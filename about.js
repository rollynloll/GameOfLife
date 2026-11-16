/* Game of Life — 설명 · 패턴 · 만들기 페이지 (v3)
 * (i) 버튼으로 여는 전체 화면 페이지. 탭 세 개:
 *  - 규칙: 만져 보는 규칙 카드 4장, 글라이더 해부, 짧은 이야기
 *  - 패턴: v2 라이브러리 (실행 / 만들기에서 열기)
 *  - 만들기: 패턴 편집기
 * 주소 해시: #about/rules · #about/patterns · #about/make (· #about/make?p=<RLE>)
 */
(() => {
  'use strict';

  const { CATEGORIES, LIST, cellsOf, parseRLE } = window.GOLPatterns;
  const $ = (id) => document.getElementById(id);
  const TABS = ['rules', 'patterns', 'make'];
  const ED_SPEED = 10;               // 편집기 재생 속도 (세대/초)
  const PREVIEW_SPEED = 10;          // 패턴 카드 미리보기 속도
  const UNDO_MAX = 100;

  let api = { runPattern() {}, toast() {} };
  let root, scroller;
  let isOpen = false, tab = 'rules', pushed = false;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lifeNext = (alive, n) => (n === 3 || (alive && n === 2)) ? 1 : 0;

  // 벽(격자 밖은 죽은 셀) 한 세대
  function stepWalls(a, b, w, h) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            if (xx >= 0 && xx < w) n += a[yy * w + xx];
          }
        }
        b[y * w + x] = lifeNext(a[y * w + x], n);
      }
    }
  }

  // ====================== 규칙 탭 ======================
  // 3×3 판에서 가운데를 뺀 이웃 위치
  const NB = [0, 1, 2, 3, 5, 6, 7, 8];
  const RULES = [
    { title: '외로움', text: '살아 있는 세포의 이웃이 0–1개면 다음 세대에 죽어요.', center: 1, on: [1] },
    { title: '생존', text: '살아 있는 세포의 이웃이 2–3개면 그대로 살아남아요.', center: 1, on: [0, 5] },
    { title: '과밀', text: '살아 있는 세포의 이웃이 4개 이상이면 너무 붐벼서 죽어요.', center: 1, on: [0, 2, 6, 8] },
    { title: '탄생', text: '비어 있는 칸의 이웃이 정확히 3개면 새로 태어나요.', center: 0, on: [0, 2, 7] },
  ];

  function buildRules() {
    const wrap = $('ruleCards');
    for (const r of RULES) {
      const card = document.createElement('article');
      card.className = 'rule';
      card.innerHTML = `
        <div class="rule-demo">
          <div class="mini3" role="group" aria-label="${r.title} 예시 판"></div>
          <svg class="rule-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div class="mini-next" aria-hidden="true"><span></span></div>
        </div>
        <h3>${r.title}</h3>
        <p>${r.text}</p>
        <p class="rule-out" aria-live="polite"></p>`;
      const grid = card.querySelector('.mini3');
      const state = new Array(9).fill(0);
      state[4] = r.center;
      for (const k of r.on) state[NB[k]] = 1;
      const cells = [];
      for (let i = 0; i < 9; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'c' + (i === 4 ? ' center' : '');
        b.setAttribute('aria-label', i === 4 ? '가운데 칸' : '이웃 칸');
        b.addEventListener('click', () => { state[i] ^= 1; update(); });
        grid.appendChild(b);
        cells.push(b);
      }
      const next = card.querySelector('.mini-next span');
      const out = card.querySelector('.rule-out');
      const update = () => {
        cells.forEach((b, i) => { b.classList.toggle('on', !!state[i]); b.setAttribute('aria-pressed', String(!!state[i])); });
        const n = NB.reduce((s, i) => s + state[i], 0);
        const alive = state[4] === 1, nx = lifeNext(alive, n);
        next.classList.toggle('on', !!nx);
        let msg, cls;
        if (alive) {
          if (n < 2) { msg = '외로워서 죽어요'; cls = 'die'; }
          else if (n <= 3) { msg = '살아남아요'; cls = 'live'; }
          else { msg = '너무 붐벼서 죽어요'; cls = 'die'; }
        } else if (n === 3) { msg = '새로 태어나요'; cls = 'live'; }
        else { msg = '그대로 비어 있어요'; cls = 'empty'; }
        out.className = 'rule-out ' + cls;
        out.textContent = `이웃 ${n}개 · ${msg}`;
      };
      update();
      wrap.appendChild(card);
    }
  }

  function buildGlider() {
    const wrap = $('gliderSteps');
    const w = 6, h = 6;
    let a = new Uint8Array(w * h), b = new Uint8Array(w * h);
    for (const [x, y] of parseRLE('bo$2bo$3o!')) a[(y + 1) * w + x + 1] = 1;
    for (let g = 0; g <= 4; g++) {
      const fig = document.createElement('figure');
      fig.className = 'gstep' + (g === 4 ? ' last' : '');
      const grid = document.createElement('div');
      grid.className = 'gmini';
      grid.style.gridTemplateColumns = `repeat(${w}, 1fr)`;
      for (let i = 0; i < w * h; i++) {
        const c = document.createElement('i');
        if (a[i]) c.className = 'on';
        grid.appendChild(c);
      }
      fig.appendChild(grid);
      const cap = document.createElement('figcaption');
      cap.textContent = g === 4 ? '4세대 · 한 칸 이동' : `${g}세대`;
      fig.appendChild(cap);
      wrap.appendChild(fig);
      stepWalls(a, b, w, h);
      [a, b] = [b, a];
    }
  }

  // ====================== 패턴 탭 ======================
  const previews = [];
  let pvAcc = 0;

  function makePreview(p, canvas) {
    const c = cellsOf(p);
    const pv = p.preview || {};
    const padX = pv.padX ?? pv.pad ?? 2, padY = pv.padY ?? pv.pad ?? 2;
    const w = c.w + padX * 2, h = c.h + padY * 2;
    const start = new Uint8Array(w * h);
    for (const [x, y] of c.list) start[(y + padY) * w + x + padX] = 1;
    return { canvas, ctx: canvas.getContext('2d'), w, h, start, a: start.slice(), b: new Uint8Array(w * h), gen: 0, loop: pv.loop || 0, visible: false };
  }

  function stepTorus(pr) {
    const { a, b, w, h } = pr;
    for (let y = 0; y < h; y++) {
      const ru = ((y - 1 + h) % h) * w, r = y * w, rd = ((y + 1) % h) * w;
      for (let x = 0; x < w; x++) {
        const xl = (x - 1 + w) % w, xr = (x + 1) % w;
        const n = a[ru + xl] + a[ru + x] + a[ru + xr] + a[r + xl] + a[r + xr] + a[rd + xl] + a[rd + x] + a[rd + xr];
        b[r + x] = lifeNext(a[r + x], n);
      }
    }
    pr.a = b; pr.b = a; pr.gen++;
    if (pr.loop && pr.gen >= pr.loop) { pr.a.set(pr.start); pr.gen = 0; }
  }

  function drawPreview(pr) {
    const { canvas, ctx, w, h, a } = pr;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0b0e';
    ctx.fillRect(0, 0, cw, ch);
    let cs = Math.min(cw / w, ch / h);
    if (cs >= 2) cs = Math.floor(cs);
    const ox = (cw - w * cs) / 2, oy = (ch - h * cs) / 2;
    const gap = cs >= 5 ? 1 : 0;
    ctx.fillStyle = '#ececee';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[y * w + x]) ctx.fillRect(ox + x * cs, oy + y * cs, cs - gap, cs - gap);
  }

  function buildLibrary() {
    const body = $('libBody'), chips = $('libChips');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const pr = previews.find((x) => x.canvas === e.target);
        if (pr) { pr.visible = e.isIntersecting; if (pr.visible) drawPreview(pr); }
      }
    }, { root: scroller, rootMargin: '120px 0px' });
    for (const cat of CATEGORIES) {
      const items = LIST.filter((p) => p.cat === cat.id);
      if (!items.length) continue;
      const sec = document.createElement('section');
      sec.className = 'lib-sec';
      sec.innerHTML = `<h3>${cat.name} <span>${items.length}</span></h3><div class="lib-grid"></div>`;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'lib-chip';
      chip.textContent = cat.name;
      chip.addEventListener('click', () => {
        const top = sec.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 112;
        scroller.scrollTo({ top, behavior: 'smooth' });
      });
      chips.appendChild(chip);
      const grid = sec.querySelector('.lib-grid');
      for (const p of items) {
        const card = document.createElement('div');
        card.className = 'lib-card';
        card.innerHTML = `<canvas aria-hidden="true"></canvas><span class="lib-name"></span><span class="lib-desc"></span>
          <span class="lib-actions"><button type="button" class="run">실행</button><button type="button" class="edit">만들기에서 열기</button></span>`;
        card.querySelector('.lib-name').textContent = p.name;
        card.querySelector('.lib-desc').textContent = p.desc;
        card.querySelector('.run').addEventListener('click', () => { close(); api.runPattern(p); });
        card.querySelector('.edit').addEventListener('click', () => { setTab('make'); requestAnimationFrame(() => ed.load(cellsOf(p), p.name)); });
        grid.appendChild(card);
        const pr = makePreview(p, card.querySelector('canvas'));
        previews.push(pr);
        io.observe(pr.canvas);
      }
      body.appendChild(sec);
    }
  }

  // ====================== 만들기 탭 (편집기) ======================
  const ed = (() => {
    const s = {
      W: 0, H: 0, cs: 10, g: null, nx: null, gen: 0,
      playing: false, acc: 0, preview: false,
      undo: [], stamp: null, hover: null, drawing: -1, last: null,
    };
    let canvas, ctx, stage, info, playBtn, previewBtn, stampSel, rotBtn, flipBtn, legend;

    function pop() { let n = 0; for (let i = 0; i < s.g.length; i++) n += s.g[i]; return n; }
    function pushUndo() {
      s.undo.push({ g: s.g.slice(), gen: s.gen });
      if (s.undo.length > UNDO_MAX) s.undo.shift();
    }
    function undo() {
      setPlaying(false);
      const u = s.undo.pop();
      if (!u) { api.toast('더 되돌릴 게 없어요'); return; }
      s.g.set(u.g); s.gen = u.gen; draw();
    }

    function layout() {
      const cw = stage.clientWidth;
      if (!cw) return;
      const W = Math.max(48, Math.floor(cw / 12));
      const cs = cw / W;
      const H = Math.max(32, Math.round(Math.min(window.innerHeight * 0.56, 560) / cs));
      if (W !== s.W || H !== s.H) {
        const old = s.g, oW = s.W, oH = s.H;
        s.g = new Uint8Array(W * H); s.nx = new Uint8Array(W * H);
        if (old) {   // 가운데 기준으로 옮겨 담는다
          const dx = Math.floor((W - oW) / 2), dy = Math.floor((H - oH) / 2);
          for (let y = 0; y < oH; y++) for (let x = 0; x < oW; x++) {
            const nx = x + dx, ny = y + dy;
            if (old[y * oW + x] && nx >= 0 && ny >= 0 && nx < W && ny < H) s.g[ny * W + nx] = 1;
          }
        }
        s.W = W; s.H = H; s.undo = [];
      }
      s.cs = cs;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.height = `${Math.round(H * cs)}px`;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(H * cs * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      if (!s.g) return;
      const { W, H, cs, g } = s;
      ctx.fillStyle = '#0b0b0e';
      ctx.fillRect(0, 0, W * cs, H * cs);
      if (cs >= 7) {   // 옅은 격자선
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < W; x++) { const px = Math.round(x * cs) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, H * cs); }
        for (let y = 1; y < H; y++) { const py = Math.round(y * cs) + 0.5; ctx.moveTo(0, py); ctx.lineTo(W * cs, py); }
        ctx.stroke();
      }
      if (s.preview) stepWalls(g, s.nx, W, H);
      const gap = cs >= 7 ? 1 : 0;
      const cell = (x, y) => ctx.fillRect(Math.round(x * cs) + gap, Math.round(y * cs) + gap, Math.ceil(cs) - gap, Math.ceil(cs) - gap);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (g[i]) {
            ctx.fillStyle = s.preview && !s.nx[i] ? '#e0786b' : '#ececee';
            cell(x, y);
          } else if (s.preview && s.nx[i]) {
            ctx.fillStyle = 'rgba(120, 210, 150, 0.38)';
            cell(x, y);
          }
        }
      }
      // 도장 미리보기
      if (s.stamp && s.hover) {
        const [hx, hy] = s.hover;
        const ox = hx - Math.floor(s.stamp.w / 2), oy = hy - Math.floor(s.stamp.h / 2);
        ctx.fillStyle = 'rgba(160, 190, 255, 0.55)';
        for (const [x, y] of s.stamp.list) {
          const X = ox + x, Y = oy + y;
          if (X >= 0 && Y >= 0 && X < W && Y < H) cell(X, Y);
        }
      }
      info.textContent = `${s.gen.toLocaleString('ko-KR')}세대 · ${pop().toLocaleString('ko-KR')}칸`;
      legend.hidden = !s.preview;
    }

    function step() {
      stepWalls(s.g, s.nx, s.W, s.H);
      const t = s.g; s.g = s.nx; s.nx = t;
      s.gen++;
    }

    function setPlaying(v) {
      if (v && !s.playing) pushUndo();
      s.playing = v; s.acc = 0;
      playBtn.classList.toggle('paused', !v);
      playBtn.setAttribute('aria-label', v ? '일시정지' : '재생');
    }

    function cellAt(e) {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / s.cs), y = Math.floor((e.clientY - r.top) / s.cs);
      return (x >= 0 && y >= 0 && x < s.W && y < s.H) ? [x, y] : null;
    }
    function paintLine(a, b, v) {
      let [x0, y0] = a; const [x1, y1] = b;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        s.g[y0 * s.W + x0] = v;
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    function placeAt(cells, cx, cy) {
      const ox = cx - Math.floor(cells.w / 2), oy = cy - Math.floor(cells.h / 2);
      let clipped = false;
      for (const [x, y] of cells.list) {
        const X = ox + x, Y = oy + y;
        if (X >= 0 && Y >= 0 && X < s.W && Y < s.H) s.g[Y * s.W + X] = 1; else clipped = true;
      }
      return clipped;
    }

    function setStamp(cells) {
      s.stamp = cells ? { list: cells.list.map((c) => c.slice()), w: cells.w, h: cells.h } : null;
      rotBtn.hidden = flipBtn.hidden = !s.stamp;
      canvas.classList.toggle('stamping', !!s.stamp);
      if (!s.stamp) stampSel.value = '';
      draw();
    }
    function rotate() {
      if (!s.stamp) return;
      const { list, h } = s.stamp;
      s.stamp = { list: list.map(([x, y]) => [h - 1 - y, x]), w: s.stamp.h, h: s.stamp.w };
      draw();
    }
    function flip() {
      if (!s.stamp) return;
      const { list, w } = s.stamp;
      s.stamp = { ...s.stamp, list: list.map(([x, y]) => [w - 1 - x, y]) };
      draw();
    }

    // 살아 있는 칸의 범위
    function bbox() {
      let x0 = s.W, y0 = s.H, x1 = -1, y1 = -1;
      for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) if (s.g[y * s.W + x]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    function toRLE() {
      const b = bbox();
      if (!b) return null;
      let body = '', pending = 0;
      for (let y = b.y0; y <= b.y1; y++) {
        let row = '', x = b.x0;
        const runs = [];
        while (x <= b.x1) {
          const v = s.g[y * s.W + x];
          let n = 0;
          while (x <= b.x1 && s.g[y * s.W + x] === v) { n++; x++; }
          runs.push([n, v ? 'o' : 'b']);
        }
        if (runs.length && runs[runs.length - 1][1] === 'b') runs.pop();
        for (const [n, c] of runs) row += (n > 1 ? n : '') + c;
        if (y > b.y0) pending++;
        if (row) {
          if (pending) body += (pending > 1 ? pending : '') + '$';
          pending = 0;
          body += row;
        }
      }
      body += '!';
      return { body, w: b.w, h: b.h, n: pop() };
    }
    function wrap70(t) { return t.match(/.{1,70}/g).join('\n'); }

    function load(cells, label) {
      setPlaying(false);
      pushUndo();
      s.g.fill(0); s.gen = 0;
      const clipped = placeAt(cells, Math.floor(s.W / 2), Math.floor(s.H / 2));
      draw();
      if (clipped) api.toast('편집 판보다 커서 일부가 잘렸어요');
      else if (label) api.toast(`${label}을(를) 불러왔어요`);
    }

    function init() {
      canvas = $('edCanvas'); ctx = canvas.getContext('2d'); stage = $('edStage');
      info = $('edInfo'); playBtn = $('edPlay'); previewBtn = $('edPreview');
      stampSel = $('edStamp'); rotBtn = $('edRot'); flipBtn = $('edFlip'); legend = $('edLegend');

      // 도장 목록
      for (const cat of CATEGORIES) {
        const og = document.createElement('optgroup');
        og.label = cat.name;
        for (const p of LIST.filter((x) => x.cat === cat.id)) {
          const o = document.createElement('option');
          o.value = p.id; o.textContent = p.name;
          og.appendChild(o);
        }
        stampSel.appendChild(og);
      }
      stampSel.addEventListener('change', () => {
        const p = LIST.find((x) => x.id === stampSel.value);
        setStamp(p ? cellsOf(p) : null);
        stampSel.blur();
      });
      rotBtn.addEventListener('click', rotate);
      flipBtn.addEventListener('click', flip);

      playBtn.addEventListener('click', () => setPlaying(!s.playing));
      $('edStep').addEventListener('click', () => { setPlaying(false); pushUndo(); step(); draw(); });
      $('edUndo').addEventListener('click', undo);
      $('edClear').addEventListener('click', () => { setPlaying(false); pushUndo(); s.g.fill(0); s.gen = 0; draw(); });
      $('edRandom').addEventListener('click', () => {
        setPlaying(false); pushUndo();
        for (let i = 0; i < s.g.length; i++) s.g[i] = Math.random() < 0.2 ? 1 : 0;
        s.gen = 0; draw();
      });
      previewBtn.addEventListener('click', () => {
        s.preview = !s.preview;
        previewBtn.setAttribute('aria-pressed', String(s.preview));
        draw();
      });

      // 그리기 · 지우기 · 도장
      canvas.addEventListener('pointerdown', (e) => {
        const c = cellAt(e);
        if (!c) return;
        e.preventDefault();
        if (s.stamp) {
          pushUndo();
          if (placeAt(s.stamp, c[0], c[1])) api.toast('판 밖으로 나간 부분은 잘렸어요');
          draw();
          return;
        }
        pushUndo();
        s.drawing = s.g[c[1] * s.W + c[0]] ? 0 : 1;
        s.last = c;
        paintLine(c, c, s.drawing);
        canvas.setPointerCapture(e.pointerId);
        draw();
      });
      canvas.addEventListener('pointermove', (e) => {
        const c = cellAt(e);
        s.hover = c;
        if (s.drawing >= 0 && c) { paintLine(s.last, c, s.drawing); s.last = c; }
        if (s.drawing >= 0 || s.stamp) draw();
      });
      const end = () => { s.drawing = -1; s.last = null; };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('pointerleave', () => { s.hover = null; if (s.stamp) draw(); });

      // 내보내기
      $('edRun').addEventListener('click', () => {
        const r = toRLE();
        if (!r) { api.toast('먼저 칸을 그려 주세요'); return; }
        setPlaying(false);
        close();
        api.runPattern({
          id: `custom-${Date.now()}`, cat: 'custom', name: '내 패턴',
          desc: `${r.n.toLocaleString('ko-KR')}칸으로 시작했어요`,
          rle: r.body, cs: clamp(Math.round(360 / Math.max(r.w, r.h)), 3, 24), speed: 'ramp', final: true,
        });
      });
      $('edShare').addEventListener('click', () => {
        const r = toRLE();
        if (!r) { api.toast('먼저 칸을 그려 주세요'); return; }
        const url = `${location.href.split('#')[0]}#about/make?p=${encodeURIComponent(r.body)}`;
        copyText(url, '링크');
      });
      $('edCopy').addEventListener('click', () => {
        const r = toRLE();
        if (!r) { api.toast('먼저 칸을 그려 주세요'); return; }
        copyText(`x = ${r.w}, y = ${r.h}, rule = B3/S23\n${wrap70(r.body)}`, 'RLE');
      });
      $('edPaste').addEventListener('click', () => openModal('paste'));
    }

    function tick(dt) {
      if (!s.playing) return;
      s.acc += dt;
      const ms = 1000 / ED_SPEED;
      if (s.acc < ms) return;
      s.acc %= ms;
      step();
      draw();
    }

    function key(e) {
      if (e.key === 'Escape' && s.stamp) { setStamp(null); return true; }
      if (e.code === 'Space') { setPlaying(!s.playing); return true; }
      if (e.key === 'ArrowRight') { setPlaying(false); pushUndo(); step(); draw(); return true; }
      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) { undo(); return true; }
      if (e.metaKey || e.ctrlKey || e.altKey) return false;
      if (e.key === 'r' || e.key === 'R') { rotate(); return true; }
      if (e.key === 'f' || e.key === 'F') { flip(); return true; }
      return false;
    }

    return { init, layout, draw, tick, key, load, stop: () => setPlaying(false), hasStamp: () => !!s.stamp, clearStamp: () => setStamp(null) };
  })();

  // ====================== RLE 창 · 복사 ======================
  let modalMode = null;
  function openModal(mode, text = '') {
    modalMode = mode;
    const m = $('rleModal'), ta = $('rleText');
    $('rleTitle').textContent = mode === 'paste' ? 'RLE 붙여 넣기' : '직접 복사해 주세요';
    $('rleHelp').textContent = mode === 'paste'
      ? 'LifeWiki 등에서 복사한 RLE를 붙여 넣으세요. "x = …" 머리줄은 있어도 되고 없어도 돼요.'
      : '이 환경에서는 자동 복사를 쓸 수 없어요. 아래 내용을 선택해서 복사해 주세요.';
    $('rleOk').hidden = mode !== 'paste';
    ta.value = text;
    ta.readOnly = mode !== 'paste';
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => { ta.focus(); if (mode !== 'paste') ta.select(); });
  }
  function closeModal() {
    modalMode = null;
    $('rleModal').classList.remove('open');
    $('rleModal').setAttribute('aria-hidden', 'true');
  }
  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      api.toast(`${label}를 복사했어요`);
    } catch (_) {
      openModal('copy', text);
    }
  }
  function loadFromRLE(text, label) {
    const list = parseRLE(text.includes('!') ? text : text + '!');
    if (!list.length) return false;
    const minX = Math.min(...list.map((c) => c[0])), minY = Math.min(...list.map((c) => c[1]));
    const norm = list.map(([x, y]) => [x - minX, y - minY]);
    ed.load({ list: norm, w: Math.max(...norm.map((c) => c[0])) + 1, h: Math.max(...norm.map((c) => c[1])) + 1 }, label);
    return true;
  }

  // ====================== 열기 · 닫기 · 탭 ======================
  function setTab(t, fromHash) {
    if (!TABS.includes(t)) t = 'rules';
    tab = t;
    for (const name of TABS) {
      $(`tab-${name}`).hidden = name !== t;
      const b = root.querySelector(`[data-tab="${name}"]`);
      b.setAttribute('aria-selected', String(name === t));
    }
    if (t !== 'make') ed.stop();
    if (!fromHash) history.replaceState(null, '', `#about/${t}`);
    scroller.scrollTop = 0;
    if (t === 'make') requestAnimationFrame(() => ed.layout());
    if (t === 'patterns') for (const pr of previews) { pr.a.set(pr.start); pr.gen = 0; if (pr.visible) drawPreview(pr); }
  }

  function show(t, fromHash) {
    isOpen = true;
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('about-open');
    setTab(t, fromHash);
  }
  function hide() {
    if (root.contains(document.activeElement)) document.activeElement.blur();
    isOpen = false;
    ed.stop();
    closeModal();
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('about-open');
  }

  function open(t = 'rules') {
    if (!isOpen) {
      history.pushState(null, '', `#about/${t}`);
      pushed = true;
      show(t, true);
    } else setTab(t);
  }
  function close() {
    if (!isOpen) return;
    hide();
    if (pushed) { pushed = false; history.back(); }
    else history.replaceState(null, '', location.pathname + location.search);
  }

  // 주소 해시와 맞춘다 (뒤로 가기, 직접 링크)
  function syncFromHash() {
    const h = location.hash;
    if (!h.startsWith('#about')) { if (isOpen) { pushed = false; hide(); } return; }
    const m = h.match(/^#about\/(\w+)(?:\?p=(.*))?$/);
    const t = m ? m[1] : 'rules';
    if (!isOpen) show(t, true); else setTab(t, true);
    if (m && m[2]) {
      let rle = '';
      try { rle = decodeURIComponent(m[2]); } catch (_) { /* 깨진 링크 */ }
      history.replaceState(null, '', '#about/make');
      requestAnimationFrame(() => { if (!loadFromRLE(rle, '공유된 패턴')) api.toast('링크의 패턴을 읽지 못했어요'); });
    }
  }

  function onKey(e) {
    if (!isOpen) return;
    if (modalMode) { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } return; }
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT';
    if (e.key === 'Escape') {
      e.preventDefault();
      if (tab === 'make' && ed.hasStamp()) ed.clearStamp(); else close();
      return;
    }
    if (typing) return;
    if (tab === 'make') {
      if (e.code === 'Space' && tag === 'BUTTON') return;   // 버튼의 기본 동작에 맡긴다
      if (ed.key(e)) e.preventDefault();
    }
  }

  window.GOLAbout = {
    init(opts) {
      api = { ...api, ...opts };
      root = $('about'); scroller = $('aboutBody');
      buildRules();
      buildGlider();
      buildLibrary();
      ed.init();
      root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
      root.querySelector('.about-close').addEventListener('click', close);
      $('rleCancel').addEventListener('click', closeModal);
      $('rleOk').addEventListener('click', () => {
        if (loadFromRLE($('rleText').value, '붙여 넣은 패턴')) closeModal();
        else $('rleHelp').textContent = 'RLE를 읽지 못했어요. b·o·$·숫자로 된 내용인지 확인해 주세요.';
      });
      $('rleModal').addEventListener('click', (e) => { if (e.target.id === 'rleModal') closeModal(); });
      window.addEventListener('keydown', onKey);
      window.addEventListener('popstate', syncFromHash);
      window.addEventListener('hashchange', syncFromHash);
      window.addEventListener('resize', () => { if (isOpen && tab === 'make') ed.layout(); });
      syncFromHash();
    },
    open, close,
    isOpen: () => isOpen,
    tick(dt) {
      if (!isOpen) return;
      if (tab === 'make') ed.tick(dt);
      else if (tab === 'patterns') {
        pvAcc += dt;
        const ms = 1000 / PREVIEW_SPEED;
        if (pvAcc < ms) return;
        pvAcc %= ms;
        for (const pr of previews) if (pr.visible) { stepTorus(pr); drawPreview(pr); }
      }
    },
  };
})();
