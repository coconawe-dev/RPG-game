// 오프라인 스모크 테스트: 월드/몬스터/플레이어/스킬을 DOM·WebGL 없이 논리 검증
import * as THREE from 'three';
import { buildWorld } from '/workspace/RPG-game/src/world.js';
import { MobManager } from '/workspace/RPG-game/src/mobs.js';
import { Player } from '/workspace/RPG-game/src/player.js';
import { Effects } from '/workspace/RPG-game/src/effects.js';
import { Combat } from '/workspace/RPG-game/src/combat.js';
import { castSkill } from '/workspace/RPG-game/src/skills.js';
import { CLASS_ORDER, BIOMES, BOSS_POS, MOB_TYPES, SHOP, START_GOLD } from '/workspace/RPG-game/src/config.js';
import { terrainHeight, regionAt, clampToWorld, WORLD } from '/workspace/RPG-game/src/utils.js';
import { buyItem } from '/workspace/RPG-game/src/shop.js';

const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

const scene = new THREE.Scene();
const world = buildWorld(scene);
console.log('world children:', scene.children.length);
check(scene.children.length > 20, 'world produced too few objects');

// 지형 연속성: 바이옴 경계에서 높이 동일해야 함
const edgeChecks = [
  [-500, 0], [-500, 400], [500, 0], [0, -500], [0, 500], [-1499, 0], [0, -1499],
  [-1500, 0], [-1500, 420], [-2500, 0],
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

// 태초마을: 1000x1000 · 숲 서쪽 · 평화 지대
const village = BIOMES.village;
check(!!village, 'village biome missing');
check(village.bounds.x1 - village.bounds.x0 === 1000 && village.bounds.z1 - village.bounds.z0 === 1000, 'village must be 1000x1000');
check(village.center.x === -2000 && village.center.z === 0, 'village center must be (-2000, 0)');
check(regionAt(-2000, 0) === 'village', 'village region wrong');
check(regionAt(-2300, 320) === 'village', 'village region wrong (open area)');
check(regionAt(village.spawn.x, village.spawn.z) === 'village', 'village spawn is not inside village');
check(regionAt(-1000, 0) === 'forest', 'forest region broken by village');
check(!village.mob && !village.mobCount, 'village must be a peaceful zone');
// 월드 경계: 태초마을 너머로는 나갈 수 없다
const cl = clampToWorld({ x: -9999, z: 0 });
check(cl.x === WORLD.xMin, 'world clamp west failed: ' + cl.x);
const cl2 = clampToWorld({ x: -2000, z: 9999 });
// 태초마을 통로(x축) 안에서는 z가 ±500 안쪽으로 제한된다
check(Math.abs(cl2.z) <= 500 && Math.abs(cl2.z) > 480, 'world clamp south failed: ' + cl2.z);
const cl3 = clampToWorld({ x: -2000, z: 400 });
check(cl3.x === -2000 && cl3.z === 400, 'clamp moved a valid village position');

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
  gold: START_GOLD,
};
game.addGold = (n) => { game.gold += n; };   // Game.addGold 의 핵심만 흔내기내기
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
check(!game.mobManager.mobs.some((m) => regionAt(m.position.x, m.position.z) === 'village'), 'hostile mob spawned inside village');
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

/* -------------------- 골드 · 태초마을 상점 · 포션 -------------------- */
{
  const p = game.player;

  // 골드 드랍: 몬스터를 쓰러뜨리면 종류별 골드를 얻는다
  const slime = game.mobManager.mobs.find((m) => m.typeId === 'slime' && !m.dead);
  game.gold = 0;
  slime.takeDamage(99999, {});
  check(game.gold === MOB_TYPES.slime.gold, 'slime gold drop wrong: ' + game.gold);
  const zombie = game.mobManager.mobs.find((m) => m.typeId === 'zombie' && !m.dead);
  zombie.takeDamage(99999, {});
  check(game.gold === MOB_TYPES.slime.gold + MOB_TYPES.zombie.gold, 'zombie gold drop wrong: ' + game.gold);
  check(MOB_TYPES.golem.gold === 500, 'boss gold must be 500');

  // 태초마을 스폰 · 부활
  p.hp = 1;
  p.spawnAt(village.spawn.x, village.spawn.z);
  check(regionAt(p.position.x, p.position.z) === 'village', 'player spawn is not in village');
  check(p.alive && p.hp === p.maxHp, 'village respawn did not restore HP');

  // 상점 · 무기 구매
  p.equipWeaponTier(0);
  p.weaponTier = 0;
  p.weaponBonus = 0;
  p.critChance = p.cls.critChance;
  game.gold = START_GOLD;
  const baseDmg = p.damage;
  const tiers = SHOP.weapons[p.classId];
  check(tiers && tiers.length === 2, 'shop must offer 2 weapon tiers for every class');
  const t2 = tiers[0];
  const t3 = tiers[1];

  let res = buyItem(game, t2.id);
  check(res.ok, 'tier2 weapon purchase failed: ' + res.msg);
  check(game.gold === START_GOLD - t2.price, 'tier2 gold not deducted: ' + game.gold);
  check(Math.abs(p.damage - (baseDmg + t2.damage)) < 1e-6, 'tier2 damage bonus not applied: ' + p.damage);
  check(p.weaponTier === 1 && p.weaponName === t2.name, 'tier2 weapon not equipped (tier=' + p.weaponTier + ')');
  const mesh1 = p.weapons.right || p.weapons.left;
  check(mesh1 && mesh1.userData.tier === 1, '3D weapon look not upgraded at tier2');

  res = buyItem(game, t3.id);
  check(!res.ok, 'purchase should fail when gold is short');
  check(p.weaponTier === 1, 'failed purchase changed the equipped weapon');

  game.gold = 500;
  res = buyItem(game, t3.id);
  check(res.ok, 'tier3 weapon purchase failed: ' + res.msg);
  check(game.gold === 500 - t3.price, 'tier3 gold not deducted: ' + game.gold);
  check(Math.abs(p.damage - (baseDmg + t3.damage)) < 1e-6, 'tier3 bonus must replace tier2 bonus: ' + p.damage);
  const mesh2 = p.weapons.right || p.weapons.left;
  check(mesh2 && mesh2.userData.tier === 2, '3D weapon look not upgraded at tier3');

  // 포션 구매 · 사용
  const hpPotion = SHOP.potions[0];
  const atkPotion = SHOP.potions[2];
  game.gold = 400;
  const have0 = p.potionCount(hpPotion.id);
  check(have0 >= 1, 'player should start with a HP potion for testing');
  res = buyItem(game, hpPotion.id);
  check(res.ok && p.potionCount(hpPotion.id) === have0 + 1, 'potion purchase failed');
  p.hp = 10;
  const used = p.usePotion(hpPotion.id);
  check(used.ok, 'potion use failed: ' + used.msg);
  check(p.hp > 10 && p.hp <= p.maxHp, 'potion did not heal: ' + p.hp);
  check(p.potionCount(hpPotion.id) === have0, 'potion not consumed');
  p.hp = p.maxHp;
  const usedFull = p.usePotion(hpPotion.id);
  check(!usedFull.ok, 'potion used while already at full HP');
  check(p.potionCount(hpPotion.id) === have0, 'full-HP attempt consumed a potion');

  // 전투의 비약: 20초간 공격력 +35%
  const baseAfterWeapons = p.damage;
  res = buyItem(game, atkPotion.id);
  check(res.ok, 'elixir purchase failed');
  const usedElixir = p.usePotion(atkPotion.id);
  check(usedElixir.ok, 'elixir use failed: ' + usedElixir.msg);
  check(p.damage > baseAfterWeapons * 1.3, 'elixir did not raise attack: ' + p.damage);
  for (let i = 0; i < 60 * 21; i++) p.update(1 / 60, input);
  check(Math.abs(p.damage - baseAfterWeapons) < 1e-6, 'elixir buff did not expire: ' + p.damage);
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
