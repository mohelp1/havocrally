'use strict';
// ============================================================
//  HAVOC RALLY – wasteland menu art: rust plates, spikes, chains,
//  burning-wreck backdrop, fire & ember ambience, buggy convoy
// ============================================================

// ---------------- bones (canvas drawing) ----------------
function boneFill(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#f4ead2'); gr.addColorStop(0.55, '#cdbd98'); gr.addColorStop(1, '#8a7a5a');
  return gr;
}
function drawFemur(g, x0, y0, x1, y1, w) {
  const a = Math.atan2(y1 - y0, x1 - x0), l = Math.hypot(x1 - x0, y1 - y0);
  g.save(); g.translate(x0, y0); g.rotate(a);
  g.beginPath(); g.rect(0, -w * 0.32, l, w * 0.64);
  for (const ex of [0, l]) for (const ey of [-w * 0.42, w * 0.42]) { g.moveTo(ex + w * 0.6, ey); g.arc(ex, ey, w * 0.6, 0, Math.PI * 2); }
  g.fillStyle = boneFill(g, 0, -w, 0, w); g.fill('nonzero');
  g.strokeStyle = 'rgba(40,28,16,0.7)'; g.lineWidth = 1.4; g.stroke();
  g.restore();
}
function drawHornedSkull(g, x, y, s, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  // horns
  for (const sd of [-1, 1]) {
    g.beginPath(); g.moveTo(sd * 12, -16); g.quadraticCurveTo(sd * 44, -14, sd * 52, -46); g.quadraticCurveTo(sd * 38, -22, sd * 10, -8); g.closePath();
    const hg = g.createLinearGradient(sd * 10, -10, sd * 52, -46); hg.addColorStop(0, '#d8c8a2'); hg.addColorStop(0.7, '#9a8662'); hg.addColorStop(1, '#3a2e20');
    g.fillStyle = hg; g.fill(); g.strokeStyle = 'rgba(40,28,16,0.75)'; g.lineWidth = 1.3; g.stroke();
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(sd * (14 + k * 7), -15 - k * 3); g.lineTo(sd * (12 + k * 7), -10 - k * 4); g.strokeStyle = 'rgba(60,40,20,0.35)'; g.stroke(); }
  }
  // skull
  g.beginPath(); g.moveTo(-17, -14); g.quadraticCurveTo(0, -26, 17, -14); g.lineTo(13, 8); g.quadraticCurveTo(9, 30, 0, 34); g.quadraticCurveTo(-9, 30, -13, 8); g.closePath();
  g.fillStyle = boneFill(g, -17, -20, 17, 34); g.fill(); g.strokeStyle = 'rgba(40,28,16,0.8)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#1a120a';
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 8, -4, 5, 6.5, sd * 0.3, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(sd * 3, 25, 1.8, 3, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(40,28,16,0.5)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-2, -18); g.lineTo(2, -9); g.lineTo(-1, -2); g.moveTo(9, 6); g.lineTo(5, 14); g.stroke();
  g.restore();
}
function drawHumanSkull(g, x, y, s, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.beginPath(); g.arc(0, -4, 14, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(9, 12); g.lineTo(-9, 12); g.closePath();
  g.fillStyle = boneFill(g, -14, -18, 14, 12); g.fill(); g.strokeStyle = 'rgba(40,28,16,0.8)'; g.lineWidth = 1.4; g.stroke();
  g.fillStyle = '#1a120a';
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 5.5, -1, 4, 4.6, 0, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.moveTo(0, 4); g.lineTo(-2, 8); g.lineTo(2, 8); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,20,10,0.8)'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 2.6, 10); g.lineTo(k * 2.6, 13.5); g.stroke(); }
  g.restore();
}
function drawRibcage(g, x, y, s, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.strokeStyle = '#3a2a18'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-46, 0); g.lineTo(46, 0); g.stroke();
  g.strokeStyle = '#d8c8a2'; g.lineWidth = 5; g.stroke();
  for (let k = 0; k < 7; k++) {
    const rx = -34 + k * 11, rr = 26 - Math.abs(k - 3) * 3;
    for (const sd of [-1, 1]) {
      g.beginPath(); g.moveTo(rx, 0); g.quadraticCurveTo(rx + 10, sd * rr * 1.2, rx - 6, sd * rr);
      g.strokeStyle = 'rgba(40,28,16,0.7)'; g.lineWidth = 4.6; g.stroke();
      g.strokeStyle = k % 2 ? '#cdbd98' : '#e6d8b8'; g.lineWidth = 3; g.stroke();
    }
  }
  for (let k = 0; k < 9; k++) circ(g, -40 + k * 10, 0, 2.6, '#f0e4c8');
  g.restore();
}
// a heap of bones: ribcage, crossed femurs, horned skull, small skulls
function drawBonePile(g, x, y, s, seed = 1) {
  const rng = mulberry(seed);
  g.save(); g.translate(x, y); g.scale(s, s);
  const sh = g.createRadialGradient(0, 18, 0, 0, 18, 120); sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.beginPath(); g.ellipse(0, 18, 120, 34, 0, 0, Math.PI * 2); g.fill();
  drawRibcage(g, 34, -6, 0.9, -0.25);
  for (let k = 0; k < 5; k++) { const a = rng() * Math.PI, cx = (rng() - 0.5) * 150, cy = 8 + rng() * 16, l = 24 + rng() * 22; drawFemur(g, cx - Math.cos(a) * l / 2, cy - Math.sin(a) * l * 0.3, cx + Math.cos(a) * l / 2, cy + Math.sin(a) * l * 0.3, 6 + rng() * 2); }
  drawFemur(g, -60, 22, 10, -16, 10); drawFemur(g, -64, -14, 4, 24, 10);
  drawHumanSkull(g, 78, 10, 1.1, 0.3); drawHumanSkull(g, -92, 16, 0.9, -0.4);
  drawHornedSkull(g, -18, -12, 1.25, -0.08);
  g.restore();
}

function makeMenuTextures(scene) {
  if (!scene.textures.exists('bonepile')) {
    const cv = makeCanvas(420, 220), g = cv.getContext('2d');
    drawBonePile(g, 210, 140, 1.25, 7);
    scene.textures.addCanvas('bonepile', cv);
    const cv2 = makeCanvas(160, 200), g2 = cv2.getContext('2d');      // horned skull on a spiked pike
    g2.fillStyle = '#2a1d12'; g2.fillRect(76, 60, 8, 140); g2.fillStyle = '#4a3420'; g2.fillRect(76, 60, 3, 140);
    drawHornedSkull(g2, 80, 66, 1.15);
    scene.textures.addCanvas('skullpike', cv2);
  }
  if (!scene.textures.exists('rustplate')) {
    const cv = noiseTile(256, '#5c4a3c', '#3a2f27', 6, 333, 20, [['rgba(20,12,8,0.35)', 140, 1], ['rgba(200,180,150,0.15)', 80, 0.8]]);
    const g = cv.getContext('2d'), rng = mulberry(4242);
    for (let k = 0; k < 18; k++) {                     // rust blooms
      const x = rng() * 256, y = rng() * 256, r = 10 + rng() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${140 + rng() * 40},${55 + rng() * 25},20,0.45)`); gr.addColorStop(1, 'rgba(120,50,20,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.lineCap = 'round';
    for (let k = 0; k < 40; k++) {                     // scratches
      const x = rng() * 256, y = rng() * 256, a = rng() * 7, l = 8 + rng() * 40;
      g.strokeStyle = `rgba(210,195,170,${0.08 + rng() * 0.15})`; g.lineWidth = 0.6 + rng();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let k = 0; k < 14; k++) {                     // rust streaks running down
      const x = rng() * 256, y = rng() * 256, l = 20 + rng() * 60, gr = g.createLinearGradient(0, y, 0, y + l);
      gr.addColorStop(0, 'rgba(110,45,15,0.35)'); gr.addColorStop(1, 'rgba(110,45,15,0)');
      g.fillStyle = gr; g.fillRect(x, y, 2 + rng() * 4, l);
    }
    scene.textures.addCanvas('rustplate', cv);
  }
  if (!scene.textures.exists('menubg')) {
    const W = GW, H = GH, cv = makeCanvas(W, H), g = cv.getContext('2d'), rng = mulberry(777), HZ = 455;
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#160a06'); sky.addColorStop(0.3, '#4a1c0c'); sky.addColorStop(0.55, '#b8561c'); sky.addColorStop(0.63, '#e08c3c');
    sky.addColorStop(0.635, '#3a2214'); sky.addColorStop(1, '#100a06');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    let gr = g.createRadialGradient(930 * W / 1280, 430, 0, 930 * W / 1280, 430, 300); gr.addColorStop(0, 'rgba(255,215,140,0.6)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    circ(g, 930 * W / 1280, 430, 58, 'rgba(255,225,170,0.55)');
    for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(60,25,10,${0.08 + rng() * 0.1})`; g.fillRect(0, 120 + k * 45 + rng() * 20, W, 8 + rng() * 20); }
    // mesas: far and mid silhouettes
    const ridge = (base, hmax, col, seed) => {
      const r2 = mulberry(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, H); let x = 0, y = base;
      g.lineTo(0, y);
      while (x < W) {
        if (r2() < 0.35) { const w = 60 + r2() * 140, h = 30 + r2() * hmax; g.lineTo(x + 10, base - h); g.lineTo(x + w - 10, base - h); g.lineTo(x + w, base); x += w; }
        else { x += 30 + r2() * 60; y = base - r2() * 18; g.lineTo(x, y); }
      }
      g.lineTo(W, H); g.closePath(); g.fill();
    };
    ridge(HZ, 90, 'rgba(110,48,20,0.75)', 3); ridge(HZ + 12, 60, '#4a2212', 9);
    gr = g.createLinearGradient(0, HZ + 10, 0, H); gr.addColorStop(0, '#3e2616'); gr.addColorStop(1, '#0e0805');
    g.fillStyle = gr; g.fillRect(0, HZ + 10, W, H - HZ);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '160,110,70'},${0.1 + rng() * 0.2})`; g.fillRect(rng() * W, HZ + 12 + rng() * (H - HZ), 1 + rng() * 2, 1); }
    // wreck silhouettes, spike fences and tire stacks
    const fires = [];
    const wreck = (x, y, s, flip, burning) => {
      g.save(); g.translate(x, y); g.scale(s * (flip ? -1 : 1), s); g.rotate((rng() - 0.5) * 0.25);
      g.fillStyle = '#0d0704';
      g.beginPath(); g.moveTo(-34, 0); g.lineTo(-34, -12); g.lineTo(-20, -14); g.lineTo(-10, -26); g.lineTo(12, -26); g.lineTo(20, -14); g.lineTo(36, -11); g.lineTo(38, 0); g.closePath(); g.fill();
      for (const wx of [-22, 22]) { g.beginPath(); g.arc(wx, 0, 8, 0, 7); g.fill(); }
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(36, -6 + k * 3); g.lineTo(46, -5 + k * 3); g.lineTo(36, -4 + k * 3); g.fill(); }
      g.restore();
      if (burning) {
        const r = 70 * s; const fg = g.createRadialGradient(x, y - 14 * s, 0, x, y - 14 * s, r);
        fg.addColorStop(0, 'rgba(255,150,60,0.55)'); fg.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = fg; g.fillRect(x - r, y - 14 * s - r, r * 2, r * 2);
        fires.push({ x: x + (rng() - 0.5) * 20 * s, y: y - 20 * s, s: s * 1.2 });
        for (let k = 0; k < 9; k++) {                  // baked smoke column drifting right
          const sx = x + k * k * 2.2 * s + (rng() - 0.5) * 10, sy = y - 40 * s - k * 22 * s, sr = (14 + k * 7) * s;
          const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr); sg.addColorStop(0, `rgba(20,12,8,${0.45 - k * 0.04})`); sg.addColorStop(1, 'rgba(20,12,8,0)');
          g.fillStyle = sg; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
        }
      }
    };
    const fence = (x0, x1, y, s) => {
      g.strokeStyle = '#0d0704'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(x0, y - 18 * s); g.lineTo(x1, y - 18 * s); g.moveTo(x0, y - 8 * s); g.lineTo(x1, y - 8 * s); g.stroke();
      g.fillStyle = '#0d0704';
      for (let x = x0; x <= x1; x += 26 * s) { g.fillRect(x - 2 * s, y - 34 * s, 4 * s, 34 * s); g.beginPath(); g.moveTo(x - 3 * s, y - 34 * s); g.lineTo(x, y - 46 * s); g.lineTo(x + 3 * s, y - 34 * s); g.fill(); }
    };
    const tires = (x, y, s) => { g.fillStyle = '#0d0704'; for (let r = 0; r < 4; r++) for (let k = 0; k <= 3 - r; k++) { g.beginPath(); g.ellipse(x + (k - (3 - r) / 2) * 16 * s, y - r * 9 * s, 8 * s, 5 * s, 0, 0, 7); g.fill(); } };
    fence(40 * W / 1280, 330 * W / 1280, HZ + 40, 0.7); fence(840 * W / 1280, 1240 * W / 1280, HZ + 38, 0.65);
    tires(380 * W / 1280, HZ + 44, 0.8); tires(760 * W / 1280, HZ + 48, 0.9);
    [[150, HZ + 50, 0.3], [520, HZ + 44, 0.25], [1060, HZ + 48, 0.28], [1190, HZ + 58, 0.32]].forEach(([x, y, s], i) => drawBonePile(g, x * W / 1280, y, s, 11 + i));
    [[260, HZ + 125, 0.75], [1000, HZ + 160, 0.9], [640, HZ + 95, 0.5]].forEach(([x, y, s], i) => drawBonePile(g, x * W / 1280, y, s, 31 + i));
    for (const [x, y, s] of [[66, HZ + 6, 0.32], [222, HZ + 6, 0.32], [880, HZ + 8, 0.3], [1140, HZ + 8, 0.3]]) drawHornedSkull(g, x * W / 1280, y, s);
    // warm sunset light over the bones
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(230,150,90,0.55)'; g.fillRect(0, HZ, W, H - HZ); g.globalCompositeOperation = 'source-over';
    scene.textures.addCanvas('menubg', cv);
    G.menuFires = fires;          // no fires in the menus any more
  }
}

// ---------------- primitives ----------------
function drawSpikes(g, x, y, w, n, h, dir = -1) {
  const step = w / n, b = step * 0.34;
  for (let i = 0; i < n; i++) {
    const cx = x + (i + 0.5) * step, ty = y + dir * h;
    g.fillStyle(0xbdb6a6, 1).fillTriangle(cx - b, y, cx, y, cx, ty);
    g.fillStyle(0x6a645a, 1).fillTriangle(cx, y, cx + b, y, cx, ty);
    g.lineStyle(1, 0x1a1410, 0.8).strokeTriangle(cx - b, y, cx + b, y, cx, ty);
    g.fillStyle(0x3a3028, 1).fillRect(cx - b - 1, y - (dir < 0 ? 0 : 2), b * 2 + 2, 2);
  }
}
function drawChain(g, x0, y0, x1, y1, sag = 0) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(len / 7));
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag;
  const P = u => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = P(i / n), [bx, by] = P((i + 1) / n), cx = (ax + bx) / 2, cy = (ay + by) / 2;
    const vert = Math.abs(by - ay) > Math.abs(bx - ax);
    if (i % 2 === 0) {
      const w = vert ? 6 : 10, h = vert ? 10 : 6;
      g.lineStyle(3.2, 0x1a1410, 1).strokeEllipse(cx + 1, cy + 1, w, h);
      g.lineStyle(2.4, 0x8a8478, 1).strokeEllipse(cx, cy, w, h);
      g.lineStyle(1, 0xd0c8b8, 0.7).strokeEllipse(cx - 0.5, cy - 0.5, w - 2, h - 2);
    } else {
      g.lineStyle(3.4, 0x1a1410, 1).lineBetween(ax + 1, ay + 1, bx + 1, by + 1);
      g.lineStyle(2.4, 0x6e685e, 1).lineBetween(ax, ay, bx, by);
    }
  }
}
// chain as a repeating texture on a TileSprite (a Graphics chain is thousands of draw commands per frame)
function chainTexture(scene) {
  if (scene.textures.exists('chainlink')) return;
  const cv = makeCanvas(14, 16), g = cv.getContext('2d');
  g.lineWidth = 3.4; g.strokeStyle = '#1a1410'; g.beginPath(); g.ellipse(7.5, 5.5, 3.6, 5.6, 0, 0, 7); g.stroke();
  g.lineWidth = 2.4; g.strokeStyle = '#8a8478'; g.beginPath(); g.ellipse(7, 5, 3.4, 5.4, 0, 0, 7); g.stroke();
  g.lineWidth = 1; g.strokeStyle = 'rgba(220,210,190,0.8)'; g.beginPath(); g.ellipse(6.4, 4.4, 2.4, 4.2, 0, Math.PI, Math.PI * 1.8); g.stroke();
  g.fillStyle = '#1a1410'; g.fillRect(5.6, 10, 3.4, 7); g.fillStyle = '#6e685e'; g.fillRect(5.6, 10, 2.4, 6.5);
  scene.textures.addCanvas('chainlink', cv);
}
function chainSprite(scene, x0, y0, x1, y1) {
  chainTexture(scene);
  const len = Math.hypot(x1 - x0, y1 - y0);
  return scene.add.tileSprite((x0 + x1) / 2, (y0 + y1) / 2, 14, len, 'chainlink').setRotation(-Math.atan2(x1 - x0, y1 - y0));
}
function rivet(g, x, y, r = 3) { g.fillStyle(0x1a120c, 0.8).fillCircle(x + 1, y + 1, r); g.fillStyle(0x9a8a72, 1).fillCircle(x, y, r); g.fillStyle(0xe0d4bc, 0.8).fillCircle(x - r * 0.35, y - r * 0.35, r * 0.35); }

// rusted metal plate with rivets (and optional spikes on top)
// canvas helpers for cached UI textures (Graphics objects are re-tessellated every frame -> slow menus on phones)
function cRivet(g, x, y, r = 3) {
  g.fillStyle = 'rgba(26,18,12,0.8)'; g.beginPath(); g.arc(x + 1, y + 1, r, 0, 7); g.fill();
  g.fillStyle = '#9a8a72'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = 'rgba(224,212,188,0.8)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, 7); g.fill();
}
function cSpikes(g, x, y, w, n, h, dir) {
  const step = w / n, b = step * 0.34;
  for (let i = 0; i < n; i++) {
    const cx = x + (i + 0.5) * step, ty = y + dir * h;
    g.fillStyle = '#bdb6a6'; g.beginPath(); g.moveTo(cx - b, y); g.lineTo(cx, y); g.lineTo(cx, ty); g.closePath(); g.fill();
    g.fillStyle = '#6a645a'; g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + b, y); g.lineTo(cx, ty); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(26,20,16,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - b, y); g.lineTo(cx, ty); g.lineTo(cx + b, y); g.stroke();
  }
}
function cRound(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// rusted metal plate (optional title bar, spikes) baked into one cached texture
function rustPlate(scene, x, y, w, h, o = {}) {
  w = Math.round(w); h = Math.round(h);
  const PT = 14, al = o.alpha === undefined ? 0.75 : o.alpha, dim = o.dim === undefined ? 0.45 : o.dim;
  const key = `plate_${w}_${h}_${o.spikes ? 1 : 0}${o.spikesBottom ? 1 : 0}${o.title ? 1 : 0}_${Math.round(al * 100)}_${Math.round(dim * 100)}`;
  if (!scene.textures.exists(key)) {
    const cv = makeCanvas(w + 8, h + PT * 2), g = cv.getContext('2d'), oy = PT;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(5, oy + 7, w, h);
    g.fillStyle = '#2a211a'; g.fillRect(0, oy, w, h);
    g.save(); g.globalAlpha = al; g.translate(3, oy + 3); g.fillStyle = g.createPattern(scene.textures.get('rustplate').getSourceImage(), 'repeat'); g.fillRect(0, 0, w - 6, h - 6); g.restore();
    g.fillStyle = `rgba(14,10,7,${dim})`; g.fillRect(3, oy + 3, w - 6, h - 6);
    g.strokeStyle = '#6a4a30'; g.lineWidth = 3; g.strokeRect(1.5, oy + 1.5, w - 3, h - 3);
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1; g.strokeRect(3.5, oy + 3.5, w - 7, h - 7);
    if (o.title) {
      g.fillStyle = 'rgba(20,13,8,0.88)'; g.fillRect(3, oy + 3, w - 6, 46);
      g.strokeStyle = '#6a4a30'; g.lineWidth = 2; g.beginPath(); g.moveTo(3, oy + 49); g.lineTo(w - 3, oy + 49); g.stroke();
      if (!o.noStripes) for (let k = 0; k < 6; k++) {
        const hx = w - 130 + k * 16;
        g.fillStyle = k % 2 ? 'rgba(26,20,16,0.9)' : 'rgba(201,154,28,0.9)';
        g.beginPath(); g.moveTo(hx, oy + 45); g.lineTo(hx + 16, oy + 45); g.lineTo(hx + 27, oy + 7); g.lineTo(hx + 11, oy + 7); g.closePath(); g.fill();
      }
      cRivet(g, 12, oy + 26); cRivet(g, w - 12, oy + 26);
    }
    for (const rx of [9, w - 9]) for (const ry of [oy + 9, oy + h - 9]) cRivet(g, rx, ry);
    if (w > 300) for (let k = 1; k < 4; k++) { cRivet(g, k * w / 4, oy + 9, 2.5); cRivet(g, k * w / 4, oy + h - 9, 2.5); }
    if (o.spikes) cSpikes(g, 14, oy, w - 28, Math.max(3, Math.round(w / 34)), 12, -1);
    if (o.spikesBottom) cSpikes(g, 14, oy + h, w - 28, Math.max(3, Math.round(w / 34)), 10, 1);
    scene.textures.addCanvas(key, cv);
  }
  const img = scene.add.image(x, y - PT, key).setOrigin(0, 0);
  if (o.depth !== undefined) img.setDepth(o.depth);
  return { img };
}

// ---------------- ambience: fire particles, embers, burning wrecks, buggies ----------------
function menuAmbience(scene, fires = [], embers = true) {
  makeFxTextures(scene);
  scene.mfx = new FX(scene, LITE ? 150 : 320); scene.mfires = fires.slice(); scene.mT = 0; scene.mEmbers = embers;
}
function menuTick(scene, delta) {
  if (!scene.mfx) return;
  const dt = Math.min(0.05, delta / 1000);
  scene.mT -= dt;
  if (scene.mT <= 0) {
    scene.mT = 0.05;
    for (const f of scene.mfires) {
      scene.mfx.spawn('soft', f.x + rnd(-5, 5) * f.s, f.y, { tint: pick([0xffd040, 0xff8a1a, 0xff5a10]), add: true, life: rnd(0.35, 0.65), s0: 0.45 * f.s, s1: 0.06, a0: 0.95, vx: rnd(-6, 10), vy: -rnd(45, 85) * f.s, depth: f.depth === undefined ? -5 : f.depth });
      if (Math.random() < 0.35) scene.mfx.spawn('smoke', f.x, f.y - 14 * f.s, { tint: 0x141010, life: 2.4, s0: 0.3 * f.s, s1: 1.6 * f.s, a0: 0.45, vx: rnd(12, 30), vy: -rnd(25, 45), vr: rnd(-0.5, 0.5), depth: (f.depth === undefined ? -5 : f.depth) - 0.1 });
    }
    if (scene.mEmbers) for (let k = 0; k < (LITE ? (Math.random() < 0.4 ? 1 : 0) : 1); k++) scene.mfx.spawn('soft', rnd(0, GW) + scene.cameras.main.scrollX, GH + 10, { tint: pick([0xff8a2a, 0xffb040]), add: true, life: rnd(3, 6), s0: rnd(0.05, 0.11), s1: 0.02, a0: 0.9, vx: rnd(-20, 30), vy: -rnd(60, 140), depth: 60 });
  }
  scene.mfx.update(dt);
  if (scene.convoy) scene.convoy(dt);
}
function menuBackdrop(scene) {
  makeMenuTextures(scene);
  const ox = -scene.cameras.main.scrollX;
  scene.add.image(-ox, 0, 'menubg').setOrigin(0).setDepth(-10);
  scene.add.image(GW / 2 - ox, GH / 2, 'vignette').setDisplaySize(GW, GH).setDepth(-9);
  menuAmbience(scene, (G.menuFires || []).map(f => ({ ...f, x: f.x - ox, depth: -6 })));
}
// buggies and war cars tearing across the screen, kicking up dust
const CONVOY = [[4, 0xffd23f, 'kudla'], [7, 0xff4fa3, 'zdena'], [5, 0xff8a3d, 'vyfuk'], [6, 0x8fd14f, 'srot'], [7, 0x3fa7ff, 'bara'], [3, 0x262626, 'baron']];
function startConvoy(scene, y, scale, depth) {
  const lineup = CONVOY;
  const cars = [];
  let timer = 0.5, idx = 0;
  scene.convoy = dt => {
    timer -= dt;
    if (timer <= 0) {
      timer = rnd(1.4, 3.2);
      const [shape, col, kit] = lineup[idx++ % lineup.length], yy = y + rnd(-14, 14);
      const im = addCarImage(scene, -80, yy, shape, col, scale, 0, false, kit).setDepth(depth + yy * 0.001);
      cars.push({ im, v: rnd(380, 560), ph: rnd(0, 6), y: yy });
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i]; c.im.x += c.v * dt; c.ph += dt * 18;
      c.im.y = c.y + Math.sin(c.ph) * 1.2;
      if (Math.random() < (LITE ? 0.2 : 0.45)) scene.mfx.spawn('smoke', c.im.x - 30 * scale, c.y - 4, { tint: 0xb08050, life: 0.9, s0: 0.35 * scale, s1: 1.3 * scale, a0: 0.4, vx: -rnd(20, 60), vy: -rnd(5, 25), depth: depth - 0.5 });
      if (Math.random() < 0.15) scene.mfx.spawn('smoke', c.im.x - 30 * scale, c.y - 12 * scale, { tint: 0x1a1410, life: 0.7, s0: 0.12 * scale, s1: 0.5 * scale, a0: 0.5, vx: -40, vy: -30, depth: depth + 0.5 });
      if (c.im.x > GW + 100) { c.im.destroy(); cars.splice(i, 1); }
    }
  };
}
