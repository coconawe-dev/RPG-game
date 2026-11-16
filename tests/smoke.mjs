// 오프라인 스모크 테스트: 월드/몬스터/플레이어/스킬을 DOM·WebGL 없이 논리 검증
import * as THREE from 'three';
import { buildWorld, updateBiomeCulling } from '/workspace/RPG-game/src/world.js';
import { MobManager } from '/workspace/RPG-game/src/mobs.js';
import { Player } from '/workspace/RPG-game/src/player.js';
import { Effects } from '/workspace/RPG-game/src/effects.js';
import { Combat } from '/workspace/RPG-game/src/combat.js';
import { castSkill } from '/workspace/RPG-game/src/skills.js';
import { CLASS_ORDER, BIOMES, BIOME_ORDER, BIOME_ORDER_W2, ALL_BIOME_ORDER, BOSS_POS, BOSS2_POS, MOB_TYPES, SHOP, SHOP2, START_GOLD, WORLD2, WORLD2_ARRIVAL, WORLD1_PORTAL_POS, WORLD2_RETURN_POS, MAX_ARMOR_TIER, MAX_WEAPON_TIER, shopForBiome, shopWeaponsFor, allArmors, allPotions, homeBiomeFor, homeSpawnFor } from '/workspace/RPG-game/src/config.js';
import { terrainHeight, regionAt, clampToWorld, worldAt, WORLD } from '/workspace/RPG-game/src/utils.js';
import { Portals, handleBossDefeated, travelPlayer } from '/workspace/RPG-game/src/portals.js';
import { buyItem } from '/workspace/RPG-game/src/shop.js';
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
  check(ALL_BIOME_ORDER.length === BIOME_ORDER.length + BIOME_ORDER_W2.length, 'ALL_BIOME_ORDER must cover both worlds');

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

/* ================== 2세계 태초마을 상점: 더 세고 더 비싼 장비 ================== */
{
  // 상점 목록 분리: 1세계 마을은 1세계 물건만, 2세계 마을은 2세계 물건만 판다
  check(allArmors().length === 5, 'five armor tiers expected across both shops, got ' + allArmors().length);
  check(MAX_ARMOR_TIER === 5, 'max armor tier must be 5, got ' + MAX_ARMOR_TIER);
  check(MAX_WEAPON_TIER === 4, 'max weapon tier must be 4, got ' + MAX_WEAPON_TIER);
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
    check(w2[0].price >= 550 && w2[0].price <= 700, cls + ' tier4 price out of range: ' + w2[0].price);
    check(w2[1].price >= 1200 && w2[1].price <= 1400, cls + ' tier5 price out of range: ' + w2[1].price);
    check(w2[0].damage >= 30 && w2[1].damage >= 58, cls + ' world 2 weapon damage too low: ' + w2[0].damage + '/' + w2[1].damage);
  }
  const warriorT4 = shopWeaponsFor('warrior', 'shop_w2')[0];
  const warriorT5 = shopWeaponsFor('warrior', 'shop_w2')[1];
  check(warriorT4.damage >= 42 && warriorT4.damage <= 52, 'warrior tier4 damage should be 42~52, got ' + warriorT4.damage);
  check(warriorT5.damage >= 75 && warriorT5.damage <= 90, 'warrior tier5 damage should be 75~90, got ' + warriorT5.damage);

  // 2세계 갑옷 수치
  const mithril = allArmors().find((a) => a.tier === 4);
  const eternal = allArmors().find((a) => a.tier === 5);
  check(mithril && mithril.price === 720 && mithril.hp === 340 && Math.abs(mithril.defense - 0.62) < 1e-9, 'mithril armor terms wrong');
  check(eternal && eternal.price === 1520 && eternal.hp === 550 && Math.abs(eternal.defense - 0.72) < 1e-9, 'eternal armor terms wrong');
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
  game.gold = 1500;
  r = buyItem(game, warriorT4.id);
  check(r.ok, 'tier4 weapon purchase failed: ' + r.msg);
  check(game.gold === 1500 - warriorT4.price, 'tier4 gold not deducted: ' + game.gold);
  check(hero.weaponTier === 3, 'tier4 weapon must equip internal tier 3, got ' + hero.weaponTier);
  check(Math.abs(hero.damage - (baseDmg + warriorT4.damage)) < 1e-6, 'tier4 damage bonus not applied: ' + hero.damage);
  check(Math.abs(hero.critChance - (hero.cls.critChance + warriorT4.crit)) < 1e-9, 'tier4 crit bonus not applied');
  const mesh4 = hero.weapons.right || hero.weapons.left;
  check(mesh4 && mesh4.userData.tier === 3, '3D weapon look must upgrade to the world 2 tier 4 model');
  game.gold = 2000;
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
  game.gold = 800;
  ares = buyItem(game, mithril.id);
  check(ares.ok, 'mithril armor purchase failed: ' + ares.msg);
  check(p3.armorTier === 4 && Math.abs(p3.armorDefense - 0.62) < 1e-9, 'mithril armor not equipped');
  check(p3.maxHp === baseMaxHp3 + mithril.hp, 'mithril max HP bonus wrong: ' + p3.maxHp);
  check(!!p3.armorChest && !!p3.armorBracerL, '3D armor pieces missing at tier 4');
  p3.hp = p3.maxHp;
  p3.invuln = 0;
  const taken4 = p3.takeDamage(100, null);
  check(Math.abs(taken4 - 38) <= 1, '62% damage reduction wrong: ' + taken4);
  game.gold = 2000;
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
  check(pots.length === 6, 'six potions expected, got ' + pots.length);
  const keys = pots.map((p) => p.key).sort().join('');
  check(keys === '123456', 'potion quick keys must be 1~6, got ' + keys);
  const supreme = pots.find((p) => p.id === 'potion-hp-supreme');
  const restore = pots.find((p) => p.id === 'potion-full-restore');
  const rage = pots.find((p) => p.id === 'potion-rage');
  check(supreme && supreme.price === 180 && supreme.heal === 600, 'supreme HP potion terms wrong');
  check(restore && restore.price === 320 && restore.heal === 'full' && restore.buff === 'guard', 'full restore potion terms wrong');
  check(rage && rage.price === 380 && rage.buff === 'rage' && Math.abs(rage.mult - 1.6) < 1e-9, 'rage elixir terms wrong');
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

console.log(JSON.stringify(results, null, 1));
console.log('problems:', problems.length ? problems : 'none');
console.log('scene objects:', scene.children.length, 'effects:', game.effects.items.length);
process.exit(problems.length ? 1 : 0);
