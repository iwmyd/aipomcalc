/* 인라인 SVG 차트 — 의존성 없음. dataviz 스킬 규칙: 얇은 마크, 2px 선, 막대 사이 2px 간격, 끝 4px 라운드,
 * 2개 이상 시리즈면 범례, 호버 툴팁(선·영역: 크로스헤어 / 막대: 막대별), 색은 시리즈 의미로 고정(--s-*). */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let W = 720, H = 260; const M = { t: 16, r: 16, b: 30, l: 60 };
  const css = (v) => getComputedStyle(document.body).getPropertyValue(v).trim() || v; // tone 은 body 에 정의됨
  const short = (v) => { const a = Math.abs(v); if (a >= 1e8) return (v / 1e8).toFixed(a >= 1e9 ? 0 : 1).replace(/\.0$/, '') + '억'; if (a >= 1e4) return Math.round(v / 1e4).toLocaleString('ko-KR') + '만'; return Math.round(v).toLocaleString('ko-KR'); };
  const won = (v) => Math.round(v).toLocaleString('ko-KR') + '원';
  const niceMax = (m) => { if (m <= 0) return 1; const raw = m / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => x >= n - 1e-9) * p; return step * 4; }; // 4칸 눈금이 깔끔한 수가 되도록
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  function frame(host, title, legend, h) {
    host.innerHTML = '';
    W = Math.max(300, Math.round(host.clientWidth || 720)); H = h || (W < 520 ? 230 : 270); // 화면 폭에 맞춰 그려 글자 크기 유지
    const wrap = document.createElement('div'); wrap.className = 'chart-wrap';
    if (title) { const h = document.createElement('h3'); h.textContent = title; host.appendChild(h); }
    if (legend && legend.length > 1) {
      const lg = document.createElement('div'); lg.className = 'legend';
      lg.innerHTML = legend.map((s) => `<span><i style="background:${css(s.color)}"></i>${s.label}</span>`).join('');
      host.appendChild(lg);
    }
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title || '차트' });
    wrap.appendChild(svg); host.appendChild(wrap);
    const tip = document.createElement('div'); tip.className = 'ctip'; tip.hidden = true; wrap.appendChild(tip);
    return { svg, tip, wrap };
  }
  function yAxis(svg, max, fmt) {
    const g = el('g', { class: 'grid' }, svg), a = el('g', { class: 'axis' }, svg);
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i, y = M.t + (H - M.t - M.b) * (1 - i / 4);
      el('line', { x1: M.l, x2: W - M.r, y1: y, y2: y }, g);
      const t = el('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end' }, a); t.textContent = (fmt || short)(v);
    }
  }
  const tipAt = (tip, wrap, x, y, html) => { const r = wrap.getBoundingClientRect(); tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(Math.max((x / W) * r.width, 70), r.width - 70) + 'px'; tip.style.top = (y / H) * r.height + 'px'; };

  /** 누적 영역(시간 흐름). opt: { title, x: [라벨], series: [{label, color, values}], xLabel(i) } */
  function area(host, opt) {
    M.l = 60;
    const { svg, tip, wrap } = frame(host, opt.title, opt.series);
    const n = opt.x.length, tot = opt.x.map((_, i) => opt.series.reduce((s, se) => s + se.values[i], 0));
    const max = niceMax(Math.max(...tot)), iw = W - M.l - M.r, ih = H - M.t - M.b;
    const X = (i) => M.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1)), Y = (v) => M.t + ih * (1 - v / max);
    yAxis(svg, max);
    let base = new Array(n).fill(0);
    for (const s of opt.series) {
      const top = base.map((b, i) => b + s.values[i]);
      const d = `M${X(0)},${Y(top[0])}` + top.map((v, i) => `L${X(i)},${Y(v)}`).join('') + base.map((b, i) => `L${X(n - 1 - i)},${Y(base[n - 1 - i])}`).join('') + 'Z';
      el('path', { d, fill: css(s.color), 'fill-opacity': 0.22 }, svg);
      el('path', { d: `M${X(0)},${Y(top[0])}` + top.map((v, i) => `L${X(i)},${Y(v)}`).join(''), fill: 'none', stroke: css(s.color), 'stroke-width': 2 }, svg);
      base = top;
    }
    const ax = el('g', { class: 'axis' }, svg), step = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += step) { const t = el('text', { x: X(i), y: H - 8, 'text-anchor': 'middle' }, ax); t.textContent = opt.xLabel ? opt.xLabel(i) : opt.x[i]; }
    // 크로스헤어 + 툴팁
    const cross = el('line', { class: 'cross', y1: M.t, y2: H - M.b, visibility: 'hidden' }, svg);
    const dot = el('circle', { r: 5, fill: css(opt.series[opt.series.length - 1].color), stroke: css('--card'), 'stroke-width': 2, visibility: 'hidden' }, svg);
    const hit = el('rect', { x: M.l, y: M.t, width: iw, height: ih, fill: 'transparent' }, svg);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / iw) * (n - 1))));
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', X(i)); dot.setAttribute('cy', Y(tot[i])); dot.setAttribute('visibility', 'visible');
      tipAt(tip, wrap, X(i), Y(tot[i]), `<div>${opt.xLabel ? opt.xLabel(i) : opt.x[i]}</div>` + opt.series.map((s) => `<div>${s.label} <b>${won(s.values[i])}</b></div>`).join('') + (opt.series.length > 1 ? `<div>합계 <b>${won(tot[i])}</b></div>` : ''));
    };
    const leave = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    hit.addEventListener('mousemove', move); hit.addEventListener('touchstart', move, { passive: true }); hit.addEventListener('touchmove', move, { passive: true }); hit.addEventListener('mouseleave', leave);
  }

  /** 누적 막대. opt: { title, cats: [라벨], series: [{label, color, values}], horizontal?, fmt? } */
  function bars(host, opt) {
    M.l = 60;
    const { svg, tip, wrap } = frame(host, opt.title, opt.series, opt.horizontal ? opt.cats.length * 52 + 24 : 0);
    const n = opt.cats.length, tot = opt.cats.map((_, i) => opt.series.reduce((s, se) => s + se.values[i], 0));
    const max = niceMax(Math.max(...tot)), iw = W - M.l - M.r, ih = H - M.t - M.b;
    const fmt = opt.fmt || won;
    if (opt.horizontal) {
      const bh = Math.min(34, ih / n - 12), lw = Math.min(90, W * 0.22); M.l = lw;
      const hw = iw - (lw - 60) - 48; // 오른쪽 값 라벨 자리
      opt.cats.forEach((c, i) => {
        const y = M.t + (ih / n) * i + (ih / n - bh) / 2; let x = M.l;
        const lab = el('text', { class: 'lbl', x: M.l - 8, y: y + bh / 2 + 4, 'text-anchor': 'end' }, svg); lab.textContent = c;
        opt.series.forEach((s) => { const w = (hw * s.values[i]) / max; if (w <= 0) return; const r = el('rect', { x, y, width: Math.max(0, w - 2), height: bh, rx: 4, fill: css(s.color) }, svg); bind(r, `${c} · ${s.label} <b>${fmt(s.values[i])}</b>`, x + w / 2, y); x += w; });
        const v = el('text', { class: 'lbl', x: Math.min(x + 6, W - M.r), y: y + bh / 2 + 4 }, svg); v.textContent = short(tot[i]);
      });
    } else {
      yAxis(svg, max, opt.axisFmt);
      const slot = iw / n, bw = Math.max(2, Math.min(48, slot - 2));
      opt.cats.forEach((c, i) => {
        const x = M.l + slot * i + (slot - bw) / 2; let base = 0;
        opt.series.forEach((s, k) => {
          const v = s.values[i]; if (v <= 0) return;
          const y1 = M.t + ih * (1 - (base + v) / max), h = (ih * v) / max;
          const r = el('rect', { x, y: y1, width: bw, height: Math.max(0, h - (k < opt.series.length - 1 ? 2 : 0)), rx: k === opt.series.length - 1 ? Math.min(4, bw / 2) : 0, fill: css(s.color) }, svg);
          bind(r, `${c} · ${s.label} <b>${fmt(v)}</b><div>합계 <b>${fmt(tot[i])}</b></div>`, x + bw / 2, y1);
          base += v;
        });
      });
      const ax = el('g', { class: 'axis' }, svg), step = Math.max(1, Math.ceil(n / 12));
      for (let i = 0; i < n; i += step) { const t = el('text', { x: M.l + slot * i + slot / 2, y: H - 8, 'text-anchor': 'middle' }, ax); t.textContent = opt.cats[i]; }
    }
    function bind(r, html, cx, cy) {
      const show = () => tipAt(tip, wrap, cx, cy, html), hide = () => (tip.hidden = true);
      r.addEventListener('mouseenter', show); r.addEventListener('mouseleave', hide); r.addEventListener('touchstart', show, { passive: true });
      r.setAttribute('tabindex', '0'); r.addEventListener('focus', show); r.addEventListener('blur', hide);
    }
  }

  /** 비율 게이지(0~100%+). opt: { title, value(0~1), label } — 상태색 대신 계산기 tone 사용 */
  function gauge(host, opt) {
    const { svg } = frame(host, opt.title, null, 110);
    const v = Math.max(0, opt.value), bw = W - 40, x = 20, y = 40;
    el('rect', { x, y, width: bw, height: 22, rx: 11, fill: css('--soft') }, svg);
    el('rect', { x, y, width: Math.max(4, bw * Math.min(1, v)), height: 22, rx: 11, fill: css('--tone') }, svg);
    for (let p = 0; p <= 100; p += 20) { const t = el('text', { class: 'axis', x: x + (bw * p) / 100, y: y + 46, 'text-anchor': 'middle', fill: css('--muted'), 'font-size': 12 }, svg); t.textContent = p + '%'; }
    const lab = el('text', { class: 'lbl', x: x + Math.min(bw, bw * Math.min(1, v)), y: y - 10, 'text-anchor': v > 0.85 ? 'end' : 'middle' }, svg); lab.textContent = opt.label || (v * 100).toFixed(1) + '%';
  }

  root.Charts = { area, bars, gauge, short, won };
})(this);
