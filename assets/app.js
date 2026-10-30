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
  // 입력칸의 min·max 를 계산에도 적용한다 (대출 기간에 큰 수를 넣으면 월별 표를 끝없이 만들어 페이지가 멈추던 문제, 2026-10-29)
  const num = (id) => {
    const e = $(id); if (!e) return 0;
    let v = Number(String(e.value).replace(/[^\d.\-]/g, '')) || 0;
    const max = e.getAttribute('max'), min = e.getAttribute('min');
    if (max !== null && v > Number(max)) v = Number(max);
    if (min !== null && String(e.value).trim() !== '' && v < Number(min)) v = Number(min);
    return v;
  };
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

  // 고정 헤더 높이 → 카테고리(/#work 등)로 이동했을 때 제목·목록이 헤더에 가리지 않게 (2026-10-31)
  const topEl = qs('.top');
  if (topEl) {
    const setTopH = () => document.documentElement.style.setProperty('--top-h', topEl.offsetHeight + 'px');
    setTopH(); if ('ResizeObserver' in window) new ResizeObserver(setTopH).observe(topEl); else addEventListener('resize', setTopH);
    if (location.hash.length > 1) addEventListener('load', () => { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView(); });
  }

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

  // 문의하기: 계산기 페이지의 "알려 주세요"(#calc=slug)로 왔으면 관련 계산기를 미리 골라 둔다
  // (예전 ?calc= 링크도 읽음 — 쿼리 주소는 구글이 "대체 페이지"로 따로 수집해서 2026-10-30 # 으로 바꿈)
  if (page === 'contact') {
    const slug = new URLSearchParams(location.hash.slice(1)).get('calc') || new URLSearchParams(location.search).get('calc'), sel = $('c-calc');
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
  const showFor = (state) => qsa('.calc [data-show]').forEach((d) => { d.style.display = d.dataset.show.split(' ').some((t) => state.includes(t)) ? '' : 'none'; });

  // 시급 계산기 달력: 고른 날짜는 숨은 입력 #wdates(쉼표 목록), 보는 달은 #wmonth — 자동 저장·공유 링크에 그대로 담긴다
  const ymdKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const wcalMonth = () => { const v = $('wmonth') && $('wmonth').value; return /^\d{4}-\d{2}$/.test(v || '') ? v : today().slice(0, 7); };
  const wcalDates = () => ($('wdates').value || '').split(',').filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const renderWcal = (ym) => {
    const box = $('wcal'); if (!box) return;
    const [y, m] = ym.split('-').map(Number), set = new Set(wcalDates()), first = new Date(y, m - 1, 1), H = Calc.HOLIDAYS;
    const start = new Date(y, m - 1, 1 - ((first.getDay() + 6) % 7)); // 월요일부터
    const lastD = new Date(y, m, 0), end = new Date(y, m - 1, lastD.getDate() + ((7 - lastD.getDay()) % 7));
    let cells = '';
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const k = ymdKey(d), out = d.getMonth() !== m - 1, dow = d.getDay(), hol = H[k];
      const cls = ['wd', out ? 'out' : '', hol ? 'hol' : dow === 0 ? 'sun' : dow === 6 ? 'sat' : '', set.has(k) ? 'on' : ''].filter(Boolean).join(' ');
      cells += `<button type="button" class="${cls}" data-wd="${k}" aria-pressed="${set.has(k)}" aria-label="${d.getMonth() + 1}월 ${d.getDate()}일${hol ? ' ' + hol : ''}${set.has(k) ? ' 근무' : ''}"${hol ? ` title="${hol}"` : ''}>${d.getDate()}${hol ? '<small>' + hol.replace('대체공휴일', '대체') + '</small>' : ''}</button>`;
    }
    const inMonth = wcalDates().filter((k) => k.startsWith(ym)).length, noHol = !Calc.HOLIDAY_YEARS.includes(y);
    box.innerHTML = `<div class="wcal-head"><button type="button" class="tb" data-wnav="-1" aria-label="이전 달"><svg class="ic" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button><b>${y}년 ${m}월 · ${inMonth}일 근무</b><button type="button" class="tb" data-wnav="1" aria-label="다음 달"><svg class="ic" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button></div>
<div class="wcal" role="group" aria-label="${y}년 ${m}월 근무한 날 (누르면 선택·해제)">${['월', '화', '수', '목', '금', '토', '일'].map((w, i) => `<span class="wdh${i === 5 ? ' sat' : i === 6 ? ' sun' : ''}" aria-hidden="true">${w}</span>`).join('')}${cells}</div>
<div class="wcal-act"><button type="button" class="ab" data-wfill="weekday">평일 모두</button><button type="button" class="ab" data-wfill="clear">이 달 지우기</button></div>
<small class="wcal-help">근무한 날을 누르세요. 빨간 날은 공휴일, 흐린 날은 앞뒤 달(주휴 계산용)입니다.${noHol ? ' 이 해는 공휴일 표시가 없어요(2026·2027년만).' : ''}</small>`;
  };
  const wcalSet = (dates) => { $('wdates').value = [...new Set(dates)].sort().join(','); rerender(); };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-wd],[data-wnav],[data-wfill]'); if (!t || !$('wcal') || !$('wcal').contains(t)) return;
    if (t.dataset.wd) { const k = t.dataset.wd, cur = wcalDates(); wcalSet(cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]); qs(`[data-wd="${k}"]`, $('wcal'))?.focus(); return; }
    if (t.dataset.wnav) { const [y, m] = wcalMonth().split('-').map(Number), d = new Date(y, m - 1 + Number(t.dataset.wnav), 1); $('wmonth').value = ymdKey(d).slice(0, 7); rerender(); return; }
    const ym = wcalMonth(), [y, m] = ym.split('-').map(Number), rest = wcalDates().filter((k) => !k.startsWith(ym));
    if (t.dataset.wfill === 'clear') { wcalSet(rest); toast('이 달 선택을 지웠어요'); return; }
    const days = []; for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) { const dt = new Date(y, m - 1, d), k = ymdKey(dt); if (dt.getDay() % 6 && !Calc.HOLIDAYS[k]) days.push(k); }
    wcalSet([...rest, ...days]); toast('공휴일을 뺀 평일을 모두 골랐어요');
  });

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
      const pctMode = $('downMode').value === 'pct'; showFor([pctMode ? 'pct' : 'won']);
      const price = num('price'), down = Math.min(pctMode ? Math.round(price * num('downPct') / 100) : num('down'), price), rate = num('rate') / 100, n = Math.round(num('months')), x = Calc.carLoan(price, down, rate, n);
      $('out').innerHTML = kpi([['월 납입금', won(x.monthly), 'main'], ['할부 원금', won(x.principal)], ['총 이자', won(x.totalInterest)], pctMode ? ['선납금', won(down)] : ['선납금 비율', price ? (down / price * 100).toFixed(1) + '%' : '-'], ['총 지출(선납 포함)', won(x.total)]]);
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
      const yrs = num('years'); if (!yrs) return; // 기간을 비우면 계산하지 않음 (NaN 그래프 방지)
      const x = Calc.goal(num('target'), yrs, num('rate') / 100, num('initial'));
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
      const mode = $('wmode').value; showFor([mode]);
      const opt = (tax) => ({ tax, pension: $('pension').value === '1', health: $('health').value === '1', employ: $('employ').value === '1', family: Math.round(num('family')) || 1, probation: $('probation').value === '1', absentDays: Math.round(num('absent')), juhyu: $('juhyu').value === '1' });
      const h = num('hours');
      let monthIn = null;
      if (mode === 'cal') { const ym = wcalMonth(); monthIn = Calc.wageCalendar(ym, wcalDates(), h); renderWcal(ym); }
      else if (mode === 'count') monthIn = { workDays: num('mdays'), holidayDays: num('mhol'), weekendDays: num('mwkd') };
      const calcBy = (tax) => monthIn ? Calc.wageMonth(num('hourly'), h, Object.assign({ holidayMul: $('holMul').value, weekendMul: $('wkdMul').value, juhyu: $('juhyu').value === '1' }, monthIn), opt(tax)) : Calc.wage(num('hourly'), h, num('days'), opt(tax));
      const tax = $('tax').value, x = calcBy(tax);
      const head = monthIn
        ? [['월 실수령액', won(x.net), 'main'], ['월급(세전)', won(x.gross)], ['월 공제 합계', won(x.deduct)], ['근무분', won(x.workPay)], ['주휴수당(월)', won(x.juhyuPay)], ['공휴일·주말 가산', won(x.premiumPay)], ['근무 일수', x.workDays + '일'], ['근무 시간', +x.workHours.toFixed(2) + '시간']]
        : [['월 실수령액', won(x.net), 'main'], ['월급(세전)', won(x.gross)], ['월 공제 합계', won(x.deduct)], ['주휴수당(주)', won(x.rate * x.holidayHours)], ['주급(주휴 포함)', won(x.rate * (x.weekHours + x.holidayHours))], ['월 환산 시간', x.monthHours + '시간'], ['주 근무 시간', x.weekHours + '시간'], ['주휴 시간', +x.holidayHours.toFixed(2) + '시간']];
      const juhyuOff = $('juhyu').value === '0';
      $('out').innerHTML = kpi(head) +
        (x.rateBelowMin ? `<p class="note over">${num('hourly') < Calc.Y2026.minWage ? '입력한 시급이 2026년 최저임금(10,320원)보다 낮습니다.' : '수습 감액 후 시급이 최저임금의 90%(9,288원)보다 낮습니다.'}</p>` : x.belowMin ? '<p class="note over">입력한 시급이 2026년 최저임금(10,320원)보다 낮습니다.</p>' : '') +
        (juhyuOff && x.juhyuEligible ? '<p class="note">주 15시간 이상이라 원칙적으로 주휴수당 대상입니다(개근한 주). 받지 않음으로 계산했습니다.</p>' : !juhyuOff && !x.juhyuEligible ? `<p class="note">${mode === 'cal' ? '주 15시간 이상인 주가 없어' : '주 15시간 미만이라'} 주휴수당이 없습니다.</p>` : '') +
        (mode === 'cal' && x.eligibleWeeks ? `<p class="note">주휴수당: 15시간 이상인 주 ${x.eligibleWeeks}개 (일요일이 이 달에 있는 주 기준)</p>` : '') +
        (monthIn && (x.holidayDays || x.weekendDays) ? `<p class="note">공휴일 ${x.holidayDays}일 · 주말 ${x.weekendDays}일 근무${x.premiumPay ? ` → 가산 ${won(x.premiumPay)}` : ' (가산 없음으로 계산)'}</p>` : '') +
        (mode === 'count' && num('mhol') + num('mwkd') > num('mdays') ? '<p class="note over">공휴일·주말 근무 일수의 합이 전체 근무 일수보다 많아, 전체 근무 일수까지만 셌습니다.</p>' : '') +
        (x.absent ? `<p class="note">결근 ${x.absent}일로 근무분 ${won(x.lostWork)}과 주휴수당 ${won(x.lostHoliday)}이 빠졌습니다.</p>` : '') +
        (tax === 'biz' ? '<p class="note">3.3%는 4대보험을 떼지 않습니다. 다음 해 5월 종합소득세 신고로 세금을 정산합니다.</p>' : '') +
        (tax !== 'biz' && tax !== 'none' && (monthIn ? x.workHours : x.weekHours * 365 / 7 / 12) < 60 && (x.pension || x.health) ? '<p class="note">한 달 소정근로가 60시간 미만이면 국민연금·건강보험 직장가입 대상이 아닐 수 있습니다.</p>' : '');
      const items = [['국민연금', x.pension], ['건강보험', x.health], ['장기요양', x.care], ['고용보험', x.employ], ['소득세', x.incomeTax], ['지방소득세', x.localTax]].filter((r) => r[1] > 0);
      if (items.length) Charts.bars($('chart'), { title: '월급에서 빠지는 돈', horizontal: true, cats: items.map((r) => r[0]), series: [{ label: '금액', color: S.i, values: items.map((r) => r[1]) }] }); else $('chart').innerHTML = '';
      const b = x.boss, ins = tax !== 'biz' && tax !== 'none';
      $('tables').innerHTML = (ins && x.bossTotal ? table('4대보험 누가 얼마 내나 (월)', ['보험', '내 월급에서', '회사가 따로'], [['국민연금', won(x.pension), won(b.pension)], ['건강보험', won(x.health), won(b.health)], ['장기요양', won(x.care), won(b.care)], ['고용보험', won(x.employ), won(b.employ)], ['산재보험', '0원', '업종별 요율'], { cls: 'now', cells: ['합계', won(x.pension + x.health + x.care + x.employ), won(x.bossTotal) + ' + 산재'] }]) : '') +
        table('세금 방식별 월 실수령액 (같은 조건)', ['방식', '월 공제', '월 실수령'], [['earned', '4대보험 + 근로소득세'], ['biz', '3.3%'], ['daily', '일용직'], ['none', '떼지 않음']].map(([k, l]) => { const y = calcBy(k); return { cls: k === tax ? 'now' : '', cells: [l, won(y.deduct), won(y.net)] }; }));
    },
    unemployment() {
      const daily = num('days3m') ? num('wage3m') / num('days3m') : 0, x = Calc.unemployment(daily, num('hours'), num('years'), $('older').value === '1');
      $('out').innerHTML = kpi([['실업급여 총액', won(x.total), 'main'], ['1일 지급액', won(x.daily)], ['받는 일수', x.days + '일'], ['한 달(30일) 기준', won(x.monthly)]]) +
        (x.capped ? '<p class="note">평균임금의 60%가 상한(68,100원)을 넘어 상한액으로 계산했습니다.</p>' : x.floored ? `<p class="note">평균임금의 60%가 하한보다 낮아 하한액(${won(x.lower)})으로 계산했습니다.</p>` : '') +
        (num('years') < 0.5 ? '<p class="note over">가입 기간 180일 미만이면 받을 수 없습니다.</p>' : '');
      $('chart').innerHTML = '';
      $('tables').innerHTML = table('받는 일수 (고용보험법 별표1)', ['가입 기간', '50세 미만', '50세 이상·장애인'], [['1년 미만', 120, 120], ['1~3년', 150, 180], ['3~5년', 180, 210], ['5~10년', 210, 240], ['10년 이상', 240, 270]].map((r) => r.map((c, i) => (i ? c + '일' : c))));
    },
    parental() {
      const kind = $('pkind').value; showFor([kind]);
      const months = Math.min(18, Math.max(1, Math.round(num('pmonths')) || 1)), x = Calc.parentalLeave(num('pwage'), months, kind, Math.round(num('ptogether')));
      const first = x.rows[0], late = x.rows.find((r) => r.m >= 7);
      $('out').innerHTML = kpi([['육아휴직 급여 총액', won(x.total), 'main'], ['한 달 평균', won(x.total / months)], ['첫 달', won(first.pay)], ['7개월째부터 매달', late ? won(late.pay) : '—']]) +
        (months > 12 ? '<p class="note">1년을 넘는 기간(최대 1년 6개월)은 부모가 같은 자녀로 각각 3개월 이상 쓰는 등 조건을 채워야 합니다.</p>' : '') +
        (x.rows.some((r) => r.floored) ? '<p class="note">통상임금 기준 금액이 하한(월 70만 원)보다 적은 달은 70만 원으로 계산했습니다.</p>' : '');
      Charts.bars($('chart'), { title: '달마다 받는 육아휴직 급여', cats: x.rows.map((r) => r.m + '개월'), series: [{ label: '급여', color: S.p, values: x.rows.map((r) => r.pay) }], fmt: (v) => won(v) });
      $('tables').innerHTML = table('월별 육아휴직 급여', ['기간', '적용', '지급률', '상한액', '받는 금액'], x.rows.map((r) => ({ cls: r.capped ? 'now' : '', cells: [r.m + '개월째', r.how, Math.round(r.rate * 100) + '%', won(r.cap), won(r.pay)] })));
    },
    homeacq() {
      const price = num('hprice'), homes = Number($('hhomes').value), adj = $('hadj').value === '1', small = $('harea').value === '1', fv = $('hfirst').value;
      const x = Calc.homeAcqTax(price, homes, adj, small, fv !== '0', fv === '2');
      const pct = (r) => String(Math.round(r * 10000) / 100) + '%';
      $('out').innerHTML = kpi([['총 납부 세액', won(x.total), 'main'], ['취득세 (' + pct(x.rate) + ')', won(x.acq)], ['지방교육세', won(x.edu)], ['농어촌특별세', small ? '비과세' : won(x.rural)], ['합계 세율', price ? pct(x.total / price) : '—']]) +
        (x.relief ? `<p class="note">생애최초 감면 ${won(x.relief)}을 뺐습니다. 3년 안에 팔거나 임대하면 추징됩니다.</p>` : fv !== '0' && !x.firstOk ? '<p class="note over">생애최초 감면은 처음 산 집(1주택)이 12억 원 이하일 때만 받을 수 있어 빼지 않았습니다.</p>' : '') +
        (x.heavy ? '<p class="note">다주택 중과세율입니다. 일시적 2주택이나 중과 제외 주택이면 1~3%가 될 수 있습니다.</p>' : '');
      Charts.bars($('chart'), { title: '세금 구성', horizontal: true, cats: ['취득세', '지방교육세', '농어촌특별세'], series: [{ label: '금액', color: S.p, values: [x.acq, x.edu, x.rural] }], fmt: (v) => won(v) });
      const row = (h, a, l) => { const y = Calc.homeAcqTax(price, h, a, small, false, false); return { cls: h === homes && (h === 1 || h === 4 || a === adj) ? 'now' : '', cells: [l, pct(y.rate), won(y.total)] }; };
      $('tables').innerHTML = table('주택 수·지역별 세금 (같은 집값, 감면 전)', ['경우', '취득세율', '총 납부 세액'], [row(1, false, '1주택'), row(2, false, '2주택 · 조정대상지역 아님'), row(2, true, '2주택 · 조정대상지역'), row(3, false, '3주택 · 조정대상지역 아님'), row(3, true, '3주택 · 조정대상지역'), row(4, false, '4주택 이상')]);
    },
    yearend() {
      const v = (id) => Math.max(0, num(id)), paidRaw = String($('ypaid').value).trim();
      const o = { pay: v('ypay'), paid: paidRaw === '' ? -1 : v('ypaid'), family: Math.max(1, Math.round(num('yfam'))), kidsAll: Math.round(v('ykids')), kidsCredit: Math.round(v('ykidc')), elder: Math.round(v('yold')), disabled: Math.round(v('ydis')),
        birth: Number($('ybirth').value), marry: $('ymarry').value === '1', credit: v('ycredit'), debit: v('ydebit'), market: v('ymarket'), transit: v('ytransit'), culture: v('yculture'),
        pensionSave: v('ysave'), irp: v('yirp'), houseOk: $('yhouse').value === '1', house: v('yhamt'), insure: v('yins'), medSelf: v('ymeds'), medOther: v('ymedo'), edu: v('yedu'), donate: v('ydon'), rent: v('yrent') };
      const x = Calc.yearEnd(o), back = x.refund >= 0;
      $('out').innerHTML = kpi([[back ? '예상 환급액' : '예상 추가 납부액', won(Math.abs(x.refund)), 'main'], ['결정세액 (소득세)', won(x.tax)], ['미리 낸 소득세', won(x.paid) + (x.paidEstimated ? ' (추정)' : '')], ['지방소득세 포함 결정세액', won(x.tax + x.local)]]) +
        '<p class="note">환급액은 소득세와 지방소득세(소득세의 10%)를 합친 금액입니다.</p>' +
        (x.paidEstimated ? '<p class="note over">미리 낸 소득세를 비워 두어 기본 공제만 반영한 세액으로 추정했습니다. 급여명세서의 소득세 1년 합계를 넣으면 더 정확합니다.</p>' : '') +
        (x.standard ? '<p class="note">보험료·의료비 등 공제보다 표준세액공제 13만 원이 더 유리해 표준세액공제로 계산했습니다.</p>' : '') +
        (o.kidsCredit > o.kidsAll ? '<p class="note over">2017년 이전에 태어난 자녀 수가 전체 자녀 수보다 많습니다.</p>' : '');
      const c = x.credits, L = [['근로소득세액공제', c.earned], ['자녀', c.kid], ['출산·입양', c.birth], ['결혼', c.marry], ['연금저축·IRP', c.pension], ['보험·의료·교육·기부', c.special], ['월세', c.rent], ['표준세액공제', c.standard]].filter((r) => r[1] > 0);
      Charts.bars($('chart'), { title: '세액공제 내역', horizontal: true, cats: L.map((r) => r[0]), series: [{ label: '공제액', color: S.p, values: L.map((r) => r[1]) }], fmt: (v) => won(v) });
      $('tables').innerHTML = table('계산 과정', ['단계', '금액'], [['총급여', won(x.g)], ['− 근로소득공제', won(x.earnDed)], ['− 인적공제', won(x.personal)], ['− 국민연금 (추정)', won(x.pension)], ...(x.standard ? [] : [['− 건강·고용보험 (추정)', won(x.ins)]]),
        ['− 신용카드 등 공제', won(x.card.ded)], ...(x.house ? [['− 주택청약 공제', won(x.house)]] : []), { cls: 'now', cells: ['= 과세표준', won(x.base)] }, ['산출세액', won(x.calc)], ['− 세액공제 합계', won(x.creditSum)], { cls: 'now', cells: ['= 결정세액', won(x.tax)] }]) +
        table('신용카드 등 공제', ['항목', '금액'], [['사용액 합계', won(x.card.used)], ['공제 문턱 (총급여 25%)', won(x.card.min)], ['기본 공제 (한도 ' + won(x.card.lim) + ')', won(x.card.basic)], ['추가 공제 (전통시장·대중교통 등)', won(x.card.extra)]]);
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

    // ── 건축·토목 ──
    areavol() {
      const sh = $('shape').value; showFor([sh]);
      const solid = ['box', 'cyl', 'cone', 'frustum', 'pfrustum', 'sphere'].includes(sh);
      const n = (id) => Math.max(0, num(id));
      const nf = (v, d = 3) => (Number.isFinite(v) ? (+v.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d }) : '—');
      $('tables').innerHTML = '';
      if (solid) {
        const x = Calc.solidVolume(sh, { w: n('w'), l: n('l'), h: sh === 'box' ? n('bh') : sh === 'frustum' ? n('fh') : sh === 'pfrustum' ? n('ph') : n('ch'), d: n('d'), d1: n('d1'), d2: n('d2'), a1: n('a1'), a2: n('a2') });
        const sv = { w: n('w'), l: n('l'), h: sh === 'box' ? n('bh') : sh === 'frustum' ? n('fh') : sh === 'pfrustum' ? n('ph') : n('ch'), d: n('d'), d1: n('d1'), d2: n('d2'), a1: n('a1'), a2: n('a2') };
        $('chart').innerHTML = Number.isFinite(x.vol) && x.vol > 0 && window.Diagram ? Diagram.solid(sh, sv) : '';
        $('out').innerHTML = kpi([['부피', nf(x.vol) + '㎥', 'main'], ['리터', nf(x.liter, 1) + 'L'], ['콘크리트로 채우면', '<a href="/materials/">자재 물량 계산기 →</a>']]);
        return;
      }
      const v = { w: n('w'), h: n('h'), base: n('base'), height: n('height'), a: n('sa'), b: n('sb'), c: n('sc'), top: n('top'), bottom: n('bottom'), th: n('th'), d: n('d'), r: n('r'), angle: Math.min(360, n('angle')), ea: n('ea'), eb: n('eb'), pts: Calc.parsePts($('pts').value) };
      const x = Calc.shapeArea(sh, v);
      if (x.err) { $('out').innerHTML = `<p class="note over">${x.err}</p>`; $('chart').innerHTML = ''; return; }
      $('chart').innerHTML = x.area > 0 && window.Diagram ? Diagram.shape(sh, v) : '';
      $('out').innerHTML = kpi([['면적', nf(x.area) + '㎡', 'main'], ['평', nf(x.pyeong, 2) + '평'], ['둘레', Number.isFinite(x.perim) ? nf(x.perim) + 'm' + (sh === 'ellipse' ? ' (근사)' : '') : '—'], ['cm²', nf(x.area * 1e4, 0) + 'cm²']]) +
        (sh === 'poly' ? `<p class="note">꼭짓점 ${v.pts.length}개로 계산했습니다. 변이 서로 교차하지 않게 둘레 순서대로 넣어야 정확합니다.</p>` : '');
    },
    materials() {
      const mat = $('mat').value, ck = $('ckind').value; showFor([mat, mat + ':' + ck]);
      const n = (id) => Math.max(0, num(id)), nf = (v, d = 3) => (+v.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d });
      $('chart').innerHTML = '';
      if (mat === 'concrete') {
        const x = Calc.concrete(ck, { w: n('cw'), l: ck === 'wall' ? n('wl') : n('cl'), t: n('ct'), h: ck === 'colRound' ? n('rh') : ck === 'wall' ? n('wh') : n('ch'), d: n('cd') }, Math.round(n('cn')), $('closs').value, n('truck'));
        $('out').innerHTML = kpi([['주문량 (할증 포함)', nf(x.order, 2) + '㎥', 'main'], ['정미 물량', nf(x.net, 3) + '㎥'], ['할증', (x.rate * 100) + '%'], ['1개 체적', nf(x.one, 3) + '㎥'], ...(n('truck') ? [['레미콘 차', x.trucks + '대 (' + n('truck') + '㎥ 기준)']] : [])]);
        const cv = { w: n('cw'), l: ck === 'wall' ? n('wl') : n('cl'), t: n('ct'), h: ck === 'colRound' ? n('rh') : ck === 'wall' ? n('wh') : n('ch'), d: n('cd') };
        if (window.Diagram && x.one > 0) $('chart').innerHTML = Diagram.concrete(ck, cv) + Diagram.trucks(x.order, n('truck'));
        $('tables').innerHTML = table('같은 물량의 할증별 주문량 (표준품셈)', ['구분', '할증', '주문량'], [['rebar', '레미콘 · 철근·철골 구조물'], ['plain', '레미콘 · 무근 구조물'], ['mixRebar', '현장 혼합 · 철근 구조물'], ['mixPlain', '현장 혼합 · 무근 구조물']].map(([k, l]) => ({ cls: k === $('closs').value ? 'now' : '', cells: [l, Calc.CONC_LOSS[k] * 100 + '%', nf(x.net * (1 + Calc.CONC_LOSS[k]), 2) + '㎥'] })));
      } else if (mat === 'rebar') {
        const x = Calc.rebar($('rb').value, n('rlen'), Math.round(n('rcnt')), +$('rloss').value);
        $('out').innerHTML = kpi([['주문 중량 (할증 포함)', nf(x.order / 1000, 3) + '톤', 'main'], ['정미 중량', nf(x.net, 1) + 'kg'], ['총 길이', nf(x.totalLen, 1) + 'm'], ['단위무게', x.unit + 'kg/m'], ['공칭지름', x.dia + 'mm']]);
        if (window.Diagram) $('chart').innerHTML = Diagram.rebars(Calc.REBAR, $('rb').value);
        $('tables').innerHTML = table('이형철근 단위무게 (KS D 3504)', ['호칭', '공칭지름', '공칭단면적', '단위무게', '1톤당 길이'], Calc.REBAR.map(([nm, d, a, w]) => ({ cls: nm === $('rb').value ? 'now' : '', cells: [nm, d + 'mm', a + 'mm²', w + 'kg/m', nf(1000 / w, 0) + 'm'] })));
      } else {
        const x = Calc.brick(n('bw') * n('bh'), n('bopen'), $('bt').value, +$('bloss').value);
        $('out').innerHTML = kpi([['주문 매수 (할증 포함)', x.order.toLocaleString('ko-KR') + '매', 'main'], ['정미 매수', x.net.toLocaleString('ko-KR') + '매'], ['쌓을 면적', nf(x.area, 2) + '㎡'], ['㎡당', x.perM2 + '매']]) +
          (n('bopen') > n('bw') * n('bh') ? '<p class="note over">문·창 면적이 벽 면적보다 큽니다.</p>' : '');
        if (window.Diagram) $('chart').innerHTML = Diagram.wall(n('bw'), n('bh'), n('bopen'));
        $('tables').innerHTML = table('쌓기 두께별 매수 (표준형 190×90×57, 줄눈 10mm)', ['두께', '㎡당', '이 벽 정미', '주문 (할증)'], Object.keys(Calc.BRICK).map((t) => { const y = Calc.brick(n('bw') * n('bh'), n('bopen'), t, +$('bloss').value); return { cls: t === $('bt').value ? 'now' : '', cells: [t, y.perM2 + '매', y.net.toLocaleString('ko-KR') + '매', y.order.toLocaleString('ko-KR') + '매'] }; }));
      }
    },
    slope() {
      const mode = $('smode').value; showFor([mode]);
      const n = (id) => Math.max(0, num(id)), nf = (v, d = 2) => (Number.isFinite(v) ? (+v.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d }) : '—');
      let g = NaN, run = n('run2');
      if (mode === 'rr') { run = n('run'); g = run > 0 ? n('rise') / run : NaN; }
      else if (mode === 'pct') g = n('pct') / 100;
      else if (mode === 'deg') g = n('deg') < 90 ? Math.tan(n('deg') * Math.PI / 180) : NaN;
      else if (mode === 'ratio') g = n('ratio') > 0 ? 1 / n('ratio') : NaN;
      else g = n('chi') / 10;
      $('chart').innerHTML = '';
      if (!Number.isFinite(g)) { $('out').innerHTML = '<p class="note over">값을 확인해 주세요. 수평거리·n은 0보다 커야 하고, 각도는 90° 미만이어야 합니다.</p>'; $('tables').innerHTML = ''; return; }
      const x = Calc.slope(g, run), ok = (b) => (b ? '✔ 충족' : '✕ 초과');
      $('chart').innerHTML = window.Diagram && g > 0 && g <= 20 ? Diagram.slope(g, run) : '';
      $('out').innerHTML = kpi([['경사 퍼센트', nf(x.pct, 2) + '%', 'main'], ['각도', nf(x.deg, 2) + '°'], ['비율', g > 0 ? '1 : ' + nf(x.n, 2) : '수평'], ['지붕 물매', nf(x.chi, 2) + '치'], ...(run > 0 ? [['높이', nf(x.rise, 3) + 'm'], ['경사 길이', nf(x.len, 3) + 'm']] : [])]);
      $('tables').innerHTML = table('경사로 기준 확인', ['기준', '허용 기울기', '이 경사'], [['장애인 경사로 (편의시설 세부기준)', '1/12 (8.33%) 이하', ok(x.ramp12)], ['장애인 경사로 · 요건 충족 시 완화', '1/8 (12.5%) 이하', ok(x.ramp8)], ['계단 대체 경사로 (건축물방화구조규칙 제15조)', '1 : 8 (12.5%) 이하', ok(x.ramp8)]]) +
        table('자주 쓰는 구배 환산표', ['퍼센트', '각도', '1 : n', '물매'], [0.01, 0.02, 0.05, 1 / 12, 0.1, 0.125, 0.2, 0.3, 0.4, 0.5, 1].map((v) => { const y = Calc.slope(v, 0); return { cls: Math.abs(v - g) < 1e-9 ? 'now' : '', cells: [nf(y.pct, 2) + '%', nf(y.deg, 2) + '°', '1 : ' + nf(y.n, 2), nf(y.chi, 2) + '치'] }; }));
    },
    stairs() {
      const H = Math.max(0, num('H')), tg = Math.max(1, num('target')), T = Math.max(1, num('tread')), use = $('use').value;
      $('chart').innerHTML = '';
      if (!H) { $('out').innerHTML = '<p class="note over">층고를 넣어 주세요.</p>'; $('tables').innerHTML = ''; return; }
      const x = Calc.stairs(H, tg, T), rule = Calc.STAIR_RULE[use], mm = (v) => (+v.toFixed(1)).toLocaleString('ko-KR') + 'mm';
      $('chart').innerHTML = window.Diagram ? Diagram.stairs(x.n, x.R, T, H) : '';
      $('out').innerHTML = kpi([['단 수', x.n + '단', 'main'], ['실제 단높이', mm(x.R)], ['디딤판 수', x.treads + '개'], ['계단 수평 길이', mm(x.run)], ['경사각', (+x.deg.toFixed(1)) + '°'], ['2R + T', mm(x.blondel)]]) +
        (rule ? `<p class="note ${x.R <= rule[0] + 1e-9 && T >= rule[1] ? '' : 'over'}">법정 기준(단높이 ${rule[0] / 10}cm 이하·단너비 ${rule[1] / 10}cm 이상): 단높이 ${x.R <= rule[0] + 1e-9 ? '충족' : '초과'}, 단너비 ${T >= rule[1] ? '충족' : '부족'}.</p>` : '<p class="note">이 용도는 단높이·단너비 수치 기준이 없습니다. 계단참·난간·유효너비 기준은 지켜야 합니다.</p>') +
        (x.blondel < 600 || x.blondel > 650 ? `<p class="note">2R + T가 ${mm(x.blondel)}로 걷기 편한 범위(600~650mm, 설계 관례)를 벗어납니다.</p>` : '') +
        (x.landing ? '<p class="note">높이 3m를 넘으므로 3m 이내마다 유효너비 120cm 이상의 계단참이 필요합니다(건축물방화구조규칙 제15조 제1항).</p>' : '');
      $('tables').innerHTML = table('단 수별 단높이 (같은 층고)', ['단 수', '단높이', '계단 길이 (단너비 ' + T + 'mm)', '2R + T'], [-2, -1, 0, 1, 2].map((k) => x.n + k).filter((k) => k >= 1).map((k) => ({ cls: k === x.n ? 'now' : '', cells: [k + '단', mm(H / k), mm((k - 1) * T), mm(2 * H / k + T)] })));
    },
    earthwork() {
      const A = [], D = [];
      for (let i = 1; i <= 5; i++) { const raw = $('A' + i).value; if (raw === '') break; A.push(Math.max(0, num('A' + i))); if (i > 1) D.push(Math.max(0, num('L' + (i - 1)))); }
      const nf = (v, d = 2) => (+v.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d });
      if (A.length < 2) { $('out').innerHTML = '<p class="note over">측점을 2개 이상 넣어 주세요(위에서부터 차례대로).</p>'; $('chart').innerHTML = ''; $('tables').innerHTML = ''; return; }
      const x = Calc.earthwork(A, D, Math.max(0, num('kL')), Math.max(0, num('kC'))), dump = Math.max(0, num('dump'));
      $('out').innerHTML = kpi([['토공량 (자연 상태)', nf(x.vol) + '㎥', 'main'], ['흐트러진 상태 (운반량)', nf(x.loose) + '㎥'], ['다져진 상태', nf(x.compact) + '㎥'], ...(dump ? [['덤프트럭', Math.ceil(x.loose / dump - 1e-9) + '대']] : [])]) +
        (D.some((d) => d === 0) ? '<p class="note over">거리가 0인 구간이 있습니다.</p>' : '');
      $('chart').innerHTML = window.Diagram ? Diagram.earth(A, D) : '';
      $('tables').innerHTML = table('구간별 계산 (양단면 평균법)', ['구간', '평균 단면적', '거리', '토량'], x.segs.map((v, i) => [`측점 ${i + 1}~${i + 2}`, nf((A[i] + A[i + 1]) / 2) + '㎡', nf(D[i]) + 'm', nf(v) + '㎥']));
    },
    unitconv() {
      const k = $('ukind').value; showFor([k]);
      const from = $('ufrom-' + k).value, val = num('uval');
      const fmt = (v) => { if (v === 0) return '0'; const a = Math.abs(v); return a >= 1e-4 && a < 1e12 ? (+v.toPrecision(8)).toLocaleString('ko-KR', { maximumFractionDigits: 8 }) : v.toExponential(6); };
      const rows = Calc.convert(k, val, from);
      // 위쪽 카드: 현장에서 흔히 찾는 단위부터 (MPa → kgf/cm², 평 ↔ ㎡ 등)
      const PREF = { len: ['m', 'mm', 'ft', '자(尺)', 'in'], area: ['평', '㎡', 'ha', 'ft²'], vol: ['L', '㎥(루베)', 'ft³'], force: ['kN', 'tf', 'kgf', 'N'], press: ['kgf/cm²', 'MPa', 'kPa', 'psi'] }[k];
      const top = [...PREF, ...rows.map(([u]) => u)].filter((u, i, a) => u !== from && a.indexOf(u) === i).slice(0, 4);
      $('out').innerHTML = kpi(top.map((u, i) => [u, fmt(rows.find((r) => r[0] === u)[1]), i === 0 ? 'main' : '']));
      $('chart').innerHTML = '';
      $('tables').innerHTML = table(`${fmt(val)} ${from} 환산표`, ['단위', '값'], rows.map(([u, v]) => ({ cls: u === from ? 'now' : '', cells: [u, fmt(v)] })));
    },
    fc() {
      const pc = $('fpc').checked, top = $('ftop').checked, K = Calc.korBP, P = Calc.parseBP;
      const n = Math.min(10, Math.max(1, Math.round(num('fcn')) || 1)); $('fcn').value = n;
      qsa('.fc-row').forEach((r) => { r.hidden = +r.dataset.row > n; });
      const cp = (sid, xid) => ($(sid).value === 'x' ? Math.max(0, Math.min(100, num(xid))) : Number($(sid).value));
      const tok = []; for (let i = 1; i <= n; i++) if ($('fcc' + i).value === 'x') tok.push('cx' + i); showFor(tok);
      qsa('[data-bp]').forEach((e) => { const h = $(e.id + '-k'); if (h) { const v = P(e.value); h.textContent = v ? K(v) + ' BP' : ''; } });
      const N = pc && top ? 50 : pc ? 30 : top ? 20 : 0, CASES = [['할인 없음', 0, 0], ['프리미엄 PC방', 1, 0], ['TOP CLASS', 0, 1], ['PC방 + TOP CLASS', 1, 1]];
      const pct = (a, b) => (b ? (Number(a * 100000n / b) / 1000).toFixed(2) + '%' : '0%');
      $('chart').innerHTML = '';
      // 전체 판매 금액 = 쿠폰 쓴 선수들 + 나머지(쿠폰 없음). 선수 칸은 전체 금액 안에서 쿠폰을 따로 적용할 몫
      const players = Array.from({ length: n }, (_, k) => ({ no: k + 1, price: P($('fcp' + (k + 1)).value), coupon: cp('fcc' + (k + 1), 'fcx' + (k + 1)), cap: P($('fcm' + (k + 1)).value) })).filter((r) => r.price > 0n);
      const total = P($('ftot').value), sum = players.reduce((a, r) => a + r.price, 0n), rest = total > sum ? total - sum : 0n;
      const rows = [...players, ...(rest ? [{ price: rest, coupon: 0, cap: 0n }] : [])], names = [...players.map((r) => '쿠폰 사용 선수 ' + r.no), ...(rest ? [players.length ? '나머지 (쿠폰 없음)' : '전체 (쿠폰 없음)'] : [])];
      const x = Calc.fcFee(rows, pc, top);
      if (!x.gross) { $('out').innerHTML = '<p class="note">전체 판매 금액을 넣어 주세요.</p>'; $('tables').innerHTML = ''; return; }
      const overSum = sum > total;
      const over = rows.some((r) => r.coupon + N > 100), capped = x.each.some((e) => e.capped);
      $('out').innerHTML = kpi([['받는 BP', K(x.receive) + ' BP', 'main'], ['판매 금액 합계', K(x.gross)], ['기본 수수료 40%', '−' + K(x.base)], [`PC방·TOP CLASS 할인 ${N}%`, '+' + K(x.disc)], ['쿠폰 할인', '+' + K(x.coupon)], ['최종 수수료', '−' + K(x.final)], ['실제 수수료율', pct(x.final, x.gross)]]) +
        `<p class="note">숫자로: ${x.receive.toLocaleString('ko-KR')} BP</p>` +
        (overSum ? `<p class="note over">선수 판매 금액의 합(${K(sum)})이 전체 판매 금액${total ? '(' + K(total) + ')' : ''}보다 커서, 선수 금액의 합을 전체 판매 금액으로 계산했습니다.</p>` : '') +
        (over ? `<p class="note">쿠폰과 기본 할인을 합쳐 100%를 넘는 쿠폰은 ${100 - N}%까지만 적용했습니다.</p>` : '') +
        (capped ? '<p class="note over">최대 할인 금액에 걸린 쿠폰이 있습니다. 아래 선수별 내역을 확인하세요.</p>' : '');
      if (x.final > 0n || x.receive > 0n) Charts.bars($('chart'), { title: '판매 금액이 나뉘는 모습', horizontal: true, cats: ['판매 금액'], series: [{ label: '받는 BP', color: S.p, values: [Number(x.receive)] }, { label: '최종 수수료', color: S.i, values: [Number(x.final)] }], fmt: (v) => K(BigInt(Math.round(v))) });
      const noCp = Calc.fcFee(rows.map((r) => ({ ...r, coupon: 0 })), pc, top);
      $('tables').innerHTML = (players.length ? table('선수별 내역', ['선수', '판매 금액', '쿠폰', '쿠폰 할인', '받는 BP'], x.each.map((e, i) => ({ cls: e.capped ? 'now' : '', cells: [names[i], K(e.amt), e.I ? e.I + '%' : '—', e.capped ? `${K(e.coupon)} (한도, 원래 ${K(e.couponRaw)})` : K(e.coupon), K(e.receive)] }))) : '') +
        table('할인 조건별로 받는 BP', ['조건', '기본 할인', '최종 수수료', '받는 BP'], [...CASES.map(([l, a, b]) => { const y = Calc.fcFee(rows, a, b); return { cls: !!a === pc && !!b === top ? 'now' : '', cells: [l + (!!a === pc && !!b === top ? ' (지금)' : ''), y.N + '%', K(y.final), K(y.receive)] }; }),
          ...(x.coupon ? [['쿠폰 효과 (지금 조건)', '—', '−' + K(x.coupon), '+' + K(x.receive - noCp.receive)]] : [])]);
    },
    photo() {
      const mode = $('pmode').value, ref = $('pref').value, K = Calc.korBP;
      showFor([mode, 'm-' + ref]);
      qsa('[data-bp]').forEach((e) => { const h = $(e.id + '-k'); if (h) { const v = Calc.parseBP(e.value); h.textContent = v ? K(v) + ' BP' : ''; } });
      const P = window.PhotoCalc; if (P) P.sync(mode);
      $('chart').innerHTML = ''; $('tables').innerHTML = '';
      const empty = (t) => { $('out').innerHTML = `<p class="note">${t}</p>`; };
      const nf = (v, d = 2) => (+v.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d });
      const ask = '이미지를 첨부하면 값을 찾아 넣어 드립니다. 직접 입력해도 됩니다.';
      if (mode === 'receipt') {
        const t = num('ptotal'), n = Math.max(1, Math.round(num('ppeople')) || 1), u = Number($('punit').value);
        if (!t) return empty(ask);
        const each = Math.ceil(t / n / u - 1e-9) * u;
        $('out').innerHTML = kpi([['1인당', won(each), 'main'], ['모이는 돈', won(each * n)], ['남는 돈', won(each * n - t)], ['정확히 나누면', (t / n).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '원']]);
        $('tables').innerHTML = table('끝자리 단위별 1인당 금액', ['단위', '1인당', '남는 돈'], [1, 10, 100, 1000].map((v) => { const e2 = Math.ceil(t / n / v - 1e-9) * v; return { cls: v === u ? 'now' : '', cells: [v.toLocaleString('ko-KR') + '원', won(e2), won(e2 * n - t)] }; }));
      } else if (mode === 'vat') {
        const t = num('pvat'); if (!t) return empty(ask);
        const x = Calc.vat(t, 'total');
        $('out').innerHTML = kpi([['공급가액', won(x.supply), 'main'], ['부가세 10%', won(x.tax)], ['합계', won(x.total)]]) + '<p class="note">공급가액 = 합계 ÷ 1.1 (원 미만 반올림) — <a href="/vat/">부가세 계산기</a>와 같은 방식입니다.</p>';
      } else if (mode === 'discount') {
        const p = num('pprice'), r = Math.min(100, Math.max(0, num('prate'))); if (!p) return empty(ask);
        const sale = Math.round(p * (1 - r / 100));
        $('out').innerHTML = kpi([['할인가', won(sale), 'main'], ['할인 금액', won(p - sale)], ['원래 가격', won(p)], ['할인율', nf(r, 1) + '%']]) + (r ? '' : '<p class="note">할인율을 찾지 못했으면 직접 넣어 주세요.</p>');
        $('tables').innerHTML = table('할인율별 가격', ['할인율', '할인가', '할인 금액'], [10, 20, 30, 40, 50, 70].map((v) => ({ cls: v === r ? 'now' : '', cells: [v + '%', won(Math.round(p * (1 - v / 100))), won(p - Math.round(p * (1 - v / 100)))] })));
      } else if (mode === 'elec') {
        const k = Math.max(0, num('pkwh')); if (!k) return empty('전기요금 고지서나 한전ON 화면을 첨부하면 사용량(kWh)을 찾아 넣어 드립니다. 직접 입력해도 됩니다.');
        const x = Calc.electricity(k, $('pseason').value === 'summer', 9, 5);
        $('out').innerHTML = kpi([['청구 예상액', won(x.total), 'main'], ['기본요금', won(x.basic)], ['전력량요금', won(x.energy)], ['누진 단계', x.step + '단계']]) + '<p class="note">주택용 저압 기준, 기후환경요금 kWh당 9원·연료비조정 +5원으로 계산했습니다. 단가를 바꾸려면 <a href="/electricity/">전기요금 계산기</a>에서 하세요.</p>';
      } else if (mode === 'fc') {
        const p = Calc.parseBP($('pbp').value); if (!p) return empty('이적시장 화면을 첨부하면 판매 금액을 찾아 넣어 드립니다. 직접 입력해도 됩니다.');
        const x = Calc.fcFee([{ price: p }], $('ppc').checked, $('ptop').checked);
        $('out').innerHTML = kpi([['받는 BP', K(x.receive) + ' BP', 'main'], ['최종 수수료', '−' + K(x.final)], [`할인 ${x.N}%`, '+' + K(x.disc)]]) + '<p class="note">쿠폰·선수별 쿠폰 계산은 <a href="/fc-transfer/">FC 온라인 이적시장 수수료 계산기</a>에서 할 수 있습니다.</p>';
      } else if (mode === 'text') {
        const t = $('ptext').value; if (!t.trim()) return empty('글이 담긴 이미지(캡처)를 첨부하면 글을 읽어 글자 수를 셉니다.');
        const x = Calc.charCount(t);
        $('out').innerHTML = kpi([['공백 포함', x.withSpace.toLocaleString('ko-KR') + '자', 'main'], ['공백 제외', x.noSpace.toLocaleString('ko-KR') + '자'], ['줄 수', x.lines + '줄'], ['단어 수', x.words + '개'], ['바이트 (한글 2)', x.euckr.toLocaleString('ko-KR')]]) + '<p class="note">글자 인식은 띄어쓰기를 틀리기 쉬워 "공백 제외"가 더 정확합니다. 읽은 글은 칸에서 고칠 수 있습니다.</p>';
      } else if (mode === 'dday') {
        const d = $('pdate').value; if (!d) return empty('날짜가 보이는 이미지(유통기한·예약·공연 티켓 등)를 첨부하면 날짜를 찾아 넣어 드립니다.');
        const x = Calc.dday(today(), d), dd = x.diff;
        $('out').innerHTML = kpi([[dd > 0 ? '남은 날' : dd < 0 ? '지난 날' : '오늘', dd > 0 ? 'D-' + dd : dd < 0 ? 'D+' + -dd : 'D-Day', 'main'], ['날짜', d], ['오늘', today()]]);
      } else {
        const r = P ? P.measure(mode === 'slope' ? 'slope' : ref, ref === 'line' ? [num('prl')] : [num('prw'), num('prh')]) : { msg: '이미지를 첨부해 주세요.' };
        if (!r.ok) return empty(r.msg);
        if (mode === 'slope') {
          const y = Calc.slope(r.g, 0);
          $('out').innerHTML = kpi([['경사 각도', nf(y.deg) + '°', 'main'], ['경사 퍼센트', nf(y.pct) + '%'], ['비율', r.g > 0 ? '1 : ' + nf(y.n) : '수평'], ['지붕 물매', nf(y.chi) + '치']]) + '<p class="note">이미지 가로선 기준입니다. 카메라를 수평으로 두고 옆에서(정면으로) 찍어야 정확합니다. 기준 확인은 <a href="/slope/">경사도·구배 계산기</a>에서 하세요.</p>';
          return;
        }
        $('out').innerHTML = (r.area != null ? kpi([['면적', nf(r.area) + '㎡', 'main'], ['평', nf(r.area / Calc.PY) + '평'], ['둘레', nf(r.perim) + 'm'], ['꼭짓점', r.sides.length + '개']]) : kpi([['길이', nf(r.len, 3) + 'm', 'main'], ['cm', nf(r.len * 100, 1) + 'cm']])) + (r.note ? `<p class="note">${r.note}</p>` : '');
        if (r.sides.length > 1) $('tables').innerHTML = table('변 길이', ['변', '길이'], r.sides.map((v, i) => [`${i + 1}번 → ${i + 2 > r.sides.length ? 1 : i + 2}번 점`, nf(v, 3) + 'm']));
      }
    },
  };


  // FC 이적시장: + 선수 추가 / 빼기 — 줄은 미리 10개 만들어 두고 #fcn(보이는 줄 수)만 바꾼다
  if (page === 'fc-transfer') {
    const fire = () => $('fcn').dispatchEvent(new Event('input', { bubbles: true }));
    const KEYS = ['fcp', 'fcc', 'fcx', 'fcm'];
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-fc-add]')) {
        const n = Math.round(Number($('fcn').value)) || 1; if (n >= 10) { toast('선수는 10명까지 넣을 수 있어요'); return; }
        $('fcn').value = n + 1; fire(); const inp = $('fcp' + (n + 1)); if (inp) inp.focus();
      }
      const d = e.target.closest('[data-fc-del]'); if (!d) return;
      const k = +d.dataset.fcDel, n = Math.round(Number($('fcn').value)) || 1;
      for (let i = k; i < n; i++) KEYS.forEach((p) => { $(p + i).value = $(p + (i + 1)).value; });
      KEYS.forEach((p) => { const el = $(p + n); el.value = p === 'fcc' ? '0' : p === 'fcx' ? '10' : ''; });
      $('fcn').value = Math.max(1, n - 1); fire(); toast(`쿠폰 사용 선수 ${k}을(를) 뺐어요`);
    });
  }

  // ── 9. 입력값 저장·복원·공유·초기화 ──
  const calcEl = qs('[data-calc]'), kind = calcEl && calcEl.dataset.calc;
  const SKEY = 'in-' + kind + ({ fc: '-v2' }[kind] || ''); // 입력 구조가 바뀐 계산기는 예전 저장값(옛 기본값 등)을 버린다
  const fields = calcEl ? qsa('input,select,textarea', calcEl).filter((e) => e.id && !['expr'].includes(e.id) && e.type !== 'file') : [];
  const saved = fields.filter((e) => e.dataset.nosave === undefined); // 글자 수 세기 본문 등은 저장·공유 제외
  // 체크박스는 checked 를 '1'/'' 로 저장·복원 (FC 이적시장 PC방·TOP CLASS 등)
  const val = (e) => (e.type === 'checkbox' ? (e.checked ? '1' : '') : e.value);
  const setVal = (e, v) => { if (e.type === 'checkbox') e.checked = v === '1' || v === true; else e.value = v; };
  const defaults = Object.fromEntries(fields.map((e) => [e.id, val(e)]));
  const snapshot = () => Object.fromEntries(saved.map((e) => [e.id, val(e)]));
  const apply = (vals) => fields.forEach((e) => { if (vals[e.id] !== undefined) setVal(e, vals[e.id]); if (e.dataset.money !== undefined) e.dispatchEvent(new Event('input')); });
  const params = new URLSearchParams(location.search);
  if (kind && run[kind]) {
    if ([...params.keys()].some((k) => defaults[k] !== undefined)) apply(Object.fromEntries(params)); else apply(store.get(SKEY, {}));
  }
  let saveT = null, annT = null;
  const announce = () => { const k = qs('.kpi.main'), s = $('sr-status'); if (k && s) s.textContent = qs('span', k).textContent + ' ' + qs('b', k).textContent; const mini = qs('[data-mini]'); if (k && mini) { qs('span', mini).textContent = qs('span', k).textContent; qs('b', mini).textContent = qs('b', k).textContent; } };
  function rerender(e) {
    if (!kind || !run[kind]) return;
    try { run[kind](e); } catch (err) { console.error(err); }
    clearTimeout(saveT); saveT = setTimeout(() => store.set(SKEY, snapshot()), 400);
    clearTimeout(annT); annT = setTimeout(announce, 600);
  }
  if (kind && run[kind]) {
    addEventListener('pagehide', () => { clearTimeout(saveT); store.set(SKEY, snapshot()); }); // 바로 새로고침·이동해도 마지막 입력값 저장
    fields.forEach((e) => { e.addEventListener('input', rerender); if (e.type === 'checkbox' || e.tagName === 'SELECT') e.addEventListener('change', rerender); });
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
  qsa('[data-reset]').forEach((b) => b.addEventListener('click', () => { apply(defaults); store.del(SKEY); history.replaceState(null, '', location.pathname); rerender(); toast('처음 값으로 돌렸어요'); }));
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
