'use strict';
// ============================================================
//  HAVOC RALLY – race: physics, AI, weapons, pickups, effects
// ============================================================

const CAR_R = 12, CAR_OFF = 10;            // two collision circles per car
const CAM_ZOOM = 1.12, GUN_Z = 11;
const BULLET_SPEED = 1450, BULLET_LIFE = 0.42, FIRE_GAP = 0.085;
const AMMO_BASE = 140, AMMO_MAX = 220;

// ---------------- particle pool ----------------
class FX {
  constructor(scene, cap = 1200) { this.s = scene; this.pool = []; this.live = []; this.cap = cap; }
  spawn(tex, x, y, o = {}) {
    if (this.live.length >= this.cap) return null;
    let im = this.pool.pop();
    if (!im) im = this.s.add.image(0, 0, tex);
    im.setTexture(tex).setPosition(x, y).setVisible(true).setActive(true);
    im.setTint(o.tint === undefined ? 0xffffff : o.tint);
    im.setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    im.setDepth(o.depth === undefined ? 20 : o.depth).setRotation(o.rot || 0);
    const p = im._p || (im._p = {});
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.life = o.life || 0.5; p.t = 0; p.drag = o.drag || 0; p.vr = o.vr || 0;
    p.s0 = o.s0 === undefined ? 1 : o.s0; p.s1 = o.s1 === undefined ? p.s0 : o.s1;
    p.a0 = o.a0 === undefined ? 1 : o.a0; p.a1 = o.a1 === undefined ? 0 : o.a1; p.sx = o.sx || 1;
    im.setScale(p.s0 * p.sx, p.s0).setAlpha(p.a0);
    this.live.push(im);
    return im;
  }
  update(dt) {
    const L2 = this.live;
    for (let i = L2.length - 1; i >= 0; i--) {
      const im = L2[i], p = im._p; p.t += dt;
      const f = p.t / p.life;
      if (f >= 1) { im.setVisible(false).setActive(false); this.pool.push(im); L2[i] = L2[L2.length - 1]; L2.pop(); continue; }
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      im.x += p.vx * dt; im.y += p.vy * dt; if (p.vr) im.rotation += p.vr * dt;
      const sc = p.s0 + (p.s1 - p.s0) * f; im.setScale(sc * p.sx, sc); im.setAlpha(p.a0 + (p.a1 - p.a0) * f);
    }
  }
}

// skid marks: ring buffer of fading images
class Skids {
  constructor(scene, cap = 520) { this.s = scene; this.cap = cap; this.items = []; this.head = 0; }
  add(x, y, a, alpha, tint = 0xffffff) {
    let im;
    if (this.items.length < this.cap) { im = this.s.add.image(x, y, 'skid').setDepth(1); this.items.push(im); }
    else { im = this.items[this.head]; this.head = (this.head + 1) % this.cap; im.setPosition(x, y); }
    im.setRotation(a).setAlpha(alpha).setScale(1.3, 1.1).setTint(tint).setVisible(true); im._a = alpha;
  }
  update(dt) { for (const im of this.items) if (im._a > 0) { im._a -= dt * 0.09; im.setAlpha(Math.max(0, im._a)); if (im._a <= 0) im.setVisible(false); } }
}

// ---------------- car ----------------
class Car {
  constructor(scene, o, slot) {
    this.scene = scene; this.id = o.id; this.name = o.name; this.color = o.color; this.isPlayer = !!o.isPlayer;
    this.st = o.stats; this.skill = o.skill || 0; this.aggr = o.aggr || 0.5;
    this.maxHp = o.stats.hp; this.hp = Math.min(o.hp, this.maxHp);
    this.ammo = o.ammo; this.mines = o.mines; this.nitro = o.nitro; this.invuln = !!o.invuln;
    this.x = slot.x; this.y = slot.y; this.a = slot.a; this.vx = 0; this.vy = 0; this.spin = 0;
    const n = nearest(scene.tr, this.x, this.y);
    this.idx = n.i; this.s = n.s; this.d = n.d; this.side = n.side; this.lapRaw = -1; this.total = this.s - scene.tr.len;
    this.finished = false; this.finishOrder = 0; this.dead = false; this.deadAt = 0; this.kills = 0;
    this.lastHit = null; this.lastHitT = -99; this.fireCd = 0; this.nitroT = 0; this.mineCd = 0; this.flashT = 0; this.shots = 0;
    const S3 = CAR3[o.stats.shape];
    this.gunZ = S3.roofGun ? S3.cz + 1.8 : S3.bz1 + 1.6; this.gunX = S3.gunRoof ? S3.gunRoof[1] : S3.roofGun ? S3.cabTop[1][0] + 9 : S3.gun[1];
    this.fwd = 0; this.lat = 0; this.offroad = false; this.skidT = 0; this.smokeT = 0;
    // AI state
    this.lane = 0; this.laneTarget = 0; this.laneT = 0; this.stuckT = 0; this.revT = 0; this.burstT = 0; this.wrongT = 0;
    const tex = renderCarSheet(scene, o.stats.shape, o.color, o.kit, scene.demo);   // demo race: quick untextured sheets
    this.sh = scene.add.image(this.x + 4, this.y + 6, carShadowTexture(scene, o.stats.shape)).setScale(1.08 / CAR_RES).setAlpha(0.45).setDepth(8);
    this.sheet = tex; this.fname = 'f0';
    this.spr = scene.add.image(this.x, this.y, tex + '_f0').setOrigin(0.5, CAR_OY).setScale(1 / CAR_RES3).setDepth(10);
    if (scene.tr.theme.lamps) this.cone = scene.add.image(this.x, this.y, 'cone').setOrigin(0, 0.5).setScale(1.1, 0.9).setAlpha(0.42).setBlendMode(Phaser.BlendModes.ADD).setDepth(11);
    if (this.isPlayer) this.marker = scene.add.image(this.x, this.y, 'soft').setTint(0xffe14a).setAlpha(0).setDepth(7);
    this.brk = scene.add.image(this.x, this.y, 'soft').setTint(0xff2a10).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55, 0.32).setAlpha(0);
    this.sync();
  }
  sync() {
    const fr = carFrame(this.a);
    if (fr.name !== this.fname) { this.fname = fr.name; this.spr.setTexture(this.sheet + '_' + fr.name); }
    this.spr.setPosition(this.x, this.y).setRotation(fr.rest).setDepth(10 + this.y * 1e-4);
    const hpf = this.hp / this.maxHp;
    this.spr.setTint(this.dead ? 0x3a3a3a : this.flashT > 0 ? 0xff9a7a : hpf < 0.3 ? 0xb8a494 : 0xffffff).setAlpha(this.finished && !this.scene.demo ? 0.6 : 1);
    const braking = !this.dead && this.thr < 0 && this.fwd > 30;
    this.brk.setPosition(this.x - Math.cos(this.a) * 22, this.y - Math.sin(this.a) * 22 - 7 * VIEW_K).setRotation(this.a + Math.PI / 2).setDepth(this.spr.depth + 0.00005).setAlpha(braking ? 0.95 : 0);
    this.sh.setPosition(this.x + 5, this.y + 5).setRotation(this.a);
    if (this.cone) this.cone.setPosition(this.x + Math.cos(this.a) * 18, this.y + Math.sin(this.a) * 18).setRotation(this.a).setVisible(!this.dead);
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
}

// ============================================================
class RaceScene extends Phaser.Scene {
  constructor() { super('race'); }

  init(data) {
    this.demo = !!data.demo;
    this.offer = data.offer || { diff: 0, track: data.track || 0, laps: 99, opp: [] };
  }

  create() {
    this.tr = buildTrack(this.offer.track);
    makeFxTextures(this);
    const chunks = renderTrackTextures(this, this.tr);
    chunks.forEach(c => this.add.image(c.x, c.y, c.key).setOrigin(0, 0).setDepth(0));
    this.fx = new FX(this); this.skids = new Skids(this);
    const dc = cssRGB(this.tr.theme.run1); this.dustCol = (dc[0] << 16) | (dc[1] << 8) | dc[2]; this.fireT = 0;
    this.bulletG = this.add.graphics().setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    this.bullets = []; this.mines = []; this.pickups = [];
    this.time0 = 0; this.raceT = 0; this.count = this.demo ? 0 : 3.6; this.lastBeep = 4;
    this.finishCount = 0; this.deaths = 0; this.endT = -1; this.ended = false; this.paused = false;
    this.playerCash = 0; this.playerBounty = 0; this.touch = { left: false, right: false, brake: false, fire: false, mine: false, nitro: false, active: false };
    this.mineEdge = false; this.nitroEdge = false;

    this.makeCars();
    for (let k = 0; k < 7; k++) this.spawnPickup(true);
    if (!this.demo) pruneCarSheets(this, this.cars.map(c => c.sheet).concat(G.career ? [carSheetKey(CARS[G.career.car].shape, PLAYER_COLOR)] : []));

    const cam = this.cameras.main;
    cam.setZoom(CAM_ZOOM, CAM_ZOOM * VIEW_IY);          // tilted 2.5D view
    this.zoomNow = CAM_ZOOM;
    if (!LOW_MEM) try {                                  // gritty color grade (one cheap full-screen pass)
      const cm = cam.filters.external.addColorMatrix();
      cm.colorMatrix.saturate(0.12); cm.colorMatrix.contrast(0.1, true);
    } catch (e) { /* filters not available */ }
    cam.setBounds(0, 0, this.tr.W, this.tr.H);
    const f = this.player || this.cars[0];
    this.camX = f.x; this.camY = f.y; cam.centerOn(this.camX, this.camY);
    this.camTarget = f; this.camSwitch = 8;

    if (!this.demo) {
      this.keys = this.input.keyboard.addKeys({
        up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D',
        fire: 'SPACE', fire2: 'J', mine: 'X', mine2: 'K', nitro: 'SHIFT', nitro2: 'L'
      });
      this.input.keyboard.on('keydown-ESC', () => this.togglePause());
      this.input.keyboard.on('keydown-P', () => this.togglePause());
      this.scene.launch('hud');
      Sound.engineStart();
      const onBlur = () => { if (!this.paused && !this.ended) this.togglePause(true); };
      this.game.events.on(Phaser.Core.Events.BLUR, onBlur);
      this.game.events.on(Phaser.Core.Events.HIDDEN, onBlur);
      this.events.once('shutdown', () => {
        this.game.events.off(Phaser.Core.Events.BLUR, onBlur);
        this.game.events.off(Phaser.Core.Events.HIDDEN, onBlur);
        Sound.engineStop();
      });
      Poki.gameplayStart();
    }
  }

  makeCars() {
    const c = G.career, slots = this.tr.slots;
    this.cars = [];
    let opp = this.offer.opp.slice();
    if (this.demo) opp = shuffle(DRIVERS.map(d => d.id)).slice(0, 4);
    const order = this.demo ? opp : [...opp];
    // player starts at the back of the grid (more action), except in the final
    const entries = order.map(id => {
      const def = driverDef(id), dd = c && c.drivers.find(x => x.id === id);
      // rivals' cars scale with the player's car so easy races stay easy
      const d = this.offer.diff, cap = this.demo ? 3 : d === 0 ? c.car : d === 1 ? c.car + 1 : d === 2 ? c.car + 2 : 3;
      const tier = Math.min(3, cap, dd ? dd.tier : def.tier), sk = def.skill;
      const lvl = Math.min(3, Math.floor(sk * 2.6 + d * 0.35));
      const stats = carStats(tier, { engine: lvl, tires: lvl, plating: Math.min(3, Math.floor(sk * 2.4)) }, Math.floor(sk * 2.5), 0.86 + sk * 0.12 + (d === 3 ? 0.04 : 0));
      if (def.vis !== undefined) stats.shape = def.vis;
      return { id, kit: id, name: def.name, color: def.color, stats, skill: sk, aggr: 0.3 + sk * 0.6, hp: stats.hp, ammo: 90 + Math.round(sk * 80), mines: sk > 0.6 ? 2 : 1, nitro: 1 + Math.round(sk * 2), invuln: this.demo };
    });
    if (!this.demo) {
      const stats = carStats(c.car, c.up, c.mg);
      entries.push({ id: 'player', name: t('you'), color: PLAYER_COLOR, stats, isPlayer: true, hp: c.hp, ammo: AMMO_BASE, mines: c.mines, nitro: c.nitro });
    }
    entries.forEach((e, i) => this.cars.push(new Car(this, e, slots[i])));
    this.player = this.cars.find(x => x.isPlayer) || null;
  }

  togglePause(force) {
    if (this.ended || this.demo) return;
    this.paused = force === true ? true : !this.paused;
    const hud = this.scene.get('hud');
    if (this.paused) { Poki.gameplayStop(); Sound.engineSet(0, 0); if (hud) hud.showPause(true); }
    else { Poki.gameplayStart(); if (hud) hud.showPause(false); }
  }

  msg(text, color = '#ffffff', big = false) { this.events.emit('msg', text, color, big); }

  // ---------------- main loop ----------------
  update(time, delta) {
    if (this.paused) return;
    const dt = Math.min(delta / 1000, 1 / 30);
    this.raceT += dt;
    if (this.count > 0) {
      this.count -= dt;
      const n = Math.ceil(this.count);
      if (n < this.lastBeep && n >= 1 && n <= 3) { this.lastBeep = n; Sound.play('beep'); this.events.emit('count', n); }
      if (this.count <= 0) { Sound.play('go'); this.events.emit('count', 0); }
    }
    const racing = this.count <= 0;
    for (const car of this.cars) {
      let ctl;
      if (car.dead || (car.finished && !car.isPlayer && !this.demo)) ctl = car.finished ? this.aiControl(car, dt, true) : { thr: 0, steer: 0 };
      else if (!racing) ctl = { thr: 0, steer: 0 };
      else if (car.isPlayer) ctl = car.finished ? this.aiControl(car, dt, true) : this.playerControl(car);
      else ctl = this.aiControl(car, dt, false);
      if (car.dead) ctl = { thr: 0, steer: 0 };
      this.physics(car, ctl, dt, racing);
      if (racing && !car.dead && !car.finished) this.weapons(car, ctl, dt);
    }
    this.collideCars();
    for (const car of this.cars) this.trackCar(car, dt);
    this.updateBullets(dt);
    this.updateMines(dt);
    this.updatePickups(dt);
    this.updateFires(dt);
    this.fx.update(dt); this.skids.update(dt);
    for (const car of this.cars) car.sync();
    this.updateCamera(dt);
    if (this.player) {
      const p = this.player;
      Sound.engineSet(p.dead ? 0 : Math.abs(p.fwd) / p.st.speed, this.count <= 0 && p.thr > 0 ? 1 : (this.count > 0 && this.count < 1.5 ? 1 : 0));
      if (p.marker) p.marker.setPosition(p.x, p.y).setAlpha(this.count > 0 ? 0.5 + Math.sin(this.raceT * 8) * 0.3 : 0).setScale(1.6);
    }
    if (!this.demo) this.checkEnd(dt);
  }

  playerControl(car) {
    const k = this.keys, tc = this.touch;
    let thr = 0, steer = 0;
    if (k.up.isDown || k.w.isDown) thr += 1;
    if (k.down.isDown || k.s.isDown) thr -= 1;
    if (tc.active) thr = tc.brake ? -1 : 1;
    if (k.left.isDown || k.a.isDown || tc.left) steer -= 1;
    if (k.right.isDown || k.d.isDown || tc.right) steer += 1;
    const mineNow = k.mine.isDown || k.mine2.isDown || tc.mine, nitroNow = k.nitro.isDown || k.nitro2.isDown || tc.nitro;
    const ctl = { thr, steer, fire: k.fire.isDown || k.fire2.isDown || tc.fire, mine: mineNow && !this.mineEdge, nitro: nitroNow && !this.nitroEdge };
    this.mineEdge = mineNow; this.nitroEdge = nitroNow;
    return ctl;
  }

  // ---------------- physics ----------------
  physics(car, ctl, dt, racing) {
    const st = car.st, ca = Math.cos(car.a), sa = Math.sin(car.a);
    let vf = car.vx * ca + car.vy * sa, vl = -car.vx * sa + car.vy * ca;
    car.thr = ctl.thr;
    if (car.flashT > 0) car.flashT -= dt;
    if (car.nitroT > 0) car.nitroT -= dt;
    const nitro = car.nitroT > 0;
    const off = car.offroad;
    let maxS = st.speed * (off ? 0.58 : 1) * (nitro ? 1.38 : 1) * (car.hp / car.maxHp < 0.25 ? 0.9 : 1);
    if (car.dead) maxS = 0;
    const acc = st.accel * (nitro ? 1.7 : 1) * (off ? 0.75 : 1);
    if (nitro && ctl.thr >= 0) ctl.thr = 1;
    if (ctl.thr > 0) {
      if (vf < maxS) vf = Math.min(maxS, vf + acc * ctl.thr * dt * (vf < 0 ? 2.2 : 1) * (1 - 0.35 * Math.max(0, vf) / maxS));
      else vf -= (vf - maxS) * 2.5 * dt;
    } else if (ctl.thr < 0) {
      if (vf > 15) vf -= 620 * dt;
      else vf = Math.max(-st.speed * 0.38, vf - acc * 0.7 * dt);
    } else {
      const roll = (car.dead ? 420 : 110) * dt; vf = Math.abs(vf) <= roll ? 0 : vf - Math.sign(vf) * roll;
      if (vf > maxS) vf -= (vf - maxS) * 2.5 * dt;
    }
    if (off) vf -= vf * 0.6 * dt;
    // lateral grip
    const grip = st.grip * this.tr.grip * (off ? 0.75 : 1) * (car.dead ? 3 : 1);
    vl *= Math.exp(-grip * dt);
    // steering
    const spd = Math.abs(vf);
    const turnK = st.turn * clamp(spd / 110, 0, 1) * (1 - 0.28 * clamp(spd / st.speed, 0, 1.3)) * (vf >= 0 ? 1 : -1);
    car.a += ctl.steer * turnK * dt + car.spin * dt;
    car.spin *= Math.exp(-5 * dt);
    const ca2 = Math.cos(car.a), sa2 = Math.sin(car.a);
    car.vx = ca2 * vf - sa2 * vl; car.vy = sa2 * vf + ca2 * vl;
    car.x += car.vx * dt; car.y += car.vy * dt;
    car.fwd = vf; car.lat = vl;
    // effects: skids, dust, smoke, nitro flame
    car.skidT -= dt;
    const sliding = Math.abs(vl) > 95 || (ctl.thr < 0 && vf > 120) || (ctl.thr > 0 && vf < 60 && vf > 0 && racing && acc > 0 && car.raceStartBoost);
    if (sliding && car.skidT <= 0 && !off && !car.dead) {
      car.skidT = 0.028;
      for (const sd of [-1, 1]) this.skids.add(car.x - ca2 * 13 - sa2 * 9 * sd, car.y - sa2 * 13 + ca2 * 9 * sd, car.a, 0.42);
      if (car.isPlayer && Math.abs(vl) > 140) Sound.play('skid', 0.6);
    }
    car.smokeT -= dt;
    if (car.smokeT <= 0) {
      car.smokeT = 0.05;
      if (off && spd > 60 && !car.dead) for (const sd of [-1, 1]) this.skids.add(car.x - ca2 * 13 - sa2 * 9 * sd, car.y - sa2 * 13 + ca2 * 9 * sd, car.a, 0.3, 0x8a6040);
      if (off && spd > 70) {
        const dust = this.dustCol;
        this.fx.spawn('smoke', car.x - ca2 * 18 + rnd(-6, 6), car.y - sa2 * 18 + rnd(-6, 6), { tint: dust, life: 0.9, s0: 0.35, s1: 1.1, a0: 0.55, vx: -car.vx * 0.1 + rnd(-15, 15), vy: -car.vy * 0.1 + rnd(-15, 15), depth: 9 });
      }
      const hpf = car.hp / car.maxHp;
      if (car.dead || hpf < 0.45) {
        this.fx.spawn('smoke', car.x + ca2 * 10 + rnd(-4, 4), car.y + sa2 * 10 + rnd(-4, 4), { tint: car.dead || hpf < 0.2 ? 0x222222 : 0x777777, life: car.dead ? 1.8 : 1.1, s0: 0.3, s1: car.dead ? 1.6 : 1.0, a0: car.dead ? 0.7 : 0.45, vx: rnd(-10, 10) + 25, vy: rnd(-10, 10) - 30, depth: 22 });
        if ((car.dead && car.raceDeadFire > this.raceT) || (!car.dead && hpf < 0.2 && Math.random() < 0.5))
          this.fx.spawn('soft', car.x + ca2 * 8 + rnd(-5, 5), car.y + sa2 * 8 + rnd(-5, 5), { tint: pick([0xff7a1a, 0xffb02a, 0xff4a10]), add: true, life: 0.35, s0: 0.45, s1: 0.1, a0: 0.9, vy: -40, depth: 21 });
      }
    }
    if (!car.dead) {
      // exhaust: dark puffs on throttle, road dust on sandy tracks, backfire when lifting off at speed
      const ex = car.x - ca2 * 25, ey = car.y - sa2 * 25 - 4 * VIEW_K;
      if (ctl.thr > 0 && Math.random() < 0.3) this.fx.spawn('smoke', ex, ey, { tint: 0x2a2622, life: 0.7, s0: 0.16, s1: 0.5, a0: 0.42, vx: -ca2 * 40 + rnd(-10, 10), vy: -sa2 * 40 - 14, depth: 9 });
      if (this.tr.theme.sand && !off && spd > 170 && Math.random() < 0.35)
        this.fx.spawn('smoke', car.x - ca2 * 20 + rnd(-8, 8), car.y - sa2 * 20 + rnd(-8, 8), { tint: this.dustCol, life: 0.9, s0: 0.3, s1: 1.1, a0: 0.28, vx: -car.vx * 0.12, vy: -car.vy * 0.12, depth: 9 });
      if (car.prevThr > 0 && ctl.thr <= 0 && vf > 180 && Math.random() < 0.55) {
        for (let k = 0; k < 4; k++) this.fx.spawn('soft', ex, ey, { tint: pick([0xffd040, 0xff7a1a, 0x5ab0ff]), add: true, life: 0.14, s0: 0.42, s1: 0.1, a0: 1, vx: -ca2 * rnd(90, 200), vy: -sa2 * rnd(90, 200), depth: 12 });
        this.sfx('backfire', car, 0.8);
      }
    }
    car.prevThr = ctl.thr;
    if (nitro) {
      for (const sd of [-1, 1]) this.fx.spawn('soft', car.x - ca2 * 24 - sa2 * 5 * sd, car.y - sa2 * 24 + ca2 * 5 * sd, { tint: Math.random() < 0.5 ? 0x4ab8ff : 0xffa030, add: true, life: 0.18, s0: 0.38, s1: 0.08, a0: 0.95, vx: -ca2 * 200 + car.vx * 0.6, vy: -sa2 * 200 + car.vy * 0.6, depth: 9 });
    }
  }

  // progress, laps, walls, offroad
  trackCar(car, dt) {
    const tr = this.tr, n = nearest(tr, car.x, car.y, car.idx, 30);
    const lim = WALL - 10;
    if (n.d > lim) {
      const nx = (car.x - n.qx) / n.d, ny = (car.y - n.qy) / n.d;
      car.x = n.qx + nx * lim; car.y = n.qy + ny * lim;
      const vn = car.vx * nx + car.vy * ny;
      if (vn > 0) {
        car.vx -= nx * vn * 1.45; car.vy -= ny * vn * 1.45;
        car.vx *= 0.9; car.vy *= 0.9;
        // spin away from wall based on hit angle
        const ca = Math.cos(car.a), sa = Math.sin(car.a);
        car.spin += clamp((ca * ny - sa * nx) * vn * -0.012, -2.5, 2.5);
        if (vn > 60) {
          if (!car.invuln) this.damage(car, (vn - 95) * 0.03, null);
          this.sparks(car.x + nx * 14, car.y + ny * 14, Math.atan2(-ny, -nx), Math.min(10, vn / 30));
          this.sfx('thud', car, Math.min(1, vn / 300));
        }
      }
      n.d = lim;
    }
    car.offroad = n.d > HW + 6;
    car.d = n.d; car.side = n.side;
    const ds = n.s - car.s;
    if (ds < -tr.len / 2) car.lapRaw++;
    else if (ds > tr.len / 2) car.lapRaw--;
    car.idx = n.i; car.s = n.s;
    if (!car.dead) {
      const prevLap = Math.floor(car.total / tr.len);
      car.total = car.lapRaw * tr.len + car.s;
      const lap = Math.floor(car.total / tr.len);
      if (!this.demo && !car.finished && car.total >= this.offer.laps * tr.len) {
        car.finished = true; car.finishOrder = ++this.finishCount; car.finishT = this.raceT;
        if (car.isPlayer) { this.msg(t('finish'), '#ffe14a', true); Sound.play(car.finishOrder === 1 ? 'win' : 'lap'); }
      } else if (car.isPlayer && lap > prevLap && lap >= 1) {
        Sound.play('lap');
        if (lap === this.offer.laps - 1) this.msg(t('lastLap'), '#ff9a3a', true);
      }
      // wrong way detection for the player
      if (car.isPlayer && this.count <= 0) {
        const dot = Math.cos(car.a) * tr.TX[car.idx] + Math.sin(car.a) * tr.TY[car.idx];
        car.wrongT = dot < -0.3 && car.speed > 60 ? car.wrongT + dt : 0;
      }
    }
  }

  collideCars() {
    const C = this.cars, R2 = CAR_R * 2;
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
      const a = C[i], b = C[j];
      if (Math.abs(a.x - b.x) > 60 || Math.abs(a.y - b.y) > 60) continue;
      const fa = [Math.cos(a.a), Math.sin(a.a)], fb = [Math.cos(b.a), Math.sin(b.a)];
      let best = null;
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
        const ax = a.x + fa[0] * CAR_OFF * sa, ay = a.y + fa[1] * CAR_OFF * sa, bx = b.x + fb[0] * CAR_OFF * sb, by = b.y + fb[1] * CAR_OFF * sb;
        const dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy;
        if (d2 < R2 * R2 && (!best || d2 < best.d2)) best = { d2, dx, dy, ax, ay, bx, by };
      }
      if (!best) continue;
      const d = Math.sqrt(best.d2) || 0.01, nx = best.dx / d, ny = best.dy / d, ov = R2 - d;
      const ma = a.dead ? 3 : a.st.mass, mb = b.dead ? 3 : b.st.mass, tot = ma + mb;
      a.x -= nx * ov * mb / tot; a.y -= ny * ov * mb / tot;
      b.x += nx * ov * ma / tot; b.y += ny * ov * ma / tot;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const J = -(1 + 0.35) * vn / (1 / ma + 1 / mb);
        a.vx -= J / ma * nx; a.vy -= J / ma * ny; b.vx += J / mb * nx; b.vy += J / mb * ny;
        // spin from off-center contact
        const cx = (best.ax + best.bx) / 2, cy = (best.ay + best.by) / 2;
        const ta = ((cx - a.x) * -ny - (cy - a.y) * -nx), tb = ((cx - b.x) * ny - (cy - b.y) * nx);
        a.spin += clamp(ta * J * 0.00009 / ma, -2, 2); b.spin += clamp(tb * J * 0.00009 / mb, -2, 2);
        const imp = -vn;
        if (imp > 80) {
          const dmg = (imp - 105) * 0.028;
          if (!a.invuln) this.damage(a, dmg * mb / ma, b);
          if (!b.invuln) this.damage(b, dmg * ma / mb, a);
          this.sparks(cx, cy, Math.atan2(ny, nx) + Math.PI / 2, Math.min(12, imp / 25));
          this.sfx('crash', a.isPlayer || b.isPlayer ? this.player : a, Math.min(1, imp / 260));
        }
      }
    }
  }

  // ---------------- AI ----------------
  aiControl(car, dt, cruise) {
    const tr = this.tr, N = tr.N, sp = car.fwd, st = car.st;
    // lane wander + avoidance
    car.laneT -= dt;
    if (car.laneT <= 0) { car.laneTarget = rnd(-0.42, 0.42) * HW; car.laneT = rnd(1.2, 3.5); }
    const ca = Math.cos(car.a), sa = Math.sin(car.a);
    let target = null, tBest = 1e9;
    for (const o of this.cars) {
      if (o === car || o.dead) continue;
      const rx = o.x - car.x, ry = o.y - car.y, ah = rx * ca + ry * sa, lt = -rx * sa + ry * ca;
      if (o.finished) { if (ah > 0 && ah < 100 && Math.abs(lt) < 28 && !cruise) { car.laneTarget = clamp(car.side + (lt > 0 ? -46 : 46), -HW * 0.62, HW * 0.62); car.laneT = 0.7; } continue; }
      if (ah > 0 && ah < 100 && Math.abs(lt) < 28 && !cruise) {
        car.laneTarget = clamp(car.side + (lt > 0 ? -46 : 46), -HW * 0.62, HW * 0.62); car.laneT = 0.7;
      }
      if (ah > 40 && ah < 420 && ah < tBest && (o.isPlayer || Math.random() < 0.6)) { tBest = ah; target = o; }
    }
    // steer around mines (skilled drivers see them earlier)
    if (!cruise) for (const m of this.mines) {
      const rx = m.x - car.x, ry = m.y - car.y, ah = rx * ca + ry * sa, lt = -rx * sa + ry * ca;
      if (ah > 0 && ah < 90 + car.skill * 120 && Math.abs(lt) < 34 && Math.random() < 0.4 + car.skill * 0.6) {
        car.laneTarget = clamp(car.side + (lt > 0 ? -55 : 55), -HW * 0.7, HW * 0.7); car.laneT = 0.8;
      }
    }
    // aggressive drivers line up behind a target to shoot it
    if (target && !cruise && car.ammo > 0 && car.aggr > 0.45 && car.laneT > 0.8) car.laneTarget = clamp(target.side, -HW * 0.6, HW * 0.6);
    car.lane += (car.laneTarget - car.lane) * (1 - Math.exp(-2.2 * dt));
    const look = Math.floor(7 + Math.max(0, sp) / 26);
    const ti = (car.idx + look) % N;
    const tx = tr.P[ti].x - tr.TY[ti] * car.lane, ty = tr.P[ti].y + tr.TX[ti] * car.lane;
    const diff = angDiff(car.a, Math.atan2(ty - car.y, tx - car.x));
    let steer = clamp(diff * 2.8, -1, 1);
    // speed for the curvature ahead
    let turn = 0;
    const reach = 8 + Math.floor(Math.max(0, sp) / 13);
    for (let k = 6; k <= reach; k += 3) turn = Math.max(turn, Math.abs(angDiff(tr.A[car.idx], tr.A[(car.idx + k) % N])));
    const caution = 0.5 - car.skill * 0.18;
    let tSpeed = st.speed * clamp(1.06 - turn * caution, 0.4, 1);
    if (cruise) tSpeed *= 0.55;
    let thr = sp < tSpeed ? 1 : sp > tSpeed + 45 ? -0.7 : 0.15;
    if (car.offroad && Math.abs(diff) < 0.6) thr = 1;
    // stuck recovery
    if (this.count <= 0 && Math.abs(sp) < 30 && car.revT <= 0) car.stuckT += dt; else car.stuckT = Math.max(0, car.stuckT - dt * 2);
    if (car.stuckT > 1.2) { car.revT = 0.9; car.stuckT = 0; car.stuckN = (car.stuckN || 0) + 1; }
    if (car.revT > 0) { car.revT -= dt; thr = -1; steer = -Math.sign(diff || 1); }
    if (Math.abs(diff) > 2.2 && car.revT <= 0 && sp < 60) { thr = -1; steer = -Math.sign(diff); }
    if (car.stuckN > 4) this.respawnCar(car);
    if (Math.abs(sp) > 80) car.stuckN = 0;
    const ctl = { thr, steer, fire: false, mine: false, nitro: false };
    if (cruise) return ctl;
    // weapons
    car.burstT -= dt;
    if (target && car.ammo > 0) {
      const rx = target.x - car.x, ry = target.y - car.y, dist = Math.hypot(rx, ry);
      const cosA = (rx * ca + ry * sa) / (dist || 1);
      if (dist < 360 && cosA > 0.982 && Math.random() < car.aggr * dt * 4) car.burstT = rnd(0.2, 0.5);
    }
    ctl.fire = car.burstT > 0;
    car.mineCd -= dt;
    if (car.mines > 0 && car.mineCd <= 0 && this.raceT > 12) {
      for (const o of this.cars) {
        if (o === car || o.dead || o.finished) continue;
        const rx = o.x - car.x, ry = o.y - car.y, ah = rx * ca + ry * sa, lt = -rx * sa + ry * ca;
        if (ah < -40 && ah > -200 && Math.abs(lt) < 40 && Math.random() < car.aggr * 0.3) { ctl.mine = true; car.mineCd = rnd(6, 11); break; }
      }
      if (!ctl.mine) car.mineCd = 0.4;
    }
    if (car.nitro > 0 && car.nitroT <= 0 && turn < 0.18 && sp > st.speed * 0.55 && Math.random() < dt * (0.12 + car.skill * 0.35)) ctl.nitro = true;
    return ctl;
  }

  respawnCar(car) {
    const tr = this.tr, i = car.idx;
    car.x = tr.P[i].x; car.y = tr.P[i].y; car.a = tr.A[i]; car.vx = car.vy = 0; car.spin = 0; car.stuckN = 0; car.revT = 0;
    this.fx.spawn('ring', car.x, car.y, { s0: 0.1, s1: 0.6, a0: 0.8, life: 0.4, tint: 0xffffff });
  }

  // ---------------- weapons ----------------
  weapons(car, ctl, dt) {
    car.fireCd -= dt;
    const ca = Math.cos(car.a), sa = Math.sin(car.a);
    if (ctl.fire && car.ammo > 0 && car.fireCd <= 0) {
      car.fireCd = FIRE_GAP; car.ammo--;
      const spread = car.isPlayer ? 0.035 : 0.035 + (1 - car.skill) * 0.07;
      const a = car.a + rnd(-spread, spread), gx = car.x + ca * (car.gunX + 1), gy = car.y + sa * (car.gunX + 1);
      const hz = car.gunZ * VIEW_K, my = gy - hz;
      this.bullets.push({ x: gx, y: gy, px: gx, py: gy, vx: Math.cos(a) * BULLET_SPEED + car.vx, vy: Math.sin(a) * BULLET_SPEED + car.vy, life: BULLET_LIFE, owner: car, dmg: car.st.mgDmg, hz, tr: car.shots % 2 === 0 });
      car.shots++;
      // muzzle flash: glow + star + flame tongue
      this.fx.spawn('soft', gx, my, { tint: 0xffe08a, add: true, life: 0.07, s0: 0.85, s1: 0.3, a0: 1, depth: 13 });
      this.fx.spawn('spark', gx + ca * 8, my + sa * 8, { tint: 0xfff2c0, add: true, life: 0.05, s0: 0.9, s1: 0.6, sx: 1.8, rot: car.a, a0: 1, depth: 13 });
      this.fx.spawn('spark', gx, my, { tint: 0xffa040, add: true, life: 0.05, s0: 0.5, s1: 0.3, sx: 1.2, rot: car.a + Math.PI / 2 * (car.shots % 2 ? 1 : -1) * 0.6, a0: 0.9, depth: 13 });
      this.fx.spawn('soft', gx + ca * 12, gy + sa * 12, { tint: 0xffa040, add: true, life: 0.07, s0: 2.2, s1: 1.6, a0: 0.26, depth: 2 });
      if (car.shots % 3 === 0) this.fx.spawn('smoke', gx, my, { tint: 0x8a8278, life: 0.5, s0: 0.12, s1: 0.45, a0: 0.35, vx: car.vx * 0.6 + ca * 40, vy: car.vy * 0.6 + sa * 40 - 20, depth: 13 });
      // ejected brass casing
      const ex = car.x + ca * (car.gunX - 8), ey = car.y + sa * (car.gunX - 8) - hz, side = rnd(150, 230);
      this.fx.spawn('px', ex, ey, { tint: 0xe0b44a, life: 0.45, s0: 0.75, s1: 0.6, sx: 1.8, a0: 1, a1: 0.6, vx: car.vx * 0.85 - sa * side, vy: car.vy * 0.85 + ca * side - 60, drag: 4, vr: rnd(-25, 25), depth: 12 });
      if (car.isPlayer && car.shots % 4 === 0) this.cameras.main.shake(70, 0.0016);
      this.sfx('gun', car, car.isPlayer ? 0.85 : 0.6);
    }
    if (ctl.mine && car.mines > 0) {
      car.mines--;
      const mx = car.x - ca * 30, my = car.y - sa * 30;
      const spr = this.add.image(mx, my, 'mine').setDepth(3).setScale(0.8);
      const led = this.add.image(mx, my, 'soft').setDepth(3.1).setTint(0xff2020).setBlendMode(Phaser.BlendModes.ADD).setScale(0.22);
      this.mines.push({ x: mx, y: my, owner: car, age: 0, spr, led });
      this.sfx('mine', car, 0.8);
      if (this.mines.length > 24) this.removeMine(this.mines[0]);
    }
    if (ctl.nitro && car.nitro > 0 && car.nitroT <= 0) { car.nitro--; car.nitroT = 2.2; this.sfx('nitro', car, 0.9); }
  }

  updateBullets(dt) {
    const g = this.bulletG; g.clear();
    const B = this.bullets;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let hit = null;
      for (const c of this.cars) {
        if (c === b.owner || c.finished) continue;       // finished cars are out of the fight
        if (Math.abs(c.x - b.x) > 50 || Math.abs(c.y - b.y) > 50) continue;
        const sx = b.x - b.px, sy = b.y - b.py, l2 = sx * sx + sy * sy || 1;
        const u = clamp(((c.x - b.px) * sx + (c.y - b.py) * sy) / l2, 0, 1);
        const qx = b.px + sx * u, qy = b.py + sy * u;
        const ca = Math.cos(c.a), sa = Math.sin(c.a), rx = qx - c.x, ry = qy - c.y;
        const lx = rx * ca + ry * sa, ly = -rx * sa + ry * ca;
        if ((lx * lx) / (24 * 24) + (ly * ly) / (13 * 13) < 1) { hit = { c, x: qx, y: qy }; break; }
      }
      if (hit) {
        if (!hit.c.dead && !hit.c.invuln) this.damage(hit.c, b.dmg, b.owner);
        hit.c.vx += b.vx * 0.006; hit.c.vy += b.vy * 0.006;
        this.bulletImpact(hit.x, hit.y - 8 * VIEW_K, Math.atan2(-b.vy, -b.vx), true);
        this.sfx('hit', hit.c, 0.8);
        B[i] = B[B.length - 1]; B.pop(); continue;
      }
      if (b.life <= 0) {
        const n = nearest(this.tr, b.x, b.y);
        if (n.d > WALL - 4) { this.bulletImpact(b.x, b.y - 6 * VIEW_K, Math.atan2(-b.vy, -b.vx), false); if (Math.random() < 0.25) this.sfx('ricochet', b, 0.5); }
        else this.fx.spawn('smoke', b.x, b.y, { tint: this.dustCol, life: 0.5, s0: 0.12, s1: 0.4, a0: 0.5, vy: -20, depth: 9 });
        B[i] = B[B.length - 1]; B.pop(); continue;
      }
      // glowing tracer (every other round), plain streak otherwise
      const al = Math.min(1, b.life * 5), x0 = b.x - b.vx * 0.03, y0 = b.y - b.vy * 0.03 - b.hz, y1 = b.y - b.hz;
      if (b.tr) {
        g.lineStyle(7, 0xff8a20, 0.22 * al); g.lineBetween(x0, y0, b.x, y1);
        g.lineStyle(3.2, 0xffd060, 0.75 * al); g.lineBetween(x0, y0, b.x, y1);
        g.lineStyle(1.4, 0xffffff, al); g.lineBetween(b.x - b.vx * 0.014, b.y - b.vy * 0.014 - b.hz, b.x, y1);
      } else { g.lineStyle(1.6, 0xffe9a0, 0.55 * al); g.lineBetween(b.x - b.vx * 0.018, b.y - b.vy * 0.018 - b.hz, b.x, y1); }
    }
  }

  bulletImpact(x, y, dir, onCar) {
    this.fx.spawn('soft', x, y, { tint: onCar ? 0xfff0c0 : 0xffd080, add: true, life: 0.08, s0: onCar ? 0.75 : 0.5, s1: 0.2, a0: 1, depth: 24 });
    this.sparks(x, y, dir, onCar ? 7 : 4);
    for (let k = 0; k < (onCar ? 2 : 1); k++) {
      const a = dir + rnd(-1.2, 1.2), v = rnd(60, 160);
      this.fx.spawn('px', x, y, { tint: onCar ? 0x2a2622 : 0x6a5a4a, life: rnd(0.3, 0.5), s0: rnd(0.5, 0.9), s1: 0.4, a0: 1, a1: 0.8, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, drag: 3, vr: rnd(-20, 20), depth: 21 });
    }
    this.fx.spawn('smoke', x, y, { tint: onCar ? 0x3a3530 : this.dustCol, life: 0.45, s0: 0.12, s1: 0.45, a0: 0.45, vy: -18, depth: 21 });
  }

  updateMines(dt) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i]; m.age += dt;
      m.led.setAlpha(Math.sin(m.age * 10) > 0 ? 1 : 0.15);
      let boom = false;
      for (const c of this.cars) {
        if (c.dead || c.finished) continue;
        if (c === m.owner && m.age < 1.2) continue;
        if (m.age < 0.25) continue;
        if (Math.hypot(c.x - m.x, c.y - m.y) < 24) { boom = true; break; }
      }
      if (m.age > 45) boom = true;
      if (boom) this.explodeMine(m);
    }
  }
  removeMine(m) { m.spr.destroy(); m.led.destroy(); const k = this.mines.indexOf(m); if (k >= 0) this.mines.splice(k, 1); }
  explodeMine(m) {
    this.removeMine(m);
    this.explosion(m.x, m.y, 0.8);
    for (const c of this.cars) {
      const dx = c.x - m.x, dy = c.y - m.y, d = Math.hypot(dx, dy);
      if (d > 60) continue;
      const f = 1 - d / 60;
      if (!c.dead && !c.invuln) this.damage(c, 14 * f + 6, m.owner);
      c.vx += dx / (d || 1) * 320 * f; c.vy += dy / (d || 1) * 320 * f; c.spin += rnd(-4, 4) * f;
    }
  }

  damage(car, amount, src) {
    if (car.dead || car.finished || amount <= 0) return;
    car.hp -= amount;
    if (src && src !== car) { car.lastHit = src; car.lastHitT = this.raceT; }
    if (car.isPlayer) this.events.emit('hurt', amount);
    car.flashT = 0.07;
    if (car.hp <= 0) this.destroyCar(car);
  }

  destroyCar(car) {
    car.hp = 0; car.dead = true; car.deadAt = ++this.deaths; car.raceDeadFire = this.raceT + 5;

    this.explosion(car.x, car.y, 1.4);
    const killer = car.lastHit && this.raceT - car.lastHitT < 5 ? car.lastHit : null;
    if (killer && !killer.dead) {
      killer.kills++;
      if (killer.isPlayer) {
        const b = BOUNTY[this.offer.diff];
        this.playerBounty += b;
        this.msg(t('kill', car.name, money(b)), '#7dff6a', true);
        Sound.play('cash');
      }
    }
    if (car.isPlayer) { this.msg(t('wrecked'), '#ff4a3a', true); this.endT = 3; Sound.engineSet(0, 0); }
  }

  explosion(x, y, size) {
    this.fx.spawn('soft', x, y, { tint: 0xfff1c0, add: true, life: 0.25, s0: 1.2 * size, s1: 3.2 * size, a0: 1, depth: 24 });
    this.fx.spawn('ring', x, y, { tint: 0xffc070, add: true, life: 0.45, s0: 0.15, s1: 1.3 * size, a0: 0.8, depth: 24 });
    for (let k = 0; k < 18 * size; k++) {
      const a = rnd(0, Math.PI * 2), v = rnd(60, 260) * size;
      this.fx.spawn('soft', x, y, { tint: pick([0xff8a1a, 0xffc040, 0xff4a10]), add: true, life: rnd(0.3, 0.7), s0: rnd(0.5, 1) * size, s1: 0.1, a0: 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 4, depth: 23 });
      if (k % 2 === 0) this.fx.spawn('smoke', x, y, { tint: 0x2a2a2a, life: rnd(1.2, 2.2), s0: 0.6 * size, s1: 2.2 * size, a0: 0.7, vx: Math.cos(a) * v * 0.3, vy: Math.sin(a) * v * 0.3, drag: 2, depth: 22, vr: rnd(-1, 1) });
      if (k % 3 === 0) this.fx.spawn('px', x, y, { tint: 0x333333, life: rnd(0.5, 0.9), s0: rnd(1, 2), s1: 0.8, a0: 1, a1: 1, vx: Math.cos(a) * v * 1.4, vy: Math.sin(a) * v * 1.4, drag: 3, vr: rnd(-10, 10), depth: 21 });
    }
    this.add.image(x, y, 'soft').setTint(0x000000).setAlpha(0.55).setScale(1.6 * size).setDepth(1);
    const p = this.player || this.camTarget, d = p ? Math.hypot(p.x - x, p.y - y) : 0;
    if (d < 700) { this.cameras.main.shake(260, 0.012 * size * (1 - d / 700)); }
    Sound.play('boom', this.demo ? 0 : clamp(1 - d / 900, 0.1, 1));
  }

  sparks(x, y, dir, n) {
    for (let k = 0; k < n; k++) {
      const a = dir + rnd(-0.9, 0.9), v = rnd(120, 380);
      this.fx.spawn('spark', x, y, { tint: pick([0xffe08a, 0xffffff, 0xffb040]), add: true, life: rnd(0.12, 0.3), s0: rnd(0.4, 0.8), s1: 0.1, a0: 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: a, drag: 3, depth: 21 });
    }
  }

  sfx(name, src, v) {
    if (this.demo) return;
    const p = this.player; if (!p) return;
    const d = src ? Math.hypot(src.x - p.x, src.y - p.y) : 0;
    Sound.play(name, v * clamp(1 - d / 900, 0, 1));
  }

  updateFires(dt) {
    this.fireT -= dt;
    if (this.fireT > 0 || !this.tr.fires.length) return;
    this.fireT = 0.055;
    const v = this.cameras.main.worldView;
    for (const f of this.tr.fires) {
      if (f.x < v.x - 80 || f.x > v.right + 80 || f.y < v.y - 40 || f.y > v.bottom + 140) continue;
      const fy = f.y - f.z * VIEW_K;
      this.fx.spawn('soft', f.x + rnd(-3, 3) * f.s, fy, { tint: pick([0xffd040, 0xff8a1a, 0xff5a10]), add: true, life: rnd(0.35, 0.6), s0: 0.34 * f.s, s1: 0.06, a0: 0.9, vx: rnd(-8, 8), vy: -rnd(40, 70), depth: 9.8 });
      if (f.big && Math.random() < 0.5) this.fx.spawn('soft', f.x + rnd(-6, 6), fy - rnd(0, 8), { tint: pick([0xff7a1a, 0xff4a10]), add: true, life: rnd(0.4, 0.7), s0: 0.5 * f.s, s1: 0.1, a0: 0.8, vx: rnd(-10, 10), vy: -rnd(50, 90), depth: 9.8 });
      if (Math.random() < (f.big ? 0.4 : 0.15)) this.fx.spawn('smoke', f.x + rnd(-4, 4), fy - 12, { tint: f.big ? 0x141210 : 0x221d18, life: f.big ? 2.8 : 1.8, s0: 0.3 * f.s, s1: (f.big ? 1.9 : 1.1) * f.s, a0: f.big ? 0.5 : 0.3, vx: rnd(10, 26), vy: -rnd(28, 45), vr: rnd(-0.5, 0.5), depth: 21 });
    }
  }

  // ---------------- pickups ----------------
  spawnPickup(initial) {
    const tr = this.tr;
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(rnd(0.08, 0.95) * tr.N), lat = rnd(-HW + 22, HW - 22);
      const x = tr.P[i].x - tr.TY[i] * lat, y = tr.P[i].y + tr.TX[i] * lat;
      if (this.pickups.some(p => Math.hypot(p.x - x, p.y - y) < 300)) continue;
      const r = Math.random(), type = r < 0.38 ? 'cash' : r < 0.62 ? 'ammo' : r < 0.84 ? 'fix' : 'nitro';
      const spr = this.add.image(x, y - 14 * VIEW_K, 'pk_' + type).setDepth(9 + y * 1e-4).setScale(initial ? 0.8 : 0.01);
      const shd = this.add.image(x + 6, y + 4, 'soft').setTint(0x000000).setAlpha(0.35).setScale(0.55).setDepth(3);
      if (!initial) this.tweens.add({ targets: spr, scale: 0.8, duration: 400, ease: 'Back.Out' });
      this.pickups.push({ x, y, type, spr, shd, t: Math.random() * 6 });
      return;
    }
  }
  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]; p.t += dt;
      const sc = 0.8 + Math.sin(p.t * 4) * 0.05;
      p.spr.setScale(sc, sc / VIEW_IY).setY(p.y - (14 + Math.sin(p.t * 3) * 4) * VIEW_K);
      let taker = null;
      for (const c of this.cars) if (!c.dead && !c.finished && Math.hypot(c.x - p.x, c.y - p.y) < 30) { taker = c; break; }
      if (!taker) continue;
      this.applyPickup(taker, p.type);
      p.spr.destroy(); p.shd.destroy(); this.pickups.splice(i, 1);
      this.fx.spawn('ring', p.x, p.y, { tint: 0xffffff, add: true, life: 0.35, s0: 0.15, s1: 0.6, a0: 0.9, depth: 20 });
      this.time.delayedCall(rnd(5000, 9000), () => { if (!this.ended && this.sys.isActive()) this.spawnPickup(false); });
    }
  }
  applyPickup(c, type) {
    if (type === 'cash') {
      if (c.isPlayer) { const v = Math.round(rnd(40, 90) * [1, 1.6, 2.4, 3][this.offer.diff] / 5) * 5; this.playerCash += v; this.msg('+' + money(v), '#7dff6a'); Sound.play('cash'); }
    } else if (type === 'ammo') {
      c.ammo = Math.min(AMMO_MAX, c.ammo + 45); if (c.isPlayer) { this.msg(t('pkAmmo'), '#ffd36a'); Sound.play('pickup'); }
    } else if (type === 'fix') {
      c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.25); if (c.isPlayer) { this.msg(t('pkFix'), '#6ab4ff'); Sound.play('pickup'); }
    } else if (type === 'nitro') {
      c.nitro = Math.min(NITRO_MAX, c.nitro + 1); if (c.isPlayer) { this.msg(t('pkNitro'), '#ff6ad8'); Sound.play('pickup'); }
    }
  }

  // ---------------- camera ----------------
  updateCamera(dt) {
    let f = this.player;
    if (this.demo) {
      this.camSwitch -= dt;
      if (this.camSwitch <= 0) { this.camSwitch = 9; this.camTarget = pick(this.cars); }
      f = this.camTarget;
    }
    if (!f) return;
    if (!this.demo) {
      const sr = clamp(Math.hypot(f.vx, f.vy) / f.st.speed, 0, 1.4), zt = CAM_ZOOM * (1 - 0.07 * sr - (f.nitroT > 0 ? 0.05 : 0));
      this.zoomNow = (this.zoomNow || CAM_ZOOM) + (zt - (this.zoomNow || CAM_ZOOM)) * (1 - Math.exp(-2.2 * dt));
      this.cameras.main.setZoom(this.zoomNow, this.zoomNow * VIEW_IY);
    }
    const tx = f.x + f.vx * 0.36, ty = f.y + f.vy * 0.36;
    const k = 1 - Math.exp(-(this.demo ? 2 : 5) * dt);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    this.cameras.main.centerOn(this.camX, this.camY);
  }

  // ---------------- ranking & end ----------------
  ranking() {
    return this.cars.slice().sort((a, b) => {
      const ka = a.finished ? 0 : a.dead ? 2 : 1, kb = b.finished ? 0 : b.dead ? 2 : 1;
      if (ka !== kb) return ka - kb;
      if (ka === 0) return a.finishOrder - b.finishOrder;
      if (ka === 2) return b.deadAt - a.deadAt;
      return b.total - a.total;
    });
  }

  checkEnd(dt) {
    const p = this.player;
    if (this.ended || !p) return;
    if (this.endT < 0 && p.finished) {
      const anyLeft = this.cars.some(c => !c.isPlayer && !c.dead && !c.finished);
      this.endT = anyLeft ? 5 : 2.2;
    }
    if (this.endT >= 0) {
      this.endT -= dt;
      if (p.finished && this.endT > 2 && this.cars.every(c => c.dead || c.finished)) this.endT = 2;
      if (this.endT <= 0) this.finishRace(false);
    }
  }

  finishRace(forfeit) {
    if (this.ended) return;
    this.ended = true;
    Poki.gameplayStop();
    Sound.engineStop();
    const order = this.ranking(), d = this.offer.diff;
    const rows = order.map((c, i) => {
      const placed = !c.dead && !(forfeit && c.isPlayer);
      return { id: c.id, name: c.name, color: c.color, isPlayer: c.isPlayer, dead: c.dead, place: i + 1,
        kills: c.kills, prize: placed ? PRIZES[d][i] : 0, points: placed ? POINTS[d][i] : 0, finished: c.finished };
    });
    if (forfeit) { const pr = rows.find(r => r.isPlayer); pr.prize = 0; pr.points = 0; }
    const p = this.player;
    const res = { offer: this.offer, rows, cash: forfeit ? 0 : this.playerCash, bounty: forfeit ? 0 : this.playerBounty,
      hp: p.dead ? Math.round(p.maxHp * 0.12) : Math.max(1, Math.round(p.hp)), mines: p.mines, nitro: p.nitro, dead: p.dead, forfeit };
    this.scene.stop('hud');
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(380, () => this.scene.start('results', res));
  }
}

// ============================================================
//  HUD + touch controls
// ============================================================
class HudScene extends Phaser.Scene {
  constructor() { super('hud'); }

  create() {
    this.race = this.scene.get('race');
    this.input.addPointer(3);
    const txt = (x, y, s, size, col = '#fff', o = {}) => this.add.text(x, y, s, { fontFamily: FONT, fontSize: size + 'px', color: col, stroke: '#000', strokeThickness: 4, resolution: 2, ...o });
    this.txt = txt;
    // status panel
    const pg = this.add.graphics();
    pg.fillStyle(0x000000, 0.45).fillRoundedRect(14, 14, 300, 132, 12);
    this.posT = txt(30, 18, '', 46, '#ffe14a');
    this.posL = txt(30 + 2, 72, t('pos'), 14, '#cccccc', { strokeThickness: 3 });
    this.lapT = txt(180, 24, '', 30, '#ffffff');
    this.lapL = txt(182, 60, t('lap'), 14, '#cccccc', { strokeThickness: 3 });
    this.cashT = txt(298, 98, '', 20, '#7dff6a').setOrigin(1, 0);
    this.hpG = this.add.graphics();
    this.ammoT = txt(30, 94, '', 18, '#ffd36a');
    this.mineT = txt(112, 94, '', 18, '#ff9a8a');
    this.nitroT = txt(180, 94, '', 18, '#ff8ae8');
    // minimap
    const tr = this.race.tr, mw = 230, mh = 160;
    const sc = Math.min((mw - 20) / tr.W, (mh - 20) / tr.H);
    this.mm = { x: GW - mw - 14, y: 14, sc, ox: (mw - tr.W * sc) / 2, oy: (mh - tr.H * sc) / 2 };
    const mg = this.add.graphics();
    mg.fillStyle(0x000000, 0.45).fillRoundedRect(this.mm.x, this.mm.y, mw, mh, 12);
    mg.lineStyle(7, 0xffffff, 0.25); mg.beginPath();
    tr.P.forEach((p, i) => { const x = this.mm.x + this.mm.ox + p.x * sc, y = this.mm.y + this.mm.oy + p.y * sc; i ? mg.lineTo(x, y) : mg.moveTo(x, y); });
    mg.closePath(); mg.strokePath();
    mg.lineStyle(3, 0x222222, 0.9); mg.beginPath();
    tr.P.forEach((p, i) => { const x = this.mm.x + this.mm.ox + p.x * sc, y = this.mm.y + this.mm.oy + p.y * sc; i ? mg.lineTo(x, y) : mg.moveTo(x, y); });
    mg.closePath(); mg.strokePath();
    this.dotG = this.add.graphics();
    // standings list under minimap
    this.listG = this.add.graphics();
    this.listT = [];
    for (let i = 0; i < this.race.cars.length; i++) this.listT.push(this.add.text(GW - mw - 4, 186 + i * 26, '', { fontFamily: FONT_B, fontSize: '15px', fontStyle: 'bold', color: '#fff', stroke: '#000', strokeThickness: 3, resolution: 2 }));
    // pause button
    this.pauseBtn = this.add.zone(GW - mw - 50, 44, 60, 60).setInteractive({ useHandCursor: true });
    const pb = this.add.graphics();
    pb.fillStyle(0x000000, 0.45).fillRoundedRect(GW - mw - 76, 18, 52, 52, 10);
    pb.fillStyle(0xffffff, 0.9).fillRect(GW - mw - 60, 32, 7, 24).fillRect(GW - mw - 47, 32, 7, 24);
    this.pauseBtn.on('pointerdown', () => this.race.togglePause());
    // messages
    this.msgs = [];
    this.race.events.on('msg', this.onMsg, this);
    this.race.events.on('count', this.onCount, this);
    this.race.events.on('hurt', this.onHurt, this);
    this.events.once('shutdown', () => {
      this.race.events.off('msg', this.onMsg, this); this.race.events.off('count', this.onCount, this); this.race.events.off('hurt', this.onHurt, this);
    });
    this.countT = txt(GW / 2, GH / 2 - 60, '', 140, '#ffe14a', { strokeThickness: 10 }).setOrigin(0.5).setAlpha(0);
    this.wrongT = txt(GW / 2, 190, t('wrongWay'), 40, '#ff4a3a').setOrigin(0.5).setVisible(false);
    this.hurtR = this.add.rectangle(GW / 2, GH / 2, GW, GH, 0xff0000, 0).setDepth(-1);
    // ambience: dusty vignette + blowing sand / ash / embers (screen space, under the HUD)
    const haze = this.race.tr.theme.haze;
    this.add.image(GW / 2, GH / 2, 'vignette').setDisplaySize(GW, GH).setDepth(-3);
    this.add.rectangle(GW / 2, GH / 2, GW, GH, haze === 'ash' ? 0x5a4c44 : haze === 'toxic' ? 0x7aa030 : haze === 'ember' ? 0xff6a20 : 0xd89a58, haze === 'ember' ? 0.05 : 0.07).setDepth(-3);
    this.amb = { type: haze, g: this.add.graphics().setDepth(-2), p: [] };
    this.speedG = this.add.graphics().setDepth(-1).setBlendMode(Phaser.BlendModes.ADD);
    if (haze === 'ember') this.amb.g.setBlendMode(Phaser.BlendModes.ADD);
    for (let k = 0; k < (haze === 'sand' ? 46 : 60); k++) this.amb.p.push({ x: rnd(0, GW), y: rnd(0, GH), v: rnd(0.6, 1.4), l: rnd(18, 60), a: rnd(0.08, 0.28), ph: rnd(0, 7) });
    // touch controls
    this.buildTouch();
    // pause overlay
    this.buildPause();
  }

  onMsg(text, color, big) {
    const m = this.txt(GW / 2, 0, text, big ? 44 : 26, color).setOrigin(0.5);
    this.msgs.unshift(m);
    this.msgs.forEach((o, i) => { o.y = 250 - i * (big ? 50 : 34); if (i > 3) { o.destroy(); } });
    this.msgs.length = Math.min(this.msgs.length, 4);
    m.setScale(0.5);
    this.tweens.add({ targets: m, scale: 1, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: m, alpha: 0, delay: big ? 1600 : 1000, duration: 400, onComplete: () => { m.destroy(); const k = this.msgs.indexOf(m); if (k >= 0) this.msgs.splice(k, 1); } });
  }
  onCount(n) {
    this.countT.setText(n > 0 ? String(n) : t('go')).setAlpha(1).setScale(1.6).setColor(n > 0 ? '#ffe14a' : '#7dff6a');
    this.tweens.add({ targets: this.countT, scale: 1, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: this.countT, alpha: 0, delay: n > 0 ? 550 : 700, duration: 250 });
  }
  onHurt(a) { this.hurtR.setFillStyle(0xff0000, Math.min(0.35, 0.08 + a * 0.012)); this.tweens.add({ targets: this.hurtR, fillAlpha: 0, duration: 260 }); }

  buildTouch() {
    const coarse = (() => { try { return navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
    this.touchOn = coarse || !!G.touch;
    this.tbtn = [
      { k: 'left', x: 110, y: 610, r: 78, label: '◀' },
      { k: 'right', x: 290, y: 610, r: 78, label: '▶' },
      { k: 'fire', x: GW - 120, y: 600, r: 82, label: '●', sub: 'GUN' },
      { k: 'brake', x: GW - 290, y: 640, r: 56, label: '▼', sub: 'BRAKE' },
      { k: 'nitro', x: GW - 135, y: 420, r: 56, label: '⚡', sub: 'NITRO' },
      { k: 'mine', x: GW - 300, y: 490, r: 56, label: '✸', sub: 'MINE' }
    ];
    this.touchG = this.add.graphics();
    this.touchTxt = this.tbtn.map(b => [
      this.add.text(b.x, b.y - (b.sub ? 6 : 0), b.label, { fontFamily: FONT_B, fontSize: Math.round(b.r * 0.6) + 'px', color: '#ffffff', resolution: 2 }).setOrigin(0.5).setAlpha(0.85),
      b.sub ? this.add.text(b.x, b.y + b.r * 0.45, b.sub, { fontFamily: FONT, fontSize: '13px', color: '#ffffff', resolution: 2 }).setOrigin(0.5).setAlpha(0.7) : null
    ]);
    this.input.on('pointerdown', p => { if (p.wasTouch) { this.touchOn = true; G.touch = true; } });
  }
  updateTouch() {
    const tc = this.race.touch, on = this.touchOn && !this.race.paused;
    tc.active = this.touchOn;
    const g = this.touchG; g.clear();
    this.touchTxt.forEach(arr => arr.forEach(o => o && o.setVisible(on)));
    const state = {};
    if (on) for (const p of this.input.manager.pointers) {
      if (!p.isDown) continue;
      for (const b of this.tbtn) if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.25) state[b.k] = true;
    }
    for (const b of this.tbtn) {
      tc[b.k] = !!state[b.k];
      if (!on) continue;
      g.fillStyle(state[b.k] ? 0xffe14a : 0x000000, state[b.k] ? 0.45 : 0.32).fillCircle(b.x, b.y, b.r);
      g.lineStyle(3, 0xffffff, 0.5).strokeCircle(b.x, b.y, b.r);
    }
  }

  updateAmbience() {
    const A = this.amb, g = A.g, dt = Math.min(0.05, this.game.loop.delta / 1000);
    g.clear();
    if (this.race.paused) return;
    for (const q of A.p) {
      if (A.type === 'sand') {
        q.x += 520 * q.v * dt; q.y += 90 * q.v * dt;
        if (q.x > GW + 60 || q.y > GH + 20) { q.x = rnd(-200, GW * 0.6); q.y = rnd(-40, GH); }
        g.lineStyle(1.6, 0xead2a2, q.a); g.lineBetween(q.x, q.y, q.x - q.l, q.y - q.l * 0.17);
      } else if (A.type === 'ash' || A.type === 'toxic') {
        q.ph += dt * 2; q.x += (20 + Math.sin(q.ph) * 30) * q.v * dt; q.y += 38 * q.v * dt;
        if (q.y > GH + 10) { q.y = -10; q.x = rnd(0, GW); }
        g.fillStyle(A.type === 'toxic' ? 0xc8f060 : 0xb0a8a0, q.a * 1.6).fillRect(q.x, q.y, 2.4 * q.v, 2.4 * q.v);
      } else {
        q.ph += dt * 6; q.x += Math.sin(q.ph * 0.5) * 20 * dt; q.y -= 45 * q.v * dt;
        if (q.y < -10) { q.y = GH + 10; q.x = rnd(0, GW); }
        g.fillStyle(0xff8a2a, (0.4 + 0.4 * Math.sin(q.ph)) * q.a * 2.5).fillCircle(q.x, q.y, 1.6 * q.v);
      }
    }
  }

  buildPause() { this.pauseC = null; }
  showPause(on) {
    if (this.pauseC) { this.pauseC.destroy(); this.pauseC = null; }
    if (!on) return;
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.65).setInteractive());
    c.add(this.txt(GW / 2, 210, t('paused'), 72, '#ffe14a', { strokeThickness: 8 }).setOrigin(0.5));
    c.add(makeButton(this, GW / 2, 350, 340, 70, t('resume'), () => this.race.togglePause(), { color: 0x5f8a2a }));
    c.add(makeButton(this, GW / 2, 440, 340, 60, t('forfeit'), () => { this.race.paused = false; this.race.finishRace(true); }, { color: 0x8a2a2a, size: 22 }));
    c.add(makeSoundButton(this, GW / 2, 530));
    this.pauseC = c;
  }

  update() {
    const r = this.race; if (!r || !r.player) return;
    const p = r.player, rank = r.ranking();
    const pos = rank.indexOf(p) + 1;
    this.posT.setText(pos + '/' + rank.length);
    const lap = clamp(Math.floor(p.total / r.tr.len) + 1, 1, r.offer.laps);
    this.lapT.setText(lap + '/' + r.offer.laps);
    this.ammoT.setText('▮' + p.ammo);
    this.mineT.setText('✸' + p.mines);
    this.nitroT.setText('⚡' + p.nitro + (p.nitroT > 0 ? '!' : ''));
    this.cashT.setText(r.playerCash + r.playerBounty > 0 ? '+' + money(r.playerCash + r.playerBounty) : '');
    const hg = this.hpG; hg.clear();
    const f = clamp(p.hp / p.maxHp, 0, 1);
    hg.fillStyle(0x000000, 0.6).fillRoundedRect(28, 124, 272, 14, 5);
    hg.fillStyle(f > 0.5 ? 0x4ad04a : f > 0.25 ? 0xffb020 : 0xff3a2a, 1).fillRoundedRect(30, 126, Math.max(2, 268 * f), 10, 4);
    // minimap dots + standings
    const dg = this.dotG; dg.clear();
    const lg = this.listG; lg.clear();
    rank.forEach((c, i) => {
      const x = this.mm.x + this.mm.ox + c.x * this.mm.sc, y = this.mm.y + this.mm.oy + c.y * this.mm.sc;
      dg.fillStyle(0x000000, 1).fillCircle(x, y, c.isPlayer ? 6.5 : 5);
      dg.fillStyle(c.dead ? 0x555555 : c.color, 1).fillCircle(x, y, c.isPlayer ? 5 : 3.8);
      const ty = 186 + i * 26;
      lg.fillStyle(0x000000, c.isPlayer ? 0.6 : 0.4).fillRoundedRect(GW - 244, ty - 2, 230, 24, 6);
      lg.fillStyle(c.color, 1).fillRect(GW - 240, ty + 3, 8, 14);
      const hf = clamp(c.hp / c.maxHp, 0, 1);
      lg.fillStyle(0x333333, 1).fillRect(GW - 80, ty + 8, 60, 6);
      if (!c.dead) lg.fillStyle(hf > 0.5 ? 0x4ad04a : hf > 0.25 ? 0xffb020 : 0xff3a2a, 1).fillRect(GW - 80, ty + 8, 60 * hf, 6);
      this.listT[i].setPosition(GW - 226, ty + 1).setText(`${i + 1}. ${c.name}${c.dead ? ' ✖' : c.finished ? ' ⚑' : ''}`).setColor(c.dead ? '#888' : c.isPlayer ? '#ffe14a' : '#fff');
    });
    this.wrongT.setVisible(p.wrongT > 1 && !p.dead && Math.floor(r.raceT * 3) % 2 === 0);
    this.updateAmbience();
    const sg = this.speedG; sg.clear();
    if (p.nitroT > 0 && !r.paused) for (let k = 0; k < 22; k++) {
      const a = Math.random() * Math.PI * 2, r0 = 260 + Math.random() * 260, l = 60 + Math.random() * 140;
      sg.lineStyle(2, 0xfff0d0, 0.08 + Math.random() * 0.14);
      sg.lineBetween(GW / 2 + Math.cos(a) * r0, GH / 2 + Math.sin(a) * r0 * 0.6, GW / 2 + Math.cos(a) * (r0 + l), GH / 2 + Math.sin(a) * (r0 + l) * 0.6);
    }
    this.updateTouch();
  }
}
