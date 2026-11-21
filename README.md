# Havoc Rally

Top-down combat racing (Phaser 4.2.1, no build step), made for Poki.

Run locally: `python -m http.server 8131 --directory public` and open http://localhost:8131

Deployed by Cloudflare Workers (static assets from `public/`, see `wrangler.jsonc`) on every push to `main`.

## Structure
- `public/index.html` – loads Poki SDK, Phaser and the game scripts
- `public/src/data.js` – texts, cars, drivers, tracks, career/economy, save (localStorage)
- `public/src/poki.js` – Poki SDK wrapper (safe no-op without SDK) + synthesized Web Audio sound
- `public/src/art.js` – procedural graphics: track geometry, track textures (1024px chunks), cars, effects
- `public/src/race.js` – race scene (physics, AI, weapons, mines, pickups) + HUD with touch controls
- `public/src/menus.js` – boot, title (live demo race), garage/shop/dealer, results, victory
- `public/src/main.js` – Phaser config

## Poki integration
- `gameLoadingFinished` after boot, `gameplayStart/Stop` on race start, pause, finish
- `commercialBreak` before every race except the first
- `rewardedBreak`: free repair (garage) and double prize (results)
- audio muted during ads, auto-pause on tab blur, touch controls, landscape notice on phones

## Upload
For Poki: zip the contents of `public/` (`index.html`, `lib/`, `src/`).
