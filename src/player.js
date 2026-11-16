// 플레이어: 직업별 3D 리그, 이동, 절차적 애니메이션(공격/스킬/피격)
import * as THREE from 'three';
import { CLASSES, SHOP, allArmors, allPotions, MAX_ARMOR_TIER, MAX_WEAPON_TIER } from './config.js';
import { buildWeapons } from './weapons.js';
import {
  clamp, damp, dampAngle, lerp, smoothstep, terrainHeight, clampToWorld, TAU, disposeObject,
} from './utils.js';

/* ------------------------- 스태미나 · 대쉬 · 막기 ------------------------- */
// 스태미나 100칸: 대쉬 한 번에 5, 막은 한 번에 5가 빠진다. 쿨타임은 없다.
// 0 이 되면(남은 양이 5보다 작아지면) '지침' 상태가 되어 100까지 다 차야 다시 대쉬 · 막기를 쓸 수 있다.
// 회복 22/s + 사용 직후 0.35초 쉼 → 0 에서 100까지 약 4.9초.
export const STAMINA = {
  max: 100,
  dashCost: 5,
  blockCost: 5,
  regen: 22,
  regenDelay: 0.35,
  dashDuration: 0.18,   // 순간 돌진 지속 시간(초)
  blockDamageMul: 0.5,  // 막으면 받는 피해 50%
  blockMoveMul: 0.55,   // 막는 동안 이동 속도
};

// 손에 쥐는 무기의 위치·회전 (직업별)
// 무기 그룹의 원점은 곧 '손잡이를 쥔 지점'이라, p는 손 뼈의 주먹 중심(0,-0.5,0)에 거의 그대로 둔다.
// r.x = 손 안에서 무기를 앞으로 눕히는 각(π/2면 무기가 손에서 정확히 앞(+Z)을 향한다).
const WEAPON_POSE = {
  // 검: 주먹에서 앞·살짝 위(지면 기준 약 22°)로 뻗는다
  warrior: { r: { p: [0.04, -0.5, 0.1], r: [1.79, 0.35, 0.14] } },
  // 활: 왼손 가죽 손잡이를 쥐고 세워 든다 (활몸이 앞, 시위가 몸 쪽)
  archer: { l: { p: [0.05, -0.5, 0.12], r: [0.6, 0.25, -0.1] } },
  // 쌍단검: 양손 모두 앞쪽으로 낮게 겨눈다
  rogue: {
    r: { p: [0, -0.5, 0.08], r: [2.06, 0.35, 0.16] },
    l: { p: [0, -0.5, 0.08], r: [2.06, 0.35, -0.16] },
  },
  tanker: {
    // 철퇴: 자루를 쥐고 머리가 앞·위로
    r: { p: [0, -0.5, 0.08], r: [1.75, 0.35, 0.14] },
    // 방패: 앞면이 앞·바깥(왼쪽)을 향해 몸 앞을 가린다
    l: { p: [0, -0.45, 0.15], r: [0, -1.15, 0.12] },
  },
  // 지팡이: 자루 중간 아래를 쥐고 결정구가 어깨 위로 올라온다
  mage: { r: { p: [0, -0.5, 0.08], r: [1.01, 0.35, 0.12] } },
};

// 직업별 기본 서 있는 자세 (팔은 붙이지 않고 살짝 굽혀 든다)
// swingL/R = 달릴 때 그 팔이 흔들리는 비율 (무기를 든 팔은 덜 흔든다)
const STANCE = {
  warrior: { armRx: -0.22, armRz: -0.34, foreRx: -0.38, armLx: 0.02, armLz: 0.17, foreLx: -0.30, swingR: 0.55, swingL: 0.95 },
  archer: { armRx: 0.02, armRz: -0.16, foreRx: -0.34, armLx: -0.34, armLz: 0.26, foreLx: -0.26, swingR: 0.95, swingL: 0.50 },
  rogue: { armRx: -0.30, armRz: -0.30, foreRx: -0.45, armLx: -0.30, armLz: 0.30, foreLx: -0.45, swingR: 0.65, swingL: 0.65 },
  // 방패 팔은 윗팔을 살짝 뒤로 · 팔꿈치를 펴서 손목이 수직이 되게 둔다(방패가 똑바로 선다)
  tanker: { armRx: -0.30, armRz: -0.38, foreRx: -0.40, armLx: 0.20, armLz: 0.22, foreLx: -0.20, swingR: 0.50, swingL: 0.45 },
  mage: { armRx: -0.34, armRz: -0.30, foreRx: -0.28, armLx: 0.02, armLz: 0.16, foreLx: -0.30, swingR: 0.45, swingL: 0.95 },
};

// 공격/스킬 중 무기 방향(몸통 기준). [pitch, yaw] 도(°)
//   pitch: 0=수평 앞, 90=위, -90=아래 / yaw: 0=정면, +90=캐릭터 왼쪽, 180=뒤
// 표에 없는 클립은 기본 파지 자세(WEAPON_POSE)를 그대로 쓴다 → 팔 움직임을 무기가 따라간다.
const WEAPON_AIM = {
  warrior: {
    right: {
      cleave: {
        0.00: { p: 20, y: 8 },
        0.28: { p: 95, y: 35 },
        0.35: { p: 108, y: 25 },
        0.46: { p: 35, y: -25 },
        0.52: { p: 5, y: -55 },
        0.62: { p: -18, y: -65 },
        0.72: { p: 0, y: -25 },
        0.85: { p: 12, y: 0 },
        0.95: { p: 19, y: -5 },
        1.00: { p: 19, y: -5 },
      },
      whirlwind: {
        0.00: { p: 15, y: 30 },
        0.12: { p: 5, y: 60 },
        0.50: { p: 5, y: 60 },
        0.78: { p: 8, y: 55 },
        0.92: { p: 15, y: 20 },
        1.00: { p: 19, y: -5 },
      },
      dashstrike: {
        0.00: { p: 0, y: 160 },
        0.35: { p: 0, y: 165 },
        0.46: { p: 100, y: 30 },
        0.52: { p: 25, y: 0 },
        0.62: { p: -20, y: -10 },
        0.72: { p: -5, y: -5 },
        0.85: { p: 10, y: 0 },
        1.00: { p: 19, y: -5 },
      },
    },
  },
  archer: {
    left: {
      shoot: {
        0.00: { p: 82, y: 0 },
        0.30: { p: 78, y: 0 },
        0.52: { p: 76, y: 0 },
        0.62: { p: 80, y: 0 },
        0.85: { p: 82, y: 0 },
        1.00: { p: 84, y: 0 },
      },
      multishot: {
        0.00: { p: 82, y: 0 },
        0.38: { p: 78, y: 0 },
        0.50: { p: 78, y: 0 },
        0.75: { p: 81, y: 0 },
        1.00: { p: 84, y: 0 },
      },
      barrage: {
        0.00: { p: 82, y: 0 },
        0.16: { p: 80, y: 0 },
        0.34: { p: 78, y: 0 },
        0.52: { p: 78, y: 0 },
        0.84: { p: 82, y: 0 },
        1.00: { p: 84, y: 0 },
      },
    },
  },
  rogue: {
    right: {
      stab: {
        0.00: { p: 8, y: -12 },
        0.35: { p: 2, y: -8 },
        0.62: { p: 6, y: -12 },
        1.00: { p: 12, y: -10 },
      },
      ambush: {
        0.00: { p: 8, y: -12 },
        0.22: { p: -6, y: -14 },
        0.50: { p: 4, y: -10 },
        0.72: { p: 8, y: -12 },
        1.00: { p: 12, y: -10 },
      },
      flurry: {
        0.00: { p: 10, y: -12 },
        0.20: { p: 2, y: -10 },
        0.60: { p: 4, y: -12 },
        0.90: { p: 8, y: -10 },
        1.00: { p: 12, y: -10 },
      },
    },
    left: {
      stab: {
        0.00: { p: 8, y: 12 },
        0.35: { p: 2, y: 8 },
        0.62: { p: 6, y: 12 },
        1.00: { p: 12, y: 10 },
      },
      ambush: {
        0.00: { p: 8, y: 12 },
        0.22: { p: -6, y: 14 },
        0.50: { p: 4, y: 10 },
        0.72: { p: 8, y: 12 },
        1.00: { p: 12, y: 10 },
      },
      flurry: {
        0.00: { p: 10, y: 12 },
        0.20: { p: 2, y: 10 },
        0.60: { p: 4, y: 12 },
        0.90: { p: 8, y: 10 },
        1.00: { p: 12, y: 10 },
      },
    },
  },
  tanker: {
    left: {
      bash: {
        0.00: { p: 82, y: 0 },
        0.26: { p: 84, y: 0 },
        0.46: { p: 72, y: 0 },
        0.62: { p: 80, y: 0 },
        0.85: { p: 82, y: 0 },
        1.00: { p: 82, y: 0 },
      },
      shieldslam: {
        0.00: { p: 82, y: 0 },
        0.26: { p: 58, y: 0 },
        0.46: { p: 40, y: 0 },
        0.72: { p: 74, y: 0 },
        1.00: { p: 82, y: 0 },
      },
      fortress: {
        0.00: { p: 82, y: 0 },
        0.18: { p: 88, y: 0 },
        0.85: { p: 88, y: 0 },
        1.00: { p: 82, y: 0 },
      },
    },
  },
  mage: {
    right: {
      cast: {
        0.00: { p: 70, y: 6 },
        0.32: { p: 62, y: 6 },
        0.52: { p: 66, y: 6 },
        0.80: { p: 70, y: 6 },
        1.00: { p: 69, y: 10 },
      },
      explosion: {
        0.00: { p: 68, y: 10 },
        0.30: { p: 58, y: 8 },
        0.48: { p: 55, y: 6 },
        0.62: { p: 52, y: 4 },
        0.82: { p: 66, y: 8 },
        1.00: { p: 69, y: 10 },
      },
      nova: {
        0.00: { p: 69, y: 10 },
        0.40: { p: 64, y: 6 },
        0.80: { p: 66, y: 6 },
        1.00: { p: 69, y: 10 },
      },
    },
  },
};

// 조준 시 무기의 '평면' 기준: 무기 로컬 +Z가 향할 방향 (몸통 기준)
const AIM_HINT = {
  archer: { left: [-0.95, 0, 0.3] },   // 활몸이 앞, 시위가 몸 쪽
  tanker: { left: [-0.91, 0, 0.41] },  // 방패 앞면이 앞·왼쪽
};

const POSE_KEYS = [
  'bodyY', 'bodyPitch', 'bodyRoll', 'spinY',
  'torsoPitch', 'torsoYaw', 'torsoRoll',
  'headPitch', 'headYaw',
  'armLx', 'armLy', 'armLz', 'armRx', 'armRy', 'armRz',
  'foreLx', 'foreRx', 'handLx', 'handRx',
  'legLx', 'legLz', 'legRx', 'legRz', 'kneeLx', 'kneeRx',
];

const PALETTE = {
  warrior: { main: 0xb8453c, trim: 0xd8b25e, cloth: 0x3a2a26, metal: 0.35 },
  archer: { main: 0x4f7a3e, trim: 0xc9a86a, cloth: 0x2f3a2a, metal: 0.1 },
  rogue: { main: 0x4b3a63, trim: 0x9a7fd0, cloth: 0x1e1a26, metal: 0.2 },
  tanker: { main: 0x4f6f8c, trim: 0xd8b25e, cloth: 0x2a333c, metal: 0.5 },
  mage: { main: 0x6b4a8a, trim: 0xc9a0ff, cloth: 0x2a2038, metal: 0.05 },
};

// 상점 갑옷 티어별 재질감: 가죽 → 강철 → 빛나는 황금
const ARMOR_STYLE = {
  1: { plate: 0x7a5230, trim: 0x4b3320, rune: 0x2a1a0e, glow: 0, rough: 0.86, metal: 0.06 },
  2: { plate: 0xa9b2ba, trim: 0x6d7883, rune: 0xa8d8ff, glow: 0.35, rough: 0.3, metal: 0.9 },
  3: { plate: 0xd9a93a, trim: 0xf2d784, rune: 0xffe9a0, glow: 1.8, rough: 0.24, metal: 0.95 },
  // 2세계 갑옷 — 별빛 미스릴(보랏빛 룬) · 차원의 불멸(금빛 불꽃 룬)
  4: { plate: 0x8f7fd0, trim: 0xd8ccff, rune: 0xa87cff, glow: 2.1, rough: 0.24, metal: 0.96 },
  5: { plate: 0x2e2846, trim: 0xffd98a, rune: 0xff9a3c, glow: 2.9, rough: 0.18, metal: 0.98 },
};

/* 키프레임 보간: frames = [{t:0, p:{...}}, ...] */
function sampleFrames(t, frames) {
  let a = frames[0], b = frames[frames.length - 1];
  if (t <= a.t) return Object.assign({}, a.p);
  for (let i = 0; i < frames.length - 1; i++) {
    if (t >= frames[i].t && t <= frames[i + 1].t) { a = frames[i]; b = frames[i + 1]; break; }
  }
  const span = Math.max(0.0001, b.t - a.t);
  const k = smoothstep(0, 1, clamp((t - a.t) / span, 0, 1));
  const out = {};
  const keys = {};
  Object.keys(a.p).forEach((key) => { keys[key] = true; });
  Object.keys(b.p).forEach((key) => { keys[key] = true; });
  Object.keys(keys).forEach((key) => {
    const va = a.p[key] === undefined ? 0 : a.p[key];
    const vb = b.p[key] === undefined ? 0 : b.p[key];
    out[key] = lerp(va, vb, k);
  });
  return out;
}

/* ------------------------ 애니메이션 클립 정의 ------------------------ */
const CLIPS = {
  // 기본 공격
  cleave: {
    0.00: { armRx: -0.4, armRz: -0.5, foreRx: -0.3, torsoYaw: -0.1 },
    0.28: { armRx: -1.2, armRz: -1.5, foreRx: -0.7, torsoYaw: -0.55, torsoPitch: -0.1, bodyY: 0.35 },
    0.46: { armRx: -1.5, armRz: 0.35, foreRx: -0.15, torsoYaw: 0.35, torsoPitch: 0.1 },
    0.62: { armRx: -1.35, armRz: 1.15, foreRx: -0.1, torsoYaw: 0.6 },
    0.85: { armRx: -0.7, armRz: 0.2, foreRx: -0.3, torsoYaw: 0.15 },
    1.00: {},
  },
  stab: {
    0.00: { armRx: -0.5, foreRx: -0.7, torsoYaw: -0.15 },
    0.35: { armRx: -1.55, foreRx: -0.05, torsoYaw: 0.35, torsoPitch: 0.1, armRz: 0.15 },
    0.62: { armRx: -1.0, foreRx: -0.75, torsoYaw: 0.1 },
    1.00: {},
  },
  bash: {
    0.00: {},
    0.26: { armLx: -0.2, armLz: 0.25, foreLx: -1.3, torsoPitch: -0.12, bodyY: -0.35, torsoYaw: 0.25 },
    0.46: { armLx: -1.35, armLz: 0.15, foreLx: -0.25, handLx: -1.45, torsoPitch: 0.2, torsoYaw: -0.2, bodyY: 0.25 },
    0.72: { armLx: -0.85, foreLx: -0.5, handLx: -0.9 },
    1.00: {},
  },
  shoot: {
    0.00: { armLx: -1.45, armLz: 0.35, foreLx: -0.3, handLx: 1.45, armRx: -1.2, armRz: -0.25, foreRx: -1.6, torsoYaw: 0.3, headYaw: 0.08 },
    0.52: { armLx: -1.5, armLz: 0.32, foreLx: -0.2, handLx: 1.5, armRx: -1.35, armRz: -0.35, foreRx: -2.35, torsoYaw: 0.45 },
    0.62: { armLx: -1.4, armLz: 0.4, handLx: 1.4, armRx: -0.9, armRz: -0.7, foreRx: -0.3, torsoYaw: 0.2 },
    0.82: { armLx: -1.0, armRz: -0.3, foreRx: -0.5, torsoYaw: 0.1 },
    1.00: {},
  },
  cast: {
    0.00: { armRx: -0.5, foreRx: -0.5, armRz: -0.25 },
    0.32: { armRx: -1.0, foreRx: -0.9, armRz: -0.4, torsoPitch: -0.1, torsoYaw: -0.25 },
    0.52: { armRx: -1.75, foreRx: -0.05, armRz: 0.05, torsoPitch: 0.14, torsoYaw: 0.2 },
    0.8: { armRx: -1.2, foreRx: -0.4, torsoPitch: 0.05 },
    1.00: {},
  },

  // Q / E 스킬
  whirlwind: {
    0.00: { armRx: -1.3, armRz: -0.9, armLx: -1.3, armLz: 0.9, foreRx: -0.2, foreLx: -0.2 },
    0.12: { spinY: -0.5, armRx: -1.45, armRz: -1.45, armLx: -1.45, armLz: 1.45, torsoPitch: 0.05 },
    0.5: { spinY: -3.6, armRx: -1.45, armRz: -1.5, armLx: -1.45, armLz: 1.5 },
    0.78: { spinY: -6.0, armRx: -1.2, armRz: -1.2, armLx: -1.2, armLz: 1.2, torsoPitch: 0.15 },
    1.00: { spinY: -6.2832, armRx: -0.6, armRz: -0.5, armLx: -0.6, armLz: 0.5 },
  },
  dashstrike: {
    0.00: { armRx: -2.8, armRz: -0.15, foreRx: -0.5, torsoPitch: -0.22, bodyY: 0.2 },
    0.35: { armRx: -3.0, armRz: -0.1, foreRx: -0.6, torsoPitch: -0.28, bodyPitch: 0.25, legLx: -0.7, legRx: 0.5 },
    0.58: { armRx: -1.1, armRz: 0.1, foreRx: -0.1, torsoPitch: 0.34, bodyPitch: 0.1, kneeLx: 0.8, kneeRx: 0.8, bodyY: -0.6 },
    0.8: { armRx: -0.8, foreRx: -0.3, torsoPitch: 0.2 },
    1.00: {},
  },
  multishot: {
    0.00: { armLx: -1.4, armLz: 0.35, handLx: 1.4, armRx: -1.3, armRz: -0.35, foreRx: -1.7, torsoYaw: 0.35 },
    0.38: { armLx: -1.5, armLz: 0.3, handLx: 1.5, armRx: -1.4, armRz: -0.45, foreRx: -2.45, torsoYaw: 0.5, torsoPitch: -0.05 },
    0.48: { armLx: -1.35, armLz: 0.42, handLx: 1.35, armRx: -0.95, armRz: -0.75, foreRx: -0.25, torsoYaw: 0.15 },
    0.75: { armLx: -1.0, armRz: -0.3, foreRx: -0.5, torsoYaw: 0.05 },
    1.00: {},
  },
  barrage: {
    0.00: { kneeLx: 0.3, kneeRx: 0.3 },
    0.16: { kneeLx: 1.1, kneeRx: 1.1, bodyY: -1.4, torsoPitch: 0.3, armLx: -0.6, armRx: -0.6 },
    0.34: { legLx: -0.9, legRx: -0.7, kneeLx: 0.5, kneeRx: 0.4, armLx: -2.5, armRz: -0.6, armRx: -2.2, torsoPitch: -0.15, bodyY: 1.2 },
    0.52: { legLx: -0.4, legRx: -0.2, kneeLx: 0.9, kneeRx: 0.9, armLx: -1.4, handLx: 1.4, foreRx: -2.2, armRx: -1.3, torsoPitch: 0.25, bodyY: -0.8 },
    0.68: { armLx: -1.45, handLx: 1.45, foreRx: -1.9, armRx: -1.3, torsoPitch: 0.1 },
    0.84: { armLx: -1.1, foreRx: -0.4, armRx: -0.8, torsoPitch: 0.05 },
    1.00: {},
  },
  ambush: {
    0.00: { kneeLx: 0.9, kneeRx: 0.9, bodyY: -0.9, torsoPitch: 0.35, armRx: -0.7, armLx: -0.7 },
    0.22: { armRx: -0.2, armRz: -1.3, armLx: 0.2, armLz: 1.2, foreRx: -0.3, legLx: -0.7, legRx: 0.6, bodyPitch: 0.35, torsoPitch: 0.3 },
    0.5: { armRx: -1.7, armRz: 0.3, foreRx: 0.05, torsoYaw: 0.45, torsoPitch: 0.12, bodyPitch: 0.05, kneeLx: 0.5, kneeRx: 0.3 },
    0.72: { armRx: -1.2, foreRx: -0.5, torsoYaw: 0.2 },
    1.00: {},
  },
  flurry: {
    0.00: {},
    0.10: { armRx: -1.65, armRz: 0.15, foreRx: 0.0, torsoYaw: -0.3 },
    0.20: { armRx: -0.9, foreRx: -0.8, torsoYaw: -0.1 },
    0.30: { armLx: -1.65, armLz: -0.15, foreLx: 0.0, torsoYaw: 0.3 },
    0.40: { armLx: -0.9, foreLx: -0.8, torsoYaw: 0.1 },
    0.50: { armRx: -1.7, armRz: 0.2, foreRx: 0.0, torsoYaw: -0.35 },
    0.60: { armRx: -0.8, foreRx: -0.85, torsoYaw: -0.15 },
    0.70: { armLx: -1.7, armLz: -0.2, foreLx: 0.0, torsoYaw: 0.35 },
    0.80: { armLx: -0.85, foreLx: -0.8, torsoYaw: 0.15 },
    0.90: { armRx: -1.5, foreRx: -0.2, torsoYaw: -0.2 },
    1.00: {},
  },
  shieldslam: {
    0.00: {},
    0.26: { armLx: -2.7, armLz: 0.25, foreLx: -0.3, handLx: 0.6, torsoPitch: -0.22, bodyY: 0.6, armRx: -0.9 },
    0.46: { armLx: -0.35, armLz: 0.1, foreLx: -1.5, handLx: -0.4, torsoPitch: 0.38, bodyY: -1.0, kneeLx: 0.8, kneeRx: 0.8 },
    0.72: { armLx: -0.25, foreLx: -0.8, torsoPitch: 0.18, bodyY: -0.2 },
    1.00: {},
  },
  fortress: {
    0.00: {},
    0.18: { armLx: -1.55, armLz: 1.05, foreLx: -1.35, armRx: -1.55, armRz: -1.05, foreRx: -1.35, torsoPitch: -0.12, bodyY: 0.5, headPitch: -0.1 },
    0.85: { armLx: -1.5, armLz: 1.0, foreLx: -1.3, armRx: -1.5, armRz: -1.0, foreRx: -1.3, torsoPitch: -0.1, bodyY: 0.45 },
    1.00: {},
  },
  explosion: {
    0.00: {},
    0.3: { armRx: -2.9, armRz: -0.2, foreRx: -0.45, torsoPitch: -0.26, bodyY: 0.6, headPitch: -0.15 },
    0.48: { armRx: -2.6, foreRx: -0.3 },
    0.62: { armRx: -1.5, armRz: 0.05, foreRx: -0.05, torsoPitch: 0.28, bodyY: -0.2 },
    0.82: { armRx: -1.15, foreRx: -0.35, torsoPitch: 0.1 },
    1.00: {},
  },
  nova: {
    0.00: {},
    0.2: { armRx: -1.5, armRz: -1.1, armLx: -1.4, armLz: 1.1, torsoPitch: -0.16, bodyY: 0.55, headPitch: -0.12 },
    0.5: { armRz: -1.35, armLz: 1.35, armRx: -1.3, armLx: -1.2, torsoPitch: -0.05, spinY: -3.0 },
    0.8: { armRz: -1.1, armLz: 1.1, armRx: -1.5, armLx: -1.4, torsoPitch: -0.1, spinY: -6.0 },
    1.00: { spinY: -6.2832 },
  },
  death: {
    0.00: {},
    0.35: { bodyPitch: -0.5, kneeLx: 1.2, kneeRx: 1.2, torsoPitch: 0.4, bodyY: -1.6 },
    1.00: { bodyPitch: -1.5, kneeLx: 1.4, kneeRx: 1.4, bodyY: -3.0, torsoPitch: 0.5 },
  },
};

function toFrames(obj) {
  return Object.keys(obj).map((k) => ({ t: parseFloat(k), p: obj[k] })).sort((a, b) => a.t - b.t);
}

const FRAMES = {};
Object.keys(CLIPS).forEach((k) => { FRAMES[k] = toFrames(CLIPS[k]); });

const AIM_FRAMES = {};
Object.keys(WEAPON_AIM).forEach((cid) => {
  AIM_FRAMES[cid] = {};
  Object.keys(WEAPON_AIM[cid]).forEach((side) => {
    AIM_FRAMES[cid][side] = {};
    Object.keys(WEAPON_AIM[cid][side]).forEach((clip) => {
      AIM_FRAMES[cid][side][clip] = toFrames(WEAPON_AIM[cid][side][clip]);
    });
  });
});

// 캐릭터 기준 (pitch, yaw) 방향으로 무기를 세우는 쿼터니언
const _aimAxis = new THREE.Vector3();
const _aimZ = new THREE.Vector3();
const _aimX = new THREE.Vector3();
const _aimRef = new THREE.Vector3();
const _aimMat = new THREE.Matrix4();
const _qTorso = new THREE.Quaternion();
const _qArm = new THREE.Quaternion();
const _qFore = new THREE.Quaternion();
const _qHand = new THREE.Quaternion();
function aimQuaternion(pitchDeg, yawDeg, hint) {
  const pitch = (pitchDeg * Math.PI) / 180;
  const yaw = (yawDeg * Math.PI) / 180;
  _aimAxis.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
  _aimRef.set(hint[0], hint[1], hint[2]);
  if (Math.abs(_aimAxis.dot(_aimRef)) > 0.98) _aimRef.set(0, 1, 0);
  _aimZ.copy(_aimRef).addScaledVector(_aimAxis, -_aimAxis.dot(_aimRef));
  if (_aimZ.lengthSq() < 1e-5) _aimZ.set(0, 0, 1);
  _aimZ.normalize();
  _aimX.crossVectors(_aimAxis, _aimZ).normalize();
  _aimMat.makeBasis(_aimX, _aimAxis, _aimZ);
  return new THREE.Quaternion().setFromRotationMatrix(_aimMat);
}

export class Player {
  constructor(game, classId) {
    this.game = game;
    this.classId = classId;
    this.cls = CLASSES[classId];
    this.stance = STANCE[classId] || STANCE.warrior;
    this.level = 1;
    this.maxHp = this.cls.hp;
    this.hp = this.maxHp;
    this.baseDamage = this.cls.damage;
    this.weaponTier = 0;
    this.weaponBonus = 0;
    this.weaponName = this.cls.weaponName.split(' ')[0];
    // 갑옷: 0 = 맨몸(기본 모험가 복장), 1 ~ 3 = 1세계 상점 갑옷, 4 ~ 5 = 2세계 상점 갑옷
    this.armorTier = 0;
    this.armorDefense = 0;
    this.armorBonusHp = 0;
    this.armorName = '';
    this.critChance = this.cls.critChance;
    this.potions = Object.assign({}, SHOP.starterPotions);
    this.xp = 0;
    this.xpNext = 70;
    this.state = 'alive';
    this.radius = 4.6;

    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.vy = 0;
    this.grounded = true;
    this.speedNow = 0;
    this.facing = 0;
    this.time = 0;
    this.walkPhase = 0;
    this.comboIndex = 0;

    this.attackCooldown = 0;
    this.cooldowns = { q: 0, e: 0 };
    this.buffs = { fortress: 0, haste: 0, frost: 0, elixir: 0, rage: 0, guard: 0 };
    this.invuln = 0;
    this.dash = null;
    // 스태미나 · 대쉬 · 막기 상태
    this.maxStamina = STAMINA.max;
    this.stamina = this.maxStamina;
    this.staminaExhausted = false;
    this.staminaRegenDelay = 0;
    this.blocking = false;      // 입력으로 막기를 누르고 있는지
    this.blockFlash = 0;        // 막은 순간의 반짝임
    this._dashDenyAt = -9;
    this.lastWish = new THREE.Vector3();   // 마지막 이동 입력 방향 (대쉬 방향)
    this.anim = { name: null, time: 0, duration: 1 };
    this.aimLock = 0;
    this.timers = [];

    this.pose = {};
    this.target = {};
    POSE_KEYS.forEach((k) => { this.pose[k] = 0; this.target[k] = 0; });

    this.hurtTint = 0;
    this.kills = 0;
    this.build();
  }

  /* -------------------------------- 리그 -------------------------------- */
  build() {
    const pal = PALETTE[this.classId];
    const skin = new THREE.MeshStandardMaterial({ color: 0xe6bb98, roughness: 0.75 });
    this.skinMat = skin;
    // 기본 의상(모험가 튜닉) — 갑옷이 아닌 천 소재
    this.tunicMat = new THREE.MeshStandardMaterial({ color: pal.main, roughness: 0.9, metalness: 0.0, emissive: 0x000000 });
    this.tunicDarkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pal.main).multiplyScalar(0.7), roughness: 0.94, metalness: 0.0, emissive: 0x000000 });
    this.bootMat = new THREE.MeshStandardMaterial({ color: 0x3b2f26, roughness: 1, emissive: 0x000000 });
    this.strapMat = new THREE.MeshStandardMaterial({ color: 0x513c28, roughness: 0.9, emissive: 0x000000 });
    // 갑옷 재질 (Tier 1 ~ 3 에서 다시 만든다)
    this.armorMat = new THREE.MeshStandardMaterial({ color: pal.main, roughness: 0.62, metalness: pal.metal, emissive: 0x000000 });
    this.armorDarkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pal.main).multiplyScalar(0.6), roughness: 0.75, metalness: pal.metal * 0.8, emissive: 0x000000 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: pal.trim, roughness: 0.35, metalness: 0.75, emissive: 0x000000 });
    this.clothMat = new THREE.MeshStandardMaterial({ color: pal.cloth, roughness: 0.95, emissive: 0x000000 });
    this.tintMats = [this.tunicMat, this.tunicDarkMat, this.clothMat, this.bootMat, this.strapMat];

    const mk = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const hipY = 8.6;

    // 다리
    this.legL = new THREE.Group();
    this.legL.position.set(1.95, hipY, 0);
    this.legR = new THREE.Group();
    this.legR.position.set(-1.95, hipY, 0);
    this.kneeL = new THREE.Group();
    this.kneeL.position.set(0, -4.3, 0);
    this.kneeR = new THREE.Group();
    this.kneeR.position.set(0, -4.3, 0);
    this.legL.add(mk(new THREE.BoxGeometry(2.1, 4.5, 2.5), this.clothMat, 0, -2.2, 0));
    this.legR.add(mk(new THREE.BoxGeometry(2.1, 4.5, 2.5), this.clothMat, 0, -2.2, 0));
    this.kneeL.add(mk(new THREE.BoxGeometry(1.95, 3.7, 2.3), this.clothMat, 0, -1.85, 0));
    this.kneeR.add(mk(new THREE.BoxGeometry(1.95, 3.7, 2.3), this.clothMat, 0, -1.85, 0));
    this.kneeL.add(mk(new THREE.BoxGeometry(2.3, 1.5, 3.4), this.bootMat, 0, -3.75, 0.5));
    this.kneeR.add(mk(new THREE.BoxGeometry(2.3, 1.5, 3.4), this.bootMat, 0, -3.75, 0.5));
    this.legL.add(this.kneeL);
    this.legR.add(this.kneeR);
    this.body.add(this.legL, this.legR);

    // 상체
    // 상체 — 갑옷 없는 기본 튜닉
    this.torso = new THREE.Group();
    this.torso.position.set(0, hipY, 0);
    this.body.add(this.torso);
    this.torso.add(mk(new THREE.BoxGeometry(7.4, 6.8, 3.9), this.tunicMat, 0, 3.3, 0));
    // 튜닉 옷자락 · 허리끈(천) — 갑옷 벨트가 아니다
    this.torso.add(mk(new THREE.BoxGeometry(7.9, 1.8, 4.1), this.tunicDarkMat, 0, 0.5, 0));
    this.torso.add(mk(new THREE.BoxGeometry(7.6, 0.9, 4.15), this.strapMat, 0, 1.9, 0));
    // 깃 · 목둘레
    this.torso.add(mk(new THREE.BoxGeometry(4.6, 1.0, 0.6), this.tunicDarkMat, 0, 6.5, 1.85));
    this.torso.add(mk(new THREE.BoxGeometry(2.0, 2.4, 0.5), this.tunicDarkMat, 0, 4.6, 1.95));

    // 팔
    this.armL = new THREE.Group();
    this.armL.position.set(4.4, 5.9, 0);
    this.armR = new THREE.Group();
    this.armR.position.set(-4.4, 5.9, 0);
    this.foreL = new THREE.Group();
    this.foreL.position.set(0, -3.5, 0);
    this.foreR = new THREE.Group();
    this.foreR.position.set(0, -3.5, 0);
    this.handL = new THREE.Group();
    this.handL.position.set(0, -3.2, 0);
    this.handR = new THREE.Group();
    this.handR.position.set(0, -3.2, 0);

    for (const arm of [this.armL, this.armR]) {
      arm.add(mk(new THREE.BoxGeometry(2.0, 3.6, 2.1), this.tunicMat, 0, -1.75, 0));
    }
    for (const fore of [this.foreL, this.foreR]) {
      fore.add(mk(new THREE.BoxGeometry(1.85, 3.2, 1.95), this.skinMat, 0, -1.6, 0));
      fore.add(mk(new THREE.BoxGeometry(1.95, 0.8, 2.05), this.tunicDarkMat, 0, -0.35, 0));
    }
    this.handL.add(mk(new THREE.BoxGeometry(1.8, 1.4, 1.9), skin, 0, -0.5, 0));
    this.handR.add(mk(new THREE.BoxGeometry(1.8, 1.4, 1.9), skin, 0, -0.5, 0));
    this.foreL.add(this.handL);
    this.foreR.add(this.handR);
    this.armL.add(this.foreL);
    this.armR.add(this.foreR);
    this.torso.add(this.armL, this.armR);

    // 머리
    this.head = new THREE.Group();
    this.head.position.set(0, 6.9, 0);
    this.torso.add(this.head);
    this.head.add(mk(new THREE.CylinderGeometry(1.2, 1.5, 1.0, 8), skin, 0, 0.3, 0));
    this.head.add(mk(new THREE.BoxGeometry(3.9, 3.9, 3.8), skin, 0, 2.3, 0));
    // 눈
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x20242c });
    for (const s of [-1, 1]) {
      this.head.add(mk(new THREE.BoxGeometry(0.55, 0.75, 0.3), eyeMat, s * 0.85, 2.5, 1.92));
    }
    this.addHeadgear(mk);

    // 갑옷 (Tier 0 = 없음)
    this.armorChest = null;
    this.armorBracerL = null;
    this.armorBracerR = null;
    this.armorMats = [];

    // 무기 (손 위치에서 몸 바깥쪽으로 기울여 어깨 견갑에 가리지 않게)
    this.equipWeaponTier(0, true);

    // 그림자 접지
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.buildGuardAura();
    this.game.scene.add(this.root);
  }

  /* --------------------------- 막기 방어막 (3D) --------------------------- */
  // 막는 동안 가슴 앞에 반투명 방어막이 떠오른다 (그림자는 만들지 않는다)
  buildGuardAura() {
    const geo = new THREE.CircleGeometry(12, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fe8ff, transparent: true, opacity: 0.2, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 3.4, 4.6);
    mesh.rotation.set(-0.12, 0, 0);
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const ringGeo = new THREE.TorusGeometry(12, 0.38, 6, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xd8f6ff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.castShadow = false;
    ring.receiveShadow = false;
    mesh.add(ring);
    this.torso.add(mesh);
    this.guardMesh = mesh;
    this.guardMat = mat;
    this.guardRingMat = ringMat;
  }

  /* --------------------------- 무기 교체 --------------------------- */
  // tier 0 = 기본 장비, 1 = 1세계 Tier 2, 2 = 1세계 Tier 3,
  // 3 = 2세계 Tier 4, 4 = 2세계 Tier 5 — 손의 무기 메시를 새로 만들어 갈아끼운다
  equipWeaponTier(tier, initial) {
    const t = clamp(Math.round(tier || 0), 0, MAX_WEAPON_TIER);
    const old = this.weapons;
    if (old && !initial) {
      for (const side of ['right', 'left']) {
        const w = old[side];
        if (!w) continue;
        if (w.parent) w.parent.remove(w);
        disposeObject(w);
      }
    }
    const w = buildWeapons(this.classId, t);
    const wp = WEAPON_POSE[this.classId] || {};
    this.weaponBase = { right: [0, 0, 0], left: [0, 0, 0] };
    if (w.right) {
      const cfg = wp.r || { p: [0, -0.5, 0.05], r: [0, 0, 0] };
      w.right.position.set(cfg.p[0], cfg.p[1], cfg.p[2]);
      w.right.rotation.set(cfg.r[0], cfg.r[1], cfg.r[2]);
      this.weaponBase.right = cfg.r.slice();
      this.handR.add(w.right);
    }
    if (w.left) {
      const cfg = wp.l || { p: [0, -0.5, 0.05], r: [0, 0, 0] };
      w.left.position.set(cfg.p[0], cfg.p[1], cfg.p[2]);
      w.left.rotation.set(cfg.r[0], cfg.r[1], cfg.r[2]);
      this.weaponBase.left = cfg.r.slice();
      this.handL.add(w.left);
    }
    this.weapons = w;
    this.weaponTier = t;
    return w;
  }

  addHeadgear(mk) {
    // 기본은 갑옷이 아니라 천/가죽 소품 — 투구가 아닌 모자 · 머리띠
    if (this.classId === 'warrior') {
      this.head.add(mk(new THREE.BoxGeometry(4.15, 0.9, 4.05), this.strapMat, 0, 3.35, 0));
      this.head.add(mk(new THREE.SphereGeometry(0.95, 8, 6), this.tunicDarkMat, 0, 3.1, -2.25));
      this.head.add(mk(new THREE.BoxGeometry(1.1, 0.7, 0.5), this.tunicDarkMat, 0, 2.9, 2.0));
    } else if (this.classId === 'archer') {
      const hood = mk(new THREE.SphereGeometry(2.3, 10, 8), this.clothMat, 0, 2.9, -0.3);
      hood.scale.set(1.05, 0.9, 1.05);
      this.head.add(hood);
      this.head.add(mk(new THREE.ConeGeometry(1.1, 2.2, 6), this.clothMat, 0, 4.9, -1.4));
    } else if (this.classId === 'rogue') {
      this.head.add(mk(new THREE.SphereGeometry(2.2, 10, 8), this.clothMat, 0, 3.1, -0.2));
      this.head.add(mk(new THREE.BoxGeometry(3.5, 1.4, 0.5), this.clothMat, 0, 1.6, 1.95));
      this.head.add(mk(new THREE.BoxGeometry(3.8, 0.5, 0.6), this.strapMat, 0, 2.2, 1.9));
    } else if (this.classId === 'tanker') {
      this.head.add(mk(new THREE.BoxGeometry(4.1, 1.7, 3.95), this.strapMat, 0, 3.95, 0));
      this.head.add(mk(new THREE.BoxGeometry(4.35, 0.8, 4.15), this.tunicDarkMat, 0, 3.05, 0));
      this.head.add(mk(new THREE.BoxGeometry(0.9, 1.4, 0.5), this.tunicMat, 0, 2.4, 2.0));
    } else if (this.classId === 'mage') {
      this.head.add(mk(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 12), this.clothMat, 0, 4.2, 0));
      this.head.add(mk(new THREE.ConeGeometry(2.1, 4.6, 10), this.clothMat, 0, 6.6, -0.2));
      this.head.add(mk(new THREE.SphereGeometry(0.45, 8, 6), this.trimMat, 0, 8.6, -0.2));
    }
  }

  /* ---------------------- 갑옷 (상점) 장착 · 3D 표시 ---------------------- */
  // tier 0 = 없음(기본 복장), 1 = 가죽, 2 = 강철 판금, 3 = 황금 수호,
  // 4 = 미스릴 성기사, 5 = 차원의 불멸 (2세계)
  equipArmorTier(tier) {
    const t = clamp(Math.round(tier || 0), 0, MAX_ARMOR_TIER);
    const def = allArmors().find((a) => a.tier === t) || null;
    const nextHp = def ? def.hp : 0;
    const prevHp = this.armorBonusHp || 0;
    this.armorTier = t;
    this.armorDefense = def ? def.defense : 0;
    this.armorBonusHp = nextHp;
    this.armorName = def ? def.name : '';
    if (nextHp !== prevHp) {
      this.maxHp += nextHp - prevHp;
      if (nextHp > prevHp) this.hp = Math.min(this.maxHp, this.hp + (nextHp - prevHp));
      else this.hp = Math.min(this.hp, this.maxHp);
    }
    this.buildArmor(t);
    if (this.game && this.game.hud && typeof this.game.hud.refreshBars === 'function') this.game.hud.refreshBars();
    return def;
  }

  buildArmor(tier) {
    const strip = (g, parent) => {
      if (!g) return;
      if (parent) parent.remove(g);
      disposeObject(g);
    };
    strip(this.armorChest, this.torso);
    strip(this.armorBracerL, this.foreL);
    strip(this.armorBracerR, this.foreR);
    this.armorChest = null;
    this.armorBracerL = null;
    this.armorBracerR = null;
    if (!tier) return;

    const style = ARMOR_STYLE[tier] || ARMOR_STYLE[1];
    const plate = new THREE.MeshStandardMaterial({ color: style.plate, roughness: style.rough, metalness: style.metal });
    const trim = new THREE.MeshStandardMaterial({ color: style.trim, roughness: Math.max(0.15, style.rough * 0.65), metalness: Math.min(1, style.metal + 0.3) });
    const glow = new THREE.MeshStandardMaterial({
      color: style.rune, emissive: style.rune, emissiveIntensity: style.glow,
      roughness: 0.3, metalness: 0.4,
    });

    const chest = new THREE.Group();
    this.torso.add(chest);
    this.armorChest = chest;
    const add = (g, geo, mat, x, y, z, rot, scl) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
      if (scl) m.scale.set(scl[0], scl[1], scl[2]);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const slim = tier === 1 ? 0.94 : 1;
    const hi = tier >= 3;          // 룬 · 발광 장식을 두르는 상위 갑옷
    const mythic = tier >= 4;      // 2세계 갑옷은 견갑 · 룬이 한 단계 더 크다

    // 흉갑 · 목 가리개 · 허리대
    add(chest, new THREE.BoxGeometry(8.2 * slim, 5.9 * slim, 4.6 * slim), plate, 0, 3.5, 0);
    add(chest, new THREE.BoxGeometry(5.9 * slim, 1.2, 4.65 * slim), trim, 0, 6.6, 0);
    add(chest, new THREE.BoxGeometry(8.35 * slim, 1.6, 4.7 * slim), trim, 0, 0.95, 0);
    add(chest, new THREE.BoxGeometry(1.9, 1.5, 0.5), trim, 0, 0.95, 2.45);

    // 가슴 장식 · 룬
    if (tier === 1) {
      add(chest, new THREE.BoxGeometry(7.6 * slim, 1.0, 0.4), trim, 0, 4.7, 2.15, [0, 0, 0.62]);
      add(chest, new THREE.BoxGeometry(7.6 * slim, 1.0, 0.4), trim, 0, 4.7, 2.15, [0, 0, -0.62]);
    } else {
      add(chest, new THREE.BoxGeometry(4.0, 2.6, 0.5), trim, 0, 4.3, 2.3);
      add(chest, new THREE.BoxGeometry(1.7, 1.7, 0.45), glow, 0, 4.3, 2.62, [0, 0, Math.PI / 4]);
      if (hi) {
        add(chest, new THREE.SphereGeometry(1.0, 10, 8), glow, 0, 4.3, 2.75);
        add(chest, new THREE.BoxGeometry(2.0, 0.5, 0.4), glow, 0, 1.0, 2.5);
      }
      if (mythic) {
        // 2세계 갑옷: 가슴 한가운데의 큰 문장 + 어깨로 뻗는 빛줄기
        add(chest, new THREE.BoxGeometry(6.2, 0.5, 0.4), glow, 0, 5.6, 2.4, [0, 0, 0.5]);
        add(chest, new THREE.BoxGeometry(6.2, 0.5, 0.4), glow, 0, 5.6, 2.4, [0, 0, -0.5]);
        add(chest, new THREE.OctahedronGeometry(1.25, 0), glow, 0, 4.3, 2.8);
      }
    }

    // 어깨 견갑 (티어가 높을수록 크고 두꺼움)
    const padR = tier === 1 ? 2.15 : tier === 2 ? 2.65 : (mythic ? 3.1 : 2.8);
    for (const s of [-1, 1]) {
      const pad = add(chest, new THREE.SphereGeometry(padR, 11, 9), plate, s * 4.55, 5.9, 0, null, [1, 0.86, 1.05]);
      pad.rotation.z = s * 0.08;
      add(chest, new THREE.BoxGeometry(padR * 1.9, 0.55, padR * 2.0), trim, s * 4.55, 5.9 - padR * 0.72, 0);
      if (hi) add(chest, new THREE.SphereGeometry(0.55, 8, 6), glow, s * 5.7, 6.5, 0);
      if (mythic) {
        const spike = add(chest, new THREE.ConeGeometry(0.85, 2.6, 5), trim, s * 5.9, 8.0, -0.4);
        spike.rotation.z = -s * 0.35;
      }
    }

    // 팔 보호대
    const bracer = (parent) => {
      const g = new THREE.Group();
      parent.add(g);
      add(g, new THREE.BoxGeometry(2.15, 2.5, 2.3), plate, 0, -1.95, 0);
      add(g, new THREE.BoxGeometry(2.3, 0.6, 2.4), trim, 0, -0.85, 0);
      if (hi) add(g, new THREE.BoxGeometry(0.5, 0.5, 2.42), glow, 0, -1.95, 0);
      return g;
    };
    this.armorBracerL = bracer(this.foreL);
    this.armorBracerR = bracer(this.foreR);
    this.armorMats = [plate, trim, glow].map((m) => {
      m.userData.baseEmissive = m.emissive.clone();
      return m;
    });
  }

  /* ------------------------------ 상태 API ------------------------------ */
  get alive() { return this.state === 'alive'; }
  // 기본 공격력 + 장비 보너스 · 전투의 비약(+35%) · 광폭의 영약(+60%)
  get damage() {
    let base = this.baseDamage + this.weaponBonus;
    if (this.buffs) {
      if (this.buffs.elixir > 0) base *= 1.35;
      if (this.buffs.rage > 0) base *= 1.6;
    }
    return base;
  }
  set damage(v) { this.baseDamage = v; }
  get moveSpeed() {
    let s = this.cls.speed;
    if (this.buffs.haste > 0) s *= 1.3;
    return s;
  }

  forward() {
    return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  /* ------------------- 스태미나 · 대쉬 · 막기 API ------------------- */
  // 지금 실제로 방어하고 있는지: 막기 입력 + 살아 있음 + 지치지 않음 + 스태미나 5 이상 + 돌진 중 아님
  get isBlocking() {
    return !!this.blocking && this.alive && !this.staminaExhausted
      && this.stamina >= STAMINA.blockCost && !this.dash;
  }

  // 돌진 중인지 (친구 화면 · 자세 · HUD 에 쓰인다)
  get dashing() { return !!this.dash; }

  // 대쉬를 쓸 수 있는지 (쿨타임은 없다 — 스태미나와 지침 상태만 본다)
  get dashReady() {
    return this.alive && !this.staminaExhausted && this.stamina >= STAMINA.dashCost;
  }

  // 대쉬 방향: 지금 누르고 있는 이동 방향, 서 있으면 몸이 보는 방향
  dashDirection() {
    const w = this.lastWish;
    if (w && w.lengthSq() > 0.01) return new THREE.Vector3(w.x, 0, w.z).normalize();
    return this.forward();
  }

  // 대쉬 — 스태미나 5를 쓰고 0.18초 동안 그 방향으로 확 내닫는다 (쿨타임 없음, 연속 사용 가능)
  tryDash() {
    if (!this.alive) return { ok: false, reason: 'dead' };
    // 스킬 돌진(돌진 일격 · 화살비 · 그림자 습격) 중에는 겹치지 않는다
    if (this.dash && this.dash.kind !== 'burst') return { ok: false, reason: 'busy' };
    if (this.staminaExhausted) { this.denyDash(); return { ok: false, reason: 'exhausted' }; }
    if (this.stamina < STAMINA.dashCost) { this.denyDash(); return { ok: false, reason: 'stamina' }; }

    const dir = this.dashDirection();
    this.spendStamina(STAMINA.dashCost);
    const distance = clamp(this.cls.speed * 1.9, 96, 150);
    this.dash = { dir, distance, duration: STAMINA.dashDuration, time: 0, progress: 0, kind: 'burst' };
    this.velocity.set(0, 0, 0);
    this.speedNow = Math.max(this.speedNow, this.cls.speed * 1.4);
    if (this.game.sfx && this.game.sfx.dash) this.game.sfx.dash();
    if (this.game.effects) {
      this.game.effects.dashStreak(this.position, this.facing, this.cls.color);
      this.game.effects.burst(
        new THREE.Vector3(this.position.x - dir.x * 9, this.position.y + 3, this.position.z - dir.z * 9),
        0xe8dcc0, 10, { power: 18, size: 0.5, duration: 0.4, gravity: 20 },
      );
    }
    return { ok: true, stamina: this.stamina };
  }

  // 스태미나 소모 — 5보다 적게 남으면 지침 상태가 되어 100까지 다 차야 풀린다
  spendStamina(cost) {
    const before = this.stamina;
    this.stamina = Math.max(0, this.stamina - cost);
    this.staminaRegenDelay = STAMINA.regenDelay;
    if (this.stamina < STAMINA.dashCost && !this.staminaExhausted) this.exhaustStamina();
    return before - this.stamina;
  }

  exhaustStamina() {
    this.staminaExhausted = true;
    this.blockFlash = 0;
    if (this.game.hud && this.game.hud.banner) {
      this.game.hud.banner('스태미나 소진! 회복될 때까지 대쉬 · 막기 불가', 2200);
    }
    if (this.game.sfx && this.game.sfx.staminaOut) this.game.sfx.staminaOut();
    if (this.game.effects) {
      this.game.effects.ring(this.position, 0xff8a4a, 34, { duration: 0.55, yOffset: 12 });
    }
  }

  // 지쳐서 대쉬를 못 쓸 때 — 왜 안 되는지 작게 알려 준다 (연타에 시끄럽지 않게 0.55초에 한 번)
  denyDash() {
    if (this.time - this._dashDenyAt < 0.55) return;
    this._dashDenyAt = this.time;
    if (this.game.sfx && this.game.sfx.dashDeny) this.game.sfx.dashDeny();
    if (this.game.hud && this.game.hud.floater) this.game.hud.floater('스태미나 회복 중…', this.position, 'stam', 2.1);
  }

  updateStamina(dt) {
    if (this.staminaRegenDelay > 0) {
      this.staminaRegenDelay = Math.max(0, this.staminaRegenDelay - dt);
    } else if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA.regen * dt);
    }
    // 100까지 다 차면 지침이 풀리고 다시 대쉬 · 막기를 쓸 수 있다
    if (this.staminaExhausted && this.stamina >= this.maxStamina - 1e-6) {
      this.staminaExhausted = false;
      if (this.game.sfx && this.game.sfx.staminaReady) this.game.sfx.staminaReady();
      if (this.game.hud && typeof this.game.hud.staminaReady === 'function') this.game.hud.staminaReady();
    }
    if (this.blockFlash > 0) this.blockFlash = Math.max(0, this.blockFlash - dt);
  }

  // 막기 방어막 표시 · 막은 순간의 반짝임
  updateGuardFx() {
    const m = this.guardMesh;
    if (!m) return;
    const on = this.isBlocking;
    m.visible = on;
    if (!on) return;
    const flash = this.blockFlash > 0 ? this.blockFlash / 0.3 : 0;
    this.guardMat.opacity = clamp(0.16 + Math.sin(this.time * 9) * 0.05 + flash * 0.35, 0.05, 0.85);
    this.guardRingMat.opacity = clamp(0.3 + Math.sin(this.time * 7) * 0.1 + flash * 0.5, 0.1, 0.95);
    m.scale.setScalar(1 + flash * 0.16);
  }

  spawnAt(x, z) {
    this.anim.name = null;
    this.anim.time = 0;
    this.dash = null;
    // 다시 일어나면 스태미나도 가득 찬 상태로 시작한다
    this.stamina = this.maxStamina;
    this.staminaExhausted = false;
    this.staminaRegenDelay = 0;
    this.blocking = false;
    this.blockFlash = 0;
    this._dashDenyAt = -9;
    this.buffs.fortress = 0;
    this.buffs.haste = 0;
    this.buffs.frost = 0;
    this.buffs.elixir = 0;
    this.buffs.rage = 0;
    this.buffs.guard = 0;
    this.attackCooldown = 0;
    this.cooldowns.q = 0;
    this.cooldowns.e = 0;
    this.position.set(x, terrainHeight(x, z), z);
    this.vy = 0;
    this.grounded = true;
    this.root.position.copy(this.position);
    this.state = 'alive';
    this.hp = this.maxHp;
    this.invuln = 0.6;
    this.facing = Math.PI / 2;
    this.root.rotation.y = this.facing;
    this.pose.bodyPitch = 0;
    this.pose.spinY = 0;
    this.root.scale.setScalar(1);
  }

  playAnim(name, duration) {
    if (!FRAMES[name]) return;
    this.anim.name = name;
    this.anim.time = 0;
    this.anim.duration = duration || 0.6;
  }

  after(seconds, fn) { this.game.after(seconds, fn); }

  attack() {
    if (!this.alive) return;
    if (this.attackCooldown > 0) return;
    if (this.anim.name && this.anim.name !== this.cls.attackAnim) return;
    const cls = this.cls;
    this.attackCooldown = cls.attackInterval;
    this.comboIndex++;
    this.playAnim(cls.attackAnim, cls.attackInterval);
    this.aimLock = Math.max(this.aimLock, cls.attackInterval * 0.95);
    const hitAt = cls.attackInterval * (cls.projectile ? 0.58 : 0.42);
    this.after(hitAt, () => this.resolveAttack());
    if (cls.projectile === 'arrow') this.game.sfx.bow();
    else if (cls.projectile === 'orb') this.game.sfx.orb();
    else this.game.sfx.swing();
  }

  resolveAttack() {
    if (!this.alive) return;
    const dir = this.forward();
    const cls = this.cls;
    const critChance = this.critChance;
    if (cls.projectile === 'arrow') {
      this.game.combat.fireArrow(this, dir, {
        damage: this.damage, speed: 420, range: 340, critChance,
      });
    } else if (cls.projectile === 'orb') {
      this.game.combat.fireOrb(this, dir, {
        damage: this.damage * 1.05, speed: 260, range: 320, splash: 34, critChance,
      });
    } else {
      this.game.combat.melee(this, dir, cls.attackRange, cls.attackArc, this.damage, {
        critChance, swingFrom: this.comboIndex % 2 === 0,
      });
    }
  }

  useSkill(key) {
    if (!this.alive) return false;
    return this.game.castSkill(key);
  }

  takeDamage(amount, sourcePos) {
    if (!this.alive || this.invuln > 0) return 0;
    // 막기: 스태미나 5 이상 · 대쉬/사망 상태가 아니면 받는 피해를 50%로 줄인다
    const blocked = this.isBlocking;
    let dmg = amount;
    if (blocked) dmg *= STAMINA.blockDamageMul;
    if (this.buffs.fortress > 0) dmg *= 0.4;
    // 완전 회복의 성수: 15초간 받는 피해 50% 감소
    if (this.buffs.guard > 0) dmg *= 0.5;
    if (this.armorDefense > 0) dmg *= (1 - this.armorDefense);
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;
    this.invuln = 0.42;
    if (blocked) {
      // 막은 한 번에 스태미나 5 — 다 쓰면 방어가 풀리고 지침 상태가 된다
      this.spendStamina(STAMINA.blockCost);
      this.blockFlash = 0.3;
      this.hurtTint = 0.14;
      if (this.game.sfx && this.game.sfx.block) this.game.sfx.block();
      this.game.hud.floater('막기! -' + dmg, this.position, 'block', 2.8);
      if (this.game.effects) {
        const f = this.forward();
        this.game.effects.ring(this.position, 0x9ff0ff, 40, { duration: 0.3, yOffset: 11, thickness: 0.06 });
        this.game.effects.burst(
          new THREE.Vector3(this.position.x + f.x * 13, this.position.y + 12, this.position.z + f.z * 13),
          0xd8f6ff, 10, { power: 24, size: 0.45, duration: 0.32 },
        );
      }
    } else {
      this.hurtTint = 0.32;
      this.game.sfx.hurt();
      this.game.hud.floater('-' + dmg, this.position, 'hurt', 3);
    }
    if (sourcePos) {
      const away = new THREE.Vector3().subVectors(this.position, sourcePos).setY(0).normalize();
      // 막아 낸 공격에는 밀려나는 거리도 줄어든다
      this.position.addScaledVector(away, blocked ? 1.4 : 3.5);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
    this.game.hud.refreshBars();
    return dmg;
  }

  heal(amount) {
    if (!this.alive) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const gained = this.hp - before;
    if (gained > 0) this.game.hud.floater('+' + Math.round(gained), this.position, 'heal', 3);
    this.game.hud.refreshBars();
    return gained;
  }

  /* ---------------------------- 포션 ---------------------------- */
  potionCount(id) { return Math.max(0, this.potions[id] || 0); }

  // 포션 사용 — 실제로 효과가 있을 때만 1개 소모한다
  // 효과 정의(config.js)
  //  · heal: 숫자(그만큼 회복) | 'full'(전체 회복)
  //  · buff: buffs 키 · duration(초) · mult(공격력 배율) · defense(피해 감소율)
  usePotion(id) {
    const def = allPotions().find((p) => p.id === id);
    if (!def) return { ok: false, msg: '알 수 없는 포션입니다' };
    if (!this.alive) return { ok: false, msg: '지금은 사용할 수 없습니다' };
    if (this.potionCount(id) <= 0) return { ok: false, msg: def.name + '이(가) 없습니다' };

    const full = def.heal === 'full';
    const hasHeal = def.heal !== undefined && def.heal !== null;
    const needsHp = hasHeal && this.hp < this.maxHp - 0.5;
    // 회복도 버프도 쓸모가 없을 때만 거절한다 (버프 포션은 풀피에서도 쓸 수 있다)
    if (hasHeal && !needsHp && !def.buff) return { ok: false, msg: '체력이 이미 가득 찼습니다' };

    const notes = [];
    if (needsHp) {
      this.heal(full ? this.maxHp : def.heal);
      notes.push('HP ' + Math.round(this.hp) + '/' + Math.round(this.maxHp));
    }
    if (def.buff) {
      this.buffs[def.buff] = def.duration || 15;
      if (def.mult) notes.push('공격력 +' + Math.round((def.mult - 1) * 100) + '%');
      if (def.defense) notes.push('받는 피해 ' + Math.round(def.defense * 100) + '% 감소');
      notes.push(def.duration + '초');
      if (this.game.effects) {
        const auraColor = def.buff === 'rage' ? 0xff6a3c : (def.buff === 'guard' ? 0x8fd8ff : 0xffb347);
        this.game.effects.aura(this.root, auraColor, 7, 14, 12);
        this.game.effects.ring(this.position, auraColor, 46, { duration: 0.6 });
      }
      if (this.game.effects && def.buff === 'rage') {
        this.game.effects.ring(this.position, 0xff3c1e, 76, { duration: 0.8, thickness: 0.05 });
      }
    }
    this.potions[id] = this.potionCount(id) - 1;
    this.game.sfx.potion();
    const label = def.buff === 'rage' ? '광폭' : (def.buff === 'guard' ? '수호' : (def.buff ? '공격' : ''));
    if (label) this.game.hud.floater(label, this.position, 'xp', 2.4);
    return { ok: true, msg: def.name + ' 사용 · ' + notes.join(' · ') };
  }

  die() {
    this.state = 'dead';
    this.blocking = false;
    this.dash = null;
    this.anim.name = null;
    this.playAnim('death', 1.4);
    this.game.sfx.death();
    this.game.onPlayerDeath();
  }

  gainXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.35 + 18);
      this.maxHp += 16;
      this.baseDamage += 2.4;
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.35);
      this.game.sfx.levelup();
      this.game.hud.banner('레벨 업!  Lv.' + this.level, 1900);
      this.game.effects.ring(this.position, 0xffd98a, 60, { duration: 0.9 });
      this.game.hud.refreshBars();
    }
    this.game.hud.refreshBars();
  }

  /* ------------------------------- 업데이트 ------------------------------- */
  update(dt, input) {
    this.time += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.cooldowns.q = Math.max(0, this.cooldowns.q - dt);
    this.cooldowns.e = Math.max(0, this.cooldowns.e - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.aimLock = Math.max(0, this.aimLock - dt);
    if (this.buffs.fortress > 0) {
      this.buffs.fortress = Math.max(0, this.buffs.fortress - dt);
      if (this.alive) this.hp = Math.min(this.maxHp, this.hp + 11 * dt);
    }
    if (this.buffs.haste > 0) this.buffs.haste = Math.max(0, this.buffs.haste - dt);
    if (this.buffs.frost > 0) this.buffs.frost = Math.max(0, this.buffs.frost - dt);
    if (this.buffs.elixir > 0) this.buffs.elixir = Math.max(0, this.buffs.elixir - dt);
    if (this.buffs.rage > 0) this.buffs.rage = Math.max(0, this.buffs.rage - dt);
    if (this.buffs.guard > 0) this.buffs.guard = Math.max(0, this.buffs.guard - dt);
    // 스태미나 회복 · 지침 해제
    this.updateStamina(dt);
    if (this.hurtTint > 0) {
      this.hurtTint = Math.max(0, this.hurtTint - dt);
      const t = clamp(this.hurtTint / 0.32, 0, 1);
      for (const m of this.tintMats) m.emissive.setRGB(t * 0.75, t * 0.06, t * 0.06);
    }
    // 갑옷 재질도 피격 시 붉게 번짝인다 (장착 중일 때만)
    if (this.armorMats && this.armorMats.length) {
      const t = this.hurtTint > 0 ? clamp(this.hurtTint / 0.32, 0, 1) : 0;
      for (const m of this.armorMats) {
        if (t > 0) m.emissive.setRGB(t * 0.8, t * 0.06, t * 0.06);
        else if (m.userData.baseEmissive) m.emissive.copy(m.userData.baseEmissive);
      }
    }

    // 타이머
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }

    const groundedBefore = this.grounded;

    if (this.alive) {
      // 이동 입력
      const iF = input.forward ? 1 : 0, iB = input.back ? 1 : 0;
      const iL = input.left ? 1 : 0, iR = input.right ? 1 : 0;
      let ix = iR - iL, iz = iF - iB;
      const len = Math.hypot(ix, iz);
      const camYaw = this.game.camYaw;
      const wish = new THREE.Vector3();
      if (len > 0) {
        ix /= len; iz /= len;
        const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
        const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
        wish.addScaledVector(fwd, iz).addScaledVector(right, ix).normalize();
      }

      let speed = this.moveSpeed * (input.sprint && !this.isBlocking ? this.cls.sprintMul : 1);
      if (this.anim.name && this.anim.name !== 'death') speed *= 0.45;
      if (this.anim.name === 'fortress') speed *= 0.35;
      if (this.isBlocking) speed *= STAMINA.blockMoveMul;   // 막는 동안은 느리게
      this.lastWish.copy(wish);

      // 막기 입력 (우클릭 / R / 화면 🛡 버튼을 누르고 있는 동안)
      this.blocking = !!input.block;

      if (this.dash) {
        this.dash.time += dt;
        const p = clamp(this.dash.time / this.dash.duration, 0, 1);
        const ease = 1 - Math.pow(1 - p, 2.2);
        const step = this.dash.distance * (ease - this.dash.progress);
        this.dash.progress = ease;
        this.position.addScaledVector(this.dash.dir, step);
        if (p >= 1) this.dash = null;
      } else {
        const accel = this.grounded ? 16 : 6;
        this.velocity.x = damp(this.velocity.x, wish.x * speed, accel, dt);
        this.velocity.z = damp(this.velocity.z, wish.z * speed, accel, dt);
        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.z * dt;
      }

      // 점프 & 중력
      if (input.jump && this.grounded) {
        this.vy = 36;
        this.grounded = false;
        input.jump = false;
      }
      this.vy -= 78 * dt;
      this.position.y += this.vy * dt;

      // 바라보는 방향
      const aiming = this.aimLock > 0 || (this.anim.name && this.anim.name !== 'death' && this.anim.name !== 'flurry');
      let desired = this.facing;
      if (aiming) desired = camYaw + Math.PI;
      else if (wish.lengthSq() > 0.01) desired = Math.atan2(wish.x, wish.z);
      this.facing = dampAngle(this.facing, desired, aiming ? 22 : 13, dt);
    } else {
      this.blocking = false;
      this.velocity.multiplyScalar(0.9);
      this.vy -= 78 * dt;
      this.position.y += this.vy * dt;
      if (this.anim.name) this.aimLock = 0;
    }

    // 지금 있는 세계의 통행 영역으로 제한한다 (1번째 세계 십자 · 2번째 세계 십자)
    clampToWorld(this.position, this.game.worldId);
    const groundY = terrainHeight(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      if (this.vy < -30 && !groundedBefore) this.game.sfx.tone({ freq: 120, to: 60, dur: 0.12, type: 'sine', vol: 0.18 });
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    this.speedNow = Math.hypot(this.velocity.x, this.velocity.z);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;

    this.updatePose(dt, input);
    this.updateWeaponFx(dt);
  }

  /* --------------------------- 원격 친구 렌더 --------------------------- */
  // 위치·보간은 net 쪽에서 처리하고, 여기서는 자세·애니메이션만 갱신한다.
  updateRemote(dt, st) {
    this.time += dt;
    const s = st || {};
    if (s.weaponTier !== undefined && s.weaponTier !== this.weaponTier) {
      this.equipWeaponTier(clamp(Math.round(s.weaponTier), 0, MAX_WEAPON_TIER));
    }
    if (s.armorTier !== undefined && Math.round(s.armorTier) !== this.armorTier) {
      this.equipArmorTier(clamp(Math.round(s.armorTier), 0, MAX_ARMOR_TIER));
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (typeof s.yaw === 'number') this.facing = dampAngle(this.facing, s.yaw, 16, dt);
    // 친구가 막기 · 대쉬 중이면 같은 자세 · 방어막이 보인다 (원격은 실제 이동은 보간으로 따라간다)
    if (s.block !== undefined) this.blocking = !!s.block && this.alive;
    this.dashLean = s.dashing ? STAMINA.dashDuration : Math.max(0, (this.dashLean || 0) - dt);
    if (s.anim && s.anim !== this.anim.name) {
      this.playAnim(s.anim, s.animDur || 0.6);
    }
    this.speedNow = damp(this.speedNow, Number(s.speed) || 0, 9, dt);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;
    this.updatePose(dt, null);
    this.updateWeaponFx(dt);
  }

  /* --------------------------- 원격 친구 렌더 (끝) --------------------------- */
  updatePose(dt, input) {
    const p = this.pose;
    const t = this.target;
    POSE_KEYS.forEach((k) => { t[k] = 0; });

    const breath = Math.sin(this.time * 2.0);
    const st = this.stance;
    t.bodyY = breath * 0.16;
    t.torsoPitch = 0.035 + breath * 0.015;
    t.armLz = st.armLz;
    t.armRz = st.armRz;
    t.armLx = st.armLx + breath * 0.05;
    t.armRx = st.armRx - breath * 0.05;
    t.foreLx = st.foreLx;
    t.foreRx = st.foreRx;
    t.headYaw = Math.sin(this.time * 0.8) * 0.05;
    t.legLx = 0.02;
    t.legRx = -0.02;

    const moveAmt = clamp(this.speedNow / this.cls.speed, 0, 1.6);
    if (moveAmt > 0.04 && this.alive) {
      this.walkPhase += dt * (5.0 + this.speedNow * 0.16);
      const s = Math.sin(this.walkPhase);
      const c = Math.cos(this.walkPhase);
      t.legLx = s * 0.9 * moveAmt;
      t.legRx = -s * 0.9 * moveAmt;
      t.kneeLx = Math.max(0, -s) * 1.15 * moveAmt;
      t.kneeRx = Math.max(0, s) * 1.15 * moveAmt;
      t.armLx += -s * 0.62 * moveAmt * st.swingL;
      t.armRx += s * 0.62 * moveAmt * st.swingR;
      t.armLz = st.armLz + Math.abs(s) * 0.05 * st.swingL;
      t.armRz = st.armRz - Math.abs(s) * 0.05 * st.swingR;
      t.bodyY = Math.abs(Math.sin(this.walkPhase)) * 0.5 * moveAmt + breath * 0.12;
      t.torsoPitch = 0.05 + moveAmt * 0.07;
      t.torsoYaw = -s * 0.09 * moveAmt;
      t.headPitch = 0.03 * moveAmt;
    }

    // 공중
    if (!this.grounded && this.alive && !this.anim.name) {
      t.legLx = -0.4;
      t.legRx = 0.25;
      t.kneeLx = 0.8;
      t.kneeRx = 0.45;
      t.armLz = 0.55;
      t.armRz = -0.55;
      t.bodyY = 0.2;
    }

    // 막기 · 대쉬 자세
    if (this.isBlocking) {
      // 방어 자세: 무기를 가슴 앞으로 세우고 몸을 살짝 낮춘다 (방패수는 방패를 앞에)
      const guard = Math.sin(this.time * 8) * 0.03;
      t.armRx = -1.52 + guard;
      t.armRz = -0.6;
      t.foreRx = -1.02;
      t.handRx = -0.18;
      t.armLx = -1.42;
      t.armLz = 0.64;
      t.foreLx = -0.98;
      t.torsoYaw = 0.3;
      t.torsoPitch = 0.2;
      t.bodyPitch = 0.06;
      t.bodyY = -0.55;
      t.legLx = 0.34;
      t.legRx = -0.28;
      t.kneeLx = 0.26;
      t.kneeRx = 0.2;
      t.headPitch = 0.05;
      t.headYaw = -0.12;
    } else if ((this.dash || this.dashLean > 0) && !this.anim.name) {
      // 대쉬: 앞으로 몸을 눕히고 팔을 뒤로 빼며 내닫는 자세
      t.bodyPitch = 0.42;
      t.torsoPitch = 0.18;
      t.armLx = 0.22;
      t.armRx = 0.22;
      t.armLz = 0.95;
      t.armRz = -0.95;
      t.foreLx = -0.35;
      t.foreRx = -0.35;
      t.legLx = 0.92;
      t.legRx = -0.72;
      t.kneeLx = 0.55;
      t.bodyY = 0.16;
      t.headPitch = -0.1;
    }

    // 클립 오버라이드
    let override = null;
    if (this.anim.name) {
      this.anim.time += dt;
      const prog = clamp(this.anim.time / this.anim.duration, 0, 1);
      override = sampleFrames(prog, FRAMES[this.anim.name]);
      if (prog >= 1 && this.state === 'alive') this.anim.name = null;
      else if (prog >= 1) this.anim.time = this.anim.duration;
    }

    if (override) {
      Object.keys(override).forEach((k) => {
        if (k === 'spinY') return;
        t[k] = t[k] + (override[k] - t[k]) * 0.92;
      });
      t.spinY = override.spinY === undefined ? 0 : override.spinY;
    }

    // 도적 연격: 양손 번갈아
    if (this.anim.name === 'stab' && this.comboIndex % 2 === 0) {
      t.armLx = t.armRx;
      t.armLz = -t.armRz;
      t.armRx = 0.2;
      t.armRz = -0.2;
      t.foreLx = t.foreRx;
      t.foreRx = -0.3;
    }

    const lambda = 20;
    for (const k of POSE_KEYS) {
      if (k === 'spinY') continue;
      p[k] = damp(p[k], t[k], lambda, dt);
    }
    p.spinY = t.spinY;

    this.body.position.y = p.bodyY;
    this.body.rotation.set(p.bodyPitch, p.spinY, p.bodyRoll);
    this.torso.rotation.set(p.torsoPitch, p.torsoYaw, p.torsoRoll);
    this.head.rotation.set(p.headPitch, p.headYaw, 0);
    this.armL.rotation.set(p.armLx, p.armLy, p.armLz);
    this.armR.rotation.set(p.armRx, p.armRy, p.armRz);
    this.foreL.rotation.x = p.foreLx;
    this.foreR.rotation.x = p.foreRx;
    this.handL.rotation.x = p.handLx;
    this.handR.rotation.x = p.handRx;
    this.legL.rotation.set(p.legLx, 0, p.legLz);
    this.legR.rotation.set(p.legRx, 0, p.legRz);
    this.kneeL.rotation.x = p.kneeLx;
    this.kneeR.rotation.x = p.kneeRx;
    this.updateWeaponHold();
    this.updateGuardFx();
  }

  // 클립별 무기 방향: 표가 있으면 몸통 기준 방향을 직접 지정하고,
  // 없으면 기본 파지 자세(손 기준)를 그대로 둔다.
  updateWeaponHold() {
    const w = this.weapons;
    if (!w || !this.weaponBase) return;
    const table = AIM_FRAMES[this.classId];
    const clip = this.anim.name;
    const prog = clip ? clamp(this.anim.time / this.anim.duration, 0, 1) : 0;
    for (const side of ['right', 'left']) {
      const m = w[side];
      if (!m) continue;
      const b = this.weaponBase[side];
      const frames = table && table[side] && clip ? table[side][clip] : null;
      if (!frames) {
        m.rotation.set(b[0], b[1], b[2]);
        continue;
      }
      const aim = sampleFrames(prog, frames);
      const hint = (AIM_HINT[this.classId] && AIM_HINT[this.classId][side]) || [0, 1, 0];
      // 손(월드) 기준 → 몸통 기준: 몸통 아래 사슬을 합성한다
      _qTorso.setFromEuler(this.torso.rotation);
      _qArm.setFromEuler(side === 'right' ? this.armR.rotation : this.armL.rotation);
      _qFore.setFromEuler(side === 'right' ? this.foreR.rotation : this.foreL.rotation);
      _qHand.setFromEuler(side === 'right' ? this.handR.rotation : this.handL.rotation);
      _qTorso.multiply(_qArm).multiply(_qFore).multiply(_qHand);
      const target = aimQuaternion(aim.p, aim.y, hint);
      m.quaternion.copy(_qTorso.invert().multiply(target));
    }
  }

  updateWeaponFx(dt) {
    // 지팡이 오브 발광 · 활 시위 장력
    const w = this.weapons;
    if (w && w.right && this.classId === 'mage') {
      const attacking = this.anim.name === 'cast' || this.anim.name === 'explosion';
      const orbMat = w.right.userData.orbMat;
      if (orbMat && orbMat.emissiveIntensity !== undefined) {
        orbMat.emissiveIntensity = attacking ? 3.4 : 2.0 + Math.sin(this.time * 3) * 0.4;
      }
    }
    if (w && w.left && this.classId === 'archer') {
      const arrow = w.left.userData.arrow;
      const drawing = this.anim.name === 'shoot' || this.anim.name === 'multishot' || this.anim.name === 'barrage';
      if (arrow) arrow.visible = !!drawing && (this.anim.time < this.anim.duration * 0.62);
      const str = w.left.userData.string;
      if (str) {
        const pull = drawing ? Math.sin(clamp(this.anim.time / this.anim.duration, 0, 1) * Math.PI) * 0.5 : 0;
        str.position.z = -pull * 1.1;
      }
    }
  }
}
