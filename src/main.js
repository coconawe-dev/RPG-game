// 게임 진입점: 렌더러 · 월드 · 입력 · 카메라 · 상태 관리
import * as THREE from 'three';
import {
  BIOMES, BIOME_ORDER, ALL_BIOME_ORDER, CLASSES, PLAYER_SIZE, START_GOLD, WORLD2, WORLD2_ARRIVAL,
  SHOP, shopForBiome, homeBiomeFor,
} from './config.js';
import { buildWorld, updateSun, updateVillage, updateOldVillage, updateWorld2, updateBiomeCulling, applyWorldQuality } from './world.js';
import { Portals, handleBossDefeated, travelPlayer } from './portals.js';
import { Player } from './player.js';
import { MobManager } from './mobs.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';
import { Sfx } from './audio.js';
import { castSkill } from './skills.js';
import { Shop } from './shop.js';
import {
  Net, normalizeRoomCode, isValidRoomCode, playerListForHud, MAX_PLAYERS,
} from './net.js';
import { terrainHeight, clamp, damp, lerp, biomeWeights, regionAt, worldAt } from './utils.js';

// 터치 목록에서 identifier가 같은 손가락을 찾는다.
// (멀티터치에서 손가락마다 다른 일을 시키기 위한 추적용 — 조이스틱과 시점 회전이 서로를 방해하지 않게 한다)
function findTouchById(list, id) {
  if (!list || id === null || id === undefined) return null;
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].identifier === id) return list[i];
  }
  return null;
}

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
    this.gold = START_GOLD;
    // 어느 세계에 있는지 (1 | 2) · 고대 골렘을 잡으면 2번째 세계가 열린다
    this.worldId = 1;
    this.world2Unlocked = false;
    this.nearPortal = false;
    this.portals = null;
    this.victoryKind = null;
    this.mpMode = 'solo';
    this.nick = '';
    this.net = null;
    this.pendingStart = null;
    this._roomAcc = 0;
    this.nearShop = false;
    this.victoryTimer = -1;
    this.deathTimer = -1;
    this.pointerLockBroken = false;
    this.dragging = false;
    this.mouseDragging = false;
    this.mouseDragMoved = 0;
    this.mouseDragAt = 0;
    this._look = null;
    this.lastPointer = { x: 0, y: 0 };
    this.biomeCenters = {};
    this.biomeColors = {};
    // 화면 품질: 'high' | 'low' — 기본은 모든 기기에서 고화질('high')이다
    this.quality = 'high';
    this.qualityLevel = 0;      // 0 = 기본, 1·2 = 프레임이 느릴 때의 자동 하향 단계
    this.pixelRatio = 1;
    this._perf = { frames: 0, acc: 0, low: 0, samples: 0 };
    this._cullAcc = 0;
    this._tmp = {
      vecA: new THREE.Vector3(),
      vecB: new THREE.Vector3(),
      colorA: new THREE.Color(),
      colorB: new THREE.Color(),
      colorC: new THREE.Color(),
      colorD: new THREE.Color(),
      colorE: new THREE.Color(),
    };
    for (const id of ALL_BIOME_ORDER) {
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
    // 렌더러를 만들기 전에 터치 기기인지 · 어떤 품질로 시작할지 정한다
    this.isTouch = this.detectTouch();
    this.quality = this.chooseQuality();
    this.pixelRatio = this.targetPixelRatio();
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: this.quality === 'high', // 고화질은 계단 현상을 없앤다 (컨텍스트를 만들 때만 정할 수 있다)
        powerPreference: 'high-performance',
        stencil: false,
      });
    } catch (err) {
      const el = document.getElementById('loader');
      if (el) el.innerHTML = '<p>이 브라우저에서 WebGL을 사용할 수 없습니다.</p>';
      throw err;
    }
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    // 안개 너머까지 그리지 않는다 — 바이옴 컬링 거리(≈1280)를 덮는 정도면 충분하다
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.8, 1900);
    this.camera.position.set(-1050, 70, 160);

    this.world = buildWorld(this.scene, { low: this.quality === 'low' });
    this.portals = new Portals(this);
    this.effects = new Effects(this.scene);
    if (this.quality === 'low') this.effects.maxParticles = 24;
    this.combat = new Combat(this);
    this.mobManager = new MobManager(this);
    if (this.quality === 'low') {
      this.mobManager.cullRadius = 680;
      this.mobManager.animRadius = 380;
    }
    // 시작 화면부터 먼 몹을 꺼 둔다 (첫 프레임부터 가볍게)
    this.mobManager.cullByDistance(BIOMES.village.spawn);
    this.hud = new HUD(this);
    this.sfx = new Sfx();
    this.shop = new Shop(this);
    this.net = new Net(this);

    this.bindInput();
    this.bindTouch();
    this.bindQualityToggle();
    this.setupMultiplayer();
    this.resize();

    // 디버그용: ?class=warrior&biome=temple 로 바로 시작, ?x=&z= 로 위치 지정, ?world=2 로 2번째 세계부터
    const qp = new URLSearchParams(window.location.search);
    this.startBiome = qp.get('biome');
    this.autoClass = qp.get('class');
    const qw = parseInt(qp.get('world'), 10);
    this.startWorld = qw === 2 ? 2 : 1;
    const qx = parseFloat(qp.get('x'));
    const qz = parseFloat(qp.get('z'));
    // 점검용: 인위적으로 프레임을 느리게 만들어 자동 화질 하향을 시험한다 (?perfdelay=800)
    this.perfDelay = parseFloat(qp.get('perfdelay')) || 0;
    this.debugSpawn = (isFinite(qx) && isFinite(qz)) ? { x: qx, z: qz } : null;
    if (this.autoClass && CLASSES[this.autoClass]) {
      // ?room= 초대 링크로 들어왔으면 혼자 모드로 새지 않게 한다
      const inviteRoom = normalizeRoomCode(qp.get('room') || '');
      const mp = qp.get('mp');
      const nick = qp.get('nick');
      if (nick && this.mpDom && this.mpDom.nick) this.mpDom.nick.value = nick.slice(0, 10);
      if (mp === 'host' || mp === 'join') {
        // 점검/공유용: ?mp=host / ?mp=join&room=CODE 로 바로 방을 열거나 참가한다
        if (this.mpSetMode) this.mpSetMode(mp);
        if (mp === 'join' && inviteRoom && this.mpDom.code) this.mpDom.code.value = inviteRoom;
        setTimeout(() => this.requestStart(this.autoClass), 500);
      } else if (!inviteRoom) {
        setTimeout(() => this.startClass(this.autoClass), 350);
      }
    }

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

  /* ---------------------------- 화면 품질 ---------------------------- */
  // 휴대폰 · iPad 판단 (iPadOS Safari 는 데스크톱처럼 보고하므로 터치 지원 여부로 본다)
  detectTouch() {
    const qp = new URLSearchParams(window.location.search);
    const force = qp.get('touch');
    if (force === '1') return true;
    if (force === '0') return false;
    const coarse = (navigator.maxTouchPoints > 0)
      || ('ontouchstart' in window)
      || !!(window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
    return !!coarse;
  }

  // ?quality=low|high 로 강제 · 없으면 지난번 선택(localStorage) · 그것도 없으면 고화질
  chooseQuality() {
    const forced = (new URLSearchParams(window.location.search).get('quality') || '').toLowerCase();
    if (forced === 'low' || forced === 'high') return forced;
    const saved = this.readQualityPreference();
    if (saved === 'low' || saved === 'high') return saved;
    // 휴대폰 · iPad 도 기본은 고화질이다 (Retina 화면에서 선명하게)
    return 'high';
  }

  // 화면 배율 — 점검용으로 ?dpr=3 처럼 Retina 화면을 흔내볼 수 있다
  effectiveDpr() {
    const forced = parseFloat(new URLSearchParams(window.location.search).get('dpr'));
    if (isFinite(forced) && forced > 0) return forced;
    return window.devicePixelRatio || 1;
  }

  readQualityPreference() {
    try {
      return window.localStorage ? window.localStorage.getItem('rpg.quality') : null;
    } catch (err) {
      return null;   // 시크릿 모드 등 저장소를 막아 둔 브라우저
    }
  }

  saveQualityPreference(quality) {
    try {
      if (window.localStorage) window.localStorage.setItem('rpg.quality', quality);
    } catch (err) { /* 저장할 수 없으면 이번 세션에만 적용된다 */ }
  }

  targetPixelRatio() {
    const dpr = this.effectiveDpr();
    if (this.quality === 'low') {
      if (this.qualityLevel >= 2) return 1;
      if (this.qualityLevel === 1) return Math.min(dpr, 1.1);
      return Math.min(dpr, 1.25);
    }
    if (this.qualityLevel >= 2) return Math.min(dpr, 1.5);
    if (this.qualityLevel === 1) return Math.min(dpr, 1.75);
    return Math.min(dpr, 2);
  }

  // 렉이 계속되면 단계적으로만 내린다 (0 → 1 → 2). 고화질에서는 해상도만 살짝 낮춘다.
  applyQualityLevel(level) {
    if (!this.renderer) return;
    const next = Math.max(this.qualityLevel, Math.min(2, level));
    if (next === this.qualityLevel) return;
    this.qualityLevel = next;
    const pr = this.targetPixelRatio();
    if (pr !== this.pixelRatio) {
      this.pixelRatio = pr;
      this.renderer.setPixelRatio(pr);
    }
    if (this.quality === 'low' && this.mobManager) {
      this.mobManager.cullRadius = next >= 1 ? 620 : 680;
      this.mobManager.animRadius = next >= 1 ? 340 : 380;
    }
  }

  // 화면 품질 토글: 'high' = ✨ 고화질 / 'low' = ⚡ 성능 우선
  // 게임 중에도 바로 반영되고, 고른 값은 localStorage 에 남겨 다음 접속에 이어 쓴다.
  setQuality(quality, opts) {
    const q = quality === 'low' ? 'low' : 'high';
    this.quality = q;
    this.qualityLevel = 0;
    this._perf.low = 0;
    this.pixelRatio = this.targetPixelRatio();
    if (this.renderer) {
      this.renderer.setPixelRatio(this.pixelRatio);
      const type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      if (this.renderer.shadowMap.type !== type) {
        this.renderer.shadowMap.type = type;
        // 그림자 종류는 셰이더에 박히므로 재질을 다시 컴파일하게 한다 (토글할 때만)
        this.refreshMaterials();
      }
      this.renderer.shadowMap.needsUpdate = true;
    }
    if (this.world) applyWorldQuality(this.world, { low: q === 'low' });
    if (this.effects) this.effects.maxParticles = q === 'low' ? 24 : 40;
    if (this.mobManager) {
      this.mobManager.cullRadius = q === 'low' ? 680 : 760;
      this.mobManager.animRadius = q === 'low' ? 380 : 460;
    }
    this.updateQualityButton();
    if (!opts || opts.persist !== false) this.saveQualityPreference(q);
    return q;
  }

  toggleQuality() {
    return this.setQuality(this.quality === 'high' ? 'low' : 'high');
  }

  updateQualityButton() {
    const btn = document.getElementById('quality-toggle');
    if (!btn) return;
    const high = this.quality === 'high';
    const label = high ? '✨ 고화질' : '⚡ 성능 우선';
    if (btn.textContent !== label) btn.textContent = label;
    btn.classList.toggle('on', high);
    btn.setAttribute('aria-label', high ? '화질: 지금 고화질. 누르면 성능 우선으로 바뀝니다' : '화질: 지금 성능 우선. 누르면 고화질로 바뀝니다');
    btn.title = high
      ? '지금 고화질 — 누르면 성능 우선(선명도 살짝 낮춤)으로 바꿉니다'
      : '지금 성능 우선 — 누르면 고화질(선명하게)로 바꿉니다';
  }

  // 그림자 종류가 바뀌면 이미 쓰던 재질의 셰이더를 다시 컴파일해야 한다
  refreshMaterials() {
    if (!this.scene) return;
    const seen = new Set();
    this.scene.traverse((o) => {
      const m = o.material;
      if (!m) return;
      const list = Array.isArray(m) ? m : [m];
      for (const mat of list) {
        if (!mat || seen.has(mat)) continue;
        seen.add(mat);
        mat.needsUpdate = true;
      }
    });
  }

  bindQualityToggle() {
    const btn = document.getElementById('quality-toggle');
    this.updateQualityButton();
    if (!btn) return;
    const flip = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      this.toggleQuality();
    };
    btn.addEventListener('click', flip);
    btn.addEventListener('touchstart', flip, { passive: false });
  }

  // 1초 단위 프레임 수를 재서 계속 느리면 품질을 한 단계 내린다
  measurePerf(rawDt) {
    const perf = this._perf;
    if (document.hidden || rawDt > 1.0) { perf.acc = 0; perf.frames = 0; return; }
    perf.acc += rawDt;
    perf.frames++;
    if (perf.acc < 1) return;
    const fps = perf.frames / perf.acc;
    perf.acc = 0;
    perf.frames = 0;
    perf.samples++;
    this.lastFps = Math.round(fps);
    // 시작 직후(로딩 · 셰이더 컴파일)에는 판단하지 않는다
    if (this.elapsed < 5 || this.state !== 'playing') { perf.low = 0; return; }
    const limit = this.quality === 'low' ? 42 : 46;
    if (fps < limit) {
      perf.low++;
      if (perf.low >= 2 && this.qualityLevel < 2) {
        perf.low = 0;
        this.applyQualityLevel(this.qualityLevel + 1);
      }
    } else {
      perf.low = 0;
    }
  }

  /* ------------------------------ 입력 ------------------------------ */
  bindInput() {
    const canvas = this.renderer.domElement;

    window.addEventListener('keydown', (e) => {
      // 닉네임 · 방 코드 입력 중에는 게임 키를 먹지 않는다
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        if (e.key === 'Escape' && t.blur) t.blur();
        return;
      }
      const k = e.key ? e.key.toLowerCase() : '';
      // 지도 접기 / 펴기 (M)
      if (k === 'm') {
        if (this.hud) this.hud.toggleMap();
        e.preventDefault();
        return;
      }
      // 상점 모달이 열려 있는 동안은 이동 · 공격 입력을 막는다
      if (this.state === 'shop') {
        if (k === 'escape' || k === 'f') this.closeShop();
        return;
      }
      if (k === 'w' || k === 'arrowup') { this.input.forward = true; }
      if (k === 's' || k === 'arrowdown') { this.input.back = true; }
      if (k === 'a' || k === 'arrowleft') { this.input.left = true; }
      if (k === 'd' || k === 'arrowright') { this.input.right = true; }
      if (k === 'shift') this.input.sprint = true;
      if (e.code === 'Space') { this.input.jump = true; e.preventDefault(); }
      if (k === 'j') { if (this.state === 'playing' && this.player) this.player.attack(); }
      if (k === 'f') {
        if (this.state === 'playing' && this.player) {
          if (this.nearPortal && this.portals) this.portals.enterNearest();
          else if (this.nearShop) this.openShop();
          else this.player.attack();
        }
      }
      if (k === 'q') { if (this.state === 'playing' && this.player) this.player.useSkill('q'); }
      if (k === 'e') { if (this.state === 'playing' && this.player) this.player.useSkill('e'); }
      if (k === 'escape' && document.exitPointerLock) document.exitPointerLock();
      // 포션 빠른 사용: 1 / 2 / 3 (1세계) · 4 / 5 / 6 (2세계)
      if (this.state === 'playing' && this.player) {
        const pid = {
          '1': 'potion-hp', '2': 'potion-hp-big', '3': 'potion-atk',
          '4': 'potion-hp-supreme', '5': 'potion-full-restore', '6': 'potion-rage',
        }[k];
        if (pid) { this.usePotion(pid); e.preventDefault(); return; }
      }
      if (k === '1' || k === '2' || k === '3' || k === '4' || k === '5') {
        if (this.state === 'menu') {
          const order = ['warrior', 'archer', 'rogue', 'tanker', 'mage'];
          const idx = parseInt(k, 10) - 1;
          if (order[idx]) this.requestStart(order[idx]);
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
      if (Date.now() - (this.lastTouchAt || 0) < 700) return; // 터치 뒤 합성 이벤트 무시
      if (this.state !== 'playing') return;
      if (e.button !== 0) return;
      if (document.pointerLockElement === canvas) {
        if (this.player) this.player.attack();
        return;
      }
      // 포인터 락이 없거나(iPad 트랙패드·Safari·미지원 브라우저) 걸지 못해도
      // 버튼을 누른 채 끌면 바로 시점이 돌아가도록 드래그를 먼저 살린다.
      this.mouseDragging = true;
      this.dragging = true;
      this.mouseDragMoved = 0;
      this.mouseDragAt = Date.now();
      this.lastPointer.x = e.clientX;
      this.lastPointer.y = e.clientY;
      if (!this.pointerLockBroken && canvas.requestPointerLock) {
        const req = canvas.requestPointerLock();
        if (req && req.catch) req.catch(() => { this.pointerLockBroken = true; });
      }
    });

    window.addEventListener('mouseup', (e) => {
      const wasDragging = this.mouseDragging;
      const moved = this.mouseDragMoved || 0;
      const quickTap = Date.now() - (this.mouseDragAt || 0) < 350;
      this.mouseDragging = false;
      this.dragging = false;
      // 포인터 락이 없는 상태(트랙패드·터치 노트북)에서는 짧게 “클릭”한 경우만 공격
      if (wasDragging && moved < 6 && quickTap
        && document.pointerLockElement !== this.renderer.domElement
        && this.state === 'playing' && this.player && (!e || e.button === 0)) {
        this.player.attack();
      }
    });

    window.addEventListener('mousemove', (e) => {
      const canvasEl = this.renderer.domElement;
      if (document.pointerLockElement === canvasEl) {
        this.camYaw -= e.movementX * 0.0023;
        this.camPitch = clamp(this.camPitch + e.movementY * 0.0019, -0.32, 0.95);
      } else if (this.mouseDragging) {
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer.x = e.clientX;
        this.lastPointer.y = e.clientY;
        this.mouseDragMoved += Math.abs(dx) + Math.abs(dy);
        this.camYaw -= dx * 0.004;
        this.camPitch = clamp(this.camPitch + dy * 0.003, -0.32, 0.95);
      }
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.renderer.domElement;
      if (this.hud) this.hud.setCrosshair(locked);
      if (!locked) { this.dragging = false; this.mouseDragging = false; }
    });

    canvas.addEventListener('wheel', (e) => {
      this.camDist = clamp(this.camDist + e.deltaY * 0.045, 26, 110);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('resize', () => this.resize());
    // iPad/아이폰 회전 시 Safari가 늦게 크기를 갱신하므로 한 번 더 맞춰준다
    window.addEventListener('orientationchange', () => {
      this.resize();
      setTimeout(() => this.resize(), 260);
      setTimeout(() => this.resize(), 700);
    });

    // ---- 모바일 확대(더블탭 · 핀치) 차단 ----
    const stopMulti = (e) => {
      if (e.touches && e.touches.length > 1 && e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchstart', stopMulti, { passive: false });
    document.addEventListener('touchmove', stopMulti, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((name) => {
      document.addEventListener(name, (e) => e.preventDefault(), { passive: false });
    });
    // 더블탭(300ms 이내 두 번째 탭) 확대 방지
    // 주의: 버튼 · 입력칸 · 직업 카드처럼 누르는 요소에서 preventDefault 하면 그 탭의 click 이
    // 사라져 휴대폰에서 "방 참가"나 직업 선택이 눌리지 않는 것처럼 보인다. 그래서 게임 화면과
    // 빈 배경에서만 막고, 실제로 누르는 컨트롤은 그대로 둔다.
    let lastTouchEnd = 0;
    const TAP_CONTROL = 'button, input, textarea, select, a, label, .class-card, .mp-panel, .mp-join-row, .shop-item, .slot, .tbtn, .joy';
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      const t = e.target;
      const onControl = !!(t && t.closest && t.closest(TAP_CONTROL));
      if (!onControl && now - lastTouchEnd < 320 && e.cancelable) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
    // iOS Safari 핀치 줌 (일부 버전)
    document.addEventListener('wheel', (e) => {
      if (e.ctrlKey && e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  /* -------------------------- 모바일 터치 조작 -------------------------- */
  bindTouch() {
    // iPadOS Safari는 데스크톱 UA/넓은 화면으로 보고하므로 터치 지원 여부로 판단 (init 에서 이미 판단함)
    const initialTouch = this.isTouch;
    const setTouchMode = (on) => {
      document.body.classList.toggle('touch-mode', on);
      const btn = document.getElementById('mode-toggle');
      if (btn) btn.textContent = on ? '🖥 키보드/마우스 모드' : '📱 터치 모드';
      this.touchMode = on;
    };
    setTouchMode(initialTouch);
    const toggle = document.getElementById('mode-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        setTouchMode(!document.body.classList.contains('touch-mode'));
      });
      toggle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        setTouchMode(!document.body.classList.contains('touch-mode'));
      }, { passive: false });
    }

    document.addEventListener('touchstart', () => { this.lastTouchAt = Date.now(); }, { passive: true });

    // 캔버스 터치 드래그로 시점 회전 + 짧은 탭으로 공격
    // 손가락을 identifier로 추적한다. 왼손으로 조이스틱을 잡은 채 오른손으로 화면을 끌어도
    // (동시에 터치가 2개 이상이어도) 시점 회전이 계속 동작한다.
    const canvas = this.renderer.domElement;
    const LOOK_YAW = 0.005;
    const LOOK_PITCH = 0.004;
    let look = null;
    const setLook = (v) => { look = v; this._look = v; };

    canvas.addEventListener('touchstart', (e) => {
      this.lastTouchAt = Date.now();
      if (this.state !== 'playing') return;
      if (look) return; // 이미 다른 손가락이 시점을 돌리는 중이면 그 손가락을 계속 쓴다
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      setLook({ id: t.identifier, x: t.clientX, y: t.clientY, moved: 0, at: Date.now() });
      // iPadOS Safari가 드래그를 페이지 스크롤/바운스로 처리하지 않도록
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (!look) return;
      if (this.state !== 'playing') { setLook(null); return; }
      const t = findTouchById(e.touches, look.id) || findTouchById(e.changedTouches, look.id);
      if (!t) return;
      const dx = t.clientX - look.x;
      const dy = t.clientY - look.y;
      look.x = t.clientX;
      look.y = t.clientY;
      look.moved += Math.abs(dx) + Math.abs(dy);
      this.camYaw -= dx * LOOK_YAW;
      this.camPitch = clamp(this.camPitch + dy * LOOK_PITCH, -0.32, 0.95);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    const endLook = (e) => {
      if (!look) return;
      // 방금 떨어진 손가락이 시점용 손가락일 때만 드래그를 끝낸다
      // (조이스틱을 잡은 다른 손가락이 떨어져도 시점 회전은 유지)
      if (e && e.changedTouches && e.changedTouches.length && !findTouchById(e.changedTouches, look.id)) return;
      if (look.moved < 14 && Date.now() - look.at < 320 && this.state === 'playing' && this.player) {
        this.player.attack();
      }
      setLook(null);
      if (e && e.cancelable) e.preventDefault();
    };
    canvas.addEventListener('touchend', endLook, { passive: false });
    canvas.addEventListener('touchcancel', endLook, { passive: false });

    const joy = document.getElementById('joy');
    const knob = document.getElementById('joy-knob');
    if (joy && knob) {
      let active = false;
      let touchId = null; // 조이스틱을 잡고 있는 손가락 identifier
      let cx = 0, cy = 0;
      const maxR = 52;
      const setKnob = (dx, dy) => {
        knob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      };
      const apply = (dx, dy) => {
        const len = Math.hypot(dx, dy);
        const limit = Math.min(1, len / maxR);
        if (len < 10) {
          this.input.forward = false; this.input.back = false;
          this.input.left = false; this.input.right = false;
          this.input.sprint = false;
          return;
        }
        const nx = dx / (len || 1);
        const ny = dy / (len || 1);
        this.input.left = nx < -0.38;
        this.input.right = nx > 0.38;
        this.input.forward = ny < -0.3;
        this.input.back = ny > 0.45;
        this.input.sprint = limit > 0.85;
      };
      const start = (e) => {
        if (active) return;
        const t = (e.changedTouches && e.changedTouches[0]) || e;
        if (!t) return;
        touchId = (typeof t.identifier === 'number') ? t.identifier : null;
        const r = joy.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        active = true;
        if (e.cancelable) e.preventDefault();
        move({ clientX: t.clientX, clientY: t.clientY, preventDefault() {}, cancelable: false });
      };
      const move = (e) => {
        if (!active) return;
        let t;
        if (e.changedTouches) {
          t = touchId === null
            ? e.changedTouches[0]
            : (findTouchById(e.touches, touchId) || findTouchById(e.changedTouches, touchId));
        } else {
          t = e; // 마우스 테스트 입력
        }
        if (!t) return; // 다른 손가락의 이동 — 조이스틱과 무관
        let dx = t.clientX - cx;
        let dy = t.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
        setKnob(dx, dy);
        apply(dx, dy);
        if (e.cancelable) e.preventDefault();
      };
      const end = (e) => {
        if (!active) return;
        // 조이스틱을 잡은 손가락이 떨어진 경우에만 조이스틱을 놓는다
        if (e && e.changedTouches && touchId !== null && !findTouchById(e.changedTouches, touchId)) return;
        active = false;
        touchId = null;
        setKnob(0, 0);
        this.input.forward = false; this.input.back = false;
        this.input.left = false; this.input.right = false;
        this.input.sprint = false;
        if (e && e.cancelable) e.preventDefault();
      };
      joy.addEventListener('touchstart', start, { passive: false });
      joy.addEventListener('touchmove', move, { passive: false });
      joy.addEventListener('touchend', end, { passive: false });
      joy.addEventListener('touchcancel', end, { passive: false });
      // 마우스로도 조이스틱 테스트 가능
      joy.addEventListener('mousedown', (e) => {
        const r = joy.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        touchId = null;
        active = true;
        move(e);
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => { if (active) move(e); });
      window.addEventListener('mouseup', (e) => { if (active) end(e); });
    }

    const bindBtn = (id, fn, labelId) => {
      const el = document.getElementById(id);
      if (!el) return;
      const fire = (e) => {
        if (e.cancelable) e.preventDefault();
        if (this.state === 'playing' && this.player && fn) fn();
      };
      el.addEventListener('touchstart', fire, { passive: false });
      el.addEventListener('mousedown', (e) => {
        if (Date.now() - (this.lastTouchAt || 0) < 700) return;
        if (e.button === 0) fire(e);
      });
      if (labelId) this[labelId] = el;
    };
    bindBtn('tbtn-attack', () => this.player.attack());
    bindBtn('tbtn-q', () => this.player.useSkill('q'));
    bindBtn('tbtn-e', () => this.player.useSkill('e'));
    bindBtn('tbtn-jump', () => { this.input.jump = true; });
    bindBtn('tbtn-potion-1', () => this.usePotion('potion-hp'));
    bindBtn('tbtn-potion-2', () => this.usePotion('potion-hp-big'));
    bindBtn('tbtn-potion-3', () => this.usePotion('potion-atk'));
    bindBtn('tbtn-potion-4', () => this.usePotion('potion-hp-supreme'));
    bindBtn('tbtn-potion-5', () => this.usePotion('potion-full-restore'));
    bindBtn('tbtn-potion-6', () => this.usePotion('potion-rage'));

    // 상점 프롬프트 자체가 버튼 (데스크톱 채팅 · iPad 탭 모두)
    const prompt = document.getElementById('shop-prompt');
    if (prompt) {
      const openShop = (e) => {
        if (e.cancelable) e.preventDefault();
        if (this.state === 'playing' && this.player) this.openShop();
      };
      prompt.addEventListener('click', openShop);
      prompt.addEventListener('touchstart', openShop, { passive: false });
    }

    // 포털 안내도 버튼 — 누르면 바로 다른 세계로 넘어간다
    const portalPrompt = document.getElementById('portal-prompt');
    if (portalPrompt) {
      const usePortal = (e) => {
        if (e.cancelable) e.preventDefault();
        if (this.state === 'playing' && this.player && this.portals) this.portals.enterNearest();
      };
      portalPrompt.addEventListener('click', usePortal);
      portalPrompt.addEventListener('touchstart', usePortal, { passive: false });
    }
  }

  resize() {
    if (!this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ------------------------- 함께 하기 (멀티플레이) ------------------------- */
  setupMultiplayer() {
    const $ = (id) => document.getElementById(id);
    this.mpDom = {
      nick: $('mp-nick'),
      code: $('mp-code'),
      joinRow: document.querySelector('.mp-join-row'),
      note: $('mp-note'),
      buttons: {
        solo: $('mp-mode-solo'), host: $('mp-mode-host'), join: $('mp-mode-join'),
      },
      joinGo: $('mp-join-go'),
    };

    const setMode = (mode) => {
      this.mpMode = mode;
      for (const key in this.mpDom.buttons) {
        const b = this.mpDom.buttons[key];
        if (b) b.classList.toggle('on', key === mode);
      }
      if (this.mpDom.joinRow) this.mpDom.joinRow.classList.toggle('on', mode === 'join');
      if (mode === 'solo') this.mpNote('혼자 하기를 고르면 바로 시작합니다. 직업을 선택하세요.');
      else if (mode === 'host') this.mpNote('직업을 고르면 방이 만들어지고 초대 링크가 표시됩니다.');
      else this.mpNote('초대받은 방 코드를 넣고 직업을 고르면 바로 참가합니다.');
    };
    this.mpSetMode = setMode;

    for (const key in this.mpDom.buttons) {
      const b = this.mpDom.buttons[key];
      if (!b) continue;
      const pick = (e) => {
        if (e && e.cancelable) e.preventDefault();
        setMode(key);
        if (key === 'join' && this.mpDom.code) this.mpDom.code.focus();
      };
      b.addEventListener('click', pick);
      b.addEventListener('touchstart', pick, { passive: false });
    }

    if (this.mpDom.code) {
      this.mpDom.code.addEventListener('input', () => {
        const v = normalizeRoomCode(this.mpDom.code.value);
        if (v !== this.mpDom.code.value) this.mpDom.code.value = v;
      });
    }

    if (this.mpDom.joinGo) {
      const go = (e) => {
        if (e && e.cancelable) e.preventDefault();
        setMode('join');
        const code = normalizeRoomCode(this.mpDom.code ? this.mpDom.code.value : '');
        if (!isValidRoomCode(code)) {
          this.mpNote('방 코드를 확인해 주세요 (예: K7TQ)', 'err');
          this.highlightCodeInput();
          return;
        }
        // 휴대폰 키보드가 열려 있으면 닫아 직업 카드가 보이게 한다
        if (this.mpDom.code) this.mpDom.code.blur();
        this.mpNote('직업을 고르면 <b>' + code + '</b> 방에 참가합니다.', 'ok');
        this.revealClassGrid();
      };
      this.mpDom.joinGo.addEventListener('click', go);
    }

    // 방 코드 입력 후 키보드의 이동/완료 키로도 참가되게
    if (this.mpDom.code) {
      this.mpDom.code.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        if (this.mpDom.joinGo) this.mpDom.joinGo.click();
      });
    }

    // ?room=CODE 초대 링크로 들어온 경우: 코드 채우고 방 참가 강조
    const qp = new URLSearchParams(window.location.search);
    const invite = normalizeRoomCode(qp.get('room') || '');
    if (invite) {
      this.inviteCode = invite;
      if (this.mpDom.code) {
        this.mpDom.code.value = invite;
        this.mpDom.code.classList.add('highlight');
      }
      setMode('join');
      this.mpNote('초대받은 방 <b>' + invite + '</b> 입니다 · 직업을 고르면 바로 참가합니다!', 'ok');
    }

    // HUD 방 패널 버튼
    const copyBtn = document.getElementById('rp-copy');
    if (copyBtn) {
      const cp = (e) => {
        if (e && e.cancelable) e.preventDefault();
        this.copyInviteLink();
      };
      copyBtn.addEventListener('click', cp);
      copyBtn.addEventListener('touchstart', cp, { passive: false });
    }
    const leaveBtn = document.getElementById('rp-leave');
    if (leaveBtn) {
      const lv = (e) => {
        if (e && e.cancelable) e.preventDefault();
        this.leaveRoom();
      };
      leaveBtn.addEventListener('click', lv);
      leaveBtn.addEventListener('touchstart', lv, { passive: false });
    }

    window.addEventListener('beforeunload', () => {
      if (this.net && this.net.active) this.net.stop('leave');
    });
  }

  mpNote(text, kind) {
    const el = this.mpDom && this.mpDom.note;
    if (!el) return;
    el.innerHTML = text;
    el.classList.toggle('err', kind === 'err');
    el.classList.toggle('ok', kind === 'ok');
  }

  // 방 코드 입력칸을 잠깐 강조해 어디를 고쳐야 하는지 보이게
  highlightCodeInput() {
    const el = this.mpDom && this.mpDom.code;
    if (!el) return;
    el.focus();
    el.classList.add('highlight');
    clearTimeout(this._codeHighlightTimer);
    this._codeHighlightTimer = setTimeout(() => el.classList.remove('highlight'), 2600);
  }

  // 직업 카드가 화면 밖으로 밑려 있을 때만 부드럽게 올린다 (휴대폰에서 키보드·작은 화면 대비)
  revealClassGrid() {
    const ov = document.getElementById('start-overlay');
    const grid = document.getElementById('class-grid');
    if (!ov || !grid) return;
    grid.classList.remove('mp-flash');
    void grid.offsetWidth;
    grid.classList.add('mp-flash');
    const ob = ov.getBoundingClientRect();
    const gb = grid.getBoundingClientRect();
    const panel = document.getElementById('mp-panel');
    // 휴대폰에서 위에 붙어 있는 패널 높이만큼은 비워 둔다
    const docked = panel ? Math.max(0, panel.getBoundingClientRect().bottom - ob.top) : 0;
    if (gb.top > ob.top + docked + 40) {
      const delta = gb.top - ob.top - docked - 8;
      ov.scrollTo({ top: Math.max(0, ov.scrollTop + delta), behavior: 'smooth' });
    }
  }

  readNick() {
    const v = this.mpDom && this.mpDom.nick ? this.mpDom.nick.value.trim() : '';
    return (v || '모험가').slice(0, 10);
  }

  inviteUrl() {
    const code = this.net && this.net.roomCode ? this.net.roomCode : '';
    return window.location.origin + window.location.pathname + '?room=' + code;
  }

  copyInviteLink() {
    const url = this.inviteUrl();
    let settled = false;
    const success = () => {
      if (settled) return;
      settled = true;
      this.hud.flashCopied();
      this.mpNote('초대 링크를 복사했습니다 · 카톡으로 붙여넣어 보내세요', 'ok');
    };
    const failure = () => {
      if (settled) return;
      settled = true;
      this.copyFallback(url, success);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(success).catch(failure);
      // 권한 창이 뜨거나 응답이 없는 경우를 대비해 잠시 뒤 직접 복사로 넘긴다
      setTimeout(() => { if (!settled) failure(); }, 700);
    } else {
      failure();
    }
  }

  copyFallback(text, done) {
    let ok = false;
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ok = !!(document.execCommand && document.execCommand('copy'));
      document.body.removeChild(ta);
    } catch (e) {
      ok = false;
    }
    if (ok) {
      done();
      return;
    }
    // 복사가 막혔으면 링크를 화면에 보여 주어 직접 복사할 수 있게 한다
    this.hud.banner('링크 복사: ' + text, 8000);
  }

  leaveRoom() {
    if (this.net) this.net.stop('leave');
    try {
      history.replaceState({}, '', window.location.pathname);
    } catch (e) { /* noop */ }
    window.location.reload();
  }

  // 직업 카드를 눌렀을 때: 혼자면 바로, 함께면 방을 먼저 연다
  requestStart(classId) {
    if (!CLASSES[classId]) return;
    if (this.mpMode === 'solo' || (this.net && this.net.active)) {
      this.startClass(classId);
      return;
    }
    if (this.pendingStart) return;
    this.pendingStart = classId;
    this.tryStartMultiplayer(classId).finally(() => { this.pendingStart = null; });
  }

  async tryStartMultiplayer(classId) {
    const nick = this.readNick();
    this.nick = nick;
    try {
      if (this.mpMode === 'host') {
        this.mpNote('방을 만드는 중…');
        const code = await this.net.host(classId, nick, (s) => this.mpNote(s));
        this.startClass(classId);
        this.hud.showRoom({ code, count: 1, players: playerListForHud(this.net, this.player) });
        this.hud.banner('방 코드 ' + code + ' · 초대 링크를 보내 보세요', 3200);
      } else {
        const code = normalizeRoomCode(this.mpDom.code ? this.mpDom.code.value : '');
        if (!isValidRoomCode(code)) {
          this.mpNote('방 코드를 넣고 <b>참가</b>를 누른 뒤 직업을 골라 주세요.', 'err');
          this.highlightCodeInput();
          return;
        }
        this.mpNote('방 <b>' + code + '</b> 를 찾는 중…');
        const data = await this.net.join(code, classId, nick, (s) => this.mpNote(s));
        this.startClass(classId, { spawn: data.spawn });
        this.hud.showRoom({ code, count: this.net.playerCount, players: playerListForHud(this.net, this.player) });
      }
      this.mpNote(this.mpMode === 'host'
        ? '방이 열렸습니다 · 친구를 기다리는 중 · 지도는 <b>M</b> 키'
        : '방에 참가했습니다! 함께 플레이 중 · 지도는 <b>M</b> 키', 'ok');
    } catch (err) {
      if (this.net) this.net.stop();
      const msg = (err && err.message) || '접속에 실패했습니다';
      this.mpNote(msg + '<br><span style="opacity:.8">직업을 다시 누르면 방을 찾는 것을 다시 시도합니다.</span>', 'err');
    }
  }

  combatTargets() {
    const list = [];
    const p = this.player;
    if (p && p.alive) {
      list.push({ local: true, alive: true, radius: p.radius, position: p.position });
    }
    if (this.net && this.net.active && this.net.isHost) {
      const extra = this.net.hostTargets();
      for (let i = 0; i < extra.length; i++) list.push(extra[i]);
    }
    return list;
  }

  /* ------------------------------ 게임 시작 ------------------------------ */
  startClass(classId, opts) {
    if (!CLASSES[classId]) return;
    const o = opts || {};
    if (this.player) {
      this.scene.remove(this.player.root);
      this.combat.clear();
      this.effects.clear();
    }
    this.player = new Player(this, classId);
    // 기본 시작 지점은 태초마을 (디버그 ?biome= / ?x=&z= / ?world=2 로 바꿀 수 있다)
    let startWorld = this.startWorld === 2 ? 2 : 1;
    let biomeId = (this.startBiome && BIOMES[this.startBiome]) ? this.startBiome : 'village';
    if (startWorld === 1 && BIOMES[biomeId] && BIOMES[biomeId].world === 2) startWorld = 2;
    if (startWorld === 2 && (!BIOMES[biomeId] || BIOMES[biomeId].world !== 2)) biomeId = 'village_w2';
    let spawn;
    let yaw = -Math.PI / 2 + 0.25;
    if (this.debugSpawn) {
      spawn = this.debugSpawn;
    } else if (biomeId === 'temple') {
      spawn = { x: 0, z: 372 };
      yaw = 0;
    } else if (biomeId === 'village') {
      spawn = BIOMES.village.spawn;
      yaw = 0; // 북쪽(광장 · 상점)을 바라보는 시점
    } else if (biomeId === 'village_w2') {
      // 2세계 태초마을: 광장에서 남쪽 2세계 대장간을 바라본다 (북쪽으로 나가면 고블린 숲)
      spawn = BIOMES.village_w2.spawn;
      yaw = Math.PI;
    } else if (BIOMES[biomeId].spawn) {
      spawn = BIOMES[biomeId].spawn;
      if (startWorld === 2) yaw = 0; // 북쪽(암흑지역)을 바라본다
    } else {
      spawn = BIOMES[biomeId].center;
    }
    // 함께 하기: 초대받은 사람은 호스트가 알려 준 자리에서 시작한다
    if (o.spawn) spawn = { x: o.spawn.x, z: o.spawn.z };
    this.player.spawnAt(spawn.x, spawn.z);
    if (biomeId === 'village' && !this.debugSpawn) this.player.facing = Math.PI;
    if (biomeId === 'village_w2' && !this.debugSpawn) this.player.facing = 0;
    this.setWorld(worldAt(spawn.x, spawn.z), { silent: true });
    if (startWorld === 2) {
      this.world2Unlocked = true;
      if (this.mobManager) this.mobManager.spawnWorld(2);
    }
    this.gold = START_GOLD;
    this.nearShop = false;
    this.camYaw = yaw;
    this.camPitch = 0.22;
    this.camDist = 56;
    this.focused = true;
    this.state = 'playing';
    this.playTime = 0;
    this.victoryTimer = -1;
    this.victoryKind = null;
    this.deathTimer = -1;
    this.hud.onStart(this.player);
    // 멀티플레이 연결을 이 시점에 붙인다 (호스트: 몹 스냅샷 송신 시작, 게스트: 몹 미러 준비)
    if (this.net && this.net.role && !this.net.active) {
      if (this.net.isHost) this.net.spawn = { x: spawn.x, z: spawn.z };
      this.net.attach();
    }
    this.hud.hideEnd();
    this.sfx.init();
    this.hud.banner(CLASSES[classId].name + ' · ' + (startWorld === 2 ? '2세계 ' : '') + BIOMES[regionAt(spawn.x, spawn.z)].name, 2400);
    // 터치 조작 안내는 시작 후 잠시 보여주고 사라진다
    const touchHint = document.getElementById('touch-hint');
    if (touchHint) {
      touchHint.classList.remove('fade');
      if (this._touchHintTimer) clearTimeout(this._touchHintTimer);
      this._touchHintTimer = setTimeout(() => touchHint.classList.add('fade'), 8000);
    }
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
    // 부활하면 그 세계의 태초마을(광장 앞)에서 체력을 회복하고 다시 시작한다
    // (2번째 세계에서 죽었다면 2세계 태초마을로 — 사자마자 다시 포털을 찾아가지 않도록)
    const inW2 = this.worldId === 2;
    const home = homeBiomeFor(inW2 ? 2 : 1);
    const spawn = home.spawn;
    this.player.spawnAt(spawn.x, spawn.z);
    this.player.facing = inW2 ? 0 : Math.PI;
    this.player.root.rotation.y = this.player.facing;
    this.player.hp = this.player.maxHp;
    this.mobManager.resetAggro();
    this.setWorld(inW2 ? 2 : 1, { silent: true });
    this.camYaw = this.player.facing + Math.PI;
    this.placeCamera(true);
    this.hud.hideEnd();
    this.hud.refreshBars();
    this.hud.banner(inW2 ? '2세계 태초마을에서 다시 일어났습니다' : '태초마을에서 다시 일어났습니다', 2000);
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

  /* --------------------------- 세계 이동 (포털) --------------------------- */
  // 지금 있는 세계를 기록하고, 그 세계의 몹 · 미니맵 · 나침반을 맞춘다
  setWorld(worldId, opts) {
    const id = worldId === 2 ? 2 : 1;
    const changed = id !== this.worldId;
    this.worldId = id;
    if (id === 2) this.world2Unlocked = true;
    if (this.mobManager) this.mobManager.spawnWorld(id);
    if (this.hud && this.hud.setWorld) this.hud.setWorld(id);
    if (changed && this.world && this.player) {
      // 바로 다음 프레임부터 새 세계만 보이게 한다
      const fogFar = this.scene.fog ? this.scene.fog.far : 1200;
      const maxCut = this.quality === 'low' ? 1100 : 1280;
      updateBiomeCulling(this.world, this.player.position, Math.min(maxCut, Math.max(720, fogFar)));
    }
    return id;
  }

  // 포털을 타고 다른 세계로 간다 — 체력 · 경험치는 그대로 두고 자리만 옮긴다
  travelTo(target) {
    return travelPlayer(this, target);
  }

  // 화면의 포털 안내 (상점 안내와 같은 자리에 하나만 뜨게 자리를 비운다)
  setPortalPrompt(portal) {
    const el = document.getElementById('portal-prompt');
    const on = !!(portal && portal.open && this.state === 'playing');
    this.nearPortal = on;
    if (!el) return;
    el.classList.toggle('on', on);
    if (!on) return;
    const name = portal.label;
    if (this._portalLabel !== name) {
      this._portalLabel = name;
      const t = el.querySelector('.sp-text');
      if (t) t.textContent = name + ' 타기';
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
    const name = boss && boss.type ? boss.type.name : '보스';
    const region = boss ? regionAt(boss.position.x, boss.position.z) : 'temple';
    const where = BIOMES[region] ? BIOMES[region].name : '';
    this.hud.banner(name + ' · ' + where + '의 주인', 2600);
    this.effects.ring(new THREE.Vector3(boss.position.x, boss.position.y + 1, boss.position.z), 0x9fe8ff, 220, { duration: 1.1, thickness: 0.03 });
  }

  // 보스 처치 — 고대 골렘은 2번째 세계 포털을 열고, 흑마법사는 승리 화면
  onBossDefeated(boss) {
    return handleBossDefeated(this, boss);
  }

  onPlayerDeath() {
    this.deathTimer = 1.9;
    this.hud.banner('쓰러졌습니다…', 1800);
  }

  /* --------------------------- 태초마을 상점 --------------------------- */
  // 지금 서 있는 마을의 상점 (1세계 태초마을 · 2세계 태초마을 대장간)
  activeShopBiome() {
    const p = this.player;
    if (!p || !p.alive) return null;
    const order = worldAt(p.position.x, p.position.z) === 2 ? ['village_w2'] : ['village'];
    for (const id of order) {
      const b = BIOMES[id];
      if (!b || !b.shop || !b.shop.interact) continue;
      const inter = b.shop.interact;
      if (Math.hypot(p.position.x - inter.x, p.position.z - inter.z) <= inter.radius) return b;
    }
    return null;
  }

  isNearShop() {
    return !!this.activeShopBiome();
  }

  updateShopProximity() {
    const near = this.state === 'playing' && this.isNearShop();
    if (near === this.nearShop) return;
    this.nearShop = near;
    const el = document.getElementById('shop-prompt');
    if (el) {
      el.classList.toggle('on', near);
      if (near) {
        const b = this.activeShopBiome();
        const def = b ? shopForBiome(b.id) : null;
        const txt = el.querySelector('.sp-text');
        if (txt) txt.textContent = def && def.kind === 'world2' ? '2세계 대장간 열기' : '상점 열기';
      }
    }
    const tBtn = document.getElementById('tbtn-shop');
    if (tBtn) tBtn.classList.toggle('on', near);
  }

  openShop() {
    if (this.state !== 'playing' || !this.player) return;
    const b = this.activeShopBiome();
    const def = b ? shopForBiome(b.id) : SHOP;
    this.state = 'shop';
    this.input.forward = false;
    this.input.back = false;
    this.input.left = false;
    this.input.right = false;
    this.input.sprint = false;
    this.input.jump = false;
    if (document.exitPointerLock) document.exitPointerLock();
    if (this.shop) this.shop.open(def ? def.id : SHOP.id);
    this.sfx.shop();
    this.hud.setCrosshair(false);
    this.nearShop = false;
    const el = document.getElementById('shop-prompt');
    if (el) el.classList.remove('on');
  }

  closeShop() {
    if (this.shop) this.shop.close();
    if (this.state !== 'shop') return;
    this.state = 'playing';
    this.nearShop = false;
    this.updateShopProximity();
    if (!this.isTouch && !this.pointerLockBroken && this.renderer && this.renderer.domElement.requestPointerLock) {
      const req = this.renderer.domElement.requestPointerLock();
      if (req && req.catch) req.catch(() => { this.pointerLockBroken = true; });
    }
    this.hud.refreshBars();
    this.hud.refreshPotions();
  }

  addGold(amount, pos) {
    const n = Math.max(0, Math.round(amount));
    if (!n) return;
    this.gold += n;
    if (pos) this.hud.floater('+' + n + 'G', pos, 'gold', 1.6);
    this.sfx.coin();
    this.hud.updateGold();
  }

  usePotion(id) {
    const p = this.player;
    if (!p) return { ok: false, msg: '' };
    const res = p.usePotion(id);
    this.hud.refreshPotions();
    this.hud.refreshBars();
    if (!res.ok && res.msg) this.hud.banner(res.msg, 1200);
    return res;
  }

  onWeaponBought(weapon) {
    this.hud.refreshBars();
    this.hud.refreshWeapon();
    this.hud.banner(weapon.name + ' 장착!', 1500);
    if (this.effects && this.player) this.effects.ring(this.player.position, 0xffd24a, 64, { duration: 0.7 });
  }

  onPotionBought() {
    this.hud.refreshPotions();
  }

  onArmorBought(armor) {
    this.hud.refreshBars();
    this.hud.banner(armor.name + ' 장착! 최대 HP +' + armor.hp, 1800);
    if (this.effects && this.player) {
      this.effects.ring(this.player.position, armor.tier === 3 ? 0xffd24a : armor.tier === 2 ? 0xcfe4ff : 0xc9935a, 70, { duration: 0.8 });
      this.effects.burst(new THREE.Vector3(this.player.position.x, this.player.position.y + 10, this.player.position.z), 0xffe1a3, 18, { power: 20, size: 0.6 });
    }
    // 장착한 갑옷이 함께 하는 친구에게도 바로 보이도록
    if (this.net && this.net.active && this.net.isGuest) this.net._sendLocalState();
  }

  /* ------------------------------- 루프 ------------------------------- */
  tick(now) {
    requestAnimationFrame((t) => this.tick(t));
    const dtRaw = this.last ? (now - this.last) / 1000 : 0.016;
    this.last = now;
    const dt = clamp(dtRaw, 0, 0.05);
    this.elapsed += dt;

    // 느린 기기 흉내 (?perfdelay=ms) — 지정한 시간이 지나기 전에는 그리지 않고 건너뛴다
    if (this.perfDelay > 0) {
      this._pdAcc = (this._pdAcc || 0) + dtRaw * 1000;
      if (this._pdAcc < this.perfDelay) return;
      this._pdAcc = 0;
    }

    this.step(dt);

    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.measurePerf(dtRaw);
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

    // 먼 바이옴은 통째로 꺼 둔다 (안개가 덮는 거리에서만) — 0.2초에 한 번만 검사
    this._cullAcc += dt;
    if (this._cullAcc > 0.2 && this.world && this.world.biomeGroups) {
      this._cullAcc = 0;
      const at = this.player ? this.player.position : BIOMES.village.spawn;
      const fogFar = this.scene.fog ? this.scene.fog.far : 1200;
      const maxCut = this.quality === 'low' ? 1100 : 1280;
      updateBiomeCulling(this.world, at, Math.min(maxCut, Math.max(720, fogFar)));
    }

    if (this.state === 'menu') {
      this.updateMenuCamera(dt);
      this.effects.update(dt);
      if (this.mobManager) this.mobManager.cullByDistance(BIOMES.village.spawn);
      updateVillage(this.world, dt, this.elapsed);
      updateOldVillage(this.world, dt, this.elapsed);
      return;
    }

    // 상점 창이 열려 있는 동안은 이동 · 전투를 잠시 멈춘다
    if (this.state === 'shop') {
      this.placeCamera(false, dt);
      this.updateEnvironment(dt);
      this.hud.update(dt);
      if (this.net && this.net.active) this.net.update(dt);
      updateVillage(this.world, dt, this.elapsed);
      updateOldVillage(this.world, dt, this.elapsed);
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
      // 포털: 가까우면 안내를 띄우고, 안으로 걸어 들어가면 넘어간다
      if (this.portals) {
        const nearPortal = this.portals.update(dt, this.elapsed);
        this.setPortalPrompt(nearPortal);
      }
    }

    // 멀티플레이 동기화 (원격 캐릭터 · 몹 스냅샷 · 방 정보)
    if (this.net && this.net.active) {
      this.net.update(dt);
      this._roomAcc += dt;
      if (this._roomAcc > 0.4) {
        this._roomAcc = 0;
        this.hud.updateRoom({
          code: this.net.roomCode,
          count: this.net.playerCount,
          players: playerListForHud(this.net, this.player),
        });
      }
    }

    this.placeCamera(false, dt);
    this.updateEnvironment(dt);
    this.hud.update(dt);
    this.updateShopProximity();
    updateVillage(this.world, dt, this.elapsed);
    updateOldVillage(this.world, dt, this.elapsed);
    updateWorld2(this.world, dt, this.elapsed, p.position);

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
        this.hud.showEnd('victory', this.buildStats(), { kind: this.victoryKind });
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
      [String(this.gold) + 'G', '보유 골드'],
      [mins + '분 ' + String(secs).padStart(2, '0') + '초', '탐험 시간'],
    ];
  }

  /* ------------------------------ 카메라 ------------------------------ */
  updateMenuCamera(dt) {
    const t = this.elapsed;
    const spawn = BIOMES.village.spawn; // 메뉴 배경: 태초마을
    const r = 170;
    const x = spawn.x + Math.cos(t * 0.12) * r;
    const z = spawn.z + Math.sin(t * 0.12) * r;
    const y = terrainHeight(x, z) + 95;
    const focus = this._tmp.vecA.set(spawn.x, 0, spawn.z);
    this.camera.position.lerp(this._tmp.vecB.set(x, y, z), 1 - Math.exp(-1.2 * dt));
    this.camera.lookAt(spawn.x, 18, spawn.z);
    updateSun(this.world, focus, this.camera);
    this.updateEnvironment(dt, focus);
  }

  placeCamera(instant, dt) {
    if (!this.player) return;
    const p = this.player;
    const target = this._tmp.vecA.set(p.position.x, p.position.y + 16, p.position.z);
    const dir = this._tmp.vecB.set(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch)
    );
    const desired = this._camDesired || (this._camDesired = new THREE.Vector3());
    desired.copy(target).addScaledVector(dir, this.camDist);
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
    const pos = atPos || (this.player ? this.player.position : this._tmp.vecA.set(-1000, 0, 0));
    const w = biomeWeights(pos.x, pos.z, this.biomeCenters);
    let fogR = 0, fogG = 0, fogB = 0;
    let skyR = 0, skyG = 0, skyB = 0;
    let sunR = 0, sunG = 0, sunB = 0;
    let hsR = 0, hsG = 0, hsB = 0;
    let hgR = 0, hgG = 0, hgB = 0;
    let near = 0, far = 0, sunI = 0, hemiI = 0;

    for (const id of ALL_BIOME_ORDER) {
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

    const fogColor = this._tmp.colorA.setRGB(fogR, fogG, fogB);
    const skyColor = this._tmp.colorB.setRGB(skyR, skyG, skyB);
    const sunColor = this._tmp.colorC.setRGB(sunR, sunG, sunB);
    const hemiSky = this._tmp.colorD.setRGB(hsR, hsG, hsB);
    const hemiGround = this._tmp.colorE.setRGB(hgR, hgG, hgB);

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
      world: this.worldId,
      world2Unlocked: !!this.world2Unlocked,
      nearPortal: this.nearPortal ? (this.portals && this.portals.current ? this.portals.current.id : true) : false,
      frames: this.frames,
      drawCalls: this.renderer ? this.renderer.info.render.calls : 0,
      triangles: this.renderer ? this.renderer.info.render.triangles : 0,
      programs: this.renderer ? this.renderer.info.programs.length : 0,
      quality: this.quality,
      qualityLevel: this.qualityLevel,
      pixelRatio: this.pixelRatio,
      fps: this.lastFps || null,
      visibleBiomes: this.world && this.world.biomeGroups
        ? Object.keys(this.world.biomeGroups).filter((id) => this.world.biomeGroups[id].visible)
        : null,
      mobs: this.mobManager ? this.mobManager.mobs.length : 0,
      aliveMobs: this.mobManager ? this.mobManager.mobs.filter((m) => !m.dead).length : 0,
      bossHp: this.mobManager && this.mobManager.boss() ? this.mobManager.boss().hp : null,
      gold: this.gold,
      nearShop: !!this.nearShop,
      shopOpen: this.state === 'shop',
      player: this.player ? {
        classId: this.player.classId, hp: Math.round(this.player.hp), level: this.player.level,
        x: Math.round(this.player.position.x), z: Math.round(this.player.position.z),
        anim: this.player.anim.name,
        gold: this.gold,
        weaponTier: this.player.weaponTier,
        weaponName: this.player.weaponName,
        damage: Math.round(this.player.damage * 10) / 10,
        potions: Object.assign({}, this.player.potions),
      } : null,
      region: this.regionId || null,
      touch: this.touchMode === undefined ? null : {
        mode: this.touchMode,
        look: this._look ? { id: this._look.id, moved: Math.round(this._look.moved) } : null,
        mouseDragging: this.mouseDragging,
        pointerLocked: this.renderer ? document.pointerLockElement === this.renderer.domElement : false,
      },
      cam: { yaw: Math.round(this.camYaw * 1000) / 1000, pitch: Math.round(this.camPitch * 1000) / 1000 },
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
