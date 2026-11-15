// 직업별 3D 무기 메시 (검 / 활 / 단검 / 방패 / 지팡이)
// tier: 0 = 기본 장비, 1 = 1세계 상점 Tier 2, 2 = 1세계 Tier 3,
//       3 = 2세계 상점 Tier 4 (심연), 4 = 2세계 Tier 5 (불멸) — 단계별로 재질 · 광택 · 크기가 좋아진다
import * as THREE from 'three';

const TIERS = [
  {
    blade: 0xd7dde2, metalness: 0.85, roughness: 0.28,
    trim: 0xd8b25e, trimMetal: 0.8, trimRough: 0.35,
    glow: 0, glowColor: 0xffd27a, scale: 1.0, wood: 0x6a4a2c,
    shield: 0x8a96a3, orb: 0xc79bff, orbEmissive: 0x9a5cff,
  },
  {
    blade: 0xeaf2fb, metalness: 0.96, roughness: 0.16,
    trim: 0xf0d98e, trimMetal: 0.92, trimRough: 0.22,
    glow: 0.45, glowColor: 0x9fd8ff, scale: 1.06, wood: 0x6a4a2c,
    shield: 0x9fb0bf, orb: 0x9fd8ff, orbEmissive: 0x3fa0e0,
  },
  {
    blade: 0xfff2c8, metalness: 0.98, roughness: 0.1,
    trim: 0xffd24a, trimMetal: 0.96, trimRough: 0.14,
    glow: 1.0, glowColor: 0xffb347, scale: 1.12, wood: 0x6f3f1e,
    shield: 0xa8b4c4, orb: 0xffd27a, orbEmissive: 0xffa020,
  },
  // 2세계 Tier 4 — 심연 · 별빛 흑요석
  {
    blade: 0xd7c8ff, metalness: 0.62, roughness: 0.13,
    trim: 0x9a6cff, trimMetal: 0.94, trimRough: 0.16,
    glow: 1.4, glowColor: 0x9f6cff, scale: 1.18, wood: 0x2a1f3a,
    shield: 0x8f7fcf, orb: 0xb98cff, orbEmissive: 0x7a2fd0,
  },
  // 2세계 Tier 5 — 불멸 · 태초의 빛
  {
    blade: 0xfff8dc, metalness: 0.98, roughness: 0.07,
    trim: 0xffcf6a, trimMetal: 0.97, trimRough: 0.12,
    glow: 2.0, glowColor: 0xff8a3c, scale: 1.26, wood: 0x3a2a18,
    shield: 0xd8b56a, orb: 0xffe6b0, orbEmissive: 0xff8a20,
  },
];

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
      opacity: st.idx >= 3 ? 0.22 : (st.idx >= 2 ? 0.15 : 0.075),
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  m.position.y = y;
  g.add(m);
}

/* 검: 손잡이에서 +Y 방향으로 뻗음 */
export function buildSword(tier) {
  const st = styleFor(tier);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 8), st.leather(), 0, 1.3, 0));
  g.add(mesh(new THREE.SphereGeometry(0.55, 8, 6), st.gold(), 0, -0.1, 0));
  g.add(mesh(new THREE.BoxGeometry(3.6, 0.55, 1.0), st.gold(), 0, 2.7, 0));
  g.add(mesh(new THREE.BoxGeometry(1.15, 7.2, 0.3), st.steel(), 0, 6.6, 0));
  const tip = mesh(new THREE.ConeGeometry(0.82, 1.8, 4), st.steel(), 0, 11.1, 0);
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  g.add(mesh(new THREE.BoxGeometry(0.26, 6.4, 0.36), st.dark(), 0, 6.6, 0));
  g.add(mesh(new THREE.BoxGeometry(1.15, 0.3, 0.34), st.glow(0xffd27a, 0.6), 0, 3.05, 0));
  if (st.idx > 0) {
    // 날을 따라 흐르는 발광선
    g.add(mesh(new THREE.BoxGeometry(0.5, 7.0, 0.12), st.glow(st.t.glowColor, 2.2), 0, 6.6, 0.18));
  }
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
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 8), st.leather(), 0, 0.85, 0));
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.32, 0.6), st.dark(), 0, 1.8, 0));
  g.add(mesh(new THREE.BoxGeometry(0.72, 3.4, 0.22), new THREE.MeshStandardMaterial({
    color: st.t.blade, roughness: st.t.roughness, metalness: 0.9,
    emissive: st.t.glow ? st.t.glowColor : 0x2a1f4a, emissiveIntensity: st.t.glow ? 0.8 : 0.6,
  }), 0, 3.7, 0));
  const tip = mesh(new THREE.ConeGeometry(0.5, 1.2, 4), st.steel(), 0, 5.9, 0);
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  if (st.idx > 0) g.add(mesh(new THREE.BoxGeometry(0.32, 3.2, 0.1), st.glow(st.t.glowColor, 2.2), 0, 3.7, 0.14));
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
  g.add(mesh(new THREE.SphereGeometry(1.25, 14, 10), orbMat, 0, 11.6, 0));
  g.add(mesh(new THREE.SphereGeometry(1.85, 12, 8), new THREE.MeshBasicMaterial({
    color: orbColor, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false,
  }), 0, 11.6, 0));
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
    out.left.scale.setScalar(0.88 * (out.left.userData.tier >= 1 ? 1.12 : 1));
  } else if (classId === 'tanker') {
    out.left = buildShield(tier);
    out.right = buildMace(tier);
  } else if (classId === 'mage') out.right = buildStaff(tier);
  return out;
}
