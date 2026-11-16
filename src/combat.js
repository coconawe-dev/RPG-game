// 전투: 근접 판정, 투사체(화살/마력 구체), 폭발 피해
import * as THREE from 'three';
import { clamp, rand } from './utils.js';

const ARROW_MAT = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.8 });
const ARROW_HEAD = new THREE.MeshStandardMaterial({ color: 0xd7dde2, roughness: 0.3, metalness: 0.8 });
const FLETCH = new THREE.MeshStandardMaterial({ color: 0xe8e2cf, roughness: 0.9 });

function makeArrowMesh() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.2, 5), ARROW_MAT);
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 5), ARROW_HEAD);
  head.rotation.x = Math.PI / 2;
  head.position.z = 3.0;
  g.add(head);
  for (const a of [0, Math.PI / 2]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.2), FLETCH);
    f.position.z = -2.2;
    f.rotation.z = a;
    g.add(f);
  }
  return g;
}

function makeOrbMesh(color, size) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(size, 14, 10),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.4, roughness: 0.2 })
  );
  g.add(core);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(size * 1.7, 12, 9),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  g.add(halo);
  return g;
}

/* ------------------------------------------------------------------
   몹 피격 판정 (실린더)
   · 바닥: 몹 발밑(y = 몹 위치) · 천장: hitHeight(없으면 몸 높이의 1.05배)
   · 슬라임처럼 납작한 몹은 hitHeight 로 위쪽 판정을 넓혀 둘 수 있다
     (config.js MOB_TYPES.slime.hitHeight = 20)
------------------------------------------------------------------ */
function hitTop(mob) {
  const h = mob.hitHeight !== undefined ? mob.hitHeight : (mob.height || 12) * 1.05;
  return mob.position.y + h;
}
function hitBottom(mob) { return mob.position.y; }

// 이동 구간(prev → next)이 몹의 피격 실린더를 스치는지
// 원거리 투사체가 한 프레임에 몹을 지나쳐 버리는(터널링) 경우까지 잡아낸다.
function segmentHitsMob(prev, next, mob, projectileRadius) {
  const r = (mob.radius || 6) + (projectileRadius || 2);
  const ax = prev.x, az = prev.z;
  const dx = next.x - ax, dz = next.z - az;
  const len2 = dx * dx + dz * dz;
  let t = 0;
  if (len2 > 1e-8) {
    t = clamp(((mob.position.x - ax) * dx + (mob.position.z - az) * dz) / len2, 0, 1);
  }
  const cx = ax + dx * t, cz = az + dz * t;
  const dist = Math.hypot(mob.position.x - cx, mob.position.z - cz);
  if (dist > r) return false;
  // 가장 가까워진 지점의 높이가 실린더(±투사체 반경) 안이어야 한다
  const y = prev.y + (next.y - prev.y) * t;
  return y >= hitBottom(mob) - r && y <= hitTop(mob) + r;
}

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
  }

  /* --------------------------- 데미지 적용 --------------------------- */
  applyDamage(mob, amount, opts) {
    const o = opts || {};
    const net = this.game.net;
    // 게스트: 피해 계산을 호스트에게 맡긴다 (호스트 권한)
    if (net && net.active && net.isGuest) {
      return net.requestDamage(mob, amount, o);
    }
    const crit = Math.random() < (o.critChance || 0);
    const dmg = amount * (crit ? (o.critMul || 1.9) : 1) * rand(0.94, 1.06);
    mob.takeDamage(dmg, {
      crit,
      dir: o.dir,
      knock: o.knock,
    });
    return dmg;
  }

  /* ---------------------------- 근접 공격 ---------------------------- */
  melee(player, dir, range, arc, damage, opts) {
    const o = opts || {};
    const origin = player.position;
    const yaw = Math.atan2(dir.x, dir.z);
    const hits = [];
    const mobs = this.game.mobManager.mobs;
    for (const mob of mobs) {
      if (mob.dead) continue;
      const dx = mob.position.x - origin.x;
      const dz = mob.position.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range + mob.radius) continue;
      const ang = Math.abs(((Math.atan2(dx, dz) - yaw + Math.PI) % (Math.PI * 2)) - Math.PI);
      if (ang > arc / 2) continue;
      hits.push(mob);
    }
    const color = o.color || (player.classId === 'tanker' ? 0x9fd8ff : player.classId === 'rogue' ? 0xc7a6ff : 0xffe1a3);
    this.game.effects.slash(
      new THREE.Vector3(origin.x, origin.y, origin.z), yaw, range,
      o.arcVisual || Math.max(arc, 0.9), color,
      { duration: 0.28, yOffset: player.classId === 'rogue' ? 9 : 11, sweep: o.swingFrom ? 0.6 : -0.6, opacity: 0.5 }
    );
    if (player.classId === 'tanker') {
      this.game.effects.burst(new THREE.Vector3(origin.x + dir.x * range * 0.6, origin.y + 8, origin.z + dir.z * range * 0.6), 0xbfe4ff, 8, { power: 14, size: 0.5 });
      this.game.shake(0.16);
    }
    for (const mob of hits) {
      const kdir = new THREE.Vector3(mob.position.x - origin.x, 0, mob.position.z - origin.z).normalize();
      const knock = player.classId === 'tanker' ? 16 : player.classId === 'rogue' ? 3 : 8;
      this.applyDamage(mob, damage, {
        critChance: player.critChance === undefined ? player.cls.critChance : player.critChance, dir: kdir, knock,
      });
      this.game.effects.burst(new THREE.Vector3(mob.position.x, mob.position.y + mob.height * 0.6, mob.position.z), 0xffd9a0, 6, { power: 16, size: 0.5, duration: 0.4 });
    }
    return hits.length;
  }

  /* ---------------------------- 투사체 ---------------------------- */
  fireArrow(player, dir, opts) {
    const o = opts || {};
    const start = new THREE.Vector3(player.position.x, player.position.y + 14, player.position.z);
    start.addScaledVector(dir, 6);
    const mesh = makeArrowMesh();
    mesh.position.copy(start);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    mesh.quaternion.copy(q);
    this.game.scene.add(mesh);
    const proj = {
      mesh, pos: start.clone(), vel: dir.clone().normalize().multiplyScalar(o.speed || 420),
      damage: o.damage || 10, life: (o.range || 340) / (o.speed || 420),
      radius: 3, splash: o.splash || 0, kind: 'arrow',
      critChance: o.critChance || 0, critMul: o.critMul || 1.9, pierce: o.pierce || 0,
      trail: 0,
    };
    this.projectiles.push(proj);
    return proj;
  }

  fireOrb(player, dir, opts) {
    const o = opts || {};
    const start = new THREE.Vector3(player.position.x, player.position.y + 15, player.position.z);
    start.addScaledVector(dir, 8);
    const color = o.color || 0xb98cff;
    const mesh = makeOrbMesh(color, o.size || 2.2);
    mesh.position.copy(start);
    this.game.scene.add(mesh);
    const proj = {
      mesh, pos: start.clone(), vel: dir.clone().normalize().multiplyScalar(o.speed || 260),
      damage: o.damage || 12, life: (o.range || 320) / (o.speed || 260),
      radius: o.size || 2.2, splash: o.splash || 34, kind: 'orb',
      critChance: o.critChance || 0, critMul: o.critMul || 1.9,
    };
    this.projectiles.push(proj);
    this.game.sfx.orb();
    return proj;
  }

  /* 지정 위치에서 임의 방향으로 화살 발사 (멀티샷/화살비) */
  spawnArrowFrom(pos, dir, opts) {
    const o = opts || {};
    const mesh = makeArrowMesh();
    mesh.position.copy(pos);
    mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()));
    this.game.scene.add(mesh);
    const speed = o.speed || 420;
    this.projectiles.push({
      mesh, pos: pos.clone(), vel: dir.clone().normalize().multiplyScalar(speed),
      damage: o.damage || 10, life: (o.range || 320) / speed, radius: 3,
      splash: o.splash || 0, kind: 'arrow', critChance: o.critChance || 0, critMul: 1.9,
      fall: o.fall || 0, vy: o.vy || 0,
    });
  }

  /* 폭발 (즉시 범위 피해) */
  explode(pos, radius, damage, opts) {
    const o = opts || {};
    const hits = this.game.mobManager.inRadius(pos, radius);
    for (const mob of hits) {
      const d = new THREE.Vector3(mob.position.x - pos.x, 0, mob.position.z - pos.z);
      const dist = Math.max(1, d.length());
      const falloff = clamp(1 - (dist / radius) * 0.55, 0.35, 1);
      this.applyDamage(mob, damage * falloff, {
        critChance: o.critChance || 0,
        dir: d.normalize(),
        knock: o.knock || 10,
      });
    }
    const color = o.color || 0xffb15c;
    this.game.effects.ring(pos, color, radius * 1.05, { duration: 0.55, thickness: 0.05 });
    this.game.effects.burst(new THREE.Vector3(pos.x, pos.y + 8, pos.z), color, o.particles || 26, { power: radius * 0.75, size: 1.6 });
    this.game.effects.flash(pos, color, 700, 480, 0.4);
    if (o.shake !== 0) this.game.shake(o.shake || 0.45);
    if (o.freeze) {
      for (const mob of this.game.mobManager.inRadius(pos, radius * 1.15)) {
        mob.attackT = Math.max(mob.attackT, 0.35);
      }
    }
    return hits.length;
  }

  update(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const prev = p.prev || (p.prev = new THREE.Vector3());
      prev.copy(p.pos);
      if (p.fall) p.vy -= 90 * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.fall) p.pos.y += p.vy * dt;
      p.mesh.position.copy(p.pos);

      let remove = false;
      const mobs = this.game.mobManager.mobs;
      for (const mob of mobs) {
        if (mob.dead) continue;
        if (!segmentHitsMob(prev, p.pos, mob, p.radius)) continue;
        const dx = mob.position.x - p.pos.x;
        const dz = mob.position.z - p.pos.z;
        const dir = new THREE.Vector3(dx, 0, dz).normalize();
        if (p.splash > 0) {
          this.explode(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), p.splash, p.damage, {
            color: p.kind === 'orb' ? 0xb98cff : 0xffb15c, critChance: p.critChance, knock: 12,
          });
        } else {
          this.applyDamage(mob, p.damage, { critChance: p.critChance, critMul: p.critMul, dir, knock: 6 });
          this.game.effects.burst(p.pos, 0xffe0a8, 5, { power: 12, size: 0.4, duration: 0.35 });
        }
        if (p.pierce > 0) { p.pierce--; } else { remove = true; }
        break;
      }
      // 지면 충돌
      if (p.fall && p.pos.y <= this.game.terrainHeightAt(p.pos.x, p.pos.z) + 1) {
        this.explode(new THREE.Vector3(p.pos.x, p.pos.y + 2, p.pos.z), p.splash || 26, p.damage, {
          color: 0xffd08a, critChance: p.critChance, shake: 0.2,
        });
        remove = true;
      }
      if (p.life <= 0) {
        if (p.splash > 0) {
          this.explode(new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z), p.splash, p.damage, {
            color: p.kind === 'orb' ? 0xb98cff : 0xffb15c, critChance: p.critChance, shake: 0.2,
          });
        }
        remove = true;
      }
      if (remove) {
        this.game.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.projectiles) this.game.scene.remove(p.mesh);
    this.projectiles.length = 0;
  }
}
