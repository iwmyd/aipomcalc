/* 에이팜 계산기 — 건축·토목 결과 그림 (외부 의존성 없음)
 * 모든 그림은 "실제 좌표(m 또는 mm)"로 도형을 만든 뒤 상자에 맞춰 같은 비율로 줄여 그린다(가로세로 비율 유지).
 * 색은 CSS 변수(--tone, --tone-soft, --ink2, --muted)를 써서 계산기 색·다크 모드를 그대로 따른다. */
(function (root) {
  'use strict';
  const W = 520, H = 300, PAD = 46, PADX = 78; // 좌우 여백은 글자가 잘리지 않게 더 넓게
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const nf = (v, d = 2) => (Number.isFinite(v) ? (+v.toFixed(d)).toLocaleString('ko-KR', { maximumFractionDigits: d }) : '—');
  const ell = (cx, cy, rx, ry, n = 48, a0 = 0, a1 = 2 * Math.PI) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + (a1 - a0) * i / n; return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]; });

  /** 장면(실제 좌표, y 위쪽 +)을 SVG 로. items: {poly, closed, cls} | {line:[p,q], cls} | {text, at, anchor, cls} | {dim:[p,q], label, off} */
  function render(items, label, opt = {}) {
    const pts = [];
    for (const it of items) { if (it.poly) pts.push(...it.poly); if (it.line) pts.push(...it.line); if (it.dim) pts.push(...it.dim); if (it.at && !it.free) pts.push(it.at); }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const s = Math.min((W - 2 * PADX) / Math.max(x1 - x0, 1e-9), (H - 2 * PAD) / Math.max(y1 - y0, 1e-9));
    const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
    const T = ([x, y]) => [ox + (x - x0) * s, H - oy - (y - y0) * s];
    const P = (arr) => arr.map((p) => T(p).map((v) => v.toFixed(1)).join(',')).join(' ');
    let out = '';
    for (const it of items) {
      if (it.poly) out += `<${it.closed === false ? 'polyline' : 'polygon'} class="${it.cls || 'dg-shape'}" points="${P(it.poly)}"/>`;
      else if (it.line) out += `<polyline class="${it.cls || 'dg-dim'}" points="${P(it.line)}"/>`;
      else if (it.dim) { // 치수선: 두 점 사이를 바깥쪽으로 off(px) 띄워 표시
        const [a, b] = it.dim.map(T), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * (it.off ?? 16), ny = dx / L * (it.off ?? 16);
        const A = [a[0] + nx, a[1] + ny], B = [b[0] + nx, b[1] + ny], M = [(A[0] + B[0]) / 2 + nx * 0.9, (A[1] + B[1]) / 2 + ny * 0.9];
        out += `<line class="dg-dim" x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" marker-start="url(#dga)" marker-end="url(#dga)"/>`;
        out += `<text class="dg-t" x="${M[0].toFixed(1)}" y="${(M[1] + 4).toFixed(1)}" text-anchor="middle">${esc(it.label)}</text>`;
      } else if (it.text) { const [x, y] = T(it.at); out += `<text class="${it.cls || 'dg-t'}" x="${(x + (it.dx || 0)).toFixed(1)}" y="${(y + (it.dy || 0)).toFixed(1)}" text-anchor="${it.anchor || 'middle'}">${esc(it.text)}</text>`; }
    }
    const defs = '<defs><marker id="dga" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 5L10 0v10z" class="dg-arrow"/></marker></defs>';
    return `<figure class="diagram"><svg viewBox="0 0 ${W} ${opt.h || H}" role="img" aria-label="${esc(label)}">${defs}${out}</svg><figcaption>${esc(label)}</figcaption></figure>`;
  }

  // ── 평면 도형 ──
  function shape(sh, v) {
    const it = [];
    if (sh === 'rect') { const p = [[0, 0], [v.w, 0], [v.w, v.h], [0, v.h]]; it.push({ poly: p }, { dim: [[0, 0], [v.w, 0]], label: `가로 ${nf(v.w)}m`, off: 18 }, { dim: [[v.w, 0], [v.w, v.h]], label: `세로 ${nf(v.h)}m`, off: 18 }); }
    else if (sh === 'tri') { const p = [[0, 0], [v.base, 0], [v.base / 2, v.height]]; it.push({ poly: p }, { line: [[v.base / 2, 0], [v.base / 2, v.height]], cls: 'dg-dash' }, { dim: [[0, 0], [v.base, 0]], label: `밑변 ${nf(v.base)}m`, off: 18 }, { text: `높이 ${nf(v.height)}m`, at: [v.base / 2, v.height / 2], dx: 8, anchor: 'start' }); }
    else if (sh === 'tri3') { const { a, b, c } = v, x = (c * c + b * b - a * a) / (2 * c), y = Math.sqrt(Math.max(0, b * b - x * x)); const A = [0, 0], B = [c, 0], C = [x, y];
      it.push({ poly: [A, B, C] }, { dim: [A, B], label: `c ${nf(c)}m`, off: 18 }, { dim: [B, C], label: `a ${nf(a)}m`, off: 18 }, { dim: [C, A], label: `b ${nf(b)}m`, off: 18 }); }
    else if (sh === 'trap') { const d = (v.bottom - v.top) / 2, p = [[0, 0], [v.bottom, 0], [d + v.top, v.th], [d, v.th]]; it.push({ poly: p }, { dim: [[0, 0], [v.bottom, 0]], label: `아랫변 ${nf(v.bottom)}m`, off: 18 }, { dim: [[d, v.th], [d + v.top, v.th]], label: `윗변 ${nf(v.top)}m`, off: -18 }, { line: [[d, 0], [d, v.th]], cls: 'dg-dash' }, { text: `높이 ${nf(v.th)}m`, at: [d, v.th / 2], dx: -6, anchor: 'end' }); }
    else if (sh === 'circle') { const r = v.d / 2; it.push({ poly: ell(0, 0, r, r) }, { dim: [[-r, 0], [r, 0]], label: `지름 ${nf(v.d)}m`, off: 0 }); }
    else if (sh === 'sector') { const a = Math.min(360, v.angle) * Math.PI / 180, arc = ell(0, 0, v.r, v.r, 48, 0, a); it.push({ poly: a >= 2 * Math.PI - 1e-9 ? arc : [[0, 0], ...arc] }, { dim: [[0, 0], [v.r, 0]], label: `반지름 ${nf(v.r)}m`, off: 16 }, { text: `${nf(v.angle, 1)}°`, at: [v.r * 0.28 * Math.cos(a / 2), v.r * 0.28 * Math.sin(a / 2)], cls: 'dg-t dg-acc' }); }
    else if (sh === 'ellipse') { it.push({ poly: ell(0, 0, v.ea, v.eb) }, { line: [[0, 0], [v.ea, 0]], cls: 'dg-dash' }, { line: [[0, 0], [0, v.eb]], cls: 'dg-dash' }, { text: `긴 반지름 ${nf(v.ea)}m`, at: [v.ea / 2, 0], dy: 16 }, { text: `짧은 반지름 ${nf(v.eb)}m`, at: [0, v.eb / 2], dx: 6, anchor: 'start' }); }
    else if (sh === 'poly' && v.pts.length >= 3) { it.push({ poly: v.pts }); v.pts.forEach((p, i) => it.push({ text: String(i + 1), at: p, dy: -6, cls: 'dg-t dg-acc' })); }
    if (!it.length) return '';
    return render(it, '도형 그림 — 입력한 치수 비율 그대로');
  }

  // ── 입체 (사투상: 깊이 방향을 오른쪽 위로 비스듬히) ──
  const K = 0.45, ANG = Math.PI / 6, pr = ([x, y, z]) => [x + z * K * Math.cos(ANG), y + z * K * Math.sin(ANG)];
  function solid(sh, v, names) {
    const it = [];
    const box = (w, l, h, lab) => {
      const c = [[0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0], [0, 0, l], [w, 0, l], [w, h, l], [0, h, l]].map(pr);
      it.push({ poly: [c[3], c[2], c[6], c[7]], cls: 'dg-shape dg-top' }, { poly: [c[1], c[5], c[6], c[2]], cls: 'dg-shape dg-side' }, { poly: [c[0], c[1], c[2], c[3]] });
      it.push({ dim: [c[0], c[1]], label: lab[0], off: 18 }, { dim: [c[1], c[5]], label: lab[1], off: 18 });
      if (h < 0.15 * Math.max(w, l)) it.push({ text: lab[2], at: c[6], dx: 8, dy: -6, anchor: 'start' }); else it.push({ dim: [c[5], c[6]], label: lab[2], off: 18 });
    };
    const disc = (r, y) => ell(0, y, r, r * K * 0.9);
    const round = (r1, r2, h, lab) => {
      const b = disc(r1, 0), t = disc(r2, h);
      it.push({ poly: [[-r1, 0], ...ell(0, 0, r1, r1 * K * 0.9, 24, Math.PI, 2 * Math.PI), [r1, 0], [r2, h], [-r2, h]] }, ...(r2 > 0 ? [{ poly: t, cls: 'dg-shape dg-top' }] : []), { poly: b.slice(0, 25), closed: false, cls: 'dg-dash' });
      const ry = r1 * K * 0.9;
      it.push({ dim: [[-r1, -ry], [r1, -ry]], label: lab[0], off: 14 }, { line: [[r1 + Math.max(r1, r2) * 0.35, 0], [r1 + Math.max(r1, r2) * 0.35, h]], cls: 'dg-dim' }, { text: lab[1], at: [r1 + Math.max(r1, r2) * 0.35, h / 2], dx: 6, anchor: 'start' });
      if (lab[2]) it.push({ text: lab[2], at: [0, h], dy: -10 });
    };
    if (sh === 'box') { const [a, b, c] = names || ['가로', '세로', '높이']; box(v.w, v.l, v.h, [`${a} ${nf(v.w)}m`, `${b} ${nf(v.l)}m`, `${c} ${nf(v.h)}m`]); }
    else if (sh === 'cyl') round(v.d / 2, v.d / 2, v.h, [`지름 ${nf(v.d)}m`, `높이 ${nf(v.h)}m`]);
    else if (sh === 'cone') round(v.d / 2, 0, v.h, [`지름 ${nf(v.d)}m`, `높이 ${nf(v.h)}m`]);
    else if (sh === 'frustum') round(v.d1 / 2, v.d2 / 2, v.h, [`아래 지름 ${nf(v.d1)}m`, `높이 ${nf(v.h)}m`, `위 지름 ${nf(v.d2)}m`]);
    else if (sh === 'pfrustum') { // 위·아래 정사각형으로 그린다 (면적만 알기 때문)
      const a = Math.sqrt(v.a1), b = Math.sqrt(v.a2), o = (a - b) / 2;
      const B = [[0, 0, 0], [a, 0, 0], [a, 0, a], [0, 0, a]].map(pr), U = [[o, v.h, o], [o + b, v.h, o], [o + b, v.h, o + b], [o, v.h, o + b]].map(pr);
      it.push({ poly: [B[0], B[1], U[1], U[0]] }, { poly: [B[1], B[2], U[2], U[1]], cls: 'dg-shape dg-side' }, { poly: U, cls: 'dg-shape dg-top' }, { poly: [B[3], B[0]], closed: false, cls: 'dg-dash' }, { poly: [B[3], B[2]], closed: false, cls: 'dg-dash' }, { poly: [B[3], U[3]], closed: false, cls: 'dg-dash' });
      it.push({ text: `아래 ${nf(v.a1)}㎡`, at: B[0], dy: 18, anchor: 'start' }, { text: `위 ${nf(v.a2)}㎡`, at: U[3], dy: -8, anchor: 'start' }, { text: `높이 ${nf(v.h)}m`, at: pr([a, v.h / 2, 0]), dx: 8, anchor: 'start' });
    } else if (sh === 'sphere') { const r = v.d / 2; it.push({ poly: ell(0, 0, r, r) }, { poly: ell(0, 0, r, r * 0.3), closed: false, cls: 'dg-dash' }, { dim: [[-r, 0], [r, 0]], label: `지름 ${nf(v.d)}m`, off: 0 }); }
    if (!it.length) return '';
    return render(it, '입체 그림 — 치수 비율 그대로(비스듬히 본 모습)');
  }

  // ── 콘크리트: 부재 + 레미콘 차별 적재량 ──
  function trucks(order, cap) {
    if (!(cap > 0) || !(order > 0)) return '';
    const n = Math.ceil(order / cap - 1e-9); if (n > 40) return `<p class="note">레미콘 차 ${n}대 — 그림은 40대까지 보여 드립니다.</p>`;
    const per = 10, cw = 46, ch = 30, gap = 8, rows = Math.ceil(n / per), w = Math.min(n, per) * (cw + gap) + 20, h = rows * (ch + 26) + 10;
    let out = '';
    for (let i = 0; i < n; i++) {
      const f = Math.min(1, (order - i * cap) / cap), x = 10 + (i % per) * (cw + gap), y = 10 + Math.floor(i / per) * (ch + 26);
      out += `<rect class="dg-truck" x="${x}" y="${y}" width="${cw}" height="${ch}" rx="6"/><rect class="dg-fill" x="${x}" y="${(y + ch * (1 - f)).toFixed(1)}" width="${cw}" height="${(ch * f).toFixed(1)}" rx="${f > 0.9 ? 6 : 2}"/><text class="dg-t dg-small" x="${x + cw / 2}" y="${y + ch + 15}" text-anchor="middle">${nf(Math.min(cap, order - i * cap), 1)}㎥</text>`;
    }
    return `<figure class="diagram"><svg viewBox="0 0 ${w} ${h}" style="max-width:${w}px" role="img" aria-label="레미콘 차 ${n}대에 나눠 싣는 양">${out}</svg><figcaption>레미콘 차 ${n}대 — 칸마다 실리는 양 (마지막 차는 덜 찹니다)</figcaption></figure>`;
  }
  function concrete(kind, v) {
    if (kind === 'colRound') return solid('cyl', { d: v.d, h: v.h });
    if (kind === 'wall') return solid('box', { w: v.l, l: v.t, h: v.h }, ['벽 길이', '두께', '벽 높이']);
    if (kind === 'slab') return solid('box', { w: v.w, l: v.l, h: v.t }, ['가로', '세로', '두께']);
    return solid('box', { w: v.w, l: v.l, h: v.h }, ['가로', '세로', '길이·높이']);
  }

  // ── 철근: 규격별 실제 단면 크기 비교 ──
  function rebars(list, sel) {
    const sc = 2.4, gap = 10; let x = 12, out = '';
    for (const [nm, d] of list) {
      const r = d / 2 * sc, cx = x + r, on = nm === sel;
      out += `<circle class="${on ? 'dg-fill' : 'dg-shape'}" cx="${cx.toFixed(1)}" cy="74" r="${r.toFixed(1)}"/><text class="dg-t dg-small${on ? ' dg-acc' : ''}" x="${cx.toFixed(1)}" y="${(74 + 50 * sc / 2 + 18).toFixed(1)}" text-anchor="middle">${nm}</text>`;
      x += 2 * r + gap;
    }
    return `<figure class="diagram"><svg viewBox="0 0 ${Math.ceil(x)} 150" role="img" aria-label="철근 규격별 단면 크기 비교, ${esc(sel)} 강조">${out}</svg><figcaption>규격별 단면 크기 (실제 지름 비율) — 고른 규격은 색칠</figcaption></figure>`;
  }

  // ── 벽돌: 벽 입면 + 줄눈(67mm 간격) + 문·창(같은 면적의 사각형으로 표시) ──
  function wall(w, h, open) {
    if (!(w > 0 && h > 0)) return '';
    const it = [{ poly: [[0, 0], [w, 0], [w, h], [0, h]], cls: 'dg-shape dg-brick' }];
    const course = 0.067, n = Math.floor(h / course);
    if (n <= 80) for (let i = 1; i <= n; i++) it.push({ line: [[0, i * course], [w, i * course]], cls: 'dg-joint' });
    if (open > 0 && open < w * h) { const ow = Math.min(w * 0.8, Math.sqrt(open * 1.2)), oh = Math.min(h * 0.85, open / ow), ox = (w - ow) / 2;
      it.push({ poly: [[ox, 0], [ox + ow, 0], [ox + ow, oh], [ox, oh]], cls: 'dg-open' }, { text: `문·창 ${nf(open)}㎡`, at: [w / 2, oh / 2], dy: 4 }); }
    it.push({ dim: [[0, 0], [w, 0]], label: `벽 길이 ${nf(w)}m`, off: 18 }, { dim: [[w, 0], [w, h]], label: `높이 ${nf(h)}m`, off: 18 });
    return render(it, '벽 입면 — 가로줄은 벽돌 한 켜(57mm + 줄눈 10mm), 문·창은 같은 면적의 사각형으로 표시');
  }

  // ── 경사: 직각삼각형 + 1/12·1/8 기준선 ──
  function slope(g, run) {
    const R = run > 0 ? run : 10, rise = R * g, it = [];
    it.push({ line: [[0, 0], [R, R / 12]], cls: 'dg-ref' }, { text: '1/12', at: [R * 0.62, R * 0.62 / 12], dy: -5, cls: 'dg-t dg-small' });
    it.push({ line: [[0, 0], [R, R / 8]], cls: 'dg-ref' }, { text: '1/8', at: [R * 0.8, R * 0.8 / 8], dy: -5, cls: 'dg-t dg-small' });
    it.push({ poly: [[0, 0], [R, 0], [R, rise]] }, { dim: [[0, 0], [R, 0]], label: `수평 ${nf(R)}m${run > 0 ? '' : ' (예시)'}`, off: 18 }, { dim: [[R, 0], [R, rise]], label: `높이 ${nf(rise, 3)}m`, off: 18 });
    const a = Math.atan(g), arc = ell(0, 0, R * 0.18, R * 0.18, 16, 0, a);
    it.push({ poly: arc, closed: false, cls: 'dg-acc-line' }, { text: `${nf(a * 180 / Math.PI, 1)}°`, at: [R * 0.24 * Math.cos(a / 2), R * 0.24 * Math.sin(a / 2)], anchor: 'start', cls: 'dg-t dg-acc' });
    return render(it, '경사 그림 — 점선은 장애인 경사로 기준 1/12, 완화 기준 1/8', { h: g > 2 ? 320 : 300 });
  }

  // ── 계단 단면 ──
  function stairs(n, R, T, H) {
    if (n > 80) return '';
    const p = [[0, 0]]; let x = 0, y = 0;
    for (let i = 0; i < n; i++) { y += R; p.push([x, y]); if (i < n - 1) { x += T; p.push([x, y]); } }
    const run = x, it = [{ poly: [...p, [run + T * 1.2, H], [run + T * 1.2, 0]], cls: 'dg-shape' }, { line: [[-T, 0], [run + T * 1.2, 0]], cls: 'dg-joint' }, { line: [[run, H], [run + T * 1.6, H]], cls: 'dg-joint' }];
    it.push({ dim: [[0, 0], [0, H]], label: `층고 ${nf(H, 0)}mm`, off: -22 }, { dim: [[0, 0], [run, 0]], label: `길이 ${nf(run, 0)}mm`, off: 18 });
    if (n >= 2) { const m = Math.floor((n - 1) / 2), mx = m * T, my = (m + 1) * R;
      it.push({ text: `단높이 ${nf(R, 1)}`, at: [mx, my - R / 2], dx: -6, dy: 4, anchor: 'end', cls: 'dg-t dg-small dg-acc' }, { text: `단너비 ${nf(T, 0)}`, at: [mx + T / 2, my], dy: -8, cls: 'dg-t dg-small dg-acc' }); }
    return render(it, `계단 단면 — ${n}단, 실제 비율`);
  }

  // ── 토공: 측점별 단면적 종단면 (색칠한 넓이 = 양단면 평균법 토량) ──
  function earth(A, D) {
    if (A.length < 2) return '';
    let x = 0; const p = [[0, A[0]]]; const st = [0];
    for (let i = 1; i < A.length; i++) { x += D[i - 1] || 0; p.push([x, A[i]]); st.push(x); }
    const maxA = Math.max(...A, 1e-9), sx = 1, k = x > 0 ? (x * 0.55) / maxA : 1; // 세로 배율: 가장 큰 단면이 길이의 55% 높이가 되게
    const it = [{ poly: [[0, 0], ...p.map(([a, b]) => [a * sx, b * k]), [x, 0]], cls: 'dg-shape' }];
    p.forEach(([a, b], i) => { it.push({ line: [[a, 0], [a, b * k]], cls: 'dg-dash' }, { text: `${nf(b)}㎡`, at: [a, b * k], dy: -8, cls: 'dg-t dg-small' }, { text: `측점 ${i + 1}`, at: [a, 0], dy: 18, cls: 'dg-t dg-small' }); });
    for (let i = 0; i + 1 < st.length; i++) it.push({ text: `${nf(D[i])}m`, at: [(st[i] + st[i + 1]) / 2, 0], dy: 34, cls: 'dg-t dg-small dg-acc' });
    return render(it, '종단면 — 가로는 측점 간 거리, 세로는 단면적(보기 좋게 세로 배율 조정). 색칠한 넓이가 토공량', { h: 320 });
  }

  root.Diagram = { shape, solid, concrete, trucks, rebars, wall, slope, stairs, earth };
})(this);
