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
import {
  Net, encodeMsg, decodeMsg, packPlayer, unpackPlayer, packMob, unpackMob,
  makeRoomCode, normalizeRoomCode, isValidRoomCode, nearestDistance, ANIM_NAMES,
} from '/workspace/RPG-game/src/net.js';

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
check(regionAt(2000, 0) === 'old_village', 'old_village region wrong');
check(regionAt(0, -1000) === 'graveyard', 'graveyard region wrong');
check(regionAt(0, 1000) === 'jungle', 'jungle region wrong');

// 낡은 마을: 사바나 동쪽 · 1000x1000 · 약탈자
const old = BIOMES.old_village;
check(!!old, 'old_village biome missing');
check(old.bounds.x1 - old.bounds.x0 === 1000 && old.bounds.z1 - old.bounds.z0 === 1000, 'old_village must be 1000x1000');
check(old.bounds.x0 === 1500 && old.bounds.x1 === 2500 && old.bounds.z0 === -500 && old.bounds.z1 === 500, 'old_village bounds wrong');
check(old.center.x === 2000 && old.center.z === 0, 'old_village center must be (2000, 0)');
check(regionAt(1550, -420) === 'old_village', 'old_village region wrong (open area)');
check(regionAt(1499, 0) === 'savanna', 'savanna region broken by old_village');
check(old.mob === 'raider' && old.mobCount >= 12, 'old_village must spawn raiders');
const clEast = clampToWorld({ x: 9999, z: 0 });
check(clEast.x === WORLD.xMax, 'world clamp east failed: ' + clEast.x);
check(WORLD.xMax === 2470 && WORLD.xMin === -2470, 'world bounds must be -2470..2470');

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
    update() {}, showEnd() {}, hideEnd() {}, updateRoom() {}, showRoom() {}, hideRoom() {}, flashCopied() {},
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
check(counts.raider >= 10, 'old_village raiders missing: ' + counts.raider);
check(!game.mobManager.mobs.some((m) => m.typeId === 'raider' && regionAt(m.position.x, m.position.z) !== 'old_village'), 'raider spawned outside old_village');

// 강화된 고대 곰렘
check(MOB_TYPES.golem.hp === 3200, 'golem hp must be 3200, got ' + MOB_TYPES.golem.hp);
check(MOB_TYPES.golem.damage === 54, 'golem damage must be 54');
check(MOB_TYPES.golem.xp === 2500 && MOB_TYPES.golem.gold === 800, 'golem rewards must be xp 2500 / gold 800');
check(MOB_TYPES.raider.hp === 135 && MOB_TYPES.raider.attackRange === 30 && MOB_TYPES.raider.speed === 44, 'raider stats wrong');

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
  check(MOB_TYPES.golem.gold === 800, 'boss gold must be 800');

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

/* -------------------- 갑옷: 기본 맨몸 · 상점 구매 · 피해 감소 -------------------- */
{
  const p2 = new Player(game, 'warrior');
  game.player = p2;
  p2.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  input.forward = false;
  input.sprint = false;

  // 기본 캐릭터: 갑옷 없음 (흉갑 · 견갑 · 팔보호대 없이 기본 튜닉만)
  check(p2.armorTier === 0, 'default armorTier must be 0, got ' + p2.armorTier);
  check(p2.armorDefense === 0, 'default character must not reduce damage');
  check(!p2.armorChest && !p2.armorBracerL && !p2.armorBracerR, 'default character must have no 3D armor pieces');
  let torsoMeshes = 0;
  p2.torso.traverse((o) => { if (o.isMesh) torsoMeshes++; });
  const baseTorsoMeshes = torsoMeshes;
  const baseMaxHp = p2.maxHp;

  const leather = SHOP.armors[0];
  const steel = SHOP.armors[1];
  const goldArmor = SHOP.armors[2];
  check(SHOP.armors.length === 3, 'shop must offer 3 armor tiers');
  check(leather.name === '가죽 갑옷' && leather.price === 90 && leather.hp === 45 && Math.abs(leather.defense - 0.2) < 1e-9, 'leather armor terms wrong');
  check(steel.name === '강철 판금 갑옷' && steel.price === 200 && steel.hp === 110 && Math.abs(steel.defense - 0.35) < 1e-9, 'steel armor terms wrong');
  check(goldArmor.name === '황금 수호 갑옷' && goldArmor.price === 380 && goldArmor.hp === 200 && Math.abs(goldArmor.defense - 0.5) < 1e-9, 'gold armor terms wrong');

  // 골드 부족 → 실패해야 하고 아무것도 바뀌지 않는다
  game.gold = 60;
  let ares = buyItem(game, leather.id);
  check(!ares.ok, 'armor purchase should fail when gold is short');
  check(p2.armorTier === 0 && p2.maxHp === baseMaxHp && game.gold === 60, 'failed armor purchase changed the character');

  // 보유 골드를 조금 넉넉하게 주고 갑옷 구매 → 장착 · 최대 HP · 피해 감소 · 3D 갑옷
  game.gold = 500;
  ares = buyItem(game, leather.id);
  check(ares.ok, 'leather armor purchase failed: ' + ares.msg);
  check(game.gold === 500 - leather.price, 'armor gold not deducted: ' + game.gold);
  check(p2.armorTier === 1 && Math.abs(p2.armorDefense - 0.2) < 1e-9, 'leather armor not equipped');
  check(p2.maxHp === baseMaxHp + leather.hp, 'armor max HP bonus not applied: ' + p2.maxHp);
  check(!!p2.armorChest && !!p2.armorBracerL && !!p2.armorBracerR, '3D armor pieces not built');
  torsoMeshes = 0;
  p2.torso.traverse((o) => { if (o.isMesh) torsoMeshes++; });
  check(torsoMeshes > baseTorsoMeshes, 'armor meshes not attached to the body');

  // 같은 갑옷을 다시 사면 실패
  ares = buyItem(game, leather.id);
  check(!ares.ok, 'already owned armor must not be repurchased');

  // 피해 감소 계산: 100 피해 → 80 (20% 감소)
  p2.hp = p2.maxHp;
  p2.invuln = 0;
  const taken1 = p2.takeDamage(100, null);
  check(Math.abs(taken1 - 80) <= 1, '20% damage reduction wrong: ' + taken1);

  // 강철 갑옷으로 업그레이드
  game.gold = 400;
  ares = buyItem(game, steel.id);
  check(ares.ok, 'steel armor purchase failed: ' + ares.msg);
  check(p2.armorTier === 2 && Math.abs(p2.armorDefense - 0.35) < 1e-9, 'steel armor not equipped');
  check(p2.maxHp === baseMaxHp + steel.hp, 'steel max HP bonus must replace leather bonus: ' + p2.maxHp);
  p2.hp = p2.maxHp;
  p2.invuln = 0;
  const taken2 = p2.takeDamage(100, null);
  check(Math.abs(taken2 - 65) <= 1, '35% damage reduction wrong: ' + taken2);

  // 황금 갑옷 (최종 티어)
  game.gold = 400;
  ares = buyItem(game, goldArmor.id);
  check(ares.ok, 'gold armor purchase failed: ' + ares.msg);
  check(p2.armorTier === 3 && Math.abs(p2.armorDefense - 0.5) < 1e-9, 'gold armor not equipped');
  check(p2.maxHp === baseMaxHp + goldArmor.hp, 'gold max HP bonus wrong: ' + p2.maxHp);
  p2.hp = p2.maxHp;
  p2.invuln = 0;
  const taken3 = p2.takeDamage(100, null);
  check(Math.abs(taken3 - 50) <= 1, '50% damage reduction wrong: ' + taken3);
  check(p2.hp > 0, 'armor test player should survive 100 damage');
}

/* ------------------- 고대 곰렘: 격노 · 충격파 내려치기 ------------------- */
{
  const g = game.mobManager.boss();
  const hero = new Player(game, 'warrior');
  game.player = hero;
  input.forward = false;
  input.back = false;
  input.sprint = false;
  hero.spawnAt(g.position.x + 90, g.position.z);
  hero.invuln = 0;

  // 충격파: 범위 안은 맞고 범위 밖은 안 맞는다
  hero.hp = hero.maxHp;
  hero.invuln = 0;
  const hpInside = hero.hp;
  g.resolveSlam();
  check(hero.hp < hpInside, 'ground slam did not damage the player inside the radius');
  hero.hp = hero.maxHp;
  hero.invuln = 0;
  hero.position.set(g.position.x + 900, hero.position.y, g.position.z);
  const hpOutside = hero.hp;
  g.resolveSlam();
  check(hero.hp === hpOutside, 'ground slam damaged a player outside the radius');

  // 체력 50% 이하 → 격노 · 예고 링을 남기는 내려치기
  g.hp = g.maxHp * 0.45;
  g.aggro = true;
  g.slamCd = 0;
  g.attacksSinceSlam = 9;
  hero.spawnAt(g.position.x + 90, g.position.z);
  hero.hp = hero.maxHp;
  let armed = false;
  for (let i = 0; i < 180; i++) {
    stepAll(1 / 60);
    hero.invuln = 0;
    if (g.slamT > 0) { armed = true; break; }
  }
  check(g.enraged === true, 'golem did not enrage below 50% HP');
  check(armed, 'enraged golem did not start a telegraphed ground slam');
  stepAll(1 / 60);
  check(g.slamDur > 0.5, 'slam needs a visible wind-up before it hits');
  // 예고 링이 충분한 시간 남아 있어야 한다
  const slamLeft = g.slamT;
  for (let i = 0; i < 30; i++) stepAll(1 / 60);
  check(slamLeft > 0.4, 'slam telegraph too short: ' + slamLeft);
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

/* ------------------- 멀티플레이: 직렬화 · 원격 처리 · 권한 ------------------- */
{
  // 1) 메시지 인코딩 / 디코딩
  const raw = encodeMsg('st', { pid: 'ABC123', x: 1, z: 2 });
  const msg = decodeMsg(raw);
  check(!!msg && msg.t === 'st' && msg.p.pid === 'ABC123', 'encode/decode round trip failed');
  check(decodeMsg('not json') === null, 'garbage message must decode to null');
  check(decodeMsg(JSON.stringify({ x: 1 })) === null, 'message without type must decode to null');
  check(decodeMsg(undefined) === null, 'undefined message must decode to null');
  check(decodeMsg(JSON.stringify({ t: 'x', p: { a: 1 } })).p.a === 1, 'payload lost');

  // 두 중계 서버에서 같은 메시지가 두 번 와도 한 번만 처리한다
  {
    const d1 = decodeMsg(encodeMsg('st', { pid: 'A' }));
    d1.f = 'SENDER';
    d1.s = 7;
    const dup = JSON.stringify({ t: d1.t, p: d1.p, f: d1.f, s: d1.s });
    const dn = new Net({ scene, hud: game.hud, mobManager: game.mobManager });
    dn.role = 'guest';
    let handled = 0;
    dn._handleGuest = () => { handled++; };
    dn._dispatch(dup);
    dn._dispatch(dup);
    check(handled === 1, 'duplicate relay message handled ' + handled + ' times');
    check(decodeMsg(dup).f === 'SENDER' && decodeMsg(dup).s === 7, 'dedupe stamp lost in decode');
  }

  // 2) 방 코드
  for (let i = 0; i < 20; i++) {
    const c = makeRoomCode();
    check(c.length === 4 && isValidRoomCode(c), 'generated room code invalid: ' + c);
  }
  check(normalizeRoomCode(' k7-tq ') === 'K7TQ', 'room code normalize failed: ' + normalizeRoomCode(' k7-tq '));
  check(normalizeRoomCode('kO1i') === 'K', 'unusable letters must be dropped: ' + normalizeRoomCode('kO1i'));
  check(isValidRoomCode('K7TQ'), 'K7TQ must be valid');
  check(!isValidRoomCode('K7'), 'too short code must be invalid');
  check(!isValidRoomCode('K7T!'), 'symbol code must be invalid');

  // 3) 내 캐릭터 상태 직렬화
  const me = new Player(game, 'warrior');
  game.player = me;
  me.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  me.playAnim('cleave', 0.62);
  const packedMe = packPlayer('PSELF', me, { nick: '지우', classId: 'warrior' });
  const unMe = unpackPlayer(packedMe);
  check(unMe.pid === 'PSELF' && unMe.classId === 'warrior' && unMe.nick === '지우', 'player identity not serialized');
  check(Math.abs(unMe.x - me.position.x) < 0.2 && Math.abs(unMe.z - me.position.z) < 0.2, 'player position drifted');
  check(unMe.anim === 'cleave', 'player anim not serialized: ' + unMe.anim);
  check(Math.abs(unMe.animDur - 0.62) < 0.06, 'player anim duration not serialized: ' + unMe.animDur);
  check(unMe.maxHp === Math.round(me.maxHp) && unMe.alive === true, 'player hp/alive not serialized');
  check(ANIM_NAMES[0] === '' && ANIM_NAMES.indexOf('fortress') > 0, 'anim name table broken');

  // 갑옷 등급도 함께 실려 나간다 (멀티플레이 동기화)
  me.equipArmorTier(2);
  const unArmor = unpackPlayer(packPlayer('PSELF', me, { nick: '지우', classId: 'warrior' }));
  check(unArmor.armorTier === 2, 'armor tier not serialized: ' + unArmor.armorTier);
  me.equipArmorTier(0);
  const unNoArmor = unpackPlayer(packPlayer('PSELF', me, { nick: '지우', classId: 'warrior' }));
  check(unNoArmor.armorTier === 0, 'armor tier 0 must survive serialization');

  // 4) 몹 상태 직렬화 + 거리 필터
  game.mobManager.clearAll();
  const nearMob = game.mobManager.spawn('slime', { x: me.position.x + 40, z: me.position.z + 20 }, 'forest');
  const farMob = game.mobManager.spawn('gorilla', { x: 0, z: 1000 }, 'jungle');
  const um = unpackMob(packMob(nearMob));
  check(um && um.netId === nearMob.netId && um.typeId === 'slime', 'mob id/type not serialized');
  check(Math.abs(um.hp - nearMob.hp) < 0.5, 'mob hp drifted: ' + um.hp);
  check(nearestDistance([me.position], 0, 1000) > 900, 'nearestDistance wrong');

  const netH = new Net(game);
  game.net = netH;
  netH.role = 'host';
  netH.active = true;
  netH.pid = 'HOSTID';
  netH.roomCode = 'K7TQ';
  netH.nick = '나';
  const outbox = [];
  netH.publish = (ch, text) => { outbox.push([ch, decodeMsg(text)]); return true; };
  const records = netH._mobRecords();
  check(records.length === 1, 'mob snapshot must drop far mobs, got ' + records.length);

  // 5) 게스트 참가 → 원격 캐릭터 · 웰컴 메시지
  netH._acceptGuest({ pid: 'GUEST1', nick: '엄마', class: 'archer', wt: 0 });
  check(netH.remotes.size === 1 && netH.playerCount === 2, 'guest not registered');
  const gRec = netH.remotes.get('GUEST1');
  check(!!gRec.rig && gRec.rig.classId === 'archer', 'remote rig not built with the guest class');
  const welcome = outbox.filter((m) => m[1] && m[1].t === 'welcome').pop();
  check(!!welcome && welcome[1].p.hostPid === 'HOSTID', 'welcome not sent');
  check(!!welcome[1].p.spawn && Math.abs(welcome[1].p.spawn.x + 2000) < 120, 'welcome spawn not in village');

  // 6) 게스트 상태 → 원격 리그 (무기 등급 · 애니메이션)
  netH._applyRemoteState(gRec, {
    pid: 'GUEST1', x: me.position.x + 12, z: me.position.z - 8, yaw: 0.4,
    anim: 'shoot', ad: 5, hp: 90, maxHp: 120, lvl: 3, wt: 2, spd: 30, alive: true,
  });
  check(gRec.weaponTier === 2 && gRec.rig.weaponTier === 2, 'remote weapon tier not applied');
  // 갑옷 등급도 친구 화면에 반영된다
  netH._applyRemoteState(gRec, {
    pid: 'GUEST1', x: me.position.x + 12, z: me.position.z - 8, yaw: 0.4,
    anim: 'shoot', ad: 5, hp: 90, maxHp: 120, lvl: 3, wt: 2, at: 3, spd: 30, alive: true,
  });
  check(gRec.armorTier === 3 && gRec.rig.armorTier === 3, 'remote armor tier not applied');
  check(!!gRec.rig.armorChest, '3D armor not built on the remote character');
  check(gRec.anim === 'shoot' && gRec.hp === 90 && gRec.level === 3, 'remote state not stored');
  netH.update(1 / 60);
  check(gRec.rig.anim.name === 'shoot', 'remote animation not played: ' + gRec.rig.anim.name);
  check(Math.abs(gRec.rig.position.x - (me.position.x + 12)) < 8, 'remote rig did not move toward the guest');

  // 7) 몹 AI가 친구를 노릴 수 있다 (호스트 권한 대상 목록)
  const targets = netH.hostTargets();
  check(targets.length === 1 && targets[0].pid === 'GUEST1' && targets[0].remote === true, 'guest target missing');
  const mobTarget = nearMob.pickTarget();
  check(!!mobTarget && (mobTarget.remote || mobTarget.local), 'mob has no target');

  // 8) 게스트가 요청한 피해를 호스트가 검증 · 적용
  const xpBefore = me.xp;
  const levelBefore = me.level;
  const goldBefore = game.gold;
  const hpBefore = nearMob.hp;
  netH._applyGuestDamage({ pid: 'GUEST1', mob: nearMob.netId, d: 12, c: 0, cm: 1.9, dir: [1, 0], k: 6 });
  check(nearMob.hp < hpBefore, 'host did not apply guest damage');
  check(nearMob.hp > hpBefore - 20, 'guest damage was doubled or over-applied: ' + (hpBefore - nearMob.hp));
  outbox.length = 0;
  netH._applyGuestDamage({ pid: 'GUEST1', mob: nearMob.netId, d: 99999, c: 0, cm: 1.9, dir: [1, 0], k: 6 });
  check(nearMob.dead, 'huge damage did not kill the mob');
  check(netH.pendingDeaths.indexOf(nearMob.netId) >= 0, 'death not queued for the snapshot');

  // 9) 몹 사망 → 모든 참가자 보상 + 스냅샷에 사망 목록
  check(outbox.some((m) => m[1] && m[1].t === 'rw'), 'reward not broadcast');
  check(me.xp !== xpBefore || me.level > levelBefore, 'host player did not gain xp from the kill');
  check(game.gold >= goldBefore + (MOB_TYPES.slime.gold - 40), 'host player did not gain gold from the kill');
  outbox.length = 0;
  netH._broadcastWorld(false);
  const worldMsg = outbox.filter((m) => m[1] && m[1].t === 'w').pop();
  check(!!worldMsg, 'world snapshot not broadcast');
  check(worldMsg[1].p.ds.indexOf(nearMob.netId) >= 0, 'death id missing in snapshot');
  check(worldMsg[1].p.ps.length === 2, 'snapshot must include host + guest, got ' + worldMsg[1].p.ps.length);

  // 10) 게스트 화면: 월드 스냅샷 → 몹 미러 · 사망 연출 · 보상
  const netG = new Net(game);
  netG.role = 'guest';
  netG.active = true;
  netG.pid = 'GUEST1';
  netG.hostPid = 'HOSTID';
  game.net = netG;
  game.mobManager.clearAll();
  const hostMobRec = packMob({ netId: 7, typeId: 'zombie', position: new THREE.Vector3(10, 0, 10), hp: 74, maxHp: 74, attackT: 0, attackDur: 0.85, state: 'chase' });
  const hostPlayerRec = packPlayer('HOSTID', me, { nick: '아빠', classId: 'warrior' });
  netG._applyWorld({ ps: [hostPlayerRec], ms: [hostMobRec], ds: [] });
  check(netG.remotes.has('HOSTID'), 'host avatar not created on the guest');
  check(game.mobManager.mobs.length === 1 && game.mobManager.mobs[0].remote, 'mob mirror not created');
  const mirror = game.mobManager.mobs[0];
  check(mirror.netId === 7 && mirror.typeId === 'zombie' && mirror.hp === 74, 'mob mirror state wrong');
  check(Math.abs(mirror.targetPos.x - 10) < 0.2, 'mob mirror target not set');

  // 호스트의 갑옷도 친구 화면에 보인다
  me.equipArmorTier(1);
  netG._applyWorld({ ps: [packPlayer('HOSTID', me, { nick: '아빠', classId: 'warrior' })], ms: [], ds: [] });
  const hostRecArmor = netG.remotes.get('HOSTID');
  check(hostRecArmor.armorTier === 1 && hostRecArmor.rig.armorTier === 1, 'host armor tier not applied on the guest');
  // 내 상태 전송에도 갑옷 등급이 실린다
  const stOut = [];
  netG.publish = (ch, text) => { stOut.push([ch, decodeMsg(text)]); return true; };
  netG._sendLocalState();
  const stMsg = stOut.filter((m) => m[1] && m[1].t === 'st').pop();
  check(!!stMsg && stMsg[1].p.at === 1, 'guest state must carry armorTier');
  me.equipArmorTier(0);

  // 미러는 AI를 돌리지 않고 호스트 위치를 따라간다
  mirror.position.set(10, 0, 10);
  netG._applyWorld({ ps: [hostPlayerRec], ms: [packMob({ netId: 7, typeId: 'zombie', position: new THREE.Vector3(60, 0, 10), hp: 50, maxHp: 74, attackT: 0, attackDur: 0.85, state: 'chase' })], ds: [] });
  for (let i = 0; i < 20; i++) game.mobManager.update(1 / 60);
  check(mirror.position.x > 10.5, 'mob mirror did not interpolate toward host position: ' + mirror.position.x);
  check(mirror.hp === 50, 'mob mirror hp not synced');

  // 게스트 피해는 호스트에게 보내고, 화면에는 예상 피해만 표시
  const guestOut = [];
  netG.publish = (ch, text) => { guestOut.push([ch, decodeMsg(text)]); return true; };
  const mirrorHp = mirror.hp;
  game.combat.applyDamage(mirror, 10, { critChance: 0 });
  check(guestOut.some((m) => m[1] && m[1].t === 'dmg' && m[1].p.mob === 7), 'guest did not request damage from host');
  check(mirror.hp < mirrorHp, 'guest screen did not show predicted damage');
  check(mirror.hp > mirrorHp - 20, 'predicted damage too large: ' + (mirrorHp - mirror.hp));

  // 사망 연출 · 보상 적용
  netG._killMobMirror(7);
  check(mirror.dead, 'mirror did not die on snapshot death');
  const xp2 = me.xp;
  netG._applyReward({ xp: 26, gold: 30, x: 10, z: 10 });
  check(me.xp !== xp2 || me.level > 1, 'guest did not gain xp from reward');
  netG._applyWorld({ ps: [hostPlayerRec], ms: [hostMobRec], ds: [] });
  check(mirror.dead === false, 'mirror did not revive on a live snapshot');

  // 11) 게스트 → 혼자 모드 복귀
  netG.stop();
  check(!netG.active && netG.role === null, 'net did not stop');
  check(game.mobManager.mobs.length > 20 && !game.mobManager.mobs.some((m) => m.remote), 'solo mobs not restored after leaving');
  game.net = null;
}

console.log(JSON.stringify(results, null, 1));
console.log('problems:', problems.length ? problems : 'none');
console.log('scene objects:', scene.children.length, 'effects:', game.effects.items.length);
process.exit(problems.length ? 1 : 0);
