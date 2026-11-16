// 몹: 슬라임 · 좀비 · 하이에나 · 고릴라 · 고대 골렘(보스) + AI
import * as THREE from 'three';
import { BIOMES, BIOME_ORDER, BIOME_ORDER_W2, MOB_TYPES, BOSS_POS, BOSS2_POS } from './config.js';
import { terrainHeight, clamp, damp, dampAngle, rand, TAU, lerp, WORLD, WORLD2, clampToWorld } from './utils.js';

function mkMesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function stdMat(color, opts) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0.05 }, opts || {}));
}

/* ------------------------------- 모델 ------------------------------- */
function buildSlime() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const bodyMat = stdMat(0x63d06d, { roughness: 0.25, transparent: true, opacity: 0.9, emissive: 0x1f6b2c, emissiveIntensity: 0.45 });
  mats.push(bodyMat);
  const coreMat = stdMat(0x2f8f3f, { roughness: 0.5, emissive: 0x0f3a18, emissiveIntensity: 0.6 });
  mats.push(coreMat);
  const b = mkMesh(new THREE.SphereGeometry(6.4, 18, 14), bodyMat, 0, 5.0, 0);
  b.scale.set(1, 0.78, 1);
  body.add(b);
  const core = mkMesh(new THREE.SphereGeometry(3.2, 12, 10), coreMat, 0, 4.2, 0);
  body.add(core);
  const eyeMat = stdMat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 });
  const pupilMat = stdMat(0x142018);
  mats.push(eyeMat, pupilMat);
  for (const s of [-1, 1]) {
    body.add(mkMesh(new THREE.SphereGeometry(1.25, 10, 8), eyeMat, s * 2.1, 6.2, 4.9));
    body.add(mkMesh(new THREE.SphereGeometry(0.62, 8, 6), pupilMat, s * 2.1, 6.15, 5.85));
  }
  return { root, body, mats, height: 12 };
}

function buildZombie() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const skinMat = stdMat(0x86a379, { roughness: 0.9 });
  const clothMat = stdMat(0x40412f, { roughness: 1 });
  const darkMat = stdMat(0x2b2c22, { roughness: 1 });
  mats.push(skinMat, clothMat, darkMat);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(1.5, 7, 0);
  legR.position.set(-1.5, 7, 0);
  legL.add(mkMesh(new THREE.BoxGeometry(1.9, 7, 2.1), darkMat, 0, -3.5, 0));
  legR.add(mkMesh(new THREE.BoxGeometry(1.9, 7, 2.1), darkMat, 0, -3.5, 0));
  body.add(legL, legR);

  const torso = new THREE.Group();
  torso.position.y = 7;
  body.add(torso);
  torso.add(mkMesh(new THREE.BoxGeometry(4.8, 6.4, 2.9), clothMat, 0, 3.2, 0));
  torso.add(mkMesh(new THREE.BoxGeometry(5.2, 1.0, 3.2), skinMat, 0, 0.4, 0));
  torso.add(mkMesh(new THREE.BoxGeometry(2.2, 2.4, 0.5), clothMat, 0.8, 4.0, 1.6));
  torso.add(mkMesh(new THREE.BoxGeometry(3.4, 3.4, 3.2), skinMat, 0, 7.4, 0.2));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c });
  for (const s of [-1, 1]) {
    torso.add(mkMesh(new THREE.SphereGeometry(0.42, 6, 5), eyeMat, s * 0.8, 7.9, 1.7));
  }
  torso.add(mkMesh(new THREE.BoxGeometry(1.6, 0.4, 0.3), darkMat, 0, 6.4, 1.75));

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(3.0, 5.6, 0);
  armR.position.set(-3.0, 5.6, 0);
  for (const arm of [armL, armR]) {
    arm.rotation.x = -1.45;
    arm.add(mkMesh(new THREE.BoxGeometry(1.6, 5.6, 1.7), skinMat, 0, -2.8, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(1.8, 1.5, 1.9), skinMat, 0, -5.8, 0));
    torso.add(arm);
  }
  return { root, body, torso, legL, legR, armL, armR, mats, height: 18 };
}

function buildHyena() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const furMat = stdMat(0x9d7c4c, { roughness: 0.95 });
  const darkMat = stdMat(0x5f4a2c, { roughness: 1 });
  const spotMat = stdMat(0x4d3b22, { roughness: 1 });
  mats.push(furMat, darkMat, spotMat);

  body.add(mkMesh(new THREE.BoxGeometry(3.8, 4.0, 8.6), furMat, 0, 8.2, 0));
  body.add(mkMesh(new THREE.BoxGeometry(3.2, 2.2, 3.4), darkMat, 0, 6.6, 0.4));
  // 목덜미 갈기
  for (let i = 0; i < 5; i++) {
    const spike = mkMesh(new THREE.ConeGeometry(0.7, 2.0, 4), darkMat, 0, 10.4 + (i % 2) * 0.3, 2.4 - i * 0.9);
    body.add(spike);
  }
  const head = new THREE.Group();
  head.position.set(0, 9.0, 4.6);
  body.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(3.2, 3.1, 3.4), furMat, 0, 0, 0));
  head.add(mkMesh(new THREE.BoxGeometry(2.1, 1.8, 2.4), darkMat, 0, -0.7, 2.4));
  head.add(mkMesh(new THREE.BoxGeometry(1.0, 0.6, 1.0), spotMat, 0, -0.8, 3.3));
  for (const s of [-1, 1]) {
    const ear = mkMesh(new THREE.ConeGeometry(0.75, 2.0, 4), darkMat, s * 1.0, 2.1, -0.2);
    ear.rotation.z = s * 0.2;
    head.add(ear);
    const eye = mkMesh(new THREE.SphereGeometry(0.35, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffcc55 }), s * 0.9, 0.3, 1.7);
    head.add(eye);
  }
  // 다리
  const legs = [];
  const legPositions = [[1.5, 3.0], [-1.5, 3.0], [1.5, -3.0], [-1.5, -3.0]];
  for (const lp of legPositions) {
    const leg = new THREE.Group();
    leg.position.set(lp[0], 6.6, lp[1]);
    leg.add(mkMesh(new THREE.BoxGeometry(1.2, 5.7, 1.3), furMat, 0, -2.85, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(1.5, 1.0, 2.0), darkMat, 0, -5.4, 0.3));
    body.add(leg);
    legs.push(leg);
  }
  // 꼬리
  const tail = mkMesh(new THREE.ConeGeometry(0.6, 4.0, 5), darkMat, 0, 9.4, -4.8);
  tail.rotation.x = -0.9;
  body.add(tail);
  // 점무늬
  for (let i = 0; i < 8; i++) {
    const s = mkMesh(new THREE.SphereGeometry(0.45, 5, 4), spotMat, (Math.random() - 0.5) * 3.4, 9.2 + Math.random() * 0.8, (Math.random() - 0.5) * 7);
    s.scale.set(1, 0.4, 1);
    body.add(s);
  }
  return { root, body, head, legs, mats, height: 12 };
}

function buildGorilla() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const furMat = stdMat(0x3d3d42, { roughness: 0.95 });
  const darkMat = stdMat(0x25252a, { roughness: 1 });
  const faceMat = stdMat(0x1e1e22, { roughness: 0.9 });
  const silverMat = stdMat(0x6a6a72, { roughness: 0.9 });
  mats.push(furMat, darkMat, faceMat, silverMat);

  const torso = mkMesh(new THREE.SphereGeometry(5.6, 14, 12), furMat, 0, 13.2, 0);
  torso.scale.set(1.0, 1.15, 0.85);
  body.add(torso);
  const chest = mkMesh(new THREE.SphereGeometry(4.2, 12, 10), silverMat, 0, 12.6, 1.6);
  chest.scale.set(1, 1.05, 0.5);
  body.add(chest);
  const head = new THREE.Group();
  head.position.set(0, 20.0, 1.2);
  body.add(head);
  head.add(mkMesh(new THREE.SphereGeometry(3.0, 12, 10), furMat, 0, 0, 0));
  head.add(mkMesh(new THREE.BoxGeometry(2.6, 1.6, 1.2), faceMat, 0, -0.3, 2.4));
  head.add(mkMesh(new THREE.BoxGeometry(3.4, 0.8, 1.0), darkMat, 0, 1.2, 2.2));
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(0.42, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd76a }), s * 1.0, 0.2, 2.4));
  }
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(4.6, 16.4, 0);
  armR.position.set(-4.6, 16.4, 0);
  for (const arm of [armL, armR]) {
    arm.add(mkMesh(new THREE.BoxGeometry(3.0, 8.6, 3.0), furMat, 0, -4.3, 0));
    arm.add(mkMesh(new THREE.SphereGeometry(2.1, 10, 8), darkMat, 0, -9.2, 0.2));
    body.add(arm);
  }
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(2.6, 6.6, 0);
  legR.position.set(-2.6, 6.6, 0);
  for (const leg of [legL, legR]) {
    leg.add(mkMesh(new THREE.BoxGeometry(2.6, 6.6, 3.0), darkMat, 0, -3.3, 0));
    body.add(leg);
  }
  return { root, body, head, armL, armR, legL, legR, mats, height: 22 };
}

function buildGolem() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const stoneMat = stdMat(0x8f9084, { roughness: 0.95, metalness: 0.08 });
  const darkStone = stdMat(0x65665c, { roughness: 1 });
  const mossMat = stdMat(0x4a7a44, { roughness: 1 });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x9ff4ff, emissive: 0x4fd8ff, emissiveIntensity: 3.2, roughness: 0.3,
  });
  mats.push(stoneMat, darkStone, mossMat);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(9, 15, 0);
  legR.position.set(-9, 15, 0);
  for (const leg of [legL, legR]) {
    leg.add(mkMesh(new THREE.BoxGeometry(8, 15, 9), stoneMat, 0, -7.5, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(9.5, 3, 11), darkStone, 0, -14, 0.6));
    body.add(leg);
  }
  body.add(mkMesh(new THREE.BoxGeometry(26, 9, 15), darkStone, 0, 21, 0));
  const torso = mkMesh(new THREE.BoxGeometry(30, 22, 17), stoneMat, 0, 34, 0);
  body.add(torso);
  body.add(mkMesh(new THREE.BoxGeometry(31, 2, 18), darkStone, 0, 26, 0));
  body.add(mkMesh(new THREE.BoxGeometry(31, 2, 18), darkStone, 0, 40, 0));
  // 가슴 코어
  const core = mkMesh(new THREE.SphereGeometry(4.6, 14, 10), coreMat, 0, 34, 9);
  body.add(core);
  const coreHalo = mkMesh(new THREE.SphereGeometry(6.4, 12, 9), new THREE.MeshBasicMaterial({
    color: 0x7fe8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
  }), 0, 34, 9);
  body.add(coreHalo);

  // 어깨 · 팔
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(19, 41, 0);
  armR.position.set(-19, 41, 0);
  for (const arm of [armL, armR]) {
    body.add(arm);
    arm.add(mkMesh(new THREE.BoxGeometry(12, 10, 13), darkStone, 0, 1, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(8.5, 16, 9), stoneMat, 0, -10, 0));
    const fist = mkMesh(new THREE.DodecahedronGeometry(6.2, 0), stoneMat, 0, -21, 0);
    arm.add(fist);
    arm.add(mkMesh(new THREE.BoxGeometry(9, 2, 9.6), mossMat, 0, -6, 0));
  }
  // 머리
  const head = new THREE.Group();
  head.position.set(0, 49, 1);
  body.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(11, 9.5, 10), stoneMat, 0, 0, 0));
  head.add(mkMesh(new THREE.BoxGeometry(12, 2.2, 11), darkStone, 0, 4.6, 0));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xa8f4ff });
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.BoxGeometry(2.4, 1.2, 0.8), eyeMat, s * 2.8, 1.4, 5.1));
  }
  head.add(mkMesh(new THREE.BoxGeometry(6, 1.4, 0.8), darkStone, 0, -2.8, 5.1));
  // 이끼 · 균열 장식
  for (let i = 0; i < 6; i++) {
    const m = mkMesh(new THREE.BoxGeometry(5 + Math.random() * 4, 1.2, 3 + Math.random() * 3), mossMat,
      (Math.random() - 0.5) * 22, 27 + Math.random() * 12, (Math.random() - 0.5) * 12);
    body.add(m);
  }
  return { root, body, head, armL, armR, legL, legR, core, coreMat, coreHalo, eyeMat, mats, height: 56 };
}

function buildRaider() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const leatherMat = stdMat(0x6b4f33, { roughness: 0.95 });
  const leatherDark = stdMat(0x4a3623, { roughness: 1 });
  const ironMat = stdMat(0x5c5c58, { roughness: 0.45, metalness: 0.75 });
  const hoodMat = stdMat(0x2b2620, { roughness: 1 });
  const bandMat = stdMat(0x7a2a26, { roughness: 0.9 });
  const skinMat = stdMat(0xb98d68, { roughness: 0.85 });
  mats.push(leatherMat, leatherDark, ironMat, hoodMat, bandMat, skinMat);

  // 다리 · 장화
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(1.7, 9, 0);
  legR.position.set(-1.7, 9, 0);
  for (const leg of [legL, legR]) {
    leg.add(mkMesh(new THREE.BoxGeometry(2.1, 6.4, 2.3), leatherDark, 0, -3.2, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(2.3, 2.4, 3.0), hoodMat, 0, -5.6, 0.4));
    body.add(leg);
  }

  // 몸통 — 입은 가죽 조끼 + 덧댄 철판
  const torso = new THREE.Group();
  torso.position.y = 9;
  body.add(torso);
  torso.add(mkMesh(new THREE.BoxGeometry(5.4, 6.4, 3.1), leatherMat, 0, 3.3, 0));
  torso.add(mkMesh(new THREE.BoxGeometry(3.4, 4.6, 0.6), ironMat, 0, 3.6, 1.6));
  torso.add(mkMesh(new THREE.BoxGeometry(5.6, 1.2, 3.3), leatherDark, 0, 0.5, 0));
  torso.add(mkMesh(new THREE.BoxGeometry(1.5, 1.4, 0.5), ironMat, 0, 0.5, 1.7));
  // 어깨 가죽
  for (const s of [-1, 1]) {
    const pad = mkMesh(new THREE.BoxGeometry(2.4, 1.6, 3.0), leatherDark, s * 3.1, 6.2, 0);
    pad.rotation.z = s * 0.25;
    torso.add(pad);
  }

  // 머리 — 어두운 두건 + 얼굴 가리개
  const head = new THREE.Group();
  head.position.set(0, 7.0, 0.2);
  torso.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(3.5, 3.5, 3.4), skinMat, 0, 1.9, 0));
  const hood = mkMesh(new THREE.SphereGeometry(2.4, 10, 8), hoodMat, 0, 2.5, -0.35);
  hood.scale.set(1.02, 0.92, 1.06);
  head.add(hood);
  head.add(mkMesh(new THREE.BoxGeometry(3.6, 1.3, 0.5), hoodMat, 0, 3.5, 1.7));
  head.add(mkMesh(new THREE.BoxGeometry(3.3, 1.5, 0.6), bandMat, 0, 1.1, 1.75));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffb060 });
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), eyeMat, s * 0.75, 2.3, 1.78));
  }

  // 팔 — 오른손에 도끼
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(3.2, 5.8, 0);
  armR.position.set(-3.2, 5.8, 0);
  for (const arm of [armL, armR]) {
    arm.add(mkMesh(new THREE.BoxGeometry(1.8, 4.6, 1.9), leatherMat, 0, -2.3, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(1.9, 1.4, 2.0), ironMat, 0, -4.6, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(1.7, 1.5, 1.8), skinMat, 0, -5.5, 0));
    torso.add(arm);
  }
  const axe = new THREE.Group();
  axe.position.set(0, -5.6, 0.4);
  const handle = mkMesh(new THREE.CylinderGeometry(0.3, 0.34, 10, 6), leatherDark, 0, 0, 3.6);
  handle.rotation.x = Math.PI / 2;
  axe.add(handle);
  const blade = mkMesh(new THREE.BoxGeometry(0.5, 3.6, 2.6), ironMat, 0.5, 0, 7.4);
  axe.add(blade);
  const edge = mkMesh(new THREE.ConeGeometry(1.5, 1.6, 4), ironMat, 0.5, 0, 9.2);
  edge.rotation.x = Math.PI / 2;
  axe.add(edge);
  armR.add(axe);

  return { root, body, torso, head, legL, legR, armL, armR, axe, eyeMat, mats, height: 20 };
}

/* ------------------------- 2번째 세계의 몹 모델 ------------------------- */

// 고블린 — 초록 피부 · 뾰족한 귀 · 곤봉
function buildGoblin() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const skinMat = stdMat(0x6dab4f, { roughness: 0.85 });
  const skinDark = stdMat(0x4f8239, { roughness: 0.9 });
  const hideMat = stdMat(0x5a4326, { roughness: 1 });
  const clothMat = stdMat(0x8a4a2a, { roughness: 0.95 });
  const boneMat = stdMat(0xd8cfae, { roughness: 0.8 });
  mats.push(skinMat, skinDark, hideMat, clothMat, boneMat);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(1.1, 6.2, 0);
  legR.position.set(-1.1, 6.2, 0);
  for (const leg of [legL, legR]) {
    leg.add(mkMesh(new THREE.BoxGeometry(1.7, 5.2, 1.9), skinDark, 0, -2.6, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(2.0, 1.6, 2.6), hideMat, 0, -5.2, 0.5));
    body.add(leg);
  }

  const torso = new THREE.Group();
  torso.position.y = 6.2;
  body.add(torso);
  torso.add(mkMesh(new THREE.BoxGeometry(4.6, 5.4, 2.9), skinMat, 0, 2.7, 0));
  torso.add(mkMesh(new THREE.BoxGeometry(5.0, 2.4, 3.1), hideMat, 0, 1.4, 0));
  torso.add(mkMesh(new THREE.BoxGeometry(1.6, 3.0, 0.5), clothMat, 0, 3.2, 1.5));
  // 어깨 뼈 장식
  for (const s of [-1, 1]) {
    torso.add(mkMesh(new THREE.SphereGeometry(1.2, 8, 6), boneMat, s * 2.6, 4.7, 0));
  }

  const head = new THREE.Group();
  head.position.set(0, 5.6, 0.3);
  torso.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(3.6, 3.2, 3.4), skinMat, 0, 1.6, 0));
  head.add(mkMesh(new THREE.BoxGeometry(3.8, 0.9, 3.6), skinDark, 0, 3.2, 0));
  // 뾰족한 코 · 턱
  head.add(mkMesh(new THREE.ConeGeometry(0.8, 2.0, 5), skinDark, 0, 1.2, 2.0));
  head.add(mkMesh(new THREE.BoxGeometry(2.6, 1.0, 0.8), skinDark, 0, 0.1, 1.5));
  head.add(mkMesh(new THREE.BoxGeometry(1.4, 0.5, 0.4), boneMat, 0, 0.3, 1.9));
  // 뾰족한 귀
  for (const s of [-1, 1]) {
    const ear = mkMesh(new THREE.ConeGeometry(0.75, 3.4, 4), skinMat, s * 2.4, 2.2, -0.2);
    ear.rotation.z = s * -0.95;
    ear.rotation.x = -0.2;
    head.add(ear);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(0.5, 7, 5), eyeMat, s * 0.95, 1.9, 1.65));
  }

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(2.7, 4.4, 0);
  armR.position.set(-2.7, 4.4, 0);
  for (const arm of [armL, armR]) {
    arm.add(mkMesh(new THREE.BoxGeometry(1.5, 4.4, 1.6), skinMat, 0, -2.2, 0));
    arm.add(mkMesh(new THREE.SphereGeometry(0.95, 7, 5), skinDark, 0, -4.6, 0));
    torso.add(arm);
  }
  // 곤봉 (오른손)
  const club = new THREE.Group();
  club.position.set(0, -4.6, 0);
  const handle = mkMesh(new THREE.CylinderGeometry(0.28, 0.42, 7.4, 6), hideMat, 0, 1.4, 0.9);
  handle.rotation.x = 0.9;
  club.add(handle);
  const head2 = mkMesh(new THREE.DodecahedronGeometry(1.5, 0), hideMat, 0, 4.4, 3.4);
  club.add(head2);
  armR.add(club);

  return { root, body, torso, head, legL, legR, armL, armR, club, eyeMat, mats, height: 17 };
}

// 스켈레톤 — 앙상한 뼈 · 갈비뼈 · 녹슨 검
function buildSkeleton() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const boneMat = stdMat(0xe2dcc6, { roughness: 0.75 });
  const boneDark = stdMat(0xb9b29a, { roughness: 0.85 });
  const rustMat = stdMat(0x8a5a3a, { roughness: 0.7, metalness: 0.5 });
  const ragMat = stdMat(0x3d3a30, { roughness: 1 });
  mats.push(boneMat, boneDark, rustMat, ragMat);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(1.2, 9.2, 0);
  legR.position.set(-1.2, 9.2, 0);
  for (const leg of [legL, legR]) {
    leg.add(mkMesh(new THREE.CylinderGeometry(0.42, 0.5, 6.0, 6), boneMat, 0, -3.0, 0));
    leg.add(mkMesh(new THREE.SphereGeometry(0.7, 7, 5), boneDark, 0, -6.0, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(1.3, 0.5, 2.6), boneMat, 0, -6.5, 0.5));
    body.add(leg);
  }

  const torso = new THREE.Group();
  torso.position.y = 9.2;
  body.add(torso);
  torso.add(mkMesh(new THREE.CylinderGeometry(0.55, 0.6, 4.6, 6), boneMat, 0, 2.3, 0));
  // 갈비뼈
  for (let i = 0; i < 4; i++) {
    const rib = mkMesh(new THREE.TorusGeometry(1.9 - i * 0.1, 0.24, 5, 10, Math.PI), boneMat, 0, 3.9 - i * 0.85, 0.1);
    rib.rotation.set(Math.PI / 2, 0, Math.PI);
    torso.add(rib);
  }
  torso.add(mkMesh(new THREE.BoxGeometry(3.8, 0.6, 0.7), boneDark, 0, 4.5, 0));
  // 골반 · 널린 천
  torso.add(mkMesh(new THREE.BoxGeometry(2.8, 1.2, 1.8), boneDark, 0, 0.2, 0));
  torso.add(mkMesh(new THREE.BoxGeometry(3.4, 3.2, 0.3), ragMat, 0, -1.4, 1.0, ));

  const head = new THREE.Group();
  head.position.set(0, 5.4, 0);
  torso.add(head);
  head.add(mkMesh(new THREE.CylinderGeometry(0.7, 0.7, 1.0, 6), boneMat, 0, 0.2, 0));
  head.add(mkMesh(new THREE.BoxGeometry(2.9, 2.8, 3.0), boneMat, 0, 2.0, 0));
  head.add(mkMesh(new THREE.BoxGeometry(3.1, 1.0, 1.2), boneDark, 0, 1.0, 1.2));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x7fe4ff });
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(0.52, 7, 5), eyeMat, s * 0.75, 2.2, 1.35));
  }

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(2.2, 4.4, 0);
  armR.position.set(-2.2, 4.4, 0);
  for (const arm of [armL, armR]) {
    arm.add(mkMesh(new THREE.CylinderGeometry(0.36, 0.42, 4.4, 6), boneMat, 0, -2.2, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(0.9, 0.9, 1.2), boneDark, 0, -4.5, 0));
    torso.add(arm);
  }
  // 녹슨 검
  const sword = new THREE.Group();
  sword.position.set(0, -4.6, 0.6);
  const blade = mkMesh(new THREE.BoxGeometry(0.34, 7.4, 1.0), rustMat, 0, 2.4, 1.2);
  blade.rotation.x = 0.75;
  sword.add(blade);
  sword.add(mkMesh(new THREE.BoxGeometry(1.8, 0.4, 0.5), boneDark, 0, -1.1, -0.2));
  armR.add(sword);

  return { root, body, torso, head, legL, legR, armL, armR, sword, eyeMat, mats, height: 19 };
}

// 사무라이 — 뿔 달린 투구 · 판갑 · 카타나
function buildSamurai() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const plateMat = stdMat(0x39404d, { roughness: 0.55, metalness: 0.45 });
  const plateDark = stdMat(0x23282f, { roughness: 0.6, metalness: 0.4 });
  const clothMat = stdMat(0x7d2a2a, { roughness: 0.95 });
  const goldMat = stdMat(0xc9a24a, { roughness: 0.35, metalness: 0.8 });
  const steelMat = stdMat(0xdfe7ef, { roughness: 0.18, metalness: 0.95 });
  mats.push(plateMat, plateDark, clothMat, goldMat, steelMat);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(1.5, 8.6, 0);
  legR.position.set(-1.5, 8.6, 0);
  for (const leg of [legL, legR]) {
    leg.add(mkMesh(new THREE.BoxGeometry(2.0, 5.6, 2.2), plateDark, 0, -2.8, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(2.4, 1.6, 3.2), plateMat, 0, -5.6, 0.4));
    body.add(leg);
  }
  // 허리 갑 (쿠사즈리)
  body.add(mkMesh(new THREE.BoxGeometry(5.4, 2.6, 3.4), clothMat, 0, 8.0, 0));
  for (let i = 0; i < 3; i++) {
    body.add(mkMesh(new THREE.BoxGeometry(5.6, 0.5, 3.6), plateDark, 0, 6.8 - i * 0.9, 0));
  }

  const torso = new THREE.Group();
  torso.position.y = 9.4;
  body.add(torso);
  torso.add(mkMesh(new THREE.BoxGeometry(5.2, 6.0, 3.2), plateMat, 0, 3.0, 0));
  for (let i = 0; i < 3; i++) {
    torso.add(mkMesh(new THREE.BoxGeometry(5.5, 0.45, 3.4), plateDark, 0, 1.5 + i * 1.7, 0));
  }
  // 가슴 문양
  torso.add(mkMesh(new THREE.SphereGeometry(0.9, 8, 6), goldMat, 0, 3.6, 1.7));
  // 어깨 갑 (소데)
  for (const s of [-1, 1]) {
    const ada = mkMesh(new THREE.BoxGeometry(2.4, 4.2, 3.6), plateDark, s * 3.5, 4.4, 0);
    ada.rotation.z = s * 0.22;
    torso.add(ada);
    torso.add(mkMesh(new THREE.BoxGeometry(2.6, 0.4, 3.8), goldMat, s * 3.6, 6.3, 0));
  }

  // 머리 · 뿔 달린 투구
  const head = new THREE.Group();
  head.position.set(0, 6.4, 0.1);
  torso.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(3.2, 3.0, 3.2), stdMat(0xd8b48c, { roughness: 0.85 }), 0, 1.4, 0));
  head.add(mkMesh(new THREE.BoxGeometry(3.4, 1.0, 0.4), plateDark, 0, 0.55, 1.6)); // 얼굴 가리개
  const kabuto = mkMesh(new THREE.SphereGeometry(2.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), plateMat, 0, 3.0, 0);
  head.add(kabuto);
  head.add(mkMesh(new THREE.CylinderGeometry(3.2, 3.6, 0.6, 12), plateDark, 0, 2.2, 0.1)); // 챙
  // 뿔 (쿠와가타)
  for (const s of [-1, 1]) {
    const horn = mkMesh(new THREE.ConeGeometry(0.55, 3.2, 5), goldMat, s * 1.5, 4.4, 0.2);
    horn.rotation.z = s * -0.45;
    head.add(horn);
  }
  head.add(mkMesh(new THREE.BoxGeometry(0.6, 1.6, 0.4), goldMat, 0, 4.6, 2.0));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff6a4a });
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.BoxGeometry(0.6, 0.45, 0.3), eyeMat, s * 0.75, 2.0, 1.62));
  }

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(3.4, 5.0, 0);
  armR.position.set(-3.4, 5.0, 0);
  for (const arm of [armL, armR]) {
    arm.add(mkMesh(new THREE.BoxGeometry(1.7, 4.4, 1.9), clothMat, 0, -2.2, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(1.9, 1.6, 2.1), plateDark, 0, -4.6, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(1.6, 1.2, 1.8), stdMat(0xd8b48c, { roughness: 0.85 }), 0, -5.6, 0));
    torso.add(arm);
  }
  // 카타나 (오른손) — 칼날이 길고 휘었다
  const katana = new THREE.Group();
  katana.position.set(0, -5.7, 0.4);
  katana.add(mkMesh(new THREE.CylinderGeometry(0.22, 0.26, 3.4, 6), clothMat, 0, 0, 1.5).rotateX(Math.PI / 2));
  const tsuba = mkMesh(new THREE.CylinderGeometry(0.9, 0.9, 0.24, 10), goldMat, 0, 0, 3.3);
  tsuba.rotation.x = Math.PI / 2;
  katana.add(tsuba);
  const blade = mkMesh(new THREE.BoxGeometry(0.2, 1.0, 11.0), steelMat, 0, 0, 9.0);
  katana.add(blade);
  armR.add(katana);

  return { root, body, torso, head, legL, legR, armL, armR, katana, mats, height: 21 };
}

// 아이언 골렘 — 거대한 쇳덩이 몸 · 타오르는 주황 핵
function buildIronGolem() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const ironMat = stdMat(0x6e7278, { roughness: 0.42, metalness: 0.85 });
  const ironDark = stdMat(0x43474d, { roughness: 0.5, metalness: 0.8 });
  const rustMat = stdMat(0x7a5238, { roughness: 0.9, metalness: 0.3 });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffb066, emissive: 0xff6a1c, emissiveIntensity: 3.4, roughness: 0.3,
  });
  mats.push(ironMat, ironDark, rustMat);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(8, 13, 0);
  legR.position.set(-8, 13, 0);
  for (const leg of [legL, legR]) {
    leg.add(mkMesh(new THREE.BoxGeometry(7.4, 13, 8), ironMat, 0, -6.5, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(8.6, 3, 10), ironDark, 0, -12.2, 0.6));
    body.add(leg);
  }
  body.add(mkMesh(new THREE.BoxGeometry(24, 8, 14), ironDark, 0, 18, 0));
  const torso = mkMesh(new THREE.BoxGeometry(28, 20, 16), ironMat, 0, 30, 0);
  body.add(torso);
  body.add(mkMesh(new THREE.BoxGeometry(29, 1.8, 17), ironDark, 0, 22, 0));
  body.add(mkMesh(new THREE.BoxGeometry(29, 1.8, 17), ironDark, 0, 35, 0));
  // 리벳 · 녹
  for (let i = 0; i < 10; i++) {
    const rz = mkMesh(new THREE.SphereGeometry(0.7, 6, 5), rustMat,
      (Math.random() - 0.5) * 24, 22 + Math.random() * 14, (Math.random() - 0.5) * 15);
    body.add(rz);
  }
  // 가슴 핵
  const core = mkMesh(new THREE.SphereGeometry(4.4, 14, 10), coreMat, 0, 31, 8.4);
  body.add(core);
  const coreHalo = mkMesh(new THREE.SphereGeometry(6.2, 12, 9), new THREE.MeshBasicMaterial({
    color: 0xffa04a, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false,
  }), 0, 31, 8.4);
  body.add(coreHalo);

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(18, 36, 0);
  armR.position.set(-18, 36, 0);
  for (const arm of [armL, armR]) {
    body.add(arm);
    arm.add(mkMesh(new THREE.BoxGeometry(11, 9, 12), ironDark, 0, 1, 0));
    // 어깨 가시
    arm.add(mkMesh(new THREE.ConeGeometry(1.5, 4.4, 5), rustMat, 0, 6.4, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(7.6, 14, 8), ironMat, 0, -9, 0));
    arm.add(mkMesh(new THREE.DodecahedronGeometry(5.6, 0), ironDark, 0, -18.6, 0));
  }
  // 머리 — 투구 같은 쇳덩이
  const head = new THREE.Group();
  head.position.set(0, 44, 1);
  body.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(10, 9, 9), ironMat, 0, 0, 0));
  head.add(mkMesh(new THREE.BoxGeometry(11, 2.2, 10), ironDark, 0, 4.4, 0));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff8a3a });
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.BoxGeometry(2.4, 1.2, 0.8), eyeMat, s * 2.6, 1.2, 4.6));
  }
  head.add(mkMesh(new THREE.BoxGeometry(6, 1.4, 0.8), ironDark, 0, -2.6, 4.6));

  return { root, body, torso, head, armL, armR, legL, legR, core, coreMat, coreHalo, eyeMat, mats, height: 50 };
}

// 흑마법사 (최종 보스) — 두건 로브 · 보랏빛 지팡이 · 떠 있는 룬 고리
function buildDarkMage() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const robeMat = stdMat(0x2f2244, { roughness: 0.9, emissive: 0x1a0c30, emissiveIntensity: 0.55 });
  const robeDark = stdMat(0x1b1428, { roughness: 1, emissive: 0x120a22, emissiveIntensity: 0.4 });
  const trimMat = stdMat(0x7a3fbf, { roughness: 0.5, metalness: 0.4, emissive: 0x5a24a0, emissiveIntensity: 1.1 });
  const skinMat = stdMat(0x9c8f9e, { roughness: 0.9 });
  const staffMat = stdMat(0x2c1f36, { roughness: 0.8 });
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xc9a0ff, emissive: 0x8a3aff, emissiveIntensity: 3.6, roughness: 0.2,
  });
  mats.push(robeMat, robeDark, trimMat, skinMat, staffMat);

  // 로브 (아래로 퍼지는 원뿔) — 발이 보이지 않고 떠 있는 느낌
  body.add(mkMesh(new THREE.ConeGeometry(8.2, 26, 14, 1, true), robeDark, 0, 13, 0));
  body.add(mkMesh(new THREE.ConeGeometry(6.4, 16, 12, 1, true), robeMat, 0, 19, 0));
  const torso = new THREE.Group();
  torso.position.y = 26;
  body.add(torso);
  torso.add(mkMesh(new THREE.CylinderGeometry(4.4, 6.0, 11, 12), robeMat, 0, 2.5, 0));
  torso.add(mkMesh(new THREE.TorusGeometry(4.5, 0.28, 6, 20), trimMat, 0, 5.4, 0));
  torso.add(mkMesh(new THREE.BoxGeometry(1.2, 7.4, 0.4), trimMat, 0, 2.4, 4.2));
  // 어깨 망토
  for (const s of [-1, 1]) {
    const cape = mkMesh(new THREE.ConeGeometry(3.2, 9, 8, 1, true), robeDark, s * 4.6, 1.2, 0);
    cape.rotation.z = s * 0.5;
    torso.add(cape);
  }

  // 머리 · 깊은 두건 (얼굴은 어둡게, 눈만 보랏빛)
  const head = new THREE.Group();
  head.position.set(0, 8.6, 0.2);
  torso.add(head);
  head.add(mkMesh(new THREE.SphereGeometry(2.9, 12, 10), robeDark, 0, 1.4, -0.2));
  const hood = mkMesh(new THREE.ConeGeometry(3.5, 6.2, 10, 1, true), robeMat, 0, 3.2, -0.4);
  hood.rotation.x = -0.12;
  head.add(hood);
  head.add(mkMesh(new THREE.BoxGeometry(2.4, 2.4, 0.6), new THREE.MeshBasicMaterial({ color: 0x0a0610 }), 0, 1.9, 1.9));
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd8a0ff });
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(0.42, 7, 5), eyeMat, s * 0.62, 2.0, 2.2));
  }

  // 팔
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(4.3, 4.6, 0);
  armR.position.set(-4.3, 4.6, 0);
  for (const arm of [armL, armR]) {
    arm.add(mkMesh(new THREE.BoxGeometry(1.9, 5.2, 1.9), robeMat, 0, -2.6, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(1.7, 1.6, 1.7), skinMat, 0, -5.4, 0));
    torso.add(arm);
  }

  // 지팡이 (오른손) — 끝에 보랏빛 구체
  const staff = new THREE.Group();
  staff.position.set(0, -5.6, 0.6);
  staff.add(mkMesh(new THREE.CylinderGeometry(0.36, 0.44, 22, 8), staffMat, 0, 6, 0).rotateX(0));
  const orb = mkMesh(new THREE.SphereGeometry(2.9, 14, 10), orbMat, 0, 18.4, 0);
  staff.add(orb);
  const orbHalo = mkMesh(new THREE.SphereGeometry(5.0, 12, 9), new THREE.MeshBasicMaterial({
    color: 0xb07aff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false,
  }), 0, 18.4, 0);
  staff.add(orbHalo);
  // 지팡이 끝 갈라진 가지
  for (const s of [-1, 1]) {
    const prong = mkMesh(new THREE.ConeGeometry(0.3, 3.4, 4), staffMat, s * 1.0, 16.2, 0);
    prong.rotation.z = s * 0.55;
  }
  armR.add(staff);

  // 떠 있는 룬 고리 (몸 주위)
  const runeRing = new THREE.Group();
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xc58cff, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rune = mkMesh(new THREE.BoxGeometry(0.9, 1.6, 0.24), runeMat, Math.cos(a) * 10.5, 0, Math.sin(a) * 10.5);
    rune.rotation.y = -a;
    runeRing.add(rune);
  }
  runeRing.position.y = 20;
  body.add(runeRing);

  // 머리 위 어두운 후광
  const halo = mkMesh(new THREE.TorusGeometry(4.4, 0.4, 6, 24), new THREE.MeshBasicMaterial({
    color: 0x8a3aff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
  }), 0, 41, 0);
  halo.rotation.x = Math.PI / 2;
  body.add(halo);

  // 발치의 어둠 안개 (어두운 바닥에서도 보스가 한눈에 띄게)
  const baseGlow = new THREE.Mesh(new THREE.SphereGeometry(26, 14, 10), new THREE.MeshBasicMaterial({
    color: 0x8a3aff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  baseGlow.scale.set(1, 0.22, 1);
  baseGlow.position.y = 3;
  body.add(baseGlow);

  return {
    root, body, torso, head, armL, armR, staff, orb, orbMat, orbHalo, runeRing, halo, baseGlow, eyeMat, mats,
    height: 40,
  };
}

const BUILDERS = {
  slime: buildSlime, zombie: buildZombie, hyena: buildHyena, gorilla: buildGorilla,
  raider: buildRaider, golem: buildGolem,
  goblin: buildGoblin, skeleton: buildSkeleton, samurai: buildSamurai,
  iron_golem: buildIronGolem, dark_mage: buildDarkMage,
};

/* -------------------------------- 몹 -------------------------------- */
export class Mob {
  constructor(game, typeId, pos, biomeId) {
    this.game = game;
    this.typeId = typeId;
    this.type = MOB_TYPES[typeId];
    this.biomeId = biomeId;
    this.biome = BIOMES[biomeId] || null;
    this.maxHp = this.type.hp;
    this.hp = this.maxHp;
    // HP가 2배로 강화되어(2026-11-16) 표시 레벨이 함께 2배가 되지 않도록 80으로 나눈다 — 화면의 Lv. 는 예전과 같다
    this.level = this.type.level || (this.type.boss ? 20 : Math.max(1, Math.round(this.type.hp / 80)));
    this.radius = this.type.radius;
    this.height = this.type.height;
    this.speed = this.type.speed;

    this.position = new THREE.Vector3(pos.x, terrainHeight(pos.x, pos.z), pos.z);
    this.spawnPoint = this.position.clone();
    this.facing = rand(0, TAU);
    this.state = 'idle';
    this.aggro = false;
    this.attackCd = rand(0.4, 1.2);
    this.attackT = 0;
    this.attackDur = this.type.boss ? 1.15 : 0.85;
    this.attackHit = false;
    this.hurtT = 0;
    this.dead = false;
    this.deadT = 0;
    this.respawnT = 0;
    this.time = rand(0, 10);
    this.walkPhase = rand(0, TAU);
    this.knock = new THREE.Vector3();
    this.wanderTarget = this.position.clone();
    this.wanderT = rand(1, 3);
    this.didAlert = false;
    this.bossIntroDone = false;
    this.stompCd = 4;
    // 보스(고대 골렘) 격노 · 충격파 내려치기
    this.enraged = false;
    this.slamT = 0;
    this.slamDur = (this.type.slamWindup || 1.5);
    this.slamHit = false;
    this.slamCd = 0;
    this.attacksSinceSlam = 0;

    // 멀티플레이: netId 가 있으면 호스트 권한 몹, remote=true 면 친구 화면에서 보는 미러
    this.netId = undefined;
    this.remote = false;
    this.targetPos = this.position.clone();
    this.remoteChase = false;
    this.remoteAtk = 0;
    this.lastSeen = 0;
    this.targetRef = null;
    // 이 몹이 사는 세계 (1 | 2) — 이동 제한과 부활 자리를 정한다
    this.worldId = (this.biome && this.biome.world) === 2 ? 2 : 1;
    // 흑마법사의 어둠 구체 (원거리 공격) — 호스트/솔로 화면에서만 실제로 날아간다
    this.bolts = [];

    const built = BUILDERS[typeId]();
    this.model = built;
    this.root = built.root;
    this.body = built.body;
    this.mats = built.mats || [];
    this.baseEmissive = this.mats.map((m) => (m.emissive ? m.emissive.clone() : null));
    for (const m of this.mats) {
      if (m.emissiveIntensity !== undefined && m.userData.baseEI === undefined) m.userData.baseEI = m.emissiveIntensity;
    }
    this.root.position.copy(this.position);
    game.scene.add(this.root);
  }

  get alive() { return !this.dead; }

  /* ------------------------------ 피해 ------------------------------ */
  takeDamage(amount, opts) {
    if (this.dead || this.remote) return;
    const o = opts || {};
    const dmg = Math.max(1, Math.round(amount));
    this.hp -= dmg;
    this.hurtT = 0.3;
    this.aggro = true;
    this.state = this.state === 'idle' ? 'chase' : this.state;
    if (o.dir) {
      this.knock.addScaledVector(o.dir, o.knock || 7);
    }
    this.game.hud.floater(String(dmg), new THREE.Vector3(this.position.x, this.position.y + this.height * 0.9, this.position.z), o.crit ? 'crit' : 'dmg', 1.2);
    if (o.crit) this.game.sfx.crit(); else this.game.sfx.hit();
    this.game.hud.setTarget(this);
    if (this.hp <= 0) this.die(o);
  }

  die(opts) {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.hp = 0;
    this.aggro = false;
    this.state = 'dead';
    const p = this.game.player;
    const net = this.game.net;
    const multiplayerHost = !!(net && net.active && net.isHost);
    if (multiplayerHost) {
      // 함께 하는 모두가 경험치 · 골드를 받는다 (호스트가 알려 준다)
      net.onMobDeath(this);
    } else if (p && p.alive) {
      p.gainXp(this.type.xp);
      p.kills++;
      this.game.hud.floater('+' + this.type.xp + ' XP', new THREE.Vector3(this.position.x, this.position.y + this.height, this.position.z), 'xp', 1.5);
    }
    // 골드 드랍 (상점에서 무기 · 포션 구매)
    const gold = this.type.gold || 0;
    if (gold > 0 && !multiplayerHost && typeof this.game.addGold === 'function') {
      this.game.addGold(gold, this.position);
    }
    this.game.effects.burst(new THREE.Vector3(this.position.x, this.position.y + this.height * 0.5, this.position.z), this.type.boss ? 0x9fe8ff : 0xffcf8a, this.type.boss ? 40 : 14, { power: this.type.boss ? 60 : 26, size: this.type.boss ? 2.2 : 0.8 });
    this.clearBolts();
    if (this.type.boss) {
      this.game.onBossDefeated(this);
    } else {
      this.respawnT = rand(22, 38);
    }
  }

  respawn() {
    const b = BIOMES[this.biomeId].bounds;    const p = this.game.player.position;
    let x = 0, z = 0, tries = 0;
    do {
      x = rand(b.x0 + 100, b.x1 - 100);
      z = rand(b.z0 + 100, b.z1 - 100);
      tries++;
    } while (Math.hypot(x - p.x, z - p.z) < 220 && tries < 30);
    this.position.set(x, terrainHeight(x, z), z);
    this.spawnPoint.copy(this.position);
    this.hp = this.maxHp;
    this.dead = false;
    this.deadT = 0;
    this.state = 'idle';
    this.aggro = false;
    this.attackCd = 1;
    this.attackT = 0;
    this.hurtT = 0;
    this.knock.set(0, 0, 0);
    this.root.visible = true;
    this.root.scale.setScalar(1);
    this.root.position.copy(this.position);
  }

  /* ------------------------------ 업데이트 ------------------------------ */
  update(dt) {
    if (this.dead) {
      this.deadT += dt;
      const p = clamp(this.deadT / 0.9, 0, 1);
      this.root.scale.setScalar(Math.max(0.01, 1 - p));
      this.root.position.y = this.position.y - p * 2;
      this.root.rotation.z = p * 0.8;
      if (p >= 1) this.root.visible = false;
      if (!this.type.boss) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) this.respawn();
      }
      return;
    }

    this.time += dt;
    const target = this.pickTarget();
    if (!target) {
      this.root.position.copy(this.position);
      return;
    }
    this.targetRef = target;
    const dx = target.position.x - this.position.x;
    const dz = target.position.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    const distSpawn = Math.hypot(this.position.x - this.spawnPoint.x, this.position.z - this.spawnPoint.z);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.type.boss) {
      this.stompCd = Math.max(0, this.stompCd - dt);
      this.slamCd = Math.max(0, this.slamCd - dt);
      // 체력 50% 이하 → 격노
      if (!this.enraged && this.hp <= this.maxHp * (this.type.enrageAt || 0.5)) this.enrage();
    }

    // 어그로
    if (target.alive && dist < this.type.aggro && distSpawn < this.type.leash * 1.25) {
      if (!this.aggro) {
        this.aggro = true;
        if (this.type.boss && !this.bossIntroDone) {
          this.bossIntroDone = true;
          this.game.onBossEngage(this);
        } else if (!this.didAlert) {
          this.didAlert = true;
        }
      }
    }
    if (distSpawn > this.type.leash) this.aggro = false;

    let moveTarget = null;
    let speedMul = 1;

    if (this.slamT > 0) {
      // 내려치기 예고 → 내리치는 순간
      this.slamT -= dt;
      speedMul = 0;
      this.state = 'chase';
      if (target.alive) this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 6, dt);
      if (!this.slamHit && this.slamT <= this.slamDur * 0.3) {
        this.slamHit = true;
        this.resolveSlam();
      }
      if (this.slamT <= 0) this.slamT = 0;
    } else if (this.attackT > 0) {
      // 공격 모션 진행
      this.attackT -= dt;
      const prog = 1 - this.attackT / this.attackDur;
      if (!this.attackHit && prog >= 0.52) {
        this.attackHit = true;
        this.resolveAttack(dist);
      }
      speedMul = 0.1;
    } else if (this.aggro && target.alive) {
      // 격노한 보스는 몇 대 때린 뒤 충격파를 내려친다
      const canSlam = this.type.boss && this.enraged && this.slamCd <= 0
        && dist < (this.type.slamRadius || 200) * 1.15
        && this.attacksSinceSlam >= (this.type.slamEvery || 3);
      if (canSlam) {
        this.startSlam();
        speedMul = 0;
      } else if (dist > this.type.attackRange * 0.92) {
        moveTarget = target.position;
        this.state = 'chase';
      } else if (this.attackCd <= 0) {
        this.startAttack();
        speedMul = 0;
      } else {
        this.state = 'idle';
        // 공격 대기 중에도 살짝 접근
        if (dist > this.type.attackRange * 0.75) moveTarget = target.position;
        speedMul = 0.45;
      }
    } else {
      // 배회
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = rand(2.5, 5.5);
        const a = rand(0, TAU);
        const r = rand(30, 110);
        this.wanderTarget.set(
          clamp(this.spawnPoint.x + Math.cos(a) * r, this.spawnPoint.x - 140, this.spawnPoint.x + 140),
          0,
          clamp(this.spawnPoint.z + Math.sin(a) * r, this.spawnPoint.z - 140, this.spawnPoint.z + 140)
        );
      }
      moveTarget = this.wanderTarget;
      speedMul = 0.35;
      this.state = 'idle';
    }

    // 이동
    if (moveTarget) {
      const mx = moveTarget.x - this.position.x;
      const mz = moveTarget.z - this.position.z;
      const md = Math.hypot(mx, mz);
      if (md > 2) {
        const sp = this.speed * speedMul * (this.hurtT > 0 ? 0.4 : 1);
        this.position.x += (mx / md) * sp * dt;
        this.position.z += (mz / md) * sp * dt;
        const want = Math.atan2(mx, mz);
        this.facing = dampAngle(this.facing, want, 8, dt);
        this.walkPhase += dt * (4.5 + sp * 0.12);
      }
    } else if (this.aggro) {
      this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 8, dt);
    }

    // 넉백
    if (this.knock.lengthSq() > 0.01) {
      this.position.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(1 - Math.min(1, dt * 7));
    }

    // 다른 몹과 겹치지 않게
    const mobs = this.game.mobManager.mobs;
    for (let i = 0; i < mobs.length; i++) {
      const o = mobs[i];
      if (o === this || o.dead) continue;
      const ox = this.position.x - o.position.x;
      const oz = this.position.z - o.position.z;
      const d2 = ox * ox + oz * oz;
      const minD = (this.radius + o.radius) * 0.9;
      if (d2 > 0.001 && d2 < minD * minD) {
        const d = Math.sqrt(d2);
        const push = (minD - d) / d * 0.5;
        this.position.x += ox * push;
        this.position.z += oz * push;
      }
    }

    // 태초마을은 안전 지대 — 몬스터는 마을로 들어오지 않는다 (1번째 세계 한정)
    if (this.worldId === 1 && this.biomeId !== 'village' && this.position.x < -1492) this.position.x = -1492;
    // 2세계 태초마을도 안전 지대 — 고블린 숲 몬스터는 마을 남문 밖에서 멈춘다
    if (this.worldId === 2 && this.biomeId !== 'village_w2' && this.position.z > WORLD2.originZ + 1492) {
      this.position.z = WORLD2.originZ + 1492;
    }

    // 지형 · 경계 (사는 세계의 통행 영역)
    clampToWorld(this.position, this.worldId);
    this.position.y = terrainHeight(this.position.x, this.position.z);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;

    // 어둠 구체가 날아간다 (원거리 보스)
    if (this.bolts.length) this.updateBolts(dt);

    // 화면에 또렷하게 잡히는 거리에서만 뼈대 애니메이션을 돌린다 (먼 몹은 꿈쩍 않는 점과 구분되지 않는다)
    if (this.dist === undefined || this.dist < (this.game.mobManager ? this.game.mobManager.animRadius : 460) || this.type.boss) {
      this.animate(dt, dist);
    }
  }

  // 아주 먼 몹: 그리지도, 움직이지도 않고 부활 타이머만 돌린다
  updateFar(dt) {
    if (!this.dead) return;
    this.deadT += dt;
    if (this.type.boss) return;
    this.respawnT -= dt;
    if (this.respawnT <= 0) {
      this.respawn();
      this.root.visible = false;
    }
  }

  // 가장 가까운 플레이어(나 또는 함께 하는 친구)를 노린다
  pickTarget() {
    const list = this.game.combatTargets ? this.game.combatTargets() : null;
    if (!list) {
      const p = this.game.player;
      return p && p.alive ? { local: true, alive: true, radius: p.radius || 4.6, position: p.position } : null;
    }
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t || !t.alive) continue;
      const d = Math.hypot(t.position.x - this.position.x, t.position.z - this.position.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  startAttack() {
    this.attackT = this.attackDur;
    this.attackHit = false;
    this.attackCd = this.type.attackCooldown * (this.enraged ? 0.6 : 1) * rand(0.9, 1.15);
    this.attacksSinceSlam++;
    if (this.type.boss) this.game.sfx.boss();
  }

  /* ------------------- 격노 · 충격파 내려치기 (보스) ------------------- */
  enrage() {
    if (this.enraged) return;
    this.enraged = true;
    const m = this.model;
    if (m.coreMat) {
      m.coreMat.color.setHex(0xffb066);
      m.coreMat.emissive.setHex(0xff4a1c);
      m.coreMat.emissiveIntensity = 4.2;
    }
    if (m.coreHalo && m.coreHalo.material) m.coreHalo.material.color.setHex(0xff8a4a);
    if (m.eyeMat) m.eyeMat.color.setHex(0xffa050);
    this.game.hud.banner(this.type.name + ' · 격노!', 1700);
    this.game.shake(0.75);
    this.game.sfx.boss();
    if (this.game.effects) {
      this.game.effects.ring(this.position, 0xff5a2a, 190, { duration: 0.9, thickness: 0.05 });
      this.game.effects.burst(new THREE.Vector3(this.position.x, this.position.y + 30, this.position.z), 0xff7040, 26, { power: 40, size: 2 });
    }
    // 격노 직후 바로 내려치기를 예고한다 (조금 여유를 두고)
    this.slamCd = 1.8;
  }

  startSlam() {
    const radius = this.type.slamRadius || 200;
    this.slamDur = this.type.slamWindup || 1.5;
    this.slamT = this.slamDur;
    this.slamHit = false;
    this.slamCd = this.type.slamCooldown || 9;
    this.attacksSinceSlam = 0;
    this.attackT = 0;
    this.attackHit = true;
    this.game.sfx.boss();
    this.game.hud.banner(this.type.slamLabel || '충격파 내려치기!', 1100);
    if (this.game.effects) {
      // 바닥에 범위를 예고하는 고리 (점점 넓어지며 위험 범위를 보여 준다)
      this.game.effects.ring(
        new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z),
        0xff7a3c, radius, { duration: this.slamDur, thickness: 0.05, yOffset: 1.5 }
      );
      this.game.effects.ring(
        new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z),
        0xffc46a, radius * 0.5, { duration: this.slamDur, thickness: 0.02, yOffset: 1.5 }
      );
    }
  }

  resolveSlam() {
    const radius = this.type.slamRadius || 200;
    const base = this.type.damage * 1.4;
    const list = this.game.combatTargets ? this.game.combatTargets() : null;
    const targets = list || (this.game.player ? [{ local: true, alive: this.game.player.alive, radius: 4.6, position: this.game.player.position }] : []);
    for (const t of targets) {
      if (!t || !t.alive) continue;
      const d = Math.hypot(t.position.x - this.position.x, t.position.z - this.position.z);
      if (d > radius + (t.radius || 4.6)) continue;
      const falloff = clamp(1 - (d / radius) * 0.4, 0.6, 1);
      const dmg = base * falloff;
      if (t.remote) {
        if (this.game.net) this.game.net.hitGuest(t.pid, dmg, this.position);
      } else {
        const p = this.game.player;
        if (p && p.alive) p.takeDamage(dmg, this.position);
      }
    }
    if (this.game.effects) {
      this.game.effects.ring(this.position, 0xffb15c, radius * 1.1, { duration: 0.62, thickness: 0.07 });
      this.game.effects.burst(new THREE.Vector3(this.position.x, this.position.y + 6, this.position.z), 0xffc46a, 34, { power: 78, size: 1.8 });
      this.game.effects.crack(this.position, 0xff8a4a, radius * 0.8, 0.9);
    }
    this.game.shake(1.15);
  }

  resolveAttack(dist) {
    const target = this.targetRef;
    if (!target || !target.alive) return;
    const reach = this.type.attackRange + (target.radius || 4.6);
    if (dist > reach) return;
    // 원거리 보스(흑마법사): 화면에 어둠 구체가 실제로 날아가 박힌다
    if (this.type.enemyProjectile) {
      this.fireBolt(target);
      return;
    }
    const dmg = this.type.damage * rand(0.9, 1.1);
    if (target.remote) {
      if (this.game.net) this.game.net.hitGuest(target.pid, dmg, this.position);
    } else {
      const player = this.game.player;
      if (player && player.alive) player.takeDamage(dmg, this.position);
    }
    if (this.type.boss) {
      this.game.effects.ring(this.position, 0x9fe8ff, 130, { duration: 0.7, thickness: 0.05 });
      this.game.effects.burst(new THREE.Vector3(this.position.x, this.position.y + 4, this.position.z), 0x9fe8ff, 18, { power: 34 });
      this.game.shake(0.8);
    }
  }

  /* ------------------- 어둠 구체 (흑마법사 원거리 공격) ------------------- */
  fireBolt(target) {
    if (!target || !target.alive) return;
    const scene = this.game.scene;
    const from = new THREE.Vector3(this.position.x, this.position.y + this.height * 0.62, this.position.z);
    const tx = target.position.x - from.x;
    const tz = target.position.z - from.z;
    const d = Math.hypot(tx, tz) || 1;
    const color = this.enraged ? 0xff5a9a : 0xa46aff;
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(3.0, 12, 9), new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 3.4, roughness: 0.2,
    }));
    g.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(5.2, 10, 8), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    g.add(halo);
    g.position.copy(from);
    scene.add(g);
    const speed = this.enraged ? 240 : 190;
    this.bolts.push({
      mesh: g, x: from.x, z: from.z, y: from.y,
      dx: tx / d, dz: tz / d, speed,
      dmg: this.type.damage * rand(0.85, 1.05),
      life: 2.6, t: 0,
    });
    this.game.sfx.orb();
  }

  updateBolts(dt) {
    const targets = this.game.combatTargets ? this.game.combatTargets() : null;
    const list = targets || (this.game.player ? [{ local: true, alive: this.game.player.alive, radius: 4.6, position: this.game.player.position }] : []);
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      b.x += b.dx * b.speed * dt;
      b.z += b.dz * b.speed * dt;
      const groundY = terrainHeight(b.x, b.z) + this.height * 0.55;
      b.y = groundY;
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.y += dt * 6;
      let hit = null;
      for (const t of list) {
        if (!t || !t.alive) continue;
        const rr = 12 + (t.radius || 4.6);
        if (Math.hypot(t.position.x - b.x, t.position.z - b.z) < rr) { hit = t; break; }
      }
      const expired = b.t > b.life;
      if (hit || expired) {
        if (hit) {
          if (hit.remote) {
            if (this.game.net) this.game.net.hitGuest(hit.pid, b.dmg, new THREE.Vector3(b.x, b.y, b.z));
          } else {
            const p = this.game.player;
            if (p && p.alive) p.takeDamage(b.dmg, new THREE.Vector3(b.x, b.y, b.z));
          }
        }
        if (this.game.effects) {
          this.game.effects.burst(new THREE.Vector3(b.x, b.y, b.z), 0xa46aff, 14, { power: 30, size: 1.1 });
          this.game.effects.ring(new THREE.Vector3(b.x, b.y - 6, b.z), 0x8a3aff, 46, { duration: 0.45, thickness: 0.05 });
        }
        this.removeBolt(i);
      }
    }
  }

  removeBolt(i) {
    const b = this.bolts[i];
    if (!b) return;
    if (b.mesh) {
      this.game.scene.remove(b.mesh);
      b.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.bolts.splice(i, 1);
  }

  clearBolts() {
    for (let i = this.bolts.length - 1; i >= 0; i--) this.removeBolt(i);
    this.bolts.length = 0;
  }

  /* ------------------------------ 애니메이션 ------------------------------ */
  animate(dt, dist) {
    const m = this.model;
    const t = this.time;
    const hurt = this.hurtT / 0.3;
    const atkP = this.attackT > 0 ? 1 - this.attackT / this.attackDur : -1;
    const moving = this.state === 'chase' || (this.state === 'idle' && this.hurtT <= 0 && this.attackT <= 0);

    // 피격 시 붉게 번쩍
    for (let i = 0; i < this.mats.length; i++) {
      const mat = this.mats[i];
      const base = this.baseEmissive[i];
      if (!mat.emissive) continue;
      if (hurt > 0.01) {
        mat.emissive.setRGB(1, 0.35, 0.3);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 1.6 * hurt;
      } else if (base) {
        mat.emissive.copy(base);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = mat.userData.baseEI === undefined ? 1 : mat.userData.baseEI;
      }
    }

    if (this.typeId === 'slime') {
      const hop = Math.sin(t * 3.2);
      const squash = 1 + hop * 0.09 + hurt * 0.25;
      m.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      m.body.position.y = Math.max(0, hop) * 1.6;
      if (atkP >= 0) {
        const k = Math.sin(clamp(atkP, 0, 1) * Math.PI);
        m.body.position.z = k * 3.2;
        m.body.scale.set(1 + k * 0.15, 1 - k * 0.2, 1 + k * 0.15);
      } else {
        m.body.position.z = 0;
      }
    } else if (this.typeId === 'zombie') {
      const s = Math.sin(this.walkPhase);
      m.legL.rotation.x = s * 0.6;
      m.legR.rotation.x = -s * 0.6;
      m.body.position.y = Math.abs(s) * 0.35;
      m.body.rotation.z = Math.sin(t * 1.4) * 0.06;
      const swing = atkP >= 0 ? Math.sin(clamp(atkP, 0, 1) * Math.PI) : 0;
      m.armL.rotation.x = -1.45 + swing * 1.5;
      m.armR.rotation.x = -1.45 - swing * 0.4;
      m.torso.rotation.y = swing * 0.4;
      if (hurt > 0) m.body.rotation.x = -hurt * 0.25;
      else m.body.rotation.x = 0;
    } else if (this.typeId === 'hyena') {
      const s = Math.sin(this.walkPhase * 1.6);
      m.legs[0].rotation.x = s * 0.8;
      m.legs[1].rotation.x = -s * 0.8;
      m.legs[2].rotation.x = -s * 0.8;
      m.legs[3].rotation.x = s * 0.8;
      m.body.position.y = Math.abs(Math.sin(this.walkPhase * 1.6)) * 0.5;
      m.body.rotation.x = moving && this.state === 'chase' ? -0.08 : 0;
      const lunge = atkP >= 0 ? Math.sin(clamp(atkP, 0, 1) * Math.PI) : 0;
      m.body.position.z = lunge * 4;
      m.head.rotation.x = -0.2 + lunge * 0.5;
      m.body.position.y += lunge * 1.2;
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 30) * 0.12;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'gorilla') {
      const s = Math.sin(this.walkPhase * 0.9);
      m.legL.rotation.x = s * 0.5;
      m.legR.rotation.x = -s * 0.5;
      m.body.position.y = Math.abs(Math.sin(this.walkPhase * 0.9)) * 0.7 - 0.4;
      m.body.rotation.x = 0.06;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      m.armL.rotation.x = swing > 0 ? -2.6 * swing : -0.1;
      m.armR.rotation.x = swing > 0 ? -2.6 * swing : -0.1;
      m.armL.rotation.z = 0.15 + swing * 0.5;
      m.armR.rotation.z = -0.15 - swing * 0.5;
      m.head.rotation.x = swing * 0.3;
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 26) * 0.1;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'raider') {
      const s = Math.sin(this.walkPhase);
      m.legL.rotation.x = s * 0.72;
      m.legR.rotation.x = -s * 0.72;
      m.body.position.y = Math.abs(s) * 0.5;
      m.torso.rotation.y = s * -0.12;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      // 도끼를 머리 위로 들어 내려친다
      m.armR.rotation.x = -0.3 - swing * 2.4;
      m.armR.rotation.z = -0.18 - swing * 0.25;
      m.armL.rotation.x = -0.2 + swing * 0.45;
      m.armL.rotation.z = 0.24;
      m.torso.rotation.x = swing * 0.22;
      m.head.rotation.x = -swing * 0.16;
      if (moving && this.state === 'chase') m.body.rotation.x = -0.05;
      else m.body.rotation.x = 0;
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 24) * 0.1;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'golem') {
      const s = Math.sin(this.walkPhase * 0.55);
      m.legL.rotation.x = s * 0.32;
      m.legR.rotation.x = -s * 0.32;
      m.body.position.y = Math.abs(Math.sin(this.walkPhase * 0.55)) * 1.2;
      const swing = atkP >= 0 ? Math.sin(clamp(atkP, 0, 1) * Math.PI) : 0;
      const slamP = this.slamT > 0 ? clamp(1 - this.slamT / this.slamDur, 0, 1) : -1;
      if (slamP >= 0) {
        // 양팔을 머리 위로 들어 올렸다가 지면을 내려친다
        const raise = slamP < 0.72 ? slamP / 0.72 : 1;
        const fall = slamP < 0.72 ? 0 : clamp((slamP - 0.72) / 0.28, 0, 1);
        const armX = -2.9 * raise + 3.9 * fall;
        m.armR.rotation.x = armX;
        m.armL.rotation.x = armX;
        m.armR.rotation.z = -0.35 * raise;
        m.armL.rotation.z = 0.35 * raise;
        m.body.rotation.x = -0.12 * raise + 0.36 * fall;
        m.head.rotation.x = 0.18 * raise - 0.3 * fall;
      } else {
        // 오른팔 들어 내려찍기
        m.armR.rotation.x = -2.2 * swing;
        m.armR.rotation.z = -0.1 - swing * 0.15;
        m.armL.rotation.x = -0.3 * swing;
        m.armL.rotation.z = 0;
        m.body.rotation.x = swing * 0.12;
        m.head.rotation.x = -swing * 0.12;
      }
      const pulse = 1 + Math.sin(t * (this.enraged ? 5.5 : 3)) * (this.enraged ? 0.14 : 0.08);
      m.core.scale.setScalar(pulse * (1 + swing * 0.25));
      m.coreHalo.scale.setScalar(pulse * 1.1 + swing * 0.3);
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 22) * 0.05;
      else m.body.rotation.z = 0;
      // 격노(체력 50% 이하): 황금빛 룬 · 눈이 타오른다
      if (this.enraged && m.coreMat) {
        m.coreMat.emissiveIntensity = 3.2 + Math.sin(t * 7) * 1.5;
        if (m.coreHalo && m.coreHalo.material) m.coreHalo.material.opacity = 0.28 + Math.sin(t * 7) * 0.1;
        if (m.eyeMat) m.eyeMat.color.setHex(Math.sin(t * 7) > 0 ? 0xffc070 : 0xff5a24);
      }
    } else if (this.typeId === 'goblin') {
      // 종종대며 달리고, 곤봉을 머리 위로 들어 내려친다
      const s = Math.sin(this.walkPhase * 1.35);
      m.legL.rotation.x = s * 0.85;
      m.legR.rotation.x = -s * 0.85;
      m.body.position.y = Math.abs(s) * 0.85 + Math.sin(t * 2.2) * 0.2;
      m.torso.rotation.y = s * -0.16;
      m.torso.rotation.x = 0.08;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      m.armR.rotation.x = -0.5 - swing * 2.5;
      m.armR.rotation.z = -0.2 - swing * 0.2;
      m.armL.rotation.x = -0.25 + swing * 0.5;
      m.armL.rotation.z = 0.25;
      m.head.rotation.x = -swing * 0.25;
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 26) * 0.12;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'skeleton') {
      // 뻑뻑한 걸음 · 녹슨 검을 옆에서 베어 올린다
      const s = Math.sin(this.walkPhase * 1.1);
      m.legL.rotation.x = s * 0.6;
      m.legR.rotation.x = -s * 0.6;
      m.body.position.y = Math.abs(s) * 0.4;
      m.torso.rotation.z = Math.sin(t * 1.1) * 0.05;
      m.head.rotation.z = Math.sin(t * 0.9) * 0.1;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      m.armR.rotation.set(-0.9 + swing * 2.6, 0, -0.35 + swing * 0.9);
      m.armL.rotation.set(-0.2, 0, 0.3);
      m.torso.rotation.y = swing * 0.55;
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 24) * 0.1;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'samurai') {
      // 허리를 낮춰 빠르게 파고들고, 카타나를 옆구리에서 뽑아 크게 벤다
      const s = Math.sin(this.walkPhase * 1.15);
      m.legL.rotation.x = s * 0.7;
      m.legR.rotation.x = -s * 0.7;
      m.body.position.y = Math.abs(s) * 0.5;
      m.torso.rotation.x = 0.12 + (atkP >= 0 ? 0.16 : 0);
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      // 칼을 뽑아 들고(왼쪽) → 오른쪽으로 내리긴다
      const shift = atkP >= 0 ? clamp(atkP, 0, 1) : 0;
      m.armR.rotation.x = -0.35 - swing * 1.5;
      m.armR.rotation.z = -0.15 + swing * 1.1;
      m.armL.rotation.x = -0.3 + swing * 0.6;
      m.armL.rotation.z = 0.2;
      m.torso.rotation.y = -0.6 + shift * 1.3;
      m.head.rotation.y = -shift * 0.5;
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 22) * 0.07;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'iron_golem') {
      // 쇳덩이 무게: 느린 걸음 · 양팔을 들어 내려친다
      const s = Math.sin(this.walkPhase * 0.6);
      m.legL.rotation.x = s * 0.36;
      m.legR.rotation.x = -s * 0.36;
      m.body.position.y = Math.abs(Math.sin(this.walkPhase * 0.6)) * 1.4;
      const swing = atkP >= 0 ? Math.sin(clamp(atkP, 0, 1) * Math.PI) : 0;
      m.armR.rotation.x = -2.0 * swing;
      m.armR.rotation.z = -0.12 - swing * 0.2;
      m.armL.rotation.x = -1.5 * swing;
      m.armL.rotation.z = 0.12 + swing * 0.2;
      m.body.rotation.x = swing * 0.2;
      m.head.rotation.x = -swing * 0.16;
      const pulse = 1 + Math.sin(t * (this.enraged ? 6 : 3.4)) * 0.1;
      if (m.core) m.core.scale.setScalar(pulse * (1 + swing * 0.22));
      if (m.coreHalo) m.coreHalo.scale.setScalar(pulse * 1.1);
      if (this.enraged && m.coreMat) {
        m.coreMat.emissiveIntensity = 3.4 + Math.sin(t * 8) * 1.6;
        if (m.eyeMat) m.eyeMat.color.setHex(Math.sin(t * 8) > 0 ? 0xffd08a : 0xff4a1c);
      }
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 20) * 0.05;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'dark_mage') {
      // 로브가 떠다니고, 룬 고리가 돌고, 지팡이를 들어 구체를 던진다
      const float = Math.sin(t * 1.6) * 1.5;
      m.body.position.y = 2.4 + float;
      m.body.position.z = 0;
      m.torso.rotation.x = 0.05 + Math.sin(t * 1.2) * 0.03;
      if (m.runeRing) {
        m.runeRing.rotation.y += dt * 0.55;
        m.runeRing.position.y = 20 + Math.sin(t * 2.4) * 1.2;
      }
      if (m.halo) {
        m.halo.rotation.z += dt * 0.4;
        m.halo.position.y = 41 + Math.sin(t * 1.8) * 1.0;
      }
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      // 지팡이를 앞으로 들어 구체를 내민 뒤 놓아 보낸다
      m.armR.rotation.x = -2.3 * swing;
      m.armR.rotation.z = -0.2 - swing * 0.3;
      m.armL.rotation.x = -0.6 * swing;
      m.armL.rotation.z = 0.35 + swing * 0.5;
      m.head.rotation.x = swing * 0.22;
      const pulse = 1 + Math.sin(t * (this.enraged ? 7 : 3.6)) * 0.14;
      if (m.orb) m.orb.scale.setScalar(pulse * (1 + swing * 0.5));
      if (m.orbHalo) m.orbHalo.scale.setScalar(pulse * 1.2 + swing * 0.6);
      if (m.baseGlow) m.baseGlow.material.opacity = (this.enraged ? 0.16 : 0.11) + Math.sin(t * 2.1) * 0.035;
      if (this.enraged && m.orbMat) {
        m.orbMat.color.setHex(0xff8ad0);
        m.orbMat.emissive.setHex(0xff2a8a);
        m.orbMat.emissiveIntensity = 3.6 + Math.sin(t * 8) * 1.6;
        if (m.eyeMat) m.eyeMat.color.setHex(Math.sin(t * 9) > 0 ? 0xff8ad0 : 0xd8a0ff);
        if (m.runeRing) {
          for (const r of m.runeRing.children) {
            if (r.material) r.material.color.setHex(0xff7ac0);
          }
        }
      }
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 20) * 0.08;
      else m.body.rotation.z = 0;
    }
  }

  /* --------------------------- 멀티플레이 미러 --------------------------- */
  // 호스트가 보낸 위치로 부드럽게 따라가며 모션만 재생한다 (AI 없음)
  updateRemote(dt) {
    this.time += dt;
    if (this.dead) {
      this.deadT += dt;
      const p = clamp(this.deadT / 0.9, 0, 1);
      this.root.scale.setScalar(Math.max(0.01, 1 - p));
      this.root.position.y = this.position.y - p * 2;
      this.root.rotation.z = p * 0.8;
      if (p >= 1) this.root.visible = false;
      return;
    }
    const dx = this.targetPos.x - this.position.x;
    const dz = this.targetPos.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    let traveled = 0;
    if (dist > 320) {
      this.position.x = this.targetPos.x;
      this.position.z = this.targetPos.z;
    } else if (dist > 0.05) {
      const k = 1 - Math.exp(-13 * dt);
      const stepX = dx * k;
      const stepZ = dz * k;
      this.position.x += stepX;
      this.position.z += stepZ;
      traveled = Math.hypot(stepX, stepZ);
      this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 9, dt);
    }
    this.position.y = terrainHeight(this.position.x, this.position.z);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;
    if (traveled > 0.02) this.walkPhase += dt * (4.5 + Math.min(80, traveled / Math.max(dt, 1e-4) * 0.3));
    this.state = this.remoteChase ? 'chase' : 'idle';
    this.attackT = this.remoteAtk > 0 ? this.attackDur * (1 - this.remoteAtk / 100) : 0;
    this.hurtT = Math.max(0, this.hurtT - dt);
    const p = this.game.player;
    const near = p ? Math.hypot(p.position.x - this.position.x, p.position.z - this.position.z) : 200;
    if (near < (this.game.mobManager ? this.game.mobManager.animRadius : 460)) this.animate(dt, near);
  }

  // 내가 가한 피해를 바로 보여 주기 (게스트 화면의 예상 표시)
  applyPredictedDamage(amount, crit) {
    if (this.dead) return;
    const dmg = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - dmg);
    this.hurtT = 0.3;
    this.game.hud.floater(
      String(dmg),
      new THREE.Vector3(this.position.x, this.position.y + this.height * 0.9, this.position.z),
      crit ? 'crit' : 'dmg', 1.2
    );
    if (crit) this.game.sfx.crit(); else this.game.sfx.hit();
    this.game.hud.setTarget(this);
    if (this.hp <= 0) {
      this.dead = true;
      this.deadT = 0;
      this.state = 'dead';
      this.root.scale.setScalar(1);
    }
  }

  distTo(p) { return Math.hypot(p.x - this.position.x, p.z - this.position.z); }
}

/* ------------------------------ 매니저 ------------------------------ */
export class MobManager {
  constructor(game) {
    this.game = game;
    this.mobs = [];
    // 이 거리 밖의 몹은 그리지도 업데이트하지도 않는다 (안개에 가려 보이지 않는 구간)
    this.cullRadius = 760;
    // 이 거리 밖의 몹은 위치만 갱신하고 애니메이션은 쉰다
    this.animRadius = 460;
    this.spawnAll();
  }

  spawnAll() {
    this.spawnWorld(1);
    // 고대 골렘을 잡아 2번째 세계가 열렸다면 그 몹들도 함께 세운다
    if (this.game && this.game.world2Unlocked) this.spawnWorld(2);
  }

  // 한 세계의 몹만 세운다 (2번째 세계는 포털이 열린 뒤에 처음 부른다 — 시작 부하를 줄인다)
  spawnWorld(worldId) {
    if (!this.spawnedWorlds) this.spawnedWorlds = {};
    if (this.spawnedWorlds[worldId]) return;
    this.spawnedWorlds[worldId] = true;
    const order = worldId === 2 ? BIOME_ORDER_W2 : BIOME_ORDER;
    for (const id of order) {
      const biome = BIOMES[id];
      const typeId = biome.mob;
      if (!typeId || !MOB_TYPES[typeId] || !biome.mobCount) continue; // 태초마을: 평화 지대
      if (MOB_TYPES[typeId].boss) {
        this.spawn(typeId, id === 'dark_realm' ? BOSS2_POS : BOSS_POS, id);
        continue;
      }
      for (let i = 0; i < biome.mobCount; i++) this.spawn(typeId, this.randomPoint(id), id);
    }
  }

  randomPoint(biomeId, awayFrom) {
    const b = BIOMES[biomeId].bounds;
    let x = 0, z = 0, tries = 0;
    do {
      x = rand(b.x0 + 90, b.x1 - 90);
      z = rand(b.z0 + 90, b.z1 - 90);
      tries++;
    } while (awayFrom && Math.hypot(x - awayFrom.x, z - awayFrom.z) < 200 && tries < 40);
    return { x, z };
  }

  spawn(typeId, pos, biomeId) {
    const mob = new Mob(this.game, typeId, pos, biomeId);
    mob.netId = this.mobs.length;
    this.mobs.push(mob);
    return mob;
  }

  update(dt) {
    const p = this.game.player;
    const px = p ? p.position.x : 0;
    const pz = p ? p.position.z : 0;
    for (let i = 0; i < this.mobs.length; i++) {
      const m = this.mobs[i];
      if (!p) {
        if (m.remote) m.updateRemote(dt);
        else m.update(dt);
        continue;
      }
      m.dist = Math.hypot(m.position.x - px, m.position.z - pz);
      if (m.dist > this.cullRadius) {
        if (m.root.visible) m.root.visible = false;
        m.updateFar(dt);
        continue;
      }
      if (!m.root.visible && !m.dead) m.root.visible = true;
      if (m.remote) m.updateRemote(dt);
      else m.update(dt);
    }
  }

  // AI 를 돌리지 않는 상태(시작 화면 · 상점 창 등)에서도 가까운 몸만 보이게 한다
  cullByDistance(center) {
    const p = center || (this.game.player ? this.game.player.position : BIOMES.village.spawn);
    if (!p) return;
    for (let i = 0; i < this.mobs.length; i++) {
      const m = this.mobs[i];
      m.dist = Math.hypot(m.position.x - p.x, m.position.z - p.z);
      if (m.dist > this.cullRadius) {
        if (m.root.visible) m.root.visible = false;
      } else if (!m.root.visible && !m.dead) {
        m.root.visible = true;
      }
    }
  }

  nearest(pos, maxDist) {
    let best = null;
    let bd = maxDist === undefined ? Infinity : maxDist;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const d = m.distTo(pos);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  inRadius(pos, radius) {
    const out = [];
    for (const m of this.mobs) {
      if (m.dead) continue;
      if (m.distTo(pos) <= radius + m.radius) out.push(m);
    }
    return out;
  }

  boss() {
    for (const m of this.mobs) if (m.type.boss) return m;
    return null;
  }

  // 모든 보스 (1번째 세계 고대 골렘 · 2번째 세계 흑마법사)
  bosses() {
    const out = [];
    for (const m of this.mobs) if (m.type.boss && !m.dead) out.push(m);
    return out;
  }

  // 가까운 보스 — 화면의 보스 체력 바는 이 보스를 따라간다
  nearestBoss(pos, maxDist) {
    let best = null;
    let bd = maxDist === undefined ? Infinity : maxDist;
    if (!pos) return null;
    for (const m of this.mobs) {
      if (m.dead || !m.type.boss) continue;
      const d = Math.hypot(m.position.x - pos.x, m.position.z - pos.z);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // 모든 몹을 장면에서 제거한다 (멀티플레이 전환 · 복귀용)
  clearAll() {
    for (const m of this.mobs) {
      if (m.root) this.game.scene.remove(m.root);
      if (m.clearBolts) m.clearBolts();
    }
    this.mobs.length = 0;
    this.spawnedWorlds = {};
  }

  resetAggro() {
    for (const m of this.mobs) {
      m.aggro = false;
      m.attackT = 0;
      m.state = 'idle';
    }
  }
}
