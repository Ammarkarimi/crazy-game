'use strict';
/* ==========================================================================
   Core game: run state, main loop, wave director, combat, pickups, hazards,
   camera and world rendering.
   ========================================================================== */

const ARENA_W = 2400, ARENA_H = 1700;
const STANDARD_WAVES = 20;

let W = null; // the active run

const _hits = [];

/* ---------------------------------------------------------------------------
   Global combat helpers (used by player / enemies / bosses)
   ------------------------------------------------------------------------- */
function shake(amount) { Game.cam.trauma = Math.min(1, Game.cam.trauma + amount); }

function banner(text, sub, color = '#ffffff', dur = 2.2) {
  W.banners.push({ text, sub, color, t: 0, dur });
}

function screenFlash(color, a) {
  if (!Save.data.settings.flashes) a *= 0.3;
  W.flash = { color, a: Math.max(W.flash ? W.flash.a : 0, a) };
}

function addHazard(h) {
  h.t = 0;
  W.hazards.push(h);
  return h;
}

function enemyBullet(x, y, a, speed, o = {}) {
  if (W.ebullets.length > 1400) return;
  W.ebullets.push({
    x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed,
    r: (o.r || 6) * (W.sizeMult || 1), dmg: o.dmg || 10 * W.dmgScale,
    color: o.color || '#ff3b6b', life: o.life || 7, homing: o.homing || 0,
    delay: o.delay || 0, aimAtPlayer: !!o.aimAtPlayer,
  });
}

function comboMult() { return 1 + Math.min(4, W.combo * 0.02); }

function addChaos(n) {
  if (W.overdrive > 0 || W.dying > 0) return;
  const before = W.chaos;
  W.chaos = Math.min(100, W.chaos + n);
  if (before < 100 && W.chaos >= 100) {
    Sound.play('ready');
    const p = W.player;
    FX.text(p.x, p.y - 40, 'OVERDRIVE READY', '#ff2bd6', 18, 1.4, { pop: 0.5 });
  }
}

function damageEnemy(e, dmg, o = {}) {
  if (e.dead || e.spawnT > 0) return false;
  const p = W.player;
  const crit = o.crit !== undefined ? o.crit : Math.random() < p.crit * 0.5;
  if (crit) dmg *= p.critMult;
  if (W.overdrive > 0) dmg *= 1.25;
  e.hp -= dmg;
  e.flash = 0.07;
  W.stats.damage += dmg;
  if (o.kx !== undefined) {
    const k = 1 - e.knockRes;
    e.vx += o.kx * k; e.vy += o.ky * k;
  }
  if (Save.data.settings.damageNumbers && FX.texts.length < 70) {
    FX.text(e.x + frand(-10, 10), e.y - e.r - 4, String(Math.max(1, Math.round(dmg))), crit ? '#ffe600' : '#ffffff', crit ? 19 : 13, 0.55, { vy: -90, pop: crit ? 0.6 : 0 });
  }
  if (e.boss) {
    Sound.play('bossHit');
    addChaos(0.08 * p.chaosGain);
  } else Sound.play(crit ? 'crit' : 'hit');
  if (e.hp <= 0) killEnemy(e, o);
  return crit;
}

function aoeDamage(x, y, R, dmg, o = {}) {
  const list = Game.sgrid.query(x, y, R, []);
  let n = 0;
  for (const e of list) {
    if (e.dead || e.spawnT > 0 || e === o.exclude) continue;
    if (dist2(x, y, e.x, e.y) < (R + e.r) ** 2) {
      const a = angleTo(x, y, e.x, e.y);
      damageEnemy(e, dmg, { kx: Math.cos(a) * 180, ky: Math.sin(a) * 180, noChain: o.noChain });
      n++;
    }
  }
  return n;
}

function chainLightning(e, dmg, jumps) {
  let cur = e;
  const done = [e];
  for (let j = 0; j < jumps; j++) {
    let best = null, bd = 230 * 230;
    for (const o of W.enemies) {
      if (o.dead || o.spawnT > 0 || done.includes(o)) continue;
      const d = dist2(cur.x, cur.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) break;
    FX.bolt(cur.x, cur.y, best.x, best.y, '#9ff', 0.16, 14);
    done.push(best);
    damageEnemy(best, dmg, { noChain: true });
    cur = best;
  }
  if (done.length > 1) Sound.play('zap');
}

function killEnemy(e, o = {}) {
  if (e.dead) return;
  e.dead = true;
  const p = W.player;
  if (e.boss) { bossDefeated(e); return; }

  const sc = e.elite ? 2.2 : clamp(e.r / 16, 0.6, 1.6);
  FX.explosion(e.x, e.y, e.color[0] === '#' ? e.color : '#ff2bd6', sc);
  FX.debris(e.x, e.y, e.color, 4 + Math.round(e.r / 5), 260, Math.max(4, e.r * 0.45));
  Game.grid.impulse(e.x, e.y, 200 + e.r * 7, 80 + e.r * 3.5);
  Sound.play('kill', e.r > 20 ? 0.7 : 1);
  if (e.elite) shake(0.25);

  if (e.def.onDeath) e.def.onDeath(e);
  if (o.noLoot) return;

  W.kills++;
  W.combo++;
  W.comboT = 2.6;
  if (W.combo > W.maxCombo) W.maxCombo = W.combo;
  if (W.combo === 50) Achievements.unlock('combo50');
  if (W.combo === 150) Achievements.unlock('combo150');
  if (W.kills === 1) Achievements.unlock('first_blood');
  if (o.nuke) W.nukeKills++;

  W.score += e.score * comboMult() * W.scoreEventMult * (p.midas ? 1.25 : 1) * (W.overdrive > 0 ? 1.5 : 1);
  addChaos((e.elite ? 9 : 1.15) * p.chaosGain);

  dropXP(e.x, e.y, e.xp * (W.pinata ? 2 : 1));
  const luck = p.luck;
  if (rng.chance(0.011 + (e.elite ? 0.35 : 0) + (W.pinata ? 0.12 : 0) + luck * 0.004)) dropPickup('heart', e.x, e.y, 1);
  let shardChance = 0.018 + luck * 0.008 + (W.goldRush ? 0.4 : 0) + (p.midas ? 0.08 : 0) + (e.elite ? 1 : 0);
  if (rng.chance(shardChance)) dropPickup('shard', e.x, e.y, e.elite ? 5 : W.goldRush ? rng.int(1, 3) : 1);
  if (rng.chance(0.004 + (e.elite ? 0.12 : 0) + luck * 0.002)) dropPickup('magnet', e.x, e.y, 1);
  if (rng.chance(0.0025 + (e.elite ? 0.06 : 0) + (W.pinata ? 0.01 : 0))) dropPickup('nuke', e.x, e.y, 1);
  if (rng.chance(0.006 + (e.elite ? 0.2 : 0))) dropPickup('chaos', e.x, e.y, 1);
  if (W.pinata) FX.sparks(e.x, e.y, hsl(frand(0, 360), 100, 65), 14, 380, 0.8, { grav: 500, drag: 1.5 });
  if (p.lifesteal > 0 && rng.chance(p.lifesteal)) healPlayer(3);
}

function healPlayer(n) {
  const p = W.player;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + n);
  const got = p.hp - before;
  if (got >= 1) FX.text(p.x, p.y - 26, '+' + Math.round(got), '#3dff9e', 15, 0.7);
}

function damagePlayer(dmg, sx, sy) {
  const p = W.player;
  if (W.dying > 0 || p.iframes > 0 || p.dashTime > 0 || W.overdrive > 0 || W.bossDeath || W.waveState === 'clear') return false;
  dmg *= 1 - p.armor;
  p.hp -= dmg;
  p.iframes = 0.75;
  p.hurtT = 0.15;
  W.stats.taken += dmg;
  W.waveHit = true;
  if (W.boss) W.bossHitTaken = true;
  W.combo = Math.floor(W.combo / 2);
  shake(0.5);
  screenFlash('#ff0030', 0.35);
  W.hitstop = 0.05;
  if (sx !== undefined) {
    const a = angleTo(sx, sy, p.x, p.y);
    p.vx += Math.cos(a) * 380; p.vy += Math.sin(a) * 380;
  }
  Sound.play('hurt');
  FX.sparks(p.x, p.y, '#ff3b6b', 22, 380, 0.5);
  FX.text(p.x, p.y - 24, '-' + Math.round(dmg), '#ff3b6b', 20, 0.8, { pop: 0.4 });
  Game.grid.impulse(p.x, p.y, 500, 180);

  if (p.novaOnHit > 0) {
    const n = 12 + p.novaOnHit * 6;
    for (let i = 0; i < n; i++) spawnBullet(p.x, p.y, i / n * TAU, p, 1.5, { life: 0.7, color: '#ffe600' });
    FX.ring(p.x, p.y, '#ffe600', 10, 120, 0.35, 5);
  }

  if (p.hp <= 0) {
    if (p.secondWind > 0) revivePlayer();
    else playerDie();
  }
  return true;
}

function revivePlayer() {
  const p = W.player;
  p.secondWind--;
  p.hp = p.maxHp * 0.5;
  p.iframes = 2.5;
  W.hitstop = 0.25;
  for (const b of W.ebullets) b.life = 0;
  aoeDamage(p.x, p.y, 450, p.damage * 15 + 100 * W.hpScale);
  FX.ring(p.x, p.y, '#ffe600', 10, 450, 0.7, 10);
  FX.explosion(p.x, p.y, '#ffe600', 3);
  Game.grid.impulse(p.x, p.y, 1800, 600);
  shake(0.8);
  screenFlash('#ffe600', 0.6);
  banner('SECOND WIND', 'Back from the brink!', '#ffe600', 1.8);
  Sound.play('revive');
}

function playerDie() {
  const p = W.player;
  W.dying = 2.0;
  p.hp = 0;
  FX.explosion(p.x, p.y, p.color, 5);
  FX.explosion(p.x, p.y, '#ffffff', 2);
  FX.debris(p.x, p.y, p.color, 24, 420, 8);
  Game.grid.impulse(p.x, p.y, 2400, 700);
  shake(1);
  screenFlash('#ffffff', 0.8);
  Sound.play('bigBoom');
  Sound.setMuffle(true);
}

function dropPickup(kind, x, y, value) {
  W.pickups.push({
    kind, x, y, vx: frand(-110, 110), vy: frand(-110, 110), value,
    r: kind === 'xp' ? (value >= 25 ? 9 : value >= 5 ? 7 : 5) : 11,
    t: 0, magnet: false, life: kind === 'xp' ? Infinity : 16,
  });
}

function dropXP(x, y, amount) {
  amount = Math.round(amount);
  let xpCount = 0;
  for (const pk of W.pickups) if (pk.kind === 'xp') xpCount++;
  while (amount > 0) {
    const v = amount >= 25 ? 25 : amount >= 5 ? 5 : 1;
    amount -= v;
    if (xpCount > 380) {
      // merge into an existing gem to keep things fast
      const g = W.pickups[Math.floor(frand(0, W.pickups.length))];
      if (g && g.kind === 'xp') { g.value += v; g.r = g.value >= 25 ? 9 : g.value >= 5 ? 7 : 5; continue; }
    }
    dropPickup('xp', x + frand(-6, 6), y + frand(-6, 6), v);
    xpCount++;
  }
}

function xpNeed(l) { return Math.floor(5 + l * 4 + Math.pow(l, 1.55) * 1.2); }

function addXP(v) {
  const p = W.player;
  W.xp += v * p.xpMult * W.xpEventMult;
  while (W.xp >= W.xpNext) {
    W.xp -= W.xpNext;
    W.level++;
    W.pendingLevels++;
    W.xpNext = xpNeed(W.level);
    if (W.level === 20) Achievements.unlock('level20');
  }
}

/* ---------------------------------------------------------------------------
   Boss defeat & wave flow
   ------------------------------------------------------------------------- */
function bossDefeated(e) {
  const id = BOSS_ORDER.find(k => BOSSES[k] === e.bossDef);
  W.bossKills++;
  Save.data.stats.bossKills++;
  if (id === 'hive') Achievements.unlock('boss_hive');
  if (id === 'obliterator') Achievements.unlock('boss_obliterator');
  if (id === 'mirror') Achievements.unlock('boss_mirror');
  if (!W.bossHitTaken) Achievements.unlock('nohit_boss');
  W.score += e.score * comboMult();
  W.boss = null;
  W.bossDeath = { x: e.x, y: e.y, t: 2.4, color: e.bossDef.color, tick: 0, r: e.r };
  W.hitstop = 0.3;
  Sound.play('bigBoom');
  shake(1);
  screenFlash('#ffffff', 0.7);
  for (const o of W.enemies) if (!o.dead && o !== e) o.dieAt = W.t + frand(0.1, 1.2);
  for (const b of W.ebullets) b.life = 0;
  for (const h of W.hazards) if (h.owner === e) h.life = 0, h.t = 1e9;
  // loot shower
  for (let i = 0; i < 30; i++) dropXP(e.x + frand(-80, 80), e.y + frand(-80, 80), e.xp / 30 * 3);
  for (let i = 0; i < 8 + Math.floor(W.wave / 2); i++) dropPickup('shard', e.x + frand(-60, 60), e.y + frand(-60, 60), 2);
  dropPickup('heart', e.x, e.y, 1);
  dropPickup('heart', e.x + 30, e.y, 1);
  addChaos(40);
}

function pickEvent() {
  const r = W.eventRng;
  let pool = EVENTS.filter(ev => ev.id !== W.lastEventId);
  if (W.wave < 4) pool = pool.filter(ev => ev.id !== 'blackout' && ev.id !== 'mirror');
  return r.pick(pool);
}

function startWave(n) {
  W.wave = n;
  W.waveState = 'intro';
  W.introT = 2.6;
  W.waveT = 0;
  W.spawnT = 0.4;
  W.waveHit = false;
  W.isBossWave = n % 5 === 0;
  W.hpScale = 1 + 0.17 * (n - 1) + 0.011 * (n - 1) ** 2;
  W.dmgScale = 1 + 0.05 * (n - 1);
  W.spdScale = 1 + Math.min(0.3, 0.012 * (n - 1));
  W.waveDuration = W.isBossWave ? 0 : 26 + Math.min(n, 20) * 1.3;
  W.pendingEvent = null;
  if (!W.isBossWave && n >= 2) {
    const chance = W.mode === 'daily' ? 1 : n >= 12 ? 0.65 : 0.5;
    if (W.eventRng.next() < chance) W.pendingEvent = pickEvent();
  }
  if (W.isBossWave) {
    const bid = BOSS_ORDER[(n / 5 - 1) % BOSS_ORDER.length];
    const b = BOSSES[bid];
    W.pendingBoss = bid;
    banner('WARNING', b.name + ' · ' + b.title, b.color, 2.5);
    Sound.play('warning');
    Music.start('boss');
  } else {
    banner('WAVE ' + n, W.pendingEvent ? 'CHAOS EVENT: ' + W.pendingEvent.name : (n === 1 ? 'Survive.' : ''), W.pendingEvent ? W.pendingEvent.color : '#00f0ff', 2.4);
    Sound.play(W.pendingEvent ? 'event' : 'waveStart');
    Music.start(n > 10 ? 'game2' : 'game');
  }
  if (n > W.bestWaveThisRun) W.bestWaveThisRun = n;
  if (n >= 5) Achievements.unlock('wave5');
  if (n >= 10) Achievements.unlock('wave10');
  if (n >= 15) Achievements.unlock('wave15');
  if (W.mode === 'endless' && n >= 30) Achievements.unlock('endless30');
  if (W.mode === 'daily' && n >= 5) Achievements.unlock('daily');
}

function beginFight() {
  W.waveState = 'fight';
  if (W.pendingBoss) {
    spawnBoss(W.pendingBoss);
    W.pendingBoss = null;
    W.minionT = 4;
  }
  if (W.pendingEvent) {
    W.event = W.pendingEvent;
    W.lastEventId = W.event.id;
    W.pendingEvent = null;
    banner(W.event.name, W.event.desc, W.event.color, 2.6);
    if (W.event.start) W.event.start();
    Save.data.stats.events++;
    W.eventsSeen++;
    if (Save.data.stats.events >= 10) Achievements.unlock('events10');
  }
}

function endEvent() {
  if (W.event && W.event.end) W.event.end();
  W.event = null;
}

function waveCleared() {
  endEvent();
  W.waveState = 'clear';
  W.clearT = 2.6;
  for (const e of W.enemies) if (!e.dead && e.dieAt < 0) e.dieAt = W.t + frand(0.05, 0.9);
  for (const b of W.ebullets) b.life = Math.min(b.life, 0.2);
  for (const h of W.hazards) if (h.kind === 'meteor' && h.t < h.warn) h.t = 1e9;
  const bonus = 250 * W.wave;
  W.score += bonus;
  let sub = '+' + fmt(bonus) + ' score';
  if (!W.waveHit && W.wave >= 3) {
    sub = 'FLAWLESS! +' + fmt(bonus * 2) + ' score, +5 shards';
    W.score += bonus;
    W.shards += 5;
    Achievements.unlock('flawless');
  }
  banner('WAVE ' + W.wave + ' CLEAR', sub, '#3dff9e', 2.2);
  Sound.play('waveClear');
}

function updateWaves(dt) {
  if (W.waveState === 'intro') {
    W.introT -= dt;
    if (W.introT <= 0) beginFight();
    return;
  }
  if (W.waveState === 'clear') {
    W.clearT -= dt;
    if (W.clearT <= 0) {
      if (W.mode !== 'endless' && W.wave >= STANDARD_WAVES) { Game.endRun(true); return; }
      startWave(W.wave + 1);
    }
    return;
  }
  // fight
  if (W.event && W.event.update) W.event.update(dt);

  if (W.bossDeath) {
    const bd = W.bossDeath;
    bd.t -= dt;
    bd.tick -= dt;
    if (bd.tick <= 0) {
      bd.tick = 0.11;
      const x = bd.x + frand(-bd.r * 1.5, bd.r * 1.5), y = bd.y + frand(-bd.r * 1.5, bd.r * 1.5);
      FX.explosion(x, y, bd.color[0] === '#' ? bd.color : '#ff2bd6', frand(1, 2.5));
      Game.grid.impulse(x, y, 600, 260);
      shake(0.2);
      Sound.play('kill', 0.5);
    }
    if (bd.t <= 0) {
      FX.explosion(bd.x, bd.y, '#ffffff', 6);
      FX.ring(bd.x, bd.y, bd.color[0] === '#' ? bd.color : '#ff2bd6', 20, 900, 1, 14);
      Game.grid.impulse(bd.x, bd.y, 3000, 1100);
      Sound.play('bigBoom');
      W.bossDeath = null;
      waveCleared();
    }
    return;
  }

  if (W.isBossWave) {
    // light minion trickle during boss fights
    W.minionT -= dt;
    if (W.minionT <= 0 && W.boss) {
      W.minionT = Math.max(2.2, 4.5 - W.wave * 0.08);
      if (W.enemies.length < 30) {
        const pt = spawnPoint();
        const pool = ENEMY_TYPES.filter(t => ENEMIES[t].wave <= Math.min(W.wave, 10) && t !== 'tank');
        const type = rng.pick(pool);
        const c = ENEMIES[type].group ? 4 : 2;
        for (let i = 0; i < c; i++) spawnEnemy(type, pt.x + rng.range(-40, 40), pt.y + rng.range(-40, 40), { elite: false });
      }
    }
    return;
  }

  W.waveT += dt;
  const n = W.wave;
  const prog = W.waveT / W.waveDuration;
  W.spawnT -= dt;
  if (W.spawnT <= 0) {
    const interval = Math.max(0.15, 1.0 - n * 0.037) * (1 - 0.35 * prog) / (W.spawnEventMult || 1);
    W.spawnT = interval * rng.range(0.7, 1.3);
    let alive = 0;
    for (const e of W.enemies) if (!e.dead) alive++;
    const cap = Math.min(270, 70 + n * 7) * (W.spawnEventMult > 1 ? 1.4 : 1);
    if (alive < cap) {
      const pool = ENEMY_TYPES.filter(t => ENEMIES[t].wave <= n);
      const type = rng.weighted(pool, t => ENEMIES[t].weight * (ENEMIES[t].wave === n ? 2.2 : 1));
      const def = ENEMIES[type];
      const count = def.group ? rng.int(def.group[0], def.group[1]) + Math.floor(n / 6) : (n > 5 && rng.chance(0.28) ? rng.int(2, 3) : 1);
      const pt = spawnPoint();
      for (let i = 0; i < count; i++) spawnEnemy(type, pt.x + rng.range(-45, 45), pt.y + rng.range(-45, 45));
    }
  }
  if (W.waveT >= W.waveDuration) waveCleared();
}

/* ---------------------------------------------------------------------------
   Upgrades
   ------------------------------------------------------------------------- */
function rollUpgrades(n) {
  const p = W.player;
  const L = p.luck;
  const pool = UPGRADES.filter(u => (W.upgrades[u.id] || 0) < u.max);
  const mult = { common: 1, rare: 1 + L * 0.25, epic: (1 + L * 0.5) * (W.level >= 3 ? 1 : 0.3), legendary: (1 + L * 0.8) * (W.level >= 5 ? 1 : 0) };
  const out = [];
  const avail = pool.slice();
  while (out.length < n && avail.length) {
    const u = W.runRng.weighted(avail, u => RARITY[u.r].w * mult[u.r] + 0.0001);
    out.push(u);
    avail.splice(avail.indexOf(u), 1);
  }
  const fillers = [
    { id: '_heal', name: 'Field Repair', ico: '✚', r: 'common', desc: 'Restore 50% HP', max: 99, apply: p => { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5); } },
    { id: '_cache', name: 'Shard Cache', ico: '◆', r: 'rare', desc: '+20 shards', max: 99, apply: () => { W.shards += 20; } },
    { id: '_score', name: 'Score Surge', ico: '★', r: 'common', desc: '+5,000 score', max: 99, apply: () => { W.score += 5000; } },
  ];
  let fi = 0;
  while (out.length < n && fi < fillers.length) out.push(fillers[fi++]);
  return out;
}

function applyUpgrade(u) {
  const p = W.player;
  u.apply(p);
  if (u.id[0] !== '_') W.upgrades[u.id] = (W.upgrades[u.id] || 0) + 1;
  if (u.r === 'legendary') Achievements.unlock('legendary');
}

/* ---------------------------------------------------------------------------
   Overdrive
   ------------------------------------------------------------------------- */
function activateOverdrive() {
  const p = W.player;
  W.chaos = 0;
  W.overdrive = p.odDuration;
  W.odCount++;
  Save.data.stats.overdrives++;
  if (W.odCount >= 5) Achievements.unlock('od5');
  for (const b of W.ebullets) { FX.sparks(b.x, b.y, b.color, 2, 120, 0.3); b.life = 0; }
  aoeDamage(p.x, p.y, 400, p.damage * 6 + 30 * W.hpScale);
  for (const e of W.enemies) {
    if (e.dead || e.boss) continue;
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < 600) { const a = angleTo(p.x, p.y, e.x, e.y); const f = (1 - d / 600) * 900 * (1 - e.knockRes); e.vx += Math.cos(a) * f; e.vy += Math.sin(a) * f; }
  }
  FX.ring(p.x, p.y, '#ff2bd6', 10, 420, 0.6, 12);
  FX.ring(p.x, p.y, '#00f0ff', 10, 300, 0.5, 8);
  FX.sparks(p.x, p.y, '#ff2bd6', 60, 900, 0.8);
  Game.grid.impulse(p.x, p.y, 2600, 700);
  shake(0.8);
  screenFlash('#ff2bd6', 0.5);
  W.hitstop = 0.12;
  FX.text(p.x, p.y - 50, 'OVERDRIVE!', '#ffffff', 34, 1.2, { pop: 1 });
  Sound.play('overdrive');
}

/* ---------------------------------------------------------------------------
   Game object
   ------------------------------------------------------------------------- */
const Game = {
  canvas: null, ctx: null, w: 1, h: 1, dpr: 1, scale: 1,
  cam: { x: ARENA_W / 2, y: ARENA_H / 2, trauma: 0, sx: 0, sy: 0 },
  grid: null,
  sgrid: new SpatialGrid(72),
  state: 'boot',
  lastTs: 0,
  fps: 60, fpsAcc: 0, fpsN: 0,
  menuT: 0,
  stars: [],

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.grid = new WarpGrid(ARENA_W, ARENA_H, 50);
    for (let i = 0; i < 240; i++) {
      this.stars.push({ x: Math.random(), y: Math.random(), d: frand(0.05, 0.4), s: frand(0.5, 1.8), tw: frand(0, TAU) });
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame(t => this.loop(t));
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.scale = clamp(Math.min(this.w, this.h) / 760, 0.4, 2.4);
  },

  viewRect() {
    const vw = this.w / this.scale, vh = this.h / this.scale;
    return { x: this.cam.x - vw / 2, y: this.cam.y - vh / 2, w: vw, h: vh };
  },

  screenToWorld(sx, sy) {
    if (W && W.mirror) sx = this.w - sx;
    return { x: (sx - this.w / 2) / this.scale + this.cam.x, y: (sy - this.h / 2) / this.scale + this.cam.y };
  },

  worldToScreen(x, y) {
    let sx = (x - this.cam.x) * this.scale + this.w / 2;
    const sy = (y - this.cam.y) * this.scale + this.h / 2;
    if (W && W.mirror) sx = this.w - sx;
    return { x: sx, y: sy };
  },

  loop(ts) {
    const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000 || 0.016));
    this.lastTs = ts;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    try {
      Input.update(dt);
      UI.update(dt);
      if (this.state === 'playing') this.update(dt);
      else this.idleUpdate(dt);
      this.render(dt);
    } catch (err) {
      console.error(err);
    }
    Input.endFrame();
    requestAnimationFrame(t => this.loop(t));
  },

  /* ---------------- run lifecycle ---------------- */
  startRun(mode, shipId) {
    const daily = mode === 'daily';
    const seed = daily ? hashString('HYPERCHAOS-' + todayKey()) : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    rng.seed(seed);
    const ship = SHIPS.find(s => s.id === shipId) || SHIPS[0];
    const m = Save.data.meta;
    W = {
      mode, seed, ship,
      runRng: new RNG(seed ^ 0xa5a5a5),
      eventRng: new RNG(seed ^ 0x5eed),
      t: 0, realT: 0,
      wave: 0, waveState: 'intro', introT: 0, waveT: 0, waveDuration: 30, spawnT: 0, clearT: 0, minionT: 0,
      player: makePlayer(ship),
      enemies: [], bullets: [], ebullets: [], pickups: [], hazards: [], banners: [],
      score: 0, kills: 0, combo: 0, comboT: 0, maxCombo: 0,
      chaos: m.chaos * 25, overdrive: 0, odCount: 0,
      xp: 0, level: 1, xpNext: xpNeed(1), pendingLevels: 0,
      upgrades: {}, rerolls: 1 + m.reroll,
      shards: 0, bankedShards: 0, bossKills: 0, nukeKills: 0, eventsSeen: 0, bestWaveThisRun: 0,
      event: null, pendingEvent: null, pendingBoss: null, lastEventId: null,
      boss: null, bossDeath: null, bossHitTaken: false, isBossWave: false,
      hpScale: 1, dmgScale: 1, spdScale: 1,
      speedMult: 1, sizeMult: 1, xpEventMult: 1, scoreEventMult: 1, spawnEventMult: 1, hpEventMult: 1,
      mirror: false, allShoot: false, goldRush: false, tiny: false, blackout: false, pinata: false,
      hitstop: 0, flash: null, dying: 0, magnetAll: 0, over: false,
      stats: { damage: 0, taken: 0 },
    };
    if (ship.randomStart) {
      for (let i = 0; i < ship.randomStart; i++) {
        const u = rollUpgrades(1)[0];
        applyUpgrade(u);
      }
    }
    if (W.player.secondWind > 0) W.upgrades.secondwind = 1;
    enemyIdSeq = 1;
    FX.clear();
    this.cam.x = W.player.x; this.cam.y = W.player.y; this.cam.trauma = 0;
    Save.data.stats.runs++;
    Save.save();
    this.state = 'playing';
    document.body.classList.add('playing');
    Sound.setMuffle(false);
    Music.intensity = 0.3;
    startWave(1);
    UI.hideAll();
    if (mode === 'daily') banner('DAILY CHAOS', todayKey() + ' · Ship: ' + ship.name, '#ffe600', 2.6);
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.body.classList.remove('playing');
    Sound.setMuffle(true);
    UI.showPause();
  },

  resume() {
    if (this.state !== 'paused' && this.state !== 'levelup') return;
    this.state = 'playing';
    document.body.classList.add('playing');
    Sound.setMuffle(false);
    UI.hideAll();
    Input.keyHits.clear();
  },

  computeShards(victory) {
    const p = W.player;
    let s = W.shards + Math.max(0, W.bestWaveThisRun - 1) * 6 + W.bossKills * 40 + Math.floor(W.score / 3000) + (victory ? 250 : 0);
    if (W.mode === 'daily') s *= 1.25;
    return Math.round(s * p.shardMult);
  },

  endRun(victory) {
    if (W.over) return;
    W.over = true;
    this.state = 'gameover';
    document.body.classList.remove('playing');
    Sound.setMuffle(true);
    const st = Save.data.stats;
    const total = this.computeShards(victory);
    const earned = Math.max(0, total - W.bankedShards);
    W.bankedShards = total;
    Save.data.shards += earned;
    st.shardsEarned += earned;
    st.kills += W.kills - (W.countedKills || 0);
    W.countedKills = W.kills;
    st.playTime += W.realT - (W.countedTime || 0);
    W.countedTime = W.realT;
    if (victory) st.wins++; else st.deaths++;
    if (W.mode === 'endless') st.bestEndlessWave = Math.max(st.bestEndlessWave, W.wave);
    else st.bestWave = Math.max(st.bestWave, W.wave);
    const isNewBest = W.score > st.bestScore;
    st.bestScore = Math.max(st.bestScore, Math.floor(W.score));
    if (st.kills >= 1000) Achievements.unlock('kills1k');
    if (st.kills >= 10000) Achievements.unlock('kills10k');
    if (victory) {
      Achievements.unlock('victory');
      if (W.upgrades.glass) Achievements.unlock('glass_win');
    }
    let rank = -1;
    if (!W.recorded) {
      W.recorded = true;
      rank = Save.addHighscore({
        score: Math.floor(W.score), wave: W.wave, ship: W.ship.name, mode: W.mode,
        date: todayKey(), kills: W.kills, level: W.level,
      });
    } else {
      // continuing an endless run after victory: update the existing record
      const rec = Save.data.highscores.find(h => h.seed === W.seed);
      if (rec) { rec.score = Math.floor(W.score); rec.wave = W.wave; rec.kills = W.kills; rec.level = W.level; }
      Save.data.highscores.sort((a, b) => b.score - a.score);
    }
    const rec = Save.data.highscores[rank];
    if (rec) rec.seed = W.seed;
    if (W.mode === 'daily') {
      const d = Save.data.daily;
      if (d.key !== todayKey()) { d.key = todayKey(); d.best = 0; d.played = 0; }
      d.played++;
      d.best = Math.max(d.best, Math.floor(W.score));
    }
    if (Save.data.shards >= 2000) Achievements.unlock('rich');
    Save.save();
    Sound.play(victory ? 'victory' : 'gameOver');
    Music.start('menu');
    UI.showGameOver({ victory, earned, rank, isNewBest });
  },

  continueEndless() {
    W.mode = 'endless';
    W.over = false;
    this.state = 'playing';
    document.body.classList.add('playing');
    Sound.setMuffle(false);
    UI.hideAll();
    startWave(W.wave + 1);
    banner('ENDLESS', 'How deep does the chaos go?', '#ff2bd6', 2.4);
  },

  quitToMenu() {
    W = null;
    FX.clear();
    this.state = 'menu';
    document.body.classList.remove('playing');
    Sound.setMuffle(false);
    Music.start('menu');
    UI.show('title');
  },

  openLevelUp() {
    this.state = 'levelup';
    document.body.classList.remove('playing');
    Sound.play('levelUp');
    Sound.setMuffle(true);
    const p = W.player;
    FX.ring(p.x, p.y, '#ffe600', 10, 160, 0.5, 6);
    UI.showLevelUp(rollUpgrades(3 + p.extraChoice));
  },

  chooseUpgrade(u) {
    applyUpgrade(u);
    W.pendingLevels--;
    const p = W.player;
    FX.sparks(p.x, p.y, RARITY[u.r].color, 30, 400, 0.6);
    Sound.play('select');
    if (W.pendingLevels > 0) {
      UI.showLevelUp(rollUpgrades(3 + p.extraChoice));
    } else {
      p.iframes = Math.max(p.iframes, 0.6);
      this.resume();
    }
  },

  /* ---------------- per-frame simulation ---------------- */
  update(rdt) {
    const w = W;
    if (Input.hit('pause') && w.dying <= 0) { this.pause(); return; }
    this.updateCamera(rdt);
    if (w.hitstop > 0) { w.hitstop -= rdt; return; }

    let slow = 1;
    if (w.dying > 0) {
      w.dying -= rdt;
      slow = 0.3;
      if (w.dying <= 0) { this.endRun(false); return; }
    }
    const dt = rdt * w.speedMult * slow;
    w.t += dt;
    w.realT += rdt;
    const edt = dt * (w.overdrive > 0 ? 0.45 : 1);
    const p = w.player;

    updateWaves(dt);
    if (this.state !== 'playing') return;

    // spatial grid of active enemies
    this.sgrid.clear();
    for (const e of w.enemies) if (!e.dead && e.spawnT <= 0) this.sgrid.insert(e);

    if (w.dying <= 0) {
      updatePlayer(p, dt);
      if (Input.hit('overdrive')) {
        if (w.chaos >= 100 && w.overdrive <= 0) activateOverdrive();
        else if (w.overdrive <= 0) Sound.play('deny');
      }
    }
    if (w.overdrive > 0) {
      w.overdrive -= dt;
      if (w.overdrive <= 0) { FX.text(p.x, p.y - 40, 'overdrive ended', '#8a8fb8', 14, 0.9); }
    }

    // combo decay
    if (w.combo > 0) { w.comboT -= dt; if (w.comboT <= 0) w.combo = 0; }

    this.updateEnemies(edt, dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(edt);
    this.updateHazards(dt);
    this.updatePickups(dt);

    FX.update(dt);
    this.grid.update(Math.min(dt, 1 / 30));

    // banners
    for (let i = w.banners.length - 1; i >= 0; i--) {
      const b = w.banners[i];
      b.t += rdt;
      if (b.t > b.dur) w.banners.splice(i, 1);
    }
    if (w.flash) { w.flash.a -= rdt * 2.2; if (w.flash.a <= 0) w.flash = null; }

    // music intensity follows the action
    const alive = w.enemies.length;
    const target = w.overdrive > 0 ? 1 : clamp(0.25 + alive / 90 + w.wave / 40, 0.25, 0.95);
    Music.intensity += (target - Music.intensity) * Math.min(1, rdt * 0.8);

    if (w.pendingLevels > 0 && w.dying <= 0 && !w.bossDeath && this.state === 'playing') this.openLevelUp();
  },

  updateEnemies(edt, dt) {
    const w = W, p = w.player;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (e.dead) continue;
      if (e.dieAt >= 0 && w.t >= e.dieAt) { e.hp = 0; e.boss ? null : killEnemy(e, {}); continue; }
      updateEnemy(e, edt);
      if (e.dead || e.spawnT > 0) continue;
      // contact damage
      if (w.dying <= 0 && e.dmg > 0) {
        const rr = e.r + p.r * 0.75;
        if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
          if (damagePlayer(e.dmg, e.x, e.y)) {
            const a = angleTo(p.x, p.y, e.x, e.y);
            e.vx += Math.cos(a) * 300 * (1 - e.knockRes); e.vy += Math.sin(a) * 300 * (1 - e.knockRes);
          }
        }
      }
    }
    // soft separation so hordes spread out instead of stacking
    for (const e of w.enemies) {
      if (e.dead || e.spawnT > 0 || e.boss) continue;
      this.sgrid.query(e.x, e.y, e.r, _hits);
      for (const o of _hits) {
        if (o === e || o.dead || o.id < e.id && !o.boss) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const rr = e.r + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 0.01) continue;
        const d = Math.sqrt(d2), push = (rr - d) * 0.5;
        const nx = dx / d, ny = dy / d;
        if (o.boss) { e.x += nx * push * 2; e.y += ny * push * 2; }
        else { e.x += nx * push; e.y += ny * push; o.x -= nx * push; o.y -= ny * push; }
      }
    }
    let j = 0;
    for (let i = 0; i < w.enemies.length; i++) { const e = w.enemies[i]; if (!e.dead) w.enemies[j++] = e; }
    w.enemies.length = j;
  },

  updateBullets(dt) {
    const w = W, p = w.player;
    const bs = w.bullets;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      b.life -= dt;
      if (b.life <= 0) { bs[i] = bs[bs.length - 1]; bs.pop(); continue; }
      if (b.homing > 0) {
        b.retarget -= dt;
        if (b.retarget <= 0 || !b.target || b.target.dead) {
          b.target = nearestEnemy(b.x, b.y, 340);
          b.retarget = 0.2;
        }
        const t = b.target;
        if (t && !t.dead) {
          const sp = Math.hypot(b.vx, b.vy);
          const cur = Math.atan2(b.vy, b.vx);
          const want = angleTo(b.x, b.y, t.x, t.y);
          const turn = clamp(angDiff(cur, want), -b.homing * 5 * dt, b.homing * 5 * dt);
          const na = cur + turn;
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // walls
      if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) {
        if (b.bounce > 0) {
          b.bounce--;
          if (b.x < 0 || b.x > ARENA_W) b.vx = -b.vx;
          if (b.y < 0 || b.y > ARENA_H) b.vy = -b.vy;
          b.x = clamp(b.x, 1, ARENA_W - 1); b.y = clamp(b.y, 1, ARENA_H - 1);
          b.hits.length = 0;
          FX.sparks(b.x, b.y, '#ffffff', 3, 160, 0.2);
        } else { bs[i] = bs[bs.length - 1]; bs.pop(); continue; }
      }
      this.sgrid.query(b.x, b.y, b.r, _hits);
      for (const e of _hits) {
        if (e.dead || e.spawnT > 0 || b.hits.includes(e.id)) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) ** 2) {
          if (!this.bulletHit(b, e)) { b.life = 0; break; }
        }
      }
      if (b.life <= 0) { bs[i] = bs[bs.length - 1]; bs.pop(); }
    }
  },

  /* returns true if the bullet survives */
  bulletHit(b, e) {
    const p = W.player;
    b.hits.push(e.id);
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const crit = Math.random() < p.crit;
    damageEnemy(e, b.dmg, { crit, kx: b.vx / sp * 85, ky: b.vy / sp * 85 });
    FX.sparks(b.x, b.y, crit ? '#ffe600' : (b.color || p.color), 4, 240, 0.25, { angle: Math.atan2(-b.vy, -b.vx), spread: 0.9 });
    if (p.explosive > 0) {
      const R = (34 + 14 * p.explosive) * (W.sizeMult || 1);
      aoeDamage(b.x, b.y, R, b.dmg * (0.35 + 0.15 * p.explosive), { exclude: e });
      FX.ring(b.x, b.y, '#ff9a3d', 4, R, 0.25, 3);
      FX.dots(b.x, b.y, '#ff7a00', 2, 60, 0.3, 10);
      if (Math.random() < 0.3) Game.grid.impulse(b.x, b.y, 160, R * 1.5);
    }
    if (p.chain > 0 && Math.random() < 0.25) chainLightning(e, b.dmg * 0.6, 1 + p.chain);
    if (p.freeze > 0 && !e.boss && Math.random() < p.freeze) e.slow = 2.2;
    if (p.hydra && !b.child) {
      const a = Math.atan2(b.vy, b.vx);
      for (const s of [-0.5, 0.5]) {
        if (W.bullets.length > 900) break;
        W.bullets.push({
          x: b.x, y: b.y, vx: Math.cos(a + s) * sp, vy: Math.sin(a + s) * sp, r: b.r * 0.8, dmg: b.dmg * 0.5,
          life: 0.45, pierce: 0, bounce: 0, homing: b.homing, hits: b.hits.slice(), child: true, color: '#ffb400', target: null, retarget: 0,
        });
      }
    }
    if (b.pierce > 0) { b.pierce--; return true; }
    if (b.bounce > 0) {
      let best = null, bd = 320 * 320;
      for (const o of W.enemies) {
        if (o.dead || o.spawnT > 0 || b.hits.includes(o.id)) continue;
        const d = dist2(b.x, b.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        b.bounce--;
        const a = angleTo(b.x, b.y, best.x, best.y);
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
        b.life = Math.max(b.life, 0.4);
        return true;
      }
    }
    return false;
  },

  updateEnemyBullets(dt) {
    const w = W, p = w.player;
    const bs = w.ebullets;
    const pr = p.r * 0.7;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      b.life -= dt;
      if (b.life <= 0) { bs[i] = bs[bs.length - 1]; bs.pop(); continue; }
      if (b.delay > 0) {
        b.delay -= dt;
        if (b.delay <= 0 && b.aimAtPlayer) {
          const a = angleTo(b.x, b.y, p.x, p.y);
          b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed;
        }
        continue;
      }
      if (b.homing > 0 && w.dying <= 0) {
        const cur = Math.atan2(b.vy, b.vx);
        const want = angleTo(b.x, b.y, p.x, p.y);
        const na = cur + clamp(angDiff(cur, want), -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(na) * b.speed; b.vy = Math.sin(na) * b.speed;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -40 || b.x > ARENA_W + 40 || b.y < -40 || b.y > ARENA_H + 40) { bs[i] = bs[bs.length - 1]; bs.pop(); continue; }
      if (w.dying <= 0 && dist2(b.x, b.y, p.x, p.y) < (b.r + pr) ** 2) {
        if (damagePlayer(b.dmg, b.x - b.vx, b.y - b.vy)) { bs[i] = bs[bs.length - 1]; bs.pop(); }
      }
    }
  },

  updateHazards(dt) {
    const w = W, p = w.player;
    for (let i = w.hazards.length - 1; i >= 0; i--) {
      const h = w.hazards[i];
      h.t += dt;
      if (h.kind === 'meteor') {
        if (!h.hit && h.t >= h.warn) {
          h.hit = true;
          FX.explosion(h.x, h.y, '#ff7a00', 2.6);
          FX.debris(h.x, h.y, '#ffb000', 10, 380, 9);
          Game.grid.impulse(h.x, h.y, 1100, h.r * 2.6);
          shake(0.4);
          Sound.play('meteor');
          if (w.dying <= 0 && dist(h.x, h.y, p.x, p.y) < h.r + p.r * 0.4) damagePlayer(24 * w.dmgScale, h.x, h.y);
          aoeDamage(h.x, h.y, h.r, 70 * w.hpScale, { noChain: true });
        }
        if (h.t > h.warn + 0.3) w.hazards.splice(i, 1);
      } else if (h.kind === 'laser') {
        if (h.owner) {
          if (h.owner.dead) { w.hazards.splice(i, 1); continue; }
          h.x = h.owner.x; h.y = h.owner.y;
        }
        const active = h.t >= h.warn && h.t < h.warn + h.dur;
        if (h.t >= h.warn && !h.fired) { h.fired = true; Sound.play('laserFire'); shake(0.3); }
        if (active) {
          h.angle += (h.angVel || 0) * dt;
          const ex = h.x + Math.cos(h.angle) * h.len, ey = h.y + Math.sin(h.angle) * h.len;
          if (w.dying <= 0 && pointSegDist2(p.x, p.y, h.x, h.y, ex, ey) < (h.width / 2 + p.r * 0.6) ** 2) damagePlayer(h.dmg, h.x, h.y);
          if (Math.random() < 0.5) FX.sparks(h.x + Math.cos(h.angle) * frand(0, 900), h.y + Math.sin(h.angle) * frand(0, 900), h.color, 1, 200, 0.3);
        } else if (h.t < h.warn) {
          h.angle += (h.angVel || 0) * dt * 0.15;
        }
        if (h.t >= h.warn + h.dur) w.hazards.splice(i, 1);
      } else if (h.kind === 'blackhole') {
        h.life -= dt;
        if (h.owner) { if (h.owner.dead) h.life = 0; else { h.x = h.owner.x; h.y = h.owner.y; } }
        if (h.life <= 0) {
          FX.ring(h.x, h.y, '#b84dff', h.r, 300, 0.5, 8);
          Game.grid.impulse(h.x, h.y, 900, 400);
          w.hazards.splice(i, 1);
          continue;
        }
        const strength = h.weak ? 150 : 230;
        if (w.dying <= 0) {
          const d = dist(h.x, h.y, p.x, p.y);
          if (d < h.pull && d > 1) {
            const f = strength * (1 - d / h.pull) * dt;
            p.x += (h.x - p.x) / d * f; p.y += (h.y - p.y) / d * f;
          }
          if (d < h.r + p.r * 0.5 && !h.weak) damagePlayer(16 * w.dmgScale, h.x, h.y);
        }
        if (!h.owner) {
          for (const e of w.enemies) {
            if (e.dead || e.boss || e.spawnT > 0) continue;
            const d = dist(h.x, h.y, e.x, e.y);
            if (d < h.pull && d > 1) { const f = strength * 1.4 * (1 - d / h.pull) * dt; e.x += (h.x - e.x) / d * f; e.y += (h.y - e.y) / d * f; }
            if (d < h.r + e.r) damageEnemy(e, 260 * w.hpScale * dt, {});
          }
        }
        for (const pk of w.pickups) {
          const d = dist(h.x, h.y, pk.x, pk.y);
          if (d < h.pull && d > h.r) { pk.x += (h.x - pk.x) / d * 120 * dt; pk.y += (h.y - pk.y) / d * 120 * dt; }
        }
        if (Math.random() < 0.5) Game.grid.impulse(h.x, h.y, -60, 260);
        if (Math.random() < 0.6) {
          const a = frand(0, TAU), r = frand(h.r * 2, h.r * 5);
          FX.particles.push({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r, vx: Math.cos(a + 1.9) * 160, vy: Math.sin(a + 1.9) * 160, life: 0.6, max: 0.6, size: 2, color: '#b84dff', drag: 0, type: 'spark', grav: 0 });
        }
      }
    }
  },

  updatePickups(dt) {
    const w = W, p = w.player;
    const vacuum = w.waveState === 'clear' || w.bossDeath;
    if (w.magnetAll > 0) w.magnetAll -= dt;
    const mr2 = p.magnet * p.magnet;
    for (let i = w.pickups.length - 1; i >= 0; i--) {
      const pk = w.pickups[i];
      pk.t += dt;
      pk.life -= dt;
      if (pk.life <= 0) { w.pickups.splice(i, 1); continue; }
      const d2 = dist2(pk.x, pk.y, p.x, p.y);
      if (!pk.magnet && w.dying <= 0 && pk.t > 0.25 && (d2 < mr2 || (vacuum && pk.kind === 'xp') || (w.magnetAll > 0 && pk.kind === 'xp'))) pk.magnet = true;
      if (pk.magnet && w.dying <= 0) {
        const d = Math.sqrt(d2) || 1;
        const s = 520 + pk.t * 60 + (vacuum ? 600 : 0);
        const k = 1 - Math.exp(-9 * dt);
        pk.vx += ((p.x - pk.x) / d * s - pk.vx) * k;
        pk.vy += ((p.y - pk.y) / d * s - pk.vy) * k;
      } else {
        const fr = Math.exp(-4 * dt);
        pk.vx *= fr; pk.vy *= fr;
      }
      pk.x += pk.vx * dt; pk.y += pk.vy * dt;
      if (w.dying <= 0 && d2 < (p.r + pk.r + 8) ** 2) {
        this.collect(pk);
        w.pickups.splice(i, 1);
      }
    }
  },

  collect(pk) {
    const w = W, p = w.player;
    switch (pk.kind) {
      case 'xp':
        addXP(pk.value);
        w.pickupChain = (w.pickupChainT > 0 ? (w.pickupChain || 0) + 1 : 0);
        w.pickupChainT = 0.4;
        Sound.play('pickup', w.pickupChain);
        break;
      case 'heart':
        healPlayer(Math.round(p.maxHp * 0.2));
        FX.ring(p.x, p.y, '#3dff9e', 10, 60, 0.3, 3);
        Sound.play('heal');
        break;
      case 'shard':
        w.shards += pk.value;
        FX.text(pk.x, pk.y - 10, '+' + pk.value + ' ◆', '#ffe600', 14, 0.7);
        Sound.play('shard');
        break;
      case 'magnet':
        w.magnetAll = 2;
        FX.ring(p.x, p.y, '#00f0ff', 10, 400, 0.5, 4);
        FX.text(p.x, p.y - 30, 'MAGNET!', '#00f0ff', 18, 0.9, { pop: 0.4 });
        Sound.play('select');
        break;
      case 'chaos':
        addChaos(30);
        FX.text(p.x, p.y - 30, '+CHAOS', '#ff2bd6', 16, 0.8);
        Sound.play('shard');
        break;
      case 'nuke': {
        w.nukeKills = 0;
        const view = this.viewRect();
        for (const e of w.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (e.x < view.x - 50 || e.x > view.x + view.w + 50 || e.y < view.y - 50 || e.y > view.y + view.h + 50) continue;
          if (e.boss) damageEnemy(e, e.maxHp * 0.06, {});
          else damageEnemy(e, 999999, { nuke: true });
        }
        for (const b of w.ebullets) b.life = 0;
        if (w.nukeKills >= 30) Achievements.unlock('nuke');
        screenFlash('#ffffff', 0.9);
        shake(1);
        FX.ring(p.x, p.y, '#ffb000', 10, 1200, 0.9, 20);
        this.grid.impulse(p.x, p.y, 3000, 1200);
        Sound.play('bigBoom');
        FX.text(p.x, p.y - 40, 'NUKE!', '#ffb000', 36, 1.2, { pop: 1 });
        break;
      }
    }
  },

  updateCamera(dt) {
    const c = this.cam, p = W.player;
    const tx = p.x + Math.cos(p.angle) * 50 + p.vx * 0.12;
    const ty = p.y + Math.sin(p.angle) * 50 + p.vy * 0.12;
    const k = 1 - Math.exp(-6 * dt);
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    const v = this.viewRect();
    if (v.w < ARENA_W + 160) c.x = clamp(c.x, v.w / 2 - 80, ARENA_W - v.w / 2 + 80); else c.x = ARENA_W / 2;
    if (v.h < ARENA_H + 160) c.y = clamp(c.y, v.h / 2 - 80, ARENA_H - v.h / 2 + 80); else c.y = ARENA_H / 2;
    c.trauma = Math.max(0, c.trauma - dt * 1.5);
    const s = c.trauma * c.trauma * 24 * Save.data.settings.shake;
    c.sx = frand(-s, s); c.sy = frand(-s, s);
    if (W.pickupChainT > 0) W.pickupChainT -= dt;
  },

  /* Menus: drift the camera around and ripple the grid for an attract mode */
  idleUpdate(dt) {
    this.menuT += dt;
    if (!W || this.state === 'menu' || this.state === 'boot') {
      const c = this.cam;
      c.x = ARENA_W / 2 + Math.cos(this.menuT * 0.07) * 500;
      c.y = ARENA_H / 2 + Math.sin(this.menuT * 0.11) * 300;
      c.trauma = 0; c.sx = c.sy = 0;
      if (Math.random() < dt * 1.6) {
        const v = this.viewRect();
        const x = v.x + frand(0, v.w), y = v.y + frand(0, v.h);
        this.grid.impulse(x, y, frand(300, 900), frand(150, 350));
        FX.ring(x, y, Math.random() < 0.5 ? '#ff2bd6' : '#00f0ff', 5, frand(60, 180), 0.8, 3);
        FX.sparks(x, y, Math.random() < 0.5 ? '#ff2bd6' : '#00f0ff', 12, 300, 0.7);
      }
      FX.update(dt);
      this.grid.update(Math.min(dt, 1 / 30));
    }
  },

  /* ---------------- rendering ---------------- */
  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#05010f';
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawStars(ctx);

    const c = this.cam;
    ctx.save();
    if (W && W.mirror) { ctx.translate(this.w, 0); ctx.scale(-1, 1); }
    ctx.translate(this.w / 2 + c.sx, this.h / 2 + c.sy);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-c.x, -c.y);
    const v = this.viewRect();

    // arena floor + grid
    ctx.fillStyle = 'rgba(20,6,48,0.55)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    let gridCol = '#6a3dff';
    if (W && W.overdrive > 0) gridCol = quantizeColor(hsl((W.t * 200) % 360, 100, 60));
    else if (W && W.event) gridCol = W.event.color;
    else if (W && W.boss) gridCol = W.boss.color[0] === '#' ? W.boss.color : '#ff2bd6';
    ctx.globalCompositeOperation = 'lighter';
    let gAlpha = 0.16;
    if (W && W.event && W.event.id === 'disco') { gridCol = quantizeColor(hsl((W.t * 240) % 360, 100, 55)); gAlpha = 0.2 + 0.1 * Math.abs(Math.sin(W.t * 8)); }
    this.grid.draw(ctx, v.x, v.y, v.x + v.w, v.y + v.h, gridCol, gAlpha);
    ctx.globalCompositeOperation = 'source-over';
    this.drawBorder(ctx);

    if (W) {
      this.drawHazards(ctx, false);
      this.drawPickups(ctx);
      for (const e of W.enemies) {
        if (e.x < v.x - 160 || e.x > v.x + v.w + 160 || e.y < v.y - 160 || e.y > v.y + v.h + 160) continue;
        drawEnemy(ctx, e);
      }
      this.drawBullets(ctx);
      drawPlayer(ctx, W.player);
      this.drawHazards(ctx, true);
      this.drawEnemyBullets(ctx);
    }
    FX.draw(ctx);
    FX.drawTexts(ctx);
    ctx.restore();

    if (W) {
      if (W.blackout) this.drawBlackout(ctx);
      if (W.flash) {
        ctx.globalAlpha = Math.max(0, W.flash.a);
        ctx.fillStyle = W.flash.color;
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.globalAlpha = 1;
      }
      HUD.draw(ctx);
    }
    if (Save.data.settings.showFps) {
      ctx.fillStyle = '#3dff9e'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(this.fps + ' FPS', 8, this.h - 24);
    }
  },

  drawStars(ctx) {
    const c = this.cam, t = this.menuT + (W ? W.t : 0);
    ctx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      const x = ((s.x * (this.w + 200) - c.x * s.d) % (this.w + 200) + this.w + 200) % (this.w + 200) - 100;
      const y = ((s.y * (this.h + 200) - c.y * s.d) % (this.h + 200) + this.h + 200) % (this.h + 200) - 100;
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.8 + s.tw));
      ctx.fillRect(x, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  },

  drawBorder(ctx) {
    const t = this.menuT + (W ? W.t : 0);
    const col = W && W.boss ? (W.boss.color[0] === '#' ? W.boss.color : '#ff2bd6') : '#ff2bd6';
    ctx.globalCompositeOperation = 'lighter';
    for (const [lw, a] of [[18, 0.08], [8, 0.2], [3, 0.9]]) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = a * (0.85 + 0.15 * Math.sin(t * 3));
      ctx.lineWidth = lw;
      ctx.strokeRect(0, 0, ARENA_W, ARENA_H);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawPickups(ctx) {
    const t = W.t;
    ctx.globalCompositeOperation = 'lighter';
    for (const pk of W.pickups) {
      const blink = pk.life < 3 && Math.floor(pk.life * 8) % 2 === 0;
      if (blink) continue;
      let col;
      switch (pk.kind) {
        case 'xp': col = pk.value >= 25 ? '#ff2bd6' : pk.value >= 5 ? '#3dff9e' : '#00f0ff'; break;
        case 'heart': col = '#ff3b6b'; break;
        case 'shard': col = '#ffe600'; break;
        case 'magnet': col = '#00f0ff'; break;
        case 'nuke': col = '#ffb000'; break;
        default: col = '#ff2bd6';
      }
      const g = pk.r * 3.2;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(FX.glow(col), pk.x - g, pk.y - g, g * 2, g * 2);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 2;
      const r = pk.r;
      if (pk.kind === 'xp' || pk.kind === 'shard') {
        ctx.rotate(t * 2 + pk.x);
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(0, r * 1.3); ctx.lineTo(-r, 0); ctx.lineTo(0, -r * 1.3); ctx.closePath();
        ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
      } else if (pk.kind === 'heart') {
        const s = 1 + Math.sin(t * 6) * 0.12;
        ctx.scale(s, s);
        ctx.fillRect(-r * 0.3, -r, r * 0.6, r * 2);
        ctx.fillRect(-r, -r * 0.3, r * 2, r * 0.6);
      } else if (pk.kind === 'magnet') {
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.lineWidth = 5; ctx.stroke();
        ctx.fillRect(-r - 2.5, 0, 5, r * 0.6); ctx.fillRect(r - 2.5, 0, 5, r * 0.6);
      } else if (pk.kind === 'nuke') {
        ctx.rotate(t * 2);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 0.8, k * TAU / 3, k * TAU / 3 + 0.9); ctx.closePath(); ctx.fill(); }
      } else {
        ctx.rotate(-t * 3);
        shapePath(ctx, 'star', r * 1.2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  drawBullets(ctx) {
    const p = W.player;
    const od = W.overdrive > 0;
    ctx.globalCompositeOperation = 'lighter';
    const base = p.color;
    const glow = FX.glow(base);
    for (const b of W.bullets) {
      const col = b.color || (od ? quantizeColor(hsl((W.t * 500 + b.x) % 360, 100, 60)) : base);
      const g = b.r * 4.5;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(b.color || od ? FX.glow(col) : glow, b.x - g, b.y - g, g * 2, g * 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = b.r * 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'source-over';
  },

  drawEnemyBullets(ctx) {
    for (const b of W.ebullets) {
      if (b.delay > 0) {
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(W.t * 30);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6 * b.delay, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      const g = b.r * 3.4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.75;
      ctx.drawImage(FX.glow(b.color), b.x - g, b.y - g, g * 2, g * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.62, 0, TAU); ctx.fill();
      ctx.strokeStyle = b.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
    }
  },

  drawHazards(ctx, top) {
    for (const h of W.hazards) {
      if (h.kind === 'meteor' && !top) {
        if (h.t >= h.warn) continue;
        const k = h.t / h.warn;
        ctx.strokeStyle = '#ff7a00';
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(h.t * 25) ** 2;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#ff7a00';
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r * k, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (h.kind === 'meteor' && top) {
        if (h.t >= h.warn) continue;
        const k = 1 - h.t / h.warn;
        const mx = h.x + 260 * k, my = h.y - 640 * k;
        const g = 40;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(FX.glow('#ff7a00'), mx - g, my - g, g * 2, g * 2);
        ctx.strokeStyle = 'rgba(255,170,60,0.5)'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 80, my - 200); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffe0b0';
        ctx.beginPath(); ctx.arc(mx, my, 10, 0, TAU); ctx.fill();
      } else if (h.kind === 'laser' && top) {
        const ex = h.x + Math.cos(h.angle) * h.len, ey = h.y + Math.sin(h.angle) * h.len;
        ctx.lineCap = 'round';
        if (h.t < h.warn) {
          ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(h.t * 22));
          ctx.strokeStyle = h.color; ctx.lineWidth = 2;
          ctx.setLineDash([16, 10]);
          ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.08;
          ctx.lineWidth = h.width;
          ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke();
        } else {
          const fade = Math.min(1, (h.warn + h.dur - h.t) * 6);
          ctx.globalCompositeOperation = 'lighter';
          for (const [wm, col, a] of [[2.2, h.color, 0.25], [1, h.color, 0.8], [0.35, '#ffffff', 1]]) {
            ctx.globalAlpha = a * fade;
            ctx.strokeStyle = col;
            ctx.lineWidth = h.width * wm * (0.9 + Math.random() * 0.2);
            ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
        ctx.lineCap = 'butt';
      } else if (h.kind === 'blackhole' && !top) {
        const t = W.t;
        ctx.globalCompositeOperation = 'lighter';
        const g = h.r * 5;
        ctx.globalAlpha = 0.6;
        ctx.drawImage(FX.glow('#b84dff', 128), h.x - g, h.y - g, g * 2, g * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = k === 1 ? '#ff2bd6' : '#b84dff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.r * (1.3 + k * 0.45), t * (2 + k) + k, t * (2 + k) + k + 3.6);
          ctx.stroke();
        }
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
      }
    }
  },

  drawBlackout(ctx) {
    const s = this.worldToScreen(W.player.x, W.player.y);
    const r = 330 * this.scale;
    const g = ctx.createRadialGradient(s.x, s.y, r * 0.3, s.x, s.y, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  },
};
