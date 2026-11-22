'use strict';
// ============================================================
//  Poki SDK wrapper – safe no-op when the SDK is unavailable
//  (local dev / offline / adblock)
// ============================================================
const Poki = {
  ok: false, playing: false, adBusy: false, firstRaceDone: false,

  init() {
    return new Promise(resolve => {
      const done = () => resolve();
      if (!window.PokiSDK) return done();
      const timer = setTimeout(done, 4000);
      try {
        PokiSDK.init()
          .then(() => { this.ok = true; })
          .catch(() => { this.ok = true; /* adblock: game must still work */ })
          .finally(() => { clearTimeout(timer); done(); });
      } catch (e) { clearTimeout(timer); done(); }
    });
  },
  loadingFinished() { try { if (this.ok) PokiSDK.gameLoadingFinished(); } catch (e) { /* ignore */ } },
  gameplayStart() {
    if (this.playing) return; this.playing = true;
    try { if (this.ok) PokiSDK.gameplayStart(); } catch (e) { /* ignore */ }
  },
  gameplayStop() {
    if (!this.playing) return; this.playing = false;
    try { if (this.ok) PokiSDK.gameplayStop(); } catch (e) { /* ignore */ }
  },
  // interstitial at natural breaks (before a race, except the very first one)
  commercialBreak() {
    return new Promise(resolve => {
      if (!this.ok || this.adBusy) return resolve();
      this.adBusy = true;
      const end = () => { this.adBusy = false; Sound.adMute(false); resolve(); };
      try { PokiSDK.commercialBreak(() => Sound.adMute(true)).then(end).catch(end); } catch (e) { end(); }
    });
  },
  // rewarded ad; resolves true when the reward should be granted
  rewardedBreak() {
    return new Promise(resolve => {
      if (!this.ok) return resolve(true);              // dev mode: grant reward
      if (this.adBusy) return resolve(false);
      this.adBusy = true;
      const end = v => { this.adBusy = false; Sound.adMute(false); resolve(!!v); };
      try { PokiSDK.rewardedBreak(() => Sound.adMute(true)).then(end).catch(() => end(false)); } catch (e) { end(false); }
    });
  }
};

// ============================================================
//  Sound – synthesized with Web Audio (no files)
// ============================================================
const Sound = {
  ctx: null, last: {}, muted: false, adMuted: false, eng: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume(); return; }
    try {
      this.muted = localStorage.getItem('havocrally_muted') === '1';
    } catch (e) { /* ignore */ }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVol();
      const len = this.ctx.sampleRate;
      this.nb = this.ctx.createBuffer(1, len, len);
      const d = this.nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  applyVol() { if (this.master) this.master.gain.value = (this.muted || this.adMuted) ? 0 : 0.45; },
  toggle() {
    this.muted = !this.muted; this.applyVol();
    try { localStorage.setItem('havocrally_muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
    return this.muted;
  },
  adMute(on) { this.adMuted = on; this.applyVol(); },
  suspend(on) { if (!this.ctx) return; try { on ? this.ctx.suspend() : this.ctx.resume(); } catch (e) { /* ignore */ } },

  noise(dur, freq, type, vol, q = 1, delay = 0) {
    const c = this.ctx, t0 = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.nb;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur);
  },
  tone(f0, f1, dur, type, vol, delay = 0) {
    const c = this.ctx, t0 = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  play(name, v = 1) {
    if (!this.ctx || v <= 0.03) return;
    const now = performance.now();
    const gap = name === 'gun' ? 55 : name === 'ricochet' ? 120 : name === 'flame' ? 110 : 40;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'gun':
        this.noise(0.07, 2400, 'bandpass', 0.32 * v, 1.2); this.noise(0.09, 600, 'lowpass', 0.45 * v);
        this.tone(170, 55, 0.06, 'square', 0.1 * v); this.tone(2600, 1400, 0.02, 'square', 0.03 * v); break;
      case 'ricochet': this.tone(2800 + Math.random() * 1200, 700, 0.18, 'sine', 0.12 * v); break;
      case 'hit': this.noise(0.05, 3800, 'highpass', 0.22 * v); this.tone(900, 400, 0.04, 'square', 0.04 * v); break;
      case 'thud': this.noise(0.18, 300, 'lowpass', 0.6 * v); this.tone(90, 40, 0.15, 'sine', 0.35 * v); break;
      case 'crash': this.noise(0.25, 900, 'bandpass', 0.55 * v, 0.7); this.tone(120, 50, 0.2, 'sawtooth', 0.15 * v); break;
      case 'boom':
        this.noise(1.1, 500, 'lowpass', 1.0 * v); this.noise(0.4, 2000, 'bandpass', 0.4 * v);
        this.tone(80, 25, 0.8, 'sine', 0.7 * v); break;
      case 'mine': this.tone(500, 300, 0.12, 'triangle', 0.25 * v); break;
      case 'pickup': this.tone(700, 1400, 0.12, 'triangle', 0.3 * v); this.tone(1050, 2100, 0.12, 'triangle', 0.2 * v, 0.07); break;
      case 'cash': [880, 1320, 1760].forEach((f, i) => this.tone(f, f, 0.09, 'square', 0.12 * v, i * 0.06)); break;
      case 'nitro': this.noise(0.9, 1200, 'bandpass', 0.5 * v, 0.5); this.tone(200, 900, 0.5, 'sawtooth', 0.12 * v); break;
      case 'beep': this.tone(660, 660, 0.18, 'square', 0.22 * v); break;
      case 'go': this.tone(1320, 1320, 0.45, 'square', 0.25 * v); break;
      case 'click': this.tone(900, 600, 0.05, 'square', 0.12 * v); break;
      case 'buy': this.tone(520, 1040, 0.1, 'square', 0.15 * v); this.tone(780, 1560, 0.12, 'square', 0.12 * v, 0.08); break;
      case 'deny': this.tone(220, 140, 0.18, 'square', 0.18 * v); break;
      case 'lap': [660, 990].forEach((f, i) => this.tone(f, f, 0.12, 'triangle', 0.25 * v, i * 0.1)); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.22, 'square', 0.16 * v, i * 0.13)); break;
      case 'backfire': this.noise(0.09, 700, 'lowpass', 0.7 * v); this.tone(160, 50, 0.08, 'square', 0.25 * v); break;
      case 'flame': this.noise(0.14, 900, 'bandpass', 0.35 * v, 0.6); this.noise(0.12, 300, 'lowpass', 0.3 * v); break;
      case 'rocket': this.noise(0.6, 1400, 'bandpass', 0.6 * v, 0.7); this.tone(260, 90, 0.5, 'sawtooth', 0.15 * v); break;
      case 'skid': this.noise(0.12, 1600, 'bandpass', 0.07 * v, 3); break;
    }
  },

  // continuous engine for the player car
  engineStart() {
    if (!this.ctx || this.eng) return;
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'square';
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 2;
    const g = c.createGain(); g.gain.value = 0;
    const g2 = c.createGain(); g2.gain.value = 0.35;
    const sh = c.createWaveShaper(), curve = new Float32Array(512);       // gritty, rumbling V8-ish tone
    for (let i = 0; i < 512; i++) { const xx = i / 255.5 - 1; curve[i] = Math.tanh(xx * 3.2); }
    sh.curve = curve;
    o1.connect(f); o2.connect(g2).connect(f); f.connect(sh).connect(g).connect(this.master);
    o1.start(); o2.start();
    this.eng = { o1, o2, f, g };
  },
  engineSet(ratio, load) {
    if (!this.eng) return;
    const t0 = this.ctx.currentTime, r = clamp(ratio, 0, 1.4);
    const base = 34 + r * 108 + load * 10;
    this.eng.o1.frequency.setTargetAtTime(base, t0, 0.05);
    this.eng.o2.frequency.setTargetAtTime(base * 0.5, t0, 0.05);
    this.eng.f.frequency.setTargetAtTime(380 + r * 900 + load * 300, t0, 0.08);
    this.eng.g.gain.setTargetAtTime(0.05 + r * 0.045 + load * 0.025, t0, 0.08);
  },
  engineStop() {
    if (!this.eng) return;
    const e = this.eng; this.eng = null;
    try { e.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (x) { /* ignore */ } }, 300); } catch (x) { /* ignore */ }
  }
};
