'use strict';
/* Generates store assets from the live game:
     build/icon.png               1024x1024 app icon (desktop builds)
     marketing/cover-630x500.png  itch.io cover image
     marketing/capsule-460x215.png  Steam header capsule
     marketing/capsule-616x353.png  Steam main capsule
     marketing/screenshot-*.png   1920x1080 gameplay screenshots
   Usage: npm run marketing */
const fs = require('fs');
const path = require('path');
const { launch, GAME_URL } = require('./_browser');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'marketing');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });

async function boot(page) {
  await page.goto(GAME_URL);
  await page.evaluate(() => {
    Save.data.seenHowTo = true;
    Save.data.settings.damageNumbers = false;
    Save.data.settings.voice = false;
    Save.data.settings.difficulty = 'easy';
    Achievements.unlock = () => {};
    const st = document.createElement('style');
    st.textContent = '#toasts{display:none!important}';
    document.head.appendChild(st);
  });
  await page.click('[data-act=boot]');
  await page.waitForTimeout(300);
}

/* Plays a staged scene: auto-aim, simulated movement, chosen wave/event/upgrades. */
async function scene(page, setup, secs) {
  await page.evaluate(([setup]) => {
    Input.aim = () => ({ mode: 'auto' });
    Input.firing = () => true;
    let t = 0;
    Input.moveVector = () => { t += 0.016; return { x: Math.cos(t * 0.7) * 0.6, y: Math.sin(t * 0.9) * 0.6 }; };
    Game.startRun('standard', setup.ship || 'vector');
    const w = W;
    for (const [id, n] of Object.entries(setup.upgrades || {})) for (let i = 0; i < n; i++) applyUpgrade(UPGRADE_BY_ID[id]);
    w.player.maxHp = w.player.hp = 1e9;
    w.banners.length = 0;
    startWave(setup.wave);
    w.banners.length = 0;
    w.introT = 0.01;
    if (setup.event) w.pendingEvent = EVENT_BY_ID[setup.event];
    // fast-forward the simulation so the arena is full of action
    for (let i = 0; i < (setup.warm || 8) * 60; i++) {
      while (Game.state === 'levelup') { W.pendingLevels = 0; Game.resume(); }
      Game.update(1 / 60);
      if (setup.keepBoss && W.boss) W.boss.hp = Math.max(W.boss.hp, W.boss.maxHp * 0.6);
    }
    w.banners.length = 0;
    w.player.maxHp = 100 + Object.keys(w.upgrades).length * 5; w.player.hp = w.player.maxHp * 0.82;
    w.xpNext = 1e12;
    w.pendingLevels = 0;
    w.level = setup.level || 14;
    if (setup.chaos) w.chaos = setup.chaos;
    if (setup.overdrive) activateOverdrive();
    w.banners.length = 0;
    w.hints = null;
    FX.texts.length = 0;
  }, [setup]);
  await page.waitForTimeout(secs * 1000);
  await page.evaluate(() => { W.banners.length = 0; });
}

(async () => {
  const browser = await launch();

  // ---- icon ----
  const ip = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  await ip.setContent(`<html><body style="margin:0;background:transparent">${fs.readFileSync(path.join(ROOT, 'assets', 'icon.svg'), 'utf8').replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`);
  await ip.screenshot({ path: path.join(ROOT, 'build', 'icon.png'), omitBackground: true });
  await ip.close();
  console.log('build/icon.png');

  // ---- key art (cover + capsules): logo over live gameplay ----
  for (const [w, h, name, logo] of [[630, 500, 'cover-630x500', 76], [460, 215, 'capsule-460x215', 54], [616, 353, 'capsule-616x353', 74]]) {
    const scale = 2;
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await boot(p);
    await scene(p, { wave: 13, ship: 'glitch', upgrades: { multishot: 3, overclock: 5, orbital: 3, explosive: 2, chain: 2 }, overdrive: true }, 0.8);
    await p.evaluate(([logo]) => {
      HUD.draw = () => {};
      Save.data.settings.damageNumbers = false;
      FX.texts.length = 0;
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'background:radial-gradient(ellipse at center, rgba(5,1,15,0.55) 0%, rgba(5,1,15,0.15) 60%, rgba(5,1,15,0.6) 100%);pointer-events:none';
      o.innerHTML = '<div class="rainbow" style="font-size:' + logo + 'px">' + 'HYPERCHAOS'.split('').map(c => '<span>' + c + '</span>').join('') + '</div>' +
        '<div class="tagline" style="font-size:' + Math.round(logo * 0.2) + 'px">SUPER SILLY SPACE ADVENTURE</div>';
      document.body.appendChild(o);
    }, [logo]);
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    await p.close();
    console.log('marketing/' + name + '.png');
  }

  // ---- gameplay screenshots ----
  const shots = [
    { name: 'screenshot-1-confetti-party', wave: 9, ship: 'vector', upgrades: { multishot: 4, overclock: 5, hollow: 4, orbital: 3, pierce: 2, chain: 2 } },
    { name: 'screenshot-2-queen-buzz', wave: 5, ship: 'prism', upgrades: { overclock: 3, orbital: 2, drone: 2 }, keepBoss: true, warm: 6 },
    { name: 'screenshot-3-space-whirlpool', wave: 12, ship: 'razor', event: 'singularity', upgrades: { multishot: 2, overclock: 4, homing: 1, explosive: 2 } },
    { name: 'screenshot-4-rainbow-mode', wave: 14, ship: 'glitch', upgrades: { multishot: 3, overclock: 4, explosive: 2, drone: 2, thunder: 2 }, overdrive: true },
    { name: 'screenshot-5-copycat-crystal', wave: 15, ship: 'bulwark', upgrades: { overclock: 5, hollow: 5, pierce: 2, orbital: 4 }, keepBoss: true, warm: 7 },
    { name: 'screenshot-6-falling-stars', wave: 16, ship: 'vector', event: 'meteor', upgrades: { multishot: 3, ricochet: 3, overclock: 5, explosive: 2 } },
  ];
  for (const s of shots) {
    const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await boot(p);
    await scene(p, s, 1.6);
    await p.screenshot({ path: path.join(OUT, s.name + '.png') });
    await p.close();
    console.log('marketing/' + s.name + '.png');
  }
  await browser.close();
})();
