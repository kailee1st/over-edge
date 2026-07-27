/* ============================================================
   Dr.Hand — 판정 엔진 (순수 함수)
   ------------------------------------------------------------
   ⚠️ 이 파일에 LLM 호출을 넣지 않는다.

   이유: 제품의 축이 완결성과 재현성이다.
   "같은 상황이면 같은 항목이 빠짐없이 나온다"를 파는데
   판정 경로에 생성 모델을 두면 그 주장이 무너진다.
   LLM은 나중에 입력 이해(자유 텍스트 → 상태) 보조로만 쓴다.
   그때도 출력은 이 엔진이 결정한다.

   함수 4개:
     extractState(input)        텍스트·시나리오 → 상태
     tagDocs(state)             확보·미확보 서류에 층 태그
     matchRules(state, tags)    발화 룰 목록 (정렬됨)
     buildOutput(...)           출력 조립 (F3/F4/F5/F6 분기)
   ============================================================ */

import {
  DOCS,
  TIERS,
  NOTICES,
  detectDocs,
  findDoc,
  tierOf,
  canDelegate,
  matchGuardrail,
  citeSource,
  outOfScopeMessage,
  KB_VERSION,
} from './kb.js';

import {
  RULES,
  RULES_VERSION,
  DEADLINE_KINDS,
  BASIS,
  SCENARIOS,
  findScenario,
  findBacklog,
  sortRules,
  ruleSource,
} from './rules.js';

export const ENGINE_VERSION = `engine-v1-20260727 (${KB_VERSION} / ${RULES_VERSION})`;

/* ------------------------------------------------------------
   단계 판정 패턴
   ------------------------------------------------------------
   순서가 중요하다. 위에서 먼저 걸린 것이 이긴다.
   구체적인 단계를 위에, 넓은 단계를 아래에 둔다.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   ⚠️ 여기가 자유 입력의 성패를 가른다.
   버튼(시나리오)은 상태가 미리 정의돼 있어 통과하지만,
   실제 사용자는 직접 친다. 표현이 조금만 달라도 단계 판정이
   실패하면 룰이 하나도 안 켜진다.
   그래서 어미 변화("듣는/들으러/들어요")까지 넓게 잡는다.
   위에서 먼저 걸린 것이 이긴다. 확정된 상태를 위에 둔다.
   ------------------------------------------------------------ */
const STAGE_PATTERNS = [
  {
    stage: '확진직후',
    re: /확진|암이(라고|래|에요|예요|입니다)|암 진단|판정.*(받|났)|진단.*(받았|나왔|났)|진단서.*(받|나)|양성.*나왔/,
  },
  {
    stage: '입원중',
    re: /입원해 있|입원 중|입원중|병실|지금.*입원|입원하셨|입원했/,
  },
  {
    stage: '입원예정',
    re: /입원.*(하기로|예정|한다고|하래|하라고|잡)|수술.*(하기로|예정|잡|날짜)/,
  },
  {
    stage: '전원예정',
    re: /전원|옮기(라고|래|기로)|다른 병원.*(가라|가래|가기로)|회송/,
  },
  {
    stage: '결과대기',
    re: /결과.*(기다|듣|들으|보러|나오면|언제|다음)|검사.*(끝났|했|받았|마쳤)|조직검사.*(했|받았|끝)|생검.*(했|받았)|내시경.*(했|받았)/,
  },
  {
    stage: '조직검사예정',
    re: /조직검사.*(하기로|예정|한다고|하래|잡)|생검.*(하기로|예정)|내시경.*(하기로|예정|잡)/,
  },
  {
    stage: '상급병원예정',
    re: /대학병원|상급종합|큰 병원.*(가라|가래|가기로|가야)|서울.*병원.*(가|의뢰)|3차 병원/,
  },
  {
    stage: '추가검사권유',
    re: /추가검사|추가 검사|재검|다시 찍|정밀검사|정밀 검사|더 검사/,
  },
  {
    stage: '검진이상소견',
    re: /건강검진|검진.*(결과|받았|나왔)|결절|이상소견|이상 소견|뭐가 (보인다|보인대|있다|있대)|소견.*나왔/,
  },
  {
    stage: '수납완료',
    re: /수납|계산했|영수증.*(받|나)|돈.*(냈|냇)|진료비.*(냈|나왔)/,
  },
  {
    stage: '통원중',
    re: /통원|다니고 있|외래.*다|치료.*받고 있|항암.*(중|받)/,
  },
];

/* 확진 판정 — 처방전만으로는 하지 않는다 (kb FIELDS.prescription.note) */
const CONFIRM_POSITIVE = /확진|암이라고|암이래|암입니다|판정.*받았|진단.*나왔/;
const CONFIRM_NEGATIVE = /아직.*모르|결과.*기다|확진.*전|아닐 수도/;

/* 날짜 표현 */
const DATE_PATTERNS = [
  { re: /(\d{4})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})/, kind: 'ymd' },
  { re: /(\d{1,2})[-.\/월\s]+(\d{1,2})[일]?/, kind: 'md' },
  { re: /오늘/, kind: 'today' },
  { re: /어제/, kind: 'yesterday' },
];

/* 예정 이벤트 */
const EVENT_PATTERNS = [
  { type: 'resultVisit', re: /결과.*(다음 주|내일|모레|(\d{1,2})일|월요일|화요일|수요일|목요일|금요일)/, label: '결과 진료' },
  { type: 'nextVisit', re: /(다음 진료|다음 외래|또 오라고|재진)/, label: '다음 진료' },
  { type: 'test', re: /(검사.*예정|검사.*하기로|CT.*찍기로)/, label: '검사' },
];

/* ------------------------------------------------------------
   1. extractState — 입력 → 상태
   ------------------------------------------------------------
   시나리오 버튼이면 미리 정의된 상태를 쓴다 (재현성 보장).
   자유 입력이면 패턴 매칭으로 뽑는다.
   ------------------------------------------------------------ */
export function extractState(input, opts = {}) {
  const today = opts.today ? new Date(opts.today) : startOfDay(new Date());

  // (a) 시나리오 버튼 — 상태가 이미 정의되어 있다
  if (input && input.scenarioId) {
    const sc = findScenario(input.scenarioId);
    if (!sc) return emptyState(today, 'unknown-scenario');
    const st = deepClone(sc.state);
    if (st.confirmDate === 'TODAY') st.confirmDate = fmtDate(today);
    return applyProfile({
      ...st,
      today: fmtDate(today),
      rawText: sc.input,
      inputMode: 'button',
      scenarioId: sc.id,
      confidence: 'defined', // 판정 근거가 정의값
    }, opts.profile);
  }

  // (b) 자유 입력
  const text = String((input && input.text) || '').trim();
  if (!text) return emptyState(today, 'empty-input');

  const stage = detectStage(text);
  const confirmed = detectConfirmed(text);
  const confirmDate = confirmed ? detectConfirmDate(text, today) : null;
  const docs = detectDocs(text);
  const events = detectEvents(text, today);
  const patientCanVisit = !/입원|의식|치매|인지|못 움직|누워/.test(text);
  // 동행 여부: 같이 간다는 말이 없으면 혼자 가시는 것으로 본다
  const patientGoesAlone = !/같이 가|동행|제가 가|모시고 가|반차/.test(text);

  return applyProfile({
    stage,
    confirmed,
    confirmDate,
    docs,
    docsHave: docs.map((id) => (findDoc(id) || {}).name).filter(Boolean),
    docsMissing: [],
    events,
    patientCanVisit,
    patientGoesAlone,
    today: fmtDate(today),
    rawText: text,
    inputMode: 'free',
    scenarioId: null,
    confidence: stage ? 'matched' : 'weak',
  }, opts.profile);
}

/* ------------------------------------------------------------
   프로필 — 사용자가 직접 채운 정보
   ------------------------------------------------------------
   텍스트에서 추출한 값보다 우선한다. 사용자가 직접 적은 것이
   더 정확하기 때문이다.
   정보가 채워질수록 발화 가능한 룰이 늘어난다. 그게 이 구조의 목적이다.
   ------------------------------------------------------------ */
export const PROFILE_FIELDS = [
  {
    key: 'confirmed',
    label: '확진 진단을 받으셨나요?',
    type: 'choice',
    options: [
      { v: true, t: '받았어요' },
      { v: null, t: '아직 몰라요' },
    ],
    unlocks: ['R1'],
    why: '확진 여부가 확인되면 기한이 걸린 신청을 짚어드릴 수 있어요',
  },
  {
    key: 'confirmDate',
    label: '확진일이 언제예요?',
    type: 'date',
    hint: '진단서의 "진단 연월일" 칸에 적혀 있어요',
    dependsOn: { confirmed: true },
    unlocks: ['R1'],
    why: '이 날짜가 30일 시계의 시작점이에요',
  },
  {
    key: 'nextVisitDate',
    label: '다음 진료가 언제예요?',
    type: 'date',
    unlocks: [],
    why: '그날 먼저 연락드릴 수 있어요',
  },
  {
    key: 'patientCanVisit',
    label: '부모님이 병원 창구에 직접 가실 수 있나요?',
    type: 'choice',
    options: [
      { v: true, t: '갈 수 있어요' },
      { v: false, t: '어려워요' },
    ],
    unlocks: ['R3'],
    why: '못 가시는 경우엔 자녀분도 못 떼는 서류가 생겨서, 미리 알려드려야 해요',
  },
  {
    key: 'patientGoesAlone',
    label: '진료실에 부모님 혼자 들어가시나요?',
    type: 'choice',
    options: [
      { v: true, t: '혼자 가세요' },
      { v: false, t: '같이 가요' },
    ],
    unlocks: ['R6'],
    why: '혼자 가시면 의사 말이 자녀분에게 도달하지 않아요',
  },
  {
    key: 'hasPrivateInsurance',
    label: '실손보험에 가입돼 있나요?',
    type: 'choice',
    options: [
      { v: true, t: '가입했어요' },
      { v: false, t: '없어요' },
      { v: null, t: '모르겠어요' },
    ],
    unlocks: ['R4'],
    why: '가입돼 있으면 수납할 때 챙길 서류가 달라져요',
  },
];

export function applyProfile(state, profile) {
  if (!profile) return state;
  const out = { ...state };
  for (const f of PROFILE_FIELDS) {
    const v = profile[f.key];
    if (v === undefined || v === '') continue;
    out[f.key] = v;
  }
  // 다음 진료일이 있으면 이벤트로 넣는다 (팔로업 날짜가 됨)
  if (profile.nextVisitDate) {
    const others = (out.events || []).filter((e) => e.type !== 'resultVisit');
    out.events = [
      ...others,
      { type: 'resultVisit', label: '다음 진료', date: profile.nextVisitDate, inDays: null },
    ];
  }
  out.profileApplied = true;
  return out;
}

/** 아직 안 채운 정보와, 채우면 켜지는 룰 */
export function profileGaps(profile, state) {
  const p = profile || {};
  const gaps = [];
  for (const f of PROFILE_FIELDS) {
    if (p[f.key] !== undefined && p[f.key] !== '') continue;
    if (f.dependsOn) {
      const ok = Object.entries(f.dependsOn).every(([k, v]) => p[k] === v);
      if (!ok) continue;
    }
    // 이미 발화 중인 룰만 unlock 하는 항목은 세지 않는다
    const newRules = (f.unlocks || []).filter((id) => !(state.firedIds || []).includes(id));
    gaps.push({ ...f, newRules });
  }
  return {
    fields: gaps,
    count: gaps.length,
    unlockCount: new Set(gaps.flatMap((g) => g.newRules)).size,
  };
}

function emptyState(today, reason) {
  return {
    stage: null,
    confirmed: null,
    confirmDate: null,
    docs: [],
    docsHave: [],
    docsMissing: [],
    events: [],
    patientCanVisit: true,
    patientGoesAlone: true,
    today: fmtDate(today),
    rawText: '',
    inputMode: 'free',
    scenarioId: null,
    confidence: 'none',
    reason,
  };
}

function detectStage(text) {
  const hit = STAGE_PATTERNS.find((p) => p.re.test(text));
  return hit ? hit.stage : null;
}

function detectConfirmed(text) {
  if (CONFIRM_NEGATIVE.test(text)) return null; // 미정
  if (CONFIRM_POSITIVE.test(text)) return true;
  return null;
}

function detectConfirmDate(text, today) {
  for (const p of DATE_PATTERNS) {
    const m = text.match(p.re);
    if (!m) continue;
    if (p.kind === 'today') return fmtDate(today);
    if (p.kind === 'yesterday') return fmtDate(addDays(today, -1));
    if (p.kind === 'ymd') return fmtDate(new Date(+m[1], +m[2] - 1, +m[3]));
    if (p.kind === 'md') return fmtDate(new Date(today.getFullYear(), +m[1] - 1, +m[2]));
  }
  return null;
}

function detectEvents(text, today) {
  const out = [];
  for (const p of EVENT_PATTERNS) {
    const m = text.match(p.re);
    if (!m) continue;
    let inDays = null;
    if (/내일/.test(text)) inDays = 1;
    else if (/모레/.test(text)) inDays = 2;
    else if (/다음 주/.test(text)) inDays = 7;
    out.push({ type: p.type, label: p.label, inDays, date: inDays != null ? fmtDate(addDays(today, inDays)) : null });
  }
  return out;
}

/* ------------------------------------------------------------
   2. tagDocs — 확보·미확보 서류에 층 태그
   ------------------------------------------------------------
   DB `doc_tags` 테이블에 그대로 들어간다.
   목적: 실제로 어느 층이 들어오는지 계측.
   ------------------------------------------------------------ */
export function tagDocs(state) {
  const have = (state.docs || []).map((id) => tagOne(id, true, state));

  // 미확보 중 이 단계에서 필요해질 것
  const missingIds = state.docsMissing && state.docsMissing.length
    ? state.docsMissing
    : inferMissing(state);

  const missing = missingIds.map((id) => tagOne(id, false, state));

  return {
    have,
    missing,
    // 층 요약 — 계측용
    summary: {
      T1: countTier(have, 'T1'),
      T2: countTier(have, 'T2'),
      'T3-ok': countTier(have, 'T3-ok'),
      'T3-blocked': countTier(have, 'T3-blocked'),
      T4: have.filter((d) => d.tier === 'T4').length,
    },
    // 부모가 창구에 갈 수 없으면 T3-blocked가 T4로 승격된다
    hasT4Risk: !state.patientCanVisit && missing.some((d) => d.tier === 'T3-blocked'),
  };
}

function tagOne(docId, obtained, state) {
  const doc = findDoc(docId);
  if (!doc) return { docId, name: docId, tier: null, obtained, unknown: true };

  // 부모가 창구에 못 가면 본인만 뗄 수 있는 서류는 T4
  let tier = doc.tier;
  if (!state.patientCanVisit && tier === 'T3-blocked') tier = 'T4';

  const t = TIERS[tier];
  const del = canDelegate(doc.id);

  return {
    docId: doc.id,
    name: doc.name,
    plain: doc.plain,
    tier,
    tierLabel: t ? t.label : null,
    friction: t ? t.friction : null,
    whoCanGet: t ? t.whoCanGet : null,
    obtained,
    delegable: del ? del.possible : null,
    delegateNote: del ? del.reason || del.note || null : null,
    delegateRequires: del && del.requires ? del.requires : null,
    alternative: del ? del.alternative || null : null,
    caveat: doc.caveat || null,
    unresolved: t ? !!t.unresolved : false,
    unresolvedNote: t ? t.unresolvedNote || null : null,
  };
}

function countTier(list, tier) {
  return list.filter((d) => d.tier === tier).length;
}

/** 단계별로 곧 필요해질 서류 추론 */
function inferMissing(state) {
  const have = new Set(state.docs || []);
  const need = [];
  const push = (id) => { if (!have.has(id)) need.push(id); };

  switch (state.stage) {
    case '검진이상소견':
    case '추가검사권유':
    case '상급병원예정':
      push('referral');
      break;
    case '조직검사예정':
    case '결과대기':
      push('diagnosis');
      push('medical-record');
      break;
    case '확진직후':
      push('receipt-detail');
      push('medical-record');
      break;
    case '입원중':
    case '입원예정':
      push('admission-cert');
      push('receipt-detail');
      break;
    case '전원예정':
      push('medical-record');
      push('referral');
      break;
    case '수납완료':
    case '통원중':
      push('receipt-detail');
      break;
    default:
      break;
  }
  return need;
}

/* ------------------------------------------------------------
   3. matchRules — 상태 + 층 → 발화 룰
   ------------------------------------------------------------
   순수 함수. 같은 입력이면 같은 출력, 같은 순서.
   ------------------------------------------------------------ */
export function matchRules(state, tags) {
  const fired = [];
  const skipped = [];

  for (const rule of RULES) {
    const verdict = testRule(rule, state, tags);
    if (verdict.fired) fired.push(rule);
    else skipped.push({ id: rule.id, reason: verdict.reason });
  }

  return { fired: sortRules(fired), skipped };
}

function testRule(rule, state, tags) {
  const t = rule.trigger || {};

  // 확진 조건
  if (t.confirmed === true && state.confirmed !== true) {
    return { fired: false, reason: '확진 아님' };
  }

  // 필수 필드 (예: 확진일)
  if (t.requireField && !state[t.requireField]) {
    return { fired: false, reason: `${t.requireField} 없음` };
  }

  // 단계 조건
  if (t.stage && t.stage.length) {
    if (!state.stage || !t.stage.includes(state.stage)) {
      return { fired: false, reason: `단계 불일치 (현재: ${state.stage || '미정'})` };
    }
  }

  // 특정 서류 보유 조건
  if (t.hasDoc && t.hasDoc.length) {
    const have = new Set(state.docs || []);
    if (!t.hasDoc.some((d) => have.has(d))) {
      return { fired: false, reason: '필요 서류 미보유' };
    }
  }

  // 미확보 서류의 층 조건 (R3)
  if (t.needsDocTier && t.needsDocTier.length) {
    const hit = (tags.missing || []).some((d) => t.needsDocTier.includes(d.tier)) ||
                (tags.have || []).some((d) => t.needsDocTier.includes(d.tier));
    if (!hit) return { fired: false, reason: '해당 층 서류 없음' };
  }

  // 추가 조건 (예: 부모가 혼자 진료실에 들어가는 상황에서만)
  if (rule.onlyIf === 'patientGoesAlone' && state.patientGoesAlone !== true) {
    return { fired: false, reason: '부모님이 혼자 가시는 상황이 아님' };
  }

  return { fired: true, reason: null };
}

/* ------------------------------------------------------------
   4. buildOutput — 출력 조립
   ------------------------------------------------------------
   F3 누락 카드 / F4 예고 / F5 경계선 / F6 0개
   ------------------------------------------------------------ */
export function buildOutput(state, tags, matched, opts = {}) {
  const prevRuleIds = opts.prevRuleIds || [];
  const today = state.today ? new Date(state.today) : startOfDay(new Date());

  // F5-a 가드레일 — 판정하지 않고 리다이렉트. 단 감정을 먼저 받는다
  const guard = matchGuardrail(state.rawText);
  if (guard) {
    return {
      kind: 'guardrail',
      guard: {
        empathy: guard.empathy,
        weDo: guard.weDo,
        weDont: guard.weDont,
        redirectTo: guard.redirectTo,
        redirectHint: guard.redirectHint,
        weCanStillHelp: guard.weCanStillHelp,
        scopeMessage: guard.outOfScopeRef ? outOfScopeMessage(guard.outOfScopeRef) : null,
      },
      // 가드레일에 걸려도 룰이 있으면 같이 보여준다
      cards: matched.fired.map((r) => renderCard(r, state, today)),
      state: renderState(state, tags),
      notices: [NOTICES.base],
    };
  }

  // F5-b 백로그 주제 — 아직 안 다루는 것
  const backlog = findBacklog(state.rawText);
  if (backlog && !matched.fired.length) {
    return {
      kind: 'backlog',
      backlog: {
        name: backlog.name,
        redirectTo: backlog.redirectTo,
        message: `${backlog.name}은 아직 다루지 않아요. 지금은 ${backlog.redirectTo}에 확인하셔야 해요`,
        why: '기한과 요건을 공식 원문으로 확인하기 전에는 안내하지 않아요. 틀리면 금전 손해가 생기니까요',
      },
      cards: [],
      state: renderState(state, tags),
      notices: [NOTICES.base],
      logAsUnhandled: true,
    };
  }

  // F5-b 아무것도 안 걸림
  if (!matched.fired.length) {
    // 이전에 안내한 게 있으면 F6 (0개), 없으면 F5-b (안 다룸)
    if (prevRuleIds.length) {
      return {
        kind: 'zero',
        zero: {
          message: '새로 놓치고 있는 것 0개',
          detail: '지난번에 안내한 것들 외에 새로 생긴 건 없어요',
          prevCount: prevRuleIds.length,
        },
        cards: [],
        state: renderState(state, tags),
        notices: [NOTICES.base],
      };
    }
    // 단계는 알아냈는데 룰이 없는 경우 — 구체적으로 말한다.
    // "무릎이 아파요"(단계 판정 실패)와 "입원하셨어요"(단계는 알지만 룰 없음)는
    // 사용자에게 전혀 다른 상황이다. 같은 문구로 답하면 안 된다.
    const STAGE_SOON = {
      입원예정: '입원 준비',
      입원중: '입원 중에 챌 것',
      전원예정: '병원 옮길 때',
      통원중: '치료 받는 동안',
    };
    if (state.stage && STAGE_SOON[state.stage]) {
      return {
        kind: 'stage-soon',
        stageSoon: {
          stage: state.stage,
          label: STAGE_SOON[state.stage],
          message: `${STAGE_SOON[state.stage]} 항목은 아직 준비 중이에요`,
          detail:
            '지금은 검진에서 뭔가 보인다는 이야기를 들은 시점부터 확진 직후까지를 다뤄요. ' +
            '이 단계도 곧 넣을 예정이라, 어떤 게 막히셨는지 적어주시면 먼저 만들 순서에 반영해요.',
        },
        cards: [],
        state: renderState(state, tags),
        notices: [NOTICES.base],
        logAsUnhandled: true,
      };
    }

    return {
      kind: 'unhandled',
      unhandled: {
        message: '이 상황은 아직 다루지 않아요',
        detail:
          '지금은 검진에서 뭔가 보인다는 이야기를 들은 시점부터 확진 직후까지의 서류·기한을 다뤄요. 부모님 병원 이야기를 조금 더 알려주시면 다룰 수 있는지 확인해볼게요',
        stage: state.stage,
      },
      cards: [],
      state: renderState(state, tags),
      notices: [NOTICES.base],
      logAsUnhandled: true,
    };
  }

  // F3 + F4 정상 출력
  const cards = matched.fired.slice(0, 3).map((r) => renderCard(r, state, today));
  const overflow = matched.fired.length > 3 ? matched.fired.slice(3).map((r) => r.id) : [];

  const followUp = matched.fired
    .filter((r) => r.followUp && r.followUp.enabled)
    .map((r) => buildFollowUp(r, state, today))
    .filter(Boolean)[0] || null;

  const notices = [NOTICES.base];
  if (matched.fired.some((r) => r.guardRef === 'insurancePayout')) notices.push(NOTICES.insurance);
  if (matched.fired.some((r) => r.unverifiedNumbers)) notices.push(`일부 수치는 ${NOTICES.unverifiedNumber}입니다`);

  return {
    kind: 'cards',
    cards,
    overflow,
    followUp,
    state: renderState(state, tags),
    notices,
  };
}

/* ---------------- 카드 렌더 데이터 ---------------- */
function renderCard(rule, state, today) {
  const basisId = rule.basis || 'law'; // 명시 안 하면 법령·제도
  const basis = BASIS[basisId];
  const src = ruleSource(rule);
  const dl = rule.deadline || {};

  // 법령 룰인데 Tier 1 출처가 없으면 데이터 오류다. 조용히 넘기지 않는다
  if (basis.requiresSource && !src) {
    console.warn(`[engine] ${rule.id}: basis=law인데 Tier 1 출처가 없습니다`);
  }

  // hard 타입이면 실제 날짜를 계산한다
  let deadlineText = dl.text || null;
  let dueDate = null;
  let daysLeft = null;

  if (rule.type === 'hard' && dl.days && dl.anchor && state[dl.anchor]) {
    const anchor = new Date(state[dl.anchor]);
    dueDate = fmtDate(addDays(anchor, dl.days));
    daysLeft = diffDays(today, new Date(dueDate));
    deadlineText = `${state[dl.anchor]}부터 ${dl.days}일 → ${dueDate}까지 (${daysLeft >= 0 ? `${daysLeft}일 남음` : `${-daysLeft}일 지남`})`;
  }

  return {
    ruleId: rule.id,
    type: rule.type,
    typeLabel: DEADLINE_KINDS[rule.type].label,
    urgent: DEADLINE_KINDS[rule.type].urgent,

    // ① 놓치고 있는 것
    title: rule.title,

    // ② 기한 또는 요건
    deadline: {
      text: deadlineText,
      dueDate,
      daysLeft,
      loss: dl.lossIfMissed || null,
    },

    // ③ 근거 — 법령이면 Tier 1 출처, 운영 조언이면 그 사실을 명시
    basis: basisId,
    basisLabel: basis.label,
    source: src ? { org: src.org, label: src.label, url: src.url, tel: src.tel || null } : null,
    basisDisclaimer: basisId === 'ops' ? basis.disclaimer : null,

    // ④ 다음 한 걸음
    step: rule.step,
    stepWhy: rule.stepWhy || null,

    caution: rule.caution || null,
    breakdown: rule.breakdown || null,

    // 미검증 수치는 숫자를 내보내지 않는다
    numbersHidden: !!rule.unverifiedNumbers,
    numbersNote: rule.unverifiedNumbers ? NOTICES.unverifiedNumber : null,

    notice: NOTICES.base,
  };
}

/* ---------------- 상태 카드 (F2, 기본 접힘) ---------------- */
function renderState(state, tags) {
  return {
    stage: state.stage,
    stageLabel: state.stage || '아직 파악 중',
    confirmed: state.confirmed,
    confirmedLabel:
      state.confirmed === true ? '확진' : state.confirmed === false ? '확진 아님' : '아직 모름',
    confirmDate: state.confirmDate,
    events: state.events || [],

    // 공감 문장 — A가 하는 일. "정리됐다"는 느낌을 주는 자리
    empathy: buildEmpathy(state, tags),

    docsHave: tags.have,
    docsMissing: tags.missing,
    tierSummary: tags.summary,
    t4Risk: tags.hasT4Risk
      ? {
          message: '부모님이 병원에 가시기 어려운 상황이면, 자녀분도 못 떼는 서류가 생겨요',
          unresolved: true,
          note: '이 경우의 예외 경로는 확인 중이에요. 해당 병원 원무과에 문의해보셔야 해요',
        }
      : null,

    confidence: state.confidence,
    engineVersion: ENGINE_VERSION,
  };
}

/** 상태를 사람 문장으로. 판정이 아니라 "이렇게 이해했어요" */
function buildEmpathy(state, tags) {
  const parts = [];

  const stageWord = {
    검진이상소견: '건강검진에서 뭔가 보인다는 이야기를 들으신 단계',
    추가검사권유: '추가검사를 권유받은 단계',
    상급병원예정: '큰 병원으로 가야 하는 단계',
    조직검사예정: '조직검사를 앞둔 단계',
    결과대기: '검사는 끝났고 결과를 기다리는 단계',
    확진직후: '확진을 들으신 직후',
    입원예정: '입원을 앞둔 단계',
    입원중: '입원 중인 단계',
    전원예정: '병원을 옮기는 단계',
    수납완료: '진료를 받고 나오신 단계',
    통원중: '통원 치료 중인 단계',
  }[state.stage];

  if (stageWord) parts.push(`지금은 ${stageWord}예요.`);

  if (state.confirmed === null && state.stage === '결과대기') {
    parts.push('아직 확정된 게 없으니, 지금은 결과가 어떻게 나오든 손해를 막는 준비만 해두면 돼요.');
  }
  if (state.confirmed === true) {
    parts.push('확진이 확정됐으니 여기서부터는 기한이 걸린 것들이 생겨요.');
  }

  const t1 = (tags.summary && tags.summary.T1) || 0;
  if (t1 > 0) {
    parts.push(`보내주신 서류 ${t1}장은 병원에서 그냥 주는 것들이라, 이것만으로도 확인할 수 있는 게 있어요.`);
  }

  const blocked = (tags.missing || []).filter((d) => d.tier === 'T3-blocked');
  if (blocked.length) {
    parts.push(`${blocked.map((d) => d.name).join('·')}는 부모님만 뗄 수 있어서 부모님 도움이 필요해요.`);
  }

  return parts.join(' ');
}

/* ---------------- F7 팔로업 ---------------- */
function buildFollowUp(rule, state, today) {
  const fu = rule.followUp;
  if (!fu) return null;

  // 예정 이벤트에서 날짜를 찾는다
  const ev = (state.events || []).find((e) => e.type === fu.anchorEvent);
  const date = ev && ev.date ? ev.date : null;

  return {
    ruleId: rule.id,
    notifyDate: date,
    notifyDateLabel: date ? date : '날짜를 알려주시면 그날 먼저 연락드려요',
    message: fu.message,
    ask: date
      ? `${date}에 먼저 연락드릴까요? 그날 확진이면 30일이 시작돼요`
      : '결과 듣는 날짜를 알려주시면, 그날 먼저 연락드릴게요',
  };
}

/* ------------------------------------------------------------
   전체 파이프라인 (편의 함수)
   ------------------------------------------------------------ */
export function run(input, opts = {}) {
  const state = extractState(input, opts);
  const tags = tagDocs(state);
  const matched = matchRules(state, tags);
  const output = buildOutput(state, tags, matched, opts);

  return {
    state,
    tags,
    matched,
    output,
    // DB 저장용 페이로드 — 개인정보 없음
    log: buildLog(state, tags, matched, output),
  };
}

/* ------------------------------------------------------------
   DB 저장 페이로드
   ------------------------------------------------------------
   서류 사진·이름·주민번호는 넣지 않는다.
   자유 입력 원문은 unhandled일 때만, 마스킹 후.
   ------------------------------------------------------------ */
export function buildLog(state, tags, matched, output) {
  return {
    session: {
      input_mode: state.inputMode,
      scenario_id: state.scenarioId,
      stage: state.stage,
      confirmed: state.confirmed,
      confirm_date: state.confirmDate,
      output_kind: output.kind,
      confidence: state.confidence,
      kb_version: KB_VERSION,
      rules_version: RULES_VERSION,
    },
    rule_hits: matched.fired.map((r, i) => ({
      rule_id: r.id,
      position: i + 1,
      type: r.type,
      basis: r.basis || 'law',
    })),
    doc_tags: [
      ...tags.have.map((d) => ({ doc_id: d.docId, tier: d.tier, obtained: true })),
      ...tags.missing.map((d) => ({ doc_id: d.docId, tier: d.tier, obtained: false })),
    ],
    unhandled: output.logAsUnhandled
      ? { input_text: maskPII(state.rawText), stage: state.stage, reason: output.kind }
      : null,
    followup: output.followUp && output.followUp.notifyDate
      ? { preview_rule_id: output.followUp.ruleId, notify_date: output.followUp.notifyDate }
      : null,
  };
}

/** 개인정보 마스킹 — 이름·생년·연락처·주민번호 패턴 */
export function maskPII(text) {
  if (!text) return '';
  return String(text)
    .replace(/\d{6}\s*-\s*\d{7}/g, '[주민번호]')
    .replace(/01[016-9][-\s]?\d{3,4}[-\s]?\d{4}/g, '[연락처]')
    .replace(/\b(19|20)\d{2}\s*년?\s*생\b/g, '[생년]')
    .replace(/[가-힣]{2,4}\s*(씨|님)(?![가-힣])/g, '[이름]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '[이메일]');
}

/* ------------------------------------------------------------
   날짜 유틸
   ------------------------------------------------------------ */
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return startOfDay(x);
}
function diffDays(from, to) {
  const ms = startOfDay(to) - startOfDay(from);
  return Math.round(ms / 86400000);
}
function fmtDate(d) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
}
function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

/* ------------------------------------------------------------
   자기검사 — 재현성 확인
   ------------------------------------------------------------
   같은 입력을 N번 돌려 출력이 동일한지 본다.
   재현성이 제품의 축이므로 이 함수가 합격선이다.
   ------------------------------------------------------------ */
export function selfTestReproducibility(scenarioId, times = 5, opts = {}) {
  const runs = [];
  for (let i = 0; i < times; i++) {
    const r = run({ scenarioId }, opts);
    runs.push(JSON.stringify(r.matched.fired.map((x) => x.id)));
  }
  const allSame = runs.every((x) => x === runs[0]);
  return { scenarioId, times, allSame, signature: runs[0], runs };
}

/** 시나리오 3개의 기대 발화와 실제 발화 대조 */
export function selfTestScenarios(opts = {}) {
  return SCENARIOS.map((sc) => {
    const r = run({ scenarioId: sc.id }, opts);
    const firedIds = r.matched.fired.map((x) => x.id);
    const missing = (sc.expectRules || []).filter((id) => !firedIds.includes(id));
    const unexpected = (sc.expectNotFired || []).filter((id) => firedIds.includes(id));
    return {
      scenarioId: sc.id,
      label: sc.label,
      expected: sc.expectRules,
      expectNotFired: sc.expectNotFired,
      actual: firedIds,
      pass: missing.length === 0 && unexpected.length === 0,
      missing,
      unexpected,
      outputKind: r.output.kind,
    };
  });
}
