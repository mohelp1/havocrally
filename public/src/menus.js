'use strict';
// ============================================================
//  HAVOC RALLY – menus: boot, title, garage, results, victory
// ============================================================

function mixInt(col, f) {
  const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
  const m = c => Math.round(clamp(f >= 0 ? c + (255 - c) * f : c * (1 + f), 0, 255));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}
// menu cameras: logical 1280/GW x 720 layout, rendered at RS
const uiCam = (scene, scrollX = 0) => scene.cameras.main.setOrigin(0, 0).setZoom(RS).setScroll(scrollX, 0);
const hexStr = col => '#' + col.toString(16).padStart(6, '0');

// button background baked into a cached canvas texture per size/colour/state (cheap to render)
function btnTexture(scene, w, h, color, state) {
  const key = `btn_${w}_${h}_${color.toString(16)}_${state}`;
  if (scene.textures.exists(key)) return key;
  const P = 6, cv = makeCanvas(w + P * 2, h + P * 2 + 4), g = cv.getContext('2d');
  const on = state !== 'x', cc = on ? color : 0x4a4a4a, dy = state === 'd' ? 2 : 0;
  cRound(g, P + 2, P + 5, w, h, 12); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill();
  cRound(g, P, P + dy, w, h, 12); g.fillStyle = hexStr(mixInt(cc, state === 'h' ? 0.18 : 0)); g.fill();
  cRound(g, P + 4, P + 3 + dy, w - 8, h * 0.4, 9); g.fillStyle = `rgba(255,255,255,${on ? 0.18 : 0.06})`; g.fill();
  cRound(g, P, P + dy, w, h, 12); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2; g.stroke();
  if (w >= 120) { cRivet(g, P + 9, P + h / 2 + dy, 2.5); cRivet(g, P + w - 9, P + h / 2 + dy, 2.5); }
  scene.textures.addCanvas(key, cv);
  return key;
}
function makeButton(scene, x, y, w, h, label, cb, o = {}) {
  w = Math.round(w); h = Math.round(h);
  const c = scene.add.container(x, y);
  const col = o.color === undefined ? 0xd8262e : o.color;
  const bgImg = scene.add.image(0, 0, btnTexture(scene, w, h, col, 'n')).setOrigin(0.5, (6 + h / 2) / (h + 16));
  const txt = scene.add.text(0, 1, label, { fontFamily: FONT, fontSize: (o.size || Math.round(Math.min(28, h * 0.42))) + 'px', color: '#ffffff', stroke: '#000', strokeThickness: 3, resolution: 2, align: 'center' }).setOrigin(0.5);
  c.add([bgImg, txt]);
  let enabled = !o.disabled, hover = false, down = false;
  const draw = () => {
    bgImg.setTexture(btnTexture(scene, w, h, col, !enabled ? 'x' : down ? 'd' : hover ? 'h' : 'n'));
    txt.setAlpha(enabled ? 1 : 0.55); txt.y = 1 + (down ? 2 : 0);
  };
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => { hover = true; draw(); });
  c.on('pointerout', () => { hover = false; down = false; draw(); });
  c.on('pointerdown', () => { Sound.init(); if (!enabled) { Sound.play('deny'); if (o.onDisabled) o.onDisabled(); return; } down = true; draw(); });
  c.on('pointerup', () => { if (!down) return; down = false; draw(); Sound.play('click'); cb(); });
  c.setEnabled = v => { enabled = v; draw(); return c; };
  c.setLabel = s => { txt.setText(s); return c; };
  draw();
  return c;
}
// race card background (also a cached texture)
function raceCardTexture(scene, w, h, color, boss) {
  const key = `card_${w}_${h}_${color.toString(16)}_${boss ? 1 : 0}`;
  if (scene.textures.exists(key)) return key;
  const cv = makeCanvas(w + 6, h + 20), g = cv.getContext('2d'), oy = 12;
  cSpikes(g, 24, oy, w - 48, Math.round(w / 40), 10, -1);
  cRound(g, 3, oy + 5, w, h, 14); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
  cRound(g, 0, oy, w, h, 14); g.fillStyle = boss ? 'rgba(42,12,12,0.96)' : 'rgba(27,24,22,0.95)'; g.fill();
  g.save(); cRound(g, 0, oy, w, h, 14); g.clip(); g.fillStyle = hexStr(color); g.fillRect(0, oy, w, 44); g.restore();
  cRound(g, 1.5, oy + 1.5, w - 3, h - 3, 13); g.strokeStyle = hexStr(color); g.lineWidth = 3; g.stroke();
  scene.textures.addCanvas(key, cv);
  return key;
}
function makeSoundButton(scene, x, y) {
  const lab = () => (Sound.muted ? 'SOUND: OFF' : 'SOUND: ON');
  const b = makeButton(scene, x, y, 220, 46, lab(), () => { Sound.toggle(); b.setLabel(lab()); }, { color: 0x4a3f36, size: 18 });
  return b;
}
function panel(scene, x, y, w, h, title, o = {}) {
  const parts = rustPlate(scene, x, y, w, h, { ...o, title: !!title });
  if (title) parts.title = scene.add.text(x + 26, y + 26, title, { fontFamily: FONT, fontSize: '26px', color: '#ffb52a', stroke: '#000', strokeThickness: 4, resolution: 2 }).setOrigin(0, 0.5);
  return parts;
}
function bg(scene) { menuBackdrop(scene); }
function toast(scene, text, color = '#ff5a4a') {
  const tt = scene.add.text(UW / 2, GH / 2, text, { fontFamily: FONT, fontSize: '40px', color, stroke: '#000', strokeThickness: 6, resolution: 2 }).setOrigin(0.5).setDepth(500);
  scene.tweens.add({ targets: tt, y: GH / 2 - 60, alpha: 0, duration: 1100, delay: 300, onComplete: () => tt.destroy() });
}
function statBar(scene, x, y, w, label, f) {
  scene.add.text(x, y, label, { fontFamily: FONT_B, fontSize: '20px', fontStyle: 'bold', color: '#d0c8c0', resolution: 2 }).setOrigin(0, 0.5);
  const g = scene.add.graphics(), bx = x + 150, bw = w - 150;
  g.fillStyle(0x000000, 0.6).fillRect(bx, y - 8, bw, 16);
  g.fillStyle(0xffb52a, 1).fillRect(bx + 2, y - 6, Math.max(3, (bw - 4) * clamp(f, 0, 1)), 12);
  return g;
}
const STAT_MAX = (() => { const s = carStats(3, { engine: 3, tires: 3, plating: 3 }, 0); return { speed: s.speed, accel: s.accel, handling: s.turn * s.grip, hp: s.hp }; })();
const statFracs = s => ({ speed: s.speed / STAT_MAX.speed, accel: s.accel / STAT_MAX.accel, handling: (s.turn * s.grip) / STAT_MAX.handling, hp: s.hp / STAT_MAX.hp });

// ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    makeFxTextures(this);
    makeMenuTextures(this);
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    G.career = Save.load();
    if (G.career) G.career.offers = makeOffers(G.career);     // older saves used a different tier layout
    Poki.loadingFinished();
    this.scene.start('title');
  }
}

// ============================================================
class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    this.scene.launch('race', { demo: true, track: pick(RACE_TRACKS) });
    this.scene.bringToTop();
    uiCam(this);
    const g = this.add.graphics();
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.82, 0.15, 0.82, 0.15).fillRect(0, 0, GW, GH);
    g.fillStyle(0x000000, 0.35).fillRect(0, GH - 58, GW, 58);
    if (!LITE) {
      this.add.image(GW / 2, GH / 2, 'vignette').setDisplaySize(GW, GH).setDepth(-1);
      this.add.rectangle(GW / 2, GH / 2, GW, GH, 0xd89a58, 0.07).setDepth(-1);
    }
    menuAmbience(this, [], true);
    const cg = this.add.graphics();
    chainSprite(this, 95, -10, 120, 52); chainSprite(this, 505, -10, 480, 52);
    rustPlate(this, 50, 48, 500, 285, { spikes: true, spikesBottom: true, alpha: 0.85, dim: 0.25 });   // cached texture
    const hook = this.add.graphics(); rivet(hook, 120, 58, 5); rivet(hook, 480, 58, 5);
    this.add.image(GW - 170, 618, 'bonepile').setScale(1.05).setDepth(5);
    this.add.image(GW - 55, 470, 'skullpike').setScale(0.95).setDepth(4).setAngle(4);
    this.add.image(GW - 65, 300, 'bonepile').setScale(0.5).setDepth(4).setFlipX(true);
    startConvoy(this, 642, 1.9, -0.5);
    const logo1 = this.add.text(80, 120, 'HAVOC', { fontFamily: FONT, fontSize: '124px', color: '#ffb52a', stroke: '#2a0a00', strokeThickness: 12, resolution: 2 }).setOrigin(0, 0.5).setShadow(6, 8, '#000', 6, true, true);
    const logo2 = this.add.text(92, 225, 'RALLY', { fontFamily: FONT, fontSize: '92px', color: '#ffffff', stroke: '#8a1010', strokeThickness: 10, resolution: 2 }).setOrigin(0, 0.5).setShadow(6, 8, '#000', 6, true, true);
    this.add.text(96, 296, t('subtitle').toUpperCase(), { fontFamily: FONT, fontSize: '22px', color: '#ff6a4a', resolution: 2 }).setOrigin(0, 0.5);
    this.tweens.add({ targets: logo1, scale: 1.03, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
    logo2.setAngle(-2);
    const has = !!G.career;
    const go = () => { Sound.init(); this.scene.stop('race'); this.scene.start('garage'); };
    makeButton(this, 260, 410, 360, 80, has ? t('cont') : t('play'), () => { if (!G.career) G.career = newCareer(); go(); }, { color: 0x5f8a2a, size: 34 });
    if (has) {
      let armed = false;
      const nb = makeButton(this, 260, 505, 360, 56, t('newCareer'), () => {
        if (!armed) { armed = true; nb.setLabel(t('sure')); this.time.delayedCall(2500, () => { armed = false; if (nb.active) nb.setLabel(t('newCareer')); }); return; }
        Save.clear(); G.career = newCareer(); go();
      }, { color: 0x8a2a2a, size: 22 });
    }
    makeSoundButton(this, 260, has ? 580 : 500);
    if (G.career && G.career.champion) this.add.text(80, 345, '★ CHAMPION ★', { fontFamily: FONT, fontSize: '22px', color: '#ffe14a', resolution: 2 });
    this.add.text(GW / 2, GH - 29, t('controls'), { fontFamily: FONT_B, fontSize: '16px', fontStyle: 'bold', color: '#e0e0e0', resolution: 2 }).setOrigin(0.5);
    this.input.keyboard.once('keydown-ENTER', () => { if (!G.career) G.career = newCareer(); go(); });
  }
  update(time, delta) { menuTick(this, delta); }
}

// ============================================================
class GarageScene extends Phaser.Scene {
  constructor() { super('garage'); }
  create() {
    uiCam(this, -MX);
    this.starting = false;              // scene instances are reused between visits
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.build();
    if (!G.career.tipSeen) this.showTip();
  }
  rebuild() { this.children.removeAll(true); this.build(); }
  update(time, delta) { menuTick(this, delta); }

  build() {
    const c = G.career;
    bg(this);
    // header
    rustPlate(this, -MX - 4, -4, GW + 8, 84, { spikesBottom: true, dim: 0.35 });
    this.add.text(20, 40, t('garage'), { fontFamily: FONT, fontSize: '31px', color: '#ffb52a', stroke: '#000', strokeThickness: 4, resolution: 2 }).setOrigin(0, 0.5);
    this.add.text(330, 40, money(c.money), { fontFamily: FONT, fontSize: '34px', color: '#7dff6a', stroke: '#000', strokeThickness: 4, resolution: 2 }).setOrigin(0, 0.5);
    this.add.text(520, 26, `${t('points')}: ${c.points} / ${BOSS_POINTS}`, { fontFamily: FONT, fontSize: '25px', color: '#ffffff', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5);
    const next = TIER_UNLOCK.findIndex((p, ti) => ti > 0 && c.points < p);
    const hint = next > 0 ? t('tierLocked', STR.diff[next], TIER_UNLOCK[next]) : (!c.champion && c.points < BOSS_POINTS ? t('bossLocked', BOSS_POINTS) : '');
    if (hint) this.add.text(520, 60, hint, { fontFamily: FONT_B, fontSize: '18px', fontStyle: 'bold', color: '#ffd36a', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5);
    makeButton(this, 905, 40, 200, 58, t('standingsBtn'), () => this.showStandings(), { color: 0x7a5228, size: 22 });
    makeButton(this, 1072, 40, 120, 58, 'MENU', () => this.scene.start('title'), { color: 0x4a3f36, size: 22 });
    const sb = makeButton(this, 1204, 40, 128, 58, Sound.muted ? '🔇 OFF' : '🔊 ON', () => { Sound.toggle(); sb.setLabel(Sound.muted ? '🔇 OFF' : '🔊 ON'); }, { color: 0x4a3f36, size: 20 });
    this.buildCar(c); this.buildShop(c); this.buildRaces(c);
    chainSprite(this, 450, 84, 450, 528);
  }

  buildCar(c) {
    const x = 14, y = 98, w = 428, h = 420;
    panel(this, x, y, w, h, CARS[c.car].name.toUpperCase());
    const st = carStats(c.car, c.up, c.mg);
    this.add.image(x + w / 2 + 10, y + 150, 'soft').setTint(0x000000).setAlpha(0.5).setScale(3, 1.1).setDepth(0.5);
    addCarImage(this, x + w / 2, y + 144, st.shape, PLAYER_COLOR, 1.45, 0.5).setDepth(1);   // static showcase angle
    const fr = statFracs(st);
    [['speed', fr.speed], ['accel', fr.accel], ['handling', fr.handling], ['armor', fr.hp]].forEach(([k, v], j) => statBar(this, x + 22, y + 198 + j * 30, w - 44, t(k), v));
    // condition + repair (blinks below 60 %)
    const mh = st.hp, f = clamp(c.hp / mh, 0, 1);
    const ct = this.add.text(x + 22, y + 328, `${t('condition')}: ${Math.round(f * 100)}%`, { fontFamily: FONT, fontSize: '24px', color: f > 0.6 ? '#7dff6a' : f > 0.3 ? '#ffb020' : '#ff4a3a', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.6).fillRect(x + 22, y + 348, w - 44, 16);
    g.fillStyle(f > 0.6 ? 0x4ad04a : f > 0.3 ? 0xffb020 : 0xff3a2a, 1).fillRect(x + 24, y + 350, Math.max(3, (w - 48) * f), 12);
    const cost = Math.ceil((mh - c.hp) * REPAIR_PER_HP);
    const damaged = c.hp < mh - 0.5;
    const rb = makeButton(this, x + 110, y + 392, 196, 54, damaged ? t('repair', money(cost)) : t('repaired'), () => {
      if (c.money < cost) { toast(this, t('noMoney')); Sound.play('deny'); return; }
      c.money -= cost; c.hp = mh; Sound.play('buy'); Save.store(c); this.rebuild();
    }, { color: 0x3f6a7a, size: 20, disabled: !damaged });
    const fb = makeButton(this, x + 318, y + 392, 196, 54, t('repairAd'), async () => {
      const ok = await Poki.rewardedBreak();
      if (ok) { c.hp = mh; Sound.play('buy'); Save.store(c); this.rebuild(); }
    }, { color: 0x7a3f8a, size: 20, disabled: !(damaged && c.hp < mh * 0.8) });
    if (damaged && f < 0.6) {
      const glow = this.add.rectangle(x + 110, y + 394, 214, 70, 0xff3a2a, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(-0.5);
      this.tweens.add({ targets: glow, alpha: 0, yoyo: true, repeat: -1, duration: 420 });
      this.tweens.add({ targets: [rb, fb], scale: 1.07, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.InOut' });
      this.tweens.add({ targets: ct, alpha: 0.35, yoyo: true, repeat: -1, duration: 420 });
    }
  }

  buildShop(c) {
    const x = 458, y = 98, w = 808, h = 420;
    panel(this, x, y, w, h, t('upgrades'), { noStripes: true });
    makeButton(this, x + w - 160, y + 26, 290, 40, '🚗  ' + t('dealer'), () => this.showDealer(), { color: 0xc0601a, size: 20 });
    const rows = [];
    UPGRADES.forEach(k => {
      const lvl = c.up[k];
      rows.push({ name: t(k), desc: STR.upDesc[k], lvl, max: UP_MAX, cost: lvl < UP_MAX ? upCost(c.car, k, lvl) : 0, buy: () => { c.up[k]++; if (k === 'plating') c.hp += carStats(c.car, c.up, c.mg).hp - carStats(c.car, { ...c.up, plating: c.up.plating - 1 }, c.mg).hp; } });
    });
    rows.push({ name: t('mg'), desc: STR.upDesc.mg, lvl: c.mg, max: UP_MAX, cost: c.mg < UP_MAX ? MG_COST[c.mg] : 0, buy: () => { c.mg++; } });
    rows.push({ name: t('flame'), desc: STR.upDesc.flame, count: c.flame ? t('ownedW') : '', full: !!c.flame, cost: FLAME_COST, buy: () => { c.flame = true; } });
    if (!c.bazooka) rows.push({ name: t('bazooka'), desc: STR.upDesc.bazooka, count: '', full: false, cost: BAZOOKA_COST, buy: () => { c.bazooka = true; c.rockets = Math.max(c.rockets || 0, 2); } });
    else rows.push({ name: t('rockets'), desc: STR.upDesc.rockets, count: `${c.rockets || 0} / ${ROCKET_MAX}`, full: (c.rockets || 0) >= ROCKET_MAX, cost: ROCKET_PACK, buy: () => { c.rockets = Math.min(ROCKET_MAX, (c.rockets || 0) + 2); } });
    rows.push({ name: t('mines'), desc: STR.upDesc.mines, count: `${c.mines} / ${MINE_MAX}`, full: c.mines >= MINE_MAX, cost: MINE_PACK, buy: () => { c.mines = Math.min(MINE_MAX, c.mines + 3); } });
    rows.push({ name: t('nitro'), desc: STR.upDesc.nitro, count: `${c.nitro} / ${NITRO_MAX}`, full: c.nitro >= NITRO_MAX, cost: NITRO_COST, buy: () => { c.nitro = Math.min(NITRO_MAX, c.nitro + 1); } });
    const colW = (w - 30) / 2, g = this.add.graphics();
    rows.forEach((r, i) => {
      const cx = x + 10 + (i % 2) * (colW + 10), cy = y + 100 + Math.floor(i / 2) * 84;
      g.fillStyle(0xffffff, (Math.floor(i / 2) + i) % 2 ? 0.03 : 0.07).fillRect(cx, cy - 38, colW, 76);
      this.add.text(cx + 14, cy - 22, r.name, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(cx + 14, cy + 2, r.desc, { fontFamily: FONT_B, fontSize: '15px', fontStyle: 'bold', color: '#a8a098', resolution: 2 }).setOrigin(0, 0.5);
      if (r.max) {
        for (let k = 0; k < r.max; k++) g.fillStyle(k < r.lvl ? 0xffb52a : 0x4a443e, 1).fillRect(cx + 14 + k * 15, cy + 17, 12, 12);
        this.add.text(cx + 172, cy + 23, `${r.lvl}/${r.max}`, { fontFamily: FONT, fontSize: '16px', color: '#ffb52a', resolution: 2 }).setOrigin(0, 0.5);
      } else if (r.count) this.add.text(cx + 14, cy + 24, r.count, { fontFamily: FONT, fontSize: '20px', color: '#ffb52a', resolution: 2 }).setOrigin(0, 0.5);
      const maxed = r.max ? r.lvl >= r.max : r.full;
      makeButton(this, cx + colW - 84, cy, 152, 58, maxed ? (r.max ? t('max') : t('ownedW')) : money(r.cost), () => {
        if (c.money < r.cost) { toast(this, t('noMoney')); Sound.play('deny'); return; }
        c.money -= r.cost; r.buy(); Sound.play('buy'); Save.store(c); this.rebuild();
      }, { color: c.money >= r.cost ? 0x5f8a2a : 0x6b3030, size: 22, disabled: maxed });
    });
  }

  buildRaces(c) {
    const offers = c.offers, n = offers.length, gap = 12, x0 = 14, y = 538, h = 172;
    const w = Math.floor((UW - 28 - gap * (n - 1)) / n);
    const diffCol = [0x2e9e4a, 0xd89a1a, 0xc8322a, 0x9a3aa8, 0x2a6ab8, 0x3a3a3a, 0x7a1010];
    offers.forEach((o, i) => {
      const x = x0 + i * (w + gap), boss = o.diff === FINAL;
      this.add.image(x, y - 12, raceCardTexture(this, w, h, diffCol[o.diff], boss)).setOrigin(0, 0);
      this.add.text(x + 16, y + 22, boss ? t('bossCard').toUpperCase() : STR.diff[o.diff], { fontFamily: FONT, fontSize: '25px', color: '#ffffff', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + w - 16, y + 22, lapsText(o.laps), { fontFamily: FONT, fontSize: '21px', color: '#ffffff', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(1, 0.5);
      this.add.text(x + 16, y + 66, TRACKS[o.track].name, { fontFamily: FONT, fontSize: n > 3 ? '22px' : '27px', color: '#ffb52a', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + 16, y + 100, money(PRIZES[o.diff][0]) + (POINTS[o.diff][0] ? `  ·  +${POINTS[o.diff][0]} pts` : ''), { fontFamily: FONT, fontSize: '21px', color: '#7dff6a', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5);
      const names = o.opp.map(id => driverDef(id).name).join(', ');
      this.add.text(x + 16, y + 140, names, { fontFamily: FONT_B, fontSize: '16px', fontStyle: 'bold', color: '#c0b8b0', resolution: 2, wordWrap: { width: w - 220 } }).setOrigin(0, 0.5);
      makeButton(this, x + w - 104, y + h - 40, 180, 64, t('race'), () => this.startRace(o), { color: diffCol[o.diff], size: 28 });
    });
  }

  showStandings() {
    const c = G.career;
    const layer = this.add.container(0, 0).setDepth(800);
    layer.add(this.add.rectangle(UW / 2, GH / 2, GW, GH, 0x000000, 0.8).setInteractive());
    layer.add(rustPlate(this, UW / 2 - 440, 28, 880, 664, { title: true, spikes: true, dim: 0.5 }).img);
    layer.add(this.add.text(UW / 2 - 410, 53, t('ranking'), { fontFamily: FONT, fontSize: '30px', color: '#ffb52a', stroke: '#000', strokeThickness: 4, resolution: 2 }).setOrigin(0, 0.5));
    const g = this.add.graphics(); layer.add(g);
    standings(c).forEach((r, i) => {
      const ry = 112 + i * 44, x = UW / 2 - 420, w = 840;
      g.fillStyle(r.player ? 0xffb52a : r.boss ? 0x8a1010 : 0xffffff, r.player ? 0.25 : r.boss ? 0.35 : i % 2 ? 0.03 : 0.07).fillRect(x, ry - 20, w, 40);
      g.fillStyle(r.color, 1).fillRect(x + 70, ry - 11, 20, 22);
      layer.add(this.add.text(x + 16, ry, `${i + 1}.`, { fontFamily: FONT, fontSize: '24px', color: '#b0a898', resolution: 2 }).setOrigin(0, 0.5));
      layer.add(this.add.text(x + 106, ry, r.name + (r.boss ? '  ☠' : ''), { fontFamily: FONT, fontSize: '25px', color: r.player ? '#ffe14a' : r.boss ? '#ff6a5a' : '#ffffff', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5));
      layer.add(this.add.text(x + w - 20, ry, String(r.points), { fontFamily: FONT, fontSize: '25px', color: '#ffffff', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(1, 0.5));
    });
    if (!c.champion) layer.add(this.add.text(UW / 2, 610, t('bossLocked', BOSS_POINTS), { fontFamily: FONT_B, fontSize: '20px', fontStyle: 'bold', color: '#ff8a6a', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0.5));
    layer.add(makeButton(this, UW / 2, 652, 260, 64, t('back'), () => layer.destroy(), { color: 0x4a3f36, size: 26 }));
  }

  async startRace(offer) {
    if (this.starting) return;
    this.starting = true;
    const c = G.career;
    const ov = this.add.rectangle(UW / 2, GH / 2, GW, GH, 0x000000, 0.75).setDepth(900).setInteractive();
    this.add.text(UW / 2, GH / 2, t('loading'), { fontFamily: FONT, fontSize: '40px', color: '#ffb52a', resolution: 2 }).setOrigin(0.5).setDepth(901);
    if (Poki.firstRaceDone) await Poki.commercialBreak();
    Poki.firstRaceDone = true;
    Save.store(c);
    // let the overlay render before the (synchronous) track generation
    this.time.delayedCall(40, () => this.scene.start('race', { offer }));
    void ov;
  }

  showTip() {
    const c = G.career;
    const layer = this.add.container(0, 0).setDepth(800);
    layer.add(this.add.rectangle(UW / 2, GH / 2, GW, GH, 0x000000, 0.7).setInteractive());
    layer.add(rustPlate(this, UW / 2 - 400, GH / 2 - 250, 800, 500, { spikes: true, spikesBottom: true, dim: 0.5 }).img);
    layer.add(this.add.text(UW / 2, GH / 2 - 200, 'WELCOME TO HAVOC RALLY', { fontFamily: FONT, fontSize: '34px', color: '#ffb52a', stroke: '#000', strokeThickness: 4, resolution: 2 }).setOrigin(0.5));
    layer.add(this.add.text(UW / 2, GH / 2 - 80, t('tip'), { fontFamily: FONT_B, fontSize: '26px', fontStyle: 'bold', color: '#ffffff', align: 'center', resolution: 2, wordWrap: { width: 720 } }).setOrigin(0.5));
    layer.add(this.add.text(UW / 2, GH / 2 + 50, t('controls').replace(/ {3}· {3}/g, '  ·  '), { fontFamily: FONT_B, fontSize: '19px', fontStyle: 'bold', color: '#ffb52a', align: 'center', resolution: 2, wordWrap: { width: 720 } }).setOrigin(0.5));
    layer.add(this.add.text(UW / 2, GH / 2 + 110, t('controlsTouch'), { fontFamily: FONT_B, fontSize: '20px', fontStyle: 'bold', color: '#c0b8b0', align: 'center', resolution: 2 }).setOrigin(0.5));
    layer.add(makeButton(this, UW / 2, GH / 2 + 180, 260, 68, 'OK', () => { c.tipSeen = true; Save.store(c); layer.destroy(); }, { color: 0x5f8a2a, size: 30 }));
  }

  showDealer() {
    const c = G.career;
    const layer = this.add.container(0, 0).setDepth(800);
    layer.add(this.add.rectangle(UW / 2, GH / 2, GW, GH, 0x000000, 0.8).setInteractive());
    layer.add(this.add.text(UW / 2, 52, t('dealer'), { fontFamily: FONT, fontSize: '44px', color: '#ffb52a', stroke: '#000', strokeThickness: 5, resolution: 2 }).setOrigin(0.5));
    const trade = Math.round(CARS[c.car].price * 0.5);
    layer.add(this.add.text(UW / 2, 100, t('tradeIn', money(trade)) + '   ·   ' + money(c.money), { fontFamily: FONT_B, fontSize: '24px', fontStyle: 'bold', color: '#7dff6a', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0.5));
    const w = 290, gap = 16, x0 = (UW - (w * 4 + gap * 3)) / 2;
    CARS.forEach((car, i) => {
      const x = x0 + i * (w + gap), y = 140, h = 470;
      layer.add(rustPlate(this, x, y, w, h, { spikes: true, dim: 0.5 }).img);
      const g = this.add.graphics();
      if (i === c.car) g.lineStyle(3, 0xffb52a, 1).strokeRect(x, y, w, h);
      layer.add(g);
      layer.add(this.add.text(x + w / 2, y + 32, car.name.toUpperCase(), { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#000', strokeThickness: 4, resolution: 2 }).setOrigin(0.5));
      layer.add(addCarImage(this, x + w / 2, y + 140, car.shape, PLAYER_COLOR, 1.45, 0.5));
      const st = carStats(i, { engine: 0, tires: 0, plating: 0 }, 0), fr = statFracs(st);
      [['speed', fr.speed], ['accel', fr.accel], ['handling', fr.handling], ['armor', fr.hp]].forEach(([k, v], j) => {
        const by = y + 190 + j * 30;
        layer.add(this.add.text(x + 14, by, t(k), { fontFamily: FONT_B, fontSize: '18px', fontStyle: 'bold', color: '#d0c8c0', resolution: 2 }).setOrigin(0, 0.5));
        const bg2 = this.add.graphics();
        bg2.fillStyle(0x000000, 0.6).fillRect(x + 140, by - 7, w - 156, 14);
        bg2.fillStyle(0xffb52a, 1).fillRect(x + 142, by - 5, (w - 160) * clamp(v, 0, 1), 10);
        layer.add(bg2);
      });
      layer.add(this.add.text(x + w / 2, y + 336, STR.carDesc[i], { fontFamily: FONT_B, fontSize: '19px', fontStyle: 'bold', color: '#c0b8b0', align: 'center', resolution: 2, wordWrap: { width: w - 26 } }).setOrigin(0.5));
      const own = i === c.car, net = car.price - trade;
      const btn = makeButton(this, x + w / 2, y + h - 50, w - 40, 66, own ? t('owned') : t('buyFor', money(Math.max(0, net))), () => {
        if (c.money < net) { toast(this, t('noMoney')); Sound.play('deny'); return; }
        c.money -= Math.max(0, net); c.car = i; c.up = { engine: 0, tires: 0, plating: 0 }; c.hp = maxHp(c);
        Sound.play('buy'); Save.store(c); layer.destroy(); this.rebuild(); toast(this, t('bought'), '#7dff6a');
      }, { color: own ? 0x555555 : c.money >= net ? 0x5f8a2a : 0x6b3030, size: 23, disabled: own || i < c.car });
      layer.add(btn);
    });
    layer.add(makeButton(this, UW / 2, GH - 48, 280, 64, t('close'), () => layer.destroy(), { color: 0x4a3f36, size: 26 }));
  }
}

// ============================================================
class ResultsScene extends Phaser.Scene {
  constructor() { super('results'); }
  update(time, delta) { menuTick(this, delta); }
  create(res) {
    const c = G.career, pr = res.rows.find(r => r.isPlayer);
    uiCam(this, -MX);
    this.wonTitle = !!res.wonTitle;
    this.cameras.main.fadeIn(300, 0, 0, 0);
    // apply results to the career (once)
    if (!res.applied) {
      res.applied = true;
      const before = [0, 1, 2, 3, 4, 5].filter(ti => tierUnlocked(c, ti)).length;
      c.money += pr.prize + res.cash + res.bounty;
      c.points += pr.points;
      res.unlocked = null;
      c.hp = Math.min(maxHp(c), res.hp); c.mines = res.mines; c.nitro = res.nitro; if (c.bazooka) c.rockets = res.rockets;
      c.races++; c.kills += pr.kills;
      if (pr.place === 1 && !res.dead && !res.forfeit) c.wins++;
      res.rows.forEach(r => { if (!r.isPlayer) { const d = c.drivers.find(x => x.id === r.id); if (d) d.points += r.points; } });
      simulateOthers(c, res.offer.opp);
      c.raceNo++;
      this.wonTitle = res.offer.diff === FINAL && pr.place === 1 && !res.dead && !res.forfeit;
      if (this.wonTitle) c.champion = true;
      res.wonTitle = this.wonTitle;
      const after = [0, 1, 2, 3, 4, 5].filter(ti => tierUnlocked(c, ti)).length;
      if (after > before) res.unlocked = STR.diff[after - 1];
      c.offers = makeOffers(c);
      Save.store(c);
    }
    bg(this);
    const won = pr.place === 1 && !res.dead && !res.forfeit;
    this.add.text(UW / 2, 56, t('results'), { fontFamily: FONT, fontSize: '48px', color: '#ffb52a', stroke: '#000', strokeThickness: 6, resolution: 2 }).setOrigin(0.5);
    this.add.text(UW / 2, 104, `${TRACKS[res.offer.track].name}  ·  ${STR.diff[res.offer.diff]}`, { fontFamily: FONT_B, fontSize: '18px', fontStyle: 'bold', color: '#b0b0bc', resolution: 2 }).setOrigin(0.5);
    // table
    const x = 170, w = UW - 340, y0 = 140;
    panel(this, x, y0, w, 60 + res.rows.length * 52);
    const cols = [[x + 30, t('place')], [x + 130, t('name')], [x + 520, t('kills')], [x + 650, t('prizeMoney')], [x + w - 30, t('pts')]];
    cols.forEach(([cx, s], i) => this.add.text(cx, y0 + 28, s.toUpperCase(), { fontFamily: FONT, fontSize: '14px', color: '#9a9aa8', resolution: 2 }).setOrigin(i === 4 ? 1 : 0, 0.5));
    res.rows.forEach((r, i) => {
      const ry = y0 + 78 + i * 52;
      const g = this.add.graphics();
      g.fillStyle(r.isPlayer ? 0xffb52a : 0xffffff, r.isPlayer ? 0.2 : 0.04).fillRoundedRect(x + 12, ry - 22, w - 24, 44, 8);
      g.fillStyle(r.color, 1).fillRoundedRect(x + 100, ry - 10, 18, 20, 4);
      const col = r.dead ? '#888' : r.isPlayer ? '#ffe14a' : '#fff';
      this.add.text(x + 30, ry, r.dead ? '✖' : `${r.place}.`, { fontFamily: FONT, fontSize: '24px', color: r.place === 1 && !r.dead ? '#ffe14a' : col, resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + 130, ry, r.name + (r.dead ? `  (${t('out')})` : ''), { fontFamily: FONT_B, fontSize: '21px', fontStyle: 'bold', color: col, resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + 520, ry, String(r.kills), { fontFamily: FONT, fontSize: '20px', color: '#ff9a8a', resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + 650, ry, r.prize ? money(r.prize) : '–', { fontFamily: FONT, fontSize: '20px', color: '#7dff6a', resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + w - 30, ry, r.points ? '+' + r.points : '–', { fontFamily: FONT, fontSize: '20px', color: '#fff', resolution: 2 }).setOrigin(1, 0.5);
    });
    // summary
    const sy = y0 + 90 + res.rows.length * 52;
    const lines = [[t('prizeMoney'), pr.prize], [t('bounty'), res.bounty], [t('pickups'), res.cash]];
    lines.forEach(([s, v], i) => {
      this.add.text(x + 30, sy + i * 30, s, { fontFamily: FONT_B, fontSize: '22px', fontStyle: 'bold', color: '#d0c8c0', resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + 430, sy + i * 30, money(v), { fontFamily: FONT, fontSize: '22px', color: '#7dff6a', resolution: 2 }).setOrigin(1, 0.5);
    });
    const total = pr.prize + res.bounty + res.cash;
    this.totalT = this.add.text(x + 30, sy + 98, `${t('total')}: ${money(total)}`, { fontFamily: FONT, fontSize: '32px', color: '#7dff6a', stroke: '#000', strokeThickness: 4, resolution: 2 }).setOrigin(0, 0.5);
    if (res.unlocked) {
      const ut = this.add.text(UW / 2, sy + 128, `NEW RACES UNLOCKED: ${res.unlocked}!`, { fontFamily: FONT, fontSize: '26px', color: '#ffd36a', stroke: '#000', strokeThickness: 5, resolution: 2 }).setOrigin(0.5);
      this.tweens.add({ targets: ut, scale: 1.08, yoyo: true, repeat: -1, duration: 450 });
    }
    if (res.dead) this.add.text(x + 440, sy + 30, t('youWrecked'), { fontFamily: FONT_B, fontSize: '18px', fontStyle: 'bold', color: '#ff6a5a', resolution: 2 }).setOrigin(0, 0.5);
    if (won) {
      Sound.play('win');
      const wt = this.add.text(x + w - 30, sy + 20, '🏆 1ST!', { fontFamily: FONT, fontSize: '40px', color: '#ffe14a', stroke: '#000', strokeThickness: 6, resolution: 2 }).setOrigin(1, 0.5);
      this.tweens.add({ targets: wt, scale: 1.12, yoyo: true, repeat: -1, duration: 500 });
    }
    // buttons
    const next = () => this.scene.start(this.wonTitle ? 'victory' : 'garage');
    const by = GH - 50;
    if (pr.prize > 0 && !res.doubled) {
      const db = makeButton(this, UW / 2 - 170, by, 310, 60, t('double'), async () => {
        db.setEnabled(false);
        const ok = await Poki.rewardedBreak();
        if (ok) { res.doubled = true; c.money += pr.prize; Save.store(c); this.totalT.setText(`${t('total')}: ${money(total + pr.prize)}`); toast(this, t('doubled'), '#7dff6a'); Sound.play('cash'); }
        else db.setEnabled(true);
        if (res.doubled) db.setVisible(false);
      }, { color: 0x7a3f8a, size: 20 });
      makeButton(this, UW / 2 + 170, by, 300, 60, t('toGarage'), next, { color: 0x5f8a2a, size: 22 });
    } else makeButton(this, UW / 2, by, 320, 60, t('toGarage'), next, { color: 0x5f8a2a, size: 22 });
    this.input.keyboard.once('keydown-ENTER', next);
  }
}

// ============================================================
class VictoryScene extends Phaser.Scene {
  constructor() { super('victory'); }
  update(time, delta) { menuTick(this, delta); }
  create() {
    const c = G.career;
    uiCam(this, -MX);
    bg(this);
    makeFxTextures(this);
    this.add.text(UW / 2, 170, t('victory'), { fontFamily: FONT, fontSize: '68px', color: '#ffe14a', stroke: '#5a2a00', strokeThickness: 10, resolution: 2 }).setOrigin(0.5);
    this.add.text(UW / 2, 260, t('victoryTxt'), { fontFamily: FONT_B, fontSize: '24px', fontStyle: 'bold', color: '#ffffff', resolution: 2 }).setOrigin(0.5);
    this.add.text(UW / 2, 310, t('stats', c.races, c.wins, c.kills), { fontFamily: FONT_B, fontSize: '20px', color: '#b0b0bc', resolution: 2 }).setOrigin(0.5);
    addCarImage(this, UW / 2, 460, CARS[c.car].shape, PLAYER_COLOR, 2.2, 0.5);
    makeButton(this, UW / 2 - 170, 600, 300, 64, t('cont'), () => this.scene.start('garage'), { color: 0x5f8a2a });
    makeButton(this, UW / 2 + 170, 600, 300, 64, t('newCareer'), () => { Save.clear(); G.career = newCareer(); this.scene.start('garage'); }, { color: 0x8a2a2a, size: 22 });
    this.time.addEvent({ delay: 60, loop: true, callback: () => {
      const im = this.add.image(rnd(-MX, UW + MX), -10, 'px').setTint(pick([0xffe14a, 0xff4a3a, 0x4ab8ff, 0x7dff6a, 0xff8ae8])).setScale(rnd(1.5, 3));
      this.tweens.add({ targets: im, y: GH + 20, x: im.x + rnd(-120, 120), angle: rnd(-360, 360), duration: rnd(2000, 3500), onComplete: () => im.destroy() });
    } });
  }
}
