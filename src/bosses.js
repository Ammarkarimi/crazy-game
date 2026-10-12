'use strict';
/* ==========================================================================
   Bosses: Hive Queen (5), Obliterator (10), Mirrormind (15), Chaos Engine (20).
   In Endless mode they loop with scaling health.
   ========================================================================== */

const BOSS_ORDER = ['hive', 'obliterator', 'mirror', 'engine'];

function ringBurst(e, n, speed, offset = 0, opts = {}) {
  for (let i = 0; i < n; i++) enemyBullet(e.x, e.y, offset + (i / n) * TAU, speed, Object.assign({ color: e.color, dmg: 12 * W.dmgScale, r: 7 }, opts));
  Sound.play('enemyShoot');
}
function aimedSpread(e, n, spread, speed, opts = {}) {
  const p = W.player;
  const a = angleTo(e.x, e.y, p.x, p.y);
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1) - 0.5;
    enemyBullet(e.x, e.y, a + k * spread, speed, Object.assign({ color: e.color, dmg: 12 * W.dmgScale, r: 7 }, opts));
  }
  Sound.play('enemyShoot');
}
function convergeRain(n, radius, color) {
  const p = W.player;
  const off = frand(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU;
    const x = p.x + Math.cos(a) * radius, y = p.y + Math.sin(a) * radius;
    enemyBullet(x, y, a + Math.PI, 300, { color, dmg: 12 * W.dmgScale, r: 8, delay: 0.75, aimAtPlayer: true });
  }
}
function bossPhaseCheck(e) {
  const f = e.hp / e.maxHp;
  const want = f < e.bossDef.phases[1] ? 3 : f < e.bossDef.phases[0] ? 2 : 1;
  if (want > e.phase) {
    e.phase = want;
    e.flash = 0.3;
    FX.explosion(e.x, e.y, e.color, 3);
    Game.grid.impulse(e.x, e.y, 900, 420);
    shake(0.6);
    Sound.play('warning');
    banner('PHASE ' + want, e.bossDef.name + ' is enraged!', e.color, 1.6);
    // clear bullets as a breather
    for (const b of W.ebullets) b.life = Math.min(b.life, 0.15);
  }
}
function hover(e, dt, p, range, spd) {
  const d = dist(e.x, e.y, p.x, p.y);
  const a = angleTo(e.x, e.y, p.x, p.y);
  e.orbit = (e.orbit || 0) + dt * 0.4;
  if (d > range + 60) seekAngle(e, a, spd, dt, 2);
  else if (d < range - 60) seekAngle(e, a + Math.PI, spd, dt, 2);
  else seekAngle(e, a + Math.PI / 2, spd * 0.6, dt, 1.5);
}

const BOSSES = {
  /* ---------------------------------------------------------------- HIVE */
  hive: {
    name: 'HIVE QUEEN', title: 'Mother of the Swarm', color: '#ffb000', hp: 4000, r: 62, speed: 85, dmg: 20,
    score: 2500, xp: 60, phases: [0.5, 0.2],
    update(e, dt, p) {
      bossPhaseCheck(e);
      hover(e, dt, p, 330, eSpeed(e) * (e.phase > 1 ? 1.4 : 1));
      e.spin = (e.spin || 0) + dt * (e.phase > 1 ? 1.4 : 0.7);
      e.patT -= dt;
      if (e.seq > 0) {
        e.seqT -= dt;
        if (e.seqT <= 0) {
          e.seq--;
          if (e.pattern === 0) { ringBurst(e, e.phase > 1 ? 28 : 20, 165, e.seq * 0.17 + e.spin); e.seqT = 0.38; }
          if (e.pattern === 2) { aimedSpread(e, e.phase > 1 ? 7 : 5, 0.9, 260); e.seqT = 0.2; }
        }
      }
      if (e.patT <= 0) {
        e.pattern = (e.pattern + 1) % 3;
        if (e.pattern === 0) { e.seq = e.phase > 1 ? 4 : 3; e.seqT = 0; }
        if (e.pattern === 1) {
          const n = e.phase > 1 ? 10 : 6;
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU;
            const s = spawnEnemy('swarm', e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, { instant: true, elite: false });
            if (s) { s.vx = Math.cos(a) * 300; s.vy = Math.sin(a) * 300; }
          }
          if (e.phase >= 3) spawnEnemy('bomber', e.x, e.y + 80, { instant: true, elite: false });
          FX.ring(e.x, e.y, e.color, 20, 140, 0.4, 5);
        }
        if (e.pattern === 2) { e.seq = e.phase > 1 ? 6 : 4; e.seqT = 0; }
        e.patT = e.phase > 1 ? 2.4 : 3.2;
      }
    },
    draw(ctx, e) {
      bossGlow(ctx, e);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.lineWidth = 4;
      ctx.strokeStyle = e.flash > 0 ? '#fff' : e.color;
      ctx.fillStyle = 'rgba(255,176,0,0.12)';
      ctx.rotate(e.spin);
      shapePath(ctx, 'hex', e.r);
      ctx.fill(); ctx.stroke();
      ctx.rotate(-e.spin * 2);
      ctx.lineWidth = 2.5;
      shapePath(ctx, 'hex', e.r * 0.6);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + e.spin;
        const pr = 10 + Math.sin(e.t * 6 + i) * 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * e.r * 0.82, Math.sin(a) * e.r * 0.82, pr, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = e.phase > 1 ? '#ff3b6b' : '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 12 + Math.sin(e.t * 8) * 3, 0, TAU); ctx.fill();
      ctx.restore();
    },
  },

  /* --------------------------------------------------------- OBLITERATOR */
  obliterator: {
    name: 'OBLITERATOR', title: 'Siege Engine Mk.IX', color: '#ff3b3b', hp: 12000, r: 58, speed: 95, dmg: 22,
    score: 5000, xp: 100, phases: [0.5, 0.25],
    update(e, dt, p) {
      bossPhaseCheck(e);
      e.patT -= dt;
      e.spin = (e.spin || 0) + dt * 0.5;
      if (e.mode === 'aim') {
        brake(e, dt, 8);
        e.angle = angleTo(e.x, e.y, p.x, p.y);
        e.modeT -= dt;
        if (e.modeT <= 0) {
          e.mode = 'charge'; e.modeT = 0.65;
          e.vx = Math.cos(e.angle) * 950; e.vy = Math.sin(e.angle) * 950;
          Sound.play('dash'); shake(0.3);
        }
        return;
      }
      if (e.mode === 'charge') {
        e.modeT -= dt;
        FX.trail(e.x, e.y, e.color, 30, 0.35);
        if (frand(0, 1) < 0.3) Game.grid.impulse(e.x, e.y, 200, 140);
        if (e.modeT <= 0) {
          e.charges--;
          if (e.phase >= 2) ringBurst(e, 14, 200);
          if (e.charges > 0) { e.mode = 'aim'; e.modeT = 0.55; } else { e.mode = null; }
        }
        return;
      }
      hover(e, dt, p, 360, eSpeed(e));
      e.angle = angleTo(e.x, e.y, p.x, p.y);
      if (e.patT <= 0) {
        e.pattern = (e.pattern + 1) % 3;
        if (e.pattern === 0) { e.mode = 'aim'; e.modeT = 0.9; e.charges = e.phase > 1 ? 3 : 2; e.patT = 4.2; }
        if (e.pattern === 1) {
          const base = angleTo(e.x, e.y, p.x, p.y);
          const n = e.phase > 1 ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * (TAU / (n * 1.6));
            addHazard({ kind: 'laser', owner: e, x: e.x, y: e.y, angle: a, angVel: e.phase > 1 ? (i % 2 ? 0.45 : -0.45) : 0.25, len: 2800, width: 30, warn: 1.0, dur: 1.1, dmg: 20 * W.dmgScale, color: e.color });
          }
          Sound.play('laserCharge');
          e.patT = 3.6;
        }
        if (e.pattern === 2) {
          const n = e.phase > 1 ? 12 : 8;
          for (let i = 0; i < n; i++) enemyBullet(e.x, e.y, i / n * TAU, 160, { color: '#ffb000', dmg: 14 * W.dmgScale, r: 9, homing: 1.6, life: 4.5 });
          Sound.play('enemyShoot');
          e.patT = 3.2;
        }
      }
    },
    draw(ctx, e) {
      bossGlow(ctx, e);
      if (e.mode === 'aim') {
        ctx.globalAlpha = 0.2 + 0.3 * Math.abs(Math.sin(e.t * 30));
        ctx.strokeStyle = e.color; ctx.lineWidth = e.r * 1.8;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.angle) * 700, e.y + Math.sin(e.angle) * 700); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.lineWidth = 4;
      ctx.strokeStyle = e.flash > 0 ? '#fff' : e.color;
      ctx.fillStyle = 'rgba(255,59,59,0.12)';
      const r = e.r;
      ctx.beginPath();
      ctx.moveTo(r * 1.15, 0); ctx.lineTo(r * 0.4, r * 0.55); ctx.lineTo(-r * 0.2, r);
      ctx.lineTo(-r * 0.9, r * 0.7); ctx.lineTo(-r * 0.6, 0); ctx.lineTo(-r * 0.9, -r * 0.7);
      ctx.lineTo(-r * 0.2, -r); ctx.lineTo(r * 0.4, -r * 0.55); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.rotate(e.spin * 3);
      ctx.lineWidth = 2;
      ctx.strokeRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6);
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x + Math.cos(e.angle) * e.r * 0.35, e.y + Math.sin(e.angle) * e.r * 0.35, 9, 0, TAU); ctx.fill();
    },
  },

  /* ---------------------------------------------------------- MIRRORMIND */
  mirror: {
    name: 'MIRRORMIND', title: 'The Thousand Reflections', color: '#7dffef', hp: 22000, r: 54, speed: 110, dmg: 22,
    score: 9000, xp: 150, phases: [0.55, 0.25],
    update(e, dt, p) {
      bossPhaseCheck(e);
      e.spin = (e.spin || 0) + dt * (e.phase > 1 ? 2.2 : 1.5);
      e.patT -= dt;
      if (e.blinkT > 0) {
        e.blinkT -= dt;
        brake(e, dt, 10);
        if (e.blinkT <= 0) {
          FX.sparks(e.x, e.y, e.color, 30, 400, 0.4);
          e.x = e.tx; e.y = e.ty;
          FX.ring(e.x, e.y, e.color, 120, 10, 0.3, 6);
          Sound.play('teleport');
          ringBurst(e, 16, 220, e.spin);
        }
        return;
      }
      hover(e, dt, p, 300, eSpeed(e));
      if (e.spiralT > 0) {
        e.spiralT -= dt;
        e.subT -= dt;
        if (e.subT <= 0) {
          e.subT = e.phase > 1 ? 0.07 : 0.09;
          const arms = e.phase > 1 ? 4 : 3;
          for (let i = 0; i < arms; i++) enemyBullet(e.x, e.y, e.spin * 1.3 + i / arms * TAU, 175, { color: e.color, dmg: 11 * W.dmgScale, r: 6 });
        }
      }
      if (e.patT <= 0) {
        e.pattern = (e.pattern + 1) % 4;
        if (e.pattern === 0) { e.spiralT = 2.6; e.subT = 0; e.patT = 3.4; }
        if (e.pattern === 1) {
          const n = e.phase > 1 ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const c = spawnEnemy('clone', e.x, e.y, { instant: true, elite: false });
            if (c) { c.orbit = i / n * TAU; c.owner = e; }
          }
          e.patT = 2.5;
        }
        if (e.pattern === 2) { convergeRain(e.phase > 1 ? 16 : 12, 380, e.color); e.patT = 2.6; }
        if (e.pattern === 3) {
          const a = frand(0, TAU), d = frand(240, 360);
          e.tx = clamp(p.x + Math.cos(a) * d, 100, ARENA_W - 100);
          e.ty = clamp(p.y + Math.sin(a) * d, 100, ARENA_H - 100);
          e.blinkT = 0.6;
          e.patT = 1.8;
        }
      }
    },
    draw(ctx, e) {
      if (e.blinkT > 0) {
        ctx.strokeStyle = e.color; ctx.globalAlpha = 0.7; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.tx, e.ty, e.r * (0.5 + e.blinkT * 2), 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      bossGlow(ctx, e);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = e.flash > 0 ? '#fff' : e.color;
      ctx.fillStyle = 'rgba(125,255,239,0.1)';
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.rotate(e.spin * (k % 2 ? -1 : 1) + k);
        ctx.beginPath();
        ctx.moveTo(e.r * (1 - k * 0.25), 0);
        ctx.lineTo(0, e.r * 0.5 * (1 - k * 0.2));
        ctx.lineTo(-e.r * (1 - k * 0.25), 0);
        ctx.lineTo(0, -e.r * 0.5 * (1 - k * 0.2));
        ctx.closePath();
        if (k === 0) ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
      ctx.restore();
    },
  },

  /* -------------------------------------------------------- CHAOS ENGINE */
  engine: {
    name: 'CHAOS ENGINE', title: 'Heart of the Madness', color: '#ff2bd6', hp: 45000, r: 84, speed: 70, dmg: 30,
    score: 20000, xp: 250, phases: [0.66, 0.33],
    update(e, dt, p) {
      bossPhaseCheck(e);
      e.color = hsl((e.t * 90) % 360, 100, 60);
      e.spin = (e.spin || 0) + dt * (0.6 + e.phase * 0.3);
      hover(e, dt, p, 380, eSpeed(e));
      e.patT -= dt;
      if (e.seq > 0) {
        e.seqT -= dt;
        if (e.seqT <= 0) {
          e.seq--;
          ringBurst(e, 18 + e.phase * 4, 170 + e.phase * 15, e.seq * 0.2 + e.spin, { color: e.color });
          e.seqT = 0.3;
        }
      }
      if (e.phase >= 3 && !e.bh) {
        e.bh = addHazard({ kind: 'blackhole', x: e.x, y: e.y, r: 40, pull: 520, life: 9999, owner: e, weak: true });
      }
      if (e.patT <= 0) {
        const pool = e.phase === 1 ? [0, 1, 2] : e.phase === 2 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5];
        let pick = rng.pick(pool);
        if (pick === e.pattern) pick = pool[(pool.indexOf(pick) + 1) % pool.length];
        e.pattern = pick;
        switch (pick) {
          case 0: e.seq = 3 + e.phase; e.seqT = 0; e.patT = 2.8; break;
          case 1: {
            const n = 4;
            for (let i = 0; i < n; i++) addHazard({ kind: 'laser', owner: e, x: e.x, y: e.y, angle: e.spin + i / n * TAU, angVel: 0.5 * (e.phase > 2 ? -1.3 : 1), len: 2800, width: 26, warn: 1.1, dur: 2.2, dmg: 25 * W.dmgScale, color: '#ff2bd6' });
            Sound.play('laserCharge');
            e.patT = 4;
            break;
          }
          case 2: {
            const types = ['drone', 'dasher', 'bomber', 'shooter', 'spinner'];
            for (let i = 0; i < 4 + e.phase * 2; i++) {
              const a = i / (4 + e.phase * 2) * TAU;
              spawnEnemy(rng.pick(types), e.x + Math.cos(a) * 140, e.y + Math.sin(a) * 140, { elite: false });
            }
            e.patT = 2.6;
            break;
          }
          case 3: convergeRain(18, 400, '#ff8ef0'); e.patT = 2.4; break;
          case 4:
            for (let i = 0; i < 6; i++) addHazard({ kind: 'meteor', x: clamp(p.x + frand(-300, 300), 60, ARENA_W - 60), y: clamp(p.y + frand(-300, 300), 60, ARENA_H - 60), r: frand(80, 120), warn: 1.2 + i * 0.15 });
            e.patT = 2.6;
            break;
          case 5:
            for (let i = 0; i < 10; i++) enemyBullet(e.x, e.y, i / 10 * TAU, 150, { color: '#ffe600', dmg: 14 * W.dmgScale, r: 9, homing: 1.4, life: 4.5 });
            e.patT = 2.8;
            break;
        }
      }
    },
    draw(ctx, e) {
      bossGlow(ctx, e);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.lineWidth = 4;
      for (let k = 0; k < 4; k++) {
        ctx.strokeStyle = e.flash > 0 ? '#fff' : hsl((e.t * 90 + k * 60) % 360, 100, 60);
        ctx.save();
        ctx.rotate(e.spin * (k % 2 ? -1.3 : 1) + k * 0.4);
        const rr = e.r * (1 - k * 0.2);
        shapePath(ctx, k % 2 ? 'star' : 'oct', rr);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(e.t * 10) * 4, 0, TAU); ctx.fill();
      ctx.restore();
    },
  },
};

/* Mirrormind's reflections */
ENEMIES.clone = {
  name: 'Reflection', hp: 70, speed: 140, r: 24, dmg: 14, score: 50, xp: 3, color: '#7dffef', shape: 'ring',
  wave: 999, weight: 0,
  update(e, dt, p) {
    const o = e.owner && !e.owner.dead ? e.owner : null;
    e.orbit = (e.orbit || 0) + dt * 1.1;
    const cx = o ? o.x : p.x, cy = o ? o.y : p.y;
    seek(e, cx + Math.cos(e.orbit) * 200, cy + Math.sin(e.orbit) * 200, 260, dt, 3);
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = 1.6;
      for (let i = 0; i < 8; i++) enemyBullet(e.x, e.y, i / 8 * TAU + e.t, 170, { color: e.color, dmg: 10 * W.dmgScale });
    }
    if (!o && e.t > 2) { e.hp = 0; killEnemy(e, { noLoot: true }); }
  },
};

function bossGlow(ctx, e) {
  const g = e.r * 3.4;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.45 + Math.sin(e.t * 4) * 0.1;
  ctx.drawImage(FX.glow(e.color[0] === '#' ? e.color : '#ff2bd6', 128), e.x - g, e.y - g, g * 2, g * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function spawnBoss(id) {
  const def = BOSSES[id];
  const loops = Math.floor((W.wave - 1) / 20);
  const hp = def.hp * (1 + loops * 1.8) * (W.mode === 'daily' ? 1.1 : 1);
  const p = W.player;
  const x = p.x < ARENA_W / 2 ? ARENA_W * 0.75 : ARENA_W * 0.25;
  const y = ARENA_H / 2;
  const e = {
    id: enemyIdSeq++, type: 'boss', def: { shape: 'boss', score: def.score, xp: def.xp }, bossDef: def, boss: true,
    x, y, vx: 0, vy: 0, r: def.r, baseR: def.r, hp, maxHp: hp, speed: def.speed, dmg: def.dmg * W.dmgScale,
    color: def.color, score: def.score, xp: def.xp, t: 0, state: 0, timer: 0, angle: 0, flash: 0, slow: 0,
    elite: false, spawnT: 0, knockRes: 0.97, dead: false, dieAt: -1, lastOrb: -9, lastDash: -9, dir: 1,
    phase: 1, pattern: -1, patT: 2.2, seq: 0, seqT: 0, gunT: 99, spin: 0,
  };
  W.enemies.push(e);
  W.boss = e;
  W.bossHitTaken = false;
  FX.explosion(x, y, def.color, 4);
  Game.grid.impulse(x, y, 1400, 500);
  shake(0.7);
  return e;
}
