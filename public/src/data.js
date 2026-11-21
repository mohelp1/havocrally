'use strict';
// ============================================================
//  HAVOC RALLY – data, texts, career, save
// ============================================================

const GH = 720, UW = 1280;                   // UW = width of the centered menu layout
// game width follows the screen's aspect ratio (landscape), so wide phones are filled edge to edge
const GW = (() => {
  try {
    const w = window.innerWidth || UW, h = window.innerHeight || GH, a = Math.max(w, h) / Math.max(1, Math.min(w, h));
    return Math.round(Math.min(1800, Math.max(UW, GH * a)) / 2) * 2;
  } catch (e) { return UW; }
})();
const MX = (GW - UW) / 2;                    // menus scroll by -MX to stay centered
const MOBILE_UI = (() => { try { return window.matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 520; } catch (e) { return false; } })();
const FONT = '"Arial Black", "Segoe UI Black", Impact, sans-serif';
const FONT_B = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------- texty (EN) ----------------
const STR = {
    subtitle: 'Gasoline. Guns. Glory.',
    play: 'PLAY', cont: 'CONTINUE', newCareer: 'NEW CAREER', sure: 'REALLY DELETE?',
    controls: 'Arrows / WASD – drive   ·   Space – machine gun   ·   X – mine   ·   Shift – nitro   ·   Esc – pause',
    controlsTouch: 'Touch controls: ◀ ▶ to steer, throttle is automatic',
    garage: 'SCRAP GARAGE', points: 'Points', raceNo: 'Race #{0}',
    speed: 'Top speed', accel: 'Acceleration', handling: 'Handling', armor: 'Armor', condition: 'Condition',
    repair: 'REPAIR  {0}', repaired: 'ALL GOOD', repairAd: '▶ FREE REPAIR',
    upgrades: 'UPGRADES', engine: 'Engine', tires: 'Tires', plating: 'Armor plating', mg: 'Machine gun',
    mines: 'Mines', nitro: 'Nitro', max: 'MAX', dealer: 'JUNKYARD DEALER',
    ranking: 'STANDINGS', you: 'You',
    diff: ['EASY', 'MEDIUM', 'HARD', 'FINAL'],
    prize: 'Prize {0}', race: 'RACE!', opponents: 'Rivals:',
    bossLocked: 'Reach {0} pts to challenge the Black Baron!',
    bossCard: 'Title showdown',
    tip: 'The world burned, the roads stayed. Pick a race below, win, grab scrap money – wrecking rivals pays off. Bolt on armor and challenge the Black Baron!',
    loading: 'Loading track…',
    lap: 'LAP', pos: 'POS', go: 'GO!', finish: 'FINISH!', wrecked: 'WRECKED!',
    kill: '{0} wrecked!  +{1}', lastLap: 'FINAL LAP!',
    wrongWay: 'WRONG WAY!', pkAmmo: 'AMMO +45', pkFix: 'REPAIR +25%', pkNitro: 'NITRO +1',
    paused: 'PAUSED', resume: 'RESUME', forfeit: 'FORFEIT RACE',
    results: 'RESULTS', place: 'Place', name: 'Driver', pts: 'Points', kills: 'Wrecks',
    prizeMoney: 'Prize money', bounty: 'Wreck bounties', pickups: 'Cash pickups', total: 'Total',
    double: '▶ DOUBLE THE PRIZE', doubled: 'PRIZE DOUBLED!', toGarage: 'TO GARAGE', out: 'wrecked',
    youWrecked: 'Your car was wrecked – no prize.',
    victory: 'HAVOC RALLY CHAMPION!', victoryTxt: 'You beat the Black Baron. The wasteland roads are yours now.',
    stats: 'Races: {0}   ·   Wins: {1}   ·   Cars wrecked: {2}',
    owned: 'YOUR CAR', buyFor: 'BUY  {0}', tradeIn: 'Trade-in for your car: {0}', close: 'CLOSE',
    noMoney: 'Not enough cash!', bought: 'Purchased!', rotate: 'Please rotate your device',
    carDesc: ['Rusty little bug with a spiked bumper. Runs on hope.', 'Blown hot-rod coupe. Loud, fast and angry.', 'Low wedge with a wing and a supercharger. Sticks to the sand.', 'Scrap-plated war truck. Ramming it is a mistake.'],
    upDesc: { engine: 'top speed & acceleration', tires: 'grip & steering', plating: 'car durability', mg: 'machine gun damage', mines: 'pack of 3 mines', nitro: 'one nitro charge' }
};
function t(k, ...a) {
  let s = STR[k]; if (s === undefined) return k;
  if (typeof s === 'string') a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
const L = o => (typeof o === 'string' ? o : o.en);
const lapsText = n => `${n} ${n === 1 ? 'lap' : 'laps'}`;
const money = n => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---------------- auta ----------------
const CARS = [
  { name: 'Rustbug', price: 0,     speed: 385, accel: 320, turn: 3.15, grip: 6.0, hp: 100, mass: 1.0,  shape: 0 },
  { name: 'Scorcher',  price: 2400,  speed: 432, accel: 366, turn: 3.3, grip: 6.7, hp: 130, mass: 1.1,  shape: 1 },
  { name: 'Razorback',  price: 5800,  speed: 480, accel: 413, turn: 3.45, grip: 7.4, hp: 160, mass: 1.2, shape: 2 },
  { name: 'Juggernaut',  price: 11500, speed: 522, accel: 455, turn: 3.5, grip: 7.9, hp: 220, mass: 1.5,  shape: 3 }
];
const UPGRADES = ['engine', 'tires', 'plating'];
const UP_BASE = { engine: 320, tires: 260, plating: 280 };
const upCost = (carIdx, key, lvl) => Math.round(UP_BASE[key] * (1 + carIdx * 0.85) * (lvl + 1) / 10) * 10;
const MG_COST = [450, 900, 1600];
const MINE_PACK = 150, MINE_MAX = 9, NITRO_COST = 120, NITRO_MAX = 6;
const REPAIR_PER_HP = 3;

function carStats(carIdx, up, mgLvl, mult = 1) {
  const c = CARS[carIdx];
  return {
    speed: c.speed * (1 + 0.065 * up.engine) * mult,
    accel: c.accel * (1 + 0.1 * up.engine) * mult,
    turn: c.turn * (1 + 0.05 * up.tires),
    grip: c.grip * (1 + 0.12 * up.tires),
    hp: Math.round(c.hp * (1 + 0.25 * up.plating)),
    mass: c.mass,
    shape: c.shape,
    mgDmg: 2.55 * (1 + 0.45 * mgLvl)
  };
}

// ---------------- jezdci ----------------
const PLAYER_COLOR = 0xd8262e;
const DRIVERS = [
  { id: 'bara',   name: 'Rust Widow',     color: 0x3fa7ff, skill: 0.32, tier: 0, pts: 2, vis: 7 },
  { id: 'kudla',  name: 'Shiv',               color: 0xffd23f, skill: 0.38, tier: 0, pts: 4, vis: 4 },
  { id: 'srot',   name: 'Doc Scrap',    color: 0x8fd14f, skill: 0.44, tier: 0, pts: 6, vis: 6 },
  { id: 'vyfuk',  name: 'Gasket', color: 0xff8a3d, skill: 0.5,  tier: 1, pts: 9, vis: 5 },
  { id: 'rada',   name: 'Rusty Rudy',   color: 0xb87a3d, skill: 0.56, tier: 1, pts: 12, vis: 0 },
  { id: 'mlynek', name: 'Grinder',           color: 0x9b59ff, skill: 0.63, tier: 1, pts: 16, vis: 2 },
  { id: 'zdena',  name: 'Toothy Tess', color: 0xff4fa3, skill: 0.71, tier: 2, pts: 20, vis: 7 },
  { id: 'jed',    name: 'Jinx',           color: 0x2de0c0, skill: 0.79, tier: 2, pts: 25, vis: 4 },
  { id: 'hrom',   name: 'Sandstorm',             color: 0xe8e8e8, skill: 0.87, tier: 3, pts: 31, vis: 5 }
];
const BOSS = { id: 'baron', name: 'Black Baron', color: 0x262626, skill: 1.0, tier: 3, pts: 50, vis: 3 };
// each rival's own paint job and bolted-on scrap (see carModel in art.js)
const KITS = {
  bara:   { rust: 0.18, decals: ['flames'], addons: ['zoomies'] },
  kudla:  { rust: 0.3, decals: ['hazard'], addons: ['flags'], flag: '#d8b020' },
  srot:   { rust: 0.3, decals: ['skull'], addons: ['ladder', 'roofTires'] },
  vyfuk:  { rust: 0.22, decals: ['twotone'], addons: ['bedjunk', 'cage'], col2: '#2a1a12' },
  rada:   { rust: 0.55, decals: ['rustheavy'], addons: ['roofTires', 'harpoon'] },
  mlynek: { rust: 0.2, decals: ['checker'], addons: ['saws'] },
  zdena:  { rust: 0.12, decals: ['teeth'], addons: ['harpoon', 'flags'], flag: '#ff4fa3' },
  jed:    { rust: 0.25, decals: ['camo'], addons: ['flags'], flag: '#2de0c0' },
  hrom:   { rust: 0.3, decals: ['camo', 'twotone'], addons: ['ram', 'cage'], col2: '#6a5a40' },
  baron:  { rust: 0.08, decals: ['skull', 'hazard'], addons: ['ram', 'bigspikes', 'flags'], flag: '#8a1010' }
};
const BOSS_POINTS = 50;
const driverDef = id => (id === 'baron' ? BOSS : DRIVERS.find(d => d.id === id));

// ---------------- závody ----------------
const PRIZES = [[400, 220, 100, 0], [800, 450, 220, 0], [1500, 850, 400, 0], [6000, 0, 0, 0]];
const POINTS = [[6, 3, 1, 0], [12, 6, 2, 0], [18, 9, 3, 0], [0, 0, 0, 0]];
const BOUNTY = [100, 180, 260, 500];
const LAPS = [3, 3, 4, 4];

// trati v mřížce (1 jednotka = TRACK_G px); první bod leží uprostřed rovinky (start)
const TRACKS = [
  { name: 'Dust Gulch', theme: 'desert', grip: 1,
    pts: [[9, 3], [15, 3], [20, 4], [22, 8], [20, 12], [15, 12], [12, 9], [9, 12], [4, 13], [2, 9], [2, 5], [4, 3]] },
  { name: 'Scrapyard', theme: 'scrap', grip: 1,
    pts: [[7, 3], [10, 3], [12, 5], [14, 3], [21, 3], [23, 5], [23, 12], [21, 14], [14, 14], [14, 9], [9, 9], [9, 14], [4, 14], [2, 12], [2, 5], [4, 3]] },
  { name: 'Salt Flats', theme: 'salt', grip: 0.7, long: true,
    pts: [[13, 20], [8, 20], [3, 17], [5, 13], [2, 9], [3, 4], [8, 2], [13, 4], [18, 2], [23, 4], [24, 9], [20, 11], [16, 9], [12, 12], [16, 15], [22, 15], [23, 18], [18, 20]] },
  { name: 'Ashlands', theme: 'ash', grip: 0.95, long: true,
    pts: [[12, 3], [22, 3], [24, 6], [21, 9], [12, 9], [10, 11], [12, 13], [22, 13], [24, 16], [21, 19], [4, 19], [2, 16], [2, 6], [4, 3]] },
  { name: "Baron's Fire Pit", theme: 'night', grip: 1, long: true,
    pts: [[7, 3], [11, 3], [14, 7], [18, 3], [24, 3], [26, 6], [26, 16], [23, 19], [17, 19], [15, 15], [11, 15], [9, 19], [4, 19], [2, 16], [4, 12], [2, 8], [3, 4]] },
  { name: 'Red Canyon Run', theme: 'canyon', grip: 1, long: true,
    pts: [[10, 3], [18, 3], [22, 5], [22, 8], [18, 10], [12, 10], [9, 12], [9, 15], [12, 17], [20, 17], [23, 19], [21, 22], [6, 22], [3, 19], [3, 12], [5, 8], [3, 5], [5, 3]] },
  { name: 'Toxic Sump', theme: 'toxic', grip: 0.92,
    pts: [[8, 4], [16, 4], [19, 6], [19, 9], [16, 11], [11, 11], [9, 13], [11, 15], [17, 15], [20, 17], [19, 20], [14, 21], [5, 21], [2, 18], [2, 8], [4, 5]] },
  { name: 'Bone Valley', theme: 'desert', grip: 1, long: true,
    pts: [[12, 3], [20, 3], [24, 5], [24, 8], [20, 11], [20, 14], [24, 17], [24, 20], [20, 23], [8, 23], [4, 20], [4, 17], [8, 14], [8, 11], [4, 8], [4, 5], [7, 3]] },
  { name: 'Rust Belt', theme: 'scrap', grip: 1, long: true,
    pts: [[6, 3], [14, 3], [16, 5], [18, 3], [24, 3], [26, 5], [26, 10], [23, 12], [16, 12], [14, 14], [14, 18], [16, 20], [24, 20], [26, 22], [24, 25], [5, 25], [3, 22], [3, 15], [6, 12], [3, 9], [3, 5]] },
  { name: 'Cinder Loop', theme: 'ash', grip: 0.95, long: true,
    pts: [[10, 3], [19, 3], [23, 5], [24, 9], [21, 12], [17, 12], [15, 14], [17, 16], [22, 17], [23, 20], [19, 23], [8, 23], [4, 20], [3, 15], [6, 12], [4, 9], [3, 5], [6, 3]] }
];
const BOSS_TRACK = 4;
const RACE_TRACKS = TRACKS.map((_, i) => i).filter(i => i !== BOSS_TRACK);

// ---------------- kariéra ----------------
function newCareer() {
  const c = {
    v: 1, money: 700, points: 0, raceNo: 1, car: 0, up: { engine: 0, tires: 0, plating: 0 },
    mg: 0, mines: 3, nitro: 2, hp: 0, races: 0, wins: 0, kills: 0, champion: false, tipSeen: false,
    drivers: DRIVERS.map(d => ({ id: d.id, points: d.pts, tier: d.tier })), offers: null
  };
  c.hp = maxHp(c);
  c.offers = makeOffers(c);
  return c;
}
const maxHp = c => carStats(c.car, c.up, c.mg).hp;

function makeOffers(c) {
  const ranked = c.drivers.slice().sort((a, b) => a.points - b.points);
  const pools = [ranked.slice(0, 5), ranked.slice(2, 7), ranked.slice(4, 9)];
  const tracks = shuffle(RACE_TRACKS.slice());
  const offers = [0, 1, 2].map(d => ({
    diff: d, track: tracks[d], laps: LAPS[d] - (TRACKS[tracks[d]].long ? 1 : 0),
    opp: shuffle(pools[d].map(x => x.id)).slice(0, 3)
  }));
  if (c.points >= BOSS_POINTS) {
    const top = ranked.slice(-2).map(x => x.id);
    offers.push({ diff: 3, track: BOSS_TRACK, laps: LAPS[3] - 1, opp: ['baron', ...top] });
  }
  return offers;
}

// po závodě: ostatní jezdci sbírají body v "jiných" závodech a vylepšují auta
function simulateOthers(c, raced) {
  c.drivers.forEach(d => {
    const def = driverDef(d.id);
    if (!raced.includes(d.id) && Math.random() < 0.6) d.points += Math.round(Math.random() * def.skill * 6);
    d.points = Math.min(d.points, BOSS_POINTS - 2 - Math.floor((1 - def.skill) * 10));
    const want = d.points >= 40 ? 3 : d.points >= 24 ? 2 : d.points >= 10 ? 1 : 0;
    d.tier = Math.max(d.tier, Math.min(want, def.tier + 1));
  });
}

function standings(c) {
  const rows = c.drivers.map(d => ({ name: L(driverDef(d.id).name), points: d.points, color: driverDef(d.id).color }));
  rows.push({ name: L(BOSS.name), points: BOSS_POINTS, color: BOSS.color, boss: true });
  rows.push({ name: t('you'), points: c.points, color: PLAYER_COLOR, player: true });
  return rows.sort((a, b) => b.points - a.points || (a.player ? -1 : 1));
}

const Save = {
  key: 'havocrally_save_v1',
  load() { try { const s = localStorage.getItem(this.key); const c = s ? JSON.parse(s) : null; return c && c.v === 1 ? c : null; } catch (e) { return null; } },
  store(c) { try { localStorage.setItem(this.key, JSON.stringify(c)); } catch (e) { /* ignore */ } },
  clear() { try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ } }
};

const G = { career: null };
