// 특별 퀘스트 — 1·2·3세계 태초마을의 NPC 에게 말을 걸어 받는 의뢰
//   · 순차 퀘스트(src/quests.js)와 완전히 따로 센다 (NPC 에게 수락 → 목표 달성 → NPC 에게 보상 받기)
//   · 처치는 main.js 의 recordKill 한 곳으로 모이므로 혼자 하기 · 호스트 · 친구(멀티플레이) 처치가 모두 세어진다
//   · 화면(DOM)도 three.js 도 쓰지 않는 순수 로직이라 tests/smoke.mjs 에서 그대로 검증한다
import { SPECIAL_QUESTS, MOB_TYPES, specialDefFor } from './config.js';
import { normWorld } from './utils.js';

// 퀘스트 한 줄의 상태
export const SPECIAL_STATE = {
  AVAILABLE: 'available',   // 아직 받지 않음
  ACTIVE: 'active',         // 진행 중
  READY: 'ready',           // 목표 달성 · NPC 에게 보상 받기 기다리는 중
  CLAIMED: 'claimed',       // 보상까지 받음
};

// 몹 id -> 화면에 쓰는 이름
export function specialMobName(mob) {
  const t = MOB_TYPES[mob];
  return (t && t.name) || mob;
}

// 한 목표의 문구 — 예: "고릴라 15마리"
export function specialGoalText(goal) {
  if (!goal) return '';
  return specialMobName(goal.mob) + ' ' + goal.target + '마리';
}

// 퀘스트 전체 목표 문구 — 예: "고릴라 15마리 + 고대 골렘 1마리"
export function specialQuestGoalText(quest) {
  if (!quest || !quest.goals) return '';
  return quest.goals.map(specialGoalText).join(' + ');
}

// 그 세계의 특별 퀘스트 정의 (모르는 세계는 1세계)
export function specialDef(worldId) {
  return specialDefFor(normWorld(worldId));
}

// 한 줄 요약 — 예: "고릴라 3/15 · 고대 골렘 0/1"
export function specialProgressText(entry) {
  if (!entry || !entry.goals) return '';
  return entry.goals.map((g) => g.name + ' ' + g.progress + '/' + g.target).join(' · ');
}

/* ------------------------------------------------------------------
   세 세계의 특별 퀘스트 기록장
------------------------------------------------------------------ */
export class SpecialQuestLog {
  constructor(defs) {
    this.defs = defs || SPECIAL_QUESTS;
    this.reset();
  }

  // 새 게임을 시작하면 처음 상태로 (아직 아무 퀘스트도 받지 않음)
  reset() {
    this.records = {};
    for (const w in this.defs) {
      const world = this.defs[w];
      const rec = {};
      for (const q of (world.quests || [])) rec[q.id] = { state: SPECIAL_STATE.AVAILABLE, count: {} };
      this.records[w] = rec;
    }
  }

  world(worldId) { return specialDef(worldId); }
  npc(worldId) { return specialDef(worldId).npc; }
  questDefs(worldId) { return specialDef(worldId).quests || []; }

  _def(worldId, questId) {
    return this.questDefs(worldId).find((q) => q.id === questId) || null;
  }

  _rec(worldId, questId) {
    const w = normWorld(worldId);
    const all = this.records[w] || {};
    if (!all[questId]) all[questId] = { state: SPECIAL_STATE.AVAILABLE, count: {} };
    this.records[w] = all;
    return all[questId];
  }

  // 화면에 그릴 수 있는 한 줄 (정의 + 진행 + 상태)
  entry(worldId, quest) {
    const def = typeof quest === 'string' ? this._def(worldId, quest) : quest;
    if (!def) return null;
    const rec = this._rec(worldId, def.id);
    const goals = (def.goals || []).map((g) => {
      const progress = Math.min(g.target, rec.count[g.mob] || 0);
      return {
        mob: g.mob, name: specialMobName(g.mob), target: g.target,
        progress, done: progress >= g.target,
      };
    });
    const totalTarget = goals.reduce((s, g) => s + g.target, 0) || 1;
    const totalDone = goals.reduce((s, g) => s + g.progress, 0);
    const e = {
      id: def.id, title: def.title, desc: def.desc, line: def.line || '',
      rewardGold: def.rewardGold || 0, rewardXp: def.rewardXp || 0,
      goals, state: rec.state,
      available: rec.state === SPECIAL_STATE.AVAILABLE,
      active: rec.state === SPECIAL_STATE.ACTIVE,
      ready: rec.state === SPECIAL_STATE.READY,
      claimed: rec.state === SPECIAL_STATE.CLAIMED,
      fraction: Math.min(1, totalDone / totalTarget),
    };
    e.progressText = specialProgressText(e);
    e.goalText = specialQuestGoalText(def);
    return e;
  }

  // 그 세계의 모든 특별 퀘스트 (받는 순서 그대로)
  entries(worldId) {
    return this.questDefs(worldId).map((q) => this.entry(worldId, q)).filter(Boolean);
  }

  // NPC 에게 말을 걸어 의뢰를 받는다
  accept(worldId, questId) {
    const def = this._def(worldId, questId);
    if (!def) return { ok: false, msg: '그런 의뢰는 없습니다' };
    const rec = this._rec(worldId, def.id);
    if (rec.state === SPECIAL_STATE.ACTIVE) return { ok: false, msg: '이미 진행 중인 의뢰입니다', quest: this.entry(worldId, def) };
    if (rec.state === SPECIAL_STATE.READY) return { ok: false, msg: '목표를 채웠습니다 — 보상을 받아 주세요', quest: this.entry(worldId, def) };
    if (rec.state === SPECIAL_STATE.CLAIMED) return { ok: false, msg: '이미 완료한 의뢰입니다', quest: this.entry(worldId, def) };
    rec.state = SPECIAL_STATE.ACTIVE;
    rec.count = {};
    return { ok: true, msg: '의뢰를 받았습니다 — ' + specialQuestGoalText(def), quest: this.entry(worldId, def) };
  }

  // 목표를 채운 의뢰의 보상을 받는다 (지급은 호출한 쪽이 한다)
  claim(worldId, questId) {
    const def = this._def(worldId, questId);
    if (!def) return { ok: false, msg: '그런 의뢰는 없습니다' };
    const rec = this._rec(worldId, def.id);
    if (rec.state === SPECIAL_STATE.CLAIMED) return { ok: false, msg: '이미 보상을 받은 의뢰입니다' };
    if (rec.state !== SPECIAL_STATE.READY) return { ok: false, msg: '아직 목표를 다 채우지 못했습니다' };
    rec.state = SPECIAL_STATE.CLAIMED;
    const entry = this.entry(worldId, def);
    return {
      ok: true,
      msg: '⭐ ' + def.title + ' 완료! +' + def.rewardGold + ' G · +' + def.rewardXp + ' XP',
      quest: entry,
      rewardGold: def.rewardGold || 0,
      rewardXp: def.rewardXp || 0,
    };
  }

  /* 몹 하나를 잡았다고 알린다.
     · 그 세계에서 진행 중인 특별 퀘스트의 몹만 센다
     · 목표를 모두 채운 퀘스트는 state = 'ready' 가 되고 completed 목록으로 돌려준다 (보상 지급은 NPC 에서) */
  recordKill(worldId, mobType) {
    if (!mobType) return [];
    const out = [];
    for (const def of this.questDefs(worldId)) {
      const rec = this._rec(worldId, def.id);
      if (rec.state !== SPECIAL_STATE.ACTIVE) continue;
      const goal = (def.goals || []).find((g) => g.mob === mobType);
      if (!goal) continue;
      const before = rec.count[mobType] || 0;
      if (before >= goal.target) continue;
      rec.count[mobType] = before + 1;
      const goals = def.goals.map((g) => ({
        mob: g.mob, progress: Math.min(g.target, rec.count[g.mob] || 0), target: g.target,
      }));
      const allDone = goals.every((g) => g.progress >= g.target);
      if (allDone) rec.state = SPECIAL_STATE.READY;
      out.push({
        quest: this.entry(worldId, def),
        completed: allDone,
      });
    }
    return out;
  }

  // 지금 화면에 보여 줄 한 줄 (보상 받을 의뢰 → 진행 중인 의뢰 순)
  focus(worldId) {
    const all = this.entries(worldId);
    return all.find((e) => e.ready) || all.find((e) => e.active) || null;
  }

  readyCount(worldId) { return this.entries(worldId).filter((e) => e.ready).length; }
  claimedCount(worldId) { return this.entries(worldId).filter((e) => e.claimed).length; }

  /* HUD · 안내 문구가 그대로 쓸 수 있는 상태 */
  status(worldId) {
    const w = normWorld(worldId);
    const def = specialDef(w);
    const all = this.entries(w);
    const focus = this.focus(w);
    const ready = all.filter((e) => e.ready);
    const claimed = all.filter((e) => e.claimed);
    let hint = '';
    if (ready.length) hint = '보상 받으러 ' + def.npc.name + ' 에게!';
    else if (focus) hint = specialProgressText(focus);
    else if (claimed.length === all.length && all.length) hint = '모든 특별 퀘스트 완료 ✨';
    else hint = 'NPC 에게 말을 걸어 의뢰를 받으세요';
    return {
      world: w,
      npcName: def.npc.name,
      npcShort: def.npc.name.split(' ').pop(),
      total: all.length,
      ready: ready.length,
      claimed: claimed.length,
      focus,
      quest: focus,
      title: '⭐ 특별 퀘스트',
      hint,
      done: !!all.length && claimed.length === all.length,
      flashReady: ready.length > 0,
    };
  }
}

/* ------------------------------------------------------------------
   게임 쪽 연결점 — 수락 · 처치 · 보상 (main.js 가 그대로 부른다)
   DOM 없이도 돌도록 game 의 메서드 · hud 는 있을 때만 쓴다
------------------------------------------------------------------ */

// NPC 창에서 "의뢰 받기"를 눌렀을 때
export function acceptSpecialQuest(game, worldId, questId) {
  const log = game && game.specialQuests;
  if (!log) return { ok: false, msg: '지금은 의뢰를 받을 수 없습니다' };
  const res = log.accept(normWorld(worldId), questId);
  if (res.ok) {
    if (game.hud) {
      if (game.hud.banner) game.hud.banner('⭐ 특별 퀘스트 수락 · ' + res.quest.title, 2400);
      if (game.hud.refreshSpecial) game.hud.refreshSpecial(true);
    }
    if (game.sfx && game.sfx.coin) game.sfx.coin();
  }
  return res;
}

// 목표를 채운 의뢰의 보상을 받는다 — 골드 + 경험치 지급
// · game.addGold / player.gainXp 가 없으면(테스트 스텁) 그냥 수치만 돌려준다
export function claimSpecialQuest(game, worldId, questId) {
  const log = game && game.specialQuests;
  if (!log) return { ok: false, msg: '지금은 보상을 받을 수 없습니다' };
  const res = log.claim(normWorld(worldId), questId);
  if (!res.ok) return res;
  if (res.rewardGold) {
    if (typeof game.addGold === 'function') game.addGold(res.rewardGold);
    else game.gold = (Number(game.gold) || 0) + res.rewardGold;
  }
  if (res.rewardXp) {
    if (game.player && typeof game.player.gainXp === 'function') game.player.gainXp(res.rewardXp);
    else if (game.player) game.player.xp = (Number(game.player.xp) || 0) + res.rewardXp;
  }
  if (game.hud) {
    if (game.hud.banner) game.hud.banner(res.msg, 3200);
    if (game.hud.questFlash) game.hud.questFlash();
    if (game.hud.refreshSpecial) game.hud.refreshSpecial(true);
  }
  if (game.sfx && game.sfx.levelup) game.sfx.levelup();
  return res;
}

// 몹 하나를 잡았을 때 — 특별 퀘스트 진행을 세고, 다 채우면 배너로 알린다
export function feedSpecialKill(game, worldId, mobType) {
  const log = game && game.specialQuests;
  if (!log || !mobType) return [];
  const w = normWorld(worldId);
  const events = log.recordKill(w, mobType);
  if (!events.length) return events;
  // 친구(멀티플레이) 처치로 창이 열린 채 진행이 바뀔 수 있다 — 열려 있으면 다시 그린다
  if (game.specialDialog && game.specialDialog.isOpen) game.specialDialog.refresh();
  if (game.hud && game.hud.refreshSpecial) game.hud.refreshSpecial();
  const done = events.filter((e) => e.completed);
  if (!done.length) return events;
  const ev = done[0];
  const npc = log.npc(w);
  if (game.hud) {
    if (game.hud.banner) {
      game.hud.banner('⭐ 특별 퀘스트 목표 달성! ' + ev.quest.title + ' — ' + npc.name + ' 에게 보상을 받으세요', 3600);
    }
    if (game.hud.questFlash) game.hud.questFlash();
    if (game.hud.refreshSpecial) game.hud.refreshSpecial(true);
  }
  if (game.sfx && game.sfx.levelup) game.sfx.levelup();
  return events;
}

/* ------------------------------------------------------------------
   특별 퀘스트 창 (NPC 에게 말을 걸면 열린다)
------------------------------------------------------------------ */
const $ = (id) => (typeof document === 'undefined' ? null : document.getElementById(id));

export class SpecialQuestDialog {
  constructor(game) {
    this.game = game;
    this.root = $('special-overlay');
    this.listEl = $('special-list');
    this.eyebrowEl = $('special-eyebrow');
    this.titleEl = $('special-modal-title');
    this.lineEl = $('special-line');
    this.toastEl = $('special-toast');
    this.closeBtn = $('special-close');
    this.isOpen = false;
    this.worldId = 1;
    this._toastTimer = 0;

    const act = (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-special]') : null;
      if (!btn) return;
      if (e.cancelable) e.preventDefault();
      const action = btn.getAttribute('data-special');
      const id = btn.getAttribute('data-quest');
      if (!id) return;
      const now = Date.now();
      if (this._last && this._last.id === id && this._last.action === action && now - this._last.t < 400) return;
      this._last = { id, action, t: now };
      const res = action === 'claim'
        ? this.game.claimSpecialQuest(id)
        : this.game.acceptSpecialQuest(id);
      this.refresh();
      this.toast(res.msg, res.ok);
    };
    if (this.listEl) {
      this.listEl.addEventListener('click', act);
      this.listEl.addEventListener('touchstart', act, { passive: false });
    }
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.game.closeSpecialDialog());
    if (this.root) {
      this.root.addEventListener('click', (e) => {
        if (e.target === this.root) this.game.closeSpecialDialog();
      });
    }
  }

  open(worldId) {
    this.worldId = normWorld(worldId);
    const def = specialDef(this.worldId);
    const npc = def.npc;
    if (this.eyebrowEl) this.eyebrowEl.textContent = this.worldId + '세계 태초마을 · 특별 퀘스트';
    if (this.titleEl) this.titleEl.textContent = npc.name;
    if (this.lineEl) {
      const st = this.game.specialQuests ? this.game.specialQuests.status(this.worldId) : null;
      const readyNow = st && st.ready > 0;
      this.lineEl.textContent = '"' + (readyNow ? npc.greeting || npc.line : npc.line) + '"';
    }
    if (this.root) this.root.classList.remove('hidden');
    this.isOpen = true;
    document.body.classList.add('special-open');
    this.refresh();
  }

  close() {
    if (!this.root) return;
    this.root.classList.add('hidden');
    this.isOpen = false;
    document.body.classList.remove('special-open');
    if (this.toastEl) this.toastEl.classList.remove('on');
  }

  refresh() {
    const log = this.game && this.game.specialQuests;
    if (!log || !this.listEl) return;
    this._last = null;
    const entries = log.entries(this.worldId);
    this.listEl.innerHTML = entries.map((e) => {
      const goals = e.goals.map((g) => {
        const pct = ((g.progress / Math.max(1, g.target)) * 100).toFixed(0);
        return '<li class="sp-goal' + (g.done ? ' done' : '') + '">'
          + '<span class="sp-goal-name">' + g.name + '</span>'
          + '<span class="sp-goal-bar"><i style="width:' + pct + '%"></i></span>'
          + '<b class="sp-goal-num">' + g.progress + ' / ' + g.target + '</b>'
          + '</li>';
      }).join('');
      let btn;
      if (e.ready) {
        btn = '<button class="btn primary sp-action claim" type="button" data-special="claim" data-quest="' + e.id + '">보상 받기 · '
          + e.rewardGold + ' G</button>';
      } else if (e.active) {
        btn = '<button class="btn sp-action" type="button" disabled>진행 중</button>';
      } else if (e.claimed) {
        btn = '<button class="btn sp-action" type="button" disabled>완료 ✨</button>';
      } else {
        btn = '<button class="btn primary sp-action" type="button" data-special="accept" data-quest="' + e.id + '">의뢰 받기</button>';
      }
      const badge = e.ready ? '<span class="sp-badge ready">보상 준비</span>'
        : (e.active ? '<span class="sp-badge active">진행 중</span>'
          : (e.claimed ? '<span class="sp-badge claimed">완료</span>' : '<span class="sp-badge">새 의뢰</span>'));
      return '<article class="sp-card' + (e.ready ? ' ready' : '') + (e.claimed ? ' claimed' : '') + '">'
        + '<header class="sp-card-head">'
        + '<h3>' + e.title + '</h3>' + badge
        + '</header>'
        + '<p class="sp-desc">' + e.desc + '</p>'
        + '<ul class="sp-goals">' + goals + '</ul>'
        + '<footer class="sp-card-foot">'
        + '<span class="sp-reward">보상 <b>' + e.rewardGold + ' G</b> · <b>' + e.rewardXp + ' XP</b></span>'
        + btn
        + '</footer>'
        + '</article>';
    }).join('');
  }

  toast(msg, ok) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.toggle('bad', !ok);
    this.toastEl.classList.add('on');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('on'), 2400);
  }
}
