// 함께 하기: 몹이 친구(동료)를 때리는지 '진짜 두 Net 인스턴스'로 끝까지 검증한다.
//  · 중계 서버(MQTT) 대신 메모리 안 허브로 두 클라이언트를 잇는다 → publish/subscribe 부터
//    _dispatch · _handleGuest · hitp 수신 · player.takeDamage 까지 실제 코드 경로를 그대로 지난다.
//  · 호스트 게임과 게스트 게임을 각각 실제 프레임처럼 update 해서, 화면에서 보이는 상태
//    (친구 체력)가 정말 줄어드는지 확인한다.
import * as THREE from 'three';
import { Net, encodeMsg } from '/workspace/RPG-game/src/net.js';
import { Player } from '/workspace/RPG-game/src/player.js';
import { Mob, MobManager } from '/workspace/RPG-game/src/mobs.js';
import { Effects } from '/workspace/RPG-game/src/effects.js';
import { BIOMES, MOB_TYPES } from '/workspace/RPG-game/src/config.js';
import { terrainHeight, clampToWorld } from '/workspace/RPG-game/src/utils.js';

const noop = () => {};
const NO_INPUT = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, block: false };

/* ----------------------------- 메모리 MQTT 허브 ----------------------------- */
class Hub {
  constructor() { this.clients = []; }
  add(c) { this.clients.push(c); return c; }
  deliver(from, topic, text) {
    for (const c of this.clients) {
      if (c === from) continue;                       // MQTT: 발행자 자신에게는 돌아오지 않는다
      if (!c.subs.has(topic)) continue;
      if (c.onPublish) c.onPublish(topic, text);
    }
  }
}
class FakeClient {
  constructor(hub) { this.hub = hub; this.subs = new Set(); this.onPublish = null; this.sent = 0; this.closed = false; }
  subscribe(topic) { this.subs.add(topic); }
  publish(topic, text) { this.sent++; this.hub.deliver(this, topic, text); return true; }
  close() { this.closed = true; }
}

/* -------------------------------- 가짜 게임 -------------------------------- */
function hudStub() {
  return new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop) });
}
function gameStub(name) {
  const g = {
    name,
    scene: new THREE.Scene(),
    timers: [],
    elapsed: 0,
    state: 'playing',
    worldId: 1,
    world2Unlocked: false,
    gold: 0,
    hits: [],
    after(sec, fn) { g.timers.push({ t: sec, fn }); },
    shake: noop,
    sfx: new Proxy({}, { get: () => noop }),
    addGold: noop,
    recordKill: () => null,
    onBossDefeated: noop,
    onBossEngage: noop,
    onPlayerDeath: noop,
  };
  g.hud = hudStub();
  g.effects = new Effects(g.scene);
  g.player = new Player(g, 'warrior');
  g.player.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  g.combatTargets = () => {
    const list = [];
    if (g.player && g.player.alive) {
      list.push({ local: true, alive: true, radius: g.player.radius, position: g.player.position, world: g.worldId });
    }
    if (g.net && g.net.active && g.net.isHost) {
      for (const t of g.net.hostTargets()) list.push(t);
    }
    return list;
  };
  return g;
}

/* ------------------------------ 방을 잇는다 ------------------------------ */
function connectPair() {
  const hub = new Hub();
  const hostGame = gameStub('host');
  const guestGame = gameStub('guest');
  hostGame.mobManager = new MobManager(hostGame);
  hostGame.mobManager.mobs.length = 0;
  guestGame.mobManager = new MobManager(guestGame);
  guestGame.mobManager.mobs.length = 0;

  const hostNet = new Net(hostGame);
  hostGame.net = hostNet;
  hostNet.role = 'host';
  hostNet.roomCode = 'TEST';
  hostNet.pid = 'HOST01';
  hostNet.hostPid = 'HOST01';
  hostNet.nick = '방장';
  hostNet.transports = [hub.add(new FakeClient(hub))];
  hostNet.transports[0].subscribe(hostNet._topic('h'));
  hostNet.transports[0].onPublish = (tp, body) => { if (tp === hostNet._topic('h')) hostNet._onHostMessage(body); };
  hostNet.active = true;
  hostNet.lastRecvAt = Date.now();

  const guestNet = new Net(guestGame);
  guestGame.net = guestNet;
  guestNet.role = 'guest';
  guestNet.roomCode = 'TEST';
  guestNet.pid = 'GUEST1';
  guestNet.nick = '친구';
  guestNet.classId = 'warrior';
  guestNet.transports = [hub.add(new FakeClient(hub))];
  guestNet.transports[0].subscribe(guestNet._topic('g'));
  guestNet.transports[0].onPublish = (tp, body) => { if (tp === guestNet._topic('g')) guestNet._onGuestMessage(body); };
  guestNet.active = true;
  guestNet.lastRecvAt = Date.now();

  // 게스트가 방에 들어온다 (실제 join 경로: join 메시지 → welcome)
  guestNet.publish('h', encodeMsg('join', { pid: guestNet.pid, nick: guestNet.nick, class: 'warrior', wt: 0, at: 0 }));
  const rec = hostNet.remotes.get(guestNet.pid);
  return { hub, hostGame, guestGame, hostNet, guestNet, rec };
}

// 실제 프레임처럼 두 게임을 함께 돌린다
function runFrames(pair, seconds, opts) {
  const o = opts || {};
  const dt = 1 / 60;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    pair.hostGame.player.update(dt, NO_INPUT);
    pair.hostGame.mobManager.update(dt);
    pair.hostGame.effects.update(dt);
    pair.hostNet.update(dt);                        // 몹 스냅샷 · 원격 캐릭터
    pair.guestGame.player.update(dt, NO_INPUT);
    pair.guestGame.mobManager.update(dt);           // 게스트 화면의 몹 미러
    pair.guestGame.effects.update(dt);
    pair.guestNet.update(dt);                       // 내 상태 전송 · 수신
    if (o.onFrame) o.onFrame(i);
  }
}

/* ================= 1) 11종 몹이 모두 게스트를 실제로 때린다 ================= */
export function runMpLoopbackChecks(check) {

const MP_TYPES = ['slime', 'zombie', 'hyena', 'gorilla', 'raider', 'golem', 'goblin', 'skeleton', 'samurai', 'iron_golem', 'dark_mage'];
const biomeFor = (typeId) => Object.keys(BIOMES).find((id) => BIOMES[id] && BIOMES[id].mob === typeId) || 'forest';

for (const typeId of MP_TYPES) {
  for (const hostFar of [false, true]) {
    const pair = connectPair();
    const { hostGame, guestGame, hostNet } = pair;
    const biomeId = biomeFor(typeId);
    const world = BIOMES[biomeId].world === 2 ? 2 : 1;
    const center = BIOMES[biomeId].center;
    hostGame.worldId = world;
    const mob = new Mob(hostGame, typeId, { x: center.x, z: center.z }, biomeId);
    mob.netId = 0;
    mob.attackCd = 0.05;
    hostGame.mobManager.mobs.push(mob);
    // 호스트: 가까이(같은 바이옴) 또는 아주 멀리(다른 바이옴 · 컬링 거리 밖)
    if (hostFar) {
      const far = clampToWorld({ x: center.x - 1600, z: center.z - 1600 }, world);
      hostGame.player.spawnAt(far.x, far.z);
    } else {
      hostGame.player.spawnAt(center.x, center.z + 420);
    }
    // 게스트: 몹 사거리 안
    const gx = center.x;
    const gz = center.z + MOB_TYPES[typeId].attackRange * 0.5;
    guestGame.worldId = world;
    guestGame.player.spawnAt(gx, gz);
    const hp0 = guestGame.player.hp;
    runFrames(pair, 6);
    const lost = hp0 - guestGame.player.hp;
    const tag = typeId + (hostFar ? ' (호스트가 멀리)' : '');
    check(lost > 0, tag + ' must cost the teammate HP over the network (lost ' + lost + ')');
    check(hostNet.remotes.get('GUEST1').hp < hp0, tag + ': the host must see the teammate HP drop too (' +
      hostNet.remotes.get('GUEST1').hp + ' of ' + hp0 + ')');
    check(Number.isFinite(lost), tag + ': hp must stay a number');
  }
}

/* ================= 2) 다른 세계의 친구는 이 세계 몹에게 맞지 않는다 ================= */
{
  const pair = connectPair();
  const { hostGame, guestGame } = pair;
  hostGame.worldId = 1;
  const center = BIOMES.forest.center;
  const mob = new Mob(hostGame, 'slime', { x: center.x, z: center.z }, 'forest');
  mob.netId = 0;
  hostGame.mobManager.mobs.push(mob);
  hostGame.player.spawnAt(center.x, center.z + 300);
  // 게스트는 2세계 마을에 있다 (1세계 숲 몹과는 다른 세계)
  guestGame.worldId = 2;
  const home2 = BIOMES.village_w2.spawn;
  guestGame.player.spawnAt(home2.x, home2.z);
  const hp0 = guestGame.player.hp;
  runFrames(pair, 5);
  check(guestGame.player.hp === hp0, 'a teammate in another world must not be hit (' + (hp0 - guestGame.player.hp) + ')');
  // 세계 판정 자체도 확인한다 — 다른 세계의 상대는 처음부터 대상이 아니다
  check(mob.canTarget({ alive: true, world: 2, radius: 4.6, position: new THREE.Vector3(center.x, 0, center.z + 5) }) === false,
    'a world 1 mob must refuse a world 2 target');
  check(mob.canTarget({ alive: true, world: 1, radius: 4.6, position: new THREE.Vector3(center.x, 0, center.z + 5) }) === true,
    'a world 1 mob must accept a world 1 target');
}

/* ================= 3) 게스트가 2세계로 가면 그 세계 몹도 세워지고 때린다 ================= */
{
  const pair = connectPair();
  const { hostGame, guestGame, hostNet } = pair;
  hostGame.worldId = 1;                       // 호스트는 1세계 마을에 그대로
  hostGame.player.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  const w2 = BIOMES.goblin_forest;
  guestGame.worldId = 2;
  // 고블린 무리가 있는 자리로 보낸다
  const gl = new Mob(hostGame, 'goblin', { x: w2.center.x, z: w2.center.z }, 'goblin_forest');
  gl.netId = 900;
  hostGame.mobManager.mobs.push(gl);
  guestGame.player.spawnAt(w2.center.x, w2.center.z + 14);
  runFrames(pair, 0.4);
  const rec = hostNet.remotes.get('GUEST1');
  check(rec.world === 2, 'host must learn the teammate moved to world 2 (got ' + rec.world + ')');
  const spawned = hostGame.mobManager.mobs.filter((m) => m.worldId === 2 && m.netId !== 900);
  check(spawned.length > 0, 'world 2 mobs must be spawned on the host when a teammate enters world 2 (' + spawned.length + ')');
  const hp0 = guestGame.player.hp;
  runFrames(pair, 5);
  check(guestGame.player.hp < hp0, 'a teammate in world 2 must be hit by world 2 mobs (lost ' + (hp0 - guestGame.player.hp) + ')');
  check(hostGame.worldId === 1, 'the host must stay in world 1');
}

/* ================= 4) 두 친구 중 맞은 사람만 피해를 받는다 ================= */
{
  const pair = connectPair();
  const { guestGame, hostNet } = pair;
  const hp0 = guestGame.player.hp;
  runFrames(pair, 1);                             // 스폰 무적이 풀릴 만큼
  const hp1 = guestGame.player.hp;
  hostNet.hitGuest('GUEST1', 17, null);
  check(hp1 - guestGame.player.hp > 0, 'hitGuest must reach the guest through the network (lost ' + (hp1 - guestGame.player.hp) + ')');
  const hp2 = guestGame.player.hp;
  hostNet.hitGuest('SOMEONE_ELSE', 17, null);
  check(guestGame.player.hp === hp2, 'damage aimed at another pid must not hit this guest');
  // 출처 위치가 없으면 밀려나지 않는다 (원점 기준 넉백 금지)
  const before = guestGame.player.position.clone();
  guestGame.player.invuln = 0;
  hostNet.hitGuest('GUEST1', 1, null);
  check(guestGame.player.position.distanceTo(before) < 0.001, 'a hit without a source position must not shove the player');
  // 출처 위치가 있으면 그 반대로 밀려난다
  const before2 = guestGame.player.position.clone();
  guestGame.player.invuln = 0;
  hostNet.hitGuest('GUEST1', 1, { x: before2.x, z: before2.z + 40 });
  check(guestGame.player.position.distanceTo(before2) > 0.5, 'a hit with a source position must knock the player away');
  check(hp0 === hp1, 'standing still at spawn must not cost HP on its own');
}

/* ================= 5) 방이 가득 찼다는 안내도 게스트에게 도착한다 ================= */
{
  const pair = connectPair();
  const { guestNet, hostNet } = pair;
  let got = false;
  guestNet._handleGuest = ((orig) => function (msg) {
    if (msg.t === 'full') got = true;
    return orig.call(this, msg);
  })(guestNet._handleGuest);
  hostNet.publish('g', encodeMsg('full', { pid: guestNet.pid }));
  check(got, 'the "room is full" notice must reach the guest it is addressed to');
}

}
