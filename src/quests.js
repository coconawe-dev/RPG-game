// 퀘스트: 세계마다 정해진 순서대로 하나씩 — 지정한 몹을 정해진 수만큼 잡으면 골드를 받는다
//   · 1세계와 2세계는 각자 자기 줄을 따로 센다 (2세계에 가도 1세계 진행이 사라지지 않는다)
//   · 지금 진행 중인 퀘스트의 몹만 센다 (순서를 건너뛰고 잡아도 미리 채워지지 않는다)
//   · 화면(DOM)도 three.js 도 쓰지 않는 순수 로직이라 tests/smoke.mjs 에서 그대로 검증한다
import { MOB_TYPES } from './config.js';

// 퀘스트 목록 — 순서가 곧 진행 순서다
export const QUEST_CHAINS = {
  1: [
    { id: 'w1_q1', mobType: 'slime', target: 10, rewardGold: 150 },
    { id: 'w1_q2', mobType: 'zombie', target: 12, rewardGold: 280 },
    { id: 'w1_q3', mobType: 'hyena', target: 15, rewardGold: 450 },
    { id: 'w1_q4', mobType: 'raider', target: 12, rewardGold: 650 },
    { id: 'w1_q5', mobType: 'gorilla', target: 12, rewardGold: 900 },
    { id: 'w1_q6', mobType: 'golem', target: 1, rewardGold: 1600 },
  ],
  2: [
    { id: 'w2_q1', mobType: 'goblin', target: 12, rewardGold: 700 },
    { id: 'w2_q2', mobType: 'skeleton', target: 12, rewardGold: 1100 },
    { id: 'w2_q3', mobType: 'samurai', target: 10, rewardGold: 1600 },
    { id: 'w2_q4', mobType: 'iron_golem', target: 6, rewardGold: 2400 },
    { id: 'w2_q5', mobType: 'dark_mage', target: 1, rewardGold: 4500 },
  ],
};

// 몹 id → 화면에 쓰는 이름 (모르는 id 는 id 그대로)
export function mobName(mobType) {
  const t = MOB_TYPES[mobType];
  return (t && t.name) || mobType;
}

// 퀘스트 한 줄의 목표 문구 — 예: "슬라임 10마리 잡기" · "고대 골렘 1마리 처치"
export function questGoalText(quest) {
  if (!quest) return '';
  const name = mobName(quest.mobType);
  const verb = quest.target === 1 ? '처치' : '잡기';
  return name + ' ' + quest.target + '마리 ' + verb;
}

export function worldQuestLabel(worldId) {
  return (worldId === 2 ? 2 : 1) + '세계';
}

// 한 세계의 퀘스트 줄 — 지금 몇 번째인지 · 몇 마리 잡았는지
export class QuestChain {
  constructor(worldId, quests) {
    this.worldId = worldId === 2 ? 2 : 1;
    this.quests = quests || QUEST_CHAINS[this.worldId] || [];
    this.index = 0;   // 지금 진행 중인 퀘스트 (0부터)
    this.count = 0;   // 그 퀘스트로 잡은 수
  }

  get total() { return this.quests.length; }
  get done() { return this.index >= this.quests.length; }
  get quest() { return this.done ? null : this.quests[this.index]; }
  // 사람이 읽는 순번 (1부터) — 모두 끝났으면 total
  get number() { return Math.min(this.index + 1, this.total); }

  /* 몹 하나를 잡았다고 알린다.
     · 지금 퀘스트의 몹이 아니면 아무 일도 없음(null)
     · 진행만 했으면 { completed: false }
     · 목표를 채웠으면 보상 금액과 함께 { completed: true } 를 돌려준다 (보상 지급은 호출한 쪽이 한다) */
  recordKill(mobType) {
    const q = this.quest;
    if (!q || !mobType) return null;
    if (mobType !== q.mobType) return null;
    this.count += 1;
    if (this.count < q.target) {
      return { counted: true, completed: false, quest: q, progress: this.count, target: q.target, world: this.worldId };
    }
    // 목표 달성 → 다음 퀘스트로 넘어간다
    this.count = 0;
    this.index += 1;
    return {
      counted: true,
      completed: true,
      quest: q,
      rewardGold: q.rewardGold,
      progress: q.target,
      target: q.target,
      world: this.worldId,
      chainDone: this.done,
      next: this.quest,
    };
  }
}

// 두 세계의 퀘스트 줄을 함께 들고 있는 기록장
export class QuestLog {
  constructor(chains) {
    const src = chains || QUEST_CHAINS;
    this.chains = {
      1: new QuestChain(1, src[1]),
      2: new QuestChain(2, src[2]),
    };
  }

  chainFor(worldId) { return this.chains[worldId === 2 ? 2 : 1]; }

  // 그 세계에서 몹 하나를 잡았을 때
  recordKill(worldId, mobType) {
    return this.chainFor(worldId).recordKill(mobType);
  }

  activeQuest(worldId) { return this.chainFor(worldId).quest; }

  /* HUD 가 그대로 그릴 수 있는 상태
     { world, index(1부터), total, done, quest, progress, target, rewardGold, goal } */
  status(worldId) {
    const c = this.chainFor(worldId);
    const q = c.quest;
    return {
      world: c.worldId,
      index: c.number,
      total: c.total,
      done: c.done,
      quest: q,
      id: q ? q.id : null,
      progress: c.count,
      target: q ? q.target : 0,
      rewardGold: q ? q.rewardGold : 0,
      goal: q ? questGoalText(q) : '',
      title: c.done ? '✨ ' + worldQuestLabel(c.worldId) + ' 모든 퀘스트 완료!' : '📜 퀘스트',
    };
  }

  // 한 줄 요약 (접었을 때 · 안내 문구용) — 예: "슬라임 3/10"
  summary(worldId) {
    const st = this.status(worldId);
    if (st.done) return '모두 완료 ✨';
    const name = mobName(st.quest.mobType);
    return name + ' ' + st.progress + '/' + st.target;
  }
}
