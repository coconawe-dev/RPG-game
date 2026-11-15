// 몹: 슬라임 · 좀비 · 하이에나 · 고릴라 · 고대 골렘(보스) + AI
import * as THREE from 'three';
import { BIOMES, BIOME_ORDER, MOB_TYPES, BOSS_POS } from './config.js';
import { terrainHeight, clamp, damp, dampAngle, rand, TAU, lerp, WORLD } from './utils.js';

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
  armL.position.set(3.0, 12.5, 0);
  armR.position.set(-3.0, 12.5, 0);
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
  const coreLight = new THREE.PointLight(0x6fe0ff, 900, 420, 2);
  coreLight.position.set(0, 34, 12);
  body.add(coreLight);

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
  return { root, body, head, armL, armR, legL, legR, core, coreMat, coreHalo, mats, height: 56 };
}

const BUILDERS = { slime: buildSlime, zombie: buildZombie, hyena: buildHyena, gorilla: buildGorilla, golem: buildGolem };

/* -------------------------------- 몹 -------------------------------- */
export class Mob {
  constructor(game, typeId, pos, biomeId) {
    this.game = game;
    this.typeId = typeId;
    this.type = MOB_TYPES[typeId];
    this.biomeId = biomeId;
    this.maxHp = this.type.hp;
    this.hp = this.maxHp;
    this.level = this.type.boss ? 20 : Math.max(1, Math.round(this.type.hp / 40));
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

    // 멀티플레이: netId 가 있으면 호스트 권한 몹, remote=true 면 친구 화면에서 보는 미러
    this.netId = undefined;
    this.remote = false;
    this.targetPos = this.position.clone();
    this.remoteChase = false;
    this.remoteAtk = 0;
    this.lastSeen = 0;
    this.targetRef = null;

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
    if (this.type.boss) {
      this.game.onBossDefeated();
    } else {
      this.respawnT = rand(22, 38);
    }
  }

  respawn() {
    const b = BIOMES[this.biomeId].bounds;
    const p = this.game.player.position;
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
    if (this.type.boss) this.stompCd = Math.max(0, this.stompCd - dt);

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

    if (this.attackT > 0) {
      // 공격 모션 진행
      this.attackT -= dt;
      const prog = 1 - this.attackT / this.attackDur;
      if (!this.attackHit && prog >= 0.52) {
        this.attackHit = true;
        this.resolveAttack(dist);
      }
      speedMul = 0.1;
    } else if (this.aggro && target.alive) {
      if (dist > this.type.attackRange * 0.92) {
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

    // 태초마을은 안전 지대 — 몬스터는 마을로 들어오지 않는다
    if (this.biomeId !== 'village' && this.position.x < -1492) this.position.x = -1492;

    // 지형 · 경계
    this.position.x = clamp(this.position.x, WORLD.xMin + 10, WORLD.xMax - 10);
    this.position.z = clamp(this.position.z, WORLD.zMin + 10, WORLD.zMax - 10);
    this.position.y = terrainHeight(this.position.x, this.position.z);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;

    this.animate(dt, dist);
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
    this.attackCd = this.type.attackCooldown * rand(0.9, 1.15);
    if (this.type.boss) this.game.sfx.boss();
  }

  resolveAttack(dist) {
    const target = this.targetRef;
    if (!target || !target.alive) return;
    const reach = this.type.attackRange + (target.radius || 4.6);
    if (dist > reach) return;
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
    } else if (this.typeId === 'golem') {
      const s = Math.sin(this.walkPhase * 0.55);
      m.legL.rotation.x = s * 0.32;
      m.legR.rotation.x = -s * 0.32;
      m.body.position.y = Math.abs(Math.sin(this.walkPhase * 0.55)) * 1.2;
      const swing = atkP >= 0 ? Math.sin(clamp(atkP, 0, 1) * Math.PI) : 0;
      // 오른팔 들어 내려찍기
      m.armR.rotation.x = -2.2 * swing;
      m.armR.rotation.z = -0.1 - swing * 0.15;
      m.armL.rotation.x = -0.3 * swing;
      m.body.rotation.x = swing * 0.12;
      m.head.rotation.x = -swing * 0.12;
      const pulse = 1 + Math.sin(t * 3) * 0.08;
      m.core.scale.setScalar(pulse * (1 + swing * 0.25));
      m.coreHalo.scale.setScalar(pulse * 1.1 + swing * 0.3);
      if (hurt > 0) m.body.rotation.z = Math.sin(hurt * 22) * 0.05;
      else m.body.rotation.z = 0;
      // 체력 40% 이하 격노
      if (this.hp < this.maxHp * 0.4) {
        m.coreMat.color.setHex(0xffb0a0);
        m.coreMat.emissive.setHex(0xff5a3c);
      }
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
    this.animate(dt, near);
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
    this.spawnAll();
  }

  spawnAll() {
    for (const id of BIOME_ORDER) {
      const biome = BIOMES[id];
      const typeId = biome.mob;
      if (!typeId || !MOB_TYPES[typeId] || !biome.mobCount) continue; // 태초마을: 평화 지대
      if (MOB_TYPES[typeId].boss) {
        this.spawn(typeId, BOSS_POS, id);
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
    for (let i = 0; i < this.mobs.length; i++) {
      const m = this.mobs[i];
      if (m.remote) m.updateRemote(dt);
      else m.update(dt);
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

  // 모든 몹을 장면에서 제거한다 (멀티플레이 전환 · 복귀용)
  clearAll() {
    for (const m of this.mobs) {
      if (m.root) this.game.scene.remove(m.root);
    }
    this.mobs.length = 0;
  }

  resetAggro() {
    for (const m of this.mobs) {
      m.aggro = false;
      m.attackT = 0;
      m.state = 'idle';
    }
  }
}
