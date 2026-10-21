/* 에이팜 계산기 — 계산 로직 (브라우저·Node 공용, 외부 의존성 없음)
 * 모든 계산은 월 단위 단순 계산. 가정은 각 페이지 "계산 기준" 에 표시한다. */
(function (root) {
  'use strict';

  /** 대출 상환 스케줄. method: 'equal-payment'(원리금균등) | 'equal-principal'(원금균등) | 'bullet'(만기일시) */
  function loan(principal, annualRate, months, method) {
    const r = annualRate / 12;
    const pmt = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
    const rows = [];
    let bal = principal, totalInterest = 0;
    for (let i = 1; i <= months; i++) {
      const interest = bal * r;
      let prin;
      if (i === months) prin = bal;
      else if (method === 'equal-payment') prin = pmt - interest;
      else if (method === 'equal-principal') prin = principal / months;
      else prin = 0;
      const pay = interest + prin;
      rows.push({ n: i, begin: bal, interest, principal: prin, payment: pay, end: bal - prin });
      totalInterest += interest;
      bal -= prin;
    }
    return { rows, first: rows[0].payment, last: rows[rows.length - 1].payment, totalInterest, totalPayment: principal + totalInterest };
  }

  /** 예금(목돈 1회 예치) 이자. compound: 'simple' | 'monthly' */
  function deposit(amount, annualRate, months, compound, taxRate) {
    const r = annualRate / 12;
    const gross = compound === 'monthly' ? amount * (Math.pow(1 + r, months) - 1) : amount * r * months;
    const tax = Math.floor(gross * taxRate / 10) * 10; // 원 단위 절사(10원 미만) — 단순화
    return { gross, tax, net: gross - tax, total: amount + gross - tax };
  }

  /** 적금(매월 같은 금액 납입) 이자. 1회차는 n개월, 마지막 회차는 1개월 이자. */
  function savings(monthly, annualRate, months, compound, taxRate) {
    const r = annualRate / 12;
    let gross = 0;
    for (let k = 1; k <= months; k++) {
      const m = months - k + 1; // k회차 납입금이 이자를 받는 개월 수
      gross += compound === 'monthly' ? monthly * (Math.pow(1 + r, m) - 1) : monthly * r * m;
    }
    const tax = Math.floor(gross * taxRate / 10) * 10;
    const paid = monthly * months;
    return { paid, gross, tax, net: gross - tax, total: paid + gross - tax };
  }

  /** 중도상환수수료 = 상환금액 × 수수료율 × 잔여기간 / 수수료 부과기간 (잔여기간이 부과기간을 넘으면 1) */
  function prepayFee(repayAmount, feeRate, elapsedMonths, feePeriodMonths) {
    const remain = Math.max(0, feePeriodMonths - elapsedMonths);
    const ratio = feePeriodMonths > 0 ? Math.min(1, remain / feePeriodMonths) : 0;
    return { remain, ratio, fee: repayAmount * feeRate * ratio };
  }

  /** 퇴직금 = 1일 평균임금 × 30 × (재직일수 ÷ 365). 1일 평균임금 = 최근 3개월 임금총액 ÷ 그 기간 총일수
   *  (근로자퇴직급여 보장법 제8조, 근로기준법 제2조 제1항 제6호). 재직 1년 미만이면 법정 퇴직금 없음. */
  function severance(wage3m, days3m, serviceDays, bonusYear, leavePayYear) {
    const extra = (bonusYear || 0) * 3 / 12 + (leavePayYear || 0) * 3 / 12; // 상여·연차수당은 3개월분 가산
    const daily = days3m > 0 ? (wage3m + extra) / days3m : 0;
    const eligible = serviceDays >= 365;
    return { daily, eligible, amount: eligible ? daily * 30 * (serviceDays / 365) : 0 };
  }

  /** 전월세 전환: 보증금 일부를 월세로 돌릴 때 월세 = 전환 보증금 × 전환율 ÷ 12.
   *  법정 상한 전환율 = min(연 10%, 한국은행 기준금리 + 연 2%) (주택임대차보호법 제7조의2, 시행령 제9조). */
  function rentConvert(depositAmount, baseRate) {
    const legalRate = Math.min(0.10, baseRate + 0.02);
    return { legalRate, monthly: depositAmount * legalRate / 12, yearly: depositAmount * legalRate };
  }

  /** DSR = 모든 대출의 연간 원리금 상환액 ÷ 연소득. loans: [{principal, rate, months, method}] (원리금은 첫 해 12개월 합) */
  function dsr(annualIncome, loans) {
    const yearly = loans.reduce((sum, l) => {
      if (!l.principal || !l.months) return sum;
      const rows = loan(l.principal, l.rate, l.months, l.method).rows.slice(0, 12);
      return sum + rows.reduce((a, r) => a + r.payment, 0) * (12 / rows.length);
    }, 0);
    return { yearly, ratio: annualIncome > 0 ? yearly / annualIncome : 0 };
  }

  /** 카드 할부수수료(잔액 기준): 매달 원금 균등 + 남은 원금 × 연수수료율 ÷ 12. 총수수료 = 원금 × 율/12 × (개월+1)/2 */
  function installment(amount, annualFeeRate, months) {
    const r = loan(amount, annualFeeRate, months, 'equal-principal');
    return { rows: r.rows, first: r.first, totalFee: r.totalInterest, total: r.totalPayment };
  }

  /** 장병내일준비적금 (국방부 안내, 2025.1~): 월 한도 55만(계좌당 30만), 은행이자 비과세(단리 적립식), 만기 시 원금 100% 매칭지원금 */
  const MILITARY = { maxMonthly: 550000, perAccount: 300000, matchRatio: 1.0 };
  function military(monthly, annualRate, months) {
    const m = Math.min(monthly, MILITARY.maxMonthly);
    const s = savings(m, annualRate, months, 'simple', 0);
    const match = s.paid * MILITARY.matchRatio;
    return { monthly: m, capped: monthly > MILITARY.maxMonthly, paid: s.paid, interest: s.gross, match, total: s.paid + s.gross + match };
  }

  /** 날짜: 두 날짜 사이 일수(b−a), 기념일식 N일째(+1), 날짜 더하기. 입력은 'YYYY-MM-DD' (UTC 기준으로 계산해 시간대 영향 제거) */
  const dayMs = 86400000;
  const toUTC = (s) => { const [y, m, d] = String(s).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const fmt = (t) => new Date(t).toISOString().slice(0, 10);
  function dday(from, to) { const diff = Math.round((toUTC(to) - toUTC(from)) / dayMs); return { diff, nth: diff >= 0 ? diff + 1 : diff }; }
  function addDays(from, n) { return fmt(toUTC(from) + n * dayMs); }

  /** 나이: 만 나이(행정기본법 제7조의2, 2023.6.28~ 원칙), 연 나이(현재연도−출생연도), 세는 나이(+1) */
  function age(birth, today) {
    const [by, bm, bd] = birth.split('-').map(Number), [ty, tm, td] = today.split('-').map(Number);
    const man = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
    return { man, year: ty - by, counting: ty - by + 1 };
  }

  /** 평 ↔ ㎡ : 1평 = 400/121 ㎡ (≈3.305785㎡) */
  const PYEONG = 400 / 121;
  const toPyeong = (m2) => m2 / PYEONG, toM2 = (py) => py * PYEONG;

  /** 복리 성장: 초기 원금 + 매월 적립. freq 'monthly'(월복리) | 'yearly'(연복리 — 같은 연수익률의 월 환산율 사용).
   *  taxRate 는 이자에 대한 세율(일반 15.4%, 비과세 0) — 매년 말 이자분에서 차감하지 않고 최종 이자에만 적용(단순화). */
  function compound(initial, monthly, annualRate, years, freq, taxRate) {
    const mr = freq === 'yearly' ? Math.pow(1 + annualRate, 1 / 12) - 1 : annualRate / 12;
    let bal = initial, paid = initial;
    const series = [{ year: 0, principal: initial, interest: 0, balance: initial }];
    for (let m = 1; m <= Math.round(years * 12); m++) {
      bal = bal * (1 + mr) + monthly; paid += monthly;
      if (m % 12 === 0 || m === Math.round(years * 12)) series.push({ year: +(m / 12).toFixed(2), principal: paid, interest: bal - paid, balance: bal });
    }
    const gross = bal - paid, tax = Math.floor(gross * (taxRate || 0) / 10) * 10;
    return { series, paid, gross, tax, net: gross - tax, total: bal - tax, rule72: annualRate > 0 ? 72 / (annualRate * 100) : Infinity };
  }

  /** 수식 계산기 (eval 사용 안 함 — 재귀 하강 파서). 지원: + − × ÷ ^ ( ) % ! √ π e, sin cos tan asin acos atan ln log sqrt abs, 암시적 곱(2π, 3(4))
   *  % : a+b% / a−b% 는 a의 b% (휴대폰 계산기 방식), 그 외는 ÷100. angle: 'deg' | 'rad' */
  function evaluate(src, angle) {
    const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/\s+/g, '');
    let i = 0;
    const toRad = (x) => (angle === 'rad' ? x : (x * Math.PI) / 180), fromRad = (x) => (angle === 'rad' ? x : (x * 180) / Math.PI);
    const round = (x) => (Math.abs(x) < 1e-12 ? 0 : x);
    const F = {
      sin: (x) => round(Math.sin(toRad(x))), cos: (x) => round(Math.cos(toRad(x))), tan: (x) => { const c = Math.cos(toRad(x)); if (Math.abs(c) < 1e-12) throw new Error('정의되지 않음'); return round(Math.tan(toRad(x))); },
      asin: (x) => fromRad(Math.asin(x)), acos: (x) => fromRad(Math.acos(x)), atan: (x) => fromRad(Math.atan(x)),
      ln: (x) => Math.log(x), log: (x) => Math.log10(x), sqrt: (x) => { if (x < 0) throw new Error('음수의 제곱근'); return Math.sqrt(x); }, abs: Math.abs,
    };
    const peek = () => s[i];
    const fact = (n) => { if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error('계승은 0~170 정수만'); let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
    function primary() {
      if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw new Error('괄호 짝이 맞지 않음'); i++; return v; }
      const num = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
      if (num) { i += num[0].length; return parseFloat(num[0]); }
      const id = s.slice(i).match(/^[a-z]+/i);
      if (id) {
        const name = id[0].toLowerCase(); i += id[0].length;
        if (name === 'pi') return Math.PI;
        if (name === 'e') return Math.E;
        if (F[name]) { if (peek() !== '(') { const arg = unary(); return F[name](arg); } i++; const v = expr(); if (peek() !== ')') throw new Error('괄호 짝이 맞지 않음'); i++; return F[name](v); }
        throw new Error('알 수 없는 기호: ' + name);
      }
      throw new Error('수식이 올바르지 않음');
    }
    function postfix() {
      let v = primary(), pct = false;
      while (peek() === '!' || peek() === '%') { if (s[i++] === '!') v = fact(v); else pct = true; }
      return pct ? { v, pct } : v;
    }
    const val = (x) => (typeof x === 'object' ? x.v / 100 : x);
    function power() { const b = postfix(); if (peek() === '^') { i++; const e = unary(); return Math.pow(val(b), val(e)); } return b; }
    function unary() { if (peek() === '-') { i++; const v = unary(); return typeof v === 'object' ? { v: -v.v, pct: true } : -v; } if (peek() === '+') { i++; return unary(); } return power(); }
    function term() {
      let v = val(unary());
      for (;;) {
        const c = peek();
        if (c === '*' || c === '/') { i++; const r = val(unary()); if (c === '/' && r === 0) throw new Error('0으로 나눌 수 없음'); v = c === '*' ? v * r : v / r; }
        else if (c && /[\d.(a-z]/i.test(c)) { v *= val(unary()); } // 암시적 곱
        else return v;
      }
    }
    function expr() {
      let v = term();
      for (;;) {
        const c = peek();
        if (c !== '+' && c !== '-') return v;
        i++;
        const save = i; let r = unary(); // a ± b% → a의 b%
        if (typeof r === 'object' && (peek() === undefined || peek() === ')' || peek() === '+' || peek() === '-')) r = v * r.v / 100;
        else { i = save; r = term(); }
        v = c === '+' ? v + r : v - r;
      }
    }
    if (!s) return 0;
    const out = val(expr());
    if (i < s.length) throw new Error('수식이 올바르지 않음');
    if (!isFinite(out)) throw new Error('결과가 너무 큼');
    return parseFloat(out.toPrecision(12));
  }

  /** 자동차 할부: 원금 = 차량가 − 선납금, 원리금균등 */
  function carLoan(price, down, annualRate, months) {
    const principal = Math.max(0, price - down);
    if (!principal || !months) return { principal, monthly: 0, totalInterest: 0, total: down, rows: [] };
    const r = loan(principal, annualRate, months, 'equal-payment');
    return { principal, monthly: r.first, totalInterest: r.totalInterest, total: down + r.totalPayment, rows: r.rows };
  }

  /** 자동차세(비영업용 승용) — 지방세법 제127조. cc당: ≤1000cc 80원, ≤1600cc 140원, 초과 200원.
   *  차령 n≥3: 연세액 × (1 − 0.05(n−2)), n>12 는 12. 전기·수소 등 그 밖의 승용 10만 원. 지방교육세 30%(제151조). */
  function carTax(cc, ageYears, fuel) {
    let base, perCc = 0;
    if (fuel === 'ev') base = 100000;
    else { perCc = cc <= 1000 ? 80 : cc <= 1600 ? 140 : 200; base = cc * perCc; }
    const n = Math.min(Math.max(1, Math.floor(ageYears)), 12);
    const cut = fuel === 'ev' || n < 3 ? 0 : 0.05 * (n - 2);
    const tax = Math.floor(base * (1 - cut) / 10) * 10;
    const edu = Math.floor(tax * 0.3 / 10) * 10;
    return { perCc, base, cut, tax, edu, total: tax + edu, half: (tax + edu) / 2 };
  }

  // ───────────── 2026 기준값 (출처: 각 계산기 페이지 "계산 기준") ─────────────
  const Y2026 = {
    pension: 0.0475, pensionMin: 410000, pensionMax: 6590000, // 국민연금 근로자 4.75%, 기준소득월액 하·상한
    health: 0.03595, care: 0.1314, employ: 0.009,             // 건강보험 근로자 3.595%, 장기요양 = 건보료×13.14%, 고용보험 0.9%
    employBoss: 0.0025,                                       // 고용안정·직업능력개발(회사만, 150인 미만 0.25%)
    bizTax: 0.03, dailyDed: 150000,                           // 사업소득 원천징수 3%(+지방 0.3%), 일용근로 근로소득공제 일 15만 원
    minWage: 10320,                                           // 2026 최저임금(시간급)
    ubMax: 68100, ubRate: 0.6, ubMinRatio: 0.8,               // 구직급여 1일 상한, 평균임금 60%, 하한 = 최저임금 80%
  };
  const floor10 = (v) => Math.floor(Math.round(v) / 10) * 10; // 소수 오차 정리 후 10원 미만 절사

  /** 근로소득세(연) — 소득세법 기본세율·근로소득공제·근로소득세액공제·자녀세액공제·표준세액공제 13만 원. 간이세액표의 추정치 */
  function incomeTaxYear(totalPay, family, kids, pensionYear, insYear) {
    const g = totalPay;
    const ded = g <= 5e6 ? g * 0.7 : g <= 15e6 ? 3.5e6 + (g - 5e6) * 0.4 : g <= 45e6 ? 7.5e6 + (g - 15e6) * 0.15 : g <= 1e8 ? 12e6 + (g - 45e6) * 0.05 : Math.min(2e7, 14.75e6 + (g - 1e8) * 0.02);
    const base = Math.max(0, g - ded - 1.5e6 * Math.max(1, family) - pensionYear - insYear);
    const B = [[14e6, 0.06, 0], [50e6, 0.15, 84e4], [88e6, 0.24, 624e4], [150e6, 0.35, 1536e4], [300e6, 0.38, 3706e4], [500e6, 0.40, 9406e4], [1e9, 0.42, 17406e4], [Infinity, 0.45, 38406e4]];
    let prev = 0, calc = 0;
    for (const [up, r, acc] of B) { if (base <= up) { calc = acc + (base - prev) * r; break; } prev = up; }
    let credit = calc <= 13e5 ? calc * 0.55 : 715000 + (calc - 13e5) * 0.3;
    const lim = g <= 33e6 ? 740000 : g <= 70e6 ? Math.max(660000, 740000 - (g - 33e6) * 0.008) : g <= 120e6 ? Math.max(500000, 660000 - (g - 70e6) * 0.5) : Math.max(200000, 500000 - (g - 120e6) * 0.5);
    credit = Math.min(credit, lim);
    const kidCredit = kids <= 0 ? 0 : kids === 1 ? 250000 : kids === 2 ? 550000 : 950000 + (kids - 3) * 400000;
    return Math.max(0, calc - credit - kidCredit - 130000);
  }
  /** 연봉 실수령액 (월). nonTax: 월 비과세(식대 등) */
  function salary(annual, nonTax, family, kids) {
    const gross = annual / 12, taxable = Math.max(0, gross - nonTax);
    const pension = floor10(Math.min(Math.max(taxable, Y2026.pensionMin), Y2026.pensionMax) * Y2026.pension);
    const health = floor10(taxable * Y2026.health), care = floor10(health * Y2026.care), employ = floor10(taxable * Y2026.employ);
    const incomeTax = floor10(incomeTaxYear(taxable * 12, family, kids, pension * 12, (health + care + employ) * 12) / 12);
    const localTax = floor10(incomeTax * 0.1);
    const deduct = pension + health + care + employ + incomeTax + localTax;
    return { gross, taxable, pension, health, care, employ, incomeTax, localTax, deduct, net: gross - deduct, netYear: (gross - deduct) * 12 };
  }

  /** 퍼센트 4종 */
  const percent = {
    of: (a, p) => (a * p) / 100,                              // a의 p%
    ratio: (a, b) => (b ? (a / b) * 100 : NaN),               // a는 b의 몇 %
    change: (from, to) => (from ? ((to - from) / from) * 100 : NaN), // from→to 증감률
    apply: (a, p) => a * (1 + p / 100),                       // a를 p% 늘리면(음수면 줄이면)
  };

  /** 부가세 10% (부가가치세법 제30조) */
  function vat(amount, mode) {
    if (mode === 'total') { const supply = Math.round(amount / 1.1); return { supply, tax: amount - supply, total: amount }; }
    const tax = Math.round(amount * 0.1); return { supply: amount, tax, total: amount + tax };
  }

  /** 시급·주휴수당: 주 15시간 이상이면 주휴시간 = min(8, 주 소정근로시간/40×8). 월 환산 = (주 시간+주휴)×365/7/12 (반올림) */
  function wage(hourly, hoursPerDay, daysPerWeek, opt) {
    const weekHours = hoursPerDay * daysPerWeek;
    const holidayHours = weekHours >= 15 ? Math.min(8, (Math.min(weekHours, 40) / 40) * 8) : 0;
    const monthHours = Math.round(((weekHours + holidayHours) * 365) / 7 / 12);
    const base = { weekHours, holidayHours, weekPay: hourly * weekHours, holidayPay: hourly * holidayHours, weekTotal: hourly * (weekHours + holidayHours), monthHours, monthPay: hourly * monthHours, belowMin: hourly < Y2026.minWage };
    return opt ? Object.assign(base, wageNet(hourly, hoursPerDay, daysPerWeek, holidayHours, monthHours, opt)) : base;
  }
  /** 시급 월급의 공제. opt: { tax: 'earned'(근로소득 간이세액) | 'biz'(사업소득 3.3%) | 'daily'(일용근로) | 'none',
   *  pension·health·employ: 가입 여부, family: 부양가족(본인 포함), probation: 수습 90%, absentDays: 한 달 결근 일수 }
   *  결근일은 서로 다른 주로 가정(그 주 주휴수당 없음). 3.3% 는 4대보험 대상이 아니므로 보험료 0. */
  function wageNet(hourly, hoursPerDay, daysPerWeek, holidayHours, monthHours, opt) {
    const rate = opt.probation ? hourly * 0.9 : hourly;
    const absent = Math.max(0, Math.min(opt.absentDays || 0, Math.round(daysPerWeek * 365 / 7 / 12)));
    const lostWork = absent * hoursPerDay * rate, lostHoliday = Math.min(absent, 5) * holidayHours * rate;
    const gross = Math.max(0, Math.round(rate * monthHours - lostWork - lostHoliday));
    const ins = opt.tax !== 'biz' && opt.tax !== 'none';
    const pension = ins && opt.pension ? floor10(Math.min(Math.max(gross, Y2026.pensionMin), Y2026.pensionMax) * Y2026.pension) : 0;
    const health = ins && opt.health ? floor10(gross * Y2026.health) : 0, care = floor10(health * Y2026.care);
    const employ = ins && opt.employ ? floor10(gross * Y2026.employ) : 0;
    let incomeTax = 0, localTax = 0;
    if (opt.tax === 'earned') { incomeTax = floor10(incomeTaxYear(gross * 12, opt.family || 1, 0, pension * 12, (health + care + employ) * 12) / 12); localTax = floor10(incomeTax * 0.1); }
    else if (opt.tax === 'biz') { incomeTax = floor10(gross * Y2026.bizTax); localTax = floor10(incomeTax * 0.1); }
    else if (opt.tax === 'daily') { // 일 단위: (일당 − 15만 원) × 6% × 45%(세액공제 55%), 1,000원 미만 소액부징수
      const daily = rate * hoursPerDay, t = Math.floor(Math.max(0, daily - Y2026.dailyDed) * 0.06 * 0.45);
      const perDay = t < 1000 ? 0 : t, workDays = Math.round(daysPerWeek * 365 / 7 / 12) - absent;
      incomeTax = floor10(perDay * workDays); localTax = floor10(Math.floor(perDay * 0.1) * workDays);
    }
    const deduct = pension + health + care + employ + incomeTax + localTax;
    const boss = { pension, health, care, employ: ins && opt.employ ? floor10(gross * (Y2026.employ + Y2026.employBoss)) : 0 }; // 회사 부담(산재 별도)
    return { rate, absent, lostWork, lostHoliday, gross, pension, health, care, employ, incomeTax, localTax, deduct, net: gross - deduct, boss,
      bossTotal: boss.pension + boss.health + boss.care + boss.employ, rateBelowMin: rate < Y2026.minWage * (opt.probation ? 0.9 : 1) };
  }

  /** 글자 수: 공백 포함/제외, 줄, 단어, UTF-8 바이트, 한글 2바이트 기준(EUC-KR식) */
  function charCount(s) {
    const chars = [...s];
    return { withSpace: chars.length, noSpace: chars.filter((c) => !/\s/.test(c)).length, lines: s ? s.split(/\r\n|\r|\n/).length : 0, words: (s.trim().match(/\S+/g) || []).length,
      utf8: new TextEncoder().encode(s).length, euckr: chars.reduce((n, c) => n + (c.charCodeAt(0) > 127 ? 2 : 1), 0) };
  }

  /** 평단가: rows [{price, qty}] → 평균 단가 */
  function avgPrice(rows) {
    const r = rows.filter((x) => x.qty > 0 && x.price >= 0);
    const qty = r.reduce((a, x) => a + x.qty, 0), cost = r.reduce((a, x) => a + x.price * x.qty, 0);
    return { qty, cost, avg: qty ? cost / qty : 0 };
  }

  /** 실업급여(구직급여): 1일 = 평균임금일액×60% (상한 68,100, 하한 = 최저임금×80%×1일 소정근로시간). 소정급여일수 = 고용보험법 별표1 */
  function unemployment(dailyAvgWage, hoursPerDay, insuredYears, over50OrDisabled) {
    const lower = Y2026.minWage * Y2026.ubMinRatio * Math.min(8, hoursPerDay);
    const raw = dailyAvgWage * Y2026.ubRate;
    const daily = Math.floor(Math.min(Y2026.ubMax, Math.max(lower, raw)));
    const T = over50OrDisabled ? [120, 180, 210, 240, 270] : [120, 150, 180, 210, 240];
    const i = insuredYears < 1 ? 0 : insuredYears < 3 ? 1 : insuredYears < 5 ? 2 : insuredYears < 10 ? 3 : 4;
    const days = T[i];
    return { daily, days, total: daily * days, lower, capped: raw > Y2026.ubMax, floored: raw < lower, monthly: daily * 30 };
  }

  /** 대출 갈아타기: 남은 기간 원리금균등 기준 총이자 비교 − 중도상환수수료 − 새 대출 비용 */
  function refinance(balance, curRate, newRate, months, feeRate, feeRemain, feePeriod, newCost) {
    const a = loan(balance, curRate, months, 'equal-payment'), b = loan(balance, newRate, months, 'equal-payment');
    const fee = prepayFee(balance, feeRate, Math.max(0, feePeriod - feeRemain), feePeriod).fee;
    const save = a.totalInterest - b.totalInterest, net = save - fee - newCost, monthlyDiff = a.first - b.first;
    return { save, fee, net, curMonthly: a.first, newMonthly: b.first, monthlyDiff, payback: monthlyDiff > 0 ? Math.ceil((fee + newCost) / monthlyDiff) : Infinity };
  }

  /** 자동차 취득세 (지방세법 제12조): 비영업 승용 7%, 승합·화물 5%, 경차 4%(감면 75만 원 한도, 지방세특례제한법 2026년까지),
   *  전기차 7%에서 140만 원 한도 감면(2026.12.31까지). 과세표준 = 취득가액(부가세 제외 공급가액). 공채 매입은 미반영 */
  function carAcqTax(price, kind) {
    const rate = kind === 'light' ? 0.04 : kind === 'van' ? 0.05 : 0.07;
    const tax = floor10(price * rate), cut = kind === 'light' ? Math.min(tax, 750000) : kind === 'ev' ? Math.min(tax, 1400000) : 0;
    return { rate, tax, cut, pay: tax - cut };
  }

  /** 청약 가점 (주택공급에 관한 규칙 별표1): 무주택 최대 32, 부양가족 최대 35, 통장 최대 17 = 84점
   *  noHomeYears < 0 이면 유주택(0점). 배우자 통장 기간은 50%(최대 3점) 합산, 통장 점수 상한 17 */
  function subscription(noHomeYears, dependents, accountYears, spouseYears) {
    const home = noHomeYears < 0 ? 0 : Math.min(32, 2 + 2 * Math.floor(Math.max(0, noHomeYears)));
    const dep = Math.min(35, 5 + 5 * Math.max(0, Math.floor(dependents)));
    const acc = (y) => (y <= 0 ? 0 : y < 0.5 ? 1 : y < 1 ? 2 : Math.min(17, 2 + Math.floor(y)));
    const spouse = Math.min(3, Math.floor(acc(spouseYears || 0) / 2));
    const account = Math.min(17, acc(accountYears) + spouse);
    return { home, dep, account, spouse, total: home + dep + account };
  }

  /** 목표 금액 모으기: 목표액·기간·연 수익률(월복리)·초기 금액 → 필요한 월 적립액 */
  function goal(target, years, annualRate, initial) {
    const n = Math.round(years * 12), r = annualRate / 12;
    const fvInit = initial * Math.pow(1 + r, n);
    const need = Math.max(0, target - fvInit);
    const monthly = r === 0 ? need / n : (need * r) / (Math.pow(1 + r, n) - 1);
    return { monthly, n, paid: initial + monthly * n, interest: target - (initial + monthly * n), fvInit };
  }

  /** BMI (대한비만학회 2022 기준): <18.5 저체중, ~22.9 정상, ~24.9 비만 전 단계, ~29.9 1단계 비만, ~34.9 2단계, 35+ 3단계 */
  function bmi(heightCm, weightKg) {
    const m = heightCm / 100, v = weightKg / (m * m);
    const level = v < 18.5 ? '저체중' : v < 23 ? '정상' : v < 25 ? '비만 전 단계' : v < 30 ? '1단계 비만' : v < 35 ? '2단계 비만' : '3단계 비만';
    return { bmi: v, level, normalMin: 18.5 * m * m, normalMax: 22.9 * m * m };
  }

  /** 승률. draw: 'exclude'(무승부 빼고 승÷(승+패), KBO 방식) | 'half'(무승부 0.5승) | 'loss'(무승부도 경기 수에 포함, 승÷전체)
   *  target(0~1) 까지 필요한 연승 수 / 목표 이상을 지키며 버틸 수 있는 연패 수 */
  function winRate(w, l, d, draw, target) {
    const W = w + (draw === 'half' ? d / 2 : 0), G = w + l + (draw === 'exclude' ? 0 : d);
    const rate = G > 0 ? W / G : 0, T = target;
    let needWins = 0, canLose = 0;
    if (T > 0 && rate < T) needWins = T >= 1 ? (W === G ? 0 : Infinity) : Math.max(0, Math.ceil((T * G - W) / (1 - T) - 1e-9));
    if (T > 0 && G > 0 && rate >= T) canLose = Math.max(0, Math.floor(W / T - G + 1e-9));
    return { rate, games: w + l + d, W, G, needWins, canLose };
  }

  // ───────────── 추가 4종 (2026-10-22) ─────────────
  /** 날짜 문자열(YYYY-MM-DD) → UTC 자정. k개월 뒤 같은 날(기간이 끝난 다음 날 = 연차 발생일).
   *  그달에 같은 날이 없으면 기간은 말일에 끝나므로 다음 달 1일 (민법 제160조 제3항) */
  const ymd = (v) => { const [y, m, d] = String(v).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  function addMonthsYmd(t, k) {
    const d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth() + k, day = d.getUTCDate();
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return day > last ? Date.UTC(y, m + 1, 1) : Date.UTC(y, m, day);
  }
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  /** 연차 일수 (근로기준법 제60조): n년 근속 시 15 + ⌊(n−1)/2⌋, 최대 25일 */
  const leaveGrant = (n) => (n < 1 ? 0 : Math.min(25, 15 + Math.floor((n - 1) / 2)));
  /** 연차 (입사일 기준, 매월 개근·연 80% 이상 출근 가정). lastDay: 마지막 근무일(재직 중이면 오늘).
   *  발생일에 근로관계가 있어야 연차가 생긴다(대법원 2021다227100 — 1년 계약 만료 퇴사 시 15일 미발생). */
  function annualLeave(start, lastDay, used, dailyWage) {
    const s0 = ymd(start), e = ymd(lastDay);
    if (!(e >= s0)) return null;
    let monthly = 0; for (let k = 1; k <= 11; k++) if (addMonthsYmd(s0, k) <= e) monthly = k;
    let n = 0; while (addMonthsYmd(s0, 12 * (n + 1)) <= e) n++;
    const cur = n === 0 ? monthly : n === 1 ? monthly + leaveGrant(1) : leaveGrant(n); // 1년 차엔 아직 정산 안 된 월 단위 연차 포함
    let total = monthly; for (let i = 1; i <= n; i++) total += leaveGrant(i);
    const next = n === 0 && monthly < 11 ? { date: iso(addMonthsYmd(s0, monthly + 1)), days: 1 } : { date: iso(addMonthsYmd(s0, 12 * (n + 1))), days: leaveGrant(n + 1) };
    const unused = Math.max(0, cur - (used || 0));
    return { years: n, monthly, cur, total, next, unused, pay: unused * (dailyWage || 0), serviceDays: Math.round((e - s0) / 864e5) + 1 };
  }

  /** 중개보수 상한 (공인중개사법 시행규칙 제20조, 2021.10.19 개정 · 한국공인중개사협회 요율표).
   *  kind: house|officetel|other, deal: sale|lease. 월세 거래금액 = 보증금 + 월세 × 100 (5천만 원 미만이면 × 70) */
  const BROKER = {
    sale: [[5e7, 0.006, 250000], [2e8, 0.005, 800000], [9e8, 0.004], [12e8, 0.005], [15e8, 0.006], [Infinity, 0.007]],
    lease: [[5e7, 0.005, 200000], [1e8, 0.004, 300000], [6e8, 0.003], [12e8, 0.004], [15e8, 0.005], [Infinity, 0.006]],
  };
  function brokerage(kind, deal, price, deposit, monthlyRent, vatOn) {
    let amount = deal === 'sale' ? price : deposit + monthlyRent * 100;
    if (deal === 'lease' && monthlyRent > 0 && amount < 5e7) amount = deposit + monthlyRent * 70;
    let rate, cap = null;
    if (kind === 'officetel') rate = deal === 'sale' ? 0.005 : 0.004;
    else if (kind === 'other') rate = 0.009;
    else { const row = BROKER[deal].find(([up]) => amount < up); rate = row[1]; cap = row[2] || null; }
    const raw = Math.floor(amount * rate), fee = cap ? Math.min(raw, cap) : raw;
    const vat = vatOn ? Math.round(fee * 0.1) : 0;
    return { amount, rate, cap, raw, capped: cap !== null && raw > cap, fee, vat, total: fee + vat };
  }

  /** 종합소득세 기본세율 산출세액 (소득세법 제55조) */
  function basicTax(base) {
    const B = [[14e6, 0.06, 0], [50e6, 0.15, 84e4], [88e6, 0.24, 624e4], [150e6, 0.35, 1536e4], [300e6, 0.38, 3706e4], [500e6, 0.40, 9406e4], [1e9, 0.42, 17406e4], [Infinity, 0.45, 38406e4]];
    let prev = 0; for (const [up, r, acc] of B) { if (base <= up) return acc + (base - prev) * r; prev = up; } return 0;
  }
  /** 3.3% 프리랜서 종합소득세 환급(추정) — 단순경비율 추계. 수입 4천만 원 초과분 경비율 = 1 − (1 − 단순경비율) × 1.4
   *  표준세액공제 7만 원(근로소득 없는 종합소득자), 인적공제 1인 150만 원. 기납부 = 수입 × 3% (+ 지방 0.3%) */
  function freelanceTax(income, expRate, family, pensionPaid) {
    const r = expRate, over = Math.max(0, income - 4e7);
    const expense = Math.min(income, 4e7) * r + over * Math.max(0, 1 - (1 - r) * 1.4);
    const earn = Math.max(0, income - expense);
    const base = Math.max(0, earn - 1.5e6 * Math.max(1, family) - (pensionPaid || 0));
    const calc = basicTax(base), tax = Math.max(0, Math.floor(calc) - 70000), local = Math.floor(tax * 0.1);
    const prepaid = Math.floor(income * 0.03), prepaidLocal = Math.floor(income * 0.003);
    const refund = prepaid + prepaidLocal - tax - local;
    return { expense, earn, base, calc, tax, local, prepaid, prepaidLocal, refund };
  }

  /** 주택용 전기요금(저압) — 한국전력 기본공급약관. 하계(7·8월) 300/450kWh, 그 외 200/400kWh 누진 구간.
   *  전기요금계 = 기본 + 전력량 + 기후환경 + 연료비조정. 부가세 10%(반올림), 전력기금 2.7%(10원 미만 절사), 청구액 10원 미만 절사 */
  const ELEC = { basic: [910, 1600, 7300], rate: [120.0, 214.6, 307.3], fund: 0.027 };
  function electricity(kwh, summer, climate, fuel) {
    const [t1, t2] = summer ? [300, 450] : [200, 400];
    const step = kwh <= t1 ? 0 : kwh <= t2 ? 1 : 2;
    const parts = [Math.min(kwh, t1), Math.max(0, Math.min(kwh, t2) - t1), Math.max(0, kwh - t2)];
    const energy = Math.floor(parts.reduce((a, q, i) => a + q * ELEC.rate[i], 0) + 1e-9);
    const basic = ELEC.basic[step], clim = Math.floor(kwh * climate + 1e-9), fuelFee = Math.floor(kwh * fuel + 1e-9);
    const sum = basic + energy + clim + fuelFee, vat = Math.round(sum * 0.1), fund = Math.floor(sum * ELEC.fund / 10) * 10;
    return { step: step + 1, parts, basic, energy, clim, fuelFee, sum, vat, fund, total: Math.floor((sum + vat + fund) / 10) * 10, t1, t2 };
  }

  const api = { winRate, loan, deposit, savings, prepayFee, severance, rentConvert, dsr, installment, military, MILITARY, dday, addDays, age, toPyeong, toM2, compound, evaluate, carLoan, carTax,
    Y2026, salary, incomeTaxYear, percent, vat, wage, charCount, avgPrice, unemployment, refinance, carAcqTax, subscription, goal, bmi,
    annualLeave, leaveGrant, addMonthsYmd, brokerage, BROKER, basicTax, freelanceTax, electricity, ELEC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
