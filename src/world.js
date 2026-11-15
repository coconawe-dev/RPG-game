// 월드 생성: 지형(5개 바이옴), 프롭, 랜드마크, 사원 구조물, 조명, 하늘
import * as THREE from 'three';
import {
  BIOMES, BIOME_ORDER, BIOME_ORDER_W2, ALL_BIOME_ORDER, compassOrderFor,
} from './config.js';
import {
  WORLD, WORLD2, terrainHeight, valueNoise, fbm, mulberry32, clamp, smoothstep, makeInstanced, lerp,
} from './utils.js';

const NEIGHBORS = {
  village: [{ side: 'east', id: 'forest' }],
  forest: [{ side: 'east', id: 'temple' }, { side: 'west', id: 'village' }],
  savanna: [{ side: 'west', id: 'temple' }, { side: 'east', id: 'old_village' }],
  old_village: [{ side: 'west', id: 'savanna' }],
  graveyard: [{ side: 'south', id: 'temple' }],
  jungle: [{ side: 'north', id: 'temple' }],
  temple: [
    { side: 'east', id: 'savanna' },
    { side: 'west', id: 'forest' },
    { side: 'north', id: 'graveyard' },
    { side: 'south', id: 'jungle' },
  ],
  // 2번째 세계 — 중앙 암흑지역을 네 방향이 감싼다
  goblin_forest: [{ side: 'north', id: 'dark_realm' }],
  misty_plains: [{ side: 'east', id: 'dark_realm' }],
  sakura: [{ side: 'west', id: 'dark_realm' }],
  ominous_cave: [{ side: 'south', id: 'dark_realm' }],
  dark_realm: [
    { side: 'north', id: 'ominous_cave' },
    { side: 'south', id: 'goblin_forest' },
    { side: 'east', id: 'sakura' },
    { side: 'west', id: 'misty_plains' },
  ],
};

const C = (hex) => new THREE.Color(hex);

/* ---------------------------- 품질 설정 ----------------------------
   buildWorld(scene, { low: true }) 로 휴대폰 품질을 고른다.
   - low: 지형 정점 수를 줄이고, 프롭(나무·바위·풀)은 그림자를 드리우지 않는다
   - 두 경우 모두 장식용 점광원은 쓰지 않는다 (아래 glowHalo · 발광 재질로 대신한다)
------------------------------------------------------------------- */
const QUALITY = { low: false, propShadows: true, groundSeg: 78, shadowSets: [] };

/* 그림자 설정 — 같은 1024 맵이라도 그림자 카메라를 플레이어 주변으로 좁게 잡으면
   훨씬 또렷하다. 품질 토글은 이 값과 프롭 그림자만 바꾼다(지형은 다시 만들지 않는다). */
const SHADOW = {
  high: { mapSize: 1536, ext: 125, far: 620, normalBias: 0.4, bias: -0.0005 },
  low: { mapSize: 1024, ext: 120, far: 520, normalBias: 0.6, bias: -0.0006 },
};

export function getWorldQuality() { return QUALITY; }

/* 게임 중 품질 토글: 프롭 그림자를 켜고 끄고, 태양 그림자 맵의 크기 · 범위를 바꾼다.
   (지형 정점 수처럼 메시를 다시 만들어야 하는 값은 시작할 때 정해진 그대로 둔다) */
export function applyWorldQuality(world, opts) {
  const low = !!(opts && opts.low);
  QUALITY.low = low;
  QUALITY.propShadows = !low;
  for (const s of QUALITY.shadowSets) {
    const want = !!(s.cast && QUALITY.propShadows);
    if (s.mesh.castShadow !== want) s.mesh.castShadow = want;
  }
  const sun = world && world.sun;
  if (!sun || !sun.shadow) return;
  const cfg = low ? SHADOW.low : SHADOW.high;
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = cfg.far;
  cam.left = -cfg.ext;
  cam.right = cfg.ext;
  cam.top = cfg.ext;
  cam.bottom = -cfg.ext;
  cam.updateProjectionMatrix();
  sun.shadow.bias = cfg.bias;
  sun.shadow.normalBias = cfg.normalBias;
  const size = sun.shadow.mapSize;
  if (size.x !== cfg.mapSize || size.y !== cfg.mapSize) {
    size.set(cfg.mapSize, cfg.mapSize);
    // 크기가 바뀌면 쓰던 그림자 텍스처를 버리고 다음 프레임에 새로 만든다
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }
  sun.shadow.needsUpdate = true;
}

// 값이 큰 장식 불빛은 실제 조명(점광원) 대신 가산 혼합 후광 메시로 표현한다.
// 점광원 하나가 씬의 모든 MeshStandardMaterial 픽셀 비용을 끌어올리기 때문.
const haloGeo = new THREE.SphereGeometry(1, 10, 8);
function glowHalo(color, size, opacity, flatten) {
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opacity === undefined ? 0.2 : opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const m = new THREE.Mesh(haloGeo, mat);
  m.scale.set(size, size * (flatten === undefined ? 1 : flatten), size);
  m.userData.baseOpacity = mat.opacity;
  return m;
}

/* ------------------------------- 지형 ------------------------------- */
function buildGround(scene, biome) {
  const seg = QUALITY.groundSeg;
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

    // 낡은 마을은 흙바닥 + 부서진 조약돌 길
    if (biome.id === 'old_village') {
      const cob = fbm(wx * 0.045, wz * 0.045, 2);
      tmp.lerp(C(0x5b5346), clamp(0.3 + cob * 0.55, 0, 1) * 0.5);
      const cgx = Math.abs(((lx + 500) % 46) - 23) / 23;
      const cgz = Math.abs(((lz + 500) % 46) - 23) / 23;
      const crack = Math.max(cgx, cgz);
      tmp.lerp(C(0x413a30), smoothstep(0.9, 1, crack) * 0.45);
    }

    /* ---------------------- 2번째 세계 바닥 결 ---------------------- */
    // 고블린 숲: 이끼 마당 · 젖은 흙길
    if (biome.id === 'goblin_forest') {
      const moss = fbm(wx * 0.012, wz * 0.012, 3);
      tmp.lerp(C(0x3d7a4a), clamp(0.35 + moss * 0.8, 0, 1) * 0.45);
      const trail = Math.abs(wx) / 34 + Math.sin(wz * 0.021) * 0.5;
      tmp.lerp(C(0x2a3d26), clamp(1 - trail, 0, 1) * 0.4);
    }
    // 불길한 동굴: 거친 흑암 · 용암이 드러난 갈라진 틈
    if (biome.id === 'ominous_cave') {
      const rock = fbm(wx * 0.03, wz * 0.03, 2);
      tmp.lerp(C(0x120e14), clamp(0.35 - rock * 0.6, 0, 0.4));
      const veins = fbm(wx * 0.008, wz * 0.008, 2);
      const lava = smoothstep(0.46, 0.56, Math.abs(veins)) * (1 - Math.abs(veins) * 0.4);
      tmp.lerp(C(0xff5a1c), clamp(lava, 0, 1) * 0.75);
    }
    // 안개낀 평지: 재빛 마른 땅 · 하얗게 마른 갈라진 쩍
    if (biome.id === 'misty_plains') {
      const ash = fbm(wx * 0.011, wz * 0.011, 3);
      tmp.lerp(C(0xb1afa6), clamp(0.4 + ash * 0.9, 0, 1) * 0.4);
      const crack = fbm(wx * 0.05, wz * 0.05, 2);
      tmp.lerp(C(0x6a6963), smoothstep(0.28, 0.38, Math.abs(crack)) * 0.3);
    }
    // 사쿠라: 꽃잎이 깔린 연둣빛 풀밭
    if (biome.id === 'sakura') {
      const grass = fbm(wx * 0.013, wz * 0.013, 3);
      tmp.lerp(C(0x93ab6e), clamp(0.4 + grass * 0.8, 0, 1) * 0.45);
      const petals = fbm(wx * 0.045 + 11, wz * 0.045 - 7, 2);
      tmp.lerp(C(0xe9a8bd), smoothstep(0.34, 0.5, petals) * 0.55);
    }
    // 암흑지역: 흑요석 판 · 제단을 감싼 자줏빛 룬 미늘
    if (biome.id === 'dark_realm') {
      const shard = fbm(wx * 0.026, wz * 0.026, 2);
      tmp.lerp(C(0x141020), clamp(0.4 - shard * 0.7, 0, 0.45));
      const r = Math.hypot(lx, lz);
      const runeA = Math.abs(Math.sin(r * 0.045));
      tmp.lerp(C(0x7a3fbf), smoothstep(0.965, 1, runeA) * 0.55);
      const runeB = Math.abs(Math.sin(Math.atan2(lz, lx) * 6));
      tmp.lerp(C(0xc23a6a), smoothstep(0.985, 1, runeB) * (r > 90 && r < 330 ? 0.5 : 0));
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

  // 지면은 화면을 가장 크게 채우는 면이라 표준(PBR) 재질 대신 램버트를 쓴다.
  // 색은 정점 색으로 이미 다 칠해져 있어 겉모습 차이가 거의 없고 픽셀 비용은 훨씬 싸다.
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
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
    im.castShadow = !!(part.castShadow && QUALITY.propShadows);
    im.receiveShadow = true;
    // 나중에 품질 토글로 프롭 그림자만 껐다 켰다 할 수 있게 원래 성질을 기억해 둔다
    QUALITY.shadowSets.push({ mesh: im, cast: !!part.castShadow });
    // 인스턴스 전체를 감싸는 경계 구를 계산해 두면 화면 밖으로 나갈 때 통째로 건너뛴다
    im.computeBoundingSphere();
    im.frustumCulled = true;
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
  old_village: [
    { x: 2000, z: 0, r: 150 }, { x: 1500, z: 0, r: 110 },
    { x: 1860, z: -230, r: 80 }, { x: 2160, z: -215, r: 80 },
    { x: 1845, z: 235, r: 80 }, { x: 2150, z: 250, r: 80 },
    { x: 1740, z: -60, r: 78 }, { x: 2270, z: 20, r: 78 },
    { x: 2000, z: -360, r: 78 }, { x: 2000, z: 360, r: 78 },
    { x: 2050, z: 130, r: 60 },
  ],
  jungle: [{ x: 0, z: 1000, r: 130 }, { x: 0, z: 500, r: 120 }],
  temple: [{ x: 0, z: 0, r: 260 }, { x: 0, z: -500, r: 90 }, { x: 0, z: 500, r: 90 }, { x: -500, z: 0, r: 90 }, { x: 500, z: 0, r: 90 }],
  // 2번째 세계 — 도착 광장 · 랜드마크 · 보스 투기장을 비워 둔다
  goblin_forest: [
    { x: 0, z: WORLD2.originZ + 1400, r: 250 },
    { x: 190, z: WORLD2.originZ + 1400, r: 110 },
    { x: 0, z: WORLD2.originZ + 900, r: 130 },
    { x: 0, z: WORLD2.originZ + 500, r: 90 },
  ],
  ominous_cave: [{ x: 0, z: WORLD2.originZ - 1000, r: 170 }, { x: 0, z: WORLD2.originZ - 500, r: 100 }],
  misty_plains: [{ x: -1000, z: WORLD2.originZ, r: 160 }, { x: -500, z: WORLD2.originZ, r: 100 }],
  sakura: [{ x: 1000, z: WORLD2.originZ, r: 180 }, { x: 500, z: WORLD2.originZ, r: 100 }],
  dark_realm: [{ x: 0, z: WORLD2.originZ, r: 320 }],
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
  // 촛불 후광 (점광원 대신 가산 메시)
  const candleGlow = glowHalo(0x9fd8ff, 7, 0.14);
  candleGlow.position.set(0, 9, 0);
  g.add(candleGlow);
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

/* ---------------------------- 낡은 마을 (폐촌) ---------------------------- */
// 무너진 목조 가옥 · 부서진 울타리 · 통/상자 · 캠프파이어 · 망루 폐허
const RUIN_WOOD = 0x4a3d31;
const RUIN_WOOD_DARK = 0x352c24;
const RUIN_STONE = 0x6b6558;

function ruinedHouse(scene, x, z, ry, tilt, variant) {
  const g = new THREE.Group();
  const wood = propMat(RUIN_WOOD, { roughness: 1 });
  const woodDark = propMat(RUIN_WOOD_DARK, { roughness: 1 });
  const stone = propMat(RUIN_STONE, { roughness: 1 });
  const roof = propMat(variant % 2 ? 0x3f3a33 : 0x51443a, { roughness: 0.95 });
  const doorMat = propMat(0x241d17, { roughness: 1 });

  const mk = (geo, mat, px, py, pz, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // 돌 기단(허물어진 부분은 낮게)
  mk(new THREE.BoxGeometry(72, 6, 58), stone, 0, 3, 0);
  mk(new THREE.BoxGeometry(26, 4, 58), stone, -22, 3, 6, [0, 0, -0.06]);

  // 벽 — 네 면 중 한 면은 무너져 내려 없다
  const wallH = 24;
  mk(new THREE.BoxGeometry(70, wallH, 4.5), wood, 0, 6 + wallH / 2, -27);
  mk(new THREE.BoxGeometry(4.5, wallH * 0.82, 54), woodDark, -33, 6 + wallH * 0.41, 0);
  if (variant % 3 !== 0) mk(new THREE.BoxGeometry(4.5, wallH * 0.6, 54), woodDark, 33, 6 + wallH * 0.3, 0, [0, 0, 0.04]);
  // 앞면: 기둥 두 개 + 부서진 벽 조각
  mk(new THREE.BoxGeometry(4.6, wallH, 4.6), woodDark, -31, 6 + wallH / 2, 26);
  mk(new THREE.BoxGeometry(4.6, wallH * 0.55, 4.6), woodDark, 31, 6 + wallH * 0.28, 26, [0.05, 0, 0.05]);
  mk(new THREE.BoxGeometry(20, 9, 3.4), wood, -17, 6 + wallH * 0.72, 26, [0, 0, -0.12]);
  mk(new THREE.BoxGeometry(12, 14, 3), doorMat, 8, 6 + 7, 26.6, [0, 0, 0.09]);

  // 들보 · 기둥 머리
  mk(new THREE.BoxGeometry(74, 3.4, 60), woodDark, 0, 6 + wallH, 0, [0, 0, tilt * 0.5]);
  for (const s of [-1, 1]) {
    mk(new THREE.BoxGeometry(9, 4, 9), woodDark, s * 30, 6 + wallH * 0.62, 24, [0, 0, 0.2]);
  }

  // 지붕: 한쪽만 남은 부서진 판자 지붕
  const roofSide = variant % 2 ? 1 : -1;
  mk(new THREE.BoxGeometry(40, 3, 62), roof, roofSide * 17, 6 + wallH + 9, 0, [0, 0, -roofSide * 0.5]);
  mk(new THREE.BoxGeometry(16, 2.4, 40), roof, -roofSide * 8, 6 + wallH + 13, -6, [0.12, 0.2, roofSide * 0.85]);
  // 떨어져 나간 서까래
  mk(new THREE.BoxGeometry(2.6, 22, 2.6), woodDark, roofSide * 22, 6 + wallH + 4, 27, [0.9, 0, roofSide * 0.3]);
  mk(new THREE.BoxGeometry(2.6, 18, 2.6), woodDark, roofSide * 26, 6 + wallH + 2, -20, [-0.7, 0, roofSide * 0.5]);

  // 무너진 잔해
  mk(new THREE.BoxGeometry(16, 2.4, 5), woodDark, -8, 7.4, 32, [0, 0.4, 0.15]);
  mk(new THREE.BoxGeometry(10, 2.2, 4), wood, 14, 7.2, -34, [0, -0.6, -0.1]);

  g.position.set(x, terrainHeight(x, z), z);
  g.rotation.set(0, ry, tilt);
  scene.add(g);
  return g;
}

function buildOldVillage(scene) {
  const biome = BIOMES.old_village;

  // 길 · 광장 (부서진 조약돌)
  buildRoad(scene, 1500, 0, 2500, 0, 40, 0x6a6053);
  buildDisc(scene, 2000, 0, 118, 0x6d6558, 0.35, 44);
  buildDisc(scene, 2000, 0, 92, 0x615a4c, 0.5, 36);

  // 폐가 8채 — 저마다 다른 각도로 기울어 서 있다
  const houses = [
    [1860, -230, 0.35, 0.05, 0], [2160, -215, -0.4, -0.07, 1],
    [1845, 235, 2.6, 0.06, 2], [2150, 250, 3.4, -0.05, 3],
    [1740, -60, 1.55, 0.09, 4], [2270, 20, -1.4, -0.08, 5],
    [2010, -360, 0.1, 0.04, 6], [2000, 365, 3.1, -0.03, 7],
  ];
  for (const h of houses) ruinedHouse(scene, h[0], h[1], h[2], h[3], h[4]);

  // 부서진 울타리 (기둥 · 쓰러진 판자)
  const fence = scatter(701, biome, 120, KEEP_OUTS.old_village, { margin: 40, minScale: 0.7, maxScale: 1.3 });
  const fenceMat = propMat(RUIN_WOOD, { roughness: 1 });
  const fenceDark = propMat(RUIN_WOOD_DARK, { roughness: 1 });
  buildInstancedSet(scene, [
    { geo: new THREE.BoxGeometry(2.2, 11, 2.2), mat: fenceDark, pos: [0, 5.5, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(11, 1.6, 1.4), mat: fenceMat, pos: [5, 8, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(11, 1.4, 1.3), mat: fenceMat, pos: [-6, 5.2, 1.4], rot: [0, 0.5, 0.22] },
  ], fence);

  // 통 · 상자
  const barrels = scatter(702, biome, 70, KEEP_OUTS.old_village, { margin: 55, minScale: 0.8, maxScale: 1.5 });
  const caskMat = propMat(0x5c4630, { roughness: 0.95 });
  const ironMat = propMat(0x4b4a46, { roughness: 0.7, metalness: 0.5 });
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(4.2, 4.2, 10, 10), mat: caskMat, pos: [0, 5, 0], castShadow: true },
    { geo: new THREE.CylinderGeometry(4.4, 4.4, 1.1, 10), mat: ironMat, pos: [0, 8.4, 0] },
    { geo: new THREE.CylinderGeometry(4.4, 4.4, 1.1, 10), mat: ironMat, pos: [0, 2.2, 0] },
  ], barrels);
  const crates = scatter(703, biome, 60, KEEP_OUTS.old_village, { margin: 55, minScale: 0.8, maxScale: 1.4 });
  const crateMat = propMat(0x6a5334, { roughness: 0.95 });
  buildInstancedSet(scene, [
    { geo: new THREE.BoxGeometry(8.6, 8.6, 8.6), mat: crateMat, pos: [0, 4.3, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(9.2, 1.4, 1.4), mat: ironMat, pos: [0, 7.6, 0] },
    // 쓰러진 상자
    { geo: new THREE.BoxGeometry(8, 8, 8), mat: crateMat, pos: [9, 3.4, 3], rot: [0.9, 0, 0.2], castShadow: true },
  ], crates);

  // 마른 잡풀 · 돌무더기
  const dryGrass = scatter(704, biome, 500, null, { margin: 20, minScale: 0.6, maxScale: 1.5 });
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(1.1, 3.8, 3), mat: propMat(0x6f6448, { roughness: 1 }), pos: [0, 1.9, 0] },
  ], dryGrass);
  const rubble = scatter(705, biome, 110, KEEP_OUTS.old_village, { margin: 40, minScale: 0.5, maxScale: 1.6 });
  buildInstancedSet(scene, [
    { geo: new THREE.DodecahedronGeometry(3.6, 0), mat: propMat(RUIN_STONE, { roughness: 1 }), pos: [0, 1.6, 0], scale: [1.25, 0.7, 1.05], castShadow: true },
  ], rubble);

  // 흩어진 바퀴 · 수레 잔해
  const carts = scatter(706, biome, 16, KEEP_OUTS.old_village, { margin: 80, minScale: 0.9, maxScale: 1.5 });
  buildInstancedSet(scene, [
    { geo: new THREE.TorusGeometry(3.4, 0.7, 5, 12), mat: fenceDark, pos: [0, 3.4, 0], rot: [0, 0, 0] },
    { geo: new THREE.BoxGeometry(12, 1.6, 7), mat: fenceMat, pos: [2, 8.4, 0], rot: [0, 0, 0.4], castShadow: true },
  ], carts);

  // 캠프파이어 (광장 북동쪽)
  const fire = new THREE.Group();
  const fx = 2050, fz = 130;
  const logMat = propMat(0x2f2620, { roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 14, 6), logMat);
    log.position.set(Math.cos(a) * 5, 3.2, Math.sin(a) * 5);
    log.rotation.set(Math.PI / 2 - 0.35, a, 0);
    log.castShadow = true;
    fire.add(log);
  }
  // 돌 테두리
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 0), propMat(RUIN_STONE, { roughness: 1 }));
    s.position.set(Math.cos(a) * 13, 1.6, Math.sin(a) * 13);
    s.scale.set(1, 0.7, 1);
    fire.add(s);
  }
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.85 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(4.2, 12, 8), flameMat);
  flame.position.y = 8;
  fire.add(flame);
  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd08a })
  );
  ember.position.y = 4.4;
  fire.add(ember);
  // 모닥불 후광 — 실제 조명 대신 가산 혼합 메시 (아래 updateOldVillage 에서 흔들린다)
  const fireGlow = glowHalo(0xffa040, 18, 0.13, 0.7);
  fireGlow.position.y = 11;
  fire.add(fireGlow);
  fire.position.set(fx, terrainHeight(fx, fz), fz);
  scene.add(fire);

  // 랜드마크: 망루 폐허
  const g = new THREE.Group();
  const timber = propMat(0x3f342a, { roughness: 1 });
  const timberLight = propMat(0x584635, { roughness: 1 });
  const legH = 68;
  for (const s of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(5.2, legH, 5.2), timber);
    leg.position.set(s[0] * 13, legH / 2, s[1] * 13);
    leg.rotation.set(s[1] * -0.06, 0, s[0] * 0.06);
    leg.castShadow = true;
    g.add(leg);
  }
  // 가로 버팀목
  for (const h of [22, 44]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(31, 2.6, 2.6), timberLight);
    brace.position.set(0, h, -13);
    brace.rotation.z = 0.36;
    g.add(brace);
    const brace2 = new THREE.Mesh(new THREE.BoxGeometry(31, 2.6, 2.6), timberLight);
    brace2.position.set(0, h, 13);
    brace2.rotation.z = -0.36;
    g.add(brace2);
  }
  // 부서진 상부 마루
  const deck = new THREE.Mesh(new THREE.BoxGeometry(42, 4, 40), timberLight);
  deck.position.set(0, legH, 0);
  deck.rotation.set(0.02, 0.1, 0.13);
  deck.castShadow = true;
  g.add(deck);
  // 난간 (일부만 남음)
  for (const p of [[-19, 0], [19, 0], [0, -18], [-9, 18]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(2.4, 13, 2.4), timber);
    post.position.set(p[0], legH + 8, p[1]);
    post.rotation.z = 0.1;
    g.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(26, 1.8, 1.8), timber);
  rail.position.set(-6, legH + 13, -18);
  rail.rotation.z = 0.05;
  g.add(rail);
  // 부서진 지붕 조각
  const roofPiece = new THREE.Mesh(new THREE.BoxGeometry(26, 2.2, 30), timberLight);
  roofPiece.position.set(9, legH + 16, 6);
  roofPiece.rotation.set(0.5, 0.2, -0.7);
  g.add(roofPiece);
  // 사다리
  for (const s of [-3, 3]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(1.8, legH, 1.8), timberLight);
    side.position.set(s, legH / 2, 22);
    side.rotation.x = -0.14;
    g.add(side);
  }
  for (let i = 0; i < 10; i++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.3, 1.4), timber);
    rung.position.set(0, 5 + i * 6.4, 20.6 + i * 0.85);
    g.add(rung);
  }
  // 찢어진 깃발
  const flagMat = new THREE.MeshStandardMaterial({ color: 0x7a2f2a, roughness: 0.9, side: THREE.DoubleSide });
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 26), flagMat);
  flag.position.set(-20, legH - 6, 4);
  flag.rotation.z = 0.06;
  g.add(flag);
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  g.rotation.y = -0.35;
  scene.add(g);

  return { fire, flame, fireGlow, tower: g };
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
  const eyeGlow = glowHalo(0x8cff8c, 9, 0.12, 0.55);
  eyeGlow.position.set(0, 30, 13);
  g.add(eyeGlow);
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
  const crystalGlow = glowHalo(0x6fe0ff, 16, 0.16);
  crystalGlow.position.y = topY + 18;
  g.add(crystalGlow);

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
    const flameGlow = glowHalo(0xffb45c, 7, 0.16);
    flameGlow.position.set(0, 62, 0);
    gate.add(flameGlow);
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
    const fireGlow = glowHalo(0xff9a3c, 12, 0.16);
    fireGlow.position.y = 13;
    brazier.add(fireGlow);
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
  mesh.position.set(x, 0, z); // 정점은 절대 좌표로 계산했으므로 중심만 옮긴다
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
    // 회전된 평면의 로컬 z는 진행 방향의 반대 -> 뒤집지 않으면 면이 아래를 봐서 사라진다
    const v = -pos.getZ(i);
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
  // 글자가 길면 간판 폭(470px)에 맞춰 글씨를 줄인다
  let size = 62;
  while (size > 24 && ctx.measureText(text).width > 470) {
    size -= 2;
    ctx.font = 'bold ' + size + 'px "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
  }
  ctx.fillText(text, 256, sub ? 64 : 82);
  if (sub) {
    ctx.fillStyle = '#d9c9a0';
    ctx.font = 'bold 24px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
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
  const waterGlow = glowHalo(0x9fe0ff, 20, 0.08, 0.6);
  waterGlow.position.set(0, 34, 0);
  g.add(waterGlow);
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
  // 조명은 램프 유리(발광 재질)만으로 표현한다 — 점광원 · 후광 없이도 불빛으로 보인다
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
}

// 무기 · 갑옷 · 포션 상점 건물 + 상점 주인 NPC
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
    signMaterial('무기 · 갑옷 · 포션 상점', 'WEAPONS · ARMOR · POTIONS', 0x3f2712)
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
  const shopGlow = glowHalo(0xffcf8a, 18, 0.12, 0.9);
  shopGlow.position.set(0, 50, 30);
  g.add(shopGlow);

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
  const postX = -1735, postZ = 96;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 26, 7), postMat);
  post.position.set(postX, terrainHeight(postX, postZ) + 13, postZ);
  post.castShadow = true;
  scene.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 2), signMaterial('→ 쾌적한 숲', 'PLEASANT FOREST', 0x4a2e18));
  board.position.set(postX, terrainHeight(postX, postZ) + 26, postZ);
  scene.add(board);

  const shop = buildShop(scene);
  return { shop, fountain };
}

function buildBoundary(scene) {
  const rockMat = propMat(0x4a4741, { roughness: 1 });
  const edges = [
    // 태초마을 · 낡은 마을이 동 · 서로 이어지므로 z=±500 경계는 x=-2500 ~ 2500 이다
    { x0: -2500, z0: -500, x1: -500, z1: -500 },
    { x0: -2500, z0: 500, x1: -500, z1: 500 },
    { x0: -2500, z0: -500, x1: -2500, z1: 500 },
    { x0: -500, z0: -1500, x1: 500, z1: -1500 },
    { x0: -500, z0: -1500, x1: -500, z1: -500 },
    { x0: 500, z0: -1500, x1: 500, z1: -500 },
    { x0: 2500, z0: -500, x1: 2500, z1: 500 },
    { x0: 500, z0: -500, x1: 2500, z1: -500 },
    { x0: 500, z0: 500, x1: 2500, z1: 500 },
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

/* =====================================================================
   2번째 세계 — 고블린 숲 · 불길한 동굴 · 안개낀 평지 · 사쿠라 · 암흑지역
   모든 프롭은 인스턴싱으로 묶고, 조명은 발광 재질 + 가산 후광으로 대신한다.
   ===================================================================== */

// 평평한 원형 대지 (도착 광장 · 제단)
function flatPad(scene, x, z, radius, color, yOff) {
  return buildDisc(scene, x, z, radius, color, yOff);
}

/* ------------------------------ 고블린 숲 ------------------------------ */
function buildGoblinForest(scene) {
  const biome = BIOMES.goblin_forest;
  const W2 = WORLD2.originZ;
  const trunkMat = propMat(0x3c2f22, { roughness: 1 });
  const barkDark = propMat(0x2a2018, { roughness: 1 });
  const leafMat = propMat(0x24512f, { roughness: 0.95 });
  const leafMat2 = propMat(0x2f6a3a, { roughness: 0.95 });
  const mossMat = propMat(0x3f7a45, { roughness: 1 });

  // 비틀린 나무 — 줄기가 기울어 자란다
  const trees = scatter(9101, biome, 260, KEEP_OUTS.goblin_forest, { margin: 40, minScale: 0.85, maxScale: 1.7 });
  const trunkGeo = new THREE.CylinderGeometry(0.9, 1.9, 22, 6);
  const leafGeo = new THREE.IcosahedronGeometry(7.4, 1);
  buildInstancedSet(scene, [
    { geo: trunkGeo, mat: trunkMat, pos: [0, 11, 0], rot: [0.07, 0, 0.1], castShadow: true },
    { geo: trunkGeo, mat: barkDark, pos: [1.6, 15, 0.8], rot: [-0.18, 0, 0.24], scale: 0.6 },
    { geo: leafGeo, mat: leafMat, pos: [0, 24, 0], scale: [1.15, 0.8, 1.15], castShadow: true },
    { geo: leafGeo, mat: leafMat2, pos: [3.4, 21, -1.8], scale: 0.7 },
  ], trees);

  // 이끼 덮인 돌무더기
  const rocks = scatter(9102, biome, 110, KEEP_OUTS.goblin_forest, { margin: 40, minScale: 0.5, maxScale: 1.5 });
  buildInstancedSet(scene, [
    { geo: new THREE.DodecahedronGeometry(3.6, 0), mat: propMat(0x4a5a44, { roughness: 1 }), pos: [0, 1.8, 0], scale: [1.25, 0.65, 1.05], castShadow: true },
    { geo: new THREE.SphereGeometry(2.0, 8, 6), mat: mossMat, pos: [0.4, 1.0, 0.6], scale: [1.2, 0.4, 1.2] },
  ], rocks);

  // 독버섯 무리 — 갓만 옅게 빛난다
  const shrooms = scatter(9103, biome, 130, KEEP_OUTS.goblin_forest, { margin: 35, minScale: 0.6, maxScale: 1.5 });
  const stemMat = propMat(0xd8d2b4, { roughness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x9a4ad0, emissive: 0x5a1fa0, emissiveIntensity: 0.9, roughness: 0.5,
  });
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(0.5, 0.7, 3.2, 6), mat: stemMat, pos: [0, 1.6, 0] },
    { geo: new THREE.SphereGeometry(1.9, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), mat: capMat, pos: [0, 3.2, 0], scale: [1, 0.8, 1] },
  ], shrooms);

  // 뾰족 말뚝 · 해골 토템 (고블린 진영 표시)
  const totems = scatter(9104, biome, 26, KEEP_OUTS.goblin_forest, { margin: 90, minScale: 0.9, maxScale: 1.4 });
  const boneMat = propMat(0xd8cfae, { roughness: 0.8 });
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(0.8, 1.1, 16, 6), mat: barkDark, pos: [0, 8, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(2.0, 4.0, 2.4), mat: boneMat, pos: [0, 17, 0.2] },
    { geo: new THREE.ConeGeometry(0.6, 5.0, 4), mat: barkDark, pos: [1.6, 12, 0], rot: [0, 0, -0.5] },
  ], totems);

  // 풀더미 · 덩굴
  const grass = scatter(9105, biome, 700, null, { margin: 20, minScale: 0.7, maxScale: 1.7 });
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(1.3, 4.6, 4), mat: mossMat, pos: [0, 2.3, 0] },
  ], grass);

  // 도착 광장 — 길게 깔린 돌길과 울타리
  buildRoad(scene, 0, W2 + 1470, 0, W2 + 560, 46, 0x4a4436);
  flatPad(scene, 0, W2 + 1400, 150, 0x5c5647, 0.3);
  flatPad(scene, 0, W2 + 1400, 118, 0x6a6353, 0.42);
  // 도착 광장을 감싸는 횟불 기둥 한 쌍
  for (const sx of [-78, 78]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 34, 7), barkDark);
    pole.position.set(sx, terrainHeight(sx, W2 + 1300) + 17, W2 + 1300);
    pole.castShadow = true;
    scene.add(pole);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(3.4, 9, 7), new THREE.MeshBasicMaterial({ color: 0x8ad0ff }));
    flame.position.set(sx, terrainHeight(sx, W2 + 1300) + 36, W2 + 1300);
    scene.add(flame);
    const glow = glowHalo(0x7fc4ff, 14, 0.16);
    glow.position.copy(flame.position);
    scene.add(glow);
  }

  // 랜드마크: 고블린 토템
  const g = new THREE.Group();
  const tMat = propMat(0x33281d, { roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.4 - i * 0.4, 3.2 - i * 0.5, 26, 7), tMat);
    pole.position.set((i - 1) * 15, 13 + i, (i - 1) * 6);
    pole.rotation.z = (i - 1) * 0.06;
    pole.castShadow = true;
    g.add(pole);
  }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 9), boneMat);
  skull.position.set(0, 34, 0);
  skull.scale.set(1, 1.05, 1.1);
  skull.castShadow = true;
  g.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(10, 3.4, 7), boneMat);
  jaw.position.set(0, 28.6, 2.2);
  g.add(jaw);
  const tEye = new THREE.MeshBasicMaterial({ color: 0xff5a3c });
  for (const sx of [-3.4, 3.4]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(2.1, 9, 7), tEye);
    eye.position.set(sx, 35, 7.4);
    g.add(eye);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(1.1, 8, 4), boneMat);
    spike.position.set(Math.cos(a) * 12, 22, Math.sin(a) * 12);
    spike.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    g.add(spike);
  }
  const tGlow = glowHalo(0xff7a4a, 20, 0.12);
  tGlow.position.set(0, 34, 6);
  g.add(tGlow);
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  scene.add(g);

  return { totem: g, totemGlow: tGlow };
}

/* ------------------------------ 불길한 동굴 ------------------------------ */
function buildOminousCave(scene) {
  const biome = BIOMES.ominous_cave;
  const W2 = WORLD2.originZ;
  const rockMat = propMat(0x201a22, { roughness: 1 });
  const rockMat2 = propMat(0x2c2430, { roughness: 0.95 });
  const emberMat = new THREE.MeshStandardMaterial({ color: 0xff7a3c, emissive: 0xff4a14, emissiveIntensity: 1.8, roughness: 0.6 });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xb07aff, emissive: 0x7a2fd0, emissiveIntensity: 2.2, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.94,
  });
  const crystalMat2 = new THREE.MeshStandardMaterial({
    color: 0x6ad0ff, emissive: 0x2a8ad0, emissiveIntensity: 2.0, roughness: 0.25, transparent: true, opacity: 0.94,
  });

  // 뾰족한 흑암 기둥
  const spires = scatter(9201, biome, 170, KEEP_OUTS.ominous_cave, { margin: 30, minScale: 0.7, maxScale: 2.0 });
  const spireGeo = new THREE.ConeGeometry(4.2, 26, 5);
  buildInstancedSet(scene, [
    { geo: spireGeo, mat: rockMat, pos: [0, 13, 0], castShadow: true },
    { geo: new THREE.ConeGeometry(2.4, 14, 5), mat: rockMat2, pos: [3.4, 7, 2.2], scale: 0.9, castShadow: true },
    { geo: new THREE.ConeGeometry(1.8, 9, 5), mat: rockMat2, pos: [-3.2, 4.5, -2.4], scale: 0.8 },
  ], spires);

  // 천장에서 흘러내린 종유석 (뒤집힌 원뿔을 허공에)
  const stalactites = scatter(9202, biome, 120, KEEP_OUTS.ominous_cave, { margin: 40, minScale: 0.6, maxScale: 1.6 });
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(2.6, 16, 5), mat: rockMat, pos: [0, 40, 0], rot: [Math.PI, 0, 0] },
  ], stalactites);

  // 빛나는 수정 (보랏빛 · 푸른빛)
  const crystals = scatter(9203, biome, 90, KEEP_OUTS.ominous_cave, { margin: 45, minScale: 0.8, maxScale: 2.0 });
  const crystalGeo = new THREE.OctahedronGeometry(3.2, 0);
  buildInstancedSet(scene, [
    { geo: crystalGeo, mat: crystalMat, pos: [0, 4.4, 0], scale: [0.7, 1.6, 0.7], castShadow: true },
    { geo: crystalGeo, mat: crystalMat2, pos: [3.0, 2.6, 1.4], scale: [0.5, 1.1, 0.5], rot: [0, 0.6, 0.2] },
  ], crystals);

  // 갈라진 틈에서 새어 나온 용암 (지면에 붙은 발광 판)
  const lavaSpots = scatter(9204, biome, 60, KEEP_OUTS.ominous_cave, { margin: 60, minScale: 0.7, maxScale: 1.8 });
  buildInstancedSet(scene, [
    { geo: new THREE.CircleGeometry(6.4, 10), mat: emberMat, pos: [0, 0.6, 0], rot: [-Math.PI / 2, 0, 0] },
  ], lavaSpots);

  // 잿더미 · 검은 자갈
  const gravel = scatter(9205, biome, 420, null, { margin: 20, minScale: 0.6, maxScale: 1.6 });
  buildInstancedSet(scene, [
    { geo: new THREE.DodecahedronGeometry(1.6, 0), mat: propMat(0x1a151d, { roughness: 1 }), pos: [0, 0.6, 0], scale: [1.2, 0.6, 1.1] },
  ], gravel);

  // 랜드마크: 불타는 용광로 (거대한 용암 구명이)
  const g = new THREE.Group();
  const ringMat = propMat(0x2a222c, { roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const block = new THREE.Mesh(new THREE.BoxGeometry(18, 16 + Math.sin(i * 2.1) * 6, 14), ringMat);
    block.position.set(Math.cos(a) * 56, 8, Math.sin(a) * 56);
    block.rotation.y = -a;
    block.castShadow = true;
    g.add(block);
  }
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(48, 28),
    new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: 2.4, roughness: 0.3 })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 1.2;
  g.add(pool);
  const forgeGlow = glowHalo(0xff7a2a, 92, 0.12, 0.4);
  forgeGlow.position.y = 12;
  g.add(forgeGlow);
  // 용광로를 감싼 거대한 쇠사슬 기둥
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 76, 8), rockMat2);
    pillar.position.set(s * 90, 38, -40);
    pillar.castShadow = true;
    g.add(pillar);
  }
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  scene.add(g);

  return { forge: g, forgePool: pool, forgeGlow };
}

/* ------------------------------ 안개낀 평지 ------------------------------ */
function buildMistyPlains(scene) {
  const biome = BIOMES.misty_plains;
  const woodMat = propMat(0x4a4640, { roughness: 1 });
  const woodDark = propMat(0x2f2c28, { roughness: 1 });
  const stoneMat = propMat(0x8a8981, { roughness: 1 });
  const stoneDark = propMat(0x6a6963, { roughness: 1 });

  // 마른 나무
  const deadTrees = scatter(9301, biome, 90, KEEP_OUTS.misty_plains, { margin: 60, minScale: 0.8, maxScale: 1.7 });
  const branchGeo = new THREE.CylinderGeometry(0.3, 0.7, 9, 5);
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(0.8, 1.6, 20, 6), mat: woodMat, pos: [0, 10, 0], castShadow: true },
    { geo: branchGeo, mat: woodDark, pos: [3, 16, 0], rot: [0, 0, -0.95], castShadow: true },
    { geo: branchGeo, mat: woodDark, pos: [-2.6, 18, 1.2], rot: [0.2, 0, 1.0] },
    { geo: branchGeo, mat: woodDark, pos: [0.6, 15, -3], rot: [1.0, 0, 0.1] },
  ], deadTrees);

  // 무너진 석주 · 묘비
  const pillars = scatter(9302, biome, 70, KEEP_OUTS.misty_plains, { margin: 55, minScale: 0.7, maxScale: 1.6 });
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(3.4, 4.2, 26, 8), mat: stoneMat, pos: [0, 13, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(9, 2.4, 9), mat: stoneDark, pos: [0, 26.6, 0], castShadow: true },
  ], pillars);
  const brokenPillars = scatter(9303, biome, 46, KEEP_OUTS.misty_plains, { margin: 70, minScale: 0.8, maxScale: 1.5 });
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(3.2, 3.6, 12, 7), mat: stoneMat, pos: [0, 6, 0], rot: [0, 0, 0.34], castShadow: true },
  ], brokenPillars);
  const graves = scatter(9304, biome, 110, KEEP_OUTS.misty_plains, { margin: 50, minScale: 0.6, maxScale: 1.4 });
  buildInstancedSet(scene, [
    { geo: new THREE.BoxGeometry(4.2, 6.4, 1.2), mat: stoneMat, pos: [0, 2.8, 0], rot: [0, 0, 0.04], castShadow: true },
    { geo: new THREE.BoxGeometry(3.0, 1.0, 1.0), mat: stoneDark, pos: [0, 1.4, 0.2] },
  ], graves);

  // 마른 풀 · 재더미
  const grass = scatter(9305, biome, 620, null, { margin: 20, minScale: 0.6, maxScale: 1.6 });
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(1.0, 3.4, 3), mat: propMat(0x8f8b74, { roughness: 1 }), pos: [0, 1.7, 0] },
  ], grass);

  // 지면을 기는 안개 띠 (가까울수록 옅게 깔린다)
  const fogMat = new THREE.MeshBasicMaterial({ color: 0xdfe3e4, transparent: true, opacity: 0.07, depthWrite: false });
  const banks = scatter(9306, biome, 16, null, { margin: 110, minScale: 0.8, maxScale: 1.8 });
  for (const b of banks) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(96, 14, 10), fogMat);
    m.position.set(b.x, terrainHeight(b.x, b.z) + 12, b.z);
    m.scale.set(1, 0.15, 1);
    scene.add(m);
  }

  // 랜드마크: 부서진 석주 — 하늘을 향해 기울어진 거대 기둥
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(7 - i, 9 - i, 58 + i * 24, 9), i % 2 ? stoneMat : stoneDark);
    pillar.position.set((i - 1) * 26, (58 + i * 24) / 2, (i - 1) * 14);
    pillar.rotation.set((i - 1) * 0.05, 0, (i - 1) * -0.05);
    pillar.castShadow = true;
    g.add(pillar);
  }
  const capstone = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 40), stoneMat);
  capstone.position.set(0, 76, 0);
  capstone.rotation.set(0.06, 0.2, 0.1);
  capstone.castShadow = true;
  g.add(capstone);
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  scene.add(g);

  return { landmark: g };
}

/* -------------------------------- 사쿠라 -------------------------------- */
function buildSakura(scene) {
  const biome = BIOMES.sakura;
  const trunkMat = propMat(0x4a3230, { roughness: 1 });
  const barkDark = propMat(0x35221f, { roughness: 1 });
  const pinkA = propMat(0xf2adc4, { roughness: 0.9 });
  const pinkB = propMat(0xe58caa, { roughness: 0.9 });
  const pinkC = propMat(0xffe4ee, { roughness: 0.9 });
  const stoneMat = propMat(0xb0a89a, { roughness: 1 });

  // 벚나무 — 줄기 + 분홍 잎
  const trees = scatter(9401, biome, 300, KEEP_OUTS.sakura, { margin: 35, minScale: 0.85, maxScale: 1.6 });
  const trunkGeo = new THREE.CylinderGeometry(1.0, 1.9, 18, 6);
  const canopyGeo = new THREE.IcosahedronGeometry(7.2, 1);
  buildInstancedSet(scene, [
    { geo: trunkGeo, mat: trunkMat, pos: [0, 9, 0], rot: [0.06, 0, -0.08], castShadow: true },
    { geo: new THREE.CylinderGeometry(0.55, 0.9, 10, 5), mat: barkDark, pos: [2.2, 13, 0.8], rot: [0, 0, 0.6], castShadow: true },
    { geo: canopyGeo, mat: pinkA, pos: [0, 20, 0], scale: [1.2, 0.78, 1.2], castShadow: true },
    { geo: canopyGeo, mat: pinkB, pos: [3.6, 17, -2], scale: 0.72, castShadow: true },
    { geo: canopyGeo, mat: pinkC, pos: [-3.0, 21.5, 1.6], scale: 0.6 },
  ], trees);

  // 석등 (돌로 만든 등롱) — 불을 밝힌 창만 발광 재질
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xfff0c8, emissive: 0xffc46a, emissiveIntensity: 1.7, roughness: 0.5,
  });
  const lanterns = scatter(9402, biome, 44, KEEP_OUTS.sakura, { margin: 60, minScale: 0.9, maxScale: 1.3 });
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(1.6, 2.2, 12, 8), mat: stoneMat, pos: [0, 6, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(5.0, 4.2, 5.0), mat: stoneMat, pos: [0, 14, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(3.4, 3.0, 3.4), mat: lanternMat, pos: [0, 14, 0] },
    { geo: new THREE.ConeGeometry(4.4, 3.2, 4), mat: stoneMat, pos: [0, 17.6, 0], rot: [0, Math.PI / 4, 0] },
  ], lanterns);

  // 도리이 문 (붉은 기둥)
  const toriiMat = propMat(0xc0442f, { roughness: 0.85 });
  const toriiDark = propMat(0x7a2a1c, { roughness: 0.9 });
  const toriiSpots = [
    { x: 610, z: WORLD2.originZ }, { x: 1390, z: WORLD2.originZ },
    { x: 1000, z: WORLD2.originZ - 420 }, { x: 1000, z: WORLD2.originZ + 420 },
  ].map((p) => ({ x: p.x, z: p.z, y: terrainHeight(p.x, p.z), ry: (p.x === 1000 ? Math.PI / 2 : 0), s: 1 }));
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(2.0, 2.4, 34, 8), mat: toriiMat, pos: [-16, 17, 0], castShadow: true },
    { geo: new THREE.CylinderGeometry(2.0, 2.4, 34, 8), mat: toriiMat, pos: [16, 17, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(48, 2.6, 5), mat: toriiMat, pos: [0, 32, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(56, 2.0, 7), mat: toriiDark, pos: [0, 37, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(40, 1.6, 4), mat: toriiDark, pos: [0, 26, 0] },
  ], toriiSpots);

  // 바닥에 흩어진 꽃잎
  const petals = scatter(9403, biome, 520, null, { margin: 20, minScale: 0.5, maxScale: 1.2 });
  buildInstancedSet(scene, [
    { geo: new THREE.CircleGeometry(1.6, 6), mat: new THREE.MeshBasicMaterial({ color: 0xffcfe0, transparent: true, opacity: 0.72, depthWrite: false }), pos: [0, 0.45, 0], rot: [-Math.PI / 2, 0, 0] },
  ], petals);

  // 랜드마크: 천 년 벚나무
  const g = new THREE.Group();
  const bigTrunk = new THREE.Mesh(new THREE.CylinderGeometry(6, 11, 62, 9), trunkMat);
  bigTrunk.position.y = 31;
  bigTrunk.castShadow = true;
  g.add(bigTrunk);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.4, 26, 6), barkDark);
    limb.position.set(Math.cos(a) * 12, 46, Math.sin(a) * 12);
    limb.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    limb.castShadow = true;
    g.add(limb);
    const blossom = new THREE.Mesh(new THREE.IcosahedronGeometry(17, 1), i % 2 ? pinkA : pinkB);
    blossom.position.set(Math.cos(a) * 26, 58 + Math.sin(i) * 6, Math.sin(a) * 26);
    blossom.scale.set(1.1, 0.75, 1.1);
    blossom.castShadow = true;
    g.add(blossom);
  }
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(24, 1), pinkC);
  crown.position.y = 74;
  crown.scale.set(1.1, 0.7, 1.1);
  g.add(crown);
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  scene.add(g);

  // 떠다니는 꽃잎 (아주 옅은 한 덩어리 — updateWorld2 에서 천천히 돈다)
  const driftGeo = new THREE.BufferGeometry();
  const N = 90;
  const arr = new Float32Array(N * 3);
  const rnd = mulberry32(9411);
  for (let i = 0; i < N; i++) {
    arr[i * 3] = (rnd() - 0.5) * 620;
    arr[i * 3 + 1] = 12 + rnd() * 46;
    arr[i * 3 + 2] = (rnd() - 0.5) * 620;
  }
  driftGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const drift = new THREE.Points(driftGeo, new THREE.PointsMaterial({
    color: 0xffd0e2, size: 2.6, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true,
  }));
  drift.position.set(biome.center.x, terrainHeight(biome.center.x, biome.center.z), biome.center.z);
  drift.frustumCulled = true;
  scene.add(drift);

  return { landmark: g, drift };
}

/* ------------------------------ 암흑지역 ------------------------------ */
function buildDarkRealm(scene) {
  const biome = BIOMES.dark_realm;
  const W2 = WORLD2.originZ;
  const obsidian = propMat(0x191323, { roughness: 0.55, metalness: 0.35 });
  const obsidian2 = propMat(0x241b32, { roughness: 0.5, metalness: 0.4 });
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0xb07aff, emissive: 0x8a2fd0, emissiveIntensity: 2.4, roughness: 0.3, transparent: true, opacity: 0.9,
  });
  const crimsonMat = new THREE.MeshStandardMaterial({
    color: 0xff5a8a, emissive: 0xd01a5a, emissiveIntensity: 2.2, roughness: 0.3, transparent: true, opacity: 0.9,
  });

  // 흑요석 기둥 — 투기장을 둘러싼다
  const pillars = [];
  const rnd = mulberry32(9501);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + 0.08;
    const r = 300 + rnd() * 130;
    const x = Math.cos(a) * r;
    const z = W2 + Math.sin(a) * r;
    pillars.push({ x, z, y: terrainHeight(x, z), ry: a, s: 0.85 + rnd() * 0.6 });
  }
  buildInstancedSet(scene, [
    { geo: new THREE.CylinderGeometry(4.4, 6.0, 54, 6), mat: obsidian, pos: [0, 27, 0], castShadow: true },
    { geo: new THREE.ConeGeometry(5.6, 14, 6), mat: obsidian2, pos: [0, 61, 0], castShadow: true },
    { geo: new THREE.BoxGeometry(13, 2.6, 13), mat: obsidian2, pos: [0, 1.3, 0] },
  ], pillars);

  // 제단 둘레의 뾰족한 조각들
  const shards = scatter(9502, biome, 150, KEEP_OUTS.dark_realm, { margin: 40, minScale: 0.6, maxScale: 1.8 });
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(2.6, 18, 4), mat: obsidian2, pos: [0, 9, 0], rot: [0, 0, 0.12], castShadow: true },
    { geo: new THREE.ConeGeometry(1.4, 9, 4), mat: obsidian, pos: [3.2, 4.5, 1.6], rot: [0, 0.6, -0.2] },
  ], shards);

  // 바닥 룬 고리 (제단을 감싸는 두 겹)
  const arenaDisc = new THREE.Mesh(
    new THREE.CircleGeometry(300, 64),
    new THREE.MeshStandardMaterial({ color: 0x1d1629, roughness: 0.7, metalness: 0.25 })
  );
  arenaDisc.rotation.x = -Math.PI / 2;
  arenaDisc.position.set(0, terrainHeight(0, W2) + 0.35, W2);
  arenaDisc.receiveShadow = true;
  scene.add(arenaDisc);

  const runeRings = new THREE.Group();
  for (let k = 0; k < 2; k++) {
    const rr = 150 + k * 90;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 8), k === 0 ? runeMat : crimsonMat);
      m.position.set(Math.cos(a) * rr, 0.7, W2 + Math.sin(a) * rr);
      m.rotation.y = -a;
      runeRings.add(m);
    }
  }
  scene.add(runeRings);

  // 떠 있는 룬석
  const floaters = new THREE.Group();
  const rnd2 = mulberry32(9503);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 120 + rnd2() * 150;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(3.0, 0), i % 3 ? runeMat : crimsonMat);
    m.position.set(Math.cos(a) * r, 22 + rnd2() * 40, W2 + Math.sin(a) * r);
    floaters.add(m);
  }
  scene.add(floaters);

  // 랜드마크: 흑마법사의 제단
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(64 - i * 12, 70 - i * 12, 2.6, 28), i % 2 ? obsidian : obsidian2);
    step.position.y = i * 2.6 + 1.3;
    step.receiveShadow = true;
    g.add(step);
  }
  const altar = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 34), obsidian2);
  altar.position.y = 10.4 + 6;
  altar.castShadow = true;
  g.add(altar);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(6.2, 16, 12), runeMat);
  orb.position.y = 30;
  g.add(orb);
  const orbGlow = glowHalo(0xa46aff, 26, 0.16);
  orbGlow.position.y = 30;
  g.add(orbGlow);
  // 제단을 감싼 뾰족한 흑요석 조각
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(2.2, 16, 4), obsidian);
    spike.position.set(Math.cos(a) * 40, 14, Math.sin(a) * 40);
    spike.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
    g.add(spike);
  }
  g.position.set(biome.landmarkPos.x, terrainHeight(biome.landmarkPos.x, biome.landmarkPos.z), biome.landmarkPos.z);
  scene.add(g);

  return { landmark: g, orb, orbGlow, runeRings, floaters, arenaDisc };
}

/* --------------------- 2번째 세계 외곽 경계 암벽 --------------------- */
function buildWorld2Boundary(scene) {
  const rockMat = propMat(0x1e1a24, { roughness: 1 });
  const W2 = WORLD2.originZ;
  const edges = [
    { x0: -1500, z0: W2 + 500, x1: -500, z1: W2 + 500 },
    { x0: 500, z0: W2 + 500, x1: 1500, z1: W2 + 500 },
    { x0: -1500, z0: W2 - 500, x1: -500, z1: W2 - 500 },
    { x0: 500, z0: W2 - 500, x1: 1500, z1: W2 - 500 },
    { x0: -1500, z0: W2 - 500, x1: -1500, z1: W2 + 500 },
    { x0: 1500, z0: W2 - 500, x1: 1500, z1: W2 + 500 },
    { x0: -500, z0: W2 - 1500, x1: 500, z1: W2 - 1500 },
    { x0: -500, z0: W2 + 1500, x1: 500, z1: W2 + 1500 },
  ];
  const rnd = mulberry32(9601);
  const list = [];
  for (const e of edges) {
    const len = Math.hypot(e.x1 - e.x0, e.z1 - e.z0);
    const steps = Math.floor(len / 52);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jitter = (rnd() - 0.5) * 28;
      const nx = (e.z1 - e.z0) / len;
      const nz = -(e.x1 - e.x0) / len;
      const x = lerp(e.x0, e.x1, t) + nx * jitter;
      const z = lerp(e.z0, e.z1, t) + nz * jitter;
      list.push({ x, z, y: terrainHeight(x, z) + rnd() * 2, ry: rnd() * Math.PI * 2, s: 1.0 + rnd() * 1.7 });
    }
  }
  buildInstancedSet(scene, [
    { geo: new THREE.ConeGeometry(8, 26, 5), mat: rockMat, pos: [0, 10, 0], castShadow: true },
    { geo: new THREE.IcosahedronGeometry(6, 0), mat: rockMat, pos: [6, 4, 4], scale: 0.8 },
  ], list);
}

// 2번째 세계 전체를 조립한다 (바이옴 그룹별로 담아 컬링한다)
export function buildWorld2(scene, groups) {
  const out = {};
  out.goblinForest = buildGoblinForest(groups.goblin_forest);
  out.mistyPlains = buildMistyPlains(groups.misty_plains);
  out.sakura = buildSakura(groups.sakura);
  out.ominousCave = buildOminousCave(groups.ominous_cave);
  out.darkRealm = buildDarkRealm(groups.dark_realm);
  buildWorld2Boundary(groups.dark_realm);
  return out;
}

// 2번째 세계의 생동감: 벚꽃 · 룬 · 용광로 불빛
// (색은 바이옴별 거리 가중치로 어차피 섞이므로, 여기서는 확실히 가까울 때만 움직인다)
export function updateWorld2(world, dt, t, pos) {
  const w2 = world && world.world2;
  if (!w2) return;
  // 사쿠라: 꽃잎이 천천히 떠돈다
  if (w2.sakura && w2.sakura.drift) {
    const d = w2.sakura.drift;
    d.rotation.y += dt * 0.06;
    d.position.y += Math.sin(t * 0.6) * dt * 2.2;
  }
  // 암흑지역: 룬 고리가 돌고 룬석이 떠오른다
  if (w2.darkRealm) {
    const dr = w2.darkRealm;
    if (dr.runeRings) dr.runeRings.rotation.y += dt * 0.12;
    if (dr.floaters) dr.floaters.rotation.y -= dt * 0.08;
    if (dr.orb) {
      dr.orb.rotation.y += dt * 0.7;
      dr.orb.position.y = 30 + Math.sin(t * 1.5) * 2.2;
    }
    if (dr.orbGlow) dr.orbGlow.material.opacity = 0.13 + Math.sin(t * 2.1) * 0.05;
  }
  // 불길한 동굴: 용광로가 끓어오른다
  if (w2.ominousCave) {
    const oc = w2.ominousCave;
    if (oc.forgeGlow) oc.forgeGlow.material.opacity = 0.1 + Math.sin(t * 3.1) * 0.04;
    if (oc.forgePool && oc.forgePool.material) {
      oc.forgePool.material.emissiveIntensity = 2.2 + Math.sin(t * 2.4) * 0.6;
    }
  }
  // 고블린 숲: 토템 눈빛이 약하게 깜박인다
  if (w2.goblinForest && w2.goblinForest.totemGlow) {
    w2.goblinForest.totemGlow.material.opacity = 0.1 + Math.sin(t * 1.9) * 0.04;
  }
}

/* -------------------------------- 하늘 -------------------------------- */
function buildSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(0x7fb2d8) },
    bottomColor: { value: new THREE.Color(0xd9e6ee) },
    offset: { value: 120 },
    exponent: { value: 0.9 },
  };
  const geo = new THREE.SphereGeometry(1400, 24, 16);
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
  // 고화질은 1536 맵을 플레이어 주변 좁은 범위(±125)에 촘촘히 맞춰 그림자가 또렷하다
  const cfg = QUALITY.low ? SHADOW.low : SHADOW.high;
  sun.shadow.mapSize.set(cfg.mapSize, cfg.mapSize);
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = cfg.far;
  cam.left = -cfg.ext;
  cam.right = cfg.ext;
  cam.top = cfg.ext;
  cam.bottom = -cfg.ext;
  sun.shadow.bias = cfg.bias;
  sun.shadow.normalBias = cfg.normalBias;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x9fc4e8, 0.35);
  fill.position.set(150, 120, -140);
  scene.add(fill);

  return { sun, fill, hemi };
}

/* ------------------------------- 월드 ------------------------------- */
export function buildWorld(scene, opts) {
  const o = opts || {};
  QUALITY.low = !!o.low;
  QUALITY.propShadows = !QUALITY.low;
  QUALITY.groundSeg = QUALITY.low ? 52 : 78;
  QUALITY.shadowSets = [];

  scene.fog = new THREE.Fog(0xb5dbe4, 280, 1500);

  // 바이옴마다 하나의 그룹에 담는다 — 멀리 있는 바이옴은 통째로 visible=false 로 꺼서
  // 그리기 호출과 그림자 패스를 아예 건너뛴다 (아래 updateBiomeCulling).
  const biomeGroups = {};
  for (const id of ALL_BIOME_ORDER) {
    const g = new THREE.Group();
    g.name = 'biome-' + id;
    scene.add(g);
    biomeGroups[id] = g;
  }

  for (const id of ALL_BIOME_ORDER) buildGround(biomeGroups[id], BIOMES[id]);

  const village = buildVillage(biomeGroups.village);
  buildForest(biomeGroups.forest);
  buildGraveyard(biomeGroups.graveyard);
  buildSavanna(biomeGroups.savanna);
  const oldVillage = buildOldVillage(biomeGroups.old_village);
  buildJungle(biomeGroups.jungle);
  buildTemple(biomeGroups.temple);
  buildBoundary(scene);

  // 2번째 세계 — 처음에는 전부 멀리 있어 컬링으로 꺼지지만, 월드 자체는 미리 만들어 둔다
  const world2 = buildWorld2(scene, biomeGroups);

  const lights = buildLights(scene);
  const sky = buildSky(scene);

  return {
    sun: lights.sun,
    fill: lights.fill,
    hemi: lights.hemi,
    sky: sky.sky,
    skyUniforms: sky.uniforms,
    biomeGroups,
    village,
    oldVillage,
    world2,
  };
}

/* 바이옴 거리 컬링: 카메라(플레이어)에서 가장 가까운 바이옴 경계까지의 거리가
   잘림 거리(cut)보다 멀면 그 바이옴 그룹을 통째로 끈다.
   안개가 이미 덮는 거리에서만 끄므로 화면에서 사라지는 것이 보이지 않는다.
   (히스테리시스: 끄는 거리와 켜는 거리를 다르게 둬 경계에서 깜빡이지 않게) */
export function updateBiomeCulling(world, pos, cut) {
  const groups = world && world.biomeGroups;
  if (!groups || !pos) return;
  const hide = cut || 1280;
  const show = hide * 0.9;
  for (const id of ALL_BIOME_ORDER) {
    const g = groups[id];
    if (!g) continue;
    const b = BIOMES[id].bounds;
    const dx = pos.x < b.x0 ? b.x0 - pos.x : (pos.x > b.x1 ? pos.x - b.x1 : 0);
    const dz = pos.z < b.z0 ? b.z0 - pos.z : (pos.z > b.z1 ? pos.z - b.z1 : 0);
    const d = Math.hypot(dx, dz);
    if (g.visible) {
      if (d > hide) g.visible = false;
    } else if (d < show) {
      g.visible = true;
    }
  }
}

/* 낡은 마을의 생동감: 캠프파이어 불길 */
export function updateOldVillage(world, dt, t) {
  const ov = world && world.oldVillage;
  if (!ov || !ov.flame) return;
  ov.flame.scale.set(
    1 + Math.sin(t * 7.3) * 0.09,
    1 + Math.sin(t * 9.1) * 0.13,
    1 + Math.cos(t * 6.1) * 0.09
  );
  ov.flame.rotation.y += dt * 0.6;
  if (ov.flame.material) ov.flame.material.opacity = 0.68 + Math.sin(t * 11.3) * 0.14;
  // 후광도 불길처럼 밝아졌다 어두워진다 (점광원 없이 같은 느낌)
  if (ov.fireGlow && ov.fireGlow.material) {
    const k = 0.82 + Math.sin(t * 8.4) * 0.16 + Math.sin(t * 17.1) * 0.05;
    ov.fireGlow.material.opacity = ov.fireGlow.userData.baseOpacity * k;
  }
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
