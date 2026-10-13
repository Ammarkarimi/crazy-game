'use strict';
/* Economy check: a bot "player" starts from a fresh save, spends coins in the Forge
   and challenges rivals. Reports how many matches (and minutes) each tier takes.
   node tools/progression.js [skillTier] [maxMatches] */
const { loadGame, duel } = require('./sim');
const api = loadGame();
const skill = process.argv[2] || 'normal';
const MAX = +(process.argv[3] || 400);
const vm = require('vm');

// pull pricing helpers from the game
const ctx = {};
const T = Object.fromEntries(api.TIERS.map((t, i) => [t.id, Object.assign(t, { index: i })]));
const ITEM = Object.fromEntries(api.ITEMS.map(i => [i.id, i]));
const itemStat = (it, k, l) => (it[k] || 0) * (1 + 0.18 * (l - 1));
const upgradeCost = (it, l) => { const base = it.gems ? 2400 + it.tier * 900 : Math.max(220, it.price); return Math.round(base * 0.36 * l / 10) * 10; };

const save = { coins: 300, gems: 5, owned: {}, wins: {}, frames: 0 };
for (const it of api.ITEMS) if (!it.price && !it.gems) save.owned[it.id] = 1;
const lo = { weapon: 'bokken', armor: 'gi', helmet: 'band', ranged: 'shuriken', magic: 'kiblast' };
const gear = () => Object.fromEntries(Object.entries(lo).map(([s, id]) => [s, [id, save.owned[id]]]));

const weaponLine = ['katana', 'dao', 'moon', 'dragon'];
const armorLine = ['vest', 'lamellar', 'yoroi', 'dragonplate'];
const helmLine = ['hood', 'kabuto', 'oni', 'dragonhelm'];
const magicLine = ['fireball', 'lightning', 'quake', 'drain'];
function shop() {
  let bought = true;
  while (bought) {
    bought = false;
    for (const line of [weaponLine, armorLine, helmLine, magicLine]) {
      const next = line.find(id => !save.owned[id]);
      if (!next) continue;
      const it = ITEM[next];
      const slot = it.slot;
      const curIdx = line.indexOf(lo[slot]);
      if (line.indexOf(next) <= curIdx) continue;
      if (it.gems ? save.gems >= it.gems : save.coins >= it.price) {
        if (it.gems) save.gems -= it.gems; else save.coins -= it.price;
        save.owned[next] = 1; lo[slot] = next; bought = true;
      }
    }
    // upgrade equipped weapon/armor/helmet if we have spare coins (keep a reserve for the next weapon)
    for (const slot of ['weapon', 'armor', 'helmet', 'magic']) {
      const it = ITEM[lo[slot]], lvl = save.owned[it.id];
      if (lvl >= 5) continue;
      const c = upgradeCost(it, lvl);
      if (save.coins >= c * 1.6) { save.coins -= c; save.owned[it.id]++; bought = true; }
    }
  }
}

const O = api.OPPONENTS;
let target = 0, streakLoss = 0, matches = 0;
const firstReach = {};
while (matches < MAX && target < O.length) {
  shop();
  const o = O[target];
  const { res, frames } = duel(api, { tier: skill, fighter: 'kage', gear: gear() }, { tier: o.tier, style: o.style, fighter: o.fighter, gear: o.gear });
  matches++; save.frames += frames;
  const t = T[o.tier];
  if (res && res.winner === 1) {
    save.coins += t.reward; if (!save.wins[o.id]) save.gems += t.gems; save.gems += Math.max(0, t.index - 3);
    save.wins[o.id] = (save.wins[o.id] || 0) + 1;
    if (!firstReach[o.tier]) firstReach[o.tier] = { matches, minutes: Math.round(save.frames / 3600) };
    target++; streakLoss = 0;
  } else {
    save.coins += Math.round(t.reward * 0.35);
    streakLoss++;
    if (streakLoss >= 2 && target > 0) { // farm the toughest rival already beaten
      for (let k = 0; k < 3; k++) {
        const f = O[target - 1];
        const r2 = duel(api, { tier: skill, fighter: 'kage', gear: gear() }, { tier: f.tier, style: f.style, fighter: f.fighter, gear: f.gear });
        matches++; save.frames += r2.frames;
        const tt = T[f.tier];
        save.coins += r2.res && r2.res.winner === 1 ? tt.reward + Math.max(0, tt.index - 3) * 0 : Math.round(tt.reward * 0.35);
        if (r2.res && r2.res.winner === 1) save.gems += Math.max(0, tt.index - 3);
      }
      streakLoss = 0;
    }
  }
}
console.log(`player skill = ${skill}, matches played ${matches}, play time ~${Math.round(save.frames / 3600)} min (fights only)`);
for (const t of api.TIERS) console.log(`  first ${t.id.padEnd(7)} win: ${firstReach[t.id] ? `match ${firstReach[t.id].matches}, ~${firstReach[t.id].minutes} min` : 'not yet'}`);
console.log('  final gear:', JSON.stringify(gear()), 'coins', save.coins, 'gems', save.gems);
