'use strict';
/* ==========================================================================
   Game content: ships, upgrades, permanent upgrades, achievements, events.
   Tweak numbers here to rebalance the game.
   ========================================================================== */

const SHIPS = [
  {
    id: 'vector', name: 'ZIPPY', color: '#00f0ff', cost: 0,
    desc: 'A happy little rocket. Good at everything!',
    stats: { maxHp: 100, speed: 290, fireRate: 6, damage: 10, shots: 1, spread: 0.1 },
  },
  {
    id: 'razor', name: 'ZOOM', color: '#3dff9e', cost: 350,
    desc: 'Super fast! Shoots lots of tiny bubbles. Dashing bonks Grumpies.',
    stats: { maxHp: 70, speed: 350, fireRate: 9.5, damage: 7, dashCd: 0.75, dashDamage: true },
  },
  {
    id: 'bulwark', name: 'TURTLE', color: '#ffb000', cost: 600,
    desc: 'Big and strong, but slow. Shoots 5 bubbles at once!',
    stats: { maxHp: 170, speed: 245, fireRate: 2.4, damage: 11, shots: 5, spread: 0.15, armor: 0.15, bulletLife: 0.62 },
  },
  {
    id: 'prism', name: 'SPARKLE', color: '#b84dff', cost: 900,
    desc: 'Magic bubbles chase Grumpies, and 2 stars spin around you!',
    stats: { maxHp: 90, speed: 300, fireRate: 5, damage: 9, homing: 1, orbitals: 2 },
  },
  {
    id: 'glitch', name: 'WIGGLES', color: '#ff2bd6', cost: 1400,
    desc: 'Silly and surprising! Starts with 3 random powers.',
    stats: { maxHp: 100, speed: 310, fireRate: 6, damage: 10, chaosGain: 2, extraChoice: 1 },
    randomStart: 3,
  },
];

/* Difficulty. EASY is made for little kids: lots of health, gentle Grumpies,
   3 lives and auto-aim. HARD is the original arcade challenge. */
const DIFFICULTY = {
  easy: {
    id: 'easy', name: 'EASY', ico: '🐣', btn: 'primary', note: 'For little heroes: 3 lives, gentle Grumpies.',
    hp: 2.2, enemyDmg: 0.35, enemyHp: 0.6, enemySpeed: 0.78, bulletSpeed: 0.68, spawn: 0.72, bossHp: 0.45,
    lives: 3, iframes: 1.4, formationWave: 12, elite: 0.4, gems: 1, waveLen: 0.7, noEvents: ['mirror', 'blackout'],
  },
  normal: {
    id: 'normal', name: 'NORMAL', ico: '🙂', btn: 'blue', note: 'A fun challenge: 2 lives.',
    hp: 1.4, enemyDmg: 0.7, enemyHp: 0.85, enemySpeed: 0.9, bulletSpeed: 0.85, spawn: 0.9, bossHp: 0.75,
    lives: 2, iframes: 1.0, formationWave: 8, elite: 0.8, gems: 1.2, waveLen: 0.85, noEvents: [],
  },
  hard: {
    id: 'hard', name: 'HARD', ico: '🔥', btn: 'danger', note: 'For grown-ups and brave kids: 1 life, no mercy!',
    hp: 1, enemyDmg: 1, enemyHp: 1, enemySpeed: 1, bulletSpeed: 1, spawn: 1, bossHp: 1,
    lives: 1, iframes: 0.75, formationWave: 6, elite: 1, gems: 1.5, waveLen: 1, noEvents: [],
  },
};

const RARITY = {
  common: { w: 62, color: '#9fb4c8', label: 'GOOD' },
  rare: { w: 26, color: '#2f9bff', label: 'GREAT' },
  epic: { w: 9, color: '#b84dff', label: 'AMAZING' },
  legendary: { w: 3, color: '#ffb400', label: 'LEGENDARY!' },
};

const UPGRADES = [
  // ---- common ----
  { id: 'overclock', name: 'Fast Fingers', ico: '⚡', r: 'common', max: 8, desc: 'Shoot faster!', apply: p => { p.rateAdd += 0.15; } },
  { id: 'hollow', name: 'Power Up', ico: '💪', r: 'common', max: 8, desc: 'Bubbles hit harder!', apply: p => { p.dmgAdd += 0.2; } },
  { id: 'velocity', name: 'Speedy Shots', ico: '🏹', r: 'common', max: 5, desc: 'Bubbles fly faster and farther!', apply: p => { p.bulletSpeed *= 1.2; p.bulletLife *= 1.1; } },
  { id: 'thrusters', name: 'Zoom Boots', ico: '👟', r: 'common', max: 5, desc: 'Fly faster!', apply: p => { p.speed *= 1.09; } },
  { id: 'plating', name: 'Big Heart', ico: '❤️', r: 'common', max: 8, desc: 'More health, and heal a little!', apply: p => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
  { id: 'magnet', name: 'Star Magnet', ico: '🧲', r: 'common', max: 5, desc: 'Grab stars from far away!', apply: p => { p.magnet *= 1.35; } },
  { id: 'regen', name: 'Band-Aid', ico: '🩹', r: 'common', max: 6, desc: 'Slowly heal all the time!', apply: p => { p.regen += 0.6; } },
  { id: 'crit', name: 'Super Hit', ico: '💫', r: 'common', max: 6, desc: 'More super hits!', apply: p => { p.crit += 0.08; } },
  { id: 'caliber', name: 'Big Bubbles', ico: '🔵', r: 'common', max: 4, desc: 'Bigger, stronger bubbles!', apply: p => { p.bulletSize *= 1.25; p.dmgAdd += 0.08; } },
  // ---- rare ----
  { id: 'multishot', name: 'Double Shot', ico: '✌️', r: 'rare', max: 5, desc: 'One more bubble every shot!', apply: p => { p.shots += 1; p.spread = Math.max(p.spread, 0.13); } },
  { id: 'pierce', name: 'Zoom Through', ico: '➡️', r: 'rare', max: 5, desc: 'Bubbles go right through Grumpies!', apply: p => { p.pierce += 1; } },
  { id: 'ricochet', name: 'Bouncy Shots', ico: '🏀', r: 'rare', max: 4, desc: 'Bubbles bounce around!', apply: p => { p.bounce += 1; } },
  { id: 'orbital', name: 'Spinning Star', ico: '🌟', r: 'rare', max: 6, desc: 'A star spins around you!', apply: p => { p.orbitals += 1; } },
  { id: 'drone', name: 'Robot Buddy', ico: '🤖', r: 'rare', max: 4, desc: 'A little robot helps you!', apply: p => { p.drones += 1; } },
  { id: 'frost', name: 'Ice Pops', ico: '🧊', r: 'rare', max: 3, desc: 'Bubbles can freeze Grumpies!', apply: p => { p.freeze += 0.15; } },
  { id: 'vampire', name: 'Hug Power', ico: '🤗', r: 'rare', max: 4, desc: 'Heal when you cheer up Grumpies!', apply: p => { p.lifesteal += 0.05; } },
  { id: 'dashmaster', name: 'Super Dash', ico: '💨', r: 'rare', max: 3, desc: 'Dash more often and bonk Grumpies!', apply: p => { p.dashCd *= 0.78; p.dashDamage = true; } },
  { id: 'battery', name: 'Rainbow Battery', ico: '🔋', r: 'rare', max: 3, desc: 'Rainbow bar fills faster!', apply: p => { p.chaosGain *= 1.3; } },
  { id: 'critdmg', name: 'Mega Hits', ico: '💥', r: 'rare', max: 4, desc: 'Super hits are even bigger!', apply: p => { p.critMult += 0.5; } },
  { id: 'backshot', name: 'Back Blaster', ico: '🔙', r: 'rare', max: 2, desc: 'Shoot behind you too!', apply: p => { p.backShot += 1; } },
  { id: 'armor', name: 'Bubble Armor', ico: '🛡️', r: 'rare', max: 5, desc: 'Ouchies hurt less!', apply: p => { p.armor = Math.min(0.6, p.armor + 0.08); } },
  { id: 'luck', name: 'Lucky Clover', ico: '🍀', r: 'rare', max: 3, desc: 'Better cards and more treats!', apply: p => { p.luck += 1; } },
  // ---- epic ----
  { id: 'homing', name: 'Smart Bubbles', ico: '🎯', r: 'epic', max: 3, desc: 'Bubbles chase the Grumpies!', apply: p => { p.homing += 1; } },
  { id: 'explosive', name: 'Confetti Pop', ico: '🎉', r: 'epic', max: 4, desc: 'Bubbles pop into confetti blasts!', apply: p => { p.explosive += 1; } },
  { id: 'chain', name: 'Zappy Zap', ico: '🌩️', r: 'epic', max: 4, desc: 'Hits zap to nearby Grumpies!', apply: p => { p.chain += 1; } },
  { id: 'nova', name: 'Ouchie Burst', ico: '🎆', r: 'epic', max: 3, desc: 'Getting hurt shoots bubbles everywhere!', apply: p => { p.novaOnHit += 1; } },
  { id: 'thunder', name: 'Thunder Buddy', ico: '⛈️', r: 'epic', max: 4, desc: 'Lightning helps you from the sky!', apply: p => { p.thunder += 1; } },
  { id: 'secondwind', name: 'Extra Life', ico: '💖', r: 'epic', max: 1, desc: 'Come back once if you run out of health!', apply: p => { p.secondWind += 1; } },
  // ---- legendary ----
  { id: 'glass', name: 'Super Strong', ico: '🦸', r: 'legendary', max: 1, desc: 'Way more power, but less health!', apply: p => { p.dmgMul *= 1.7; p.maxHp = Math.round(p.maxHp * 0.7); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: 'storm', name: 'Bubble Storm', ico: '🌪️', r: 'legendary', max: 1, desc: '3 more bubbles, shoot faster!', apply: p => { p.shots += 3; p.rateMul *= 1.25; p.dmgMul *= 0.85; p.spread = Math.max(p.spread, 0.16); } },
  { id: 'timewarp', name: 'Slow-Mo', ico: '🐌', r: 'legendary', max: 1, desc: 'Rainbow Mode lasts much longer!', apply: p => { p.odDuration += 4; p.chaosGain *= 1.25; } },
  { id: 'midas', name: 'Golden Touch', ico: '👑', r: 'legendary', max: 1, desc: 'Grumpies drop gems! More points!', apply: p => { p.midas = true; } },
  { id: 'hydra', name: 'Split Bubbles', ico: '🍡', r: 'legendary', max: 1, desc: 'Bubbles split in two when they hit!', apply: p => { p.hydra = true; } },
];
const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

const META = [
  { id: 'hp', name: 'Bigger Heart', ico: '❤️', desc: '+10 health', cost: [60, 120, 200, 320, 480] },
  { id: 'dmg', name: 'Power Crystal', ico: '💪', desc: 'Bubbles hit 6% harder', cost: [80, 150, 250, 380, 550] },
  { id: 'speed', name: 'Rocket Boots', ico: '👟', desc: 'Fly 4% faster', cost: [50, 100, 170, 260, 380] },
  { id: 'magnet', name: 'Super Magnet', ico: '🧲', desc: 'Grab stars from farther away', cost: [60, 140, 260] },
  { id: 'xp', name: 'Smart Brain', ico: '🧠', desc: 'Level up 8% faster', cost: [70, 140, 230, 350, 500] },
  { id: 'shard', name: 'Gem Finder', ico: '💎', desc: 'Find 10% more gems', cost: [100, 200, 320, 480, 700] },
  { id: 'reroll', name: 'Lucky Dice', ico: '🎲', desc: '+1 New Cards button use per game', cost: [150, 350, 700] },
  { id: 'chaos', name: 'Rainbow Start', ico: '🌈', desc: 'Start with the rainbow bar 25% full', cost: [120, 260, 450] },
  { id: 'revive', name: 'Extra Life', ico: '💖', desc: 'Start every game with an Extra Life', cost: [1200] },
];

const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Friend', ico: '😊', desc: 'Cheer up your first Grumpy', reward: 10 },
  { id: 'wave5', name: 'Warming Up', ico: '🌟', desc: 'Reach wave 5', reward: 25 },
  { id: 'wave10', name: 'Halfway Hero', ico: '🦸', desc: 'Reach wave 10', reward: 50 },
  { id: 'wave15', name: 'Space Explorer', ico: '🪐', desc: 'Reach wave 15', reward: 80 },
  { id: 'victory', name: 'Superstar', ico: '👑', desc: 'Cheer up King Grumpus on wave 20', reward: 300 },
  { id: 'boss_hive', name: 'Bee Happy', ico: '🐝', desc: 'Cheer up Queen Buzz', reward: 50 },
  { id: 'boss_obliterator', name: 'Robot Friend', ico: '🤖', desc: 'Cheer up Robo Grump', reward: 75 },
  { id: 'boss_mirror', name: 'Mirror Smile', ico: '💎', desc: 'Cheer up Copycat Crystal', reward: 100 },
  { id: 'nohit_boss', name: 'Dance Party', ico: '💃', desc: 'Beat a Big Grumpy without any ouchies', reward: 120 },
  { id: 'combo50', name: 'Combo Kid', ico: '🔥', desc: 'Get a 50 combo', reward: 40 },
  { id: 'combo150', name: 'Unstoppable', ico: '🚀', desc: 'Get a 150 combo', reward: 100 },
  { id: 'od5', name: 'Rainbow Rider', ico: '🌈', desc: 'Use Rainbow Mode 5 times in one game', reward: 60 },
  { id: 'level20', name: 'Level Legend', ico: '🏆', desc: 'Reach level 20 in one game', reward: 60 },
  { id: 'flawless', name: 'No Ouchies', ico: '🛡️', desc: 'Finish a wave (3+) without getting hurt', reward: 40 },
  { id: 'kills1k', name: 'Friend Maker', ico: '🤝', desc: 'Cheer up 1,000 Grumpies', reward: 50 },
  { id: 'kills10k', name: 'Best Friends Forever', ico: '💖', desc: 'Cheer up 10,000 Grumpies', reward: 200 },
  { id: 'legendary', name: 'Jackpot', ico: '🎁', desc: 'Pick a LEGENDARY power', reward: 30 },
  { id: 'events10', name: 'Party Animal', ico: '🥳', desc: 'See 10 surprise events', reward: 40 },
  { id: 'daily', name: 'Daily Explorer', ico: '📅', desc: 'Reach wave 5 in a Daily Surprise', reward: 30 },
  { id: 'endless30', name: 'To Infinity!', ico: '♾️', desc: 'Reach wave 30 in Forever Mode', reward: 200 },
  { id: 'allships', name: 'Rocket Collector', ico: '🛸', desc: 'Get every rocket', reward: 150 },
  { id: 'rich', name: 'Treasure Chest', ico: '💰', desc: 'Have 2,000 gems at once', reward: 0 },
  { id: 'nuke', name: 'Mega Star', ico: '🌠', desc: 'Cheer up 30 Grumpies with one Mega Star', reward: 40 },
  { id: 'glass_win', name: 'Mighty Hero', ico: '💪', desc: 'Win a game with Super Strong', reward: 150 },
];

/* ---------------------------------------------------------------------------
   CHAOS EVENTS - random rule-twisting modifiers that last a whole wave.
   Hooks are called by the game: start(), update(dt), end().
   ------------------------------------------------------------------------- */
const EVENTS = [
  {
    id: 'meteor', name: 'FALLING STARS', desc: 'Dodge the falling stars!', ico: '🌠', color: '#ff7a00',
    start() { W.evTimer = 1; },
    update(dt) {
      W.evTimer -= dt;
      if (W.evTimer <= 0) {
        W.evTimer = rng.range(0.35, 0.8);
        const p = W.player;
        const near = rng.chance(0.45);
        const x = near ? p.x + rng.range(-220, 220) : rng.range(100, ARENA_W - 100);
        const y = near ? p.y + rng.range(-220, 220) : rng.range(100, ARENA_H - 100);
        addHazard({ kind: 'meteor', x: clamp(x, 60, ARENA_W - 60), y: clamp(y, 60, ARENA_H - 60), r: rng.range(70, 115), warn: 1.25 });
      }
    },
  },
  {
    id: 'disco', name: 'DISCO PARTY', desc: 'Double stars! Everybody dance!', ico: '🕺', color: '#ff2bd6',
    start() { W.xpEventMult = 2; }, end() { W.xpEventMult = 1; },
  },
  {
    id: 'big', name: 'GIANT MODE', desc: 'Everything is HUGE!', ico: '🐘', color: '#3dff9e',
    start() { W.sizeMult = 1.55; for (const e of W.enemies) if (!e.boss) e.r = e.baseR * 1.55; },
    end() { W.sizeMult = 1; for (const e of W.enemies) if (!e.boss) e.r = e.baseR; },
  },
  {
    id: 'hyper', name: 'ZOOMIES', desc: 'Everything goes super fast! Double points!', ico: '🏎️', color: '#00f0ff',
    start() { W.speedMult = 1.35; W.scoreEventMult = 2; }, end() { W.speedMult = 1; W.scoreEventMult = 1; },
  },
  {
    id: 'singularity', name: 'SPACE WHIRLPOOL', desc: 'A whirlpool! Don\'t get sucked in!', ico: '🌀', color: '#b84dff',
    start() { addHazard({ kind: 'blackhole', x: ARENA_W / 2, y: ARENA_H / 2, r: 46, pull: 640, life: 9999, ev: true }); },
    update() {
      const bh = W.hazards.find(h => h.kind === 'blackhole' && h.ev);
      if (bh) { bh.x = ARENA_W / 2 + Math.cos(W.t * 0.25) * 520; bh.y = ARENA_H / 2 + Math.sin(W.t * 0.37) * 360; }
    },
    end() { for (const h of W.hazards) if (h.kind === 'blackhole' && h.ev) h.life = 0; },
  },
  {
    id: 'mirror', name: 'SILLY MIRROR', desc: 'Everything is backwards!', ico: '🙃', color: '#7dffef',
    start() { W.mirror = true; }, end() { W.mirror = false; },
  },
  {
    id: 'bullethell', name: 'BUBBLE TROUBLE', desc: 'Grumpies blow bubbles too!', ico: '🧼', color: '#ff3b6b',
    start() { W.allShoot = true; }, end() { W.allShoot = false; },
  },
  {
    id: 'goldrush', name: 'TREASURE TIME', desc: 'Grumpies drop gems!', ico: '💎', color: '#ffe600',
    start() { W.goldRush = true; }, end() { W.goldRush = false; },
  },
  {
    id: 'tiny', name: 'TEENY TINY', desc: 'You shrank! Tiny and speedy!', ico: '🐭', color: '#9dff00',
    start() { W.tiny = true; }, end() { W.tiny = false; },
  },
  {
    id: 'swarm', name: 'GRUMPY PARADE', desc: 'So many Grumpies! (They are wobbly.)', ico: '🎈', color: '#ffb000',
    start() { W.spawnEventMult = 2.6; W.hpEventMult = 0.45; }, end() { W.spawnEventMult = 1; W.hpEventMult = 1; },
  },
  {
    id: 'blackout', name: 'NIGHT LIGHT', desc: 'Lights out! Be brave!', ico: '🔦', color: '#8a8fb8',
    start() { W.blackout = true; }, end() { W.blackout = false; },
  },
  {
    id: 'pinata', name: 'PIÑATA PARTY', desc: 'Grumpies burst into treats!', ico: '🎊', color: '#ff8ef0',
    start() { W.pinata = true; }, end() { W.pinata = false; },
  },
];
const EVENT_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e]));
