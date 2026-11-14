// 월드 생성: 지형(5개 바이옴), 프롭, 랜드마크, 사원 구조물, 조명, 하늘
import * as THREE from 'three';
import { BIOMES, BIOME_ORDER } from './config.js';
import {
  WORLD, terrainHeight, valueNoise, fbm, mulberry32, clamp, smoothstep, makeInstanced, lerp,
} from './utils.js';

const NEIGHBORS = {
  forest: [{ side: 'east', id: 'temple' }],
  savanna: [{ side: 'west', id: 'temple' }],
  graveyard: [{ side: 'south', id: 'temple' }],
  jungle: [{ side: 'north', id: 'temple' }],
  temple: [
    { side: 'east', id: 'savanna' },
    { side: 'west', id: 'forest' },
    { side: 'north', id: 'graveyard' },
    { side: 'south', id: 'jungle' },
  ],
};

const C = (hex) => new THREE.Color(hex);

/* ------------------------------- 지형 ------------------------------- */
function buildGround(scene, biome) {
  const seg = 78;
  const geo = new THREE.PlaneGeometry(WORLD.cell, WORLD.cell, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = C(biome.ground);
  const alt = C(biome.ground2);
  const tmp = new THREE.Color();
  const nbColors = NEIGHBORS[biome.id].map((n) => ({ side: n.side, color: C(BIOMES[n.id].ground) }));

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const wx = biome.center.x + lx;
    const wz = biome.center.z + lz;
    pos.setY(i, terrainHeight(wx, wz));

    // 기본 색 변주
    const n = fbm(wx * 0.0075, wz * 0.0075, 3);
    tmp.copy(base).lerp(alt, clamp(0.5 + n * 0.9, 0, 1));

    // 사원은 석재 바닥 패턴
    if (biome.id === 'temple') {
      const gx = Math.abs(((lx + 500) % 62) - 31) / 31;
      const gz = Math.abs(((lz + 500) % 62) - 31) / 31;
      const line = Math.max(gx, gz);
      const pave = smoothstep(0.86, 1, line);
      tmp.lerp(C(0x4e4a40), pave * 0.55);
      tmp.lerp(C(0x8f8877), clamp(0.5 - n * 0.6, 0, 0.5));
    }

    // 인접 바이옴과의 경계 색 블렌딩 (울퉁불퉁한 경계)
    const wobble = valueNoise(wx * 0.006, wz * 0.006) * 46;
    for (let k = 0; k < nbColors.length; k++) {
      const nc = nbColors[k];
      let dist = 9999;
      if (nc.side === 'east') dist = WORLD.halfCell - lx;
      else if (nc.side === 'west') dist = WORLD.halfCell + lx;
      else if (nc.side === 'north') dist = WORLD.halfCell + lz;
      else if (nc.side === 'south') dist = WORLD.halfCell - lz;
      const t = smoothstep(190, 0, dist + wobble);
      if (t > 0) tmp.lerp(nc.color, t * 0.72);
    }

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(biome.center.x, 0, biome.center.z);
  mesh.receiveShadow = true;
  mesh.name = 'ground-' + biome.id;
  scene.add(mesh);
  return mesh;
}

/* ------------------------------ 프롭 헬퍼 ------------------------------ */
const propMat = (color, opts) => new THREE.MeshStandardMaterial(Object.assign({
  color, roughness: 0.85, metalness: 0.0,
}, opts || {}));

function buildInstancedSet(scene, parts, placements) {
  if (!placements.length) return;
  const base = new THREE.Matrix4();
  const partM = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();

  for (const part of parts) {
    const geo = part.geo;
    const im = new THREE.InstancedMesh(geo, part.mat, placements.length);
    for (let i = 0; i < placements.length; i++) {
      const pl = placements[i];
      const s = pl.s === undefined ? 1 : pl.s;
      base.makeRotationY(pl.ry || 0);
      base.scale(v.set(s, (pl.sy || 1) * s, s));
      base.setPosition(pl.x, pl.y, pl.z);

      e.set(part.rot ? part.rot[0] : 0, part.rot ? part.rot[1] : 0, part.rot ? part.rot[2] : 0);
      q.setFromEuler(e);
      const ps = part.scale === undefined ? 1 : part.scale;
      if (Array.isArray(ps)) sc.set(ps[0], ps[1], ps[2]);
      else sc.set(ps, ps, ps);
      partM.compose(v.set(part.pos ? part.pos[0] : 0, part.pos ? part.pos[1] : 0, part.pos ? part.pos[2] : 0), q, sc);

      out.multiplyMatrices(base, partM);
      im.setMatrixAt(i, out);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = !!part.castShadow;
    im.receiveShadow = true;
    im.frustumCulled = false;
    scene.add(im);
  }
}

function scatter(seed, biome, count, minFrom, options) {
  const rnd = mulberry32(seed);
  const opts = options || {};
  const list = [];
  const b = biome.bounds;
  const margin = opts.margin === undefined ? 60 : opts.margin;
  let guard = 0;
  while (list.length < count && guard < count * 40) {
    guard++;
    const x = lerp(b.x0 + margin, b.x1 - margin, rnd());
    const z = lerp(b.z0 + margin, b.z1 - margin, rnd());
    if (minFrom) {
      let ok = true;
      for (let i = 0; i < minFrom.length; i++) {
        const m = minFrom[i];
        if (Math.hypot(x - m.x, z - m.z) < m.r) { ok = false; break; }
      }
      if (!ok) continue;
    }
    list.push({
      x, z, y: terrainHeight(x, z) + (opts.yOffset || 0),
      ry: rnd() * Math.PI * 2,
      s: lerp(opts.minScale === undefined ? 0.85 : opts.minScale, opts.maxScale === undefined ? 1.25 : opts.maxScale, rnd()),
    });
  }
  return list;
}

const KEEP_OUTS = {
  forest: [{ x: -1160, z: 40, r: 120 }, { x: -1000, z: 0, r: 110 }, { x: -500, z: 0, r: 110 }],
  graveyard: [{ x: 0, z: -1000, r: 150 }, { x: 0, z: -500, r: 120 }],
  savanna: [{ x: 1000, z: 0, r: 140 }, { x: 500, z: 0, r: 110 }],
  jungle: [{ x: 0, z: 1000, r: 130 }, { x: 0, z: 500, r: 120 }],
  temple: [{ x: 0, z: 0, r: 260 }, { x: 0, z: -500, r: 90 }, { x: 0, z: 500, r: 90 }, { x: -500, z: 0, r: 90 }, { x: 500, z: 0, r: 90 }],
};

/* ------------------------------ 바이옴별 프롭 ------------------------------ */
function buildForest(scene) {
  const biome = BIOMES.forest;
  const trunkMat = propMat(0x6b4a2f, { roughness: 0.95 });
  const leafMat = propMat(0x3f7a35, { roughness: 0.9 });
  const leafMat2 = propMat(0x4f9143, { roughness: 0.9 });
  const rockMat = propMat(0x8b8a7c, { roughness: 1 });

  const trees = scatter(101, biome, 250, KEEP_OUTS.forest, { margin: 50, minScale: 0.8, maxScale: 1.6 });
  const trunkGeo = new THREE.CylinderGeometry(1.1, 1.9, 16, 6);
  const leafGeo = new THREE.IcosahedronGeometry(6.2, 1);
  buildInstancedSet(scene, [
    { geo: trunkGeo, mat: trunkMat, pos: [0, 8, 0], castShadow: true },
    { geo: leafGeo, mat: leafMat, pos: [0, 19, 0], scale: [1.15, 0.95, 1.15], castShadow: true },
    { geo: leafGeo, mat: leafMat2, pos: [2.6, 23.5, -1.6], scale: 0.75 },
    { geo: leafGeo, mat: leafMat2, pos: [-2.2, 22.6, 2.2], scale: 0.66 },
  ], trees);

  const rocks = scatter(102, biome, 90, KEEP_OUTS.forest, { margin: 40, minScale: 0.5, maxScale: 1.4 });
  buildInstancedSet(scene, [
    { geo: new THREE.DodecahedronGeometry(3.4, 0), mat: rockMat, pos: [0, 1.8, 0], scale: [1.2, 0.7, 1], castShadow: true },
  ], rocks);

  const grass = scatter(103, biome, 900, null, { margin: 20, minScale: 0.7, maxScale: 1.5 });
  const grassMat = propMat(0x5f9c45, { roughness: 1 });
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(1.1, 4.4, 4), mat: grassMat, pos: [0, 2.2, 0] },
  ], grass);

  // 랜드마크: 거대 고목
  const g = new THREE.Group();
  const bigTrunk = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 58, 10), trunkMat);
  bigTrunk.position.y = 29;
  bigTrunk.castShadow = true;
  g.add(bigTrunk);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(15, 1), i % 2 ? leafMat : leafMat2);
    canopy.position.set(Math.cos(a) * 12, 62 + Math.sin(i) * 5, Math.sin(a) * 12);
    canopy.scale.set(1, 0.8, 1);
    canopy.castShadow = true;
    g.add(canopy);
  }
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(19, 1), leafMat2);
  crown.position.y = 72;
  crown.scale.set(1, 0.7, 1);
  g.add(crown);
  // 풀숲 지대 표시 링
  const ringGeo = new THREE.RingGeometry(30, 36, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x9fe08a, transparent: true, opacity: 0.28 }));
  ring.position.y = 1.2;
  g.add(ring);
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  scene.add(g);

  // 작은 연못
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(58, 32),
    new THREE.MeshStandardMaterial({ color: 0x3f7fa8, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-1330, terrainHeight(-1330, 330) + 0.6, 330);
  scene.add(pond);
}

function buildGraveyard(scene) {
  const biome = BIOMES.graveyard;
  const stoneMat = propMat(0x8d9088, { roughness: 1 });
  const darkStone = propMat(0x5f635c, { roughness: 1 });
  const woodMat = propMat(0x4a4034, { roughness: 1 });
  const tuftMat = propMat(0x4c5a42, { roughness: 1 });

  const tombs = scatter(201, biome, 230, KEEP_OUTS.graveyard, { margin: 50, minScale: 0.7, maxScale: 1.5 });
  buildInstancedSet(scene, [
    { geo: new THREE.BoxGeometry(4.6, 7.4, 1.3), mat: stoneMat, pos: [0, 3.2, 0], castShadow: true },
    { geo: new THREE.CylinderGeometry(2.3, 2.3, 1.3, 10, 1, false, 0, Math.PI), mat: stoneMat, pos: [0, 6.9, 0], rot: [Math.PI / 2, 0, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(9, 2.4, 1.1), mat: darkStone, pos: [0, -0.2, 0] },
  ], tombs);

  const crossTombs = scatter(202, biome, 60, KEEP_OUTS.graveyard, { margin: 60, minScale: 0.8, maxScale: 1.3 });
  buildInstancedSet(scene, [
    { geo: new THREE.BoxGeometry(6, 1.4, 1.2), mat: stoneMat, pos: [0, 7.5, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(1.4, 8, 1.2), mat: stoneMat, pos: [0, 4, 0], castShadow: true },
  ], crossTombs);

  const deadTrees = scatter(203, biome, 60, KEEP_OUTS.graveyard, { margin: 70, minScale: 0.8, maxScale: 1.6 });
  const branchGeo = new THREE.CylinderGeometry(0.35, 0.8, 9, 5);
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(0.9, 1.8, 18, 6), mat: woodMat, pos: [0, 9, 0], castShadow: true },
    { geo: branchGeo, mat: woodMat, pos: [3, 15, 0], rot: [0, 0, -0.9], castShadow: true },
    { geo: branchGeo, mat: woodMat, pos: [-3, 17, 0], rot: [0, 0, 0.95], castShadow: true },
    { geo: branchGeo, mat: woodMat, pos: [0, 14, 3], rot: [0.9, 0, 0], castShadow: true },
  ], deadTrees);

  const tufts = scatter(204, biome, 500, null, { margin: 20, minScale: 0.7, maxScale: 1.4 });
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(1.2, 3.6, 3), mat: tuftMat, pos: [0, 1.8, 0] },
  ], tufts);

  // 안개 띠 (은은한 지면 안개)
  const fogMat = new THREE.MeshBasicMaterial({ color: 0xcdd6d6, transparent: true, opacity: 0.055, depthWrite: false });
  const banks = scatter(205, biome, 14, null, { margin: 120, minScale: 0.7, maxScale: 1.6 });
  for (const b of banks) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(90, 14, 10), fogMat);
    m.position.set(b.x, terrainHeight(b.x, b.z) + 14, b.z);
    m.scale.set(1, 0.16, 1);
    scene.add(m);
  }

  // 랜드마크: 폐허 예배당
  const g = new THREE.Group();
  const wallMat = propMat(0x6c6f66, { roughness: 1 });
  const wallH = 34;
  const walls = [
    { x: -28, z: 0, w: 4, d: 60, h: wallH },
    { x: 28, z: 0, w: 4, d: 60, h: wallH * 0.7 },
    { x: 0, z: -30, w: 60, d: 4, h: wallH * 0.85 },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), wallMat);
    m.position.set(w.x, w.h / 2, w.z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  // 뾰족한 아치
  const arch = new THREE.Mesh(new THREE.BoxGeometry(4, 26, 4), wallMat);
  arch.position.set(0, 13, 30);
  g.add(arch);
  const archTop = new THREE.Mesh(new THREE.TorusGeometry(14, 1.8, 6, 14, Math.PI), wallMat);
  archTop.position.set(0, 26, -30);
  g.add(archTop);
  const altar = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10), propMat(0x55584f, { roughness: 1 }));
  altar.position.set(0, 3, 0);
  g.add(altar);
  const candle = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xa8e0ff }));
  candle.position.set(0, 8, 0);
  g.add(candle);
  const candleLight = new THREE.PointLight(0x9fd8ff, 60, 220, 2);
  candleLight.position.set(0, 10, 0);
  g.add(candleLight);
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  scene.add(g);
}

function buildSavanna(scene) {
  const biome = BIOMES.savanna;
  const barkMat = propMat(0x6f5636, { roughness: 1 });
  const leafMat = propMat(0x7d8f42, { roughness: 0.95 });
  const grassMat = propMat(0xc0a75c, { roughness: 1 });
  const rockMat = propMat(0x9b8b72, { roughness: 1 });

  const acacias = scatter(301, biome, 95, KEEP_OUTS.savanna, { margin: 70, minScale: 0.8, maxScale: 1.5 });
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(0.9, 1.7, 14, 6), mat: barkMat, pos: [0, 7, 0], castShadow: true },
    { geo: new THREE.CylinderGeometry(9, 11, 1.7, 12), mat: leafMat, pos: [0, 15.4, 0], scale: [1.25, 1, 1.25], castShadow: true },
    { geo: new THREE.CylinderGeometry(5.4, 6.4, 1.4, 10), mat: leafMat, pos: [4.5, 17.4, 2], scale: [1.2, 1, 1.2] },
  ], acacias);

  const grass = scatter(302, biome, 1100, null, { margin: 24, minScale: 0.7, maxScale: 1.6 });
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(0.9, 4.2, 3), mat: grassMat, pos: [0, 2.1, 0] },
  ], grass);

  const rocks = scatter(303, biome, 110, KEEP_OUTS.savanna, { margin: 50, minScale: 0.5, maxScale: 1.8 });
  buildInstancedSet(scene, [
    { geo: new THREE.DodecahedronGeometry(4, 0), mat: rockMat, pos: [0, 1.6, 0], scale: [1.3, 0.75, 1.1], castShadow: true },
  ], rocks);

  // 랜드마크: 거대 아카시아
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 34, 8), barkMat);
  trunk.position.y = 17;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(26 - i * 3, 30 - i * 3, 2.6, 16), leafMat);
    cap.position.y = 34 + i * 4.2;
    cap.scale.set(1, 1, 0.82);
    cap.castShadow = true;
    g.add(cap);
  }
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  scene.add(g);

  // 마른 강바닥
  const bed = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 1000, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xcdb578, roughness: 1 })
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(700, terrainHeight(700, 0) + 0.4, 0);
  scene.add(bed);
}

function buildJungle(scene) {
  const biome = BIOMES.jungle;
  const trunkMat = propMat(0x4d3b26, { roughness: 1 });
  const leafMat = propMat(0x265c30, { roughness: 0.95 });
  const leafMat2 = propMat(0x1d4826, { roughness: 0.95 });
  const fernMat = propMat(0x357a3d, { roughness: 1 });

  const trees = scatter(401, biome, 330, KEEP_OUTS.jungle, { margin: 40, minScale: 0.9, maxScale: 1.8 });
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(0.9, 1.9, 34, 6), mat: trunkMat, pos: [0, 17, 0], castShadow: true },
    { geo: new THREE.IcosahedronGeometry(9.5, 1), mat: leafMat, pos: [0, 36, 0], scale: [1.2, 0.85, 1.2], castShadow: true },
    { geo: new THREE.IcosahedronGeometry(6.4, 1), mat: leafMat2, pos: [3.4, 31, 2.2], scale: 0.9 },
    { geo: new THREE.IcosahedronGeometry(5.4, 1), mat: leafMat2, pos: [-3, 33, -2.6], scale: 0.8 },
  ], trees);

  const ferns = scatter(402, biome, 800, null, { margin: 24, minScale: 0.7, maxScale: 1.8 });
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(2, 5.4, 4), mat: fernMat, pos: [0, 2.6, 0] },
    { geo: new THREE.ConeGeometry(2, 5.4, 4), mat: fernMat, pos: [0, 2.6, 0], rot: [0, Math.PI / 4, 0], scale: 0.8 },
  ], ferns);

  // 랜드마크: 고대 우상
  const g = new THREE.Group();
  const stone = propMat(0x6d7a63, { roughness: 1 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(30, 26, 24), stone);
  head.position.y = 30;
  head.castShadow = true;
  g.add(head);
  const base = new THREE.Mesh(new THREE.BoxGeometry(38, 16, 30), stone);
  base.position.y = 8;
  base.castShadow = true;
  g.add(base);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(32, 4, 4), propMat(0x4f5a48, { roughness: 1 }));
  brow.position.set(0, 36, 12);
  g.add(brow);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9dff9d });
  for (const sx of [-7, 7]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(2.3, 8, 6), eyeMat);
    eye.position.set(sx, 30, 12.4);
    g.add(eye);
  }
  const eyeLight = new THREE.PointLight(0x8cff8c, 70, 240, 2);
  eyeLight.position.set(0, 30, 20);
  g.add(eyeLight);
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  g.rotation.y = Math.PI;
  scene.add(g);
}

function buildTemple(scene) {
  const biome = BIOMES.temple;
  const stoneMat = propMat(0x8e8877, { roughness: 0.95 });
  const darkStoneMat = propMat(0x6a6659, { roughness: 1 });
  const mossMat = propMat(0x4c7a44, { roughness: 1 });

  // 중앙 제단: 계단식 플랫폼
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const r = 120 - i * 26;
    const h = 2.4;
    const step = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 3, h, 40), i % 2 ? stoneMat : darkStoneMat);
    step.position.y = i * h + h / 2;
    step.receiveShadow = true;
    step.castShadow = true;
    g.add(step);
  }
  const topY = 4 * 2.4;
  const altar = new THREE.Mesh(new THREE.BoxGeometry(46, 10, 46), stoneMat);
  altar.position.y = topY + 5;
  altar.castShadow = true;
  altar.receiveShadow = true;
  g.add(altar);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(7, 0), new THREE.MeshStandardMaterial({
    color: 0x8ff0ff, emissive: 0x3fd0ff, emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.92,
  }));
  crystal.position.y = topY + 18;
  g.add(crystal);
  const crystalLight = new THREE.PointLight(0x6fe0ff, 260, 520, 2);
  crystalLight.position.y = topY + 18;
  g.add(crystalLight);

  // 랜드마크 링
  const ringGeo = new THREE.RingGeometry(196, 204, 60);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.35 }));
  ring.position.y = 1.4;
  g.add(ring);
  g.position.set(biome.center.x, 0, biome.center.z);
  scene.add(g);

  // 둘레 기둥
  const pillars = [];
  const rnd = mulberry32(501);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 260;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    pillars.push({ x, z, y: terrainHeight(x, z), ry: a, s: 0.85 + rnd() * 0.4 });
  }
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(5.6, 6.4, 44, 8), mat: stoneMat, pos: [0, 22, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(15, 3.4, 15), mat: darkStoneMat, pos: [0, 44, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(17, 2.2, 17), mat: stoneMat, pos: [0, 1.1, 0] },
  ], pillars);

  // 부서진 기둥 조각
  const rubble = scatter(502, biome, 120, KEEP_OUTS.temple, { margin: 40, minScale: 0.5, maxScale: 1.5 });
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(3.4, 3.8, 8, 7), mat: darkStoneMat, pos: [0, 2.2, 0], rot: [Math.PI / 2.1, 0, 0], castShadow: true },
  ], rubble);

  // 이끼 낀 바위
  const mossRocks = scatter(503, biome, 60, KEEP_OUTS.temple, { margin: 50, minScale: 0.6, maxScale: 1.6 });
  buildInstancedSet(scene, [
    { geo: new THREE.DodecahedronGeometry(3.6, 0), mat: mossMat, pos: [0, 1.4, 0], scale: [1.3, 0.6, 1.1], castShadow: true },
  ], mossRocks);

  // 네 방향 사원 문 (바이옴 경계 표식)
  const gateDefs = [
    { x: 0, z: -472, ry: 0, name: 'north' },
    { x: 0, z: 472, ry: 0, name: 'south' },
    { x: -472, z: 0, ry: Math.PI / 2, name: 'west' },
    { x: 472, z: 0, ry: Math.PI / 2, name: 'east' },
  ];
  for (const gd of gateDefs) {
    const gate = new THREE.Group();
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(12, 48, 12), stoneMat);
      pillar.position.set(side * 30, 24, 0);
      pillar.castShadow = true;
      gate.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 18), darkStoneMat);
      cap.position.set(side * 30, 50, 0);
      gate.add(cap);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(84, 8, 16), darkStoneMat);
    lintel.position.y = 56;
    lintel.castShadow = true;
    gate.add(lintel);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb45c }));
    flame.position.set(0, 62, 0);
    gate.add(flame);
    const light = new THREE.PointLight(0xffb45c, 90, 260, 2);
    light.position.set(0, 62, 0);
    gate.add(light);
    gate.position.set(gd.x, terrainHeight(gd.x, gd.z), gd.z);
    gate.rotation.y = gd.ry;
    scene.add(gate);
  }

  // 화로 4개
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const x = Math.cos(a) * 120;
    const z = Math.sin(a) * 120;
    const brazier = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(7, 4, 7, 10), darkStoneMat);
    bowl.position.y = 7;
    brazier.add(bowl);
    const fire = new THREE.Mesh(new THREE.SphereGeometry(4.2, 9, 7), new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
    fire.position.y = 12;
    brazier.add(fire);
    const fl = new THREE.PointLight(0xff9a3c, 150, 340, 2);
    fl.position.y = 16;
    brazier.add(fl);
    brazier.position.set(x, terrainHeight(x, z), z);
    scene.add(brazier);
  }
}

function buildBoundary(scene) {
  const rockMat = propMat(0x4a4741, { roughness: 1 });
  const edges = [
    { x0: -1500, z0: -500, x1: -1500, z1: 500 },
    { x0: -1500, z0: -500, x1: -500, z1: -500 },
    { x0: -1500, z0: 500, x1: -500, z1: 500 },
    { x0: -500, z0: -1500, x1: 500, z1: -1500 },
    { x0: -500, z0: -1500, x1: -500, z1: -500 },
    { x0: 500, z0: -1500, x1: 500, z1: -500 },
    { x0: 1500, z0: -500, x1: 1500, z1: 500 },
    { x0: 500, z0: -500, x1: 1500, z1: -500 },
    { x0: 500, z0: 500, x1: 1500, z1: 500 },
    { x0: -500, z0: 1500, x1: 500, z1: 1500 },
    { x0: -500, z0: 500, x1: -500, z1: 1500 },
    { x0: 500, z0: 500, x1: 500, z1: 1500 },
  ];
  const rnd = mulberry32(777);
  const list = [];
  for (const e of edges) {
    const len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0);
    const steps = Math.floor(len / 46);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jitter = (rnd() - 0.5) * 26;
      const nx = (e.z1 - e.z0) / len;
      const nz = -(e.x1 - e.x0) / len;
      const x = lerp(e.x0, e.x1, t) + nx * jitter;
      const z = lerp(e.z0, e.z1, t) + nz * jitter;
      list.push({
        x, z, y: terrainHeight(x, z) + rnd() * 1.5,
        ry: rnd() * Math.PI * 2,
        s: 0.9 + rnd() * 1.5,
      });
    }
  }
  buildInstancedSet(scene, [
    { geo: new THREE.DodecahedronGeometry(7, 0), mat: rockMat, pos: [0, 5, 0], scale: [1, 1.25, 1], castShadow: true },
    { geo: new THREE.IcosahedronGeometry(5, 0), mat: rockMat, pos: [5, 3, 3], scale: 0.8 },
  ], list);
}

/* -------------------------------- 하늘 -------------------------------- */
function buildSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(0x7fb2d8) },
    bottomColor: { value: new THREE.Color(0xd9e6ee) },
    offset: { value: 120 },
    exponent: { value: 0.9 },
  };
  const geo = new THREE.SphereGeometry(2600, 24, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: [
      'varying vec3 vWorldPosition;',
      'void main() {',
      '  vec4 worldPosition = modelMatrix * vec4(position, 1.0);',
      '  vWorldPosition = worldPosition.xyz;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 topColor;',
      'uniform vec3 bottomColor;',
      'uniform float offset;',
      'uniform float exponent;',
      'varying vec3 vWorldPosition;',
      'void main() {',
      '  float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;',
      '  float f = pow(max(h, 0.0), exponent);',
      '  gl_FragColor = vec4(mix(bottomColor, topColor, f), 1.0);',
      '}',
    ].join('\n'),
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  return { sky, uniforms };
}

/* ------------------------------- 조명 ------------------------------- */
function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x40502f, 0.72);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4d6, 2.0);
  sun.position.set(-120, 240, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = 620;
  cam.left = -150;
  cam.right = 150;
  cam.top = 150;
  cam.bottom = -150;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x9fc4e8, 0.35);
  fill.position.set(150, 120, -140);
  scene.add(fill);

  return { sun, fill, hemi };
}

/* ------------------------------- 월드 ------------------------------- */
export function buildWorld(scene) {
  scene.fog = new THREE.Fog(0xb5dbe4, 280, 1500);

  for (const id of BIOME_ORDER) buildGround(scene, BIOMES[id]);

  buildForest(scene);
  buildGraveyard(scene);
  buildSavanna(scene);
  buildJungle(scene);
  buildTemple(scene);
  buildBoundary(scene);

  const lights = buildLights(scene);
  const sky = buildSky(scene);

  return {
    sun: lights.sun,
    fill: lights.fill,
    hemi: lights.hemi,
    sky: sky.sky,
    skyUniforms: sky.uniforms,
  };
}

export function updateSun(world, target, camera) {
  const sun = world.sun;
  sun.position.set(target.x - 120, target.y + 240, target.z + 90);
  sun.target.position.set(target.x, target.y, target.z);
  sun.target.updateMatrixWorld();
  if (world.sky) world.sky.position.copy(camera.position);
}
