/* ============================================================
   Dr.Hand — 판정 규칙 (룰) + 시나리오
   ------------------------------------------------------------
   kb.js가 "법이 이렇게 정한다"이고
   이 파일이 "그래서 이 상황이면 이걸 말한다"다.

   ⚠️ 이 파일의 존재 이유는 완결성이다.
   범용 AI도 산정특례를 꺼낼 수 있다. 다만 매번 꺼내지 않고,
   무엇을 빠뜨렸는지 자기도 모른다.
   이 리스트는 배포 단위로 고정되어 있고, 같은 상황이면
   같은 항목이 빠짐없이 나온다. 그게 파는 것이다.

   ⚠️ 룰을 추가할 때 지켜야 할 것
   1. source는 kb.js SOURCES의 Tier 1 항목만
   2. 원문 검증이 안 됐으면 verified: false + unverifiedNumbers: true
      → 숫자를 출력하지 않고 "해당 기관 확인 필요"로 대체된다
   3. step은 60분 안에 실행 가능한 행동 하나여야 한다
   ============================================================ */

import { SOURCES } from './kb.js';

export const RULES_VERSION = 'rules-v1-20260727';

/* ------------------------------------------------------------
   기한 유형
   ------------------------------------------------------------
   hard     날짜가 있다. 놓치면 금전 손해가 확정된다
   preview  아직 시계가 안 돌지만 곧 돈다. 미리 알려준다
            ★ T1 서류만으로 발화하는 유일한 hard 계열 경로
   gate     날짜는 없지만 조건이 있다. 그 전에 안 하면 막힌다
   ------------------------------------------------------------ */
export const DEADLINE_KINDS = {
  hard: { id: 'hard', label: '기한', order: 1, urgent: true },
  preview: { id: 'preview', label: '곧 생길 기한', order: 2, urgent: false },
  gate: { id: 'gate', label: '요건', order: 3, urgent: false },
};

/* ------------------------------------------------------------
   근거 유형 (basis)
   ------------------------------------------------------------
   law  법령·제도. Tier 1 출처가 반드시 있어야 한다
   ops  운영 조언. 법령 근거가 없다. 그래서 출처 대신
        "법령 근거가 아니라 경험에서 나온 조언"임을 명시한다

   ⚠️ 왜 나누나
   섞어서 둘 다 근거 있는 것처럼 내면, 나중에 하나가 틀렸을 때
   전체 신뢰가 무너진다. "이건 법이고 이건 저희 경험입니다"를
   구분해서 말하는 것이 의료 도메인에서 더 강한 신뢰 장치다.
   ------------------------------------------------------------ */
export const BASIS = {
  law: {
    id: 'law',
    label: '법령·제도',
    requiresSource: true,
    note: 'Tier 1 공식 원문이 근거',
  },
  ops: {
    id: 'ops',
    label: '경험에서 나온 조언',
    requiresSource: false,
    disclaimer: '법령 근거가 아니라, 같은 상황을 겪은 분들에게서 반복해 본 것이에요',
    note: '틀릴 수 있다. 손해가 크지 않은 것만 여기 둔다',
  },
};

/* ------------------------------------------------------------
   룰 5개
   5개 중 4개가 T1(자동교부 서류)만으로 발화한다.
   즉 사진 한 장으로 시작해도 도움이 나간다.
   ------------------------------------------------------------ */
export const RULES = [
  /* ---------------- R1 산정특례 (hard) ---------------- */
  {
    id: 'R1',
    order: 10,
    type: 'hard',
    name: '산정특례 등록 신청',

    // 확진 + 확진일이 둘 다 있어야 발화
    trigger: {
      confirmed: true,
      requireField: 'confirmDate',
      stage: null,
    },
    requiresTier: ['T3-blocked', 'T3-ok'], // 확진일이 진단서 또는 병리보고서에 있음

    title: '확진 진단을 받으셨으면, 그날부터 30일 안에 해야 하는 신청이 하나 있어요',

    deadline: {
      kind: 'hard',
      days: 30,
      anchor: 'confirmDate',
      anchorLabel: '확진일(진단서의 진단 연월일)',
      text: '확진일로부터 30일 이내(토·일·공휴일 포함)',
      lossIfMissed:
        '30일이 지나서 신청하면 신청일부터만 적용돼요. 그 사이에 낸 진료비는 소급되지 않아요',
    },

    source: 'nhis-special-copay',
    step:
      '결과를 듣는 자리에서 그대로 말해보세요. "확진이면 산정특례 등록신청서를 오늘 여기서 써주실 수 있나요? 병원에서 대행 신청 해주시나요?"',
    stepWhy: '병원이 대행해주면 직접 하실 일이 없어져요. 대행 안 하는 병원이면 공단에 접수하셔야 해요',

    caution:
      '신청서에는 담당의가 적는 확진일과 병명코드가 들어가요. 자녀가 대신 만들 수 없어요',

    // 본인부담률 숫자는 원문 재검증 전까지 출력 금지
    unverifiedNumbers: true,
    unverifiedNote: '본인부담률이 몇 %로 내려가는지는 원문 재검증 전이라 숫자를 말하지 않습니다',

    verified: true,
    verifiedAt: '2026-07-26',
  },

  /* ---------------- R1-pre 조건부 예고 (preview) ---------------- */
  {
    id: 'R1-pre',
    order: 20,
    type: 'preview',
    name: '산정특례 30일 시계 예고',

    // ★ 확진일이 없어도 발화한다. 이게 이 룰의 존재 이유
    trigger: {
      confirmed: null, // 미정이어도 됨
      stage: ['조직검사예정', '조직검사완료', '결과대기'],
    },
    requiresTier: ['T1'], // 처방전·영수증만 있어도 됨

    title: '결과가 확진으로 나오면, 그날부터 30일짜리 시계가 하나 시작돼요',

    deadline: {
      kind: 'preview',
      willBecome: 'hard',
      days: 30,
      anchor: 'futureConfirmDate',
      text: '지금은 기한이 없어요. 확진일이 정해지는 순간 30일 시계가 시작돼요',
      lossIfMissed:
        '결과 듣는 날 신청서를 못 받으면, 다시 병원에 가야 하고 그만큼 30일이 줄어들어요',
    },

    source: 'nhis-special-copay',
    step:
      '결과 듣는 날 진료실을 나오기 전에 물어보세요. "확진이면 산정특례 등록신청서 지금 써주실 수 있나요?"',
    stepWhy: '나온 뒤에 다시 들어가는 건 하루가 더 들어요. 진료실 안에서만 물을 수 있는 것이에요',

    caution:
      '결과가 좋게 나오면 이 준비는 버리면 돼요. 나쁘게 나올 경우에만 필요한 준비예요',

    // 예고한 날짜에 우리가 먼저 연락한다 (F7)
    followUp: {
      enabled: true,
      anchorEvent: 'resultVisitDate',
      offsetDays: 0,
      message: '오늘 결과 들으셨죠? 확진이면 오늘부터 30일이에요',
      why: '한 번 쓰고 안 돌아오는 게 이 제품의 최대 위험이다. 사용자가 우리를 기억하지 않아도 되게 만든다',
    },

    unverifiedNumbers: true,
    verified: true,
    verifiedAt: '2026-07-26',
  },

  /* ---------------- R2 상급병원 의뢰서 (gate) ---------------- */
  {
    id: 'R2',
    order: 30,
    type: 'gate',
    name: '상급병원 진료의뢰서',

    trigger: {
      stage: ['상급병원예정', '검진이상소견', '추가검사권유'],
      confirmed: null,
    },
    requiresTier: ['T1'],

    title:
      '동네 병원을 먼저 거치지 않고 대학병원에 바로 가면, 진료비를 전액 본인이 부담할 수 있어요',

    deadline: {
      kind: 'gate',
      text: '기한은 없어요. 다만 상급종합병원 외래 첫 방문 전에 필요해요',
      lossIfMissed: '의뢰서 없이 가면 그날 진료비에 건강보험이 적용되지 않을 수 있어요',
    },

    source: 'nhis-referral',
    step:
      '검진받은 병원(또는 동네 내과)에 결과지를 들고 가서 이렇게 말해보세요. "대학병원 진료의뢰서 써주세요"',
    stepWhy: '이 문장 그대로 전달하시면 돼요. 병원에서 바로 알아들어요',

    caution:
      '소견서로는 갈음되지 않아요. 요양급여의뢰서라는 법정 서식이어야 해요. 그리고 사진이 아니라 원본 종이가 필요해요',

    relatedDoc: 'referral',
    unverifiedNumbers: false,
    verified: true,
    verifiedAt: '2026-07-22',
  },

  /* ---------------- R3 사본 대리발급 요건 (gate) ---------------- */
  {
    id: 'R3',
    order: 40,
    type: 'gate',
    name: '서류 대리발급 요건',

    trigger: {
      // 케어러가 서류를 직접 떼려는 상황, 또는 T3 서류가 미확보인 상황
      stage: ['결과대기', '확진직후', '전원예정', '입원예정'],
      needsDocTier: ['T3-ok', 'T3-blocked'],
    },
    requiresTier: ['T1'],

    title: '부모님 서류 중에는 자녀가 대신 뗄 수 없는 것이 있어요',

    deadline: {
      kind: 'gate',
      text: '기한은 없어요. 다만 부모님이 병원에 가실 수 있을 때 미리 준비하는 게 좋아요',
      lossIfMissed:
        '부모님이 입원하시면 창구에 가기 어려워져요. 그때는 자녀도 못 떼고 부모님도 못 떼는 상황이 생겨요',
    },

    source: 'medical-law-17',
    step:
      '지금 부모님이 병원 가실 수 있으면, 진단서 2부와 병리결과지를 미리 받아두세요. 나중에 여러 곳에 낼 일이 생겨요',
    stepWhy: '진단서는 매번 새로 떼야 하고 그때마다 부모님이 직접 가셔야 해요',

    // 서류별로 갈리는 게 이 룰의 핵심 정보
    breakdown: [
      {
        docs: ['진단서', '소견서'],
        possible: false,
        who: '부모님 본인만',
        note: '자녀가 대신 뗄 수 없어요 (의료법 제17조)',
      },
      {
        docs: ['의무기록 사본', '병리결과지', '검사결과지'],
        possible: true,
        who: '자녀도 가능',
        note: '자필서명 동의서 + 가족관계증명서(3개월 내) + 본인 신분증이 필요해요',
      },
    ],

    caution: '동의서는 자필서명이어야 해요. 도장이나 지장은 인정되지 않아요',

    unverifiedNumbers: false,
    verified: true,
    verifiedAt: '2026-07-22',
  },

  /* ---------------- R4 실손 청구 서류 (gate) ---------------- */
  {
    id: 'R4',
    order: 50,
    type: 'gate',
    name: '실손보험 청구 서류',

    trigger: {
      stage: ['수납완료', '확진직후', '통원중', '입원중'],
      hasDoc: ['receipt'],
    },
    requiresTier: ['T1'],

    title: '수납하고 그냥 나오면, 나중에 보험 청구할 때 서류를 다시 떼러 가야 해요',

    deadline: {
      kind: 'gate',
      text: '기한은 없어요. 다만 수납 창구를 떠나기 전에 챙기는 게 좋아요',
      lossIfMissed: '나중에 다시 병원에 가셔야 해요. 서류당 수수료도 다시 들어요',
    },

    source: 'knia-claim',
    step: '수납할 때 한마디만 더 하세요. "세부내역서도 같이 주세요"',
    stepWhy:
      '진료비 영수증은 자동으로 주는데 세부내역서는 요청해야 줘요. 비급여 항목이 있으면 청구에 필요해요',

    caution: '보험사마다 요구 서류가 달라요. 지급 여부와 금액은 가입 보험사에 확인하셔야 해요',
    guardRef: 'insurancePayout',

    relatedDoc: 'receipt-detail',
    unverifiedNumbers: false,
    verified: true,
    verifiedAt: '2026-07-22',
  },

  /* ---------------- R5 원본 유실 방지 (gate · ops) ---------------- */
  {
    id: 'R5',
    order: 70,
    type: 'gate',
    basis: 'ops',
    name: '서류 원본 유실 방지',

    trigger: {
      // 서류가 하나라도 들어온 모든 초기 단계
      stage: ['검진이상소견', '추가검사권유', '상급병원예정', '조직검사예정', '결과대기'],
      confirmed: null,
    },
    requiresTier: ['T1'],

    title: '서류 원본을 병원에 내고 나면, 자녀분 손에는 아무것도 안 남아요',

    deadline: {
      kind: 'gate',
      text: '기한은 없어요. 다만 원본을 병원에 제출하기 전에 필요해요',
      lossIfMissed:
        '나중에 보험 청구나 다른 병원에 낼 때 다시 떼러 가셔야 해요. 서류마다 수수료도 다시 들어요',
    },

    // ops 룰이라 Tier 1 출처가 없다. 대신 그 사실을 명시한다
    source: null,
    step:
      '부모님께 이렇게 부탁하세요. "그 서류, 병원에 내기 전에 접힌 데 펴서 밝은 데서 한 장씩 다 찍어서 보내줘"',
    stepWhy:
      '한 장만 보내주시는 경우가 많은데, 보통 첫 장이에요. 뒷장에 중요한 게 있어요',

    caution: null,
    unverifiedNumbers: false,
    verified: true,
    verifiedAt: '2026-07-27',
  },

  /* ---------------- R6 진료실 전달 경로 (gate · ops) ---------------- */
  {
    id: 'R6',
    order: 60,
    type: 'gate',
    basis: 'ops',
    name: '진료실 내용 전달 경로',

    trigger: {
      stage: ['검진이상소견', '추가검사권유', '상급병원예정', '조직검사예정', '결과대기', '확진직후'],
      confirmed: null,
    },
    requiresTier: ['T1'],
    // 부모가 혼자 진료실에 들어가는 상황에서만 의미가 있다
    onlyIf: 'patientGoesAlone',

    title: '부모님 혼자 진료실에 들어가시면, 의사 선생님 말이 자녀분에게 도달하지 않아요',

    deadline: {
      kind: 'gate',
      text: '기한은 없어요. 다만 다음 진료 전에 정해두는 게 좋아요',
      lossIfMissed:
        '"괜찮대"만 전해 들으시게 돼요. 실제로 무슨 말이 있었는지 확인할 방법이 없어져요',
    },

    source: null,
    step:
      '진료 직후 병원 복도에서, 부모님이 기억나는 대로 말한 음성메모를 받으세요. "정리하지 말고 들은 대로만" 이라고 부탁하는 게 중요해요',
    stepWhy:
      '진료실 안에서 녹음하는 건 병원에 따라 제한될 수 있어요. 나온 직후 복도가 가장 현실적이에요',

    caution:
      '정리해서 말해달라고 하면 부모님이 중요한 걸 빼고 말하시게 돼요. 들은 그대로가 필요해요',

    unverifiedNumbers: false,
    verified: true,
    verifiedAt: '2026-07-27',
  },
];

/* ------------------------------------------------------------
   룰 백로그 — 아직 넣지 않은 것
   ------------------------------------------------------------
   원문 검증 전이라 넣지 않는다. 물어오면 F5로 리다이렉트한다.
   경험·후기(SOURCE_TIERS 3)에서 후보를 찾을 때 이 목록에 추가한다.
   ------------------------------------------------------------ */
export const RULE_BACKLOG = [
  {
    id: 'B1',
    name: '노인장기요양 등급 신청',
    blockedBy: '65세 미만 노인성 질병 해당 여부, 30일 판정 기간 기산점 미검증',
    source: 'longtermcare',
    redirectTo: '국민건강보험공단 1577-1000',
  },
  {
    id: 'B2',
    name: '본인부담상한제',
    blockedBy: '공단 통보형이라 사용자가 할 일이 있는지 불명확. 상한액 기준 미검증',
    source: 'nhis-special-copay',
    redirectTo: '국민건강보험공단 1577-1000',
  },
  {
    id: 'B3',
    name: '의료비 세액공제',
    blockedBy: '연간 신고 + 5년 경정청구. 공제율·한도 미검증',
    source: 'nts',
    redirectTo: '국세청',
  },
  {
    id: 'B4',
    name: '회송서 (추적관찰 전환 시)',
    blockedBy: '발급 요건과 실무 관행 미검증',
    source: 'nhis-referral',
    redirectTo: '담당의',
  },
  {
    id: 'B5',
    name: 'T4 경로 (부모가 발급 불가)',
    blockedBy: '의료법 제21조 제3항 각 호 원문 미확인. 우리 공략 상황에서 가장 많이 발생할 층',
    source: 'medical-law-21',
    redirectTo: '해당 병원 원무과',
    priority: 'high',
  },
];

/* ------------------------------------------------------------
   시나리오 3개 (데모 버튼)
   텍스트는 시나리오_아들보호자_암의심_20260727.md 세션 1·5·6에서 가져옴
   ------------------------------------------------------------ */
export const SCENARIOS = [
  {
    id: 'S1',
    label: '건강검진에서 뭐가 보인다고 해요',
    sourceSession: '세션 1 (2026-03-09)',
    input:
      '어머니가 건강검진 결과지를 사진으로 보내셨는데 폐에 뭐가 있다고 추가검사 받으라고 나왔어요. 지금 뭐부터 해야 하는지 모르겠어요.',
    state: {
      stage: '검진이상소견',
      confirmed: null,
      confirmDate: null,
      docs: ['receipt'], // 검진 결과지는 T1 취급
      docsHave: ['검진 결과지'],
      docsMissing: ['referral'],
      events: [],
      patientCanVisit: true,
      patientGoesAlone: true,
    },
    expectRules: ['R2', 'R6', 'R5'],
    expectNotFired: ['R1', 'R3'],
    note: '확진 전이라 R1은 안 뜬다. R3(대리발급)도 이 단계엔 뗄 일이 없어 안 뜬다. 그래도 할 일 3개가 나온다는 게 요점',
  },
  {
    id: 'S2',
    label: '조직검사 했고 결과 기다려요',
    sourceSession: '세션 5 (2026-03-24)',
    input:
      '검사 끝났어요. 결과는 다음 주 월요일에 듣는대요. 일주일 동안 아무것도 안 하고 기다리는 게 미치겠어요. 뭐라도 미리 할 게 있나요?',
    state: {
      stage: '결과대기',
      confirmed: null,
      confirmDate: null,
      docs: ['prescription', 'receipt'],
      docsHave: ['처방전', '진료비 영수증'],
      docsMissing: ['diagnosis', 'medical-record'],
      events: [{ type: 'resultVisit', label: '결과 진료', inDays: 5 }],
      patientCanVisit: true,
      patientGoesAlone: true,
    },
    expectRules: ['R1-pre', 'R3', 'R6'],
    expectNotFired: ['R1'],
    isVerticalSlice: true,
    note:
      'vertical slice. T1 서류(처방전·영수증)만으로 발화한다. R1-pre가 여기서 살아난다. R1은 확진일이 없어 안 떠야 정상',
  },
  {
    id: 'S3',
    label: '확진 들었고 진단서 받았어요',
    sourceSession: '세션 6 (2026-03-30)',
    input:
      '오늘 결과 들었어요. 폐암이라고 하셨고 진단서 받아왔어요. 진단 연월일은 오늘 날짜로 적혀 있어요. 이제 뭘 해야 해요?',
    state: {
      stage: '확진직후',
      confirmed: true,
      confirmDate: 'TODAY', // engine이 오늘 날짜로 치환
      docs: ['prescription', 'receipt', 'diagnosis'],
      docsHave: ['처방전', '진료비 영수증', '진단서'],
      docsMissing: ['receipt-detail', 'medical-record'],
      events: [],
      patientCanVisit: true,
      patientGoesAlone: true,
    },
    expectRules: ['R1', 'R3', 'R4'],
    expectNotFired: [],
    note: 'R1이 맨 위에 떠야 한다. 30일 계산이 확진일 기준으로 맞아야 한다',
  },
];

/* ------------------------------------------------------------
   조회 헬퍼
   ------------------------------------------------------------ */

export function findRule(id) {
  return RULES.find((r) => r.id === id) || null;
}

export function findScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || null;
}

/** 룰의 출처를 표시용으로 (Tier 1만 통과) */
export function ruleSource(rule) {
  if (!rule || !rule.source) return null;
  const s = SOURCES[rule.source];
  if (!s || s.tier !== 1) return null;
  return s;
}

/** 백로그에 있는 주제인가 (F5 리다이렉트 대상 판정) */
export function findBacklog(text) {
  if (!text) return null;
  const map = [
    { re: /장기요양|요양보호사|등급/, id: 'B1' },
    { re: /본인부담상한|상한제|환급/, id: 'B2' },
    { re: /세액공제|연말정산|의료비 공제/, id: 'B3' },
    { re: /회송서|동네병원.*돌아|추적관찰/, id: 'B4' },
  ];
  const hit = map.find((m) => m.re.test(text));
  return hit ? RULE_BACKLOG.find((b) => b.id === hit.id) : null;
}

/** 정렬 — hard → preview → gate, 같은 유형 안에서는 order */
export function sortRules(rules) {
  return [...rules].sort((a, b) => {
    const ka = DEADLINE_KINDS[a.type].order;
    const kb = DEADLINE_KINDS[b.type].order;
    if (ka !== kb) return ka - kb;
    return a.order - b.order;
  });
}
