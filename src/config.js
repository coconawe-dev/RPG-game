// 월드 · 직업 · 스킬 정의
import { WORLD2 } from './utils.js';

export { WORLD2 };

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
   좌표는 1번째 세계와 겹치지 않게 WORLD2.originZ 만큼 밀어 둔 절대 좌표다.
------------------------------------------------------------------ */
const W2 = WORLD2.originZ;

export const BIOMES_W2 = {
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
    spawn: { x: 0, z: W2 + 1400 },
    arrival: true,
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

// 2번째 세계 지역 순서 (도착지인 고블린 숲이 먼저)
export const BIOME_ORDER_W2 = ['goblin_forest', 'misty_plains', 'sakura', 'ominous_cave', 'dark_realm'];

// 1번째 세계 지역 순서
export const BIOME_ORDER = ['village', 'forest', 'graveyard', 'savanna', 'old_village', 'jungle', 'temple'];

// 두 세계를 한 곳에서 찾을 수 있게 합쳐 둔다 (지역 이름 · 색 · 경계 조회용)
Object.assign(BIOMES, BIOMES_W2);

// 두 세계를 모두 포함한 목록 — 몹 스폰 · 바이옴 컬링 · 환경 색 계산용
export const ALL_BIOME_ORDER = BIOME_ORDER.concat(BIOME_ORDER_W2);

// 두 세계의 바이옴 정의를 한 곳에서 찾는다
export function biomeById(id) {
  return BIOMES[id] || null;
}

// 세계별 지역 목록
export function biomeOrderFor(worldId) {
  return worldId === 2 ? BIOME_ORDER_W2 : BIOME_ORDER;
}


// 미니맵 · 나침반에서 사용할 지역 목록 (사원 우선 표시)
export const COMPASS_ORDER = ['temple', 'village', 'forest', 'graveyard', 'savanna', 'old_village', 'jungle'];

// 2번째 세계 나침반 (보스가 있는 암흑지역을 맨 위에)
export const COMPASS_ORDER_W2 = ['dark_realm', 'goblin_forest', 'misty_plains', 'sakura', 'ominous_cave'];

export function compassOrderFor(worldId) {
  return worldId === 2 ? COMPASS_ORDER_W2 : COMPASS_ORDER;
}

// 시작 골드
export const START_GOLD = 100;

export const MOB_TYPES = {
  slime: {
    id: 'slime', name: '슬라임', hp: 46, damage: 7, speed: 20, aggro: 120,
    attackRange: 24, attackCooldown: 1.7, xp: 16, gold: 15, height: 12, radius: 6,
    leash: 260, kind: 'slime',
  },
  zombie: {
    id: 'zombie', name: '좀비', hp: 74, damage: 11, speed: 30, aggro: 150,
    attackRange: 28, attackCooldown: 1.9, xp: 26, gold: 30, height: 18, radius: 6,
    leash: 300, kind: 'humanoid',
  },
  hyena: {
    id: 'hyena', name: '하이에나', hp: 82, damage: 13, speed: 54, aggro: 190,
    attackRange: 26, attackCooldown: 1.35, xp: 32, gold: 45, height: 12, radius: 6,
    leash: 360, kind: 'quadruped',
  },
  gorilla: {
    id: 'gorilla', name: '고릴라', hp: 158, damage: 19, speed: 38, aggro: 170,
    attackRange: 32, attackCooldown: 2.1, xp: 52, gold: 70, height: 20, radius: 8,
    leash: 320, kind: 'gorilla',
  },
  raider: {
    id: 'raider', name: '약탈자', hp: 135, damage: 18, speed: 44, aggro: 190,
    attackRange: 30, attackCooldown: 1.5, xp: 48, gold: 65, height: 20, radius: 7,
    leash: 340, kind: 'raider',
  },
  golem: {
    id: 'golem', name: '고대 골렘', hp: 3200, damage: 54, speed: 28, aggro: 340,
    attackRange: 82, attackCooldown: 2.1, xp: 2500, gold: 800, height: 48, radius: 18,
    leash: 660, kind: 'golem', boss: true, level: 20,
    enrageAt: 0.5, slamEvery: 3, slamRadius: 200, slamWindup: 1.5, slamCooldown: 9,
  },

  /* ---------------------- 2번째 세계의 몹 — 훨씬 강하다 ---------------------- */
  goblin: {
    id: 'goblin', name: '고블린', hp: 540, damage: 29, speed: 64, aggro: 210,
    attackRange: 32, attackCooldown: 1.25, xp: 300, gold: 150, height: 17, radius: 6,
    leash: 360, kind: 'goblin',
  },
  skeleton: {
    id: 'skeleton', name: '스켈레톤', hp: 720, damage: 37, speed: 52, aggro: 220,
    attackRange: 42, attackCooldown: 1.6, xp: 450, gold: 230, height: 19, radius: 6,
    leash: 380, kind: 'skeleton',
  },
  samurai: {
    id: 'samurai', name: '사무라이', hp: 1150, damage: 49, speed: 56, aggro: 240,
    attackRange: 46, attackCooldown: 1.45, xp: 700, gold: 330, height: 21, radius: 7,
    leash: 420, kind: 'samurai',
  },
  iron_golem: {
    id: 'iron_golem', name: '아이언 골렘', hp: 1850, damage: 60, speed: 36, aggro: 280,
    attackRange: 70, attackCooldown: 2.0, xp: 1200, gold: 620, height: 46, radius: 16,
    leash: 600, kind: 'iron_golem',
  },
  dark_mage: {
    id: 'dark_mage', name: '흑마법사', hp: 6800, damage: 78, speed: 32, aggro: 380,
    attackRange: 170, attackCooldown: 2.3, xp: 6500, gold: 2600, height: 40, radius: 12,
    leash: 640, kind: 'dark_mage', boss: true, level: 60,
    enemyProjectile: 'dark_orb',
    enrageAt: 0.55, slamEvery: 3, slamRadius: 230, slamWindup: 1.4, slamCooldown: 8,
    slamLabel: '어둠의 충격파!',
  },
};

// 2번째 세계 보스가 서는 자리 (암흑지역 제단 앞)
export const BOSS2_POS = { x: 0, z: WORLD2.originZ + 130 };

// 2번째 세계 도착 광장 · 고대 골렘을 잡으면 열리는 포털 자리
export const WORLD2_ARRIVAL = { x: 0, z: WORLD2.originZ + 1400 };
export const WORLD1_PORTAL_POS = { x: 0, z: 172 };
// 1번째 세계로 돌아가는 귀환 포털 (도착 광장 옆)
export const WORLD2_RETURN_POS = { x: 190, z: WORLD2.originZ + 1400 };


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
  },
};

export const CLASS_ORDER = ['warrior', 'archer', 'rogue', 'tanker', 'mage'];

export const PLAYER_SIZE = { width: 10, height: 20, radius: 4.6 };

/* ------------------------- 태초마을 무기 · 포션 상점 ------------------------- */
export const SHOP = {
  keeper: { name: '도로시', role: '상점 주인', line: '필요한 게 있으면 얼마든지 골라 봐.' },
  // 직업별 상위 무기 (Tier 2 · 3) — 사면 바로 장착됩니다
  weapons: {
    warrior: [
      { id: 'w-warrior-2', tier: 2, name: '강철 대검', price: 80, damage: 12, desc: '든든한 강철 대검. 공격력 +12' },
      { id: 'w-warrior-3', tier: 3, name: '황금 기사검', price: 220, damage: 26, crit: 0.05, desc: '빛나는 황금 기사검. 공격력 +26 · 치명타 +5%' },
    ],
    archer: [
      { id: 'w-archer-2', tier: 2, name: '강철 장궁', price: 80, damage: 10, desc: '튼튼한 강철 장궁. 공격력 +10' },
      { id: 'w-archer-3', tier: 3, name: '바람의 명궁', price: 220, damage: 22, crit: 0.05, desc: '바람을 가르는 명궁. 공격력 +22 · 치명타 +5%' },
    ],
    rogue: [
      { id: 'w-rogue-2', tier: 2, name: '미스릴 쌍단검', price: 80, damage: 8, desc: '가벼운 미스릴 쌍단검. 공격력 +8' },
      { id: 'w-rogue-3', tier: 3, name: '그림자 쌍검', price: 220, damage: 18, crit: 0.06, desc: '그림자를 베는 쌍검. 공격력 +18 · 치명타 +6%' },
    ],
    tanker: [
      { id: 'w-tanker-2', tier: 2, name: '강철 방패', price: 80, damage: 10, desc: '두꺼운 강철 방패. 공격력 +10' },
      { id: 'w-tanker-3', tier: 3, name: '수호자의 성벽', price: 220, damage: 21, crit: 0.04, desc: '빛나는 수호자의 방패. 공격력 +21 · 치명타 +4%' },
    ],
    mage: [
      { id: 'w-mage-2', tier: 2, name: '수정 지팡이', price: 80, damage: 11, desc: '맑은 수정이 박힌 지팡이. 공격력 +11' },
      { id: 'w-mage-3', tier: 3, name: '대현자의 홀', price: 220, damage: 24, crit: 0.05, desc: '대현자의 홀. 공격력 +24 · 치명타 +5%' },
    ],
  },
  // 갑옷 (Tier 1 · 2 · 3) — 사면 바로 장착되고 최대 HP · 피해 감소가 붙는다
  armors: [
    {
      id: 'a-leather', tier: 1, name: '가죽 갑옷', price: 90, hp: 45, defense: 0.2,
      desc: '질긴 가죽으로 두른 모험가의 갑옷. 최대 HP +45 · 받는 피해 20% 감소',
    },
    {
      id: 'a-steel', tier: 2, name: '강철 판금 갑옷', price: 200, hp: 110, defense: 0.35,
      desc: '두꺼운 강철 판금. 최대 HP +110 · 받는 피해 35% 감소',
    },
    {
      id: 'a-gold', tier: 3, name: '황금 수호 갑옷', price: 380, hp: 200, defense: 0.5,
      desc: '빛나는 황금 갑옷. 최대 HP +200 · 받는 피해 50% 감소',
    },
  ],
  potions: [
    { id: 'potion-hp', name: '체력 포션', icon: '🧪', price: 30, heal: 80, key: '1', desc: 'HP 80 회복' },
    { id: 'potion-hp-big', name: '고급 체력 포션', icon: '🍶', price: 70, heal: 99999, key: '2', desc: 'HP 전체 회복' },
    { id: 'potion-atk', name: '전투의 비약', icon: '⚗️', price: 90, buff: 'elixir', duration: 20, mult: 1.35, key: '3', desc: '20초간 공격력 +35%' },
  ],
  // 시작 시 지급되는 포션
  starterPotions: { 'potion-hp': 1 },
};

export function shopWeaponsFor(classId) {
  return SHOP.weapons[classId] || [];
}

export function armorByTier(tier) {
  return SHOP.armors.find((a) => a.tier === tier) || null;
}

export const MAX_ARMOR_TIER = 3;

export const BOSS_POS = { x: 0, z: -165 };
export const TEMPLE_GATE = { x: 0, z: 0 };
