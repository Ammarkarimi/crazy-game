'use strict';
/* Checks that each rival beats the one listed before it (with their own gear and AI). */
const { loadGame, duel } = require('./sim');
const api = loadGame();
const N = +(process.argv[2] || 12);
const O = api.OPPONENTS;
for (let i = 1; i < O.length; i++) {
  const a = O[i - 1], b = O[i];
  let wb = 0;
  for (let k = 0; k < N; k++) {
    const { res } = duel(api,
      { tier: a.tier, style: a.style, fighter: a.fighter, gear: a.gear },
      { tier: b.tier, style: b.style, fighter: b.fighter, gear: b.gear });
    if (res && res.winner === 2) wb++;
  }
  const pa = api.powerRating(api.FIGHTERS.find(f => f.id === a.fighter), a.gear);
  const pb = api.powerRating(api.FIGHTERS.find(f => f.id === b.fighter), b.gear);
  console.log(`${a.name.padEnd(12)} (${a.tier}, ${pa})  vs  ${b.name.padEnd(12)} (${b.tier}, ${pb}):  later rival wins ${wb}/${N}`);
}
