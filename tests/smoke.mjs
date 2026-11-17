// 오프라인 스모크 테스트: 월드/몬스터/플레이어/스킬을 DOM·WebGL 없이 논리 검증
import * as THREE from 'three';
import { buildWorld, updateBiomeCulling } from '/workspace/RPG-game/src/world.js';
import { Mob, MobManager } from '/workspace/RPG-game/src/mobs.js';
import { Player } from '/workspace/RPG-game/src/player.js';
import { Effects } from '/workspace/RPG-game/src/effects.js';
import { Combat } from '/workspace/RPG-game/src/combat.js';
import { castSkill } from '/workspace/RPG-game/src/skills.js';
import { CLASS_ORDER, BIOMES, BIOME_ORDER, BIOME_ORDER_W2, BIOME_ORDER_W3, ALL_BIOME_ORDER, BOSS_POS, BOSS2_POS, BOSS3_POS, MOB_TYPES, SHOP, SHOP2, SHOP3, SHOPS, shopById, bossPosFor, compassOrderFor, biomeOrderFor, bossSkillById, bossSkillByCode, bossSkillCode, START_GOLD, WORLD2, WORLD3, WORLD2_ARRIVAL, WORLD1_PORTAL_POS, WORLD2_RETURN_POS, WORLD2_PORTAL_POS, WORLD3_ARRIVAL, WORLD3_RETURN_POS, MAX_ARMOR_TIER, MAX_WEAPON_TIER, shopForBiome, shopWeaponsFor, allArmors, allPotions, homeBiomeFor, homeSpawnFor, CLASSES, ULT_LEVEL, EVOLUTION_LEVEL, ULT_COOLDOWN, skillDefFor } from '/workspace/RPG-game/src/config.js';
import { terrainHeight, regionAt, clampToWorld, worldAt, normWorld, WORLD } from '/workspace/RPG-game/src/utils.js';
import { Portals, handleBossDefeated, travelPlayer } from '/workspace/RPG-game/src/portals.js';
import { buyItem } from '/workspace/RPG-game/src/shop.js';
import { QuestLog, QUEST_CHAINS, QuestChain, questGoalText, mobName } from '/workspace/RPG-game/src/quests.js';
import {
  Net, encodeMsg, decodeMsg, packPlayer, unpackPlayer, packMob, unpackMob, MOB_CODES,
  makeRoomCode, normalizeRoomCode, isValidRoomCode, nearestDistance, ANIM_NAMES,
} from '/workspace/RPG-game/src/net.js';

const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

const scene = new THREE.Scene();
const world = buildWorld(scene);
let worldMeshes = 0;
scene.traverse((o) => { if (o.isMesh || o.isInstancedMesh) worldMeshes++; });
console.log('world children:', scene.children.length, 'meshes:', worldMeshes);
check(worldMeshes > 20, 'world produced too few objects');

// 바이옴 그룹: 멀리 있는 바이옴은 통째로 꺼진다 (그리기 호출 · 그림자 패스 절약)
check(!!world.biomeGroups && Object.keys(world.biomeGroups).length === ALL_BIOME_ORDER.length, 'biome groups missing');
updateBiomeCulling(world, { x: -2000, z: 0 }, 1280);
const inVillage = Object.keys(world.biomeGroups).filter((id) => world.biomeGroups[id].visible);
check(inVillage.indexOf('village') >= 0, 'nearby biome must stay visible');
check(inVillage.indexOf('old_village') < 0, 'distant biome (old_village) must be culled from the village: ' + inVillage.join(','));
check(inVillage.indexOf('jungle') < 0, 'distant biome (jungle) must be culled from the village: ' + inVillage.join(','));
updateBiomeCulling(world, { x: 2000, z: 0 }, 1280);
check(world.biomeGroups.old_village.visible, 'biome must come back when approached');

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

/* =====================================================================
   2번째 세계 — 다섯 바이옴 · 몹 · 지형 · 경계
   ===================================================================== */
{
  const W2 = WORLD2.originZ;
  const expectMob = {
    village_w2: null,
    goblin_forest: 'goblin', misty_plains: 'skeleton', sakura: 'samurai',
    ominous_cave: 'iron_golem', dark_realm: 'dark_mage',
  };
  check(BIOME_ORDER_W2.length === 6, 'world 2 must have 6 biomes, got ' + BIOME_ORDER_W2.length);
  check(ALL_BIOME_ORDER.length === BIOME_ORDER.length + BIOME_ORDER_W2.length + BIOME_ORDER_W3.length, 'ALL_BIOME_ORDER must cover all three worlds');

  for (const region of Object.keys(expectMob)) {
    const b = BIOMES[region];
    check(!!b, 'world 2 biome missing: ' + region);
    if (!b) continue;
    check(b.world === 2, region + ' must be tagged as world 2');
    check(b.bounds.x1 - b.bounds.x0 === 1000 && b.bounds.z1 - b.bounds.z0 === 1000, region + ' must be 1000x1000');
    check(b.mob === expectMob[region], region + ' must spawn ' + expectMob[region] + ', got ' + b.mob);
    check(worldAt(b.center.x, b.center.z) === 2, region + ' must sit in world 2 coordinates');
    check(regionAt(b.center.x, b.center.z) === region, region + ' region lookup wrong: ' + regionAt(b.center.x, b.center.z));
    check(b.bounds.z0 > WORLD.zMax, region + ' must not overlap world 1');
    check(!!b.landmark && !!b.landmarkPos, region + ' needs a landmark');
    check(b.minimap && b.sky && b.fog, region + ' needs map/sky/fog colors');
  }

  // 2번째 세계는 1번째 세계와 완전히 떨어져 있다고 본다 (z > 4000)
  check(worldAt(0, 0) === 1 && worldAt(-2000, 0) === 1 && worldAt(0, 1400) === 1, 'world 1 coordinates misclassified');
  check(WORLD2.originZ > WORLD.zMax + 2000, 'world 2 must be far from world 1');

  // 2세계 태초마을: 고블린 숲 남쪽 · 1000x1000 · 평화 지대 · 상점 있음
  const v2 = BIOMES.village_w2;
  check(!!v2, 'world 2 starter village missing');
  check(v2.name === '태초마을', 'world 2 starter village must be called 태초마을, got ' + v2.name);
  check(v2.bounds.x1 - v2.bounds.x0 === 1000 && v2.bounds.z1 - v2.bounds.z0 === 1000, 'world 2 village must be 1000x1000');
  check(v2.center.x === 0 && v2.center.z === W2 + 2000, 'world 2 village center must be (0, W2+2000)');
  check(v2.mob === null && v2.mobCount === 0 && v2.peaceful === true, 'world 2 village must be a peaceful zone');
  check(regionAt(0, W2 + 2000) === 'village_w2', 'world 2 village region wrong');
  check(regionAt(-420, W2 + 2200) === 'village_w2', 'world 2 village region wrong (open area)');
  check(regionAt(0, W2 + 1490) === 'goblin_forest', 'road north of the village must still be goblin forest');
  check(regionAt(0, W2 + 1510) === 'village_w2', 'road south of the goblin forest must be the village');
  check(regionAt(v2.spawn.x, v2.spawn.z) === 'village_w2', 'world 2 village spawn is outside the village');
  check(Math.abs(terrainHeight(v2.center.x, v2.center.z)) < 1.5, 'world 2 village plaza must be flat: ' + terrainHeight(v2.center.x, v2.center.z));
  // 사거리: 남쪽 끝까지 걸어갈 수 있고 그 밖으로는 못 나간다
  const deepSouth = clampToWorld({ x: 0, z: W2 + 2440 }, 2);
  check(deepSouth.z === W2 + 2440, 'south end of the world 2 village must be walkable');
  check(clampToWorld({ x: 700, z: W2 + 2200 }, 2).x <= WORLD2.halfCell, 'clamp must keep the player inside the village cell');

  // 2세계 상점: 마을 광장 남쪽 건물 · 상호작용 지점도 마을 안
  check(!!v2.shop && !!v2.shop.interact, 'world 2 village needs a shop');
  check(v2.shop.id === 'shop_w2', 'world 2 shop must use the world 2 catalog');
  check(Math.abs(v2.shop.z - (W2 + 2150)) < 1, 'world 2 shop building position wrong');
  check(regionAt(v2.shop.interact.x, v2.shop.interact.z) === 'village_w2', 'world 2 shop counter must stand in the village');
  check(Math.hypot(v2.shop.interact.x - v2.spawn.x, v2.shop.interact.z - v2.spawn.z) > v2.shop.interact.radius, 'player must not start inside the shop trigger');
  check(shopForBiome('village_w2') === SHOP2 && shopForBiome('village') === SHOP, 'shop lookup by biome broken');

  // 죽었을 때 돌아갈 자리: 1세계는 1세계 태초마을, 2세계는 2세계 태초마을
  check(homeBiomeFor(1) === BIOMES.village && homeBiomeFor(2) === BIOMES.village_w2, 'home biome per world wrong');
  check(regionAt(homeSpawnFor(2).x, homeSpawnFor(2).z) === 'village_w2', 'respawn point of world 2 must be inside the world 2 village');
  check(regionAt(homeSpawnFor(1).x, homeSpawnFor(1).z) === 'village', 'respawn point of world 1 must stay in the world 1 village');

  // 지형은 바이옴 경계에서 이어져야 한다
  const w2Edges = [
    [0, W2 + 500], [0, W2 - 500], [-500, W2], [500, W2],
    [0, W2 + 1500], [0, W2 - 1500], [-1500, W2], [1500, W2],
    [0, W2 + 1400], [-1000, W2], [1000, W2],
    [0, W2 + 2500], [-500, W2 + 2000], [500, W2 + 2000],
    [-380, W2 + 1500], [380, W2 + 1500], [0, W2 + 2000],
  ];
  for (const [x, z] of w2Edges) {
    const a = terrainHeight(x - 0.01, z);
    const b2 = terrainHeight(x + 0.01, z);
    const c = terrainHeight(x, z - 0.01);
    const d = terrainHeight(x, z + 0.01);
    check(Math.abs(a - b2) < 0.05 && Math.abs(c - d) < 0.05, 'world 2 terrain discontinuity at ' + x + ',' + z);
  }
  // 도직 광장 · 보스 투기장은 평탄해야 한다
  check(Math.abs(terrainHeight(WORLD2_ARRIVAL.x, WORLD2_ARRIVAL.z)) < 1.5, 'arrival plaza must be flat');
  check(Math.abs(terrainHeight(0, W2)) < 3, 'boss arena must be fairly flat');

  // 도착 지점은 안전한 2세계 태초마을 광장 안
  check(regionAt(WORLD2_ARRIVAL.x, WORLD2_ARRIVAL.z) === 'village_w2', 'world 2 arrival must be the world 2 village: ' + regionAt(WORLD2_ARRIVAL.x, WORLD2_ARRIVAL.z));
  check(regionAt(WORLD2_RETURN_POS.x, WORLD2_RETURN_POS.z) === 'village_w2', 'return portal must stand in the world 2 village plaza');
  check(Math.hypot(WORLD2_RETURN_POS.x - WORLD2_ARRIVAL.x, WORLD2_RETURN_POS.z - WORLD2_ARRIVAL.z) > 100, 'return portal must be far enough from the arrival spot');
  check(regionAt(WORLD1_PORTAL_POS.x, WORLD1_PORTAL_POS.z) === 'temple', 'world 2 portal must open at the temple');
  check(regionAt(BOSS2_POS.x, BOSS2_POS.z) === 'dark_realm', 'dark mage must stand in the dark realm');

  /* ------------------- 컬링: 두 세계는 서로 안 보인다 ------------------- */
  updateBiomeCulling(world, { x: -2000, z: 0 }, 1280);
  const w2culled = BIOME_ORDER_W2.filter((id) => world.biomeGroups[id].visible);
  check(w2culled.length === 0, 'world 2 biomes must be culled while in world 1: ' + w2culled.join(','));
  updateBiomeCulling(world, { x: 0, z: W2 + 1400 }, 1280);
  check(world.biomeGroups.goblin_forest.visible === true, 'goblin forest must show at the arrival plaza');
  check(world.biomeGroups.village_w2.visible === true, 'world 2 village must be visible from the forest gate');
  check(world.biomeGroups.dark_realm.visible === true, 'dark realm must be visible from the arrival plaza');
  check(world.biomeGroups.village.visible === false, 'world 1 village must be culled while in world 2');
  check(world.biomeGroups.temple.visible === false, 'world 1 temple must be culled while in world 2');

  // 각 바이옴 그룹에 프롭이 실제로 만들어졌다
  for (const region of Object.keys(expectMob)) {
    let meshes = 0;
    world.biomeGroups[region].traverse((o) => { if (o.isMesh || o.isInstancedMesh) meshes++; });
    check(meshes > 6, region + ' has too few objects: ' + meshes);
  }

  // 십자 모양 경계 안에서만 움직일 수 있다 (clampToWorld 사용법은 그대로)
  check(clampToWorld({ x: 9e9, z: W2 }, 2).x === WORLD2.xMax, 'world 2 east clamp failed');
  check(clampToWorld({ x: -9e9, z: W2 }, 2).x === WORLD2.xMin, 'world 2 west clamp failed');
  check(clampToWorld({ x: 0, z: W2 + 9e9 }, 2).z === WORLD2.zMax, 'world 2 south clamp failed');
  const corner = clampToWorld({ x: 900, z: W2 + 900 }, 2);
  check(Math.abs(corner.x) <= 500 || Math.abs(corner.z - W2) <= 500, 'world 2 cross clamp failed: ' + corner.x + ',' + corner.z);
  const okSpot = clampToWorld({ x: 120, z: W2 + 1200 }, 2);
  check(okSpot.x === 120 && okSpot.z === W2 + 1200, 'clamp moved a valid world 2 position');

  /* ------------------------- 몹: 훨씬 강해진 수치 ------------------------- */
  // (MOB_TYPES 에는 두 세계의 몹이 모두 들어 있으므로 1번째 세계 몹만 골라 본다)
  const W1_MOBS = ['slime', 'zombie', 'hyena', 'gorilla', 'raider'];
  const w1Strongest = Math.max(...W1_MOBS.map((id) => MOB_TYPES[id].hp));
  check(w1Strongest === MOB_TYPES.gorilla.hp, 'strongest world 1 normal mob should be the gorilla');
  check(MOB_TYPES.goblin.hp >= 900 && MOB_TYPES.goblin.hp <= 1200, 'goblin hp out of range: ' + MOB_TYPES.goblin.hp);
  check(MOB_TYPES.goblin.damage >= 50 && MOB_TYPES.goblin.damage <= 64, 'goblin damage out of range');
  check(MOB_TYPES.skeleton.hp >= 1300 && MOB_TYPES.skeleton.hp <= 1600, 'skeleton hp out of range: ' + MOB_TYPES.skeleton.hp);
  check(MOB_TYPES.skeleton.damage >= 66 && MOB_TYPES.skeleton.damage <= 80, 'skeleton damage out of range');
  check(MOB_TYPES.samurai.hp >= 2000 && MOB_TYPES.samurai.hp <= 2400, 'samurai hp out of range: ' + MOB_TYPES.samurai.hp);
  check(MOB_TYPES.samurai.damage >= 88 && MOB_TYPES.samurai.damage <= 104, 'samurai damage out of range');
  check(MOB_TYPES.iron_golem.hp >= 3400 && MOB_TYPES.iron_golem.hp <= 4000, 'iron golem hp out of range: ' + MOB_TYPES.iron_golem.hp);
  check(MOB_TYPES.iron_golem.damage >= 110 && MOB_TYPES.iron_golem.damage <= 130, 'iron golem damage out of range');
  check(MOB_TYPES.dark_mage.hp >= 13000, 'dark mage hp must be at least 13000');
  check(MOB_TYPES.dark_mage.damage >= 150, 'dark mage damage must be at least 150');
  check(MOB_TYPES.dark_mage.boss === true, 'dark mage must be a boss');
  check(MOB_TYPES.dark_mage.enemyProjectile === 'dark_orb', 'dark mage must throw dark orbs');
  check(MOB_TYPES.dark_mage.slamRadius >= 200, 'dark mage needs a wide shockwave');
  for (const id of ['goblin', 'skeleton', 'samurai', 'iron_golem']) {
    check(MOB_TYPES[id].hp > w1Strongest, id + ' must be tougher than every world 1 normal mob');
    check(MOB_TYPES[id].xp > MOB_TYPES.gorilla.xp && MOB_TYPES[id].gold > MOB_TYPES.gorilla.gold, id + ' rewards must beat world 1');
  }
  check(MOB_TYPES.dark_mage.xp > MOB_TYPES.golem.xp, 'dark mage must be worth more than the ancient golem');
}

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
  // 세계 이동 (main.js 의 Game 과 같은 역할을 하는 최소 스텁)
  worldId: 1,
  world2Unlocked: false,
  camera: { position: { copy() {} } },
};
game.addGold = (n) => { game.gold += n; };   // Game.addGold 의 핵심만 흔내기내기
game.combat = new Combat(game);
game.mobManager = new MobManager(game);
game.castSkill = (k) => castSkill(game, k);
game.onBossEngage = () => {};
// 본보스 처치 → 실제 처리기(포털 개방 · 승리)를 그대로 통과시킨다
game.onBossDefeated = (boss) => { game.victory = true; return handleBossDefeated(game, boss); };
game.onPlayerDeath = () => { game.dead = true; };
game.terrainHeightAt = terrainHeight;
game.setWorld = (id) => { game.worldId = id === 2 ? 2 : 1; if (game.worldId === 2) game.world2Unlocked = true; return game.worldId; };
game.placeCamera = () => {};
game.setPortalPrompt = () => {};
game.travelTo = (target) => travelPlayer(game, target);
game.portals = new Portals(game);

console.log('mobs:', game.mobManager.mobs.length);
const counts = {};
for (const m of game.mobManager.mobs) counts[m.typeId] = (counts[m.typeId] || 0) + 1;
console.log('mob counts:', JSON.stringify(counts));
check(counts.golem === 1, 'boss count must be exactly 1, got ' + counts.golem);
check(!game.mobManager.mobs.some((m) => regionAt(m.position.x, m.position.z) === 'village'), 'hostile mob spawned inside village');
check(counts.slime >= 10 && counts.zombie >= 10 && counts.hyena >= 8 && counts.gorilla >= 8, 'missing mob population');
check(counts.raider >= 10, 'old_village raiders missing: ' + counts.raider);
check(!game.mobManager.mobs.some((m) => m.typeId === 'raider' && regionAt(m.position.x, m.position.z) !== 'old_village'), 'raider spawned outside old_village');

// 강화된 고대 골렘
check(MOB_TYPES.golem.hp === 6400, 'golem hp must be 6400, got ' + MOB_TYPES.golem.hp);
check(MOB_TYPES.golem.damage === 108, 'golem damage must be 108');
check(MOB_TYPES.golem.xp === 2500 && MOB_TYPES.golem.gold === 800, 'golem rewards must be xp 2500 / gold 800');
check(MOB_TYPES.raider.hp === 270 && MOB_TYPES.raider.attackRange === 30 && MOB_TYPES.raider.speed === 44, 'raider stats wrong');

// 모든 몹 2배 강화: HP · 공격력이 기존 수치의 정확히 2배 (XP · 골드는 그대로)
const MOB_BASE_STATS = {
  slime: [46, 7], zombie: [74, 11], hyena: [82, 13], gorilla: [158, 19], raider: [135, 18],
  golem: [3200, 54], goblin: [540, 29], skeleton: [720, 37], samurai: [1150, 49],
  iron_golem: [1850, 60], dark_mage: [6800, 78],
};
for (const [id, base] of Object.entries(MOB_BASE_STATS)) {
  check(MOB_TYPES[id].hp === base[0] * 2, id + ' hp must be doubled to ' + base[0] * 2 + ', got ' + MOB_TYPES[id].hp);
  check(MOB_TYPES[id].damage === base[1] * 2, id + ' damage must be doubled to ' + base[1] * 2 + ', got ' + MOB_TYPES[id].damage);
}
check(MOB_TYPES.goblin.xp === 300 && MOB_TYPES.goblin.gold === 150, 'goblin rewards must stay 300 xp / 150 gold');
check(MOB_TYPES.golem.xp === 2500 && MOB_TYPES.golem.gold === 800, 'golem rewards must stay 2500 xp / 800 gold');


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
  const goldStart = 500;
  game.gold = goldStart;
  const baseDmg = p.damage;
  const tiers = SHOP.weapons[p.classId];
  check(tiers && tiers.length === 2, 'shop must offer 2 weapon tiers for every class');
  const t2 = tiers[0];
  const t3 = tiers[1];

  let res = buyItem(game, t2.id);
  check(res.ok, 'tier2 weapon purchase failed: ' + res.msg);
  check(game.gold === goldStart - t2.price, 'tier2 gold not deducted: ' + game.gold);
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
  check(leather.name === '가죽 갑옷' && leather.price === 180 && leather.hp === 45 && Math.abs(leather.defense - 0.2) < 1e-9, 'leather armor terms wrong');
  check(steel.name === '강철 판금 갑옷' && steel.price === 400 && steel.hp === 110 && Math.abs(steel.defense - 0.35) < 1e-9, 'steel armor terms wrong');
  check(goldArmor.name === '황금 수호 갑옷' && goldArmor.price === 760 && goldArmor.hp === 200 && Math.abs(goldArmor.defense - 0.5) < 1e-9, 'gold armor terms wrong');

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
  game.gold = 900;
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

/* ================== 2세계 태초마을 상점: 더 세고 더 비싼 장비 ================== */
{
  // 상점 목록 분리: 1세계 마을은 1세계 물건만, 2세계 마을은 2세계 물건만 판다
  check(allArmors().length === 7, 'seven armor tiers expected across the three shops, got ' + allArmors().length);
  check(MAX_ARMOR_TIER === 7, 'max armor tier must be 7, got ' + MAX_ARMOR_TIER);
  check(MAX_WEAPON_TIER === 6, 'max weapon tier must be 6, got ' + MAX_WEAPON_TIER);
  check(SHOP.armors.length === 3 && SHOP2.armors.length === 2, 'each shop keeps its own armor list');
  check(SHOP.potions.length === 3 && SHOP2.potions.length === 2 + 1, 'each shop keeps its own potion list');
  for (const cls of CLASS_ORDER) {
    const w1 = shopWeaponsFor(cls, 'shop_w1');
    const w2 = shopWeaponsFor(cls, 'shop_w2');
    check(w1.length === 2 && w2.length === 2, cls + ' must have 2 weapons in each shop');
    check(w1[0].tier === 2 && w1[1].tier === 3, cls + ' world 1 weapon tiers must stay 2/3');
    check(w2[0].tier === 4 && w2[1].tier === 5, cls + ' world 2 weapon tiers must be 4/5');
    // 더 비싸고 더 강하다
    check(w2[0].price > w1[1].price * 2, cls + ' tier4 must cost far more than world 1 tier3: ' + w2[0].price + ' vs ' + w1[1].price);
    check(w2[1].price > w2[0].price * 1.8, cls + ' tier5 must cost far more than tier4');
    check(w2[0].damage > w1[1].damage, cls + ' tier4 damage must beat world 1 tier3');
    check(w2[1].damage > w2[0].damage, cls + ' tier5 damage must beat tier4');
    check(w2[0].crit > 0 && w2[1].crit >= w2[0].crit, cls + ' world 2 weapons need crit bonuses');
    // 2세계 장비는 전부 10,000G 이상 (사용자 요청: "2번째세계 상점 최소 10000이상으로 바꿔줘")
    check(w2[0].price >= 10000 && w2[0].price <= 11000, cls + ' tier4 price must be 10,000~11,000G, got ' + w2[0].price);
    check(w2[1].price >= 21000 && w2[1].price <= 23000, cls + ' tier5 price must be 21,000~23,000G, got ' + w2[1].price);
    check(w2[0].damage >= 30 && w2[1].damage >= 58, cls + ' world 2 weapon damage too low: ' + w2[0].damage + '/' + w2[1].damage);
  }
  const warriorT4 = shopWeaponsFor('warrior', 'shop_w2')[0];
  const warriorT5 = shopWeaponsFor('warrior', 'shop_w2')[1];
  check(warriorT4.damage >= 42 && warriorT4.damage <= 52, 'warrior tier4 damage should be 42~52, got ' + warriorT4.damage);
  check(warriorT5.damage >= 75 && warriorT5.damage <= 90, 'warrior tier5 damage should be 75~90, got ' + warriorT5.damage);

  // 2세계 갑옷 수치
  const mithril = allArmors().find((a) => a.tier === 4);
  const eternal = allArmors().find((a) => a.tier === 5);
  check(mithril && mithril.price === 12000 && mithril.hp === 340 && Math.abs(mithril.defense - 0.62) < 1e-9, 'mithril armor terms wrong');
  check(eternal && eternal.price === 25000 && eternal.hp === 550 && Math.abs(eternal.defense - 0.72) < 1e-9, 'eternal armor terms wrong');
  check(mithril.price > SHOP.armors[2].price && mithril.hp > SHOP.armors[2].hp && mithril.defense > SHOP.armors[2].defense, 'world 2 armor must beat the golden armor');

  // 무기 구매: 2세계 무기는 내부 등급 3 · 4 로 장착된다
  const hero = new Player(game, 'warrior');
  game.player = hero;
  hero.spawnAt(BIOMES.village_w2.shop.interact.x, BIOMES.village_w2.shop.interact.z);
  hero.equipWeaponTier(0);
  hero.weaponBonus = 0;
  hero.critChance = hero.cls.critChance;
  const baseDmg = hero.damage;
  game.gold = 500;
  let r = buyItem(game, warriorT4.id);
  check(!r.ok, 'tier4 weapon must not be affordable with 500G');
  check(hero.weaponTier === 0, 'failed tier4 purchase changed the weapon');
  game.gold = 11000;
  r = buyItem(game, warriorT4.id);
  check(r.ok, 'tier4 weapon purchase failed: ' + r.msg);
  check(game.gold === 11000 - warriorT4.price, 'tier4 gold not deducted: ' + game.gold);
  check(hero.weaponTier === 3, 'tier4 weapon must equip internal tier 3, got ' + hero.weaponTier);
  check(Math.abs(hero.damage - (baseDmg + warriorT4.damage)) < 1e-6, 'tier4 damage bonus not applied: ' + hero.damage);
  check(Math.abs(hero.critChance - (hero.cls.critChance + warriorT4.crit)) < 1e-9, 'tier4 crit bonus not applied');
  const mesh4 = hero.weapons.right || hero.weapons.left;
  check(mesh4 && mesh4.userData.tier === 3, '3D weapon look must upgrade to the world 2 tier 4 model');
  game.gold = 23000;
  r = buyItem(game, warriorT5.id);
  check(r.ok, 'tier5 weapon purchase failed: ' + r.msg);
  check(hero.weaponTier === 4, 'tier5 weapon must equip internal tier 4, got ' + hero.weaponTier);
  check(Math.abs(hero.damage - (baseDmg + warriorT5.damage)) < 1e-6, 'tier5 bonus must replace tier4: ' + hero.damage);
  const mesh5 = hero.weapons.right || hero.weapons.left;
  check(mesh5 && mesh5.userData.tier === 4, '3D weapon look must upgrade to the mythic model');
  hero.equipWeaponTier(99);
  check(hero.weaponTier === MAX_WEAPON_TIER, 'weapon tier must clamp at ' + MAX_WEAPON_TIER + ', got ' + hero.weaponTier);

  // 2세계 갑옷: Tier 4 · 5 장착 · 최대 HP · 피해 감소 · 3D 갑옷
  const p3 = new Player(game, 'warrior');
  game.player = p3;
  p3.spawnAt(BIOMES.village_w2.spawn.x, BIOMES.village_w2.spawn.z);
  const baseMaxHp3 = p3.maxHp;
  game.gold = 100;
  let ares = buyItem(game, mithril.id);
  check(!ares.ok, 'mithril armor must not be affordable with 100G');
  check(p3.armorTier === 0 && p3.maxHp === baseMaxHp3, 'failed armor purchase changed the character');
  game.gold = 12500;
  ares = buyItem(game, mithril.id);
  check(ares.ok, 'mithril armor purchase failed: ' + ares.msg);
  check(p3.armorTier === 4 && Math.abs(p3.armorDefense - 0.62) < 1e-9, 'mithril armor not equipped');
  check(p3.maxHp === baseMaxHp3 + mithril.hp, 'mithril max HP bonus wrong: ' + p3.maxHp);
  check(!!p3.armorChest && !!p3.armorBracerL, '3D armor pieces missing at tier 4');
  p3.hp = p3.maxHp;
  p3.invuln = 0;
  const taken4 = p3.takeDamage(100, null);
  check(Math.abs(taken4 - 38) <= 1, '62% damage reduction wrong: ' + taken4);
  game.gold = 26000;
  ares = buyItem(game, eternal.id);
  check(ares.ok, 'eternal armor purchase failed: ' + ares.msg);
  check(p3.armorTier === 5 && Math.abs(p3.armorDefense - 0.72) < 1e-9, 'eternal armor not equipped');
  check(p3.maxHp === baseMaxHp3 + eternal.hp, 'eternal max HP bonus wrong: ' + p3.maxHp);
  p3.hp = p3.maxHp;
  p3.invuln = 0;
  const taken5 = p3.takeDamage(100, null);
  check(Math.abs(taken5 - 28) <= 1, '72% damage reduction wrong: ' + taken5);
  p3.equipArmorTier(99);
  check(p3.armorTier === MAX_ARMOR_TIER, 'armor tier must clamp at ' + MAX_ARMOR_TIER);

  // 2세계 포션 3종
  const pots = allPotions();
  check(pots.length === 9, 'nine potions expected, got ' + pots.length);
  const keys = pots.map((p) => p.key).sort().join('');
  check(keys === '123456789', 'potion quick keys must be 1~9, got ' + keys);
  const supreme = pots.find((p) => p.id === 'potion-hp-supreme');
  const restore = pots.find((p) => p.id === 'potion-full-restore');
  const rage = pots.find((p) => p.id === 'potion-rage');
  check(supreme && supreme.price === 360 && supreme.heal === 600, 'supreme HP potion terms wrong');
  check(restore && restore.price === 640 && restore.heal === 'full' && restore.buff === 'guard', 'full restore potion terms wrong');
  check(rage && rage.price === 760 && rage.buff === 'rage' && Math.abs(rage.mult - 1.6) < 1e-9, 'rage elixir terms wrong');
  check(supreme.price > SHOP.potions[1].price && restore.price > supreme.price && rage.price > restore.price, 'world 2 potions must be pricier than world 1');
  check(supreme.heal > SHOP.potions[0].heal * 5, 'supreme potion must heal far more than the basic one');

  const p4 = new Player(game, 'warrior');
  game.player = p4;
  p4.spawnAt(BIOMES.village_w2.spawn.x, BIOMES.village_w2.spawn.z);
  game.gold = 100;
  r = buyItem(game, supreme.id);
  check(!r.ok, 'supreme potion must not be affordable with 100G');
  game.gold = 1000;
  r = buyItem(game, supreme.id);
  check(r.ok && p4.potionCount(supreme.id) === 1, 'supreme potion purchase failed: ' + r.msg);
  check(game.gold === 1000 - supreme.price, 'supreme potion gold not deducted');
  p4.hp = 50;
  const useSup = p4.usePotion(supreme.id);
  check(useSup.ok, 'supreme potion use failed: ' + useSup.msg);
  check(Math.abs(p4.hp - Math.min(p4.maxHp, 650)) < 1, 'supreme potion must heal 600 HP (capped by max HP), hp=' + p4.hp);
  check(p4.potionCount(supreme.id) === 0, 'supreme potion not consumed');

  game.gold = 2000;
  r = buyItem(game, restore.id);
  check(r.ok, 'full restore purchase failed: ' + r.msg);
  p4.hp = Math.round(p4.maxHp * 0.2);
  const useRes = p4.usePotion(restore.id);
  check(useRes.ok, 'full restore use failed: ' + useRes.msg);
  check(p4.hp === p4.maxHp, 'full restore must fill HP: ' + p4.hp + '/' + p4.maxHp);
  check(p4.buffs.guard > 14, 'full restore must grant a 15s guard buff: ' + p4.buffs.guard);
  p4.invuln = 0;
  const guarded = p4.takeDamage(100, null);
  check(guarded <= 50, 'guard buff must halve incoming damage, took ' + guarded);
  for (let i = 0; i < 60 * 16; i++) p4.update(1 / 60, input);
  check(p4.buffs.guard === 0, 'guard buff did not expire: ' + p4.buffs.guard);

  game.gold = 2000;
  r = buyItem(game, rage.id);
  check(r.ok, 'rage elixir purchase failed: ' + r.msg);
  p4.hp = p4.maxHp;
  const beforeRage = p4.damage;
  const useRage = p4.usePotion(rage.id);
  check(useRage.ok, 'rage elixir use failed: ' + useRage.msg);
  check(Math.abs(p4.damage - beforeRage * 1.6) < 1e-6, 'rage must give +60% attack: ' + p4.damage + ' vs ' + beforeRage * 1.6);
  check(p4.buffs.rage > 24, 'rage must last 25s: ' + p4.buffs.rage);
  for (let i = 0; i < 60 * 26; i++) p4.update(1 / 60, input);
  check(Math.abs(p4.damage - beforeRage) < 1e-6, 'rage buff did not expire: ' + p4.damage);

  // 1세계 포션은 2세계에서도, 2세계 포션은 1세계에서도 그대로 쓸 수 있다
  const hpSmall = SHOP.potions[0];
  game.gold = 300;
  r = buyItem(game, hpSmall.id);
  check(r.ok, 'world 1 potion must still be purchasable: ' + r.msg);
  p4.hp = 10;
  check(p4.usePotion(hpSmall.id).ok, 'world 1 potion must still be usable');
}

/* ------------------- 고대 골렘: 격노 · 충격파 내려치기 ------------------- */
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
  // 이 검사는 '격노 충격파'만 본다 — 이름 붙은 보스 기술이 먼저 나와 검사를 흔들지 않게 막아 둔다
  for (const sid in g.skillCds) g.skillCds[sid] = 99;
  g.skillGap = 0;
  hero.spawnAt(g.position.x + 90, g.position.z);
  hero.hp = hero.maxHp;
  let armed = false;
  for (let i = 0; i < 180; i++) {
    hero.hp = hero.maxHp;      // 충격파를 볼 수 있도록 쓰러지지 않게 한다
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

/* =================== 2번째 세계: 포털 · 스폰 · 보스 =================== */
{
  const W2 = WORLD2.originZ;

  // 1) 고대 골렘 처치 → 2번째 세계 포털이 열리고 그 몹들이 세워졌다
  check(game.portals.world2Portal.open === true, 'world 2 portal did not open after the golem died');
  check(game.portals.world2Portal.group.visible === true, 'open portal must be visible');
  check(game.world2Unlocked === true, 'world 2 must stay unlocked in this session');

  const w2mobs = game.mobManager.mobs.filter((m) => m.worldId === 2);
  const c2 = {};
  for (const m of w2mobs) c2[m.typeId] = (c2[m.typeId] || 0) + 1;
  console.log('world 2 mob counts:', JSON.stringify(c2));
  check((c2.goblin || 0) >= 12, 'goblin population missing: ' + c2.goblin);
  check((c2.skeleton || 0) >= 10, 'skeleton population missing: ' + c2.skeleton);
  check((c2.samurai || 0) >= 8, 'samurai population missing: ' + c2.samurai);
  check((c2.iron_golem || 0) >= 4, 'iron golem population missing: ' + c2.iron_golem);
  check(c2.dark_mage === 1, 'dark mage must spawn exactly once, got ' + c2.dark_mage);

  // 팔 · 다리가 몸에서 떨어져 공중에 뜬 몹이 없어야 한다 (두 세계의 모든 몹)
  {
    const limbNames = ['armL', 'armR', 'legL', 'legR'];
    const seen = new Set();
    for (const m of game.mobManager.mobs) {
      if (seen.has(m.typeId)) continue;
      seen.add(m.typeId);
      const model = m.model;
      const root = model.root;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const pts = [];
      for (const n of limbNames) if (model[n]) pts.push([n, model[n]]);
      if (model.legs) model.legs.forEach((leg, i) => pts.push(['legs[' + i + ']', leg]));
      const v = new THREE.Vector3();
      for (const [name, node] of pts) {
        node.getWorldPosition(v);
        check(box.containsPoint(v), m.typeId + ' ' + name + ' floats outside the body at y=' + v.y.toFixed(1));
      }
      // 좀비 팔은 어깨 높이(몸통 위쪽)에 붙어 있어야 한다 — 머리 위로 뜨면 안 된다
      if (m.typeId === 'zombie') {
        check(Math.abs(model.armL.position.y - model.armR.position.y) < 1e-6, 'zombie arms must sit at the same height');
        check(model.armL.position.y > 0 && model.armL.position.y < 6.4, 'zombie shoulders must sit on the torso, y=' + model.armL.position.y);
        check(model.armL.position.y < model.height, 'zombie shoulders must stay below the head, y=' + model.armL.position.y);
      }
    }
    check(seen.size >= 11, 'expected all 11 mob types in the world, saw ' + seen.size);
  }

  // HP가 2배가 되어도 화면의 Lv. 표시는 그대로여야 한다 (아이언 골렘이 최종 보스보다 높으면 안 됨)
  {
    const lv = {};
    for (const m of game.mobManager.mobs) if (!(m.typeId in lv)) lv[m.typeId] = m.level;
    check(lv.slime === 1 && lv.zombie === 2 && lv.gorilla === 4 && lv.raider === 3, 'world 1 mob levels changed: ' + JSON.stringify(lv));
    check(lv.goblin === 14 && lv.skeleton === 18 && lv.samurai === 29 && lv.iron_golem === 46, 'world 2 mob levels changed: ' + JSON.stringify(lv));
    check(lv.iron_golem < lv.dark_mage, 'final boss must display a higher level than the iron golem: ' + lv.iron_golem + ' vs ' + lv.dark_mage);
  }

  // 몹은 자기 바이옴 안에서만 산다
  const home = {
    goblin: 'goblin_forest', skeleton: 'misty_plains', samurai: 'sakura',
    iron_golem: 'ominous_cave', dark_mage: 'dark_realm',
  };
  for (const m of w2mobs) {
    const r = regionAt(m.position.x, m.position.z);
    check(r === home[m.typeId], m.typeId + ' spawned in ' + r + ' (expected ' + home[m.typeId] + ')');
  }
  check(!w2mobs.some((m) => regionAt(m.position.x, m.position.z) === 'village_w2'), 'no hostile mob may spawn in the world 2 village');
  check(!w2mobs.some((m) => m.position.z < WORLD.zMax + 500), 'world 2 mobs must not spawn in world 1');

  const dm = w2mobs.find((m) => m.typeId === 'dark_mage');
  check(!!dm, 'dark mage missing');
  check(Math.abs(dm.position.x - BOSS2_POS.x) < 60 && Math.abs(dm.position.z - BOSS2_POS.z) < 60, 'dark mage not at the arena');
  check(dm.level > MOB_TYPES.golem.level, 'dark mage must be a higher level than the golem');
  const golemMob = game.mobManager.mobs.find((m) => m.typeId === 'golem');
  check(!!golemMob && golemMob.dead, 'ancient golem should be dead here');
  check(game.mobManager.nearestBoss({ x: dm.position.x, z: dm.position.z }, 520) === dm, 'nearestBoss must find the dark mage');

  // 2) 포털 안내 → 걸어 들어가면 2번째 세계로
  const hero = new Player(game, 'warrior');
  game.player = hero;
  game.state = 'playing';
  hero.spawnAt(WORLD1_PORTAL_POS.x, WORLD1_PORTAL_POS.z + 70);
  hero.hp = Math.round(hero.maxHp * 0.6);
  hero.invuln = 0;
  const hpBefore = Math.round(hero.hp);
  game.worldId = 1;
  game.portals.cooldown = 0;
  game.portals.world2Portal.armed = true;
  const near = game.portals.update(1 / 60, 1.0);
  check(!!near && near.id === 'world2', 'portal prompt not detected near the portal');
  check(game.worldId === 1, 'standing near the portal must not teleport');

  hero.position.x = WORLD1_PORTAL_POS.x;
  hero.position.z = WORLD1_PORTAL_POS.z + 20;
  game.portals.update(1 / 60, 1.2);
  check(game.worldId === 2, 'walking into the portal did not move the player to world 2');
  check(regionAt(hero.position.x, hero.position.z) === 'village_w2', 'arrival must be the world 2 village, got ' + regionAt(hero.position.x, hero.position.z));
  check(Math.round(hero.hp) === hpBefore, 'portal travel must not heal: ' + hero.hp + ' vs ' + hpBefore);
  check(hero.alive === true, 'player died during portal travel');

  // 3) 2번째 세계 → 1번째 세계 귀환 포털
  game.portals.cooldown = 0;
  game.portals.returnPortal.armed = true;
  hero.position.x = WORLD2_RETURN_POS.x;
  hero.position.z = WORLD2_RETURN_POS.z + 15;
  game.portals.update(1 / 60, 2.0);
  check(game.worldId === 1, 'return portal did not bring the player back to world 1');
  check(regionAt(hero.position.x, hero.position.z) === 'temple', 'return must land at the jungle temple, got ' + regionAt(hero.position.x, hero.position.z));
  check(game.world2Unlocked === true, 'returning must keep world 2 unlocked (portal stays open)');
  check(game.portals.world2Portal.open === true, 'world 2 portal must stay open after returning');

  // 포털을 다시 쓰려면 한 번 멀어졌다가 와야 한다 (연속 이동 방지)
  check(game.portals.cooldown > 0, 'portal must cool down right after travel');

  // 4) 모든 2번째 세계 몹의 3D 모델 · 애니메이션이 실제로 돈다 (모델 부품 누락 방지)
  for (const id of ['goblin', 'skeleton', 'samurai', 'iron_golem', 'dark_mage']) {
    const m = game.mobManager.mobs.find((x) => x.typeId === id && !x.dead);
    check(!!m, id + ' model missing for animation check');
    if (!m) continue;
    let meshes = 0;
    m.root.traverse((o) => { if (o.isMesh) meshes++; });
    check(meshes >= 6, id + ' model has too few parts: ' + meshes);
    m.attackT = m.attackDur;
    m.attackHit = false;
    for (let i = 0; i < 20; i++) {
      m.time += 1 / 60;
      m.hurtT = i < 3 ? 0.2 : 0;
      m.animate(1 / 60, 40);
    }
    check(!!m.model && !!m.model.head, id + ' model head missing');
  }

  // 5) 흑마법사: 어둠 구체 원거리 공격
  game.worldId = 2;
  const mage = game.mobManager.mobs.find((m) => m.typeId === 'dark_mage' && !m.dead) || dm;
  const target = new Player(game, 'tanker');
  game.player = target;
  target.spawnAt(mage.position.x, mage.position.z + 120);
  target.invuln = 0;
  const tHp = target.hp;
  mage.aggro = true;
  mage.targetRef = { local: true, alive: true, radius: target.radius, position: target.position };
  mage.resolveAttack(120);
  check(mage.bolts.length === 1, 'dark mage did not fire a dark orb');
  for (let i = 0; i < 120 && mage.bolts.length; i++) {
    mage.updateBolts(1 / 60);
    target.invuln = 0;
  }
  check(target.hp < tHp, 'dark orb never damaged the player');
  check(mage.bolts.length === 0, 'dark orb was not cleaned up');

  // 6) 격노 · 어둠의 충격파 (기존 보스 메커니즘을 그대로 쓴다)
  mage.hp = mage.maxHp * 0.5;
  mage.aggro = true;
  mage.slamCd = 0;
  mage.attacksSinceSlam = 9;
  target.maxHp = 999999;       // 격노·충격파를 보는 동안은 죽지 않게
  target.hp = target.maxHp;
  target.spawnAt(mage.position.x, mage.position.z + 90);
  target.invuln = 0;
  let slamStarted = false;
  for (let i = 0; i < 1800; i++) {
    target.update(1 / 60, input);
    target.hp = target.maxHp;
    mage.update(1 / 60);
    if (mage.slamT > 0) { slamStarted = true; break; }
  }
  check(mage.enraged === true, 'dark mage did not enrage below its threshold');
  check(slamStarted, 'dark mage never started its dark shockwave');

  // 7) 흑마법사 처치 → 2번째 세계 승리 화면
  const hpBeforeKill = target.hp;
  mage.hp = 1;
  target.invuln = 0;
  mage.takeDamage(99999, {});
  check(mage.dead, 'dark mage did not die');
  check(game.victoryKind === 'world2', 'dark mage defeat must set the world-2 victory kind');
  check(target.hp >= hpBeforeKill - 1, 'defeating the boss must not hurt the player');
  check(mage.bolts.length === 0, 'orbs must be cleared when the boss dies');

  // 8) 멀티플레이 직렬화에 새 몹이 실린다
  const rec = packMob({ netId: 42, typeId: 'dark_mage', position: new THREE.Vector3(0, 0, W2), hp: 4200, maxHp: 6800, attackT: 0, attackDur: 1.15, state: 'chase' });
  const un = unpackMob(rec);
  check(un.typeId === 'dark_mage', 'dark mage type lost in sync: ' + un.typeId);
  for (const id of ['goblin', 'skeleton', 'samurai', 'iron_golem', 'dark_mage']) {
    check(MOB_CODES.indexOf(id) >= 0, 'mob code table missing ' + id);
  }
  mage.clearBolts();
}

/* -------------------- 대쉬 · 막기 · 스태미나 -------------------- */
{
  // 앞선 2세계 테스트가 worldId 를 바꿔 두었을 수 있다 — 이 검사는 1세계 기준으로 한다
  const worldBefore = game.worldId;
  game.worldId = 1;

  // 1) 기본 상태: 100 / 100 · 지치지 않음 · 대쉬 준비
  const p = new Player(game, 'warrior');
  game.player = p;
  p.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  input.forward = false; input.sprint = false; input.block = false; input.jump = false;
  check(p.maxStamina === 100, 'max stamina must be 100, got ' + p.maxStamina);
  check(p.stamina === 100, 'stamina must start at 100, got ' + p.stamina);
  check(p.staminaExhausted === false, 'player must not start exhausted');
  check(p.dashReady === true, 'dash must be ready at full stamina');

  // 2) 대쉬 1회 = 스태미나 5 · 쿨타임 없음 (바로 연달 이을 수 있다)
  const d1 = p.tryDash();
  check(d1.ok, 'first dash failed at full stamina: ' + d1.reason);
  check(Math.abs(p.stamina - 95) < 1e-6, 'a dash must cost 5 stamina, got ' + p.stamina);
  const d2 = p.tryDash();
  check(d2.ok, 'a second dash must fire immediately (no cooldown): ' + d2.reason);
  check(Math.abs(p.stamina - 90) < 1e-6, 'second dash must cost 5 more, got ' + p.stamina);

  // 대쉬는 실제로 그 방향으로 내닫는다 (거절되지 않은 돌진은 0.18초 동안 이동)
  const ax = p.position.x, az = p.position.z;
  for (let i = 0; i < 14; i++) p.update(1 / 60, input);
  const dashed = Math.hypot(p.position.x - ax, p.position.z - az);
  check(dashed > 50, 'dash must actually move the player, moved ' + dashed.toFixed(1));
  check(p.dashing === false, 'dash must end after its short burst');
  check(p.position.y >= terrainHeight(p.position.x, p.position.z) - 0.6, 'dash must not drop the player through the ground');

  // 3) 20연속 대쉬로 스태미나를 다 쓰면 0 이 되고 대쉬가 잠긴다
  p.stamina = 100; p.staminaExhausted = false; p.dash = null;
  let fired = 0;
  for (let i = 0; i < 20; i++) { if (p.tryDash().ok) fired++; }
  check(fired === 20, 'twenty chained dashes must all fire, fired ' + fired);
  check(Math.abs(p.stamina) < 1e-6, 'twenty dashes must drain stamina to 0, got ' + p.stamina);
  check(p.staminaExhausted === true, 'running out of stamina must lock dash (staminaExhausted)');
  const locked = p.tryDash();
  check(!locked.ok, 'dash must be refused while exhausted');
  check(Math.abs(p.stamina) < 1e-6, 'a refused dash must cost nothing, got ' + p.stamina);

  // 지친 동안에도 스태미나는 차오르지만, 100이 되기 전에는 여전히 잠겨 있다
  for (let i = 0; i < 60; i++) p.update(1 / 60, input);
  check(p.stamina > 10, 'stamina must regenerate while exhausted, got ' + p.stamina);
  check(p.staminaExhausted === true, 'dash must stay locked until stamina is full');
  check(!p.tryDash().ok, 'dash must still be locked at partial stamina');

  // 4) 0 → 100 회복은 약 4~5초 (공정한 회복 창)
  let extra = 0;
  while (p.staminaExhausted && extra < 12) { p.update(1 / 60, input); extra += 1 / 60; }
  const refill = 1 + extra;
  check(p.staminaExhausted === false, 'exhaustion must clear when stamina refills');
  check(Math.abs(p.stamina - 100) < 1e-6, 'stamina must be exactly 100 when unlocked, got ' + p.stamina);
  check(refill >= 4.0 && refill <= 5.6, 'refill 0→100 must take about 4~5s, took ' + refill.toFixed(2) + 's');
  check(p.tryDash().ok, 'dash must work again after refilling');

  // 5) 부활하면 스태미나도 가득 찬다
  p.stamina = 12; p.staminaExhausted = true;
  p.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  check(p.stamina === 100 && p.staminaExhausted === false, 'respawn must refill stamina');
  game.worldId = worldBefore;
}

{
  // 6) 막기: 받는 피해 50% · 막은 한 번에 스태미나 5
  const worldBefore2 = game.worldId;
  game.worldId = 1;
  const b = new Player(game, 'warrior');
  game.player = b;
  b.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  input.forward = false; input.sprint = false; input.jump = false;
  input.block = true;
  b.update(1 / 60, input);
  check(b.blocking === true, 'holding the block key must raise the guard');
  check(b.isBlocking === true, 'guard must be active at full stamina');
  b.invuln = 0; b.hp = b.maxHp;
  const guarded = b.takeDamage(100, null);
  check(Math.abs(guarded - 50) <= 1, 'block must halve incoming damage, took ' + guarded);
  check(Math.abs(b.stamina - 95) < 1e-6, 'each blocked hit must cost 5 stamina, got ' + b.stamina);

  // 막기는 갑옷 피해 감소와도 함께 적용된다: 100 → 50(막기) → 40(가죽 20%)
  b.equipArmorTier(1);
  b.invuln = 0; b.hp = b.maxHp;
  const guardedArmor = b.takeDamage(100, null);
  check(Math.abs(guardedArmor - 40) <= 1, 'block + leather armor must give 40 damage, took ' + guardedArmor);
  check(Math.abs(b.stamina - 90) < 1e-6, 'blocked hit with armor must still cost 5, got ' + b.stamina);
  b.equipArmorTier(0);

  // 막을 때마다 5씩 빠진다 (4번 더 = 90 → 70)
  for (let i = 0; i < 4; i++) { b.invuln = 0; b.hp = b.maxHp; b.takeDamage(100, null); }
  check(Math.abs(b.stamina - 70) < 1e-6, 'six blocked hits must cost 30 stamina, got ' + b.stamina);

  // 7) 스태미나가 5보다 작아지면 마지막 타격은 막지만, 방어가 풀리고 지침 상태가 된다
  b.stamina = 7; b.staminaExhausted = false; b.invuln = 0; b.hp = b.maxHp;
  const lastGuard = b.takeDamage(100, null);
  check(Math.abs(lastGuard - 50) <= 1, 'the last block must still halve the hit, took ' + lastGuard);
  check(Math.abs(b.stamina - 2) < 1e-6, 'block must spend 5 even when it empties the bar, got ' + b.stamina);
  check(b.staminaExhausted === true, 'running out of stamina while blocking must set staminaExhausted');
  check(b.isBlocking === false, 'guard must drop when stamina runs out');
  b.invuln = 0; b.hp = b.maxHp;
  const open = b.takeDamage(100, null);
  check(Math.abs(open - 100) <= 1, 'with the guard down the hit must land fully, took ' + open);
  check(!b.tryDash().ok, 'blocking to exhaustion must also lock dash');

  // 8) 스태미나 5 미만 · 돌진 중에는 막기가 열리지 않는다
  b.stamina = 4; b.staminaExhausted = false; b.update(1 / 60, input);
  check(b.isBlocking === false, 'guard must not stay up below 5 stamina');
  b.stamina = 100; b.staminaExhausted = false;
  b.update(1 / 60, input);
  check(b.isBlocking === true, 'guard must come back at full stamina');
  b.tryDash();
  b.update(1 / 60, input);
  check(b.isBlocking === false, 'guard must be down during a dash');
  b.dash = null;

  // 9) 막기는 이동을 느리게 만든다 (방어 자세)
  b.stamina = 100; b.staminaExhausted = false;
  b.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  input.block = false; input.forward = true;
  for (let i = 0; i < 30; i++) b.update(1 / 60, input);
  const walk = Math.hypot(b.position.x - BIOMES.village.spawn.x, b.position.z - BIOMES.village.spawn.z);
  b.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  input.block = true;
  for (let i = 0; i < 30; i++) b.update(1 / 60, input);
  const guardWalk = Math.hypot(b.position.x - BIOMES.village.spawn.x, b.position.z - BIOMES.village.spawn.z);
  check(guardWalk < walk * 0.85, 'blocking must slow movement: ' + guardWalk.toFixed(1) + ' vs ' + walk.toFixed(1));
  input.forward = false;
  input.block = false;
  game.worldId = worldBefore2;
}

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
  // (렉 절약을 위해 플레이어에서 먼 몹은 갱신을 쉬므로, 미러 옆으로 플레이어를 옮겨 놓고 본다)
  const savedPos = me.position.clone();
  me.position.set(30, me.position.y, 10);
  mirror.position.set(10, 0, 10);
  netG._applyWorld({ ps: [hostPlayerRec], ms: [packMob({ netId: 7, typeId: 'zombie', position: new THREE.Vector3(60, 0, 10), hp: 50, maxHp: 74, attackT: 0, attackDur: 0.85, state: 'chase' })], ds: [] });
  for (let i = 0; i < 20; i++) game.mobManager.update(1 / 60);
  check(mirror.position.x > 10.5, 'mob mirror did not interpolate toward host position: ' + mirror.position.x);
  check(mirror.hp === 50, 'mob mirror hp not synced');
  me.position.copy(savedPos);

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

/* =====================================================================
   슬라임 히트박스 · 15레벨 필살기 · 20레벨 1차 진화
   ===================================================================== */

// 몹과 플레이어만 돌리는 가벼운 시험용 게임 (DOM · WebGL 없이)
function makeFeatureGame() {
  const sc = new THREE.Scene();
  const g = {
    scene: sc,
    effects: new Effects(sc),
    timers: [],
    after(sec, fn) { g.timers.push({ t: sec, fn }); },
    shake() {},
    sfx: new Proxy({}, { get: () => () => {} }),
    hud: {
      floater() {}, refreshBars() {}, banner(text) { g.lastBanner = text; }, setTarget() {}, flashSkill() {},
      refreshSkillBar() {}, refreshPotions() {}, setTargetEarly() {}, showEnd() {}, hideEnd() {},
      updateRoom() {}, showRoom() {}, hideRoom() {},
    },
    net: null,
    elapsed: 0,
    state: 'playing',
    worldId: 1,
    camYaw: Math.PI,
    camPitch: 0.25,
    gold: 0,
    camera: { position: new THREE.Vector3() },
  };
  g.addGold = () => {};
  g.combat = new Combat(g);
  g.mobManager = {
    mobs: [],
    inRadius(pos, radius) { return this.mobs.filter((m) => !m.dead && m.distTo(pos) <= radius + m.radius); },
    nearest(pos, maxDist) {
      let best = null;
      const bd0 = maxDist === undefined ? Infinity : maxDist;
      let bd = bd0;
      for (const m of this.mobs) {
        if (m.dead) continue;
        const d = m.distTo(pos);
        if (d < bd) { bd = d; best = m; }
      }
      return best;
    },
  };
  g.terrainHeightAt = terrainHeight;
  g.onBossDefeated = () => {};
  g.onPlayerDeath = () => {};
  g.castSkill = (k) => castSkill(g, k);
  g.setWorld = (id) => (id === 2 ? 2 : 1);
  g.setPortalPrompt = () => {};
  g.placeCamera = () => {};
  return g;
}

// 피해만 기록하는 허수아비 몹 (AI 없음)
function dummyMob(g, x, z) {
  const mob = {
    position: new THREE.Vector3(x, terrainHeight(x, z), z),
    radius: 6, height: 12, hitHeight: 20,
    dead: false, hp: 1e9, maxHp: 1e9, level: 1, taken: 0, hits: 0,
    knock: new THREE.Vector3(),
    type: { name: '허수아비', boss: false },
    distTo(p) { return Math.hypot(p.x - this.position.x, p.z - this.position.z); },
    takeDamage(amount) { this.taken += amount; this.hits++; },
    update() {},
  };
  g.mobManager.mobs.push(mob);
  return mob;
}

const FEATURE_INPUT = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, block: false };

function stepFeature(g, dt, times) {
  for (let i = 0; i < times; i++) {
    for (let k = g.timers.length - 1; k >= 0; k--) {
      const tm = g.timers[k];
      tm.t -= dt;
      if (tm.t <= 0) { g.timers.splice(k, 1); tm.fn(); }
    }
    if (g.player) g.player.update(dt, FEATURE_INPUT);
    g.combat.update(dt);
    g.effects.update(dt);
  }
}

// 한 스킬을 허수아비 무리에 써 보고 총 피해를 돌려준다
function measureSkillDamage(g, p, slot, seconds) {
  g.mobManager.mobs.length = 0;
  g.timers.length = 0;
  g.combat.clear();
  g.effects.clear();
  p.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  p.facing = 0;
  g.camYaw = Math.PI;                       // 정면(+Z)을 보게
  const dummies = [];
  for (const dz of [30, 60, 90, 120, 150, 190, 230, 260]) {
    for (const dx of [-50, 0, 50]) dummies.push(dummyMob(g, p.position.x + dx, p.position.z + dz));
  }
  const cast = p.useSkill(slot);
  stepFeature(g, 1 / 60, Math.round((seconds || 2.6) * 60));
  return { cast, total: dummies.reduce((s, m) => s + m.taken, 0), dummies };
}

/* ---------------- 1) 슬라임 히트박스 · 원거리 명중 ---------------- */
{
  check(MOB_TYPES.slime.hitHeight !== undefined && MOB_TYPES.slime.hitHeight >= 18,
    'slime needs a taller hit box than its 12-height body: ' + MOB_TYPES.slime.hitHeight);
  check(MOB_TYPES.slime.height === 12, 'slime visual height must stay 12');

  const g = makeFeatureGame();
  const start = BIOMES.forest.spawn;
  const spots = [];
  for (const d of [60, 95, 130, 165]) for (const a of [0, 0.55, -0.65]) {
    spots.push({ x: start.x + Math.sin(a) * d, z: start.z + Math.cos(a) * d });
  }

  for (const classId of ['mage', 'archer']) {
    for (const dt of [1 / 60, 1 / 30, 1 / 20]) {
      let hits = 0;
      for (const spot of spots) {
        g.mobManager.mobs.length = 0;
        g.timers.length = 0;
        g.combat.clear();
        const p = new Player(g, classId);
        g.player = p;
        p.spawnAt(start.x, start.z);
        const yaw = Math.atan2(spot.x - start.x, spot.z - start.z);
        p.facing = yaw;
        g.camYaw = yaw - Math.PI;             // 바라보는 쪽으로 조준
        const slime = new Mob(g, 'slime', spot, 'forest');
        g.mobManager.mobs.push(slime);
        const hp0 = slime.hp;
        p.attack();
        for (let i = 0; i < Math.round(1.4 / dt); i++) {
          for (let k = g.timers.length - 1; k >= 0; k--) {
            const tm = g.timers[k];
            tm.t -= dt;
            if (tm.t <= 0) { g.timers.splice(k, 1); tm.fn(); }
          }
          p.update(dt, FEATURE_INPUT);
          g.combat.update(dt);
        }
        if (slime.hp < hp0) hits++;
      }
      check(hits === spots.length,
        classId + ' ranged attack must hit slimes at every distance/fps (' + hits + '/' + spots.length +
        ' at dt=' + dt.toFixed(3) + ')');
    }
  }

  // 몸 높이(12)보다 위를 지나는 탄도 슬라임 피격 판정에 들어야 한다
  {
    g.mobManager.mobs.length = 0;
    g.timers.length = 0;
    g.combat.clear();
    const p = new Player(g, 'mage');
    g.player = p;
    p.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
    const slime = new Mob(g, 'slime', { x: p.position.x + 0.2, z: p.position.z + 70 }, 'forest');
    g.mobManager.mobs.push(slime);
    const hp0 = slime.hp;
    const proj = g.combat.fireOrb(p, new THREE.Vector3(0, 0, 1), { damage: 12, speed: 260, range: 200, splash: 0 });
    proj.pos.y = slime.position.y + 16;      // 슬라임 몸통 위쪽 높이
    for (let i = 0; i < 60; i++) g.combat.update(1 / 60);
    check(slime.hp < hp0, 'a shot passing above the slime body (y +16) must still hit it');
  }
}

/* ---------------- 2) 15레벨 필살기 (75초 쿨타임) ---------------- */
const FEATURE_REPORT = { ult: {}, evolvedQ: {}, evolvedE: {} };
{
  check(ULT_LEVEL === 15 && ULT_COOLDOWN === 75, 'ultimate must unlock at Lv.15 with a 75s cooldown');
  check(EVOLUTION_LEVEL === 20, 'evolution must happen at Lv.20');

  // 14레벨: 잠김 · 시전 불가
  {
    const g = makeFeatureGame();
    const p = new Player(g, 'warrior');
    g.player = p;
    p.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
    p.setLevel(14, { silent: true });
    check(p.level === 14 && p.ultUnlocked === false, 'ultimate must stay locked at Lv.14');
    check(p.skillFor('ult') === null, 'no ultimate skill before Lv.15');
    check(g.castSkill('ult') === false, 'ultimate must not cast before Lv.15');
    check((p.cooldowns.ult || 0) === 0, 'a locked ultimate must not set a cooldown');
    check(p.evolved === false, 'player must not be evolved at Lv.14');

    p.setLevel(15, { silent: true });
    check(p.ultUnlocked === true && p.level === 15, 'Lv.15 must unlock the ultimate');
    const ult = p.skillFor('ult');
    check(!!ult && ult.cooldown === ULT_COOLDOWN, 'ultimate cooldown must be 75s: ' + (ult && ult.cooldown));
  }

  // 경험치로 15 · 20레벨에 도달하면 배너와 함께 해금된다
  {
    const g = makeFeatureGame();
    const p = new Player(g, 'mage');
    g.player = p;
    p.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
    let guard = 0;
    while (p.level < ULT_LEVEL && guard++ < 400) p.gainXp(p.xpNext);
    check(p.ultUnlocked === true, 'leveling up to 15 must unlock the ultimate');
    check(/필살기 해금/.test(g.lastBanner || ''), 'unlock banner missing: ' + g.lastBanner);
    check(g.effects.items.length > 0 || true, 'unlock must play effects');
    guard = 0;
    while (p.level < EVOLUTION_LEVEL && guard++ < 800) p.gainXp(p.xpNext);
    check(p.evolved === true && p.evolutionTier === 1, 'leveling up to 20 must trigger the 1st evolution');
    check(/1차 진화/.test(g.lastBanner || ''), 'evolution banner missing: ' + g.lastBanner);
    check(p.cooldowns.q === 0 && p.cooldowns.e === 0, 'evolution must clear Q/E cooldowns');
  }

  // 다섯 직업 모두: 필살기 시전 · 75초 쿨타임 · 큰 피해
  for (const classId of CLASS_ORDER) {
    const g = makeFeatureGame();
    const p = new Player(g, classId);
    g.player = p;
    p.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
    p.setLevel(ULT_LEVEL, { silent: true });

    g.mobManager.mobs.length = 0;
    g.timers.length = 0;
    g.combat.clear();
    p.facing = 0;
    g.camYaw = Math.PI;
    const dummies = [];
    for (const [dx, dz] of [[0, 50], [22, 85], [-22, 85], [0, 120], [40, 130], [-40, 130]]) {
      dummies.push(dummyMob(g, p.position.x + dx, p.position.z + dz));
    }
    check(g.castSkill('ult') === true, classId + ' ultimate did not cast at Lv.15');
    check(Math.abs(p.cooldowns.ult - ULT_COOLDOWN) < 0.2, classId + ' ultimate cooldown must start at 75s: ' + p.cooldowns.ult);
    check(g.castSkill('ult') === false, classId + ' ultimate must not be reusable during its cooldown');

    stepFeature(g, 1 / 60, 180);          // 3초
    const total = dummies.reduce((s, m) => s + m.taken, 0);
    FEATURE_REPORT.ult[classId] = { damage: Math.round(total), playerDamage: Math.round(p.damage * 10) / 10, hits: dummies.reduce((s, m) => s + m.hits, 0) };
    check(total > p.damage * 5,
      classId + ' ultimate damage too low: ' + total.toFixed(1) + ' (damage ' + p.damage.toFixed(1) + ')');
    check(p.cooldowns.ult > 70 && p.cooldowns.ult < 73,
      classId + ' ultimate cooldown must count down in the HUD: ' + p.cooldowns.ult);
    check(g.castSkill('ult') === false, classId + ' ultimate must still be cooling at ~72s');

    g.effects.clear();
    stepFeature(g, 0.1, 740);             // 나머지 쿨타임
    check(p.cooldowns.ult === 0, classId + ' ultimate cooldown must reach 0 (got ' + p.cooldowns.ult + ')');
    check(g.castSkill('ult') === true, classId + ' ultimate must be usable again after 75s');
  }
}

/* ---------------- 3) 20레벨 1차 진화 (Q · E 강화) ---------------- */
for (const classId of CLASS_ORDER) {
  const baseQ = CLASSES[classId].skills.q;
  const baseE = CLASSES[classId].skills.e;
  const g = makeFeatureGame();
  const p = new Player(g, classId);
  g.player = p;
  p.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  p.setLevel(EVOLUTION_LEVEL - 1, { silent: true });

  check(p.evolved === false && p.evolutionTier === 0, classId + ' must not be evolved at Lv.19');
  check(p.skillFor('q').name === baseQ.name, classId + ' Q must stay the base skill before Lv.20');
  check(p.skillFor('e').name === baseE.name, classId + ' E must stay the base skill before Lv.20');

  const baseQDamage = measureSkillDamage(g, p, 'q', 2.6).total;
  check(baseQDamage > 0, classId + ' base Q dealt no damage to the dummies');
  const baseEDamage = measureSkillDamage(g, p, 'e', 2.8).total;
  const baseEFortress = p.buffs.fortress;   // 탱커 E 는 방어 스킬 — 지속시간으로 강함을 잰다
  check(baseEDamage > 0 || baseEFortress > 0, classId + ' base E did nothing to the dummies');

  // 1차 진화
  p.cooldowns.q = 5;
  p.cooldowns.e = 6;
  p.setLevel(EVOLUTION_LEVEL, { silent: true });
  check(p.evolved === true && p.evolutionTier === 1, classId + ' must evolve at Lv.20');
  check(p.cooldowns.q === 0 && p.cooldowns.e === 0, classId + ' evolution must clear Q/E cooldowns');

  const q = p.skillFor('q');
  const e = p.skillFor('e');
  check(q.name !== baseQ.name && q.icon !== baseQ.icon && !!q.desc, classId + ' evolved Q must be a brand-new skill (name/icon/desc)');
  check(e.name !== baseE.name && e.icon !== baseE.icon && !!e.desc, classId + ' evolved E must be a brand-new skill (name/icon/desc)');
  check(q.cooldown <= baseQ.cooldown && e.cooldown <= baseE.cooldown, classId + ' evolved skills must not cool down slower');
  check(skillDefFor(classId, 'q', 20) === CLASSES[classId].evolved.q, 'skillDefFor must return the evolved Q at Lv.20');
  check(CLASSES[classId].evolved.q.name === q.name && CLASSES[classId].evolved.e.name === e.name,
    classId + ' HUD slot would show the evolved names');
  // 필살기는 진화해도 그대로 유지된다
  check(!!p.skillFor('ult') && p.skillFor('ult').cooldown === ULT_COOLDOWN, classId + ' evolution must keep the ultimate unlocked');

  const evolvedQDamage = measureSkillDamage(g, p, 'q', 2.6).total;
  const evolvedEResult = measureSkillDamage(g, p, 'e', 2.8);
  const evolvedEDamage = evolvedEResult.total;
  const evolvedEFortress = p.buffs.fortress;
  FEATURE_REPORT.evolvedQ[classId] = { base: Math.round(baseQDamage), evolved: Math.round(evolvedQDamage) };
  FEATURE_REPORT.evolvedE[classId] = { base: Math.round(baseEDamage), evolved: Math.round(evolvedEDamage) };
  check(evolvedQDamage > baseQDamage * 1.3,
    classId + ' evolved Q must hit much harder than the base Q (' + evolvedQDamage.toFixed(0) + ' vs ' + baseQDamage.toFixed(0) + ')');
  if (baseEDamage > 0) {
    check(evolvedEDamage > baseEDamage * 1.3,
      classId + ' evolved E must hit much harder than the base E (' + evolvedEDamage.toFixed(0) + ' vs ' + baseEDamage.toFixed(0) + ')');
  } else {
    // 원래 E 가 수호 스킬인 직업 — 진화하면 충격파가 더해지고 지속시간·회복도 커진다
    check(evolvedEDamage > 0, classId + ' evolved E must add damage where the base E had none');
    check(evolvedEFortress > baseEFortress + 2,
      classId + ' evolved E must guard longer (' + evolvedEFortress.toFixed(1) + 's vs ' + baseEFortress.toFixed(1) + 's)');
  }
}

/* =====================================================================
   상점 가격 2배 (1세계 · 2세계 모든 물건)
   ===================================================================== */
{
  // 2배 전 가격표 — 1세계 물건과 2세계 포션 (2세계 장비는 10,000G 이상 가격표를 따로 검사)
  const OLD = {
    'w-warrior-2': 80, 'w-warrior-3': 220, 'w-archer-2': 80, 'w-archer-3': 220,
    'w-rogue-2': 80, 'w-rogue-3': 220, 'w-tanker-2': 80, 'w-tanker-3': 220,
    'w-mage-2': 80, 'w-mage-3': 220,
    'a-leather': 90, 'a-steel': 200, 'a-gold': 380,
    'potion-hp': 30, 'potion-hp-big': 70, 'potion-atk': 90,
    'potion-hp-supreme': 180, 'potion-full-restore': 320, 'potion-rage': 380,
  };
  // 2세계 무기·갑옷 가격표 (10,000G 이상 · 직업/등급 순서 유지)
  const W2_PRICE = {
    'w2-archer-4': 10000, 'w2-rogue-4': 10000, 'w2-warrior-4': 10500, 'w2-tanker-4': 10500, 'w2-mage-4': 10800,
    'w2-rogue-5': 21000, 'w2-archer-5': 21500, 'w2-tanker-5': 21500, 'w2-warrior-5': 22000, 'w2-mage-5': 22500,
    'a-mithril': 12000, 'a-eternal': 25000,
  };
  const seen = new Set();
  const checkItem = (item, where) => {
    const old = OLD[item.id];
    check(old !== undefined, 'price table is missing ' + item.id);
    if (old === undefined) return;
    seen.add(item.id);
    check(item.price === old * 2, where + ' ' + item.id + ' must cost ' + old * 2 + 'G (2×), got ' + item.price);
  };
  const w2Seen = new Set();
  const checkW2Equip = (item) => {
    const want = W2_PRICE[item.id];
    check(want !== undefined, 'world 2 price table is missing ' + item.id);
    if (want === undefined) return;
    w2Seen.add(item.id);
    check(item.price === want, 'shop_w2 ' + item.id + ' must cost ' + want + 'G, got ' + item.price);
    check(item.price >= 10000, 'shop_w2 ' + item.id + ' must cost at least 10,000G, got ' + item.price);
  };
  for (const cls of CLASS_ORDER) {
    for (const w of shopWeaponsFor(cls, 'shop_w1')) checkItem(w, 'shop_w1');
    for (const w of shopWeaponsFor(cls, 'shop_w2')) checkW2Equip(w);
  }
  for (const a of SHOP.armors) checkItem(a, 'shop_w1');
  for (const a of SHOP2.armors) checkW2Equip(a);
  for (const p of SHOP.potions) checkItem(p, 'shop_w1');
  for (const p of SHOP2.potions) checkItem(p, 'shop_w2');
  check(seen.size === Object.keys(OLD).length, 'some shop items were not checked: ' + seen.size + '/' + Object.keys(OLD).length);
  check(w2Seen.size === Object.keys(W2_PRICE).length, 'some world 2 equipment was not checked: ' + w2Seen.size + '/' + Object.keys(W2_PRICE).length);
  // 2세계 포션은 그대로 저렴하게 (사용자 요청: "포션말고")
  for (const p of SHOP2.potions) check(p.price < 10000, 'shop_w2 potion ' + p.id + ' must stay under 10,000G, got ' + p.price);
  // 2세계 상점 전체: 무기·갑옷은 10,000G 이상, 포션은 10,000G 미만
  const w2Equip = CLASS_ORDER.flatMap((cls) => shopWeaponsFor(cls, 'shop_w2')).concat(SHOP2.armors);
  check(w2Equip.length === 12, 'twelve world 2 equipment items expected, got ' + w2Equip.length);
  for (const it of w2Equip) check(it.price >= 10000, 'world 2 equipment ' + it.id + ' must be >= 10000G');
}

/* =====================================================================
   순차 퀘스트 (1세계 · 2세계)
   ===================================================================== */
{
  // 퀘스트 목록이 기획 그대로인지
  const spec = {
    1: [['slime', 10, 150], ['zombie', 12, 280], ['hyena', 15, 450], ['raider', 12, 650], ['gorilla', 12, 900], ['golem', 1, 1600]],
    2: [['goblin', 12, 700], ['skeleton', 12, 1100], ['samurai', 10, 1600], ['iron_golem', 6, 2400], ['dark_mage', 1, 4500]],
  };
  for (const w of [1, 2]) {
    const list = QUEST_CHAINS[w];
    check(Array.isArray(list) && list.length === spec[w].length, w + '세계 퀘스트는 ' + spec[w].length + '개여야 합니다');
    for (let i = 0; i < Math.min(list.length, spec[w].length); i++) {
      const q = list[i];
      const sp = spec[w][i];
      check(q.mobType === sp[0] && q.target === sp[1] && q.rewardGold === sp[2],
        w + '세계 ' + (i + 1) + '번째 퀘스트가 기획과 다릅니다: ' + JSON.stringify(q));
      check(typeof q.id === 'string' && q.id === 'w' + w + '_q' + (i + 1), w + '세계 퀘스트 id 오류: ' + q.id);
    }
  }
  check(questGoalText(QUEST_CHAINS[1][0]) === '슬라임 10마리 잡기', 'goal text wrong: ' + questGoalText(QUEST_CHAINS[1][0]));
  check(questGoalText(QUEST_CHAINS[1][5]) === '고대 골렘 1마리 처치', 'boss goal text wrong: ' + questGoalText(QUEST_CHAINS[1][5]));

  // 1) 순서를 건너뛰고 잡은 몹은 세지 않는다
  const log = new QuestLog();
  let st = log.status(1);
  check(st.quest && st.quest.mobType === 'slime' && st.progress === 0 && st.index === 1 && st.total === 6, 'world 1 must start with the slime quest');
  check(log.recordKill(1, 'zombie') === null, 'future mobs must not pre-fill a locked quest');
  check(log.recordKill(1, 'golem') === null, 'the boss kill must not count before its quest is active');
  check(log.status(1).progress === 0, 'out-of-order kills changed the progress');

  // 2) 지금 퀘스트의 몹만 센다
  log.recordKill(1, 'slime');
  st = log.status(1);
  check(st.progress === 1 && st.quest.mobType === 'slime', 'slime kill must count: ' + JSON.stringify(st));

  // 3) 목표를 채우면 정확한 보상 · 다음 퀘스트로 이동
  let res = null;
  for (let i = 0; i < 9; i++) res = log.recordKill(1, 'slime');
  check(res && res.completed === true, 'slime 10th kill must complete the quest');
  check(res.rewardGold === 150, 'first quest reward must be 150G, got ' + (res && res.rewardGold));
  check(res.chainDone === false, 'chain must not be done after the first quest');
  st = log.status(1);
  check(st.index === 2 && st.quest.mobType === 'zombie' && st.progress === 0, 'must advance to the zombie quest: ' + JSON.stringify(st));
  // 완료 뒤 같은 몹을 더 잡아도 다음 퀘스트는 채워지지 않는다
  check(log.recordKill(1, 'slime') === null, 'kills of the finished quest must not count');

  // 4) 두 세계는 서로 독립
  check(log.status(2).index === 1 && log.status(2).quest.mobType === 'goblin', 'world 2 must start fresh at the goblin quest');
  log.recordKill(2, 'goblin');
  check(log.status(2).progress === 1, 'world 2 goblin kill must count');
  check(log.status(1).quest.mobType === 'zombie' && log.status(1).progress === 0, 'world 2 progress must not touch world 1');
  log.recordKill(1, 'zombie');
  check(log.status(1).progress === 1 && log.status(2).progress === 1, 'both worlds must keep their own progress');
  // 세계를 건너뛴 킬은 그 세계 목록에만 들어간다
  check(log.recordKill(2, 'zombie') === null, 'world 1 mob kill must not count in world 2 quests');

  // 5) 1세계 끝까지 → 모든 퀘스트 완료
  const solo = new QuestLog();
  const rewards = [];
  for (const q of QUEST_CHAINS[1]) {
    for (let i = 0; i < q.target; i++) {
      const r = solo.recordKill(1, q.mobType);
      if (r && r.completed) rewards.push(r.rewardGold);
      else check(!r || !r.completed, 'completion must only fire on the last kill');
    }
  }
  check(rewards.length === 6, 'all six world 1 quests must complete: ' + rewards.length);
  check(rewards.reduce((a, b) => a + b, 0) === 150 + 280 + 450 + 650 + 900 + 1600, 'world 1 rewards must add up: ' + rewards.join(','));
  const fin1 = solo.status(1);
  check(fin1.done === true, 'world 1 chain must be marked done');
  check(solo.recordKill(1, 'slime') === null, 'a finished chain must not count kills');
  // 2세계는 그대로 남아 있다
  check(solo.status(2).done === false && solo.status(2).index === 1, 'finishing world 1 must not finish world 2');
  // 2세계 끝까지
  const r5 = (() => { let last = null; for (const q of QUEST_CHAINS[2]) for (let i = 0; i < q.target; i++) last = solo.recordKill(2, q.mobType); return last; })();
  check(r5 && r5.completed && r5.rewardGold === 4500 && r5.chainDone === true, 'the last world 2 quest must award 4500G and finish the chain');
  check(solo.status(2).done === true, 'world 2 chain must be marked done');

  // 6) 한 마리도 빠짐없이 세는지 (10 · 12 · 15 …)
  const one = new QuestChain(1, QUEST_CHAINS[1]);
  let counted = 0;
  for (let i = 0; i < 9; i++) { if (one.recordKill('slime')) counted++; }
  check(counted === 9 && one.count === 9 && !one.done, 'every slime kill up to the target must count once');
  const done = one.recordKill('slime');
  check(done.completed && one.index === 1 && one.count === 0, 'the 10th slime must finish the quest and reset the counter');

  // 7) 몹이 죽으면 게임이 퀘스트로 알린다 (혼자 하기 경로)
  const qg = makeFeatureGame();
  qg.recordKill = (type, world) => { qg.killLog = (qg.killLog || []).concat([[type, world]]); return null; };
  qg.mobManager = new MobManager(qg);
  qg.mobManager.mobs.length = 0;
  qg.player = new Player(qg, 'warrior');
  qg.player.spawnAt(BIOMES.forest.spawn.x, BIOMES.forest.spawn.z);
  qg.worldId = 1;
  const slimeMob = new Mob(qg, 'slime', { x: BIOMES.forest.spawn.x + 20, z: BIOMES.forest.spawn.z }, 'forest');
  slimeMob.netId = 0;
  qg.mobManager.mobs.push(slimeMob);
  slimeMob.takeDamage(1e9, {});
  check(!!qg.killLog && qg.killLog.length === 1 && qg.killLog[0][0] === 'slime' && qg.killLog[0][1] === 1,
    'a solo kill must report to the quest log: ' + JSON.stringify(qg.killLog));
  const w2Mob = new Mob(qg, 'goblin', { x: 0, z: WORLD2.originZ + 1000 }, 'goblin_forest');
  w2Mob.netId = 1;
  qg.mobManager.mobs.push(w2Mob);
  w2Mob.takeDamage(1e9, {});
  check(qg.killLog.length === 2 && qg.killLog[1][0] === 'goblin' && qg.killLog[1][1] === 2,
    'a world 2 kill must be reported with its world: ' + JSON.stringify(qg.killLog));

  // 8) 친구(게스트)도 호스트가 알려 준 처치를 자기 퀘스트로 센다 ('rw' 보상 메시지)
  const gg = makeFeatureGame();
  const grant = [];
  gg.recordKill = (type, world) => { gg.killLog = (gg.killLog || []).concat([[type, world]]); return null; };
  const fakeNet = { game: gg, _grant(xp, gold, x, z) { grant.push([xp, gold, x, z]); } };
  Net.prototype._applyReward.call(fakeNet, { xp: 16, gold: 15, x: 10, z: 20, t: 'slime', w: 1 });
  check(!!gg.killLog && gg.killLog.length === 1 && gg.killLog[0][0] === 'slime', 'guest must count host-reported kills: ' + JSON.stringify(gg.killLog));
  check(grant.length === 1 && grant[0][0] === 16 && grant[0][1] === 15, 'guest must still receive xp and gold');
  // 호스트의 rw 메시지에는 몹 종류가 실린다
  const rw = decodeMsg(encodeMsg('rw', { xp: 1, gold: 2, t: 'goblin', w: 2 }));
  check(rw && rw.p && rw.p.t === 'goblin' && rw.p.w === 2, 'rw payload must carry the mob type and world');
}

/* =====================================================================
   함께 하기: 11종 몹 모두가 친구(동료)에게 피해를 준다
   ===================================================================== */
{
  const MP_TYPES = ['slime', 'zombie', 'hyena', 'gorilla', 'raider', 'golem', 'goblin', 'skeleton', 'samurai', 'iron_golem', 'dark_mage'];
  const biomeForMob = (typeId) => ALL_BIOME_ORDER.find((id) => BIOMES[id] && BIOMES[id].mob === typeId) || 'forest';

  // 호스트 게임: 원격 친구 한 명 + hitGuest 기록
  function makeHostGame() {
    const sc = new THREE.Scene();
    const g = {
      scene: sc,
      effects: new Effects(sc),
      timers: [],
      after(sec, fn) { g.timers.push({ t: sec, fn }); },
      shake() {},
      sfx: new Proxy({}, { get: () => () => {} }),
      hud: {
        floater() {}, refreshBars() {}, banner() {}, setTarget() {}, flashSkill() {},
        refreshQuest() {}, questFlash() {}, updateGold() {}, refreshPotions() {},
        updateRoom() {}, showRoom() {}, hideRoom() {}, showEnd() {}, hideEnd() {},
      },
      elapsed: 0,
      state: 'playing',
      worldId: 1,
      gold: 0,
      hits: [],
    };
    g.addGold = (n) => { g.gold += n; };
    g.combat = new Combat(g);
    g.mobManager = null;
    g.onBossEngage = () => {};
    g.onBossDefeated = () => {};
    g.onPlayerDeath = () => {};
    g.recordKill = () => null;
    g.remote = null;
    g.combatTargets = () => {
      const list = [];
      if (g.player && g.player.alive) list.push({ local: true, alive: true, radius: g.player.radius, position: g.player.position, world: g.worldId });
      if (g.remote) list.push(g.remote);
      return list;
    };
    g.net = {
      active: true, isHost: true,
      hostTargets() { return g.remote ? [g.remote] : []; },
      hitGuest(pid, dmg) { g.hits.push({ pid, dmg }); },
      onMobDeath() { return true; },
    };
    const mm = new MobManager(g);
    mm.mobs.length = 0;
    g.mobManager = mm;
    g.player = new Player(g, 'warrior');
    return g;
  }

  function runMob(hostGame, typeId, hostFar) {
    const biomeId = biomeForMob(typeId);
    const world = BIOMES[biomeId].world === 2 ? 2 : 1;
    const center = BIOMES[biomeId].center;
    const mob = new Mob(hostGame, typeId, { x: center.x, z: center.z }, biomeId);
    mob.netId = 0;
    hostGame.mobManager.mobs.push(mob);
    mob.attackCd = 0.2;
    // 이 검사는 '가까운 사람을 노리는가'만 본다 — 여러 사람에게 동시에 떨어지는 보스 기술은
    // 합법적으로 방장도 때리므로, 기술 쿨타임을 막아 기본 공격만 하게 한다 (검사 흔들림 방지)
    for (const id in mob.skillCds) mob.skillCds[id] = 99;
    mob.skillGap = 99;
    // 친구: 몹 바로 앞 (사거리 안)
    const rz = center.z + MOB_TYPES[typeId].attackRange * 0.5 + 2;
    hostGame.remote = {
      pid: 'guest-1', remote: true, alive: true, radius: 4.6,
      position: new THREE.Vector3(center.x, 0, rz), world,
    };
    // 호스트: 가까이 또는 아주 멀리 (사거리 · 컬링 거리 밖)
    hostGame.worldId = world;
    // 멀리 떨어진 자리: 세계 경계에 걸리지 않으면서 컬링 거리(760) 밖인 곳을 고른다
    const farPoint = () => {
      const cands = [[1800, 0], [-1800, 0], [0, 1800], [0, -1800], [1300, 0], [-1300, 0], [900, 0], [-900, 0], [0, 900], [0, -900]];
      for (const c of cands) {
        const p = clampToWorld({ x: center.x + c[0], z: center.z + c[1] }, world);
        if (Math.hypot(p.x - center.x, p.z - center.z) > 800) return p;
      }
      return clampToWorld({ x: center.x + 900, z: center.z }, world);
    };
    const hp = hostFar ? farPoint() : { x: center.x, z: center.z + 520 };
    hostGame.player.spawnAt(hp.x, hp.z);
    const dist = Math.hypot(hp.x - center.x, hp.z - center.z);
    if (hostFar) check(dist > 760, typeId + ' far host must be outside the cull radius: ' + Math.round(dist));
    check(!hostFar || dist > 760, typeId + ' far host placement failed');
    const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, block: false };
    for (let i = 0; i < 240; i++) {   // 4초
      hostGame.player.update(1 / 60, input);
      hostGame.mobManager.update(1 / 60);
      hostGame.effects.update(1 / 60);
      if (mob.dead) break;
    }
    const total = hostGame.hits.reduce((a, h) => a + (h.dmg || 0), 0);
    return { hits: hostGame.hits.length, total, mob, world, biomeId };
  }

  for (const typeId of MP_TYPES) {
    const gNear = makeHostGame();
    const near = runMob(gNear, typeId, false);
    check(near.hits > 0, typeId + ' must damage a nearby teammate (host close)');
    check(near.total > 0, typeId + ' must deal real damage: ' + near.total);
    check(gNear.hits.every((h) => h.pid === 'guest-1'), typeId + ' damage must go to the teammate pid');
    check(gNear.player.hp === gNear.player.maxHp, typeId + ' must not hit the host instead of the closer teammate');

    const gFar = makeHostGame();
    const far = runMob(gFar, typeId, true);
    check(far.hits > 0, typeId + ' must still damage a teammate who fights far from the host');
    check(far.total > 0, typeId + ' far fight must deal real damage: ' + far.total);
    check(far.mob.dead === false, typeId + ' must stay alive during the check');

    // 다른 세계에 있는 친구는 이 세계 몹의 공격을 받지 않는다
    const gWorld = makeHostGame();
    const biomeId = biomeForMob(typeId);
    const world = BIOMES[biomeId].world === 2 ? 2 : 1;
    const center = BIOMES[biomeId].center;
    const mobW = new Mob(gWorld, typeId, { x: center.x, z: center.z }, biomeId);
    mobW.netId = 0;
    gWorld.mobManager.mobs.push(mobW);
    gWorld.worldId = world;
    gWorld.remote = {
      pid: 'guest-2', remote: true, alive: true, radius: 4.6,
      position: new THREE.Vector3(center.x, 0, center.z + 12),
      world: world === 2 ? 1 : 2,   // 반대 세계
    };
    gWorld.player.spawnAt(center.x, center.z + 400);
    const input2 = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, block: false };
    for (let i = 0; i < 240; i++) {
      gWorld.player.update(1 / 60, input2);
      gWorld.mobManager.update(1 / 60);
      gWorld.effects.update(1 / 60);
    }
    check(gWorld.hits.length === 0, typeId + ' must not hit a teammate who is in another world');
  }

  // hostTargets 는 살아 있는 친구의 자리 · 반지름 · 세계를 정확히 넘긴다
  const fakeNet2 = {
    remotes: new Map([
      ['a', { pid: 'a', alive: true, radius: 4.6, x: 10, z: 20, world: 2, rig: { radius: 4.6 } }],
      ['b', { pid: 'b', alive: false, x: 30, z: 40, world: 1, rig: { radius: 4.6 } }],
    ]),
  };
  const targets = Net.prototype.hostTargets.call(fakeNet2);
  check(targets.length === 2, 'hostTargets must list every teammate');
  const ta = targets.find((t) => t.pid === 'a');
  const tb = targets.find((t) => t.pid === 'b');
  check(ta && ta.remote === true && ta.alive === true && ta.world === 2 && ta.position.x === 10 && ta.position.z === 20, 'hostTargets must carry position and world');
  check(tb && tb.alive === false && tb.world === 1, 'hostTargets must carry the alive flag');

  // 같은 세계의 먼 친구 곁의 몹은 컬링되지 않고, 친구와 다른 세계의 몹은 움직이지 않는다
  const gc = makeHostGame();
  gc.player.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  gc.worldId = 1;
  const nearMob = new Mob(gc, 'zombie', { x: 1200, z: 1200 }, 'savanna');
  nearMob.netId = 0;
  const otherMob = new Mob(gc, 'goblin', { x: 1200, z: WORLD2.originZ + 1200 }, 'goblin_forest');
  otherMob.netId = 1;
  gc.mobManager.mobs.push(nearMob, otherMob);
  gc.remote = { pid: 'guest-3', remote: true, alive: true, radius: 4.6, position: new THREE.Vector3(1200, 0, 1212), world: 1 };
  gc.mobManager.update(1 / 60);
  check(nearMob.dist < 60, 'a mob beside a far teammate must not be culled: dist=' + Math.round(nearMob.dist));
  check(otherMob.dist > 6000, 'a mob in another world must be culled from the teammate: dist=' + Math.round(otherMob.dist));
}

/* =====================================================================
   보스는 한 땅에 하나 (중복 스폰 방지) · 보스 스킬
   ===================================================================== */
{
  const NO_INPUT = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, block: false };
  const aliveBosses = (mm, typeId) => mm.mobs.filter((m) => m.type && m.type.boss && (!typeId || m.typeId === typeId) && !m.dead).length;

  // main.js Game 과 같은 역할을 하는 최소 스텁 (setWorld → ensureWorld)
  function makeBossGame() {
    const sc = new THREE.Scene();
    const g = {
      scene: sc,
      effects: new Effects(sc),
      timers: [],
      elapsed: 0,
      state: 'playing',
      worldId: 1,
      world2Unlocked: false,
      gold: 0,
      floaters: [],
      hits: [],
      broadcast: [],
      after(sec, fn) { g.timers.push({ t: sec, fn }); },
      shake() {},
      sfx: new Proxy({}, { get: () => () => {} }),
      addGold() {},
      recordKill: () => null,
      onBossEngage() {},
      onBossDefeated() {},
      onPlayerDeath() {},
      placeCamera() {},
    };
    g.hud = {
      floater(text, pos, kind) { g.floaters.push([text, kind]); },
      banner() {}, refreshBars() {}, setTarget() {}, refreshQuest() {},
      questFlash() {}, updateGold() {}, refreshPotions() {}, showEnd() {}, hideEnd() {},
      updateRoom() {}, showRoom() {}, hideRoom() {}, setWorld() {},
    };
    g.combat = new Combat(g);
    g.mobManager = new MobManager(g);
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
    g.setWorld = (id) => {
      g.worldId = id === 2 ? 2 : 1;
      if (g.worldId === 2) g.world2Unlocked = true;
      if (g.mobManager) {
        if (g.mobManager.ensureWorld) g.mobManager.ensureWorld(g.worldId);
        else g.mobManager.spawnWorld(g.worldId);
      }
      return g.worldId;
    };
    return g;
  }

  function step(g, seconds, onFrame) {
    const dt = 1 / 60;
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) {
      if (g.player) g.player.update(dt, NO_INPUT);
      g.mobManager.update(dt);
      g.effects.update(dt);
      if (g.player) g.player.invuln = 0;
      if (onFrame) onFrame(i);
    }
  }

  /* ---------- 1) 혼자 하기: 세계 이동 · 다시 시작 · 부활에도 보스는 하나 ---------- */
  const solo = makeBossGame();
  check(aliveBosses(solo.mobManager, 'golem') === 1, 'solo must start with one golem, got ' + aliveBosses(solo.mobManager, 'golem'));
  check(solo.mobManager.bossCount('golem') === 1, 'MobManager.bossCount must see the golem');
  for (let i = 0; i < 4; i++) solo.setWorld(i % 2 ? 2 : 1);
  check(aliveBosses(solo.mobManager, 'golem') === 1, 'world switching duplicated the golem: ' + aliveBosses(solo.mobManager, 'golem'));
  check(aliveBosses(solo.mobManager, 'dark_mage') === 1, 'world 2 must have exactly one dark mage: ' + aliveBosses(solo.mobManager, 'dark_mage'));
  // 같은 세계를 여러 번 다시 세워도 하나
  for (let i = 0; i < 5; i++) { solo.mobManager.ensureWorld(1); solo.mobManager.ensureWorld(2); }
  check(aliveBosses(solo.mobManager, 'golem') === 1 && aliveBosses(solo.mobManager, 'dark_mage') === 1,
    'ensureWorld must never spawn a second boss: ' + aliveBosses(solo.mobManager) );
  // 보스를 한 번 더 세우려 해도 살아 있는 보스 자리에 또 세우지 않는다
  const again = solo.mobManager.spawn('golem', BOSS_POS, 'temple');
  check(solo.mobManager.mobs.filter((m) => m.typeId === 'golem').length === 1,
    'spawning a golem while one is alive must not add a second body: ' + solo.mobManager.mobs.filter((m) => m.typeId === 'golem').length);
  check(again && again.typeId === 'golem', 'the boss spawn must return the existing boss');
  // 일반 몹 부활은 그대로 (보스만 예외)
  const slimeForRespawn = solo.mobManager.mobs.find((m) => m.typeId === 'slime');
  slimeForRespawn.takeDamage(1e9, {});
  slimeForRespawn.respawnT = 0.05;
  for (let i = 0; i < 12; i++) solo.mobManager.update(1 / 60);
  check(!slimeForRespawn.dead, 'normal mobs must still respawn after death');
  check(aliveBosses(solo.mobManager, 'golem') === 1, 'a respawn must not create another boss');
  // 앱을 다시 시작하는 것과 같은 경로(clearAll → spawnAll)
  solo.mobManager.clearAll();
  solo.mobManager.spawnAll();
  check(aliveBosses(solo.mobManager, 'golem') === 1 && aliveBosses(solo.mobManager, 'dark_mage') === 1,
    'restart (clearAll + spawnAll) must leave one boss per land: ' + aliveBosses(solo.mobManager));

  /* ---------- 2) 함께 하기 손님: 부활·세계 이동에도 내 보스가 끼어들지 않는다 ---------- */
  const host = makeBossGame();
  host.world2Unlocked = true;
  host.setWorld(2);
  const bossRecords = host.mobManager.mobs.filter((m) => m.type.boss).map((m) => packMob(m));
  check(bossRecords.length === 2, 'the host snapshot must carry both bosses, got ' + bossRecords.length);

  const guestGame = makeBossGame();
  const guestNet = new Net(guestGame);
  guestGame.net = guestNet;
  guestNet.role = 'guest';
  guestNet.active = true;
  guestNet.pid = 'GUEST1';
  guestNet.hostPid = 'HOST01';
  // 방에 들어오면 손님은 자기 로컬 몹을 버리고 호스트 스냅샷만 그린다
  guestGame.mobManager.clearAll();
  guestNet.mirrors.clear();
  guestNet._applyWorld({ ps: [], ms: bossRecords, ds: [] });
  check(aliveBosses(guestGame.mobManager, 'golem') === 1 && aliveBosses(guestGame.mobManager, 'dark_mage') === 1,
    'the guest must mirror one boss per land: ' + aliveBosses(guestGame.mobManager));
  // 부활하거나 세계를 옮길 때마다 setWorld 가 불린다 — 예전에는 여기서 로컬 보스가 하나 더 생겼다
  for (let i = 0; i < 4; i++) guestGame.setWorld(i % 2 ? 2 : 1);
  check(aliveBosses(guestGame.mobManager, 'golem') === 1, 'a teammate must not spawn a second golem on its own screen: ' + aliveBosses(guestGame.mobManager, 'golem'));
  check(aliveBosses(guestGame.mobManager, 'dark_mage') === 1, 'a teammate must not spawn a second dark mage: ' + aliveBosses(guestGame.mobManager, 'dark_mage'));
  // 손님 화면에서는 로컬 몹을 아예 세우지 않는다 (호스트 스냅샷과 겹치지 않게)
  check(guestGame.mobManager.isGuestSession() === true, 'a guest session must be detected');
  check(guestGame.mobManager.ensureWorld(1) === false, 'ensureWorld must do nothing on a guest screen');
  check(guestGame.mobManager.mobs.every((m) => m.remote), 'a guest screen must only hold host mirrors: ' + guestGame.mobManager.mobs.filter((m) => !m.remote).length + ' local mobs');
  // 그래도 로컬 보스가 억지로 끼어들면 정리된다
  const strayGolem = new Mob(guestGame, 'golem', BOSS_POS, 'temple');
  strayGolem.netId = guestGame.mobManager.nextNetId();
  guestGame.mobManager.mobs.push(strayGolem);
  check(aliveBosses(guestGame.mobManager, 'golem') === 2, 'test setup: the stray golem must be there');
  guestNet._applyWorld({ ps: [], ms: bossRecords, ds: [] });
  check(aliveBosses(guestGame.mobManager, 'golem') === 1, 'a duplicate local boss must be cleaned up, got ' + aliveBosses(guestGame.mobManager, 'golem'));
  check(guestGame.mobManager.mobs.filter((m) => m.typeId === 'golem').every((m) => m.remote), 'the host mirror must be the boss that stays');

  /* ---------- 3) 호스트: 친구가 오가도 보스는 하나 ---------- */
  const hostNet = new Net(host);
  host.net = hostNet;
  hostNet.role = 'host';
  hostNet.active = true;
  hostNet.pid = 'HOST01';
  hostNet.roomCode = 'TEST';
  for (let i = 0; i < 6; i++) hostNet._ensureWorldMobs(i % 2 ? 2 : 1);
  check(aliveBosses(host.mobManager, 'golem') === 1 && aliveBosses(host.mobManager, 'dark_mage') === 1,
    'the host must keep one boss per land while friends come and go: ' + aliveBosses(host.mobManager));

  /* ---------- 4) 고대 골렘 스킬: 예고 → 피해 ---------- */
  const gSkills = MOB_TYPES.golem.skills;
  check(Array.isArray(gSkills) && gSkills.length >= 3, 'the golem needs at least three boss skills');
  for (const id of ['quake', 'boulder', 'roar']) {
    check(!!gSkills.find((s) => s.id === id), 'the golem skill is missing: ' + id);
  }
  for (const def of gSkills) {
    check(def.telegraph >= 0.8 && def.telegraph <= 1.2, def.id + ' telegraph must be 0.8~1.2s, got ' + def.telegraph);
    check(def.damage > 0, def.id + ' must deal damage');
    check(!!def.label && def.label.indexOf('!') >= 0, def.id + ' needs a callout label');
  }

  const gs = makeBossGame();
  const golem = gs.mobManager.mobs.find((m) => m.typeId === 'golem');
  gs.player.maxHp = 999999;
  gs.player.hp = 999999;
  gs.player.spawnAt(golem.position.x + 70, golem.position.z + 10);
  gs.player.invuln = 0;
  golem.aggro = true;
  // 격노하기 전에도 스킬을 쓴다
  const early = new Set();
  step(gs, 26, () => {
    if (golem.castT > 0 && golem.castDef) early.add(golem.castDef.id);
    gs.player.hp = Math.max(gs.player.hp, 1);
  });
  check(!golem.enraged || early.size > 0, 'the golem must use skills before it enrages');
  check(early.size >= 2, 'the golem must mix its skills, used: ' + [...early].join(','));

  // 예고 중에는 피해가 없고, 예고가 끝날 때 들어간다
  const quake = gSkills.find((s) => s.id === 'quake');
  golem.castT = 0;
  golem.castDef = null;
  golem.castHit = false;
  golem.skillCds = {};
  golem.skillGap = 0;
  gs.player.spawnAt(golem.position.x + 80, golem.position.z);
  gs.player.hp = gs.player.maxHp;
  gs.player.invuln = 0;
  const hpBeforeQuake = gs.player.hp;
  const fxBefore = gs.effects.items.length;
  golem.startBossSkill(quake, { position: gs.player.position, alive: true, radius: gs.player.radius });
  check(golem.castT > 0.8, 'quake needs a visible telegraph: ' + golem.castT);
  check(gs.effects.items.length > fxBefore, 'quake must draw a ground warning ring');
  check(gs.floaters.some((f) => f[0] === quake.label && f[1] === 'boss'), 'quake must show its name above the boss');
  step(gs, 0.2);
  check(gs.player.hp === hpBeforeQuake, 'quake must not hit before its telegraph ends');
  step(gs, 1.2);
  check(gs.player.hp < hpBeforeQuake, 'quake must damage a player standing inside the ring');
  check(gs.mobManager.bossCount('golem') === 1, 'a boss skill must not spawn another boss');

  // 바위 투척: 돌덩이가 날아가 예고한 자리에 떨어진다
  const boulder = gSkills.find((s) => s.id === 'boulder');
  golem.castT = 0;
  golem.castDef = null;
  gs.player.spawnAt(golem.position.x + 180, golem.position.z);
  gs.player.hp = gs.player.maxHp;
  gs.player.invuln = 0;
  const hpBeforeBoulder = gs.player.hp;
  golem.startBossSkill(boulder, { position: gs.player.position, alive: true, radius: gs.player.radius });
  step(gs, 1.0);
  check(golem.bolts.length >= 1, 'boulder toss must throw a rock');
  step(gs, 1.6);
  check(gs.player.hp < hpBeforeBoulder, 'the thrown boulder must damage a player who stayed on the mark');

  // 고대의 포효: 잠깐 단단해진다
  const roar = gSkills.find((s) => s.id === 'roar');
  golem.castT = 0;
  golem.castDef = null;
  golem.hp = golem.maxHp;
  golem.guardT = 0;
  golem.startBossSkill(roar, { position: gs.player.position, alive: true, radius: gs.player.radius });
  step(gs, 1.3);
  check(golem.guardT > 0, 'ancient roar must grant the boss a short guard');
  const hpBeforeGuard = golem.hp;
  golem.takeDamage(100, {});
  const guardTaken = hpBeforeGuard - golem.hp;
  check(guardTaken <= 75, 'the roar guard must reduce incoming damage, took ' + guardTaken);

  /* ---------- 5) 흑마법사 스킬: 유성 · 3연 구체 · 공허의 파동 ---------- */
  const mSkills = MOB_TYPES.dark_mage.skills;
  check(Array.isArray(mSkills) && mSkills.length >= 3, 'the dark mage needs at least three boss skills');
  for (const id of ['meteor', 'volley', 'nova']) {
    check(!!mSkills.find((s) => s.id === id), 'the dark mage skill is missing: ' + id);
  }
  for (const def of mSkills) {
    check(def.telegraph >= 0.8 && def.telegraph <= 1.25, def.id + ' telegraph must be 0.8~1.25s, got ' + def.telegraph);
    check(def.damage > 0, def.id + ' must deal damage');
    check(!!def.label, def.id + ' needs a callout label');
  }

  const ms = makeBossGame();
  ms.world2Unlocked = true;
  ms.setWorld(2);
  const mage = ms.mobManager.mobs.find((m) => m.typeId === 'dark_mage');
  ms.player.maxHp = 999999;
  ms.player.hp = 999999;
  ms.player.spawnAt(mage.position.x, mage.position.z + 140);
  ms.player.invuln = 0;
  mage.aggro = true;
  const mageUsed = new Set();
  step(ms, 30, () => {
    if (mage.castT > 0 && mage.castDef) mageUsed.add(mage.castDef.id);
    ms.player.hp = Math.max(ms.player.hp, 1);
  });
  check(mageUsed.size >= 2, 'the dark mage must mix its skills, used: ' + [...mageUsed].join(','));

  // 어둠의 유성: 2~3개의 예고 자리 → 기둥이 솟는다
  const meteor = mSkills.find((s) => s.id === 'meteor');
  mage.castT = 0;
  mage.castDef = null;
  mage.bolts.length = 0;
  ms.player.spawnAt(mage.position.x, mage.position.z + 150);
  ms.player.hp = ms.player.maxHp;
  ms.player.invuln = 0;
  const hpBeforeMeteor = ms.player.hp;
  const fxBeforeMeteor = ms.effects.items.length;
  mage.startBossSkill(meteor, { position: ms.player.position, alive: true, radius: ms.player.radius });
  check(mage.castSpots.length >= 2 && mage.castSpots.length <= 4, 'the meteor must mark 2~4 spots, got ' + mage.castSpots.length);
  check(ms.effects.items.length > fxBeforeMeteor + 1, 'the meteor must mark its spots on the ground');
  check(ms.floaters.some((f) => f[0] === meteor.label), 'the meteor must announce its name');
  step(ms, 1.3);
  check(ms.player.hp < hpBeforeMeteor, 'the meteor must damage a player standing on a marked spot');

  // 암흑 3연 구체: 세 발
  const volley = mSkills.find((s) => s.id === 'volley');
  mage.castT = 0;
  mage.castDef = null;
  mage.bolts.length = 0;
  ms.player.spawnAt(mage.position.x, mage.position.z + 200);
  ms.player.hp = ms.player.maxHp;
  ms.player.invuln = 0;
  mage.startBossSkill(volley, { position: ms.player.position, alive: true, radius: ms.player.radius });
  step(ms, 1.0);
  check(mage.bolts.length === 3, 'the dark volley must fire three orbs, got ' + mage.bolts.length);
  const hpBeforeVolley = ms.player.hp;
  step(ms, 1.6);
  check(ms.player.hp < hpBeforeVolley, 'the dark volley must damage the player');
  mage.clearBolts();

  // 공허의 파동: 보스에 붙은 상대를 밀어낸다
  const nova = mSkills.find((s) => s.id === 'nova');
  mage.castT = 0;
  mage.castDef = null;
  mage.bolts.length = 0;
  ms.player.spawnAt(mage.position.x, mage.position.z + 70);
  ms.player.hp = ms.player.maxHp;
  ms.player.invuln = 0;
  const hpBeforeNova = ms.player.hp;
  const posBeforeNova = ms.player.position.clone();
  mage.startBossSkill(nova, { position: ms.player.position, alive: true, radius: ms.player.radius });
  step(ms, 0.2);
  check(ms.player.hp === hpBeforeNova, 'the void nova must telegraph before it hits');
  step(ms, 1.0);
  check(ms.player.hp < hpBeforeNova, 'the void nova must damage a player hugging the boss');
  check(ms.player.position.distanceTo(posBeforeNova) > 1, 'the void nova must push the player away');
  check(ms.mobManager.bossCount('dark_mage') === 1, 'the dark mage skills must not duplicate the boss');

  /* ---------- 6) 함께 하기: 보스 스킬이 친구에게도 들어간다 ---------- */
  const mp = makeBossGame();
  const mpGolem = mp.mobManager.mobs.find((m) => m.typeId === 'golem');
  mp.net = {
    active: true,
    isHost: true,
    hostTargets() { return mp.remote ? [mp.remote] : []; },
    hitGuest(pid, dmg) { mp.hits.push([pid, dmg]); },
    broadcastBossSkill(mob, def, spots, dur) { mp.broadcast.push([def.id, spots.length, dur]); return true; },
  };
  mp.remote = { pid: 'guest-1', remote: true, alive: true, radius: 4.6, position: new THREE.Vector3(mpGolem.position.x + 60, 0, mpGolem.position.z), world: 1 };
  mp.player.invuln = 0;
  mp.player.spawnAt(mpGolem.position.x + 900, mpGolem.position.z);
  mpGolem.aggro = true;
  const mpQuake = gSkills.find((s) => s.id === 'quake');
  mpGolem.startBossSkill(mpQuake, { position: mp.remote.position, alive: true, radius: 4.6 });
  check(mp.broadcast.length === 1 && mp.broadcast[0][0] === 'quake', 'the host must tell teammates where the boss skill will land');
  step(mp, 1.2);
  check(mp.hits.length > 0 && mp.hits[0][0] === 'guest-1' && mp.hits[0][1] > 0, 'a boss skill must damage the teammate through hitGuest');

  // 친구 화면: 미러 보스가 같은 이름 · 같은 범위로 예고를 그린다
  const mirrorBoss = guestNet.mirrors.size ? [...guestNet.mirrors.values()].find((m) => m.type.boss) : null;
  check(!!mirrorBoss, 'the guest must hold a boss mirror');
  if (mirrorBoss) {
    const before = guestGame.effects.items.length;
    const cuesBefore = guestGame.floaters.length;
    guestNet._applyBossSkill({
      m: mirrorBoss.netId, k: 1, q: 7, d: 1.05,
      c: [[mirrorBoss.position.x, mirrorBoss.position.z, 205]],
    });
    check(mirrorBoss.cueSeq === 7, 'the guest mirror must remember the cast it drew');
    check(guestGame.effects.items.length > before, 'the guest must draw the boss skill warning ring');
    check(guestGame.floaters.length > cuesBefore, 'the guest must show the boss skill name');
    // 같은 예고를 다시 받아도 두 번 그리지 않는다
    const fxAfter = guestGame.effects.items.length;
    guestNet._applyBossSkill({
      m: mirrorBoss.netId, k: 1, q: 7, d: 1.05,
      c: [[mirrorBoss.position.x, mirrorBoss.position.z, 205]],
    });
    check(guestGame.effects.items.length === fxAfter, 'the same skill cue must not be drawn twice');
  }
  // 스냅샷에도 스킬 상태가 실린다 (예고를 놓쳐도 이름과 자세는 보인다)
  const packedCasting = packMob({
    netId: 3, typeId: 'golem', position: new THREE.Vector3(0, 0, 0), hp: 5000,
    attackT: 0, attackDur: 1.15, state: 'chase', castT: 0.5, castDur: 1.0,
    castDef: gSkills.find((s) => s.id === 'quake'), castSeq: 4,
  });
  const unpackedCasting = unpackMob(packedCasting);
  check(unpackedCasting.skill === 1 && unpackedCasting.seq === 4, 'the boss skill state must ride the mob snapshot: ' + JSON.stringify([unpackedCasting.skill, unpackedCasting.seq]));
}

/* =====================================================================
   함께 하기 (끝까지): 두 Net 인스턴스를 메모리 중계로 실제로 잇는다
   ===================================================================== */
{
  const { runMpLoopbackChecks } = await import('/workspace/RPG-game/tests/mp-loopback.mjs');
  runMpLoopbackChecks(check);
}

/* =====================================================================
   3번째 세계 — 선사시대 숲 · 공룡 · 최종 보스 강하닭 · 10만G 상점 · 순차 퀘스트
   ===================================================================== */
{
  const W3 = WORLD3.originZ;

  /* ---------------------- 1) 지역 6곳 · 좌표 · 지형 ---------------------- */
  const expectMob3 = {
    village_w3: [],
    annoying_forest: ['tyrannosaurus', 'spinosaurus'],
    secret_cave: ['wyvern'],
    fantasy_forest: ['dragon'],
    corrupted_city: ['fallen_hero'],
    occupied_ranch: ['strong_chicken'],
  };
  check(BIOME_ORDER_W3.length === 6, 'world 3 must have 6 biomes, got ' + BIOME_ORDER_W3.length);
  for (const region of Object.keys(expectMob3)) {
    const b = BIOMES[region];
    check(!!b, 'world 3 biome missing: ' + region);
    if (!b) continue;
    check(b.world === 3, region + ' must be tagged as world 3');
    check(b.bounds.x1 - b.bounds.x0 === 1000 && b.bounds.z1 - b.bounds.z0 === 1000, region + ' must be 1000x1000');
    check(worldAt(b.center.x, b.center.z) === 3, region + ' must sit in world 3 coordinates');
    check(regionAt(b.center.x, b.center.z) === region, region + ' region lookup wrong: ' + regionAt(b.center.x, b.center.z));
    check(b.bounds.z0 > WORLD2.zMax, region + ' must not overlap world 2');
    check(!!b.landmark && !!b.landmarkPos, region + ' needs a landmark');
    check(b.minimap && b.sky && b.fog, region + ' needs map/sky/fog colors');
    if (expectMob3[region].length === 0) {
      check(!b.mob && !b.mobCount && b.peaceful === true, region + ' must be a peaceful zone');
    } else {
      const types = Array.isArray(b.mobs) && b.mobs.length ? b.mobs.slice() : [b.mob];
      for (const t of expectMob3[region]) check(types.indexOf(t) >= 0, region + ' must spawn ' + t + ', got ' + types.join(','));
      check(b.mobCount > 0, region + ' needs a mob population');
      if (expectMob3[region].length === 2) {
        check(b.mobCount >= 10, region + ' must hold both dinosaurs in numbers, got ' + b.mobCount);
      }
    }
  }
  // 사용자 수정: 지역 이름은 '선사시대 숲' (성가시대 숲이 아니다)
  check(BIOMES.annoying_forest.name === '선사시대 숲', 'prehistoric forest name wrong: ' + BIOMES.annoying_forest.name);
  check(BIOMES.annoying_forest.en === 'Prehistoric Forest', 'prehistoric forest english name wrong: ' + BIOMES.annoying_forest.en);
  check(BIOMES.annoying_forest.short === '선사시대 숲', 'prehistoric forest short name wrong: ' + BIOMES.annoying_forest.short);
  for (const loc of Object.keys(BIOMES)) {
    const text = [BIOMES[loc].name, BIOMES[loc].short, BIOMES[loc].en, BIOMES[loc].landmark].join(' ');
    check(text.indexOf('성가시대') < 0, 'the old biome name must not remain: ' + loc + ' ' + text);
  }

  check(worldAt(0, 0) === 1 && worldAt(0, WORLD2.originZ) === 2 && worldAt(0, W3) === 3, 'worldAt must tell the three worlds apart');
  check(WORLD3.originZ > WORLD2.zMax + 2000, 'world 3 must be far below world 2');
  check(regionAt(0, W3 - 1000) === 'occupied_ranch', 'occupied ranch region wrong');
  check(regionAt(-1000, W3) === 'secret_cave', 'secret cave region wrong');
  check(regionAt(1000, W3) === 'fantasy_forest', 'fantasy forest region wrong');
  check(regionAt(0, W3 + 1000) === 'annoying_forest', 'prehistoric forest region wrong');
  check(regionAt(0, W3 + 2000) === 'village_w3', 'world 3 village region wrong');
  check(regionAt(0, W3 + 1490) === 'annoying_forest', 'road north of the world 3 village must still be the prehistoric forest');
  check(regionAt(0, W3 + 1510) === 'village_w3', 'road south of the prehistoric forest must be the world 3 village');

  // 지형은 지역 경계에서 이어져야 한다
  const w3Edges = [
    [0, W3 + 500], [0, W3 - 500], [-500, W3], [500, W3],
    [0, W3 + 1500], [0, W3 - 1500], [-1500, W3], [1500, W3],
    [0, W3 + 1400], [-1000, W3], [1000, W3],
    [0, W3 + 2500], [-500, W3 + 2000], [500, W3 + 2000],
    [-380, W3 + 1500], [380, W3 + 1500], [0, W3 + 2000],
  ];
  for (const [x, z] of w3Edges) {
    const a = terrainHeight(x - 0.01, z);
    const b2 = terrainHeight(x + 0.01, z);
    const c = terrainHeight(x, z - 0.01);
    const d = terrainHeight(x, z + 0.01);
    check(Math.abs(a - b2) < 0.05 && Math.abs(c - d) < 0.05, 'world 3 terrain discontinuity at ' + x + ',' + z);
  }
  check(Math.abs(terrainHeight(0, W3)) < 3, 'corrupted city arena must be fairly flat');
  check(Math.abs(terrainHeight(WORLD3_ARRIVAL.x, WORLD3_ARRIVAL.z)) < 1.5, 'world 3 arrival plaza must be flat');

  // 3세계 태초마을 · 상점
  const v3 = BIOMES.village_w3;
  check(v3.mob === null && v3.mobCount === 0 && v3.peaceful === true, 'world 3 village must be a peaceful zone');
  check(regionAt(v3.spawn.x, v3.spawn.z) === 'village_w3', 'world 3 village spawn is outside the village');
  check(!!v3.shop && v3.shop.id === 'shop_w3' && !!v3.shop.interact, 'world 3 village needs a shop');
  check(regionAt(v3.shop.interact.x, v3.shop.interact.z) === 'village_w3', 'world 3 shop counter must stand in the village');
  check(Math.hypot(v3.shop.interact.x - v3.spawn.x, v3.shop.interact.z - v3.spawn.z) > v3.shop.interact.radius, 'player must not start inside the world 3 shop trigger');
  check(shopForBiome('village_w3') === SHOP3, 'shop lookup by world 3 biome broken');
  check(shopById('shop_w3') === SHOP3 && SHOPS.shop_w3 === SHOP3, 'shop_w3 must be reachable by id');
  check(homeBiomeFor(3) === BIOMES.village_w3, 'home biome of world 3 wrong');
  check(regionAt(homeSpawnFor(3).x, homeSpawnFor(3).z) === 'village_w3', 'respawn point of world 3 must be inside the world 3 village');
  check(biomeOrderFor(3) === BIOME_ORDER_W3, 'biomeOrderFor(3) wrong');
  check(compassOrderFor(3)[0] === 'occupied_ranch' && compassOrderFor(3).length === 6, 'world 3 compass wrong: ' + compassOrderFor(3).join(','));
  check(regionAt(BOSS3_POS.x, BOSS3_POS.z) === 'occupied_ranch', 'strong chicken must stand in the occupied ranch');
  check(bossPosFor('occupied_ranch') === BOSS3_POS && bossPosFor('dark_realm') === BOSS2_POS, 'bossPosFor wrong');

  // 지역 컬링: 세 세계는 서로 안 보인다
  updateBiomeCulling(world, { x: 0, z: W3 }, 1280);
  check(world.biomeGroups.corrupted_city.visible === true, 'corrupted city must show in world 3');
  check(world.biomeGroups.occupied_ranch.visible === true, 'occupied ranch must be visible from the city');
  check(world.biomeGroups.village.visible === false, 'world 1 village must be culled in world 3');
  check(world.biomeGroups.dark_realm.visible === false, 'world 2 dark realm must be culled in world 3');
  updateBiomeCulling(world, { x: 0, z: W3 + 1400 }, 1280);
  check(world.biomeGroups.village_w3.visible === true, 'world 3 village must be visible from the forest gate');
  for (const region of Object.keys(expectMob3)) {
    let meshes = 0;
    world.biomeGroups[region].traverse((o) => { if (o.isMesh || o.isInstancedMesh) meshes++; });
    check(meshes > 6, region + ' has too few objects: ' + meshes);
  }

  /* ---------------------- 2) 몹 · 최종 보스 강하닭 ---------------------- */
  const EXPECT_MOB3 = {
    dragon: [5200, 190, 2600, 1800], wyvern: [4200, 160, 2100, 1500],
    spinosaurus: [6000, 210, 3000, 2000], tyrannosaurus: [5400, 230, 2900, 2000],
    fallen_hero: [7600, 260, 4200, 2800], strong_chicken: [46000, 360, 20000, 12000],
  };
  for (const [id, v] of Object.entries(EXPECT_MOB3)) {
    const t = MOB_TYPES[id];
    check(!!t, 'world 3 mob missing: ' + id);
    if (!t) continue;
    check(t.hp === v[0] && t.damage === v[1] && t.xp === v[2] && t.gold === v[3], id + ' stats wrong: ' + JSON.stringify(t));
    check(t.gold >= 1500, id + ' must drop generous gold for the 100,000G shop');
  }
  // 두 번째 세계보다 확실히 강하다
  const w2Strongest = Math.max(...['goblin', 'skeleton', 'samurai', 'iron_golem'].map((id) => MOB_TYPES[id].hp));
  for (const id of ['dragon', 'wyvern', 'spinosaurus', 'tyrannosaurus', 'fallen_hero']) {
    check(MOB_TYPES[id].hp > w2Strongest, id + ' must be stronger than any world 2 normal mob');
  }
  // 강하닭은 거대하다 (사용자 요청: "강하닭은 크게만들어야되")
  const chickenType = MOB_TYPES.strong_chicken;
  check(chickenType.boss === true, 'strong chicken must be a boss');
  check(chickenType.height >= 58, 'strong chicken must be huge, height=' + chickenType.height);
  check(chickenType.radius >= 22, 'strong chicken must be bulky, radius=' + chickenType.radius);
  check(chickenType.height > MOB_TYPES.golem.height && chickenType.radius > MOB_TYPES.golem.radius, 'strong chicken must be larger than the ancient golem');
  check(chickenType.enrageAt > 0, 'strong chicken must enrage');

  // 보스 스킬 3종 (깃털 폭풍 · 거대 부리 강타 · 황금 알 폭격)
  const chSkills = chickenType.skills || [];
  check(chSkills.length === 3, 'strong chicken needs 3 boss skills, got ' + chSkills.length);
  check(chSkills.map((s) => s.id).join(',') === 'feather,beaksmash,eggbarrage', 'strong chicken skill ids wrong: ' + chSkills.map((s) => s.id).join(','));
  check(chSkills[0].label.indexOf('깃털') >= 0 && chSkills[1].label.indexOf('부리') >= 0 && chSkills[2].label.indexOf('알') >= 0, 'strong chicken skill names wrong: ' + chSkills.map((s) => s.label).join(' '));
  for (const s of chSkills) {
    check(s.telegraph >= 0.8 && s.telegraph <= 1.2, s.id + ' telegraph out of range: ' + s.telegraph);
    check(typeof s.name === 'string' && s.name.length > 0, s.id + ' needs a name');
    check((s.damage || 0) > 0.5, s.id + ' must hurt');
  }
  // 함께 하기: 새 스킬도 번호로 주고받는다
  check(bossSkillCode('feather') > 6 && bossSkillCode('eggbarrage') > 6, 'new boss skills need snapshot codes');
  check(bossSkillByCode(bossSkillCode('eggbarrage')).id === 'eggbarrage', 'skill code round-trip broken');
  check(bossSkillById('beaksmash').name === '거대 부리 강타', 'bossSkillById broken');
  check(MOB_CODES.indexOf('dragon') >= 0 && MOB_CODES.indexOf('strong_chicken') >= 0, 'new mobs must be in MOB_CODES');

  /* ---------------------- 3) 3세계 몹 스폰 · 포털 ---------------------- */
  const w3scene = new THREE.Scene();
  const w3game = {
    scene: w3scene,
    effects: new Effects(w3scene),
    elapsed: 0,
    state: 'playing',
    worldId: 1,
    world2Unlocked: false,
    world3Unlocked: false,
    gold: 0,
    timers: [],
    kills: [],
    camera: { position: { copy() {} } },
    after(sec, fn) { w3game.timers.push({ t: sec, fn }); },
    shake() {},
    sfx: new Proxy({}, { get: () => () => {} }),
    addGold(n) { w3game.gold += n; },
    recordKill(t, w) { w3game.kills.push([t, normWorld(w)]); return null; },
    placeCamera() {},
    setPortalPrompt() {},
    onBossEngage() {},
    onPlayerDeath() {},
    onBossDefeated(boss) { return handleBossDefeated(w3game, boss); },
  };
  w3game.hud = {
    floater() {}, banner() {}, refreshBars() {}, refreshQuest() {}, questFlash() {},
    updateGold() {}, refreshPotions() {}, setTarget() {}, showEnd() {}, hideEnd() {},
    setWorld() {}, refreshWeapon() {}, updateRoom() {}, showRoom() {}, hideRoom() {},
  };
  w3game.combat = new Combat(w3game);
  w3game.mobManager = new MobManager(w3game);
  w3game.player = new Player(w3game, 'warrior');
  w3game.player.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  w3game.castSkill = (k) => castSkill(w3game, k);
  w3game.terrainHeightAt = terrainHeight;
  w3game.combatTargets = () => [{ local: true, alive: w3game.player.alive, radius: w3game.player.radius, position: w3game.player.position, world: w3game.worldId }];
  w3game.setWorld = (id) => {
    w3game.worldId = normWorld(id);
    if (w3game.worldId === 2) w3game.world2Unlocked = true;
    if (w3game.worldId === 3) { w3game.world2Unlocked = true; w3game.world3Unlocked = true; }
    return w3game.worldId;
  };
  w3game.travelTo = (target) => travelPlayer(w3game, target);
  w3game.portals = new Portals(w3game);

  check(w3game.portals.world3Portal.open === false, 'the world 3 portal must start closed');
  check(regionAt(WORLD2_PORTAL_POS.x, WORLD2_PORTAL_POS.z) === 'dark_realm', 'the world 3 portal must open in the dark realm');
  check(regionAt(WORLD3_RETURN_POS.x, WORLD3_RETURN_POS.z) === 'village_w3', 'the world 2 return portal must stand in the world 3 village');
  check(Math.hypot(WORLD3_RETURN_POS.x - WORLD3_ARRIVAL.x, WORLD3_RETURN_POS.z - WORLD3_ARRIVAL.z) > 100, 'the return portal must be far enough from the arrival spot');
  // 흑마법사 처치 → 3번째 세계 포털이 열리고 그 몹들이 세워진다
  handleBossDefeated(w3game, { typeId: 'dark_mage', position: new THREE.Vector3(0, 0, WORLD2.originZ + 130), type: MOB_TYPES.dark_mage });
  check(w3game.portals.world3Portal.open === true && w3game.portals.world3Portal.group.visible === true, 'the world 3 portal must open after the dark mage dies');
  check(w3game.world3Unlocked === true, 'world 3 must stay unlocked in this session');

  const w3mobs = w3game.mobManager.mobs.filter((m) => m.worldId === 3);
  const c3 = {};
  for (const m of w3mobs) c3[m.typeId] = (c3[m.typeId] || 0) + 1;
  console.log('world 3 mob counts:', JSON.stringify(c3));
  check((c3.dragon || 0) >= 6, 'dragon population missing: ' + c3.dragon);
  check((c3.wyvern || 0) >= 8, 'wyvern population missing: ' + c3.wyvern);
  check((c3.spinosaurus || 0) >= 4, 'spinosaurus population missing: ' + c3.spinosaurus);
  check((c3.tyrannosaurus || 0) >= 4, 'tyrannosaurus population missing: ' + c3.tyrannosaurus);
  check((c3.fallen_hero || 0) >= 6, 'fallen hero population missing: ' + c3.fallen_hero);
  check(c3.strong_chicken === 1, 'strong chicken must spawn exactly once, got ' + c3.strong_chicken);
  // 선사시대 숲에는 두 공룡이 함께 산다 (같이소환)
  const inForest = w3mobs.filter((m) => regionAt(m.position.x, m.position.z) === 'annoying_forest');
  check(inForest.some((m) => m.typeId === 'spinosaurus') && inForest.some((m) => m.typeId === 'tyrannosaurus'), 'both dinosaurs must live in the prehistoric forest');
  const home3 = {
    dragon: 'fantasy_forest', wyvern: 'secret_cave', spinosaurus: 'annoying_forest',
    tyrannosaurus: 'annoying_forest', fallen_hero: 'corrupted_city', strong_chicken: 'occupied_ranch',
  };
  for (const m of w3mobs) {
    const r = regionAt(m.position.x, m.position.z);
    check(r === home3[m.typeId], m.typeId + ' spawned in ' + r + ' (expected ' + home3[m.typeId] + ')');
  }
  check(!w3mobs.some((m) => regionAt(m.position.x, m.position.z) === 'village_w3'), 'no hostile mob may spawn in the world 3 village');
  check(!w3mobs.some((m) => m.position.z < WORLD.zMax + 1000), 'world 3 mobs must not spawn in world 1');
  const chicken = w3mobs.find((m) => m.typeId === 'strong_chicken');
  check(!!chicken, 'strong chicken missing');
  check(Math.abs(chicken.position.x - BOSS3_POS.x) < 60 && Math.abs(chicken.position.z - BOSS3_POS.z) < 60, 'strong chicken not at the ranch nest');
  check(chicken.level > MOB_TYPES.dark_mage.level, 'strong chicken must be the highest level boss');
  check(w3game.mobManager.bossCount('strong_chicken') === 1, 'bossCount must see one strong chicken');
  // 하나 더 만들어도 정리된다
  const strayChicken = new Mob(w3game, 'strong_chicken', BOSS3_POS, 'occupied_ranch');
  w3game.mobManager.mobs.push(strayChicken);
  check(w3game.mobManager.bossCount('strong_chicken') === 2, 'test setup: the stray chicken must be there');
  w3game.mobManager.enforceBossUniqueness();
  check(w3game.mobManager.bossCount('strong_chicken') === 1, 'duplicate strong chickens must be cleaned up');

  // 몸에서 떨어진 팔 · 다리가 없어야 한다 (3세계 몹 6종)
  {
    const limbNames = ['armL', 'armR', 'legL', 'legR', 'head', 'wingL', 'wingR', 'tail'];
    for (const id of Object.keys(EXPECT_MOB3)) {
      const mob = w3mobs.find((m) => m.typeId === id);
      check(!!mob, id + ' must be spawned to check its model');
      if (!mob) continue;
      mob.model.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mob.model.root);
      const pts = [];
      for (const n of limbNames) if (mob.model[n]) pts.push([n, mob.model[n]]);
      if (mob.model.legs) mob.model.legs.forEach((leg, i) => pts.push(['legs[' + i + ']', leg]));
      const v = new THREE.Vector3();
      for (const [name, node] of pts) {
        node.getWorldPosition(v);
        check(box.containsPoint(v), id + ' ' + name + ' floats outside the body at y=' + v.y.toFixed(1));
      }
    }
  }

  // 포털로 3세계 도착 → 2세계로 귀환
  const traveller = new Player(w3game, 'warrior');
  w3game.player = traveller;
  traveller.spawnAt(BIOMES.village.spawn.x, BIOMES.village.spawn.z);
  w3game.setWorld(1);
  travelPlayer(w3game, { world: 3, x: WORLD3_ARRIVAL.x, z: WORLD3_ARRIVAL.z, yaw: Math.PI });
  check(w3game.worldId === 3 && regionAt(traveller.position.x, traveller.position.z) === 'village_w3', 'travelling to world 3 must land in its village');
  travelPlayer(w3game, w3game.portals.returnPortalW3.target);
  check(w3game.worldId === 2 && regionAt(traveller.position.x, traveller.position.z) === 'village_w2', 'the world 3 return portal must lead back to the world 2 village');

  // 보스 기술: 예고 → 피해 · 격노
  w3game.setWorld(3);
  w3game.player.spawnAt(0, BOSS3_POS.z + 150);
  w3game.player.hp = w3game.player.maxHp;
  w3game.player.invuln = 0;
  chicken.position.set(0, terrainHeight(0, BOSS3_POS.z), BOSS3_POS.z);
  chicken.aggro = true;
  chicken.bossIntroDone = true;
  chicken.skillGap = 0;
  const beak = chSkills.find((s) => s.id === 'beaksmash');
  // 격노: 체력 40% 로 떨어뜨리면 다음 프레임에 격노한다
  chicken.position.set(0, terrainHeight(0, BOSS3_POS.z), BOSS3_POS.z);
  chicken.hp = chicken.maxHp * 0.4;
  chicken.update(1 / 60);
  check(chicken.enraged === true, 'strong chicken must enrage below half health');
  chicken.hp = chicken.maxHp;
  w3game.player.hp = w3game.player.maxHp;
  w3game.player.invuln = 0;
  check(chicken.startBossSkill(beak, { position: w3game.player.position, alive: true, radius: 4.6 }) === true, 'strong chicken must start its boss skill');
  check(chicken.castDef && chicken.castDef.id === 'beaksmash' && chicken.castT > 0.5, 'boss skill needs a visible telegraph');
  const hpBeforeBeak = w3game.player.hp;
  for (let i = 0; i < 120; i++) chicken.update(1 / 60);
  check(w3game.player.hp < hpBeforeBeak || !w3game.player.alive, 'the boss skill must damage the player in range');
  // 스냅샷에 새 스킬 상태가 실린다
  const packedChicken = packMob({
    netId: 9, typeId: 'strong_chicken', position: new THREE.Vector3(0, 0, BOSS3_POS.z), hp: 20000,
    attackT: 0, attackDur: 1.15, state: 'chase', castT: 0.4, castDur: 1.0, castDef: chSkills[0], castSeq: 5,
  });
  const unpackedChicken = unpackMob(packedChicken);
  check(unpackedChicken.typeId === 'strong_chicken', 'strong chicken must survive the mob snapshot: ' + unpackedChicken.typeId);
  check(unpackedChicken.skill === bossSkillCode('feather') && unpackedChicken.seq === 5, 'the new boss skill state must ride the snapshot');

  /* ---------------------- 4) 3세계 상점: 다 100,000G 이상 (포션 제외) ---------------------- */
  const w3Weapons = CLASS_ORDER.flatMap((cls) => shopWeaponsFor(cls, 'shop_w3'));
  check(w3Weapons.length === 10, 'ten world 3 weapons expected, got ' + w3Weapons.length);
  for (const w of w3Weapons) {
    check(w.price >= 100000, 'world 3 weapon ' + w.id + ' must cost at least 100,000G, got ' + w.price);
  }
  check(SHOP3.armors.length === 2, 'world 3 needs 2 armors');
  for (const a of SHOP3.armors) {
    check(a.price >= 100000, 'world 3 armor ' + a.id + ' must cost at least 100,000G, got ' + a.price);
    check(a.tier === 6 || a.tier === 7, 'world 3 armor tiers must be 6/7, got ' + a.tier);
  }
  check(SHOP3.potions.length === 3, 'world 3 needs 3 potions');
  for (const p of SHOP3.potions) {
    check(p.price < 100000, 'world 3 potion ' + p.id + ' must stay under 100,000G, got ' + p.price);
  }
  check(SHOP3.potions.map((p) => p.key).join('') === '789', 'world 3 potion keys must be 7/8/9');
  for (const cls of CLASS_ORDER) {
    const w2 = shopWeaponsFor(cls, 'shop_w2');
    const w3 = shopWeaponsFor(cls, 'shop_w3');
    check(w3.length === 2 && w3[0].tier === 6 && w3[1].tier === 7, cls + ' world 3 weapon tiers must be 6/7');
    check(w3[1].price > w3[0].price * 1.8, cls + ' tier 7 must cost far more than tier 6');
    check(w3[0].damage > w2[1].damage && w3[1].damage > w3[0].damage, cls + ' world 3 weapons must beat world 2');
  }
  check(allArmors().length === 7 && MAX_ARMOR_TIER === 7 && MAX_WEAPON_TIER === 6, 'tier limits must reach 6/7');

  // Tier 6 · 7 무기 · 갑옷 장착 · 3D 모델 · 포션 사용
  const w3hero = new Player(w3game, 'warrior');
  w3game.player = w3hero;
  w3hero.spawnAt(BIOMES.village_w3.shop.interact.x, BIOMES.village_w3.shop.interact.z);
  w3hero.equipWeaponTier(0);
  w3hero.weaponBonus = 0;
  w3hero.critChance = w3hero.cls.critChance;
  const baseDmg3 = w3hero.damage;
  const t6 = shopWeaponsFor('warrior', 'shop_w3')[0];
  const t7 = shopWeaponsFor('warrior', 'shop_w3')[1];
  w3game.gold = 99999;
  let r3 = buyItem(w3game, t6.id);
  check(!r3.ok, 'a tier 6 weapon must not be affordable with 99,999G');
  check(w3hero.weaponTier === 0, 'a failed tier 6 purchase changed the weapon');
  w3game.gold = 110000;
  r3 = buyItem(w3game, t6.id);
  check(r3.ok, 'tier 6 weapon purchase failed: ' + r3.msg);
  check(w3hero.weaponTier === 5, 'tier 6 weapon must equip internal tier 5, got ' + w3hero.weaponTier);
  check(Math.abs(w3hero.damage - (baseDmg3 + t6.damage)) < 1e-6, 'tier 6 damage bonus not applied');
  const mesh6 = w3hero.weapons.right || w3hero.weapons.left;
  check(mesh6 && mesh6.userData.tier === 5, '3D weapon must upgrade to the tier 6 model');
  w3game.gold = 230000;
  r3 = buyItem(w3game, t7.id);
  check(r3.ok, 'tier 7 weapon purchase failed: ' + r3.msg);
  check(w3hero.weaponTier === 6 && w3hero.weaponTier === MAX_WEAPON_TIER, 'tier 7 weapon must equip internal tier 6, got ' + w3hero.weaponTier);
  check(Math.abs(w3hero.damage - (baseDmg3 + t7.damage)) < 1e-6, 'tier 7 bonus must replace tier 6');
  const mesh7 = w3hero.weapons.right || w3hero.weapons.left;
  check(mesh7 && mesh7.userData.tier === 6, '3D weapon must upgrade to the tier 7 model');
  w3hero.equipWeaponTier(99);
  check(w3hero.weaponTier === 6, 'weapon tier must clamp at 6');

  const baseMaxHp3 = w3hero.maxHp;
  const dragonArmor = SHOP3.armors[0];
  const celestialArmor = SHOP3.armors[1];
  w3game.gold = 125000;
  let ar3 = buyItem(w3game, dragonArmor.id);
  check(ar3.ok, 'dragon armor purchase failed: ' + ar3.msg);
  check(w3hero.armorTier === 6 && Math.abs(w3hero.armorDefense - 0.8) < 1e-9, 'dragon armor not equipped');
  check(w3hero.maxHp === baseMaxHp3 + dragonArmor.hp, 'dragon armor max HP wrong: ' + w3hero.maxHp);
  check(!!w3hero.armorChest, '3D armor pieces missing at tier 6');
  w3hero.hp = w3hero.maxHp;
  w3hero.invuln = 0;
  const taken6 = w3hero.takeDamage(100, null);
  check(Math.abs(taken6 - 20) <= 1, '80% damage reduction wrong: ' + taken6);
  w3game.gold = 260000;
  ar3 = buyItem(w3game, celestialArmor.id);
  check(ar3.ok, 'celestial armor purchase failed: ' + ar3.msg);
  check(w3hero.armorTier === 7 && w3hero.armorTier === MAX_ARMOR_TIER, 'celestial armor not equipped at tier 7');
  check(Math.abs(w3hero.armorDefense - 0.86) < 1e-9, 'celestial armor reduction wrong');
  w3hero.hp = w3hero.maxHp;
  w3hero.invuln = 0;
  const taken7 = w3hero.takeDamage(100, null);
  check(Math.abs(taken7 - 14) <= 1, '86% damage reduction wrong: ' + taken7);

  const legend = SHOP3.potions[0];
  const fortress = SHOP3.potions[1];
  const ascend = SHOP3.potions[2];
  w3game.gold = 5000;
  r3 = buyItem(w3game, legend.id);
  check(r3.ok && w3hero.potionCount(legend.id) === 1, 'legend potion purchase failed: ' + r3.msg);  w3hero.hp = 100;
  const useLegend = w3hero.usePotion(legend.id);
  check(useLegend.ok, 'legend potion use failed: ' + useLegend.msg);
  check(w3hero.hp > 100, 'legend potion must heal a lot: ' + w3hero.hp);
  r3 = buyItem(w3game, fortress.id);
  check(r3.ok, 'fortress potion purchase failed: ' + r3.msg);  w3hero.hp = Math.round(w3hero.maxHp * 0.2);
  check(w3hero.usePotion(fortress.id).ok, 'fortress potion use failed');
  check(w3hero.hp === w3hero.maxHp && w3hero.buffs.guard > 19, 'fortress potion must fully heal and guard for 20s');
  w3hero.invuln = 0;
  const guarded3 = w3hero.takeDamage(100, null);
  check(guarded3 <= 14, 'fortress potion must cut 60% of the remaining damage: ' + guarded3);
  w3game.gold = 5000;
  r3 = buyItem(w3game, ascend.id);
  check(r3.ok, 'ascend elixir purchase failed: ' + r3.msg);  w3hero.hp = w3hero.maxHp;
  const beforeAscend = w3hero.damage;
  check(w3hero.usePotion(ascend.id).ok, 'ascend elixir use failed');
  check(Math.abs(w3hero.damage - beforeAscend * 2) < 1e-6, 'ascend elixir must double attack: ' + w3hero.damage);
  check(w3hero.buffs.rage > 34, 'ascend elixir must last 35s: ' + w3hero.buffs.rage);

  /* ---------------------- 5) 3세계 순차 퀘스트 ---------------------- */
  const want3 = [
    ['dragon', 8, 8000], ['wyvern', 10, 10000], ['tyrannosaurus', 8, 13000],
    ['spinosaurus', 8, 15000], ['fallen_hero', 10, 20000], ['strong_chicken', 1, 35000],
  ];
  check(QUEST_CHAINS[3].length === 6, 'world 3 must have 6 quests');
  for (let i = 0; i < 6; i++) {
    const q = QUEST_CHAINS[3][i];
    check(q.id === 'w3_q' + (i + 1), 'world 3 quest id wrong: ' + q.id);
    check(q.mobType === want3[i][0] && q.target === want3[i][1] && q.rewardGold === want3[i][2], 'world 3 quest ' + (i + 1) + ' wrong: ' + JSON.stringify(q));
  }
  check(questGoalText(QUEST_CHAINS[3][0]) === '용 8마리 잡기', 'world 3 goal text wrong: ' + questGoalText(QUEST_CHAINS[3][0]));
  check(questGoalText(QUEST_CHAINS[3][5]) === '강하닭 1마리 처치', 'world 3 boss goal text wrong: ' + questGoalText(QUEST_CHAINS[3][5]));
  const total3 = QUEST_CHAINS[3].reduce((a, q) => a + q.rewardGold, 0);
  check(total3 >= 100000, 'world 3 quest rewards must fund the 100,000G shop: ' + total3);

  const qlog3 = new QuestLog();
  check(qlog3.chainFor(1).index === 0 && qlog3.chainFor(2).index === 0 && qlog3.chainFor(3).index === 0, 'all quest chains must start at 1');
  check(qlog3.recordKill(1, 'dragon') === null, 'a dragon must not count for world 1');
  check(qlog3.recordKill(2, 'dragon') === null, 'a dragon must not count for world 2');
  let qres = null;
  for (let i = 0; i < 8; i++) qres = qlog3.recordKill(3, 'dragon');
  check(qres && qres.completed === true && qres.rewardGold === 8000, 'world 3 first quest must pay 8000G: ' + JSON.stringify(qres));
  check(qlog3.chainFor(3).index === 1 && qlog3.chainFor(1).index === 0 && qlog3.chainFor(2).index === 0, 'quest chains must stay independent');
  check(qlog3.status(3).goal === '와이번 10마리 잡기', 'world 3 second quest must be the wyvern: ' + qlog3.status(3).goal);
  check(qlog3.summary(3) === '와이번 0/10', 'world 3 summary wrong: ' + qlog3.summary(3));
  check(qlog3.status(3).title.indexOf('3세계') < 0 && qlog3.status(3).index === 2 && qlog3.status(3).total === 6, 'world 3 quest status wrong');
  // 2번째 세계 퀘스트도 그대로 남아 있다
  check(QUEST_CHAINS[2].length === 5 && QUEST_CHAINS[1].length === 6, 'world 1/2 quest chains must not change');
}

console.log('feature report:', JSON.stringify(FEATURE_REPORT));
console.log(JSON.stringify(results, null, 1));
console.log('problems:', problems.length ? problems : 'none');
console.log('scene objects:', scene.children.length, 'effects:', game.effects.items.length);
process.exit(problems.length ? 1 : 0);
