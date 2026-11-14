// 직업별 3D 무기 메시 (검 / 활 / 단검 / 방패 / 지팡이)
import * as THREE from 'three';

const steel = () => new THREE.MeshStandardMaterial({ color: 0xd7dde2, roughness: 0.28, metalness: 0.85 });
const darkSteel = () => new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.45, metalness: 0.7 });
const wood = () => new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.85 });
const leather = () => new THREE.MeshStandardMaterial({ color: 0x3d2a1b, roughness: 0.95 });
const gold = () => new THREE.MeshStandardMaterial({ color: 0xd8b25e, roughness: 0.35, metalness: 0.8 });
const glowMat = (color, intensity) => new THREE.MeshStandardMaterial({
  color, emissive: color, emissiveIntensity: intensity === undefined ? 1.4 : intensity, roughness: 0.4,
});

function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  return m;
}

/* 검: 손잡이에서 +Y 방향으로 뻗음 */
export function buildSword() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 8), leather(), 0, 1.3, 0));
  g.add(mesh(new THREE.SphereGeometry(0.55, 8, 6), gold(), 0, -0.1, 0));
  g.add(mesh(new THREE.BoxGeometry(3.6, 0.55, 1.0), gold(), 0, 2.7, 0));
  g.add(mesh(new THREE.BoxGeometry(1.15, 7.2, 0.3), steel(), 0, 6.6, 0));
  const tip = mesh(new THREE.ConeGeometry(0.82, 1.8, 4), steel(), 0, 11.1, 0);
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  g.add(mesh(new THREE.BoxGeometry(0.26, 6.4, 0.36), darkSteel(), 0, 6.6, 0));
  g.add(mesh(new THREE.BoxGeometry(1.15, 0.3, 0.34), glowMat(0xffd27a, 0.6), 0, 3.05, 0));
  g.userData.tip = new THREE.Vector3(0, 12.2, 0);
  return g;
}

/* 활: 왼손에 세로로 들고 +Z 방향으로 조준 */
export function buildBow() {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -4.6, 0.1),
    new THREE.Vector3(0, -2.4, 1.25),
    new THREE.Vector3(0, 0, 1.6),
    new THREE.Vector3(0, 2.4, 1.25),
    new THREE.Vector3(0, 4.6, 0.1),
  ]);
  const limbGeo = new THREE.TubeGeometry(curve, 24, 0.26, 7, false);
  const limb = new THREE.Mesh(limbGeo, wood());
  limb.castShadow = true;
  g.add(limb);

  for (const y of [-4.6, 4.6]) {
    const tipDeco = mesh(new THREE.SphereGeometry(0.36, 8, 6), gold(), 0, y, 0.1);
    g.add(tipDeco);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 2.4, 8), leather(), 0, 0, 1.15));

  const stringMat = new THREE.MeshBasicMaterial({ color: 0xe8e2cf });
  const stringGroup = new THREE.Group();
  const upper = mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 4), stringMat, 0, 2.3, 0.1);
  const lower = mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 4), stringMat, 0, -2.3, 0.1);
  stringGroup.add(upper, lower);
  g.add(stringGroup);

  // 시위에 걸린 화살 (발사 시 잠깐 보임)
  const arrow = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.07, 0.07, 5.2, 5), wood(), 0, 0, 0);
  shaft.rotation.x = Math.PI / 2;
  arrow.add(shaft);
  const head = mesh(new THREE.ConeGeometry(0.26, 0.9, 4), steel(), 0, 0, 2.9);
  head.rotation.x = Math.PI / 2;
  arrow.add(head);
  arrow.position.set(0, 0, 0.4);
  arrow.visible = false;
  g.add(arrow);

  g.userData.tip = new THREE.Vector3(0, 0, 1.6);
  g.userData.string = stringGroup;
  g.userData.arrow = arrow;
  return g;
}

/* 단검: 짧은 칼날 */
export function buildDagger() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 8), leather(), 0, 0.85, 0));
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.32, 0.6), darkSteel(), 0, 1.8, 0));
  g.add(mesh(new THREE.BoxGeometry(0.72, 3.4, 0.22), new THREE.MeshStandardMaterial({
    color: 0xc8d2dc, roughness: 0.2, metalness: 0.9, emissive: 0x2a1f4a, emissiveIntensity: 0.6,
  }), 0, 3.7, 0));
  const tip = mesh(new THREE.ConeGeometry(0.5, 1.2, 4), steel(), 0, 5.9, 0);
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  g.userData.tip = new THREE.Vector3(0, 6.6, 0);
  return g;
}

/* 방패 */
export function buildShield() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.9, 8.4, 6.6), new THREE.MeshStandardMaterial({
    color: 0x8a96a3, roughness: 0.35, metalness: 0.72,
  }), 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(1.05, 9.0, 7.2), gold(), 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(1.0, 7.6, 5.8), new THREE.MeshStandardMaterial({
    color: 0x5c6a78, roughness: 0.4, metalness: 0.7,
  }), 0.12, 0, 0));
  const boss = mesh(new THREE.SphereGeometry(1.9, 12, 8), gold(), 0.7, 0.4, 0);
  boss.scale.set(0.7, 1, 1);
  g.add(boss);
  for (const z of [-2.6, 2.6]) {
    for (const y of [-3.2, 3.2]) {
      g.add(mesh(new THREE.SphereGeometry(0.42, 6, 5), darkSteel(), 0.6, y, z));
    }
  }
  g.userData.tip = new THREE.Vector3(0.9, 0, 0);
  return g;
}

/* 보조 철퇴 */
export function buildMace() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 3.4, 8), leather(), 0, 1.7, 0));
  g.add(mesh(new THREE.DodecahedronGeometry(1.5, 0), darkSteel(), 0, 4.0, 0));
  for (let i = 0; i < 4; i++) {
    const spike = mesh(new THREE.ConeGeometry(0.42, 1.4, 4), steel(), 0, 0, 0);
    spike.position.set(Math.cos(i * Math.PI / 2) * 1.5, 4.0, Math.sin(i * Math.PI / 2) * 1.5);
    spike.rotation.z = -Math.PI / 2;
    spike.rotation.y = -i * Math.PI / 2;
    g.add(spike);
  }
  g.userData.tip = new THREE.Vector3(0, 5.4, 0);
  return g;
}

/* 지팡이: 끝에 마력 구체 */
export function buildStaff() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.44, 10.4, 7), wood(), 0, 5.2, 0));
  for (const y of [1.4, 4.6, 7.6]) {
    g.add(mesh(new THREE.TorusGeometry(0.52, 0.13, 5, 10), gold(), 0, y, 0));
  }
  const claw = mesh(new THREE.TorusGeometry(1.5, 0.26, 6, 12), gold(), 0, 11.4, 0);
  claw.rotation.x = Math.PI / 2;
  g.add(claw);
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xc79bff, emissive: 0x9a5cff, emissiveIntensity: 2.2, roughness: 0.2, transparent: true, opacity: 0.95,
  });
  g.add(mesh(new THREE.SphereGeometry(1.25, 14, 10), orbMat, 0, 11.6, 0));
  g.add(mesh(new THREE.SphereGeometry(1.85, 12, 8), new THREE.MeshBasicMaterial({
    color: 0xb98cff, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false,
  }), 0, 11.6, 0));
  g.userData.tip = new THREE.Vector3(0, 11.6, 0);
  return g;
}

export function buildWeapons(classId) {
  const out = { right: null, left: null };
  if (classId === 'warrior') out.right = buildSword();
  else if (classId === 'archer') out.left = buildBow();
  else if (classId === 'rogue') { out.right = buildDagger(); out.left = buildDagger(); out.left.scale.setScalar(0.88); }
  else if (classId === 'tanker') { out.left = buildShield(); out.right = buildMace(); }
  else if (classId === 'mage') out.right = buildStaff();
  return out;
}
