// 플레이어: 직업별 3D 리그, 이동, 절차적 애니메이션(공격/스킬/피격)
import * as THREE from 'three';
import { CLASSES } from './config.js';
import { buildWeapons } from './weapons.js';
import {
  clamp, damp, dampAngle, lerp, smoothstep, terrainHeight, clampToWorld, TAU,
} from './utils.js';

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

export class Player {
  constructor(game, classId) {
    this.game = game;
    this.classId = classId;
    this.cls = CLASSES[classId];
    this.level = 1;
    this.maxHp = this.cls.hp;
    this.hp = this.maxHp;
    this.damage = this.cls.damage;
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
    this.buffs = { fortress: 0, haste: 0, frost: 0 };
    this.invuln = 0;
    this.dash = null;
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
    this.armorMat = new THREE.MeshStandardMaterial({ color: pal.main, roughness: 0.62, metalness: pal.metal, emissive: 0x000000 });
    this.armorDarkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pal.main).multiplyScalar(0.6), roughness: 0.75, metalness: pal.metal * 0.8, emissive: 0x000000 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: pal.trim, roughness: 0.35, metalness: 0.75, emissive: 0x000000 });
    this.clothMat = new THREE.MeshStandardMaterial({ color: pal.cloth, roughness: 0.95, emissive: 0x000000 });
    this.tintMats = [this.armorMat, this.armorDarkMat, this.trimMat, this.clothMat];

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
    this.legL.add(mk(new THREE.BoxGeometry(2.1, 4.5, 2.5), this.armorDarkMat, 0, -2.2, 0));
    this.legR.add(mk(new THREE.BoxGeometry(2.1, 4.5, 2.5), this.armorDarkMat, 0, -2.2, 0));
    this.kneeL.add(mk(new THREE.BoxGeometry(1.95, 3.7, 2.3), this.armorDarkMat, 0, -1.85, 0));
    this.kneeR.add(mk(new THREE.BoxGeometry(1.95, 3.7, 2.3), this.armorDarkMat, 0, -1.85, 0));
    this.kneeL.add(mk(new THREE.BoxGeometry(2.3, 1.3, 3.4), this.clothMat, 0, -3.7, 0.5));
    this.kneeR.add(mk(new THREE.BoxGeometry(2.3, 1.3, 3.4), this.clothMat, 0, -3.7, 0.5));
    this.legL.add(this.kneeL);
    this.legR.add(this.kneeR);
    this.body.add(this.legL, this.legR);

    // 상체
    this.torso = new THREE.Group();
    this.torso.position.set(0, hipY, 0);
    this.body.add(this.torso);
    this.torso.add(mk(new THREE.BoxGeometry(7.6, 6.8, 4.0), this.armorMat, 0, 3.3, 0));
    this.torso.add(mk(new THREE.BoxGeometry(7.9, 2.2, 4.3), this.trimMat, 0, 1.0, 0));
    this.torso.add(mk(new THREE.BoxGeometry(5.2, 3.6, 0.5), this.trimMat, 0, 4.2, 2.0));
    this.torso.add(mk(new THREE.BoxGeometry(2.2, 3.0, 0.6), this.clothMat, 0, 4.3, 2.15));
    // 어깨 견갑
    for (const s of [-1, 1]) {
      const pad = mk(new THREE.SphereGeometry(2.5, 10, 8), this.trimMat, s * 4.5, 5.9, 0);
      pad.scale.set(1, 0.85, 1.05);
      this.torso.add(pad);
    }

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
      arm.add(mk(new THREE.BoxGeometry(2.0, 3.6, 2.1), this.armorMat, 0, -1.75, 0));
    }
    for (const fore of [this.foreL, this.foreR]) {
      fore.add(mk(new THREE.BoxGeometry(1.85, 3.2, 1.95), this.armorDarkMat, 0, -1.6, 0));
      fore.add(mk(new THREE.BoxGeometry(1.95, 0.7, 2.05), this.trimMat, 0, -3.0, 0));
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

    // 무기 (손 위치에서 몸 바깥쪽으로 기울여 어깨 견갑에 가리지 않게)
    const w = buildWeapons(this.classId);
    this.weapons = w;
    const WEAPON_POSE = {
      warrior: { r: { p: [-0.4, -1.0, 0.55], r: [0.14, 0, 0.46] } },
      archer: { l: { p: [1.35, -0.6, 0.5], r: [0.05, 0.72, -0.22] } },
      rogue: {
        r: { p: [-0.25, -0.8, 0.4], r: [0.12, 0, 0.26] },
        l: { p: [0.25, -0.8, 0.4], r: [0.12, 0, -0.26] },
      },
      tanker: {
        r: { p: [-0.3, -0.8, 0.35], r: [0.1, 0, 0.32] },
        l: { p: [0.7, -0.5, 0.25], r: [0, -Math.PI / 2, 0.12] },
      },
      mage: { r: { p: [-0.2, -0.85, 0.45], r: [0.1, 0, 0.22] } },
    };
    const wp = WEAPON_POSE[this.classId] || {};
    if (w.right) {
      const cfg = wp.r || { p: [0, -0.7, 0.2], r: [0, 0, 0] };
      w.right.position.set(cfg.p[0], cfg.p[1], cfg.p[2]);
      w.right.rotation.set(cfg.r[0], cfg.r[1], cfg.r[2]);
      this.handR.add(w.right);
    }
    if (w.left) {
      const cfg = wp.l || { p: [0, -0.5, 0.2], r: [0, 0, 0] };
      w.left.position.set(cfg.p[0], cfg.p[1], cfg.p[2]);
      w.left.rotation.set(cfg.r[0], cfg.r[1], cfg.r[2]);
      this.handL.add(w.left);
    }

    // 그림자 접지
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.game.scene.add(this.root);
  }

  addHeadgear(mk) {
    if (this.classId === 'warrior') {
      this.head.add(mk(new THREE.BoxGeometry(4.1, 1.7, 4.0), this.armorMat, 0, 3.9, 0));
      this.head.add(mk(new THREE.BoxGeometry(0.7, 1.3, 3.2), this.trimMat, 0, 4.9, 0));
      this.head.add(mk(new THREE.BoxGeometry(4.3, 1.1, 1.1), this.trimMat, 0, 3.4, 1.6));
    } else if (this.classId === 'archer') {
      const hood = mk(new THREE.SphereGeometry(2.3, 10, 8), this.clothMat, 0, 2.9, -0.3);
      hood.scale.set(1.05, 0.9, 1.05);
      this.head.add(hood);
      this.head.add(mk(new THREE.ConeGeometry(1.1, 2.2, 6), this.clothMat, 0, 4.9, -1.4));
    } else if (this.classId === 'rogue') {
      this.head.add(mk(new THREE.SphereGeometry(2.2, 10, 8), this.clothMat, 0, 3.1, -0.2));
      this.head.add(mk(new THREE.BoxGeometry(3.5, 1.4, 0.5), this.clothMat, 0, 1.6, 1.95));
      this.head.add(mk(new THREE.BoxGeometry(3.8, 0.5, 0.6), this.trimMat, 0, 2.2, 1.9));
    } else if (this.classId === 'tanker') {
      this.head.add(mk(new THREE.BoxGeometry(4.2, 3.0, 4.1), this.armorMat, 0, 3.1, 0));
      this.head.add(mk(new THREE.BoxGeometry(4.4, 0.7, 4.3), this.trimMat, 0, 4.6, 0));
      this.head.add(mk(new THREE.BoxGeometry(0.9, 1.6, 0.6), this.trimMat, 0, 2.4, 2.0));
    } else if (this.classId === 'mage') {
      this.head.add(mk(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 12), this.clothMat, 0, 4.2, 0));
      this.head.add(mk(new THREE.ConeGeometry(2.1, 4.6, 10), this.clothMat, 0, 6.6, -0.2));
      this.head.add(mk(new THREE.SphereGeometry(0.45, 8, 6), this.trimMat, 0, 8.6, -0.2));
    }
  }

  /* ------------------------------ 상태 API ------------------------------ */
  get alive() { return this.state === 'alive'; }
  get moveSpeed() {
    let s = this.cls.speed;
    if (this.buffs.haste > 0) s *= 1.3;
    return s;
  }

  forward() {
    return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  spawnAt(x, z) {
    this.anim.name = null;
    this.anim.time = 0;
    this.dash = null;
    this.buffs.fortress = 0;
    this.buffs.haste = 0;
    this.buffs.frost = 0;
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
    const critChance = cls.critChance;
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
    let dmg = amount;
    if (this.buffs.fortress > 0) dmg *= 0.4;
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg;
    this.invuln = 0.42;
    this.hurtTint = 0.32;
    this.game.sfx.hurt();
    this.game.hud.floater('-' + dmg, this.position, 'hurt', 3);
    if (sourcePos) {
      const away = new THREE.Vector3().subVectors(this.position, sourcePos).setY(0).normalize();
      this.position.addScaledVector(away, 3.5);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
    this.game.hud.refreshBars();
    return dmg;
  }

  heal(amount) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.game.hud.floater('+' + Math.round(amount), this.position, 'heal', 3);
    this.game.hud.refreshBars();
  }

  die() {
    this.state = 'dead';
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
      this.damage += 2.4;
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
    if (this.hurtTint > 0) {
      this.hurtTint = Math.max(0, this.hurtTint - dt);
      const t = clamp(this.hurtTint / 0.32, 0, 1);
      for (const m of this.tintMats) m.emissive.setRGB(t * 0.75, t * 0.06, t * 0.06);
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

      let speed = this.moveSpeed * (input.sprint ? this.cls.sprintMul : 1);
      if (this.anim.name && this.anim.name !== 'death') speed *= 0.45;
      if (this.anim.name === 'fortress') speed *= 0.35;

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
      this.velocity.multiplyScalar(0.9);
      this.vy -= 78 * dt;
      this.position.y += this.vy * dt;
      if (this.anim.name) this.aimLock = 0;
    }

    clampToWorld(this.position);
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

  updatePose(dt, input) {
    const p = this.pose;
    const t = this.target;
    POSE_KEYS.forEach((k) => { t[k] = 0; });

    const breath = Math.sin(this.time * 2.0);
    t.bodyY = breath * 0.16;
    t.torsoPitch = 0.035 + breath * 0.015;
    t.armLz = 0.17;
    t.armRz = -0.22;
    t.armLx = breath * 0.05;
    t.armRx = -breath * 0.05;
    t.foreLx = -0.28;
    t.foreRx = -0.28;
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
      t.armLx += -s * 0.62 * moveAmt;
      t.armRx += s * 0.62 * moveAmt;
      t.armLz = 0.15 + Math.abs(s) * 0.06;
      t.armRz = -0.15 - Math.abs(s) * 0.06;
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
  }

  updateWeaponFx(dt) {
    // 지팡이 오브 발광 · 활 시위 장력
    const w = this.weapons;
    if (w && w.right && this.classId === 'mage') {
      const attacking = this.anim.name === 'cast' || this.anim.name === 'explosion';
      const orb = w.right.children[w.right.children.length - 2];
      if (orb && orb.material && orb.material.emissiveIntensity !== undefined) {
        orb.material.emissiveIntensity = attacking ? 3.4 : 2.0 + Math.sin(this.time * 3) * 0.4;
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
