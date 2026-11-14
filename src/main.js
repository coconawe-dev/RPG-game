// 게임 진입점: 렌더러 · 월드 · 입력 · 카메라 · 상태 관리
import * as THREE from 'three';
import { BIOMES, BIOME_ORDER, CLASSES, PLAYER_SIZE } from './config.js';
import { buildWorld, updateSun } from './world.js';
import { Player } from './player.js';
import { MobManager } from './mobs.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';
import { Sfx } from './audio.js';
import { castSkill } from './skills.js';
import { terrainHeight, clamp, damp, lerp, biomeWeights, regionAt } from './utils.js';

class Game {
  constructor() {
    this.state = 'menu';
    this.timers = [];
    this.input = {
      forward: false, back: false, left: false, right: false,
      sprint: false, jump: false,
    };
    this.camYaw = -Math.PI / 2;
    this.camPitch = 0.26;
    this.camDist = 56;
    this.shakeAmt = 0;
    this.playTime = 0;
    this.elapsed = 0;
    this.player = null;
    this.victoryTimer = -1;
    this.deathTimer = -1;
    this.pointerLockBroken = false;
    this.dragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.biomeCenters = {};
    this.biomeColors = {};
    for (const id of BIOME_ORDER) {
      const b = BIOMES[id];
      this.biomeCenters[id] = b.center;
      this.biomeColors[id] = {
        sky: new THREE.Color(b.sky),
        fog: new THREE.Color(b.fog),
        sun: new THREE.Color(b.sun),
        hemiSky: new THREE.Color(b.hemiSky),
        hemiGround: new THREE.Color(b.hemiGround),
        fogNear: b.fogNear,
        fogFar: b.fogFar,
      };
    }
  }

  init() {
    const canvas = document.getElementById('scene');
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      const el = document.getElementById('loader');
      if (el) el.innerHTML = '<p>이 브라우저에서 WebGL을 사용할 수 없습니다.</p>';
      throw err;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 6000);
    this.camera.position.set(-1050, 70, 160);

    this.world = buildWorld(this.scene);
    this.effects = new Effects(this.scene);
    this.combat = new Combat(this);
    this.mobManager = new MobManager(this);
    this.hud = new HUD(this);
    this.sfx = new Sfx();

    this.bindInput();
    this.resize();

    this.clock = new THREE.Clock();
    this.last = 0;
    this.frames = 0;
    this.firstFrameDone = false;

    document.getElementById('end-primary').addEventListener('click', () => this.onEndPrimary());
    document.getElementById('end-restart').addEventListener('click', () => window.location.reload());

    // 디버그/검증용
    window.__GAME__ = this;

    requestAnimationFrame((t) => this.tick(t));
  }

  /* ------------------------------- 입력 ------------------------------- */
  bindInput() {
    const canvas = this.renderer.domElement;

    window.addEventListener('keydown', (e) => {
      const k = e.key ? e.key.toLowerCase() : '';
      if (k === 'w' || k === 'arrowup') { this.input.forward = true; }
      if (k === 's' || k === 'arrowdown') { this.input.back = true; }
      if (k === 'a' || k === 'arrowleft') { this.input.left = true; }
      if (k === 'd' || k === 'arrowright') { this.input.right = true; }
      if (k === 'shift') this.input.sprint = true;
      if (e.code === 'Space') { this.input.jump = true; e.preventDefault(); }
      if (k === 'j' || k === 'f') { if (this.state === 'playing' && this.player) this.player.attack(); }
      if (k === 'q') { if (this.state === 'playing' && this.player) this.player.useSkill('q'); }
      if (k === 'e') { if (this.state === 'playing' && this.player) this.player.useSkill('e'); }
      if (k === 'escape' && document.exitPointerLock) document.exitPointerLock();
      if (k === '1' || k === '2' || k === '3' || k === '4' || k === '5') {
        if (this.state === 'menu') {
          const order = ['warrior', 'archer', 'rogue', 'tanker', 'mage'];
          const idx = parseInt(k, 10) - 1;
          if (order[idx]) this.startClass(order[idx]);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key ? e.key.toLowerCase() : '';
      if (k === 'w' || k === 'arrowup') this.input.forward = false;
      if (k === 's' || k === 'arrowdown') this.input.back = false;
      if (k === 'a' || k === 'arrowleft') this.input.left = false;
      if (k === 'd' || k === 'arrowright') this.input.right = false;
      if (k === 'shift') this.input.sprint = false;
    });

    window.addEventListener('blur', () => {
      this.input.forward = false;
      this.input.back = false;
      this.input.left = false;
      this.input.right = false;
      this.input.sprint = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      if (document.pointerLockElement === canvas) {
        if (e.button === 0 && this.player) this.player.attack();
        return;
      }
      if (this.pointerLockBroken) {
        if (e.button === 0 && this.player) this.player.attack();
        return;
      }
      this.dragging = true;
      this.lastPointer.x = e.clientX;
      this.lastPointer.y = e.clientY;
      const req = canvas.requestPointerLock ? canvas.requestPointerLock() : null;
      if (req && req.catch) req.catch(() => { this.pointerLockBroken = true; });
      if (!canvas.requestPointerLock) this.pointerLockBroken = true;
    });

    window.addEventListener('mouseup', () => { this.dragging = false; });

    window.addEventListener('mousemove', (e) => {
      const canvasEl = this.renderer.domElement;
      if (document.pointerLockElement === canvasEl) {
        this.camYaw -= e.movementX * 0.0023;
        this.camPitch = clamp(this.camPitch + e.movementY * 0.0019, -0.32, 0.95);
      } else if (this.dragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer.x = e.clientX;
        this.lastPointer.y = e.clientY;
        this.camYaw -= dx * 0.004;
        this.camPitch = clamp(this.camPitch + dy * 0.003, -0.32, 0.95);
      }
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.renderer.domElement;
      if (this.hud) this.hud.setCrosshair(locked);
      if (!locked) this.dragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      this.camDist = clamp(this.camDist + e.deltaY * 0.045, 26, 110);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ------------------------------ 게임 시작 ------------------------------ */
  startClass(classId) {
    if (!CLASSES[classId]) return;
    if (this.player) {
      this.scene.remove(this.player.root);
      this.combat.clear();
      this.effects.clear();
    }
    this.player = new Player(this, classId);
    const spawn = BIOMES.forest.spawn;
    this.player.spawnAt(spawn.x, spawn.z);
    this.camYaw = -Math.PI / 2 + 0.25;
    this.camPitch = 0.22;
    this.camDist = 56;
    this.focused = true;
    this.state = 'playing';
    this.playTime = 0;
    this.victoryTimer = -1;
    this.deathTimer = -1;
    this.hud.onStart(this.player);
    this.hud.hideEnd();
    this.sfx.init();
    this.hud.banner(CLASSES[classId].name + ' · ' + BIOMES.forest.name, 2400);
    this.placeCamera(true);
    const canvas = this.renderer.domElement;
    if (canvas.requestPointerLock && !this.pointerLockBroken) {
      const req = canvas.requestPointerLock();
      if (req && req.catch) req.catch(() => { this.pointerLockBroken = true; });
    }
    this.sfx.magic();
  }

  resetRun() {
    if (!this.player) return;
    const spawn = BIOMES.forest.spawn;
    this.player.spawnAt(spawn.x, spawn.z);
    this.player.hp = this.player.maxHp;
    this.mobManager.resetAggro();
    this.hud.hideEnd();
    this.hud.refreshBars();
    this.state = 'playing';
    this.deathTimer = -1;
  }

  onEndPrimary() {
    if (this.state === 'dead') this.resetRun();
    else {
      this.hud.hideEnd();
      this.state = 'playing';
    }
  }

  /* ------------------------------- 이벤트 ------------------------------- */
  after(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  shake(amount) {
    this.shakeAmt = Math.min(1.4, Math.max(this.shakeAmt, amount));
  }

  terrainHeightAt(x, z) { return terrainHeight(x, z); }

  castSkill(key) { return castSkill(this, key); }

  onBossEngage(boss) {
    this.sfx.boss();
    this.shake(0.9);
    this.hud.banner('고대 골렘 · 정글 사원의 주인', 2600);
    this.effects.ring(new THREE.Vector3(boss.position.x, boss.position.y + 1, boss.position.z), 0x9fe8ff, 220, { duration: 1.1, thickness: 0.03 });
  }

  onBossDefeated() {
    this.hud.banner('고대 골렘을 쓰러뜨렸습니다!', 3200);
    this.sfx.victory();
    this.shake(1.1);
    const boss = this.mobManager.boss();
    if (boss) {
      this.effects.ring(new THREE.Vector3(boss.position.x, boss.position.y + 2, boss.position.z), 0xffe1a3, 320, { duration: 1.6, thickness: 0.02 });
    }
    this.victoryTimer = 2.6;
  }

  onPlayerDeath() {
    this.deathTimer = 1.9;
    this.hud.banner('쓰러졌습니다…', 1800);
  }

  /* ------------------------------- 루프 ------------------------------- */
  tick(now) {
    requestAnimationFrame((t) => this.tick(t));
    const dtRaw = this.last ? (now - this.last) / 1000 : 0.016;
    this.last = now;
    const dt = clamp(dtRaw, 0, 0.05);
    this.elapsed += dt;

    this.step(dt);

    this.renderer.render(this.scene, this.camera);
    this.frames++;
    if (!this.firstFrameDone) {
      this.firstFrameDone = true;
      this.hud.hideLoader();
    }
  }

  step(dt) {
    // 지연 실행 타이머
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(i, 1);
        try { tm.fn(); } catch (err) { console.warn(err); }
      }
    }

    if (this.state === 'menu') {
      this.updateMenuCamera(dt);
      this.effects.update(dt);
      return;
    }

    if (this.state === 'playing') this.playTime += dt;

    const p = this.player;
    if (!p) return;

    if (this.state !== 'dead') {
      p.update(dt, this.input);
      this.mobManager.update(dt);
      this.combat.update(dt);
      this.effects.update(dt);
    }

    this.placeCamera(false, dt);
    this.updateEnvironment(dt);
    this.hud.update(dt);

    // 타이머 상태 전환
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.state = 'dead';
        this.deathTimer = -1;
        this.hud.showEnd('defeat', this.buildStats());
      }
    }
    if (this.victoryTimer > 0) {
      this.victoryTimer -= dt;
      if (this.victoryTimer <= 0) {
        this.victoryTimer = -1;
        this.state = 'victory';
        this.hud.showEnd('victory', this.buildStats());
      }
    }
  }

  buildStats() {
    const p = this.player;
    const mins = Math.floor(this.playTime / 60);
    const secs = Math.floor(this.playTime % 60);
    return [
      [CLASSES[p.classId].name, '선택 직업'],
      ['Lv.' + p.level, '최종 레벨'],
      [String(p.kills), '처치한 몬스터'],
      [mins + '분 ' + String(secs).padStart(2, '0') + '초', '탐험 시간'],
    ];
  }

  /* ------------------------------ 카메라 ------------------------------ */
  updateMenuCamera(dt) {
    const t = this.elapsed;
    const spawn = BIOMES.forest.spawn;
    const r = 170;
    const x = spawn.x + Math.cos(t * 0.12) * r;
    const z = spawn.z + Math.sin(t * 0.12) * r;
    const y = terrainHeight(x, z) + 95;
    this.camera.position.lerp(new THREE.Vector3(x, y, z), 1 - Math.exp(-1.2 * dt));
    this.camera.lookAt(spawn.x, 18, spawn.z);
    updateSun(this.world, new THREE.Vector3(spawn.x, 0, spawn.z), this.camera);
    this.updateEnvironment(dt, new THREE.Vector3(spawn.x, 0, spawn.z));
  }

  placeCamera(instant, dt) {
    if (!this.player) return;
    const p = this.player;
    const target = new THREE.Vector3(p.position.x, p.position.y + 16, p.position.z);
    const dir = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch)
    );
    const desired = target.clone().addScaledVector(dir, this.camDist);
    const minY = terrainHeight(desired.x, desired.z) + 7;
    if (desired.y < minY) desired.y = minY;

    if (instant) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 1 - Math.exp(-13 * (dt || 0.016)));

    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt;
      this.camera.position.x += (Math.random() - 0.5) * s * 4.2;
      this.camera.position.y += (Math.random() - 0.5) * s * 3.2;
      this.camera.position.z += (Math.random() - 0.5) * s * 4.2;
      this.shakeAmt *= Math.exp(-6 * (dt || 0.016));
    }

    const f = p.forward();
    this.camera.lookAt(target.x + f.x * 10, target.y - 1.5, target.z + f.z * 10);
    updateSun(this.world, p.position, this.camera);
  }

  /* ---------------------------- 환경 전환 ---------------------------- */
  updateEnvironment(dt, atPos) {
    const pos = atPos || (this.player ? this.player.position : new THREE.Vector3(-1000, 0, 0));
    const w = biomeWeights(pos.x, pos.z, this.biomeCenters);
    let fogR = 0, fogG = 0, fogB = 0;
    let skyR = 0, skyG = 0, skyB = 0;
    let sunR = 0, sunG = 0, sunB = 0;
    let hsR = 0, hsG = 0, hsB = 0;
    let hgR = 0, hgG = 0, hgB = 0;
    let near = 0, far = 0, sunI = 0, hemiI = 0;

    for (const id of BIOME_ORDER) {
      const k = w[id] || 0;
      if (k <= 0.0001) continue;
      const c = this.biomeColors[id];
      fogR += c.fog.r * k; fogG += c.fog.g * k; fogB += c.fog.b * k;
      skyR += c.sky.r * k; skyG += c.sky.g * k; skyB += c.sky.b * k;
      sunR += c.sun.r * k; sunG += c.sun.g * k; sunB += c.sun.b * k;
      hsR += c.hemiSky.r * k; hsG += c.hemiSky.g * k; hsB += c.hemiSky.b * k;
      hgR += c.hemiGround.r * k; hgG += c.hemiGround.g * k; hgB += c.hemiGround.b * k;
      near += c.fogNear * k; far += c.fogFar * k;
      sunI += BIOMES[id].sunIntensity * k;
      hemiI += BIOMES[id].hemiIntensity * k;
    }

    const fogColor = new THREE.Color(fogR, fogG, fogB);
    const skyColor = new THREE.Color(skyR, skyG, skyB);
    const sunColor = new THREE.Color(sunR, sunG, sunB);
    const hemiSky = new THREE.Color(hsR, hsG, hsB);
    const hemiGround = new THREE.Color(hgR, hgG, hgB);

    if (this.scene.fog) {
      this.scene.fog.color.lerp(fogColor, 1 - Math.exp(-2.5 * dt));
      this.scene.fog.near = lerp(this.scene.fog.near, near, 1 - Math.exp(-2.5 * dt));
      this.scene.fog.far = lerp(this.scene.fog.far, far, 1 - Math.exp(-2.5 * dt));
    }
    if (this.world.skyUniforms) {
      this.world.skyUniforms.topColor.value.lerp(skyColor, 1 - Math.exp(-2.5 * dt));
      this.world.skyUniforms.bottomColor.value.lerp(fogColor, 1 - Math.exp(-2.5 * dt));
    }
    this.world.sun.color.lerp(sunColor, 1 - Math.exp(-2.5 * dt));
    this.world.sun.intensity = lerp(this.world.sun.intensity, sunI, 1 - Math.exp(-2.5 * dt));
    this.world.hemi.color.lerp(hemiSky, 1 - Math.exp(-2.5 * dt));
    this.world.hemi.groundColor.lerp(hemiGround, 1 - Math.exp(-2.5 * dt));
    this.world.hemi.intensity = lerp(this.world.hemi.intensity, hemiI, 1 - Math.exp(-2.5 * dt));

    this.regionId = regionAt(pos.x, pos.z);
  }

  /* ------------------------------ 디버그 ------------------------------ */
  debugInfo() {
    return {
      state: this.state,
      frames: this.frames,
      drawCalls: this.renderer ? this.renderer.info.render.calls : 0,
      triangles: this.renderer ? this.renderer.info.render.triangles : 0,
      mobs: this.mobManager ? this.mobManager.mobs.length : 0,
      aliveMobs: this.mobManager ? this.mobManager.mobs.filter((m) => !m.dead).length : 0,
      bossHp: this.mobManager && this.mobManager.boss() ? this.mobManager.boss().hp : null,
      player: this.player ? {
        classId: this.player.classId, hp: Math.round(this.player.hp), level: this.player.level,
        x: Math.round(this.player.position.x), z: Math.round(this.player.position.z),
        anim: this.player.anim.name,
      } : null,
      region: this.regionId || null,
      errors: this.errors || [],
    };
  }
}

const game = new Game();
window.addEventListener('error', (e) => {
  if (!game.errors) game.errors = [];
  game.errors.push(String(e.message));
});

try {
  game.init();
} catch (err) {
  console.error(err);
  if (!game.errors) game.errors = [];
  game.errors.push(String(err && err.message ? err.message : err));
  const loader = document.getElementById('loader');
  if (loader) loader.innerHTML = '<p style="max-width:420px;text-align:center">게임을 불러오지 못했습니다.<br><br>' + String(err && err.message ? err.message : err) + '</p>';
}
