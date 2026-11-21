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
  desert: { ripples: true, g1: '#c39a5a', g2: '#a47944', run1: '#a07646', run2: '#86613a', road1: '#5f5850', road2: '#504a43',
    curbA: '#8a3a18', curbB: '#2b2520', line: 'rgba(235,215,170,0.3)', edge: 'rgba(225,205,160,0.35)', wall: 'tires', sand: true, haze: 'sand',
    blots: ['rgba(130,85,45,0.25)', 'rgba(235,205,150,0.22)'], specks: [['rgba(90,60,30,0.35)', 90, 1.2], ['rgba(240,215,165,0.4)', 70, 1]],
    decor: ['burnwreck', 'rock', 'spire', 'wreck', 'bones', 'bush', 'firebarrel', 'skull', 'rock', 'wreckpile', 'cactus', 'spire'] },
  scrap: { g1: '#6e6052', g2: '#5a4e42', run1: '#54493e', run2: '#463c33', road1: '#403a34', road2: '#36312c',
    curbA: '#c99a1c', curbB: '#1e1b18', line: 'rgba(220,180,60,0.35)', edge: 'rgba(200,170,90,0.3)', wall: 'blocks', sand: true, haze: 'sand',
    blots: ['rgba(30,24,18,0.3)', 'rgba(150,110,70,0.2)'], specks: [['rgba(25,20,15,0.4)', 120, 1.1], ['rgba(160,120,80,0.3)', 60, 0.9]],
    decor: ['burnwreck', 'wreckpile', 'container', 'shack', 'barrels', 'wreck', 'stain', 'pumpjack', 'firebarrel', 'wreckpile', 'shack'] },
  salt: { g1: '#e4d9c4', g2: '#cfc0a4', run1: '#bfae8c', run2: '#ab9a78', road1: '#8a7a64', road2: '#7a6b57',
    curbA: '#8a3a18', curbB: '#e0d6c2', line: 'rgba(60,45,30,0.25)', edge: 'rgba(60,45,30,0.2)', wall: 'tires', sand: true, cracks: true, haze: 'sand',
    blots: ['rgba(170,150,115,0.25)', 'rgba(255,250,240,0.3)'], specks: [['rgba(140,120,90,0.3)', 70, 1], ['rgba(255,255,250,0.6)', 90, 1]],
    decor: ['burnwreck', 'bones', 'rock', 'skull', 'wreck', 'spire', 'bones', 'rock', 'wreckpile'] },
  ash: { g1: '#3d3935', g2: '#2b2825', run1: '#4a423a', run2: '#3b342e', road1: '#3f3b37', road2: '#34312d',
    curbA: '#8a2a14', curbB: '#1a1715', line: 'rgba(255,140,60,0.22)', edge: 'rgba(200,180,160,0.18)', wall: 'tires', haze: 'ash',
    blots: ['rgba(0,0,0,0.3)', 'rgba(110,100,90,0.2)'], specks: [['rgba(10,8,6,0.45)', 110, 1.2], ['rgba(150,140,130,0.3)', 80, 1], ['rgba(255,110,30,0.7)', 14, 0.9]],
    decor: ['burnwreck', 'burnt', 'burnt', 'rock', 'wreck', 'firebarrel', 'burnt', 'bones', 'spire', 'wreckpile'] },
  night: { g1: '#2b241f', g2: '#1f1915', run1: '#3a302a', run2: '#2e2621', road1: '#312b26', road2: '#28231f',
    curbA: '#d2581c', curbB: '#14110f', line: 'rgba(255,150,60,0.35)', edge: 'rgba(255,170,90,0.25)', wall: 'blocks', haze: 'ember',
    blots: ['rgba(0,0,0,0.3)', 'rgba(120,70,40,0.18)'], specks: [['rgba(0,0,0,0.4)', 100, 1], ['rgba(150,100,70,0.25)', 60, 0.8]],
    decor: ['burnwreck', 'shack', 'wreckpile', 'firebarrel', 'container', 'shack', 'firebarrel', 'pumpjack'], lamps: true },
  canyon: { ripples: true, g1: '#b8653a', g2: '#96502c', run1: '#8c4c2a', run2: '#743d22', road1: '#5e4a40', road2: '#4e3d35',
    curbA: '#2a1a12', curbB: '#c98a4a', line: 'rgba(240,200,150,0.3)', edge: 'rgba(240,200,150,0.3)', wall: 'tires', sand: true, haze: 'sand',
    blots: ['rgba(120,50,20,0.28)', 'rgba(230,150,90,0.22)'], specks: [['rgba(80,30,10,0.35)', 100, 1.2], ['rgba(240,180,120,0.35)', 70, 1]],
    decor: ['spire', 'spire', 'rock', 'bones', 'wreck', 'burnwreck', 'skull', 'spire', 'wreckpile', 'rock'] },
  toxic: { g1: '#56623a', g2: '#3e472a', run1: '#4a5232', run2: '#3c4228', road1: '#3e403a', road2: '#34362f',
    curbA: '#b8c81c', curbB: '#1a1c14', line: 'rgba(180,230,60,0.35)', edge: 'rgba(170,210,80,0.25)', wall: 'blocks', haze: 'toxic',
    blots: ['rgba(20,30,10,0.3)', 'rgba(150,190,60,0.18)'], specks: [['rgba(15,20,8,0.4)', 110, 1.2], ['rgba(180,220,90,0.3)', 60, 1]],
    decor: ['toxicpool', 'barrels', 'wreck', 'burnwreck', 'bones', 'wreckpile', 'toxicpool', 'shack', 'stain', 'toxicpool'] }
};
// height of decor types relative to their radius (keeps tall things from covering the road)
const DECOR_H = { burnwreck: 0.6, tirefire: 1.4, spire: 3.2, shack: 1.1, roof: 1.2, pumpjack: 1.4, burnt: 1.4, tree: 1.7, pine: 2.4, wreckpile: 0.9, container: 0.7, cactus: 2.3 };

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
      roof: [70, 120], stain: [20, 40], pine: [22, 40], rocksnow: [16, 32], tree: [26, 46], burnt: [22, 36], log: [18, 26],
      spire: [24, 40], bones: [16, 24], skull: [12, 18], wreckpile: [28, 34], shack: [40, 58], pumpjack: [28, 34], firebarrel: [10, 10],
      burnwreck: [26, 26], tirefire: [16, 20], toxicpool: [30, 60] }[type] || [20, 30];
    const r = sz[0] + rng() * (sz[1] - sz[0]);
    if (x < -r || y < -r || x > tr.W + r || y > tr.H + r) return;
    if (distGlobal(tr, x, y) < WALL + 22 + r * (type === 'roof' || type === 'shack' ? 0.75 : 0.6)) return;
    const hh = (DECOR_H[type] || 0) * r * VIEW_K;          // tall objects must not reach over the road
    if (hh > 20 && (distGlobal(tr, x, y - hh * 0.5) < WALL + 10 || distGlobal(tr, x, y - hh) < WALL + 10)) return;
    if (occupied(x, y, r * 0.8, hashD)) return;
    const o = { type, x, y, r, a: rng() * Math.PI * 2, seed: Math.floor(rng() * 1e6) };
    items.push(o); addHash(o, hashD);
  };
  const near = Math.round(tr.len / 19);
  for (let k = 0; k < near; k++) {
    const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, dist = WALL + 40 + Math.pow(rng(), 1.6) * 420;
    tryPlace(tr.P[i].x - tr.TY[i] * side * dist, tr.P[i].y + tr.TX[i] * side * dist, pick2(rng, th.decor));
  }
  const far = Math.round(tr.W * tr.H / 19000);
  for (let k = 0; k < far; k++) tryPlace(rng() * tr.W, rng() * tr.H, pick2(rng, th.decor));
  items.sort((a, b) => a.y - b.y);
  tr.decor = items;
  // burning wrecks / tire piles close to the track so they are seen while racing
  for (let k = 0; k < tr.len / 520; k++) {
    const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, dist = WALL + 46 + rng() * 120;
    tryPlace(tr.P[i].x - tr.TY[i] * side * dist, tr.P[i].y + tr.TX[i] * side * dist, rng() < 0.7 ? 'burnwreck' : 'tirefire');
  }
  items.sort((a, b) => a.y - b.y);
  tr.fires = [];
  for (const o of items) {
    if (o.type === 'firebarrel') tr.fires.push({ x: o.x, y: o.y, z: 19, s: 1 });
    if (o.type === 'burnwreck') {
      const ca = Math.cos(o.a), sa = Math.sin(o.a);
      tr.fires.push({ x: o.x + ca * 10, y: o.y + sa * 10, z: 14, s: 1.7, big: true }, { x: o.x - ca * 8, y: o.y - sa * 8, z: 12, s: 1.2 });
    }
    if (o.type === 'tirefire') tr.fires.push({ x: o.x, y: o.y, z: 22, s: 1.5, big: true });
  }
  // small ground debris (pebbles, scrap bits, tufts...) for detail
  const DEB = { desert: ['pebble', 'pebble', 'tuft', 'scrap', 'shred', 'pebble', 'bolt'], scrap: ['scrap', 'scrap', 'bolt', 'shred', 'pebble', 'glass'],
    salt: ['salt', 'salt', 'pebble', 'bonebit', 'tuft'], ash: ['char', 'char', 'pebble', 'ember', 'scrap'], night: ['scrap', 'bolt', 'glass', 'pebble', 'shred'],
    canyon: ['pebble', 'pebble', 'tuft', 'bonebit', 'scrap'], toxic: ['scrap', 'bolt', 'ooze', 'pebble', 'shred', 'ooze'] }[tr.themeName] || ['pebble'];
  tr.debris = [];
  for (let k = 0; k < tr.W * tr.H / (LOW_MEM ? 900 : 560); k++) {
    const x = rng() * tr.W, y = rng() * tr.H, dd = distGlobal(tr, x, y);
    if (dd < HW + 4 && rng() > 0.12) continue;
    tr.debris.push({ t: dd < HW + 4 ? 'pebble' : pick2(rng, DEB), x, y, a: rng() * 7, s: 0.6 + rng() * 0.9, c: rng() });
  }
  tr.marks = [];
  // tar patches and old skid marks in the corners
  for (let k = 0; k < tr.len / 450; k++) {
    const i = Math.floor(rng() * tr.N), lat = (rng() * 2 - 1) * (HW - 35);
    tr.marks.push({ t: 'patch', x: tr.P[i].x - tr.TY[i] * lat, y: tr.P[i].y + tr.TX[i] * lat, w: 30 + rng() * 50, h: 18 + rng() * 30, a: tr.A[i] + (rng() - 0.5) * 0.4 });
  }
  for (let i = 0; i < tr.N; i += 9) {
    const turn = angDiff(tr.A[i], tr.A[(i + 12) % tr.N]);
    if (Math.abs(turn) < 0.35 || rng() < 0.5) continue;
    const lat = -Math.sign(turn) * rnd(10, 45), pts = [], pts2 = [];
    for (let k = 0; k < 18; k++) {
      const j = (i + k) % tr.N, l = lat + Math.sin(k / 17 * Math.PI) * Math.sign(turn) * 22;
      pts.push([tr.P[j].x - tr.TY[j] * (l - 7), tr.P[j].y + tr.TX[j] * (l - 7)]); pts2.push([tr.P[j].x - tr.TY[j] * (l + 7), tr.P[j].y + tr.TX[j] * (l + 7)]);
    }
    tr.marks.push({ t: 'skid', pts }, { t: 'skid', pts: pts2 });
  }
  // road wear: cracks, oil, sand drifts
  for (let k = 0; k < tr.len / 120; k++) {
    const i = Math.floor(rng() * tr.N), lat = (rng() * 2 - 1) * (HW - 12);
    const x = tr.P[i].x - tr.TY[i] * lat, y = tr.P[i].y + tr.TX[i] * lat;
    const pts = [[x, y]]; let a = rng() * 7;
    for (let j = 0; j < 4 + rng() * 4; j++) { a += (rng() - 0.5) * 1.6; const l = 6 + rng() * 14; const p = pts[pts.length - 1]; pts.push([p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l]); }
    tr.marks.push({ t: 'crack', pts });
  }
  for (let k = 0; k < tr.len / 380; k++) {
    const i = Math.floor(rng() * tr.N), lat = (rng() * 2 - 1) * (HW - 30);
    tr.marks.push({ t: 'oil', x: tr.P[i].x - tr.TY[i] * lat, y: tr.P[i].y + tr.TX[i] * lat, r: 14 + rng() * 22, seed: Math.floor(rng() * 1e6) });
  }
  if (th.sand) for (let k = 0; k < tr.len / 110; k++) {
    const i = Math.floor(rng() * tr.N), side = rng() < 0.5 ? -1 : 1, lat = side * (HW - rng() * 45);
    tr.marks.push({ t: 'drift', x: tr.P[i].x - tr.TY[i] * lat, y: tr.P[i].y + tr.TX[i] * lat, r: 28 + rng() * 60, a: tr.A[i] });
  }
  // ground blotches
  tr.blots = [];
  for (let k = 0; k < Math.round(tr.W * tr.H / 90000); k++) tr.blots.push({ x: rng() * tr.W, y: rng() * tr.H, r: 80 + rng() * 260, c: th.blots[k % th.blots.length] });
  // lamps for the night theme
  tr.lamps = [];
  if (th.lamps) {
    for (let i = 0, side = 1; i < tr.N; i += 34, side = -side) {
      const x = tr.P[i].x - tr.TY[i] * side * (WALL + 30), y = tr.P[i].y + tr.TX[i] * side * (WALL + 30);
      if (distGlobal(tr, x, y) > WALL + 14) {
        const l = { x, y, ox: tr.TY[i] * side, oy: -tr.TX[i] * side };
        tr.lamps.push(l); tr.fires.push({ x: x + l.ox * 40, y: y + l.oy * 40, z: 76, s: 1.3 });
      }
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

function embossTile(cv, strength) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), img = g.getImageData(0, 0, W, H), d = img.data;
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = L[((y + H - 1) % H) * W + (x + W - 1) % W], b = L[((y + 1) % H) * W + (x + 1) % W];
    const v = (a - b) * strength, i = (y * W + x) * 4;
    d[i] = clamp(d[i] + v, 0, 255); d[i + 1] = clamp(d[i + 1] + v, 0, 255); d[i + 2] = clamp(d[i + 2] + v, 0, 255);
  }
  g.putImageData(img, 0, 0);
  return cv;
}
function rippleTile(cv, seed) {
  const g = cv.getContext('2d'), S = cv.width, rng = mulberry(seed);
  g.lineCap = 'round';
  for (let y0 = 0; y0 < S; y0 += 13) {
    const ph = rng() * 7, amp = 2 + rng() * 2.5;
    for (const oy of [-S, 0, S]) for (const [dy, col] of [[0, 'rgba(60,35,15,0.16)'], [1.6, 'rgba(255,235,200,0.16)']]) {
      g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath();
      for (let x = 0; x <= S; x += 4) { const y = y0 + oy + dy + Math.sin(x / S * TAU * 2 + ph) * amp; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  }
  return cv;
}
function makeTileSet(th, seed) {
  const ground = noiseTile(256, th.g1, th.g2, 4, seed, 10, th.specks);
  if (th.cracks) {               // dried salt crust: crack network
    const g = ground.getContext('2d'), rng = mulberry(seed + 77);
    g.strokeStyle = 'rgba(120,100,70,0.45)'; g.lineWidth = 1.3; g.lineJoin = 'round';
    for (let k = 0; k < 26; k++) {
      let x = rng() * 256, y = rng() * 256, a = rng() * 7; g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 6; j++) { a += (rng() - 0.5) * 1.8; x += Math.cos(a) * 18; y += Math.sin(a) * 18; g.lineTo(x, y); }
      g.stroke();
    }
  }
  if (th.ripples) rippleTile(ground, seed + 3);
  embossTile(ground, 0.55);
  return {
    ground,
    run: embossTile(noiseTile(128, th.run1, th.run2, 8, seed + 5, 22, [['rgba(0,0,0,0.25)', 120, 1], ['rgba(255,255,255,0.18)', 80, 0.9]]), 0.7),
    road: embossTile(noiseTile(128, th.road1, th.road2, 8, seed + 9, 18, [['rgba(255,255,255,0.1)', 180, 0.7], ['rgba(0,0,0,0.22)', 110, 0.9], ['rgba(200,190,170,0.18)', 40, 1.4]]), 0.45)
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
  for (const d of tr.debris) if (inView(d.x, d.y, 12)) drawDebris(g, d);
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
  stroke((HW - 7) * 2, th.edge);
  stroke((HW - 10) * 2, road);
  stroke(HW * 0.9, 'rgba(0,0,0,0.07)');           // racing line wear
  stroke(3, th.line, [28, 34]);
  g.setLineDash([]);
  g.lineCap = 'round';
  for (const m of tr.marks) {
    if (m.t === 'crack') {
      if (!inView(m.pts[0][0], m.pts[0][1], 120)) continue;
      g.strokeStyle = 'rgba(15,12,10,0.26)'; g.lineWidth = 1.1; polyPath(g, m.pts); g.stroke();
    } else if (m.t === 'oil') {
      if (!inView(m.x, m.y, m.r * 2)) continue;
      const rr = mulberry(m.seed);
      for (let k = 0; k < 3; k++) { blob(g, m.x + (rr() - 0.5) * m.r, m.y + (rr() - 0.5) * m.r * 0.6, m.r * (0.4 + rr() * 0.5), 10, rr, 0.25); g.fillStyle = 'rgba(8,6,4,0.22)'; g.fill(); }
    } else if (m.t === 'patch') {
      if (!inView(m.x, m.y, m.w)) continue;
      g.save(); g.translate(m.x, m.y); g.rotate(m.a); g.fillStyle = 'rgba(20,18,16,0.32)'; g.fillRect(-m.w / 2, -m.h / 2, m.w, m.h);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2; g.strokeRect(-m.w / 2, -m.h / 2, m.w, m.h); g.restore();
    } else if (m.t === 'skid') {
      if (!inView(m.pts[0][0], m.pts[0][1], 260)) continue;
      g.strokeStyle = 'rgba(10,8,6,0.2)'; g.lineWidth = 5; g.beginPath(); m.pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    } else if (m.t === 'drift') {
      if (!inView(m.x, m.y, m.r * 2.2)) continue;
      g.save(); g.translate(m.x, m.y); g.rotate(m.a); g.scale(2.2, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, m.r), c = cssRGB(th.run1).join(',');
      gr.addColorStop(0, `rgba(${c},0.7)`); gr.addColorStop(0.6, `rgba(${c},0.35)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, m.r, 0, 7); g.fill(); g.restore();
    }
  }
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
    gr.addColorStop(0, 'rgba(255,150,60,0.32)'); gr.addColorStop(0.6, 'rgba(255,110,40,0.12)'); gr.addColorStop(1, 'rgba(255,100,30,0)');
    g.fillStyle = gr; g.fillRect(gx - 180, gy - 180, 360, 360);
  }
  // walls, decor and lamps have height: shadows first, then objects sorted north -> south
  const near = (x, y, m) => inView(x, y, m);
  for (const o of tr.walls) if (near(o.x, o.y, 40)) drawWallShadow(g, th.wall, o);
  for (const o of tr.decor) if (near(o.x, o.y, o.r * 2 + 170)) drawDecor(g, o, true);
  for (const l of tr.lamps) if (near(l.x, l.y, 130)) drawLamp(g, l, true);
  const tall = [];
  for (const o of tr.walls) if (near(o.x, o.y, 40)) tall.push([o.y, () => drawWall(g, th.wall, o)]);
  for (const o of tr.decor) if (near(o.x, o.y, o.r * 2 + 170)) tall.push([o.y, () => drawDecor(g, o, false)]);
  for (const l of tr.lamps) if (near(l.x, l.y, 130)) tall.push([l.y, () => drawLamp(g, l, false)]);
  tall.sort((p, q) => p[0] - q[0]).forEach(e => e[1]());
  g.restore();
}

// ---------------- 2.5D: objects with height ----------------
// The race camera squashes world Y by VIEW_IY (tilted view). Heights are drawn "up" (-y) in world
// units multiplied by VIEW_K so that after the squash they appear with the correct VIEW_IZ factor.
const VIEW_IY = 0.766, VIEW_IZ = 0.643, VIEW_K = VIEW_IZ / VIEW_IY;
const SH_X = 0.45, SH_Y = 0.32;          // ground shadow offset per unit of height (light from north-west)

function rectPts(cx, cy, w, h, a = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function polyPath(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
function prismShadow(g, pts, H, alpha = 0.3) {
  const dx = H * SH_X, dy = H * SH_Y;
  polyPath(g, hull(pts.concat(pts.map(p => [p[0] + dx, p[1] + dy]))));
  g.fillStyle = `rgba(0,0,0,${alpha})`; g.fill();
}
// convex prism: visible side faces + top; returns lifted footprint
function prism(g, pts, H, top, side, edge) {
  const up = H * VIEW_K, n = pts.length;
  const cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
  const lifted = pts.map(p => [p[0], p[1] - up]);
  const sc = cssRGB(side);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    let nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (ny <= 0.02) continue;
    polyPath(g, [a, b, lifted[(i + 1) % n], lifted[i]]);
    g.fillStyle = shade(sc, -0.1 - nx * 0.16); g.fill();
    if (edge) { g.strokeStyle = edge; g.lineWidth = 1; g.stroke(); }
  }
  polyPath(g, lifted); g.fillStyle = top; g.fill();
  if (edge) { g.strokeStyle = edge; g.lineWidth = 1; g.stroke(); }
  return lifted;
}
function cylinder(g, x, y, r, z0, H, side, top) {
  const b = y - z0 * VIEW_K, tY = y - (z0 + H) * VIEW_K;
  const gr = g.createLinearGradient(x - r, 0, x + r, 0);
  const sc = cssRGB(side); gr.addColorStop(0, shade(sc, 0.12)); gr.addColorStop(0.5, shade(sc, 0)); gr.addColorStop(1, shade(sc, -0.3));
  g.fillStyle = gr; g.beginPath(); g.arc(x, b, r, 0, Math.PI); g.lineTo(x - r, tY); g.lineTo(x + r, tY); g.closePath(); g.fill();
  g.fillStyle = top; g.beginPath(); g.arc(x, tY, r, 0, Math.PI * 2); g.fill();
  return tY;
}

function drawWallShadow(g, type, o) {
  g.fillStyle = 'rgba(0,0,0,0.3)';
  if (type === 'blocks') { prismShadow(g, rectPts(o.x, o.y, 32, 12, o.a), 14, 0.28); return; }
  g.beginPath(); g.arc(o.x + 6, o.y + 4, 11, 0, 7); g.fill();
}
function drawWall(g, type, o) {
  const { x, y } = o;
  if (type === 'blocks') {
    const stripe = o.n % 2 === 0;
    const top = prism(g, rectPts(x, y, 32, 12, o.a), 14, o.n % 3 ? '#8a6a50' : '#7a7066', o.n % 3 ? '#5e4532' : '#55504a', 'rgba(0,0,0,0.35)');
    if (stripe) {
      g.save(); polyPath(g, top); g.clip();
      g.translate(x, y - 14 * VIEW_K); g.rotate(o.a); g.fillStyle = '#c99a1c';
      for (let k = -14; k < 16; k += 10) g.fillRect(k, -7, 5, 14);
      g.restore();
    }
    return;
  }
  if (type === 'snow') {
    for (let k = 0; k < 4; k++) circ(g, x, y - k * 2.2 * VIEW_K, 12.5 - k * 2.2, k === 3 ? '#ffffff' : ['#cfdbe8', '#e1eaf3', '#eef4fa'][k]);
    if (o.n % 3 !== 0) return;
  }
  const painted = o.n % 6 < 2;
  const side = painted ? (o.n % 6 === 0 ? '#bdb29a' : '#8a3c1a') : '#202020';
  const top = painted ? (o.n % 6 === 0 ? '#d6ccb4' : '#a64a22') : '#2e2e2e';
  let tY = y;
  for (let k = 0; k < 2; k++) {
    tY = cylinder(g, x, y, 9.5, k * 7.5, 7, side, top);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y - k * 7.5 * VIEW_K, 9.5, 0, Math.PI); g.stroke();
  }
  circ(g, x, tY, 4.2, '#0a0a0a');
}

function drawLamp(g, l, shadow) {     // scrap torch pole with a fire bowl (flames are particles in the race)
  const H = 72, hx = l.x + l.ox * 40, hy = l.y + l.oy * 40;
  if (shadow) {
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(l.x + H * SH_X, l.y + H * SH_Y); g.lineTo(hx + H * SH_X, hy + H * SH_Y); g.stroke();
    return;
  }
  cylinder(g, l.x, l.y, 6, 0, 5, '#3a2a20', '#4a3628');
  cylinder(g, l.x, l.y, 3, 5, H - 5, '#5a3a24', '#6e4a2e');
  const tY = l.y - H * VIEW_K;
  g.strokeStyle = '#4a3020'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(l.x, tY); g.lineTo(hx, hy - H * VIEW_K); g.stroke();
  const lx = hx, ly = hy - H * VIEW_K;
  const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 34); gr.addColorStop(0, 'rgba(255,170,70,0.75)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gr; g.fillRect(lx - 34, ly - 34, 68, 68);
  cylinder(g, lx, ly + 6 * VIEW_K, 8, 0, 6, '#3a2a20', '#ff9a3a');
}

function drawDebris(g, d) {
  const s = d.s;
  switch (d.t) {
    case 'pebble': circ(g, d.x + 1, d.y + 1, 2.2 * s, 'rgba(0,0,0,0.25)'); circ(g, d.x, d.y, 2.2 * s, d.c < 0.5 ? '#7d7064' : '#9a8a76'); circ(g, d.x - 0.6, d.y - 0.6, 0.9 * s, 'rgba(255,255,255,0.25)'); break;
    case 'salt': circ(g, d.x, d.y, 1.8 * s, 'rgba(255,255,250,0.8)'); break;
    case 'tuft': g.strokeStyle = d.c < 0.5 ? '#a08a4a' : '#8a7a3e'; g.lineWidth = 1;
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + k * 2 * s, d.y - 5 * s); g.stroke(); } break;
    case 'scrap': g.save(); g.translate(d.x, d.y); g.rotate(d.a); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-3 * s + 1, -1.5 * s + 1, 6 * s, 3 * s);
      g.fillStyle = d.c < 0.4 ? '#7a3e1e' : d.c < 0.7 ? '#6a6660' : '#5a4430'; g.fillRect(-3 * s, -1.5 * s, 6 * s, 3 * s); g.restore(); break;
    case 'bolt': circ(g, d.x, d.y, 1.3 * s, '#8a8a82'); circ(g, d.x, d.y, 0.5 * s, '#3a3a36'); break;
    case 'glass': g.fillStyle = 'rgba(200,230,255,0.55)'; g.fillRect(d.x, d.y, 1.6 * s, 1.6 * s); break;
    case 'shred': g.strokeStyle = '#1e1c1a'; g.lineWidth = 2.2 * s; g.beginPath(); g.arc(d.x, d.y, 5 * s, d.a, d.a + 1.4); g.stroke(); break;
    case 'bonebit': g.strokeStyle = '#e6dcc4'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(d.x - 3 * s, d.y); g.lineTo(d.x + 3 * s, d.y + s); g.stroke(); break;
    case 'char': g.fillStyle = '#141210'; g.save(); g.translate(d.x, d.y); g.rotate(d.a); g.fillRect(-4 * s, -1 * s, 8 * s, 2 * s); g.restore(); break;
    case 'ember': circ(g, d.x, d.y, 2.6 * s, 'rgba(255,90,20,0.25)'); circ(g, d.x, d.y, 1 * s, '#ff8a2a'); break;
    case 'ooze': circ(g, d.x, d.y, 3.4 * s, 'rgba(150,230,40,0.25)'); circ(g, d.x, d.y, 1.6 * s, '#b8f040'); break;
  }
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
function star(g, x, y, r, n, rot) {
  g.beginPath();
  for (let k = 0; k <= n * 2; k++) { const a = k / (n * 2) * Math.PI * 2 + rot, d = k % 2 ? r * 0.58 : r; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; k ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath();
}

function drawDecor(g, o, shadow) {
  const rng = mulberry(o.seed), r = o.r, K = VIEW_K;
  const sh = 'rgba(0,0,0,0.32)';
  const axisRot = Math.round(o.a / (Math.PI / 2)) % 2 !== 0;
  g.save(); g.translate(o.x, o.y);
  switch (o.type) {
    case 'rock': case 'rocksnow': {
      const H = r * 0.75;
      if (shadow) { blob(g, H * SH_X, H * SH_Y, r, 9, mulberry(o.seed), 0.2); g.fillStyle = sh; g.fill(); break; }
      const base = [106, 98, 90];
      for (let k = 0; k <= 4; k++) {
        blob(g, 0, -H * k / 4 * K, r * (1 - k * 0.13), 9, mulberry(o.seed), 0.2);
        g.fillStyle = shade(base, -0.45 + k * 0.14); g.fill();
      }
      blob(g, -r * 0.2, -H * K - r * 0.12, r * 0.42, 7, mulberry(o.seed + 3), 0.25);
      g.fillStyle = o.type === 'rocksnow' ? '#f6faff' : 'rgba(255,255,255,0.18)'; g.fill();
      break;
    }
    case 'cactus': {
      const H = r * 2.3, cr = r * 0.26;
      if (shadow) { g.strokeStyle = sh; g.lineWidth = cr * 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(H * SH_X, H * SH_Y); g.stroke(); break; }
      const dir = rng() < 0.5 ? -1 : 1;
      const arm = (side, z, len, upLen) => {
        const yb = -z * K;
        g.strokeStyle = '#3c7a37'; g.lineWidth = cr * 1.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, yb); g.lineTo(side * len, yb); g.lineTo(side * len, yb - upLen * K); g.stroke();
        circ(g, side * len, yb - upLen * K, cr * 0.75, '#5aa04f');
      };
      arm(-dir, H * 0.42, r * 0.62, H * 0.28);
      cylinder(g, 0, 0, cr, 0, H, '#3f7d3a', '#5fae52');
      arm(dir, H * 0.55, r * 0.55, H * 0.3);
      break;
    }
    case 'bush': {
      for (let k = 0; k < 7; k++) {
        const a = rng() * 7, d = rng() * r * 0.6, rr = r * (0.35 + rng() * 0.3), z = rng() * r * 0.5;
        if (shadow) circ(g, Math.cos(a) * d + r * 0.35, Math.sin(a) * d + r * 0.25, rr, sh);
        else circ(g, Math.cos(a) * d, Math.sin(a) * d - z * K, rr, k % 2 ? '#8a7a3c' : '#a6944c');
      }
      break;
    }
    case 'barrels': {
      const cols = [['#a8321f', '#c94a35'], ['#2a5f9c', '#3d78bd'], ['#b88a14', '#d9a826'], ['#357a40', '#469552']];
      const n = 3 + Math.floor(rng() * 3), bs = [];
      for (let k = 0; k < n; k++) { const a = k / n * 7 + o.a, d = k ? r * 0.6 : 0; bs.push([Math.cos(a) * d, Math.sin(a) * d, cols[(o.seed + k) % 4]]); }
      bs.sort((a, b) => a[1] - b[1]);
      for (const [bx, by, c] of bs) {
        if (shadow) { g.fillStyle = sh; g.beginPath(); g.arc(bx + 7, by + 5, 8.5, 0, 7); g.fill(); continue; }
        const tY = cylinder(g, bx, by, 8.5, 0, 17, c[0], c[1]);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(bx, tY, 5.5, 0, 7); g.stroke();
      }
      break;
    }
    case 'wreck': {
      const pts = rectPts(0, 0, 46, 24, o.a);
      if (shadow) { prismShadow(g, pts, 12); break; }
      prism(g, pts, 9, '#6e4628', '#4a2e1a', 'rgba(0,0,0,0.35)');
      cylinder(g, 26 * Math.cos(o.a + 1.2), 18 * Math.sin(o.a + 1.2), 8, 0, 6, '#1c1c1c', '#2a2a2a');
      g.save(); g.translate(0, -9 * K); g.rotate(o.a);
      g.fillStyle = '#3a2416'; g.fillRect(-10, -9, 18, 18);
      g.fillStyle = '#8a5530'; g.fillRect(-23, -12, 9, 24);
      g.restore();
      break;
    }
    case 'container': {
      const lw = r * 2.4, lh = r * 0.95, H = 26;
      const pts = axisRot ? rectPts(0, 0, lh, lw) : rectPts(0, 0, lw, lh);
      if (shadow) { prismShadow(g, pts, H, 0.35); break; }
      const cols = ['#7a3b22', '#5a4a3a', '#6b5a2a', '#4a5a52', '#8a5a32'];
      const c = cssRGB(cols[o.seed % cols.length]);
      const top = prism(g, pts, H, shade(c, 0.08), shade(c, -0.1), 'rgba(0,0,0,0.3)');
      // ridges on the visible long side and on the roof
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys), y0 = Math.min(...ys);
      g.strokeStyle = shade(c, -0.45); g.lineWidth = 1.5;
      for (let x = x0 + 5; x < x1 - 2; x += 6) { g.beginPath(); g.moveTo(x, y1 - 2); g.lineTo(x, y1 - H * K + 2); g.stroke(); }
      g.strokeStyle = shade(c, -0.25); g.lineWidth = 1;
      if (x1 - x0 > y1 - y0) for (let x = x0 + 6; x < x1 - 3; x += 9) { g.beginPath(); g.moveTo(x, y0 - H * K + 2); g.lineTo(x, y1 - H * K - 2); g.stroke(); }
      else for (let y = y0 + 6; y < y1 - 3; y += 9) { g.beginPath(); g.moveTo(x0 + 2, y - H * K); g.lineTo(x1 - 2, y - H * K); g.stroke(); }
      void top;
      break;
    }
    case 'crate': {
      const pts = rectPts(0, 0, r * 2, r * 2, o.a), H = r * 1.7;
      if (shadow) { prismShadow(g, pts, H); break; }
      const top = prism(g, pts, H, '#b0814a', '#8a6034', 'rgba(60,35,15,0.6)');
      g.strokeStyle = '#6b4a26'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(top[0][0], top[0][1]); g.lineTo(top[2][0], top[2][1]); g.moveTo(top[1][0], top[1][1]); g.lineTo(top[3][0], top[3][1]); g.stroke();
      break;
    }
    case 'roof': {
      const lw = r * 1.6, lh = r * (0.9 + rng() * 0.5), H = 38 + rng() * 70;
      const pts = axisRot ? rectPts(0, 0, lh, lw) : rectPts(0, 0, lw, lh);
      if (shadow) { prismShadow(g, pts, H, 0.4); break; }
      const base = cssRGB(pick2(rng, ['#8a8580', '#6e6a66', '#94765e', '#5f6670', '#7d6a5a']));
      prism(g, pts, H, shade(base, -0.05), shade(base, -0.15), 'rgba(0,0,0,0.35)');
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), up = H * K;
      // windows on the south wall
      const lit = rng() < 0.5;
      for (let wy = y1 - 10; wy > y1 - up + 8; wy -= 14) for (let wx = x0 + 7; wx < x1 - 12; wx += 15) {
        g.fillStyle = lit && rng() < 0.45 ? 'rgba(255,214,120,0.9)' : 'rgba(25,32,45,0.75)'; g.fillRect(wx, wy - 7, 9, 7);
      }
      // roof: parapet + AC units
      g.strokeStyle = shade(base, -0.35); g.lineWidth = 3; g.strokeRect(x0 + 2, y0 - up + 2, x1 - x0 - 4, y1 - y0 - 4);
      for (let k = 0; k < 3; k++) {
        const ux = x0 + 8 + rng() * (x1 - x0 - 30), uy = y0 + 8 + rng() * (y1 - y0 - 26);
        g.save(); g.translate(0, -up); prism(g, rectPts(ux + 8, uy + 6, 16, 12), 7, '#b0b5ba', '#7d8287'); g.restore();
        circ(g, ux + 8, uy + 6 - up - 7 * K, 3.5, '#4a4f54');
      }
      if (rng() < 0.5) { g.fillStyle = 'rgba(255,60,160,0.8)'; g.fillRect(x0 + 8, y1 - up * 0.92, (x1 - x0) * 0.45, 4); }
      break;
    }
    case 'stain': {
      if (shadow) break;
      for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(10,10,10,0.18)'; blob(g, (rng() - 0.5) * r, (rng() - 0.5) * r, r * (0.4 + rng() * 0.5), 10, rng, 0.25); g.fill(); }
      break;
    }
    case 'pine': {
      const H = r * 2.4;
      if (shadow) {
        g.fillStyle = 'rgba(40,60,90,0.28)'; g.beginPath();
        g.moveTo(-r * 0.6, r * 0.2); g.lineTo(H * SH_X * 1.1, H * SH_Y * 1.1); g.lineTo(r * 0.6, -r * 0.2); g.closePath(); g.fill();
        circ(g, 0, 0, r * 0.7, 'rgba(40,60,90,0.25)');
        break;
      }
      cylinder(g, 0, 0, r * 0.13, 0, r * 0.5, '#5a3e26', '#6b4a2e');
      const cols = ['#1d4530', '#25563b', '#2e6847', '#3a7a55'];
      for (let k = 0; k < 4; k++) {
        const z = r * 0.35 + k * H * 0.2, rr = r * (1 - k * 0.23);
        star(g, 0, -z * K, rr, 8, o.a + k); g.fillStyle = cols[k]; g.fill();
        g.save(); g.clip(); circ(g, -rr * 0.35, -z * K - rr * 0.35, rr * 0.6, 'rgba(255,255,255,0.55)'); g.restore();
      }
      circ(g, 0, -(r * 0.35 + 3 * H * 0.2) * K, r * 0.12, '#f2f6fa');
      break;
    }
    case 'tree': case 'burnt': {
      const burnt = o.type === 'burnt', H = r * (burnt ? 1.4 : 1.7);
      if (shadow) { circ(g, H * SH_X, H * SH_Y, r * (burnt ? 0.7 : 0.95), 'rgba(0,0,0,0.28)'); break; }
      cylinder(g, 0, 0, r * 0.14, 0, H * 0.55, burnt ? '#241c17' : '#5a3e26', burnt ? '#2e241e' : '#6b4a2e');
      const cols = burnt ? ['#211b17', '#2f2722', '#3d332b'] : ['#264217', '#335a20', '#457529', '#5a8c35'];
      const layers = cols.length;
      for (let L2 = 0; L2 < layers; L2++) {
        const z = H * (0.45 + L2 * 0.17), rr = r * (burnt ? 0.7 : 1) * (1 - L2 * 0.2);
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * 7 + rng(), d = rr * 0.45;
          circ(g, Math.cos(a) * d - L2 * 2, Math.sin(a) * d - z * K - L2 * 2, rr * 0.55, cols[L2]);
        }
      }
      if (burnt) {
        g.strokeStyle = '#1a1512'; g.lineWidth = 2.5;
        for (let k = 0; k < 5; k++) { const a = rng() * 7; g.beginPath(); g.moveTo(0, -H * 0.5 * K); g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.6 - H * K); g.stroke(); }
        circ(g, 0, -H * 0.55 * K, 4, '#ff6a1a');
      } else circ(g, -r * 0.35, -H * 0.95 * K - r * 0.3, r * 0.2, 'rgba(255,255,200,0.14)');
      break;
    }
    case 'spire': {             // banded sandstone pillar
      const H = r * 3.2;
      if (shadow) {
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(-r * 0.8, 0); g.lineTo(H * SH_X - r * 0.5, H * SH_Y); g.lineTo(H * SH_X + r * 0.5, H * SH_Y); g.lineTo(r * 0.8, 0); g.closePath(); g.fill();
        blob(g, 0, 0, r, 9, mulberry(o.seed), 0.18); g.fill(); break;
      }
      const bands = ['#7a4a2e', '#8f5a36', '#a5693f', '#8a5434', '#b07a4a', '#9a6440'];
      for (let k = 0; k <= 12; k++) {
        const z = H * k / 12, rr = r * (1 - k * 0.03);
        blob(g, 0, -z * K, rr, 9, mulberry(o.seed), 0.18); g.fillStyle = shade(cssRGB(bands[(k + o.seed) % bands.length]), -0.3 + k * 0.025); g.fill();
      }
      blob(g, 0, -H * K, r * 0.64, 9, mulberry(o.seed), 0.18); g.fillStyle = '#c4905e'; g.fill();
      break;
    }
    case 'bones': {
      if (shadow) break;
      const bone = '#e6dcc4';
      g.strokeStyle = bone; g.lineCap = 'round';
      g.save(); g.rotate(o.a); g.lineWidth = 2.6; g.beginPath(); g.moveTo(-r * 0.6, 0); g.lineTo(r * 0.6, 0); g.stroke();
      g.lineWidth = 1.8;
      for (let k = -2; k <= 2; k++) {
        g.beginPath(); g.arc(k * r * 0.22, 0, r * 0.34, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
        g.beginPath(); g.arc(k * r * 0.22, 0, r * 0.34, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke();
      }
      g.restore();
      for (let k = 0; k < 3; k++) {
        const a = rng() * 7, d = r * (0.8 + rng() * 0.4), bx = Math.cos(a) * d, by = Math.sin(a) * d, ba = rng() * 7;
        g.lineWidth = 2; g.beginPath(); g.moveTo(bx - Math.cos(ba) * 6, by - Math.sin(ba) * 6); g.lineTo(bx + Math.cos(ba) * 6, by + Math.sin(ba) * 6); g.stroke();
        circ(g, bx + Math.cos(ba) * 6, by + Math.sin(ba) * 6, 1.9, bone); circ(g, bx - Math.cos(ba) * 6, by - Math.sin(ba) * 6, 1.9, bone);
      }
      break;
    }
    case 'skull': {             // horned animal skull
      if (shadow) { circ(g, 4, 3, r * 0.45, 'rgba(0,0,0,0.25)'); break; }
      const z = 3 * K;
      g.strokeStyle = '#d8cdb2'; g.lineWidth = 3; g.lineCap = 'round';
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * r * 0.25, -r * 0.1 - z); g.quadraticCurveTo(sd * r * 0.95, -r * 0.3, sd * r * 0.8, -r * 0.75 - 2 * z); g.stroke(); }
      g.fillStyle = '#ece3cc'; g.beginPath(); g.ellipse(0, -z, r * 0.3, r * 0.42, 0, 0, 7); g.fill();
      circ(g, -r * 0.12, -z - r * 0.08, r * 0.08, '#2a2018'); circ(g, r * 0.12, -z - r * 0.08, r * 0.08, '#2a2018');
      break;
    }
    case 'wreckpile': {          // stacked car wrecks
      const n = 2 + (o.seed % 2), cols = [['#7a4026', '#5a2e1a'], ['#5e5a50', '#45423b'], ['#8a5a2a', '#5f3d1c'], ['#4a5a5a', '#384444']];
      if (shadow) { prismShadow(g, rectPts(0, 0, 52, 30, o.a), 10 * n, 0.32); break; }
      for (let k = 0; k < n; k++) {
        const c = cols[(o.seed + k) % 4], a = o.a + (k ? (rng() - 0.5) * 1.2 : 0), ox2 = (rng() - 0.5) * 10 * k, oy2 = (rng() - 0.5) * 8 * k;
        g.save(); g.translate(ox2, oy2 - k * 10 * K);
        const top = prism(g, rectPts(0, 0, 44, 22, a), 10, c[0], c[1], 'rgba(0,0,0,0.35)');
        g.save(); polyPath(g, top); g.clip(); g.translate(0, -10 * K); g.rotate(a);
        g.fillStyle = 'rgba(20,14,10,0.6)'; g.fillRect(-9, -8, 15, 16); g.fillStyle = 'rgba(160,80,30,0.5)'; g.fillRect(8, -10, 10, 7);
        g.restore(); g.restore();
      }
      cylinder(g, 30 * Math.cos(o.a + 1), 20 * Math.sin(o.a + 1), 9, 0, 6, '#1c1c1c', '#2a2a2a');
      break;
    }
    case 'shack': {              // scrap metal hut
      const lw = r * 1.5, lh = r * 1.1, H = 30 + rng() * 20;
      const pts = axisRot ? rectPts(0, 0, lh, lw) : rectPts(0, 0, lw, lh);
      if (shadow) { prismShadow(g, pts, H + 6, 0.38); break; }
      prism(g, pts, H, '#7d756a', ['#6b4a33', '#5a5048', '#7a4a2a', '#4f4a40'][o.seed % 4], 'rgba(0,0,0,0.4)');
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), up = H * K;
      for (let k = 0; k < 5; k++) {
        g.fillStyle = pick2(rng, ['rgba(140,70,30,0.6)', 'rgba(110,110,100,0.55)', 'rgba(60,40,25,0.6)', 'rgba(150,120,60,0.5)']);
        const pw = 12 + rng() * 16, ph = up * (0.3 + rng() * 0.5), px = x0 + rng() * (x1 - x0 - pw);
        g.fillRect(px, y1 - ph - rng() * (up - ph), pw, ph);
      }
      g.fillStyle = '#1e1712'; g.fillRect((x0 + x1) / 2 - 6, y1 - up * 0.7, 12, up * 0.7);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2;
      for (let x = x0 + 4; x < x1; x += 5) { g.beginPath(); g.moveTo(x, y0 - up); g.lineTo(x, y1 - up); g.stroke(); }
      g.fillStyle = 'rgba(150,70,25,0.55)'; g.fillRect(x0 + rng() * (x1 - x0) * 0.5, y0 - up + rng() * (y1 - y0) * 0.5, (x1 - x0) * 0.4, (y1 - y0) * 0.35);
      break;
    }
    case 'pumpjack': {           // oil pump
      const c = o.seed % 2 ? 1 : -1, up = z => -z * K;
      if (shadow) { prismShadow(g, rectPts(0, 0, r * 2.2, r * 0.7), 30, 0.3); break; }
      prism(g, rectPts(0, 0, r * 2.2, r * 0.7), 5, '#4a4540', '#35312d');
      prism(g, rectPts(-c * r * 0.75, 0, 14, 10), 14, '#6a3a22', '#4a2a18');
      g.strokeStyle = '#5a5550'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-r * 0.35, up(5)); g.lineTo(0, up(40)); g.lineTo(r * 0.35, up(5)); g.stroke();
      g.strokeStyle = '#2a2826'; g.lineWidth = 6; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(-c * r * 0.95, up(46)); g.lineTo(c * r * 0.85, up(34)); g.stroke();
      g.fillStyle = '#b8452a'; g.beginPath(); g.moveTo(c * r * 0.8, up(28)); g.lineTo(c * r * 1.05, up(32)); g.lineTo(c * r * 1.05, up(44)); g.lineTo(c * r * 0.85, up(40)); g.closePath(); g.fill();
      g.strokeStyle = '#8a8a80'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c * r * 1.02, up(30)); g.lineTo(c * r * 1.02, up(3)); g.stroke();
      circ(g, 0, up(40), 3.5, '#222');
      break;
    }
    case 'firebarrel': {
      if (shadow) { circ(g, 7, 5, 9.5, 'rgba(0,0,0,0.35)'); break; }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 70); gr.addColorStop(0, 'rgba(255,140,50,0.32)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.fillRect(-70, -70, 140, 140);
      const tY = cylinder(g, 0, 0, 9, 0, 18, '#6b3a1e', '#4a2814');
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.2;
      [5, 12].forEach(z => { g.beginPath(); g.arc(0, -z * K, 9, 0, Math.PI); g.stroke(); });
      const fg = g.createRadialGradient(0, tY, 0, 0, tY, 9); fg.addColorStop(0, '#fff2a0'); fg.addColorStop(0.5, '#ff8a20'); fg.addColorStop(1, '#5a1a08');
      g.fillStyle = fg; g.beginPath(); g.arc(0, tY, 8, 0, 7); g.fill();
      break;
    }
    case 'burnwreck': {          // charred car on fire (flames/smoke are particles in the race)
      const pts = rectPts(0, 0, 46, 23, o.a);
      if (shadow) { prismShadow(g, pts, 14, 0.35); circ(g, 0, 0, 40, 'rgba(10,6,4,0.35)'); break; }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 95); gr.addColorStop(0, 'rgba(255,120,40,0.35)'); gr.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = gr; g.fillRect(-95, -95, 190, 190);
      for (const [wx, wy] of [[-14, -12], [14, -12], [-14, 12], [14, 12]]) { const c2 = Math.cos(o.a), s2 = Math.sin(o.a); cylinder(g, wx * c2 - wy * s2, wx * s2 + wy * c2, 5, 0, 4, '#101010', '#1a1a1a'); }
      const top = prism(g, pts, 9, '#2a211b', '#1c1612', 'rgba(0,0,0,0.5)');
      g.save(); g.translate(0, -9 * K); g.rotate(o.a);
      g.fillStyle = '#3a2a20'; g.fillRect(-12, -9, 20, 18);
      const ig = g.createRadialGradient(0, 0, 0, 0, 0, 12); ig.addColorStop(0, '#ffd070'); ig.addColorStop(0.5, '#ff6a1a'); ig.addColorStop(1, 'rgba(90,20,5,0.9)');
      g.fillStyle = ig; g.fillRect(-10, -7, 16, 14);
      g.fillStyle = 'rgba(120,50,20,0.7)'; g.fillRect(10, -10, 11, 20);
      g.restore(); void top;
      break;
    }
    case 'tirefire': {           // burning pile of tires
      if (shadow) { circ(g, 10, 7, r * 0.9, 'rgba(0,0,0,0.33)'); break; }
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 80); gr.addColorStop(0, 'rgba(255,120,40,0.3)'); gr.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = gr; g.fillRect(-80, -80, 160, 160);
      const layers = [[[-7, 0], [7, 0], [0, 6]], [[-3, 0], [5, -1]], [[0, 0]]];
      layers.forEach((L, li) => L.forEach(([tx, ty]) => {
        const tY = cylinder(g, tx, ty, 9, li * 7, 7, '#1c1c1c', '#2a2a2a');
        circ(g, tx, tY, 4, li === layers.length - 1 ? '#ff8a2a' : '#0a0a0a');
      }));
      break;
    }
    case 'toxicpool': {         // glowing toxic puddle with bubbles and a leaking barrel
      if (shadow) break;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.4); gr.addColorStop(0, 'rgba(170,255,60,0.35)'); gr.addColorStop(1, 'rgba(120,200,40,0)');
      g.fillStyle = gr; g.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
      blob(g, 0, 0, r, 12, mulberry(o.seed), 0.22); g.fillStyle = '#2e3a14'; g.fill();
      blob(g, 0, 0, r * 0.86, 12, mulberry(o.seed), 0.22);
      const pg = g.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r); pg.addColorStop(0, '#d8ff6a'); pg.addColorStop(0.5, '#8ad028'); pg.addColorStop(1, '#4a7a14');
      g.fillStyle = pg; g.fill();
      for (let k = 0; k < 7; k++) { const a = rng() * 7, dd = rng() * r * 0.7; circ(g, Math.cos(a) * dd, Math.sin(a) * dd, 1.5 + rng() * 3, 'rgba(240,255,170,0.7)'); }
      const bx = Math.cos(o.a) * r * 0.9, by = Math.sin(o.a) * r * 0.9;
      const tY = cylinder(g, bx, by, 8, 0, 16, '#c8b41c', '#a8961a');
      g.fillStyle = '#1a1a10'; g.beginPath(); g.moveTo(bx, tY - 4); g.lineTo(bx - 4, tY + 3); g.lineTo(bx + 4, tY + 3); g.closePath(); g.fill();
      break;
    }
    case 'log': {
      const pts = rectPts(0, 0, r * 2, 13, o.a);
      if (shadow) { prismShadow(g, pts, 11); break; }
      prism(g, pts, 11, '#8a6440', '#5e4026');
      const ex = Math.cos(o.a) * r * (Math.sin(o.a) > 0 ? 1 : -1), ey = Math.sin(o.a) * r * (Math.sin(o.a) > 0 ? 1 : -1);
      circ(g, ex, ey - 5.5 * K, 6.5, '#b08a5c');
      g.strokeStyle = '#7a5a36'; g.lineWidth = 1; g.beginPath(); g.arc(ex, ey - 5.5 * K, 3.5, 0, 7); g.stroke();
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
  { len: 24, rear: -24, hw: 12.5, wheelX: 15, wheelY: 12, wheel: [12, 7], cab: { wf: 12, wr: 7, rr: -14, rw: -18, cw: 9.5 } },
  { len: 19, rear: -18, hw: 7.5, wheelX: 12, wheelY: 9.5, wheel: [12, 7], cab: { wf: 2, wr: 0, rr: -8, rw: -9, cw: 6 } }
];
function carBodyPath(shape) {
  const p = new Path2D();
  CAR3[shape].body.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath();
  return p;
}
function carShadowTexture(scene, shape) {
  const key = 'carsh' + shape;
  if (scene.textures.exists(key)) return key;
  const cv = makeCanvas(128, 64), g = cv.getContext('2d');
  g.translate(64, 32); g.scale(CAR_RES, CAR_RES);
  try { g.filter = 'blur(2px)'; } catch (e) { /* ignore */ }
  g.fillStyle = '#000'; g.fill(carBodyPath(shape));
  const S = CAR3[shape], W = S.wr || { x: -S.wx, r: S.wh / 2, y1: S.wy1 }, F = S.wf || { x: S.wx, r: S.wh / 2, y1: S.wy1 };
  g.fillRect(W.x - W.r, -W.y1, F.x + F.r - (W.x - W.r), W.y1 * 2);
  scene.textures.addCanvas(key, cv);
  return key;
}

// ---------------- 3D cars: small polygon models pre-rendered at CAR_FRAMES headings ----------------
const LOW_MEM = (() => { try { return (navigator.deviceMemory && navigator.deviceMemory < 4) || window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
const CAR_FRAMES = 40, CAR_RES3 = LOW_MEM ? 2 : 2.8, CAR_RAD = 32, CAR_HMAX = 22;
const CAR_FW = Math.ceil(CAR_RAD * 2 * CAR_RES3), CAR_FH = Math.ceil((CAR_RAD * 2 + CAR_HMAX) * CAR_RES3);
const CAR_OY = (CAR_RAD + CAR_HMAX) / (CAR_RAD * 2 + CAR_HMAX);
const TAU = Math.PI * 2;
const V3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const LIGHT3 = V3(-0.45, -0.55, 0.85), VIEW3 = [0, VIEW_IZ, VIEW_IY];
const HALF3 = V3(LIGHT3[0] + VIEW3[0], LIGHT3[1] + VIEW3[1], LIGHT3[2] + VIEW3[2]);

const rectXY = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const scalePts = (pts, sx, sy) => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
};
const circPts = (cx, cy, r, n = 12) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * TAU) * r, cy + Math.sin(i / n * TAU) * r]);

const CAR3 = [
  { // Rustbug – round little bug
    body: [[-21, -8], [-18.5, -11], [18.5, -11], [21, -8], [21, 8], [18.5, 11], [-18.5, 11], [-21, 8]], bz0: 3.5, bz1: 10, inset: [0.92, 0.84],
    cab: rectXY(-9, 8, -8.8, 8.8), cabTop: rectXY(-6.5, 4, -6.6, 6.6), cz: 16.5,
    wx: 13, wl: 4.5, wy0: 8, wy1: 11.8, wh: 8, front: 21, rear: -21, hw: 11, gun: [9.5, 20], len3: 19, roofGun: false
  },
  { // Scorcher – long coupe
    body: [[-22, -10], [-20, -11], [10, -11], [19, -8.5], [23, -4], [23, 4], [19, 8.5], [10, 11], [-20, 11], [-22, 10]], bz0: 3, bz1: 9.5, inset: [0.96, 0.85],
    cab: rectXY(-10, 5, -8.6, 8.6), cabTop: rectXY(-7.5, 0.5, -6.6, 6.6), cz: 15,
    wx: 14, wl: 4.6, wy0: 8, wy1: 11.8, wh: 8, front: 23, rear: -22, hw: 11, gun: [6.5, 19], len3: 20, roofGun: true
  },
  { // Razorback – low wedge with a wing
    body: [[-22, -12], [-6, -12], [8, -10.5], [19, -6.5], [24, -2.5], [24, 2.5], [19, 6.5], [8, 10.5], [-6, 12], [-22, 12]], bz0: 3, bz1: 8, inset: [0.95, 0.84],
    cab: rectXY(-9, 4, -8, 8), cabTop: rectXY(-6.5, -1, -6, 6), cz: 13,
    wx: 14, wl: 5, wy0: 9, wy1: 12.8, wh: 7.5, front: 24, rear: -22, hw: 12, gun: [5, 19], len3: 20, roofGun: true
  },
  { // Juggernaut – armored truck
    body: [[-24, -12.5], [20, -12.5], [24, -9], [24, 9], [20, 12.5], [-24, 12.5]], bz0: 4, bz1: 11.5, inset: [0.97, 0.9],
    cab: rectXY(-15, 9, -10.2, 10.2), cabTop: rectXY(-13, 6, -8.6, 8.6), cz: 19,
    wx: 15, wl: 5.5, wy0: 10, wy1: 14, wh: 10, front: 24, rear: -24, hw: 12.5, gun: [9.5, 23], len3: 22, roofGun: true
  },
  { // Buggy – open frame, roll cage, big rear wheels (driven by some rivals, shown in menus)
    body: [[-18, -7.5], [10, -6.5], [19, -3], [19, 3], [10, 6.5], [-18, 7.5]], bz0: 4, bz1: 6.5, inset: [0.96, 0.9],
    cab: rectXY(-8, 2.5, -6.2, 6.2), cabTop: rectXY(-7.5, 1.5, -5.6, 5.6), cz: 17,
    wx: 12, wl: 4.5, wy0: 6, wy1: 10, wh: 8, front: 19, rear: -18, hw: 7.5, gun: [6, 18], len3: 17, roofGun: true, noCab: true,
    wf: { x: 12, r: 4.4, y0: 5.5, y1: 9.8 }, wr: { x: -12, r: 6.4, y0: 6.5, y1: 12.8 }
  },
  { // Pickup – cab in the middle, open bed
    body: [[-24, -11], [21, -11], [25, -7.5], [25, 7.5], [21, 11], [-24, 11]], bz0: 4, bz1: 10, inset: [0.97, 0.9],
    cab: rectXY(-3, 10, -9.5, 9.5), cabTop: rectXY(-2, 6, -8, 8), cz: 18.5,
    wx: 15, wl: 5, wy0: 9, wy1: 13, wh: 10, front: 25, rear: -24, hw: 11, gun: [12, 24], len3: 22, roofGun: true
  },
  { // Armored van – tall box with small windows
    body: [[-23, -11], [18, -11], [23, -8], [23, 8], [18, 11], [-23, 11]], bz0: 4, bz1: 10, inset: [0.98, 0.92],
    cab: rectXY(-22, 13, -10.2, 10.2), cabTop: rectXY(-21, 9, -9, 9), cz: 22, solidCab: true, gunRoof: [2, 17],
    wx: 14, wl: 5, wy0: 9, wy1: 12.8, wh: 9, front: 23, rear: -23, hw: 11, gun: [14, 23], len3: 21, roofGun: true
  },
  { // Hot rod – long hood with exposed engine, big rear wheels
    body: [[-21, -8], [14, -6.5], [23, -4], [23, 4], [14, 6.5], [-21, 8]], bz0: 4, bz1: 9, inset: [0.96, 0.88],
    cab: rectXY(-15, -3, -7.5, 7.5), cabTop: rectXY(-13, -6, -6.2, 6.2), cz: 15,
    wx: 13, wl: 4.5, wy0: 7, wy1: 11, wh: 9, front: 23, rear: -21, hw: 7.5, gun: [10, 22], len3: 19, roofGun: true, openFront: true,
    wf: { x: 15, r: 4.2, y0: 6.5, y1: 10 }, wr: { x: -13, r: 6.2, y0: 7.5, y1: 13.2 }
  }
];

function carModel(shape, color, kitId) {
  const S = CAR3[shape], K = (typeof KITS !== 'undefined' && KITS[kitId]) || {}, rng = mulberry(color * 7 + shape * 131 + (kitId ? kitId.length * 977 : 0));
  // weathered paint: pull the driver color toward rusty brown
  const raw = hexRGB(color), RUST = [112, 72, 44];
  const rmix = K.rust === undefined ? 0.34 : K.rust;
  const c = raw.map((v, i) => (v * (1 - rmix) + RUST[i] * rmix) * (0.94 - rmix * 0.18));
  const base = shade(c, 0), roof = shade(c, 0.08), dark = shade(c, -0.45), light = shade(c, 0.18);
  const GLASS = '#3a4e60', TIRE = '#1c1b1a', HUB = '#8a8a82', GUN = '#2c2c2a', HEAD = '#ffe9a8', TAIL = '#ff2a10', STEEL = '#77746c', RUSTC = '#7a3e1e', CHROME = '#b9b6ad', BLACK = '#161412';
  const P = [];
  const add = (pts, z0, z1, side, top, o = {}) => P.push({ pts, top: o.top || pts, z0, z1, side, topc: top || side, em: !!o.em, gloss: !!o.gloss, cat: o.cat === undefined ? 2 : o.cat });
  const mesh = (faces, col, o = {}) => P.push({ mesh: faces, side: col, topc: col, em: !!o.em, gloss: !!o.gloss, cat: o.cat === undefined ? 2 : o.cat, hint: o.hint });
  const box = (x0, x1, y0, y1, z0, z1, side, top, o) => add(rectXY(x0, x1, Math.min(y0, y1), Math.max(y0, y1)), z0, z1, side, top, o);
  // spike pointing along +/-x (dir) or up (dir = 0)
  const spike = (x, y, z, len, r, dir, col = CHROME) => {
    if (!dir) {
      const A = [x, y, z + len], b = [[x - r, y - r, z], [x + r, y - r, z], [x + r, y + r, z], [x - r, y + r, z]];
      return mesh([0, 1, 2, 3].map(i => [A, b[i], b[(i + 1) % 4]]), col, { gloss: true });
    }
    const A = [x + dir * len, y, z], b = [[x, y - r, z - r], [x, y + r, z - r], [x, y + r, z + r], [x, y - r, z + r]];
    return mesh([0, 1, 2, 3].map(i => [A, b[i], b[(i + 1) % 4]]), col, { gloss: true });
  };
  // round wheel (cylinder along y) with sidewall, rim, spokes and hub
  const wheel = (cx, yIn, yOut, r) => {
    const n = 12, ring = (k, rr) => [cx + Math.cos(k / n * TAU) * rr, r + Math.sin(k / n * TAU) * rr];
    const faces = [];
    for (let k = 0; k < n; k++) { const [x0, z0] = ring(k, r), [x1, z1] = ring(k + 1, r); faces.push([[x0, yIn, z0], [x1, yIn, z1], [x1, yOut, z1], [x0, yOut, z0]]); }
    mesh(faces, TIRE, { cat: 0 });
    const out = Math.sign(yOut - yIn), yo = yOut + out * 0.05;
    mesh([Array.from({ length: n }, (_, k) => { const [x, z] = ring(k, r * 0.97); return [x, yo, z]; })], '#262422', { cat: 0, hint: [0, out, 0] });
    // tread blocks on the visible half
    for (let k = 0; k < n; k += 2) { const [x0, z0] = ring(k + 0.25, r + 0.35), [x1, z1] = ring(k + 0.75, r + 0.35); mesh([[[x0, yIn + out * 0.3, z0], [x1, yIn + out * 0.3, z1], [x1, yOut - out * 0.3, z1], [x0, yOut - out * 0.3, z0]]], '#0e0e0d', { cat: 0, hint: [x0 + x1 - 2 * cx, 0, z0 + z1 - 2 * r] }); }
    const y2 = yo + out * 0.12;
    mesh([Array.from({ length: n }, (_, k) => { const [x, z] = ring(k, r * 0.6); return [x, y2, z]; })], HUB, { cat: 0, hint: [0, out, 0], gloss: true });
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU + 0.3, x1 = cx + Math.cos(a) * r * 0.56, z1 = r + Math.sin(a) * r * 0.56, w = r * 0.09;
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w, y3 = y2 + out * 0.1;
      mesh([[[cx + px, y3, r + pz], [x1 + px, y3, z1 + pz], [x1 - px, y3, z1 - pz], [cx - px, y3, r - pz]]], '#5a5852', { cat: 0, hint: [0, out, 0] });
    }
    mesh([Array.from({ length: 6 }, (_, k) => { const [x, z] = ring(k * 2, r * 0.2); return [x, y2 + out * 0.2, z]; })], '#2a2826', { cat: 0, hint: [0, out, 0] });
  };
  const hz = S.bz1;
  // ---- wheels (drawn first, tucked under the body)
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const W = sx > 0 ? (S.wf || { x: S.wx, r: S.wh / 2, y0: S.wy0, y1: S.wy1 }) : (S.wr || { x: -S.wx, r: S.wh / 2, y0: S.wy0, y1: S.wy1 });
    wheel(W.x, sy * W.y0, sy * W.y1, W.r);
  }
  // ---- body
  add(S.body, S.bz0, S.bz1, base, base, { cat: 1, top: scalePts(S.body, S.inset[0], S.inset[1]), gloss: true });
  // fender flares over the wheels
  if (!S.noCab) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    if (sx > 0 && S.openFront) continue;
    const W = sx > 0 ? (S.wf || { x: S.wx, r: S.wh / 2 }) : (S.wr || { x: -S.wx, r: S.wh / 2 });
    if (shape === 7) continue;
    box(W.x - W.r - 1.4, W.x + W.r + 1.4, sy * (S.hw - 1.5), sy * (S.hw + 1.1), W.r * 2 - 1.2, W.r * 2 + 0.9, dark, shade(c, -0.25));
  }
  // side skirts / sills
  if (!S.noCab) for (const sy of [-1, 1]) box(-S.wx + S.wl + 1.5, S.wx - S.wl - 1.5, sy * (S.hw - 0.4), sy * (S.hw + 0.5), S.bz0 - 0.4, S.bz0 + 1.2, BLACK, '#242220');
  // ---- cabin with pillars, wipers, mirrors
  if (!S.noCab) {
    add(S.cab, S.bz1, S.cz, S.solidCab ? base : GLASS, roof, { top: S.cabTop, gloss: true });
    const around = ([x, y], cx2, cy2, d) => { const dx = Math.sign(cx2 - x) * d, dy = Math.sign(cy2 - y) * d; return rectXY(Math.min(x, x + dx), Math.max(x, x + dx), Math.min(y, y + dy), Math.max(y, y + dy)); };
    const ccx = (S.cab[0][0] + S.cab[1][0]) / 2;
    for (let i = 0; i < 4; i++) add(around(S.cab[i], ccx, 0, 1.6), S.bz1, S.cz - 0.05, roof, roof, { top: around(S.cabTop[i], ccx, 0, 1.4) });
    for (const sy of [-1, 1]) {
      const bx = (S.cab[0][0] + S.cab[1][0]) / 2, tx = (S.cabTop[0][0] + S.cabTop[1][0]) / 2, by = sy * S.cab[2][1], ty = sy * S.cabTop[2][1];
      add(around([bx, by], bx + 1, 0, 1.2), S.bz1, S.cz - 0.05, roof, roof, { top: around([tx, ty], tx + 1, 0, 1.1) });
    }
    // wipers on the windshield
    const wfx = S.cab[1][0], wtx = S.cabTop[1][0];
    for (const y of [-2.5, 2.5]) mesh([[[wfx - 0.3, y - 2.5, hz + 0.7], [wfx - 0.1, y + 2.5, hz + 0.7], [wfx - (wfx - wtx) * 0.35, y + 2.5, hz + 0.7 + (S.cz - hz) * 0.35], [wfx - (wfx - wtx) * 0.35 - 0.2, y - 2.5, hz + 0.7 + (S.cz - hz) * 0.35]]], BLACK, { hint: [1, 0, 1] });
    for (const sy of [-1, 1]) {
      const mx = S.cab[1][0] - 1.2;
      box(mx, mx + 1.6, sy * (S.hw - 1), sy * (S.hw + 1.8), hz + 1, hz + 2.6, '#2a2826', '#3a3834');
      box(mx + 1.55, mx + 1.75, sy * (S.hw + 0.2), sy * (S.hw + 1.6), hz + 1.2, hz + 2.4, '#9ab0c0', '#9ab0c0', { gloss: true });
      // door seams + handles
      for (const x of [S.cab[0][0] - 1, S.cab[1][0] + 1]) box(x, x + 0.4, sy * (S.hw - 0.05), sy * (S.hw + 0.25), S.bz0 + 1, hz - 0.4, BLACK, BLACK);
      box(S.cab[0][0] + 1, S.cab[0][0] + 3, sy * (S.hw + 0.5), sy * (S.hw + 0.9), hz - 2.6, hz - 2, CHROME, CHROME);
    }
  }
  // ---- rust patches, scratches & primer on hood / trunk / roof
  for (let k = 0; k < 7; k++) {
    const onRoof = !S.noCab && k >= 5, x0 = onRoof ? S.cabTop[0][0] + 1 : (k % 2 ? 4 : -S.len3) + rng() * 8, w = 2 + rng() * 5;
    const yy = (rng() - 0.5) * (onRoof ? 7 : 12), h = 1.2 + rng() * 4, z = onRoof ? S.cz : hz;
    if (!onRoof && x0 + w > S.front - 3) continue;
    add(rectXY(x0, x0 + w, yy - h / 2, yy + h / 2), z, z + 0.15, RUSTC, k === 2 ? '#5a5650' : k === 4 ? '#8a5a3a' : RUSTC);
  }
  for (let k = 0; k < 4; k++) { const x0 = -S.len3 + rng() * (S.front + S.len3 - 6), yy = (rng() - 0.5) * 10; add(rectXY(x0, x0 + 4 + rng() * 5, yy, yy + 0.35), hz, hz + 0.12, '#c8bfa8', '#c8bfa8'); }
  // ---- bolted armor plates with rivets
  for (const sy of [-1, 1]) {
    const yi = sy * (S.hw - 0.6), yo = sy * (S.hw + 0.5), x0 = -8 + rng() * 3, x1 = 6 + rng() * 3;
    box(x0, x1, yi, yo, S.bz0 + 1, hz - 0.8, STEEL, STEEL);
    for (let k = 0; k < 5; k++) { const x = x0 + 1 + k * (x1 - x0 - 2) / 4; for (const z of [S.bz0 + 1.6, hz - 2.2]) box(x - 0.4, x + 0.4, sy * (S.hw + 0.5), sy * (S.hw + 0.85), z, z + 0.8, '#c8c2b0', '#c8c2b0'); }
  }
  // hood bolts
  for (const y of [-4, 4]) for (const x of [S.front - 5, S.front - 9]) box(x - 0.4, x + 0.4, y - 0.4, y + 0.4, hz, hz + 0.35, '#c8c2b0', '#c8c2b0');
  // ---- grille, lights with cages, plate, tow hook
  box(S.front - 0.6, S.front + 0.25, -S.hw + 6.5, S.hw - 6.5, S.bz0 + 1.2, S.bz0 + 4.8, '#1c1b19', '#2a2826');
  for (let k = -2; k <= 2; k++) { const y = k * (S.hw - 7) / 2.5; box(S.front - 0.2, S.front + 0.45, y - 0.3, y + 0.3, S.bz0 + 1.2, S.bz0 + 4.8, CHROME, CHROME, { gloss: true }); }
  for (const sy of [-1, 1]) {
    const ly0 = sy > 0 ? S.hw - 6.5 : -S.hw + 2.5, ly1 = sy > 0 ? S.hw - 2.5 : -S.hw + 6.5;
    box(S.front - 1.6, S.front + 0.1, ly0 - 0.5, ly1 + 0.5, S.bz0 + 1.5, S.bz0 + 5, '#2a2826', '#3a3834');
    box(S.front - 1.2, S.front + 0.3, ly0, ly1, S.bz0 + 2, S.bz0 + 4.5, HEAD, HEAD, { em: true });
    for (const y of [ly0 + 1, (ly0 + ly1) / 2, ly1 - 1]) box(S.front + 0.35, S.front + 0.75, y - 0.25, y + 0.25, S.bz0 + 1.8, S.bz0 + 4.7, BLACK, BLACK);
    box(S.rear - 0.3, S.rear + 1, sy > 0 ? S.hw - 6 : -S.hw + 2, sy > 0 ? S.hw - 2 : -S.hw + 6, hz - 3, hz - 1, TAIL, TAIL, { em: true });
  }
  box(S.rear - 0.55, S.rear + 0.05, -2.6, 2.6, S.bz0 + 1.3, S.bz0 + 3.4, '#cfc6a8', '#cfc6a8');
  box(S.rear - 2, S.rear, -0.7, 0.7, S.bz0 - 0.5, S.bz0 + 0.7, '#3a3834', '#4a4844');
  // mud flaps behind the rear wheels
  for (const sy of [-1, 1]) {
    const W = S.wr || { x: -S.wx, r: S.wh / 2, y0: S.wy0, y1: S.wy1 };
    box(W.x - W.r - 1.3, W.x - W.r - 0.8, sy * W.y0, sy * W.y1, 0.6, W.r * 1.5, '#141414', '#1c1c1c', { cat: 0 });
  }
  // ---- machine gun with ammo box (hood or roof)
  const gz = S.roofGun ? S.cz : hz, g0 = S.gunRoof ? S.gunRoof[0] : S.roofGun ? S.cabTop[0][0] + 1 : S.gun[0], g1 = S.gunRoof ? S.gunRoof[1] : S.roofGun ? S.cabTop[1][0] + 9 : S.gun[1];
  box(g0 - 0.5, g0 + 5, -2.6, 2.6, gz, gz + 1, '#3a3834', '#4a4844');
  box(g0, g0 + 4.5, -2.2, 2.2, gz + 1, gz + 3.4, GUN, '#3a3a38');
  box(g0 + 0.5, g0 + 3, 2.2, 4.2, gz + 0.8, gz + 3, '#4a5230', '#5a6238');
  box(g0 + 4, g1, -0.9, 0.9, gz + 1.8, gz + 2.9, '#141414', '#2a2a2a');
  box(g1 - 2.5, g1, -1.3, 1.3, gz + 1.5, gz + 3.2, '#222', '#333');
  // ---- spiked front bar
  box(S.front - 0.2, S.front + 2, -S.hw + 1.5, S.hw - 1.5, S.bz0 - 0.5, S.bz0 + 2.2, '#2e2c29', '#3c3a36');
  const nsp = shape === 3 ? 5 : 4;
  for (let k = 0; k < nsp; k++) { const y = -S.hw + 3 + k * (2 * S.hw - 6) / (nsp - 1); spike(S.front + 2, y, S.bz0 + 0.8, shape === 3 ? 7.5 : 5.5, 1.2, 1); }
  // spiked hubs on the rear wheels
  for (const sy of [-1, 1]) { const W = S.wr || { x: -S.wx, r: S.wh / 2, y1: S.wy1 }; mesh([[0, 1, 2, 3].map(i => [W.x + [-1, 1, 1, -1][i] * 0.9, sy * (W.y1 + 0.35), W.r + [-1, -1, 1, 1][i] * 0.9])].concat([0, 1, 2, 3].map(i => { const q = [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]; const a = q[i], b = q[(i + 1) % 4]; return [[W.x + a[0], sy * (W.y1 + 0.35), W.r + a[1]], [W.x + b[0], sy * (W.y1 + 0.35), W.r + b[1]], [W.x, sy * (W.y1 + 3.5), W.r]]; })), CHROME, { gloss: true, cat: 0 }); }
  // ---- antenna with a rag flag (not on the buggy, it has the cage)
  if (!S.noCab) {
    const ax = S.rear + 3, ay = -S.hw + 2;
    box(ax - 0.25, ax + 0.25, ay - 0.25, ay + 0.25, hz, hz + 16, '#2a2826', '#2a2826');
    const fz = hz + 16, fl = [[ax, ay, fz], [ax - 5, ay - 0.5, fz - 0.8], [ax - 5, ay - 0.5, fz - 3.6], [ax, ay, fz - 3]];
    mesh([fl], '#8a2418', { hint: [0, 1, 0] }); mesh([fl.slice().reverse()], '#6a1a10', { hint: [0, -1, 0] });
  }
  const jerry = (x, y, col) => { add(rectXY(x, x + 3.4, y - 1.2, y + 1.2), hz, hz + 3.2, col, shade(cssRGB(col), 0.1)); add(rectXY(x + 1, x + 2.4, y - 0.4, y + 0.4), hz + 3.2, hz + 3.8, '#2a2a28', '#3a3a36'); };
  // ---- per-model scrap
  if (shape === 0) {        // Rustbug: roundel, chrome bumper, spare tire, roof rack, single exhaust
    add(circPts(-1.2, 0, 3.8), S.cz, S.cz + 0.15, '#d8cfb8', '#d8cfb8');
    add(circPts(-1.2, 0, 2.5), S.cz + 0.15, S.cz + 0.3, base, base);
    add(rectXY(S.rear - 1.5, S.rear + 0.5, -7.5, 7.5), S.bz0, S.bz0 + 2.5, CHROME, '#cfccc2', { gloss: true });
    add(circPts(-16, 0, 4.2, 12), hz - 0.5, hz + 2.2, TIRE, '#202020');
    add(circPts(-16, 0, 1.8, 8), hz + 2.2, hz + 2.4, HUB, HUB);
    for (const y of [-6, 6]) add(rectXY(S.cabTop[0][0], S.cabTop[1][0], y - 0.3, y + 0.3), S.cz, S.cz + 1.2, '#2a2826', '#3a3834');
    add(rectXY(-6, -2.6, -4, -1.6), S.cz + 0.2, S.cz + 3, '#7a2a1a', '#8a3a22');
    add(rectXY(S.rear - 4, S.rear + 0.5, 5, 7), S.bz0 + 0.5, S.bz0 + 2.3, '#3a3a36', '#555');
    for (const y of [-3, 3]) { box(2, 4, y - 1, y + 1, S.cz, S.cz + 1.6, CHROME, '#9a978f', { gloss: true }); box(4, 4.4, y - 0.8, y + 0.8, S.cz + 0.2, S.cz + 1.4, HEAD, HEAD, { em: true }); }
  }
  if (shape === 1) {        // Scorcher: blower, side stacks, stripes, jerry cans, roof spotlights
    for (const sy of [-1, 1]) {
      const y0 = sy > 0 ? 1.2 : -3.4, y1 = sy > 0 ? 3.4 : -1.2;
      add(rectXY(-20.5, -10.5, y0, y1), hz, hz + 0.2, '#d8cfb8', '#d8cfb8');
      add(rectXY(-7.3, 0.3, y0, y1), S.cz, S.cz + 0.2, '#d8cfb8', '#d8cfb8');
    }
    add(rectXY(8, 16, -3.2, 3.2), hz, hz + 4.5, CHROME, '#9a978f', { gloss: true });
    for (let k = 0; k < 4; k++) box(8.5 + k * 2, 9.2 + k * 2, -3.3, 3.3, hz + 0.5, hz + 4, '#6a6862', '#6a6862');
    add(rectXY(9, 15, -2.2, 2.2), hz + 4.5, hz + 6.5, '#2a2a28', '#1a1a1a');
    for (const y of [-1.2, 1.2]) box(10, 14, y - 0.8, y + 0.8, hz + 6.5, hz + 7.2, CHROME, CHROME, { gloss: true });
    for (const sy of [-1, 1]) for (const dx of [0, 3]) { add(rectXY(-3 + dx, -1.4 + dx, sy * 11.4 - 0.8, sy * 11.4 + 0.8), S.bz0 + 2, S.cz + 2, '#4a4844', '#1a1612'); box(-3.2 + dx, -1.2 + dx, sy * 11.4 - 1, sy * 11.4 + 1, S.cz + 1.4, S.cz + 2, RUSTC, '#1a1612'); }
    jerry(-20.5, -5.5, '#4f5a2a'); jerry(-20.5, 5.5, '#7a2a1a');
  }
  if (shape === 2) {        // Razorback: blower, wing with end plates, twin pipes, roof spikes
    add(rectXY(-6.3, -1.2, -1.7, 1.7), S.cz, S.cz + 0.2, '#111', '#151515');
    add(rectXY(-21, -9.5, -1.7, 1.7), hz, hz + 0.2, '#111', '#151515');
    add(rectXY(7, 14, -3, 3), hz, hz + 4.2, CHROME, '#9a978f', { gloss: true });
    for (let k = 0; k < 3; k++) box(7.5 + k * 2.2, 8.2 + k * 2.2, -3.1, 3.1, hz + 0.5, hz + 3.8, '#6a6862', '#6a6862');
    add(rectXY(7.8, 13.2, -2, 2), hz + 4.2, hz + 6, '#2a2a28', '#1a1a1a');
    for (const sy of [-1, 1]) add(rectXY(-21, -19.5, sy > 0 ? 5 : -6.5, sy > 0 ? 6.5 : -5), hz, hz + 4.5, '#1a1a1a', '#1a1a1a');
    add(rectXY(-24.5, -19, -12.5, 12.5), hz + 4.5, hz + 5.8, dark, shade(c, -0.2));
    for (const sy of [-1, 1]) box(-24.5, -19, sy * 12.5, sy * 13.2, hz + 3, hz + 6.5, BLACK, BLACK);
    for (const sy of [-1, 1]) add(rectXY(S.rear - 3.5, S.rear + 0.8, sy * 4 - 1, sy * 4 + 1), S.bz0 + 0.5, S.bz0 + 2.5, '#4a4844', '#1a1612');
    for (const sy of [-1, 1]) for (const x of [-5, -2]) spike(x, sy * 4.5, S.cz, 4, 0.9, 0);
  }
  if (shape === 3) {        // Juggernaut: plated war truck, roof spikes, stacks, spare tire, cans
    for (const sy of [-1, 1]) add(rectXY(-19, 15, sy > 0 ? 12.5 : -13.3, sy > 0 ? 13.3 : -12.5), S.bz0 + 1.5, hz - 1, STEEL, STEEL);
    add(rectXY(-1.5, 2, -7.5, 7.5), S.cz, S.cz + 1.6, '#262626', '#333');
    for (const sy of [-1, 1]) add(rectXY(1.6, 2.4, sy > 0 ? 2.5 : -5.5, sy > 0 ? 5.5 : -2.5), S.cz + 0.2, S.cz + 1.4, '#ffb03a', '#ffb03a', { em: true });
    add(circPts(-19, 0, 5, 12), hz, hz + 3, TIRE, '#202020');
    add(circPts(-19, 0, 2, 8), hz + 3, hz + 3.2, HUB, HUB);
    for (const sy of [-1, 1]) {
      add(rectXY(-14, -12, sy * 11.2 - 1, sy * 11.2 + 1), hz, S.cz + 5, '#4a4844', '#1a1612');
      box(-14.3, -11.7, sy * 11.2 - 1.3, sy * 11.2 + 1.3, S.cz + 4.2, S.cz + 5, RUSTC, '#1a1612');
      for (const x of [-11, -5, 1]) spike(x, sy * 7.5, S.cz, 4.5, 1, 0);
    }
    jerry(-23.5, -9, '#4f5a2a'); jerry(-23.5, 9, '#4f5a2a');
    box(24, 26.5, -10.5, 10.5, 3, 9.5, '#2a2a2a', '#3a3a3a');
    for (const y of [-7, -2.5, 2.5, 7]) box(24.5, 26, y - 0.5, y + 0.5, 3, 10.5, '#3a3834', '#4a4844');
  }
  if (shape === 4) {        // Buggy: seat, driver, roll cage, exposed engine, nose
    add(rectXY(6, 19, -3, 3), hz, hz + 2.5, base, light, { top: rectXY(7, 18, -2.4, 2.4) });
    box(-8, 0, -4, 4, hz, hz + 2, BLACK, '#2a2420');
    box(-8.5, -6.5, -4, 4, hz + 2, hz + 9, BLACK, '#2a2420');
    add(circPts(-3.5, 0, 2.6, 10), hz + 5, hz + 8.5, '#5a5852', '#6a3a22', { top: circPts(-3.5, 0, 1.4, 10) });   // driver helmet
    box(-4.5, -2.5, -3.2, 3.2, hz + 2, hz + 5, '#4a3a2a', '#4a3a2a');
    // roll cage
    const posts = [[-8, -6], [-8, 6], [2, -5.6], [2, 5.6]];
    for (const [x, y] of posts) box(x - 0.45, x + 0.45, y - 0.45, y + 0.45, hz, S.cz, '#3a3834', '#4a4844');
    for (const y of [-5.8, 5.8]) box(-8.4, 2.4, y - 0.4, y + 0.4, S.cz - 0.9, S.cz, '#3a3834', '#4a4844');
    for (const x of [-8, 2]) box(x - 0.4, x + 0.4, -6.2, 6.2, S.cz - 0.9, S.cz, '#3a3834', '#4a4844');
    mesh([[[2, -5.6, S.cz - 0.5], [2, -4.8, S.cz - 0.5], [9, -2.5, hz + 2], [9, -3.3, hz + 2]], [[2, 5.6, S.cz - 0.5], [2, 4.8, S.cz - 0.5], [9, 2.5, hz + 2], [9, 3.3, hz + 2]]], '#3a3834', { hint: [1, 0, 1] });
    // engine block + blower + upswept pipes
    box(-17, -9.5, -4.5, 4.5, hz, hz + 5.5, '#5a5852', '#6a6862');
    for (let k = 0; k < 4; k++) box(-16.5 + k * 1.9, -15.8 + k * 1.9, -4.6, 4.6, hz + 0.5, hz + 5, '#3a3834', '#3a3834');
    box(-15, -11, -2.2, 2.2, hz + 5.5, hz + 8.5, CHROME, '#2a2826', { gloss: true });
    for (const sy of [-1, 1]) { box(-14, -12.6, sy * 5.2 - 0.7, sy * 5.2 + 0.7, hz + 2, hz + 11, '#4a4844', '#1a1612'); spike(-13.3, sy * 5.2, hz + 11, 2.5, 0.6, 0, RUSTC); }
    jerry(-21.5, -3.5, '#7a2a1a'); jerry(-21.5, 0.5, '#4f5a2a');
  }
  // ---- new body types
  if (shape === 5) {        // Pickup: open bed with walls, roll bar
    const bx0 = S.rear + 0.5, bx1 = S.cab[0][0] - 0.5;
    add(rectXY(bx0, bx1, -S.hw + 1.4, S.hw - 1.4), hz, hz + 0.12, '#241e18', '#2a231c');
    for (const sy of [-1, 1]) box(bx0, bx1, sy * (S.hw - 1.4), sy * (S.hw - 0.3), hz, hz + 4, base, light);
    box(bx0, bx0 + 1.1, -S.hw + 0.3, S.hw - 0.3, hz, hz + 4, base, light);
    for (let k = 0; k < 4; k++) box(bx0 + 3 + k * 4.5, bx0 + 3.6 + k * 4.5, -S.hw + 1.4, S.hw - 1.4, hz + 0.12, hz + 0.4, '#3a3028', '#3a3028');
    box(bx1 - 1.2, bx1, -S.hw + 0.6, S.hw - 0.6, hz + 4, hz + 9.5, '#3a3834', '#4a4844');
    for (const y of [-6, 0, 6]) box(bx1 - 1.1, bx1 - 0.1, y - 0.5, y + 0.5, hz, hz + 9.5, '#3a3834', '#4a4844');
  }
  if (shape === 6) {        // Armored van: window plates, roof hatch, rear doors
    const win = (xa, xb, z0, z1, sy) => {
      const t0 = (z0 - hz) / (S.cz - hz), t1 = (z1 - hz) / (S.cz - hz), cw = S.cab[2][1], tw = S.cabTop[2][1];
      const y0 = cw + (tw - cw) * t0 + 0.15, y1 = cw + (tw - cw) * t1 + 0.15;
      mesh([[[xa, sy * y0, z0], [xb, sy * y0, z0], [xb, sy * y1, z1], [xa, sy * y1, z1]]], GLASS, { hint: [0, sy, 0.3], gloss: true });
    };
    for (const sy of [-1, 1]) { win(S.cab[1][0] - 8, S.cab[1][0] - 2.5, hz + 4, S.cz - 2.5, sy); win(-14, -6, hz + 5, S.cz - 3, sy); }
    const fx0 = S.cab[1][0] + 0.15, fx1 = S.cabTop[1][0] + 0.15;
    mesh([[[fx0, -S.cab[2][1] + 1.6, hz + 2], [fx0, S.cab[2][1] - 1.6, hz + 2], [fx1, S.cabTop[2][1] - 1.6, S.cz - 1.5], [fx1, -S.cabTop[2][1] + 1.6, S.cz - 1.5]]], GLASS, { hint: [1, 0, 0.4], gloss: true });
    for (let k = 0; k < 3; k++) box(fx0 - 0.2 + k * 0.01, fx0 + 0.5, -S.cab[2][1] + 2, S.cab[2][1] - 2, hz + 4 + k * 3.5, hz + 4.6 + k * 3.5, '#2a2826', '#2a2826');
    box(-6, 2, -4, 4, S.cz, S.cz + 1.4, dark, shade(c, -0.25));
    box(S.rear - 0.4, S.rear + 0.1, -0.3, 0.3, hz, S.cz - 2, BLACK, BLACK);
  }
  if (shape === 7) {        // Hot rod: exposed engine, big blower, headers, wide rear fenders
    box(2, 14, -4.2, 4.2, hz, hz + 5, '#5a5852', '#6a6862');
    for (let k = 0; k < 5; k++) box(2.5 + k * 2.3, 3.2 + k * 2.3, -4.3, 4.3, hz + 0.5, hz + 4.6, '#3a3834', '#3a3834');
    box(4, 12, -2.8, 2.8, hz + 5, hz + 9, CHROME, '#9a978f', { gloss: true });
    for (let k = 0; k < 4; k++) box(4.4 + k * 2, 5 + k * 2, -2.9, 2.9, hz + 5.3, hz + 8.6, '#6a6862', '#6a6862');
    box(5.5, 10.5, -2, 2, hz + 9, hz + 11.5, '#2a2826', '#1a1a1a');
    for (const sy of [-1, 1]) {
      for (let k = 0; k < 4; k++) box(3.5 + k * 2.5, 4.6 + k * 2.5, sy * 4.3, sy * 6.8, hz + 1.5, hz + 2.6, '#7a6a5a', '#8a7a6a');
      box(3, 14, sy * 6.6, sy * 7.6, hz + 0.8, hz + 2.2, '#4a4844', '#1a1612');
      const W = S.wr; box(W.x - W.r - 1.5, W.x + W.r + 1.5, sy * (W.y0 - 0.5), sy * (W.y1 + 0.8), W.r * 2 - 1, W.r * 2 + 1.2, base, light);
    }
    box(15, 17, -6.8, 6.8, S.bz0 + 0.5, S.bz0 + 2, '#2a2826', '#3a3834');
  }

  // ---- per-rival paint & add-ons
  const col2 = K.col2 || '#1c1a18';
  const hood = S.noCab ? { x0: 7.5, x1: 17.5, z: hz + 2.5, w: 2 } : { x0: S.cab[1][0] + 1, x1: S.front - 2.5, z: hz, w: (shape === 7 ? 3 : S.hw - 2.5) };
  const roofA = S.noCab ? null : { x0: S.cabTop[0][0] + 0.5, x1: S.cabTop[1][0] - 0.5, z: S.cz, w: S.cabTop[2][1] - 0.6 };
  const trunk = (S.noCab || shape === 5) ? null : { x0: S.rear + 1.5, x1: S.cab[0][0] - 1.2, z: hz, w: S.hw - 2.5 };
  const plate = (pts, z, col) => add(pts, z, z + 0.14, col, col);
  const areas = [hood, roofA, trunk].filter(Boolean);
  for (const dec of K.decals || []) {
    if (dec === 'flames') {
      for (const [sc, col, zo] of [[1, '#e8561c', 0.15], [0.62, '#ffc83a', 0.3]]) {
        const pts = [[hood.x1, -hood.w * sc]], n = 5, len = (hood.x1 - hood.x0) * 0.95;
        for (let k = 0; k < n; k++) { const yc = -hood.w * sc + (k + 0.5) * (2 * hood.w * sc / n); pts.push([hood.x1 - len * sc * (0.55 + 0.45 * rng()), yc]); pts.push([hood.x1 - 2.5 * sc, yc + hood.w * sc / n]); }
        pts.push([hood.x1, hood.w * sc]);
        plate(pts, hood.z + zo, col);
      }
    }
    if (dec === 'twotone') areas.forEach(a => plate(rectXY(a.x0, a.x1, -a.w, a.w), a.z + 0.15, col2));
    if (dec === 'checker' && roofA) {
      const nx = 4, ny = 4, dx = (roofA.x1 - roofA.x0) / nx, dy = 2 * roofA.w / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) plate(rectXY(roofA.x0 + i * dx, roofA.x0 + (i + 1) * dx, -roofA.w + j * dy, -roofA.w + (j + 1) * dy), roofA.z + 0.15, (i + j) % 2 ? '#141414' : '#e8e2d2');
    }
    if (dec === 'hazard') {
      const n = 7, dy = 2 * hood.w / n;
      for (let k = 0; k < n; k++) { const y = -hood.w + k * dy; plate([[hood.x1, y], [hood.x1, y + dy], [hood.x1 - 3, y + dy * 1.6], [hood.x1 - 3, y + dy * 0.6]], hood.z + 0.2, k % 2 ? '#141210' : '#e0b41c'); }
    }
    if (dec === 'teeth') {
      plate([[hood.x1, -hood.w], [hood.x1, hood.w], [hood.x1 - 3.5, hood.w * 0.7], [hood.x1 - 4.5, 0], [hood.x1 - 3.5, -hood.w * 0.7]], hood.z + 0.15, '#7a1010');
      const n = 6;
      for (let k = 0; k < n; k++) { const y = -hood.w * 0.85 + (k + 0.5) * (1.7 * hood.w / n); plate([[hood.x1, y - 0.8], [hood.x1, y + 0.8], [hood.x1 - 2.6, y]], hood.z + 0.3, '#f4f0e4'); plate([[hood.x1 - 4.2, y - 0.8], [hood.x1 - 4.2, y + 0.8], [hood.x1 - 1.8, y]], hood.z + 0.3, '#f4f0e4'); }
      for (const sy of [-1, 1]) plate(circPts(hood.x1 - 7, sy * hood.w * 0.55, 1.1, 8), hood.z + 0.3, '#111');
    }
    if (dec === 'skull') {
      for (const a of [hood, roofA].filter(Boolean).slice(0, K.decals.length > 1 ? 2 : 1)) {
        const cx = (a.x0 + a.x1) / 2, sc = Math.min(1, a.w / 3.6);
        plate(circPts(cx + 0.8 * sc, 0, 3.2 * sc, 12), a.z + 0.15, '#ece4d0');
        plate(rectXY(cx - 3.2 * sc, cx - 0.5 * sc, -1.8 * sc, 1.8 * sc), a.z + 0.15, '#ece4d0');
        for (const sy of [-1, 1]) plate(circPts(cx + 1 * sc, sy * 1.3 * sc, 0.9 * sc, 8), a.z + 0.3, '#141210');
        plate([[cx - 1 * sc, -0.4 * sc], [cx - 1 * sc, 0.4 * sc], [cx - 0.1 * sc, 0]], a.z + 0.3, '#141210');
      }
    }
    if (dec === 'camo') {
      const cols = ['#5a6a3a', '#b8a070', '#3a3a2a', '#7a6a4a'];
      for (const a of areas) for (let k = 0; k < 4; k++) {
        const cx = a.x0 + rng() * (a.x1 - a.x0), cy = (rng() - 0.5) * 2 * a.w * 0.8, rr = 1.2 + rng() * 2.2;
        plate(circPts(cx, cy, rr, 7).map(([x, y]) => [clamp(x, a.x0, a.x1), clamp(y, -a.w, a.w)]), a.z + 0.15 + k * 0.01, cols[k % 4]);
      }
    }
    if (dec === 'rustheavy') for (let k = 0; k < 10; k++) {
      const a = areas[k % areas.length], x0 = a.x0 + rng() * (a.x1 - a.x0 - 2), w = 1.5 + rng() * 3.5, yy = (rng() - 0.5) * 2 * a.w * 0.8, h = 1 + rng() * 3;
      plate(rectXY(x0, Math.min(a.x1, x0 + w), yy - h / 2, yy + h / 2), a.z + 0.16, k % 3 ? RUSTC : '#5a2a12');
    }
  }
  for (const ad of K.addons || []) {
    if (ad === 'saws') for (const sy of [-1, 1]) {
      const cx = S.front - 1, cy = sy * (S.hw + 2.6), pts = [];
      for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, rr = k % 2 ? 4.4 : 5.6; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
      add(pts, S.bz0 + 1.6, S.bz0 + 2.3, '#8a8a80', '#cfcabe', { gloss: true });
      add(circPts(cx, cy, 1.3, 8), S.bz0 + 2.3, S.bz0 + 2.8, '#222', '#333');
      box(cx - 4, cx, sy * (S.hw - 0.5), sy * (S.hw + 1.6), S.bz0 + 1.4, S.bz0 + 2.5, '#3a3834', '#4a4844');
    }
    if (ad === 'ram') {
      add([[S.front + 0.3, -S.hw - 1.8], [S.front + 6, -3.5], [S.front + 8.5, 0], [S.front + 6, 3.5], [S.front + 0.3, S.hw + 1.8]], S.bz0 - 1, S.bz0 + 5.5, STEEL, '#8a8678', { gloss: true });
      for (let k = 0; k < 4; k++) { const y = -S.hw + 1 + k * (2 * S.hw - 2) / 3; box(S.front + 0.3, S.front + 3.5 - Math.abs(y) * 0.1, y - 0.5, y + 0.5, S.bz0 + 5.5, S.bz0 + 6, '#e0b41c', '#e0b41c'); }
    }
    if (ad === 'harpoon') {
      const z = (S.noCab ? S.cz : S.cz) + 1.6, x0 = S.noCab ? -8 : S.cabTop[0][0];
      box(x0, S.front + 9, 1.6, 2.6, z, z + 1, '#3a3028', '#4a3a2c');
      spike(S.front + 9, 2.1, z + 0.5, 4, 1, 1, '#8a8a80');
      box(x0 + 2, x0 + 4, 0.8, 3.4, z - 1.6, z, '#2a2826', '#3a3834');
    }
    if (ad === 'flags') for (const sy of [-1, 1]) {
      const ax = S.rear + 2.5, ay = sy * (S.hw - 1.5), top = Math.max(S.cz, hz + 8) + 8;
      box(ax - 0.3, ax + 0.3, ay - 0.3, ay + 0.3, hz, top, '#2a2826', '#2a2826');
      const fl = [[ax, ay, top], [ax - 6, ay + sy * 0.6, top - 1], [ax - 6, ay + sy * 0.6, top - 4.4], [ax, ay, top - 3.6]];
      const fc = sy > 0 ? (K.flag || '#8a2418') : col2;
      mesh([fl], fc, { hint: [0, 1, 0] }); mesh([fl.slice().reverse()], fc, { hint: [0, -1, 0] });
    }
    if (ad === 'cage' && roofA) {
      for (const [x, y] of S.cabTop) box(x - 0.35, x + 0.35, y - 0.35, y + 0.35, S.cz, S.cz + 5, '#3a3834', '#4a4844');
      for (const y of [S.cabTop[0][1], S.cabTop[2][1]]) box(S.cabTop[0][0] - 0.35, S.cabTop[1][0] + 0.35, y - 0.35, y + 0.35, S.cz + 4.4, S.cz + 5.1, '#3a3834', '#4a4844');
      for (let k = 0; k < 3; k++) { const x = S.cabTop[0][0] + (k + 0.5) * (S.cabTop[1][0] - S.cabTop[0][0]) / 3; box(x - 0.3, x + 0.3, S.cabTop[0][1], S.cabTop[2][1], S.cz + 4.4, S.cz + 5.1, '#3a3834', '#4a4844'); }
    }
    if (ad === 'roofTires' && roofA) {
      const cx = (roofA.x0 + roofA.x1) / 2 - 1;
      for (let k = 0; k < 2; k++) { add(circPts(cx + k * 0.8, k * 0.6, 4.4, 12), S.cz + k * 2.6, S.cz + 2.5 + k * 2.6, TIRE, '#222'); }
      add(circPts(cx + 0.8, 0.6, 2.2, 10), S.cz + 5.2, S.cz + 5.3, '#0a0a0a', '#0a0a0a');
    }
    if (ad === 'ladder' && roofA) for (const sy of [1]) {
      const y0 = sy * (S.hw + 0.3), y1 = sy * (S.hw + 0.8);
      for (const z of [hz + 2, S.cz - 1]) box(-18, 6, y0, y1, z, z + 0.7, '#5a5852', '#6a6862');
      for (let x = -17; x <= 5; x += 3) box(x, x + 0.6, y0, y1, hz + 2, S.cz - 0.3, '#5a5852', '#6a6862');
    }
    if (ad === 'bedjunk' && shape === 5) {
      add(circPts(-17, -5, 2.8, 10), hz, hz + 7, '#8a3a18', '#6a2a12');
      add(circPts(-10, 4, 4.2, 12), hz, hz + 2.6, TIRE, '#222'); add(circPts(-10, 4, 2, 8), hz + 2.6, hz + 2.7, '#0a0a0a', '#0a0a0a');
      box(-20, -14, 2, 7, hz, hz + 3.5, '#5a4a32', '#6a5a3e');
    }
    if (ad === 'zoomies') for (const sy of [-1, 1]) for (let k = 0; k < 3; k++) {
      const x = 4 + k * 3.5; box(x, x + 1.2, sy * (S.hw - 0.3), sy * (S.hw + 1), hz + 1, hz + 7 + k, '#4a4844', '#1a1612');
      box(x - 0.2, x + 1.4, sy * (S.hw - 0.4), sy * (S.hw + 1.1), hz + 6.2 + k, hz + 7 + k, RUSTC, '#1a1612');
    }
    if (ad === 'bigspikes') for (const sy of [-1, 1]) for (let k = 0; k < 5; k++) {
      const x = -S.len3 + 4 + k * (S.front + S.len3 - 10) / 4, z = S.bz0 + 3, yb = sy * (S.hw + 0.4), r = 1.1;
      const A = [x, sy * (S.hw + 6), z], b = [[x - r, yb, z - r], [x + r, yb, z - r], [x + r, yb, z + r], [x - r, yb, z + r]];
      mesh([0, 1, 2, 3].map(i => [A, b[i], b[(i + 1) % 4]]), CHROME, { gloss: true });
    }
  }
  return P;
}

// ---------------- procedural material textures for cars ----------------
// Each material = a "multiply" tile (grime, pits, tread...) and an optional "screen" tile (scratches, reflections).
// They are mapped onto every big face with an exact affine transform while the car sheets are rendered.
const MAT_DENS = 4;                 // texels per world unit
const CAR_TEX = !LOW_MEM;           // phones skip texturing (faster loading)
let MAT_TILES = null;
function makeMaterialTiles() {
  if (MAT_TILES) return MAT_TILES;
  const S = 128, mk = () => { const c = makeCanvas(S, S); return [c, c.getContext('2d')]; };
  const rng = mulberry(9090);
  const noiseFill = (g, lo, hi, cells, seed) => {
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let n = 0, a = 0.6, t = 0;
      for (let o = 0; o < 3; o++) { const p = cells << o, f = p / S; n += vnoiseP(x * f, y * f, p, seed + o * 13) * a; t += a; a *= 0.5; }
      const v = lo + (hi - lo) * (n / t) + (rng() - 0.5) * 14, i = (y * S + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = clamp(v, 0, 255); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  };
  const scratches = (g, n, col, wmax) => {
    g.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const x = rng() * S, y = rng() * S, a = rng() * Math.PI, l = 4 + rng() * 22;
      g.strokeStyle = col; g.lineWidth = 0.5 + rng() * wmax;
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); }
    }
  };
  const blotches = (g, n, col, rmin, rmax) => {
    for (let k = 0; k < n; k++) {
      const x = rng() * S, y = rng() * S, r = rmin + rng() * (rmax - rmin);
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  };
  const T = {};
  // painted sheet metal: light noise, grime patches, chips
  let [m, g] = mk(); noiseFill(g, 205, 255, 4, 11); blotches(g, 10, 'rgba(150,120,90,0.45)', 8, 26); scratches(g, 30, 'rgba(90,70,50,0.5)', 1);
  for (let k = 0; k < 40; k++) circ(g, rng() * S, rng() * S, 0.6 + rng() * 1.4, 'rgba(110,80,55,0.7)');
  let [sc, sg] = mk(); sg.fillStyle = '#000'; sg.fillRect(0, 0, S, S); scratches(sg, 26, 'rgba(255,240,220,0.55)', 0.8);
  T.paint = { mul: m, mulA: 0.75, scr: sc, scrA: 0.35 };
  // bare steel plates: brushed streaks, seams and rivets
  [m, g] = mk(); noiseFill(g, 175, 245, 8, 21);
  for (let y = 0; y < S; y += 2) { g.fillStyle = `rgba(0,0,0,${rng() * 0.08})`; g.fillRect(0, y, S, 1); }
  g.strokeStyle = 'rgba(40,30,20,0.85)'; g.lineWidth = 1.4; g.strokeRect(0.7, 0.7, S - 1.4, S - 1.4); g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.stroke();
  for (const x of [5, S / 2 - 5, S / 2 + 5, S - 5]) for (let y = 6; y < S; y += 20) circ(g, x, y, 1.6, 'rgba(50,40,30,0.8)');
  blotches(g, 6, 'rgba(140,80,40,0.5)', 6, 18);
  [sc, sg] = mk(); sg.fillStyle = '#000'; sg.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 3) { sg.fillStyle = `rgba(255,250,240,${rng() * 0.12})`; sg.fillRect(0, y, S, 1); }
  for (const x of [5, S / 2 - 5, S / 2 + 5, S - 5]) for (let y = 6; y < S; y += 20) circ(sg, x - 0.6, y - 0.6, 0.8, 'rgba(255,240,220,0.8)');
  T.metal = { mul: m, mulA: 0.85, scr: sc, scrA: 0.5 };
  // rust: pitted and flaky
  [m, g] = mk(); noiseFill(g, 120, 255, 6, 31); for (let k = 0; k < 120; k++) circ(g, rng() * S, rng() * S, 0.5 + rng() * 2, 'rgba(40,15,5,0.6)');
  T.rust = { mul: m, mulA: 0.9 };
  // tire rubber: tread blocks across the running surface
  [m, g] = mk(); noiseFill(g, 200, 240, 8, 41);
  for (let x = 0; x < S; x += 8) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x, 0, 3, S); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + 4, S * 0.3, 2, S * 0.4); }
  T.tire = { mul: m, mulA: 0.9 };
  // glass: dark gradient + diagonal sky reflections
  [m, g] = mk(); const gg = g.createLinearGradient(0, 0, 0, S); gg.addColorStop(0, '#fff'); gg.addColorStop(1, '#9aa0a8'); g.fillStyle = gg; g.fillRect(0, 0, S, S);
  [sc, sg] = mk(); sg.fillStyle = '#000'; sg.fillRect(0, 0, S, S); sg.save(); sg.translate(S / 2, S / 2); sg.rotate(-0.6);
  for (const [o, w, a] of [[-40, 18, 0.55], [-12, 6, 0.4], [20, 26, 0.3], [56, 8, 0.45]]) { sg.fillStyle = `rgba(255,245,230,${a})`; sg.fillRect(o, -S, w, S * 2); }
  sg.restore(); T.glass = { mul: m, mulA: 0.6, scr: sc, scrA: 0.65 };
  // chrome: strong horizontal bands
  [m, g] = mk(); noiseFill(g, 215, 255, 8, 51);
  [sc, sg] = mk(); sg.fillStyle = '#000'; sg.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 16) { const gr = sg.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = gr; sg.fillRect(0, y, S, 16); }
  T.chrome = { mul: m, mulA: 0.6, scr: sc, scrA: 0.45 };
  MAT_TILES = T;
  return T;
}
function makeMatPatterns(g) {
  const T = makeMaterialTiles(), P = {};
  for (const k in T) P[k] = { mul: g.createPattern(T[k].mul, 'repeat'), mulA: T[k].mulA, scr: T[k].scr ? g.createPattern(T[k].scr, 'repeat') : null, scrA: T[k].scrA };
  return P;
}
const MAT_BY_COLOR = {
  '#3a4e60': 'glass', '#9ab0c0': 'glass', '#1c1b1a': 'tire', '#262422': 'tire', '#0e0e0d': 'tire', '#1a1a1a': 'tire',
  '#b9b6ad': 'chrome', '#cfcabe': 'chrome', '#cfccc2': 'chrome', '#9a978f': 'chrome', '#8a8a80': 'chrome', '#8a8a82': 'chrome', '#c8c2b0': 'chrome',
  '#7a3e1e': 'rust', '#5a2a12': 'rust', '#8a3a18': 'rust', '#6a3a22': 'rust', '#5a2e1a': 'rust'
};
function materialFor(p) {
  if (p.em) return null;
  if (p.mat) return p.mat;
  const c = p.side;
  if (MAT_BY_COLOR[c]) return MAT_BY_COLOR[c];
  if (c.startsWith('rgb(')) return 'paint';          // body colors come from shade()
  return 'metal';
}

function drawCar3(g, parts, a, ox, oy, pats) {
  const ca = Math.cos(a), sa = Math.sin(a), R = CAR_RES3, K = VIEW_K;
  const items = parts.map((p, pi) => {
    if (p.mesh) {
      const F = p.mesh.map(f => f.map(([x, y, z]) => [x * ca - y * sa, x * sa + y * ca, z]));
      const all = F.flat(), cen = [0, 1, 2].map(k => all.reduce((s, v) => s + v[k], 0) / all.length);
      const hint = p.hint ? [p.hint[0] * ca - p.hint[1] * sa, p.hint[0] * sa + p.hint[1] * ca, p.hint[2]] : null;
      return { p, F, cen, pi, hint, depth: cen[1] * VIEW_IZ + cen[2] * VIEW_IY };
    }
    const B = p.pts.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca, p.z0]);
    const T = p.top.map(([x, y]) => [x * ca - y * sa, x * sa + y * ca, p.z1]);
    const all = B.concat(T), cen = [0, 1, 2].map(k => all.reduce((s, v) => s + v[k], 0) / all.length);
    return { p, B, T, cen, pi, depth: cen[1] * VIEW_IZ + cen[2] * VIEW_IY };
  });
  const order = [0, 1, 2].flatMap(cat => items.filter(it => it.p.cat === cat).sort((x, y) => x.depth - y.depth || x.pi - y.pi));
  const proj = v => [ox + v[0] * R, oy + (v[1] - v[2] * K) * R];
  for (const it of order) {
    const { p, B, T, cen } = it;
    const faces = [];
    if (p.mesh) it.F.forEach(v => faces.push({ v, top: false }));
    else {
      const n = B.length;
      for (let i = 0; i < n; i++) faces.push({ v: [B[i], B[(i + 1) % n], T[(i + 1) % n], T[i]], top: false });
      faces.push({ v: T, top: true });
    }
    faces.forEach((f, fi) => {
      // Newell normal, oriented away from the part center
      let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < f.v.length; i++) {
        const u = f.v[i], w = f.v[(i + 1) % f.v.length];
        nx += (u[1] - w[1]) * (u[2] + w[2]); ny += (u[2] - w[2]) * (u[0] + w[0]); nz += (u[0] - w[0]) * (u[1] + w[1]);
      }
      const fc = [0, 1, 2].map(k => f.v.reduce((s, v) => s + v[k], 0) / f.v.length);
      if (it.hint ? nx * it.hint[0] + ny * it.hint[1] + nz * it.hint[2] < 0 : nx * (fc[0] - cen[0]) + ny * (fc[1] - cen[1]) + nz * (fc[2] - cen[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz); if (l < 1e-6) return;
      nx /= l; ny /= l; nz /= l;
      if (nx * VIEW3[0] + ny * VIEW3[1] + nz * VIEW3[2] <= 0.002) return;
      const baseCol = cssRGB(f.top ? p.topc : p.side);
      let col;
      if (p.em) col = baseCol;
      else {
        const dif = Math.max(0, nx * LIGHT3[0] + ny * LIGHT3[1] + nz * LIGHT3[2]);
        const k = (0.4 + 0.72 * dif) * (1 + (hash2(it.pi, fi, 7) - 0.5) * 0.16);   // weathered, uneven panels
        col = baseCol.map(v => v * k);
        if (p.gloss) { const sp = Math.pow(Math.max(0, nx * HALF3[0] + ny * HALF3[1] + nz * HALF3[2]), 16) * (p.side === p.topc ? 55 : 110); col = col.map(v => v + sp); }
      }
      const css = `rgb(${col.map(v => Math.round(clamp(v, 0, 255))).join(',')})`;
      const sp = f.v.map(proj);
      g.beginPath();
      sp.forEach(([sx, sy], i) => (i ? g.lineTo(sx, sy) : g.moveTo(sx, sy)));
      g.closePath();
      g.fillStyle = css; g.fill();
      g.strokeStyle = css; g.lineWidth = 0.7; g.stroke();
      if (!pats || p.em) return;
      let area = 0;
      for (let i = 0; i < sp.length; i++) { const q = sp[i], w = sp[(i + 1) % sp.length]; area += q[0] * w[1] - w[0] * q[1]; }
      area = Math.abs(area) / 2;
      if (area < 26) return;                               // tiny bits: flat color is enough
      const mat = materialFor(p), M = mat && pats[mat];
      // texture axes: car-local x/y on top faces, edge direction + up on side faces
      let U, V;
      if (f.top) { U = [ca, sa, 0]; V = [-sa, ca, 0]; }
      else {
        const e0 = [f.v[1][0] - f.v[0][0], f.v[1][1] - f.v[0][1], f.v[1][2] - f.v[0][2]], le = Math.hypot(...e0) || 1;
        U = e0.map(x => x / le);
        V = Math.abs(nz) > 0.85 ? [-U[1], U[0], 0] : [0, 0, 1];
      }
      const o = sp[0], pu = [U[0] * R, (U[1] - U[2] * K) * R], pv = [V[0] * R, (V[1] - V[2] * K) * R];
      g.save();
      g.clip();
      g.setTransform(pu[0] / MAT_DENS, pu[1] / MAT_DENS, pv[0] / MAT_DENS, pv[1] / MAT_DENS, o[0], o[1]);
      if (M) {
        g.globalCompositeOperation = 'multiply'; g.globalAlpha = M.mulA; g.fillStyle = M.mul; g.fillRect(-2048, -2048, 4096, 4096);
        if (M.scr) { g.globalCompositeOperation = 'screen'; g.globalAlpha = M.scrA; g.fillStyle = M.scr; g.fillRect(-2048, -2048, 4096, 4096); }
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      if (!f.top && !p.mesh && p.cat !== 0 && Math.abs(nz) < 0.85) {   // contact shadow at the bottom of side panels
        const ao = g.createLinearGradient(0, 0, 0, 3.2 * MAT_DENS); ao.addColorStop(0, 'rgba(10,6,3,0.5)'); ao.addColorStop(1, 'rgba(10,6,3,0)');
        g.fillStyle = ao; g.fillRect(-2048, 0, 4096, 3.2 * MAT_DENS);
      }
      g.restore();
      if (nz > 0.6 && (mat === 'paint' || mat === 'metal')) {          // light catching the top edges
        g.strokeStyle = 'rgba(255,240,215,0.3)'; g.lineWidth = 0.9; g.stroke();
      }
    });
  }
}

function carSheetKey(shape, color, kit) { return `car3_${shape}_${color.toString(16)}_${kit || 'p'}`; }
// one frame: draw the textured car into a scratch canvas, then stamp a soft dark outline + the car
let CAR_TMP = null;
function composeCarFrame(dst, parts, a, x0, y0, lo) {
  if (!CAR_TMP) {
    const t = makeCanvas(CAR_FW, CAR_FH), s2 = makeCanvas(CAR_FW, CAR_FH);
    CAR_TMP = { t, tg: t.getContext('2d'), s: s2, sg: s2.getContext('2d'), pats: null };
    CAR_TMP.tg.lineJoin = 'round';
    if (CAR_TEX) CAR_TMP.pats = makeMatPatterns(CAR_TMP.tg);
  }
  const { t, tg, s: sil, sg } = CAR_TMP;
  tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, CAR_FW, CAR_FH);
  drawCar3(tg, parts, a, CAR_FW / 2, (CAR_RAD + CAR_HMAX) * CAR_RES3, lo ? null : CAR_TMP.pats);
  sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, CAR_FW, CAR_FH); sg.drawImage(t, 0, 0);
  sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#0c0805'; sg.fillRect(0, 0, CAR_FW, CAR_FH);
  dst.globalAlpha = 0.6;
  for (const [dx, dy] of [[-1.3, 0], [1.3, 0], [0, -1.3], [0, 1.3]]) dst.drawImage(sil, x0 + dx, y0 + dy);
  dst.globalAlpha = 1;
  dst.drawImage(t, x0, y0);
}
// Each car = CAR_FRAMES small textures (one per angle). Every angle is uploaded right after it is drawn,
// so the GPU rasterizes it in small pieces (no long stall) and background pre-rendering stays smooth.
const SHEET_JOBS = new Map();
const angleKey = (base, i) => base + '_f' + i;
function sheetJob(shape, color, kit, lo) {
  const key = carSheetKey(shape, color, kit) + (lo ? '_lo' : '');
  let j = SHEET_JOBS.get(key);
  if (!j) { j = { key, parts: carModel(shape, color, kit), f: 0, lo }; SHEET_JOBS.set(key, j); }
  return j;
}
function runSheetJob(scene, j, budgetMs) {
  const t0 = performance.now();
  while (j.f < CAR_FRAMES && performance.now() - t0 < budgetMs) {
    const k = angleKey(j.key, j.f);
    if (!scene.textures.exists(k)) {
      const cv = makeCanvas(CAR_FW, CAR_FH);
      composeCarFrame(cv.getContext('2d'), j.parts, j.f / CAR_FRAMES * TAU, 0, 0, j.lo);
      scene.textures.addCanvas(k, cv);
    }
    j.f++;
  }
  if (j.f < CAR_FRAMES) return false;
  SHEET_JOBS.delete(j.key);
  return true;
}
const sheetReady = (scene, key) => scene.textures.exists(angleKey(key, CAR_FRAMES - 1));
function renderCarSheet(scene, shape, color, kit, lo) {
  const key = carSheetKey(shape, color, kit) + (lo ? '_lo' : '');
  if (!sheetReady(scene, key)) runSheetJob(scene, sheetJob(shape, color, kit, lo), Infinity);
  return key;
}
// pre-render cars in the background (about one angle per frame) while a menu is shown
function prewarmCarSheets(scene, list) {
  const todo = list.filter(([sh, c, k]) => !sheetReady(scene, carSheetKey(sh, c, k)));
  if (!todo.length) return;
  const ev = scene.time.addEvent({ delay: 16, loop: true, callback: () => {
    if (!todo.length) { ev.remove(); return; }
    const [sh, c, k] = todo[0];
    if (sheetReady(scene, carSheetKey(sh, c, k)) || runSheetJob(scene, sheetJob(sh, c, k), 1)) todo.shift();
    if (!todo.length) ev.remove();
  } });
}
function carFrame(a) {
  const f = (((a % TAU) + TAU) % TAU) / TAU * CAR_FRAMES, i = Math.round(f);
  return { name: 'f' + (i % CAR_FRAMES), rest: (f - i) * TAU / CAR_FRAMES };
}
// single pre-rendered frame (cheap; for static menu cars)
function carFrameTex(scene, shape, color, heading, kit) {
  const fi = carFrame(heading).name.slice(1), key = `car3f_${shape}_${color.toString(16)}_${kit || 'p'}_${fi}`;
  if (scene.textures.exists(key)) return key;
  const cv = makeCanvas(CAR_FW, CAR_FH), g = cv.getContext('2d');
  composeCarFrame(g, carModel(shape, color, kit), fi / CAR_FRAMES * TAU, 0, 0);
  scene.textures.addCanvas(key, cv);
  return key;
}
// image of a car for menus (no camera squash there, so compensate Y); spin = needs all angles
function addCarImage(scene, x, y, shape, color, scale, heading = 0.5, spin = false, kit) {
  let im;
  if (spin) { const base = renderCarSheet(scene, shape, color, kit); im = scene.add.image(x, y, base + '_' + carFrame(heading).name); im.sheetBase = base; }
  else im = scene.add.image(x, y, carFrameTex(scene, shape, color, heading, kit));
  const k = scale * 2 / CAR_RES3;              // scale is relative to the old 2x sprites
  return im.setOrigin(0.5, CAR_OY).setScale(k, k * VIEW_IY);
}
// free car sheets that are not needed (mobile memory)
function pruneCarSheets(scene, keep) {
  scene.textures.getTextureKeys().forEach(k => { if (k.startsWith('car3_') && !keep.includes(k.replace(/_f\d+$/, ''))) scene.textures.remove(k); });
  for (const k of [...SHEET_JOBS.keys()]) if (!keep.includes(k)) SHEET_JOBS.delete(k);
}

// ---------------- fx textures ----------------
function makeFxTextures(scene) {
  const add = (key, w, h, fn) => { if (scene.textures.exists(key)) return; const cv = makeCanvas(w, h); fn(cv.getContext('2d'), w, h); scene.textures.addCanvas(key, cv); };
  add('vignette', 320, 180, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, w * 0.62);
    gr.addColorStop(0, 'rgba(40,20,8,0)'); gr.addColorStop(0.7, 'rgba(40,20,8,0.28)'); gr.addColorStop(1, 'rgba(25,12,5,0.7)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
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
