'use strict';
/* Headless duel simulator for balance testing: runs the real game logic in Node.
   node tools/sim.js [matches] [tierA] [tierB] [fighterA] [fighterB] [gearA] [gearB]
   gear = "start" (each fighter's starting kit) or an opponent id to copy their kit. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = ['util', 'data', 'moves', 'render', 'fighter', 'ai', 'fx', 'game'];
function loadGame() {
  const ctx = {
    window: {}, console, Math, performance: { now: () => Date.now() },
    localStorage: { getItem: () => null, setItem() {} },
  };
  ctx.Save = { data: { settings: { shake: 1, hitNumbers: false, announcer: false } } };
  ctx.Sound = { play() {} };
  ctx.Voice = { say() {} };
  vm.createContext(ctx);
  const code = SRC.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f + '.js'), 'utf8')).join('\n;\n')
    + '\n;this.__api = { Match, Brain, FIGHTERS, OPPONENT, OPPONENTS, TIERS, STAGES, ITEMS, powerRating };';
  vm.runInContext(code, ctx);
  return ctx.__api;
}

function gearOf(api, fighterId, spec) {
  if (spec && api.OPPONENT[spec]) return Object.assign({}, api.OPPONENT[spec].gear);
  const f = api.FIGHTERS.find(x => x.id === fighterId);
  const g = {};
  for (const s of ['weapon', 'armor', 'helmet', 'ranged', 'magic']) g[s] = [f.start[s], 1];
  if (spec && spec.startsWith('lvl')) { const L = +spec.slice(3); for (const s in g) g[s][1] = L; }
  return g;
}

function duel(api, a, b, maxFrames = 60 * 60 * 6) {
  let res = null;
  const m = new api.Match({
    mode: 'duel', sim: true, rounds: 3, stage: api.STAGES[0],
    p1: { fighter: a.fighter, gear: a.gear, name: 'A' },
    p2: { fighter: b.fighter, gear: b.gear, name: 'B' },
    brain1: new api.Brain(a.tier, a.style || 'balanced'),
    brain2: new api.Brain(b.tier, b.style || 'balanced'),
    onEnd: r => { res = r; },
  });
  let n = 0;
  while (!res && n < maxFrames) { m.update(null, null); n++; }
  return { res, m, frames: n };
}

if (require.main === module) {
  const api = loadGame();
  const [N = '20', tA = 'normal', tB = 'normal', fA = 'kage', fB = 'kage', gA = 'start', gB = 'start'] = process.argv.slice(2);
  let w = [0, 0, 0], frames = 0, hits = { 1: 0, 2: 0 }, kinds = {}, combos = 0, timeouts = 0;
  for (let i = 0; i < +N; i++) {
    const { res, m, frames: fr } = duel(api,
      { tier: tA, fighter: fA, gear: gearOf(api, fA, gA) },
      { tier: tB, fighter: fB, gear: gearOf(api, fB, gB) });
    if (!res) { timeouts++; continue; }
    w[res.winner]++; frames += fr;
    for (const h of m.hitLog) { kinds[h.type] = (kinds[h.type] || 0) + 1; if (h.type === 'hit' || h.type === 'crit') hits[h.att]++; }
    combos = Math.max(combos, m.f1.stats.maxCombo, m.f2.stats.maxCombo);
    for (const r of res.rounds) if (r.finish === 'time') kinds.timeRounds = (kinds.timeRounds || 0) + 1;
  }
  const done = w[0] + w[1] + w[2];
  console.log(`${tA} ${fA}/${gA}  vs  ${tB} ${fB}/${gB}:  A ${w[1]}  B ${w[2]}  draw ${w[0]}  stuck ${timeouts}`);
  console.log(`  avg match ${(frames / Math.max(1, done) / 60).toFixed(1)}s, hits A ${hits[1]} B ${hits[2]}, best combo ${combos}`, JSON.stringify(kinds));
}

module.exports = { loadGame, duel, gearOf };
