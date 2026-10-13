'use strict';
/* Automated QA: boots the game in Chromium, drives real keyboard input, plays full matches
   with bots, and fails on any page error.  node tools/smoke-test.js */
const { launch, GAME_URL } = require('./_browser');

const fail = m => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = m => console.log('  ok  ' + m);

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(GAME_URL);

  // ---- brand-new player: the tutorial starts by itself and is played with real keys ----
  await page.evaluate(() => { localStorage.clear(); Save.load(); });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => !!(Game.match && Game.match.tutorial)))) fail('fresh boot should start the tutorial');
  const step = () => page.evaluate(() => Game.match && Game.match.tutorial ? Game.match.tutorial.i : -1);
  const until = async (n, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await step() >= n) return true; await page.waitForTimeout(100); } return false; };
  const tut = [];
  await page.keyboard.down('KeyD'); tut.push(await until(1, 8000)); await page.keyboard.up('KeyD');
  for (let i = 0; i < 4 && (await step()) < 2; i++) { for (let k = 0; k < 3; k++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(140); } await page.waitForTimeout(500); }
  tut.push(await until(2, 2000));
  for (let i = 0; i < 5 && (await step()) < 3; i++) { await page.keyboard.press('KeyK'); await page.waitForTimeout(500); }
  tut.push(await until(3, 2000));
  await page.keyboard.down('KeyA'); tut.push(await until(4, 9000)); await page.keyboard.up('KeyA');
  for (let i = 0; i < 8 && (await step()) < 5; i++) { await page.keyboard.press('KeyU'); await page.waitForTimeout(700); }
  tut.push(await until(5, 2000));
  for (let i = 0; i < 8 && (await step()) < 6; i++) { await page.keyboard.press('KeyW'); await page.waitForTimeout(160); await page.keyboard.press('KeyJ'); await page.waitForTimeout(700); }
  tut.push(await until(6, 2000));
  for (let i = 0; i < 6 && (await step()) < 7; i++) { await page.keyboard.press('KeyI'); await page.waitForTimeout(900); }
  tut.push(await until(7, 3000));
  for (let i = 0; i < 80 && (await page.evaluate(() => UI.current)) !== 'results'; i++) { await page.keyboard.down('KeyD'); await page.waitForTimeout(60); await page.keyboard.up('KeyD'); await page.keyboard.press(i % 3 ? 'KeyJ' : 'KeyK'); await page.waitForTimeout(150); }
  await page.waitForTimeout(400);
  tut.push((await page.evaluate(() => UI.current)) === 'results');
  if (tut.includes(false)) fail('tutorial steps ' + JSON.stringify(tut)); else ok('tutorial: move, combo, kick, block, guard break, air attack, magic, knockout - all with real keys');
  await page.click('[data-act=menu]'); await page.waitForTimeout(700);
  const giftShown = await page.evaluate(() => !!document.querySelector('.gate [data-act=claimDaily]'));
  const before = await page.evaluate(() => Save.data.coins);
  if (giftShown) await page.click('[data-act=claimDaily]');
  const after = await page.evaluate(() => Save.data.coins);
  if (!giftShown || after !== before + 100) fail(`daily gift (shown ${giftShown}, ${before} -> ${after})`); else ok('daily gift shown and claimed (+100)');

  await page.evaluate(() => { localStorage.clear(); Save.load(); Save.data.seen.howto = true; Save.data.seen.tutorial = true; Save.data.daily.last = new Date().toDateString(); UI.show('boot', false); });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  if (await page.evaluate(() => UI.current) !== 'title') fail('title screen'); else ok('boot -> title');

  // menus
  for (const s of ['rivals', 'forge', 'dojo', 'versus', 'settings', 'howto', 'achievements']) {
    await page.evaluate(s => UI.show(s), s); await page.waitForTimeout(120);
    if (await page.evaluate(() => document.querySelector('.screen.active').id) !== 'scr-' + s) fail('screen ' + s);
  }
  ok('all menu screens open');
  // keyboard menu navigation
  await page.evaluate(() => UI.home());
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  ok('keyboard navigation -> ' + await page.evaluate(() => UI.current));
  await page.evaluate(() => UI.home());

  // forge economy
  const forge = await page.evaluate(() => {
    Save.data.coins = 5000;
    UI.show('forge'); UI.buyItem('katana'); UI.upgradeItem('katana');
    return { owned: Save.data.owned.katana, eq: Save.data.loadouts.kage.weapon, coins: Save.data.coins };
  });
  if (forge.owned !== 2 || forge.eq !== 'katana' || forge.coins !== 5000 - 800 - 290) fail('forge buy/upgrade ' + JSON.stringify(forge)); else ok('forge buy + upgrade + equip');

  const nx = await page.evaluate(() => { UI.home(); return document.getElementById('nextInfo').innerText; });
  if (!/Old Hiro/.test(nx)) fail('next duel label ' + nx); else ok('NEXT DUEL points at the first unbeaten rival: ' + nx);

  // real keyboard control in a duel
  await page.evaluate(() => { UI.rivalSel = 'kenta'; Game.startDuel('kenta', 3, 0); });
  await page.waitForFunction(() => Game.match && Game.match.phase === 'fight', null, { timeout: 8000 });
  await page.evaluate(() => { Game.match.brain2 = new DummyBrain('stand'); });
  const seen = new Set();
  const watch = async () => seen.add(await page.evaluate(() => Game.match.f1.state + ':' + (Game.match.f1.move ? Game.match.f1.move.id : '')));
  await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await watch(); await page.keyboard.up('KeyD');
  for (const k of ['KeyJ', 'KeyJ', 'KeyJ']) { await page.keyboard.press(k); await page.waitForTimeout(110); await watch(); }
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyK'); await page.waitForTimeout(80); await watch(); await page.waitForTimeout(400);
  await page.keyboard.press('KeyU'); await page.waitForTimeout(150); await watch(); await page.waitForTimeout(700);
  await page.keyboard.down('KeyS'); await page.keyboard.press('KeyK'); await page.waitForTimeout(100); await watch(); await page.keyboard.up('KeyS'); await page.waitForTimeout(500);
  await page.keyboard.press('KeyL'); await page.waitForTimeout(150); await watch(); await page.waitForTimeout(400);
  await page.evaluate(() => { Game.match.f1.meter = 100; });
  await page.keyboard.press('KeyI'); await page.waitForTimeout(120); await watch(); await page.waitForTimeout(700);
  await page.keyboard.press('KeyO'); await page.waitForTimeout(100); await watch(); await page.waitForTimeout(500);
  await page.keyboard.press('KeyW'); await page.waitForTimeout(150); await watch();
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(100); await watch();
  await page.waitForTimeout(600);
  const need = ['walk:', 'attack:light1', 'attack:kick', 'attack:heavy', 'attack:sweep', 'attack:throw', 'attack:cast', 'roll:', 'attack:air'];
  const states = [...seen].join(' ');
  const missing = need.filter(n => !states.includes(n));
  if (missing.length) fail('controls missing ' + missing.join(',') + ' saw ' + states); else ok('keyboard controls: walk, combo, kick, heavy, sweep, throw, magic, roll, air attack');
  const hits = await page.evaluate(() => Game.match.hitLog.filter(h => h.att === 1).length);
  if (!hits) fail('no hits landed'); else ok(`player landed ${hits} hits/blocks`);

  // pause
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  if (!(await page.evaluate(() => Game.paused))) fail('pause');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  if (await page.evaluate(() => Game.paused)) fail('resume'); else ok('pause / resume');

  // let bots finish the duel and check rewards
  const coinsBefore = await page.evaluate(() => Save.data.coins);
  await page.evaluate(() => { const m = Game.match; m.brain1 = new Brain('legend', 'aggressive'); m.brain2 = new Brain('novice', 'balanced'); });
  await page.waitForFunction(() => UI.current === 'results', null, { timeout: 240000, polling: 500 });
  const res = await page.evaluate(() => ({ coins: Save.data.coins, rec: Save.record('kenta'), txt: document.getElementById('resultPanel').innerText.slice(0, 40) }));
  if (res.coins <= coinsBefore) fail('no coins rewarded'); else ok(`duel finished: "${res.txt.split('\n')[0]}", coins ${coinsBefore} -> ${res.coins}, record ${JSON.stringify(res.rec)}`);

  // every rival & arena can load and fight a few seconds (bot vs bot, sped up)
  for (const o of await page.evaluate(() => OPPONENTS.map(o => o.id))) {
    await page.evaluate(id => { Game.startDuel(id, 1, -1); Game.match.brain1 = new Brain('hard', 'balanced'); for (let i = 0; i < 900; i++) Game.match.update(newController(), newController()); }, o);
  }
  ok('all 14 rivals fight 15s each without errors');

  // versus + training
  await page.evaluate(() => { Game.startVersus({ a: 1, b: 3, stage: 2, rounds: 1 }); Game.match.brain1 = new Brain('hard'); Game.match.brain2 = new Brain('hard'); });
  await page.waitForFunction(() => UI.current === 'results', null, { timeout: 240000, polling: 500 });
  ok('versus match completes: ' + (await page.evaluate(() => document.getElementById('resultPanel').innerText.split('\n')[0])));
  await page.evaluate(() => Game.startTraining());
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyT'); await page.waitForTimeout(100);
  const dm = await page.evaluate(() => Game.match.dummyMode);
  if (dm !== 'block') fail('training dummy cycle'); else ok('training mode + dummy switch');
  await page.evaluate(() => Game.quitMatch());

  // mobile layout + touch controls
  const m = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  m.on('pageerror', e => errors.push('mobile: ' + e.message));
  await m.goto(GAME_URL);
  await m.evaluate(() => { Save.data.seen.howto = true; });
  await m.tap('[data-act=boot]'); await m.waitForTimeout(300);
  await m.evaluate(() => Game.startDuel('hiro', 1, 0));
  await m.waitForTimeout(2200);
  const touchVisible = await m.evaluate(() => getComputedStyle(document.getElementById('touch')).display !== 'none');
  await m.tap('[data-btn=attack]'); await m.waitForTimeout(80);
  const st = await m.evaluate(() => Game.match.f1.state);
  if (!touchVisible || st !== 'attack') fail(`touch controls (visible ${touchVisible}, state ${st})`); else ok('touch controls visible and attack button works');

  if (errors.length) { fail('page errors:\n' + errors.slice(0, 10).join('\n')); }
  else ok('no page errors');
  await browser.close();
  console.log(process.exitCode ? '\nSMOKE TEST FAILED' : '\nAll smoke tests passed.');
})();
