'use strict';
/* ==========================================================================
   Boot sequence.
   ========================================================================== */

(function boot() {
  Save.load();
  Game.init();
  Input.init(Game.canvas);
  UI.init();
  UI.applySettings();

  // Pause automatically when the window loses focus
  const autoPause = () => { if (Game.state === 'playing' && W && W.dying <= 0) Game.pause(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  window.addEventListener('blur', autoPause);

  // Resume audio on any interaction (browsers require a user gesture)
  const unlock = () => Sound.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Debug / QA hook (harmless in production)
  window.HYPERCHAOS = { Game, Save, get run() { return W; } };
})();
