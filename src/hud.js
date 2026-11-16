// HUD: 상태창 · 지역 표시 · 미니맵 · 나침반 · 스킬바 · 네임플레이트 · 데미지 숫자
import * as THREE from 'three';
import { CLASSES, CLASS_ORDER, BIOMES, COMPASS_ORDER, BIOME_ORDER, SHOP, compassOrderFor, biomeOrderFor, allPotions, ULT_LEVEL, ULT_KEY } from './config.js';
import { regionAt } from './utils.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.dom = {
      classBadge: $('class-badge'),
      weaponTag: $('weapon-tag'),
      evoBadge: $('evo-badge'),
      goldTag: $('gold-tag'),
      potionBar: $('potion-bar'),
      levelText: $('level-text'),
      hpFill: $('hp-fill'),
      hpText: $('hp-text'),
      xpFill: $('xp-fill'),
      xpText: $('xp-text'),
      stRow: $('st-row'),
      stBar: $('st-bar'),
      stFill: $('st-fill'),
      stText: $('st-text'),
      statRow: $('stat-row'),
      buffRow: $('buff-row'),
      regionName: $('region-name'),
      regionEn: $('region-en'),
      bossWrap: $('boss-wrap'),
      bossName: $('boss-name'),
      bossHpText: $('boss-hp-text'),
      bossFill: $('boss-fill'),
      targetWrap: $('target-wrap'),
      targetName: $('target-name'),
      targetHpText: $('target-hp-text'),
      targetFill: $('target-fill'),
      minimap: $('minimap'),
      compass: $('compass'),
      mapPanel: $('map-panel'),
      mapOpenBtn: $('map-open-btn'),
      mapClose: $('map-close'),
      roomPanel: $('room-panel'),
      rpCount: $('rp-count'),
      rpCode: $('rp-code'),
      rpCopy: $('rp-copy'),
      rpPlayers: $('rp-players'),
      rpLeave: $('rp-leave'),
      banner: $('banner'),
      floaters: $('floaters'),
      nameplates: $('nameplates'),
      skillbar: $('skillbar'),
      controlsPanel: $('controls-panel'),
      controlsToggle: $('controls-toggle'),
      ctrlQ: $('ctrl-q'),
      ctrlE: $('ctrl-e'),
      ctrlUlt: $('ctrl-ult'),
      crosshair: $('crosshair'),
      hint: $('hint'),
      classGrid: $('class-grid'),
      startOverlay: $('start-overlay'),
      endOverlay: $('end-overlay'),
      endEyebrow: $('end-eyebrow'),
      endTitle: $('end-title'),
      endLead: $('end-lead'),
      endStats: $('end-stats'),
      endPrimary: $('end-primary'),
      endRestart: $('end-restart'),
      loader: $('loader'),
    };

    this.minimapCtx = this.dom.minimap.getContext('2d');
    this.floaters = [];
    this.namePlatePool = [];
    this.playerPlatePool = [];
    this.mapOpen = true;
    this._roomSig = '';
    this._copyTimer = null;
    this.compSide = {};
    this.target = null;
    this.targetTime = 0;
    this.bannerTimer = 0;
    this.lastRegion = null;
    this.worldId = 1;
    this.lastHp = -1;
    this.skillSlots = {};

    this.touch = {
      q: document.getElementById('tcd-q'),
      e: document.getElementById('tcd-e'),
      ult: document.getElementById('tcd-ult'),
      qBtn: document.getElementById('tbtn-q'),
      eBtn: document.getElementById('tbtn-e'),
      ultBtn: document.getElementById('tbtn-ult'),
      ultIcon: document.getElementById('tult-icon'),
      dashBtn: document.getElementById('tbtn-dash'),
      blockBtn: document.getElementById('tbtn-block'),
    };

    this.buildCompass();
    this.buildClassCards();
    this.buildSkillBar(null);
    this.buildPotionBar();

    this.dom.controlsToggle.addEventListener('click', () => {
      const p = this.dom.controlsPanel;
      p.classList.toggle('collapsed');
      this.dom.controlsToggle.textContent = p.classList.contains('collapsed') ? '펼치기' : '접기';
    });

    this.bindMapToggle();
  }

  /* --------------------------- 지도 접기 / 펴기 --------------------------- */
  bindMapToggle() {
    const open = this.dom.mapOpenBtn;
    const close = this.dom.mapClose;
    const bind = (el, fn) => {
      if (!el) return;
      el.addEventListener('click', (e) => {
        if (e && e.preventDefault) e.preventDefault();
        fn();
      });
      el.addEventListener('touchstart', (e) => {
        if (e && e.preventDefault) e.preventDefault();
        fn();
      }, { passive: false });
    };
    bind(open, () => this.setMapOpen(true));
    bind(close, () => this.setMapOpen(false));
    // 짧은 화면(가로로 든 휴대폰)에서는 지도가 오른쪽 대쉬 · 막기 버튼을 덮지 않도록 접힌 채로 시작한다
    this.setMapOpen(window.innerHeight > 520);
  }

  setMapOpen(on) {
    this.mapOpen = !!on;
    if (this.dom.mapPanel) this.dom.mapPanel.classList.toggle('collapsed', !this.mapOpen);
    if (this.dom.mapOpenBtn) this.dom.mapOpenBtn.classList.toggle('hidden', this.mapOpen);
  }

  toggleMap() {
    this.setMapOpen(!this.mapOpen);
    return this.mapOpen;
  }

  /* ------------------------------ 방 정보 ------------------------------ */
  showRoom(info) {
    const d = this.dom;
    if (!d.roomPanel) return;
    d.roomPanel.classList.remove('hidden');
    if (d.rpCode) d.rpCode.textContent = (info && info.code) || '····';
    if (d.rpCopy) {
      d.rpCopy.classList.remove('done');
      d.rpCopy.textContent = '🔗 초대 링크 복사';
    }
    this.updateRoom(info || {});
  }

  hideRoom() {
    if (this.dom.roomPanel) this.dom.roomPanel.classList.add('hidden');
    this._roomSig = '';
  }

  updateRoom(info) {
    const d = this.dom;
    if (!d.roomPanel || d.roomPanel.classList.contains('hidden')) return;
    const players = info.players || [];
    const count = info.count === undefined ? players.length : info.count;
    const sig = count + '|' + players.map((p) => p.nick + p.level + p.hp + (p.alive ? 1 : 0)).join(',');
    if (sig === this._roomSig) return;
    this._roomSig = sig;
    if (d.rpCount) d.rpCount.textContent = '👥 ' + count + '명 접속 중';
    if (d.rpCode && info.code) d.rpCode.textContent = info.code;
    if (d.rpPlayers) {
      d.rpPlayers.innerHTML = players.map((p) =>
        '<div class="rp-player' + (p.me ? ' me' : '') + '">' +
        '<i class="rp-dot' + (p.alive === false ? ' dead' : '') + '"></i>' +
        '<b>' + String(p.nick || '친구').slice(0, 10) + '</b>' +
        '<span>' + (p.classId && CLASSES[p.classId] ? CLASSES[p.classId].name : '') + ' Lv.' + (p.level || 1) + (p.me ? ' · 나' : '') + '</span>' +
        '</div>'
      ).join('');
    }
  }

  flashCopied() {
    const el = this.dom.rpCopy;
    if (!el) return;
    el.textContent = '✅ 복사됨!';
    el.classList.add('done');
    if (this._copyTimer) clearTimeout(this._copyTimer);
    this._copyTimer = setTimeout(() => {
      el.textContent = '🔗 초대 링크 복사';
      el.classList.remove('done');
    }, 1600);
  }

  /* --------------------------- 클래스 선택 --------------------------- */
  buildClassCards() {
    const grid = this.dom.classGrid;
    grid.innerHTML = '';
    for (const id of CLASS_ORDER) {
      const c = CLASSES[id];
      const card = document.createElement('article');
      card.className = 'class-card';
      card.style.setProperty('--accent', c.accent + '55');
      card.innerHTML =
        '<div class="cc-top"><span class="cc-glyph">' + c.glyph + '</span>' +
        '<div><div class="cc-name">' + c.name + '</div><div class="cc-role">' + c.role + '</div></div></div>' +
        '<p class="cc-weapon">' + c.glyph + ' ' + c.weaponName + '</p>' +
        '<p class="cc-desc">' + c.desc + '</p>' +
        this.statBar('체력', c.stats.hp) +
        this.statBar('공격', c.stats.dmg) +
        this.statBar('속도', c.stats.spd) +
        this.statBar('사거리', c.stats.rng) +
        '<div class="cc-skills">' +
        '<div class="cc-skill"><b>Q</b>' + c.skills.q.name + ' <span style="opacity:.6">(' + c.skills.q.cooldown + '초)</span></div>' +
        '<div class="cc-skill"><b>E</b>' + c.skills.e.name + ' <span style="opacity:.6">(' + c.skills.e.cooldown + '초)</span></div>' +
        (c.ult ? '<div class="cc-skill ult"><b>' + ULT_KEY + '</b>' + c.ult.icon + ' ' + c.ult.name + '<span style="opacity:.6">Lv.' + ULT_LEVEL + ' 해금</span></div>' : '') +
        '</div>';
      card.addEventListener('click', () => {
        if (this.game.requestStart) this.game.requestStart(id);
        else this.game.startClass(id);
      });
      grid.appendChild(card);
    }
  }

  statBar(label, v) {
    return '<div class="cc-stat"><span>' + label + '</span><i><b style="width:' + Math.round(v * 100) + '%"></b></i></div>';
  }

  /* ----------------------------- 스킬바 ----------------------------- */
  // 레벨 · 진화 단계에 따라 Q · E · X(필살기) 슬롯을 다시 그린다
  buildSkillBar(player) {
    const bar = this.dom.skillbar;
    bar.innerHTML = '';
    this.skillSlots = {};
    if (!player) { this._skillSig = ''; return; }
    const c = player.cls;
    const mkSlot = (key, keyLabel, icon, name, extra) => {
      const slot = document.createElement('div');
      slot.className = 'slot' + (extra || '');
      slot.innerHTML =
        '<span class="slot-key">' + keyLabel + '</span>' +
        '<span class="slot-icon">' + icon + '</span>' +
        '<span class="slot-name">' + name + '</span>' +
        '<div class="slot-cd">0</div>';
      bar.appendChild(slot);
      return slot;
    };
    const q = player.skillFor('q');
    const e = player.skillFor('e');
    const ult = c.ult;
    const ultOpen = !!player.skillFor('ult');
    const evolved = !!player.evolved;

    const sAtk = mkSlot('attack', '좌클릭', c.glyph, '기본 공격', ' attack-slot');
    const sQ = mkSlot('q', 'Q', q.icon, q.name, evolved ? ' evolved' : '');
    const sE = mkSlot('e', 'E', e.icon, e.name, evolved ? ' evolved' : '');
    const sUlt = mkSlot('ult', ULT_KEY, ultOpen ? ult.icon : '🔒', ultOpen ? ult.name : 'Lv.' + ULT_LEVEL + ' 해금',
      ' ult-slot' + (ultOpen ? '' : ' locked'));
    sQ.title = q.name + ' · ' + q.desc;
    sE.title = e.name + ' · ' + e.desc;
    sUlt.title = ultOpen ? ult.name + ' · ' + ult.desc : 'Lv.' + ULT_LEVEL + ' 에 필살기가 열립니다';

    this.skillSlots = {
      attack: { el: sAtk, cd: sAtk.querySelector('.slot-cd') },
      q: { el: sQ, cd: sQ.querySelector('.slot-cd') },
      e: { el: sE, cd: sE.querySelector('.slot-cd') },
      ult: { el: sUlt, cd: sUlt.querySelector('.slot-cd') },
    };
    if (this.dom.ctrlQ) this.dom.ctrlQ.textContent = 'Q · ' + q.name;
    if (this.dom.ctrlE) this.dom.ctrlE.textContent = 'E · ' + e.name;
    if (this.dom.ctrlUlt) {
      this.dom.ctrlUlt.textContent = ultOpen
        ? ULT_KEY + ' · ' + ult.name + ' (필살기 · ' + ult.cooldown + '초)'
        : ULT_KEY + ' · 필살기 (Lv.' + ULT_LEVEL + ' 해금)';
    }
    this._skillSig = player.classId + '|' + (evolved ? 1 : 0) + '|' + (ultOpen ? 1 : 0);
    this.refreshSkillButtons(player);
  }

  // 레벨 업 · 진화로 스킬이 바뀌면 스킬바를 다시 그린다
  refreshSkillBar() {
    const p = this.game.player;
    if (!p) return;
    const sig = p.classId + '|' + (p.evolved ? 1 : 0) + '|' + (p.skillFor('ult') ? 1 : 0);
    if (sig !== this._skillSig) this.buildSkillBar(p);
  }

  // 휴대폰 Q · E · 필살기 버튼: 진화하면 아이콘이 바뀌고, 15레벨 전에는 필살기가 잠겨 있다
  refreshSkillButtons(player) {
    const t = this.touch;
    const set = (btn, iconEl, def, fallback, cls) => {
      if (!btn) return;
      const label = def ? (player.evolved ? def.icon : fallback) : '🔒';
      if (iconEl) {
        if (iconEl.textContent !== label) iconEl.textContent = label;
      }
      btn.title = def ? def.name + ' · ' + def.desc : 'Lv.' + ULT_LEVEL + ' 에 필살기가 열립니다';
      btn.classList.toggle('locked', !def);
      btn.classList.toggle('evolved', !!player.evolved && !!def);
      if (cls) btn.classList.add(cls);
    };
    set(t.qBtn, t.qBtn ? t.qBtn.querySelector('b') : null, player.skillFor('q'), 'Q');
    set(t.eBtn, t.eBtn ? t.eBtn.querySelector('b') : null, player.skillFor('e'), 'E');
    set(t.ultBtn, t.ultIcon || (t.ultBtn ? t.ultBtn.querySelector('b') : null), player.skillFor('ult'), '🔥');
  }

  /* ---------------------------- 포션 바 ---------------------------- */
  // 1세계 포션(1 · 2 · 3) + 2세계 포션(4 · 5 · 6) — 두 세계의 포션을 함께 쓰는 도구 막대
  buildPotionBar() {
    const bar = this.dom.potionBar;
    if (!bar) return;
    bar.innerHTML = '';
    this.potionSlots = {};
    for (const pt of allPotions()) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'slot potion-slot' + (pt.key >= '4' ? ' w2' : '');
      slot.setAttribute('data-potion', pt.id);
      slot.innerHTML =
        '<span class="slot-key">' + pt.key + '</span>' +
        '<span class="slot-icon">' + pt.icon + '</span>' +
        '<b class="slot-count">×0</b>' +
        '<span class="slot-name">' + pt.name + '</span>';
      slot.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.game.state === 'playing') this.game.usePotion(pt.id);
      });
      bar.appendChild(slot);
      this.potionSlots[pt.id] = { el: slot, count: slot.querySelector('.slot-count') };
    }
    this._potionSig = '';
  }

  refreshPotions() {
    const p = this.game.player;
    if (!p || !this.potionSlots) return;
    const list = allPotions();
    const parts = [];
    for (const pt of list) parts.push(p.potionCount(pt.id));
    const sig = parts.join(',') + '|' + (p.alive ? 1 : 0);
    if (sig === (this._potionSig || '')) return;
    this._potionSig = sig;
    let w2Any = 0;
    for (const pt of list) {
      const s = this.potionSlots[pt.id];
      const n = p.potionCount(pt.id);
      if (pt.key >= '4') w2Any += n;
      if (!s) continue;
      s.count.textContent = '×' + n;
      s.el.classList.toggle('empty', n <= 0);
      const tEl = document.getElementById('tpotion-' + pt.key);
      if (tEl) tEl.textContent = String(n);
      const tBtn = document.getElementById('tbtn-potion-' + pt.key);
      if (tBtn) tBtn.classList.toggle('empty', n <= 0);
    }
    // 2세계 포션 줄은 하나라도 갖고 있을 때만 휴대폰 화면에 나온다
    const w2Row = document.getElementById('trow-potion-w2');
    if (w2Row) w2Row.classList.toggle('on', w2Any > 0);
  }

  updateGold() {
    const g = this.game;
    const amount = Number(g.gold) || 0;
    const txt = '🪙 ' + amount + 'G';
    if (this.dom.goldTag && this.dom.goldTag.textContent !== txt) this.dom.goldTag.textContent = txt;
    if (!this._shopGoldEl) this._shopGoldEl = document.getElementById('shop-gold');
    const shopGold = this._shopGoldEl;
    if (shopGold && this._shopGoldTxt !== amount) {
      this._shopGoldTxt = amount;
      shopGold.textContent = amount + ' G';
    }
  }

  refreshWeapon() {
    const p = this.game.player;
    if (!p) return;
    if (this.dom.weaponTag) this.dom.weaponTag.textContent = p.weaponName || p.cls.weaponName.split(' ')[0];
  }

  flashSkill(key) {
    const s = this.skillSlots[key];
    if (!s) return;
    s.el.classList.remove('ready-flash');
    void s.el.offsetWidth;
    s.el.classList.add('ready-flash');
  }

  /* ----------------------------- 나침반 ----------------------------- */
  buildCompass() {
    const box = this.dom.compass;
    if (!box) return;
    box.innerHTML = '';
    this.compSide = {};
    for (const id of compassOrderFor(this.worldId)) {
      const b = BIOMES[id];
      if (!b) continue;
      const row = document.createElement('div');
      row.className = 'compass-row';
      let html = '<span class="compass-arrow">▲</span><span class="compass-name">' + b.name + '</span><span class="compass-dist">-</span>';
      row.innerHTML = html;
      box.appendChild(row);
      this.compSide[id] = {
        row,
        arrow: row.querySelector('.compass-arrow'),
        dist: row.querySelector('.compass-dist'),
      };
    }
  }

  // 세계가 바뀌면 미니맵 · 나침반을 그 세계 것으로 다시 그린다
  setWorld(worldId) {
    const id = worldId === 2 ? 2 : 1;
    if (id === this.worldId) return id;
    this.worldId = id;
    this.lastRegion = null;
    this.buildCompass();
    return id;
  }

  /* ------------------------------ 갱신 ------------------------------ */
  onStart(player) {
    const c = player.cls;
    this.dom.classBadge.textContent = c.name;
    this.dom.weaponTag.textContent = c.weaponName.split(' ')[0];
    this.buildSkillBar(player);
    this.refreshPotions();
    this.updateGold();
    this.refreshBars();
    this.dom.startOverlay.classList.add('hidden');
    const hudRoot = document.getElementById('hud');
    if (hudRoot) hudRoot.classList.add('on');
    this.dom.hint.classList.remove('fade');
    this.dom.hint.style.opacity = '';
    setTimeout(() => { this.dom.hint.classList.add('fade'); }, 4200);
  }

  refreshBars() {
    const p = this.game.player;
    if (!p) return;
    // 값이 실제로 바뀔 때만 DOM 을 건드린다 (매 프레임 layout/style 재계산 방지)
    const c = this._bars || (this._bars = {});
    const hpNow = Math.ceil(Math.max(0, p.hp));
    const hpMax = Math.round(p.maxHp);
    if (c.hp !== hpNow || c.hpMax !== hpMax) {
      c.hp = hpNow; c.hpMax = hpMax;
      const hpP = Math.max(0, p.hp / p.maxHp);
      this.dom.hpFill.style.width = (hpP * 100).toFixed(1) + '%';
      this.dom.hpText.textContent = hpNow + ' / ' + hpMax;
    }
    const xpNow = Math.floor(p.xp);
    if (c.xp !== xpNow || c.xpNext !== p.xpNext) {
      c.xp = xpNow; c.xpNext = p.xpNext;
      const xpP = Math.max(0, Math.min(1, p.xp / p.xpNext));
      this.dom.xpFill.style.width = (xpP * 100).toFixed(1) + '%';
      this.dom.xpText.textContent = xpNow + ' / ' + p.xpNext;
    }
    if (c.level !== p.level) {
      c.level = p.level;
      this.dom.levelText.textContent = 'Lv.' + p.level;
    }
    // 1차 진화 배지 (20레벨) · Q/E/X 슬롯 갱신
    if (c.evolved !== !!p.evolved) {
      c.evolved = !!p.evolved;
      if (this.dom.evoBadge) this.dom.evoBadge.classList.toggle('hidden', !p.evolved);
    }
    this.refreshSkillBar();
    this.refreshStamina(p, c);
    const dmg = p.damage.toFixed(1);
    const spd = Math.round(p.moveSpeed);
    const def = Math.round((p.armorDefense || 0) * 100);
    if (c.dmg !== dmg || c.spd !== spd || c.def !== def || c.bonus !== p.weaponBonus) {
      c.dmg = dmg; c.spd = spd; c.def = def; c.bonus = p.weaponBonus;
      const bonus = p.weaponBonus > 0 ? ' (+' + p.weaponBonus + ')' : '';
      const defense = ' · 피해 감소 ' + def + '%';
      this.dom.statRow.textContent = '공격력 ' + dmg + bonus + defense + ' · 이동속도 ' + spd;
    }
    this.updateGold();
    this.refreshPotions();
  }

  /* --------------------------- 스태미나 바 --------------------------- */
  // ST 100 / 100 — 평소엔 시안색, 지쳐서 대쉬가 잠긴 동안은 주황-빨강으로 깜박이며 이유를 알려 준다
  refreshStamina(p, cache) {
    if (!this.dom.stFill || !this.dom.stText) return;
    const c = cache || this._bars || (this._bars = {});
    const max = Math.max(1, p.maxStamina || 100);
    const now = Math.max(0, Math.min(max, p.stamina === undefined ? max : p.stamina));
    const shown = Math.floor(now);
    const exhausted = !!p.staminaExhausted;
    if (c.st !== shown || c.stMax !== max || c.stEx !== exhausted) {
      c.st = shown; c.stMax = max; c.stEx = exhausted;
      this.dom.stFill.style.width = ((now / max) * 100).toFixed(1) + '%';
      this.dom.stText.textContent = exhausted
        ? '회복 중… ' + shown + ' / ' + max
        : shown + ' / ' + max;
      if (this.dom.stRow) this.dom.stRow.classList.toggle('exhausted', exhausted);
      if (this.dom.stBar) this.dom.stBar.classList.toggle('exhausted', exhausted);
    }
    // 휴대폰 대쉬 버튼도 지친 동안은 흐리게
    if (this.touch.dashBtn) {
      const off = exhausted || now < 5;
      if (c.stBtn !== off) {
        c.stBtn = off;
        this.touch.dashBtn.classList.toggle('exhausted', off);
      }
    }
    if (this.touch.blockBtn) {
      const on = !!p.isBlocking;
      if (c.blkBtn !== on) {
        c.blkBtn = on;
        this.touch.blockBtn.classList.toggle('on', on);
      }
    }
  }

  // 스태미나가 다 차서 대쉬가 다시 열린 순간 — 바를 한 번 반짝인다
  staminaReady() {
    const bar = this.dom.stBar;
    if (!bar) return;
    bar.classList.remove('ready');
    void bar.offsetWidth;
    bar.classList.add('ready');
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (!p) return;
    this._acc = (this._acc || 0) + dt;

    // 체력 · 경험치
    this.refreshBars();

    // 버프 (문자열이 바뀔 때만 innerHTML 교체)
    const buffs = [];
    if (p.buffs.fortress > 0) buffs.push(['철벽 태세 ' + p.buffs.fortress.toFixed(1) + 's', '']);
    if (p.buffs.haste > 0) buffs.push(['신속 ' + p.buffs.haste.toFixed(1) + 's', 'frost']);
    if (p.buffs.elixir > 0) buffs.push(['전투의 비약 +35% ' + Math.ceil(p.buffs.elixir) + 's', 'attack']);
    if (p.buffs.rage > 0) buffs.push(['광폭 +60% ' + Math.ceil(p.buffs.rage) + 's', 'attack']);
    if (p.buffs.guard > 0) buffs.push(['수호 -50% 피해 ' + Math.ceil(p.buffs.guard) + 's', 'frost']);
    if (p.isBlocking) buffs.push(['🛡 막기 -50% 피해', 'guard']);
    const buffHtml = buffs.map((b) => '<span class="buff ' + b[1] + '">' + b[0] + '</span>').join('');
    if (buffHtml !== this._buffHtml) {
      this._buffHtml = buffHtml;
      this.dom.buffRow.innerHTML = buffHtml;
    }
    this._buffCount = buffs.length;

    // 지역
    const region = regionAt(p.position.x, p.position.z);
    if (region !== this.lastRegion) {
      const b = BIOMES[region];
      this.dom.regionName.textContent = b.name;
      this.dom.regionEn.textContent = b.en;
      if (this.lastRegion) {
        this.banner(b.name + ' · ' + b.en, 1600);
        g.sfx.gate();
      }
      this.lastRegion = region;
    }

    // 보스 바 — 가까운 보스를 따라간다 (1번째 세계 고대 골렘 · 2번째 세계 흑마법사)
    const boss = g.mobManager ? (g.mobManager.nearestBoss ? g.mobManager.nearestBoss(p.position, 520) : g.mobManager.boss()) : null;
    const bossNear = boss && !boss.dead;
    this.dom.bossWrap.classList.toggle('on', !!bossNear);
    if (bossNear) {
      const bp = Math.ceil(Math.max(0, boss.hp));
      if (this._bossName !== boss.type.name) {
        this._bossName = boss.type.name;
        if (this.dom.bossName) this.dom.bossName.textContent = boss.type.name;
      }
      if (this._bossHp !== bp || this._bossId !== boss.netId) {
        this._bossId = boss.netId;
        this._bossHp = bp;
        this.dom.bossFill.style.width = (Math.max(0, boss.hp / boss.maxHp) * 100).toFixed(1) + '%';
        this.dom.bossHpText.textContent = bp + ' / ' + boss.maxHp;
      }
    }

    // 대상(가장 가까운 몹)
    const near = g.mobManager ? g.mobManager.nearest(p.position, 200) : null;
    if (near) this.setTarget(near);
    this.targetTime += dt;
    if (this.target && (this.targetTime > 0.6 || this.target.dead) && this.target !== near) {
      this.target = near;
      this.targetTime = 0;
    }
    const tgt = near && !near.dead ? near : null;
    this.dom.targetWrap.classList.toggle('on', !!tgt && tgt !== boss);
    if (tgt) {
      const th = Math.ceil(Math.max(0, tgt.hp));
      if (this._targetHp !== th || this._targetId !== tgt.netId) {
        this._targetHp = th;
        this._targetId = tgt.netId;
        this.dom.targetName.textContent = tgt.type.name + '  Lv.' + tgt.level;
        this.dom.targetHpText.textContent = th + ' / ' + tgt.maxHp;
        this.dom.targetFill.style.width = (Math.max(0, tgt.hp / tgt.maxHp) * 100).toFixed(1) + '%';
      }
    }

    // 스킬 쿨다운 (숫자가 바뀔 때만 글씨 교체)
    const cd = this._cd || (this._cd = {});
    for (const key of ['attack', 'q', 'e', 'ult']) {
      const slot = this.skillSlots[key];
      if (!slot) continue;
      const value = key === 'attack' ? p.attackCooldown : (p.cooldowns[key] || 0);
      const cooling = value > 0.05;
      if (slot._cooling !== cooling) {
        slot._cooling = cooling;
        slot.el.classList.toggle('cooling', cooling);
      }
      const text = cooling ? (value >= 1 ? String(Math.ceil(value)) : value.toFixed(1)) : '';
      if (cd[key] !== text) {
        cd[key] = text;
        slot.cd.textContent = text;
      }
    }

    // 모바일 터치 버튼 쿨다운
    if (this.touch.q) {
      const cq = p.cooldowns.q;
      const ce = p.cooldowns.e;
      const cu = p.cooldowns.ult || 0;
      const tq = cq > 0.05 ? (cq >= 1 ? String(Math.ceil(cq)) : cq.toFixed(1)) : '';
      const te = ce > 0.05 ? (ce >= 1 ? String(Math.ceil(ce)) : ce.toFixed(1)) : '';
      const tu = cu > 0.05 ? (cu >= 1 ? String(Math.ceil(cu)) : cu.toFixed(1)) : '';
      if (cd.tq !== tq) { cd.tq = tq; this.touch.q.textContent = tq; }
      if (cd.te !== te) { cd.te = te; this.touch.e.textContent = te; }
      if (this.touch.ult && cd.tu !== tu) { cd.tu = tu; this.touch.ult.textContent = tu; }
      if (cd.tqc !== (cq > 0.05)) { cd.tqc = cq > 0.05; this.touch.qBtn.classList.toggle('cooling', cq > 0.05); }
      if (cd.tec !== (ce > 0.05)) { cd.tec = ce > 0.05; this.touch.eBtn.classList.toggle('cooling', ce > 0.05); }
      if (this.touch.ultBtn && cd.tuc !== (cu > 0.05)) {
        cd.tuc = cu > 0.05;
        this.touch.ultBtn.classList.toggle('cooling', cu > 0.05);
      }
    }

    // 미니맵 · 나침반은 화면을 보는 데 지장 없는 8fps 로만 다시 그린다
    if (this.mapOpen) {
      this._mapAcc = (this._mapAcc || 0) + dt;
      if (this._mapAcc > 0.12) {
        this._mapAcc = 0;
        this.drawMinimap(p);
        this.updateCompass(p);
      }
    }

    // 네임플레이트 · 데미지 숫자 (이름표는 20fps 면 충분하다)
    this._plateAcc = (this._plateAcc || 0) + dt;
    if (this._plateAcc > 0.05) {
      this._plateAcc = 0;
      this.updateNameplates();
      this.updatePlayerPlates();
    }
    this.updateFloaters(dt);

    // 배너 타이머
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.dom.banner.classList.remove('on');
    }
  }

  setTarget(mob) {
    this.target = mob;
    this.targetTime = 0;
  }

  banner(text, ms) {
    this.dom.banner.textContent = text;
    this.dom.banner.classList.add('on');
    this.bannerTimer = (ms || 1500) / 1000;
  }

  /* ------------------------------ 미니맵 ------------------------------ */
  drawMinimap(p) {
    const ctx = this.minimapCtx;
    const W = this.dom.minimap.width;
    const H = this.dom.minimap.height;
    // 지금 세계의 지역 경계로 지도 전체 범위를 정한다
    // (1번째 세계는 x -2500~2500 · z -1500~1500, 2번째 세계는 3000x3000)
    const order = biomeOrderFor(this.worldId);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const id of order) {
      const b = BIOMES[id];
      if (!b) continue;
      x0 = Math.min(x0, b.bounds.x0); x1 = Math.max(x1, b.bounds.x1);
      z0 = Math.min(z0, b.bounds.z0); z1 = Math.max(z1, b.bounds.z1);
    }
    if (!isFinite(x0)) { x0 = -2500; x1 = 2500; z0 = -1500; z1 = 1500; }
    const spanX = Math.max(1, x1 - x0);
    const spanZ = Math.max(1, z1 - z0);
    const scale = Math.min(W / spanX, H / spanZ) * 0.98;
    const offX = (W - spanX * scale) / 2;
    const offY = (H - spanZ * scale) / 2;
    const toPx = (x) => offX + (x - x0) * scale;
    const toPy = (z) => offY + (z - z0) * scale;
    ctx.clearRect(0, 0, W, H);

    // 배경
    ctx.fillStyle = 'rgba(8,10,14,0.75)';
    ctx.fillRect(0, 0, W, H);

    // 바이옴 사각형
    for (const id of order) {
      const b = BIOMES[id];
      if (!b) continue;
      const x = toPx(b.bounds.x0);
      const y = toPy(b.bounds.z0);
      const w = (b.bounds.x1 - b.bounds.x0) * scale;
      const h = (b.bounds.z1 - b.bounds.z0) * scale;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = b.minimap;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }

    // 랜드마크
    for (const id of order) {
      const b = BIOMES[id];
      if (!b) continue;
      ctx.fillStyle = (id === 'temple' || id === 'dark_realm') ? '#ffe9a8' : 'rgba(255,255,255,0.55)';
      const lx = toPx(b.landmarkPos.x);
      const ly = toPy(b.landmarkPos.z);
      ctx.beginPath();
      ctx.moveTo(lx, ly - 3.5);
      ctx.lineTo(lx + 3.5, ly);
      ctx.lineTo(lx, ly + 3.5);
      ctx.lineTo(lx - 3.5, ly);
      ctx.closePath();
      ctx.fill();
    }

    // 상점 자리 — 어느 마을에 상점이 있는지 지도에서 바로 보이게
    for (const id of order) {
      const b = BIOMES[id];
      if (!b || !b.shop) continue;
      const sx = toPx(b.shop.x);
      const sy = toPy(b.shop.z);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(sx - 2.6, sy - 2.6, 5.2, 5.2);
      ctx.strokeStyle = 'rgba(60,30,0,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 2.6, sy - 2.6, 5.2, 5.2);
    }

    // 몹 점
    if (this.game.mobManager) {
      for (const m of this.game.mobManager.mobs) {
        if (m.dead) continue;
        const d = Math.hypot(m.position.x - p.position.x, m.position.z - p.position.z);
        if (d > 620) continue;
        ctx.fillStyle = m.type.boss ? '#ff6b4a' : 'rgba(255,120,90,0.9)';
        const r = m.type.boss ? 4.5 : 1.8;
        ctx.beginPath();
        ctx.arc(toPx(m.position.x), toPy(m.position.z), r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 함께 하는 친구 위치
    const net = this.game.net;
    if (net && net.active && net.remotes.size) {
      for (const rec of net.remotes.values()) {
        const bx = toPx(rec.x);
        const by = toPy(rec.z);
        ctx.beginPath();
        ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#8fd0ff';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 플레이어
    const px = toPx(p.position.x);
    const py = toPy(p.position.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-p.facing + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.4, 5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-4.4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 시야 방향 표시
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.stroke();

    // 북쪽 표시
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', W / 2, 10);
  }

  updateCompass(p) {
    const camForward = this.game.camYaw + Math.PI;
    for (const id of compassOrderFor(this.worldId)) {
      const b = BIOMES[id];
      if (!b) continue;
      const c = this.compSide[id];
      if (!c) continue;
      const dx = b.center.x - p.position.x;
      const dz = b.center.z - p.position.z;
      const dist = Math.hypot(dx, dz);
      const bearing = Math.atan2(dx, dz);
      let rel = bearing - camForward;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      c.arrow.style.transform = 'rotate(' + (-rel * 180 / Math.PI).toFixed(1) + 'deg)';
      c.dist.textContent = Math.round(dist / 10) + 'm';
      const here = regionAt(p.position.x, p.position.z) === id;
      c.row.classList.toggle('active', here);
    }
  }

  /* --------------------------- 네임플레이트 --------------------------- */
  updateNameplates() {
    const g = this.game;
    const p = g.player;
    const cam = g.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const mobs = g.mobManager ? g.mobManager.mobs : [];
    let used = 0;
    const v = this._plateV || (this._plateV = new THREE.Vector3());
    for (const m of mobs) {
      if (m.dead) continue;
      const d = Math.hypot(m.position.x - p.position.x, m.position.z - p.position.z);
      if (d > 280) continue;
      v.set(m.position.x, m.position.y + m.height + 6, m.position.z).project(cam);
      if (v.z > 1 || v.z < -1) continue;
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      if (sx < -100 || sx > w + 100 || sy < -50 || sy > h + 50) continue;
      let np = this.namePlatePool[used];
      if (!np) {
        const el = document.createElement('div');
        el.className = 'nameplate';
        el.innerHTML = '<div class="np-name"></div><div class="np-bar"><div class="np-fill"></div></div>';
        this.dom.nameplates.appendChild(el);
        np = { el, name: el.querySelector('.np-name'), fill: el.querySelector('.np-fill'), label: '', w: '' };
        this.namePlatePool.push(np);
      }
      used++;
      np.el.style.display = 'block';
      np.el.style.left = sx + 'px';
      np.el.style.top = sy + 'px';
      const label = m.type.name + ' Lv.' + m.level;
      if (np.label !== label) { np.label = label; np.name.textContent = label; }
      const hpW = (Math.max(0, m.hp / m.maxHp) * 100).toFixed(1) + '%';
      if (np.w !== hpW) { np.w = hpW; np.fill.style.width = hpW; }
      if (np.boss !== !!m.type.boss) { np.boss = !!m.type.boss; np.el.classList.toggle('boss', !!m.type.boss); }
    }
    for (let i = used; i < this.namePlatePool.length; i++) {
      this.namePlatePool[i].el.style.display = 'none';
    }
  }

  /* ------------------------ 함께 하는 친구 이름표 ------------------------ */
  updatePlayerPlates() {
    const g = this.game;
    const net = g.net;
    const pool = this.playerPlatePool;
    let used = 0;
    if (net && net.active && net.remotes.size && g.camera) {
      const cam = g.camera;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const v = this._plateV || (this._plateV = new THREE.Vector3());
      for (const rec of net.remotes.values()) {
        const rig = rec.rig;
        if (!rig) continue;
        v.set(rig.position.x, rig.position.y + 26, rig.position.z).project(cam);
        if (v.z > 1 || v.z < -1) continue;
        const sx = (v.x * 0.5 + 0.5) * w;
        const sy = (-v.y * 0.5 + 0.5) * h;
        if (sx < -120 || sx > w + 120 || sy < -60 || sy > h + 60) continue;
        let np = pool[used];
        if (!np) {
          const el = document.createElement('div');
          el.className = 'nameplate player';
          el.innerHTML = '<div class="np-name"></div><div class="np-bar"><div class="np-fill"></div></div>';
          this.dom.nameplates.appendChild(el);
          np = { el, name: el.querySelector('.np-name'), fill: el.querySelector('.np-fill'), label: '', w: '' };
          pool.push(np);
        }
        used++;
        np.el.style.display = 'block';
        np.el.style.left = sx + 'px';
        np.el.style.top = sy + 'px';
        const cls = CLASSES[rec.classId];
        const label = (rec.nick || '친구') + (cls ? ' · ' + cls.name : '') + ' Lv.' + (rec.level || 1);
        if (np.label !== label) { np.label = label; np.name.textContent = label; }
        const w2 = (Math.max(0, Math.min(1, (rec.hp || 0) / (rec.maxHp || 1))) * 100).toFixed(1) + '%';
        if (np.w !== w2) { np.w = w2; np.fill.style.width = w2; }
        if (np.dead !== !rec.alive) { np.dead = !rec.alive; np.el.classList.toggle('dead', !rec.alive); }
      }
    }
    for (let i = used; i < pool.length; i++) pool[i].el.style.display = 'none';
  }

  /* ---------------------------- 데미지 숫자 ---------------------------- */
  floater(text, worldPos, kind, scale) {
    if (this.floaters.length > 34) return;
    const el = document.createElement('div');
    el.className = 'floater' + (kind === 'crit' ? ' crit' : kind === 'hurt' ? ' hurt' : kind === 'heal' ? ' heal' : kind === 'xp' ? ' xp' : kind === 'gold' ? ' gold' : kind === 'block' ? ' block' : kind === 'stam' ? ' stam' : '');
    el.textContent = text;
    this.dom.floaters.appendChild(el);
    const f = {
      el,
      pos: new THREE.Vector3(worldPos.x, worldPos.y + (kind === 'xp' ? 6 : kind === 'gold' ? 12 : 0), worldPos.z),
      life: kind === 'xp' || kind === 'gold' ? 1.3 : 0.9,
      maxLife: kind === 'xp' || kind === 'gold' ? 1.3 : 0.9,
      scale: scale || 1,
      offX: (Math.random() - 0.5) * 26,
    };
    this.floaters.push(f);
  }

  updateFloaters(dt) {
    const cam = this.game.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = this._floatV || (this._floatV = new THREE.Vector3());
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.pos.y += dt * 16;
      const p = 1 - f.life / f.maxLife;
      v.copy(f.pos).project(cam);
      if (v.z > 1) { f.el.style.opacity = 0; }
      else {
        const sx = (v.x * 0.5 + 0.5) * w + f.offX;
        const sy = (-v.y * 0.5 + 0.5) * h;
        f.el.style.left = sx + 'px';
        f.el.style.top = sy + 'px';
        f.el.style.opacity = String(Math.max(0, 1 - p * p));
        f.el.style.transform = 'translate(-50%,-50%) scale(' + (f.scale * (1 + p * 0.35)).toFixed(2) + ')';
      }
      if (f.life <= 0) {
        f.el.remove();
        this.floaters.splice(i, 1);
      }
    }
  }

  /* ----------------------------- 오버레이 ----------------------------- */
  showEnd(kind, stats, opts) {
    const d = this.dom;
    const o = opts || {};
    d.endOverlay.classList.remove('hidden');
    if (kind === 'victory') {
      if (o.kind === 'world2') {
        d.endEyebrow.textContent = 'VICTORY · 흑마법사';
        d.endTitle.textContent = '흑마법사를 쓰러뜨렸습니다!';
        d.endLead.textContent = '두 세계를 모두 구했습니다. 2번째 세계의 어둠이 걷혔으니, 원하는 만큼 더 돌아다니며 즐겨 보세요. 포털로 두 세계를 오갈 수 있습니다.';
        d.endPrimary.textContent = '계속 탐험하기';
      } else {
        d.endEyebrow.textContent = 'VICTORY · 정글 사원';
        d.endTitle.textContent = '고대 골렘을 쓰러뜨렸습니다!';
        d.endLead.textContent = '잠들어 있던 사원의 주인이 무너졌습니다. 이제 다섯 지역은 다시 평화를 되찾았습니다.';
        d.endPrimary.textContent = '계속 탐험하기';
      }
    } else {
      d.endEyebrow.textContent = 'DEFEATED';
      d.endTitle.textContent = '쓰러졌습니다…';
      d.endLead.textContent = '태초마을 광장에서 다시 일어납니다. 레벨 · 장비 · 포션은 그대로 유지되니 상점에서 정비하고 다시 도전해 보세요.';
      d.endPrimary.textContent = '부활하기';
    }
    d.endStats.innerHTML = stats.map((s) =>
      '<div class="end-stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'
    ).join('');
  }

  hideEnd() {
    this.dom.endOverlay.classList.add('hidden');
  }

  setCrosshair(on) {
    this.dom.crosshair.classList.toggle('on', !!on);
  }

  hideLoader() {
    this.dom.loader.classList.add('done');
    setTimeout(() => { this.dom.loader.style.display = 'none'; }, 600);
  }
}
