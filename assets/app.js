/* 에이팜 종합계산기 — 사이트 공통 편의 기능 + 계산기별 화면
 * 편의 기능: 검색(초성·단축키 / Ctrl+K), 즐겨찾기, 최근 사용, 입력값 자동 저장·복원, 링크 공유(입력값 포함), 결과 복사,
 * 초기화, 인쇄·PDF, 다크 모드, 글자 크게, 금액 한글 읽기, 빠른 금액 버튼, 입력 범위 안내, 표 CSV 저장, 맨 위로,
 * 모바일 결과 요약 바, 화면낭독 결과 안내, 저장 기록 지우기, 일반·공학용 계산기(키보드·기록) */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s), qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const won = (v) => Math.round(v).toLocaleString('ko-KR') + '원';
  const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('ko-KR') + '원';
  const num = (id) => { const e = $(id); return e ? Number(String(e.value).replace(/[^\d.\-]/g, '')) || 0 : 0; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ac-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ac-' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } },
    del(k) { try { localStorage.removeItem('ac-' + k); } catch (e) {} },
  };
  const page = document.body.dataset.page;
  const INDEX = window.AC_INDEX || [];
  const toast = (msg) => { const t = $('toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1800); };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // ── 1. 다크 모드·글자 크기 ──
  qsa('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; store.set('theme', next); try { localStorage.setItem('ac-theme', next); } catch (e) {}
    rerender();
  }));
  qsa('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    const lg = document.documentElement.dataset.zoom !== 'lg';
    if (lg) document.documentElement.dataset.zoom = 'lg'; else delete document.documentElement.dataset.zoom;
    try { if (lg) localStorage.setItem('ac-zoom', 'lg'); else localStorage.removeItem('ac-zoom'); } catch (e) {}
    toast(lg ? '글자를 크게 했어요' : '기본 글자 크기');
  }));

  // ── 2. 검색 (초성 지원) ──
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const cho = (s) => [...s].map((c) => { const k = c.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? CHO[Math.floor(k / 588)] : c; }).join('');
  const dlg = $('search'), q = $('q'), qr = $('qr');
  let sel = 0, hits = [];
  const renderHits = () => {
    const t = q.value.trim().replace(/\s+/g, '').toLowerCase();
    hits = !t ? INDEX.slice() : INDEX.filter((x) => { const hay = (x.n + x.l).replace(/\s+/g, '').toLowerCase(); return hay.includes(t) || cho(hay).includes(t); });
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    qr.innerHTML = hits.length ? hits.map((x, i) => `<li role="option" aria-selected="${i === sel}" data-tone="${x.t}"><a href="/${x.s}/"><span class="tic"><svg class="ic" viewBox="0 0 24 24">${(qs(`.tile[href="/${x.s}/"] svg`) || {}).innerHTML || ''}</svg></span><span class="tt"><b>${x.n}</b><small>${x.l}</small></span></a></li>`).join('') : '<li class="empty">맞는 계산기가 없어요. 다른 말로 찾아보세요.</li>';
  };
  const openSearch = () => { if (!dlg) return; if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); q.value = ''; sel = 0; renderHits(); q.focus(); };
  qsa('[data-open-search]').forEach((b) => b.addEventListener('click', openSearch));
  qsa('[data-close-search]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  if (q) {
    q.addEventListener('input', () => { sel = 0; renderHits(); });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(hits.length - 1, sel + 1); renderHits(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); renderHits(); e.preventDefault(); }
      else if (e.key === 'Enter' && hits[sel]) location.href = `/${hits[sel].s}/`;
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openSearch(); }
  });

  // ── 3. 즐겨찾기·최근 사용 ──
  const favs = () => store.get('favs', []);
  const favBtn = qs('[data-fav]');
  if (favBtn) {
    const s = favBtn.dataset.fav, upd = () => favBtn.setAttribute('aria-pressed', favs().includes(s));
    upd();
    favBtn.addEventListener('click', () => { const f = favs(); const on = !f.includes(s); store.set('favs', on ? [s, ...f] : f.filter((x) => x !== s)); upd(); toast(on ? '즐겨찾기에 추가했어요' : '즐겨찾기에서 뺐어요'); });
    const rec = store.get('recent', []).filter((x) => x !== s); store.set('recent', [s, ...rec].slice(0, 6));
  }
  if (page === 'home') {
    const tileOf = (s) => { const t = qs(`.cat .tile[href="/${s}/"]`); return t ? t.outerHTML : ''; };
    const f = favs().filter(tileOf), r = store.get('recent', []).filter(tileOf);
    if (f.length) { $('favs').innerHTML = f.map(tileOf).join(''); $('favs-wrap').hidden = false; }
    if (r.length) { $('recent').innerHTML = r.map(tileOf).join(''); $('recent-wrap').hidden = false; }
    if (f.length || r.length) $('mine').hidden = false;
  }

  // ── 4. 맨 위로·저장 기록 지우기 ──
  const top = qs('[data-totop]');
  if (top) { addEventListener('scroll', () => top.classList.toggle('on', scrollY > 600), { passive: true }); top.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' })); }
  qsa('[data-clear-storage]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('이 기기에 저장된 즐겨찾기·최근 사용·입력값·계산 기록을 모두 지울까요?')) return;
    try { Object.keys(localStorage).filter((k) => k.startsWith('ac-')).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    toast('저장 기록을 지웠어요'); setTimeout(() => location.reload(), 600);
  }));

  // ── 5. 금액 입력: 쉼표·한글 읽기·빠른 버튼 ──
  const korean = (n) => {
    n = Math.floor(Math.abs(n)); if (!n) return '';
    const units = [['조', 1e12], ['억', 1e8], ['만', 1e4], ['', 1]]; const out = [];
    for (const [u, v] of units) { const q2 = Math.floor(n / v); if (q2) { out.push(q2.toLocaleString('ko-KR') + u); n -= q2 * v; } }
    return out.join(' ') + '원';
  };
  qsa('input[data-money]').forEach((inp) => {
    const lab = inp.closest('.f'); const hint = document.createElement('small'); hint.className = 'won'; lab.appendChild(hint);
    const quick = document.createElement('div'); quick.className = 'quick';
    quick.innerHTML = [['+100만', 1e6], ['+1,000만', 1e7], ['+1억', 1e8], ['0', 0]].map(([t, v]) => `<button type="button" data-add="${v}" aria-label="${t === '0' ? '금액 지우기' : t + ' 원 더하기'}">${t}</button>`).join('');
    lab.appendChild(quick);
    const fmt = () => { const d = inp.value.replace(/[^\d]/g, ''); inp.value = d ? Number(d).toLocaleString('ko-KR') : ''; hint.textContent = korean(Number(d)); };
    inp.addEventListener('input', fmt); fmt();
    quick.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const add = Number(b.dataset.add); const cur = Number(inp.value.replace(/[^\d]/g, '')) || 0; inp.value = String(add ? cur + add : 0); fmt(); inp.dispatchEvent(new Event('input', { bubbles: true })); });
  });

  // ── 6. 입력 범위 안내 ──
  qsa('.calc input[type=number]').forEach((inp) => inp.addEventListener('input', () => {
    const f = inp.closest('.f'); let m = qs('.msg', f); const v = Number(inp.value), mn = inp.min !== '' ? Number(inp.min) : -Infinity, mx = inp.max !== '' ? Number(inp.max) : Infinity;
    const bad = inp.value !== '' && (v < mn || v > mx);
    f.classList.toggle('invalid', bad);
    if (bad) { if (!m) { m = document.createElement('span'); m.className = 'msg'; f.appendChild(m); } m.textContent = `${mn > -Infinity ? mn : ''}~${mx < Infinity ? mx : ''} 사이로 입력하세요`; } else if (m) m.remove();
  }));

  // ── 7. 표 헬퍼 (CSV 저장 포함) ──
  const table = (title, head, rows, opt = {}) => {
    const id = 't' + Math.random().toString(36).slice(2, 7);
    TABLES[id] = { title, head, rows: opt.raw || rows };
    return `<div class="tbl-h"><h3>${title}</h3><button type="button" class="ab" data-csv="${id}"><svg class="ic" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>CSV 저장</button></div><div class="tbl"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr class="${r.cls || ''}">${(r.cells || r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const TABLES = {};
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-csv]'); if (!b) return;
    const t = TABLES[b.dataset.csv]; if (!t) return;
    const cell = (c) => `"${String(c).replace(/<[^>]+>/g, '').replace(/"/g, '""')}"`;
    const csv = '﻿' + [t.head, ...t.rows.map((r) => r.cells || r)].map((r) => r.map(cell).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `${document.title.split(' —')[0].split(' |')[0]}-${t.title}.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast('CSV 파일을 저장했어요');
  });
  const kpi = (items) => `<div class="kpis">${items.map(([k, v, c]) => `<div class="kpi ${c || ''}"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  const S = { p: '--s-principal', i: '--s-interest', g: '--s-support' };

  // ── 8. 계산기별 화면 ──
  const METHODS = [['equal-payment', '원리금균등'], ['equal-principal', '원금균등'], ['bullet', '만기일시']];
  const yearly = (rows) => { const ys = []; rows.forEach((r) => { const y = Math.ceil(r.n / 12) - 1; ys[y] = ys[y] || { p: 0, i: 0 }; ys[y].p += r.principal; ys[y].i += r.interest; }); return ys; };
  const run = {
    loan() {
      const P = num('principal'), rate = num('rate') / 100, n = Math.round(num('years') * 12), d = num('delta') / 100; if (!P || !n) return;
      const res = METHODS.map(([m, l]) => [m, l, Calc.loan(P, rate, n, m)]);
      const m = $('schedMethod').value, cur = res.find((x) => x[0] === m)[2], base = res[0][2];
      $('out').innerHTML = kpi([[`${METHODS.find((x) => x[0] === m)[1]} 첫 달 상환액`, won(cur.first), 'main'], ['총 이자', won(cur.totalInterest)], ['총 상환액', won(cur.totalPayment)]]) +
        table('상환 방식 비교', ['방식', '첫 달', '마지막 달', '총 이자'], res.map(([mm, l, r]) => ({ cls: mm === m ? 'now' : '', cells: [l, won(r.first), won(r.last), won(r.totalInterest)] })));
      const ys = yearly(cur.rows);
      Charts.bars($('chart'), { title: '연도별로 갚는 원금과 이자', cats: ys.map((_, i) => i + 1 + '년'), series: [{ label: '원금', color: S.p, values: ys.map((y) => y.p) }, { label: '이자', color: S.i, values: ys.map((y) => y.i) }] });
      const sc = [-2, -1, 0, 1, 2].map((k) => { const rr = Math.max(0, rate + k * d), x = Calc.loan(P, rr, n, 'equal-payment'); return { cls: k ? '' : 'now', cells: [k ? (k > 0 ? '+' : '−') + (Math.abs(k) * d * 100).toFixed(2) + '%p' : '현재', (rr * 100).toFixed(2) + '%', won(x.first), k ? signed(x.first - base.first) : '-', k ? signed(x.totalInterest - base.totalInterest) : '-'] }; });
      $('tables').innerHTML = table('금리가 바뀌면? (원리금균등)', ['변동', '금리', '월 상환액', '월 차이', '총이자 차이'], sc) +
        table('월별 상환표', ['회차', '이자', '원금', '상환액', '남은 잔액'], cur.rows.map((r) => [r.n, won(r.interest), won(r.principal), won(r.payment), won(Math.max(0, r.end))]));
    },
    dsr() {
      const loans = [1, 2, 3].map((i) => ({ principal: num('p' + i), rate: num('r' + i) / 100, months: Math.round(num('y' + i) * 12), method: 'equal-payment' }));
      const x = Calc.dsr(num('income'), loans);
      const each = loans.map((l) => (l.principal && l.months ? Calc.dsr(1, [l]).yearly : 0));
      $('out').innerHTML = kpi([['DSR', (x.ratio * 100).toFixed(2) + '%', 'main'], ['연간 원리금 합계', won(x.yearly)], ['월평균 상환액', won(x.yearly / 12)]]);
      const host = $('chart'); host.innerHTML = '<div id="g1"></div><div id="g2"></div>';
      Charts.gauge($('g1'), { title: '연소득 대비 원리금 비율', value: x.ratio, label: (x.ratio * 100).toFixed(1) + '%' });
      const used = each.map((v, i) => [i, v]).filter(([, v]) => v > 0);
      if (used.length > 1) Charts.bars($('g2'), { title: '대출별 연간 원리금', horizontal: true, cats: used.map(([i]) => `대출 ${i + 1}`), series: [{ label: '연간 원리금', color: S.p, values: used.map(([, v]) => v) }] });
      $('tables').innerHTML = '';
    },
    prepay() {
      const x = Calc.prepayFee(num('repay'), num('feeRate') / 100, Math.round(num('elapsed')), Math.round(num('feePeriod')));
      $('out').innerHTML = kpi([['예상 중도상환수수료', won(x.fee), 'main'], ['남은 부과 기간', x.remain + '개월'], ['적용 비율', (x.ratio * 100).toFixed(1) + '%']]) + (x.fee === 0 ? '<p class="note">부과 기간이 지나 수수료가 없습니다.</p>' : '');
      $('chart').innerHTML = ''; $('tables').innerHTML = '';
    },
    installment() {
      const x = Calc.installment(num('amount'), num('feeRate') / 100, Math.round(num('months'))); if (!x.rows.length) return;
      $('out').innerHTML = kpi([['첫 달 납입금', won(x.first), 'main'], ['총 할부 수수료', won(x.totalFee)], ['총 납입금', won(x.total)]]);
      Charts.bars($('chart'), { title: '회차별 납입금', cats: x.rows.map((r) => r.n + '회'), series: [{ label: '원금', color: S.p, values: x.rows.map((r) => r.principal) }, { label: '수수료', color: S.i, values: x.rows.map((r) => r.interest) }] });
      $('tables').innerHTML = table('회차별 납입표', ['회차', '원금', '수수료', '납입금'], x.rows.map((r) => [r.n, won(r.principal), won(r.interest), won(r.payment)]));
    },
    savings() {
      const kind = $('kind').value, A = num('amount'), rate = num('rate') / 100, n = Math.round(num('months')), c = $('compound').value, t = Number($('tax').value); if (!A || !n) return;
      const r = kind === 'deposit' ? Calc.deposit(A, rate, n, c, t) : Calc.savings(A, rate, n, c, t), paid = kind === 'deposit' ? A : r.paid;
      $('out').innerHTML = kpi([['세후 받는 금액', won(r.total), 'main'], ['세후 이자', won(r.net)], ['세전 이자', won(r.gross)], ['이자 세금', won(r.tax)], ['넣은 원금', won(paid)], ['원금 대비 세후 이자', (r.net / paid * 100).toFixed(2) + '%']]);
      Charts.bars($('chart'), { title: '받는 금액 구성', horizontal: true, cats: ['만기 수령'], series: [{ label: '원금', color: S.p, values: [paid] }, { label: '세후 이자', color: S.i, values: [r.net] }] });
      $('tables').innerHTML = '';
    },
    compound() {
      const x = Calc.compound(num('initial'), num('monthly'), num('rate') / 100, num('years'), $('freq').value, Number($('tax').value)); if (!x.series.length) return;
      $('out').innerHTML = kpi([[`${num('years')}년 뒤 금액`, won(x.total), 'main'], ['넣은 원금', won(x.paid)], [Number($('tax').value) ? '세후 이자' : '불어난 이자', won(x.net)], ['원금 대비', '×' + (x.total / Math.max(1, x.paid)).toFixed(2)], ['72의 법칙(2배까지)', isFinite(x.rule72) ? x.rule72.toFixed(1) + '년' : '-']]);
      Charts.area($('chart'), { title: '연도별 원금과 이자', x: x.series.map((s) => s.year), xLabel: (i) => x.series[i].year + '년', series: [{ label: '원금', color: S.p, values: x.series.map((s) => s.principal) }, { label: '이자', color: S.i, values: x.series.map((s) => Math.max(0, s.interest)) }] });
      $('tables').innerHTML = table('연도별 잔액', ['연차', '넣은 원금', '이자(세전)', '잔액(세전)'], x.series.slice(1).map((s) => [s.year + '년', won(s.principal), won(s.interest), won(s.balance)]));
    },
    military() {
      const months = Math.min(Math.round(num('months')), Number($('branch').value)), x = Calc.military(num('monthly'), num('rate') / 100, months);
      $('out').innerHTML = kpi([['전역 시 받는 금액', won(x.total), 'main'], ['정부 매칭지원금', won(x.match)], ['은행이자(비과세)', won(x.interest)], ['넣은 원금', won(x.paid)]]) +
        (x.capped ? '<p class="note">월 한도 55만 원으로 계산했습니다.</p>' : '') + (months < Math.round(num('months')) ? `<p class="note">복무 구분 최대 ${months}개월로 계산했습니다.</p>` : '');
      Charts.bars($('chart'), { title: '전역 때 받는 금액 구성', horizontal: true, cats: ['만기 수령'], series: [{ label: '은행이자', color: S.i, values: [x.interest] }, { label: '원금', color: S.p, values: [x.paid] }, { label: '매칭지원금', color: S.g, values: [x.match] }] });
      $('tables').innerHTML = '';
    },
    carloan() {
      const price = num('price'), down = Math.min(num('down'), price), rate = num('rate') / 100, n = Math.round(num('months')), x = Calc.carLoan(price, down, rate, n);
      $('out').innerHTML = kpi([['월 납입금', won(x.monthly), 'main'], ['할부 원금', won(x.principal)], ['총 이자', won(x.totalInterest)], ['선납금 비율', price ? (down / price * 100).toFixed(1) + '%' : '-'], ['총 지출(선납 포함)', won(x.total)]]);
      const ratios = [0, 10, 20, 30, 40, 50], alts = ratios.map((p) => Calc.carLoan(price, price * p / 100, rate, n));
      Charts.bars($('chart'), { title: '선납금 비율별 월 납입금', cats: ratios.map((p) => `선납 ${p}%`), series: [{ label: '월 납입금', color: S.p, values: alts.map((a) => a.monthly) }] });
      $('tables').innerHTML = table('선납금 비율별 비교', ['선납 비율', '선납금', '월 납입금', '총 이자'], alts.map((a, i) => [ratios[i] + '%', won(price * ratios[i] / 100), won(a.monthly), won(a.totalInterest)])) +
        (x.rows.length ? table('월별 납입표', ['회차', '이자', '원금', '납입금', '남은 원금'], x.rows.map((r) => [r.n, won(r.interest), won(r.principal), won(r.payment), won(Math.max(0, r.end))])) : '');
    },
    cartax() {
      const fuel = $('fuel').value, cc = num('cc'), age = Math.round(num('age')); $('cc').disabled = fuel === 'ev';
      const x = Calc.carTax(cc, age, fuel);
      $('out').innerHTML = kpi([['연 자동차세 (교육세 포함)', won(x.total), 'main'], ['자동차세', won(x.tax)], ['지방교육세 30%', won(x.edu)], ['6월·12월 각', won(x.half)], ['차령 경감', (x.cut * 100).toFixed(0) + '%'], ['cc당 세액', fuel === 'ev' ? '정액 10만 원' : x.perCc + '원']]);
      const years = Array.from({ length: 12 }, (_, i) => i + 1), all = years.map((y) => Calc.carTax(cc, y, fuel));
      Charts.bars($('chart'), { title: '차령별 연 자동차세 (교육세 포함)', cats: years.map((y) => y + '년차'), series: [{ label: '연 세액', color: S.p, values: all.map((a) => a.total) }] });
      $('tables').innerHTML = table('차령별 세액', ['차령', '경감', '자동차세', '교육세', '합계'], all.map((a, i) => ({ cls: i + 1 === Math.min(age, 12) ? 'now' : '', cells: [years[i] + '년차' + (i === 11 ? ' 이상' : ''), (a.cut * 100).toFixed(0) + '%', won(a.tax), won(a.edu), won(a.total)] })));
    },
    severance() {
      const x = Calc.severance(num('wage3m'), num('days3m'), Math.round(num('serviceDays')), num('bonus'), num('leavePay'));
      $('out').innerHTML = kpi([['예상 퇴직금(세전)', won(x.amount), 'main'], ['1일 평균임금', won(x.daily)], ['근속 연수', (num('serviceDays') / 365).toFixed(2) + '년']]) + (x.eligible ? '' : '<p class="note">재직 1년 미만이라 법정 퇴직금 지급 대상이 아닙니다.</p>');
      $('chart').innerHTML = ''; $('tables').innerHTML = '';
    },
    rent() {
      const x = Calc.rentConvert(num('convert'), num('baseRate') / 100);
      $('out').innerHTML = kpi([['월세 상한', won(x.monthly), 'main'], ['적용 전환율', (x.legalRate * 100).toFixed(2) + '%'], ['연간 월세 합계', won(x.yearly)]]) + (x.legalRate >= 0.1 ? '<p class="note">상한 10%가 적용됐습니다.</p>' : '');
      $('chart').innerHTML = ''; $('tables').innerHTML = '';
    },
    area(e) {
      if (e && e.target && e.target.id === 'py') $('m2').value = +Calc.toM2(num('py')).toFixed(2); else $('py').value = +Calc.toPyeong(num('m2')).toFixed(2);
      $('out').innerHTML = kpi([['평', num('py').toLocaleString('ko-KR') + '평', 'main'], ['제곱미터', num('m2').toLocaleString('ko-KR') + '㎡']]);
      $('chart').innerHTML = '';
      $('tables').innerHTML = table('자주 찾는 전용면적', ['전용면적', '평 환산'], [33, 49, 59, 74, 84, 101, 114, 135].map((m) => [m + '㎡', Calc.toPyeong(m).toFixed(1) + '평']));
    },
    dday() {
      if (!$('from').value) $('from').value = today();
      if (!$('to').value) { const d = new Date(); d.setDate(d.getDate() + 100); $('to').value = d.toISOString().slice(0, 10); }
      const from = $('from').value, to = $('to').value, add = Math.round(num('add')), d = Calc.dday(from, to);
      $('out').innerHTML = kpi([[`${from} → ${to}`, d.diff >= 0 ? `D-${d.diff}` : `D+${-d.diff}`, 'main'], ['기념일 기준', d.diff >= 0 ? d.nth + '일째' : '지난 날짜'], ['날짜 사이', Math.abs(d.diff).toLocaleString('ko-KR') + '일'], [`${add}일 뒤`, Calc.addDays(from, add)], [`${add}일째(시작일 포함)`, Calc.addDays(from, add - 1)]]);
      $('chart').innerHTML = '';
      $('tables').innerHTML = table('기념일 미리 보기', ['기념일', '날짜'], [100, 200, 300, 365, 500, 1000].map((k) => [k + '일째', Calc.addDays(from, k - 1)]));
    },
    age() {
      const b = $('birth').value; if (!b) return; const t = $('today').value || today(), x = Calc.age(b, t);
      const [ty] = t.split('-').map(Number), [, bm, bd] = b.split('-').map(Number);
      let next = `${ty}-${String(bm).padStart(2, '0')}-${String(bd).padStart(2, '0')}`; if (Calc.dday(t, next).diff < 0) next = `${ty + 1}-${next.slice(5)}`;
      $('out').innerHTML = kpi([['만 나이', x.man + '세', 'main'], ['연 나이', x.year + '세'], ['세는 나이', x.counting + '세'], ['다음 생일까지', 'D-' + Calc.dday(t, next).diff]]);
      $('chart').innerHTML = ''; $('tables').innerHTML = '';
    },
  };

  // ── 9. 입력값 저장·복원·공유·초기화 ──
  const calcEl = qs('[data-calc]'), kind = calcEl && calcEl.dataset.calc;
  const fields = calcEl ? qsa('input,select', calcEl).filter((e) => e.id && !['expr'].includes(e.id)) : [];
  const defaults = Object.fromEntries(fields.map((e) => [e.id, e.value]));
  const snapshot = () => Object.fromEntries(fields.map((e) => [e.id, e.value]));
  const apply = (vals) => fields.forEach((e) => { if (vals[e.id] !== undefined) e.value = vals[e.id]; if (e.dataset.money !== undefined) e.dispatchEvent(new Event('input')); });
  const params = new URLSearchParams(location.search);
  if (kind && run[kind]) {
    if ([...params.keys()].some((k) => defaults[k] !== undefined)) apply(Object.fromEntries(params)); else apply(store.get('in-' + kind, {}));
  }
  let saveT = null, annT = null;
  const announce = () => { const k = qs('.kpi.main'), s = $('sr-status'); if (k && s) s.textContent = qs('span', k).textContent + ' ' + qs('b', k).textContent; const mini = qs('[data-mini]'); if (k && mini) { qs('span', mini).textContent = qs('span', k).textContent; qs('b', mini).textContent = qs('b', k).textContent; } };
  function rerender(e) {
    if (!kind || !run[kind]) return;
    try { run[kind](e); } catch (err) { console.error(err); }
    clearTimeout(saveT); saveT = setTimeout(() => store.set('in-' + kind, snapshot()), 400);
    clearTimeout(annT); annT = setTimeout(announce, 600);
  }
  if (kind && run[kind]) {
    fields.forEach((e) => e.addEventListener('input', rerender));
    rerender(); announce();
    let rz = null, lastW = innerWidth; addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rz); rz = setTimeout(rerender, 200); }); // 차트 다시 맞춤
    // 모바일: 결과가 화면 밖일 때만 요약 바
    const mini = qs('[data-mini]'), outEl = $('out');
    if (mini && outEl && 'IntersectionObserver' in window) new IntersectionObserver(([en]) => { mini.hidden = en.isIntersecting || !qs('.kpi.main'); }, { threshold: 0 }).observe(outEl);
  }
  const shareUrl = () => { const u = new URL(location.href.split('?')[0]); if (kind && run[kind]) Object.entries(snapshot()).forEach(([k, v]) => { if (v !== defaults[k]) u.searchParams.set(k, v); }); return u.toString(); };
  const copy = async (text, ok) => { try { await navigator.clipboard.writeText(text); toast(ok); } catch (e) { prompt('아래 내용을 복사하세요', text); } };
  qsa('[data-share]').forEach((b) => b.addEventListener('click', async () => { const u = shareUrl(); if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: document.title, url: u }); return; } catch (e) { /* 취소 */ } } copy(u, '입력값이 담긴 링크를 복사했어요'); }));
  qsa('[data-copy-result]').forEach((b) => b.addEventListener('click', () => {
    const h1 = qs('h1').textContent, lines = qsa('.kpi').map((k) => `${qs('span', k).textContent}: ${qs('b', k).textContent}`);
    const res = $('res'); if (res && !lines.length) lines.push(`${$('expr').value} = ${res.textContent}`);
    copy(`[${h1}]\n${lines.join('\n')}\n${shareUrl()}`, '결과를 복사했어요');
  }));
  qsa('[data-reset]').forEach((b) => b.addEventListener('click', () => { apply(defaults); store.del('in-' + kind); history.replaceState(null, '', location.pathname); rerender(); toast('처음 값으로 돌렸어요'); }));
  qsa('[data-print]').forEach((b) => b.addEventListener('click', () => { qsa('details').forEach((d) => (d.open = true)); print(); }));

  // ── 10. 일반·공학용 계산기 ──
  if (kind === 'basic' || kind === 'scientific') {
    const ex = $('expr'), out = $('res'), err = $('err'), hist = $('history');
    let angle = store.get('angle', 'deg'), ans = 0, justEval = false;
    const modeBtn = qs('[data-k="deg"]'); if (modeBtn) modeBtn.textContent = angle;
    const H = () => store.get('hist-' + kind, []);
    const drawHist = () => { hist.innerHTML = H().map((h) => `<li><button type="button" data-v="${h.r}"><small>${h.e} =</small>${Number(h.r).toLocaleString('ko-KR', { maximumFractionDigits: 10 })}</button></li>`).join(''); };
    const fmt = (v) => (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-9 && v !== 0) ? v.toExponential(8) : v.toLocaleString('ko-KR', { maximumFractionDigits: 10 }));
    const preview = () => { err.textContent = ''; if (!ex.value) { out.textContent = '0'; return; } try { const v = Calc.evaluate(ex.value.replace(/Ans/g, '(' + ans + ')'), angle); out.textContent = fmt(v); } catch (e) { /* 입력 중 */ } };
    const insert = (t) => { if (justEval && /^[\d.(πe√]|^sin|^cos|^tan|^ln|^log/.test(t)) ex.value = ''; justEval = false; const s = ex.selectionStart ?? ex.value.length, en = ex.selectionEnd ?? ex.value.length; ex.value = ex.value.slice(0, s) + t + ex.value.slice(en); const p = s + t.length; ex.setSelectionRange(p, p); preview(); };
    const equals = () => {
      if (!ex.value) return;
      try { const v = Calc.evaluate(ex.value.replace(/Ans/g, '(' + ans + ')'), angle); out.textContent = fmt(v); store.set('hist-' + kind, [{ e: ex.value, r: v }, ...H()].slice(0, 50)); ans = v; drawHist(); ex.value = String(v); justEval = true; const s = $('sr-status'); if (s) s.textContent = '결과 ' + fmt(v); }
      catch (e) { err.textContent = e.message; }
    };
    const KEYMAP = { '×': '×', '÷': '÷', '−': '−', '+': '+', '%': '%', '.': '.', '(': '(', ')': ')', 'π': 'π', 'e': 'e', '√': '√(', 'sin': 'sin(', 'cos': 'cos(', 'tan': 'tan(', 'ln': 'ln(', 'log': 'log(', 'x²': '^2', 'xʸ': '^', 'n!': '!', 'Ans': 'Ans' };
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.k'); if (!b) return; const k = b.dataset.k;
      if (/^\d$/.test(k)) insert(k);
      else if (k === 'AC') { ex.value = ''; out.textContent = '0'; err.textContent = ''; }
      else if (k === '⌫') { ex.value = ex.value.slice(0, -1); preview(); }
      else if (k === '=') equals();
      else if (k === '±') { ex.value = ex.value.startsWith('-(') && ex.value.endsWith(')') ? ex.value.slice(2, -1) : ex.value ? `-(${ex.value})` : '-'; preview(); }
      else if (k === '1/x') { ex.value = `1/(${ex.value || 0})`; preview(); }
      else if (k === 'deg') { angle = angle === 'deg' ? 'rad' : 'deg'; b.textContent = angle; store.set('angle', angle); preview(); toast(angle === 'deg' ? '각도: 도(°)' : '각도: 라디안'); }
      else if (KEYMAP[k]) insert(KEYMAP[k]);
      if (!matchMedia('(pointer: coarse)').matches) ex.focus();
    });
    ex.addEventListener('input', () => { justEval = false; preview(); });
    ex.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); } if (e.key === 'Escape') { ex.value = ''; preview(); } });
    document.addEventListener('keydown', (e) => { if (document.activeElement === ex || document.activeElement.tagName === 'INPUT' || $('search').open) return; if (/^[\d+\-*/().%^]$/.test(e.key)) { ex.focus(); } });
    hist.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; ex.value = b.dataset.v; justEval = true; preview(); ex.focus(); });
    qsa('[data-clear-history]').forEach((b) => b.addEventListener('click', () => { store.del('hist-' + kind); drawHist(); toast('계산 기록을 지웠어요'); }));
    drawHist(); preview();
  }
})();
