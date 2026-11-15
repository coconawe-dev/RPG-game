// 멀티플레이: 공개 WSS 중계(MQTT)로 방을 만들어 함께 플레이한다.
//  · 호스트 권한: 몹 AI · 몹 HP · 리스폰 · 보상은 호스트만 계산한다.
//  · 게스트는 자기 캐릭터를 움직이고, 몹 스냅샷을 받아 보간해 그린다.
//  · 서버가 없는 정적 GitHub Pages에서도 동작하도록 WebSocket(MQTT) 중계만 쓴다.
import * as THREE from 'three';
import { Player } from './player.js';
import { Mob } from './mobs.js';
import { MOB_TYPES, CLASSES } from './config.js';
import { clamp, damp, dampAngle, rand, terrainHeight } from './utils.js';

/* ------------------------------ 설정값 ------------------------------ */
export const BROKERS = [
  { id: 'emqx', name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
  { id: 'hivemq', name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
];

const TOPIC_PREFIX = 'rpgmp/1/';
// 게스트가 방 응답(welcome)을 기다리는 시간 · 다시 보내는 간격
// 휴대폰 회선은 첫 패킷이 늦거나 유실될 수 있어 조금 더 길고 촘촘하게 잡는다.
const JOIN_WAIT_MS = 14000;
const JOIN_RETRY_MS = 1200;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PLAYERS = 4;

// 상태로 주고받는 애니메이션 이름 (index → 이름)
export const ANIM_NAMES = [
  '', 'cleave', 'stab', 'bash', 'shoot', 'cast', 'whirlwind', 'dashstrike',
  'multishot', 'barrage', 'ambush', 'flurry', 'shieldslam', 'fortress',
  'explosion', 'nova', 'death',
];
const ANIM_CODES = {};
ANIM_NAMES.forEach((n, i) => { if (n) ANIM_CODES[n] = i; });

export const MOB_CODES = [
  'slime', 'zombie', 'hyena', 'gorilla', 'raider', 'golem',
  'goblin', 'skeleton', 'samurai', 'iron_golem', 'dark_mage',
];
const BIOME_OF_TYPE = {
  slime: 'forest', zombie: 'graveyard', hyena: 'savanna', gorilla: 'jungle', raider: 'old_village', golem: 'temple',
  goblin: 'goblin_forest', skeleton: 'misty_plains', samurai: 'sakura', iron_golem: 'ominous_cave', dark_mage: 'dark_realm',
};

// 스냅샷 주기
const STATE_HZ = 15;       // 내 캐릭터 상태 → 호스트
const WORLD_HZ = 12.5;     // 호스트 → 월드 스냅샷
const MOB_VIEW = 900;      // 이 거리 안의 몹만 보낸다

/* --------------------------- 직렬화 도우미 --------------------------- */
function r1(v) { return Math.round((Number(v) || 0) * 10) / 10; }
function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

export function makePid() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

export function makeRoomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

// 방 코드 입력을 정규화한다 (소문자 · 붙여 쓴 기호 · 오타 문자 제거)
// 코드에 쓰지 않는 문자(O · I · 0 · 1)는 헷갈리지 않게 아예 받지 않는다.
export function normalizeRoomCode(raw) {
  if (!raw) return '';
  const s = String(raw).toUpperCase();
  let out = '';
  for (const ch of s) {
    if (CODE_ALPHABET.indexOf(ch) >= 0) out += ch;
  }
  return out.slice(0, 8);
}

export function isValidRoomCode(code) {
  if (!code || code.length < 3 || code.length > 8) return false;
  for (const ch of code) if (CODE_ALPHABET.indexOf(ch) < 0) return false;
  return true;
}

export function encodeMsg(type, payload) {
  return JSON.stringify({ t: type, p: payload === undefined ? null : payload });
}

export function decodeMsg(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 60000) return null;
  let o;
  try { o = JSON.parse(raw); } catch (e) { return null; }
  if (!o || typeof o.t !== 'string') return null;
  return { t: o.t, p: o.p === undefined ? null : o.p, f: o.f, s: o.s };
}

// 내 캐릭터 상태 → 컴팩트 배열
export function packPlayer(pid, p, extra) {
  const e = extra || {};
  return [
    pid,
    r1(p.position.x), r1(p.position.z), r2(p.facing),
    ANIM_CODES[p.anim && p.anim.name] || 0,
    Math.min(600, Math.round((p.anim && p.anim.duration || 0) * 10)),
    Math.round(p.hp || 0), Math.round(p.maxHp || 1),
    Math.round(p.level || 1), Math.round(p.weaponTier || 0),
    r1(p.speedNow || 0),
    p.alive ? 1 : 0,
    Math.round(e.gold === undefined ? 0 : e.gold),
    e.nick || '',
    e.classId || p.classId || 'warrior',
    Math.round(p.armorTier || 0),
  ];
}

export function unpackPlayer(a) {
  if (!Array.isArray(a) || a.length < 12) return null;
  return {
    pid: String(a[0]),
    x: Number(a[1]) || 0,
    z: Number(a[2]) || 0,
    yaw: Number(a[3]) || 0,
    anim: ANIM_NAMES[a[4]] || '',
    animDur: (Number(a[5]) || 0) / 10 || 0.6,
    hp: Number(a[6]) || 0,
    maxHp: Number(a[7]) || 1,
    level: Number(a[8]) || 1,
    weaponTier: Number(a[9]) || 0,
    speed: Number(a[10]) || 0,
    alive: !!a[11],
    gold: Number(a[12]) || 0,
    nick: a[13] ? String(a[13]) : '',
    classId: a[14] ? String(a[14]) : 'warrior',
    armorTier: Number(a[15]) || 0,
  };
}

// 몹 상태 → 컴팩트 배열 [id, type, x, z, hp, chasing, attackProgress, slamProgress]
export function packMob(m) {
  const atk = m.attackT > 0 ? Math.round((1 - m.attackT / (m.attackDur || 1)) * 100) : 0;
  const slam = m.slamT > 0 ? Math.round((1 - m.slamT / (m.slamDur || 1)) * 100) : 0;
  return [
    m.netId,
    MOB_CODES.indexOf(m.typeId),
    r1(m.position.x), r1(m.position.z),
    Math.round(m.hp),
    m.state === 'chase' ? 1 : 0,
    clamp(atk, 0, 100),
    clamp(slam, 0, 100),
  ];
}

export function unpackMob(a) {
  if (!Array.isArray(a) || a.length < 6) return null;
  return {
    netId: a[0],
    typeId: MOB_CODES[a[1]] || 'slime',
    x: Number(a[2]) || 0,
    z: Number(a[3]) || 0,
    hp: Number(a[4]) || 0,
    chasing: !!a[5],
    atk: Number(a[6]) || 0,
    slam: Number(a[7]) || 0,
  };
}

// 플레이어 위치들 중 가장 가까운 거리
export function nearestDistance(positions, x, z) {
  let best = Infinity;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) best = d;
  }
  return best;
}

/* ----------------------------- MQTT 클라이언트 ----------------------------- */
function utf8Bytes(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function mqttString(s) {
  const b = utf8Bytes(s);
  return [(b.length >> 8) & 255, b.length & 255].concat(b);
}

function mqttLength(n) {
  const out = [];
  do {
    let d = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) d |= 0x80;
    out.push(d);
  } while (n > 0);
  return out;
}

function bytesOf(arr) { return new Uint8Array(arr); }

export class RelayClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.buf = new Uint8Array(0);
    this.pid = 1;
    this.connected = false;
    this.onPublish = null;
    this.onClose = null;
    this._pingTimer = null;
  }

  connect(clientId, timeoutMs) {
    const self = this;
    return new Promise((resolve, reject) => {
      if (typeof WebSocket === 'undefined') { reject(new Error('이 브라우저는 WebSocket을 지원하지 않습니다')); return; }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { self.close(); } catch (e) { /* noop */ }
        reject(new Error('중계 서버 응답 없음'));
      }, timeoutMs || 9000);
      let ws;
      try {
        ws = new WebSocket(self.url, ['mqtt']);
      } catch (e) {
        clearTimeout(timer);
        reject(e);
        return;
      }
      self.ws = ws;
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        const body = mqttString('MQTT').concat([0x04, 0x02, 0x00, 0x3c]).concat(mqttString(clientId));
        ws.send(bytesOf([0x10].concat(mqttLength(body.length)).concat(body)));
      };
      ws.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error('중계 서버 접속 실패'));
      };
      ws.onclose = () => {
        self.connected = false;
        if (self._pingTimer) { clearInterval(self._pingTimer); self._pingTimer = null; }
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('중계 서버가 연결을 닫았습니다'));
          return;
        }
        if (self.onClose) self.onClose();
      };
      ws.onmessage = (ev) => {
        let chunk;
        try {
          chunk = new Uint8Array(ev.data);
        } catch (e) {
          return;
        }
        const all = new Uint8Array(self.buf.length + chunk.length);
        all.set(self.buf);
        all.set(chunk, self.buf.length);
        self.buf = all;
        self.parse((type, payload) => {
          if (type === 2 && !settled) {
            settled = true;
            clearTimeout(timer);
            self.connected = true;
            self.startPing();
            resolve(true);
          } else if (type === 3 && self.onPublish) {
            const m = self.decodePublish(payload);
            if (m) self.onPublish(m.topic, m.body);
          }
        });
      };
    });
  }

  parse(onPacket) {
    const b = this.buf;
    let i = 0;
    while (i < b.length) {
      const start = i;
      const type = b[i] >> 4;
      i++;
      let mult = 1;
      let len = 0;
      let d;
      do {
        if (i >= b.length) { this.buf = b.slice(start); return; }
        d = b[i++];
        len += (d & 127) * mult;
        mult *= 128;
      } while (d & 128);
      if (i + len > b.length) { this.buf = b.slice(start); return; }
      const payload = b.slice(i, i + len);
      i += len;
      onPacket(type, payload);
    }
    this.buf = b.slice(i);
  }

  decodePublish(payload) {
    if (payload.length < 2) return null;
    const tl = (payload[0] << 8) | payload[1];
    if (2 + tl > payload.length) return null;
    let topic = '';
    for (let i = 0; i < tl; i++) topic += String.fromCharCode(payload[2 + i]);
    const bodyBytes = payload.subarray ? payload.subarray(2 + tl) : payload.slice(2 + tl);
    let body = '';
    if (typeof TextDecoder !== 'undefined') {
      body = new TextDecoder('utf-8').decode(bodyBytes);
    } else {
      for (let j = 0; j < bodyBytes.length; j++) body += String.fromCharCode(bodyBytes[j]);
    }
    return { topic, body };
  }

  startPing() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) this.ws.send(bytesOf([0xc0, 0x00]));
    }, 25000);
  }

  subscribe(topic) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const id = this.pid++;
    const body = [(id >> 8) & 255, id & 255].concat(mqttString(topic)).concat([0x00]);
    this.ws.send(bytesOf([0x82].concat(mqttLength(body.length)).concat(body)));
  }

  publish(topic, text) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    const body = mqttString(topic).concat(utf8Bytes(text));
    this.ws.send(bytesOf([0x30].concat(mqttLength(body.length)).concat(body)));
    return true;
  }

  close() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
    this.connected = false;
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* noop */ }
      this.ws = null;
    }
  }
}

/* -------------------------------- Net -------------------------------- */
export class Net {
  constructor(game) {
    this.game = game;
    this.role = null;         // 'host' | 'guest'
    this.active = false;
    this.roomCode = '';
    this.nick = '모험가';
    this.pid = makePid();
    this.hostPid = '';
    this.transports = [];
    this.remotes = new Map(); // pid → 원격 플레이어 상태 + 3D 리그
    this.mirrors = new Map(); // netId → 게스트 쪽 몹 미러
    this.spawn = null;
    this.pendingDeaths = [];
    this.lastRecvAt = 0;
    this.lastWorldAt = 0;
    this.error = null;
    this._stateAcc = 0;
    this._worldAcc = 0;
    this._rosterDirty = false;
    this.stats = { sent: 0, recv: 0, bytes: 0 };

    // 휴대폰에서 다른 앱(카톡·문자)에 다녀오면 Safari가 연결을 잠시 멈춘다.
    // 참가 응답을 기다리는 중에 화면으로 돌아오면 join 을 바로 다시 보내 기다리는 시간을 줄인다.
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        if (this.active || this.role !== 'guest' || !this._welcomeResolve) return;
        this.publish('h', encodeMsg('join', {
          pid: this.pid, nick: this.nick, class: this.classId, wt: 0, at: 0,
        }));
      });
    }
  }

  get isHost() { return this.role === 'host'; }
  get isGuest() { return this.role === 'guest'; }
  get playerCount() { return 1 + this.remotes.size; }

  /* ------------------------------ 방 만들기 / 참가 ------------------------------ */
  async host(classId, nick, onStatus) {
    this.role = 'host';
    this.nick = (nick || '모험가').slice(0, 10);
    this.pid = makePid();
    this.roomCode = makeRoomCode();
    this.hostPid = this.pid;
    if (onStatus) onStatus('방을 여는 중…');
    await this._connectAll(onStatus);
    const topic = this._topic('h');
    for (const t of this.transports) {
      t.subscribe(topic);
      t.onPublish = (tp, body) => { if (tp === topic) this._onHostMessage(body); };
    }
    this.lastRecvAt = Date.now();
    return this.roomCode;
  }

  async join(code, classId, nick, onStatus) {
    this.role = 'guest';
    this.nick = (nick || '모험가').slice(0, 10);
    this.pid = makePid();
    this.roomCode = normalizeRoomCode(code);
    this.classId = classId;
    if (onStatus) onStatus('방을 찾는 중…');
    // 호스트가 어느 중계 서버에 있든 만날 수 있게, 연결되는 서버에 모두 붙는다
    await this._connectAll(onStatus);
    const back = this._topic('g');
    for (const t of this.transports) {
      t.subscribe(back);
      t.onPublish = (tp, body) => { if (tp === back) this._onGuestMessage(body); };
    }

    const welcome = new Promise((resolve, reject) => {
      this._welcomeResolve = resolve;
      this._welcomeReject = reject;
      // 호스트 응답이 늦어질 때(휴대폰 느린 네트워크·호스트가 아직 준비 중) 기다리는 중임을 계속 알려 준다
      const startedAt = Date.now();
      this._joinTick = setInterval(() => {
        const s = Math.round((Date.now() - startedAt) / 1000);
        if (s === 4 && onStatus) onStatus('방 <b>' + this.roomCode + '</b> 에 연결하는 중…');
        else if (s === 8 && onStatus) onStatus('아직 응답이 없습니다 · 방 코드를 다시 확인해 주세요');
      }, 1000);
      setTimeout(() => {
        if (this._welcomeResolve) {
          this._welcomeResolve = null;
          this._welcomeReject = null;
          this._clearJoinRetry();
          reject(new Error('방을 찾지 못했습니다. 방 코드를 확인하거나, 호스트가 아직 게임을 시작하지 않았다면 시작한 뒤 다시 참가해 주세요.'));
        }
      }, JOIN_WAIT_MS);
    });
    this.publish('h', encodeMsg('join', {
      pid: this.pid, nick: this.nick, class: classId, wt: 0, at: 0,
    }));
    // 호스트가 곧바로 응답하지 못하는 경우(구독 직후·패킷 유실)를 대비해 짧게 여러 번 다시 보낸다
    this._joinRetry = setInterval(() => {
      if (this.active || !this._welcomeResolve) return;
      this.publish('h', encodeMsg('join', { pid: this.pid, nick: this.nick, class: classId, wt: 0, at: 0 }));
    }, JOIN_RETRY_MS);
    const data = await welcome;
    this._clearJoinRetry();
    this.hostPid = data.hostPid;
    this.spawn = data.spawn || null;
    this.lastRecvAt = Date.now();
    return data;
  }

  _clearJoinRetry() {
    if (this._joinRetry) { clearInterval(this._joinRetry); this._joinRetry = null; }
    if (this._joinTick) { clearInterval(this._joinTick); this._joinTick = null; }
  }

  // 연결되는 중계 서버에 모두 붙는다 — 어느 쪽에 있든 서로 만나게 하기 위해 (병렬 접속)
  async _connectAll(onStatus) {
    if (onStatus) onStatus('중계 서버 접속 중…');
    const attempts = BROKERS.map(async (b) => {
      const c = new RelayClient(b.url);
      try {
        await c.connect('rpg' + makePid() + Math.random().toString(36).slice(2, 6), 9000);
        return c;
      } catch (e) {
        c.close();
        return null;
      }
    });
    const results = await Promise.all(attempts);
    const ok = results.filter(Boolean);
    if (!ok.length) throw new Error('멀티플레이 중계 서버에 접속하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    this.transports = ok;
    this.lastRecvAt = Date.now();
    return ok;
  }

  _topic(kind) { return TOPIC_PREFIX + this.roomCode + '/' + kind; }

  // 같은 메시지가 여러 중계 서버로 두 번 도착할 수 있어 (보낸이,순번)으로 걸러 낸다
  _stamp(text) {
    if (typeof text !== 'string' || text.length < 3 || text[0] !== '{' || text[text.length - 1] !== '}') return text;
    this._seq = (this._seq || 0) + 1;
    return text.slice(0, -1) + ',"f":"' + this.pid + '","s":' + this._seq + '}';
  }

  _seenAlready(key) {
    const now = Date.now();
    if (!this._seen) this._seen = new Map();
    const at = this._seen.get(key);
    if (at && now - at < 4000) return true;
    this._seen.set(key, now);
    if (this._seen.size > 240) {
      for (const [k, t] of this._seen) {
        if (now - t > 4000) this._seen.delete(k);
      }
    }
    return false;
  }

  publish(channel, text) {
    const stamped = this._stamp(text);
    let sent = false;
    for (const t of this.transports) {
      if (t.publish(this._topic(channel), stamped)) sent = true;
    }
    if (sent) {
      this.stats.sent++;
      this.stats.bytes += stamped.length;
    }
    return sent;
  }

  /* ------------------------------ 메시지 처리 ------------------------------ */
  _dispatch(raw) {
    const msg = decodeMsg(raw);
    if (!msg) return;
    if (msg.p && msg.p.pid === this.pid) return;  // 내가 보낸 메시지 무시
    if (msg.f !== undefined && msg.s !== undefined) {
      if (this._seenAlready(msg.f + ':' + msg.s)) return;
    }
    this.stats.recv++;
    this.lastRecvAt = Date.now();
    if (this.isHost) this._handleHost(msg);
    else this._handleGuest(msg);
  }

  _onHostMessage(raw) { this._dispatch(raw); }
  _onGuestMessage(raw) { this._dispatch(raw); }

  _handleHost(msg) {
    const p = msg.p || {};
    if (msg.t === 'join') {
      this._acceptGuest(p);
    } else if (msg.t === 'st') {
      const r = this.remotes.get(p.pid);
      if (!r) return;
      this._applyRemoteState(r, p);
    } else if (msg.t === 'dmg') {
      this._applyGuestDamage(p);
    } else if (msg.t === 'bye') {
      this._dropRemote(p.pid);
    }
  }

  _handleGuest(msg) {
    if (msg.t === 'welcome') {
      if (this._welcomeResolve) {
        const res = this._welcomeResolve;
        this._welcomeResolve = null;
        this._welcomeReject = null;
        res(msg.p || {});
      }
    } else if (msg.t === 'w') {
      this._applyWorld(msg.p || {});
    } else if (msg.t === 'rw') {
      this._applyReward(msg.p || {});
    } else if (msg.t === 'hitp') {
      const p = msg.p || {};
      if (p.pid !== this.pid) return;
      const pl = this.game.player;
      if (!pl || !pl.alive) return;
      const src = p.x === undefined ? null : new THREE.Vector3(p.x, 0, p.z);
      pl.takeDamage(Number(p.d) || 1, src);
    } else if (msg.t === 'bye') {
      if (msg.p && msg.p.pid === this.hostPid) this._hostGone();
      else this._dropRemote(msg.p && msg.p.pid);
    } else if (msg.t === 'full') {
      this.error = '방이 가득 찼습니다.';
      // 14초를 기다리지 않고 바로 알린다
      if (this._welcomeReject) {
        const rej = this._welcomeReject;
        this._welcomeResolve = null;
        this._welcomeReject = null;
        this._clearJoinRetry();
        rej(new Error('방이 가득 찼습니다 (최대 4명). 다른 방을 만들거나 참가해 주세요.'));
      }
      this.stop();
    }
  }

  /* ------------------------------ 호스트 동작 ------------------------------ */
  _acceptGuest(p) {
    if (!p || !p.pid) return;
    if (this.remotes.has(p.pid)) {
      const r = this.remotes.get(p.pid);
      r.lastAt = Date.now();
      this._sendWelcome(p.pid);
      return;
    }
    if (this.remotes.size + 1 >= MAX_PLAYERS) {
      this.publish('g', encodeMsg('full', { pid: p.pid }));
      return;
    }
    const classId = CLASSES[p.class] ? p.class : 'warrior';
    const spawn = this._spawnPoint(this.remotes.size + 1);
    const rig = this._makeRig(p.pid, classId, p.wt || 0, spawn, p.at || 0);
    const rec = {
      pid: p.pid,
      nick: (p.nick || '친구').slice(0, 10),
      classId,
      weaponTier: 0,
      armorTier: clamp(Math.round(p.at || 0), 0, 3),
      level: 1,
      hp: rig.maxHp,
      maxHp: rig.maxHp,
      alive: true,
      x: spawn.x,
      z: spawn.z,
      yaw: spawn.yaw,
      anim: '',
      animDur: 0,
      speed: 0,
      rig,
      target: new THREE.Vector3(spawn.x, 0, spawn.z),
      targetYaw: spawn.yaw,
      lastAt: Date.now(),
    };
    this.remotes.set(p.pid, rec);
    this._sendWelcome(p.pid);
    this._broadcastWorld(true);
    this.game.hud.banner(rec.nick + ' 님이 들어왔습니다', 2000);
    this.game.sfx.levelup();
  }

  _sendWelcome(pid) {
    const rec = this.remotes.get(pid);
    if (!rec) return;
    const p = this.game.player;
    const payload = {
      hostPid: this.pid,
      nick: this.nick,
      roomCode: this.roomCode,
      spawn: this._spawnPoint(this.remotes.size + 1),
      players: this._playerRecords(),
      mobs: this._mobRecords(),
      host: p ? packPlayer(this.pid, p, { nick: this.nick, classId: p.classId }) : null,
    };
    this.publish('g', encodeMsg('welcome', payload));
  }

  _spawnPoint(index) {
    const base = this.spawn || { x: -2000, z: 95 };
    const a = (index || 1) * 1.1;
    const x = base.x + Math.cos(a) * 26;
    const z = base.z + Math.sin(a) * 26;
    return { x, z, yaw: Math.PI };
  }

  _makeRig(pid, classId, weaponTier, spawn, armorTier) {
    const rig = new Player(this.game, classId);
    rig.isRemote = true;
    rig.weaponBonus = 0;
    if (weaponTier) rig.equipWeaponTier(Math.min(2, Math.max(0, weaponTier)));
    if (armorTier) rig.equipArmorTier(Math.min(3, Math.max(0, armorTier)));
    rig.spawnAt(spawn.x, spawn.z);
    rig.facing = spawn.yaw;
    rig.root.rotation.y = spawn.yaw;
    return rig;
  }

  _applyRemoteState(rec, p) {
    rec.lastAt = Date.now();
    rec.x = Number(p.x) || 0;
    rec.z = Number(p.z) || 0;
    rec.yaw = Number(p.yaw) || 0;
    // 친구가 다른 세계로 넘어갔으면 그 모습은 그 세계에서만 보인다
    const w = Number(p.w) === 2 ? 2 : 1;
    if (w !== rec.world) {
      rec.world = w;
      if (rec.rig) rec.rig.root.visible = (w === (this.game.worldId || 1));
    }
    rec.anim = typeof p.anim === 'string' ? p.anim : (ANIM_NAMES[p.anim] || '');
    rec.animDur = (Number(p.ad) || 0) / 10 || 0;
    rec.hp = Number(p.hp) || 0;
    rec.maxHp = Number(p.maxHp) || rec.maxHp;
    rec.level = Number(p.lvl) || 1;
    const wt = Number(p.wt) || 0;
    if (wt !== rec.weaponTier) {
      rec.weaponTier = wt;
      if (rec.rig) rec.rig.equipWeaponTier(Math.min(2, Math.max(0, wt)));
    }
    const at = clamp(Math.round(Number(p.at) || 0), 0, 3);
    if (at !== rec.armorTier) {
      rec.armorTier = at;
      if (rec.rig) rec.rig.equipArmorTier(at);
    }
    rec.alive = p.alive !== false;
    rec.speed = Number(p.spd) || 0;
    if (rec.nickValue) rec.nick = p.nick || rec.nick;
    rec.target.set(rec.x, 0, rec.z);
    rec.targetYaw = rec.yaw;
  }

  _applyGuestDamage(p) {
    const mob = this._mobByNetId(p.mob);
    if (!mob || mob.dead) return;
    const amount = clamp(Number(p.d) || 0, 1, 3000);
    const crit = Math.random() < clamp(Number(p.c) || 0, 0, 1);
    const dir = Array.isArray(p.dir) && p.dir.length === 2
      ? new THREE.Vector3(Number(p.dir[0]) || 0, 0, Number(p.dir[1]) || 0).normalize()
      : null;
    const dmg = amount * (crit ? (Number(p.cm) || 1.9) : 1) * rand(0.94, 1.06);
    mob.takeDamage(dmg, { crit, dir, knock: clamp(Number(p.k) || 6, 0, 40) });
  }

  _mobByNetId(id) {
    const mobs = this.game.mobManager ? this.game.mobManager.mobs : [];
    for (let i = 0; i < mobs.length; i++) if (mobs[i].netId === id) return mobs[i];
    return null;
  }

  /* ------------------------------ 게스트 동작 ------------------------------ */
  _applyWorld(p) {
    const ps = Array.isArray(p.ps) ? p.ps : [];
    for (const raw of ps) {
      const st = unpackPlayer(raw);
      if (!st || st.pid === this.pid) continue;
      let rec = this.remotes.get(st.pid);
      if (!rec) {
        const spawn = { x: st.x, z: st.z, yaw: st.yaw };
        const rig = this._makeRig(st.pid, st.classId, st.weaponTier, spawn, st.armorTier);
        rec = {
          pid: st.pid, nick: st.nick || (st.pid === this.hostPid ? '호스트' : '친구'),
          classId: st.classId, weaponTier: st.weaponTier, armorTier: st.armorTier || 0, level: st.level,
          hp: st.hp, maxHp: st.maxHp, alive: st.alive,
          x: st.x, z: st.z, yaw: st.yaw, anim: st.anim, animDur: st.animDur,
          speed: st.speed, rig,
          target: new THREE.Vector3(st.x, 0, st.z), targetYaw: st.yaw,
          lastAt: Date.now(),
        };
        this.remotes.set(st.pid, rec);
        if (st.pid === this.hostPid) this.game.hud.banner(st.nick + ' 님의 방에 들어왔습니다', 2200);
      }
      rec.lastAt = Date.now();
      rec.x = st.x; rec.z = st.z; rec.yaw = st.yaw;
      rec.anim = st.anim;
      rec.animDur = st.animDur;
      rec.hp = st.hp; rec.maxHp = st.maxHp; rec.level = st.level;
      rec.alive = st.alive;
      rec.speed = st.speed;
      rec.nick = st.nick || rec.nick;
      if (st.weaponTier !== rec.weaponTier) {
        rec.weaponTier = st.weaponTier;
        if (rec.rig) rec.rig.equipWeaponTier(Math.min(2, Math.max(0, rec.weaponTier)));
      }
      if ((st.armorTier || 0) !== rec.armorTier) {
        rec.armorTier = clamp(Math.round(st.armorTier || 0), 0, 3);
        if (rec.rig) rec.rig.equipArmorTier(rec.armorTier);
      }
      rec.target.set(st.x, 0, st.z);
      rec.targetYaw = st.yaw;
    }
    const ms = Array.isArray(p.ms) ? p.ms : [];
    for (const raw of ms) {
      const m = unpackMob(raw);
      if (m) this._applyMob(m);
    }
    const ds = Array.isArray(p.ds) ? p.ds : [];
    for (const id of ds) this._killMobMirror(id);
  }

  _applyMob(m) {
    let mob = this.mirrors.get(m.netId);
    if (!mob) {
      const type = MOB_TYPES[m.typeId];
      if (!type) return;
      mob = new Mob(this.game, m.typeId, { x: m.x, z: m.z }, BIOME_OF_TYPE[m.typeId] || 'forest');
      mob.netId = m.netId;
      mob.remote = true;
      mob.targetPos = new THREE.Vector3(m.x, 0, m.z);
      this.mirrors.set(m.netId, mob);
      this.game.mobManager.mobs.push(mob);
    }
    mob.hp = m.hp;
    mob.targetPos.set(m.x, 0, m.z);
    mob.remoteChase = m.chasing;
    mob.remoteAtk = m.atk;
    mob.state = m.chasing ? 'chase' : 'idle';
    mob.attackT = m.atk > 0 ? mob.attackDur * (1 - m.atk / 100) : 0;
    mob.attackHit = m.atk > 0;
    mob.slamDur = mob.type.slamWindup || 1.5;
    mob.slamT = m.slam > 0 ? mob.slamDur * (1 - m.slam / 100) : 0;
    if (mob.dead && m.hp > 0) {
      mob.dead = false;
      mob.deadT = 0;
      mob.root.visible = true;
      mob.root.scale.setScalar(1);
      mob.root.rotation.z = 0;
    }
    mob.lastSeen = Date.now();
  }

  _killMobMirror(netId) {
    const mob = this.mirrors.get(netId);
    if (!mob || mob.dead) return;
    mob.dead = true;
    mob.deadT = 0;
    mob.state = 'dead';
    mob.aggro = false;
    mob.hp = 0;
    mob.targetPos.copy(mob.position);
    const pos = mob.position;
    this.game.effects.burst(
      new THREE.Vector3(pos.x, pos.y + mob.height * 0.5, pos.z),
      mob.type.boss ? 0x9fe8ff : 0xffcf8a,
      mob.type.boss ? 40 : 14,
      { power: mob.type.boss ? 60 : 26, size: mob.type.boss ? 2.2 : 0.8 }
    );
    if (mob.type.boss) this.game.onBossDefeated(mob);
  }

  _applyReward(p) {
    const xp = Number(p.xp) || 0;
    const gold = Number(p.gold) || 0;
    this._grant(xp, gold, p.x, p.z);
  }

  _grant(xp, gold, x, z) {
    const pl = this.game.player;
    if (!pl) return;
    if (xp > 0) {
      pl.gainXp(xp);
      if (x !== undefined) {
        this.game.hud.floater('+' + xp + ' XP', new THREE.Vector3(x, terrainHeight(x, z || 0) + 12, z || 0), 'xp', 1.5);
      }
    }
    if (gold > 0) {
      this.game.addGold(gold, x === undefined ? null : new THREE.Vector3(x, terrainHeight(x, z || 0), z || 0));
    }
  }

  _hostGone() {
    this.game.hud.banner('호스트 연결이 끊겼습니다 · 혼자 플레이로 돌아갑니다', 3000);
    this.stop();
  }

  _dropRemote(pid) {
    const rec = this.remotes.get(pid);
    if (!rec) return;
    if (rec.rig) {
      this.game.scene.remove(rec.rig.root);
      rec.rig.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    this.remotes.delete(pid);
    this.game.hud.banner(rec.nick + ' 님이 나갔습니다', 1800);
    if (this.isHost) this._broadcastWorld(true);
  }

  /* ------------------------------ 전투 연결점 ------------------------------ */
  // 호스트 몹 AI가 노릴 수 있는 대상들 (내 캐릭터 + 원격 친구들)
  hostTargets() {
    const out = [];
    for (const rec of this.remotes.values()) {
      out.push({
        pid: rec.pid,
        remote: true,
        alive: rec.alive,
        radius: 4.6,
        position: new THREE.Vector3(rec.x, 0, rec.z),
      });
    }
    return out;
  }

  hitGuest(pid, amount, srcPos) {
    if (!this.isHost) return;
    this.publish('g', encodeMsg('hitp', {
      pid,
      d: Math.max(1, Math.round(amount)),
      x: srcPos ? Math.round(srcPos.x) : 0,
      z: srcPos ? Math.round(srcPos.z) : 0,
    }));
  }

  // 게스트가 몹에게 입힌 피해 → 호스트가 검증·적용
  requestDamage(mob, amount, opts) {
    if (!this.active || !mob || mob.netId === undefined) return 0;
    const o = opts || {};
    const critChance = clamp(Number(o.critChance) || 0, 0, 1);
    const critMul = Number(o.critMul) || 1.9;
    const crit = Math.random() < critChance;
    const dmg = amount * (crit ? critMul : 1) * rand(0.94, 1.06);
    // 예측 표시 — 호스트 스냅샷이 곧 실제 HP로 덮어쓴다
    if (typeof mob.applyPredictedDamage === 'function') mob.applyPredictedDamage(dmg, crit);
    const dir = o.dir ? [Number(o.dir.x) || 0, Number(o.dir.z) || 0] : [0, 0];
    this.publish('h', encodeMsg('dmg', {
      pid: this.pid,
      mob: mob.netId,
      d: Math.round(amount * 10) / 10,
      c: Math.round(critChance * 100) / 100,
      cm: critMul,
      dir,
      k: Number(o.knock) || 6,
    }));
    return dmg;
  }

  // 몹이 죽었을 때 (호스트에서만 호출) — 모든 참가자에게 보상
  onMobDeath(mob) {
    if (!this.isHost || !this.active) return false;
    this.pendingDeaths.push(mob.netId);
    const xp = (mob.type && mob.type.xp) || 0;
    const gold = (mob.type && mob.type.gold) || 0;
    this._grant(xp, gold, mob.position.x, mob.position.z);
    this.publish('g', encodeMsg('rw', {
      xp, gold,
      x: Math.round(mob.position.x),
      z: Math.round(mob.position.z),
    }));
    return true;
  }

  /* ------------------------------ 매 프레임 ------------------------------ */
  attach() {
    this.active = true;
    this.lastRecvAt = Date.now();
    this.lastWorldAt = Date.now();
    if (this.isHost) {
      this._spawnFrom = this.game.player ? this.game.player.position.clone() : null;
      this._broadcastWorld(true);
    } else if (this.game.mobManager) {
      // 게스트는 로컬 몹 시뮬레이션을 버리고 호스트 스냅샷만 그린다
      this.game.mobManager.clearAll();
      this.mirrors.clear();
    }
    this._tick = this._tick || 0;
    // 탭이 백그라운드로 가면 requestAnimationFrame 이 멈춥니다.
    // 그래도 연결은 살아 있길래, 숨겨진 동안에는 타이머로 최소한만 주고받게 한다.
    if (!this._idleTimer) {
      this._idleTimer = setInterval(() => {
        if (!this.active) return;
        const hidden = typeof document !== 'undefined' && document.hidden;
        if (!hidden) return;
        if (this.isHost) this._broadcastWorld(false);
        else if (this.game.player) this._sendLocalState();
      }, 400);
    }
  }

  _sendLocalState() {
    const p = this.game.player;
    if (!p) return;
    this.publish('h', encodeMsg('st', {
      pid: this.pid,
      x: p.position.x, z: p.position.z, yaw: p.facing,
      anim: ANIM_CODES[p.anim.name || ''] || 0,
      ad: Math.round((p.anim.duration || 0) * 10),
      hp: p.hp, maxHp: p.maxHp, lvl: p.level, wt: p.weaponTier, at: p.armorTier || 0,
      spd: p.speedNow, alive: p.alive, w: this.game.worldId || 1,
    }));
  }

  update(dt) {
    if (!this.active) return;
    this._tick += dt;

    // 내 상태 전송
    if (this.isGuest && this.game.player) {
      this._stateAcc += dt;
      if (this._stateAcc >= 1 / STATE_HZ) {
        this._stateAcc = 0;
        this._sendLocalState();
      }
    }

    // 호스트: 월드 스냅샷
    if (this.isHost) {
      this._worldAcc += dt;
      if (this._worldAcc >= 1 / WORLD_HZ) {
        this._worldAcc = 0;
        this._broadcastWorld(false);
      }
    }

    // 원격 캐릭터 보간 · 렌더
    for (const rec of this.remotes.values()) {
      this._updateRemote(rec, dt);
    }

    this._checkTimeouts();
  }

  _updateRemote(rec, dt) {
    const rig = rec.rig;
    if (!rig) return;
    const k = 1 - Math.exp(-11 * dt);
    rig.position.x += (rec.target.x - rig.position.x) * k;
    rig.position.z += (rec.target.z - rig.position.z) * k;
    rig.position.y = terrainHeight(rig.position.x, rig.position.z);
    rig.updateRemote(dt, {
      yaw: rec.targetYaw,
      anim: rec.anim,
      animDur: rec.animDur,
      speed: rec.speed,
      weaponTier: rec.weaponTier,
      armorTier: rec.armorTier || 0,
      alive: rec.alive,
    });
    if (!rec.alive && rig.state !== 'dead') {
      rig.state = 'dead';
      rig.playAnim('death', 1.4);
    } else if (rec.alive && rig.state === 'dead') {
      rig.state = 'alive';
      rig.anim.name = null;
    }
  }

  _checkTimeouts() {
    const now = Date.now();
    if (this.isHost) {
      for (const [pid, rec] of [...this.remotes]) {
        if (now - rec.lastAt > 22000) this._dropRemote(pid);
      }
    } else if (this.active && now - this.lastRecvAt > 25000) {
      this._hostGone();
    }
  }

  _playerRecords() {
    const list = [];
    if (this.game.player) {
      list.push(packPlayer(this.pid, this.game.player, { nick: this.nick, classId: this.game.player.classId }));
    }
    for (const rec of this.remotes.values()) {
      list.push([
        rec.pid, r1(rec.x), r1(rec.z), r2(rec.yaw),
        ANIM_CODES[rec.anim] || 0, Math.round((rec.animDur || 0) * 10),
        Math.round(rec.hp), Math.round(rec.maxHp), rec.level, rec.weaponTier,
        r1(rec.speed), rec.alive ? 1 : 0, 0, rec.nick, rec.classId, rec.armorTier || 0,
      ]);
    }
    return list;
  }

  _mobRecords() {
    const mobs = this.game.mobManager ? this.game.mobManager.mobs : [];
    const anchors = [];
    if (this.game.player) anchors.push(this.game.player.position);
    for (const rec of this.remotes.values()) anchors.push({ x: rec.x, z: rec.z });
    const out = [];
    for (let i = 0; i < mobs.length; i++) {
      const m = mobs[i];
      if (m.dead || m.remote) continue;
      if (m.netId === undefined) continue;
      if (anchors.length && nearestDistance(anchors, m.position.x, m.position.z) > MOB_VIEW) continue;
      out.push(packMob(m));
    }
    return out;
  }

  _broadcastWorld(full) {
    if (!this.active || !this.isHost) return;
    const ds = this.pendingDeaths.slice();
    this.pendingDeaths.length = 0;
    const payload = { ps: this._playerRecords(), ms: this._mobRecords(), ds };
    if (full) payload.full = 1;
    this.publish('g', encodeMsg('w', payload));
  }

  /* ------------------------------ 정리 ------------------------------ */
  stop(reason) {
    if (this.active && this.role) {
      try {
        this.publish(this.isHost ? 'g' : 'h', encodeMsg('bye', { pid: this.pid, reason: reason || '' }));
      } catch (e) { /* noop */ }
    }
    this.active = false;
    if (this._idleTimer) { clearInterval(this._idleTimer); this._idleTimer = null; }
    this._clearJoinRetry();
    // 참가 대기 중에 연결이 끊긴 경우 대기하던 join 을 바로 정리한다
    if (this._welcomeReject) {
      const rej = this._welcomeReject;
      this._welcomeResolve = null;
      this._welcomeReject = null;
      try { rej(new Error('방 연결이 끊어졌습니다. 잠시 뒤 다시 시도해 주세요.')); } catch (e) { /* noop */ }
    }
    for (const t of this.transports) {
      try { t.close(); } catch (e) { /* noop */ }
    }
    this.transports = [];
    // 원격 캐릭터 제거
    for (const [pid, rec] of [...this.remotes]) {
      if (rec.rig) this.game.scene.remove(rec.rig.root);
      this.remotes.delete(pid);
    }
    // 몹 미러 제거 → 혼자 모드로 복귀
    if (this.isGuest && this.game.mobManager) {
      this.game.mobManager.clearAll();
    }
    this.mirrors.clear();
    const wasGuest = this.isGuest;
    this.role = null;
    this.roomCode = '';
    if (wasGuest && this.game.mobManager) this.game.mobManager.spawnAll();
    this.game.hud.hideRoom();
  }
}

/* ----------------------------- 화면 표시용 ----------------------------- */
export function playerListForHud(net, self) {
  const out = [];
  if (self) out.push({ pid: net.pid, nick: net.nick, classId: self.classId, level: self.level, hp: self.hp, maxHp: self.maxHp, me: true });
  for (const rec of net.remotes.values()) {
    out.push({ pid: rec.pid, nick: rec.nick, classId: rec.classId, level: rec.level, hp: rec.hp, maxHp: rec.maxHp, me: false });
  }
  return out;
}
