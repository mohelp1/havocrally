'use strict';
// ============================================================
//  HAVOC RALLY – menus: boot, title, garage, results, victory
// ============================================================

function mixInt(col, f) {
  const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
  const m = c => Math.round(clamp(f >= 0 ? c + (255 - c) * f : c * (1 + f), 0, 255));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}
const hexStr = col => '#' + col.toString(16).padStart(6, '0');

function makeButton(scene, x, y, w, h, label, cb, o = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const col = o.color === undefined ? 0xd8262e : o.color;
  const txt = scene.add.text(0, 1, label, { fontFamily: FONT, fontSize: (o.size || Math.round(Math.min(28, h * 0.42))) + 'px', color: '#ffffff', stroke: '#000', strokeThickness: 3, resolution: 2, align: 'center' }).setOrigin(0.5);
  c.add([g, txt]);
  let enabled = !o.disabled, hover = false, down = false;
  const draw = () => {
    g.clear();
    const cc = enabled ? col : 0x4a4a4a, dy = down ? 2 : 0;
    g.fillStyle(0x000000, 0.45).fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, 12);
    g.fillStyle(mixInt(cc, hover && enabled ? 0.18 : 0), 1).fillRoundedRect(-w / 2, -h / 2 + dy, w, h, 12);
    g.fillStyle(0xffffff, enabled ? 0.18 : 0.06).fillRoundedRect(-w / 2 + 4, -h / 2 + 3 + dy, w - 8, h * 0.4, 9);
    g.lineStyle(2, 0x000000, 0.55).strokeRoundedRect(-w / 2, -h / 2 + dy, w, h, 12);
    txt.setAlpha(enabled ? 1 : 0.55); txt.y = 1 + dy;
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
function makeSoundButton(scene, x, y) {
  const lab = () => (Sound.muted ? 'SOUND: OFF' : 'SOUND: ON');
  const b = makeButton(scene, x, y, 220, 46, lab(), () => { Sound.toggle(); b.setLabel(lab()); }, { color: 0x4a3f36, size: 18 });
  return b;
}
function panel(scene, x, y, w, h, title) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 4, y + 6, w, h, 14);
  g.fillStyle(0x211a15, 0.95).fillRoundedRect(x, y, w, h, 10);
  g.lineStyle(3, 0x5a3c26, 1).strokeRoundedRect(x, y, w, h, 10);
  g.lineStyle(1, 0x000000, 0.6).strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 7);
  for (const [rx, ry] of [[x + 10, y + h - 10], [x + w - 10, y + h - 10]]) { g.fillStyle(0x8a6a4a, 1).fillCircle(rx, ry, 3); g.fillStyle(0x2a1d14, 1).fillCircle(rx + 0.8, ry + 0.8, 1.2); }
  if (title) {
    g.fillStyle(0x3d2a1c, 1).fillRoundedRect(x, y, w, 40, { tl: 10, tr: 10, bl: 0, br: 0 });
    g.fillStyle(0x7a4a26, 0.35); for (let k = 0; k < 4; k++) g.fillRect(x + w * 0.5 + k * (w / 9), y + 8, w / 18, 24);
    for (const rx of [x + 10, x + w - 10]) { g.fillStyle(0x8a6a4a, 1).fillCircle(rx, y + 20, 3); g.fillStyle(0x2a1d14, 1).fillCircle(rx + 0.8, y + 20.8, 1.2); }
    scene.add.text(x + 22, y + 20, title, { fontFamily: FONT, fontSize: '19px', color: '#ffb52a', resolution: 2 }).setOrigin(0, 0.5);
  }
  return g;
}
function bg(scene) {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x1c1510, 0x1c1510, 0x3a2414, 0x3a2414, 1).fillRect(0, 0, GW, GH);
  g.lineStyle(30, 0xd89a3a, 0.025);
  for (let x = -GH; x < GW; x += 90) g.lineBetween(x, GH, x + GH, 0);
  const rng = mulberry(5);
  for (let k = 0; k < 140; k++) { g.fillStyle(rng() < 0.5 ? 0x7a3e1e : 0x000000, 0.05 + rng() * 0.08).fillCircle(rng() * GW, rng() * GH, 6 + rng() * 40); }
  return g;
}
function toast(scene, text, color = '#ff5a4a') {
  const tt = scene.add.text(GW / 2, GH / 2, text, { fontFamily: FONT, fontSize: '40px', color, stroke: '#000', strokeThickness: 6, resolution: 2 }).setOrigin(0.5).setDepth(500);
  scene.tweens.add({ targets: tt, y: GH / 2 - 60, alpha: 0, duration: 1100, delay: 300, onComplete: () => tt.destroy() });
}
function statBar(scene, x, y, w, label, f, f2) {
  const g = scene.add.graphics();
  scene.add.text(x, y, label, { fontFamily: FONT_B, fontSize: '15px', fontStyle: 'bold', color: '#c8c8d0', resolution: 2 }).setOrigin(0, 0.5);
  const bx = x + 120, bw = w - 120;
  g.fillStyle(0x000000, 0.6).fillRoundedRect(bx, y - 7, bw, 14, 5);
  if (f2 !== undefined && f2 > f) g.fillStyle(0x7dff6a, 0.45).fillRoundedRect(bx + 1, y - 6, Math.max(3, (bw - 2) * clamp(f2, 0, 1)), 12, 4);
  g.fillStyle(0xffb52a, 1).fillRoundedRect(bx + 1, y - 6, Math.max(3, (bw - 2) * clamp(f, 0, 1)), 12, 4);
  return g;
}
const STAT_MAX = (() => { const s = carStats(3, { engine: 3, tires: 3, plating: 3 }, 0); return { speed: s.speed, accel: s.accel, handling: s.turn * s.grip, hp: s.hp }; })();
const statFracs = s => ({ speed: s.speed / STAT_MAX.speed, accel: s.accel / STAT_MAX.accel, handling: (s.turn * s.grip) / STAT_MAX.handling, hp: s.hp / STAT_MAX.hp });

// ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    makeFxTextures(this);
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    G.career = Save.load();
    Poki.loadingFinished();
    this.scene.start('title');
  }
}

// ============================================================
class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    this.scene.launch('race', { demo: true, track: rndi(0, 3) });
    this.scene.bringToTop();
    const g = this.add.graphics();
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.82, 0.15, 0.82, 0.15).fillRect(0, 0, GW, GH);
    g.fillStyle(0x000000, 0.35).fillRect(0, GH - 58, GW, 58);
    this.add.image(GW / 2, GH / 2, 'vignette').setDisplaySize(GW, GH).setDepth(-1);
    this.add.rectangle(GW / 2, GH / 2, GW, GH, 0xd89a58, 0.07).setDepth(-1);
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
}

// ============================================================
class GarageScene extends Phaser.Scene {
  constructor() { super('garage'); }
  create() {
    this.starting = false;              // scene instances are reused between visits
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.build();
    if (!G.career.tipSeen) this.showTip();
  }
  rebuild() { this.children.removeAll(true); this.build(); }

  build() {
    const c = G.career;
    bg(this);
    // header
    const hg = this.add.graphics();
    hg.fillStyle(0x000000, 0.5).fillRect(0, 0, GW, 64);
    hg.fillStyle(0xffb52a, 1).fillRect(0, 62, GW, 3);
    this.add.text(24, 32, t('garage'), { fontFamily: FONT, fontSize: '32px', color: '#ffb52a', resolution: 2 }).setOrigin(0, 0.5);
    this.add.text(345, 32, money(c.money), { fontFamily: FONT, fontSize: '30px', color: '#7dff6a', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5);
    this.add.text(545, 32, `${t('points')}: ${c.points} / ${BOSS_POINTS}`, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', resolution: 2 }).setOrigin(0, 0.5);
    this.add.text(820, 32, t('raceNo', c.raceNo), { fontFamily: FONT, fontSize: '20px', color: '#aab', resolution: 2 }).setOrigin(0, 0.5);
    const sb = makeButton(this, GW - 70, 32, 110, 40, Sound.muted ? '🔇 OFF' : '🔊 ON', () => { Sound.toggle(); sb.setLabel(Sound.muted ? '🔇 OFF' : '🔊 ON'); }, { color: 0x4a3f36, size: 16 });
    makeButton(this, GW - 190, 32, 110, 40, 'MENU', () => this.scene.start('title'), { color: 0x4a3f36, size: 16 });
    this.buildCar(c); this.buildShop(c); this.buildRanking(c); this.buildRaces(c);
  }

  buildCar(c) {
    const x = 20, y = 80, w = 400, h = 470;
    panel(this, x, y, w, h, CARS[c.car].name.toUpperCase());
    const st = carStats(c.car, c.up, c.mg);
    this.add.image(x + w / 2 + 10, y + 166, 'soft').setTint(0x000000).setAlpha(0.5).setScale(3.4, 1.3).setDepth(0.5);
    const sp = addCarImage(this, x + w / 2, y + 160, st.shape, PLAYER_COLOR, 1.75, 0.5).setDepth(1);
    let ang = 0.5;
    this.time.addEvent({ delay: 50, loop: true, callback: () => { ang += 0.022; sp.setFrame(carFrame(ang).name); } });
    const fr = statFracs(st);
    statBar(this, x + 24, y + 236, w - 48, t('speed'), fr.speed);
    statBar(this, x + 24, y + 264, w - 48, t('accel'), fr.accel);
    statBar(this, x + 24, y + 292, w - 48, t('handling'), fr.handling);
    statBar(this, x + 24, y + 320, w - 48, t('armor'), fr.hp);
    // condition
    const mh = st.hp, f = clamp(c.hp / mh, 0, 1);
    this.add.text(x + 24, y + 362, `${t('condition')}: ${Math.round(f * 100)}%`, { fontFamily: FONT, fontSize: '18px', color: f > 0.5 ? '#7dff6a' : f > 0.25 ? '#ffb020' : '#ff4a3a', resolution: 2 }).setOrigin(0, 0.5);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.6).fillRoundedRect(x + 24, y + 378, w - 48, 16, 6);
    g.fillStyle(f > 0.5 ? 0x4ad04a : f > 0.25 ? 0xffb020 : 0xff3a2a, 1).fillRoundedRect(x + 26, y + 380, Math.max(3, (w - 52) * f), 12, 5);
    const cost = Math.ceil((mh - c.hp) * REPAIR_PER_HP);
    const damaged = c.hp < mh - 0.5;
    makeButton(this, x + 105, y + 432, 170, 50, damaged ? t('repair', money(cost)) : t('repaired'), () => {
      if (c.money < cost) { toast(this, t('noMoney')); Sound.play('deny'); return; }
      c.money -= cost; c.hp = mh; Sound.play('buy'); Save.store(c); this.rebuild();
    }, { color: 0x3f6a7a, size: 16, disabled: !damaged });
    makeButton(this, x + 292, y + 432, 170, 50, t('repairAd'), async () => {
      const ok = await Poki.rewardedBreak();
      if (ok) { c.hp = mh; Sound.play('buy'); Save.store(c); this.rebuild(); }
    }, { color: 0x7a3f8a, size: 16, disabled: !(damaged && c.hp < mh * 0.8) });
  }

  buildShop(c) {
    const x = 440, y = 80, w = 400, h = 470;
    panel(this, x, y, w, h, t('upgrades'));
    const rows = [];
    UPGRADES.forEach(k => {
      const lvl = c.up[k];
      rows.push({ name: t(k), desc: STR.upDesc[k], lvl, max: 3, cost: lvl < 3 ? upCost(c.car, k, lvl) : 0, buy: () => { c.up[k]++; if (k === 'plating') c.hp += carStats(c.car, c.up, c.mg).hp - carStats(c.car, { ...c.up, plating: c.up.plating - 1 }, c.mg).hp; } });
    });
    rows.push({ name: t('mg'), desc: STR.upDesc.mg, lvl: c.mg, max: 3, cost: c.mg < 3 ? MG_COST[c.mg] : 0, buy: () => { c.mg++; } });
    rows.push({ name: t('mines'), desc: STR.upDesc.mines, count: `${c.mines}/${MINE_MAX}`, full: c.mines >= MINE_MAX, cost: MINE_PACK, buy: () => { c.mines = Math.min(MINE_MAX, c.mines + 3); } });
    rows.push({ name: t('nitro'), desc: STR.upDesc.nitro, count: `${c.nitro}/${NITRO_MAX}`, full: c.nitro >= NITRO_MAX, cost: NITRO_COST, buy: () => { c.nitro = Math.min(NITRO_MAX, c.nitro + 1); } });
    rows.forEach((r, i) => {
      const ry = y + 70 + i * 58;
      const g = this.add.graphics();
      g.fillStyle(0xffffff, i % 2 ? 0.02 : 0.05).fillRoundedRect(x + 10, ry - 26, w - 20, 54, 8);
      this.add.text(x + 22, ry - 9, r.name, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + 22, ry + 13, r.desc, { fontFamily: FONT_B, fontSize: '13px', color: '#9a9aa8', resolution: 2 }).setOrigin(0, 0.5);
      if (r.max) for (let k = 0; k < r.max; k++) g.fillStyle(k < r.lvl ? 0xffb52a : 0x40434e, 1).fillRoundedRect(x + 190 + k * 22, ry - 16, 17, 14, 3);
      else this.add.text(x + 190, ry - 9, r.count, { fontFamily: FONT, fontSize: '17px', color: '#ffb52a', resolution: 2 }).setOrigin(0, 0.5);
      const maxed = r.max ? r.lvl >= r.max : r.full;
      makeButton(this, x + w - 72, ry, 112, 40, maxed ? t('max') : money(r.cost), () => {
        if (c.money < r.cost) { toast(this, t('noMoney')); Sound.play('deny'); return; }
        c.money -= r.cost; r.buy(); Sound.play('buy'); Save.store(c); this.rebuild();
      }, { color: c.money >= r.cost ? 0x5f8a2a : 0x6b3030, size: 16, disabled: maxed });
    });
    makeButton(this, x + w / 2, y + h - 40, w - 60, 52, '🚗  ' + t('dealer'), () => this.showDealer(), { color: 0xc0601a, size: 22 });
  }

  buildRanking(c) {
    const x = 860, y = 80, w = 400, h = 470;
    panel(this, x, y, w, h, t('ranking'));
    const rows = standings(c);
    rows.forEach((r, i) => {
      const ry = y + 62 + i * 37;
      const g = this.add.graphics();
      g.fillStyle(r.player ? 0xffb52a : r.boss ? 0x8a1010 : 0xffffff, r.player ? 0.22 : r.boss ? 0.3 : i % 2 ? 0.02 : 0.05).fillRoundedRect(x + 10, ry - 16, w - 20, 33, 7);
      g.fillStyle(r.color, 1).fillRoundedRect(x + 50, ry - 8, 14, 16, 3);
      g.lineStyle(1, 0x000000, 0.6).strokeRoundedRect(x + 50, ry - 8, 14, 16, 3);
      this.add.text(x + 22, ry, `${i + 1}.`, { fontFamily: FONT, fontSize: '16px', color: '#9a9aa8', resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + 76, ry, r.name + (r.boss ? ' ☠' : ''), { fontFamily: FONT_B, fontSize: '17px', fontStyle: 'bold', color: r.player ? '#ffe14a' : r.boss ? '#ff6a5a' : '#ffffff', resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + w - 24, ry, String(r.points), { fontFamily: FONT, fontSize: '17px', color: '#ffffff', resolution: 2 }).setOrigin(1, 0.5);
    });
  }

  buildRaces(c) {
    const offers = c.offers, n = offers.length, gap = 14, x0 = 20, y = 566, h = 140;
    const w = (GW - 40 - gap * (n - 1)) / n;
    const diffCol = [0x2e9e4a, 0xd89a1a, 0xc8322a, 0x7a1010];
    offers.forEach((o, i) => {
      const x = x0 + i * (w + gap), boss = o.diff === 3;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 5, w, h, 14);
      g.fillStyle(boss ? 0x2a0c0c : 0x1b1d24, 0.95).fillRoundedRect(x, y, w, h, 14);
      g.lineStyle(3, diffCol[o.diff], 1).strokeRoundedRect(x, y, w, h, 14);
      g.fillStyle(diffCol[o.diff], 1).fillRoundedRect(x, y, w, 30, { tl: 14, tr: 14, bl: 0, br: 0 });
      this.add.text(x + 14, y + 15, boss ? t('bossCard').toUpperCase() : STR.diff[o.diff], { fontFamily: FONT, fontSize: '17px', color: '#ffffff', resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + w - 14, y + 15, lapsText(o.laps), { fontFamily: FONT, fontSize: '15px', color: '#ffffff', resolution: 2 }).setOrigin(1, 0.5);
      this.add.text(x + 14, y + 48, TRACKS[o.track].name, { fontFamily: FONT, fontSize: '19px', color: '#ffb52a', resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + 14, y + 74, t('prize', money(PRIZES[o.diff][0])) + (POINTS[o.diff][0] ? `  ·  +${POINTS[o.diff][0]} ${t('points').toLowerCase()}` : ''), { fontFamily: FONT_B, fontSize: '15px', fontStyle: 'bold', color: '#7dff6a', resolution: 2 }).setOrigin(0, 0.5);
      const names = o.opp.map(id => driverDef(id).name).join(', ');
      this.add.text(x + 14, y + 98, t('opponents') + ' ' + names, { fontFamily: FONT_B, fontSize: '13px', color: '#b0b0bc', resolution: 2, wordWrap: { width: w - 150 } }).setOrigin(0, 0.5);
      makeButton(this, x + w - 70, y + h - 30, 116, 44, t('race'), () => this.startRace(o), { color: diffCol[o.diff], size: 19 });
    });
    if (!offers.some(o => o.diff === 3) && !c.champion) {
      this.add.text(GW / 2, 557, t('bossLocked', BOSS_POINTS), { fontFamily: FONT_B, fontSize: '14px', fontStyle: 'bold', color: '#ff8a6a', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0.5);
    }
  }

  async startRace(offer) {
    if (this.starting) return;
    this.starting = true;
    const c = G.career;
    const ov = this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.75).setDepth(900).setInteractive();
    this.add.text(GW / 2, GH / 2, t('loading'), { fontFamily: FONT, fontSize: '40px', color: '#ffb52a', resolution: 2 }).setOrigin(0.5).setDepth(901);
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
    layer.add(this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.7).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(0x1b1d24, 1).fillRoundedRect(GW / 2 - 330, GH / 2 - 170, 660, 340, 16);
    g.lineStyle(3, 0xffb52a, 1).strokeRoundedRect(GW / 2 - 330, GH / 2 - 170, 660, 340, 16);
    layer.add(g);
    layer.add(this.add.text(GW / 2, GH / 2 - 125, 'WELCOME TO HAVOC RALLY', { fontFamily: FONT, fontSize: '28px', color: '#ffb52a', resolution: 2 }).setOrigin(0.5));
    layer.add(this.add.text(GW / 2, GH / 2 - 30, t('tip'), { fontFamily: FONT_B, fontSize: '20px', fontStyle: 'bold', color: '#ffffff', align: 'center', resolution: 2, wordWrap: { width: 580 } }).setOrigin(0.5));
    layer.add(this.add.text(GW / 2, GH / 2 + 38, t('controls').replace(/ {3}· {3}/g, '  ·  '), { fontFamily: FONT_B, fontSize: '14px', fontStyle: 'bold', color: '#ffb52a', align: 'center', resolution: 2, wordWrap: { width: 600 } }).setOrigin(0.5));
    layer.add(this.add.text(GW / 2, GH / 2 + 76, t('controlsTouch'), { fontFamily: FONT_B, fontSize: '15px', color: '#b0b0bc', align: 'center', resolution: 2 }).setOrigin(0.5));
    layer.add(makeButton(this, GW / 2, GH / 2 + 120, 220, 56, 'OK', () => { c.tipSeen = true; Save.store(c); layer.destroy(); }, { color: 0x5f8a2a }));
  }

  showDealer() {
    const c = G.career;
    const layer = this.add.container(0, 0).setDepth(800);
    layer.add(this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.8).setInteractive());
    layer.add(this.add.text(GW / 2, 60, t('dealer'), { fontFamily: FONT, fontSize: '40px', color: '#ffb52a', resolution: 2 }).setOrigin(0.5));
    const trade = Math.round(CARS[c.car].price * 0.5);
    layer.add(this.add.text(GW / 2, 104, t('tradeIn', money(trade)) + '   ·   ' + money(c.money), { fontFamily: FONT_B, fontSize: '18px', fontStyle: 'bold', color: '#7dff6a', resolution: 2 }).setOrigin(0.5));
    const w = 290, gap = 16, x0 = (GW - (w * 4 + gap * 3)) / 2;
    CARS.forEach((car, i) => {
      const x = x0 + i * (w + gap), y = 140, h = 470;
      const g = this.add.graphics();
      g.fillStyle(0x1b1d24, 1).fillRoundedRect(x, y, w, h, 14);
      g.lineStyle(3, i === c.car ? 0xffb52a : 0x3a3d48, 1).strokeRoundedRect(x, y, w, h, 14);
      layer.add(g);
      layer.add(this.add.text(x + w / 2, y + 30, car.name.toUpperCase(), { fontFamily: FONT, fontSize: '26px', color: '#ffffff', resolution: 2 }).setOrigin(0.5));
      layer.add(addCarImage(this, x + w / 2, y + 140, car.shape, PLAYER_COLOR, 1.45, 0.5));
      const st = carStats(i, { engine: 0, tires: 0, plating: 0 }, 0), fr = statFracs(st);
      [['speed', fr.speed], ['accel', fr.accel], ['handling', fr.handling], ['armor', fr.hp]].forEach(([k, v], j) => {
        const by = y + 190 + j * 30;
        layer.add(this.add.text(x + 16, by, t(k), { fontFamily: FONT_B, fontSize: '14px', fontStyle: 'bold', color: '#c8c8d0', resolution: 2 }).setOrigin(0, 0.5));
        const bg2 = this.add.graphics();
        bg2.fillStyle(0x000000, 0.6).fillRoundedRect(x + 120, by - 6, w - 140, 12, 4);
        bg2.fillStyle(0xffb52a, 1).fillRoundedRect(x + 121, by - 5, (w - 142) * clamp(v, 0, 1), 10, 3);
        layer.add(bg2);
      });
      layer.add(this.add.text(x + w / 2, y + 330, STR.carDesc[i], { fontFamily: FONT_B, fontSize: '15px', color: '#b0b0bc', align: 'center', resolution: 2, wordWrap: { width: w - 30 } }).setOrigin(0.5));
      const own = i === c.car, net = car.price - trade;
      const btn = makeButton(this, x + w / 2, y + h - 50, w - 40, 56, own ? t('owned') : t('buyFor', money(Math.max(0, net))), () => {
        if (c.money < net) { toast(this, t('noMoney')); Sound.play('deny'); return; }
        c.money -= Math.max(0, net); c.car = i; c.up = { engine: 0, tires: 0, plating: 0 }; c.hp = maxHp(c);
        Sound.play('buy'); Save.store(c); layer.destroy(); this.rebuild(); toast(this, t('bought'), '#7dff6a');
      }, { color: own ? 0x555555 : c.money >= net ? 0x5f8a2a : 0x6b3030, size: 18, disabled: own || i < c.car });
      layer.add(btn);
    });
    layer.add(makeButton(this, GW / 2, GH - 50, 260, 54, t('close'), () => layer.destroy(), { color: 0x4a3f36 }));
  }
}

// ============================================================
class ResultsScene extends Phaser.Scene {
  constructor() { super('results'); }
  create(res) {
    const c = G.career, pr = res.rows.find(r => r.isPlayer);
    this.wonTitle = !!res.wonTitle;
    this.cameras.main.fadeIn(300, 0, 0, 0);
    // apply results to the career (once)
    if (!res.applied) {
      res.applied = true;
      c.money += pr.prize + res.cash + res.bounty;
      c.points += pr.points;
      c.hp = Math.min(maxHp(c), res.hp); c.mines = res.mines; c.nitro = res.nitro;
      c.races++; c.kills += pr.kills;
      if (pr.place === 1 && !res.dead && !res.forfeit) c.wins++;
      res.rows.forEach(r => { if (!r.isPlayer) { const d = c.drivers.find(x => x.id === r.id); if (d) d.points += r.points; } });
      simulateOthers(c, res.offer.opp);
      c.raceNo++;
      this.wonTitle = res.offer.diff === 3 && pr.place === 1 && !res.dead && !res.forfeit;
      if (this.wonTitle) c.champion = true;
      res.wonTitle = this.wonTitle;
      c.offers = makeOffers(c);
      Save.store(c);
    }
    bg(this);
    const won = pr.place === 1 && !res.dead && !res.forfeit;
    this.add.text(GW / 2, 56, t('results'), { fontFamily: FONT, fontSize: '48px', color: '#ffb52a', stroke: '#000', strokeThickness: 6, resolution: 2 }).setOrigin(0.5);
    this.add.text(GW / 2, 104, `${TRACKS[res.offer.track].name}  ·  ${STR.diff[res.offer.diff]}`, { fontFamily: FONT_B, fontSize: '18px', fontStyle: 'bold', color: '#b0b0bc', resolution: 2 }).setOrigin(0.5);
    // table
    const x = 170, w = GW - 340, y0 = 140;
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
      this.add.text(x + 30, sy + i * 28, s, { fontFamily: FONT_B, fontSize: '18px', fontStyle: 'bold', color: '#c8c8d0', resolution: 2 }).setOrigin(0, 0.5);
      this.add.text(x + 380, sy + i * 28, money(v), { fontFamily: FONT, fontSize: '18px', color: '#7dff6a', resolution: 2 }).setOrigin(1, 0.5);
    });
    const total = pr.prize + res.bounty + res.cash;
    this.totalT = this.add.text(x + 30, sy + 92, `${t('total')}: ${money(total)}`, { fontFamily: FONT, fontSize: '28px', color: '#7dff6a', stroke: '#000', strokeThickness: 4, resolution: 2 }).setOrigin(0, 0.5);
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
      const db = makeButton(this, GW / 2 - 170, by, 310, 60, t('double'), async () => {
        db.setEnabled(false);
        const ok = await Poki.rewardedBreak();
        if (ok) { res.doubled = true; c.money += pr.prize; Save.store(c); this.totalT.setText(`${t('total')}: ${money(total + pr.prize)}`); toast(this, t('doubled'), '#7dff6a'); Sound.play('cash'); }
        else db.setEnabled(true);
        if (res.doubled) db.setVisible(false);
      }, { color: 0x7a3f8a, size: 20 });
      makeButton(this, GW / 2 + 170, by, 300, 60, t('toGarage'), next, { color: 0x5f8a2a, size: 22 });
    } else makeButton(this, GW / 2, by, 320, 60, t('toGarage'), next, { color: 0x5f8a2a, size: 22 });
    this.input.keyboard.once('keydown-ENTER', next);
  }
}

// ============================================================
class VictoryScene extends Phaser.Scene {
  constructor() { super('victory'); }
  create() {
    const c = G.career;
    bg(this);
    makeFxTextures(this);
    this.add.text(GW / 2, 170, t('victory'), { fontFamily: FONT, fontSize: '68px', color: '#ffe14a', stroke: '#5a2a00', strokeThickness: 10, resolution: 2 }).setOrigin(0.5);
    this.add.text(GW / 2, 260, t('victoryTxt'), { fontFamily: FONT_B, fontSize: '24px', fontStyle: 'bold', color: '#ffffff', resolution: 2 }).setOrigin(0.5);
    this.add.text(GW / 2, 310, t('stats', c.races, c.wins, c.kills), { fontFamily: FONT_B, fontSize: '20px', color: '#b0b0bc', resolution: 2 }).setOrigin(0.5);
    const car = addCarImage(this, GW / 2, 460, CARS[c.car].shape, PLAYER_COLOR, 2.2, 0);
    let ang = 0;
    this.time.addEvent({ delay: 40, loop: true, callback: () => { ang += 0.04; car.setFrame(carFrame(ang).name); } });
    makeButton(this, GW / 2 - 170, 600, 300, 64, t('cont'), () => this.scene.start('garage'), { color: 0x5f8a2a });
    makeButton(this, GW / 2 + 170, 600, 300, 64, t('newCareer'), () => { Save.clear(); G.career = newCareer(); this.scene.start('garage'); }, { color: 0x8a2a2a, size: 22 });
    this.time.addEvent({ delay: 60, loop: true, callback: () => {
      const im = this.add.image(rnd(0, GW), -10, 'px').setTint(pick([0xffe14a, 0xff4a3a, 0x4ab8ff, 0x7dff6a, 0xff8ae8])).setScale(rnd(1.5, 3));
      this.tweens.add({ targets: im, y: GH + 20, x: im.x + rnd(-120, 120), angle: rnd(-360, 360), duration: rnd(2000, 3500), onComplete: () => im.destroy() });
    } });
  }
}
