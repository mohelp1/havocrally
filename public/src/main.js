'use strict';
// ============================================================
//  HAVOC RALLY – entry point (Phaser 4 + Poki SDK)
// ============================================================

// unlock / resume audio on the first user gesture; suspend when the tab is hidden
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => Sound.init(), { passive: true }));
document.addEventListener('visibilitychange', () => Sound.suspend(document.hidden));
// keep the page from scrolling inside the Poki iframe (arrow/space capture is done by Phaser in BootScene,
// a page-level preventDefault would make Phaser ignore those keys)
window.addEventListener('wheel', e => e.preventDefault(), { passive: false });

Poki.init().then(() => {
  window.__game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: Math.round(GW * RS),
    height: Math.round(GH * RS),
    backgroundColor: '#101014',
    disableContextMenu: true,
    render: { antialias: true, mipmapFilter: 'LINEAR_MIPMAP_LINEAR', powerPreference: 'high-performance' },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4 },
    scene: [BootScene, TitleScene, GarageScene, RaceScene, HudScene, ResultsScene, VictoryScene]
  });
  if (/[?&]debug=1/.test(location.search)) startDebugOverlay(window.__game);
});

// ?debug=1 : on-screen diagnostics (device/GPU info, errors, state of the car sprites)
function startDebugOverlay(game) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:0;top:0;z-index:50;max-width:60vw;background:rgba(0,0,0,0.75);color:#7dff6a;font:11px/1.25 monospace;padding:4px 6px;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(box);
  const errors = [];
  window.addEventListener('error', e => errors.push((e.message || 'error') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => errors.push('promise: ' + (e.reason && e.reason.message || e.reason)));
  let gl = '';
  const tick = () => {
    try {
      const r = game.renderer;
      if (!gl && r && r.gl) {
        const c = r.gl, dbg = c.getExtension('WEBGL_debug_renderer_info');
        gl = `GL ${c.getParameter(c.VERSION)} | ${dbg ? c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)}\nmaxTex ${c.getParameter(c.MAX_TEXTURE_SIZE)} units ${c.getParameter(c.MAX_TEXTURE_IMAGE_UNITS)}`;
      }
      const lines = [`${navigator.userAgent.slice(0, 90)}`, gl, `GW ${GW} DPR ${window.devicePixelRatio} MOBILE_UI ${MOBILE_UI} LOW_MEM ${LOW_MEM} LITE ${LITE} RES ${CAR_RES3}`,
        `fps ${game.loop.actualFps.toFixed(0)} scenes ${game.scene.getScenes(true).map(s => s.sys.settings.key).join(',')}`];
      const race = game.scene.getScene('race');
      if (race && race.cars && game.scene.isActive('race')) {
        const v = race.cameras.main.worldView;
        race.cars.forEach(c => {
          const s = c.spr, tex = s.texture, src = tex && tex.getSourceImage && tex.getSourceImage();
          lines.push(`${c.name.slice(0, 10)} tex ${tex.key.slice(0, 22)} ${src ? src.width + 'x' + src.height : '?'} fr ${s.frame.name} ${s.frame.width}x${s.frame.height} vis ${s.visible} a ${s.alpha} d ${s.depth.toFixed(1)} inView ${v.contains(s.x, s.y)}`);
        });
      }
      lines.push('errors: ' + (errors.length ? errors.slice(-4).join(' | ') : 'none'));
      box.textContent = lines.join('\n');
    } catch (e) { box.textContent = 'debug overlay error: ' + e.message; }
  };
  setInterval(tick, 1000);
}
