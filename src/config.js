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
  // 심해 — 고블린 숲 바로 동쪽(x 500 ~ 1500 · z W2+500 ~ W2+1500)에 붙은 곁가지 지역.
  // 고블린 숲에서 동쪽으로 걸어 들어가면 그대로 심해 바닥으로 이어진다.
  deep_sea: {
    id: 'deep_sea',
    world: 2,
    name: '심해',
    en: 'Deep Sea',
    short: '심해',
    center: { x: 1000, z: W2 + 1000 },
    bounds: { x0: 500, x1: 1500, z0: W2 + 500, z1: W2 + 1500 },
    ground: 0x0a2133,
    ground2: 0x05121f,
    edge: 0x03101a,
    minimap: '#123c5e',
    sky: 0x05141f,
    fog: 0x07252f,
    fogNear: 80,
    fogFar: 520,
    sun: 0x6fe0f0,
    sunIntensity: 0.9,
    hemiSky: 0x2f9ec0,
    hemiGround: 0x03101a,
    hemiIntensity: 0.52,
    mob: 'giant_squid',
    mobCount: 8,
    landmark: '심연의 성소',
    landmarkPos: { x: 1000, z: W2 + 1000 },
    // 서쪽(고블린 숲)에서 걸어 들어오는 길목
    spawn: { x: 620, z: W2 + 1000 },
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
  // 고대유적 — 선사시대 숲 바로 동쪽(x 500 ~ 1500 · z W3+500 ~ W3+1500)에 붙은 곁가지 지역.
  // 선사시대 숲에서 동쪽으로 걸어 들어가면 무너진 신전 마당으로 이어진다.
  ancient_ruins: {
    id: 'ancient_ruins',
    world: 3,
    name: '고대유적',
    en: 'Ancient Ruins',
    short: '고대유적',
    center: { x: 1000, z: W3 + 1000 },
    bounds: { x0: 500, x1: 1500, z0: W3 + 500, z1: W3 + 1500 },
    ground: 0x8a774e,
    ground2: 0x6a5a38,
    edge: 0x51462c,
    minimap: '#c9a253',
    sky: 0x6b4a1c,
    fog: 0x8a6526,
    fogNear: 210,
    fogFar: 1020,
    sun: 0xffcf7a,
    sunIntensity: 1.65,
    hemiSky: 0xe8c88e,
    hemiGround: 0x2a2113,
    hemiIntensity: 0.68,
    mob: 'ancient_serpent',
    mobCount: 8,
    landmark: '태고의 뱀 신전',
    landmarkPos: { x: 1000, z: W3 + 1000 },
    // 서쪽(선사시대 숲)에서 걸어 들어오는 길목
    spawn: { x: 620, z: W3 + 1000 },
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
export const BIOME_ORDER_W2 = ['village_w2', 'goblin_forest', 'misty_plains', 'sakura', 'deep_sea', 'ominous_cave', 'dark_realm'];

// 1번째 세계 지역 순서
export const BIOME_ORDER = ['village', 'forest', 'graveyard', 'savanna', 'old_village', 'jungle', 'temple'];

// 3번째 세계 지역 순서 (도착지인 3세계 태초마을이 먼저 — 북쪽으로 선사시대 숲 → 부패한 도시 → 목장)
export const BIOME_ORDER_W3 = ['village_w3', 'annoying_forest', 'ancient_ruins', 'secret_cave', 'fantasy_forest', 'corrupted_city', 'occupied_ranch'];

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
export const COMPASS_ORDER_W2 = ['dark_realm', 'goblin_forest', 'misty_plains', 'sakura', 'deep_sea', 'ominous_cave', 'village_w2'];

// 3번째 세계 나침반 (최종 보스가 있는 목장을 맨 위에 · 3세계 태초마을도 표시)
export const COMPASS_ORDER_W3 = ['occupied_ranch', 'fantasy_forest', 'annoying_forest', 'ancient_ruins', 'corrupted_city', 'secret_cave', 'village_w3'];

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
  // 심해의 거대 오징어 — 8개의 촉수를 휘두르는 2세계 강자
  giant_squid: {
    id: 'giant_squid', name: '거대 오징어', hp: 3100, damage: 112, speed: 40, aggro: 265,
    attackRange: 62, attackCooldown: 1.9, xp: 980, gold: 520, height: 52, radius: 14,
    leash: 520, kind: 'giant_squid',
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
    leash: 560, kind: 'fallen_hero', level: 78,
  },
  // 고대유적의 고대 뱀 — 머리 세 개가 따로 흔들리는 신전의 수호자
  ancient_serpent: {
    id: 'ancient_serpent', name: '고대 뱀', hp: 6800, damage: 240, speed: 54, aggro: 310,
    attackRange: 66, attackCooldown: 1.55, xp: 3600, gold: 2500, height: 48, radius: 14,
    leash: 560, kind: 'ancient_serpent', heads: 3,
  },
  // 최종 보스 — 거대 강하닭 (한 마리만 · 사용자 요청: "강하닭은 크게만들어야되")
  strong_chicken: {
    id: 'strong_chicken', name: '강하닭', hp: 46000, damage: 360, speed: 42, aggro: 420,
    attackRange: 120, attackCooldown: 2.2, xp: 20000, gold: 12000, height: 58, radius: 22,
    leash: 720, kind: 'strong_chicken', boss: true, level: 99,
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
// 무기: 화면 표시 Tier 2 ~ 6 (내부 등급 1 ~ 5) — 5단계로 촘촘히 올라간다
//   · 가장 약한 무기(강철 대검 · 160G)와 가장 센 무기(황금 기사검 · 440G)는 그대로 두고
//     그 사이에 3개를 새로 넣었다 (사용자 요청: "그 두개중에 약한건 가장약하고 쌘건 가장쌔게,
//     그 사이에 무기들을 추가해줘")
export const SHOP = {
  id: 'shop_w1',
  kind: 'world1',
  // 상점 창 상단 문구 (어느 상점인지 한눈에 보이게)
  eyebrow: '1번째 세계 태초마을 · 상점',
  title: '무기 · 갑옷 · 포션 상점',
  keeper: { name: '도로시', role: '상점 주인', line: '필요한 게 있으면 얼마든지 골라 봐.' },
  // 직업별 무기 (표시 Tier 2 ~ 6) — 사면 바로 장착됩니다
  weapons: {
    warrior: [
      { id: 'w-warrior-2', tier: 2, name: '강철 대검', price: 160, damage: 12, desc: '든든한 강철 대검. 공격력 +12' },
      { id: 'w-warrior-3', tier: 3, name: '정예 강철 대검', price: 230, damage: 16, crit: 0.015, desc: '강철을 거듭 벼린 대검. 공격력 +16 · 치명타 +1.5%' },
      { id: 'w-warrior-4', tier: 4, name: '은장식 대검', price: 300, damage: 19, crit: 0.025, desc: '은장식을 두른 대검. 공격력 +19 · 치명타 +2.5%' },
      { id: 'w-warrior-5', tier: 5, name: '백금 기사검', price: 370, damage: 22, crit: 0.04, desc: '백금으로 벼린 기사검. 공격력 +22 · 치명타 +4%' },
      { id: 'w-warrior-6', tier: 6, name: '황금 기사검', price: 440, damage: 26, crit: 0.05, desc: '빛나는 황금 기사검. 공격력 +26 · 치명타 +5%' },
    ],
    archer: [
      { id: 'w-archer-2', tier: 2, name: '강철 장궁', price: 160, damage: 10, desc: '튼튼한 강철 장궁. 공격력 +10' },
      { id: 'w-archer-3', tier: 3, name: '정예 강철 장궁', price: 230, damage: 13, crit: 0.015, desc: '강철을 겹쳐 만든 장궁. 공격력 +13 · 치명타 +1.5%' },
      { id: 'w-archer-4', tier: 4, name: '은테 장궁', price: 300, damage: 16, crit: 0.025, desc: '은테를 두른 장궁. 공격력 +16 · 치명타 +2.5%' },
      { id: 'w-archer-5', tier: 5, name: '백금 장궁', price: 370, damage: 19, crit: 0.04, desc: '백금으로 다듬은 장궁. 공격력 +19 · 치명타 +4%' },
      { id: 'w-archer-6', tier: 6, name: '바람의 명궁', price: 440, damage: 22, crit: 0.05, desc: '바람을 가르는 명궁. 공격력 +22 · 치명타 +5%' },
    ],
    rogue: [
      { id: 'w-rogue-2', tier: 2, name: '미스릴 쌍단검', price: 160, damage: 8, desc: '가벼운 미스릴 쌍단검. 공격력 +8' },
      { id: 'w-rogue-3', tier: 3, name: '예리한 미스릴 쌍단검', price: 230, damage: 10, crit: 0.02, desc: '날을 세운 미스릴 쌍단검. 공격력 +10 · 치명타 +2%' },
      { id: 'w-rogue-4', tier: 4, name: '그림자 쌍단검', price: 300, damage: 13, crit: 0.035, desc: '그림자에 물든 쌍단검. 공격력 +13 · 치명타 +3.5%' },
      { id: 'w-rogue-5', tier: 5, name: '밤날개 쌍단검', price: 370, damage: 15, crit: 0.05, desc: '밤날개처럼 가벼운 쌍단검. 공격력 +15 · 치명타 +5%' },
      { id: 'w-rogue-6', tier: 6, name: '그림자 쌍검', price: 440, damage: 18, crit: 0.06, desc: '그림자를 베는 쌍검. 공격력 +18 · 치명타 +6%' },
    ],
    tanker: [
      { id: 'w-tanker-2', tier: 2, name: '강철 방패', price: 160, damage: 10, desc: '두꺼운 강철 방패. 공격력 +10' },
      { id: 'w-tanker-3', tier: 3, name: '정예 강철 방패', price: 230, damage: 13, crit: 0.012, desc: '테를 덧댄 강철 방패. 공격력 +13 · 치명타 +1.2%' },
      { id: 'w-tanker-4', tier: 4, name: '은장식 방패', price: 300, damage: 15, crit: 0.02, desc: '은장식을 두른 방패. 공격력 +15 · 치명타 +2%' },
      { id: 'w-tanker-5', tier: 5, name: '백금 수호방패', price: 370, damage: 18, crit: 0.03, desc: '백금으로 두른 수호방패. 공격력 +18 · 치명타 +3%' },
      { id: 'w-tanker-6', tier: 6, name: '수호자의 성벽', price: 440, damage: 21, crit: 0.04, desc: '빛나는 수호자의 방패. 공격력 +21 · 치명타 +4%' },
    ],
    mage: [
      { id: 'w-mage-2', tier: 2, name: '수정 지팡이', price: 160, damage: 11, desc: '맑은 수정이 박힌 지팡이. 공격력 +11' },
      { id: 'w-mage-3', tier: 3, name: '정예 수정 지팡이', price: 230, damage: 14, crit: 0.015, desc: '수정을 크게 박은 지팡이. 공격력 +14 · 치명타 +1.5%' },
      { id: 'w-mage-4', tier: 4, name: '은빛 지팡이', price: 300, damage: 17, crit: 0.025, desc: '은빛이 감도는 지팡이. 공격력 +17 · 치명타 +2.5%' },
      { id: 'w-mage-5', tier: 5, name: '백금 지팡이', price: 370, damage: 20, crit: 0.04, desc: '백금으로 두른 지팡이. 공격력 +20 · 치명타 +4%' },
      { id: 'w-mage-6', tier: 6, name: '대현자의 홀', price: 440, damage: 24, crit: 0.05, desc: '대현자의 홀. 공격력 +24 · 치명타 +5%' },
    ],
  },
  // 갑옷 (Tier 1 ~ 5) — 사면 바로 장착되고 최대 HP · 피해 감소가 붙는다
  //   · 가장 약한 가죽 갑옷과 가장 센 황금 수호 갑옷 사이에 2벌을 더 넣었다
  armors: [
    {
      id: 'a-leather', tier: 1, name: '가죽 갑옷', price: 180, hp: 45, defense: 0.2,
      desc: '질긴 가죽으로 두른 모험가의 갑옷. 최대 HP +45 · 받는 피해 20% 감소',
    },
    {
      id: 'a-chain', tier: 2, name: '사슬 갑옷', price: 270, hp: 75, defense: 0.26,
      desc: '촘촘한 사슬을 엮은 갑옷. 최대 HP +75 · 받는 피해 26% 감소',
    },
    {
      id: 'a-steel', tier: 3, name: '강철 판금 갑옷', price: 400, hp: 110, defense: 0.35,
      desc: '두꺼운 강철 판금. 최대 HP +110 · 받는 피해 35% 감소',
    },
    {
      id: 'a-mithril-chain', tier: 4, name: '미스릴 사슬 갑옷', price: 570, hp: 155, defense: 0.43,
      desc: '미스릴 고리로 엮은 사슬 갑옷. 최대 HP +155 · 받는 피해 43% 감소',
    },
    {
      id: 'a-gold', tier: 5, name: '황금 수호 갑옷', price: 760, hp: 200, defense: 0.5,
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
   · 무기: 화면 표시 Tier 7 ~ 11 (내부 등급 6 ~ 10) — 5단계, 전부 10,000G 이상
   · 갑옷: Tier 6 ~ 9 — 전부 10,000G 이상
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
  // 직업별 무기 (표시 Tier 7 ~ 11) — 사면 바로 장착됩니다
  weapons: {
    warrior: [
      { id: 'w2-warrior-7', tier: 7, name: '흑요석 대검', price: 10500, damage: 48, crit: 0.08, desc: '2세계 흑요석을 벼린 대검. 공격력 +48 · 치명타 +8%' },
      { id: 'w2-warrior-8', tier: 8, name: '정예 흑요석 대검', price: 13000, damage: 59, crit: 0.09, desc: '흑요석을 거듭 벼린 대검. 공격력 +59 · 치명타 +9%' },
      { id: 'w2-warrior-9', tier: 9, name: '별철 대검', price: 16000, damage: 68, crit: 0.10, desc: '별에서 떨어진 쇠로 벼린 대검. 공격력 +68 · 치명타 +10%' },
      { id: 'w2-warrior-10', tier: 10, name: '성운 대검', price: 19000, damage: 79, crit: 0.11, desc: '성운의 빛이 도는 대검. 공격력 +79 · 치명타 +11%' },
      { id: 'w2-warrior-11', tier: 11, name: '불멸의 심판검', price: 22000, damage: 88, crit: 0.12, desc: '차원을 가르는 심판의 검. 공격력 +88 · 치명타 +12%' },
    ],
    archer: [
      { id: 'w2-archer-7', tier: 7, name: '심연의 장궁', price: 10000, damage: 44, crit: 0.08, desc: '심연의 바람을 쏘는 장궁. 공격력 +44 · 치명타 +8%' },
      { id: 'w2-archer-8', tier: 8, name: '정예 심연 장궁', price: 13000, damage: 54, crit: 0.09, desc: '심연의 힘을 더한 장궁. 공격력 +54 · 치명타 +9%' },
      { id: 'w2-archer-9', tier: 9, name: '별빛 장궁', price: 16000, damage: 63, crit: 0.10, desc: '별빛을 걸어 쏘는 장궁. 공격력 +63 · 치명타 +10%' },
      { id: 'w2-archer-10', tier: 10, name: '성운 장궁', price: 19000, damage: 71, crit: 0.11, desc: '성운을 당겨 쏘는 장궁. 공격력 +71 · 치명타 +11%' },
      { id: 'w2-archer-11', tier: 11, name: '유성의 명궁', price: 21500, damage: 80, crit: 0.12, desc: '유성을 떨어뜨리는 명궁. 공격력 +80 · 치명타 +12%' },
    ],
    rogue: [
      { id: 'w2-rogue-7', tier: 7, name: '심연 쌍단검', price: 10000, damage: 36, crit: 0.09, desc: '어둠을 베는 심연 쌍단검. 공격력 +36 · 치명타 +9%' },
      { id: 'w2-rogue-8', tier: 8, name: '정예 심연 쌍단검', price: 13000, damage: 43, crit: 0.10, desc: '심연에 물든 정예 쌍단검. 공격력 +43 · 치명타 +10%' },
      { id: 'w2-rogue-9', tier: 9, name: '별빛 쌍단검', price: 16000, damage: 50, crit: 0.12, desc: '별빛을 가른 쌍단검. 공격력 +50 · 치명타 +12%' },
      { id: 'w2-rogue-10', tier: 10, name: '성운 쌍단검', price: 19000, damage: 57, crit: 0.13, desc: '성운을 흐르게 한 쌍단검. 공격력 +57 · 치명타 +13%' },
      { id: 'w2-rogue-11', tier: 11, name: '차원 쌍검', price: 21000, damage: 63, crit: 0.14, desc: '차원을 오가는 쌍검. 공격력 +63 · 치명타 +14%' },
    ],
    tanker: [
      { id: 'w2-tanker-7', tier: 7, name: '심연 수호방패', price: 10500, damage: 44, crit: 0.06, desc: '2세계를 막아서는 수호방패. 공격력 +44 · 치명타 +6%' },
      { id: 'w2-tanker-8', tier: 8, name: '정예 심연 수호방패', price: 13000, damage: 52, crit: 0.065, desc: '테를 덧댄 심연 수호방패. 공격력 +52 · 치명타 +6.5%' },
      { id: 'w2-tanker-9', tier: 9, name: '별빛 수호방패', price: 16000, damage: 61, crit: 0.07, desc: '별빛이 흐르는 수호방패. 공격력 +61 · 치명타 +7%' },
      { id: 'w2-tanker-10', tier: 10, name: '성운 수호방패', price: 19000, damage: 69, crit: 0.075, desc: '성운으로 두른 수호방패. 공격력 +69 · 치명타 +7.5%' },
      { id: 'w2-tanker-11', tier: 11, name: '불멸의 성벽', price: 21500, damage: 78, crit: 0.08, desc: '무너지지 않는 불멸의 성벽. 공격력 +78 · 치명타 +8%' },
    ],
    mage: [
      { id: 'w2-mage-7', tier: 7, name: '성운 지팡이', price: 10800, damage: 50, crit: 0.08, desc: '성운을 담은 지팡이. 공격력 +50 · 치명타 +8%' },
      { id: 'w2-mage-8', tier: 8, name: '정예 성운 지팡이', price: 13000, damage: 61, crit: 0.09, desc: '성운을 크게 담은 지팡이. 공격력 +61 · 치명타 +9%' },
      { id: 'w2-mage-9', tier: 9, name: '별빛 지팡이', price: 16000, damage: 70, crit: 0.10, desc: '별빛을 머금은 지팡이. 공격력 +70 · 치명타 +10%' },
      { id: 'w2-mage-10', tier: 10, name: '심연의 지팡이', price: 19000, damage: 80, crit: 0.11, desc: '심연을 부르는 지팡이. 공격력 +80 · 치명타 +11%' },
      { id: 'w2-mage-11', tier: 11, name: '태초의 홀', price: 22500, damage: 90, crit: 0.12, desc: '태초의 빛이 깃든 홀. 공격력 +90 · 치명타 +12%' },
    ],
  },
  // 2세계 갑옷 (Tier 6 ~ 9) — 1세계 갑옷보다 훨씬 비싸고 튼튼하다
  armors: [
    {
      id: 'a-mithril', tier: 6, name: '미스릴 성기사 갑옷', price: 12000, hp: 340, defense: 0.62,
      desc: '별빛 미스릴로 벼린 성기사 갑옷. 최대 HP +340 · 받는 피해 62% 감소',
    },
    {
      id: 'a-obsidian', tier: 7, name: '흑요석 수호 갑옷', price: 16000, hp: 415, defense: 0.66,
      desc: '2세계 흑요석을 두른 수호 갑옷. 최대 HP +415 · 받는 피해 66% 감소',
    },
    {
      id: 'a-starlight', tier: 8, name: '별빛 성갑', price: 20000, hp: 490, defense: 0.69,
      desc: '별빛을 엮어 두른 성갑. 최대 HP +490 · 받는 피해 69% 감소',
    },
    {
      id: 'a-eternal', tier: 9, name: '차원의 불멸 갑옷', price: 25000, hp: 550, defense: 0.72,
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
   · 무기: 화면 표시 Tier 12 ~ 16 (내부 등급 11 ~ 15) — 전부 100,000G 이상
   · 갑옷: Tier 10 ~ 13 — 전부 100,000G 이상
   · 포션: 전설 체력 포션 · 불굴의 성수 · 초월의 영약 — 100,000G 미만
   · 가장 센 무기(천공의 심판검 등)는 사용자 요청대로 더 세게 올렸다 (예전 260 → 322 · +24%)
   · 2·3세계 무기는 사용자 요청("2세계랑 3세계 무기를 좀더 쌔게 (조오오오금)")대로 한 번 더 5% 올렸다
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
  // 직업별 무기 (표시 Tier 12 ~ 16) — 사면 바로 장착됩니다
  weapons: {
    warrior: [
      { id: 'w3-warrior-12', tier: 12, name: '용사냥꾼의 대검', price: 104000, damage: 158, crit: 0.15, desc: '용의 비늘을 베도록 벼린 대검. 공격력 +158 · 치명타 +15%' },
      { id: 'w3-warrior-13', tier: 13, name: '정예 용사냥꾼 대검', price: 130000, damage: 191, crit: 0.16, desc: '용비늘을 거듭 벼린 대검. 공격력 +191 · 치명타 +16%' },
      { id: 'w3-warrior-14', tier: 14, name: '고대룡 대검', price: 160000, damage: 220, crit: 0.18, desc: '고대룡의 뼈를 벼린 대검. 공격력 +220 · 치명타 +18%' },
      { id: 'w3-warrior-15', tier: 15, name: '새벽 대검', price: 185000, damage: 248, crit: 0.19, desc: '새벽빛으로 벼린 대검. 공격력 +248 · 치명타 +19%' },
      { id: 'w3-warrior-16', tier: 16, name: '천공의 심판검', price: 232000, damage: 322, crit: 0.22, desc: '하늘을 가르는 심판의 검. 공격력 +322 · 치명타 +22%' },
    ],
    archer: [
      { id: 'w3-archer-12', tier: 12, name: '천공의 장궁', price: 101000, damage: 143, crit: 0.15, desc: '구름 위를 암다니는 장궁. 공격력 +143 · 치명타 +15%' },
      { id: 'w3-archer-13', tier: 13, name: '정예 천공 장궁', price: 130000, damage: 172, crit: 0.16, desc: '천공의 힘을 더한 장궁. 공격력 +172 · 치명타 +16%' },
      { id: 'w3-archer-14', tier: 14, name: '고대룡 장궁', price: 160000, damage: 200, crit: 0.18, desc: '고대룡의 힘줄을 걸어 만든 장궁. 공격력 +200 · 치명타 +18%' },
      { id: 'w3-archer-15', tier: 15, name: '새벽 장궁', price: 185000, damage: 225, crit: 0.19, desc: '새벽빛을 쏘는 장궁. 공격력 +225 · 치명타 +19%' },
      { id: 'w3-archer-16', tier: 16, name: '새벽의 명궁', price: 229000, damage: 292, crit: 0.22, desc: '새벽빛을 꿰뚫는 명궁. 공격력 +292 · 치명타 +22%' },
    ],
    rogue: [
      { id: 'w3-rogue-12', tier: 12, name: '용살 쌍단검', price: 100000, damage: 116, crit: 0.17, desc: '비늘 밑을 파고드는 쌍단검. 공격력 +116 · 치명타 +17%' },
      { id: 'w3-rogue-13', tier: 13, name: '정예 용살 쌍단검', price: 130000, damage: 139, crit: 0.18, desc: '용을 잡는 정예 쌍단검. 공격력 +139 · 치명타 +18%' },
      { id: 'w3-rogue-14', tier: 14, name: '고대룡 쌍단검', price: 160000, damage: 162, crit: 0.20, desc: '고대룡의 이빨로 벼린 쌍단검. 공격력 +162 · 치명타 +20%' },
      { id: 'w3-rogue-15', tier: 15, name: '새벽 쌍단검', price: 185000, damage: 181, crit: 0.21, desc: '새벽을 가르는 쌍단검. 공격력 +181 · 치명타 +21%' },
      { id: 'w3-rogue-16', tier: 16, name: '심연의 쌍검', price: 227000, damage: 235, crit: 0.24, desc: '빛을 삼키는 심연의 쌍검. 공격력 +235 · 치명타 +24%' },
    ],
    tanker: [
      { id: 'w3-tanker-12', tier: 12, name: '성곽 수호방패', price: 103000, damage: 139, crit: 0.10, desc: '성을 통째로 막아설 방패. 공격력 +139 · 치명타 +10%' },
      { id: 'w3-tanker-13', tier: 13, name: '정예 성곽 수호방패', price: 130000, damage: 166, crit: 0.105, desc: '테를 덧댄 성곽 수호방패. 공격력 +166 · 치명타 +10.5%' },
      { id: 'w3-tanker-14', tier: 14, name: '고대룡 수호방패', price: 160000, damage: 191, crit: 0.11, desc: '고대룡의 비늘을 두른 방패. 공격력 +191 · 치명타 +11%' },
      { id: 'w3-tanker-15', tier: 15, name: '새벽 수호방패', price: 185000, damage: 214, crit: 0.115, desc: '새벽빛으로 두른 수호방패. 공격력 +214 · 치명타 +11.5%' },
      { id: 'w3-tanker-16', tier: 16, name: '새벽의 성채', price: 231000, damage: 281, crit: 0.14, desc: '부수지 못하는 새벽의 성채. 공격력 +281 · 치명타 +14%' },
    ],
    mage: [
      { id: 'w3-mage-12', tier: 12, name: '별을 담은 홀', price: 106000, damage: 162, crit: 0.15, desc: '별빛을 담아 두는 홀. 공격력 +162 · 치명타 +15%' },
      { id: 'w3-mage-13', tier: 13, name: '정예 별빛 홀', price: 130000, damage: 195, crit: 0.16, desc: '별빛을 크게 담은 홀. 공격력 +195 · 치명타 +16%' },
      { id: 'w3-mage-14', tier: 14, name: '고대룡 홀', price: 160000, damage: 227, crit: 0.18, desc: '고대룡의 심장을 담은 홀. 공격력 +227 · 치명타 +18%' },
      { id: 'w3-mage-15', tier: 15, name: '새벽 홀', price: 185000, damage: 256, crit: 0.19, desc: '새벽빛을 담은 홀. 공격력 +256 · 치명타 +19%' },
      { id: 'w3-mage-16', tier: 16, name: '창세의 지팡이', price: 235000, damage: 332, crit: 0.22, desc: '창세의 불꽃이 깃든 지팡이. 공격력 +332 · 치명타 +22%' },
    ],
  },
  // 3세계 갑옷 (Tier 10 ~ 13) — 앞의 두 상점 갑옷을 모두 넘고 값도 가장 비싸다
  armors: [
    {
      id: 'a-dragon', tier: 10, name: '용비늘 판금 갑옷', price: 120000, hp: 900, defense: 0.80,
      desc: '용의 비늘을 이어 붙인 판금. 최대 HP +900 · 받는 피해 80% 감소',
    },
    {
      id: 'a-dragonlord', tier: 11, name: '용왕의 비늘 갑옷', price: 175000, hp: 1080, defense: 0.83,
      desc: '용왕의 비늘로 두른 갑옷. 최대 HP +1080 · 받는 피해 83% 감소',
    },
    {
      id: 'a-ancient', tier: 12, name: '고대 성갑', price: 220000, hp: 1250, defense: 0.845,
      desc: '고대 왕국의 성갑. 최대 HP +1250 · 받는 피해 84.5% 감소',
    },
    {
      id: 'a-celestial', tier: 13, name: '창세의 성갑', price: 250000, hp: 1400, defense: 0.86,
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

// 무기 내부 등급(0 = 기본 장비, 1 ~ 15 = 상점) · 갑옷 등급(0 = 맨몸, 1 ~ 13 = 상점)
export const MAX_WEAPON_TIER = 15;
export const MAX_ARMOR_TIER = 13;

/* ==================================================================
   세계별 특별 퀘스트 NPC — 1·2·3세계 태초마을 광장에 각각 한 명씩 선다
   사용자 요청: "1,2,3세계에 각각 NPC를 소환해주고 그 NPC에게 말을 걸면
                특별 퀘스트가 나오게 해줘"
   · 순차 퀘스트(src/quests.js)와는 별개로 NPC 에게 말을 걸어 수락하고,
     목표를 채우면 그 NPC 에게 돌아와 보상(골드 + 경험치)을 받는다.
   · 처치는 main.js 의 recordKill 한 곳으로 모이므로 혼자 하기 · 호스트 ·
     친구(멀티플레이) 처치가 모두 똑같이 세어진다.
================================================================== */
export const SPECIAL_QUESTS = {
  1: {
    world: 1,
    npc: {
      id: 'npc_special_w1',
      name: '모험가 길드장 루나',
      role: '특별 퀘스트 · 모험가 길드',
      line: '정글 사원 너머의 소문을 들었나? 길드가 의뢰서를 쥐고 있다네.',
      pos: { x: -1912, z: 34 },        // 태초마을 광장 동쪽 (상점 · 분수와 겹치지 않는 자리)
      radius: 66,                      // 말을 걸 수 있는 거리
      greeting: '내가 준 의뢰는 쉽지 않다네. 준비되면 다시 오게.',
      palette: { coat: 0x3f6fa8, trim: 0xffd24a, glow: 0x8fd8ff, skin: 0xefc9a4, hair: 0x7a4a24, prop: 0xf4e6c8 },
    },
    quests: [
      {
        id: 'sp_w1_jungle',
        title: '정글의 수호자',
        desc: '정글 사원을 지키던 고릴라가 흥포해졌다. 고릴라 15마리와 고대 골렘 1마리를 처치하라.',
        goals: [{ mob: 'gorilla', target: 15 }, { mob: 'golem', target: 1 }],
        rewardGold: 2500,
        rewardXp: 900,
        line: '숲이 자네를 기다린다네.',
      },
      {
        id: 'sp_w1_graveyard',
        title: '무덤가의 망령',
        desc: '해가 진 뒤 무덤 지대가 들끓는다. 슬라임 20마리 · 좀비 15마리 · 하이에나 10마리를 정리하라.',
        goals: [{ mob: 'slime', target: 20 }, { mob: 'zombie', target: 15 }, { mob: 'hyena', target: 10 }],
        rewardGold: 1800,
        rewardXp: 600,
        line: '무덤 지대를 깨끗하게 해 주게.',
      },
    ],
  },
  2: {
    world: 2,
    npc: {
      id: 'npc_special_w2',
      name: '심연의 현자 카이',
      role: '특별 퀘스트 · 심연의 현자',
      line: '심해 밑에서 무엇이 깨어났는지 아는가? 내가 그 의뢰를 들고 있네.',
      pos: { x: 88, z: WORLD2.originZ + 2000 },   // 2세계 태초마을 광장 동쪽
      radius: 66,
      greeting: '심연은 서두르는 자를 삼킨다네.',
      palette: { coat: 0x4a3a6e, trim: 0x9a6cff, glow: 0x8fd8ff, skin: 0xdcc4a8, hair: 0xe8e0f0, prop: 0xb98cff },
    },
    quests: [
      {
        id: 'sp_w2_squid',
        title: '심해의 괴수',
        desc: '심해의 거대 오정어와 암흑지역의 흑마법사를 함께 처치하라. 거대 오정어 10마리 · 흑마법사 1마리.',
        goals: [{ mob: 'giant_squid', target: 10 }, { mob: 'dark_mage', target: 1 }],
        rewardGold: 22000,
        rewardXp: 4500,
        line: '심연의 빛을 되찾아 주게.',
      },
      {
        id: 'sp_w2_goblin',
        title: '고블린 왕의 심장',
        desc: '고블린 숲과 불길한 동굴을 정리하라. 고블린 25마리 · 스켈레톤 15마리 · 아이언 골렘 8마리.',
        goals: [{ mob: 'goblin', target: 25 }, { mob: 'skeleton', target: 15 }, { mob: 'iron_golem', target: 8 }],
        rewardGold: 15000,
        rewardXp: 3000,
        line: '고블린의 북소리가 멈추지 않는다면 이 세계는 끝없이 흔들릴 것이네.',
      },
    ],
  },
  3: {
    world: 3,
    npc: {
      id: 'npc_special_w3',
      name: '고대 탐험가 아리아',
      role: '특별 퀘스트 · 고대 탐험가',
      line: '고대 신전과 점령당한 목장 — 내가 평생 추적한 흔적이 거기 있지.',
      pos: { x: 88, z: WORLD3.originZ + 2000 },   // 3세계 태초마을 광장 동쪽
      radius: 66,
      greeting: '지도는 내가 그려 두었네. 발은 자네가 옴기게나.',
      palette: { coat: 0x2f6b4e, trim: 0xfff2b0, glow: 0x8ef0c0, skin: 0xe8c9a8, hair: 0x3b2a1c, prop: 0xa8ffd0 },
    },
    quests: [
      {
        id: 'sp_w3_temple',
        title: '고대 신전과 목장',
        desc: '고대유적의 고대 뱀과 점령당한 목장의 주인 강하닭을 처치하라. 고대 뱀 10마리 · 강하닭 1마리.',
        goals: [{ mob: 'ancient_serpent', target: 10 }, { mob: 'strong_chicken', target: 1 }],
        rewardGold: 180000,
        rewardXp: 30000,
        line: '목장의 깃발을 다시 우리 것으로 되돌려 주게.',
      },
      {
        id: 'sp_w3_finale',
        title: '세계의 끝',
        desc: '세 번째 세계를 덮은 재앙을 끝장내라. 용 10마리 · 와이번 12마리 · 타락한 영웅 6마리.',
        goals: [{ mob: 'dragon', target: 10 }, { mob: 'wyvern', target: 12 }, { mob: 'fallen_hero', target: 6 }],
        rewardGold: 120000,
        rewardXp: 20000,
        line: '세계의 끝을 본다는 것은… 모든 것을 잃는 것과 같지.',
      },
    ],
  },
};

// 세계 번호 -> 그 세계의 특별 퀘스트 정의 (모르는 값은 1세계)
export function specialDefFor(worldId) {
  return SPECIAL_QUESTS[worldId] || SPECIAL_QUESTS[1];
}

// 그 세계의 NPC 를 한 명 (없으면 1세계)
export function specialNpcFor(worldId) {
  return specialDefFor(worldId).npc;
}

/* ------------------------------------------------------------------
   친구 초대(함께 하기)로 들어온 사람이 서는 자리 — 언제나 1세계 태초마을.
   사용자 요청: "소환될때 3세계로 스폰되 1세계에서 스폰하게 해줘"
   호스트가 2·3세계로 이동해 있어도 초대받은 사람은 1세계 태초마을에서 시작한다.
------------------------------------------------------------------ */
export const GUEST_SPAWN = { x: BIOMES.village.spawn.x, z: BIOMES.village.spawn.z };

// 초대받은 사람의 시작 자리 (index 번째 사람은 26 거리만큼 둥글게 흩어진다)
export function guestSpawnPoint(index) {
  const base = GUEST_SPAWN;
  const a = (Math.max(1, Math.round(index || 1))) * 1.1;
  return {
    x: base.x + Math.cos(a) * 26,
    z: base.z + Math.sin(a) * 26,
    yaw: Math.PI,
  };
}

export const BOSS_POS = { x: 0, z: -165 };
export const TEMPLE_GATE = { x: 0, z: 0 };
