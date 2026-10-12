'use strict';
/* ==========================================================================
   Game content: ships, upgrades, permanent upgrades, achievements, events.
   Tweak numbers here to rebalance the game.
   ========================================================================== */

const SHIPS = [
  {
    id: 'vector', name: 'VECTOR', color: '#00f0ff', cost: 0,
    desc: 'Balanced interceptor. Good at everything, great at nothing.',
    stats: { maxHp: 100, speed: 290, fireRate: 6, damage: 10, shots: 1, spread: 0.1 },
  },
  {
    id: 'razor', name: 'RAZOR', color: '#3dff9e', cost: 350,
    desc: 'Glass speedster. Blistering fire rate and a short-cooldown dash that slices enemies.',
    stats: { maxHp: 70, speed: 350, fireRate: 9.5, damage: 7, dashCd: 0.75, dashDamage: true },
  },
  {
    id: 'bulwark', name: 'BULWARK', color: '#ffb000', cost: 600,
    desc: 'Flying fortress. Thick armor and a five-barrel shotgun. Slow but brutal.',
    stats: { maxHp: 170, speed: 245, fireRate: 2.4, damage: 11, shots: 5, spread: 0.15, armor: 0.15, bulletLife: 0.62 },
  },
  {
    id: 'prism', name: 'PRISM', color: '#b84dff', cost: 900,
    desc: 'Arcane tech. Seeker rounds that hunt targets plus twin orbital blades.',
    stats: { maxHp: 90, speed: 300, fireRate: 5, damage: 9, homing: 1, orbitals: 2 },
  },
  {
    id: 'glitch', name: 'GLITCH', color: '#ff2bd6', cost: 1400,
    desc: 'Unstable prototype. Starts with 3 random upgrades, sees 4 choices, double chaos gain.',
    stats: { maxHp: 100, speed: 310, fireRate: 6, damage: 10, chaosGain: 2, extraChoice: 1 },
    randomStart: 3,
  },
];

const RARITY = {
  common: { w: 62, color: '#9fb4c8', label: 'COMMON' },
  rare: { w: 26, color: '#2f9bff', label: 'RARE' },
  epic: { w: 9, color: '#b84dff', label: 'EPIC' },
  legendary: { w: 3, color: '#ffb400', label: 'LEGENDARY' },
};

const UPGRADES = [
  // ---- common ----
  { id: 'overclock', name: 'Overclock', ico: '»', r: 'common', max: 8, desc: '+15% fire rate', apply: p => { p.rateAdd += 0.15; } },
  { id: 'hollow', name: 'Hollow Points', ico: '✸', r: 'common', max: 8, desc: '+20% damage', apply: p => { p.dmgAdd += 0.2; } },
  { id: 'velocity', name: 'Railgun Coils', ico: '➹', r: 'common', max: 5, desc: '+20% bullet speed, +10% range', apply: p => { p.bulletSpeed *= 1.2; p.bulletLife *= 1.1; } },
  { id: 'thrusters', name: 'Thrusters', ico: '⇶', r: 'common', max: 5, desc: '+9% move speed', apply: p => { p.speed *= 1.09; } },
  { id: 'plating', name: 'Nano Plating', ico: '✚', r: 'common', max: 8, desc: '+20 max HP and heal 20', apply: p => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
  { id: 'magnet', name: 'Tractor Beam', ico: '◎', r: 'common', max: 5, desc: '+35% pickup range', apply: p => { p.magnet *= 1.35; } },
  { id: 'regen', name: 'Regenerator', ico: '♥', r: 'common', max: 6, desc: 'Regenerate +0.6 HP per second', apply: p => { p.regen += 0.6; } },
  { id: 'crit', name: 'Weak Spot', ico: '✦', r: 'common', max: 6, desc: '+8% critical hit chance', apply: p => { p.crit += 0.08; } },
  { id: 'caliber', name: 'Big Caliber', ico: '●', r: 'common', max: 4, desc: '+25% bullet size, +8% damage', apply: p => { p.bulletSize *= 1.25; p.dmgAdd += 0.08; } },
  // ---- rare ----
  { id: 'multishot', name: 'Split Shot', ico: '⁂', r: 'rare', max: 5, desc: '+1 projectile per shot', apply: p => { p.shots += 1; p.spread = Math.max(p.spread, 0.13); } },
  { id: 'pierce', name: 'Piercer', ico: '➶', r: 'rare', max: 5, desc: 'Bullets pierce +1 enemy', apply: p => { p.pierce += 1; } },
  { id: 'ricochet', name: 'Ricochet', ico: '↯', r: 'rare', max: 4, desc: 'Bullets bounce +1 time off walls and enemies', apply: p => { p.bounce += 1; } },
  { id: 'orbital', name: 'Orbital Blade', ico: '✇', r: 'rare', max: 6, desc: '+1 blade orbiting your ship', apply: p => { p.orbitals += 1; } },
  { id: 'drone', name: 'Wingman Drone', ico: '◭', r: 'rare', max: 4, desc: '+1 drone that hunts nearby enemies', apply: p => { p.drones += 1; } },
  { id: 'frost', name: 'Cryo Rounds', ico: '❄', r: 'rare', max: 3, desc: '+15% chance to freeze enemies (60% slow)', apply: p => { p.freeze += 0.15; } },
  { id: 'vampire', name: 'Vampire Core', ico: '♦', r: 'rare', max: 4, desc: '+5% chance to heal 3 HP on kill', apply: p => { p.lifesteal += 0.05; } },
  { id: 'dashmaster', name: 'Blink Drive', ico: '≫', r: 'rare', max: 3, desc: '-22% dash cooldown. Dashing through enemies shreds them', apply: p => { p.dashCd *= 0.78; p.dashDamage = true; } },
  { id: 'battery', name: 'Chaos Battery', ico: '☇', r: 'rare', max: 3, desc: '+30% chaos meter gain', apply: p => { p.chaosGain *= 1.3; } },
  { id: 'critdmg', name: 'Executioner', ico: '✠', r: 'rare', max: 4, desc: '+50% critical damage', apply: p => { p.critMult += 0.5; } },
  { id: 'backshot', name: 'Rear Guns', ico: '⇄', r: 'rare', max: 2, desc: 'Also fire a volley backwards', apply: p => { p.backShot += 1; } },
  { id: 'armor', name: 'Hardened Hull', ico: '⬢', r: 'rare', max: 5, desc: '-8% damage taken', apply: p => { p.armor = Math.min(0.6, p.armor + 0.08); } },
  { id: 'luck', name: 'Lucky Charm', ico: '♣', r: 'rare', max: 3, desc: 'Rarer upgrades and more loot drops', apply: p => { p.luck += 1; } },
  // ---- epic ----
  { id: 'homing', name: 'Seeker AI', ico: '⌖', r: 'epic', max: 3, desc: 'Bullets steer toward enemies', apply: p => { p.homing += 1; } },
  { id: 'explosive', name: 'Explosive Rounds', ico: '✹', r: 'epic', max: 4, desc: 'Bullets explode on impact for area damage', apply: p => { p.explosive += 1; } },
  { id: 'chain', name: 'Tesla Coil', ico: 'ϟ', r: 'epic', max: 4, desc: '25% chance for hits to arc lightning to nearby enemies', apply: p => { p.chain += 1; } },
  { id: 'nova', name: 'Retribution', ico: '✺', r: 'epic', max: 3, desc: 'Taking damage releases a deadly bullet nova', apply: p => { p.novaOnHit += 1; } },
  { id: 'thunder', name: 'Thunder God', ico: '☈', r: 'epic', max: 4, desc: 'Lightning periodically smites random enemies', apply: p => { p.thunder += 1; } },
  { id: 'secondwind', name: 'Second Wind', ico: '☥', r: 'epic', max: 1, desc: 'Revive once with 50% HP', apply: p => { p.secondWind += 1; } },
  // ---- legendary ----
  { id: 'glass', name: 'Glass Cannon', ico: '◇', r: 'legendary', max: 1, desc: '+70% damage, but -30% max HP', apply: p => { p.dmgMul *= 1.7; p.maxHp = Math.round(p.maxHp * 0.7); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: 'storm', name: 'Bullet Storm', ico: '☄', r: 'legendary', max: 1, desc: '+3 projectiles, +25% fire rate, -15% damage', apply: p => { p.shots += 3; p.rateMul *= 1.25; p.dmgMul *= 0.85; p.spread = Math.max(p.spread, 0.16); } },
  { id: 'timewarp', name: 'Time Warp', ico: '⧗', r: 'legendary', max: 1, desc: 'Overdrive lasts 4s longer and charges 25% faster', apply: p => { p.odDuration += 4; p.chaosGain *= 1.25; } },
  { id: 'midas', name: 'Midas Touch', ico: '♛', r: 'legendary', max: 1, desc: 'Kills have an 8% chance to drop shards. +25% score', apply: p => { p.midas = true; } },
  { id: 'hydra', name: 'Hydra Shells', ico: '⋔', r: 'legendary', max: 1, desc: 'Bullets split into two on every hit', apply: p => { p.hydra = true; } },
];
const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

const META = [
  { id: 'hp', name: 'Reinforced Hull', ico: '✚', desc: '+10 max HP per level', cost: [60, 120, 200, 320, 480] },
  { id: 'dmg', name: 'Power Core', ico: '✸', desc: '+6% damage per level', cost: [80, 150, 250, 380, 550] },
  { id: 'speed', name: 'Turbo Engine', ico: '⇶', desc: '+4% move speed per level', cost: [50, 100, 170, 260, 380] },
  { id: 'magnet', name: 'Gravity Lens', ico: '◎', desc: '+15% pickup range per level', cost: [60, 140, 260] },
  { id: 'xp', name: 'Data Miner', ico: '◆', desc: '+8% XP gain per level', cost: [70, 140, 230, 350, 500] },
  { id: 'shard', name: 'Shard Siphon', ico: '♦', desc: '+10% shards earned per level', cost: [100, 200, 320, 480, 700] },
  { id: 'reroll', name: 'Reroll Module', ico: '↻', desc: '+1 upgrade reroll per run', cost: [150, 350, 700] },
  { id: 'chaos', name: 'Overdrive Capacitor', ico: '☇', desc: 'Start runs with +25% chaos meter', cost: [120, 260, 450] },
  { id: 'revive', name: 'Phoenix Chip', ico: '☥', desc: 'Start every run with Second Wind', cost: [1200] },
];

const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Destroy your first enemy', reward: 10 },
  { id: 'wave5', name: 'Warming Up', desc: 'Reach wave 5', reward: 25 },
  { id: 'wave10', name: 'Halfway to Madness', desc: 'Reach wave 10', reward: 50 },
  { id: 'wave15', name: 'Deep Chaos', desc: 'Reach wave 15', reward: 80 },
  { id: 'victory', name: 'Chaos Conqueror', desc: 'Defeat the Chaos Engine on wave 20', reward: 300 },
  { id: 'boss_hive', name: 'Queen Slayer', desc: 'Defeat the Hive Queen', reward: 50 },
  { id: 'boss_obliterator', name: 'Scrap Metal', desc: 'Defeat the Obliterator', reward: 75 },
  { id: 'boss_mirror', name: 'Shattered Reflection', desc: 'Defeat Mirrormind', reward: 100 },
  { id: 'nohit_boss', name: 'Dance Partner', desc: 'Defeat a boss without taking damage during the fight', reward: 120 },
  { id: 'combo50', name: 'Combo Fiend', desc: 'Reach a 50 kill combo', reward: 40 },
  { id: 'combo150', name: 'Unstoppable', desc: 'Reach a 150 kill combo', reward: 100 },
  { id: 'od5', name: 'Overdrive Junkie', desc: 'Trigger Overdrive 5 times in one run', reward: 60 },
  { id: 'level20', name: 'Ascended', desc: 'Reach level 20 in a single run', reward: 60 },
  { id: 'flawless', name: 'Untouchable', desc: 'Clear a wave (3+) without taking damage', reward: 40 },
  { id: 'kills1k', name: 'Exterminator', desc: 'Destroy 1,000 enemies in total', reward: 50 },
  { id: 'kills10k', name: 'Genocide Engine', desc: 'Destroy 10,000 enemies in total', reward: 200 },
  { id: 'legendary', name: 'Jackpot', desc: 'Pick a legendary upgrade', reward: 30 },
  { id: 'events10', name: 'Chaos Tourist', desc: 'Survive 10 chaos events', reward: 40 },
  { id: 'daily', name: 'Daily Dose', desc: 'Reach wave 5 in a Daily Chaos run', reward: 30 },
  { id: 'endless30', name: 'Into the Void', desc: 'Reach wave 30 in Endless mode', reward: 200 },
  { id: 'allships', name: 'Fleet Admiral', desc: 'Unlock every ship', reward: 150 },
  { id: 'rich', name: 'Hoarder', desc: 'Hold 2,000 shards at once', reward: 0 },
  { id: 'nuke', name: 'Tactical Nuke', desc: 'Kill 30 enemies with a single nuke', reward: 40 },
  { id: 'glass_win', name: 'Fragile Genius', desc: 'Win a run with Glass Cannon', reward: 150 },
];

/* ---------------------------------------------------------------------------
   CHAOS EVENTS - random rule-twisting modifiers that last a whole wave.
   Hooks are called by the game: start(), update(dt), end().
   ------------------------------------------------------------------------- */
const EVENTS = [
  {
    id: 'meteor', name: 'METEOR STORM', desc: 'Watch the skies. Meteors hurt everything.', color: '#ff7a00',
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
    id: 'disco', name: 'DISCO INFERNO', desc: 'Double XP. Everybody dance!', color: '#ff2bd6',
    start() { W.xpEventMult = 2; }, end() { W.xpEventMult = 1; },
  },
  {
    id: 'big', name: 'BIG MODE', desc: 'Everything is HUGE. Bullets too.', color: '#3dff9e',
    start() { W.sizeMult = 1.55; for (const e of W.enemies) if (!e.boss) e.r = e.baseR * 1.55; },
    end() { W.sizeMult = 1; for (const e of W.enemies) if (!e.boss) e.r = e.baseR; },
  },
  {
    id: 'hyper', name: 'HYPERSPEED', desc: 'The game runs 35% faster. Double score.', color: '#00f0ff',
    start() { W.speedMult = 1.35; W.scoreEventMult = 2; }, end() { W.speedMult = 1; W.scoreEventMult = 1; },
  },
  {
    id: 'singularity', name: 'SINGULARITY', desc: 'A black hole tears through the arena.', color: '#b84dff',
    start() { addHazard({ kind: 'blackhole', x: ARENA_W / 2, y: ARENA_H / 2, r: 46, pull: 640, life: 9999, ev: true }); },
    update() {
      const bh = W.hazards.find(h => h.kind === 'blackhole' && h.ev);
      if (bh) { bh.x = ARENA_W / 2 + Math.cos(W.t * 0.25) * 520; bh.y = ARENA_H / 2 + Math.sin(W.t * 0.37) * 360; }
    },
    end() { for (const h of W.hazards) if (h.kind === 'blackhole' && h.ev) h.life = 0; },
  },
  {
    id: 'mirror', name: 'MIRROR WORLD', desc: 'Wait... which way is left?', color: '#7dffef',
    start() { W.mirror = true; }, end() { W.mirror = false; },
  },
  {
    id: 'bullethell', name: 'BULLET HELL', desc: 'Every enemy packs a gun now.', color: '#ff3b6b',
    start() { W.allShoot = true; }, end() { W.allShoot = false; },
  },
  {
    id: 'goldrush', name: 'GOLD RUSH', desc: 'Enemies drop shards. Get rich!', color: '#ffe600',
    start() { W.goldRush = true; }, end() { W.goldRush = false; },
  },
  {
    id: 'tiny', name: 'TINY MODE', desc: 'You shrank! Smaller hitbox, more speed.', color: '#9dff00',
    start() { W.tiny = true; }, end() { W.tiny = false; },
  },
  {
    id: 'swarm', name: 'THE SWARM', desc: 'So. Many. Enemies. (They are fragile.)', color: '#ffb000',
    start() { W.spawnEventMult = 2.6; W.hpEventMult = 0.45; }, end() { W.spawnEventMult = 1; W.hpEventMult = 1; },
  },
  {
    id: 'blackout', name: 'BLACKOUT', desc: 'Lights out. Trust your instincts.', color: '#8a8fb8',
    start() { W.blackout = true; }, end() { W.blackout = false; },
  },
  {
    id: 'pinata', name: 'PINATA PARTY', desc: 'Enemies burst into hearts and loot.', color: '#ff8ef0',
    start() { W.pinata = true; }, end() { W.pinata = false; },
  },
];
const EVENT_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e]));
