/* Game of Life — prototype v3
 * v2 대비 변경
 *  - 오른쪽 위 (i) 버튼 → 규칙 · 패턴 · 만들기 페이지 (about.js)
 *  - 패턴 라이브러리를 시트에서 그 페이지의 패턴 탭으로 옮김. 메인 조작부의 "패턴" 버튼 제거
 *  - 페이지가 열려 있는 동안 메인 시뮬레이션은 멈춤
 *
 * v1.3 대비 변경 (v2)
 *  - 패턴 라이브러리: 정물·진동자·우주선·건·메투셀라 15개 항목 (patterns.js, library.js)
 *  - 패턴 모드: 흑백만, 물결 없이 1초 보여 준 뒤 시작, 패턴별 셀 크기·위치·속도
 *  - 마무리 숫자는 건·메투셀라에만 표시
 *
 * v1.2 대비 변경 (v1.3)
 *  - 세대 사이 보간 제거: 셀은 세대마다 즉시 바뀐다.
 *  - 사진 물결: 가운데→바깥 대신 사진 좌상단→우하단 대각선으로 내려온다.
 *  - 마무리 문구: "안정화까지 걸린 세대 / N 세대"
 *  - 컬러 겹침: R+G 노랑, R+B 자홍, G+B 청록, R+G+B 흰색. 안정화된 픽셀은 같은 혼합색을 어둡게.
 *
 * v1.1 대비 변경 (v1.2)
 *  1) 세대 사이 보간: 셀이 켜질 땐 빠르게 밝아지고, 꺼질 땐 잔상을 남기며 서서히 사라진다.
 *  2) 물결 시작: 첫 화면은 왼쪽→오른쪽, 사진은 가운데→바깥으로 Life가 번져 나간다.
 *     물결 앞은 원본(글자·사진) 그대로 멈춰 있고, 사진은 물결이 닿는 순간 셀로 바뀐다.
 *  3) 화면 가장자리가 벽: 화면 밖으로 나가려는 셀은 거기서 멈춘다(벽에 막혀 굳거나 사라짐).
 *  4) 첫 화면은 300세대 제한 대신 안정화된 뒤 다시 글자로 모인다.
 *  5) 사진은 안정화되면 세대 수를 화면 가운데 크게 보여 준다.
 *  6) 속도: 초당 15세대에서 시작해 약 17초마다 두 배씩 완만하게 빨라져 최대 120세대.
 *     안정화되면 초당 10세대로 천천히 돌아와 깜빡이는 셀을 보여 준다.
 */
(() => {
  'use strict';

  // ---- 설정 ----
  const SPEED = {
    start: 15,        // 시작 속도 (세대/초)
    max: 120,         // 최고 속도
    tau: 25000,       // 지수 가속 시간 상수 (ms) → 약 17초마다 2배
    end: 10,          // 안정화 후 속도
    endTau: 1500,     // 안정화 후 감속 시간 상수 (ms)
  };
  const STEP_BUDGET_MS = 9;         // 한 프레임에 계산에 쓸 최대 시간 (느린 기기 보호)
  const PHOTO_LONG = 200;
  const HERO_SAFETY_GEN = 5000;     // 첫 화면이 끝내 안정화되지 않을 때의 안전장치
  const MAX_PERIOD = 30;
  const SETTLE_WIN = 24;
  const SETTLE_MAX_P = 3;
  const WAVE = {
    hero: 6,          // 첫 화면 물결: 세대당 이동 셀 수 (왼→오)
    photo: 5,         // 사진 물결: 세대당 이동 셀 수 (좌상단→우하단 대각선)
    band: 4,          // 사진이 셀로 바뀌는 시점: 활성화 몇 세대 전부터
  };
  const T = {
    heroHold: 1200, heroSettle: 1500, heroAssembleFrames: 60,
    photoShow: 1000, restartShow: 500,
  };
  const BG = [11, 11, 14];
  const FG = [236, 236, 236];
  const FG_SETTLED = [96, 138, 204];
  const CH_ON = 255;
  const CH_SETTLED = 92;

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const canvas = $('stage');
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');
  const el = {
    gen: $('gen'), status: $('status'), hint: $('hint'), play: $('play'),
    restart: $('restart'), mono: $('mono'), color: $('color'), pick: $('pick'),
    home: $('home'), file: $('file'), toast: $('toast'),
    final: $('final'), finalNum: $('finalNum'), finalCap: $('finalCap'),
    info: $('info'), heroPatterns: $('heroPatterns'), pname: $('pname'), pdesc: $('pdesc'),
  };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch) el.hint.textContent = '탭해서 사진을 고르세요';

  // ---- 상태 ----
  let mode = 'hero';
  let colorMode = true;
  let W = 0, H = 0;
  let grids = [], scratch = [], hist = [], initial = [];
  let act = null, waveEnd = 0;      // 셀별 활성화 세대, 물결이 끝나는 세대
  let heroTarget = null;
  let photo = null;                 // { pixels, w, h, x, y }
  let pattern = null;               // 패턴 모드에서 고른 패턴 (patterns.js 항목)
  let photoIdx = null;              // 월드 셀 → 사진 픽셀 번호 (-1: 사진 밖)
  let imageData = null;
  let gen = 0, running = true, result = null, tracker = null;
  let runTime = 0, curSpeed = SPEED.start, resultAt = 0, resultSpeed = SPEED.start;
  let phase = { name: 'hold', t0: 0 };
  let acc = 0;
  let view = { cs: 1, ox: 0, oy: 0, vw: 0, vh: 0 };
  let assemble = null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- 시뮬레이션 ----
  // a → b 한 세대. frozen(act[i] > g)인 셀은 그대로 둔다. 격자 밖은 항상 죽은 셀(벽).
  function step(a, b, w, h, actArr, g) {
    for (let y = 0; y < h; y++) {
      const up = y > 0, dn = y < h - 1;
      const r = y * w, ru = r - w, rd = r + w;
      for (let x = 0; x < w; x++) {
        const i = r + x;
        if (actArr !== null && actArr[i] > g) { b[i] = a[i]; continue; }
        const l = x > 0, rt = x < w - 1;
        let n = 0;
        if (up) { n += a[ru + x]; if (l) n += a[ru + x - 1]; if (rt) n += a[ru + x + 1]; }
        if (dn) { n += a[rd + x]; if (l) n += a[rd + x - 1]; if (rt) n += a[rd + x + 1]; }
        if (l) n += a[r + x - 1];
        if (rt) n += a[r + x + 1];
        b[i] = (n === 3 || (n === 2 && a[i] === 1)) ? 1 : 0;
      }
    }
  }

  function stepAll() {
    const waveOn = gen < waveEnd ? act : null;
    for (let k = 0; k < grids.length; k++) {
      step(grids[k], scratch[k], W, H, waveOn, gen);
      const t = grids[k]; grids[k] = scratch[k]; scratch[k] = t;
      const g = grids[k], hk = hist[k];
      for (let i = 0; i < g.length; i++) hk[i] = ((hk[i] << 1) | g[i]) >>> 0;
    }
    gen++;
    // 물결이 다 지나간 뒤부터 전체 안정화를 판정한다
    if (!result && gen >= waveEnd) {
      const r = tracker.check(grids, gen);
      if (r) { result = r; resultAt = runTime; resultSpeed = curSpeed; onResult(); }
    }
  }

  const SETTLE_MASKS = [];
  for (let p = 1; p <= SETTLE_MAX_P; p++) SETTLE_MASKS.push([p, (1 << (SETTLE_WIN - p)) - 1]);
  function isSettled(h) {
    for (let j = 0; j < SETTLE_MASKS.length; j++) {
      const p = SETTLE_MASKS[j][0], m = SETTLE_MASKS[j][1];
      if (((h ^ (h >>> p)) & m) === 0) return true;
    }
    return false;
  }

  function speedNow() {
    if (mode === 'pattern' && typeof pattern.speed === 'number') return pattern.speed;
    if (result) {
      return SPEED.end + (resultSpeed - SPEED.end) * Math.exp(-(runTime - resultAt) / SPEED.endTau);
    }
    return Math.min(SPEED.max, SPEED.start * Math.exp(runTime / SPEED.tau));
  }

  // 상태 전체를 해시 두 개 + 살아 있는 셀 수로 기억해 주기를 찾는다 (복사 없음)
  function makeTracker() {
    const list = [];
    return {
      check(gs, g) {
        let h1 = 2166136261 | 0, h2 = 0x2545f491, c = 0;
        for (let k = 0; k < gs.length; k++) {
          const a = gs[k];
          for (let i = 0; i < a.length; i++) {
            const v = a[i];
            h1 = Math.imul(h1 ^ v, 16777619);
            h2 = (Math.imul(h2, 0x5bd1e995) + v + 1) | 0;
            c += v;
          }
          h1 = Math.imul(h1 ^ 0xff, 16777619);
        }
        for (let j = list.length - 1; j >= 0; j--) {
          const e = list[j];
          if (e.h1 === h1 && e.h2 === h2 && e.c === c) {
            return { since: e.gen, period: g - e.gen, empty: c === 0 };
          }
        }
        list.push({ h1, h2, c, gen: g });
        if (list.length > MAX_PERIOD) list.shift();
        return null;
      },
    };
  }

  function resetRun(fromGrids) {
    grids = fromGrids.map((g) => g.slice());
    scratch = fromGrids.map((g) => new Uint8Array(g.length));
    hist = fromGrids.map((g) => Uint32Array.from(g));
    gen = 0; acc = 0; runTime = 0; result = null;
    curSpeed = SPEED.start;
    tracker = makeTracker();
    hideFinal();
  }

  // ---- 물결 ----
  function buildWaveHero() {
    act = new Uint16Array(W * H);
    let mx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = Math.floor(x / WAVE.hero) + ((Math.random() * 3) | 0);
        act[y * W + x] = v; if (v > mx) mx = v;
      }
    }
    waveEnd = mx + 1;
  }

  function buildWavePhoto() {
    act = new Uint16Array(W * H);
    let mx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // 사진 좌상단 모서리에서 대각선 방향으로 잰 거리 (모서리보다 왼쪽·위는 0)
        const d = Math.max(0, (x - photo.x) + (y - photo.y)) / Math.SQRT2;
        const v = WAVE.band + 1 + Math.floor(d / WAVE.photo) + ((Math.random() * 2) | 0);
        act[y * W + x] = v; if (v > mx) mx = v;
      }
    }
    waveEnd = mx + 1;
  }

  // ---- 첫 화면 ----
  function textMask(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const lines = w / h < 1.15 ? ['GAME OF', 'LIFE'] : ['GAME OF LIFE'];
    const font = (s) => `900 ${s}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    x.font = font(100);
    const widest = Math.max(...lines.map((l) => x.measureText(l).width));
    let size = 100 * (w * 0.84) / widest;
    size = Math.min(size, (h * 0.62) / lines.length);
    x.font = font(size);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    const lh = size * 1.08;
    const y0 = h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => x.fillText(l, w / 2, y0 + i * lh));
    const d = x.getImageData(0, 0, w, h).data;
    const m = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    return m;
  }

  function buildHero() {
    const vw = innerWidth, vh = innerHeight;
    const cs = Math.max(4, Math.min(9, Math.round(Math.min(vw, vh) / 100)));
    W = Math.ceil(vw / cs); H = Math.ceil(vh / cs);
    heroTarget = textMask(W, H);
    photoIdx = null;
    allocImage();
    startHeroCycle();
    view.cs = cs; view.ox = 0; view.oy = 0;
  }

  function startHeroCycle() {
    resetRun([heroTarget]);
    buildWaveHero();
    phase = { name: 'hold', t0: performance.now() };
    assemble = null;
  }

  function startAssemble() {
    const g = grids[0];
    const diff = [];
    for (let i = 0; i < g.length; i++) if (g[i] !== heroTarget[i]) diff.push(i);
    for (let i = diff.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = diff[i]; diff[i] = diff[j]; diff[j] = t;
    }
    assemble = { diff, pos: 0, per: Math.max(1, Math.ceil(diff.length / T.heroAssembleFrames)) };
    phase = { name: 'assemble', t0: performance.now() };
  }

  // ---- 사진 ----
  async function decode(file) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) {
      return await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => { res(img); URL.revokeObjectURL(img.src); };
        img.onerror = rej;
        img.src = URL.createObjectURL(file);
      });
    }
  }

  function downscale(src, w, h) {
    let cw = src.width, ch = src.height;
    let cur = src;
    while (cw / 2 > w * 1.5 && ch / 2 > h * 1.5) {
      cw = Math.round(cw / 2); ch = Math.round(ch / 2);
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(cur, 0, 0, cw, ch);
      cur = c;
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, w, h);
    x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, w, h);
    return x.getImageData(0, 0, w, h).data;
  }

  function otsu(v) {
    const h = new Float64Array(256);
    for (let i = 0; i < v.length; i++) h[v[i]]++;
    const total = v.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * h[i];
    let sumB = 0, wB = 0, best = -1, t = 127;
    for (let i = 0; i < 256; i++) {
      wB += h[i];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += i * h[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; t = i; }
    }
    return t;
  }

  function buildInitial() {
    const { pixels, w: pw, h: ph, x: px, y: py } = photo;
    const n = pw * ph;
    const channels = colorMode ? [0, 1, 2] : ['luma'];
    initial = channels.map((ch) => {
      const v = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const p = i * 4;
        v[i] = ch === 'luma'
          ? Math.round(0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2])
          : pixels[p + ch];
      }
      const t = otsu(v);
      const g = new Uint8Array(W * H);
      for (let y = 0; y < ph; y++) {
        const row = (py + y) * W + px;
        for (let x = 0; x < pw; x++) g[row + x] = v[y * pw + x] > t ? 1 : 0;
      }
      return g;
    });
  }

  // 월드 = 화면 크기 그대로 (가장자리가 벽). 사진은 조작부를 피해 가운데에 둔다.
  function buildPhotoWorld() {
    const vw = innerWidth, vh = innerHeight;
    const top = 64, bottom = 92, side = 16;
    const aw = vw - side * 2, ah = vh - top - bottom;
    let cs = Math.min(aw / photo.w, ah / photo.h);
    if (cs >= 2) cs = Math.floor(cs);
    W = Math.ceil(vw / cs);
    H = Math.ceil(vh / cs);
    photo.x = clamp(Math.round((vw - photo.w * cs) / 2 / cs), 0, W - photo.w);
    photo.y = clamp(Math.round((top + (ah - photo.h * cs) / 2) / cs), 0, H - photo.h);
    view.cs = cs;
    photoIdx = new Int32Array(W * H).fill(-1);
    for (let y = 0; y < photo.h; y++) {
      for (let x = 0; x < photo.w; x++) photoIdx[(photo.y + y) * W + photo.x + x] = y * photo.w + x;
    }
    allocImage();
  }

  async function loadFile(file) {
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) { toast('이미지 파일만 넣을 수 있어요'); return; }
    let bmp;
    try { bmp = await decode(file); } catch (_) {
      toast('이 사진은 열 수 없어요. JPG나 PNG로 시도해 보세요');
      return;
    }
    const s = PHOTO_LONG / Math.max(bmp.width, bmp.height);
    const pw = Math.max(8, Math.round(bmp.width * s));
    const ph = Math.max(8, Math.round(bmp.height * s));
    photo = { pixels: downscale(bmp, pw, ph), w: pw, h: ph, x: 0, y: 0 };
    if (bmp.close) bmp.close();
    GOLAbout.close();
    mode = 'photo';
    pattern = null;
    colorMode = true;
    buildPhotoWorld();
    startPhoto(T.photoShow);
  }

  function startPhoto(showMs) {
    buildInitial();
    resetRun(initial);
    buildWavePhoto();
    running = true;
    phase = { name: 'show', t0: performance.now(), dur: showMs };
    layout();
    syncUI();
  }

  // ---- 패턴 ----
  // 패턴별 셀 크기로 화면 크기 월드를 만들고, 지정 위치에 패턴을 놓는다
  function startPattern(p) {
    pattern = p;
    mode = 'pattern';
    photo = null; photoIdx = null;
    const c = GOLPatterns.cellsOf(p);
    const vw = innerWidth, vh = innerHeight;
    const top = 96, bottom = 92, side = 16;
    let cs = clamp(Math.round(p.cs * Math.min(vw, vh) / 800), 2, p.cs);
    while (cs > 2 && (c.w * cs > vw - side * 2 || c.h * cs > vh - top - bottom)) cs--;
    W = Math.ceil(vw / cs); H = Math.ceil(vh / cs);
    view.cs = cs;
    allocImage();
    const [fx, fy] = p.place || [0.5, 0.5];
    const cx = vw * fx, cy = top + (vh - top - bottom) * fy;
    const ox = clamp(Math.round(cx / cs - c.w / 2), 0, W - c.w);
    const oy = clamp(Math.round(cy / cs - c.h / 2), 0, H - c.h);
    const g = new Uint8Array(W * H);
    for (const [x, y] of c.list) g[(oy + y) * W + ox + x] = 1;
    resetRun([g]);
    act = null; waveEnd = 0;
    running = true;
    phase = { name: 'show', t0: performance.now(), dur: 1000 };
    el.pname.textContent = p.name;
    el.pdesc.textContent = p.desc;
    layout();
    syncUI();
  }

  // ---- 화면 ----
  function allocImage() {
    off.width = W; off.height = H;
    imageData = offCtx.createImageData(W, H);
  }

  function layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = innerWidth, vh = innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.vw = vw; view.vh = vh;
    if (mode !== 'hero') {
      view.ox = Math.round((vw - W * view.cs) / 2);
      view.oy = Math.round((vh - H * view.cs) / 2);
    }
  }

  function paint(dt) {
    const d = imageData.data;
    const n = W * H;
    const mono = grids.length === 1;
    const settleOK = gen >= SETTLE_WIN && phase.name !== 'assemble';
    const waveOn = gen < waveEnd;
    const g0 = grids[0], g1 = grids[1], g2 = grids[2];
    const h0 = hist[0], h1 = hist[1], h2 = hist[2];
    const pp = photo ? photo.pixels : null;

    for (let i = 0, p = 0; i < n; i++, p += 4) {
      let tr, tg, tb;
      const pi = photoIdx !== null ? photoIdx[i] : -1;
      if (pi >= 0 && waveOn && gen < act[i] - WAVE.band) {
        // 물결이 아직 안 닿은 사진 영역: 원본 사진
        const s = pi * 4;
        tr = pp[s]; tg = pp[s + 1]; tb = pp[s + 2];
      } else {
        const st = settleOK && gen - (act !== null ? act[i] : 0) >= SETTLE_WIN;
        if (mono) {
          if (g0[i]) {
            const c = st && isSettled(h0[i]) ? FG_SETTLED : FG;
            tr = c[0]; tg = c[1]; tb = c[2];
          } else { tr = BG[0]; tg = BG[1]; tb = BG[2]; }
        } else {
          // 살아 있는 채널을 섞은 색: R+G 노랑, R+B 자홍, G+B 청록, 셋 다 흰색
          const r = g0[i], g = g1[i], b = g2[i];
          if (r | g | b) {
            // 살아 있는 채널이 모두 안정화됐을 때만 픽셀 전체를 어둡게
            const settled = st
              && (!r || isSettled(h0[i])) && (!g || isSettled(h1[i])) && (!b || isSettled(h2[i]));
            const on = settled ? CH_SETTLED : CH_ON;
            tr = r ? on : BG[0]; tg = g ? on : BG[1]; tb = b ? on : BG[2];
          } else { tr = BG[0]; tg = BG[1]; tb = BG[2]; }
        }
      }
      d[p] = tr; d[p + 1] = tg; d[p + 2] = tb; d[p + 3] = 255;
    }
    offCtx.putImageData(imageData, 0, 0);
    ctx.fillStyle = `rgb(${BG})`;
    ctx.fillRect(0, 0, view.vw, view.vh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, view.ox, view.oy, W * view.cs, H * view.cs);

    if (mode === 'photo' && photo) {
      const cs = view.cs;
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(view.ox + photo.x * cs) + 0.5, Math.round(view.oy + photo.y * cs) + 0.5,
        Math.round(photo.w * cs) - 1, Math.round(photo.h * cs) - 1);
    }
  }

  // ---- 진행 ----
  function runSteps(dt) {
    runTime += dt;
    curSpeed = speedNow();
    const stepMs = 1000 / curSpeed;
    acc += dt;
    const t0 = performance.now();
    while (acc >= stepMs) {
      stepAll();
      acc -= stepMs;
      if (performance.now() - t0 > STEP_BUDGET_MS) { acc = 0; break; }   // 기기가 못 따라오면 속도를 양보
    }
  }

  function advance(now, dt) {
    const age = now - phase.t0;
    if (mode === 'hero') {
      switch (phase.name) {
        case 'hold':
          if (age > T.heroHold) { phase = { name: 'run', t0: now }; acc = 0; }
          break;
        case 'run':
          runSteps(dt);
          if (result || gen >= HERO_SAFETY_GEN) phase = { name: 'settle', t0: now };
          break;
        case 'settle':
          runSteps(dt);
          if (age > T.heroSettle) startAssemble();
          break;
        case 'assemble': {
          const g = grids[0];
          const end = Math.min(assemble.diff.length, assemble.pos + assemble.per);
          for (let k = assemble.pos; k < end; k++) { const i = assemble.diff[k]; g[i] = heroTarget[i]; }
          assemble.pos = end;
          if (end >= assemble.diff.length) startHeroCycle();
          break;
        }
      }
      return;
    }
    switch (phase.name) {
      case 'show': if (age > phase.dur) { phase = { name: 'run', t0: now }; acc = 0; } break;
      case 'run': if (running) runSteps(dt); break;
    }
  }

  function onResult() {
    if (mode === 'hero' || (mode === 'pattern' && !pattern.final)) return;
    el.finalNum.innerHTML = `${result.since.toLocaleString('ko-KR')}<span class="unit">세대</span>`;
    el.final.classList.add('show');
  }
  function hideFinal() { el.final.classList.remove('show'); }

  let lastGenText = '';
  function updateStats() {
    if (mode === 'hero') return;
    const g = `${gen.toLocaleString('ko-KR')}세대`;
    if (g !== lastGenText) { el.gen.textContent = g; lastGenText = g; }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(100, now - last);
    last = now;
    if (GOLAbout.isOpen()) {           // 설명 페이지가 열려 있으면 메인은 멈춘다
      GOLAbout.tick(dt);
      requestAnimationFrame(frame);
      return;
    }
    if (W && H) {
      advance(now, dt);
      paint(dt);
      updateStats();
    }
    requestAnimationFrame(frame);
  }

  // ---- UI ----
  function syncUI() {
    document.body.classList.toggle('hero', mode === 'hero');
    document.body.classList.toggle('photo', mode === 'photo');
    document.body.classList.toggle('pattern', mode === 'pattern');
    el.play.classList.toggle('paused', !running);
    el.play.setAttribute('aria-label', running ? '일시정지' : '재생');
    el.mono.setAttribute('aria-pressed', String(!colorMode));
    el.color.setAttribute('aria-pressed', String(colorMode));
  }

  let toastTimer = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
  }

  const pick = () => { el.file.value = ''; el.file.click(); };
  const togglePlay = () => { running = !running; acc = 0; syncUI(); };
  const restart = () => {
    if (mode === 'photo') startPhoto(T.restartShow);
    else if (mode === 'pattern') startPattern(pattern);
  };
  const setColor = (on) => {
    if (mode !== 'photo' || colorMode === on) return;
    colorMode = on;
    startPhoto(T.restartShow);
  };
  const goHome = () => { GOLAbout.close(); mode = 'hero'; photo = null; pattern = null; running = true; buildHero(); layout(); syncUI(); };

  canvas.addEventListener('click', () => { if (mode === 'hero' && !GOLAbout.isOpen()) pick(); });
  el.info.addEventListener('click', () => GOLAbout.open('rules'));
  el.heroPatterns.addEventListener('click', (e) => { e.stopPropagation(); GOLAbout.open('patterns'); });
  el.file.addEventListener('change', () => loadFile(el.file.files[0]));
  el.play.addEventListener('click', togglePlay);
  el.restart.addEventListener('click', restart);
  el.mono.addEventListener('click', () => setColor(false));
  el.color.addEventListener('click', () => setColor(true));
  el.pick.addEventListener('click', pick);
  el.home.addEventListener('click', goHome);

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (GOLAbout.isOpen()) return;     // 페이지 단축키는 about.js가 처리
    if (e.key === 'i' || e.key === 'I') { GOLAbout.open('rules'); return; }
    if (e.key === 'p' || e.key === 'P') { GOLAbout.open('patterns'); return; }
    if (mode === 'hero') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'r' || e.key === 'R') restart();
    else if (e.key === 'c' || e.key === 'C') setColor(!colorMode);
  });

  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth++; document.body.classList.add('dragging');
  });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) document.body.classList.remove('dragging');
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  window.addEventListener('paste', (e) => {
    const item = Array.from((e.clipboardData && e.clipboardData.items) || []).find((i) => i.type.startsWith('image/'));
    if (item) loadFile(item.getAsFile());
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (mode === 'hero') buildHero();
      layout();
    }, 150);
  });

  GOLAbout.init({ runPattern: (p) => startPattern(p), toast });
  buildHero();
  layout();
  syncUI();
  requestAnimationFrame(frame);
})();
