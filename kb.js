/* ============================================================
   Dr.Hand — 의료서류 지식베이스 (사실 상수)
   ------------------------------------------------------------
   출처: knowledge/의료서류_지식베이스_v1.md (2026-07-22)
   이 파일은 "법·제도가 이렇게 정한다"만 담는다.
   "그래서 이 상황이면 뭘 말한다"는 rules.js에 있다.

   ⚠️ 고칠 때
   - 지식베이스가 개정되면 이 파일만 고친다
   - 제품 판단이 바뀌면 rules.js만 고친다

   DB에 넣지 않는다. 코드 상수 + git 버전 관리.
   이유: 완결성과 재현성이 제품의 축이다. "리스트에서 하나도 안 빠진다"를
   보장하려면 리스트가 배포 단위로 고정되어 있어야 한다.
   ============================================================ */

export const KB_VERSION = 'kb-v1-20260727';

/* ------------------------------------------------------------
   범위 표시 (SCOPE)
   ------------------------------------------------------------
   "안 합니다"와 "지금은 안 합니다"는 다르다.
   유상 대행·신청 대리는 곧 할 일이고, 지금 못 하는 이유는
   법적 준비(위임 구조·행정사법 검토)가 안 됐기 때문이다.
   영구 금지와 섞으면 나중에 제품을 스스로 막는다.
   ------------------------------------------------------------ */
export const SCOPE = {
  NOW: 'now',       // 이번 MVP에서 한다
  SOON: 'soon',     // 곧 한다. 법적·운영 준비가 선행
  VISION: 'vision', // 비전 단계
  NEVER: 'never',   // 영구히 안 한다 (무면허 진단 등)
};

/** 지금 안 하는 것들의 이유와 언제 할 것인지 */
export const OUT_OF_SCOPE = {
  paidProxy: {
    label: '유상 서류 발급 대행 · 신청서 제출 대리',
    scope: SCOPE.SOON,
    blockedBy: '행정사법 제3조 검토 + 위임 구조 설계 미완',
    userFacing: '지금은 절차 안내까지 도와드려요. 대신 접수해드리는 건 준비 중입니다',
    note: '영구 금지가 아니다. 제품 로드맵에 있다',
  },
  booking: {
    label: '병원 예약 대리',
    scope: SCOPE.SOON,
    blockedBy: '환자 동의 절차 설계',
    userFacing: '예약 대신 걸어드리는 건 준비 중입니다',
  },
  diagnosisJudgment: {
    label: '진단 · 병기 · 중증도 판단',
    scope: SCOPE.NEVER,
    blockedBy: '무면허 의료행위',
    userFacing: '진단은 하지 않아요. 의사 선생님 말씀을 정리해 전달합니다',
  },
  hospitalRecommend: {
    label: '병원 · 의사 추천',
    scope: SCOPE.NEVER,
    blockedBy: '유인·알선 소지 + 판단 근거 없음',
    userFacing: '어느 병원이 나은지는 안내하지 않아요',
  },
  medicationJudgment: {
    label: '복약 적정성 · 약물 상호작용 판단',
    scope: SCOPE.NEVER,
    blockedBy: '약사·의사 영역',
    userFacing: '약 조합은 약사님께 확인하셔야 해요',
  },
  insurancePayout: {
    label: '보험금 액수 · 지급 여부 판단',
    scope: SCOPE.NEVER,
    blockedBy: '약관 사항. 보험사 권한',
    userFacing: '지급 여부와 금액은 가입 보험사에서 확인하셔야 해요',
  },
};

/* ------------------------------------------------------------
   문서 층 (tier)
   케어러(자녀)가 그 서류를 손에 넣기까지의 마찰
   ------------------------------------------------------------ */
export const TIERS = {
  T1: {
    id: 'T1',
    label: '자동교부',
    desc: '병원이 그냥 준다. 부모가 들고 나오면 끝',
    friction: '사진 한 장',
    whoCanGet: '누구나(수령만 하면 됨)',
    // ★ 첫 기능이 서는 자리
    // T1만 있어도 "이런 게 있으니 확인하세요"가 가능하다
    supportsConditional: true,
  },
  T2: {
    id: 'T2',
    label: '요청하면 발급',
    desc: '요청해야 주지만 절차가 간단하다',
    friction: '창구에서 한마디',
    whoCanGet: '부모 본인 (상대적으로 쉬움)',
    supportsConditional: true,
  },
  'T3-ok': {
    id: 'T3-ok',
    label: '케어러 대리발급 가능',
    desc: '자녀가 직접 뗄 수 있다. 단 서류 3종이 필요하다',
    friction: '동의서 + 가족관계증명서 + 신분증',
    whoCanGet: '배우자·직계 존비속·환자가 지정한 대리인',
    supportsConditional: false,
  },
  'T3-blocked': {
    id: 'T3-blocked',
    label: '환자 본인만',
    desc: '자녀가 대신 뗄 수 없다. 부모가 직접 발급받아야 한다',
    friction: '부모가 병원에 직접 가야 함',
    whoCanGet: '환자 본인 (사망·의식불명 시 예외)',
    supportsConditional: false,
  },
  T4: {
    id: 'T4',
    label: '부모도 발급 불가',
    desc: '부모가 입원·의식불명·인지저하로 창구에 갈 수 없는 상태',
    friction: '의료법 21조 3항 예외 경로',
    whoCanGet: '미확인',
    supportsConditional: false,
    // ⚠️ 결론 보류. 원문 확인 후 정리한다
    unresolved: true,
    unresolvedNote:
      '의료법 제21조 제3항 각 호(의사무능력·의식불명)의 구체 요건과 필요 서류가 원문 미확인. ' +
      '우리 공략 상황(확진 직후, 입원 중)에서 실제로 가장 많이 발생할 층인데 답이 없다. ' +
      '검증 전까지 이 층은 안내하지 않고 "확인이 필요합니다"로만 응답한다.',
  },
};

/* ------------------------------------------------------------
   §A. 서류 지도 10종
   ------------------------------------------------------------ */
export const DOCS = [
  {
    id: 'prescription',
    name: '처방전',
    aka: ['원외처방전'],
    when: '진료 직후',
    plain: '약국에서 약 받는 종이예요. 약 이름·용량·일수가 적혀 있어요',
    usedFor: ['약국 조제', '실손청구 병명확인'],
    tier: 'T1',
    fieldsRef: 'prescription',
    caveat:
      '질병분류기호(병명코드)가 비어 있을 수 있어요. 환자가 요구하면 미기재가 가능하기 때문이라, 비어 있는 게 이상한 건 아니에요',
    verified: true,
  },
  {
    id: 'receipt',
    name: '진료비 계산서·영수증',
    aka: ['영수증', '진료비 영수증', '계산서'],
    when: '수납 시',
    plain: '낸 돈 내역서예요',
    usedFor: ['실손보험 청구 필수'],
    tier: 'T1',
    fieldsRef: 'receipt',
    verified: true,
  },
  {
    id: 'receipt-detail',
    name: '진료비 세부내역서',
    aka: ['세부내역서', '진료비세부산정내역'],
    when: '요청 시',
    plain: '어떤 항목에 얼마 썼는지 상세본이에요. 급여와 비급여가 나뉘어 있어요',
    usedFor: ['실손청구 (비급여 항목이 있으면 필수)'],
    tier: 'T1',
    fieldsRef: null,
    caveat: '자동으로 주지 않아요. 수납할 때 "세부내역서도 같이 주세요" 한마디가 필요해요',
    verified: true,
  },
  {
    id: 'referral',
    name: '진료의뢰서',
    aka: ['요양급여의뢰서', '의뢰서'],
    when: '상급(대학)병원 갈 때',
    plain: '동네 병원이 큰 병원으로 보내는 공식 서식이에요',
    usedFor: ['상급종합병원 건강보험 적용에 필수'],
    tier: 'T1',
    fieldsRef: 'referral',
    caveat: '소견서로 갈음되지 않아요. 법정 서식이어야 해요',
    verified: true,
  },
  {
    id: 'return-referral',
    name: '회송서',
    aka: [],
    when: '대학병원에서 동네병원으로 복귀할 때',
    plain: '대학병원이 동네병원으로 다시 보내는 문서예요',
    usedFor: ['지속관리 연계', '대학병원 왕복 줄이기'],
    tier: 'T1',
    fieldsRef: null,
    verified: true,
  },
  {
    id: 'visit-cert',
    name: '진료확인서',
    aka: ['진료사실확인서'],
    when: '요청 시',
    plain: '"이 사람이 이날 진료받았다"를 확인해주는 종이예요',
    usedFor: ['실손청구', '회사·학교 제출'],
    tier: 'T2',
    fieldsRef: null,
    verified: true,
  },
  {
    id: 'admission-cert',
    name: '통원·입퇴원확인서',
    aka: ['입퇴원확인서', '통원확인서'],
    when: '요청 시',
    plain: '통원했거나 입원했다는 사실을 확인해주는 종이예요',
    usedFor: ['실손청구 입원 증빙'],
    tier: 'T2',
    fieldsRef: null,
    verified: true,
  },
  {
    id: 'medical-record',
    name: '의무기록 사본',
    aka: ['진료기록 사본', '병리보고서', '검사결과지', '판독소견서', '경과기록지', '수술기록'],
    when: '요청 시 (유료)',
    plain: '진료차트 원본 묶음이에요. 초진기록·검사결과지·판독소견서·수술기록이 들어 있어요',
    usedFor: ['타병원 전원', '보험 심사', '분쟁'],
    tier: 'T3-ok',
    fieldsRef: null,
    delegationRef: 'medical-record',
    caveat:
      '가족이 대신 뗄 수 있는 유일한 서류예요. 확진 정보(병리 결과)도 여기에 들어 있어요',
    verified: true,
  },
  {
    id: 'diagnosis',
    name: '진단서',
    aka: ['일반진단서'],
    when: '요청·발급 (유료)',
    plain: '의사가 병명과 치료기간을 공식적으로 확인해주는 문서예요',
    usedFor: ['회사 병가', '학교', '보험'],
    tier: 'T3-blocked',
    fieldsRef: 'diagnosis',
    caveat:
      '자녀가 대신 뗄 수 없어요. 부모님이 병원에서 직접 발급받아 사진으로 보내주시는 게 가장 빨라요',
    legalBasis: 'medical-law-17',
    verified: true,
  },
  {
    id: 'opinion',
    name: '소견서',
    aka: [],
    when: '요청 시',
    plain: '의사가 환자 상태와 검사결과에 대한 의견을 적은 글이에요',
    usedFor: ['타병원 참고', '보험 병명확인'],
    tier: 'T3-blocked',
    fieldsRef: null,
    caveat: '자녀가 대신 뗄 수 없어요. 그리고 진료의뢰서를 대신할 수도 없어요',
    legalBasis: 'medical-law-17',
    verified: true,
  },
];

/* ------------------------------------------------------------
   §B. 파싱 필드
   ------------------------------------------------------------ */
export const FIELDS = {
  diagnosis: {
    docId: 'diagnosis',
    legalBasis: 'medical-law-rule-9',
    required: [
      { key: 'patientName', label: '환자 성명', sensitive: true },
      { key: 'patientId', label: '주민등록번호', sensitive: true },
      { key: 'diseaseName', label: '병명' },
      { key: 'kcdCode', label: '한국표준질병사인분류(KCD) 코드' },
      { key: 'onsetDate', label: '발병 연월일' },
      { key: 'diagnosisDate', label: '진단 연월일', isDeadlineAnchor: true },
      { key: 'treatmentPeriod', label: '치료·요양 기간(향후 소견)' },
      { key: 'institution', label: '의료기관 명칭·주소' },
      { key: 'doctor', label: '진찰 의사 성명·면허번호' },
    ],
    note: '진단 연월일이 기한 룰의 기준점이다. 없으면 hard 타입 룰은 발화하지 않는다',
    verified: true,
  },
  injuryDiagnosis: {
    docId: 'diagnosis',
    extends: 'diagnosis',
    required: [
      { key: 'injuryCause', label: '상해의 원인 또는 추정 원인' },
      { key: 'injurySite', label: '상해 부위 및 정도' },
      { key: 'needAdmission', label: '입원 필요 여부' },
      { key: 'needSurgery', label: '외과적 수술 여부' },
      { key: 'complication', label: '합병증 발생 가능 여부' },
      { key: 'dailyActivity', label: '통상 활동·식사 가능 여부' },
    ],
    note: '법원·경찰 증빙용. 발급비가 일반진단서보다 비싸다',
    inScope: false,
    verified: true,
  },
  prescription: {
    docId: 'prescription',
    legalBasis: 'medical-law-18',
    required: [
      { key: 'patientName', label: '환자 성명', sensitive: true },
      { key: 'patientId', label: '주민등록번호', sensitive: true },
      { key: 'institution', label: '의료기관/의사 정보' },
      { key: 'issueDate', label: '교부 연월일' },
      { key: 'drugs', label: '의약품 명칭·분량·용법·용량·투약일수' },
      {
        key: 'kcdCode',
        label: '질병분류기호(병명코드)',
        optional: true,
        optionalReason: '환자가 요구하면 미기재 가능(프라이버시)',
      },
    ],
    note:
      '처방전만으로 확진 판정을 하지 않는다. 병명코드가 비어 있을 수 있으므로 병명 확인은 진단서·소견서·진료확인서로 보완한다',
    verified: true,
  },
  receipt: {
    docId: 'receipt',
    required: [
      { key: 'visitDate', label: '진료일' },
      { key: 'department', label: '진료과' },
      { key: 'coveredAmount', label: '급여 본인부담금' },
      { key: 'uncoveredAmount', label: '비급여' },
      { key: 'totalAmount', label: '총액' },
    ],
    note: '비급여가 0보다 크면 세부내역서가 실손청구에 필요해진다',
    verified: true,
  },
  referral: {
    docId: 'referral',
    required: [
      { key: 'department', label: '진료과' },
      { key: 'diseaseName', label: '상병명 또는 의증' },
      { key: 'reason', label: '의뢰 사유' },
      { key: 'targetInstitution', label: '의뢰받는 의료기관' },
      { key: 'issueDate', label: '발급일' },
    ],
    note: '유효기간은 기관마다 다르다. 접수 전 해당 병원 확인 필요',
    verified: true,
  },
};

/* ------------------------------------------------------------
   §C. 목적별 서류 매트릭스
   ------------------------------------------------------------ */
export const PURPOSES = [
  {
    id: 'insurance-outpatient-small',
    label: '실손보험 청구 — 통원 10만원 이하',
    ref: '§C-1',
    needs: ['신분증 사본', '보험금청구서', 'receipt'],
    needsIf: [{ doc: 'receipt-detail', when: '비급여 항목이 있으면' }],
    needsAnyOf: ['prescription', 'diagnosis', 'opinion', 'visit-cert'],
    needsAnyOfLabel: '병명확인서류',
    source: 'knia-claim',
    guard: 'insurancePayout',
    verified: true,
  },
  {
    id: 'insurance-outpatient-large',
    label: '실손보험 청구 — 통원 10만원 초과',
    ref: '§C-1',
    needs: ['신분증 사본', '보험금청구서', 'receipt', 'receipt-detail', 'diagnosis'],
    source: 'knia-claim',
    guard: 'insurancePayout',
    verified: true,
  },
  {
    id: 'insurance-admission',
    label: '실손보험 청구 — 입원',
    ref: '§C-1',
    needs: ['신분증 사본', '보험금청구서', 'receipt', 'receipt-detail'],
    needsAnyOf: ['diagnosis', 'visit-cert', 'admission-cert'],
    needsAnyOfLabel: '입원 증빙서류',
    source: 'knia-claim',
    guard: 'insurancePayout',
    verified: true,
  },
  {
    id: 'tertiary-hospital',
    label: '상급(대학)병원 진료 — 건강보험 적용',
    ref: '§C-2',
    needs: ['referral'],
    source: 'nhis-referral',
    caution: '소견서로 갈음할 수 없어요. 법정 서식(요양급여의뢰서)이어야 해요',
    verified: true,
  },
  {
    id: 'workplace-school',
    label: '회사 병가·학교 결석 증빙',
    ref: '§C-4',
    needs: [],
    needsAnyOf: ['diagnosis', 'visit-cert'],
    needsAnyOfLabel: '증빙서류',
    source: null,
    verified: true,
  },
  {
    id: 'longterm-care',
    label: '노인장기요양 등급 신청',
    ref: '§C-3',
    needs: ['장기요양인정 신청서', '의사소견서'],
    channels: ['The건강보험 앱', '노인장기요양보험 누리집', '공단 지사 방문'],
    source: 'longtermcare',
    guard: 'longtermCareEligibility',
    inScope: false,
    verified: false,
    unverifiedNote:
      '65세 미만 노인성 질병 해당 여부, 30일 판정 기간 기산점 미검증. 채널 안내만 하고 대상 판정은 하지 않는다',
  },
];

/* ------------------------------------------------------------
   §D. 케어러 대리발급 절차
   ------------------------------------------------------------ */
export const DELEGATION = {
  'medical-record': {
    docId: 'medical-record',
    possible: true,
    legalBasis: 'medical-law-rule-form',
    requires: [
      { key: 'consent', label: '환자 자필서명 동의서', caveat: '도장·지장은 인정되지 않아요' },
      { key: 'relation', label: '가족관계증명서 또는 주민등록등본', caveat: '3개월 이내 발급본' },
      { key: 'agentId', label: '대리인 신분증' },
    ],
    eligibleRelation: ['배우자', '직계 존비속', '환자가 지정한 대리인'],
    verified: true,
  },
  diagnosis: {
    docId: 'diagnosis',
    possible: false,
    legalBasis: 'medical-law-17',
    reason: '진단서는 원칙적으로 환자 본인에게만 발급돼요',
    exception: '환자 사망 또는 의식불명 시 예외가 있으나 원문 검증 전이라 안내하지 않는다',
    alternative:
      '부모님이 직접 발급받아 사진으로 보내주시는 방법. 확진 정보만 필요하면 의무기록 사본(병리보고서)은 대리발급이 돼요',
    verified: true,
  },
  opinion: {
    docId: 'opinion',
    possible: false,
    legalBasis: 'medical-law-17',
    reason: '소견서는 원칙적으로 환자 본인에게만 발급돼요',
    alternative: '부모님 본인이 발급받아 전달',
    verified: true,
  },
};

/* ------------------------------------------------------------
   §E. 케어러 궁금증 + 가드레일
   ------------------------------------------------------------
   판정하지 않고 정확한 창구로 넘긴다.
   단 넘기기 전에 감정을 먼저 받는다(empathy 필드).
   "안 해드려요"만 있으면 사용자는 버려진 느낌을 받는다.
   ------------------------------------------------------------ */
export const GUARDRAILS = [
  {
    id: 'what-disease',
    match: /무슨 병|뭐라 하셨|뭐라고 하셨|암인가|암이래|중증인가|심각한가|나쁜 건가|몇 기/,
    empathy: '가장 먼저 알고 싶은 게 그거죠. 당연해요',
    weDo: '서류와 들으신 내용을 눈높이로 풀어드려요',
    weDont: '새로운 진단이나 중증도 판단',
    outOfScopeRef: 'diagnosisJudgment',
    redirectTo: '담당의',
    redirectHint: '병명·병기·예후는 담당 의사만 판단할 수 있어요',
    // 판정은 안 하지만 그 자리에서 물을 질문을 만들어준다
    weCanStillHelp: '대신 다음 진료에서 그대로 읽으실 질문을 만들어드려요',
  },
  {
    id: 'insurance-amount',
    match: /보험금|얼마 받|지급되나|보상되나|얼마나 나와/,
    empathy: '돈 문제가 겹치면 더 막막하시죠',
    weDo: '청구에 필요한 서류 목록을 빠짐없이 정리해드려요',
    weDont: '보험금 액수나 지급 여부 판단',
    outOfScopeRef: 'insurancePayout',
    redirectTo: '가입 보험사',
    redirectHint: '약관 사항이라 보험사마다 달라요',
    weCanStillHelp: '지금 안 챙기면 나중에 다시 떼러 가야 하는 서류를 미리 알려드려요',
  },
  {
    id: 'which-hospital',
    match: /어느 병원|어디가 나은|병원 추천|어느 과|무슨 과|의사 추천|잘하는 곳/,
    empathy: '잘못 고르면 어쩌나 싶으시죠',
    weDo: '큰 병원에 갈 때 필요한 절차와 서류를 안내해요',
    weDont: '병원·의사·진료과 추천, 전원 필요성 판단',
    outOfScopeRef: 'hospitalRecommend',
    redirectTo: '담당의',
    redirectHint: '어느 병원이 나은지는 안내하지 않아요',
    weCanStillHelp: '어디로 가시든 의뢰서 없이 가면 진료비가 크게 달라지는 것부터 알려드려요',
  },
  {
    id: 'longterm-care-eligibility',
    match: /장기요양.*되나|등급.*나오나|대상인가|요양보호사/,
    empathy: '낮에 봐드릴 사람이 필요한 상황이시군요',
    weDo: '신청 채널과 필요 서류, 소요 기간을 안내해요',
    weDont: '대상 여부·등급 판정',
    redirectTo: '국민건강보험공단 1577-1000',
    redirectHint: '등급 판정은 공단 권한이에요',
    weCanStillHelp: '이 경로가 막힐 때 확인할 다른 창구 이름도 같이 알려드려요',
  },
  {
    id: 'medication',
    match: /약.*맞나|약.*괜찮|같이 먹어도|부작용|용량.*맞나/,
    empathy: '드시는 약이 많으면 걱정되는 게 맞아요',
    weDo: '처방전의 용법과 투약일수를 정리해 전달해요',
    weDont: '복약 적정성·약물 상호작용 판단',
    outOfScopeRef: 'medicationJudgment',
    redirectTo: '약사 또는 담당의',
    redirectHint: '약 조합과 부작용은 약사·의사에게 확인하셔야 해요',
    weCanStillHelp: '검사 전에 중단해야 하는 약이 있는지 물어볼 문장을 만들어드려요',
  },
  {
    id: 'treatment-choice',
    match: /수술.*해야|항암.*해야|치료.*골라|어떤 치료|방사선.*해야/,
    empathy: '결정을 대신 짊어지고 계시네요',
    weDo: '그 진료에서 무엇이 결정되는지, 무엇을 물어야 하는지 정리해요',
    weDont: '치료법 선택·치료방침 결정',
    outOfScopeRef: 'diagnosisJudgment',
    redirectTo: '담당의',
    redirectHint: '치료 선택은 담당의와 상의하실 일이에요',
    weCanStillHelp: '진료실에서 그대로 읽으실 질문 목록을 만들어드려요',
  },
  {
    id: 'employment',
    match: /회사.*그만|실업급여|퇴직|휴직.*되나/,
    empathy: '병원 일에 회사 일까지 겹쳤네요',
    weDo: '사업주 제출용 서류 종류를 안내해요',
    weDont: '고용·퇴직·실업급여 판단',
    redirectTo: '고용노동부 1350',
    redirectHint: '근로 문제는 고용노동부에 확인하셔야 해요',
    weCanStillHelp: '어떤 서류를 병원에서 떼야 하는지는 알려드려요',
  },
];

/* ------------------------------------------------------------
   출처 신뢰 계층
   ------------------------------------------------------------
   Tier 1  룰의 근거로 인용 가능 (법령·공공기관 원문)
   Tier 2  실무 관행 참고. 룰 근거로 인용 금지 (병원 안내·사설 DB)
   Tier 3  경험·후기. 사람들이 실제로 어디서 막히는지 알아내는 재료
           → MVP 출력에는 쓰지 않는다. 룰 후보를 찾는 데만 쓴다
   ------------------------------------------------------------ */
export const SOURCE_TIERS = {
  1: { label: '공식 원문', citable: true, useInMVP: true },
  2: { label: '실무 참고', citable: false, useInMVP: true, note: '문구 참고만. 근거란에 넣지 않는다' },
  3: {
    label: '경험·후기',
    citable: false,
    useInMVP: false,
    note:
      '블로그·카페·커뮤니티. 사람들이 실제로 어디서 막히는지 찾는 데 쓴다. ' +
      '룰 후보 발굴용이며 출력에 인용하지 않는다. MVP에서는 사용하지 않고, ' +
      '룰 백로그를 채울 때 별도 리서치로 쓴다',
  },
};

export const SOURCES = {
  'nhis-special-copay': {
    tier: 1,
    org: '국민건강보험공단',
    label: '본인일부부담금 산정특례 제도',
    url: 'https://www.nhis.or.kr/static/html/wbma/c/wbmac0215.html',
    tel: '1577-1000',
    verifiedAt: '2026-07-26',
  },
  'nhis-referral': {
    tier: 1,
    org: '국민건강보험공단',
    label: '요양급여 의뢰 절차 안내',
    url: 'https://www.nhis.or.kr',
    tel: '1577-1000',
    verifiedAt: '2026-07-22',
  },
  'medical-law-17': {
    tier: 1,
    org: '법제처 국가법령정보센터',
    label: '의료법 제17조 (진단서 등)',
    url: 'https://www.law.go.kr',
    verifiedAt: '2026-07-22',
  },
  'medical-law-18': {
    tier: 1,
    org: '법제처 국가법령정보센터',
    label: '의료법 제18조 (처방전 작성과 교부)',
    url: 'https://www.law.go.kr',
    verifiedAt: '2026-07-22',
  },
  'medical-law-21': {
    tier: 1,
    org: '법제처 국가법령정보센터',
    label: '의료법 제21조 (기록 열람 등)',
    url: 'https://www.law.go.kr/LSW//lsLinkCommonInfo.do?lsJoLnkSeq=1007235937&chrClsCd=010202',
    verifiedAt: '2026-07-26',
  },
  'medical-law-rule-9': {
    tier: 1,
    org: '법제처 국가법령정보센터',
    label: '의료법 시행규칙 제9조 (진단서 기재사항)',
    url: 'https://www.law.go.kr',
    verifiedAt: '2026-07-22',
  },
  'medical-law-rule-form': {
    tier: 1,
    org: '법제처 국가법령정보센터',
    label: '의료법 시행규칙 별지서식 (의무기록 열람·사본 발급)',
    url: 'https://www.law.go.kr',
    verifiedAt: '2026-07-22',
  },
  'knia-claim': {
    tier: 1,
    org: '손해보험협회',
    label: '실손의료보험 청구 표준안내',
    url: 'https://www.knia.or.kr',
    verifiedAt: '2026-07-22',
  },
  longtermcare: {
    tier: 1,
    org: '노인장기요양보험',
    label: '장기요양인정 신청 안내',
    url: 'https://www.longtermcare.or.kr',
    tel: '1577-1000',
    verifiedAt: '2026-07-22',
  },
  bokjiro: { tier: 1, org: '복지로', label: '복지서비스 찾기', url: 'https://www.bokjiro.go.kr', verifiedAt: '2026-07-22' },
  mohw: { tier: 1, org: '보건복지부', label: '보건복지부', url: 'https://www.mohw.go.kr', verifiedAt: '2026-07-22' },
  nts: { tier: 1, org: '국세청', label: '국세청', url: 'https://www.nts.go.kr', verifiedAt: '2026-07-27' },
  ncc: { tier: 1, org: '국립암센터', label: '국립암센터', url: 'https://www.ncc.re.kr', verifiedAt: '2026-07-27' },

  // Tier 2 — 실무 관행 파악용. 근거란에 넣지 않는다
  'hospital-guide': {
    tier: 2,
    org: '각 병원 발급안내',
    label: '병원별 증명서 발급 안내',
    url: null,
    note: '지참 서류·수수료·유효기간의 실무 관행 확인용',
  },
};

/* ------------------------------------------------------------
   고지 문구
   ------------------------------------------------------------ */
export const NOTICES = {
  base: '확정 판단이 아니며, 최종 확인은 해당 기관과 하십시오.',
  unverifiedNumber: '해당 기관 확인 필요',
  insurance: '사보험 지급 여부와 금액은 판단하지 않아요. 약관 사항이라 가입 보험사에 확인하셔야 해요.',
  noDiagnosis: '진단은 하지 않아요. 의사 선생님 말씀을 정리해 전달합니다.',
  consent:
    '부모님 본인 동의를 받으셨나요? 건강정보는 부모님의 민감정보이고, 자녀가 대신 서명하는 구조는 쓰지 않아요.',
  proxySoon: '지금은 절차 안내까지 도와드려요. 대신 접수해드리는 건 준비 중입니다.',
};

/* ------------------------------------------------------------
   조회 헬퍼 (순수 함수)
   ------------------------------------------------------------ */

export function findDoc(nameOrId) {
  if (!nameOrId) return null;
  const q = String(nameOrId).trim();
  return (
    DOCS.find((d) => d.id === q) ||
    DOCS.find((d) => d.name === q) ||
    DOCS.find((d) => d.aka.includes(q)) ||
    null
  );
}

/** 자유 텍스트에서 언급된 서류 전부 (등장 순서, 중복 제거) */
export function detectDocs(text) {
  if (!text) return [];
  const hits = [];
  for (const doc of DOCS) {
    for (const n of [doc.name, ...doc.aka]) {
      if (text.includes(n)) {
        if (!hits.includes(doc.id)) hits.push(doc.id);
        break;
      }
    }
  }
  return hits;
}

export function tierOf(docId) {
  const doc = findDoc(docId);
  return doc ? TIERS[doc.tier] || null : null;
}

/** 케어러가 이 서류를 직접 뗄 수 있는가 */
export function canDelegate(docId) {
  const doc = findDoc(docId);
  if (!doc) return null;
  if (doc.tier === 'T1') return { possible: true, note: '병원이 자동으로 줘요' };
  if (DELEGATION[docId]) return DELEGATION[docId];
  return { possible: null, note: '확인 필요' };
}

/** T1·T2만으로 조건부 안내가 가능한가 (첫 기능의 판정 기준) */
export function supportsConditional(docIds) {
  if (!docIds || !docIds.length) return false;
  return docIds.some((id) => {
    const t = tierOf(id);
    return t && t.supportsConditional;
  });
}

export function matchGuardrail(text) {
  if (!text) return null;
  return GUARDRAILS.find((g) => g.match.test(text)) || null;
}

/** 출처 id → 인용 가능하면 정보, 아니면 null */
export function citeSource(sourceId) {
  const s = SOURCES[sourceId];
  if (!s) return null;
  const t = SOURCE_TIERS[s.tier];
  return t && t.citable ? s : null;
}

/** 범위 밖 항목의 사용자 문구 (영구 금지와 준비 중을 구분해서 말한다) */
export function outOfScopeMessage(key) {
  const o = OUT_OF_SCOPE[key];
  if (!o) return null;
  return {
    text: o.userFacing,
    isPermanent: o.scope === SCOPE.NEVER,
    comingSoon: o.scope === SCOPE.SOON,
  };
}
