'use strict';
// ============================================================
//  HAVOC RALLY – wasteland menu art: rust plates, spikes, chains,
//  burning-wreck backdrop, fire & ember ambience, buggy convoy
// ============================================================

function makeMenuTextures(scene) {
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
    let gr = g.createRadialGradient(930, 430, 0, 930, 430, 300); gr.addColorStop(0, 'rgba(255,215,140,0.6)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    circ(g, 930, 430, 58, 'rgba(255,225,170,0.55)');
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
    fence(40, 330, HZ + 40, 0.7); fence(840, 1240, HZ + 38, 0.65);
    tires(380, HZ + 44, 0.8); tires(760, HZ + 48, 0.9);
    [[150, HZ + 52, 0.55], [520, HZ + 46, 0.45], [700, HZ + 40, 0.4], [1060, HZ + 50, 0.5], [1190, HZ + 60, 0.6]].forEach(([x, y, s], i) => wreck(x, y, s, i % 2, true));
    [[260, HZ + 120, 1.1], [1000, HZ + 150, 1.3]].forEach(([x, y, s], i) => wreck(x, y, s, i % 2, true));
    wreck(640, HZ + 95, 0.8, true, false);
    scene.textures.addCanvas('menubg', cv);
    G.menuFires = fires;
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
function rivet(g, x, y, r = 3) { g.fillStyle(0x1a120c, 0.8).fillCircle(x + 1, y + 1, r); g.fillStyle(0x9a8a72, 1).fillCircle(x, y, r); g.fillStyle(0xe0d4bc, 0.8).fillCircle(x - r * 0.35, y - r * 0.35, r * 0.35); }

// rusted metal plate with rivets (and optional spikes on top)
function rustPlate(scene, x, y, w, h, o = {}) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRect(x + 5, y + 7, w, h);
  g.fillStyle(0x2a211a, 1).fillRect(x, y, w, h);
  const ts = scene.add.tileSprite(x + 3, y + 3, w - 6, h - 6, 'rustplate').setOrigin(0).setAlpha(o.alpha === undefined ? 0.75 : o.alpha);
  const g2 = scene.add.graphics();
  g2.fillStyle(0x0e0a07, o.dim === undefined ? 0.45 : o.dim).fillRect(x + 3, y + 3, w - 6, h - 6);
  g2.lineStyle(3, 0x6a4a30, 1).strokeRect(x, y, w, h);
  g2.lineStyle(1, 0x000000, 0.7).strokeRect(x + 3, y + 3, w - 6, h - 6);
  for (const rx of [x + 9, x + w - 9]) for (const ry of [y + 9, y + h - 9]) rivet(g2, rx, ry);
  if (w > 300) for (let k = 1; k < 4; k++) { rivet(g2, x + k * w / 4, y + 9, 2.5); rivet(g2, x + k * w / 4, y + h - 9, 2.5); }
  if (o.spikes) drawSpikes(g2, x + 14, y, w - 28, Math.max(3, Math.round(w / 34)), 12, -1);
  if (o.spikesBottom) drawSpikes(g2, x + 14, y + h, w - 28, Math.max(3, Math.round(w / 34)), 10, 1);
  if (o.depth !== undefined) { g.setDepth(o.depth); ts.setDepth(o.depth); g2.setDepth(o.depth); }
  return { g, ts, g2 };
}

// ---------------- ambience: fire particles, embers, burning wrecks, buggies ----------------
function menuAmbience(scene, fires = [], embers = true) {
  makeFxTextures(scene);
  scene.mfx = new FX(scene, 500); scene.mfires = fires.slice(); scene.mT = 0; scene.mEmbers = embers;
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
    if (scene.mEmbers) for (let k = 0; k < 2; k++) scene.mfx.spawn('soft', rnd(0, GW), GH + 10, { tint: pick([0xff8a2a, 0xffb040]), add: true, life: rnd(3, 6), s0: rnd(0.05, 0.11), s1: 0.02, a0: 0.9, vx: rnd(-20, 30), vy: -rnd(60, 140), depth: 60 });
  }
  scene.mfx.update(dt);
  if (scene.convoy) scene.convoy(dt);
}
function menuBackdrop(scene) {
  makeMenuTextures(scene);
  scene.add.image(0, 0, 'menubg').setOrigin(0).setDepth(-10);
  scene.add.image(GW / 2, GH / 2, 'vignette').setDisplaySize(GW, GH).setDepth(-9);
  menuAmbience(scene, (G.menuFires || []).map(f => ({ ...f, depth: -6 })));
}
// charred car sprite with fires on it
function burningWreck(scene, x, y, shape, scale, heading, depth = 0) {
  const im = addCarImage(scene, x, y, shape, 0x4a3a2c, scale, heading).setTint(0x8a7462).setDepth(depth);
  scene.add.image(x + 6 * scale, y + 2 * scale, 'soft').setTint(0x000000).setAlpha(0.5).setScale(1.6 * scale, 0.6 * scale).setDepth(depth - 0.1);
  const glow = scene.add.image(x, y - 10 * scale, 'soft').setTint(0xff7a20).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(3 * scale, 2 * scale).setDepth(depth - 0.05);
  scene.tweens.add({ targets: glow, alpha: 0.25, yoyo: true, repeat: -1, duration: 180, ease: 'Sine.InOut' });
  if (scene.mfires) scene.mfires.push({ x: x + 4 * scale, y: y - 14 * scale, s: scale * 0.9, depth: depth + 0.2 }, { x: x - 10 * scale, y: y - 10 * scale, s: scale * 0.6, depth: depth + 0.2 });
  return im;
}
// buggies and war cars tearing across the screen, kicking up dust
function startConvoy(scene, y, scale, depth) {
  const lineup = [[4, 0x9b59ff], [1, 0xff8a3d], [4, 0x2de0c0], [3, 0xffd23f], [2, 0xd8262e]];
  const cars = [];
  let timer = 0.5, idx = 0;
  scene.convoy = dt => {
    timer -= dt;
    if (timer <= 0) {
      timer = rnd(1.4, 3.2);
      const [shape, col] = lineup[idx++ % lineup.length], yy = y + rnd(-14, 14);
      const im = addCarImage(scene, -80, yy, shape, col, scale, 0).setDepth(depth + yy * 0.001);
      cars.push({ im, v: rnd(380, 560), ph: rnd(0, 6), y: yy });
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i]; c.im.x += c.v * dt; c.ph += dt * 18;
      c.im.y = c.y + Math.sin(c.ph) * 1.2;
      if (Math.random() < 0.7) scene.mfx.spawn('smoke', c.im.x - 30 * scale, c.y - 4, { tint: 0xb08050, life: 0.9, s0: 0.35 * scale, s1: 1.3 * scale, a0: 0.4, vx: -rnd(20, 60), vy: -rnd(5, 25), depth: depth - 0.5 });
      if (Math.random() < 0.15) scene.mfx.spawn('smoke', c.im.x - 30 * scale, c.y - 12 * scale, { tint: 0x1a1410, life: 0.7, s0: 0.12 * scale, s1: 0.5 * scale, a0: 0.5, vx: -40, vy: -30, depth: depth + 0.5 });
      if (c.im.x > GW + 100) { c.im.destroy(); cars.splice(i, 1); }
    }
  };
}
