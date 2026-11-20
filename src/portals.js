// 포털: 고대 골렘을 쓰러뜨리면 열리는 '2번째 세계 포털' 과,
// 2번째 세계 도착 광장의 '1번째 세계 귀환 포털'.
//  · 걸어 들어가거나(자동) [F] / 화면의 안내를 누르면 이동한다.
//  · 이동 직후에는 바로 되돌아가지 않도록 잠시 잠근다 (armed).
import * as THREE from 'three';
import {
  BIOMES, WORLD2, WORLD3, WORLD2_ARRIVAL, WORLD1_PORTAL_POS, WORLD2_RETURN_POS,
  WORLD2_PORTAL_POS, WORLD3_ARRIVAL, WORLD3_RETURN_POS, GUEST_SPAWN,
} from './config.js';
import { terrainHeight, clamp, worldAt, normWorld } from './utils.js';

const PORTAL_RADIUS = 120;       // 안내가 뜨는 거리
const ENTER_RADIUS = 46;         // 걸어 들어가면 바로 넘어가는 거리
const REARM_DIST = 210;          // 이만큼 멀어지면 다시 쓸 수 있다

function portalLabelTexture(text, sub) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext && c.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 512, 160);
  ctx.fillStyle = 'rgba(12,8,22,0.72)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(6, 6, 500, 148, 26);
  else ctx.rect(6, 6, 500, 148);
  ctx.fill();
  ctx.strokeStyle = 'rgba(196,150,255,0.85)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#f3e6ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 58;
  ctx.font = 'bold ' + size + 'px "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
  while (size > 26 && ctx.measureText(text).width > 460) {
    size -= 2;
    ctx.font = 'bold ' + size + 'px "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
  }
  ctx.fillText(text, 256, sub ? 66 : 82);
  if (sub) {
    ctx.fillStyle = 'rgba(226,206,255,0.85)';
    ctx.font = 'bold 26px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.fillText(sub, 256, 122);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class Portal {
  constructor(game, def) {
    this.game = game;
    this.id = def.id;
    this.label = def.label || '포털';
    this.sub = def.sub || '';
    this.color = def.color === undefined ? 0xa46aff : def.color;
    this.target = def.target;          // { world, x, z, yaw }
    this.radius = def.radius || PORTAL_RADIUS;
    this.enterRadius = def.enterRadius || ENTER_RADIUS;
    this.x = def.x;
    this.z = def.z;
    this.group = new THREE.Group();
    this.group.position.set(def.x, terrainHeight(def.x, def.z), def.z);
    this.group.visible = !!def.open;
    this.open = !!def.open;
    this.armed = false;
    this.build();
    game.scene.add(this.group);
  }

  build() {
    const color = this.color;
    const g = this.group;

    // 바닥의 빛나는 원
    const discGeo = new THREE.CircleGeometry(46, 40);
    discGeo.rotateX(-Math.PI / 2);
    this.disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.disc.position.y = 0.5;
    g.add(this.disc);

    // 서 있는 고리 (문)
    const ringGeo = new THREE.TorusGeometry(40, 3.4, 8, 40);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.2,
    }));
    this.ring.position.y = 44;
    g.add(this.ring);

    // 고리 안쪽의 소용돌이 막
    const veilGeo = new THREE.CircleGeometry(38, 36);
    this.veil = new THREE.Mesh(veilGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    this.veil.position.y = 44;
    g.add(this.veil);

    // 빛기둥
    const beamGeo = new THREE.CylinderGeometry(44, 52, 150, 18, 1, true);
    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    this.beam.position.y = 75;
    g.add(this.beam);

    // 떠 있는 작은 룬들
    this.runes = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5.4, 0.8), new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 1.6, roughness: 0.4,
      }));
      m.position.set(Math.cos(a) * 52, 30 + (i % 3) * 14, Math.sin(a) * 52);
      m.rotation.y = -a;
      this.runes.add(m);
    }
    g.add(this.runes);

    // 이름표 (항상 플레이어 쪽을 본다)
    const tex = portalLabelTexture(this.label, this.sub);
    if (tex) {
      this.labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
      }));
      this.labelSprite.scale.set(96, 30, 1);
      this.labelSprite.position.y = 118;
      g.add(this.labelSprite);
    }
  }

  setOpen(open) {
    this.open = !!open;
    this.group.visible = !!open;
    if (!open) this.armed = false;
  }

  distTo(pos) {
    return Math.hypot(pos.x - this.x, pos.z - this.z);
  }

  update(dt, t, pos) {
    if (!this.open) return null;
    // 소용돌이 · 룬 회전
    this.ring.rotation.z += dt * 0.35;
    this.veil.rotation.z -= dt * 0.5;
    this.disc.material.opacity = 0.24 + Math.sin(t * 2.2) * 0.08;
    this.beam.material.opacity = 0.07 + Math.sin(t * 1.7) * 0.03;
    this.veil.material.opacity = 0.3 + Math.sin(t * 2.6) * 0.08;
    this.runes.rotation.y += dt * 0.4;
    if (this.labelSprite) {
      this.labelSprite.position.y = 118 + Math.sin(t * 1.5) * 3.2;
      if (this.game.camera) this.labelSprite.material.rotation = 0;
    }
    if (!pos) return null;

    const d = this.distTo(pos);
    if (!this.armed && d > REARM_DIST) this.armed = true;
    if (d <= this.enterRadius && this.armed) {
      return { near: true, enter: true };
    }
    if (d <= this.radius) return { near: true, enter: false };
    return this.armed ? null : { near: false, enter: false };
  }
}

export class Portals {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.current = null;      // 안내가 뜨는 포털
    this.cooldown = 0;
    this.build();
  }

  build() {
    // 1) 고대 골렘을 쓰러뜨리면 열리는 2번째 세계 포털 (정글 사원 제단 앞)
    //    도착지는 2세계 태초마을 광장 — 몬스터가 없는 안전 지대다
    this.world2Portal = new Portal(this.game, {
      id: 'world2',
      label: '2번째 세계 포털',
      sub: 'ENTER THE SECOND WORLD',
      color: 0xa46aff,
      x: WORLD1_PORTAL_POS.x,
      z: WORLD1_PORTAL_POS.z,
      open: false,
      target: {
        world: 2,
        x: WORLD2_ARRIVAL.x,
        z: WORLD2_ARRIVAL.z,
        yaw: 0,               // 광장 남쪽(2세계 대장간)을 바라본다
      },
    });
    this.list.push(this.world2Portal);

    // 2) 2세계 태초마을 광장의 귀환 포털
    this.returnPortal = new Portal(this.game, {
      id: 'return',
      label: '1번째 세계 귀환 포털',
      sub: 'RETURN TO THE JUNGLE TEMPLE',
      color: 0x6fd8ff,
      x: WORLD2_RETURN_POS.x,
      z: WORLD2_RETURN_POS.z,
      open: true,
      target: { world: 1, x: 0, z: 330, yaw: Math.PI },
    });
    this.list.push(this.returnPortal);

    // 3) 흑마법사를 쓰러뜨리면 열리는 3번째 세계 포털 (암흑지역 제단 뒤)
    //    도착지는 3세계 태초마을 광장 — 몬스터가 없는 안전 지대다
    this.world3Portal = new Portal(this.game, {
      id: 'world3',
      label: '3번째 세계 포털',
      sub: 'ENTER THE THIRD WORLD',
      color: 0x4fffa8,
      x: WORLD2_PORTAL_POS.x,
      z: WORLD2_PORTAL_POS.z,
      open: false,
      target: {
        world: 3,
        x: WORLD3_ARRIVAL.x,
        z: WORLD3_ARRIVAL.z,
        yaw: Math.PI,               // 광장 남쪽(3세계 상점)을 바라본다
      },
    });
    this.list.push(this.world3Portal);

    // 4) 3세계 태초마을 광장의 2번째 세계 귀환 포털
    this.returnPortalW3 = new Portal(this.game, {
      id: 'return_w3',
      label: '2번째 세계 귀환 포털',
      sub: 'RETURN TO THE DARK REALM',
      color: 0x6fd8ff,
      x: WORLD3_RETURN_POS.x,
      z: WORLD3_RETURN_POS.z,
      open: true,
      target: { world: 2, x: 0, z: WORLD2.originZ + 1880, yaw: Math.PI },
    });
    this.list.push(this.returnPortalW3);
  }

  // 흑마법사 처치 → 3번째 세계 포털 개방
  openWorld3() {
    if (this.world3Portal.open) return false;
    this.world3Portal.setOpen(true);
    const p = this.world3Portal.group.position;
    if (this.game.effects) {
      this.game.effects.ring(new THREE.Vector3(p.x, p.y + 2, p.z), 0x4fffa8, 220, { duration: 1.5, thickness: 0.03 });
      this.game.effects.burst(new THREE.Vector3(p.x, p.y + 40, p.z), 0x4fffa8, 32, { power: 52, size: 1.8 });
    }
    this.game.world3Unlocked = true;
    if (this.game.mobManager) this.game.mobManager.ensureWorld(3);
    return true;
  }

  // 고대 골렘 처치 → 포털 개방
  openWorld2() {
    if (this.world2Portal.open) return false;
    this.world2Portal.setOpen(true);
    const g = this.world2Portal.group;
    const p = g.position;
    if (this.game.effects) {
      this.game.effects.ring(new THREE.Vector3(p.x, p.y + 2, p.z), 0xa46aff, 220, { duration: 1.5, thickness: 0.03 });
      this.game.effects.burst(new THREE.Vector3(p.x, p.y + 40, p.z), 0xa46aff, 32, { power: 52, size: 1.8 });
    }
    this.game.world2Unlocked = true;
    if (this.game.mobManager) this.game.mobManager.ensureWorld(2);
    return true;
  }

  // 매 프레임: 안내 대상 · 자동 진입 판정
  update(dt, t) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    const p = this.game.player;
    const pos = p && p.alive ? p.position : null;
    let near = null;
    for (const portal of this.list) {
      const r = portal.update(dt, t, pos);
      if (!r) continue;
      if (r.near) near = portal;
      if (r.enter && this.cooldown <= 0 && this.game.state === 'playing') {
        this.enter(portal);
        return;
      }
    }
    this.current = near;
    return near;
  }

  // [F] · 화면의 안내를 누를 때
  enterNearest() {
    const p = this.current;
    if (!p || this.cooldown > 0) return false;
    return this.enter(p);
  }

  enter(portal) {
    if (!portal || !portal.open) return false;
    const target = portal.target;
    const moved = this.game.travelTo
      ? this.game.travelTo(target)
      : null;
    this.cooldown = 1.6;
    portal.armed = false;
    this.current = null;
    return moved !== false;
  }
}

/* -------------------- 보스 처치 처리 (두 세계 공통) -------------------- */
// 고대 골렘 → 2번째 세계 포털이 열리고 탐험은 계속된다.
// 흑마법사  → 축하 승리 화면(계속 탐험하기로 이어갈 수 있다).
export function handleBossDefeated(game, boss) {
  const typeId = boss && (boss.typeId || (boss.type && boss.type.id));
  if (typeId === 'dark_mage') {
    if (game.hud) game.hud.banner('흑마법사를 쓰러뜨렸습니다! 3번째 세계로 가는 포털이 열렸습니다', 4200);
    if (game.sfx) game.sfx.victory();
    if (game.shake) game.shake(1.2);
    if (game.effects && boss) {
      game.effects.ring(
        new THREE.Vector3(boss.position.x, boss.position.y + 2, boss.position.z),
        0xd8a0ff, 360, { duration: 1.8, thickness: 0.02 }
      );
      game.effects.burst(
        new THREE.Vector3(boss.position.x, boss.position.y + 40, boss.position.z),
        0xd8a0ff, 40, { power: 70, size: 2.2 }
      );
    }
    // 흑마법사를 쓰러뜨리면 3번째 세계 포털이 열린다 (축하 화면은 그대로 보여 준다)
    if (game.portals) game.portals.openWorld3();
    game.victoryKind = 'world2';
    if (game.victoryTimer !== undefined) game.victoryTimer = 3.4;
    return 'victory';
  }

  // 3번째 세계 최종 보스 강하닭 → 세상을 모두 구한 진짜 엔딩
  if (typeId === 'strong_chicken') {
    if (game.hud) game.hud.banner('거대 강하닭을 쓰러뜨렸습니다! 세 세계가 모두 평화를 되찾았습니다', 5000);
    if (game.sfx) game.sfx.victory();
    if (game.shake) game.shake(1.4);
    if (game.effects && boss) {
      game.effects.ring(
        new THREE.Vector3(boss.position.x, boss.position.y + 2, boss.position.z),
        0xffd24a, 420, { duration: 2.0, thickness: 0.02 }
      );
      game.effects.burst(
        new THREE.Vector3(boss.position.x, boss.position.y + 50, boss.position.z),
        0xffe08a, 56, { power: 82, size: 2.6 }
      );
    }
    game.victoryKind = 'world3';
    if (game.victoryTimer !== undefined) game.victoryTimer = 3.8;
    return 'victory';
  }

  // 그 외 보스 = 고대 골렘
  if (game.hud) {
    game.hud.banner('고대 골렘을 쓰러뜨렸습니다! 2번째 세계로 가는 포털이 열렸습니다', 4200);
  }
  if (game.sfx) game.sfx.victory();
  if (game.shake) game.shake(1.1);
  if (game.effects && boss) {
    game.effects.ring(
      new THREE.Vector3(boss.position.x, boss.position.y + 2, boss.position.z),
      0xffe1a3, 320, { duration: 1.6, thickness: 0.02 }
    );
  }
  if (game.portals) game.portals.openWorld2();
  return 'portal';
}

/* --------------------------- 이동 위치 계산 --------------------------- */
// 포털을 타고 다른 세계로 간다 — 체력 · 경험치는 그대로 두고 자리만 옮긴다.
// (main.js 의 Game.travelTo 가 이 함수를 부른다 — 테스트에서도 그대로 쓸 수 있게 따로 두었다)
export function travelPlayer(game, target) {
  const p = game && game.player;
  if (!p || !target) return false;
  const hp = p.hp;
  const xp = p.xp;
  const world = target.world !== undefined ? normWorld(target.world) : worldAt(target.x, target.z);
  p.spawnAt(target.x, target.z);
  p.hp = Math.min(p.maxHp, Math.max(1, hp));
  p.xp = xp;
  p.invuln = 2.6;             // 도착 직후 잠깐은 공격받지 않는다
  const yaw = target.yaw === undefined ? Math.PI : target.yaw;
  p.facing = yaw;
  p.root.rotation.y = yaw;
  if (game.setWorld) game.setWorld(world, { silent: true });
  else game.worldId = world;
  game.camYaw = yaw - Math.PI;
  game.camPitch = 0.2;
  game.shakeAmt = 0;
  if (game.placeCamera) game.placeCamera(true);
  game.nearPortal = false;
  if (game.setPortalPrompt) game.setPortalPrompt(null);

  const region = regionOf(p.position.x, p.position.z);
  const worldName = world === 3 ? WORLD3.name : (world === 2 ? WORLD2.name : '1번째 세계');
  const regionName = region && BIOMES[region] ? BIOMES[region].name : '';
  if (game.hud) {
    game.hud.banner(worldName + ' · ' + regionName, 2800);
    game.hud.lastRegion = region;
    if (game.hud.refreshBars) game.hud.refreshBars();
  }
  if (game.effects) {
    game.effects.ring(new THREE.Vector3(p.position.x, p.position.y + 2, p.position.z), 0xa46aff, 150, { duration: 1.1, thickness: 0.03 });
    game.effects.burst(new THREE.Vector3(p.position.x, p.position.y + 10, p.position.z), 0xa46aff, 26, { power: 34, size: 1.2 });
  }
  if (game.sfx) game.sfx.gate();
  if (game.net && game.net.active) {
    // 초대받은 사람의 시작 자리는 1세계 태초마을 그대로 둔다 (호스트가 따라 옮기지 않는다)
    if (game.net.isHost) game.net.spawn = { x: GUEST_SPAWN.x, z: GUEST_SPAWN.z };
    if (game.net.isGuest) game.net._sendLocalState();
  }
  return true;
}

// 좌표가 속한 지역 (포털 파일 안에서 쓰는 작은 도우미)
function regionOf(x, z) {
  for (const id in BIOMES) {
    const b = BIOMES[id].bounds;
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return id;
  }
  return null;
}
