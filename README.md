# Havoc Rally

Top-down combat racing (Phaser 4.2.1, no build step), made for Poki.

Run locally: `python -m http.server 8131` in this folder and open http://localhost:8131

## Structure
- `index.html` – loads Poki SDK, Phaser and the game scripts
- `src/data.js` – texts, cars, drivers, tracks, career/economy, save (localStorage)
- `src/poki.js` – Poki SDK wrapper (safe no-op without SDK) + synthesized Web Audio sound
- `src/art.js` – procedural graphics: track geometry, track textures (1024px chunks), cars, effects
- `src/race.js` – race scene (physics, AI, weapons, mines, pickups) + HUD with touch controls
- `src/menus.js` – boot, title (live demo race), garage/shop/dealer, results, victory
- `src/main.js` – Phaser config

## Poki integration
- `gameLoadingFinished` after boot, `gameplayStart/Stop` on race start, pause, finish
- `commercialBreak` before every race except the first
- `rewardedBreak`: free repair (garage) and double prize (results)
- audio muted during ads, auto-pause on tab blur, touch controls, landscape notice on phones

## Upload
Zip the folder contents (`index.html`, `lib/`, `src/`) – no other files needed.
