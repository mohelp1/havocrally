'use strict';
// ============================================================
//  HAVOC RALLY – procedural art: tracks, cars, effects
// ============================================================

const TRACK_G = 112, TRACK_M = 440, HW = 82, WALL = HW + 58, CHUNK = 1024, STEP = 10;
const CAR_RES = 2.2;               // car textures are drawn at 2.2x and displayed at 1/2.2
const TRACK_CACHE = {};

// ---------------- random & noise ----------------
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let q = Math.imul(a ^ a >>> 15, 1 | a);
    q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q;
    return ((q ^ q >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoiseP(x, y, p, s) {           // tileable value noise with period p
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = k => ((k % p) + p) % p;
  const a = hash2(m(xi), m(yi), s), b = hash2(m(xi + 1), m(yi), s), c = hash2(m(xi), m(yi + 1), s), d = hash2(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function hexRGB(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
function shade(rgb, f) {
  const r = f >= 0 ? rgb.map(c => c + (255 - c) * f) : rgb.map(c => c * (1 + f));
  return `rgb(${r.map(c => Math.round(clamp(c, 0, 255))).join(',')})`;
}
function cssRGB(css) {
  if (css[0] === '#') { const n = parseInt(css.slice(1), 16); return hexRGB(n); }
  return css.match(/\d+/g).slice(0, 3).map(Number);
}

function noiseTile(size, c1, c2, cells, seed, grain, specks) {
  const cv = makeCanvas(size, size), g = cv.getContext('2d');
  const img = g.createImageData(size, size), d = img.data;
  const A = cssRGB(c1), B = cssRGB(c2), rng = mulberry(seed);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let n = 0, amp = 0.55, tot = 0;
    for (let o = 0; o < 3; o++) {
      const p = cells << o, f = p / size;
      n += vnoiseP(x * f, y * f, p, seed + o * 31) * amp; tot += amp; amp *= 0.5;
    }
    n = clamp((n / tot - 0.5) * 1.8 + 0.5, 0, 1);
    const gr = (rng() - 0.5) * grain, i = (y * size + x) * 4;
    d[i] = A[0] + (B[0] - A[0]) * n + gr; d[i + 1] = A[1] + (B[1] - A[1]) * n + gr; d[i + 2] = A[2] + (B[2] - A[2]) * n + gr; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (specks) specks.forEach(([col, count, r]) => {
    g.fillStyle = col;
    for (let k = 0; k < count; k++) { g.beginPath(); g.arc(rng() * size, rng() * size, r * (0.5 + rng()), 0, Math.PI * 2); g.fill(); }
  });
  return cv;
}

// ---------------- themes ----------------
const THEMES = {
  desert: { g1: '#c7a05c', g2: '#b0864a', run1: '#a88252', run2: '#8f6d42', road1: '#5a5651', road2: '#4c4945',
    curbA: '#d22a2a', curbB: '#f2f2f2', line: 'rgba(255,255,255,0.5)', wall: 'tires',
    blots: ['rgba(140,95,50,0.22)', 'rgba(235,205,150,0.22)'], specks: [['rgba(90,65,35,0.35)', 90, 1.2], ['rgba(240,220,170,0.4)', 70, 1]],
    decor: ['rock', 'cactus', 'bush', 'rock', 'cactus', 'barrels', 'bush', 'wreck'] },
  city: { g1: '#7a7c7e', g2: '#67696b', run1: '#5c5e60', run2: '#505254', road1: '#3e3f42', road2: '#353639',
    curbA: '#e8c21c', curbB: '#222222', line: 'rgba(255,210,60,0.65)', wall: 'blocks',
    blots: ['rgba(40,40,40,0.25)', 'rgba(140,120,90,0.18)'], specks: [['rgba(30,30,30,0.35)', 120, 1], ['rgba(200,200,200,0.25)', 60, 0.8]],
    decor: ['container', 'crate', 'barrels', 'roof', 'container', 'stain', 'roof'] },
  snow: { g1: '#eaf0f6', g2: '#d2dde8', run1: '#c3cfdb', run2: '#b2c0ce', road1: '#7c8693', road2: '#6f7986',
    curbA: '#2a6fd2', curbB: '#f4f4f4', line: 'rgba(255,255,255,0.55)', wall: 'snow',
    blots: ['rgba(170,190,210,0.25)', 'rgba(255,255,255,0.35)'], specks: [['rgba(150,170,190,0.3)', 70, 1], ['rgba(255,255,255,0.8)', 90, 1]],
    decor: ['pine', 'pine', 'rocksnow', 'pine', 'pine', 'rocksnow'] },
  forest: { g1: '#4d6b2f', g2: '#3c5524', run1: '#6b5636', run2: '#5a472b', road1: '#4c4a47', road2: '#413f3c',
    curbA: '#d22a2a', curbB: '#f2f2f2', line: 'rgba(255,255,255,0.45)', wall: 'tires',
    blots: ['rgba(30,45,15,0.3)', 'rgba(120,140,60,0.22)'], specks: [['rgba(25,35,12,0.4)', 110, 1.2], ['rgba(150,170,80,0.35)', 80, 1]],
    decor: ['tree', 'tree', 'burnt', 'bush', 'log', 'tree', 'rock', 'burnt'] },
  night: { g1: '#26252d', g2: '#1c1b22', run1: '#33313a', run2: '#2a2930', road1: '#2f2e34', road2: '#28272c',
    curbA: '#ff2a8a', curbB: '#151515', line: 'rgba(80,220,255,0.6)', wall: 'blocks',
    blots: ['rgba(0,0,0,0.3)', 'rgba(80,70,110,0.18)'], specks: [['rgba(0,0,0,0.4)', 100, 1], ['rgba(120,110,150,0.25)', 60, 0.8]],
    decor: ['roof', 'roof', 'container', 'roof', 'barrels'], lamps: true }
};

// ---------------- track geometry ----------------
function crPoint(p0, p1, p2, p3, u) {   // centripetal Catmull-Rom
  const d = (p, q) => Math.max(1e-3, Math.sqrt(Math.hypot(q.x - p.x, q.y - p.y)));
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const tt = t1 + (t2 - t1) * u;
  const mix = (a, b, ta, tb) => ({ x: (a.x * (tb - tt) + b.x * (tt - ta)) / (tb - ta), y: (a.y * (tb - tt) + b.y * (tt - ta)) / (tb - ta) });
  const A1 = mix(p0, p1, t0, t1), A2 = mix(p1, p2, t1, t2), A3 = mix(p2, p3, t2, t3);
  const B1 = mix(A1, A2, t0, t2), B2 = mix(A2, A3, t1, t3);
  return mix(B1, B2, t1, t2);
}

function buildTrack(idx) {
  if (TRACK_CACHE[idx]) return TRACK_CACHE[idx];
  const def = TRACKS[idx];
  let cp = def.pts.map(([x, y]) => ({ x: x * TRACK_G, y: y * TRACK_G }));
  const xs = cp.map(p => p.x), ys = cp.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
  cp = cp.map(p => ({ x: p.x - minX + TRACK_M, y: p.y - minY + TRACK_M }));
  const W = Math.round(maxX - minX + TRACK_M * 2), H = Math.round(maxY - minY + TRACK_M * 2);
  const n = cp.length, raw = [];
  for (let i = 0; i < n; i++) {
    const p0 = cp[(i - 1 + n) % n], p1 = cp[i], p2 = cp[(i + 1) % n], p3 = cp[(i + 2) % n];
    for (let k = 0; k < 48; k++) raw.push(crPoint(p0, p1, p2, p3, k / 48));
  }
  // resample uniformly
  const P = [{ x: raw[0].x, y: raw[0].y }];
  let prev = raw[0], need = STEP;
  for (let i = 1; i <= raw.length; i++) {
    const b = raw[i % raw.length]; let ax = prev.x, ay = prev.y, seg = Math.hypot(b.x - ax, b.y - ay);
    while (seg >= need) { const f = need / seg; ax += (b.x - ax) * f; ay += (b.y - ay) * f; P.push({ x: ax, y: ay }); seg -= need; need = STEP; }
    need -= seg; prev = b;
  }
  if (Math.hypot(P[P.length - 1].x - P[0].x, P[P.length - 1].y - P[0].y) < STEP * 0.6) P.pop();
  const N = P.length, TX = new Float32Array(N), TY = new Float32Array(N), A = new Float32Array(N), cum = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = P[(i - 1 + N) % N], b = P[(i + 1) % N];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    TX[i] = (b.x - a.x) / l; TY[i] = (b.y - a.y) / l; A[i] = Math.atan2(TY[i], TX[i]);
    if (i > 0) cum[i] = cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
  }
  const len = cum[N - 1] + Math.hypot(P[0].x - P[N - 1].x, P[0].y - P[N - 1].y);
  const tr = { idx, def, theme: THEMES[def.theme], themeName: def.theme, grip: def.grip, P, N, TX, TY, A, cum, len, W, H };
  // spatial grid of segments for fast global nearest
  tr.cell = 200; tr.gw = Math.ceil(W / tr.cell); tr.gh = Math.ceil(H / tr.cell); tr.grid = new Map();
  for (let i = 0; i < N; i++) {
    const p = P[i], gx = Math.floor(p.x / tr.cell), gy = Math.floor(p.y / tr.cell), k = gy * tr.gw + gx;
    if (!tr.grid.has(k)) tr.grid.set(k, []); tr.grid.get(k).push(i);
  }
  tr.slots = [0, 1, 2, 3].map(k => {
    const s = len - 70 - k * 62, q = pointAtS(tr, s), side = k % 2 ? 1 : -1;
    return { x: q.x - q.ty * side * 40, y: q.y + q.tx * side * 40, a: Math.atan2(q.ty, q.tx), s };
  });
  buildDecor(tr);
  TRACK_CACHE[idx] = tr;
  return tr;
}

function pointAtS(tr, s) {
  s = ((s % tr.len) + tr.len) % tr.len;
  let lo = 0, hi = tr.N - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tr.cum[m] <= s) lo = m; else hi = m - 1; }
  const i = lo, j = (i + 1) % tr.N, segL = (j === 0 ? tr.len : tr.cum[j]) - tr.cum[i], f = segL > 0 ? (s - tr.cum[i]) / segL : 0;
  return { x: lerp(tr.P[i].x, tr.P[j].x, f), y: lerp(tr.P[i].y, tr.P[j].y, f), tx: tr.TX[i], ty: tr.TY[i], i };
}

// nearest point on the centerline; local search around hint index, or global via grid
function projSeg(tr, i, x, y, out) {
  const a = tr.P[i], b = tr.P[(i + 1) % tr.N];
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  let u = ((x - a.x) * dx + (y - a.y) * dy) / l2; u = u < 0 ? 0 : u > 1 ? 1 : u;
  const qx = a.x + dx * u, qy = a.y + dy * u, d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
  if (d2 < out.d2) { out.d2 = d2; out.i = i; out.u = u; out.qx = qx; out.qy = qy; }
}
function nearest(tr, x, y, hint = -1, win = 30) {
  const out = { d2: Infinity, i: 0, u: 0, qx: 0, qy: 0 };
  if (hint >= 0) {
    for (let k = -win; k <= win; k++) projSeg(tr, (hint + k + tr.N) % tr.N, x, y, out);
    if (out.d2 < (WALL + 120) * (WALL + 120)) return finishNearest(tr, out, x, y);
  }
  const gx = Math.floor(x / tr.cell), gy = Math.floor(y / tr.cell);
  for (let r = 1; r <= 4 && out.d2 === Infinity; r++) {
    for (let yy = gy - r; yy <= gy + r; yy++) for (let xx = gx - r; xx <= gx + r; xx++) {
      const l = tr.grid.get(yy * tr.gw + xx); if (!l) continue;
      for (const i of l) { projSeg(tr, i, x, y, out); projSeg(tr, (i - 1 + tr.N) % tr.N, x, y, out); }
    }
  }
  if (out.d2 === Infinity) for (let i = 0; i < tr.N; i++) projSeg(tr, i, x, y, out);
  return finishNearest(tr, out, x, y);
}
function finishNearest(tr, out, x, y) {
  out.d = Math.sqrt(out.d2);
  const i = out.i, j = (i + 1) % tr.N;
  out.s = tr.cum[i] + ((j === 0 ? tr.len : tr.cum[j]) - tr.cum[i]) * out.u;
  out.side = (x - out.qx) * -tr.TY[i] + (y - out.qy) * tr.TX[i];   // signed lateral
  return out;
}
const distGlobal = (tr, x, y) => nearest(tr, x, y).d;

// ---------------- decor & walls ----------------
function buildDecor(tr) {
  const rng = mulberry(1000 + tr.idx * 77), th = tr.theme, items = [];
  // walls (tire stacks / concrete blocks / snow banks) on both sides
  const walls = [], hashW = new Map(), wr = 10;
  const occupied = (x, y, r, map) => {
    const gx = Math.floor(x / 40), gy = Math.floor(y / 40);
    for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) {
      const l = map.get(yy * 100000 + xx); if (!l) continue;
      for (const o of l) if (Math.hypot(o.x - x, o.y - y) < r + o.r) return true;
    }
    return false;
  };
  const addHash = (o, map) => { const k = Math.floor(o.y / 40) * 100000 + Math.floor(o.x / 40); if (!map.has(k)) map.set(k, []); map.get(k).push(o); };
  for (const side of [-1, 1]) {
    let acc = 0, px = null, py = null;
    for (let i = 0; i <= tr.N; i++) {
      const k = i % tr.N, x = tr.P[k].x - tr.TY[k] * side * (WALL + 12), y = tr.P[k].y + tr.TX[k] * side * (WALL + 12);
      if (px !== null) acc += Math.hypot(x - px, y - py);
      px = x; py = y;
      if (acc < (th.wall === 'blocks' ? 34 : 19)) continue;
      acc = 0;
      if (distGlobal(tr, x, y) < WALL + 4) continue;
      const o = { x, y, r: wr - 1, a: Math.atan2(tr.TY[k], tr.TX[k]), n: walls.length };
      if (occupied(x, y, wr - 1, hashW)) continue;
      walls.push(o); addHash(o, hashW);
    }
  }
  tr.walls = walls;
  // decorations
  const hashD = new Map();
  const tryPlace = (x, y, type) => {
    const sz = { rock: [16, 34], cactus: [14, 22], bush: [12, 22], barrels: [14, 20], wreck: [26, 26], container: [34, 40], crate: [12, 18],
      roof: [70, 120], stain: [20, 40], pine: [22, 40], rocksnow: [16, 32], tree: [26, 46], burnt: [22, 36], log: [18, 26] }[type] || [20, 30];
    const r = sz[0] + rng() * (sz[1] - sz[0]);
    if (x < -r || y < -r || x > tr.W + r || y > tr.H + r) return;
    if (distGlobal(tr, x, y) < WALL + 22 + r * (type === 'roof' ? 0.75 : 0.6)) return;
    if (occupied(x, y, r * 0.8, hashD)) return;
    const o = { type, x, y, r, a: rng() * Math.PI * 2, seed: Math.floor(rng() * 1e6) };
    items.push(o); addHash(o, hashD);
  };
  const near = Math.round(tr.len / 26);
  for (let k = 0; k < near; k++) {
    const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, dist = WALL + 40 + Math.pow(rng(), 1.6) * 420;
    tryPlace(tr.P[i].x - tr.TY[i] * side * dist, tr.P[i].y + tr.TX[i] * side * dist, pick2(rng, th.decor));
  }
  const far = Math.round(tr.W * tr.H / 26000);
  for (let k = 0; k < far; k++) tryPlace(rng() * tr.W, rng() * tr.H, pick2(rng, th.decor));
  items.sort((a, b) => a.y - b.y);
  tr.decor = items;
  // ground blotches
  tr.blots = [];
  for (let k = 0; k < Math.round(tr.W * tr.H / 90000); k++) tr.blots.push({ x: rng() * tr.W, y: rng() * tr.H, r: 80 + rng() * 260, c: th.blots[k % th.blots.length] });
  // lamps for the night theme
  tr.lamps = [];
  if (th.lamps) {
    for (let i = 0, side = 1; i < tr.N; i += 34, side = -side) {
      const x = tr.P[i].x - tr.TY[i] * side * (WALL + 30), y = tr.P[i].y + tr.TX[i] * side * (WALL + 30);
      if (distGlobal(tr, x, y) > WALL + 14) tr.lamps.push({ x, y, ox: tr.TY[i] * side, oy: -tr.TX[i] * side, c: [i % 3] });
    }
  }
}
const pick2 = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ---------------- world rendering into chunk textures ----------------
function trackPath(tr) {
  const p = new Path2D(); p.moveTo(tr.P[0].x, tr.P[0].y);
  for (let i = 1; i < tr.N; i++) p.lineTo(tr.P[i].x, tr.P[i].y);
  p.closePath(); return p;
}

function makeTileSet(th, seed) {
  return {
    ground: noiseTile(256, th.g1, th.g2, 4, seed, 10, th.specks),
    run: noiseTile(128, th.run1, th.run2, 8, seed + 5, 22, [['rgba(0,0,0,0.25)', 120, 1], ['rgba(255,255,255,0.18)', 80, 0.9]]),
    road: noiseTile(128, th.road1, th.road2, 8, seed + 9, 14, [['rgba(255,255,255,0.08)', 150, 0.7], ['rgba(0,0,0,0.18)', 90, 0.9]])
  };
}

function renderTrackTextures(scene, tr) {
  const pre = 'trk' + tr.idx + '_';
  // free other tracks' chunks (mobile memory)
  scene.textures.getTextureKeys().forEach(k => { if (/^trk\d+_/.test(k) && !k.startsWith(pre)) scene.textures.remove(k); });
  const cols = Math.ceil(tr.W / CHUNK), rows = Math.ceil(tr.H / CHUNK), chunks = [];
  let tiles = null, path = null;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const key = pre + cx + '_' + cy, ox = cx * CHUNK, oy = cy * CHUNK;
    const w = Math.min(CHUNK, tr.W - ox), h = Math.min(CHUNK, tr.H - oy);
    if (!scene.textures.exists(key)) {
      if (!tiles) { tiles = makeTileSet(tr.theme, 50 + tr.idx); path = trackPath(tr); }
      const cv = makeCanvas(w, h);
      drawWorld(cv.getContext('2d'), tr, ox, oy, w, h, tiles, path);
      scene.textures.addCanvas(key, cv);
    }
    chunks.push({ key, x: ox, y: oy });
  }
  return chunks;
}

function drawWorld(g, tr, ox, oy, w, h, tiles, path) {
  const th = tr.theme;
  const inView = (x, y, r) => x + r > ox && x - r < ox + w && y + r > oy && y - r < oy + h;
  g.save(); g.translate(-ox, -oy);
  g.fillStyle = g.createPattern(tiles.ground, 'repeat'); g.fillRect(ox, oy, w, h);
  for (const b of tr.blots) if (inView(b.x, b.y, b.r)) {
    const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); gr.addColorStop(0, b.c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  g.lineJoin = 'round'; g.lineCap = 'round';
  const stroke = (wd, style, dash) => {
    g.lineWidth = wd; g.strokeStyle = style; g.setLineDash(dash || []);
    g.lineCap = dash && wd > 10 ? 'butt' : 'round';     // round caps would fill the gaps of wide dashes
    g.stroke(path);
  };
  // run-off zone and its soft edge
  stroke((WALL + 26) * 2, 'rgba(0,0,0,0.12)');
  stroke((WALL + 16) * 2, g.createPattern(tiles.run, 'repeat'));
  // curbs
  stroke((HW + 11) * 2, th.curbB);
  stroke((HW + 11) * 2, th.curbA, [24, 24]);
  stroke((HW + 3) * 2, 'rgba(0,0,0,0.35)');
  // asphalt + edge lines
  const road = g.createPattern(tiles.road, 'repeat');
  stroke(HW * 2, road);
  stroke((HW - 7) * 2, 'rgba(235,235,235,0.75)');
  stroke((HW - 10) * 2, road);
  stroke(HW * 0.9, 'rgba(0,0,0,0.07)');           // racing line wear
  stroke(3, th.line, [28, 34]);
  g.setLineDash([]);
  // start line + grid slots
  const p0 = tr.P[0];
  if (inView(p0.x, p0.y, HW + 40)) {
    g.save(); g.translate(p0.x, p0.y); g.rotate(tr.A[0]);
    const sq = 9;
    for (let c = 0; c < 2; c++) for (let r = 0; r < Math.ceil(HW * 2 / sq); r++) {
      const yy = -HW + r * sq;
      g.fillStyle = (c + r) % 2 ? '#111' : '#f4f4f4'; g.fillRect(-sq + c * sq, yy, sq, Math.min(sq, HW - yy));
    }
    g.restore();
  }
  for (const s of tr.slots) if (inView(s.x, s.y, 50)) {
    g.save(); g.translate(s.x, s.y); g.rotate(s.a);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(30, -17); g.lineTo(30, 17); g.moveTo(30, -17); g.lineTo(14, -17); g.moveTo(30, 17); g.lineTo(14, 17); g.stroke();
    g.restore();
  }
  // lamp glow on the ground
  for (const l of tr.lamps) if (inView(l.x, l.y, 190)) {
    const gx = l.x + l.ox * 70, gy = l.y + l.oy * 70;
    const gr = g.createRadialGradient(gx, gy, 0, gx, gy, 180);
    gr.addColorStop(0, 'rgba(255,215,150,0.28)'); gr.addColorStop(0.6, 'rgba(255,190,120,0.1)'); gr.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = gr; g.fillRect(gx - 180, gy - 180, 360, 360);
  }
  // walls
  for (const o of tr.walls) if (inView(o.x, o.y, 30)) drawWall(g, th.wall, o);
  // decor: shadows first, then objects
  for (const o of tr.decor) if (inView(o.x, o.y, o.r * 2 + 30)) drawDecor(g, o, true);
  for (const o of tr.decor) if (inView(o.x, o.y, o.r * 2 + 30)) drawDecor(g, o, false);
  for (const l of tr.lamps) if (inView(l.x, l.y, 30)) {
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(l.x + 4, l.y + 5, 7, 0, 7); g.fill();
    g.fillStyle = '#555'; g.beginPath(); g.arc(l.x, l.y, 6, 0, 7); g.fill();
    g.strokeStyle = '#777'; g.lineWidth = 4; g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(l.x + l.ox * 40, l.y + l.oy * 40); g.stroke();
    g.fillStyle = '#ffe8b0'; g.beginPath(); g.arc(l.x + l.ox * 40, l.y + l.oy * 40, 5, 0, 7); g.fill();
  }
  g.restore();
}

function drawWall(g, type, o) {
  const { x, y } = o;
  if (type === 'blocks') {
    g.save(); g.translate(x, y); g.rotate(o.a);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-15, -5, 34, 15);
    const stripe = o.n % 2 === 0;
    g.fillStyle = '#b9b9b4'; g.fillRect(-17, -7, 32, 14);
    g.fillStyle = '#d8d8d2'; g.fillRect(-17, -7, 32, 5);
    if (stripe) { g.fillStyle = '#d23b2a'; for (let k = -14; k < 14; k += 10) g.fillRect(k, -7, 5, 14); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.strokeRect(-17, -7, 32, 14);
    g.restore();
    return;
  }
  if (type === 'snow') {
    g.fillStyle = 'rgba(80,100,130,0.25)'; g.beginPath(); g.arc(x + 3, y + 4, 13, 0, 7); g.fill();
    g.fillStyle = '#f7fbff'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill();
    g.fillStyle = '#dbe6f1'; g.beginPath(); g.arc(x + 3, y + 3, 6, 0, 7); g.fill();
    if (o.n % 3 !== 0) return;
  }
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(x + 3, y + 4, 10, 0, 7); g.fill();
  const painted = o.n % 6 < 2;
  g.fillStyle = painted ? (o.n % 6 === 0 ? '#e8e8e8' : '#c62a2a') : '#1c1c1c'; g.beginPath(); g.arc(x, y, 9.5, 0, 7); g.fill();
  g.strokeStyle = painted ? 'rgba(0,0,0,0.35)' : '#3a3a3a'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6.5, 0, 7); g.stroke();
  g.fillStyle = '#080808'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
}

function blob(g, x, y, r, n, rng, jitter) {
  g.beginPath();
  for (let k = 0; k <= n; k++) {
    const a = k / n * Math.PI * 2, rr = r * (1 - jitter + rng() * jitter * 2);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    k ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
}
function circ(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); g.fill(); }

function drawDecor(g, o, shadow) {
  const rng = mulberry(o.seed), r = o.r, sx = 9, sy = 11;
  const sh = 'rgba(0,0,0,0.33)';
  g.save(); g.translate(o.x, o.y);
  switch (o.type) {
    case 'rock': case 'rocksnow': {
      if (shadow) { blob(g, 5, 6, r, 9, rng, 0.2); g.fillStyle = sh; g.fill(); break; }
      blob(g, 0, 0, r, 9, rng, 0.2);
      const gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, '#9a8f84'); gr.addColorStop(1, '#5d554d');
      g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.5; g.stroke();
      blob(g, -r * 0.25, -r * 0.25, r * 0.5, 7, rng, 0.25); g.fillStyle = o.type === 'rocksnow' ? '#f6faff' : 'rgba(255,255,255,0.15)'; g.fill();
      break;
    }
    case 'cactus': {
      const arms = [[1, 0], [-1, 0.5], [0.2, 1]];
      if (shadow) { g.translate(sx * 0.8, sy * 0.8); }
      const col = shadow ? sh : '#3f7d3a';
      for (const [ax, ay] of arms) {
        const a = Math.atan2(ay, ax) + o.a;
        g.strokeStyle = col; g.lineWidth = r * 0.45; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke();
        if (!shadow) circ(g, Math.cos(a) * r, Math.sin(a) * r, r * 0.22, '#5aa04f');
      }
      circ(g, 0, 0, r * 0.42, shadow ? sh : '#4b9144');
      if (!shadow) circ(g, -r * 0.1, -r * 0.1, r * 0.2, '#6cbf5f');
      break;
    }
    case 'bush': {
      for (let k = 0; k < 6; k++) {
        const a = rng() * 7, d = rng() * r * 0.6, rr = r * (0.35 + rng() * 0.3);
        circ(g, Math.cos(a) * d + (shadow ? 5 : 0), Math.sin(a) * d + (shadow ? 6 : 0), rr, shadow ? sh : k % 2 ? '#8a7a3c' : '#a08e47');
      }
      break;
    }
    case 'barrels': {
      const cols = ['#c0392b', '#2f6fb5', '#d6a21c', '#3d8f4a'];
      const n = 3 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const a = k / n * 7 + o.a, d = k ? r * 0.55 : 0, bx = Math.cos(a) * d, by = Math.sin(a) * d;
        if (shadow) { circ(g, bx + 5, by + 6, 9, sh); continue; }
        circ(g, bx, by, 9, cols[(o.seed + k) % 4]); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(bx, by, 6, 0, 7); g.stroke(); circ(g, bx - 2, by - 2, 2, 'rgba(255,255,255,0.35)');
      }
      break;
    }
    case 'wreck': {
      g.rotate(o.a);
      if (shadow) { g.fillStyle = sh; g.fillRect(-20, -9, 46, 26); break; }
      g.fillStyle = '#5b3a22'; g.fillRect(-23, -12, 46, 24);
      g.fillStyle = '#3a2416'; g.fillRect(-8, -10, 16, 20);
      g.fillStyle = '#7a4a2a'; g.fillRect(-23, -12, 10, 24); g.fillRect(14, -12, 9, 24);
      g.fillStyle = '#1a1a1a'; [[-14, -14], [10, -14], [-14, 10], [10, 10]].forEach(([wx, wy]) => g.fillRect(wx, wy, 9, 4));
      break;
    }
    case 'container': {
      g.rotate(Math.round(o.a / (Math.PI / 2)) * Math.PI / 2 + (rng() - 0.5) * 0.2);
      const lw = r * 2.4, lh = r * 0.95;
      if (shadow) { g.fillStyle = sh; g.fillRect(-lw / 2 + 10, -lh / 2 + 12, lw, lh); break; }
      const cols = ['#b8432f', '#2f6aa1', '#3f8a4c', '#c98a22', '#6d4c8f'];
      const c = cssRGB(cols[o.seed % cols.length]);
      g.fillStyle = shade(c, 0); g.fillRect(-lw / 2, -lh / 2, lw, lh);
      g.strokeStyle = shade(c, -0.35); g.lineWidth = 2;
      for (let x = -lw / 2 + 6; x < lw / 2 - 2; x += 7) { g.beginPath(); g.moveTo(x, -lh / 2 + 2); g.lineTo(x, lh / 2 - 2); g.stroke(); }
      g.strokeStyle = shade(c, -0.5); g.strokeRect(-lw / 2, -lh / 2, lw, lh);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-lw / 2, -lh / 2, lw, lh * 0.3);
      break;
    }
    case 'crate': {
      g.rotate(o.a);
      if (shadow) { g.fillStyle = sh; g.fillRect(-r + 6, -r + 7, r * 2, r * 2); break; }
      g.fillStyle = '#a0723f'; g.fillRect(-r, -r, r * 2, r * 2);
      g.strokeStyle = '#6b4a26'; g.lineWidth = 2.5; g.strokeRect(-r + 1, -r + 1, r * 2 - 2, r * 2 - 2);
      g.beginPath(); g.moveTo(-r, -r); g.lineTo(r, r); g.moveTo(r, -r); g.lineTo(-r, r); g.stroke();
      break;
    }
    case 'roof': {
      g.rotate(Math.round(o.a / (Math.PI / 2)) * Math.PI / 2);
      const lw = r * 1.6, lh = r * (0.9 + rng() * 0.5);
      if (shadow) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(-lw / 2 + 18, -lh / 2 + 22, lw, lh); break; }
      const night = o.type === 'roof' && rng() < 0.5;
      const base = cssRGB(pick2(rng, ['#8a8580', '#6e6a66', '#94765e', '#5f6670']));
      g.fillStyle = shade(base, -0.2); g.fillRect(-lw / 2, -lh / 2, lw, lh);
      g.fillStyle = shade(base, 0); g.fillRect(-lw / 2 + 5, -lh / 2 + 5, lw - 10, lh - 10);
      g.strokeStyle = shade(base, -0.35); g.lineWidth = 1;
      for (let k = 0; k < 4; k++) { const x = -lw / 2 + 5 + rng() * (lw - 30), y = -lh / 2 + 5 + rng() * (lh - 30); g.fillStyle = '#9da3a8'; g.fillRect(x, y, 16, 12); g.strokeRect(x, y, 16, 12); circ(g, x + 8, y + 6, 4, '#5a5f63'); }
      if (night) { g.fillStyle = 'rgba(255,60,160,0.75)'; g.fillRect(-lw / 2 + 8, lh / 2 - 12, lw * 0.5, 5); }
      break;
    }
    case 'stain': {
      if (shadow) break;
      for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(10,10,10,0.18)'; blob(g, (rng() - 0.5) * r, (rng() - 0.5) * r, r * (0.4 + rng() * 0.5), 10, rng, 0.25); g.fill(); }
      break;
    }
    case 'pine': {
      if (shadow) { g.translate(12, 14); }
      for (let layer = 0; layer < 3; layer++) {
        const rr = r * (1 - layer * 0.28), n = 8;
        g.beginPath();
        for (let k = 0; k <= n * 2; k++) { const a = k / (n * 2) * Math.PI * 2 + o.a + layer, d = k % 2 ? rr * 0.55 : rr; const px = Math.cos(a) * d, py = Math.sin(a) * d; k ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.closePath();
        g.fillStyle = shadow ? (layer ? 'rgba(0,0,0,0)' : 'rgba(40,60,90,0.3)') : ['#1f4a33', '#2a5e40', '#367250'][layer]; g.fill();
        if (!shadow) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.save(); g.clip(); circ(g, -rr * 0.35, -rr * 0.35, rr * 0.55, 'rgba(255,255,255,0.45)'); g.restore(); }
      }
      if (!shadow) circ(g, 0, 0, r * 0.1, '#f2f6fa');
      break;
    }
    case 'tree': case 'burnt': {
      const burnt = o.type === 'burnt';
      if (shadow) { circ(g, 12, 15, r * (burnt ? 0.7 : 0.95), 'rgba(0,0,0,0.3)'); break; }
      const cols = burnt ? ['#2a2420', '#3a312a', '#4a3d33'] : ['#2b4a1c', '#3a6326', '#4f7d33'];
      for (let layer = 0; layer < 3; layer++) {
        const rr = r * (burnt ? 0.7 : 1) * (1 - layer * 0.25);
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * 7 + rng(), d = rr * 0.45;
          circ(g, Math.cos(a) * d - layer * 3, Math.sin(a) * d - layer * 3, rr * 0.55, cols[layer]);
        }
      }
      if (burnt) { g.strokeStyle = '#1a1512'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { const a = rng() * 7; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); } circ(g, 0, 0, 5, '#ff6a1a'); }
      else circ(g, -r * 0.3, -r * 0.3, r * 0.22, 'rgba(255,255,200,0.12)');
      break;
    }
    case 'log': {
      g.rotate(o.a);
      if (shadow) { g.fillStyle = sh; g.fillRect(-r + 5, -6, r * 2, 14); break; }
      g.fillStyle = '#6b4a2b'; g.fillRect(-r, -7, r * 2, 14);
      g.fillStyle = '#8a6440'; g.fillRect(-r, -7, r * 2, 4);
      circ(g, r, 0, 7, '#b08a5c'); g.strokeStyle = '#7a5a36'; g.lineWidth = 1; g.beginPath(); g.arc(r, 0, 4, 0, 7); g.stroke();
      break;
    }
  }
  g.restore();
}

// ---------------- cars ----------------
const CAR_SHAPES = [
  { len: 21, rear: -21, hw: 11, wheelX: 13, wheelY: 10.5, wheel: [10, 6], cab: { wf: 9, wr: 3, rr: -8, rw: -13, cw: 8.3 } },
  { len: 23, rear: -22, hw: 11, wheelX: 14, wheelY: 10.5, wheel: [10, 6], cab: { wf: 6, wr: 0, rr: -9, rw: -14, cw: 8 } },
  { len: 24, rear: -22, hw: 12, wheelX: 14, wheelY: 11.5, wheel: [11, 6], cab: { wf: 5, wr: -1, rr: -7, rw: -12, cw: 7.6 } },
  { len: 24, rear: -24, hw: 12.5, wheelX: 15, wheelY: 12, wheel: [12, 7], cab: { wf: 12, wr: 7, rr: -14, rw: -18, cw: 9.5 } }
];
function carBodyPath(shape) {
  const p = new Path2D();
  const poly = pts => { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); };
  if (shape === 0) { p.roundRect ? p.roundRect(-21, -11, 42, 22, 9) : poly([[-21, -11], [21, -11], [21, 11], [-21, 11]]); }
  else if (shape === 1) poly([[-22, -10], [-20, -11], [10, -11], [19, -8.5], [23, -4], [23, 4], [19, 8.5], [10, 11], [-20, 11], [-22, 10]]);
  else if (shape === 2) poly([[-22, -12], [-6, -12], [8, -10.5], [19, -6.5], [24, -2.5], [24, 2.5], [19, 6.5], [8, 10.5], [-6, 12], [-22, 12]]);
  else poly([[-24, -12.5], [20, -12.5], [23, -10], [24, -5], [24, 5], [23, 10], [20, 12.5], [-24, 12.5]]);
  return p;
}
function drawCar(g, shape, color) {
  const S = CAR_SHAPES[shape], c = hexRGB(color), body = carBodyPath(shape);
  // wheels
  g.fillStyle = '#121212';
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const [ww, wh] = S.wheel; g.fillRect(sx * S.wheelX - ww / 2, sy * S.wheelY - wh / 2, ww, wh);
  }
  // body with lengthwise lighting
  const gr = g.createLinearGradient(0, -S.hw, 0, S.hw);
  gr.addColorStop(0, shade(c, -0.45)); gr.addColorStop(0.22, shade(c, 0)); gr.addColorStop(0.45, shade(c, 0.32));
  gr.addColorStop(0.7, shade(c, -0.05)); gr.addColorStop(1, shade(c, -0.5));
  g.fillStyle = gr; g.fill(body);
  g.lineWidth = 0.9; g.strokeStyle = shade(c, -0.6); g.stroke(body);
  g.save(); g.clip(body);
  if (shape === 1) { g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-24, -3.4, 50, 2.2); g.fillRect(-24, 1.2, 50, 2.2); }
  if (shape === 2) { g.fillStyle = 'rgba(15,15,15,0.75)'; g.fillRect(-24, -1.6, 50, 3.2); }
  if (shape === 3) { g.fillStyle = shade(c, -0.3); g.fillRect(-24, -12.5, 48, 3); g.fillRect(-24, 9.5, 48, 3); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = -20; x < 22; x += 6) { circ(g, x, -11, 0.7, 'rgba(0,0,0,0.5)'); circ(g, x, 11, 0.7, 'rgba(0,0,0,0.5)'); } }
  g.restore();
  // cabin
  const k = S.cab, glass = g.createLinearGradient(k.rw, 0, k.wf, 0);
  glass.addColorStop(0, '#1a2330'); glass.addColorStop(1, '#55728f');
  g.fillStyle = glass;
  g.beginPath(); g.moveTo(k.wr, -k.cw); g.lineTo(k.wf, -k.cw + 2.2); g.lineTo(k.wf, k.cw - 2.2); g.lineTo(k.wr, k.cw); g.closePath(); g.fill();
  g.fillStyle = '#16202b';
  g.beginPath(); g.moveTo(k.rr, -k.cw); g.lineTo(k.rw, -k.cw + 2); g.lineTo(k.rw, k.cw - 2); g.lineTo(k.rr, k.cw); g.closePath(); g.fill();
  const rg = g.createLinearGradient(0, -k.cw, 0, k.cw);
  rg.addColorStop(0, shade(c, -0.25)); rg.addColorStop(0.45, shade(c, 0.38)); rg.addColorStop(1, shade(c, -0.3));
  g.fillStyle = rg; g.fillRect(k.rr, -k.cw, k.wr - k.rr, k.cw * 2);
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 0.6; g.strokeRect(k.rr, -k.cw, k.wr - k.rr, k.cw * 2);
  if (shape === 0) { circ(g, (k.rr + k.wr) / 2, 0, 4, '#f4f4f4'); circ(g, (k.rr + k.wr) / 2, 0, 2.6, shade(c, -0.2)); }
  // gun on the hood
  g.fillStyle = '#1d1d1d'; g.fillRect(k.wf + 1.5, -1.4, S.len - k.wf - 1, 2.8);
  g.fillStyle = '#444'; g.fillRect(k.wf + 1, -2.6, 4, 5.2);
  // lights
  g.fillStyle = '#fff4c2';
  g.beginPath(); g.ellipse(S.len - 2, -S.hw + 3.6, 1.6, 2.5, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(S.len - 2, S.hw - 3.6, 1.6, 2.5, 0, 0, 7); g.fill();
  g.fillStyle = '#ff2a2a'; g.fillRect(S.rear, -S.hw + 2, 1.8, 4); g.fillRect(S.rear, S.hw - 6, 1.8, 4);
  // extras
  if (shape === 2) { g.fillStyle = '#1a1a1a'; g.fillRect(-24, -12.5, 4, 25); g.fillStyle = shade(c, -0.2); g.fillRect(-23.5, -12, 3, 24); }
  if (shape === 3) { g.strokeStyle = '#2a2a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(25.5, -10); g.lineTo(26.5, -4); g.lineTo(26.5, 4); g.lineTo(25.5, 10); g.stroke(); }
}
function carTexture(scene, shape, color) {
  const key = `car${shape}_${color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const cv = makeCanvas(128, 64), g = cv.getContext('2d');
  g.translate(64, 32); g.scale(CAR_RES, CAR_RES); drawCar(g, shape, color);
  scene.textures.addCanvas(key, cv);
  return key;
}
function carShadowTexture(scene, shape) {
  const key = 'carsh' + shape;
  if (scene.textures.exists(key)) return key;
  const cv = makeCanvas(128, 64), g = cv.getContext('2d');
  g.translate(64, 32); g.scale(CAR_RES, CAR_RES);
  try { g.filter = 'blur(2px)'; } catch (e) { /* ignore */ }
  g.fillStyle = '#000'; g.fill(carBodyPath(shape));
  const S = CAR_SHAPES[shape];
  g.fillRect(-S.wheelX - 6, -S.wheelY - 3, S.wheelX * 2 + 12, S.wheelY * 2 + 6);
  scene.textures.addCanvas(key, cv);
  return key;
}

// ---------------- fx textures ----------------
function makeFxTextures(scene) {
  const add = (key, w, h, fn) => { if (scene.textures.exists(key)) return; const cv = makeCanvas(w, h); fn(cv.getContext('2d'), w, h); scene.textures.addCanvas(key, cv); };
  add('soft', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  add('smoke', 64, 64, (g) => {
    const rng = mulberry(7);
    for (let k = 0; k < 7; k++) { const x = 20 + rng() * 24, y = 20 + rng() * 24, r = 12 + rng() * 10; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  });
  add('spark', 32, 8, (g) => { const gr = g.createLinearGradient(0, 0, 32, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.beginPath(); g.ellipse(16, 4, 16, 3, 0, 0, 7); g.fill(); });
  add('skid', 8, 8, (g) => { g.fillStyle = 'rgba(20,20,20,0.9)'; g.beginPath(); g.ellipse(4, 4, 4, 2.6, 0, 0, 7); g.fill(); });
  add('px', 4, 4, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); });
  add('ring', 128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.stroke(); });
  add('mine', 40, 40, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(22, 23, 13, 0, 7); g.fill();
    g.fillStyle = '#555'; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.fillRect(20 + Math.cos(a) * 13 - 2, 20 + Math.sin(a) * 13 - 2, 4, 4); }
    const gr = g.createRadialGradient(17, 17, 1, 20, 20, 12); gr.addColorStop(0, '#8a8f94'); gr.addColorStop(1, '#2c2f33');
    g.fillStyle = gr; g.beginPath(); g.arc(20, 20, 11, 0, 7); g.fill();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 1.5; g.stroke();
  });
  add('cone', 256, 128, (g) => {
    g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 0); g.lineTo(256, 128); g.closePath(); g.clip();
    const gr = g.createRadialGradient(0, 64, 0, 0, 64, 256); gr.addColorStop(0, 'rgba(255,245,200,0.9)'); gr.addColorStop(0.5, 'rgba(255,240,190,0.35)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  });
  const pk = (key, bg, icon) => add(key, 48, 48, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(26, 27, 19, 0, 7); g.fill();
    const gr = g.createRadialGradient(19, 17, 2, 24, 24, 20); gr.addColorStop(0, shade(cssRGB(bg), 0.4)); gr.addColorStop(1, bg);
    g.fillStyle = gr; g.beginPath(); g.arc(24, 24, 18, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; icon(g);
  });
  pk('pk_cash', '#1e9e4a', g => { g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 24, 25); });
  pk('pk_ammo', '#c28a14', g => { for (let k = -1; k <= 1; k++) { g.fillRect(21 + k * 7, 19, 5, 14); g.beginPath(); g.arc(23.5 + k * 7, 19, 2.5, Math.PI, 0); g.fill(); } });
  pk('pk_fix', '#2f6fd0', g => { g.fillRect(14, 21, 20, 6); g.fillRect(21, 14, 6, 20); });
  pk('pk_nitro', '#c0309a', g => { g.beginPath(); g.moveTo(27, 10); g.lineTo(16, 27); g.lineTo(23, 27); g.lineTo(20, 38); g.lineTo(32, 20); g.lineTo(25, 20); g.closePath(); g.fill(); });
}
