'use strict';
/* Generates icons and store art from the live game.
     build/icon.png                 1024x1024 app icon (desktop builds)
     assets/icons/*.png             web app icons
     marketing/screenshot-*.png     1920x1080 gameplay screenshots
     marketing/cover-630x500.png    itch.io cover
     marketing/capsule-460x215.png  Steam header capsule
     marketing/capsule-616x353.png  Steam main capsule
     marketing/hero-1920x620.png    store page banner
   Usage: npm run marketing */
const fs = require('fs');
const path = require('path');
const { launch, GAME_URL } = require('./_browser');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'marketing');
for (const d of [OUT, path.join(ROOT, 'build'), path.join(ROOT, 'assets', 'icons')]) fs.mkdirSync(d, { recursive: true });

async function icons(browser) {
  const svg = fs.readFileSync(path.join(ROOT, 'assets', 'icon.svg'), 'utf8');
  const p = await browser.newPage();
  const shot = async (size, file, opts = {}) => {
    await p.setViewportSize({ width: size, height: size });
    const pad = opts.pad || 0;
    await p.setContent(`<html><body style="margin:0;background:${opts.bg || 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px">
      <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="width:${size - pad * 2}px;height:${size - pad * 2}px"></body></html>`);
    await p.waitForTimeout(100);
    await p.screenshot({ path: file, omitBackground: !opts.bg });
  };
  await shot(1024, path.join(ROOT, 'build', 'icon.png'));
  await shot(512, path.join(ROOT, 'assets', 'icons', 'icon-512.png'));
  await shot(192, path.join(ROOT, 'assets', 'icons', 'icon-192.png'));
  await shot(512, path.join(ROOT, 'assets', 'icons', 'maskable-512.png'), { bg: '#08060c', pad: 56 });
  await shot(180, path.join(ROOT, 'assets', 'icons', 'apple-touch-icon.png'), { bg: '#08060c', pad: 8 });
  await p.close();
}

async function boot(page) {
  await page.goto(GAME_URL);
  await page.evaluate(() => {
    localStorage.clear(); Save.load();
    Save.data.seen.howto = true;
    Save.data.settings.hitNumbers = false;
    Save.data.settings.announcer = false;
    Honors.unlock = () => {};
    Sound.play = () => {};
    const st = document.createElement('style');
    st.textContent = '#toasts{display:none!important} #touch{display:none!important}';
    document.head.appendChild(st);
  });
  await page.click('[data-act=boot]');
  await page.waitForTimeout(300);
}

/* Stage a bot-vs-bot fight and freeze it on a dramatic frame. */
async function fightShot(page, s, file, opts = {}) {
  const ok = await page.evaluate(([s, opts]) => {
    const mk = (fid, gear) => ({ fighter: fid, gear, isPlayer: true, name: FIGHTERS.find(f => f.id === fid).name });
    const m = new Match({
      mode: 'duel', rounds: 3, stage: STAGES.find(x => x.id === s.stage),
      p1: mk(s.a, s.ga), p2: Object.assign(mk(s.b, s.gb), { isPlayer: false, name: s.bName || FIGHTERS.find(f => f.id === s.b).name }),
      brain1: new Brain('master', 'aggressive'), brain2: new Brain('master', s.style || 'aggressive'),
    });
    Game.begin(m, 'fight');
    Game.paused = true;
    if (opts.noHud) HUD.draw = () => {};
    m.f1.hp *= 0.86; m.f2.hp *= 0.62;
    const dmg = m.damage.bind(m);
    m.damage = (def, amt, att, kind) => { amt = Math.min(amt, def.hp - def.maxHp * 0.2); if (amt > 0) dmg(def, amt, att, kind); };
    let found = false;
    for (let i = 0; i < 60 * 150 && !found; i++) {
      m.update(newController(), newController());
      if (m.phase !== 'fight') continue;
      m.timer = 50 * 60;
      if (s.magic && i % 30 === 0) { m.f1.meter = 100; }
      for (const f of m.fighters) { f.hp = Math.max(f.hp, f.maxHp * 0.25); }
      const want = s.want;
      const a = m.f1, b = m.f2;
      const attacking = [a, b].find(f => f.state === 'attack' && f.phase() === 'active' && f.trail.length >= 4);
      const victim = attacking && m.other(attacking);
      const anyTrail = [a, b].find(f => f.trail.length >= 3);
      const hurt = [a, b].find(f => f.state === 'hitstun' && f.flash === 0 && f.stateT <= 5);
      if (want === 'hit' && anyTrail && hurt && anyTrail !== hurt && m.fx.parts.length > 25 && Math.abs(a.x - b.x) < 260) found = true;
      if (want === 'launch' && [a, b].some(f => f.state === 'launched' && f.y > 80 && f.flash === 0) && Math.abs(a.x - b.x) < 320) found = true;
      if (want === 'magic' && m.projectiles.some(p => p.magic && !p.beam && (p.bolt ? p.age >= 33 && p.age <= 36 : p.age > 6 && p.age < 40)) && Math.abs(a.x - b.x) < 600) found = true;
      if (want === 'block' && [a, b].some(f => f.state === 'blockstun' && f.stateT < 2) && attacking) found = true;
      if (want === 'clash' && a.state === 'attack' && b.state === 'attack' && a.trail.length >= 3 && b.trail.length >= 3 && a.flash === 0 && b.flash === 0 && Math.abs(a.x - b.x) < 240) found = true;
    }
    m.fx.texts = [];
    m.banner = null;
    m.timer = 47 * 60;
    m.flashScreen = 0;
    for (let k = 0; k < 2; k++) m.fx.update();
    return found;
  }, [s, opts]);
  await page.waitForTimeout(250);
  await page.screenshot({ path: file });
  return ok;
}

async function logoShot(page, s, file) {
  await fightShot(page, s, file + '.tmp.png', { noHud: true });
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'mkLogo';
    const W = innerWidth, top = innerHeight / innerWidth > 0.6;
    d.style.cssText = `position:fixed;inset:0;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;padding-top:${top ? 7 : 3}%;pointer-events:none;z-index:50;background:linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0) 45%)`;
    d.innerHTML = `<div style="font-family:Cinzel,serif;font-weight:700;font-size:${Math.round(Math.min(W * 0.15, innerHeight * 0.3))}px;letter-spacing:0.12em;line-height:0.9;color:#f6f0e6;text-shadow:0 0 ${W * 0.04}px rgba(200,36,60,0.8),0 4px 0 #000;padding-left:0.12em">UMBRA</div>
      <div style="font-family:Cinzel,serif;font-size:${Math.max(10, Math.round(Math.min(W * 0.026, innerHeight * 0.05)))}px;letter-spacing:0.55em;color:#e8c06a;margin-top:${W * 0.01}px;padding-left:0.55em">DUEL OF SHADOWS</div>`;
    document.body.appendChild(d);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: file });
  await page.evaluate(() => document.getElementById('mkLogo').remove());
  fs.unlinkSync(file + '.tmp.png');
}

const G = (w, wl, a, al, h, hl, r, rl, m, ml) => ({ weapon: [w, wl], armor: [a, al], helmet: [h, hl], ranged: [r, rl], magic: [m, ml] });
const SCENES = [
  { name: 'screenshot-1-shrine-duel', a: 'kage', ga: G('moon', 4, 'lamellar', 3, 'hood', 3, 'shuriken', 3, 'fireball', 3), b: 'ronin', gb: G('katana', 5, 'yoroi', 2, 'kabuto', 3, 'kunai', 2, 'ice', 2), stage: 'shrine', want: 'hit', bName: 'Kuro' },
  { name: 'screenshot-2-volcano-hammer', a: 'brute', ga: G('hammer', 4, 'yoroi', 4, 'oni', 3, 'tAxe', 3, 'quake', 3), b: 'viper', gb: G('fangs', 3, 'lamellar', 3, 'hood', 4, 'kunai', 3, 'drain', 2), stage: 'forge', want: 'hit' },
  { name: 'screenshot-3-lightning', a: 'mystic', ga: G('voidstaff', 3, 'shadowrobe', 4, 'oni', 2, 'chakram', 3, 'lightning', 4), b: 'monk', gb: G('claws', 4, 'shadowrobe', 3, 'band', 3, 'shuriken', 3, 'kiblast', 3), stage: 'gate', want: 'magic', magic: true },
  { name: 'screenshot-4-misty-bridge', a: 'ronin', ga: G('naginata', 4, 'yoroi', 3, 'kabuto', 4, 'chakram', 3, 'ice', 3), b: 'kage', gb: G('dao', 4, 'lamellar', 3, 'hood', 3, 'shuriken', 4, 'fireball', 3), stage: 'bridge', want: 'launch' },
  { name: 'screenshot-5-temple-blades', a: 'viper', ga: G('kama', 4, 'vest', 4, 'hood', 4, 'kunai', 3, 'shadow', 3), b: 'brute', gb: G('axe', 4, 'lamellar', 2, 'straw', 4, 'tAxe', 3, 'quake', 2), stage: 'temple', want: 'hit' },
  { name: 'screenshot-6-bamboo-fire', a: 'kage', ga: G('dragon', 3, 'dragonplate', 2, 'dragonhelm', 2, 'bomb', 2, 'fireball', 4), b: 'mystic', gb: G('staff', 4, 'shadowrobe', 2, 'straw', 3, 'shuriken', 2, 'kiblast', 3), stage: 'bamboo', want: 'magic', magic: true },
];

(async () => {
  const browser = await launch();
  await icons(browser);
  console.log('icons written');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  await boot(page);
  for (const s of SCENES) {
    const ok = await fightShot(page, s, path.join(OUT, s.name + '.png'));
    console.log(`${s.name}.png ${ok ? '' : '(fallback frame)'}`);
  }
  // menu screenshots
  await page.evaluate(() => { Game.toMenu(); Save.data.coins = 4200; Save.data.gems = 35; Save.data.owned.katana = 3; Save.data.owned.vest = 2; Save.data.loadouts.kage.weapon = 'katana'; Save.data.loadouts.kage.armor = 'vest'; Game.refreshMenuFighter(); UI.show('rivals'); UI.act('rival', { dataset: { v: 'kuro' } }); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, 'screenshot-7-rivals.png') });
  await page.evaluate(() => { UI.show('forge'); UI.act('item', { dataset: { v: 'dao' } }); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, 'screenshot-8-forge.png') });
  console.log('menu screenshots written');
  await page.close();

  // capsules with logo
  const art = { a: 'ronin', ga: G('moon', 4, 'yoroi', 3, 'kabuto', 4, 'kunai', 2, 'ice', 2), b: 'brute', gb: G('hammer', 4, 'yoroi', 4, 'oni', 3, 'tAxe', 3, 'quake', 3), stage: 'gate', want: 'hit' };
  for (const [w, h, name] of [[630, 500, 'cover-630x500'], [460, 215, 'capsule-460x215'], [616, 353, 'capsule-616x353'], [1920, 620, 'hero-1920x620']]) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await boot(p);
    await logoShot(p, art, path.join(OUT, name + '.png'));
    await p.close();
    console.log(name + '.png');
  }
  await browser.close();
})();
