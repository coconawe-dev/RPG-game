// 공용 수학 · 지형 · 좌표 유틸리티
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
// 프레임 독립 감쇠 보간
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * (1 - Math.exp(-lambda * dt));
}
export function rand(a, b) { return a + Math.random() * (b - a); }
export function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
export function easeInCubic(t) { return t * t * t; }
export function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
export function easeOutBack(t) { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
export function pulse(t, a, b) { return smoothstep(a, b, t) * (1 - smoothstep(b, 1, t)); }

// 시드 기반 난수 (월드 프롭 배치를 매번 같게)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}

export function fbm(x, y, octaves) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  const oct = octaves || 4;
  for (let i = 0; i < oct; i++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/* ------------------------------------------------------------------
   세계 좌표계
   - 각 바이옴은 1000 x 1000 월드 단위
   - 중앙 정글 사원(0,0)을 네 방향이 감싸는 십자 구조
       서쪽: 쾌적한 숲(-1000) → 그 서쪽: 태초마을(-2000)
       동쪽: 사바나 / 북쪽: 무덤 / 남쪽: 정글
   - x축은 서쪽으로 한 칸 더 길다 (태초마을) → 비대칭 경계
------------------------------------------------------------------ */
export const WORLD = {
  cell: 1000,
  halfCell: 500,
  half: 2500,          // 가장 먼 x 거리(서쪽)
  bound: 2470,
  xMin: -2470,
  xMax: 1470,
  zMin: -1470,
  zMax: 1470,
};

export function terrainHeight(x, z) {
  let h = 0;
  h += Math.sin(x * 0.0042) * Math.cos(z * 0.0035) * 5.5;
  h += Math.sin((x + z) * 0.0085 + 1.7) * 2.8;
  h += Math.cos(x * 0.019 + 0.4) * Math.sin(z * 0.017) * 1.3;
  h += Math.sin(x * 0.061 + z * 0.055) * 0.45;

  // 정글 사원 중앙 광장은 평평하게
  const dEdge = WORLD.halfCell - Math.max(Math.abs(x), Math.abs(z));
  const flat = smoothstep(10, 150, dEdge);
  h *= 1 - flat * 0.99;

  // 태초마을 광장 · 상점 터는 평평하게 (건물을 올리기 위해)
  const dVillage = Math.hypot(x + 2000, z);
  const flatVillage = smoothstep(540, 300, dVillage);
  h *= 1 - flatVillage * 0.94;

  // 세계 외곽(가장자리)은 완만하게 낮춤 — 태초마을이 서쪽으로 한 칸 더 넓다
  const border = Math.min(x + 2500, 1500 - x, z + 1500, 1500 - z);
  h *= smoothstep(0, 90, border);
  return h;
}

export function regionAt(x, z) {
  if (Math.abs(x) <= WORLD.halfCell && Math.abs(z) <= WORLD.halfCell) return 'temple';
  if (x < -WORLD.halfCell) return x < -1500 ? 'village' : 'forest';
  if (x > WORLD.halfCell) return 'savanna';
  if (z < -WORLD.halfCell) return 'graveyard';
  if (z > WORLD.halfCell) return 'jungle';
  return 'forest';
}

// 십자 형태의 통행 가능 영역으로 위치를 제한
export function clampToWorld(p) {
  p.x = clamp(p.x, WORLD.xMin, WORLD.xMax);
  p.z = clamp(p.z, WORLD.zMin, WORLD.zMax);
  const ax = Math.abs(p.x), az = Math.abs(p.z);
  if (ax > WORLD.halfCell && az > WORLD.halfCell) {
    if (ax - WORLD.halfCell < az - WORLD.halfCell) {
      p.x = Math.sign(p.x) * (WORLD.halfCell - 4);
    } else {
      p.z = Math.sign(p.z) * (WORLD.halfCell - 4);
    }
  }
  return p;
}

export function isInsideWorld(x, z) {
  if (x < WORLD.xMin || x > WORLD.xMax || z < WORLD.zMin || z > WORLD.zMax) return false;
  return Math.abs(x) <= WORLD.halfCell || Math.abs(z) <= WORLD.halfCell;
}

// 플레이어 주변 바이옴 가중치 (색 전환을 부드럽게)
export function biomeWeights(x, z, centers) {
  const out = {};
  let total = 0;
  for (const id in centers) {
    const c = centers[id];
    const d = Math.hypot(x - c.x, z - c.z);
    const w = clamp(1 - d / 980, 0, 1);
    const v = w * w;
    out[id] = v;
    total += v;
  }
  if (total < 0.0001) { out[regionAt(x, z)] = 1; return out; }
  for (const id in out) out[id] /= total;
  return out;
}

export function makeInstanced(geometry, material, transforms, castShadow) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    pos.set(t.x, t.y, t.z);
    e.set(t.rx || 0, t.ry || 0, t.rz || 0);
    q.setFromEuler(e);
    const s = t.s === undefined ? 1 : t.s;
    if (typeof s === 'number') scl.set(s, t.sy === undefined ? s : t.sy, s);
    else scl.set(s.x, s.y, s.z);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = !!castShadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

export function disposeObject(obj) {
  obj.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}
