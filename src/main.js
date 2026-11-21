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
    width: GW,
    height: GH,
    backgroundColor: '#101014',
    disableContextMenu: true,
    render: { antialias: true, mipmapFilter: 'LINEAR_MIPMAP_LINEAR', powerPreference: 'high-performance' },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4 },
    scene: [BootScene, TitleScene, GarageScene, RaceScene, HudScene, ResultsScene, VictoryScene]
  });
});
