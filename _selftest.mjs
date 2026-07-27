/* 엔진 자기검사. node _selftest.mjs 로 실행.
   배포에는 포함되지 않는 개발용 파일. */
import { run, selfTestScenarios, selfTestReproducibility, ENGINE_VERSION, maskPII } from './engine.js';

const TODAY = '2026-03-30';
let fails = 0;

console.log('ENGINE:', ENGINE_VERSION);
console.log('기준일:', TODAY);
console.log('');

console.log('=== 1. 시나리오 3개 기대 발화 대조 ===');
for (const r of selfTestScenarios({ today: TODAY })) {
  if (!r.pass) fails++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.scenarioId} ${r.label}`);
  console.log(`      기대=${JSON.stringify(r.expected)} 금지=${JSON.stringify(r.expectNotFired)}`);
  console.log(`      실제=${JSON.stringify(r.actual)} 출력=${r.outputKind}`);
  if (!r.pass) console.log(`      >>> 누락=${JSON.stringify(r.missing)} 초과=${JSON.stringify(r.unexpected)}`);
}
console.log('');

console.log('=== 2. 재현성 (같은 입력 5회, 이게 합격선) ===');
for (const id of ['S1', 'S2', 'S3']) {
  const t = selfTestReproducibility(id, 5, { today: TODAY });
  if (!t.allSame) fails++;
  console.log(`${t.allSame ? 'PASS' : 'FAIL'}  ${id}  ${t.signature}`);
}
console.log('');

console.log('=== 3. S2 vertical slice 상세 ===');
const s2 = run({ scenarioId: 'S2' }, { today: TODAY });
console.log('단계:', s2.state.stage, '| 확진:', s2.state.confirmed, '| 확진일:', s2.state.confirmDate);
console.log('층 요약:', JSON.stringify(s2.tags.summary));
console.log('공감:', s2.output.state.empathy);
console.log('출력:', s2.output.kind, '| 카드', s2.output.cards.length, '장');
for (const c of s2.output.cards) {
  console.log(`  [${c.ruleId}/${c.typeLabel}] ${c.title}`);
  console.log(`     기한: ${c.deadline.text}`);
  console.log(`     출처: ${c.source ? c.source.org + ' / ' + c.source.url : '!! NONE'}`);
  console.log(`     걸음: ${c.step.slice(0, 60)}...`);
  if (c.numbersHidden) console.log(`     숫자숨김: ${c.numbersNote}`);
}
console.log('팔로업:', s2.output.followUp ? s2.output.followUp.ask : 'none');
console.log('미발화:', JSON.stringify(s2.matched.skipped.map((x) => x.id + ':' + x.reason)));
console.log('');

console.log('=== 4. S3 하드 마감 날짜 계산 ===');
const s3 = run({ scenarioId: 'S3' }, { today: TODAY });
const hard = s3.output.cards.find((c) => c.type === 'hard');
if (!hard) { fails++; console.log('FAIL  hard 카드 없음'); }
else {
  const ok = hard.deadline.dueDate === '2026-04-29' && hard.deadline.daysLeft === 30;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  확진 ${s3.state.confirmDate} + 30일 = ${hard.deadline.dueDate} (${hard.deadline.daysLeft}일 남음)`);
  console.log(`      정렬 첫 카드가 hard인가: ${s3.output.cards[0].type === 'hard' ? 'PASS' : 'FAIL'}`);
  if (s3.output.cards[0].type !== 'hard') fails++;
}
console.log('');

console.log('=== 5. 가드레일 (판정 안 하고 리다이렉트) ===');
const g = run({ text: '이거 암인가요? 몇 기래요?' }, { today: TODAY });
const gOk = g.output.kind === 'guardrail' && g.output.guard.redirectTo === '담당의';
if (!gOk) fails++;
console.log(`${gOk ? 'PASS' : 'FAIL'}  출력=${g.output.kind} 리다이렉트=${g.output.guard ? g.output.guard.redirectTo : '-'}`);
if (g.output.guard) {
  console.log(`      공감: ${g.output.guard.empathy}`);
  console.log(`      대신: ${g.output.guard.weCanStillHelp}`);
}
console.log('');

console.log('=== 6. 안 다루는 상황 ===');
const u = run({ text: '무릎이 아파요' }, { today: TODAY });
const uOk = u.output.kind === 'unhandled' && u.log.unhandled;
if (!uOk) fails++;
console.log(`${uOk ? 'PASS' : 'FAIL'}  출력=${u.output.kind} unhandled저장=${!!u.log.unhandled}`);
console.log('');

console.log('=== 7. 백로그 주제 (장기요양) ===');
const b = run({ text: '어머니 장기요양 신청 되나요?' }, { today: TODAY });
console.log(`출력=${b.output.kind}`);
if (b.output.kind === 'guardrail') console.log(`      리다이렉트=${b.output.guard.redirectTo}`);
if (b.output.kind === 'backlog') console.log(`      ${b.output.backlog.message}`);
console.log('');

console.log('=== 8. 개인정보 마스킹 ===');
const raw = '김영희씨 800101-1234567 010-1234-5678 abc@test.com 1950년생';
const masked = maskPII(raw);
const mOk = !masked.includes('800101') && !masked.includes('1234-5678') && !masked.includes('abc@');
if (!mOk) fails++;
console.log(`${mOk ? 'PASS' : 'FAIL'}  ${masked}`);
console.log('');

console.log('=== 9. DB 페이로드에 개인정보 없는지 ===');
const logStr = JSON.stringify(s3.log);
const leak = ['주민', '사진', 'photo', 'image'].filter((k) => logStr.includes(k));
const lOk = leak.length === 0;
if (!lOk) fails++;
console.log(`${lOk ? 'PASS' : 'FAIL'}  누출 키워드=${JSON.stringify(leak)}`);
console.log('  payload:', logStr.slice(0, 200) + '...');
console.log('');

console.log(fails === 0 ? '### 전체 통과' : `### 실패 ${fails}건`);
process.exit(fails === 0 ? 0 : 1);
