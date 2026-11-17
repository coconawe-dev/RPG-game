// 함께 하기: 몹이 친구(동료)를 때리는지 '진짜 두 Net 인스턴스'로 끝까지 검증한다.
// (검사 내용은 tests/mp-loopback.mjs — 오프라인 스모크 테스트도 같은 검사를 돌린다)
// 실행: node tests/mp-hit-test.mjs
import { runMpLoopbackChecks } from '/workspace/RPG-game/tests/mp-loopback.mjs';

const problems = [];
runMpLoopbackChecks((cond, msg) => { if (!cond) problems.push(msg); });
console.log('problems:', problems.length ? problems : 'none');
process.exit(problems.length ? 1 : 0);
