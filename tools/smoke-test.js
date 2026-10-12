'use strict';
/* Automated QA: boots the game in headless Chromium, plays a fast-forwarded
   simulated run through every chaos event and every boss with all upgrades
   applied, and fails on any runtime error.  Usage: npm test */
const { launch, GAME_URL } = require('./_browser');

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(GAME_URL);
  await page.click('[data-act=boot]');

  const result = await page.evaluate(() => {
    const log = [];
    const sim = secs => {
      for (let i = 0; i < secs * 60; i++) {
        while (Game.state === 'levelup') Game.chooseUpgrade(UI.levelChoices[0]);
        if (Game.state !== 'playing') break;
        W.player.hp = W.player.maxHp;
        Game.update(1 / 60);
      }
      Game.render();
    };
    for (const ship of SHIPS) {
      Game.startRun('standard', ship.id);
      sim(20);
      log.push(ship.id + ' ok, wave ' + W.wave + ', kills ' + W.kills);
      Game.quitToMenu();
    }
    Game.startRun('standard', 'vector');
    for (const u of UPGRADES) for (let i = 0; i < u.max; i++) applyUpgrade(u);
    for (const ev of EVENTS) {
      endEvent();
      startWave(W.wave % 5 === 4 ? W.wave + 2 : W.wave + 1);
      W.pendingEvent = ev; W.introT = 0;
      sim(4);
      log.push('event ' + ev.id + ' ok');
    }
    for (const n of [5, 10, 15, 20]) {
      endEvent();
      for (const e of W.enemies) e.dead = true;
      W.bossDeath = null; W.boss = null;
      startWave(n); W.introT = 0;
      sim(0.5);
      const name = W.boss ? W.boss.bossDef.name : '(already dead)';
      if (W.boss) W.boss.hp = 1;
      sim(6);
      log.push('boss wave ' + n + ' ' + name + ' ok');
    }
    sim(6);
    log.push('final state: ' + Game.state);
    return log;
  });
  result.forEach(l => console.log('  ' + l));
  await browser.close();
  if (errors.length) {
    console.error('\nFAILED with ' + errors.length + ' error(s):');
    [...new Set(errors)].slice(0, 10).forEach(e => console.error(e));
    process.exit(1);
  }
  console.log('\nAll smoke tests passed.');
})();
