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

  // ── 2. 검색 (초성·별칭·오타 보정·한/영 자판 실수) — 로직은 search.js ──
  const ICONS = window.AC_ICONS || {};
  const dlg = $('search'), q = $('q'), qr = $('qr');
  let sel = 0, hits = [];
  const renderHits = () => {
    const r = window.CalcSearch ? CalcSearch.search(INDEX, q.value) : { hits: INDEX.slice(), fuzzy: false, via: '' };
    hits = r.hits;
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    const head = !hits.length ? '' : r.via === 'qwerty' ? '<li class="sug" role="presentation">한/영 전환이 안 된 것 같아요. 이 계산기를 찾으셨나요?</li>'
      : r.fuzzy ? '<li class="sug" role="presentation">정확히 맞는 이름은 없어요. 혹시 이 계산기를 찾으셨나요?</li>' : '';
    qr.innerHTML = hits.length ? head + hits.map((x, i) => `<li role="option" aria-selected="${i === sel}" data-tone="${x.t}"><a href="/${x.s}/"><span class="tic"><svg class="ic" viewBox="0 0 24 24">${ICONS[x.i] || ''}</svg></span><span class="tt"><b>${x.n}</b><small>${x.l}</small></span></a></li>`).join('') : '<li class="empty">맞는 계산기가 없어요. 다른 말로 찾아보세요.</li>';
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

  // 없는 주소로 들어오면 가장 비슷한 계산기를 추천 (/salry/ → 연봉 실수령액)
  if (page === '404' && window.CalcSearch) {
    const near = CalcSearch.nearSlug(INDEX, location.pathname), box = $('near');
    if (near && box) { box.hidden = false; box.innerHTML = `혹시 <a href="/${near.s}/"><b>${near.n}</b></a>를 찾으셨나요?`; }
  }

  // 홈 카드 hover (PC·마우스, 움직임 줄이기 설정이 아닐 때): 올린 카드 열을 1.08fr 로 → 같은 줄 카드는 부드럽게 밀려남
  if (page === 'home' && matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const setup = (g) => { // auto-fill 로 정해진 열 수를 읽어 같은 수의 1fr 로 고정해야 열 너비 전환이 부드럽다
      g.style.gridTemplateColumns = '';
      const n = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
      g.dataset.n = n; g.style.gridTemplateColumns = Array(n).fill('1fr').join(' ');
    };
    const cols = (g, hot) => Array(+g.dataset.n).fill('1fr').map((c, i) => (i === hot ? '1.08fr' : c)).join(' ');
    qsa('.tiles').forEach((g) => {
      g.addEventListener('mouseover', (e) => {
        const t = e.target.closest('.tile'); if (!t || !g.contains(t) || t.classList.contains('grow')) return;
        if (!g.dataset.n) setup(g);
        qsa('.tile.grow', g).forEach((x) => x.classList.remove('grow'));
        const n = +g.dataset.n; if (n < 2) return;
        requestAnimationFrame(() => { t.classList.add('grow'); g.style.gridTemplateColumns = cols(g, [...g.children].indexOf(t) % n); });
      });
      g.addEventListener('mouseleave', () => { qsa('.tile.grow', g).forEach((x) => x.classList.remove('grow')); if (g.dataset.n) g.style.gridTemplateColumns = cols(g, -1); });
    });
    let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => qsa('.tiles').forEach((g) => { if (g.dataset.n) setup(g); }), 150); });
  }

  // ── 3. 즐겨찾기·최근 사용 ──
  const favs = () => store.get('favs', []);
  const favBtn = qs('[data-fav]');
  if (favBtn) {
    const s = favBtn.dataset.fav, upd = () => favBtn.setAttribute('aria-pressed', favs().includes(s));
    upd();
    favBtn.addEventListener('click', () => { const f = favs(); const on = !f.includes(s); store.set('favs', on ? [s, ...f] : f.filter((x) => x !== s)); upd(); toast(on ? '즐겨찾기에 추가했어요' : '즐겨찾기에서 뺐어요'); });
    const rec = store.get('recent', []).filter((x) => x !== s); store.set('recent', [s, ...rec].slice(0, 12)); // 넉넉히 저장, 홈에서는 화면 폭에 맞춰 1줄만
  }
  if (page === 'home') {
    const tileOf = (s) => { const t = qs(`.cat .tile[href="/${s}/"]`); return t ? t.outerHTML : ''; };
    const f = favs().filter(tileOf), r = store.get('recent', []).filter(tileOf);
    if (f.length) { $('favs').innerHTML = f.map(tileOf).join(''); $('favs-wrap').hidden = false; }
    if (r.length) { $('recent').innerHTML = r.map(tileOf).join(''); $('recent-wrap').hidden = false; }
    if (f.length || r.length) $('mine').hidden = false;
    // 최근 사용은 가로 1줄만: 지금 화면의 열 수만큼만 보이고 나머지는 숨김 (창 크기가 바뀌면 다시 계산)
    const g = $('recent'), fit = () => { if (!r.length) return; const n = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length || 1; [...g.children].forEach((t, i) => { t.style.display = i < n ? '' : 'none'; }); };
    fit(); let rf; addEventListener('resize', () => { clearTimeout(rf); rf = setTimeout(fit, 160); });
  }

  // 문의하기: 계산기 페이지의 "알려 주세요"(?calc=slug)로 왔으면 관련 계산기를 미리 골라 둔다
  if (page === 'contact') {
    const slug = new URLSearchParams(location.search).get('calc'), sel = $('c-calc');
    const o = slug && sel && qs(`option[data-slug="${CSS.escape(slug)}"]`, sel);
    if (o) { sel.value = o.value; $('c-kind').value = '계산 오류 제보'; }
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
    const big = (Number(inp.value.replace(/[^\d]/g, '')) || 0) >= 1e6; // 빠른 버튼은 큰 금액 칸(기본값 100만 원 이상)에만
    const quick = document.createElement('div'); quick.className = 'quick'; quick.hidden = !big;
    quick.innerHTML = [['+100만', 1e6], ['+1,000만', 1e7], ['+1억', 1e8], ['0', 0]].map(([t, v]) => `<button type="button" data-add="${v}" aria-label="${t === '0' ? '0 — 금액 지우기' : t + ' 원 더하기'}">${t}</button>`).join('');
    lab.appendChild(quick);
    const fmt = () => { const d = inp.value.replace(/[^\d]/g, ''); inp.value = d ? Number(d).toLocaleString('ko-KR') : ''; hint.textContent = Number(d) >= 1e4 ? korean(Number(d)) : ''; };
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
    return `<div class="tbl-h"><h3>${title}</h3><button type="button" class="ab" data-csv="${id}"><svg class="ic" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>CSV 저장</button></div><div class="tbl" tabindex="0" role="region" aria-label="${title} (좌우로 넘겨 보기)"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr class="${r.cls || ''}">${(r.cells || r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
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

    // ── 추가 12종 ──
    percent() {
      const n = (v, d = 2) => (isFinite(v) ? (+v.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d }) : '—');
      const a1 = num('p1a'), b1 = num('p1b'), a2 = num('p2a'), b2 = num('p2b'), a3 = num('p3a'), b3 = num('p3b'), a4 = num('p4a'), b4 = num('p4b');
      const c = Calc.percent.change(a3, b3), r4 = Calc.percent.apply(a4, b4);
      $('o1').textContent = `${n(a1)}의 ${n(b1)}% = ${n(Calc.percent.of(a1, b1), 4)}`;
      $('o2').textContent = `${n(a2)}은(는) ${n(b2)}의 ${n(Calc.percent.ratio(a2, b2))}%`;
      $('o3').textContent = isFinite(c) ? `${c >= 0 ? '+' : '−'}${n(Math.abs(c))}% ${c >= 0 ? '증가' : '감소'} (차이 ${n(b3 - a3)})` : '처음 값이 0이면 계산할 수 없어요';
      $('o4').textContent = `${n(r4)} (${b4 >= 0 ? '+' : '−'}${n(Math.abs(r4 - a4))})`;
      // 결과는 각 질문 아래에 바로 표시 (결과 상자 없음)
      $('chart').innerHTML = ''; $('tables').innerHTML = '';
    },
    charcount() {
      const x = Calc.charCount($('text').value), lim = num('limit');
      const left = lim ? lim - x.withSpace : null;
      $('out').innerHTML = kpi([['공백 포함', x.withSpace.toLocaleString('ko-KR') + '자', 'main'], ['공백 제외', x.noSpace.toLocaleString('ko-KR') + '자'], ['단어', x.words.toLocaleString('ko-KR') + '개'], ['줄', x.lines.toLocaleString('ko-KR') + '줄'], ['바이트(UTF-8)', x.utf8.toLocaleString('ko-KR')], ['바이트(한글 2)', x.euckr.toLocaleString('ko-KR')]]) +
        (left === null ? '' : `<p class="note ${left < 0 ? 'over' : ''}">${left >= 0 ? `목표까지 ${left.toLocaleString('ko-KR')}자 남았어요.` : `목표보다 ${(-left).toLocaleString('ko-KR')}자 많아요.`}</p>`);
      $('chart').innerHTML = ''; $('tables').innerHTML = '';
    },
    refinance() {
      const x = Calc.refinance(num('balance'), num('curRate') / 100, num('newRate') / 100, Math.round(num('months')), num('feeRate') / 100, Math.round(num('feeRemain')), Math.round(num('feePeriod')), num('newCost'));
      $('out').innerHTML = kpi([[x.net >= 0 ? '갈아타면 아끼는 돈(순이익)' : '갈아타면 손해', won(Math.abs(x.net)), 'main'], ['이자 절감액', won(x.save)], ['중도상환수수료', won(x.fee)], ['월 상환액 차이', signed(-x.monthlyDiff)], ['본전 회수', isFinite(x.payback) ? x.payback + '개월' : '-']]) +
        `<p class="note">${x.net >= 0 ? '수수료와 비용을 빼도 이득입니다.' : '수수료·비용이 이자 절감액보다 커서 지금은 손해입니다.'}</p>`;
      Charts.bars($('chart'), { title: '이자 절감 vs 비용', horizontal: true, cats: ['이자 절감', '수수료+비용'], series: [{ label: '금액', color: S.p, values: [x.save, x.fee + num('newCost')] }] });
      $('tables').innerHTML = table('월 상환액 비교 (원리금균등)', ['구분', '월 상환액'], [['지금 대출', won(x.curMonthly)], ['새 대출', won(x.newMonthly)], ['차이', signed(x.newMonthly - x.curMonthly)]]);
    },
    goal() {
      const yrs = num('years'), x = Calc.goal(num('target'), yrs, num('rate') / 100, num('initial'));
      $('out').innerHTML = kpi([['매달 모아야 할 돈', won(x.monthly), 'main'], ['총 넣는 돈', won(x.paid)], ['이자로 채워지는 돈', won(Math.max(0, x.interest))], ['기간', yrs + '년 (' + x.n + '개월)']]);
      const series = []; let bal = num('initial'), paid = bal; const r = num('rate') / 100 / 12;
      for (let m = 1; m <= x.n; m++) { bal = bal * (1 + r) + x.monthly; paid += x.monthly; if (m % 12 === 0 || m === x.n) series.push({ y: +(m / 12).toFixed(1), p: paid, i: bal - paid }); }
      Charts.area($('chart'), { title: '목표까지 쌓이는 과정', x: series.map((s) => s.y), xLabel: (i) => series[i].y + '년', series: [{ label: '넣은 돈', color: S.p, values: series.map((s) => s.p) }, { label: '이자', color: S.i, values: series.map((s) => Math.max(0, s.i)) }] });
      $('tables').innerHTML = table('기간별 필요 월 적립액', ['기간', '월 적립액'], [3, 5, 7, 10, 15, 20].map((y) => [y + '년', won(Calc.goal(num('target'), y, num('rate') / 100, num('initial')).monthly)]));
    },
    avgprice() {
      const rows = [1, 2, 3, 4, 5].map((i) => ({ price: num('pr' + i), qty: num('q' + i) }));
      const x = Calc.avgPrice(rows), now = num('now');
      const pl = now && x.qty ? (now - x.avg) * x.qty : null;
      $('out').innerHTML = kpi([['평균 단가(평단가)', won(x.avg), 'main'], ['총 수량', x.qty.toLocaleString('ko-KR') + '주'], ['총 매입액', won(x.cost)], ...(pl === null ? [] : [['현재가 기준 손익', signed(pl)], ['수익률', ((now / x.avg - 1) * 100).toFixed(2) + '%']])]);
      $('chart').innerHTML = ''; $('tables').innerHTML = '';
    },
    caracq() {
      const x = Calc.carAcqTax(num('price'), $('kind').value);
      $('out').innerHTML = kpi([['내야 할 취득세', won(x.pay), 'main'], ['세율', (x.rate * 100) + '%'], ['감면 전 세액', won(x.tax)], ['감면액', won(x.cut)]]) + (x.pay === 0 ? '<p class="note">감면 한도 안이라 취득세가 없습니다.</p>' : '');
      $('chart').innerHTML = '';
      $('tables').innerHTML = table('차 종류별 비교 (같은 가격)', ['차 종류', '세율', '감면', '납부액'], [['승용', 'car'], ['승합·화물', 'van'], ['경차', 'light'], ['전기차', 'ev']].map(([l, k]) => { const y = Calc.carAcqTax(num('price'), k); return { cls: k === $('kind').value ? 'now' : '', cells: [l, y.rate * 100 + '%', won(y.cut), won(y.pay)] }; }));
    },
    salary() {
      const x = Calc.salary(num('annual'), num('nontax'), Math.round(num('family')) || 1, Math.round(num('kids')));
      $('out').innerHTML = kpi([['월 실수령액', won(x.net), 'main'], ['연 실수령액', won(x.netYear)], ['월 공제 합계', won(x.deduct)], ['월 세전 급여', won(x.gross)]]);
      Charts.bars($('chart'), { title: '월급에서 빠지는 돈', horizontal: true, cats: ['국민연금', '건강보험', '장기요양', '고용보험', '소득세', '지방소득세'], series: [{ label: '금액', color: S.i, values: [x.pension, x.health, x.care, x.employ, x.incomeTax, x.localTax] }] });
      $('tables').innerHTML = table('연봉별 월 실수령액 (같은 조건)', ['연봉', '월 실수령', '월 공제'], [3e7, 4e7, 5e7, 6e7, 7e7, 8e7, 1e8].map((a) => { const y = Calc.salary(a, num('nontax'), Math.round(num('family')) || 1, Math.round(num('kids'))); return { cls: Math.abs(a - num('annual')) < 1 ? 'now' : '', cells: [Charts.short(a) + '원', won(y.net), won(y.deduct)] }; }));
    },
    wage() {
      const opt = (tax) => ({ tax, pension: $('pension').value === '1', health: $('health').value === '1', employ: $('employ').value === '1', family: Math.round(num('family')) || 1, probation: $('probation').value === '1', absentDays: Math.round(num('absent')) });
      const tax = $('tax').value, x = Calc.wage(num('hourly'), num('hours'), num('days'), opt(tax));
      $('out').innerHTML = kpi([['월 실수령액', won(x.net), 'main'], ['월급(세전)', won(x.gross)], ['월 공제 합계', won(x.deduct)], ['주휴수당(주)', won(x.rate * x.holidayHours)], ['주급(주휴 포함)', won(x.rate * (x.weekHours + x.holidayHours))], ['월 환산 시간', x.monthHours + '시간'], ['주 근무 시간', x.weekHours + '시간'], ['주휴 시간', +x.holidayHours.toFixed(2) + '시간']]) +
        (x.rateBelowMin ? `<p class="note over">${num('hourly') < Calc.Y2026.minWage ? '입력한 시급이 2026년 최저임금(10,320원)보다 낮습니다.' : '수습 감액 후 시급이 최저임금의 90%(9,288원)보다 낮습니다.'}</p>` : x.belowMin ? '<p class="note over">입력한 시급이 2026년 최저임금(10,320원)보다 낮습니다.</p>' : '') +
        (x.holidayHours === 0 ? '<p class="note">주 15시간 미만이라 주휴수당이 없습니다.</p>' : '') +
        (x.absent ? `<p class="note">결근 ${x.absent}일로 근무분 ${won(x.lostWork)}과 주휴수당 ${won(x.lostHoliday)}이 빠졌습니다.</p>` : '') +
        (tax === 'biz' ? '<p class="note">3.3%는 4대보험을 떼지 않습니다. 다음 해 5월 종합소득세 신고로 세금을 정산합니다.</p>' : '') +
        (tax !== 'biz' && tax !== 'none' && x.weekHours * 365 / 7 / 12 < 60 && (x.pension || x.health) ? '<p class="note">한 달 소정근로가 60시간 미만이면 국민연금·건강보험 직장가입 대상이 아닐 수 있습니다.</p>' : '');
      const items = [['국민연금', x.pension], ['건강보험', x.health], ['장기요양', x.care], ['고용보험', x.employ], ['소득세', x.incomeTax], ['지방소득세', x.localTax]].filter((r) => r[1] > 0);
      if (items.length) Charts.bars($('chart'), { title: '월급에서 빠지는 돈', horizontal: true, cats: items.map((r) => r[0]), series: [{ label: '금액', color: S.i, values: items.map((r) => r[1]) }] }); else $('chart').innerHTML = '';
      const b = x.boss, ins = tax !== 'biz' && tax !== 'none';
      $('tables').innerHTML = (ins && x.bossTotal ? table('4대보험 누가 얼마 내나 (월)', ['보험', '내 월급에서', '회사가 따로'], [['국민연금', won(x.pension), won(b.pension)], ['건강보험', won(x.health), won(b.health)], ['장기요양', won(x.care), won(b.care)], ['고용보험', won(x.employ), won(b.employ)], ['산재보험', '0원', '업종별 요율'], { cls: 'now', cells: ['합계', won(x.pension + x.health + x.care + x.employ), won(x.bossTotal) + ' + 산재'] }]) : '') +
        table('세금 방식별 월 실수령액 (같은 조건)', ['방식', '월 공제', '월 실수령'], [['earned', '4대보험 + 근로소득세'], ['biz', '3.3%'], ['daily', '일용직'], ['none', '떼지 않음']].map(([k, l]) => { const y = Calc.wage(num('hourly'), num('hours'), num('days'), opt(k)); return { cls: k === tax ? 'now' : '', cells: [l, won(y.deduct), won(y.net)] }; }));
    },
    unemployment() {
      const daily = num('days3m') ? num('wage3m') / num('days3m') : 0, x = Calc.unemployment(daily, num('hours'), num('years'), $('older').value === '1');
      $('out').innerHTML = kpi([['실업급여 총액', won(x.total), 'main'], ['1일 지급액', won(x.daily)], ['받는 일수', x.days + '일'], ['한 달(30일) 기준', won(x.monthly)]]) +
        (x.capped ? '<p class="note">평균임금의 60%가 상한(68,100원)을 넘어 상한액으로 계산했습니다.</p>' : x.floored ? `<p class="note">평균임금의 60%가 하한보다 낮아 하한액(${won(x.lower)})으로 계산했습니다.</p>` : '') +
        (num('years') < 0.5 ? '<p class="note over">가입 기간 180일 미만이면 받을 수 없습니다.</p>' : '');
      $('chart').innerHTML = '';
      $('tables').innerHTML = table('받는 일수 (고용보험법 별표1)', ['가입 기간', '50세 미만', '50세 이상·장애인'], [['1년 미만', 120, 120], ['1~3년', 150, 180], ['3~5년', 180, 210], ['5~10년', 210, 240], ['10년 이상', 240, 270]].map((r) => r.map((c, i) => (i ? c + '일' : c))));
    },
    vat() {
      const x = Calc.vat(num('amount'), $('mode').value);
      $('out').innerHTML = kpi([[$('mode').value === 'total' ? '공급가액' : '합계금액', won($('mode').value === 'total' ? x.supply : x.total), 'main'], ['공급가액', won(x.supply)], ['부가세(10%)', won(x.tax)], ['합계금액', won(x.total)]]);
      $('chart').innerHTML = ''; $('tables').innerHTML = '';
    },
    subscription() {
      const owned = $('owned').value === '1'; $('home').disabled = owned;
      const x = Calc.subscription(owned ? -1 : num('home'), num('dep'), num('acc'), num('spouse'));
      $('out').innerHTML = kpi([['청약 가점', x.total + '점 / 84점', 'main'], ['무주택 기간', x.home + ' / 32점'], ['부양가족', x.dep + ' / 35점'], ['통장 기간', x.account + ' / 17점' + (x.spouse ? ` (배우자 +${x.spouse})` : '')]]);
      Charts.bars($('chart'), { title: '항목별 점수', horizontal: true, cats: ['무주택', '부양가족', '통장'], series: [{ label: '내 점수', color: S.p, values: [x.home, x.dep, x.account] }, { label: '남은 점수', color: S.i, values: [32 - x.home, 35 - x.dep, 17 - x.account] }] });
      $('tables').innerHTML = '';
    },
    winrate() {
      const w = num('w'), l = num('l'), d = num('d'), T = num('target') / 100, x = Calc.winRate(w, l, d, $('draw').value, T);
      const pct = (v) => (v * 100).toFixed(1) + '%', tg = num('target').toFixed(1).replace(/\.0$/, '') + '%';
      const goal = !x.G ? ['목표까지', '경기를 입력하세요'] : x.rate >= T ? [`${tg} 지키며 질 수 있는 판`, x.canLose + '연패까지'] : [`${tg}까지 필요한 연승`, isFinite(x.needWins) ? x.needWins + '연승' : '도달 불가'];
      $('out').innerHTML = kpi([['승률', pct(x.rate), 'main'], ['전적', `${w}승 ${l}패${d ? ' ' + d + '무' : ''} (${x.games}경기)`], goal, ['야구식 표기', x.rate.toFixed(3).replace(/^0/, '')]]) +
        (x.G && x.rate < T && !isFinite(x.needWins) ? '<p class="note over">이미 진 경기가 있어 승률 100%는 만들 수 없습니다.</p>' : '');
      if (x.games) Charts.bars($('chart'), { title: '전적 구성', horizontal: true, cats: ['전적'], series: [{ label: '승', color: S.p, values: [w] }, ...(d ? [{ label: '무', color: S.g, values: [d] }] : []), { label: '패', color: S.i, values: [l] }] }); else $('chart').innerHTML = '';
      $('tables').innerHTML = x.G && T > 0 && T < 1 ? table('연승하면 승률이 이렇게 바뀝니다', ['연승', '전적', '승률'], [0, 1, 3, 5, 10, 20].map((k) => { const y = Calc.winRate(w + k, l, d, $('draw').value, T); return [k ? k + '연승' : '지금', `${w + k}승 ${l}패${d ? ' ' + d + '무' : ''}`, pct(y.rate)]; })) : '';
    },
    bmi() {
      const x = Calc.bmi(num('height'), num('weight')); if (!isFinite(x.bmi)) return;
      $('out').innerHTML = kpi([['BMI ' + x.bmi.toFixed(1), x.level, 'main'], ['정상 체중 범위', x.normalMin.toFixed(1) + '~' + x.normalMax.toFixed(1) + 'kg'], ['정상 상한까지', num('weight') > x.normalMax ? '−' + (num('weight') - x.normalMax).toFixed(1) + 'kg' : '범위 안']]);
      Charts.gauge($('chart'), { title: 'BMI 위치 (0~40)', value: Math.min(1, x.bmi / 40), label: 'BMI ' + x.bmi.toFixed(1) });
      $('tables').innerHTML = table('대한비만학회 기준', ['BMI', '판정'], [['18.5 미만', '저체중'], ['18.5~22.9', '정상'], ['23~24.9', '비만 전 단계'], ['25~29.9', '1단계 비만'], ['30~34.9', '2단계 비만'], ['35 이상', '3단계 비만']].map(([a, b]) => ({ cls: b === x.level ? 'now' : '', cells: [a, b] })));
    },
    leave() {
      if (!$('last').value) $('last').value = today();
      const x = Calc.annualLeave($('start').value, $('last').value, num('used'), num('daily'));
      $('chart').innerHTML = '';
      if (!x) { $('out').innerHTML = '<p class="note over">마지막 근무일이 입사일보다 빠릅니다. 날짜를 확인해 주세요.</p>'; $('tables').innerHTML = ''; return; }
      $('out').innerHTML = kpi([['지금 쓸 수 있는 연차', x.cur + '일', 'main'], ['남은 연차', x.unused + '일'], ['남은 연차 수당', won(x.pay)], ['근속', x.years + '년 (' + x.serviceDays.toLocaleString('ko-KR') + '일)'], ['입사 후 생긴 연차 합계', x.total + '일'], ['다음 연차', x.next.date + ' · ' + x.next.days + '일']]) +
        (x.years === 1 ? `<p class="note">1년 차 월 단위 연차 ${x.monthly}일 + 1년 근속 연차 15일을 합쳤습니다. 1년 차 연차를 이미 썼다면 "쓴 연차"에 넣으세요.</p>` : '') +
        (x.years === 0 && x.serviceDays >= 365 ? '<p class="note">1년을 채웠지만, 1년이 지난 다음 날 재직하지 않으면 15일은 생기지 않습니다.</p>' : '') +
        (num('used') > x.cur ? '<p class="note over">쓴 연차가 지금 쓸 수 있는 연차보다 많습니다.</p>' : '');
      const NS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21], hot = x.years === 0 ? 0 : Math.max(...NS.filter((n) => n <= x.years)); // 지금 근속에 해당하는 줄
      $('tables').innerHTML = table('근속 연수별 연차 일수', ['근속', '연차'], [['1년 미만', '매월 1일 (최대 11일)', 0], ...NS.map((n, i) => [n === 21 ? '21년 이상' : NS[i + 1] - n > 1 ? n + '~' + (NS[i + 1] - 1) + '년' : n + '년', Calc.leaveGrant(n) + '일', n])].map(([a, b, n]) => ({ cls: n === hot ? 'now' : '', cells: [a, b] })));
    },
    brokerage() {
      const deal = $('deal').value, kind = $('kind').value;
      const show = (id, on) => { const l = $(id).closest('label'); if (l) l.style.display = on ? '' : 'none'; };
      show('price', deal === 'sale'); show('deposit', deal === 'lease'); show('rent', deal === 'lease');
      const x = Calc.brokerage(kind, deal, num('price'), num('deposit'), num('rent'), $('vat').value === '1');
      $('out').innerHTML = kpi([['중개보수 상한', won(x.total), 'main'], ['거래금액', won(x.amount)], ['상한 요율', +(x.rate * 100).toFixed(1) + '%'], ['한도액', x.cap ? won(x.cap) : '없음'], ...(x.vat ? [['부가세', won(x.vat)]] : [])]) +
        (x.capped ? `<p class="note">요율로 계산한 ${won(x.raw)}이 한도액을 넘어 ${won(x.cap)}을 적용했습니다.</p>` : '') +
        (deal === 'lease' && num('rent') > 0 ? `<p class="note">월세 거래금액 = 보증금 + 월세 × ${num('deposit') + num('rent') * 100 < 5e7 ? '70 (×100 환산이 5천만 원 미만이라)' : '100'}.</p>` : '') +
        (kind === 'other' ? '<p class="note">0.9% 이내에서 협의하는 거래라 최대치로 계산했습니다.</p>' : '') + '<p class="note">파는 사람과 사는 사람(집주인과 세입자)이 각각 이 금액 안에서 냅니다.</p>';
      $('chart').innerHTML = '';
      const rows = Calc.BROKER[deal], lab = (lo, up) => (lo ? Charts.short(lo) + '원 이상' : '') + (up < Infinity ? (lo ? ' ~ ' : '') + Charts.short(up) + '원 미만' : '');
      $('tables').innerHTML = kind !== 'house' ? '' : table('주택 ' + (deal === 'sale' ? '매매' : '임대차') + ' 상한 요율표', ['거래금액', '상한 요율', '한도액'], rows.map(([up, r, cap], i) => { const lo = i ? rows[i - 1][0] : 0; return { cls: x.amount >= lo && x.amount < up ? 'now' : '', cells: [lab(lo, up), +(r * 100).toFixed(1) + '%', cap ? won(cap) : '없음'] }; }));
    },
    freelance() {
      const fam = Math.round(num('family')) || 1, x = Calc.freelanceTax(num('income'), num('exp') / 100, fam, num('pension'));
      const paid = x.prepaid + x.prepaidLocal, real = x.tax + x.local;
      $('out').innerHTML = kpi([[x.refund >= 0 ? '돌려받을 세금 (예상)' : '더 낼 세금 (예상)', won(Math.abs(x.refund)), 'main'], ['미리 낸 세금 (3.3%)', won(paid)], ['실제 세금 (지방세 포함)', won(real)], ['필요경비', won(x.expense)], ['소득금액', won(x.earn)], ['과세표준', won(x.base)]]) +
        (num('income') > 36e6 ? '<p class="note">직전 해 수입이 3,600만 원 이상이면 단순경비율 대신 기준경비율·장부 신고 대상일 수 있어 결과가 크게 달라집니다.</p>' : '');
      Charts.bars($('chart'), { title: '미리 낸 세금 vs 실제 세금', horizontal: true, cats: ['미리 낸 세금', '실제 세금'], series: [{ label: '금액', color: S.i, values: [paid, real] }] });
      $('tables').innerHTML = table('수입별 예상 환급액 (같은 조건)', ['1년 수입', '미리 낸 세금', '돌려받을 세금'], [5e6, 1e7, 1.5e7, 2e7, 3e7, 3.6e7, 5e7].map((a) => { const y = Calc.freelanceTax(a, num('exp') / 100, fam, num('pension')); return { cls: Math.abs(a - num('income')) < 1 ? 'now' : '', cells: [Charts.short(a) + '원', won(y.prepaid + y.prepaidLocal), y.refund >= 0 ? won(y.refund) : '−' + won(-y.refund) + ' (추가 납부)'] }; }));
    },
    electricity() {
      const kwh = Math.max(0, Math.round(num('kwh'))), summer = $('season').value === 'summer', x = Calc.electricity(kwh, summer, num('climate'), num('fuel'));
      $('out').innerHTML = kpi([['이번 달 전기요금', won(x.total), 'main'], ['누진 단계', x.step + '단계'], ['기본요금', won(x.basic)], ['전력량요금', won(x.energy)], ['기후환경 + 연료비조정', won(x.clim + x.fuelFee)], ['부가세 + 전력기금', won(x.vat + x.fund)]]) +
        (kwh <= x.t1 ? `<p class="note">${x.t1 - kwh}kWh 더 쓰면 2단계(기본요금 1,600원, kWh당 214.6원)가 됩니다.</p>` : kwh <= x.t2 ? `<p class="note">${x.t2 - kwh}kWh 더 쓰면 3단계(기본요금 7,300원, kWh당 307.3원)가 됩니다.</p>` : '<p class="note over">3단계 구간입니다. ' + x.t2 + 'kWh를 넘는 사용량에는 kWh당 307.3원이 붙습니다.</p>') +
        (kwh > 1000 ? '<p class="note over">여름·겨울에 1,000kWh를 넘으면 슈퍼유저 요금이 붙어 실제 요금이 더 많습니다(이 계산에는 미반영).</p>' : '');
      Charts.bars($('chart'), { title: '구간별 전력량요금', horizontal: true, cats: ['1단계 ' + x.parts[0] + 'kWh', '2단계 ' + x.parts[1] + 'kWh', '3단계 ' + x.parts[2] + 'kWh'], series: [{ label: '금액', color: S.i, values: x.parts.map((q, i) => Math.floor(q * Calc.ELEC.rate[i])) }] });
      const uses = [100, 200, 300, 350, 400, 450, 500, 600];
      $('tables').innerHTML = table('사용량별 요금 (' + (summer ? '여름' : '기타 계절') + ')', ['사용량', '단계', '청구 요금'], uses.map((u) => { const y = Calc.electricity(u, summer, num('climate'), num('fuel')); return { cls: u === kwh ? 'now' : '', cells: [u + 'kWh', y.step + '단계', won(y.total)] }; }));
    },
  };

  // ── 9. 입력값 저장·복원·공유·초기화 ──
  const calcEl = qs('[data-calc]'), kind = calcEl && calcEl.dataset.calc;
  const fields = calcEl ? qsa('input,select,textarea', calcEl).filter((e) => e.id && !['expr'].includes(e.id)) : [];
  const saved = fields.filter((e) => e.dataset.nosave === undefined); // 글자 수 세기 본문 등은 저장·공유 제외
  const defaults = Object.fromEntries(fields.map((e) => [e.id, e.value]));
  const snapshot = () => Object.fromEntries(saved.map((e) => [e.id, e.value]));
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
    if (!lines.length) lines.push(...qsa('.pct-out').map((p) => p.textContent)); // 퍼센트 계산기
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
