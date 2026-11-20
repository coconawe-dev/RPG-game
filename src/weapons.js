// 직업별 3D 무기 메시 (검 / 활 / 단검 / 방패 / 지팡이)
// tier: 0 = 기본 장비,
//       1 ~ 5 = 1세계 상점 (표시 Tier 2 ~ 6 · 강철 → 황금),
//       6 ~ 10 = 2세계 상점 (표시 Tier 7 ~ 11 · 흑요석 → 불멸),
//       11 ~ 15 = 3세계 상점 (표시 Tier 12 ~ 16 · 용비늘 → 창세)
//   단계마다 재질 · 광택 · 크기 · 룬 장식 수가 좋아진다 (15단계 전부 눈에 띄게 다르다).
import * as THREE from 'three';

// 기본 장비 (맨 처음 시작할 때의 무기)
const STARTER = {
  blade: 0xd7dde2, metalness: 0.85, roughness: 0.28,
  trim: 0xd8b25e, trimMetal: 0.8, trimRough: 0.35,
  glow: 0, glowColor: 0xffd27a, scale: 1.0, wood: 0x6a4a2c,
  shield: 0x8a96a3, orb: 0xc79bff, orbEmissive: 0x9a5cff, accents: 0,
};

/* 세계별 색 여정 — 1세계: 강철 → 황금 / 2세계: 흑요석 → 불멸 / 3세계: 용비늘 → 창세
   (한 세계 안에서 5단계로 색이 바뀌고, 세계가 바뀌면 색 계열 자체가 달라진다) */
const GRADE_COLORS = [
  // 1세계 (내부 1 ~ 5)
  { blade: 0xe8f1fb, trim: 0xd8b25e, glowColor: 0x9fd8ff, shield: 0x9fb0bf, wood: 0x6a4a2c },
  { blade: 0xdce9f7, trim: 0xcbd8e4, glowColor: 0x6fc8ff, shield: 0xa8b8c8, wood: 0x6a4a2c },
  { blade: 0xf2f6ef, trim: 0xc9a24a, glowColor: 0xffe28a, shield: 0xb0bccc, wood: 0x6f4220 },
  { blade: 0xffeec9, trim: 0xe8c05a, glowColor: 0xffce6a, shield: 0xc8b68a, wood: 0x6f3f1e },
  { blade: 0xfff2c8, trim: 0xffd24a, glowColor: 0xffb347, shield: 0xa8b4c4, wood: 0x6f3f1e },
  // 2세계 (내부 6 ~ 10)
  { blade: 0xc0a8f5, trim: 0x9a6cff, glowColor: 0x9f6cff, shield: 0x8f7fcf, wood: 0x2a1f3a },
  { blade: 0xa9bcff, trim: 0x7c8cff, glowColor: 0x6f8cff, shield: 0x8f9ad8, wood: 0x272038 },
  { blade: 0xcfffe8, trim: 0x8fa8ff, glowColor: 0x6fd8ff, shield: 0x8fc8d8, wood: 0x2c2a44 },
  { blade: 0xffe9c9, trim: 0xd8a8ff, glowColor: 0xffb066, shield: 0xd8b8d8, wood: 0x33281c },
  { blade: 0xfff8dc, trim: 0xffcf6a, glowColor: 0xff8a3c, shield: 0xd8b56a, wood: 0x3a2a18 },
  // 3세계 (내부 11 ~ 15)
  { blade: 0xd8ffe8, trim: 0x8ef0c0, glowColor: 0x4ff0a8, shield: 0x8fd8b0, wood: 0x1f3a2c },
  { blade: 0xe8ffc9, trim: 0xa8f0d8, glowColor: 0x9fff6a, shield: 0xa8d8c0, wood: 0x24382a },
  { blade: 0xd8f0ff, trim: 0x8fd8ff, glowColor: 0x6fc8ff, shield: 0xa8c8e0, wood: 0x223a3a },
  { blade: 0xfff0e0, trim: 0xffd8a8, glowColor: 0xffb0d8, shield: 0xe0d0c0, wood: 0x3a3220 },
  { blade: 0xffffff, trim: 0xfff0b8, glowColor: 0xfff2a0, shield: 0xffe9a8, wood: 0x4a3a1c },
];

const r2 = (v) => Math.round(v * 100) / 100;

// 상점 등급 하나의 재질 값 — 등급이 오를수록 더 매끈하고 더 밝게 빛난다
function shopTier(i, c) {
  const orb = c.glowColor;
  const orbEmissive = new THREE.Color(orb).multiplyScalar(0.62).getHex();
  return {
    blade: c.blade,
    metalness: r2(0.86 + 0.0095 * i),
    roughness: r2(Math.max(0.045, 0.27 - 0.0145 * i)),
    trim: c.trim,
    trimMetal: r2(Math.min(0.99, 0.84 + 0.011 * i)),
    trimRough: r2(Math.max(0.08, 0.34 - 0.017 * i)),
    glow: r2(0.45 + 0.17 * (i - 1)),
    glowColor: c.glowColor,
    scale: r2(1.0 + 0.035 * i),
    wood: c.wood,
    shield: c.shield,
    orb,
    orbEmissive,
    accents: 1 + Math.floor(i / 5),   // 룬 보석 개수 (1 ~ 4)
  };
}

const TIERS = [STARTER].concat(GRADE_COLORS.map((c, k) => shopTier(k + 1, c)));

function tierIndex(tier) {
  const t = tier === undefined || tier === null ? 0 : tier;
  const last = TIERS.length - 1;
  return t < 0 ? 0 : (t > last ? last : Math.round(t));
}

function styleFor(tier) {
  const idx = tierIndex(tier);
  const t = TIERS[idx];
  return {
    idx,
    t,
    steel: () => new THREE.MeshStandardMaterial({
      color: t.blade, roughness: t.roughness, metalness: t.metalness,
      emissive: t.glow ? t.glowColor : 0x000000, emissiveIntensity: t.glow * 0.32,
    }),
    dark: () => new THREE.MeshStandardMaterial({
      color: 0x4a4f57, roughness: 0.45, metalness: 0.7,
      emissive: t.glow ? t.glowColor : 0x000000, emissiveIntensity: t.glow * 0.12,
    }),
    wood: () => new THREE.MeshStandardMaterial({
      color: t.wood, roughness: 0.85,
    }),
    leather: () => new THREE.MeshStandardMaterial({ color: 0x3d2a1b, roughness: 0.95 }),
    gold: () => new THREE.MeshStandardMaterial({
      color: t.trim, roughness: t.trimRough, metalness: t.trimMetal,
      emissive: t.glow ? t.trim : 0x000000, emissiveIntensity: t.glow * 0.28,
    }),
    glow: (color, intensity) => new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: intensity === undefined ? 1.4 : intensity, roughness: 0.4,
    }),
  };
}

function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  return m;
}

// 손잡이(그립) 지점을 그룹 원점으로 옮긴다.
// 그러면 손 뼈(주먹 중심)에 그대로 붙였을 때 손잡이가 주먹을 지나가고,
// 회전을 어떻게 주든 쥔 자리가 어긋나지 않는다.
function gripAt(g, x, y, z) {
  const off = new THREE.Vector3(x || 0, y || 0, z || 0);
  if (!off.lengthSq()) return g;
  g.children.forEach((c) => c.position.sub(off));
  if (g.userData.tip) g.userData.tip.sub(off);
  return g;
}

// 상위 티어는 무기 둘레에 옅은 빛무리를 더해 손에서 바로 눈에 띄게 한다
function addAura(g, st, radius, height, y, color) {
  if (!st.t.glow) return;
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.68, height, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: color || st.t.glowColor, transparent: true,
      opacity: st.idx >= 11 ? 0.36 : (st.idx >= 6 ? 0.28 : (st.idx >= 3 ? 0.2 : (st.idx >= 1 ? 0.12 : 0.075))),
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  m.position.y = y;
  g.add(m);
  // 3세계 무기(내부 11 이상)는 빛무리를 한 겹 더 두른다
  if (st.idx >= 11) {
    const m2 = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.5, radius * 1.05, height * 1.1, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: color || st.t.glowColor, transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    m2.position.y = y;
    g.add(m2);
  }
}

// 등급마다 보석(룬)을 날에 박아 단계 차이를 3D 에서도 바로 보이게 한다
function addGems(g, st, list, size) {
  const n = Math.min(st.t.accents || 0, list.length);
  const mat = st.glow(st.t.glowColor, 2.4);
  for (let k = 0; k < n; k++) {
    const p = list[k];
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), mat);
    gem.position.set(p[0], p[1], p[2]);
    gem.castShadow = true;
    g.add(gem);
  }
}

/* 검: 손잡이에서 +Y 방향으로 뻗음 */
export function buildSword(tier) {
  const st = styleFor(tier);
  const g = new THREE.Group();
  const wide = 1.15 + st.idx * 0.022;          // 등급이 오르면 날이 조금씩 넓어진다
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 8), st.leather(), 0, 1.3, 0));
  g.add(mesh(new THREE.SphereGeometry(0.55, 8, 6), st.gold(), 0, -0.1, 0));
  g.add(mesh(new THREE.BoxGeometry(3.6, 0.55, 1.0), st.gold(), 0, 2.7, 0));
  g.add(mesh(new THREE.BoxGeometry(wide, 7.2, 0.3), st.steel(), 0, 6.6, 0));
  const tip = mesh(new THREE.ConeGeometry(0.82 * wide / 1.15, 1.8, 4), st.steel(), 0, 11.1, 0);
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  g.add(mesh(new THREE.BoxGeometry(0.26, 6.4, 0.36), st.dark(), 0, 6.6, 0));
  g.add(mesh(new THREE.BoxGeometry(wide, 0.3, 0.34), st.glow(0xffd27a, 0.6), 0, 3.05, 0));
  if (st.idx > 0) {
    // 날을 따라 흐르는 발광선
    g.add(mesh(new THREE.BoxGeometry(0.5, 7.0, 0.12), st.glow(st.t.glowColor, 2.2), 0, 6.6, 0.18));
  }
  addGems(g, st, [[0, 4.6, 0.34], [0, 7.0, 0.34], [0, 9.2, 0.34], [0, 5.8, -0.34]], 0.36);
  addAura(g, st, 2.4, 13.2, 6.4);
  g.scale.setScalar(st.t.scale);
  g.userData.tip = new THREE.Vector3(0, 12.2, 0);
  g.userData.tier = st.idx;
  return gripAt(g, 0, 1.3, 0); // 손잡이 가운데가 원점
}

/* 활: 왼손에 세로로 들고 +Z 방향으로 조준 */
export function buildBow(tier) {
  const st = styleFor(tier);
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -4.6, 0.1),
    new THREE.Vector3(0, -2.4, 1.25),
    new THREE.Vector3(0, 0, 1.6),
    new THREE.Vector3(0, 2.4, 1.25),
    new THREE.Vector3(0, 4.6, 0.1),
  ]);
  const limbGeo = new THREE.TubeGeometry(curve, 24, 0.42, 8, false);
  const limb = new THREE.Mesh(limbGeo, st.wood());
  limb.castShadow = true;
  g.add(limb);

  for (const y of [-4.6, 4.6]) {
    const tipDeco = mesh(new THREE.SphereGeometry(0.48, 8, 6), st.gold(), 0, y, 0.1);
    g.add(tipDeco);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.4, 8), st.leather(), 0, 0, 1.15));
  if (st.idx > 0) {
    // 상위 티어: 활몸에 금속 테
    const band = mesh(new THREE.TorusGeometry(2.6, 0.16, 5, 14), st.gold(), 0, 0, 1.1);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  if (st.idx >= 6) {
    // 2세계 이상: 활몸을 감싸는 빛 고리
    for (const y of [-2.6, 2.6]) {
      const ring = mesh(new THREE.TorusGeometry(1.9, 0.1, 5, 16), st.glow(st.t.glowColor, 1.8), 0, y, 1.0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }
  }
  addGems(g, st, [[0, 1.35, 1.35], [0, -1.35, 1.35], [0, 0.7, 1.55], [0, -0.7, 1.55]], 0.3);

  const stringMat = new THREE.MeshBasicMaterial({ color: 0xe8e2cf });
  const stringGroup = new THREE.Group();
  const upper = mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.6, 4), stringMat, 0, 2.3, 0.1);
  const lower = mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.6, 4), stringMat, 0, -2.3, 0.1);
  stringGroup.add(upper, lower);
  g.add(stringGroup);

  // 시위에 걸린 화살 (발사 시 잠깐 보임)
  const arrow = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.07, 0.07, 5.2, 5), st.wood(), 0, 0, 0);
  shaft.rotation.x = Math.PI / 2;
  arrow.add(shaft);
  const head = mesh(new THREE.ConeGeometry(0.26, 0.9, 4), st.steel(), 0, 0, 2.9);
  head.rotation.x = Math.PI / 2;
  arrow.add(head);
  arrow.position.set(0, 0, 0.4);
  arrow.visible = false;
  g.add(arrow);
  addAura(g, st, 2.0, 10.4, 0, st.t.glowColor);

  g.scale.setScalar(st.t.scale);
  g.userData.tip = new THREE.Vector3(0, 0, 1.6);
  g.userData.string = stringGroup;
  g.userData.arrow = arrow;
  g.userData.tier = st.idx;
  return gripAt(g, 0, 0, 1.15); // 가죽 손잡이가 원점 (활몸이 앞으로 나온다)
}

/* 단검: 짧은 칼날 */
export function buildDagger(tier) {
  const st = styleFor(tier);
  const g = new THREE.Group();
  const wide = 0.72 + st.idx * 0.018;
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 8), st.leather(), 0, 0.85, 0));
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.32, 0.6), st.dark(), 0, 1.8, 0));
  g.add(mesh(new THREE.BoxGeometry(wide, 3.4, 0.22), new THREE.MeshStandardMaterial({
    color: st.t.blade, roughness: st.t.roughness, metalness: 0.9,
    emissive: st.t.glow ? st.t.glowColor : 0x2a1f4a, emissiveIntensity: st.t.glow ? 0.8 : 0.6,
  }), 0, 3.7, 0));
  const tip = mesh(new THREE.ConeGeometry(0.5 * wide / 0.72, 1.2, 4), st.steel(), 0, 5.9, 0);
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  if (st.idx > 0) g.add(mesh(new THREE.BoxGeometry(0.32, 3.2, 0.1), st.glow(st.t.glowColor, 2.2), 0, 3.7, 0.14));
  if (st.idx >= 6) {
    // 2세계 이상: 손잡이 끝에 보석
    g.add(mesh(new THREE.OctahedronGeometry(0.34, 0), st.glow(st.t.glowColor, 2.6), 0, -0.25, 0));
  }
  addGems(g, st, [[0, 2.9, 0.16], [0, 4.5, 0.16], [0, 3.6, -0.16], [0, 5.2, 0.16]], 0.22);
  addAura(g, st, 1.8, 7.2, 3.6);
  g.scale.setScalar(st.t.scale);
  g.userData.tip = new THREE.Vector3(0, 6.6, 0);
  g.userData.tier = st.idx;
  return gripAt(g, 0, 0.85, 0); // 손잡이 가운데가 원점
}

/* 방패 */
export function buildShield(tier) {
  const st = styleFor(tier);
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.9, 8.4, 6.6), new THREE.MeshStandardMaterial({
    color: st.t.shield, roughness: st.t.roughness * 0.9, metalness: 0.72,
    emissive: st.t.glow ? st.t.glowColor : 0x000000, emissiveIntensity: st.t.glow * 0.2,
  }), 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(1.05, 9.0, 7.2), st.gold(), 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(1.0, 7.6, 5.8), new THREE.MeshStandardMaterial({
    color: 0x5c6a78, roughness: 0.4, metalness: 0.7,
  }), 0.12, 0, 0));
  const boss = mesh(new THREE.SphereGeometry(1.9, 12, 8), st.gold(), 0.7, 0.4, 0);
  boss.scale.set(0.7, 1, 1);
  g.add(boss);
  for (const z of [-2.6, 2.6]) {
    for (const y of [-3.2, 3.2]) {
      g.add(mesh(new THREE.SphereGeometry(0.42, 6, 5), st.dark(), 0.6, y, z));
    }
  }
  if (st.idx > 0) {
    const rim = mesh(new THREE.TorusGeometry(3.4, 0.24, 6, 18), st.glow(st.t.glowColor, 1.8), 0.4, 0, 0);
    rim.rotation.y = Math.PI / 2;
    rim.scale.set(1, 1.15, 1);
    g.add(rim);
  }
  if (st.idx >= 11) {
    // 3세계 방패: 가장자리를 따라 빛나는 못
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.add(mesh(new THREE.OctahedronGeometry(0.3, 0), st.glow(st.t.glowColor, 2.4), 0.75, Math.sin(a) * 3.6, Math.cos(a) * 2.9));
    }
  }
  addGems(g, st, [[1.4, 0.4, 0], [1.4, 2.2, 1.6], [1.4, -1.4, -1.6], [1.4, 2.2, -1.6]], 0.34);
  addAura(g, st, 3.8, 10.0, 0);
  g.scale.setScalar(st.t.scale);
  g.userData.tip = new THREE.Vector3(0.9, 0, 0);
  g.userData.tier = st.idx;
  return gripAt(g, -0.75, 0, 0); // 앞면(보스)이 주먹 앞쪽, 팔은 방패 뒤
}

/* 보조 철퇴 */
export function buildMace(tier) {
  const st = styleFor(tier);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 3.4, 8), st.leather(), 0, 1.7, 0));
  g.add(mesh(new THREE.DodecahedronGeometry(1.5, 0), st.dark(), 0, 4.0, 0));
  for (let i = 0; i < 4; i++) {
    const spike = mesh(new THREE.ConeGeometry(0.42, 1.4, 4), st.steel(), 0, 0, 0);
    spike.position.set(Math.cos(i * Math.PI / 2) * 1.5, 4.0, Math.sin(i * Math.PI / 2) * 1.5);
    spike.rotation.z = -Math.PI / 2;
    spike.rotation.y = -i * Math.PI / 2;
    g.add(spike);
  }
  if (st.idx > 0) g.add(mesh(new THREE.TorusGeometry(1.5, 0.16, 5, 14), st.gold(), 0, 2.4, 0));
  addGems(g, st, [[1.6, 4.0, 0], [-1.6, 4.0, 0], [0, 5.5, 0], [0, 2.6, 1.6]], 0.28);
  addAura(g, st, 2.4, 6.4, 3.2);
  g.scale.setScalar(st.t.scale);
  g.userData.tip = new THREE.Vector3(0, 5.4, 0);
  g.userData.tier = st.idx;
  return gripAt(g, 0, 0.55, 0); // 자루 아래쪽(손잡이)이 원점, 머리는 앞으로
}

/* 지팡이: 끝에 마력 구체 */
export function buildStaff(tier) {
  const st = styleFor(tier);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.44, 10.4, 7), st.wood(), 0, 5.2, 0));
  for (const y of [1.4, 4.6, 7.6]) {
    g.add(mesh(new THREE.TorusGeometry(0.52, 0.13, 5, 10), st.gold(), 0, y, 0));
  }
  const claw = mesh(new THREE.TorusGeometry(1.5, 0.26, 6, 12), st.gold(), 0, 11.4, 0);
  claw.rotation.x = Math.PI / 2;
  g.add(claw);
  const orbColor = st.t.orb;
  const orbMat = new THREE.MeshStandardMaterial({
    color: orbColor, emissive: st.t.orbEmissive,
    emissiveIntensity: 2.2, roughness: 0.2, transparent: true, opacity: 0.95,
  });
  g.add(mesh(new THREE.SphereGeometry(1.25 + st.idx * 0.012, 14, 10), orbMat, 0, 11.6, 0));
  g.add(mesh(new THREE.SphereGeometry(1.85 + st.idx * 0.02, 12, 8), new THREE.MeshBasicMaterial({
    color: orbColor, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false,
  }), 0, 11.6, 0));
  if (st.idx >= 6) {
    // 2세계 이상: 구체를 도는 작은 빛 고리
    const halo = mesh(new THREE.TorusGeometry(1.8, 0.08, 5, 16), st.glow(orbColor, 1.9), 0, 11.6, 0);
    halo.rotation.x = Math.PI / 2.4;
    g.add(halo);
  }
  addGems(g, st, [[0, 8.9, 0.6], [0, 9.6, -0.6], [0, 2.2, 0.6], [0, 5.4, -0.6]], 0.3);
  addAura(g, st, 2.2, 12.0, 6.0, orbColor);
  g.scale.setScalar(st.t.scale);
  g.userData.tip = new THREE.Vector3(0, 11.6, 0);
  g.userData.orbMat = orbMat;
  g.userData.tier = st.idx;
  return gripAt(g, 0, 3.4, 0); // 자루 중간 아래를 쥔다 (맨 끝 마개가 아니라)
}

export function buildWeapons(classId, tier) {
  const out = { right: null, left: null };
  if (classId === 'warrior') out.right = buildSword(tier);
  else if (classId === 'archer') out.left = buildBow(tier);
  else if (classId === 'rogue') {
    out.right = buildDagger(tier);
    out.left = buildDagger(tier);
    out.left.scale.multiplyScalar(0.88);
  } else if (classId === 'tanker') {
    out.left = buildShield(tier);
    out.right = buildMace(tier);
  } else if (classId === 'mage') out.right = buildStaff(tier);
  return out;
}
