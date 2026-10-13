'use strict';
/* Weapon-class balance: same fighter and AI, tier-2 weapon of each class vs the Katana. */
const { loadGame, duel } = require('./sim');
const api = loadGame();
const N = +(process.argv[2] || 16), tier = process.argv[3] || 'hard';
const base = { armor: ['vest', 1], helmet: ['hood', 1], ranged: ['shuriken', 1], magic: ['kiblast', 1] };
const W = { fist: 'knuckles', dual: 'sai', blade: 'katana', pole: 'spear', heavy: 'axe' };
for (const [cls, id] of Object.entries(W)) {
  let w = 0;
  for (let k = 0; k < N; k++) {
    const a = { tier, fighter: 'kage', gear: Object.assign({ weapon: [id, 1] }, base) };
    const b = { tier, fighter: 'kage', gear: Object.assign({ weapon: ['katana', 1] }, base) };
    const { res } = duel(api, k % 2 ? a : b, k % 2 ? b : a);
    if (res && res.winner === (k % 2 ? 1 : 2)) w++;
  }
  console.log(`${cls.padEnd(6)} (${id}) beats katana ${w}/${N}`);
}
