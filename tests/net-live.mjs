// 수동 점검: 실제 중계 서버를 통해 호스트와 게스트가 방을 열고 참가하는지 (DOM·WebGL 없이)
// 실행: node --experimental-websocket tests/net-live.mjs
import * as THREE from 'three';
import { buildWorld } from '../src/world.js';
import { MobManager } from '../src/mobs.js';
import { Player } from '../src/player.js';
import { Effects } from '../src/effects.js';
import { Combat } from '../src/combat.js';
import { Net } from '../src/net.js';
import { BIOMES } from '../src/config.js';

function makeGame(tag) {
  const scene = new THREE.Scene();
  buildWorld(scene);
  let timers = [];
  const game = {
    tag,
    scene,
    effects: new Effects(scene),
    sfx: new Proxy({}, { get: () => () => {} }),
    hud: {
      floater() {}, refreshBars() {}, banner() {}, setTarget() {}, flashSkill() {},
      update() {}, showEnd() {}, hideEnd() {}, updateRoom() {}, showRoom() {}, hideRoom() {}, flashCopied() {},
    },
    state: 'playing',
    camYaw: 0,
    gold: 100,
    elapsed: 0,
    after(sec, fn) { timers.push({ t: sec, fn }); },
    shake() {},
    addGold(n) { game.gold += n; },
    castSkill() { return false; },
    onBossEngage() {},
    onBossDefeated() {},
    onPlayerDeath() {},
    terrainHeightAt() { return 0; },
    combatTargets() {
      const list = [];
      if (game.player && game.player.alive) list.push({ local: true, alive: true, radius: game.player.radius, position: game.player.position });
      if (game.net) for (const t of game.net.hostTargets()) list.push(t);
      return list;
    },
  };
  game.combat = new Combat(game);
  game.mobManager = new MobManager(game);
  return game;
}

async function main() {
  const host = makeGame('host');
  host.net = new Net(host);
  const code = await host.net.host('warrior', '나', (s) => console.log('host:', s));
  console.log('방 코드:', code, '· 연결된 중계 서버:', host.net.transports.length);
  host.player = new Player(host, 'warrior');
  host.player.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  host.net.spawn = { x: BIOMES.village.spawn.x, z: BIOMES.village.spawn.z };
  host.net.attach();

  const guest = makeGame('guest');
  guest.net = new Net(guest);
  const welcome = await guest.net.join(code, 'mage', '친구', (s) => console.log('guest:', s));
  console.log('웰컴 수신 · 호스트:', welcome.hostPid, '· 스폰:', JSON.stringify(welcome.spawn), '· 몹 기록:', welcome.mobs.length);
  guest.player = new Player(guest, 'mage');
  guest.player.spawnAt(welcome.spawn.x, welcome.spawn.z);
  guest.net.attach();

  // 1.5초 동안 서로 상태를 주고받는다
  const start = Date.now();
  let hostTicks = 0;
  let guestTicks = 0;
  while (Date.now() - start < 1600) {
    host.net.update(1 / 60); hostTicks++;
    guest.net.update(1 / 60); guestTicks++;
    // 게스트를 조금 움직인다
    guest.player.position.x += 0.6;
    await new Promise((r) => setTimeout(r, 16));
  }
  await new Promise((r) => setTimeout(r, 400));

  const problems = [];
  if (host.net.remotes.size !== 1) problems.push('호스트가 게스트를 보지 못함 (remotes=' + host.net.remotes.size + ')');
  if (guest.net.remotes.size !== 1) problems.push('게스트가 호스트를 보지 못함 (remotes=' + guest.net.remotes.size + ')');
  if (guest.net.mirrors.size < 1) problems.push('게스트 몹 미러가 없음 (' + guest.net.mirrors.size + ')');
  if (host.net.stats.recv < 2) problems.push('호스트 수신 없음 (' + host.net.stats.recv + ')');
  if (guest.net.stats.recv < 2) problems.push('게스트 수신 없음 (' + guest.net.stats.recv + ')');
  const rec = [...host.net.remotes.values()][0];
  if (rec && Math.abs(rec.x - guest.player.position.x) > 90) problems.push('호스트가 본 게스트 위치가 어긋남 (' + Math.round(rec.x) + ' vs ' + Math.round(guest.player.position.x) + ')');
  if (rec && (rec.nick !== '친구' || rec.classId !== 'mage')) problems.push('원격 닉네임/직업 불일치 ' + rec.nick + '/' + rec.classId);

  console.log('호스트: remotes=' + host.net.remotes.size + ' recv=' + host.net.stats.recv + ' sent=' + host.net.stats.sent);
  console.log('게스트: remotes=' + guest.net.remotes.size + ' mirrors=' + guest.net.mirrors.size + ' recv=' + guest.net.stats.recv + ' sent=' + guest.net.stats.sent);
  if (rec) console.log('호스트가 본 친구: ' + rec.nick + ' · ' + rec.classId + ' · hp ' + Math.round(rec.hp) + ' · x ' + Math.round(rec.x));
  console.log('problems:', problems.length ? problems : 'none');
  host.net.stop();
  guest.net.stop();
  process.exit(problems.length ? 1 : 0);
}

main().catch((e) => { console.error('실패:', e); process.exit(1); });
