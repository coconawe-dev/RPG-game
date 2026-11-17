// 월드 · 직업 · 스킬 정의
import { WORLD2, WORLD3 } from './utils.js';

export { WORLD2, WORLD3 };

export const GROUND_Y = 0;

export const BIOMES = {
  village: {
    id: 'village',
    name: '태초마을',
    en: 'Starter Village',
    short: '마을',
    center: { x: -2000, z: 0 },
    bounds: { x0: -2500, x1: -1500, z0: -500, z1: 500 },
    ground: 0x77a850,
    ground2: 0x5d8b3e,
    edge: 0x4d7534,
    minimap: '#93c268',
    sky: 0x9ed8f5,
    fog: 0xd6ecf2,
    fogNear: 360,
    fogFar: 1650,
    sun: 0xfff6dd,
    sunIntensity: 2.3,
    hemiSky: 0xe4f2ff,
    hemiGround: 0x4f6d3a,
    hemiIntensity: 0.86,
    mob: null,
    mobCount: 0,
    peaceful: true,
    landmark: '마을 광장',
    landmarkPos: { x: -2000, z: 0 },
    spawn: { x: -2000, z: 95 },
    // 상점 건물 중심 · 상호작용 지점
    shop: { x: -2000, z: -140, radius: 132, interact: { x: -2000, z: -78, radius: 74 } },
  },
  forest: {
    id: 'forest',
    name: '쾌적한 숲',
    en: 'Pleasant Forest',
    short: '숲',
    center: { x: -1000, z: 0 },
    bounds: { x0: -1500, x1: -500, z0: -500, z1: 500 },
    ground: 0x5d9147,
    ground2: 0x446e34,
    edge: 0x3c6630,
    minimap: '#6fa94f',
    sky: 0xa9d4ea,
    fog: 0xb5dbe4,
    fogNear: 280,
    fogFar: 1500,
    sun: 0xfff4d6,
    sunIntensity: 2.0,
    hemiSky: 0xcfe8ff,
    hemiGround: 0x3f5a34,
    hemiIntensity: 0.72,
    mob: 'slime',
    mobCount: 20,
    landmark: '거대 고목',
    landmarkPos: { x: -1000, z: 0 },
    spawn: { x: -1160, z: 40 },
  },
  graveyard: {
    id: 'graveyard',
    name: '무덤 지역',
    en: 'Graveyard',
    short: '무덤',
    center: { x: 0, z: -1000 },
    bounds: { x0: -500, x1: 500, z0: -1500, z1: -500 },
    ground: 0x5a6157,
    ground2: 0x40473f,
    edge: 0x363d36,
    minimap: '#7d857c',
    sky: 0x8c99a3,
    fog: 0x9aa6ad,
    fogNear: 150,
    fogFar: 880,
    sun: 0xdfe6ee,
    sunIntensity: 1.15,
    hemiSky: 0xb9c6cf,
    hemiGround: 0x2f3630,
    hemiIntensity: 0.6,
    mob: 'zombie',
    mobCount: 18,
    landmark: '폐허 예배당',
    landmarkPos: { x: 0, z: -1000 },
  },
  savanna: {
    id: 'savanna',
    name: '사바나',
    en: 'Savanna',
    short: '사바나',
    center: { x: 1000, z: 0 },
    bounds: { x0: 500, x1: 1500, z0: -500, z1: 500 },
    ground: 0xb99a51,
    ground2: 0x9c7f3f,
    edge: 0x8a7038,
    minimap: '#c9a85f',
    sky: 0xf0d79c,
    fog: 0xe3cd97,
    fogNear: 300,
    fogFar: 1500,
    sun: 0xffdca6,
    sunIntensity: 2.25,
    hemiSky: 0xffe9bd,
    hemiGround: 0x6b5626,
    hemiIntensity: 0.7,
    mob: 'hyena',
    mobCount: 16,
    landmark: '거대 아카시아',
    landmarkPos: { x: 1000, z: 0 },
  },
  old_village: {
    id: 'old_village',
    name: '낡은 마을',
    en: 'Ruined Village',
    short: '낡은 마을',
    center: { x: 2000, z: 0 },
    bounds: { x0: 1500, x1: 2500, z0: -500, z1: 500 },
    ground: 0x6f6455,
    ground2: 0x585043,
    edge: 0x473f34,
    minimap: '#8a7d68',
    sky: 0x8d8a80,
    fog: 0x9c9284,
    fogNear: 180,
    fogFar: 1050,
    sun: 0xdccfb4,
    sunIntensity: 1.4,
    hemiSky: 0xc4bba8,
    hemiGround: 0x37332b,
    hemiIntensity: 0.56,
    mob: 'raider',
    mobCount: 14,
    landmark: '망루 폐허',
    landmarkPos: { x: 2000, z: 0 },
    spawn: { x: 1700, z: 90 },
  },
  jungle: {
    id: 'jungle',
    name: '정글',
    en: 'Jungle',
    short: '정글',
    center: { x: 0, z: 1000 },
    bounds: { x0: -500, x1: 500, z0: 500, z1: 1500 },
    ground: 0x3a7440,
    ground2: 0x28552f,
    edge: 0x22492a,
    minimap: '#3f8a4a',
    sky: 0x6fae87,
    fog: 0x5f9a74,
    fogNear: 160,
    fogFar: 900,
    sun: 0xd8f0c8,
    sunIntensity: 1.45,
    hemiSky: 0x9fd8ad,
    hemiGround: 0x1c3a22,
    hemiIntensity: 0.6,
    mob: 'gorilla',
    mobCount: 14,
    landmark: '고대 우상',
    landmarkPos: { x: 0, z: 1000 },
  },
  temple: {
    id: 'temple',
    name: '정글 사원',
    en: 'Jungle Temple',
    short: '사원',
    center: { x: 0, z: 0 },
    bounds: { x0: -500, x1: 500, z0: -500, z1: 500 },
    ground: 0x94897a,
    ground2: 0x7b7264,
    edge: 0x6a6156,
    minimap: '#b3a68a',
    sky: 0xa89ab0,
    fog: 0xb6a89c,
    fogNear: 300,
    fogFar: 1450,
    sun: 0xffeed4,
    sunIntensity: 2.15,
    hemiSky: 0xd8c7b2,
    hemiGround: 0x4a4438,
    hemiIntensity: 0.82,
    mob: 'golem',
    mobCount: 1,
    landmark: '고대 제단',
    landmarkPos: { x: 0, z: 0 },
  },
};

/* ------------------------------------------------------------------
   2번째 세계 — 고대 골렘을 쓰러뜨리면 열리는 땅
   중앙 암흑지역(보스) + 네 방향(북 불길한 동굴 · 남 고블린 숲 · 서 안개낀 평지 · 동 사쿠라)
   + 그 남쪽 끝의 2세계 태초마을(안전 지대 · 상점)
   좌표는 1번째 세계와 겹치지 않게 WORLD2.originZ 만큼 밀어 둔 절대 좌표다.
------------------------------------------------------------------ */
const W2 = WORLD2.originZ;

export const BIOMES_W2 = {
  // 2세계 태초마을 — 2번째 세계에 들어온 사람이 처음 발을 딛는 안전 지대.
  // 고블린 숲 바로 남쪽(마을 z W2+1500 ~ W2+2500)에 1000x1000 으로 놓는다.
  // 북쪽 문을 나서면 곧바로 고블린 숲 → 암흑지역으로 이어진다.
  village_w2: {
    id: 'village_w2',
    world: 2,
    name: '태초마을',
    en: 'Starter Village II',
    short: '2세계 마을',
    center: { x: 0, z: W2 + 2000 },
    bounds: { x0: -500, x1: 500, z0: W2 + 1500, z1: W2 + 2500 },
    ground: 0x3d5a4c,
    ground2: 0x2d443a,
    edge: 0x223630,
    minimap: '#5f9c86',
    sky: 0x33496e,
    fog: 0x415f80,
    fogNear: 300,
    fogFar: 1350,
    sun: 0xffe3b8,
    sunIntensity: 1.75,
    hemiSky: 0xa9c6e8,
    hemiGround: 0x1d2b26,
    hemiIntensity: 0.86,
    mob: null,
    mobCount: 0,
    peaceful: true,
    landmark: '별빛 광장',
    landmarkPos: { x: 0, z: W2 + 2000 },
    spawn: { x: -60, z: W2 + 1925 },
    // 2세계 대장간(상점) — 광장 남쪽, 문은 광장(북쪽)을 향한다
    shop: {
      id: 'shop_w2',
      x: 0, z: W2 + 2150, radius: 138, facing: -1,
      interact: { x: 0, z: W2 + 2086, radius: 78 },
    },
  },
  goblin_forest: {
    id: 'goblin_forest',
    world: 2,
    name: '고블린 숲',
    en: 'Goblin Forest',
    short: '고블린 숲',
    center: { x: 0, z: W2 + 1000 },
    bounds: { x0: -500, x1: 500, z0: W2 + 500, z1: W2 + 1500 },
    ground: 0x2f5a3a,
    ground2: 0x21452b,
    edge: 0x193824,
    minimap: '#2f6a44',
    sky: 0x35513f,
    fog: 0x28422f,
    fogNear: 150,
    fogFar: 860,
    sun: 0xbfdcaa,
    sunIntensity: 1.4,
    hemiSky: 0x9cc9a6,
    hemiGround: 0x182a1e,
    hemiIntensity: 0.66,
    mob: 'goblin',
    mobCount: 16,
    landmark: '고블린 토템',
    landmarkPos: { x: 0, z: W2 + 900 },
    // 2세계 태초마을 북문을 나서면 바로 고블린 숲 남쪽 길로 들어선다
    spawn: { x: 0, z: W2 + 1320 },
  },
  ominous_cave: {
    id: 'ominous_cave',
    world: 2,
    name: '불길한 동굴',
    en: 'Ominous Cave',
    short: '동굴',
    center: { x: 0, z: W2 - 1000 },
    bounds: { x0: -500, x1: 500, z0: W2 - 1500, z1: W2 - 500 },
    ground: 0x2b2329,
    ground2: 0x1b161c,
    edge: 0x120e13,
    minimap: '#4b3240',
    sky: 0x2b1c26,
    fog: 0x35202c,
    fogNear: 110,
    fogFar: 640,
    sun: 0xff9c7c,
    sunIntensity: 1.15,
    hemiSky: 0x8a4a64,
    hemiGround: 0x120c14,
    hemiIntensity: 0.62,
    mob: 'iron_golem',
    mobCount: 6,
    landmark: '불타는 용광로',
    landmarkPos: { x: 0, z: W2 - 1000 },
    spawn: { x: 0, z: W2 - 760 },
  },
  misty_plains: {
    id: 'misty_plains',
    world: 2,
    name: '안개낀 평지',
    en: 'Misty Plains',
    short: '안개 평지',
    center: { x: -1000, z: W2 },
    bounds: { x0: -1500, x1: -500, z0: W2 - 500, z1: W2 + 500 },
    ground: 0x8d8b84,
    ground2: 0x73726c,
    edge: 0x5e5d58,
    minimap: '#9a9a96',
    sky: 0xa9aeb2,
    fog: 0xc4c9cc,
    fogNear: 110,
    fogFar: 660,
    sun: 0xdfe4e6,
    sunIntensity: 1.0,
    hemiSky: 0xd6dadd,
    hemiGround: 0x484845,
    hemiIntensity: 0.78,
    mob: 'skeleton',
    mobCount: 14,
    landmark: '부서진 석주',
    landmarkPos: { x: -1000, z: W2 },
    spawn: { x: -740, z: W2 },
  },
  sakura: {
    id: 'sakura',
    world: 2,
    name: '사쿠라',
    en: 'Sakura Grove',
    short: '사쿠라',
    center: { x: 1000, z: W2 },
    bounds: { x0: 500, x1: 1500, z0: W2 - 500, z1: W2 + 500 },
    ground: 0x7d9463,
    ground2: 0x667f4f,
    edge: 0x546a42,
    minimap: '#e0a0b8',
    sky: 0xf3c9d8,
    fog: 0xf0d3dd,
    fogNear: 260,
    fogFar: 1250,
    sun: 0xffd9e4,
    sunIntensity: 1.7,
    hemiSky: 0xffe4ee,
    hemiGround: 0x4d5c3c,
    hemiIntensity: 0.8,
    mob: 'samurai',
    mobCount: 12,
    landmark: '천 년 벚나무',
    landmarkPos: { x: 1000, z: W2 },
    spawn: { x: 740, z: W2 },
  },
  dark_realm: {
    id: 'dark_realm',
    world: 2,
    name: '암흑지역',
    en: 'Dark Realm',
    short: '암흑지역',
    center: { x: 0, z: W2 },
    bounds: { x0: -500, x1: 500, z0: W2 - 500, z1: W2 + 500 },
    ground: 0x2a2438,
    ground2: 0x1d1a29,
    edge: 0x141120,
    minimap: '#402a5e',
    sky: 0x1d1224,
    fog: 0x2b1a33,
    fogNear: 200,
    fogFar: 980,
    sun: 0xc4a0ff,
    sunIntensity: 1.35,
    hemiSky: 0x9a6cd0,
    hemiGround: 0x120e1a,
    hemiIntensity: 0.72,
    mob: 'dark_mage',
    mobCount: 1,
    landmark: '흑마법사의 제단',
    landmarkPos: { x: 0, z: W2 - 80 },
    spawn: { x: 0, z: W2 + 400 },
  },
};

/* ------------------------------------------------------------------
   3번째 세계 — 흑마법사를 쓰러뜨리면 열리는 땅
   중앙 부패한 도시(타락한 영웅) + 네 방향(북 점령당한 목장 · 남 선사시대 숲
   · 서 비밀동굴 · 동 판타지숲) + 그 남쪽 끝의 3세계 태초마을(안전 지대 · 상점)
   좌표는 앞의 두 세계와 겹치지 않게 WORLD3.originZ 만큼 밀어 둔 절대 좌표다.
------------------------------------------------------------------ */
const W3 = WORLD3.originZ;

export const BIOMES_W3 = {
  // 3세계 태초마을 — 3번째 세계에 들어온 사람이 처음 발을 딛는 안전 지대.
  // 선사시대 숲 바로 남쪽(마을 z W3+1500 ~ W3+2500)에 1000x1000 으로 놓는다.
  village_w3: {
    id: 'village_w3',
    world: 3,
    name: '태초마을',
    en: 'Starter Village III',
    short: '3세계 마을',
    center: { x: 0, z: W3 + 2000 },
    bounds: { x0: -500, x1: 500, z0: W3 + 1500, z1: W3 + 2500 },
    ground: 0x5c7a4e,
    ground2: 0x47613d,
    edge: 0x3a5233,
    minimap: '#7fa96b',
    sky: 0x3a3560,
    fog: 0x50496f,
    fogNear: 300,
    fogFar: 1350,
    sun: 0xffd9a0,
    sunIntensity: 1.85,
    hemiSky: 0xc9bde8,
    hemiGround: 0x27301f,
    hemiIntensity: 0.84,
    mob: null,
    mobCount: 0,
    peaceful: true,
    landmark: '새벽 광장',
    landmarkPos: { x: 0, z: W3 + 2000 },
    spawn: { x: -60, z: W3 + 1925 },
    // 3세계 상점(대상단) — 광장 남쪽, 문은 광장(북쪽)을 향한다
    shop: {
      id: 'shop_w3',
      x: 0, z: W3 + 2150, radius: 138, facing: -1,
      interact: { x: 0, z: W3 + 2086, radius: 78 },
    },
  },
  annoying_forest: {
    id: 'annoying_forest',
    world: 3,
    name: '선사시대 숲',
    en: 'Prehistoric Forest',
    short: '선사시대 숲',
    center: { x: 0, z: W3 + 1000 },
    bounds: { x0: -500, x1: 500, z0: W3 + 500, z1: W3 + 1500 },
    ground: 0x53603a,
    ground2: 0x3d4a2a,
    edge: 0x2f3a20,
    minimap: '#76854a',
    sky: 0x7f8a5e,
    fog: 0x6f7a52,
    fogNear: 150,
    fogFar: 860,
    sun: 0xd8e0a0,
    sunIntensity: 1.4,
    hemiSky: 0xa8b878,
    hemiGround: 0x1f2614,
    hemiIntensity: 0.66,
    // 가시덤불 숲에는 두 공룡이 함께 산다 (같이 소환)
    mob: 'tyrannosaurus',
    mobs: ['tyrannosaurus', 'spinosaurus'],
    mobCount: 12,
    landmark: '가시덩굴 둥지',
    landmarkPos: { x: 0, z: W3 + 900 },
    spawn: { x: 0, z: W3 + 1320 },
  },
  secret_cave: {
    id: 'secret_cave',
    world: 3,
    name: '비밀동굴',
    en: 'Secret Cave',
    short: '비밀동굴',
    center: { x: -1000, z: W3 },
    bounds: { x0: -1500, x1: -500, z0: W3 - 500, z1: W3 + 500 },
    ground: 0x2a2a3d,
    ground2: 0x1a1a2a,
    edge: 0x121220,
    minimap: '#3d4a72',
    sky: 0x1a1c2e,
    fog: 0x232840,
    fogNear: 120,
    fogFar: 700,
    sun: 0x9fd8ff,
    sunIntensity: 1.1,
    hemiSky: 0x6f8fd0,
    hemiGround: 0x0d0f18,
    hemiIntensity: 0.62,
    mob: 'wyvern',
    mobCount: 12,
    landmark: '수정 둥지',
    landmarkPos: { x: -1000, z: W3 },
    spawn: { x: -740, z: W3 },
  },
  fantasy_forest: {
    id: 'fantasy_forest',
    world: 3,
    name: '판타지숲',
    en: 'Fantasy Forest',
    short: '판타지숲',
    center: { x: 1000, z: W3 },
    bounds: { x0: 500, x1: 1500, z0: W3 - 500, z1: W3 + 500 },
    ground: 0x3f7a52,
    ground2: 0x2d5c3d,
    edge: 0x24492f,
    minimap: '#4f9b64',
    sky: 0x4d7f6a,
    fog: 0x3f6b58,
    fogNear: 230,
    fogFar: 1150,
    sun: 0xfff0b0,
    sunIntensity: 2.0,
    hemiSky: 0xa8e0c0,
    hemiGround: 0x1d3524,
    hemiIntensity: 0.7,
    mob: 'dragon',
    mobCount: 8,
    landmark: '용의 둥지',
    landmarkPos: { x: 1000, z: W3 },
    spawn: { x: 740, z: W3 },
  },
  corrupted_city: {
    id: 'corrupted_city',
    world: 3,
    name: '부패한 도시',
    en: 'Corrupted City',
    short: '부패 도시',
    center: { x: 0, z: W3 },
    bounds: { x0: -500, x1: 500, z0: W3 - 500, z1: W3 + 500 },
    ground: 0x5a5262,
    ground2: 0x433d4c,
    edge: 0x352f3c,
    minimap: '#7a7088',
    sky: 0x4a3f55,
    fog: 0x574a63,
    fogNear: 240,
    fogFar: 1150,
    sun: 0xe0c8ff,
    sunIntensity: 1.5,
    hemiSky: 0xb8a0d8,
    hemiGround: 0x201a28,
    hemiIntensity: 0.72,
    mob: 'fallen_hero',
    mobCount: 10,
    landmark: '부패한 성문',
    landmarkPos: { x: 0, z: W3 },
    spawn: { x: 0, z: W3 + 400 },
  },
  occupied_ranch: {
    id: 'occupied_ranch',
    world: 3,
    name: '점령당한 목장',
    en: 'Occupied Ranch',
    short: '목장',
    center: { x: 0, z: W3 - 1000 },
    bounds: { x0: -500, x1: 500, z0: W3 - 1500, z1: W3 - 500 },
    ground: 0x7a6a42,
    ground2: 0x5f5232,
    edge: 0x4a4028,
    minimap: '#a08b55',
    sky: 0x6a4a44,
    fog: 0x7a5a4a,
    fogNear: 220,
    fogFar: 1050,
    sun: 0xffc08a,
    sunIntensity: 1.7,
    hemiSky: 0xe0b090,
    hemiGround: 0x2a2014,
    hemiIntensity: 0.7,
    mob: 'strong_chicken',
    mobCount: 1,
    landmark: '거대한 닭 둥지',
    landmarkPos: { x: 0, z: W3 - 940 },
    spawn: { x: 0, z: W3 - 620 },
  },
};

// 2번째 세계 지역 순서 (도착지인 2세계 태초마을이 먼저 — 북쪽으로 고블린 숲 → 암흑지역)
export const BIOME_ORDER_W2 = ['village_w2', 'goblin_forest', 'misty_plains', 'sakura', 'ominous_cave', 'dark_realm'];

// 1번째 세계 지역 순서
export const BIOME_ORDER = ['village', 'forest', 'graveyard', 'savanna', 'old_village', 'jungle', 'temple'];

// 3번째 세계 지역 순서 (도착지인 3세계 태초마을이 먼저 — 북쪽으로 선사시대 숲 → 부패한 도시 → 목장)
export const BIOME_ORDER_W3 = ['village_w3', 'annoying_forest', 'secret_cave', 'fantasy_forest', 'corrupted_city', 'occupied_ranch'];

// 세 세계를 한 곳에서 찾을 수 있게 합쳐 둔다 (지역 이름 · 색 · 경계 조회용)
Object.assign(BIOMES, BIOMES_W2);
Object.assign(BIOMES, BIOMES_W3);

// 세 세계를 모두 포함한 목록 — 몹 스폰 · 바이옴 컬링 · 환경 색 계산용
export const ALL_BIOME_ORDER = BIOME_ORDER.concat(BIOME_ORDER_W2).concat(BIOME_ORDER_W3);

// 두 세계의 바이옴 정의를 한 곳에서 찾는다
export function biomeById(id) {
  return BIOMES[id] || null;
}

// 세계별 지역 목록
export function biomeOrderFor(worldId) {
  if (worldId === 3) return BIOME_ORDER_W3;
  return worldId === 2 ? BIOME_ORDER_W2 : BIOME_ORDER;
}


// 미니맵 · 나침반에서 사용할 지역 목록 (사원 우선 표시)
export const COMPASS_ORDER = ['temple', 'village', 'forest', 'graveyard', 'savanna', 'old_village', 'jungle'];

// 2번째 세계 나침반 (보스가 있는 암흑지역을 맨 위에 · 안전 지대인 2세계 태초마을도 표시)
export const COMPASS_ORDER_W2 = ['dark_realm', 'goblin_forest', 'misty_plains', 'sakura', 'ominous_cave', 'village_w2'];

// 3번째 세계 나침반 (최종 보스가 있는 목장을 맨 위에 · 3세계 태초마을도 표시)
export const COMPASS_ORDER_W3 = ['occupied_ranch', 'fantasy_forest', 'annoying_forest', 'corrupted_city', 'secret_cave', 'village_w3'];

export function compassOrderFor(worldId) {
  if (worldId === 3) return COMPASS_ORDER_W3;
  return worldId === 2 ? COMPASS_ORDER_W2 : COMPASS_ORDER;
}

// 시작 골드
export const START_GOLD = 100;

export const MOB_TYPES = {
  slime: {
    id: 'slime', name: '슬라임', hp: 92, damage: 14, speed: 20, aggro: 120,
    attackRange: 24, attackCooldown: 1.7, xp: 16, gold: 15, height: 12, radius: 6,
    // 슬라임은 납작하게 땅에 붙어 있어 몸 높이(12)보다 위쪽으로 넉넉한 피격 판정을 둔다.
    // 마법사 구체(y ≈ 18) · 궁수 화살이 슬라임을 그냥 지나쳐 버리지 않도록 hitHeight = 20.
    hitHeight: 20,
    leash: 260, kind: 'slime',
  },
  zombie: {
    id: 'zombie', name: '좀비', hp: 148, damage: 22, speed: 30, aggro: 150,
    attackRange: 28, attackCooldown: 1.9, xp: 26, gold: 30, height: 18, radius: 6,
    leash: 300, kind: 'humanoid',
  },
  hyena: {
    id: 'hyena', name: '하이에나', hp: 164, damage: 26, speed: 54, aggro: 190,
    attackRange: 26, attackCooldown: 1.35, xp: 32, gold: 45, height: 12, radius: 6,
    leash: 360, kind: 'quadruped',
  },
  gorilla: {
    id: 'gorilla', name: '고릴라', hp: 316, damage: 38, speed: 38, aggro: 170,
    attackRange: 32, attackCooldown: 2.1, xp: 52, gold: 70, height: 20, radius: 8,
    leash: 320, kind: 'gorilla',
  },
  raider: {
    id: 'raider', name: '약탈자', hp: 270, damage: 36, speed: 44, aggro: 190,
    attackRange: 30, attackCooldown: 1.5, xp: 48, gold: 65, height: 20, radius: 7,
    leash: 340, kind: 'raider',
  },
  golem: {
    id: 'golem', name: '고대 골렘', hp: 6400, damage: 108, speed: 28, aggro: 340,
    attackRange: 82, attackCooldown: 2.1, xp: 2500, gold: 800, height: 48, radius: 18,
    leash: 660, kind: 'golem', boss: true, level: 20,
    enrageAt: 0.5, slamEvery: 3, slamRadius: 200, slamWindup: 1.5, slamCooldown: 9,
  },

  /* ---------------------- 2번째 세계의 몹 — 훨씬 강하다 ---------------------- */
  goblin: {
    id: 'goblin', name: '고블린', hp: 1080, damage: 58, speed: 64, aggro: 210,
    attackRange: 32, attackCooldown: 1.25, xp: 300, gold: 150, height: 17, radius: 6,
    leash: 360, kind: 'goblin',
  },
  skeleton: {
    id: 'skeleton', name: '스켈레톤', hp: 1440, damage: 74, speed: 52, aggro: 220,
    attackRange: 42, attackCooldown: 1.6, xp: 450, gold: 230, height: 19, radius: 6,
    leash: 380, kind: 'skeleton',
  },
  samurai: {
    id: 'samurai', name: '사무라이', hp: 2300, damage: 98, speed: 56, aggro: 240,
    attackRange: 46, attackCooldown: 1.45, xp: 700, gold: 330, height: 21, radius: 7,
    leash: 420, kind: 'samurai',
  },
  iron_golem: {
    id: 'iron_golem', name: '아이언 골렘', hp: 3700, damage: 120, speed: 36, aggro: 280,
    attackRange: 70, attackCooldown: 2.0, xp: 1200, gold: 620, height: 46, radius: 16,
    leash: 600, kind: 'iron_golem',
  },
  dark_mage: {
    id: 'dark_mage', name: '흑마법사', hp: 13600, damage: 156, speed: 32, aggro: 380,
    attackRange: 170, attackCooldown: 2.3, xp: 6500, gold: 2600, height: 40, radius: 12,
    leash: 640, kind: 'dark_mage', boss: true, level: 60,
    enemyProjectile: 'dark_orb',
    enrageAt: 0.55, slamEvery: 3, slamRadius: 230, slamWindup: 1.4, slamCooldown: 8,
    slamLabel: '어둠의 충격파!',
  },

  /* ---------------------- 3번째 세계의 몹 — 두 번째 세계보다 훨씬 강하다 ---------------------- */
  dragon: {
    id: 'dragon', name: '용', hp: 5200, damage: 190, speed: 46, aggro: 300,
    attackRange: 62, attackCooldown: 1.9, xp: 2600, gold: 1800, height: 44, radius: 16,
    leash: 520, kind: 'dragon',
  },
  wyvern: {
    id: 'wyvern', name: '와이번', hp: 4200, damage: 160, speed: 74, aggro: 290,
    attackRange: 54, attackCooldown: 1.5, xp: 2100, gold: 1500, height: 32, radius: 12,
    leash: 480, kind: 'wyvern',
  },
  spinosaurus: {
    id: 'spinosaurus', name: '스피노사우루스', hp: 6000, damage: 210, speed: 46, aggro: 300,
    attackRange: 68, attackCooldown: 2.0, xp: 3000, gold: 2000, height: 42, radius: 15,
    leash: 540, kind: 'spinosaurus',
  },
  tyrannosaurus: {
    id: 'tyrannosaurus', name: '티라노사우루스', hp: 5400, damage: 230, speed: 62, aggro: 310,
    attackRange: 58, attackCooldown: 1.7, xp: 2900, gold: 2000, height: 44, radius: 15,
    leash: 540, kind: 'tyrannosaurus',
  },
  fallen_hero: {
    id: 'fallen_hero', name: '타락한 영웅', hp: 7600, damage: 260, speed: 60, aggro: 320,
    attackRange: 58, attackCooldown: 1.4, xp: 4200, gold: 2800, height: 24, radius: 8,
    leash: 560, kind: 'fallen_hero',
  },
  // 최종 보스 — 거대 강하닭 (한 마리만 · 사용자 요청: "강하닭은 크게만들어야되")
  strong_chicken: {
    id: 'strong_chicken', name: '강하닭', hp: 46000, damage: 360, speed: 42, aggro: 420,
    attackRange: 120, attackCooldown: 2.2, xp: 20000, gold: 12000, height: 58, radius: 22,
    leash: 720, kind: 'strong_chicken', boss: true, level: 95,
    enrageAt: 0.5, slamEvery: 3, slamRadius: 260, slamWindup: 1.5, slamCooldown: 9,
    slamLabel: '거대 발톱 내려찍기!',
  },
};

/* ------------------------- 보스 스킬 (두 보스) -------------------------
   두 보스 모두 기본 공격 · 격노 충격파 말고도 이름 붙은 스킬을 쓴다.
   모든 스킬은 바닥에 범위를 먼저 알려 주는 예고(telegraph, 0.8~1.2초)를 남기고 터진다.
   예고 시간 안에 대쉬(C)로 빠져나가거나 막기(R)로 버티면 피해가 줄어든다.
   · 격노하면 예고가 조금 짧아지고 쿨타임도 줄어든다. */
export const BOSS_SKILL_IDS = ['', 'quake', 'boulder', 'roar', 'meteor', 'volley', 'nova', 'feather', 'beaksmash', 'eggbarrage'];

export const BOSS_SKILLS = {
  golem: [
    {
      id: 'quake', name: '대지 분쇄', label: '⚡ 대지 분쇄!', kind: 'aoe',
      telegraph: 1.05, radius: 205, damage: 1.45, color: 0xffa54a,
      cooldown: 11, enragedCooldown: 7, maxRange: 320,
    },
    {
      id: 'boulder', name: '바위 투척', label: '🪨 바위 투척!', kind: 'boulder',
      telegraph: 0.9, radius: 78, damage: 1.15, color: 0xffc46a,
      cooldown: 9, enragedCooldown: 5.5, minRange: 95, preferFar: true,
    },
    {
      id: 'roar', name: '고대의 포효', label: '🗿 고대의 포효!', kind: 'nova',
      telegraph: 1.1, radius: 250, damage: 0.9, color: 0x9fe8ff,
      cooldown: 19, enragedCooldown: 12, buff: 7, buffLabel: '고대의 수호',
    },
  ],
  dark_mage: [
    {
      id: 'meteor', name: '어둠의 유성', label: '☄️ 어둠의 유성!', kind: 'meteor',
      telegraph: 1.15, radius: 96, damage: 1.1, color: 0xb06aff, count: 3,
      cooldown: 12, enragedCooldown: 7.5,
    },
    {
      id: 'volley', name: '암흑 3연 구체', label: '🔮 암흑 3연 구체!', kind: 'volley',
      telegraph: 0.8, damage: 0.62, color: 0xb06aff, count: 3, spread: 0.3,
      cooldown: 8.5, enragedCooldown: 5.5,
    },
    {
      id: 'nova', name: '공허의 파동', label: '🌀 공허의 파동!', kind: 'nova',
      telegraph: 1.0, radius: 190, damage: 1.2, color: 0x8a3aff, maxRange: 215,
      cooldown: 13, enragedCooldown: 8.5,
    },
  ],
  // 최종 보스 강하닭 — 깃털 · 부리 · 황금 알, 세 가지 기술을 예고하고 내려온다
  strong_chicken: [
    {
      id: 'feather', name: '깃털 폭풍', label: '🐔 깃털 폭풍!', kind: 'meteor',
      telegraph: 1.0, radius: 88, damage: 1.0, color: 0xffe27a, count: 3,
      cooldown: 11, enragedCooldown: 7, minRange: 0,
    },
    {
      id: 'beaksmash', name: '거대 부리 강타', label: '💥 거대 부리 강타!', kind: 'aoe',
      telegraph: 1.15, radius: 205, damage: 1.5, color: 0xffa54a, maxRange: 300,
      cooldown: 10, enragedCooldown: 6.5,
    },
    {
      id: 'eggbarrage', name: '황금 알 폭격', label: '🥚 황금 알 폭격!', kind: 'volley',
      telegraph: 0.85, damage: 0.7, color: 0xffd24a, count: 4, spread: 0.36,
      cooldown: 9, enragedCooldown: 5.5,
    },
  ],
};

// 몹 정의에서 바로 꺼내 쓸 수 있게 붙여 둔다
MOB_TYPES.golem.skills = BOSS_SKILLS.golem;
MOB_TYPES.dark_mage.skills = BOSS_SKILLS.dark_mage;
MOB_TYPES.strong_chicken.skills = BOSS_SKILLS.strong_chicken;

// 스킬 id → 정의 · 코드(번호) — 함께 하기에서 친구 화면에 같은 예고를 그릴 때 쓴다
export function bossSkillById(id) {
  for (const key of Object.keys(BOSS_SKILLS)) {
    const found = BOSS_SKILLS[key].find((s) => s.id === id);
    if (found) return found;
  }
  // 새 보스가 같은 스킬을 쓰게 되면 이름으로도 찾아준다
  return null;
}

export function bossSkillCode(id) {
  return Math.max(0, BOSS_SKILL_IDS.indexOf(id));
}

export function bossSkillByCode(code) {
  const id = BOSS_SKILL_IDS[Number(code) || 0];
  return id ? bossSkillById(id) : null;
}

// 2번째 세계 보스가 서는 자리 (암흑지역 제단 앞)
export const BOSS2_POS = { x: 0, z: WORLD2.originZ + 130 };

// 3번째 세계 최종 보스 강하닭이 서는 자리 (점령당한 목장의 둥지 앞)
export const BOSS3_POS = { x: 0, z: WORLD3.originZ - 860 };

// 몹 · 지역에서 보스 자리를 찾는다 (없으면 그 지역 중심)
export function bossPosFor(biomeId) {
  if (biomeId === 'dark_realm') return BOSS2_POS;
  if (biomeId === 'occupied_ranch') return BOSS3_POS;
  return BOSS_POS;
}

// 2번째 세계 도착 지점 — 2세계 태초마을 광장 (고대 골렘을 잡으면 열리는 포털이 여기로 보낸다)
export const WORLD2_ARRIVAL = { x: 0, z: WORLD2.originZ + 1880 };
export const WORLD1_PORTAL_POS = { x: 0, z: 172 };
// 1번째 세계로 돌아가는 귀환 포털 (2세계 태초마을 광장 옆 · 도착 지점에서 200 이상 떨어져 바로 되돌아가지 않는다)
export const WORLD2_RETURN_POS = { x: 215, z: WORLD2.originZ + 1880 };

// 2번째 세계에서 3번째 세계로 가는 포털 (암흑지역 제단 뒤 · 흑마법사를 잡으면 열린다)
export const WORLD2_PORTAL_POS = { x: -230, z: WORLD2.originZ - 190 };
// 3번째 세계 도착 지점 — 3세계 태초마을 광장
export const WORLD3_ARRIVAL = { x: 0, z: WORLD3.originZ + 1880 };
// 2번째 세계로 돌아가는 귀환 포털 (3세계 태초마을 광장 옆)
export const WORLD3_RETURN_POS = { x: 215, z: WORLD3.originZ + 1880 };


/* ------------------------------------------------------------------
   성장 단계 — 15레벨에 필살기(ult)가 열리고, 20레벨에 1차 진화(evolved)로
   Q · E 스킬이 더 강한 새 스킬로 바뀐다.
------------------------------------------------------------------ */
export const ULT_LEVEL = 15;
export const EVOLUTION_LEVEL = 20;
export const ULT_COOLDOWN = 75;
export const ULT_KEY = 'X';

export const CLASSES = {
  warrior: {
    id: 'warrior',
    name: '검사',
    role: 'WARRIOR · 전사',
    weaponName: '검 (Sword)',
    glyph: '⚔',
    accent: '#e0574f',
    color: 0xc9473f,
    hp: 175,
    damage: 23,
    speed: 58,
    sprintMul: 1.55,
    attackInterval: 0.62,
    attackRange: 44,
    attackArc: Math.PI * 1.0,
    critChance: 0.12,
    critMul: 1.8,
    desc: '균형 잡힌 근접 전사. 넓은 회전 베기로 다수를 한 번에 상대합니다.',
    stats: { hp: 0.78, dmg: 0.7, spd: 0.55, rng: 0.35 },
    attackAnim: 'cleave',
    skills: {
      q: {
        key: 'Q', name: '회전 베기', en: 'Whirlwind Slash', icon: '🌀', cooldown: 7,
        desc: '몸을 한 바퀴 돌려 주변의 모든 적을 베어냅니다.',
      },
      e: {
        key: 'E', name: '돌진 일격', en: 'Dash Strike', icon: '💥', cooldown: 10,
        desc: '전방으로 돌진해 강력한 내려찍기를 날립니다.',
      },
    },
    ult: {
      key: 'X', slot: 'ult', name: '천공의 일섬', en: 'Heaven-Splitting Blade', icon: '⚡',
      cooldown: ULT_COOLDOWN,
      desc: '하늘을 가르는 세 번의 황금빛 참격. 주변의 모든 적을 베어내고 거대한 충격파로 밀어냅니다.',
    },
    evolved: {
      q: {
        key: 'Q', name: '폭풍 회전난무', en: 'Storm Tempest', icon: '🌪', cooldown: 6,
        desc: '여섯 번의 회전 베기로 주변을 갈아버리는 강화 회전 베기.',
      },
      e: {
        key: 'E', name: '천둥 돌진참', en: 'Thunder Dash', icon: '🌩', cooldown: 9,
        desc: '번개처럼 더 멀리 돌진해 내려찍고, 착지점에 천둥 충격파를 터뜨립니다.',
      },
    },
  },
  archer: {
    id: 'archer',
    name: '궁수',
    role: 'ARCHER · 원거리',
    weaponName: '활 (Bow)',
    glyph: '🏹',
    accent: '#7fc16a',
    color: 0x5d9a4e,
    hp: 120,
    damage: 17,
    speed: 62,
    sprintMul: 1.55,
    attackInterval: 0.5,
    attackRange: 300,
    attackArc: 0.16,
    critChance: 0.18,
    critMul: 2.0,
    desc: '멀리서 화살을 꽂는 원거리 사수. 빠른 연사와 넓은 시야가 장점입니다.',
    stats: { hp: 0.5, dmg: 0.55, spd: 0.62, rng: 1 },
    attackAnim: 'shoot',
    projectile: 'arrow',
    skills: {
      q: {
        key: 'Q', name: '멀티샷', en: 'Multi-Shot', icon: '🎯', cooldown: 6,
        desc: '부채꼴로 화살 5발을 동시에 발사합니다.',
      },
      e: {
        key: 'E', name: '화살비', en: 'Arrow Barrage', icon: '🌧', cooldown: 12,
        desc: '뒤로 도약하며 전방에 화살비를 퍼붓습니다.',
      },
    },
    ult: {
      key: 'X', slot: 'ult', name: '유성 화살비', en: 'Meteor Rain', icon: '☄️',
      cooldown: ULT_COOLDOWN,
      desc: '하늘에서 유성 같은 화살들이 쏟아져 넓은 지역을 불바다로 만듭니다.',
    },
    evolved: {
      q: {
        key: 'Q', name: '천풍 연사', en: 'Gale Volley', icon: '🍃', cooldown: 5,
        desc: '아홉 발의 바람 화살을 부채꼴로 연사하고, 적을 관통합니다.',
      },
      e: {
        key: 'E', name: '폭풍우 화살폭격', en: 'Storm Barrage', icon: '⛈', cooldown: 11,
        desc: '뒤로 도약하며 스무 발의 화살을 폭격합니다.',
      },
    },
  },
  rogue: {
    id: 'rogue',
    name: '도적',
    role: 'ROGUE · 암살자',
    weaponName: '단검 (Dagger)',
    glyph: '🗡',
    accent: '#a98cf0',
    color: 0x7a5fc4,
    hp: 132,
    damage: 12,
    speed: 78,
    sprintMul: 1.6,
    attackInterval: 0.24,
    attackRange: 30,
    attackArc: Math.PI * 0.5,
    critChance: 0.28,
    critMul: 2.1,
    desc: '가장 빠른 이동과 연속 찌르기. 치명타 확률이 매우 높습니다.',
    stats: { hp: 0.55, dmg: 0.42, spd: 1, rng: 0.3 },
    attackAnim: 'stab',
    skills: {
      q: {
        key: 'Q', name: '그림자 습격', en: 'Shadow Ambush', icon: '🌑', cooldown: 8,
        desc: '그림자처럼 파고들어 치명타를 꽂습니다.',
      },
      e: {
        key: 'E', name: '연격 난무', en: 'Blade Flurry', icon: '⚡', cooldown: 14,
        desc: '연속 찌르기 난무. 지속시간 동안 이동속도가 상승합니다.',
      },
    },
    ult: {
      key: 'X', slot: 'ult', name: '그림자 절멸', en: 'Shadow Annihilation', icon: '🌑',
      cooldown: ULT_COOLDOWN,
      desc: '그림자 분신이 다섯 번 연속 폭발하며 주변 적을 확정 치명타로 베어냅니다.',
    },
    evolved: {
      q: {
        key: 'Q', name: '그림자 처형', en: 'Shadow Execution', icon: '💀', cooldown: 7,
        desc: '그림자 속으로 더 멀리 파고들어 확정 치명타로 처형합니다.',
      },
      e: {
        key: 'E', name: '천변 만화', en: 'Thousand Blades', icon: '🌪', cooldown: 12,
        desc: '열한 번의 연속 찌르기와 빨라진 발놀림.',
      },
    },
  },
  tanker: {
    id: 'tanker',
    name: '탱커',
    role: 'TANKER · 수호자',
    weaponName: '방패 (Shield)',
    glyph: '🛡',
    accent: '#6fa8dc',
    color: 0x4f7fa8,
    hp: 250,
    damage: 19,
    speed: 50,
    sprintMul: 1.45,
    attackInterval: 0.78,
    attackRange: 38,
    attackArc: Math.PI * 0.85,
    critChance: 0.08,
    critMul: 1.6,
    desc: '높은 체력과 방어력. 방패 강타로 적을 밀어내며 전선을 지킵니다.',
    stats: { hp: 1, dmg: 0.6, spd: 0.42, rng: 0.32 },
    attackAnim: 'bash',
    skills: {
      q: {
        key: 'Q', name: '방패 강타', en: 'Shield Slam', icon: '💢', cooldown: 8,
        desc: '방패를 내리쳐 충격파로 주변 적을 밀어냅니다.',
      },
      e: {
        key: 'E', name: '철벽 태세', en: 'Iron Fortress', icon: '🌟', cooldown: 16,
        desc: '황금 방어막으로 받는 피해를 줄이고 HP를 회복합니다.',
      },
    },
    ult: {
      key: 'X', slot: 'ult', name: '불멸의 성역', en: 'Immortal Sanctuary', icon: '🏰',
      cooldown: ULT_COOLDOWN,
      desc: '황금 성역이 내려앉아 주변을 짓밟고, 체력과 스태미나를 크게 회복시킵니다.',
    },
    evolved: {
      q: {
        key: 'Q', name: '대지 분쇄', en: 'Earth Crusher', icon: '🪨', cooldown: 7,
        desc: '더 넓은 충격파로 대지를 뒤집어엎습니다.',
      },
      e: {
        key: 'E', name: '불굴의 성채', en: 'Unbreakable Citadel', icon: '⭐', cooldown: 14,
        desc: '더 오래, 더 단단한 황금 방어막으로 버팁니다.',
      },
    },
  },
  mage: {
    id: 'mage',
    name: '마법사',
    role: 'MAGE · 원소술사',
    weaponName: '지팡이 (Staff)',
    glyph: '✨',
    accent: '#c48cf0',
    color: 0x9a5fc4,
    hp: 112,
    damage: 26,
    speed: 56,
    sprintMul: 1.5,
    attackInterval: 0.72,
    attackRange: 320,
    attackArc: 0.2,
    critChance: 0.16,
    critMul: 1.9,
    desc: '지팡이에서 뿜어져 나오는 마력 구체. 폭발 범위 피해를 줍니다.',
    stats: { hp: 0.48, dmg: 0.9, spd: 0.5, rng: 0.95 },
    attackAnim: 'cast',
    projectile: 'orb',
    skills: {
      q: {
        key: 'Q', name: '아케인 폭발', en: 'Arcane Explosion', icon: '☄', cooldown: 9,
        desc: '전방에 거대한 마력 폭발을 일으켜 광범위 피해를 줍니다.',
      },
      e: {
        key: 'E', name: '마력 고리', en: 'Mana Nova', icon: '❄', cooldown: 12,
        desc: '확산하는 마력 고리로 적을 밀쳐내고 피해를 줍니다.',
      },
    },
    ult: {
      key: 'X', slot: 'ult', name: '아케인 메테오', en: 'Arcane Meteor', icon: '🌠',
      cooldown: ULT_COOLDOWN,
      desc: '거대한 아케인 유성이 떨어져 넓은 지역을 소멸시킵니다.',
    },
    evolved: {
      q: {
        key: 'Q', name: '아케인 심판', en: 'Arcane Judgement', icon: '🔮', cooldown: 8,
        desc: '전방에 두 번의 대형 마력 폭발을 일으켜 적을 심판합니다.',
      },
      e: {
        key: 'E', name: '차원 붕괴', en: 'Dimensional Collapse', icon: '🕳', cooldown: 11,
        desc: '주변 차원을 붕괴시켜 광범위 피해와 빙결을 겁니다.',
      },
    },
  },
};

export const CLASS_ORDER = ['warrior', 'archer', 'rogue', 'tanker', 'mage'];

/* 지금 레벨에서 실제로 쓰는 스킬 정의
   - slot: 'q' | 'e' | 'ult'
   - 20레벨(1차 진화) 이상이면 Q · E 가 evolved 스킬로 바뀐다
   - 필살기(ult)는 15레벨부터 열린다 */
export function skillDefFor(classId, slot, level) {
  const c = CLASSES[classId];
  if (!c) return null;
  const lv = Math.max(1, Math.round(level || 1));
  if (slot === 'ult') return lv >= ULT_LEVEL ? (c.ult || null) : null;
  if (lv >= EVOLUTION_LEVEL && c.evolved && c.evolved[slot]) return c.evolved[slot];
  return (c.skills && c.skills[slot]) || null;
}

// 1차 진화 여부 (20레벨 이상)
export function isEvolvedAt(level) { return Math.max(1, Math.round(level || 1)) >= EVOLUTION_LEVEL; }

export const PLAYER_SIZE = { width: 10, height: 20, radius: 4.6 };

/* ------------------------- 태초마을 무기 · 포션 상점 ------------------------- */
export const SHOP = {
  id: 'shop_w1',
  kind: 'world1',
  // 상점 창 상단 문구 (어느 상점인지 한눈에 보이게)
  eyebrow: '1번째 세계 태초마을 · 상점',
  title: '무기 · 갑옷 · 포션 상점',
  keeper: { name: '도로시', role: '상점 주인', line: '필요한 게 있으면 얼마든지 골라 봐.' },
  // 직업별 상위 무기 (Tier 2 · 3) — 사면 바로 장착됩니다
  weapons: {
    warrior: [
      { id: 'w-warrior-2', tier: 2, name: '강철 대검', price: 160, damage: 12, desc: '든든한 강철 대검. 공격력 +12' },
      { id: 'w-warrior-3', tier: 3, name: '황금 기사검', price: 440, damage: 26, crit: 0.05, desc: '빛나는 황금 기사검. 공격력 +26 · 치명타 +5%' },
    ],
    archer: [
      { id: 'w-archer-2', tier: 2, name: '강철 장궁', price: 160, damage: 10, desc: '튼튼한 강철 장궁. 공격력 +10' },
      { id: 'w-archer-3', tier: 3, name: '바람의 명궁', price: 440, damage: 22, crit: 0.05, desc: '바람을 가르는 명궁. 공격력 +22 · 치명타 +5%' },
    ],
    rogue: [
      { id: 'w-rogue-2', tier: 2, name: '미스릴 쌍단검', price: 160, damage: 8, desc: '가벼운 미스릴 쌍단검. 공격력 +8' },
      { id: 'w-rogue-3', tier: 3, name: '그림자 쌍검', price: 440, damage: 18, crit: 0.06, desc: '그림자를 베는 쌍검. 공격력 +18 · 치명타 +6%' },
    ],
    tanker: [
      { id: 'w-tanker-2', tier: 2, name: '강철 방패', price: 160, damage: 10, desc: '두꺼운 강철 방패. 공격력 +10' },
      { id: 'w-tanker-3', tier: 3, name: '수호자의 성벽', price: 440, damage: 21, crit: 0.04, desc: '빛나는 수호자의 방패. 공격력 +21 · 치명타 +4%' },
    ],
    mage: [
      { id: 'w-mage-2', tier: 2, name: '수정 지팡이', price: 160, damage: 11, desc: '맑은 수정이 박힌 지팡이. 공격력 +11' },
      { id: 'w-mage-3', tier: 3, name: '대현자의 홀', price: 440, damage: 24, crit: 0.05, desc: '대현자의 홀. 공격력 +24 · 치명타 +5%' },
    ],
  },
  // 갑옷 (Tier 1 · 2 · 3) — 사면 바로 장착되고 최대 HP · 피해 감소가 붙는다
  armors: [
    {
      id: 'a-leather', tier: 1, name: '가죽 갑옷', price: 180, hp: 45, defense: 0.2,
      desc: '질긴 가죽으로 두른 모험가의 갑옷. 최대 HP +45 · 받는 피해 20% 감소',
    },
    {
      id: 'a-steel', tier: 2, name: '강철 판금 갑옷', price: 400, hp: 110, defense: 0.35,
      desc: '두꺼운 강철 판금. 최대 HP +110 · 받는 피해 35% 감소',
    },
    {
      id: 'a-gold', tier: 3, name: '황금 수호 갑옷', price: 760, hp: 200, defense: 0.5,
      desc: '빛나는 황금 갑옷. 최대 HP +200 · 받는 피해 50% 감소',
    },
  ],
  potions: [
    { id: 'potion-hp', name: '체력 포션', icon: '🧪', price: 60, heal: 80, key: '1', desc: 'HP 80 회복' },
    { id: 'potion-hp-big', name: '고급 체력 포션', icon: '🍶', price: 140, heal: 99999, key: '2', desc: 'HP 전체 회복' },
    { id: 'potion-atk', name: '전투의 비약', icon: '⚗️', price: 180, buff: 'elixir', duration: 20, mult: 1.35, key: '3', desc: '20초간 공격력 +35%' },
  ],
  // 시작 시 지급되는 포션
  starterPotions: { 'potion-hp': 1 },
};

/* ------------------------------------------------------------------
   2세계 태초마을 상점 — 1번째 세계보다 훨씬 강하고 훨씬 비싸다
   · 무기: 화면 표시 Tier 4 · 5 (내부 등급 3 · 4)
   · 갑옷: Tier 4 · 5
   · 포션: 초월 체력 포션 · 완전 회복의 성수 · 광폭의 영약
------------------------------------------------------------------ */
export const SHOP2 = {
  id: 'shop_w2',
  kind: 'world2',
  eyebrow: '2세계 태초마을 · 대장간',
  title: '2세계 대장간 · 무기 · 갑옷 · 포션',
  keeper: {
    name: '그렌', role: '2세계 대장장이',
    line: '2세계에서는 이 정도 장비라야 살아남아. 값은 세지만 그만한 값은 하지.',
  },
  // 직업별 상위 무기 (표시 Tier 4 · 5) — 사면 바로 장착됩니다
  weapons: {
    warrior: [
      { id: 'w2-warrior-4', tier: 4, name: '흑요석 대검', price: 10500, damage: 46, crit: 0.08, desc: '2세계 흑요석을 벼린 대검. 공격력 +46 · 치명타 +8%' },
      { id: 'w2-warrior-5', tier: 5, name: '불멸의 심판검', price: 22000, damage: 84, crit: 0.12, desc: '차원을 가르는 심판의 검. 공격력 +84 · 치명타 +12%' },
    ],
    archer: [
      { id: 'w2-archer-4', tier: 4, name: '심연의 장궁', price: 10000, damage: 42, crit: 0.08, desc: '심연의 바람을 쏘는 장궁. 공격력 +42 · 치명타 +8%' },
      { id: 'w2-archer-5', tier: 5, name: '유성의 명궁', price: 21500, damage: 76, crit: 0.12, desc: '유성을 떨어뜨리는 명궁. 공격력 +76 · 치명타 +12%' },
    ],
    rogue: [
      { id: 'w2-rogue-4', tier: 4, name: '심연 쌍단검', price: 10000, damage: 34, crit: 0.09, desc: '어둠을 베는 심연 쌍단검. 공격력 +34 · 치명타 +9%' },
      { id: 'w2-rogue-5', tier: 5, name: '차원 쌍검', price: 21000, damage: 60, crit: 0.14, desc: '차원을 오가는 쌍검. 공격력 +60 · 치명타 +14%' },
    ],
    tanker: [
      { id: 'w2-tanker-4', tier: 4, name: '심연 수호방패', price: 10500, damage: 42, crit: 0.06, desc: '2세계를 막아서는 수호방패. 공격력 +42 · 치명타 +6%' },
      { id: 'w2-tanker-5', tier: 5, name: '불멸의 성벽', price: 21500, damage: 74, crit: 0.08, desc: '무너지지 않는 불멸의 성벽. 공격력 +74 · 치명타 +8%' },
    ],
    mage: [
      { id: 'w2-mage-4', tier: 4, name: '성운 지팡이', price: 10800, damage: 48, crit: 0.08, desc: '성운을 담은 지팡이. 공격력 +48 · 치명타 +8%' },
      { id: 'w2-mage-5', tier: 5, name: '태초의 홀', price: 22500, damage: 86, crit: 0.12, desc: '태초의 빛이 깃든 홀. 공격력 +86 · 치명타 +12%' },
    ],
  },
  // 2세계 갑옷 (Tier 4 · 5) — 1번째 세계 갑옷보다 훨씬 비싸고 튼튼하다
  armors: [
    {
      id: 'a-mithril', tier: 4, name: '미스릴 성기사 갑옷', price: 12000, hp: 340, defense: 0.62,
      desc: '별빛 미스릴로 벼린 성기사 갑옷. 최대 HP +340 · 받는 피해 62% 감소',
    },
    {
      id: 'a-eternal', tier: 5, name: '차원의 불멸 갑옷', price: 25000, hp: 550, defense: 0.72,
      desc: '차원의 장막을 두른 불멸의 갑옷. 최대 HP +550 · 받는 피해 72% 감소',
    },
  ],
  // 2세계 포션 — 1번째 세계 포션보다 훨씬 강하고 비싸다
  potions: [
    {
      id: 'potion-hp-supreme', name: '초월 체력 포션', icon: '💠', price: 360, heal: 600, key: '4',
      desc: 'HP 600 회복',
    },
    {
      id: 'potion-full-restore', name: '완전 회복의 성수', icon: '🏺', price: 640, heal: 'full',
      buff: 'guard', duration: 15, defense: 0.5, key: '5',
      desc: 'HP 전체 회복 · 15초간 받는 피해 50% 감소',
    },
    {
      id: 'potion-rage', name: '광폭의 영약', icon: '🔥', price: 760, buff: 'rage', duration: 25, mult: 1.6, key: '6',
      desc: '25초간 공격력 +60%',
    },
  ],
};

/* ------------------------------------------------------------------
   3세계 태초마을 상점 — 세 번째 세계의 대상단
   사용자 요청: "상점에는 무기와방어구와포션을 팔아 상점에는 다100000이상이야(포션빼고)"
   · 무기: 화면 표시 Tier 6 · 7 (내부 등급 5 · 6) — 전부 100,000G 이상
   · 갑옷: Tier 6 · 7 — 전부 100,000G 이상
   · 포션: 전설 체력 포션 · 불굴의 성수 · 초월의 영약 — 100,000G 미만
------------------------------------------------------------------ */
export const SHOP3 = {
  id: 'shop_w3',
  kind: 'world3',
  eyebrow: '3세계 태초마을 · 대상단',
  title: '3세계 대상단 · 무기 · 갑옷 · 포션',
  keeper: {
    name: '발렌', role: '3세계 대상단장',
    line: '여기 오는 물건은 다 한 번은 왕국을 벌었던 물건이야. 값은 셈값으로 세게 나왔어.',
  },
  // 직업별 상위 무기 (표시 Tier 6 · 7) — 사면 바로 장착됩니다
  weapons: {
    warrior: [
      { id: 'w3-warrior-6', tier: 6, name: '용사냥꾼의 대검', price: 104000, damage: 150, crit: 0.15, desc: '용의 비늘을 베도록 벼린 대검. 공격력 +150 · 치명타 +15%' },
      { id: 'w3-warrior-7', tier: 7, name: '천공의 심판검', price: 215000, damage: 260, crit: 0.20, desc: '하늘을 가르는 심판의 검. 공격력 +260 · 치명타 +20%' },
    ],
    archer: [
      { id: 'w3-archer-6', tier: 6, name: '천공의 장궁', price: 101000, damage: 136, crit: 0.15, desc: '구름 위를 암다니는 장궁. 공격력 +136 · 치명타 +15%' },
      { id: 'w3-archer-7', tier: 7, name: '새벽의 명궁', price: 212000, damage: 236, crit: 0.20, desc: '새벽빛을 꿰뚫는 명궁. 공격력 +236 · 치명타 +20%' },
    ],
    rogue: [
      { id: 'w3-rogue-6', tier: 6, name: '용살 쌍단검', price: 100000, damage: 110, crit: 0.17, desc: '비늘 밑을 파고드는 쌍단검. 공격력 +110 · 치명타 +17%' },
      { id: 'w3-rogue-7', tier: 7, name: '심연의 쌍검', price: 210000, damage: 190, crit: 0.22, desc: '빛을 삼키는 심연의 쌍검. 공격력 +190 · 치명타 +22%' },
    ],
    tanker: [
      { id: 'w3-tanker-6', tier: 6, name: '성곽 수호방패', price: 103000, damage: 132, crit: 0.10, desc: '성을 통째로 막아설 방패. 공격력 +132 · 치명타 +10%' },
      { id: 'w3-tanker-7', tier: 7, name: '새벽의 성채', price: 214000, damage: 228, crit: 0.12, desc: '부수지 못하는 새벽의 성채. 공격력 +228 · 치명타 +12%' },
    ],
    mage: [
      { id: 'w3-mage-6', tier: 6, name: '별을 담은 홀', price: 106000, damage: 154, crit: 0.15, desc: '별빛을 담아 두는 홀. 공격력 +154 · 치명타 +15%' },
      { id: 'w3-mage-7', tier: 7, name: '창세의 지팡이', price: 218000, damage: 268, crit: 0.20, desc: '창세의 불꽃이 깃든 지팡이. 공격력 +268 · 치명타 +20%' },
    ],
  },
  // 3세계 갑옷 (Tier 6 · 7) — 앞의 두 상점 갑옷을 모두 넘고 값도 가장 비싸다
  armors: [
    {
      id: 'a-dragon', tier: 6, name: '용비늘 판금 갑옷', price: 120000, hp: 900, defense: 0.80,
      desc: '용의 비늘을 이어 붙인 판금. 최대 HP +900 · 받는 피해 80% 감소',
    },
    {
      id: 'a-celestial', tier: 7, name: '창세의 성갑', price: 250000, hp: 1400, defense: 0.86,
      desc: '세계의 빛으로 두른 성갑. 최대 HP +1400 · 받는 피해 86% 감소',
    },
  ],
  // 3세계 포션 — 장바구니 아래 남은 숫자키 7 · 8 · 9 로 바로 사용한다 (모두 100,000G 미만)
  potions: [
    {
      id: 'potion-hp-legend', name: '전설의 체력 포션', icon: '🌀', price: 1200, heal: 3000, key: '7',
      desc: 'HP 3000 회복',
    },
    {
      id: 'potion-fortress', name: '불굴의 성수', icon: '🫗', price: 2200, heal: 'full',
      buff: 'guard', duration: 20, defense: 0.6, key: '8',
      desc: 'HP 전체 회복 · 20초간 받는 피해 60% 감소',
    },
    {
      id: 'potion-ascend', name: '초월의 영약', icon: '🌟', price: 2800, buff: 'rage', duration: 35, mult: 2.0, key: '9',
      desc: '35초간 공격력 +100%',
    },
  ],
};

// 상점 두 곳을 한 곳에서 찾는다
export const SHOPS = { shop_w1: SHOP, shop_w2: SHOP2, shop_w3: SHOP3 };

export function shopById(id) { return SHOPS[id] || SHOP; }

// 지역(마을)에 붙은 상점 설정 — village = 1번째 세계, village_w2 = 2번째 세계, village_w3 = 3번째 세계
export function shopForBiome(biomeId) {
  if (biomeId === 'village_w3') return SHOP3;
  if (biomeId === 'village_w2') return SHOP2;
  if (biomeId === 'village') return SHOP;
  return null;
}

// 그 세계의 태초마을 (죽었을 때 돌아갈 안전한 자리)
export function homeBiomeFor(worldId) {
  if (worldId === 3) return BIOMES.village_w3;
  return worldId === 2 ? BIOMES.village_w2 : BIOMES.village;
}

export function homeSpawnFor(worldId) {
  return homeBiomeFor(worldId).spawn;
}

// 세 상점의 같은 이름 함수들 (샵 UI · 구매 로직 · 테스트가 함께 쓴다)
export function shopWeaponsFor(classId, shopId) {
  const shop = shopById(shopId);
  return (shop.weapons && shop.weapons[classId]) || [];
}

export function allWeapons(classId) {
  return shopWeaponsFor(classId, 'shop_w1')
    .concat(shopWeaponsFor(classId, 'shop_w2'))
    .concat(shopWeaponsFor(classId, 'shop_w3'));
}

export function allArmors() {
  return SHOP.armors.concat(SHOP2.armors).concat(SHOP3.armors);
}

export function allPotions() {
  return SHOP.potions.concat(SHOP2.potions).concat(SHOP3.potions);
}

export function potionById(id) {
  return allPotions().find((p) => p.id === id) || null;
}

export function armorByTier(tier) {
  return allArmors().find((a) => a.tier === tier) || null;
}

// 내부 등급(0 ~ 6)의 최댓값 · 갑옷 등급(0 ~ 7)의 최댓값
export const MAX_WEAPON_TIER = 6;
export const MAX_ARMOR_TIER = 7;

export const BOSS_POS = { x: 0, z: -165 };
export const TEMPLE_GATE = { x: 0, z: 0 };
