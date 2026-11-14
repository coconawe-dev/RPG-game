// HUD: 상태창 · 지역 표시 · 미니맵 · 나침반 · 스킬바 · 네임플레이트 · 데미지 숫자
import * as THREE from 'three';
import { CLASSES, CLASS_ORDER, BIOMES, COMPASS_ORDER, BIOME_ORDER } from './config.js';
import { regionAt } from './utils.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.dom = {
      classBadge: $('class-badge'),
      weaponTag: $('weapon-tag'),
      levelText: $('level-text'),
      hpFill: $('hp-fill'),
      hpText: $('hp-text'),
      xpFill: $('xp-fill'),
      xpText: $('xp-text'),
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
      banner: $('banner'),
      floaters: $('floaters'),
      nameplates: $('nameplates'),
      skillbar: $('skillbar'),
      controlsPanel: $('controls-panel'),
      controlsToggle: $('controls-toggle'),
      ctrlQ: $('ctrl-q'),
      ctrlE: $('ctrl-e'),
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
    this.compSide = {};
    this.target = null;
    this.targetTime = 0;
    this.bannerTimer = 0;
    this.lastRegion = null;
    this.lastHp = -1;
    this.skillSlots = {};

    this.buildCompass();
    this.buildClassCards();
    this.buildSkillBar(null);

    this.dom.controlsToggle.addEventListener('click', () => {
      const p = this.dom.controlsPanel;
      p.classList.toggle('collapsed');
      this.dom.controlsToggle.textContent = p.classList.contains('collapsed') ? '펼치기' : '접기';
    });
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
        '<p class="cc-weapon">🗡 ' + c.weaponName + '</p>' +
        '<p class="cc-desc">' + c.desc + '</p>' +
        this.statBar('체력', c.stats.hp) +
        this.statBar('공격', c.stats.dmg) +
        this.statBar('속도', c.stats.spd) +
        this.statBar('사거리', c.stats.rng) +
        '<div class="cc-skills">' +
        '<div class="cc-skill"><b>Q</b>' + c.skills.q.name + ' <span style="opacity:.6">(' + c.skills.q.cooldown + '초)</span></div>' +
        '<div class="cc-skill"><b>E</b>' + c.skills.e.name + ' <span style="opacity:.6">(' + c.skills.e.cooldown + '초)</span></div>' +
        '</div>';
      card.addEventListener('click', () => this.game.startClass(id));
      grid.appendChild(card);
    }
  }

  statBar(label, v) {
    return '<div class="cc-stat"><span>' + label + '</span><i><b style="width:' + Math.round(v * 100) + '%"></b></i></div>';
  }

  /* ----------------------------- 스킬바 ----------------------------- */
  buildSkillBar(player) {
    const bar = this.dom.skillbar;
    bar.innerHTML = '';
    this.skillSlots = {};
    if (!player) return;
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
    const sAtk = mkSlot('attack', '좌클릭', c.glyph, '기본 공격', ' attack-slot');
    const sQ = mkSlot('q', 'Q', c.skills.q.icon, c.skills.q.name);
    const sE = mkSlot('e', 'E', c.skills.e.icon, c.skills.e.name);
    this.skillSlots = {
      attack: { el: sAtk, cd: sAtk.querySelector('.slot-cd') },
      q: { el: sQ, cd: sQ.querySelector('.slot-cd') },
      e: { el: sE, cd: sE.querySelector('.slot-cd') },
    };
    this.dom.ctrlQ.textContent = 'Q · ' + c.skills.q.name;
    this.dom.ctrlE.textContent = 'E · ' + c.skills.e.name;
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
    box.innerHTML = '';
    this.compSide = {};
    for (const id of COMPASS_ORDER) {
      const b = BIOMES[id];
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

  /* ------------------------------ 갱신 ------------------------------ */
  onStart(player) {
    const c = player.cls;
    this.dom.classBadge.textContent = c.name;
    this.dom.weaponTag.textContent = c.weaponName.split(' ')[0];
    this.buildSkillBar(player);
    this.refreshBars();
    this.dom.startOverlay.classList.add('hidden');
    this.dom.hint.classList.remove('fade');
    this.dom.hint.style.opacity = '';
    setTimeout(() => { this.dom.hint.classList.add('fade'); }, 4200);
  }

  refreshBars() {
    const p = this.game.player;
    if (!p) return;
    const hpP = Math.max(0, p.hp / p.maxHp);
    this.dom.hpFill.style.width = (hpP * 100).toFixed(1) + '%';
    this.dom.hpText.textContent = Math.ceil(Math.max(0, p.hp)) + ' / ' + Math.round(p.maxHp);
    const xpP = Math.max(0, Math.min(1, p.xp / p.xpNext));
    this.dom.xpFill.style.width = (xpP * 100).toFixed(1) + '%';
    this.dom.xpText.textContent = Math.floor(p.xp) + ' / ' + p.xpNext;
    this.dom.levelText.textContent = 'Lv.' + p.level;
    this.dom.statRow.textContent = '공격력 ' + p.damage.toFixed(1) + ' · 이동속도 ' + Math.round(p.moveSpeed);
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (!p) return;

    // 체력 · 경험치
    this.refreshBars();

    // 버프
    const buffs = [];
    if (p.buffs.fortress > 0) buffs.push(['철벽 태세 ' + p.buffs.fortress.toFixed(1) + 's', '']);
    if (p.buffs.haste > 0) buffs.push(['신속 ' + p.buffs.haste.toFixed(1) + 's', 'frost']);
    if (buffs.length !== this._buffCount) {
      this.dom.buffRow.innerHTML = buffs.map((b) => '<span class="buff ' + b[1] + '">' + b[0] + '</span>').join('');
    } else if (buffs.length) {
      this.dom.buffRow.innerHTML = buffs.map((b) => '<span class="buff ' + b[1] + '">' + b[0] + '</span>').join('');
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

    // 보스 바
    const boss = g.mobManager ? g.mobManager.boss() : null;
    const bossNear = boss && !boss.dead && Math.hypot(boss.position.x - p.position.x, boss.position.z - p.position.z) < 520;
    this.dom.bossWrap.classList.toggle('on', !!bossNear);
    if (bossNear) {
      const bp = Math.max(0, boss.hp / boss.maxHp);
      this.dom.bossFill.style.width = (bp * 100).toFixed(1) + '%';
      this.dom.bossHpText.textContent = Math.ceil(Math.max(0, boss.hp)) + ' / ' + boss.maxHp;
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
      this.dom.targetName.textContent = tgt.type.name + '  Lv.' + tgt.level;
      this.dom.targetHpText.textContent = Math.ceil(Math.max(0, tgt.hp)) + ' / ' + tgt.maxHp;
      this.dom.targetFill.style.width = (Math.max(0, tgt.hp / tgt.maxHp) * 100).toFixed(1) + '%';
    }

    // 스킬 쿨다운
    const cdState = { q: p.cooldowns.q, e: p.cooldowns.e, attack: p.attackCooldown };
    for (const key of ['attack', 'q', 'e']) {
      const slot = this.skillSlots[key];
      if (!slot) continue;
      const cd = cdState[key];
      const cooling = cd > 0.05;
      slot.el.classList.toggle('cooling', cooling);
      if (cooling) slot.cd.textContent = cd >= 1 ? Math.ceil(cd) : cd.toFixed(1);
    }

    // 미니맵 · 나침반
    this.drawMinimap(p);
    this.updateCompass(p);

    // 네임플레이트 · 데미지 숫자
    this.updateNameplates();
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
    const scale = W / 3000;
    const toPx = (x) => (x + 1500) * scale;
    const toPy = (z) => (z + 1500) * scale;
    ctx.clearRect(0, 0, W, H);

    // 배경
    ctx.fillStyle = 'rgba(8,10,14,0.75)';
    ctx.fillRect(0, 0, W, H);

    // 바이옴 사각형
    for (const id of BIOME_ORDER) {
      const b = BIOMES[id];
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
    for (const id of BIOME_ORDER) {
      const b = BIOMES[id];
      ctx.fillStyle = id === 'temple' ? '#ffe9a8' : 'rgba(255,255,255,0.55)';
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
    for (const id of COMPASS_ORDER) {
      const b = BIOMES[id];
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
    const v = new THREE.Vector3();
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
        np = { el, name: el.querySelector('.np-name'), fill: el.querySelector('.np-fill') };
        this.namePlatePool.push(np);
      }
      used++;
      np.el.style.display = 'block';
      np.el.style.left = sx + 'px';
      np.el.style.top = sy + 'px';
      np.name.textContent = m.type.name + ' Lv.' + m.level;
      np.fill.style.width = (Math.max(0, m.hp / m.maxHp) * 100).toFixed(1) + '%';
      np.el.classList.toggle('boss', !!m.type.boss);
    }
    for (let i = used; i < this.namePlatePool.length; i++) {
      this.namePlatePool[i].el.style.display = 'none';
    }
  }

  /* ---------------------------- 데미지 숫자 ---------------------------- */
  floater(text, worldPos, kind, scale) {
    if (this.floaters.length > 34) return;
    const el = document.createElement('div');
    el.className = 'floater' + (kind === 'crit' ? ' crit' : kind === 'hurt' ? ' hurt' : kind === 'heal' ? ' heal' : kind === 'xp' ? ' xp' : '');
    el.textContent = text;
    this.dom.floaters.appendChild(el);
    const f = {
      el,
      pos: new THREE.Vector3(worldPos.x, worldPos.y + (kind === 'xp' ? 6 : 0), worldPos.z),
      life: kind === 'xp' ? 1.3 : 0.9,
      maxLife: kind === 'xp' ? 1.3 : 0.9,
      scale: scale || 1,
      offX: (Math.random() - 0.5) * 26,
    };
    this.floaters.push(f);
  }

  updateFloaters(dt) {
    const cam = this.game.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = new THREE.Vector3();
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
  showEnd(kind, stats) {
    const d = this.dom;
    d.endOverlay.classList.remove('hidden');
    if (kind === 'victory') {
      d.endEyebrow.textContent = 'VICTORY · 정글 사원';
      d.endTitle.textContent = '고대 골렘을 쓰러뜨렸습니다!';
      d.endLead.textContent = '잠들어 있던 사원의 주인이 무너졌습니다. 이제 다섯 지역은 다시 평화를 되찾았습니다.';
      d.endPrimary.textContent = '계속 탐험하기';
    } else {
      d.endEyebrow.textContent = 'DEFEATED';
      d.endTitle.textContent = '쓰러졌습니다…';
      d.endLead.textContent = '다시 일어나 정글 사원에 도전해 보세요. 레벨과 장비는 그대로 유지됩니다.';
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
