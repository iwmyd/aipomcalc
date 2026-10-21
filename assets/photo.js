/* 이미지 계산기 — 이미지는 브라우저 안에서만 처리(서버 전송 없음).
 * 목록: 숫자 읽기(영수증·부가세·할인가·전기요금·FC 이적시장), 글자·날짜 읽기(글자 수·디데이), 이미지 위에서 재기(길이·면적·경사).
 * 1) 숫자 읽기: Tesseract.js(한국어+영어)를 처음 쓸 때만 jsDelivr 에서 불러와 실행. 읽기 전에 흑백·명암 늘리기·어두운 화면 뒤집기.
 *    사진 위를 끌어 상자를 그리면 그 부분만 다시 읽는다. 찾은 숫자를 누르면 계산 칸에 들어간다.
 * 2) 길이·면적: 기준 길이(정면 사진) 또는 크기를 아는 사각형(원근 보정, 호모그래피)으로 사진 위 점을 실제 길이로 바꾼다.
 * 계산 결과 화면은 app.js 의 run.photo 가 그리고, 여기서는 사진·점·글자 인식만 맡는다. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('pcv'); if (!cv) return;
  const ctx = cv.getContext('2d'), loupe = $('ploupe'), lctx = loupe.getContext('2d');
  const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
  const OCR_MODES = ['receipt', 'vat', 'discount', 'elec', 'fc', 'text', 'dday'], FIELD = { receipt: 'ptotal', vat: 'pvat', discount: 'pprice', elec: 'pkwh', fc: 'pbp', dday: 'pdate', text: 'ptext' };
  let src = null, imgId = 0, mode = 'receipt', ref = [], pts = [], drag = null, box = null, region = null;
  let worker = null, workerP = null, ocr = null, ocrBusy = false, picked = new Set(), tried = 0; // tried: 자동으로 읽어 본 사진 번호 (실패해도 입력할 때마다 다시 시도하지 않게)

  const fire = () => $('pmode').dispatchEvent(new Event('input', { bubbles: true }));
  const setStatus = (t) => { $('pst').textContent = t; };
  const bar = (p) => { $('pbar').style.width = Math.round(p * 100) + '%'; };

  // ── 사진 불러오기·돌리기 ──
  function load(file) {
    if (!file || !/^image\//.test(file.type)) return;
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)); // 너무 큰 사진은 줄여서 빠르게
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      setImage(c);
    };
    im.onerror = () => { URL.revokeObjectURL(url); setStatus('이 이미지는 열 수 없습니다. JPG·PNG 이미지로 다시 첨부해 주세요.'); };
    im.src = url;
  }
  function setImage(c) {
    src = c; imgId++; ref = []; pts = []; box = null; region = null; ocr = null; picked = new Set();
    cv.width = c.width; cv.height = c.height;
    $('pdrop-t').textContent = '다른 이미지 첨부하기'; $('pchips').innerHTML = ''; $('pchips-h').hidden = true; $('praw').textContent = ''; bar(0);
    sync(mode, true); fire();
  }
  $('pfile').addEventListener('change', (e) => { load(e.target.files[0]); e.target.value = ''; });
  const drop = $('pdrop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); load(e.dataTransfer.files[0]); });
  document.addEventListener('paste', (e) => { const f = [...(e.clipboardData || {}).files || []].find((x) => /^image\//.test(x.type)); if (f) { e.preventDefault(); load(f); } });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-prot]') && src) { const c = document.createElement('canvas'); c.width = src.height; c.height = src.width; const g = c.getContext('2d'); g.translate(c.width, 0); g.rotate(Math.PI / 2); g.drawImage(src, 0, 0); setImage(c); }
    if (e.target.closest('[data-pundo]')) { if (pts.length) pts.pop(); else ref.pop(); draw(); fire(); }
    if (e.target.closest('[data-preset]')) { ref = []; pts = []; draw(); fire(); }
    if (e.target.closest('[data-pread]') && src) { region = null; ocr = null; picked = new Set(); runOcr(); }
  });

  // ── 그리기 ──
  const lw = () => Math.max(2, cv.width / 300);
  function draw() {
    if (!src) return;
    ctx.drawImage(src, 0, 0);
    const w = lw(), dot = (p, c, label) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], w * 3.2, 0, 7); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p[0], p[1], w * 2.2, 0, 7); ctx.fill(); if (label) text(label, [p[0] + w * 3.5, p[1] - w * 3.5]); };
    const line = (a, b, c, dash) => { ctx.setLineDash(dash ? [w * 3, w * 2] : []); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); };
    const text = (t, p) => { ctx.font = `600 ${Math.round(w * 7)}px "IBM Plex Sans KR", sans-serif`; ctx.lineWidth = w * 1.8; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.strokeText(t, p[0], p[1]); ctx.fillStyle = '#111827'; ctx.fillText(t, p[0], p[1]); };
    if (mode === 'slope') {
      const M = '#0e7490';
      if (pts.length === 2) { const [a, b] = pts[0][0] <= pts[1][0] ? pts : [pts[1], pts[0]], up = b[1] < a[1]; line(a, [b[0], a[1]], '#d97706', true); line(a, b, M); text('수평', [a[0] + (b[0] - a[0]) * 0.55, a[1] + w * 9 * (up ? 1 : -0.4)]); }
      pts.forEach((p, i) => dot(p, M, String(i + 1)));
    } else if (mode === 'measure') {
      const REF = '#d97706', M = '#0e7490';
      const need = $('pref').value === 'rect' ? 4 : 2;
      ref.forEach((p, i) => { if (i) line(ref[i - 1], p, REF); });
      if (need === 4 && ref.length === 4) line(ref[3], ref[0], REF);
      ref.forEach((p, i) => dot(p, REF, need === 4 ? String(i + 1) : i === 1 ? '기준' : ''));
      if (pts.length >= 3) { ctx.fillStyle = 'rgba(14,116,144,.22)'; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); }
      pts.forEach((p, i) => { if (i) line(pts[i - 1], p, M); }); if (pts.length >= 3) line(pts[pts.length - 1], pts[0], M, true);
      pts.forEach((p, i) => dot(p, M, String(i + 1)));
    } else {
      const r = box || region;
      if (r) { ctx.setLineDash([w * 3, w * 2]); ctx.strokeStyle = '#0e7490'; ctx.lineWidth = w; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]); }
      (ocr ? ocr.nums.filter((n) => picked.has(key(n)) && n.bbox) : []).forEach((c) => { const b = c.bbox; ctx.fillStyle = 'rgba(217,119,6,.18)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#d97706'; ctx.lineWidth = w; ctx.strokeRect(b.x, b.y, b.w, b.h); });
    }
  }

  // ── 사진 위 누르기: 길이 재기 점 찍기·옮기기 / 숫자 읽기 범위 상자 ──
  const toImg = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  const hit = (p) => { const r = cv.getBoundingClientRect(), R = 22 * cv.width / r.width; let best = null, bd = R; (mode === 'slope' ? [['pts', pts]] : [['ref', ref], ['pts', pts]]).forEach(([k, arr]) => arr.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = [k, i]; } })); return best; };
  function showLoupe(p, e) {
    const Z = 3, S = loupe.width, half = S / Z / 2;
    lctx.imageSmoothingEnabled = false; lctx.fillStyle = '#000'; lctx.fillRect(0, 0, S, S);
    lctx.drawImage(cv, p[0] - half, p[1] - half, half * 2, half * 2, 0, 0, S, S);
    lctx.strokeStyle = '#fff'; lctx.lineWidth = 3; lctx.beginPath(); lctx.moveTo(S / 2, S / 2 - 16); lctx.lineTo(S / 2, S / 2 + 16); lctx.moveTo(S / 2 - 16, S / 2); lctx.lineTo(S / 2 + 16, S / 2); lctx.stroke();
    lctx.strokeStyle = '#111'; lctx.lineWidth = 1.2; lctx.stroke();
    const r = cv.getBoundingClientRect(); loupe.classList.toggle('right', e.clientX - r.left < r.width / 2); loupe.hidden = false;
  }
  cv.addEventListener('pointerdown', (e) => {
    if (!src) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); const p = toImg(e);
    if (mode === 'slope') {
      const h = hit(p);
      if (h && h[0] === 'pts') drag = h; else { if (pts.length >= 2) pts = []; pts.push(p); drag = ['pts', pts.length - 1]; }
      draw(); showLoupe(p, e);
    } else if (mode === 'measure') {
      const h = hit(p);
      if (h) drag = h;
      else { const need = $('pref').value === 'rect' ? 4 : 2; if (ref.length < need) { ref.push(p); drag = ['ref', ref.length - 1]; } else { pts.push(p); drag = ['pts', pts.length - 1]; } }
      draw(); showLoupe(p, e);
    } else box = { x0: p[0], y0: p[1], x: p[0], y: p[1], w: 0, h: 0 };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!src) return; const p = toImg(e);
    if (drag) { (drag[0] === 'ref' ? ref : pts)[drag[1]] = [Math.max(0, Math.min(cv.width, p[0])), Math.max(0, Math.min(cv.height, p[1]))]; draw(); showLoupe(p, e); }
    else if (box) { box.x = Math.min(box.x0, p[0]); box.y = Math.min(box.y0, p[1]); box.w = Math.abs(p[0] - box.x0); box.h = Math.abs(p[1] - box.y0); draw(); }
  });
  const up = () => {
    loupe.hidden = true;
    if (drag) { drag = null; draw(); fire(); }
    if (box) { const b = box; box = null; if (b.w > cv.width / 40 && b.h > cv.height / 80) { region = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }; ocr = null; picked = null; runOcr(); } else draw(); }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  // ── 글자 인식 ──
  function ensureWorker() {
    if (workerP) return workerP;
    workerP = new Promise((ok, no) => {
      if (window.Tesseract) return ok();
      const s = document.createElement('script'); s.src = TESS; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = () => no(new Error('load')); document.head.append(s);
    }).then(() => Tesseract.createWorker('kor+eng', 1, { logger: (m) => { if (m.status === 'recognizing text') { bar(m.progress); setStatus(`읽는 중… ${Math.round(m.progress * 100)}%`); } else if (/load|initializ/.test(m.status || '')) setStatus('글자 인식 준비 중… (처음 한 번만 수 MB를 내려받아요)'); } }))
      .then((w) => (worker = w)).catch((err) => { workerP = null; throw err; });
    return workerP;
  }
  /** 인식용 그림: 고른 부분(없으면 전체)을 글자 높이가 충분하도록 키우고, 흑백·명암 늘리기, 어두운 바탕이면 뒤집기 */
  function prep(r) {
    const R = r || { x: 0, y: 0, w: src.width, h: src.height };
    // 실측(2026-10-22): 3배로 키우면 글자가 너무 커져 인식이 무너지고, 1~2배가 가장 안정적 → 긴 변 1400px 기준, 최대 2배
    const k = Math.min(2, Math.max(1, 1400 / Math.max(R.w, R.h, 1)));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(R.w * k)); c.height = Math.max(1, Math.round(R.h * k));
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, R.x, R.y, R.w, R.h, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data, hist = new Uint32Array(256); let sum = 0;
    for (let i = 0; i < a.length; i += 4) { const y = Math.round(0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]); a[i] = y; hist[y]++; sum += y; }
    const n = a.length / 4, inv = sum / n < 115; let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { lo = v; break; } }
    acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.02) { hi = v; break; } }
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < a.length; i += 4) { let y = Math.max(0, Math.min(255, ((a[i] - lo) * 255) / span)); if (inv) y = 255 - y; a[i] = a[i + 1] = a[i + 2] = y; }
    // 긴 가로줄(가격표 취소선·표 테두리·밑줄) 지우기: 한 줄에서 어두운 점이 글자 폭보다 훨씬 길게 이어지면 선으로 본다
    // 단, 선 위아래가 모두 어두운 곳(선이 글자 획을 가로지르는 곳)은 남겨 숫자가 끊기지 않게 한다
    const W = c.width, Hh = c.height, thr = Math.max(60, Math.round(W * 0.1)), M = new Uint8Array(W * Hh), dk = (x, y) => y >= 0 && y < Hh && a[(y * W + x) * 4] < 128;
    for (let y = 0; y < Hh; y++) { let run = 0; for (let x = 0; x <= W; x++) { if (x < W && dk(x, y)) run++; else { if (run > thr) M.fill(1, y * W + x - run, y * W + x); run = 0; } } }
    for (let x = 0; x < W; x++) for (let y = 0; y < Hh; y++) {
      if (!M[y * W + x]) continue; let y1 = y; while (y1 + 1 < Hh && M[(y1 + 1) * W + x]) y1++;
      const t = y1 - y + 1, keep = dk(x, y - 1) && dk(x, y1 + 1) || dk(x, y - 2) && dk(x, y1 + 2);
      if (!keep && t < Hh / 4) for (let yy = y; yy <= y1; yy++) { const q = (yy * W + x) * 4; a[q] = a[q + 1] = a[q + 2] = 255; }
      y = y1;
    }
    g.putImageData(d, 0, 0);
    return { c, k, ox: R.x, oy: R.y };
  }
  async function runOcr() {
    if (!src || ocrBusy) return; ocrBusy = true; tried = imgId; const id = imgId, r = region;
    $('pocr').hidden = false; $('pchips').innerHTML = ''; $('pchips-h').hidden = true; bar(0);
    setStatus(r ? '고른 부분을 읽는 중…' : mode === 'text' ? '글을 읽는 중…' : '읽는 중…'); draw();
    try {
      await ensureWorker();
      const P = prep(r);
      await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); // 6(한 덩어리 글)이 자동(3)보다 줄 앞부분을 덜 놓침 — 실측
      const { data } = await worker.recognize(P.c, {}, { text: true, blocks: true });
      if (id !== imgId) return;
      const lines = [];
      (data.blocks || []).forEach((b) => (b.paragraphs || []).forEach((pa) => (pa.lines || []).forEach((l) => lines.push({ text: l.text, bbox: { x: P.ox + l.bbox.x0 / P.k, y: P.oy + l.bbox.y0 / P.k, w: (l.bbox.x1 - l.bbox.x0) / P.k, h: (l.bbox.y1 - l.bbox.y0) / P.k } }))));
      if (!lines.length) (data.text || '').split('\n').forEach((t) => lines.push({ text: t, bbox: null }));
      ocr = { text: data.text || '', nums: extract(lines) }; bar(1);
      picked = new Set(); pickGuess(true); showChips();
    } catch (err) {
      setStatus(err && err.message === 'load' ? '글자 인식 엔진을 불러오지 못했습니다. 인터넷 연결을 확인하고 "다시 읽기"를 눌러 주세요. 금액은 칸에 직접 넣어도 됩니다.' : '읽는 중 문제가 생겼습니다. "다시 읽기"를 눌러 주세요.');
    } finally { ocrBusy = false; }
  }

  // ── 값 고르기 ── 후보 종류: num(금액·숫자), pct(할인율), date(날짜). picked 는 고른 후보 key 모음
  const NOISE = /\d{2,4}\s*-\s*\d{3,4}\s*-\s*\d{4}|\d{3}\s*-\s*\d{2}\s*-\s*\d{5}|\d{4}\s*[.\/-]\s*\d{1,2}\s*[.\/-]\s*\d{1,2}|\d{1,2}\s*:\s*\d{2}(\s*:\s*\d{2})?|\d{4}\s*[-*]{1,2}\s*[\d*]{2,4}\s*[-*]{1,2}\s*[\d*]{2,4}/g;
  const KEY = { total: /합\s*계|총\s*(금\s*)?액|받\s*을\s*금\s*액|결\s*제\s*(금\s*액)?|청\s*구|판\s*매\s*(금\s*액|합\s*계)|카\s*드\s*승\s*인|TOTAL/i,
    totalNeg: /부\s*가\s*세|과\s*세|면\s*세|공\s*급\s*가|VAT|받\s*은\s*금\s*액|거\s*스\s*름|잔\s*돈|할\s*인|포\s*인\s*트|사\s*업\s*자|TEL|전\s*화|승\s*인\s*번\s*호/i,
    fc: /판\s*매|등\s*록|가\s*격|금\s*액|희\s*망|BP/i, fcNeg: /보\s*유|잔\s*액|소\s*지|구\s*매/i,
    price: /정\s*가|가\s*격|판\s*매\s*가|소\s*비\s*자\s*가|원\s*가|PRICE/i, disc: /할\s*인|세\s*일|SALE|OFF|%/i,
    kwh: /k\s*W\s*h|사\s*용\s*량|전\s*력\s*량/i, date: /유\s*통|기\s*한|까\s*지|만\s*료|소\s*비|일\s*시|예\s*약|공\s*연|출\s*발|마\s*감|날\s*짜|기\s*간/ };
  const key = (c) => c.kind + ':' + c.v;
  const today0 = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  function extract(lines) {
    const out = [];
    lines.forEach((L, li) => {
      // 자주 틀리는 한글 단위 바로잡기(실측): 숫자 뒤 반·민 → 만, 역 → 억, 완·윈 → 원
      const raw = L.text.replace(/(\d)\s*[반민](?=\s|B|P|8|\d|$)/g, '$1만').replace(/(\d)\s*역/g, '$1억').replace(/(\d)\s*[완윈](?=\s|$|\W)/g, '$1원'), base = { li, text: L.text.trim(), bbox: L.bbox };
      // 날짜 (2026.10.22, 26-10-22, 2026년 10월 22일) — 숫자 잡음 거르기 전에
      let m; const dre = /(20\d{2}|\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})\s*일?/g;
      while ((m = dre.exec(raw))) { const y = m[1].length === 2 ? 2000 + +m[1] : +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d));
        if (mo >= 1 && mo <= 12 && t.getUTCDate() === d && y >= 2000 && y <= 2100) out.push({ ...base, kind: 'date', v: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, k: KEY.date.test(raw) }); }
      // 할인율 30%
      const pre = /(\d{1,2}(?:\.\d)?)\s*%/g; while ((m = pre.exec(raw))) { const v = parseFloat(m[1]); if (v > 0 && v < 100) out.push({ ...base, kind: 'pct', v, k: KEY.disc.test(raw.replace(m[0], '')) || /할\s*인|OFF|SALE/i.test(raw) }); }
      // 사용량 350kWh (두 자리 숫자도)
      const kre = /(\d{1,3}(?:,\d{3})*|\d{1,5})\s*k\s*W\s*h/gi; while ((m = kre.exec(raw))) out.push({ ...base, kind: 'num', v: Number(m[1].replace(/,/g, '')), kwh: true });
      // 'BP' 를 86·80·8P 로 잘못 읽는 경우: 억·만 바로 뒤(줄 끝)나 금액 앞의 두 글자는 BP 로 본다
      const line = raw.replace(NOISE, ' ').replace(/\d{1,2}(?:\.\d)?\s*%/g, ' ').replace(/(조|억|만)\s*[8B][0-9P](?=\s*$)/g, '$1 BP').replace(/(^|\s)[8B][0-9P](?=\s+\d[\d,.]*\s*(조|억|만))/g, '$1BP');
      const flags = { kTot: KEY.total.test(line), nTot: KEY.totalNeg.test(line), kFc: KEY.fc.test(line), nFc: KEY.fcNeg.test(line), kPrice: KEY.price.test(line), kKwh: KEY.kwh.test(line) };
      const add = (v) => { if (v >= 10) out.push({ ...base, ...flags, kind: 'num', v }); };
      const ku = /\d[\d,.]*\s*(?:조|억|만)(?:\s*[\d,.]+\s*(?:억|만)?)*/g;
      while ((m = ku.exec(line))) add(Number(Calc.parseBP(m[0])));
      const rest = line.replace(ku, ' '), re = /\d{1,3}(?:[,.]\d{3})+|\d{3,}/g;
      while ((m = re.exec(rest))) add(Number(m[0].replace(/[,.]/g, '')));
    });
    const seen = new Set(); return out.filter((n) => !seen.has(key(n)) && seen.add(key(n)));
  }
  /** 계산기마다 후보 점수 — 높은 것을 먼저 고른다 */
  function score(n) {
    if (n.kind === 'date') return mode === 'dday' ? (n.k ? 3 : 0) + (Date.parse(n.v) >= today0() ? 2 : 0) : -99;
    if (n.kind === 'pct') return mode === 'discount' ? (n.k ? 3 : 0) + n.v / 100 : -99;
    if (mode === 'fc') return (n.kFc ? 4 : 0) - (n.nFc ? 5 : 0) + Math.log10(n.v) / 4;
    if (mode === 'elec') return n.v > 5000 ? -9 : (n.kwh ? 8 : 0) + (n.kKwh ? 3 : 0) - (n.kTot ? 2 : 0);
    if (n.v >= 1e8) return -9; // 영수증·가격표에 1억 이상은 대개 카드·사업자 번호
    if (mode === 'discount') return (n.kPrice ? 3 : 0) - (n.nTot && !/할\s*인/.test(n.text) ? 2 : 0) + Math.log10(n.v) / 2;
    return (n.kTot ? 4 : 0) - (n.nTot ? 4 : 0) + Math.log10(n.v) / 3 + n.li / 1000;
  }
  const kindsFor = () => (mode === 'dday' ? ['date'] : mode === 'discount' ? ['num', 'pct'] : mode === 'text' ? [] : ['num']);
  const fieldFor = (c) => (c.kind === 'pct' ? 'prate' : c.kind === 'date' ? 'pdate' : FIELD[mode]);
  function filled(id) { const e = $(id); if (!e) return false; return id === 'pbp' ? Calc.parseBP(e.value) > 0n : id === 'pdate' ? !!e.value : Number(String(e.value).replace(/[^\d.]/g, '')) > 0; }
  function pickGuess(force) {
    if (!ocr) return;
    if (mode === 'text') { const t = $('ptext'); if (force || !t.value.trim()) { t.value = cleanText(ocr.text); t.dispatchEvent(new Event('input', { bubbles: true })); } return; }
    picked = new Set();
    for (const kind of kindsFor()) {
      const c = ocr.nums.filter((n) => n.kind === kind && score(n) > -50).sort((a, b) => score(b) - score(a))[0]; if (!c) continue;
      const id = fieldFor(c);
      if (filled(id) && !force) { const cur = ocr.nums.find((n) => n.kind === kind && valOf(n) === $(id).value); if (cur) picked.add(key(cur)); continue; }
      setPick(c, true);
    }
    showChips(); draw();
  }
  const valOf = (c) => (c.kind === 'date' ? c.v : c.kind === 'pct' ? String(c.v) : mode === 'fc' ? Calc.korBP(BigInt(c.v)) : c.v.toLocaleString('ko-KR'));
  function setPick(c, quiet) {
    const id = fieldFor(c), fld = $(id); if (!fld) return;
    [...picked].filter((k) => k.startsWith(c.kind + ':')).forEach((k) => picked.delete(k)); picked.add(key(c));
    fld.value = mode === 'elec' ? String(c.v) : valOf(c);
    fld.dispatchEvent(new Event('input', { bubbles: true }));
    if (!quiet) { showChips(); draw(); }
  }
  /** 읽은 글 다듬기: 줄 끝 공백·빈 줄 정리 (글자 수 세기용) */
  const cleanText = (t) => t.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  function showChips() {
    if (!ocr) return;
    const kinds = kindsFor(), nums = ocr.nums.filter((n) => kinds.includes(n.kind) && score(n) > -50);
    const label = { receipt: '합계 줄', vat: '합계 줄', fc: '판매 줄', elec: '사용량', discount: '가격 줄' }[mode];
    let msg;
    if (mode === 'text') msg = ocr.text.trim() ? '이미지의 글을 읽어 아래 칸에 넣었습니다. 틀린 글자는 칸에서 고치세요.' : '글자를 찾지 못했습니다. 더 선명한 이미지로 다시 해 보세요.';
    else msg = nums.length ? `${{ date: '날짜', pct: '숫자·할인율', num: '숫자' }[kinds[kinds.length - 1]] || '값'} ${nums.length}개를 찾았습니다.` : (mode === 'dday' ? '날짜를 찾지 못했습니다.' : '숫자를 찾지 못했습니다.') + ' 더 밝고 가까이서 찍거나, 필요한 부분만 상자로 감싸 보세요.';
    const tot = [...picked].find((k) => k.startsWith('num:')), T = tot ? Number(tot.slice(4)) : null;
    if (T != null && (mode === 'receipt' || mode === 'vat')) { // 검산: 공급가액 + 부가세 = 합계, 또는 항목 금액 합 = 합계
      const N = ocr.nums.filter((n) => n.kind === 'num'), sup = N.filter((n) => /공\s*급\s*가|과\s*세\s*물\s*품/.test(n.text)).map((n) => n.v), tax = N.filter((n) => /부\s*가\s*세|VAT/i.test(n.text)).map((n) => n.v);
      const items = N.filter((n) => !n.kTot && !n.nTot && n.v < T).reduce((s, n) => s + n.v, 0);
      if (sup.some((a) => tax.some((b) => a + b === T))) msg += ' 공급가액 + 부가세 = 합계로 검산했습니다 ✔';
      else if (items === T) msg += ' 항목 금액을 더한 값이 합계와 같습니다 ✔';
    }
    setStatus(msg + (region || mode === 'text' ? '' : ' 이미지 위를 끌어 상자를 그리면 그 부분만 다시 읽습니다.'));
    $('pchips-h').hidden = !nums.length;
    const show = (n) => (n.kind === 'date' ? n.v.replace(/-/g, '.') : n.kind === 'pct' ? n.v + '%' : mode === 'fc' && n.v >= 1e4 ? Calc.korBP(BigInt(n.v)) : n.v.toLocaleString('ko-KR') + (n.kwh ? ' kWh' : ''));
    const tag = (n) => (n.kind === 'pct' ? (n.k ? '할인' : '') : n.kind === 'date' ? (n.k ? '기한' : '') : mode === 'fc' ? (n.kFc && !n.nFc ? label : '') : mode === 'elec' ? (n.kwh || n.kKwh ? label : '') : mode === 'discount' ? (n.kPrice ? label : '') : n.kTot && !n.nTot ? label : '');
    $('pchips').innerHTML = nums.slice(0, 30).map((n, i) => `<button type="button" class="pchip" data-i="${ocr.nums.indexOf(n)}" aria-pressed="${picked.has(key(n))}" title="${n.text.replace(/[<>"&]/g, '')}">${show(n)}${tag(n) ? '<small>' + tag(n) + '</small>' : ''}</button>`).join('');
    $('praw').textContent = ocr.text;
  }
  $('pchips').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) setPick(ocr.nums[+b.dataset.i]); });

  // ── 길이·면적 ──
  /** 4점 대응으로 사진 좌표 → 실제 평면 좌표 변환(호모그래피) 계수. 가우스 소거 */
  function homography(from, to) {
    const A = [], B = [];
    for (let i = 0; i < 4; i++) { const [x, y] = from[i], [u, v] = to[i]; A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); B.push(u); A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); B.push(v); }
    for (let c = 0; c < 8; c++) {
      let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-12) return null;
      [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
      for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
    }
    const h = B.map((b, i) => b / A[i][i]);
    return ([x, y]) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
  }
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const convex = (q) => { const s = q.map((_, i) => Math.sign(cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]))); return s.every((v) => v === s[0] && v !== 0); };
  const crossing = (P) => { const n = P.length; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; const a = P[i], b = P[(i + 1) % n], c = P[j], d = P[(j + 1) % n]; if (Math.sign(cross(a, b, c)) * Math.sign(cross(a, b, d)) < 0 && Math.sign(cross(c, d, a)) * Math.sign(cross(c, d, b)) < 0) return true; } return false; };
  function measure(kind, dims) {
    if (!src) return { ok: false, msg: kind === 'slope' ? '먼저 경사면이 옆에서 보이는 이미지를 첨부해 주세요.' : '먼저 이미지를 첨부해 주세요. 길이를 아는 물건(문, A4 용지, 타일 등)이 함께 찍혀 있어야 합니다.' };
    if (kind === 'slope') {
      if (pts.length < 2) return { ok: false, msg: `경사면의 아래쪽과 위쪽을 차례로 누르세요 (${pts.length}/2). 점은 끌어서 옮길 수 있습니다.` };
      const dx = Math.abs(pts[1][0] - pts[0][0]), dy = Math.abs(pts[1][1] - pts[0][1]);
      if (dx < 1) return { ok: false, msg: '두 점이 수직으로 놓였습니다. 경사면을 따라 다시 찍어 주세요.' };
      return { ok: true, g: dy / dx };
    }
    let map;
    if (kind === 'rect') {
      const [W, H] = dims; if (!(W > 0 && H > 0)) return { ok: false, msg: '사각형의 가로·세로 실제 길이를 넣어 주세요.' };
      if (ref.length < 4) return { ok: false, msg: `기준 사각형의 꼭짓점을 둘레를 따라 차례로 누르세요 (${ref.length}/4). 1번→2번이 가로, 2번→3번이 세로입니다.` };
      if (!convex(ref)) return { ok: false, msg: '기준 사각형 꼭짓점 순서가 엇갈렸습니다. 둘레를 따라 차례로 찍어 주세요 ("점 모두 지우기" 후 다시).' };
      map = homography(ref, [[0, 0], [W, 0], [W, H], [0, H]]); if (!map) return { ok: false, msg: '기준 사각형이 너무 납작합니다. 네 꼭짓점을 다시 찍어 주세요.' };
    } else {
      const [L] = dims; if (!(L > 0)) return { ok: false, msg: '기준 물건의 실제 길이를 넣어 주세요.' };
      if (ref.length < 2) return { ok: false, msg: `길이를 아는 물건의 양 끝을 차례로 누르세요 (${ref.length}/2).` };
      const px = Math.hypot(ref[1][0] - ref[0][0], ref[1][1] - ref[0][1]); if (px < 5) return { ok: false, msg: '기준선이 너무 짧습니다. 양 끝을 다시 찍어 주세요.' };
      const k = L / px; map = ([x, y]) => [x * k, y * k];
    }
    if (pts.length < 2) return { ok: false, msg: '이제 재고 싶은 곳을 누르세요. 2점이면 길이, 3점 이상이면 면적입니다. 점은 끌어서 옮길 수 있고, 누르는 동안 확대 창이 뜹니다.' };
    const P = pts.map(map), d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (P.length === 2) return { ok: true, len: d(P[0], P[1]), sides: [d(P[0], P[1])] };
    const sides = P.map((p, i) => d(p, P[(i + 1) % P.length]));
    let a = 0; P.forEach((p, i) => { const q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; });
    return { ok: true, area: Math.abs(a) / 2, perim: sides.reduce((s, v) => s + v, 0), sides, note: crossing(P) ? '변이 서로 엇갈립니다. 둘레를 따라 차례로 찍어야 면적이 맞습니다.' : kind === 'line' ? '정면에서 찍은 사진 기준입니다. 비스듬한 사진이면 "크기를 아는 사각형"을 고르세요.' : '' };
  }

  // ── 계산기 바뀔 때 화면 맞추기 (app.js run.photo 가 호출) ──
  function sync(m, fresh) {
    const prev = mode, changed = m !== mode; mode = m;
    const isOcr = OCR_MODES.includes(mode);
    $('pstage').hidden = !src; $('ptools').hidden = !src;
    document.querySelectorAll('[data-pundo],[data-preset]').forEach((b) => (b.hidden = isOcr));
    if (changed && (m === 'slope' || prev === 'slope')) pts = []; // 경사는 점 2개만 쓰므로 바뀔 때 비움
    document.querySelector('[data-pread]').hidden = !isOcr;
    $('pocr').hidden = !(src && isOcr);
    cv.style.cursor = 'crosshair'; cv.setAttribute('aria-label', isOcr ? '첨부한 이미지 — 끌어서 읽을 부분 고르기' : '첨부한 이미지 — 눌러서 점 찍기');
    draw();
    if (src && isOcr) { if (!ocr && !ocrBusy && tried !== imgId) runOcr(); else if (ocr && (changed || fresh)) { pickGuess(false); showChips(); draw(); } }
  }
  window.PhotoCalc = { sync, measure, _extract: extract, _homography: homography };
})();
