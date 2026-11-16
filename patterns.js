/* Game of Life — 패턴 라이브러리 데이터 (v2)
 * rle: LifeWiki 표준 RLE (b=죽은 셀, o=산 셀, $=줄바꿈, !=끝)
 * cs: 화면 짧은 변 800px 기준 셀 크기(px). 작은 화면에서는 비율대로 줄인다.
 * place: 패턴 중심을 놓을 위치 (화면 비율). 우주선은 화면을 가로지르도록 가장자리에 둔다.
 * speed: 숫자면 고정 속도(세대/초), 'ramp'면 사진과 같은 완만한 가속.
 * final: 안정화되면 "안정화까지 걸린 세대"를 크게 보여 줄지.
 * preview: 목록 카드 미리보기 설정 (pad/padX/padY: 여백 셀, loop: 몇 세대마다 처음으로).
 *
 * 모든 패턴은 시뮬레이션으로 주기·이동·수명을 확인했다 (docs/srs.md 17·18절).
 */
(() => {
  'use strict';

  const CATEGORIES = [
    { id: 'still', name: '정물' },
    { id: 'osc', name: '진동자' },
    { id: 'ship', name: '우주선' },
    { id: 'gun', name: '건 · 무한 성장' },
    { id: 'meth', name: '메투셀라' },
  ];

  const osc = (id, name, desc, rle, cs, speed, pad = 2) =>
    ({ id, cat: 'osc', name, desc, rle, cs, speed, final: false, preview: { pad, loop: 0 } });
  const meth = (id, name, desc, rle, cs, pad = 22) =>
    ({ id, cat: 'meth', name, desc, rle, cs, speed: 'ramp', final: true, preview: { pad, loop: 200 } });

  const LIST = [
    // ---- 정물 ----
    {
      id: 'still-lifes-1', cat: 'still', name: '정물 모음 1',
      desc: 'Block · Beehive · Loaf · Boat · Tub · Ship. 한 번 놓이면 영원히 그대로예요',
      parts: [['2o$2o!', 0, 1], ['b2o$o2bo$b2o!', 5, 0], ['b2o$o2bo$bobo$2bo!', 12, 0],
        ['2o$obo$bo!', 0, 7], ['bo$obo$bo!', 6, 7], ['2o$obo$b2o!', 12, 7]],
      cs: 18, speed: 6, final: false, preview: { pad: 2, loop: 0 },
    },
    {
      id: 'still-lifes-2', cat: 'still', name: '정물 모음 2',
      desc: 'Pond · Snake · Barge · Long boat · Aircraft carrier · Eater 1',
      parts: [['b2o$o2bo$o2bo$b2o!', 0, 0], ['2obo$ob2o!', 7, 1], ['bo$obo$bobo$2bo!', 14, 0],
        ['2o$obo$bobo$2bo!', 0, 7], ['2o$o$2bo$b2o!', 7, 7], ['2o$obo$2bo$2b2o!', 14, 7]],
      cs: 18, speed: 6, final: false, preview: { pad: 2, loop: 0 },
    },
    {
      id: 'ship-tie', cat: 'still', name: 'Ship-tie',
      desc: '두 Ship이 모서리로 맞닿아도 그대로 버텨요',
      rle: '2o$obo$b2o$3b2o$3bobo$4b2o!', cs: 22, speed: 6, final: false, preview: { pad: 2, loop: 0 },
    },

    // ---- 진동자 ----
    osc('blinker', 'Blinker', '세 칸이 가로·세로로 번갈아 바뀌어요 · 주기 2', '3o!', 32, 4),
    osc('toad', 'Toad', '두 줄이 숨 쉬듯 들썩여요 · 주기 2', 'b3o$3o!', 28, 4),
    osc('beacon', 'Beacon', '마주 본 두 블록의 모서리가 깜빡여요 · 주기 2', '2o$o$3bo$2b2o!', 28, 4),
    osc('clock', 'Clock', '시곗바늘처럼 가운데가 돌아요 · 주기 2', '2bo$obo$bobo$bo!', 26, 4),
    osc('spark-coil', 'Spark coil', '양쪽 블록 사이로 불꽃이 튀어요 · 주기 2', '2o4b2o$obo2bobo$2bo2bo$obo2bobo$2o4b2o!', 22, 4),
    osc('traffic-light', 'Traffic light', 'Blinker 네 개가 신호등처럼 번갈아 켜져요 · 주기 2', '2b3o2$o5bo$o5bo$o5bo2$2b3o!', 20, 4),
    osc('pulsar', 'Pulsar', '가장 유명한 진동자 · 주기 3',
      '2b3o3b3o2b2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b2$2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!', 18, 5),
    osc('caterer', 'Caterer', '한쪽 끝이 음식을 나르듯 움직여요 · 주기 3', '2bo$o3b4o$o3bo$o$3bo$b2o!', 22, 5),
    osc('cross', 'Cross', '십자가 테두리를 따라 셀이 돌아요 · 주기 3', '2b4o$2bo2bo$3o2b3o$o6bo$o6bo$3o2b3o$2bo2bo$2b4o!', 20, 5),
    osc('pinwheel', 'Pinwheel', '가운데 바람개비가 빙글빙글 · 주기 4',
      '6b2o4b$6b2o4b2$4b4o4b$2obo4bo3b$2obo2bobo3b$3bo3b2ob2o$3bobo2bob2o$4b4o4b2$4b2o6b$4b2o!', 16, 6),
    osc('octagon-2', 'Octagon 2', '팔각형이 안팎으로 맥동해요 · 주기 5', '3b2o3b$2bo2bo2b$bo4bo$o6bo$o6bo$bo4bo$2bo2bo2b$3b2o!', 20, 6),
    osc('figure-eight', 'Figure eight', '두 덩어리가 8자를 그리며 주고받아요 · 주기 8', '3o$3o$3o$3b3o$3b3o$3b3o!', 18, 8),
    osc('koks-galaxy', "Kok's galaxy", '네 팔이 은하처럼 소용돌이쳐요 · 주기 8', '2ob6o$2ob6o$2o7b$2o5b2o$2o5b2o$2o5b2o$7b2o$6ob2o$6ob2o!', 18, 8),
    osc('tumbler', 'Tumbler', '좌우가 뒤집히며 공중제비를 돌아요 · 주기 14', 'bo5bo$obo3bobo$o2bobo2bo$2bo3bo$2b2ob2o!', 20, 10),
    osc('pentadecathlon', 'Pentadecathlon', '열두 칸이 15세대마다 제자리로 돌아와요 · 주기 15', '2bo4bo2b$2ob4ob2o$2bo4bo2b!', 20, 8, 4),
    osc('queen-bee', 'Queen bee shuttle', '여왕벌이 두 블록 사이를 오가요 · 주기 30',
      '9bo12b$7bobo12b$6bobo13b$2o3bo2bo11b2o$2o4bobo11b2o$7bobo12b$9bo!', 12, 15, 3),
    osc('twin-bees', 'Twin bees shuttle', '벌 두 마리가 엇갈리며 오가요 · 주기 46',
      '17b2o$2o15bobo7b2o$2o17bo7b2o$17b3o4$17b3o$2o17bo$2o15bobo$17b2o!', 10, 20, 3),

    // ---- 우주선 ----
    {
      id: 'glider', cat: 'ship', name: 'Glider',
      desc: '네 세대마다 대각선으로 한 칸씩 걸어가요',
      rle: 'bo$2bo$3o!', cs: 14, place: [0.1, 0.12], speed: 8, final: false, preview: { pad: 5, loop: 0 },
    },
    {
      id: 'lwss', cat: 'ship', name: 'LWSS',
      desc: '가벼운 우주선 · 네 세대마다 두 칸씩 날아가요',
      rle: 'bo2bo$o4b$o3bo$4o!', cs: 12, place: [0.9, 0.5], speed: 10, final: false, preview: { pad: 4, padX: 12, loop: 0 },
    },
    {
      id: 'mwss', cat: 'ship', name: 'MWSS',
      desc: '중간 크기 우주선 · LWSS보다 몸집이 한 칸 커요',
      rle: '3bo2b$bo3bo$o5b$o4bo$5o!', cs: 12, place: [0.9, 0.5], speed: 10, final: false, preview: { pad: 4, padX: 12, loop: 0 },
    },
    {
      id: 'hwss', cat: 'ship', name: 'HWSS',
      desc: '무거운 우주선 · 같은 방식으로 날 수 있는 가장 큰 크기예요',
      rle: '3b2o2b$bo4bo$o6b$o5bo$6o!', cs: 12, place: [0.9, 0.5], speed: 10, final: false, preview: { pad: 4, padX: 12, loop: 0 },
    },
    {
      id: 'loafer', cat: 'ship', name: 'Loafer',
      desc: '느긋한 우주선 · 일곱 세대에 한 칸씩 나아가요 (2013)',
      rle: 'b2o2bob2o$o2bo2b2o$bobo$2bo$8bo$6b3o$5bo$6bo$7b2o!', cs: 12, place: [0.88, 0.5], speed: 14, final: false,
      preview: { pad: 3, padX: 12, loop: 0 },
    },
    {
      id: 'copperhead', cat: 'ship', name: 'Copperhead',
      desc: '열 세대에 한 칸씩 위로 기어가는 우주선 (2016)',
      rle: 'b2o2b2o$3b2o$3b2o$obo2bobo$o6bo2$o6bo$b2o2b2o$2b4o2$3b2o$3b2o!', cs: 10, place: [0.5, 0.88], speed: 20, final: false,
      preview: { pad: 3, padY: 10, loop: 0 },
    },

    // ---- 건 · 무한 성장 ----
    {
      id: 'gosper', cat: 'gun', name: 'Gosper glider gun',
      desc: '30세대마다 글라이더를 하나씩 쏘아요 · 처음 발견된 건 (1970)',
      rle: '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!',
      cs: 6, place: [0.22, 0.18], speed: 'ramp', final: true, preview: { pad: 3, padY: 10, loop: 120 },
    },
    {
      id: 'simkin', cat: 'gun', name: 'Simkin glider gun',
      desc: '120세대마다 글라이더를 쏘는 작은 건 (2015)',
      rle: '2o5b2o$2o5b2o2$4b2o$4b2o5$22b2ob2o$21bo5bo$21bo6bo2b2o$21b3o3bo3b2o$26bo4$20b2o$20bo$21b3o$23bo!',
      cs: 6, place: [0.3, 0.25], speed: 'ramp', final: true, preview: { pad: 4, loop: 240 },
    },
    {
      id: 'switch-engine-10', cat: 'gun', name: '10칸 무한 성장',
      desc: '열 칸이 블록을 깔며 끝없이 뻗어 나가요 · 벽에 닿을 때까지',
      rle: '6bob$4bob2o$4bobob$4bo3b$2bo5b$obo!', cs: 4, speed: 'ramp', final: true, preview: { pad: 15, loop: 200 },
    },
    {
      id: 'growth-5x5', cat: 'gun', name: '5×5 무한 성장',
      desc: '5×5 상자에 들어가는 가장 작은 무한 성장 패턴',
      rle: '3obo$o4b$3b2o$b2obo$obobo!', cs: 4, speed: 'ramp', final: true, preview: { pad: 15, loop: 200 },
    },
    {
      id: 'growth-1-line', cat: 'gun', name: '한 줄 무한 성장',
      desc: '높이 1칸짜리 한 줄이 양쪽으로 끝없이 자라요',
      rle: '8ob5o3b3o6b7ob5o!', cs: 4, speed: 'ramp', final: true, preview: { pad: 12, loop: 200 },
    },

    // ---- 메투셀라 ----
    meth('century', 'Century', '여섯 칸이 103세대 만에 잠잠해져요', '2b2o$3o$bo!', 6, 12),
    meth('herschel', 'Herschel', '일곱 칸이 128세대 동안 변해요 · 신호 회로의 단골 부품', 'o$3o$obo$2bo!', 6, 12),
    meth('diehard', 'Diehard', '일곱 칸이 130세대 만에 하나도 남김없이 사라져요', '6bo$2o$bo3b3o!', 8, 10),
    meth('b-heptomino', 'B-heptomino', '일곱 칸이 148세대 동안 요동쳐요', 'ob2o$3o$bo!', 6, 12),
    meth('pi-heptomino', 'Pi-heptomino', 'π 모양 일곱 칸이 173세대 동안 퍼져요', '3o$obo$obo!', 6, 12),
    meth('thunderbird', 'Thunderbird', '여섯 칸이 243세대 동안 번개처럼 갈라져요', '3o2$bo$bo$bo!', 6, 12),
    meth('r-pentomino', 'R-pentomino', '다섯 칸이 1,103세대 동안 요동쳐요 (무한 평면 기준)', 'b2o$2o$bo!', 4),
    meth('multum-in-parvo', 'Multum in parvo', '‘작은 것 속의 큰 것’ · 3,933세대 (무한 평면 기준)', '3b3o$2bo2bo$bo$o!', 3),
    meth('acorn', 'Acorn', '일곱 칸이 5,206세대 동안 퍼져 나가요 (무한 평면 기준)', 'bo$3bo$2o2b3o!', 3),
    meth('rabbits', 'Rabbits', '아홉 칸이 17,331세대 동안 번식해요 (무한 평면 기준)', 'o3b3o$3o2bo$bo!', 2),
    meth('bunnies', 'Bunnies', 'Rabbits의 사촌 · 17,332세대 (무한 평면 기준)', 'o5bo$2bo3bo$2bo2bobo$bobo!', 2),
    meth('lidka', 'Lidka', '열세 칸이 29,055세대 동안 이어져요 (무한 평면 기준)', 'bo$obo$bo8$8bo$6bobo$5b2obo2$4b3o!', 2),
  ];

  // RLE → [[x, y], ...]
  function parseRLE(rle) {
    const cells = [];
    let x = 0, y = 0, num = '';
    for (const line of rle.split('\n')) {
      const s = line.trim();
      if (!s || s[0] === '#' || /^x\s*=/.test(s)) continue;
      for (const ch of s) {
        if (ch >= '0' && ch <= '9') { num += ch; continue; }
        const k = num ? parseInt(num, 10) : 1;
        num = '';
        if (ch === 'b' || ch === '.') x += k;
        else if (ch === 'o' || ch === 'A') { for (let i = 0; i < k; i++) cells.push([x + i, y]); x += k; }
        else if (ch === '$') { y += k; x = 0; }
        else if (ch === '!') return cells;
      }
    }
    return cells;
  }

  // 패턴의 셀 목록과 크기 (왼쪽 위를 0,0으로 맞춤)
  const cache = new Map();
  function cellsOf(p) {
    if (cache.has(p.id)) return cache.get(p.id);
    let list = [];
    if (p.parts) for (const [rle, dx, dy] of p.parts) list.push(...parseRLE(rle).map(([x, y]) => [x + dx, y + dy]));
    else list = parseRLE(p.rle);
    const minX = Math.min(...list.map((c) => c[0])), minY = Math.min(...list.map((c) => c[1]));
    list = list.map(([x, y]) => [x - minX, y - minY]);
    const out = {
      list,
      w: Math.max(...list.map((c) => c[0])) + 1,
      h: Math.max(...list.map((c) => c[1])) + 1,
    };
    cache.set(p.id, out);
    return out;
  }

  window.GOLPatterns = { CATEGORIES, LIST, parseRLE, cellsOf };
})();
