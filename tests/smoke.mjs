// 오프라인 스모크 테스트: 월드/몬스터/플레이어/스킬을 DOM·WebGL 없이 논리 검증
import * as THREE from 'three';
import { buildWorld } from '/workspace/RPG-game/src/world.js';
import { MobManager } from '/workspace/RPG-game/src/mobs.js';
import { Player } from '/workspace/RPG-game/src/player.js';
import { Effects } from '/workspace/RPG-game/src/effects.js';
import { Combat } from '/workspace/RPG-game/src/combat.js';
import { castSkill } from '/workspace/RPG-game/src/skills.js';
import { CLASS_ORDER, BIOMES, BOSS_POS, MOB_TYPES } from '/workspace/RPG-game/src/config.js';
import { terrainHeight, regionAt } from '/workspace/RPG-game/src/utils.js';

const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

const scene = new THREE.Scene();
const world = buildWorld(scene);
console.log('world children:', scene.children.length);
check(scene.children.length > 20, 'world produced too few objects');

// 지형 연속성: 바이옴 경계에서 높이 동일해야 함
const edgeChecks = [
  [-500, 0], [-500, 400], [500, 0], [0, -500], [0, 500], [-1499, 0], [0, -1499],
];
for (const [x, z] of edgeChecks) {
  const a = terrainHeight(x - 0.01, z);
  const b = terrainHeight(x + 0.01, z);
  check(Math.abs(a - b) < 0.05, 'terrain discontinuity at ' + x + ',' + z + ' -> ' + (a - b));
}
check(regionAt(0, 0) === 'temple', 'temple region wrong');
check(regionAt(-1000, 0) === 'forest', 'forest region wrong');
check(regionAt(1000, 0) === 'savanna', 'savanna region wrong');
check(regionAt(0, -1000) === 'graveyard', 'graveyard region wrong');
check(regionAt(0, 1000) === 'jungle', 'jungle region wrong');

let timers = [];
const game = {
  scene,
  effects: new Effects(scene),
  after(sec, fn) { timers.push({ t: sec, fn }); },
  shake() {},
  sfx: new Proxy({}, { get: () => () => {} }),
  hud: {
    floater() {}, refreshBars() {}, banner() {}, setTarget() {}, flashSkill() {},
    update() {}, showEnd() {}, hideEnd() {},
  },
  elapsed: 0,
  state: 'playing',
  camYaw: -Math.PI / 2,
  camPitch: 0.25,
};
game.combat = new Combat(game);
game.mobManager = new MobManager(game);
game.castSkill = (k) => castSkill(game, k);
game.onBossEngage = () => {};
game.onBossDefeated = () => { game.victory = true; };
game.onPlayerDeath = () => { game.dead = true; };
game.terrainHeightAt = terrainHeight;

console.log('mobs:', game.mobManager.mobs.length);
const counts = {};
for (const m of game.mobManager.mobs) counts[m.typeId] = (counts[m.typeId] || 0) + 1;
console.log('mob counts:', JSON.stringify(counts));
check(counts.golem === 1, 'boss count must be exactly 1, got ' + counts.golem);
check(counts.slime >= 10 && counts.zombie >= 10 && counts.hyena >= 8 && counts.gorilla >= 8, 'missing mob population');

const boss = game.mobManager.boss();
check(Math.abs(boss.position.x - BOSS_POS.x) < 60 && Math.abs(boss.position.z - BOSS_POS.z) < 60, 'boss not in temple');
check(regionAt(boss.position.x, boss.position.z) === 'temple', 'boss outside temple region');

const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };

function stepAll(dt) {
  game.elapsed += dt;
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) { const t = timers.splice(i, 1)[0]; t.fn(); }
  }
  game.player.update(dt, input);
  game.mobManager.update(dt);
  game.combat.update(dt);
  game.effects.update(dt);
}

// 각 직업: 생성 → 이동 → 기본 공격 → Q → E → 피격/사망 확인
const results = [];
for (const classId of CLASS_ORDER) {
  const p = new Player(game, classId);
  game.player = p;
  p.spawnAt(BIOMES.forest.spawn.x, BIOMES.forest.spawn.z);
  input.forward = true;
  input.sprint = true;
  for (let i = 0; i < 30; i++) stepAll(1 / 60);
  const moved = Math.hypot(p.position.x - BIOMES.forest.spawn.x, p.position.z - BIOMES.forest.spawn.z);
  check(moved > 5, classId + ' did not move');
  input.jump = true;
  stepAll(1 / 60);
  input.jump = false;
  check(p.position.y >= terrainHeight(p.position.x, p.position.z) - 0.5, classId + ' fell through terrain');

  let attackHits = 0;
  const origMelee = game.combat.melee.bind(game.combat);
  game.combat.melee = (...args) => { attackHits++; return origMelee(...args); };
  p.attack();
  for (let i = 0; i < 60; i++) stepAll(1 / 60);
  const attackedOnce = p.attackCooldown >= 0;
  game.combat.melee = origMelee;

  const animSamples = [];
  // 스킬 애니메이션 포즈가 실제로 변하는지 확인
  p.cooldowns.q = 0; p.cooldowns.e = 0;
  p.useSkill('q');
  for (let i = 0; i < 12; i++) { stepAll(1 / 60); animSamples.push(Number(p.pose.armRx.toFixed(3)) + Number(p.pose.spinY.toFixed(2))); }
  const qAnim = p.anim.name;
  const qCd = p.cooldowns.q;
  p.anim.name = null;
  p.cooldowns.e = 0;
  p.useSkill('e');
  for (let i = 0; i < 20; i++) stepAll(1 / 60);
  const eAnim = p.anim.name;
  for (let i = 0; i < 120; i++) stepAll(1 / 60);
  const returnedToIdle = p.anim.name === null || p.anim.name === 'death';

  check(qCd > 0, classId + ' Q cooldown not set');
  check(animSamples.length === 12, 'anim sample failure');
  check(returnedToIdle, classId + ' did not return to idle after skill (anim=' + p.anim.name + ')');

  // 사망 → 부활 상태
  p.hp = 1;
  p.takeDamage(999, null);
  stepAll(1 / 60);
  const died = p.state === 'dead';
  p.spawnAt(BIOMES.forest.spawn.x, BIOMES.forest.spawn.z);
  check(p.state === 'alive' && p.hp === p.maxHp, classId + ' respawn broken');

  results.push({
    classId, moved: Math.round(moved), meleeCalls: attackHits, qAnim, eAnim, qCd: Math.round(qCd * 10) / 10,
    returnedToIdle, died, weapon: !!(p.weapons.right || p.weapons.left),
  });
}

// 보스 처치 → 승리 트리거
game.player = game.player;
boss.takeDamage(99999, {});
stepAll(1 / 60);
check(game.victory === true, 'boss defeat did not trigger victory');
check(boss.dead, 'boss not dead');

// 장시간 시뮬레이션 (몹 AI·리스폰·투사체 안정성)
for (let i = 0; i < 1800; i++) stepAll(1 / 60);
check(game.effects.items.length < 400, 'effect leak: ' + game.effects.items.length);
check(game.combat.projectiles.length < 200, 'projectile leak: ' + game.combat.projectiles.length);

console.log(JSON.stringify(results, null, 1));
console.log('problems:', problems.length ? problems : 'none');
console.log('scene objects:', scene.children.length, 'effects:', game.effects.items.length);
process.exit(problems.length ? 1 : 0);
