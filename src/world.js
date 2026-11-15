// 월드 생성: 지형(5개 바이옴), 프롭, 랜드마크, 사원 구조물, 조명, 하늘
import * as THREE from 'three';
import { BIOMES, BIOME_ORDER } from './config.js';
import {
  WORLD, terrainHeight, valueNoise, fbm, mulberry32, clamp, smoothstep, makeInstanced, lerp,
} from './utils.js';

const NEIGHBORS = {
  village: [{ side: 'east', id: 'forest' }],
  forest: [{ side: 'east', id: 'temple' }, { side: 'west', id: 'village' }],
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
  village: [
    { x: -2000, z: 0, r: 150 }, { x: -2000, z: -140, r: 130 },
    { x: -2250, z: -175, r: 80 }, { x: -2250, z: 175, r: 80 },
    { x: -2130, z: 300, r: 80 }, { x: -1850, z: 285, r: 80 },
    { x: -1820, z: -215, r: 80 }, { x: -2200, z: -390, r: 80 },
    { x: -1790, z: -390, r: 80 }, { x: -2380, z: -230, r: 80 },
    { x: -2390, z: 250, r: 80 }, { x: -1650, z: 185, r: 80 },
    { x: -1650, z: -130, r: 80 },
  ],
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
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
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

/* ------------------------------ 태초마을 ------------------------------ */

// 평평한 원형 바닥 (광장 등)
function buildDisc(scene, x, z, radius, color, yOff, seg) {
  const geo = new THREE.CircleGeometry(radius, seg || 48);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = x + pos.getX(i);
    const wz = z + pos.getZ(i);
    pos.setY(i, terrainHeight(wx, wz) + (yOff === undefined ? 0.25 : yOff));
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, propMat(color, { roughness: 1 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// 지형을 따라가는 길 (복도 형태)
function buildRoad(scene, x0, z0, x1, z1, width, color) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const segs = Math.max(6, Math.round(len / 44));
  const geo = new THREE.PlaneGeometry(width, len, 2, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
  const nx = -dz, nz = dx;
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = pos.getZ(i);
    const wx = mx + nx * u + dx * v;
    const wz = mz + nz * u + dz * v;
    pos.setXYZ(i, wx, terrainHeight(wx, wz) + 0.24, wz);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, propMat(color, { roughness: 1 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function distToSegment(px, pz, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - x0) * dx + (pz - z0) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t));
}

const VILLAGE_ROADS = [
  { x0: -2500, z0: 0, x1: -1500, z1: 0, w: 42 },
  { x0: -2000, z0: 0, x1: -2000, z1: 440, w: 36 },
  { x0: -2000, z0: -96, x1: -2000, z1: 0, w: 60 },
];

function onVillageRoad(x, z) {
  for (const r of VILLAGE_ROADS) {
    if (distToSegment(x, z, r.x0, r.z0, r.x1, r.z1) < r.w) return true;
  }
  return false;
}

// 간판용 캔버스 텍스처 (DOM 없는 테스트 환경에서는 null)
function signTexture(text, sub) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext && c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#33200f';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = '#e8c26a';
  ctx.lineWidth = 7;
  ctx.strokeRect(9, 9, 494, 142);
  ctx.fillStyle = '#f6dfa6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 62px "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
  ctx.fillText(text, 256, sub ? 64 : 82);
  if (sub) {
    ctx.fillStyle = '#d9c9a0';
    ctx.font = 'bold 30px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.fillText(sub, 256, 124);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function signMaterial(text, sub, tint) {
  const tex = signTexture(text, sub);
  if (!tex) return propMat(tint || 0x4a2e18, { roughness: 0.8 });
  return new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.34, roughness: 0.62,
  });
}

// 마을 집 한 채의 부품 목록 (인스턴싱으로 여러 채를 세운다)
function cottageParts(wallColor, roofColor) {
  const wallMat = propMat(wallColor, { roughness: 0.95 });
  const beamMat = propMat(0x6b4a2f, { roughness: 0.95 });
  const roofMat = propMat(roofColor, { roughness: 0.9 });
  const doorMat = propMat(0x4a3120, { roughness: 0.95 });
  const stoneMat = propMat(0x9a9486, { roughness: 1 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xffd58a, emissive: 0xffb347, emissiveIntensity: 1.1, roughness: 0.5,
  });
  return [
    { geo: new THREE.BoxGeometry(76, 26, 62), mat: wallMat, pos: [0, 13, 0], castShadow: true },
    // 모서리 기둥 · 들보
    { geo: new THREE.BoxGeometry(5, 27, 5), mat: beamMat, pos: [-35, 13.5, 29], castShadow: true },
    { geo: new THREE.BoxGeometry(5, 27, 5), mat: beamMat, pos: [35, 13.5, 29], castShadow: true },
    { geo: new THREE.BoxGeometry(5, 27, 5), mat: beamMat, pos: [-35, 13.5, -29], castShadow: true },
    { geo: new THREE.BoxGeometry(5, 27, 5), mat: beamMat, pos: [35, 13.5, -29], castShadow: true },
    { geo: new THREE.BoxGeometry(78, 4, 64), mat: beamMat, pos: [0, 25, 0], castShadow: true },
    // 지붕
    { geo: new THREE.BoxGeometry(42, 3.2, 76), mat: roofMat, pos: [-18.5, 32, 0], rot: [0, 0, 0.45], castShadow: true },
    { geo: new THREE.BoxGeometry(42, 3.2, 76), mat: roofMat, pos: [18.5, 32, 0], rot: [0, 0, -0.45], castShadow: true },
    { geo: new THREE.BoxGeometry(9, 4.4, 78), mat: beamMat, pos: [0, 40.6, 0], castShadow: true },
    // 문 · 창문
    { geo: new THREE.BoxGeometry(15, 20, 3), mat: doorMat, pos: [0, 10, 31.4] },
    { geo: new THREE.BoxGeometry(11, 11, 2.6), mat: windowMat, pos: [-24, 16, 31.2] },
    { geo: new THREE.BoxGeometry(11, 11, 2.6), mat: windowMat, pos: [24, 16, 31.2] },
    // 굴뚝
    { geo: new THREE.BoxGeometry(9, 17, 9), mat: stoneMat, pos: [25, 36, -15], castShadow: true },
  ];
}

function buildCottages(scene) {
  const a = [
    { x: -2260, z: -178, ry: 0.18 }, { x: -2255, z: 178, ry: -0.2 },
    { x: -2195, z: -392, ry: 0.1 }, { x: -1650, z: 186, ry: -0.95 },
    { x: -1660, z: -132, ry: 0.82 },
  ];
  const b = [
    { x: -2130, z: 300, ry: 0.42 }, { x: -1850, z: 288, ry: -0.5 },
    { x: -1820, z: -218, ry: 0.62 }, { x: -2386, z: 252, ry: -1.05 },
  ];
  const c = [
    { x: -1795, z: -392, ry: -0.16 }, { x: -2382, z: -232, ry: 1.2 },
  ];
  const place = (list) => list.map((p) => ({
    x: p.x, z: p.z, y: terrainHeight(p.x, p.z), ry: p.ry, s: 1,
  }));
  buildInstancedSet(scene, cottageParts(0xe8dcc0, 0xa8563c), place(a));
  buildInstancedSet(scene, cottageParts(0xdccdae, 0x6b5a52), place(b));
  buildInstancedSet(scene, cottageParts(0xefe4c8, 0x8a5a3a), place(c));
  return a.concat(b, c);
}

function buildFountain(scene, cx, cz) {
  const g = new THREE.Group();
  const stone = propMat(0xc3bda9, { roughness: 0.9 });
  const stoneDark = propMat(0x9a9486, { roughness: 1 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(30, 32, 9, 28), stone);
  basin.position.y = 4.5;
  basin.castShadow = true;
  basin.receiveShadow = true;
  g.add(basin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(30, 2.6, 8, 32), stoneDark);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 9;
  g.add(rim);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(28, 32),
    new THREE.MeshStandardMaterial({ color: 0x56b4e0, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.9 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 8.6;
  g.add(water);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 6.4, 22, 12), stone);
  pillar.position.y = 19;
  pillar.castShadow = true;
  g.add(pillar);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(13, 5, 4.4, 18), stone);
  bowl.position.y = 31;
  bowl.castShadow = true;
  g.add(bowl);
  const top = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 10), new THREE.MeshStandardMaterial({
    color: 0x7fd8ff, emissive: 0x2f9fd0, emissiveIntensity: 0.9, roughness: 0.25, transparent: true, opacity: 0.92,
  }));
  top.position.y = 37;
  g.add(top);
  // 물줄기
  const jetMat = new THREE.MeshStandardMaterial({
    color: 0xa8e4ff, transparent: true, opacity: 0.55, roughness: 0.1, emissive: 0x6fc8f0, emissiveIntensity: 0.4,
  });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 22, 6), jetMat);
    jet.position.set(Math.cos(a) * 17, 20, Math.sin(a) * 17);
    jet.rotation.set(Math.sin(a) * 0.42, 0, -Math.cos(a) * 0.42);
    g.add(jet);
  }
  const light = new THREE.PointLight(0x9fe0ff, 60, 240, 2);
  light.position.set(0, 40, 0);
  g.add(light);
  g.position.set(cx, terrainHeight(cx, cz), cz);
  scene.add(g);
  return { group: g, water, top };
}

function buildBenches(scene, cx, cz) {
  const woodMat = propMat(0x7a5230, { roughness: 0.95 });
  const ironMat = propMat(0x4a4a4f, { roughness: 0.8, metalness: 0.4 });
  const placements = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    placements.push({
      x: cx + Math.cos(a) * 70, z: cz + Math.sin(a) * 70,
      y: terrainHeight(cx + Math.cos(a) * 70, cz + Math.sin(a) * 70),
      ry: -a + Math.PI / 2, s: 1,
    });
  }
  buildInstancedSet(scene, [
    { geo: new THREE.BoxGeometry(22, 2.2, 7), mat: woodMat, pos: [0, 7.4, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(22, 6, 1.6), mat: woodMat, pos: [0, 10.4, -3.6], castShadow: true },
    { geo: new THREE.BoxGeometry(1.8, 7.4, 1.8), mat: ironMat, pos: [-8, 3.7, 2.2], castShadow: true },
    { geo: new THREE.BoxGeometry(1.8, 7.4, 1.8), mat: ironMat, pos: [8, 3.7, 2.2], castShadow: true },
    { geo: new THREE.BoxGeometry(1.8, 12, 1.8), mat: ironMat, pos: [-8, 6, -3.6] },
    { geo: new THREE.BoxGeometry(1.8, 12, 1.8), mat: ironMat, pos: [8, 6, -3.6] },
  ], placements);
}

function buildLamps(scene) {
  const poleMat = propMat(0x3f3a34, { roughness: 0.7, metalness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe0a0, emissive: 0xffb347, emissiveIntensity: 1.7, roughness: 0.4,
  });
  const spots = [
    { x: -2092, z: -92 }, { x: -1908, z: -92 },
    { x: -2092, z: 92 }, { x: -1908, z: 92 },
    { x: -2028, z: 210 }, { x: -1972, z: 330 },
    { x: -2160, z: 0 }, { x: -1840, z: 0 },
  ];
  const placements = spots.map((s) => ({ x: s.x, z: s.z, y: terrainHeight(s.x, s.z), ry: 0, s: 1 }));
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(0.9, 1.4, 30, 8), mat: poleMat, pos: [0, 15, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(7, 1.2, 7), mat: poleMat, pos: [0, 30, 0] },
    { geo: new THREE.BoxGeometry(6, 8, 6), mat: lampMat, pos: [0, 34.5, 0] },
    { geo: new THREE.ConeGeometry(5, 3.4, 4), mat: poleMat, pos: [0, 40, 0], rot: [0, Math.PI / 4, 0] },
  ], placements);
  // 실제 조명은 4개만 (성능)
  for (const i of [0, 1, 2, 3]) {
    const s = spots[i];
    const l = new THREE.PointLight(0xffcf8a, 70, 240, 2);
    l.position.set(s.x, terrainHeight(s.x, s.z) + 34, s.z);
    scene.add(l);
  }
}

function villageTrees(scene) {
  const trunkMat = propMat(0x6b4a2f, { roughness: 0.95 });
  const leafMat = propMat(0x4e8c3c, { roughness: 0.9 });
  const leafMat2 = propMat(0x63a64a, { roughness: 0.9 });
  const b = BIOMES.village.bounds;
  const list = scatter(601, BIOMES.village, 150, KEEP_OUTS.village, { margin: 70, minScale: 0.7, maxScale: 1.35 })
    .filter((t) => !onVillageRoad(t.x, t.z));
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(1.2, 2.1, 18, 6), mat: trunkMat, pos: [0, 9, 0], castShadow: true },
    { geo: new THREE.IcosahedronGeometry(8.2, 1), mat: leafMat, pos: [0, 23, 0], scale: [1.1, 0.95, 1.1], castShadow: true },
    { geo: new THREE.IcosahedronGeometry(5.4, 1), mat: leafMat2, pos: [3.4, 27.5, -1.8], scale: 0.85 },
    { geo: new THREE.IcosahedronGeometry(4.6, 1), mat: leafMat2, pos: [-3, 26.4, 2.4], scale: 0.75 },
  ], list);

  const grassMat = propMat(0x6ba84b, { roughness: 1 });
  const flowers = [];
  const rnd = mulberry32(602);
  let guard = 0;
  while (flowers.length < 320 && guard < 4000) {
    guard++;
    const x = lerp(b.x0 + 60, b.x1 - 60, rnd());
    const z = lerp(b.z0 + 60, b.z1 - 60, rnd());
    if (onVillageRoad(x, z)) continue;
    if (Math.hypot(x + 2000, z) < 100) continue;
    flowers.push({ x, z, y: terrainHeight(x, z), ry: rnd() * Math.PI * 2, s: 0.7 + rnd() * 0.8 });
  }
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(1.0, 4.0, 4), mat: grassMat, pos: [0, 2, 0] },
  ], flowers);

  const petals = propMat(0xf2d0e0, { roughness: 0.9 });
  buildInstancedSet(scene, [
    { geo: new THREE.SphereGeometry(0.9, 6, 5), mat: petals, pos: [0, 0.9, 0] },
  ], flowers.filter((f, i) => i % 7 === 0));

  // 마른 건초 더미 · 나무통
  const hayMat = propMat(0xd8bb6a, { roughness: 1 });
  const hay = [
    { x: -2180, z: 120 }, { x: -1830, z: 150 }, { x: -2270, z: 320 },
  ].map((p) => ({ x: p.x, z: p.z, y: terrainHeight(p.x, p.z), ry: Math.random() * 3, s: 1 }));
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(7, 7, 10, 12), mat: hayMat, pos: [0, 5, 0], rot: [0, 0, Math.PI / 2], castShadow: true },
  ], hay);
}

function buildVillageGate(scene) {
  const postMat = propMat(0x6b4a2f, { roughness: 0.95 });
  const roofMat = propMat(0x8a4a34, { roughness: 0.9 });
  for (const z of [-44, 44]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 52, 8), postMat);
    post.position.set(-1520, terrainHeight(-1520, z) + 26, z);
    post.castShadow = true;
    scene.add(post);
  }
  const y = terrainHeight(-1520, 0);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 104), postMat);
  beam.position.set(-1520, y + 56, 0);
  beam.castShadow = true;
  scene.add(beam);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 116), roofMat);
  roof.position.set(-1520, y + 63, 0);
  roof.castShadow = true;
  scene.add(roof);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 22, 76), signMaterial('태초마을', 'STARTER VILLAGE'));
  sign.position.set(-1520, y + 40, 0);
  scene.add(sign);
  const sign2 = new THREE.Mesh(new THREE.BoxGeometry(36, 14, 2.2), signMaterial('쾌적한 숲 →', ''));
  sign2.position.set(-1526, y + 44, 60);
  scene.add(sign2);
}

// 무기 · 포션 상점 건물 + 상점 주인 NPC
function buildShop(scene) {
  const s = BIOMES.village.shop;
  const g = new THREE.Group();
  const woodMat = propMat(0x7c5433, { roughness: 0.92 });
  const woodDark = propMat(0x53341f, { roughness: 0.95 });
  const stoneMat = propMat(0xb9b2a2, { roughness: 1 });
  const stripeA = propMat(0xc0493c, { roughness: 0.85 });
  const stripeB = propMat(0xf0e6d2, { roughness: 0.85 });
  const shelfMat = propMat(0x5c3b23, { roughness: 0.95 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(128, 3, 96), stoneMat);
  base.position.y = 1.5;
  base.receiveShadow = true;
  base.castShadow = true;
  g.add(base);

  const back = new THREE.Mesh(new THREE.BoxGeometry(128, 52, 8), woodMat);
  back.position.set(0, 26, -40);
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);
  for (const sx of [-60, 60]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(8, 52, 88), woodMat);
    side.position.set(sx, 26, -4);
    side.castShadow = true;
    g.add(side);
  }
  // 천장 들보
  const beam = new THREE.Mesh(new THREE.BoxGeometry(132, 7, 96), woodDark);
  beam.position.y = 52;
  beam.castShadow = true;
  g.add(beam);

  // 계산대
  const counter = new THREE.Mesh(new THREE.BoxGeometry(104, 17, 14), woodMat);
  counter.position.set(0, 9.5, 30);
  counter.castShadow = true;
  g.add(counter);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(112, 3, 20), woodDark);
  counterTop.position.set(0, 19, 30);
  counterTop.castShadow = true;
  g.add(counterTop);

  // 앞 기둥 + 차양 (빨강 · 크림 줄무늬)
  for (const sx of [-58, 58]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 54, 8), woodDark);
    post.position.set(sx, 27, 36);
    post.castShadow = true;
    g.add(post);
  }
  for (let i = 0; i < 6; i++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(22, 1.8, 34), i % 2 ? stripeB : stripeA);
    slab.position.set(-55 + i * 22, 50, 32);
    slab.rotation.x = -0.3;
    slab.castShadow = true;
    g.add(slab);
  }

  // 진열장 · 상품
  for (const row of [{ y: 26, z: -33 }, { y: 38, z: -33 }]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(104, 2.4, 14), shelfMat);
    shelf.position.set(0, row.y, row.z);
    shelf.castShadow = true;
    g.add(shelf);
  }
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ec, roughness: 0.3, metalness: 0.9 });
  const potionColors = [0xe0574f, 0x7fc16a, 0x9a7fd0, 0x6fa8dc, 0xffc95a];
  for (let i = 0; i < 9; i++) { // 무기 진열
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.2, 14, 2.2), steelMat);
    blade.position.set(-46 + i * 11.5, 34, -33);
    blade.rotation.z = 0.06 * (i % 2 ? 1 : -1);
    g.add(blade);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 2.4), propMat(0xd8b25e, { roughness: 0.4, metalness: 0.7 }));
    hilt.position.set(-46 + i * 11.5, 27.6, -33);
    g.add(hilt);
  }
  for (let i = 0; i < 10; i++) { // 포션 진열
    const col = potionColors[i % potionColors.length];
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 5.2, 8), new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: 0.7, roughness: 0.25, transparent: true, opacity: 0.92,
    }));
    bottle.position.set(-50 + i * 11, 24.2, -30);
    g.add(bottle);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 6), propMat(0x8a6a44, { roughness: 0.8 }));
    neck.position.set(-50 + i * 11, 28, -30);
    g.add(neck);
  }

  // 간판
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(82, 24, 2.6),
    signMaterial('무기 · 포션 상점', 'WEAPONS & POTIONS', 0x3f2712)
  );
  signBoard.position.set(0, 63, 34);
  signBoard.castShadow = true;
  g.add(signBoard);
  for (const sx of [-30, 30]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 12, 5), woodDark);
    chain.position.set(sx, 58.5, 34);
    g.add(chain);
  }

  // 상점 주인 NPC
  const npc = new THREE.Group();
  const skin = propMat(0xe8bd98, { roughness: 0.8 });
  const tunic = propMat(0x4f7fa8, { roughness: 0.9 });
  const apron = propMat(0xf0e6d2, { roughness: 0.9 });
  const hairMat = propMat(0x6b4a2f, { roughness: 0.9 });
  const pants = propMat(0x3d4652, { roughness: 0.95 });
  const mkPart = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };
  npc.add(mkPart(new THREE.BoxGeometry(4.4, 10, 4.6), pants, -1.5, 5, 0));
  npc.add(mkPart(new THREE.BoxGeometry(4.4, 10, 4.6), pants, 1.5, 5, 0));
  npc.add(mkPart(new THREE.BoxGeometry(10, 11, 5.6), tunic, 0, 15, 0));
  npc.add(mkPart(new THREE.BoxGeometry(8, 9, 1.2), apron, 0, 14, 3));
  npc.add(mkPart(new THREE.BoxGeometry(3.2, 8, 3.4), skin, -6.4, 15, 0));
  npc.add(mkPart(new THREE.BoxGeometry(3.2, 8, 3.4), skin, 6.4, 15, 0));
  npc.add(mkPart(new THREE.BoxGeometry(6.4, 6.4, 6.2), skin, 0, 24, 0));
  npc.add(mkPart(new THREE.BoxGeometry(6.8, 2.4, 6.6), hairMat, 0, 27.6, -0.2));
  const brim = mkPart(new THREE.CylinderGeometry(5.6, 5.6, 0.9, 14), hairMat, 0, 28.4, 0);
  npc.add(brim);
  npc.add(mkPart(new THREE.CylinderGeometry(3.2, 3.4, 3.4, 12), hairMat, 0, 30.4, 0));
  const eyeA = new THREE.MeshBasicMaterial({ color: 0x2b2b30 });
  npc.add(mkPart(new THREE.BoxGeometry(0.7, 0.9, 0.3), eyeA, -1.3, 24.6, 3.15));
  npc.add(mkPart(new THREE.BoxGeometry(0.7, 0.9, 0.3), eyeA, 1.3, 24.6, 3.15));
  npc.add(mkPart(new THREE.BoxGeometry(3.2, 0.7, 0.3), propMat(0xb4544a), 0, 21.6, 3.1));
  npc.position.set(-16, 0, 12);
  npc.rotation.y = Math.PI;
  g.add(npc);

  // 상호작용 표시 링 · 떠 있는 표식
  const ringGeo = new THREE.RingGeometry(60, 66, 44);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color: 0xffd24a, transparent: true, opacity: 0.18, depthWrite: false,
  }));
  ring.position.y = 2.2;
  g.add(ring);

  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(5.4, 0), new THREE.MeshStandardMaterial({
    color: 0xffd24a, emissive: 0xffb020, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.6,
  }));
  marker.position.set(0, 84, 26);
  g.add(marker);
  const lightBeam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 150, 10, 1, true), new THREE.MeshBasicMaterial({
    color: 0xffd88a, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  lightBeam.position.set(0, 80, 26);
  g.add(lightBeam);
  const shopLight = new THREE.PointLight(0xffcf8a, 200, 420, 2);
  shopLight.position.set(0, 46, 30);
  g.add(shopLight);

  g.position.set(s.x, terrainHeight(s.x, s.z), s.z);
  scene.add(g);
  return { group: g, npc, marker, ring, beam: lightBeam, npcBaseY: 0, markerBaseY: 84 };
}

function buildVillage(scene) {
  const cx = BIOMES.village.center.x;
  const cz = BIOMES.village.center.z;

  // 길 · 광장
  buildRoad(scene, -2500, 0, -1500, 0, 44, 0xb9a887);
  buildRoad(scene, -2000, 0, -2000, 440, 36, 0xb9a887);
  buildRoad(scene, -2000, -110, -2000, 0, 70, 0xb9a887);
  buildDisc(scene, cx, cz, 100, 0xc2b79c, 0.3, 56);
  buildDisc(scene, cx, cz, 74, 0xb2a68c, 0.45, 48);

  buildCottages(scene);
  const fountain = buildFountain(scene, cx, cz);
  buildBenches(scene, cx, cz);
  buildLamps(scene);
  villageTrees(scene);
  buildVillageGate(scene);

  // 마을 표지판 (동쪽 길)
  const postMat = propMat(0x6b4a2f, { roughness: 0.95 });
  const postX = -1750, postZ = 46;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 26, 7), postMat);
  post.position.set(postX, terrainHeight(postX, postZ) + 13, postZ);
  post.castShadow = true;
  scene.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(46, 14, 2), signMaterial('→ 쾌적한 숲', 'PLEASANT FOREST', 0x4a2e18));
  board.position.set(postX, terrainHeight(postX, postZ) + 26, postZ);
  scene.add(board);

  const shop = buildShop(scene);
  return { shop, fountain };
}

function buildBoundary(scene) {
  const rockMat = propMat(0x4a4741, { roughness: 1 });
  const edges = [
    // 태초마을이 서쪽으로 이어지므로 z=±500 경계는 x=-2500부터 시작한다
    { x0: -2500, z0: -500, x1: -500, z1: -500 },
    { x0: -2500, z0: 500, x1: -500, z1: 500 },
    { x0: -2500, z0: -500, x1: -2500, z1: 500 },
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

  const village = buildVillage(scene);
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
    village,
  };
}

/* 태초마을의 생동감: 상인 인사 · 상점 표식 · 분수 물결 */
export function updateVillage(world, dt, t) {
  const v = world && world.village;
  if (!v) return;
  const shop = v.shop;
  if (shop) {
    if (shop.npc) {
      shop.npc.position.y = shop.npcBaseY + Math.sin(t * 1.7) * 0.45;
      shop.npc.rotation.y = Math.PI + Math.sin(t * 0.7) * 0.3;
    }
    if (shop.marker) {
      shop.marker.rotation.y += dt * 1.1;
      shop.marker.position.y = shop.markerBaseY + Math.sin(t * 2.1) * 3.4;
    }
    if (shop.ring) {
      shop.ring.material.opacity = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(t * 2.2));
      shop.ring.rotation.z += dt * 0.06;
    }
  }
  const f = v.fountain;
  if (f && f.water) {
    f.water.material.opacity = 0.82 + Math.sin(t * 1.8) * 0.06;
    if (f.top) f.top.rotation.y += dt * 0.5;
  }
}

export function updateSun(world, target, camera) {
  const sun = world.sun;
  sun.position.set(target.x - 120, target.y + 240, target.z + 90);
  sun.target.position.set(target.x, target.y, target.z);
  sun.target.updateMatrixWorld();
  if (world.sky) world.sky.position.copy(camera.position);
}
