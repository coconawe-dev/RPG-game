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
       동쪽: 사바나(1000) → 그 동쪽: 낡은 마을(2000)
       북쪽: 무덤 / 남쪽: 정글
   - x축은 동 · 서로 한 칸씩 더 길다 (태초마을 · 낡은 마을) → 비대칭 경계
------------------------------------------------------------------ */
export const WORLD = {
  cell: 1000,
  halfCell: 500,
  half: 2500,          // 가장 먼 x 거리(동 · 서)
  bound: 2470,
  xMin: -2470,
  xMax: 2470,
  zMin: -1470,
  zMax: 1470,
};

/* ------------------------------------------------------------------
   2번째 세계 (World 2)
   1번째 세계와 완전히 떨어진 자리에 같은 십자 구조로 놓는다.
   - z 를 originZ 만큼 밀어 두면 두 세계가 절대 겹치지 않고,
     바이옴 컬링 · 미니맵 · 몹 시뮬레이션이 좌표만으로 갈린다.
   - 안쪽 좌표는 local (z = 0 이 암흑지역 중심) 로 계산한다.
     · 중앙: 암흑지역(z 0)        · 북: 불길한 동굴(z -1000)
     · 남: 고블린 숲(z +1000)     · 서: 안개낀 평지(x -1000) · 동: 사쿠라(x +1000)
     · 남쪽 끝: 2세계 태초마을(z +2000) — 고블린 숲 남문 너머의 안전 지대
------------------------------------------------------------------ */
export const WORLD2 = {
  id: 2,
  name: '2번째 세계',
  originZ: 8000,
  zSplit: 4000,        // 이 z 보다 크면 2번째 세계 좌표
  cell: 1000,
  halfCell: 500,
  xMin: -1470,
  xMax: 1470,
  zMin: 8000 - 1470,
  // 남쪽은 2세계 태초마을(z +2000 ~ +2500)의 끝까지 — 1번째 세계는 동 · 서로 길고, 이쪽은 남쪽으로 길다
  zMax: 8000 + 2470,
  southCell: 2000,     // 2세계 태초마을 중심의 local z
};

/* ------------------------------------------------------------------
   3번째 세계 (World 3)
   2번째 세계와 같은 십자 구조로, 더 남쪽(z 16000)에 완전히 떨어뜨려 놓는다.
   - z 를 originZ 만큼 밀어 두면 두 세계가 절대 겹치지 않는다.
   - 안쪽 좌표는 local (z = 0 이 부패한 도시 중심) 로 계산한다.
     · 중앙: 부패한 도시(z 0)      · 북: 점령당한 목장(z -1000)
     · 남: 선사시대 숲(z +1000)    · 서: 비밀동굴(x -1000) · 동: 판타지숲(x +1000)
     · 남쪽 끝: 3세계 태초마을(z +2000) — 선사시대 숲 남문 너머의 안전 지대
------------------------------------------------------------------ */
export const WORLD3 = {
  id: 3,
  name: '3번째 세계',
  originZ: 16000,
  zSplit: 12000,       // 이 z 보다 크면 3번째 세계 좌표
  cell: 1000,
  halfCell: 500,
  xMin: -1470,
  xMax: 1470,
  zMin: 16000 - 1470,
  // 남쪽은 3세계 태초마을(z +2000 ~ +2500)의 끝까지
  zMax: 16000 + 2470,
  southCell: 2000,     // 3세계 태초마을 중심의 local z
};

// 세계 번호를 1 · 2 · 3 중 하나로 맞춘다 (모르는 값은 1번째 세계)
export function normWorld(w) {
  const n = Number(w);
  return n === 3 ? 3 : (n === 2 ? 2 : 1);
}

// 어느 세계의 좌표인지 (1 | 2 | 3)
export function worldAt(x, z) {
  if (z > WORLD3.zSplit) return 3;
  return (z > WORLD2.zSplit) ? 2 : 1;
}

/* 1번째 세계 지형 */
function terrainHeight1(x, z) {
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

  // 낡은 마을의 망루 터 · 폐가 골목도 평평하게
  const dOld = Math.hypot(x - 2000, z);
  const flatOld = smoothstep(520, 300, dOld);
  h *= 1 - flatOld * 0.9;

  // 세계 외곽(가장자리)은 완만하게 낮춤 — 태초마을 · 낡은 마을이 동 · 서로 한 칸씩 더 넓다
  const border = Math.min(x + 2500, 2500 - x, z + 1500, 1500 - z);
  h *= smoothstep(0, 90, border);
  return h;
}

/* 2번째 세계 지형 — local 좌표(z = 0 이 암흑지역 중심) */
function terrainHeight2Local(x, z) {
  let h = 0;
  h += Math.sin(x * 0.0048) * Math.cos(z * 0.0041) * 7.4;
  h += Math.sin((x - z) * 0.0092 + 2.1) * 3.1;
  h += Math.cos(x * 0.019 + 0.7) * Math.sin(z * 0.017) * 1.6;
  h += Math.sin(x * 0.058 + z * 0.052) * 0.5;

  // 암흑지역 보스 투기장은 평평하게
  const dArena = Math.hypot(x, z);
  h *= 1 - smoothstep(560, 320, dArena) * 0.96;

  // 고블린 숲의 남쪽 초소와 2세계 태초마을로 올라서는 길은 평평하게
  const dArrive = Math.hypot(x, z - 1400);
  h *= 1 - smoothstep(320, 170, dArrive) * 0.96;

  // 2세계 태초마을 · 상점 터도 평평하게 (건물을 올리기 위해)
  const dVillage2 = Math.hypot(x, z - 2000);
  h *= 1 - smoothstep(540, 320, dVillage2) * 0.94;

  // 세계 외곽(가장자리)은 완만하게 낮춤.
  // 2세계 태초마을은 남쪽으로 한 칸 더 길어서, 남쪽 외곽은 길(폭 760)에서만 멀어진다.
  const southWall = 1500 + 1000 * smoothstep(620, 380, Math.abs(x));
  const border = Math.min(x + 1500, 1500 - x, z + 1500, southWall - z);
  h *= smoothstep(0, 90, border);
  return h;
}

/* 3번째 세계 지형 — local 좌표(z = 0 이 부패한 도시 중심) */
function terrainHeight3Local(x, z) {
  let h = 0;
  h += Math.sin(x * 0.0053) * Math.cos(z * 0.0046) * 8.6;
  h += Math.sin((x + z) * 0.0101 + 0.6) * 3.4;
  h += Math.cos(x * 0.021 + 1.2) * Math.sin(z * 0.018) * 1.7;
  h += Math.sin(x * 0.062 + z * 0.049) * 0.55;

  // 부패한 도시 중앙 광장(투기장)은 평평하게
  const dCity = Math.hypot(x, z);
  h *= 1 - smoothstep(560, 320, dCity) * 0.96;

  // 점령당한 목장 — 강하닭이 서는 넓은 마당은 평평하게
  const dRanch = Math.hypot(x, z + 1000);
  h *= 1 - smoothstep(540, 330, dRanch) * 0.95;

  // 비밀동굴은 움푹 파인 분지
  const dCave = Math.hypot(x + 1000, z);
  h -= smoothstep(640, 260, dCave) * 6.5;

  // 선사시대 숲 남쪽 길목과 3세계 태초마을로 올라서는 길은 평평하게
  const dArrive = Math.hypot(x, z - 1400);
  h *= 1 - smoothstep(320, 170, dArrive) * 0.96;

  // 3세계 태초마을 · 상점 터도 평평하게 (건물을 올리기 위해)
  const dVillage3 = Math.hypot(x, z - 2000);
  h *= 1 - smoothstep(540, 320, dVillage3) * 0.94;

  // 세계 외곽(가장자리)은 완만하게 낮춤. 3세계 태초마을은 남쪽으로 한 칸 더 길다.
  const southWall = 1500 + 1000 * smoothstep(620, 380, Math.abs(x));
  const border = Math.min(x + 1500, 1500 - x, z + 1500, southWall - z);
  h *= smoothstep(0, 90, border);
  return h;
}

export function terrainHeight(x, z) {
  if (z > WORLD3.zSplit) return terrainHeight3Local(x, z - WORLD3.originZ);
  if (z > WORLD2.zSplit) return terrainHeight2Local(x, z - WORLD2.originZ);
  return terrainHeight1(x, z);
}

export function regionAt(x, z) {
  if (z > WORLD3.zSplit) {
    const lz = z - WORLD3.originZ;
    if (Math.abs(x) <= WORLD3.halfCell && Math.abs(lz) <= WORLD3.halfCell) return 'corrupted_city';
    if (lz < -WORLD3.halfCell) return 'occupied_ranch';
    // 남쪽 끝의 3세계 태초마을 (선사시대 숲보다 먼저 확인해야 한다)
    if (lz > WORLD3.halfCell * 3) return 'village_w3';
    if (lz > WORLD3.halfCell) return 'annoying_forest';
    if (x > WORLD3.halfCell) return 'fantasy_forest';
    return 'secret_cave';
  }
  if (z > WORLD2.zSplit) {
    const lz = z - WORLD2.originZ;
    if (Math.abs(x) <= WORLD2.halfCell && Math.abs(lz) <= WORLD2.halfCell) return 'dark_realm';
    if (lz < -WORLD2.halfCell) return 'ominous_cave';
    // 남쪽 끝의 2세계 태초마을 (고블린 숲보다 먼저 확인해야 한다)
    if (lz > WORLD2.halfCell * 3) return 'village_w2';
    if (lz > WORLD2.halfCell) return 'goblin_forest';
    if (x > WORLD2.halfCell) return 'sakura';
    return 'misty_plains';
  }
  if (Math.abs(x) <= WORLD.halfCell && Math.abs(z) <= WORLD.halfCell) return 'temple';
  if (x < -WORLD.halfCell) return x < -1500 ? 'village' : 'forest';
  if (x > WORLD.halfCell) return x > 1500 ? 'old_village' : 'savanna';
  if (z < -WORLD.halfCell) return 'graveyard';
  if (z > WORLD.halfCell) return 'jungle';
  return 'forest';
}

// 십자 형태의 통행 가능 영역으로 위치를 제한 (worldId 를 주면 그 세계 기준)
export function clampToWorld(p, worldId) {
  if (worldId === 3) {
    p.x = clamp(p.x, WORLD3.xMin, WORLD3.xMax);
    p.z = clamp(p.z, WORLD3.zMin, WORLD3.zMax);
    const ax = Math.abs(p.x);
    const lz = p.z - WORLD3.originZ;
    if (ax > WORLD3.halfCell && Math.abs(lz) > WORLD3.halfCell) {
      if (ax - WORLD3.halfCell < Math.abs(lz) - WORLD3.halfCell) {
        p.x = Math.sign(p.x) * (WORLD3.halfCell - 4);
      } else {
        p.z = WORLD3.originZ + Math.sign(lz) * (WORLD3.halfCell - 4);
      }
    }
    return p;
  }
  if (worldId === 2) {
    p.x = clamp(p.x, WORLD2.xMin, WORLD2.xMax);
    p.z = clamp(p.z, WORLD2.zMin, WORLD2.zMax);
    const ax = Math.abs(p.x);
    const lz = p.z - WORLD2.originZ;
    if (ax > WORLD2.halfCell && Math.abs(lz) > WORLD2.halfCell) {
      if (ax - WORLD2.halfCell < Math.abs(lz) - WORLD2.halfCell) {
        p.x = Math.sign(p.x) * (WORLD2.halfCell - 4);
      } else {
        p.z = WORLD2.originZ + Math.sign(lz) * (WORLD2.halfCell - 4);
      }
    }
    return p;
  }
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

export function isInsideWorld(x, z, worldId) {
  if (worldId === 3) {
    if (x < WORLD3.xMin || x > WORLD3.xMax || z < WORLD3.zMin || z > WORLD3.zMax) return false;
    return Math.abs(x) <= WORLD3.halfCell || Math.abs(z - WORLD3.originZ) <= WORLD3.halfCell;
  }
  if (worldId === 2) {
    if (x < WORLD2.xMin || x > WORLD2.xMax || z < WORLD2.zMin || z > WORLD2.zMax) return false;
    // 십자 통로(수직 · 수평) + 남쪽 2세계 태초마을 길
    return Math.abs(x) <= WORLD2.halfCell || Math.abs(z - WORLD2.originZ) <= WORLD2.halfCell;
  }
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
