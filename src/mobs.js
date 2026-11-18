// 몹: 슬라임 · 좀비 · 하이에나 · 고릴라 · 고대 골렘(보스) + AI
import * as THREE from 'three';
import { BIOMES, BIOME_ORDER, BIOME_ORDER_W2, MOB_TYPES, BOSS_POS, BOSS2_POS, biomeOrderFor, bossPosFor } from './config.js';
import { terrainHeight, clamp, damp, dampAngle, rand, TAU, lerp, WORLD, WORLD2, WORLD3, clampToWorld, normWorld } from './utils.js';

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

// 가산 혼합 후광 (점광원 없이 빛나는 느낌만) — 몹 모델 공용
const haloGeo = new THREE.SphereGeometry(1, 10, 8);
function haloMesh(color, size, opacity, flatten) {
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opacity === undefined ? 0.2 : opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const m = new THREE.Mesh(haloGeo, mat);
  m.scale.set(size, size * (flatten === undefined ? 1 : flatten), size);
  return m;
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

/* ---------------------- 3번째 세계 몹 모델 ---------------------- */
function buildDragon() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const scaleMat = stdMat(0x2f6b4a, { roughness: 0.5, metalness: 0.35, emissive: 0x0d2a1c, emissiveIntensity: 0.55 });
  const scaleDark = stdMat(0x1d4430, { roughness: 0.6, metalness: 0.3, emissive: 0x0a2014, emissiveIntensity: 0.4 });
  const bellyMat = stdMat(0xc8b070, { roughness: 0.7 });
  const hornMat = stdMat(0xe8dcc0, { roughness: 0.5 });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x2a5a3e, roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.94,
    emissive: 0x0a2014, emissiveIntensity: 0.5,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  mats.push(scaleMat, scaleDark, bellyMat, hornMat, wingMat);

  // 몸통 · 배
  const torso = mkMesh(new THREE.SphereGeometry(16, 16, 12), scaleMat, 0, 26, 0);
  torso.scale.set(1, 0.88, 1.45);
  body.add(torso);
  const belly = mkMesh(new THREE.SphereGeometry(12, 14, 10), bellyMat, 0, 22, 3);
  belly.scale.set(0.85, 0.75, 1.15);
  body.add(belly);
  // 등 가시
  for (let i = 0; i < 6; i++) {
    const spike = mkMesh(new THREE.ConeGeometry(2.0, 7, 4), hornMat, 0, 38 - i * 1.2, 6 - i * 5);
    spike.rotation.x = -0.25;
    body.add(spike);
  }

  // 목 · 머리 · 턱
  const neck = new THREE.Group();
  neck.position.set(0, 32, 16);
  neck.rotation.x = 0.85;
  body.add(neck);
  neck.add(mkMesh(new THREE.CylinderGeometry(6.5, 9.5, 24, 8), scaleMat, 0, 11, 0));
  const head = new THREE.Group();
  head.position.set(0, 24, 2);
  neck.add(head);
  const skull = mkMesh(new THREE.BoxGeometry(13, 12, 18), scaleMat, 0, 0, 6);
  head.add(skull);
  head.add(mkMesh(new THREE.BoxGeometry(9, 6, 12), scaleDark, 0, -3, 14));
  const jaw = new THREE.Group();
  jaw.position.set(0, -5, 4);
  head.add(jaw);
  jaw.add(mkMesh(new THREE.BoxGeometry(10, 4, 16), scaleDark, 0, -1, 6));
  for (let i = 0; i < 4; i++) {
    jaw.add(mkMesh(new THREE.ConeGeometry(0.9, 2.6, 4), hornMat, -3.2 + i * 1.6, 1.6, 3 + i * 3));
  }
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(1.8, 8, 6), eyeMat, s * 4.4, 2.4, 11));
    const horn = mkMesh(new THREE.ConeGeometry(1.8, 14, 5), hornMat, s * 5.4, 8, -1);
    horn.rotation.z = -s * 0.4;
    horn.rotation.x = -0.5;
    head.add(horn);
  }

  // 날개
  const wingL = new THREE.Group();
  const wingR = new THREE.Group();
  wingL.position.set(13, 34, 2);
  wingR.position.set(-13, 34, 2);
  for (const [wing, s] of [[wingL, 1], [wingR, -1]]) {
    const bone = mkMesh(new THREE.CylinderGeometry(1.8, 2.4, 40, 6), scaleDark, s * 18, 2, 0);
    bone.rotation.z = -s * Math.PI / 2;
    wing.add(bone);
    const membrane = new THREE.Mesh(new THREE.CircleGeometry(30, 3), wingMat);
    membrane.scale.set(1.35, 1, 1);
    membrane.rotation.set(-Math.PI / 2, 0, s > 0 ? -0.35 : Math.PI + 0.35);
    membrane.position.set(s * 26, -2, -6);
    wing.add(membrane);
    const tip = mkMesh(new THREE.ConeGeometry(1.6, 8, 4), hornMat, s * 38, 2, 0);
    tip.rotation.z = -s * Math.PI / 2;
    wing.add(tip);
    body.add(wing);
  }

  // 네 다리
  const legs = [];
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 12, 16, sz * 12);
      leg.add(mkMesh(new THREE.CylinderGeometry(4.4, 3.6, 15, 6), scaleMat, 0, -7, 0));
      leg.add(mkMesh(new THREE.BoxGeometry(7, 3, 10), scaleDark, 0, -14, 2));
      body.add(leg);
      legs.push(leg);
    }
  }

  // 꼬리
  const tail = new THREE.Group();
  tail.position.set(0, 26, -18);
  body.add(tail);
  let tailSeg = tail;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, -i * 0.6, -12);
    seg.add(mkMesh(new THREE.CylinderGeometry(6 - i * 1.2, 5 - i * 1.2, 14, 7), i % 2 ? scaleDark : scaleMat, 0, 0, -7).rotateX(Math.PI / 2));
    tailSeg.add(seg);
    tailSeg = seg;
  }
  tailSeg.add(mkMesh(new THREE.ConeGeometry(3.4, 10, 5), hornMat, 0, 0, -16).rotateX(-Math.PI / 2));

  return { root, body, neck, head, jaw, wingL, wingR, legs, tail, eyeMat, mats, height: 50 };
}

function buildWyvern() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const scaleMat = stdMat(0x3f3f7a, { roughness: 0.5, metalness: 0.3, emissive: 0x1a1a3a, emissiveIntensity: 0.7 });
  const scaleDark = stdMat(0x252550, { roughness: 0.6, metalness: 0.3, emissive: 0x101028, emissiveIntensity: 0.5 });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a9a, roughness: 0.65, side: THREE.DoubleSide, transparent: true, opacity: 0.9,
    emissive: 0x1a1a44, emissiveIntensity: 0.6,
  });
  const hornMat = stdMat(0xd8d0f0, { roughness: 0.45 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x8fe8ff });
  mats.push(scaleMat, scaleDark, wingMat, hornMat);

  const torso = mkMesh(new THREE.SphereGeometry(10, 14, 10), scaleMat, 0, 20, 0);
  torso.scale.set(0.9, 0.85, 1.5);
  body.add(torso);
  // 긴 목 · 뾰족 머리
  const neck = new THREE.Group();
  neck.position.set(0, 24, 10);
  neck.rotation.x = 1.0;
  body.add(neck);
  neck.add(mkMesh(new THREE.CylinderGeometry(3.4, 5.0, 18, 7), scaleMat, 0, 8, 0));
  const head = new THREE.Group();
  head.position.set(0, 18, 1);
  neck.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(7, 6, 15), scaleMat, 0, 0, 5));
  head.add(mkMesh(new THREE.ConeGeometry(2.6, 6, 5), hornMat, 0, 0, 14).rotateX(Math.PI / 2));
  const jaw = new THREE.Group();
  jaw.position.set(0, -2.6, 3);
  head.add(jaw);
  jaw.add(mkMesh(new THREE.BoxGeometry(5.6, 2.2, 13), scaleDark, 0, -1, 5));
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(1.2, 8, 6), eyeMat, s * 2.6, 1.8, 9));
    const horn = mkMesh(new THREE.ConeGeometry(1.1, 9, 4), hornMat, s * 3.2, 4, -1);
    horn.rotation.set(-0.45, 0, -s * 0.35);
    head.add(horn);
  }

  // 날개 (더 크고 얇다)
  const wingL = new THREE.Group();
  const wingR = new THREE.Group();
  wingL.position.set(8, 25, 1);
  wingR.position.set(-8, 25, 1);
  for (const [wing, s] of [[wingL, 1], [wingR, -1]]) {
    const bone = mkMesh(new THREE.CylinderGeometry(1.3, 1.8, 34, 6), scaleDark, s * 15, 1, 0);
    bone.rotation.z = -s * Math.PI / 2;
    wing.add(bone);
    const membrane = new THREE.Mesh(new THREE.CircleGeometry(25, 3), wingMat);
    membrane.scale.set(1.4, 1, 1);
    membrane.rotation.set(-Math.PI / 2, 0, s > 0 ? -0.3 : Math.PI + 0.3);
    membrane.position.set(s * 22, -2, -5);
    wing.add(membrane);
    body.add(wing);
  }

  // 두 발 (가슴 앞으로 모은 발톱)
  const legs = [];
  for (const s of [1, -1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 6, 13, 2);
    leg.add(mkMesh(new THREE.CylinderGeometry(2.6, 2.2, 12, 6), scaleMat, 0, -5, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(4, 2, 8), scaleDark, 0, -11, 2));
    for (let i = -1; i <= 1; i++) {
      const claw = mkMesh(new THREE.ConeGeometry(0.7, 3.4, 4), hornMat, i * 1.6, -12, 7);
      claw.rotation.x = -1.3;
      leg.add(claw);
    }
    body.add(leg);
    legs.push(leg);
  }
  const legL = legs[0];
  const legR = legs[1];

  // 긴 꼬리 + 끝의 가시
  const tail = new THREE.Group();
  tail.position.set(0, 20, -12);
  body.add(tail);
  let seg = tail;
  for (let i = 0; i < 4; i++) {
    const s2 = new THREE.Group();
    s2.position.set(0, -i * 0.5, -9);
    s2.add(mkMesh(new THREE.CylinderGeometry(3.4 - i * 0.7, 2.8 - i * 0.6, 11, 6), i % 2 ? scaleDark : scaleMat, 0, 0, -5).rotateX(Math.PI / 2));
    seg.add(s2);
    seg = s2;
  }
  seg.add(mkMesh(new THREE.ConeGeometry(2.2, 8, 4), hornMat, 0, 0, -11).rotateX(-Math.PI / 2));

  return { root, body, neck, head, jaw, wingL, wingR, legL, legR, tail, eyeMat, mats, height: 34 };
}

function buildSpinosaurus() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const hideMat = stdMat(0x5a6b3a, { roughness: 0.85 });
  const hideDark = stdMat(0x3a4726, { roughness: 0.9 });
  const sailMat = new THREE.MeshStandardMaterial({
    color: 0x8a4a3a, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x3a1410, emissiveIntensity: 0.5,
  });
  const clawMat = stdMat(0xe0d8b8, { roughness: 0.5 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c });
  mats.push(hideMat, hideDark, sailMat);

  // 몸통 (배가 불룩한 육식 공룡)
  const torso = mkMesh(new THREE.SphereGeometry(13, 14, 12), hideMat, 0, 26, 0);
  torso.scale.set(0.95, 1.05, 1.6);
  body.add(torso);
  body.add(mkMesh(new THREE.SphereGeometry(10, 12, 10), hideDark, 0, 21, 8));

  // 목 · 긴 악어 주둥이
  const neck = new THREE.Group();
  neck.position.set(0, 32, 15);
  neck.rotation.x = 0.75;
  body.add(neck);
  neck.add(mkMesh(new THREE.CylinderGeometry(5.5, 7.5, 20, 8), hideMat, 0, 9, 0));
  const head = new THREE.Group();
  head.position.set(0, 20, 2);
  neck.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(8, 7, 14), hideMat, 0, 0, 5));
  head.add(mkMesh(new THREE.BoxGeometry(6, 4, 22), hideDark, 0, -1, 18));
  const jaw = new THREE.Group();
  jaw.position.set(0, -3, 5);
  head.add(jaw);
  jaw.add(mkMesh(new THREE.BoxGeometry(5.4, 2.6, 20), hideDark, 0, -1, 9));
  for (let i = 0; i < 6; i++) {
    jaw.add(mkMesh(new THREE.ConeGeometry(0.6, 2.4, 4), clawMat, -2.2 + (i % 2) * 4.4, 1.4, 3 + i * 3));
  }
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(1.4, 8, 6), eyeMat, s * 3.2, 2.2, 8));
  }

  // 등지느러미 — 돛 모양
  const sail = new THREE.Group();
  sail.position.set(0, 34, -2);
  body.add(sail);
  for (let i = 0; i < 7; i++) {
    const h = 22 - Math.abs(i - 3) * 4;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(1.6, h, 3), sailMat);
    spike.position.set(0, h * 0.42, -12 + i * 4.2);
    spike.rotation.x = 0.15;
    sail.add(spike);
  }

  // 뒷다리 2개 + 작은 앞발
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [leg, s] of [[legL, 1], [legR, -1]]) {
    leg.position.set(s * 9, 18, -2);
    leg.add(mkMesh(new THREE.CylinderGeometry(5, 3.6, 18, 7), hideMat, 0, -9, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(7, 3, 14), hideDark, 0, -18, 3));
    for (let i = -1; i <= 1; i++) {
      const claw = mkMesh(new THREE.ConeGeometry(0.9, 3, 4), clawMat, i * 2.2, -19, 10);
      claw.rotation.x = -1.3;
      leg.add(claw);
    }
    body.add(leg);
  }
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  for (const [arm, s] of [[armL, 1], [armR, -1]]) {
    arm.position.set(s * 8, 30, 8);
    arm.add(mkMesh(new THREE.CylinderGeometry(1.8, 1.4, 8, 5), hideMat, 0, -4, 2).rotateX(0.5));
    body.add(arm);
  }

  // 꼬리
  const tail = new THREE.Group();
  tail.position.set(0, 26, -16);
  body.add(tail);
  tail.add(mkMesh(new THREE.ConeGeometry(8, 34, 7), hideMat, 0, 0, -15).rotateX(-Math.PI / 2));

  return { root, body, neck, head, jaw, sail, legL, legR, armL, armR, tail, eyeMat, mats, height: 44 };
}

function buildTyrannosaurus() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const hideMat = stdMat(0x6b5434, { roughness: 0.85 });
  const hideDark = stdMat(0x463520, { roughness: 0.9 });
  const clawMat = stdMat(0xf0e8d0, { roughness: 0.45 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe24a });
  mats.push(hideMat, hideDark);

  // 거대한 몸통
  const torso = mkMesh(new THREE.SphereGeometry(15, 16, 12), hideMat, 0, 30, 0);
  torso.scale.set(0.95, 1.05, 1.45);
  body.add(torso);
  body.add(mkMesh(new THREE.SphereGeometry(11, 12, 10), hideDark, 0, 26, 9));
  // 등 혹
  for (let i = 0; i < 4; i++) {
    body.add(mkMesh(new THREE.ConeGeometry(2.2, 5, 4), hideDark, 0, 43 - i * 1.5, -3 - i * 5));
  }

  // 목 · 큰 머리 · 큰 턱
  const neck = new THREE.Group();
  neck.position.set(0, 38, 10);
  neck.rotation.x = 0.55;
  body.add(neck);
  neck.add(mkMesh(new THREE.CylinderGeometry(8, 11, 16, 8), hideMat, 0, 7, 0));
  const head = new THREE.Group();
  head.position.set(0, 16, 3);
  neck.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(14, 14, 18), hideMat, 0, 0, 5));
  head.add(mkMesh(new THREE.BoxGeometry(12, 6, 12), hideDark, 0, -6, 13));
  const jaw = new THREE.Group();
  jaw.position.set(0, -8, 4);
  head.add(jaw);
  jaw.add(mkMesh(new THREE.BoxGeometry(11, 4, 18), hideDark, 0, -1, 8));
  for (let i = 0; i < 6; i++) {
    head.add(mkMesh(new THREE.ConeGeometry(0.8, 3.2, 4), clawMat, -4 + (i % 2) * 8, -5.5, 4 + i * 2.6));
    jaw.add(mkMesh(new THREE.ConeGeometry(0.7, 2.6, 4), clawMat, -4 + (i % 2) * 8, 1.6, 3 + i * 2.6));
  }
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(1.6, 8, 6), eyeMat, s * 5.2, 3.2, 11));
    const brow = mkMesh(new THREE.BoxGeometry(4, 1.4, 3), hideDark, s * 5.2, 5.2, 11);
    brow.rotation.z = s * 0.28;
    head.add(brow);
  }

  // 다리 · 아주 작은 앞발
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [leg, s] of [[legL, 1], [legR, -1]]) {
    leg.position.set(s * 10, 20, 0);
    leg.add(mkMesh(new THREE.CylinderGeometry(6, 4.6, 22, 7), hideMat, 0, -11, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(9, 3.4, 17), hideDark, 0, -22, 4));
    for (let i = -1; i <= 1; i++) {
      const claw = mkMesh(new THREE.ConeGeometry(1.0, 3.6, 4), clawMat, i * 2.6, -23, 12);
      claw.rotation.x = -1.3;
      leg.add(claw);
    }
    body.add(leg);
  }
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  for (const [arm, s] of [[armL, 1], [armR, -1]]) {
    arm.position.set(s * 10, 34, 10);
    arm.add(mkMesh(new THREE.CylinderGeometry(1.6, 1.4, 6.4, 5), hideMat, 0, -3, 1.5).rotateX(0.7));
    arm.add(mkMesh(new THREE.ConeGeometry(0.8, 2.4, 4), clawMat, 0, -6.4, 3.4).rotateX(-1.0));
    body.add(arm);
  }

  // 두꺼운 꼬리
  const tail = new THREE.Group();
  tail.position.set(0, 30, -18);
  body.add(tail);
  tail.add(mkMesh(new THREE.ConeGeometry(10, 42, 7), hideMat, 0, 0, -19).rotateX(-Math.PI / 2));

  return { root, body, neck, head, jaw, legL, legR, armL, armR, tail, eyeMat, mats, height: 46 };
}

function buildFallenHero() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const armorMat = stdMat(0x2a2432, { roughness: 0.42, metalness: 0.85, emissive: 0x160e20, emissiveIntensity: 0.6 });
  const armorTrim = stdMat(0x8a3fbf, { roughness: 0.4, metalness: 0.7, emissive: 0x5a1a8a, emissiveIntensity: 1.4 });
  const capeMat = stdMat(0x1c1424, { roughness: 0.95, side: THREE.DoubleSide, emissive: 0x2a0a3a, emissiveIntensity: 0.5 });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xc58cff, emissive: 0x8a2aff, emissiveIntensity: 3.2, roughness: 0.25,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff5aa0 });
  mats.push(armorMat, armorTrim, capeMat);

  // 다리
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [leg, s] of [[legL, 1], [legR, -1]]) {
    leg.position.set(s * 2.6, 9, 0);
    leg.add(mkMesh(new THREE.BoxGeometry(3.2, 9, 3.6), armorMat, 0, -4.5, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(3.6, 2.2, 5.2), armorTrim, 0, -9.4, 0.8));
    body.add(leg);
  }
  // 몸통 · 어깨 견갑
  const torso = new THREE.Group();
  torso.position.y = 14;
  body.add(torso);
  torso.add(mkMesh(new THREE.BoxGeometry(8.4, 10, 4.8), armorMat, 0, 0, 0));
  torso.add(mkMesh(new THREE.BoxGeometry(6.4, 1.4, 5.0), armorTrim, 0, 3.4, 0.2));
  const sigil = mkMesh(new THREE.OctahedronGeometry(1.6, 0), armorTrim, 0, 0.4, 2.8);
  torso.add(sigil);
  for (const s of [-1, 1]) {
    const pad = mkMesh(new THREE.ConeGeometry(2.4, 5.4, 5), armorMat, s * 5.2, 3.6, 0);
    pad.rotation.z = -s * 0.5;
    torso.add(pad);
  }
  // 망토
  const cape = new THREE.Group();
  cape.position.set(0, 4, -2.6);
  torso.add(cape);
  const capeMesh = mkMesh(new THREE.PlaneGeometry(11, 18), capeMat, 0, -9, -2);
  capeMesh.rotation.x = 0.18;
  cape.add(capeMesh);
  // 팔
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  for (const [arm, s] of [[armL, 1], [armR, -1]]) {
    arm.position.set(s * 5.0, 3.2, 0);
    arm.add(mkMesh(new THREE.BoxGeometry(2.6, 6.4, 2.8), armorMat, 0, -3.2, 0));
    arm.add(mkMesh(new THREE.BoxGeometry(2.9, 1.2, 3.0), armorTrim, 0, -6.2, 0));
    torso.add(arm);
  }
  // 투구 · 눈
  const head = new THREE.Group();
  head.position.set(0, 6.4, 0.2);
  torso.add(head);
  head.add(mkMesh(new THREE.BoxGeometry(5.6, 5.4, 5.6), armorMat, 0, 0, 0));
  head.add(mkMesh(new THREE.BoxGeometry(4.6, 1.0, 0.6), new THREE.MeshBasicMaterial({ color: 0x0a0610 }), 0, 0.4, 2.9));
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(0.5, 7, 5), eyeMat, s * 1.2, 0.4, 3.1));
    const horn = mkMesh(new THREE.ConeGeometry(0.9, 5.0, 4), armorTrim, s * 2.4, 3.6, -0.4);
    horn.rotation.set(-0.3, 0, -s * 0.35);
    head.add(horn);
  }

  // 타락한 검 (오른손) — 보랏빛으로 타오르는 칼날
  const sword = new THREE.Group();
  sword.position.set(0, -6.2, 0.4);
  sword.add(mkMesh(new THREE.CylinderGeometry(0.5, 0.5, 3.2, 8), armorMat, 0, 1.6, 0));
  sword.add(mkMesh(new THREE.BoxGeometry(5.2, 0.7, 1.2), armorTrim, 0, 3.4, 0));
  sword.add(mkMesh(new THREE.BoxGeometry(1.7, 13, 0.5), bladeMat, 0, 10.2, 0));
  const swordTip = mkMesh(new THREE.ConeGeometry(1.2, 3.0, 4), bladeMat, 0, 18.2, 0);
  swordTip.rotation.y = Math.PI / 4;
  sword.add(swordTip);
  const swordHalo = haloMesh(0xb07aff, 6, 0.24);
  swordHalo.position.y = 12;
  sword.add(swordHalo);
  armR.add(sword);

  return { root, body, torso, head, armL, armR, legL, legR, cape, sword, eyeMat, bladeMat, mats, height: 26 };
}

function buildStrongChicken() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];
  const featherMat = stdMat(0xf2e4c4, { roughness: 0.85 });
  const featherWarm = stdMat(0xe8c88a, { roughness: 0.9 });
  const combMat = stdMat(0xd83a3a, { roughness: 0.6, emissive: 0x5a0a0a, emissiveIntensity: 0.5 });
  const beakMat = stdMat(0xffc23a, { roughness: 0.4, metalness: 0.2 });
  const legMat = stdMat(0xd89a3a, { roughness: 0.7 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffe08a, emissive: 0xffa020, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.85,
  });
  const eyeWhite = stdMat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.35 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a0a0a });
  mats.push(featherMat, featherWarm, combMat, beakMat, legMat);

  // 다리 — 굵은 닭다리와 발톱
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [leg, s] of [[legL, 1], [legR, -1]]) {
    leg.position.set(s * 10, 18, 0);
    leg.add(mkMesh(new THREE.CylinderGeometry(3.2, 2.6, 16, 7), legMat, 0, -8, 0));
    leg.add(mkMesh(new THREE.BoxGeometry(6, 2.4, 8), legMat, 0, -17, 2));
    for (let i = -1; i <= 1; i++) {
      const claw = mkMesh(new THREE.ConeGeometry(1.2, 5.0, 4), goldMat, i * 2.2, -18, 7);
      claw.rotation.x = -1.2;
      leg.add(claw);
    }
    body.add(leg);
  }

  // 거대하고 통통한 몸통
  const torso = mkMesh(new THREE.SphereGeometry(21, 18, 14), featherMat, 0, 34, 0);
  torso.scale.set(1.05, 1.0, 1.15);
  body.add(torso);
  body.add(mkMesh(new THREE.SphereGeometry(15, 14, 12), featherWarm, 0, 30, 8));
  // 가슴 깃과 날개
  const wingL = new THREE.Group();
  const wingR = new THREE.Group();
  for (const [wing, s] of [[wingL, 1], [wingR, -1]]) {
    wing.position.set(s * 19, 36, 0);
    const w = mkMesh(new THREE.SphereGeometry(9, 12, 10), featherWarm, 0, -2, 0);
    w.scale.set(0.42, 1.15, 1.3);
    wing.add(w);
    for (let i = 0; i < 3; i++) {
      const f = mkMesh(new THREE.ConeGeometry(2.0, 9, 4), featherMat, s * 1.6, -10, 4 - i * 4);
      f.rotation.z = -s * 0.5;
      wing.add(f);
    }
    body.add(wing);
  }
  // 꼬리 깃 — 화려하게 펼친 깃털
  const tail = new THREE.Group();
  tail.position.set(0, 38, -20);
  body.add(tail);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI - Math.PI / 2;
    const feather = mkMesh(new THREE.ConeGeometry(2.4, 24, 4), i % 2 ? goldMat : featherWarm, 0, 0, 0);
    feather.position.set(Math.sin(a) * 7, 8 + Math.cos(a) * 6, -8);
    feather.rotation.set(-0.7 - Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.45);
    tail.add(feather);
  }

  // 목 · 머리
  const head = new THREE.Group();
  head.position.set(0, 56, 4);
  body.add(head);
  head.add(mkMesh(new THREE.CylinderGeometry(6.4, 9.2, 16, 8), featherMat, 0, -10, 0));
  head.add(mkMesh(new THREE.SphereGeometry(10.5, 14, 12), featherMat, 0, 0, 0));
  // 벼슬 — 커다란 붉은 볏
  for (let i = 0; i < 4; i++) {
    const comb = mkMesh(new THREE.SphereGeometry(3.6 - i * 0.35, 10, 8), combMat, 0, 9 + Math.sin(i * 0.9) * 1.6, 3 - i * 3.2);
    comb.scale.set(0.8, 1.5, 1);
    head.add(comb);
  }
  // 눈 · 부리 · 볏 아래 고리
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(3.0, 10, 8), eyeWhite, s * 4.6, 2.4, 6.4));
    head.add(mkMesh(new THREE.SphereGeometry(1.5, 8, 6), eyeMat, s * 5.0, 2.4, 8.4));
    const brow = mkMesh(new THREE.BoxGeometry(4.4, 1.2, 2.0), combMat, s * 4.8, 5.4, 7.0);
    brow.rotation.z = s * 0.35;
    head.add(brow);
  }
  const beakTop = mkMesh(new THREE.ConeGeometry(6.0, 15, 4), beakMat, 0, -1.5, 11);
  beakTop.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  head.add(beakTop);
  const beakLow = mkMesh(new THREE.ConeGeometry(4.4, 10, 4), beakMat, 0, -6.5, 10);
  beakLow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  head.add(beakLow);
  for (const s of [-1, 1]) {
    const wattle = mkMesh(new THREE.SphereGeometry(2.6, 9, 7), combMat, s * 1.8, -8.2, 8.4);
    wattle.scale.set(1, 1.6, 1);
    head.add(wattle);
  }
  // 황금 왕관
  const crown = new THREE.Group();
  crown.position.set(0, 10.0, -1.5);
  head.add(crown);
  const crownRing = mkMesh(new THREE.CylinderGeometry(5.0, 5.0, 2.2, 12), goldMat, 0, 0, 0);
  crown.add(crownRing);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const point = mkMesh(new THREE.ConeGeometry(1.1, 4.4, 4), goldMat, Math.cos(a) * 4.4, 2.6, Math.sin(a) * 4.4);
    crown.add(point);
  }
  const crownHalo = haloMesh(0xffd24a, 9, 0.16);
  crownHalo.position.y = 2;
  crown.add(crownHalo);

  // 바닥의 황금 오라 · 닭 발자국 빛
  const aura = new THREE.Mesh(new THREE.RingGeometry(26, 34, 36), new THREE.MeshBasicMaterial({
    color: 0xffd24a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 1.2;
  body.add(aura);
  const bodyGlow = haloMesh(0xffb84a, 16, 0.04, 0.6);
  bodyGlow.position.y = 30;
  body.add(bodyGlow);

  return {
    root, body, head, wingL, wingR, legL, legR, tail, crown, crownHalo,
    aura, bodyGlow, combMat, beakMat, eyeMat, goldMat, mats, height: 58,
  };
}

/* --------------------------- 2세계 심해 · 거대 오징어 --------------------------- */
function buildGiantSquid() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];

  const mantleMat = stdMat(0x6d3d78, { roughness: 0.55, metalness: 0.05, emissive: 0x2a0f38, emissiveIntensity: 0.4 });
  const mantleDark = stdMat(0x472852, { roughness: 0.6, emissive: 0x180a20, emissiveIntensity: 0.35 });
  const fleshMat = stdMat(0xb07a94, { roughness: 0.62, emissive: 0x3a1628, emissiveIntensity: 0.3 });
  const finMat = stdMat(0x8a5296, { roughness: 0.55, emissive: 0x2a1038, emissiveIntensity: 0.35 });
  mats.push(mantleMat, mantleDark, fleshMat, finMat);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xd8fbff, emissive: 0x8fe8ff, emissiveIntensity: 2.2, roughness: 0.18,
  });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x06121a });
  const suckerMat = new THREE.MeshStandardMaterial({
    color: 0xffe0f2, emissive: 0xff86c8, emissiveIntensity: 1.1, roughness: 0.45,
  });
  const spotMat = new THREE.MeshStandardMaterial({
    color: 0x9ff4ff, emissive: 0x35d8e8, emissiveIntensity: 1.9, roughness: 0.3,
  });

  // 1) 외투(mantle) — 뒤-위로 길게 뻗은 원뿔과 날개지느러미
  const mantle = new THREE.Group();
  mantle.position.set(0, 10, -2);
  mantle.rotation.x = -0.22;
  body.add(mantle);
  mantle.add(mkMesh(new THREE.ConeGeometry(11.5, 34, 14), mantleMat, 0, 4, 0));
  mantle.add(mkMesh(new THREE.CylinderGeometry(11.4, 10.6, 8, 14), mantleDark, 0, -11, 0));
  const finL = new THREE.Group();
  const finR = new THREE.Group();
  for (const [fin, s] of [[finL, 1], [finR, -1]]) {
    fin.position.set(s * 4, 17, 0);
    const blade = mkMesh(new THREE.ConeGeometry(10, 19, 3), finMat, s * 6, 2, 0);
    blade.scale.set(1, 1, 0.22);
    blade.rotation.z = -s * (Math.PI / 2 + 0.25);
    fin.add(blade);
    mantle.add(fin);
  }
  // 외투 위의 발광 반점
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spot = mkMesh(new THREE.SphereGeometry(1.5, 8, 6), spotMat, Math.cos(a) * 8.2, 1 + (i % 3) * 5, Math.sin(a) * 8.2);
    mantle.add(spot);
  }

  // 2) 머리 — 아래로 처진 살덩이와 심연을 비추는 두 눈
  const head = new THREE.Group();
  head.position.set(0, -5, 2);
  body.add(head);
  head.add(mkMesh(new THREE.SphereGeometry(11.0, 16, 13), fleshMat, 0, 0, 0));
  for (const s of [-1, 1]) {
    head.add(mkMesh(new THREE.SphereGeometry(5.4, 14, 12), eyeMat, s * 7.4, 1.4, 7.2));
    head.add(mkMesh(new THREE.SphereGeometry(2.4, 10, 8), pupilMat, s * 7.8, 1.4, 11.2));
    const brow = mkMesh(new THREE.BoxGeometry(6.0, 1.8, 2.4), mantleDark, s * 7.2, 6.2, 8.0);
    brow.rotation.z = -s * 0.34;
    head.add(brow);
  }
  // 부리
  const beak = mkMesh(new THREE.ConeGeometry(3.6, 9, 4), mantleDark, 0, -8.5, 6.2);
  beak.rotation.set(Math.PI * 0.62, Math.PI / 4, 0);
  head.add(beak);

  // 3) 다리 8개 — 각 다리는 관절 세 마디가 따로 흔들린다
  const arms = [];
  const armAngles = [];
  const mkArm = (len, thick, segments, tipMat) => {
    const j0 = new THREE.Group();
    const segs = [j0];
    let parent = j0;
    let l = len;
    for (let i = 0; i < segments; i++) {
      const last = i === segments - 1;
      const rad = thick * (1 - i * 0.22);
      const mesh = last
        ? mkMesh(new THREE.ConeGeometry(rad * 0.75, l, 6), tipMat || mantleMat, 0, -l * 0.5, 0)
        : mkMesh(new THREE.CylinderGeometry(rad * 0.82, rad, l, 7), i % 2 ? mantleDark : mantleMat, 0, -l * 0.5, 0);
      parent.add(mesh);
      if (!last) {
        const joint = new THREE.Group();
        joint.position.y = -l;
        parent.add(joint);
        parent = joint;
        segs.push(joint);
      }
      l *= 0.82;
    }
    return segs;
  };
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const segs = mkArm(12, 3.2, 3);
    segs[0].position.set(Math.cos(a) * 6.6, -9, Math.sin(a) * 6.6);
    head.add(segs[0]);
    // 첫 마디 안쪽에 빛나는 빨판
    segs[0].add(mkMesh(new THREE.SphereGeometry(1.35, 8, 6), suckerMat, Math.cos(a) * 1.0, -6.0, Math.sin(a) * 1.0));
    arms.push(segs);
    armAngles.push({ x: Math.cos(a), z: Math.sin(a) });
  }

  // 4) 긴 촉수 2개 — 앞쪽으로 길게 뻗어 바닥을 더듬는다
  const tentacles = [];
  const tentacleAngles = [];
  for (const s of [-1, 1]) {
    const segs = mkArm(15, 2.4, 3, fleshMat);
    const a = s > 0 ? 0.5 : Math.PI - 0.5;
    segs[0].position.set(Math.cos(a) * 5.6, -8, Math.sin(a) * 5.6);
    head.add(segs[0]);
    // 촉수 끝의 곤봉과 빨판
    const club = new THREE.Group();
    club.position.y = -10.1;
    const lastJoint = segs[segs.length - 1];
    lastJoint.add(club);
    const bulb = mkMesh(new THREE.SphereGeometry(2.6, 10, 8), suckerMat, 0, -5, 0);
    bulb.scale.set(1, 2.1, 1);
    club.add(bulb);
    tentacles.push(segs);
    tentacleAngles.push({ x: Math.cos(a), z: Math.sin(a) });
  }

  // 5) 바닥의 어두운 그림자 같은 후광 (깊은 바다의 압박감)
  const bodyGlow = haloMesh(0x3fd8e8, 30, 0.05, 0.55);
  bodyGlow.position.y = -8;
  body.add(bodyGlow);

  return {
    root, body, head, mantle, finL, finR, arms, armAngles, tentacles, tentacleAngles,
    eyeMat, suckerMat, spotMat, bodyGlow, mats, height: 40,
  };
}

/* --------------------------- 3세계 고대유적 · 고대 뱀 (머리 세 개) --------------------------- */
function buildAncientSerpent() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mats = [];

  const scaleMat = stdMat(0x2f5c46, { roughness: 0.62, metalness: 0.12, emissive: 0x0d2418, emissiveIntensity: 0.4 });
  const scaleDark = stdMat(0x203e2e, { roughness: 0.7, emissive: 0x07130d, emissiveIntensity: 0.35 });
  const bellyMat = stdMat(0xbba76c, { roughness: 0.6, emissive: 0x3a2a08, emissiveIntensity: 0.3 });
  const crestMat = new THREE.MeshStandardMaterial({
    color: 0xffd27a, emissive: 0xc07a10, emissiveIntensity: 1.7, roughness: 0.35, metalness: 0.5,
  });
  const fangMat = stdMat(0xf2e8cf, { roughness: 0.4 });
  const mouthMat = stdMat(0x4a1414, { roughness: 0.85, emissive: 0x260606, emissiveIntensity: 0.6 });
  mats.push(scaleMat, scaleDark, bellyMat, crestMat);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfff2b8, emissive: 0xffa020, emissiveIntensity: 2.6, roughness: 0.22,
  });

  // 1) 바닥에 감긴 몸통 — 두 겹의 고리
  const coil1 = mkMesh(new THREE.TorusGeometry(19, 7.0, 9, 20), scaleMat, 0, 6.4, 0);
  coil1.rotation.x = Math.PI / 2;
  coil1.scale.set(1, 0.86, 1);
  body.add(coil1);
  const coil2 = mkMesh(new THREE.TorusGeometry(13.5, 5.6, 9, 18), scaleDark, 0, 13.4, 0);
  coil2.rotation.x = Math.PI / 2;
  coil2.scale.set(1, 0.82, 1);
  body.add(coil2);
  // 배 비놀
  body.add(mkMesh(new THREE.BoxGeometry(13, 3.2, 20), bellyMat, 0, 4.0, 12));

  // 2) 꼬리 — 일곱 마디가 물결처럼 흔들린다
  const tailSegs = [];
  let tailParent = new THREE.Group();
  tailParent.position.set(0, 9, -16);
  body.add(tailParent);
  let tr = 5.4;
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    tailParent.add(g);
    const seg = mkMesh(new THREE.CylinderGeometry(tr * 0.78, tr, 13, 8), i % 2 ? scaleDark : scaleMat, 0, 0, -6.5);
    seg.rotation.x = Math.PI / 2;
    g.add(seg);
    // 등 위의 비놀
    const ridge = mkMesh(new THREE.ConeGeometry(1.5, 4.4, 4), crestMat, 0, tr * 0.8, -6);
    g.add(ridge);
    g.position.z = i === 0 ? 0 : -13;
    g.position.y = -i * 0.7;
    tailSegs.push(g);
    tailParent = g;
    tr *= 0.86;
  }

  // 3) 목덜미 받침 (가슴)
  const chest = new THREE.Group();
  chest.position.y = 16;
  body.add(chest);
  chest.add(mkMesh(new THREE.CylinderGeometry(10.5, 13.0, 16, 10), scaleMat, 0, 0, 0));
  chest.add(mkMesh(new THREE.BoxGeometry(9, 13, 4.2), bellyMat, 0, -1, 10.4));

  // 4) 세 개의 목과 머리 — 각각 따로 흔들린다
  const necks = [];
  const heads = [];
  for (let i = 0; i < 3; i++) {
    const side = i - 1;                 // -1 왼쪽 · 0 가운데 · 1 오른쪽
    const neck = new THREE.Group();
    neck.position.set(side * 8.4, 6, 1.0);
    neck.rotation.z = -side * 0.30;
    chest.add(neck);
    // 목 마디 두 개 — 위로 뻗으며 바깥으로 젖혀진다
    const lower = mkMesh(new THREE.CylinderGeometry(4.4, 5.6, 15, 9), i === 1 ? scaleMat : scaleDark, 0, 7.5, 0);
    neck.add(lower);
    const upperJoint = new THREE.Group();
    upperJoint.position.y = 15;
    upperJoint.rotation.z = -side * 0.22;
    upperJoint.rotation.x = -0.16;
    neck.add(upperJoint);
    upperJoint.add(mkMesh(new THREE.CylinderGeometry(3.6, 4.6, 13, 9), scaleMat, 0, 6.5, 0));
    // 목의 비놀 · 금빛 깃
    for (let k = 0; k < 3; k++) {
      const frill = mkMesh(new THREE.ConeGeometry(1.7, 5.2, 4), crestMat, 0, 3 + k * 5.5, -3.6);
      frill.rotation.x = -0.5;
      upperJoint.add(frill);
    }

    // 머리
    const headG = new THREE.Group();
    headG.position.y = 13;
    upperJoint.add(headG);
    headG.add(mkMesh(new THREE.BoxGeometry(8.6, 6.6, 15), scaleMat, 0, 0, 4));
    headG.add(mkMesh(new THREE.BoxGeometry(7.0, 4.4, 8), scaleDark, 0, -1.0, 12.5));
    // 눈 — 두 눈 모두 금빛으로 타오른다
    for (const s of [-1, 1]) {
      headG.add(mkMesh(new THREE.SphereGeometry(2.1, 10, 8), eyeMat, s * 3.5, 1.8, 5.6));
      const slit = mkMesh(new THREE.BoxGeometry(0.7, 2.4, 0.7), stdMat(0x120800, { roughness: 0.9 }), s * 3.7, 1.8, 7.3);
      headG.add(slit);
      const horn = mkMesh(new THREE.ConeGeometry(1.3, 6.4, 5), crestMat, s * 3.2, 4.4, -1.2);
      horn.rotation.x = -0.55;
      horn.rotation.z = s * 0.24;
      headG.add(horn);
    }
    // 이탈 치아 · 코뿔 크레스트
    for (let k = 0; k < 4; k++) {
      const f = mkMesh(new THREE.ConeGeometry(0.85, 3.6, 4), fangMat, -3 + k * 2, -2.9, 10 + (k % 2) * 3);
      f.rotation.x = Math.PI;
      headG.add(f);
    }
    headG.add(mkMesh(new THREE.ConeGeometry(1.8, 9, 4), crestMat, 0, 3.6, -0.5));
    headG.add(mkMesh(new THREE.ConeGeometry(1.3, 6, 4), crestMat, 0, 3.0, 3.0));
    // 아래턱 — 문을 때 크게 벌어진다
    const jaw = new THREE.Group();
    jaw.position.set(0, -2.6, 3.2);
    headG.add(jaw);
    jaw.add(mkMesh(new THREE.BoxGeometry(6.6, 2.4, 11), scaleDark, 0, -1.0, 5.0));
    jaw.add(mkMesh(new THREE.BoxGeometry(6.0, 0.8, 10), mouthMat, 0, 0.4, 5.0));
    for (let k = 0; k < 3; k++) {
      const f = mkMesh(new THREE.ConeGeometry(0.75, 3.0, 4), fangMat, -2 + k * 2, 1.6, 3 + (k % 2) * 4);
      jaw.add(f);
    }

    necks.push({ group: neck, upper: upperJoint, baseZ: -side * 0.30, side });
    heads.push({ group: headG, jaw, side });
  }

  // 5) 바닥의 금빛 오라 — 신전의 룬이 몸을 감싼다
  const aura = new THREE.Mesh(new THREE.RingGeometry(26, 33, 40), new THREE.MeshBasicMaterial({
    color: 0xffc25a, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 1.2;
  body.add(aura);

  return {
    root, body, chest, necks, heads, tailSegs, coil1, coil2, aura, eyeMat, crestMat, mats, height: 46,
  };
}

const BUILDERS = {
  slime: buildSlime, zombie: buildZombie, hyena: buildHyena, gorilla: buildGorilla,
  raider: buildRaider, golem: buildGolem,
  goblin: buildGoblin, skeleton: buildSkeleton, samurai: buildSamurai,
  iron_golem: buildIronGolem, dark_mage: buildDarkMage,
  dragon: buildDragon, wyvern: buildWyvern, spinosaurus: buildSpinosaurus,
  tyrannosaurus: buildTyrannosaurus, fallen_hero: buildFallenHero,
  strong_chicken: buildStrongChicken,
  giant_squid: buildGiantSquid,
  ancient_serpent: buildAncientSerpent,
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

    // 보스 스킬 (예고 → 발동) — 스킬마다 따로 쿨타임이 돈다
    this.skillCds = {};
    const skills = this.type.skills || [];
    for (const s of skills) this.skillCds[s.id] = rand(2.5, 5.5);
    this.castT = 0;
    this.castDur = 0;
    this.castDef = null;
    this.castHit = false;
    this.castSeq = 0;
    this.castSpots = [];
    this.skillGap = 0;
    this.cueSeq = -1;
    // 고대의 수호 — 잠깐 받는 피해가 줄어드는 보호
    this.guardT = 0;

    // 멀티플레이: netId 가 있으면 호스트 권한 몹, remote=true 면 친구 화면에서 보는 미러
    this.netId = undefined;
    this.remote = false;
    this.targetPos = this.position.clone();
    this.remoteChase = false;
    this.remoteAtk = 0;
    this.lastSeen = 0;
    this.targetRef = null;
    // 이 몹이 사는 세계 (1 | 2 | 3) — 이동 제한과 부활 자리를 정한다
    this.worldId = normWorld(this.biome && this.biome.world);
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
    // 고대의 수호(보스 자기 버프) 동안에는 받는 피해가 줄어든다
    const dmg = Math.max(1, Math.round(this.guardT > 0 ? amount * 0.7 : amount));
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
    // 퀘스트: 혼자 하기에서 잡은 몹을 센다 (함께 하기에서는 호스트가 net.onMobDeath 로 센다)
    if (!multiplayerHost && typeof this.game.recordKill === 'function') {
      this.game.recordKill(this.typeId, this.worldId);
    }
    this.game.effects.burst(new THREE.Vector3(this.position.x, this.position.y + this.height * 0.5, this.position.z), this.type.boss ? 0x9fe8ff : 0xffcf8a, this.type.boss ? 40 : 14, { power: this.type.boss ? 60 : 26, size: this.type.boss ? 2.2 : 0.8 });
    this.clearBolts();
    this.castT = 0;
    this.castDef = null;
    this.castSpots = [];
    this.guardT = 0;
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
    this.castT = 0;
    this.castDef = null;
    this.castSpots = [];
    this.castHit = false;
    this.guardT = 0;
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
    // 어둠 구체가 날아간다 (원거리 보스) — 대상이 죽어도 날아가던 구체는 계속 움직인다
    if (this.bolts.length) this.updateBolts(dt);
    const target = this.pickTarget();
    if (!target) {
      // 상대가 사라져도 이미 시작한 스킬 예고는 끝까지 진행된다 (예고가 멈춘 채 남지 않게)
      if (this.castT > 0) this.tickCast(dt, null);
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
      this.skillGap = Math.max(0, this.skillGap - dt);
      this.guardT = Math.max(0, this.guardT - dt);
      for (const id in this.skillCds) this.skillCds[id] = Math.max(0, this.skillCds[id] - dt);
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

    if (this.castT > 0) {
      // 보스 스킬 예고 → 발동 (예고 동안은 거의 제자리)
      speedMul = 0;
      this.state = 'chase';
      if (this.castDef && this.castDef.kind !== 'boulder' && this.castDef.kind !== 'volley' && target.alive) {
        this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 5, dt);
      }
      this.tickCast(dt, target);
    } else if (this.slamT > 0) {
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
        this.resolveAttack();
      }
      speedMul = 0.1;
    } else if (this.aggro && target.alive) {
      // 격노한 보스는 몇 대 때린 뒤 충격파를 내려친다
      const canSlam = this.type.boss && this.enraged && this.slamCd <= 0
        && dist < (this.type.slamRadius || 200) * 1.15
        && this.attacksSinceSlam >= (this.type.slamEvery || 3);
      const skill = canSlam ? null : this.pickBossSkill(dist, target);
      if (canSlam) {
        this.startSlam();
        speedMul = 0;
      } else if (skill) {
        this.startBossSkill(skill, target);
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
    // 3세계 태초마을도 안전 지대 — 선사시대 숲 몬스터는 마을 남문 밖에서 멈춘다
    if (this.worldId === 3 && this.biomeId !== 'village_w3' && this.biomeId !== 'occupied_ranch' && this.position.z > WORLD3.originZ + 1492) {
      this.position.z = WORLD3.originZ + 1492;
    }

    // 지형 · 경계 (사는 세계의 통행 영역)
    clampToWorld(this.position, this.worldId);
    this.position.y = terrainHeight(this.position.x, this.position.z);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;

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

  // 이 몹이 노릴 수 있는 상대인가 — 살아 있고, 같은 세계에 있어야 한다
  // (다른 세계에 있는 친구가 보이지 않는 곳에서 맞거나, 반대로 맞지 않는 일을 막는다)
  canTarget(t) {
    if (!t || !t.alive) return false;
    if (t.world === undefined || t.world === null) return true;
    return normWorld(t.world) === this.worldId;
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
      if (!this.canTarget(t)) continue;
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
    // 격노 충격파가 스킬 예고보다 먼저다
    this.castT = 0;
    this.castDef = null;
    this.castSpots = [];
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
      if (!this.canTarget(t)) continue;
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

  /* --------------------- 보스 스킬 (예고 → 발동) --------------------- */
  // 지금 쓸 수 있는 스킬 하나를 고른다 — 격노 전에도 쓰고, 격노하면 쿨타임이 짧아 더 자주 쓴다
  pickBossSkill(dist, target) {
    const list = this.type.skills;
    if (!list || !list.length) return null;
    if (this.castT > 0 || this.slamT > 0 || this.attackT > 0 || this.skillGap > 0) return null;
    if (!this.aggro || !target || !target.alive) return null;
    // 멀리서 견제하는 상대에게는 바위부터 (원거리 카이팅이 공짜가 되지 않게)
    const ordered = dist > 130
      ? list.filter((d) => d.preferFar).concat(list.filter((d) => !d.preferFar))
      : list;
    for (const def of ordered) {
      if ((this.skillCds[def.id] || 0) > 0) continue;
      if (def.minRange && dist < def.minRange) continue;
      if (def.maxRange && dist > def.maxRange) continue;
      return def;
    }
    return null;
  }

  // 스킬이 터질 자리들 — 예고 그림과 피해 판정이 같은 자리를 쓴다
  skillSpots(def, target) {
    const out = [];
    const self = { x: this.position.x, z: this.position.z, r: def.radius || 180 };
    if (def.kind === 'boulder') {
      // 지금 서 있는 자리를 겨냥해 바위를 던진다 (예고 뒤 그 자리를 벗어나면 피한다)
      out.push({ x: target.position.x, z: target.position.z, r: def.radius || 78 });
      return out;
    }
    if (def.kind === 'meteor') {
      const list = (this.game.combatTargets ? this.game.combatTargets() : null) || [];
      const picked = [];
      for (const t of list) {
        if (!this.canTarget(t)) continue;
        picked.push({ x: t.position.x, z: t.position.z });
      }
      if (!picked.length) picked.push({ x: target.position.x, z: target.position.z });
      const n = Math.max(2, Math.min(def.count || 3, 4));
      for (let i = 0; i < n; i++) {
        const p = picked[i] || {
          x: target.position.x + Math.cos(rand(0, TAU)) * rand(130, 250),
          z: target.position.z + Math.sin(rand(0, TAU)) * rand(130, 250),
        };
        out.push({ x: p.x, z: p.z, r: def.radius || 96 });
      }
      return out;
    }
    // quake · nova · roar: 보스 몸을 중심으로
    out.push(self);
    return out;
  }

  startBossSkill(def, target) {
    if (!def) return false;
    const spots = this.skillSpots(def, target);
    const dur = (def.telegraph || 1) * (this.enraged ? 0.85 : 1);
    this.castDef = def;
    this.castDur = dur;
    this.castT = dur;
    this.castHit = false;
    this.castSpots = spots;
    this.castSeq = (this.castSeq + 1) % 251;
    this.attackT = 0;
    this.attackHit = true;
    this.skillGap = 0;
    this.skillCds[def.id] = (this.enraged ? (def.enragedCooldown || def.cooldown) : def.cooldown) * rand(0.9, 1.12);
    this.game.sfx.boss();
    // 예고 연출 + 이름 표시 (나와 친구 화면 모두)
    this.showSkillCue(def, spots, dur, this.castSeq);
    // 함께 하기: 호스트는 친구 화면에도 같은 예고 자리를 알려 준다
    const net = this.game.net;
    if (net && net.active && net.isHost && typeof net.broadcastBossSkill === 'function') {
      net.broadcastBossSkill(this, def, spots, dur);
    }
    return true;
  }

  // 예고 시간을 흘려보내고, 예고가 끝나기 직전에 실제로 터뜨린다
  tickCast(dt) {
    if (this.castT <= 0) return false;
    this.castT -= dt;
    if (!this.castHit && this.castDur > 0 && this.castT <= this.castDur * 0.28) {
      this.castHit = true;
      this.resolveBossSkill();
    }
    if (this.castT <= 0) {
      this.castT = 0;
      this.castDef = null;
      this.castSpots = [];
    }
    return this.castT > 0;
  }

  // 예고 그림 · 이름 표시 — 같은 예고(seq)를 두 번 그리지 않는다
  showSkillCue(def, spots, dur, seq) {
    if (!def) return;
    if (seq !== undefined && seq !== null) {
      if (this.cueSeq === seq) return;
      this.cueSeq = seq;
    }
    const g = this.game;
    if (g.hud && g.hud.floater) {
      g.hud.floater(
        def.label || def.name,
        new THREE.Vector3(this.position.x, this.position.y + this.height * 1.2, this.position.z),
        'boss', 2.6
      );
    }
    const fx = g.effects;
    if (!fx) return;
    const color = def.color || 0xffa54a;
    const life = dur || def.telegraph || 1;
    let list = spots;
    // 자리를 모르는 화면(친구 화면 폴백)에서도 보스 중심 기술은 범위를 보여 준다
    if ((!list || !list.length) && (def.kind === 'aoe' || def.kind === 'nova')) {
      list = [{ x: this.position.x, z: this.position.z, r: def.radius || 180 }];
    }
    for (const s of (list || [])) {
      const y = terrainHeight(s.x, s.z);
      fx.ring(new THREE.Vector3(s.x, y + 1.5, s.z), color, s.r, { duration: life, thickness: 0.05, yOffset: 1.5 });
      fx.ring(new THREE.Vector3(s.x, y + 1.5, s.z), color, s.r * 0.45, { duration: life, thickness: 0.02, yOffset: 1.5 });
      if (def.kind === 'meteor') fx.crack({ x: s.x, y, z: s.z }, color, s.r, life);
    }
  }

  // 스킬 발동 — 스킬 종류마다 연출과 피해 방식이 다르다
  resolveBossSkill() {
    const def = this.castDef;
    if (!def) return;
    const spots = (this.castSpots && this.castSpots.length)
      ? this.castSpots
      : [{ x: this.position.x, z: this.position.z, r: def.radius || 180 }];
    const g = this.game;
    const fx = g.effects;
    const base = this.type.damage * (def.damage || 1);
    this.skillGap = 1.1;

    if (def.kind === 'boulder') {
      this.fireBoulder(spots[0], base);
      return;
    }
    if (def.kind === 'volley') {
      this.fireVolley(def, base);
      return;
    }
    if (def.kind === 'meteor') {
      for (const s of spots) {
        const y = terrainHeight(s.x, s.z);
        if (fx) {
          fx.pillar(new THREE.Vector3(s.x, y, s.z), 0xc58cff, 150, 0.75, s.r * 0.7);
          fx.burst(new THREE.Vector3(s.x, y + 6, s.z), 0xb06aff, 26, { power: 54, size: 1.5 });
          fx.ring(new THREE.Vector3(s.x, y + 1.5, s.z), 0x8a3aff, s.r * 1.15, { duration: 0.5, thickness: 0.06, yOffset: 1.5 });
        }
        this.damageArea(s.x, s.z, s.r, base);
      }
      g.shake(1.0);
      g.sfx.boss();
      return;
    }

    // quake(대지 분쇄) · nova(공허의 파동 · 고대의 포효)
    const s = spots[0];
    this.damageArea(s.x, s.z, s.r, base);
    if (fx) {
      const y = s.y === undefined ? this.position.y : s.y;
      fx.ring(new THREE.Vector3(s.x, y + 1.5, s.z), def.color || 0xffb15c, s.r * 1.1, { duration: 0.62, thickness: 0.07, yOffset: 1.5 });
      fx.burst(new THREE.Vector3(s.x, y + 6, s.z), def.color || 0xffc46a, 34, { power: 78, size: 1.8 });
      if (def.kind !== 'nova') fx.crack({ x: s.x, y: terrainHeight(s.x, s.z), z: s.z }, 0xff8a4a, s.r * 0.8, 0.9);
    }
    g.shake(def.kind === 'nova' ? 1.0 : 1.25);
    if (def.buff) {
      // 고대의 수호 — 잠깐 단단해진다
      this.guardT = def.buff;
      if (fx) fx.ring(new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z), 0x9fe8ff, 120, { duration: 0.85, thickness: 0.04, yOffset: 1.5 });
      if (g.hud && g.hud.floater) {
        g.hud.floater(def.buffLabel || '수호', new THREE.Vector3(this.position.x, this.position.y + this.height * 1.4, this.position.z), 'boss', 1.9);
      }
    }
  }

  // 범위 피해 — 내 캐릭터와 함께 하는 친구 모두에게 (호스트가 판정을 가진다)
  damageArea(x, z, radius, baseDmg) {
    const list = this.game.combatTargets ? this.game.combatTargets() : null;
    const targets = list || (this.game.player
      ? [{ local: true, alive: this.game.player.alive, radius: this.game.player.radius || 4.6, position: this.game.player.position }]
      : []);
    const src = new THREE.Vector3(x, terrainHeight(x, z), z);
    let hits = 0;
    for (const t of targets) {
      if (!this.canTarget(t)) continue;
      const d = Math.hypot(t.position.x - x, t.position.z - z);
      if (d > radius + (t.radius || 4.6)) continue;
      const falloff = clamp(1 - (d / radius) * 0.35, 0.65, 1);
      const dmg = baseDmg * falloff;
      hits++;
      if (t.remote) {
        if (this.game.net) this.game.net.hitGuest(t.pid, dmg, src);
      } else {
        const p = this.game.player;
        if (p && p.alive) p.takeDamage(dmg, src);
      }
    }
    return hits;
  }

  // 바위 투척 — 예고한 자리로 돌덩이가 날아가 터진다
  fireBoulder(spot, base) {
    if (!spot) return;
    const from = new THREE.Vector3(this.position.x, this.position.y + this.height * 0.75, this.position.z);
    const tx = spot.x - from.x;
    const tz = spot.z - from.z;
    const d = Math.hypot(tx, tz) || 1;
    const color = this.enraged ? 0xff8a3a : 0xffc46a;
    const g = new THREE.Group();
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(6.4, 0),
      new THREE.MeshStandardMaterial({ color: 0x8f9084, emissive: color, emissiveIntensity: 1.5, roughness: 0.9, metalness: 0.1 })
    );
    g.add(rock);
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(11, 10, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    ));
    g.position.copy(from);
    this.game.scene.add(g);
    const speed = this.enraged ? 320 : 250;
    this.bolts.push({
      mesh: g, x: from.x, z: from.z, y: from.y,
      dx: tx / d, dz: tz / d,
      speed,
      dmg: base,
      life: d / speed + 0.02,
      t: 0,
      radius: (spot.r || 78) * 0.75,
      color,
      kind: 'boulder',
    });
    this.game.sfx.orb();
  }

  // 암흑 3연 구체 — 부채꼴로 세 발
  fireVolley(def, base) {
    const target = this.canTarget(this.targetRef) ? this.targetRef : this.pickTarget();
    if (!target) return;
    const from = new THREE.Vector3(this.position.x, this.position.y + this.height * 0.62, this.position.z);
    const tx = target.position.x - from.x;
    const tz = target.position.z - from.z;
    const aim = Math.atan2(tx, tz);
    const color = this.enraged ? 0xff5a9a : 0xb06aff;
    const n = Math.max(1, def.count || 3);
    const spread = def.spread === undefined ? 0.3 : def.spread;
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * spread;
      this.spawnBolt(from, Math.sin(a), Math.cos(a), base * 0.7, { color, speed: this.enraged ? 250 : 205, radius: 13 });
    }
    this.game.sfx.orb();
  }

  resolveAttack() {
    const target = this.targetRef;
    if (!this.canTarget(target)) return;
    // 휘두르기 시작할 때 잰 거리가 아니라, 지금 거리로 판정한다
    // (그 사이 상대가 조금 움직였거나 몹끼리 밀려나도 휘두른 타격이 헛돌지 않게)
    const dist = Math.hypot(target.position.x - this.position.x, target.position.z - this.position.z);
    const reach = this.type.attackRange + (target.radius || 4.6) + 8;
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
    if (!this.canTarget(target)) return;
    const from = new THREE.Vector3(this.position.x, this.position.y + this.height * 0.62, this.position.z);
    const tx = target.position.x - from.x;
    const tz = target.position.z - from.z;
    const d = Math.hypot(tx, tz) || 1;
    const color = this.enraged ? 0xff5a9a : 0xa46aff;
    this.spawnBolt(from, tx / d, tz / d, this.type.damage * rand(0.85, 1.05), { color, speed: this.enraged ? 240 : 190 });
    this.game.sfx.orb();
  }

  // 날아가는 구체 하나를 만든다 (어둠 구체 · 암흑 3연 구체 · 바위 투척 공용)
  spawnBolt(from, dx, dz, dmg, opts) {
    const o = opts || {};
    const color = o.color || 0xa46aff;
    const scene = this.game.scene;
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(o.size || 3.0, 12, 9), new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 3.4, roughness: 0.2,
    }));
    g.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry((o.size || 3.0) * 1.75, 10, 8), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    g.add(halo);
    g.position.copy(from);
    scene.add(g);
    this.bolts.push({
      mesh: g, x: from.x, z: from.z, y: from.y,
      dx, dz,
      speed: o.speed || 190,
      dmg,
      life: o.life || 2.6,
      t: 0,
      radius: o.radius || 12,
      color,
      kind: o.kind || 'orb',
    });
    return this.bolts[this.bolts.length - 1];
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
      b.mesh.rotation.x += dt * 3;
      let hit = null;
      for (const t of list) {
        if (!this.canTarget(t)) continue;
        const rr = (b.radius || 12) + (t.radius || 4.6);
        if (Math.hypot(t.position.x - b.x, t.position.z - b.z) < rr) { hit = t; break; }
      }
      const expired = b.t > b.life;
      if (hit || expired) {
        // 바위 투척은 예고한 자리에 떨어지면 그 자리 주변을 함께 때린다
        if (b.kind === 'boulder' && expired && !hit) {
          this.damageArea(b.x, b.z, b.radius || 60, b.dmg);
        }
        if (hit) {
          if (hit.remote) {
            if (this.game.net) this.game.net.hitGuest(hit.pid, b.dmg, new THREE.Vector3(b.x, b.y, b.z));
          } else {
            const p = this.game.player;
            if (p && p.alive) p.takeDamage(b.dmg, new THREE.Vector3(b.x, b.y, b.z));
          }
        }
        if (this.game.effects) {
          const color = b.color || 0xa46aff;
          this.game.effects.burst(new THREE.Vector3(b.x, b.y, b.z), color, b.kind === 'boulder' ? 24 : 14, { power: b.kind === 'boulder' ? 52 : 30, size: b.kind === 'boulder' ? 1.6 : 1.1 });
          this.game.effects.ring(new THREE.Vector3(b.x, b.y - 6, b.z), color, b.kind === 'boulder' ? 72 : 46, { duration: 0.45, thickness: 0.05 });
        }
        if (b.kind === 'boulder') this.game.shake(0.7);
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
      const castP = (this.castT > 0 && this.castDef && this.castDef.kind !== 'boulder')
        ? clamp(1 - this.castT / this.castDur, 0, 1) : -1;
      const slamP = this.slamT > 0 ? clamp(1 - this.slamT / this.slamDur, 0, 1) : castP;
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
      // 보스 스킬 예고 — 지팡이를 높이 들어 두 팔을 벌린다
      if (this.castT > 0 && this.castDef && this.castDur > 0) {
        const cp = clamp(1 - this.castT / this.castDur, 0, 1);
        const lift = Math.sin(Math.min(1, cp / 0.8) * Math.PI * 0.5);
        m.armR.rotation.x = -2.9 * lift;
        m.armR.rotation.z = -0.2 - 0.4 * lift;
        m.armL.rotation.x = -1.9 * lift;
        m.armL.rotation.z = 0.35 + 0.5 * lift;
        m.torso.rotation.x = 0.05 - 0.22 * lift;
        m.head.rotation.x = 0.2 * lift;
        if (m.orb) m.orb.scale.setScalar(pulse * (1 + lift * 0.7));
      }
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
    } else if (this.typeId === 'dragon') {
      // 묵직한 네 발걸음 · 천천히 치는 날개 · 목을 늘어 목덜미 공격
      const s = Math.sin(this.walkPhase * 0.8);
      if (m.legs) {
        m.legs[0].rotation.x = s * 0.5;
        m.legs[1].rotation.x = -s * 0.5;
        m.legs[2].rotation.x = -s * 0.5;
        m.legs[3].rotation.x = s * 0.5;
      }
      m.body.position.y = Math.abs(Math.sin(this.walkPhase * 0.8)) * 1.5;
      m.body.rotation.x = moving && this.state === 'chase' ? 0.03 : 0;
      const flap = Math.sin(t * 1.7) * 0.22;
      if (m.wingL) m.wingL.rotation.z = 0.15 + flap;
      if (m.wingR) m.wingR.rotation.z = -0.15 - flap;
      if (m.tail) m.tail.rotation.y = Math.sin(t * 0.9) * 0.2;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      if (m.neck) m.neck.rotation.x = 0.85 - swing * 0.45;
      if (m.jaw) m.jaw.rotation.x = swing * 0.85;
      if (m.head) m.head.rotation.x = -swing * 0.2;
      if (this.castT > 0 && m.wingL && m.wingR) {
        const lift = Math.sin(clamp(1 - this.castT / Math.max(0.01, this.castDur), 0, 1) * Math.PI);
        m.wingL.rotation.z = 0.15 + lift * 0.85;
        m.wingR.rotation.z = -0.15 - lift * 0.85;
      }
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 24) * 0.08;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'wyvern') {
      // 낮게 떠서 날갯짓하며 파고든다
      const hover = Math.sin(t * 3.1) * 1.3;
      m.body.position.y = 3 + hover;
      const flap = Math.sin(t * 3.4) * 0.55;
      if (m.wingL) m.wingL.rotation.z = 0.25 + flap;
      if (m.wingR) m.wingR.rotation.z = -0.25 - flap;
      const s = Math.sin(this.walkPhase * 1.4);
      if (m.legL) m.legL.rotation.x = s * 0.4;
      if (m.legR) m.legR.rotation.x = -s * 0.4;
      if (m.tail) m.tail.rotation.y = Math.sin(t * 1.4) * 0.25;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      m.body.rotation.x = swing * 0.32;
      if (m.jaw) m.jaw.rotation.x = swing * 0.7;
      if (this.castT > 0 && m.wingL) {
        const lift = Math.sin(clamp(1 - this.castT / Math.max(0.01, this.castDur), 0, 1) * Math.PI);
        m.body.position.y = 3 + hover + lift * 10;
        m.wingL.rotation.z = 0.25 + lift * 1.0;
        m.wingR.rotation.z = -0.25 - lift * 1.0;
      }
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 26) * 0.1;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'spinosaurus') {
      // 무거운 걸음 · 등지느러미가 흔들리고 긴 주둥이로 물어뜯는다
      const s = Math.sin(this.walkPhase * 0.85);
      if (m.legL) m.legL.rotation.x = s * 0.55;
      if (m.legR) m.legR.rotation.x = -s * 0.55;
      m.body.position.y = Math.abs(s) * 1.6;
      m.body.rotation.z = Math.sin(t * 1.2) * 0.03;
      if (m.sail) m.sail.rotation.x = -0.05 + Math.sin(t * 1.1) * 0.05;
      if (m.tail) m.tail.rotation.y = Math.sin(t * 0.8) * 0.18;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      if (m.neck) m.neck.rotation.x = 0.75 - swing * 0.4;
      if (m.jaw) m.jaw.rotation.x = swing * 0.95;
      if (m.armL) m.armL.rotation.x = -swing * 0.7;
      if (m.armR) m.armR.rotation.x = -swing * 0.7;
      if (this.castT > 0 && m.jaw) {
        const lift = Math.sin(clamp(1 - this.castT / Math.max(0.01, this.castDur), 0, 1) * Math.PI);
        m.jaw.rotation.x = lift * 1.1;
        if (m.neck) m.neck.rotation.x = 0.75 + lift * 0.3;
      }
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 22) * 0.07;
    } else if (this.typeId === 'tyrannosaurus') {
      // 달리며 큰 턱을 덮쳐 문다 · 작은 앞발이 바동거린다
      const s = Math.sin(this.walkPhase * 1.05);
      if (m.legL) m.legL.rotation.x = s * 0.62;
      if (m.legR) m.legR.rotation.x = -s * 0.62;
      m.body.position.y = Math.abs(s) * 1.9;
      m.body.rotation.x = moving && this.state === 'chase' ? -0.04 : 0;
      if (m.tail) m.tail.rotation.y = Math.sin(t * 1.3) * 0.2;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      if (m.jaw) m.jaw.rotation.x = swing * 1.0;
      if (m.neck) m.neck.rotation.x = 0.55 - swing * 0.28;
      if (m.head) m.head.rotation.x = -swing * 0.25;
      if (m.armL) m.armL.rotation.x = -0.4 + Math.sin(t * 5.5) * 0.35 + swing * 0.5;
      if (m.armR) m.armR.rotation.x = -0.4 + Math.cos(t * 5.5) * 0.35 + swing * 0.5;
      if (this.castT > 0 && m.jaw) m.jaw.rotation.x = Math.sin(t * 18) * 0.35 + 0.6;
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 24) * 0.09;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'fallen_hero') {
      // 무거운 성큼걸음 · 망토가 나붓기고 보랏빛 검을 크게 벤다
      const s = Math.sin(this.walkPhase);
      if (m.legL) m.legL.rotation.x = s * 0.6;
      if (m.legR) m.legR.rotation.x = -s * 0.6;
      m.body.position.y = Math.abs(s) * 0.6;
      if (m.cape) m.cape.rotation.x = 0.15 + Math.sin(t * 1.6) * 0.12 + (moving ? 0.18 : 0);
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      if (m.armR) {
        m.armR.rotation.x = -0.3 - swing * 2.3;
        m.armR.rotation.z = -0.1 - swing * 0.3;
      }
      if (m.armL) m.armL.rotation.x = -0.2 + swing * 0.5;
      if (m.torso) m.torso.rotation.y = -swing * 0.5;
      if (m.head) m.head.rotation.x = swing * 0.2;
      if (m.bladeMat) {
        m.bladeMat.emissiveIntensity = (this.castT > 0 || this.enraged ? 4.6 : 3.0) + Math.sin(t * 4.2) * 0.6 + swing * 1.4;
      }
      if (m.eyeMat) m.eyeMat.color.setHex(Math.sin(t * 3.1) > 0 ? 0xff5aa0 : 0xb84aff);
      if (this.castT > 0 && m.armR) {
        const lift = Math.sin(clamp(1 - this.castT / Math.max(0.01, this.castDur), 0, 1) * Math.PI);
        m.armR.rotation.x = -2.8 * lift;
        m.armR.rotation.z = -0.1 - 0.4 * lift;
        if (m.torso) m.torso.rotation.x = -0.16 * lift;
      }
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 24) * 0.1;
      else m.body.rotation.z = 0;
    } else if (this.typeId === 'strong_chicken') {
      // 뒤뚱뒤뚱 걷는 거대한 닭 · 부리로 쪼고 날개를 퍼덕인다
      const s = Math.sin(this.walkPhase * 0.9);
      if (m.legL) m.legL.rotation.x = s * 0.55;
      if (m.legR) m.legR.rotation.x = -s * 0.55;
      m.body.position.y = Math.abs(s) * 1.8;
      m.body.rotation.z = Math.sin(t * 2.1) * 0.05;
      m.body.position.z = 0;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      if (m.head) {
        m.head.rotation.x = swing * 0.95;
        m.head.rotation.y = Math.sin(t * 1.4) * 0.12;
        m.head.position.z = 4 + swing * 10;
      }
      m.body.rotation.x = swing * 0.14;
      if (m.tail) m.tail.rotation.x = -0.1 + Math.sin(t * 1.9) * 0.12;
      // 날개 퍼덕임 — 평소엔 천천히, 격노하면 빠르게
      const flapRate = this.enraged ? 7.5 : 3.0;
      const flap = Math.sin(t * flapRate) * (this.enraged ? 0.4 : 0.18);
      if (m.wingL) m.wingL.rotation.z = -0.25 + flap;
      if (m.wingR) m.wingR.rotation.z = 0.25 - flap;
      // 기술 예고 — 양날개를 크게 펴고 몸을 젖힌다
      if (this.castT > 0 && this.castDur > 0) {
        const cp = clamp(1 - this.castT / this.castDur, 0, 1);
        const lift = Math.sin(Math.min(1, cp / 0.85) * Math.PI * 0.5);
        if (m.wingL) m.wingL.rotation.z = -0.25 - lift * 1.15 + flap * 0.4;
        if (m.wingR) m.wingR.rotation.z = 0.25 + lift * 1.15 - flap * 0.4;
        m.body.rotation.x = -0.22 * lift;
        if (m.head) {
          m.head.rotation.x = -0.35 * lift;
          m.head.position.z = 4 - lift * 3;
        }
        if (m.crownHalo) m.crownHalo.material.opacity = 0.22 + lift * 0.35;
      }
      // 내려찍기 — 몸을 높이 들었다가 발로 찍는다
      if (this.slamT > 0 && this.slamDur > 0) {
        const sp = clamp(1 - this.slamT / this.slamDur, 0, 1);
        const raise = sp < 0.7 ? sp / 0.7 : 1;
        const fall = sp < 0.7 ? 0 : clamp((sp - 0.7) / 0.3, 0, 1);
        m.body.position.y = Math.abs(s) * 1.8 + raise * 16 - fall * 20;
        m.body.rotation.x = -0.3 * raise + 0.42 * fall;
        if (m.legL) m.legL.rotation.x = -0.7 * raise + 0.9 * fall;
        if (m.legR) m.legR.rotation.x = -0.7 * raise + 0.9 * fall;
      }
      // 격노 — 벼슬과 왕관이 타오르고 황금 오라가 커진다
      const glowPulse = 1 + Math.sin(t * (this.enraged ? 8 : 3.4)) * 0.18;
      if (m.crownHalo) m.crownHalo.scale.setScalar(9 * glowPulse);
      if (m.aura) m.aura.material.opacity = (this.enraged ? 0.3 : 0.14) + Math.sin(t * 2.4) * 0.05;
      if (m.bodyGlow) m.bodyGlow.material.opacity = (this.enraged ? 0.12 : 0.05) + Math.sin(t * 2.0) * 0.02;
      if (this.enraged) {
        if (m.combMat) m.combMat.emissiveIntensity = 1.4 + Math.sin(t * 8) * 0.8;
        if (m.goldMat) m.goldMat.emissiveIntensity = 2.8 + Math.sin(t * 9) * 0.9;
        if (m.eyeMat) m.eyeMat.color.setHex(Math.sin(t * 9) > 0 ? 0xff3a1a : 0x2a0a0a);
      }
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 22) * 0.06;
    } else if (this.typeId === 'giant_squid') {
      // 깊은 바다를 떠다니는 거대 오징어 — 외투가 물결치고 여덟 다리가 따로 유영한다
      const bob = Math.sin(t * 1.25) * 2.2;
      m.body.position.y = 24 + bob;
      m.body.rotation.x = Math.sin(t * 0.8) * 0.05;
      m.body.rotation.z = Math.sin(t * 0.65) * 0.045;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      // 날개지느러미가 물을 가른다
      const flap = Math.sin(t * 2.4) * 0.16;
      if (m.finL) m.finL.rotation.z = 0.12 + flap;
      if (m.finR) m.finR.rotation.z = -0.12 - flap;
      // 외투 수축 · 이완 (제트 추진)
      if (m.mantle) {
        const pump = 1 + Math.sin(t * 1.9) * 0.05 + swing * 0.1;
        m.mantle.scale.set(1 / Math.sqrt(pump), pump, 1 / Math.sqrt(pump));
      }
      // 여덟 다리 — 마디 세 개가 서로 다른 위상으로 흔들린다
      for (let i = 0; i < m.arms.length; i++) {
        const segs = m.arms[i];
        const dir = m.armAngles[i];
        const ph = i * 0.79;
        const spread = 1.24 - swing * 0.36;
        segs[0].rotation.x = dir.z * spread + Math.sin(t * 1.7 + ph) * 0.24 + swing * 0.5;
        segs[0].rotation.z = -dir.x * spread + Math.cos(t * 1.45 + ph) * 0.24;
        if (segs[1]) {
          segs[1].rotation.x = Math.sin(t * 2.2 + ph * 1.4) * 0.34;
          segs[1].rotation.z = Math.cos(t * 1.9 + ph) * 0.28;
        }
        if (segs[2]) segs[2].rotation.x = Math.sin(t * 2.7 + ph * 1.9) * 0.42;
      }
      // 긴 촉수 두 개는 느리게 크게 휘젓는다
      for (let i = 0; i < m.tentacles.length; i++) {
        const segs = m.tentacles[i];
        const dir = m.tentacleAngles[i];
        const ph = i * 2.4 + 0.6;
        segs[0].rotation.x = dir.z * 1.28 + Math.sin(t * 1.15 + ph) * 0.3 - swing * 0.35;
        segs[0].rotation.z = -dir.x * 1.28 + Math.cos(t * 1.0 + ph) * 0.26;
        if (segs[1]) segs[1].rotation.x = 0.28 + Math.sin(t * 1.45 + ph * 1.6) * 0.34;
        if (segs[2]) segs[2].rotation.x = 0.34 + Math.sin(t * 1.8 + ph * 2.1) * 0.38;
      }
      // 심연을 비추는 눈 — 사냥할 때 더 타오른다
      if (m.eyeMat) m.eyeMat.emissiveIntensity = 1.9 + Math.sin(t * 2.6) * 0.5 + swing * 1.3;
      if (m.spotMat) m.spotMat.emissiveIntensity = 1.6 + Math.sin(t * 3.4) * 0.5;
      if (m.bodyGlow) m.bodyGlow.material.opacity = 0.045 + Math.sin(t * 1.4) * 0.015;
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 24) * 0.12;
    } else if (this.typeId === 'ancient_serpent') {
      // 고대 신전의 수호자 — 꼬리는 물결치고 세 개의 목과 머리가 따로 흔들린다
      m.body.rotation.z = Math.sin(t * 0.9) * 0.05;
      m.body.rotation.y = Math.sin(t * 0.6) * 0.03;
      m.body.position.y = Math.abs(Math.sin(this.walkPhase * 0.75)) * 0.8;
      const swing = atkP >= 0 ? clamp(Math.sin(clamp(atkP, 0, 1) * Math.PI), 0, 1) : 0;
      // 꼬리 — 마디를 따라 흐르는 파동
      for (let i = 0; i < m.tailSegs.length; i++) {
        const seg = m.tailSegs[i];
        seg.rotation.y = Math.sin(t * 1.5 + i * 0.75) * 0.22;
        seg.rotation.x = Math.cos(t * 1.2 + i * 0.5) * 0.06;
      }
      if (m.tailSegs[0]) m.tailSegs[0].rotation.y += Math.sin(t * 0.9) * 0.14;
      // 감긴 몸통 고리도 살아 숨쉰다
      if (m.coil1) m.coil1.scale.set(1 + Math.sin(t * 1.1) * 0.02, 0.86, 1 + Math.cos(t * 1.1) * 0.02);
      // 세 개의 목 — 저마다 다른 리듬으로 흔들린다
      for (let i = 0; i < m.necks.length; i++) {
        const n = m.necks[i];
        n.group.rotation.z = n.baseZ + Math.sin(t * 1.05 + i * 2.1) * 0.13 - swing * 0.1 * n.side;
        n.group.rotation.x = Math.sin(t * 0.85 + i * 1.5) * 0.10 - swing * 0.18;
        if (n.upper) n.upper.rotation.y = Math.sin(t * 0.95 + i * 1.7) * 0.16;
        const h = m.heads[i];
        h.group.rotation.y = Math.sin(t * 1.2 + i * 2.4) * 0.30;
        h.group.rotation.x = Math.sin(t * 0.95 + i * 1.1) * 0.12 + swing * 0.55;
        h.jaw.rotation.x = 0.06 + Math.sin(t * 1.6 + i) * 0.05 + swing * 0.95;
      }
      if (m.eyeMat) m.eyeMat.emissiveIntensity = 2.3 + Math.sin(t * 3.2) * 0.6 + swing * 0.9;
      if (m.aura) m.aura.material.opacity = 0.13 + Math.sin(t * 2.2) * 0.04 + swing * 0.08;
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 24) * 0.11;
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
    this.ensureWorld(1);
    // 고대 골렘을 잡아 2번째 세계가 열렸다면 그 몹들도 함께 세운다
    if (this.game && this.game.world2Unlocked) this.ensureWorld(2);
    // 흑마법사를 잡아 3번째 세계가 열렸다면 그 몹들도 함께 세운다
    if (this.game && this.game.world3Unlocked) this.ensureWorld(3);
  }

  // 함께 하기에서 이 화면이 손님(게스트)인가 — 손님은 호스트가 보내는 몹만 그린다
  isGuestSession() {
    const net = this.game && this.game.net;
    return !!(net && net.active && net.isGuest);
  }

  // 이 세계의 몹이 준비되어 있는지 확인한다 — 보스를 다시 세우지 않는다 (중복 스폰 방지)
  ensureWorld(worldId) {
    // 손님 화면에서는 로컬 몹을 세우지 않는다. 세우면 호스트가 보낸 보스와
    // 내 화면의 보스가 동시에 있어 보스가 둘로 보인다 (부활·세계 이동 때 실제로 생겼다)
    if (this.isGuestSession()) return false;
    const before = this.mobs.length;
    this.spawnWorld(normWorld(worldId));
    return this.mobs.length !== before;
  }

  // 한 세계의 몹만 세운다 (2·3번째 세계는 포털이 열린 뒤에 처음 부른다 — 시작 부하를 줄인다)
  spawnWorld(worldId) {
    const w = normWorld(worldId);
    if (!this.spawnedWorlds) this.spawnedWorlds = {};
    if (this.spawnedWorlds[w]) return;
    this.spawnedWorlds[w] = true;
    const order = biomeOrderFor(w);
    for (const id of order) {
      const biome = BIOMES[id];
      const typeId = biome.mob;
      if (!typeId || !MOB_TYPES[typeId] || !biome.mobCount) continue; // 태초마을: 평화 지대
      // 한 지역에 여러 종이 함께 사는 곳 (선사시대 숲: 티라노 + 스피노)
      const types = (Array.isArray(biome.mobs) && biome.mobs.length) ? biome.mobs : [typeId];
      if (MOB_TYPES[typeId].boss) {
        this.spawn(typeId, bossPosFor(id), id);
        continue;
      }
      for (let i = 0; i < biome.mobCount; i++) {
        const t = types[i % types.length];
        if (!MOB_TYPES[t]) continue;
        this.spawn(t, this.randomPoint(id), id);
      }
    }
    this.enforceBossUniqueness();
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
    const type = MOB_TYPES[typeId];
    // 보스는 한 땅에 하나 — 이미 살아 있는 보스가 있으면 새로 만들지 않는다
    if (type && type.boss) {
      const existing = this.bossIn(biomeId);
      if (existing) return existing;
    }
    const mob = new Mob(this.game, typeId, pos, biomeId);
    mob.netId = this.nextNetId();
    this.mobs.push(mob);
    return mob;
  }

  // 몹 번호 — 중간에 몹이 지워져도 겹치지 않게 빈 번호를 고른다 (친구 화면 피해 판정의 열쇠)
  nextNetId() {
    const used = new Set();
    for (const m of this.mobs) if (m.netId !== undefined) used.add(m.netId);
    let id = this.mobs.length;
    while (used.has(id)) id++;
    return id;
  }

  // 그 땅에 살아 있는 보스 (내 몹 · 친구 화면 미러 모두)
  bossIn(biomeId) {
    for (const m of this.mobs) {
      if (!m.type || !m.type.boss || m.dead) continue;
      if ((m.biomeId || '') === (biomeId || '')) return m;
    }
    return null;
  }

  // 보스 종류별로 살아 있는 수 (테스트 · 화면 확인용)
  bossCount(typeId) {
    let n = 0;
    for (const m of this.mobs) {
      if (!m.type || !m.type.boss || m.dead) continue;
      if (!typeId || m.typeId === typeId) n++;
    }
    return n;
  }

  // "한 땅에 보스 하나" 를 지킨다 — 중복이 생기면 하나만 남기고 지운다
  //  · 손님 화면에서는 호스트가 보낸 미러가 진짜다 (내 로컬 보스를 지운다)
  enforceBossUniqueness() {
    const keep = new Map();
    for (let i = 0; i < this.mobs.length; i++) {
      const m = this.mobs[i];
      if (!m.type || !m.type.boss || m.dead) continue;
      const key = m.biomeId || m.typeId;
      const cur = keep.get(key);
      if (!cur) { keep.set(key, m); continue; }
      if (m.remote && !cur.remote) keep.set(key, m);
    }
    let removed = 0;
    for (const [key, keeper] of keep) {
      for (let i = this.mobs.length - 1; i >= 0; i--) {
        const m = this.mobs[i];
        if (m === keeper || !m.type || !m.type.boss || m.dead) continue;
        if ((m.biomeId || m.typeId) !== key) continue;
        this.removeMob(m);
        removed++;
      }
    }
    return removed;
  }

  // 몹 하나를 장면 · 목록 · 미러 목록에서 함께 지운다
  removeMob(m) {
    if (!m) return;
    if (m.clearBolts) m.clearBolts();
    if (m.root) this.game.scene.remove(m.root);
    const i = this.mobs.indexOf(m);
    if (i >= 0) this.mobs.splice(i, 1);
    const net = this.game && this.game.net;
    if (m.remote && net && net.mirrors && net.mirrors.get(m.netId) === m) net.mirrors.delete(m.netId);
  }

  update(dt) {
    const p = this.game.player;
    const anchors = this.anchorPoints();
    if (!p) {
      for (let i = 0; i < this.mobs.length; i++) {
        const m = this.mobs[i];
        if (m.remote) m.updateRemote(dt);
        else m.update(dt);
      }
      return;
    }
    for (let i = 0; i < this.mobs.length; i++) {
      const m = this.mobs[i];
      // 내 화면(카메라)에서의 거리 — 그리기 · 숨기기는 이 거리로 정한다
      const hostDist = Math.hypot(m.position.x - p.position.x, m.position.z - p.position.z);
      // 이 몹과 싸우는 사람 중 가장 가까운 이 (나 또는 함께 하는 친구, 같은 세계)
      // → 친구가 나에서 멀리 떨어져 싸워도 그 몹은 멈추지 않고 친구를 공격한다
      let near = hostDist;
      for (let k = 0; k < anchors.length; k++) {
        const a = anchors[k];
        if (a.world !== m.worldId) continue;
        const d = Math.hypot(m.position.x - a.x, m.position.z - a.z);
        if (d < near) near = d;
      }
      m.dist = near;
      if (near > this.cullRadius) {
        if (m.root.visible) m.root.visible = false;
        m.updateFar(dt);
        continue;
      }
      // 친구 곁에서 싸우는 먼 몹은 AI 만 돌리고 내 화면에는 그리지 않는다
      const show = hostDist <= this.cullRadius;
      if (!show) m.root.visible = false;
      else if (!m.root.visible && !m.dead) m.root.visible = true;
      if (m.remote) m.updateRemote(dt);
      else m.update(dt);
    }
  }

  /* 몹과 싸우는 플레이어들의 자리 (나 + 함께 하는 친구들) — 세계까지 함께 돌려준다
     함께 하기에서 친구가 나와 멀리 떨어져 있어도 그 곁의 몹이 계속 움직이게 하는 근거 */
  anchorPoints() {
    const g = this.game;
    const out = [];
    const list = g && g.combatTargets ? (g.combatTargets() || []) : null;
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t || !t.alive || !t.position) continue;
        const w = (t.world === undefined || t.world === null) ? normWorld(g.worldId) : normWorld(t.world);
        out.push({ x: t.position.x, z: t.position.z, world: w });
      }
      return out;
    }
    if (g && g.player && g.player.position) {
      out.push({ x: g.player.position.x, z: g.player.position.z, world: normWorld(g.worldId) });
    }
    return out;
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
    for (const m of this.mobs) if (m.type.boss && !m.dead) return m;
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
