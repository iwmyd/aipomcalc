/* 에이팜 계산기 — 검색 (브라우저·Node 공용, 외부 의존성 없음)
 * 1단계 정확 검색: 이름·설명·별칭 포함 / 초성.  2단계 오타 보정: 자모 단위 편집 거리(인접 자리바꿈 포함)로 비슷한 이름.
 * 한/영 전환을 깜빡하고 친 영문(예: dusqhd → 연봉)도 자판 배열로 바꿔서 찾는다. */
(function (root) {
  'use strict';
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  // 따로 친 겹모음·겹받침 자모도 자판 단위로 쪼갠다
  const SPLIT = { ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ', ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ' };
  // 두벌식 자판 (영문 상태로 친 글자 → 자모)
  const KEY = { q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ', a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ', z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ', Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ' };

  // 찾는 사람이 쓸 법한 다른 이름 (정확 검색·오타 보정 모두에 쓴다)
  const ALIAS = {
    basic: ['계산기', '사칙연산'], scientific: ['공학계산기', '삼각함수', '로그'],
    loan: ['대출', '이자', '주담대', '주택담보대출', '원리금균등', '원금균등', '신용대출'], dsr: ['총부채원리금상환비율', '대출한도'],
    prepay: ['중도상환', '조기상환'], installment: ['할부', '카드할부', '무이자할부'], savings: ['예금', '적금', '정기예금', '이자'],
    compound: ['복리', '72의법칙', '투자수익'], military: ['장병내일준비적금', '군인적금', '장병적금'],
    'car-loan': ['차할부', '자동차할부', '오토론'], 'car-tax': ['자동차세', '차세'], severance: ['퇴직금', '퇴직'],
    rent: ['전세', '월세', '전월세', '전환율'], area: ['평', '제곱미터', '평수'], dday: ['디데이', '날짜', '기념일', '100일', '날짜계산'],
    age: ['나이', '만나이', '연나이'], percent: ['퍼센트', '백분율', '할인율', '증감률', '비율'], charcount: ['글자수', '자소서', '바이트', '글자세기'],
    refinance: ['대환', '대환대출', '갈아타기'], goal: ['목표금액', '저축', '1억모으기'], avgprice: ['평단가', '물타기', '불타기', '주식'],
    'car-acq': ['취득세', '등록세', '취등록세'], salary: ['연봉', '월급', '실수령', '세후', '연봉실수령액'], wage: ['시급', '주휴수당', '알바', '최저임금', '알바실수령', '3.3%', '삼쩜삼', '일용직'],
    unemployment: ['실업급여', '구직급여'], 'annual-leave': ['연차', '연차수당', '월차', '휴가', '연차개수'], brokerage: ['복비', '중개수수료', '중개보수', '부동산수수료'],
    'area-volume': ['면적', '부피', '체적', '넓이', '도형', '삼각형넓이', '원넓이', '좌표면적', '사다리꼴'], materials: ['콘크리트', '레미콘', '물량', '철근', '철근무게', '철근중량', '벽돌', '조적', '적산', '루베'],
    slope: ['경사도', '구배', '기울기', '경사로', '물매', '퍼센트경사'], stairs: ['계단', '단높이', '디딤판', '챌판'], earthwork: ['토공량', '토량', '절토', '성토', '토량환산계수'], 'unit-convert': ['단위환산', '단위변환', '척', '피트', '인치', 'mpa', 'kgf', '헥타르'],
    'freelance-tax': ['종합소득세', '종소세', '프리랜서', '33환급', '3.3환급', '세금환급', '단순경비율'], electricity: ['전기요금', '전기세', '누진세', '누진제', 'kwh', '전기료'], vat: ['부가세', '부가가치세', '공급가액'], subscription: ['청약', '청약가점', '아파트청약'], bmi: ['비만도', '체중', '적정체중'],
  };

  const norm = (s) => String(s || '').replace(/[\s·()\-_,./]+/g, '').toLowerCase();
  const cho = (s) => [...s].map((c) => { const k = c.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? CHO[Math.floor(k / 588)] : c; }).join('');
  /** 글자를 자판 단위 자모로: 연봉 → ㅇㅕㄴㅂㅗㅇ */
  const jamo = (s) => [...s].map((c) => {
    const k = c.charCodeAt(0) - 0xac00;
    if (k >= 0 && k < 11172) return CHO[Math.floor(k / 588)] + JUNG[Math.floor((k % 588) / 28)] + JONG[k % 28];
    return SPLIT[c] || c;
  }).join('');
  /** 영문으로 친 한글이면 자모로 바꿔 준다 (아니면 null) */
  const fromQwerty = (raw) => {
    const s = String(raw || '').replace(/\s+/g, '');
    if (!/^[a-zA-Z]{2,}$/.test(s)) return null;
    const out = [...s].map((c) => KEY[c] || KEY[c.toLowerCase()]).join('');
    return /[ㅏ-ㅣ]/.test(out) ? out : null; // 모음이 하나도 없으면 영어 낱말로 본다
  };
  const isCho = (s) => /^[ㄱ-ㅎ]+$/.test(s);

  /** q 가 t 의 어느 부분과 가장 가까운지: 부분 문자열 편집 거리 (삽입·삭제·교체·인접 자리바꿈 = 1) */
  function subDist(q, t) {
    const a = [...q], b = [...t], n = a.length, m = b.length;
    if (!n) return 0;
    let p2 = null, p1 = new Array(m + 1).fill(0), best = n;
    for (let i = 1; i <= n; i++) {
      const cur = new Array(m + 1); cur[0] = i;
      for (let j = 1; j <= m; j++) {
        let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        cur[j] = v;
      }
      p2 = p1; p1 = cur;
    }
    for (let j = 0; j <= m; j++) best = Math.min(best, p1[j]);
    return best;
  }
  /** 허용 오타 수: 자모 길이 기준 (짧을수록 엄격) */
  const allow = (len) => (len < 4 ? 0 : len < 7 ? 1 : len < 12 ? 2 : 3);

  /** 정확 검색 + (없으면) 오타 보정. 반환: { hits, fuzzy, via } — via 는 'qwerty'(한/영 변환) 또는 '' */
  function search(index, raw) {
    const t = norm(raw);
    if (!t) return { hits: index.slice(), fuzzy: false, via: '' };
    const names = (x) => [x.n, ...(ALIAS[x.s] || [])].map(norm);
    // 필드마다 따로 본다(이어 붙이면 경계에서 엉뚱하게 걸림). 순위: 이름 0 > 별칭 1 > 설명 2
    const fields = (x) => [[norm(x.n), 0], ...(ALIAS[x.s] || []).map((a) => [norm(a), 1]), [norm(x.l), 2]];
    // test(h) 는 걸린 위치(없으면 -1)를 돌려준다 — 같은 순위면 앞쪽에서 걸린 것 먼저
    const rankBy = (test) => index.map((x, i) => {
      const r = Math.min(...fields(x).map(([h, w]) => { const p = test(h); return p < 0 ? 1e9 : w * 1000 + p; }));
      return { x, r, i };
    }).filter((o) => o.r < 1e9).sort((a, b) => a.r - b.r || a.i - b.i).map((o) => o.x);
    const jq = jamo(t);
    const at = (h) => [h.indexOf(t), cho(h).indexOf(t)].filter((p) => p >= 0).concat(jamo(h).includes(jq) ? [0.5] : [])[0] ?? -1;
    let hits = rankBy(at);
    if (hits.length) return { hits, fuzzy: false, via: '' };
    const qw = fromQwerty(raw);
    if (qw) { hits = rankBy((h) => jamo(h).indexOf(qw)); if (hits.length) return { hits, fuzzy: false, via: 'qwerty' }; }
    // 오타 보정: 이름·별칭과의 자모 편집 거리
    const q = qw || jamo(t), choQ = !qw && isCho(t);
    const lim = choQ ? (t.length >= 3 ? 1 : 0) : allow([...q].length);
    if (!lim) return { hits: [], fuzzy: true, via: qw ? 'qwerty' : '' };
    const scored = index.map((x, i) => {
      const ds = names(x).map((nm) => (choQ ? subDist(t, cho(nm)) : subDist(q, jamo(nm))));
      const d = Math.min(...ds);
      return { x, d, w: ds[0] === d ? 0 : 1, i }; // 같은 거리면 이름에서 걸린 쪽 먼저
    }).filter((r) => r.d <= lim).sort((p, r) => p.d - r.d || p.w - r.w || p.i - r.i);
    return { hits: scored.slice(0, 5).map((r) => r.x), fuzzy: true, via: qw ? 'qwerty' : '' };
  }

  /** 없는 주소(404)에서 가장 비슷한 계산기 주소: /salry/ → salary */
  function nearSlug(index, path) {
    const s = String(path || '').toLowerCase().replace(/^\/+|\/+$/g, '').split('/')[0].replace(/\.html?$/, '');
    if (s.length < 2) return null;
    let best = null;
    index.forEach((x) => { const d = Math.max(subDist(s, x.s), subDist(x.s, s)); if (!best || d < best.d) best = { x, d }; });
    return best && best.d <= Math.max(1, Math.floor(s.length / 3)) ? best.x : null;
  }

  const api = { search, nearSlug, jamo, cho, fromQwerty, subDist, ALIAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalcSearch = api;
})(this);
