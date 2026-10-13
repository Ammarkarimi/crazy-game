'use strict';
/* ==========================================================================
   Enemy roster + AI. Each type has stats, a spawn wave and an update brain.
   ========================================================================== */

function eSpeed(e) { return e.speed * (e.slow > 0 ? 0.4 : 1); }

function seekAngle(e, a, spd, dt, accel = 5) {
  const k = 1 - Math.exp(-accel * dt);
  e.vx += (Math.cos(a) * spd - e.vx) * k;
  e.vy += (Math.sin(a) * spd - e.vy) * k;
}
function seek(e, tx, ty, spd, dt, accel = 5) {
  const a = Math.atan2(ty - e.y, tx - e.x);
  seekAngle(e, a, spd, dt, accel);
  e.angle = a;
}
function brake(e, dt, k = 6) { const d = Math.exp(-k * dt); e.vx *= d; e.vy *= d; }

const ENEMIES = {
  drone: {
    name: 'Drone', hp: 16, speed: 112, r: 13, dmg: 10, score: 10, xp: 1, color: '#ff3b6b', shape: 'diamond',
    wave: 1, weight: 10,
    update(e, dt, p) { seek(e, p.x, p.y, eSpeed(e), dt, 4); },
  },

  swarm: {
    name: 'Swarmlet', hp: 5, speed: 185, r: 8, dmg: 6, score: 4, xp: 1, color: '#ffb000', shape: 'tri',
    wave: 2, weight: 6, group: [4, 7],
    update(e, dt, p) {
      const a = angleTo(e.x, e.y, p.x, p.y) + Math.sin(e.t * 5 + e.id) * 0.8;
      seekAngle(e, a, eSpeed(e), dt, 3);
      e.angle = Math.atan2(e.vy, e.vx);
    },
  },

  dasher: {
    name: 'Dasher', hp: 24, speed: 85, r: 14, dmg: 16, score: 16, xp: 2, color: '#ff7a00', shape: 'arrow',
    wave: 3, weight: 6,
    update(e, dt, p) {
      const d = dist(e.x, e.y, p.x, p.y);
      if (e.state === 0) { // approach
        seek(e, p.x, p.y, eSpeed(e), dt, 4);
        e.timer -= dt;
        if (d < 380 && e.timer <= 0) { e.state = 1; e.timer = 0.6; }
      } else if (e.state === 1) { // aim / telegraph
        brake(e, dt, 8);
        e.angle = angleTo(e.x, e.y, p.x, p.y);
        e.timer -= dt;
        if (e.timer <= 0) {
          e.state = 2; e.timer = 0.42;
          const s = 720 * (e.slow > 0 ? 0.5 : 1);
          e.vx = Math.cos(e.angle) * s; e.vy = Math.sin(e.angle) * s;
          Sound.play('dash');
        }
      } else if (e.state === 2) { // dash
        e.timer -= dt;
        if (frand(0, 1) < 0.6) FX.trail(e.x, e.y, e.color, e.r * 0.8, 0.25);
        if (e.timer <= 0) { e.state = 3; e.timer = 0.9; }
      } else { // recover
        brake(e, dt, 4);
        e.timer -= dt;
        if (e.timer <= 0) { e.state = 0; e.timer = rng.range(0.6, 1.4); }
      }
    },
    drawExtra(ctx, e) {
      if (e.state === 1) {
        ctx.globalAlpha = 0.25 + 0.35 * Math.sin(e.t * 40) ** 2;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = e.r * 1.6;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.angle) * 300, e.y + Math.sin(e.angle) * 300);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
  },

  shooter: {
    name: 'Gunner', hp: 26, speed: 95, r: 15, dmg: 8, score: 18, xp: 2, color: '#9d4dff', shape: 'square',
    wave: 4, weight: 6,
    update(e, dt, p) {
      const d = dist(e.x, e.y, p.x, p.y);
      const a = angleTo(e.x, e.y, p.x, p.y);
      if (d > 430) seekAngle(e, a, eSpeed(e), dt, 3);
      else if (d < 260) seekAngle(e, a + Math.PI, eSpeed(e), dt, 3);
      else seekAngle(e, a + Math.PI / 2 * e.dir, eSpeed(e) * 0.7, dt, 2);
      e.angle = a;
      e.timer -= dt;
      if (e.timer < 0.3) e.charge = 1 - e.timer / 0.3;
      if (e.timer <= 0) {
        e.timer = rng.range(1.8, 2.8);
        e.charge = 0;
        enemyBullet(e.x, e.y, a, 270, { color: e.color, dmg: e.dmg * 1.4 });
        if (W.wave >= 12) { enemyBullet(e.x, e.y, a - 0.25, 260, { color: e.color, dmg: e.dmg * 1.4 }); enemyBullet(e.x, e.y, a + 0.25, 260, { color: e.color, dmg: e.dmg * 1.4 }); }
      }
    },
  },

  splitter: {
    name: 'Splitter', hp: 44, speed: 72, r: 21, dmg: 14, score: 20, xp: 3, color: '#3dff9e', shape: 'hex',
    wave: 6, weight: 5,
    update(e, dt, p) { seek(e, p.x, p.y, eSpeed(e), dt, 3); e.spin = (e.spin || 0) + dt * 1.5; },
    onDeath(e) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + frand(0, 1);
        const c = spawnEnemy('splitling', e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, { instant: true, elite: false });
        if (c) { c.vx = Math.cos(a) * 260; c.vy = Math.sin(a) * 260; }
      }
    },
  },

  splitling: {
    name: 'Splitling', hp: 8, speed: 155, r: 9, dmg: 7, score: 5, xp: 1, color: '#3dff9e', shape: 'hex',
    wave: 999, weight: 0,
    update(e, dt, p) { seek(e, p.x, p.y, eSpeed(e), dt, 3); e.spin = (e.spin || 0) + dt * 4; },
  },

  bomber: {
    name: 'Bomber', hp: 16, speed: 160, r: 14, dmg: 0, score: 15, xp: 2, color: '#ff2020', shape: 'circle',
    wave: 7, weight: 4,
    update(e, dt, p) {
      if (e.state === 0) {
        seek(e, p.x, p.y, eSpeed(e), dt, 4);
        if (dist(e.x, e.y, p.x, p.y) < 85 + p.r) { e.state = 1; e.timer = 0.55; Sound.play('fuse'); }
      } else {
        brake(e, dt, 10);
        e.timer -= dt;
        if (e.timer <= 0) bomberExplode(e, true);
      }
    },
    onDeath(e) { if (!e.exploded) bomberExplode(e, false); },
  },

  tank: {
    name: 'Juggernaut', hp: 190, speed: 52, r: 30, dmg: 24, score: 45, xp: 8, color: '#00c2ff', shape: 'oct',
    wave: 8, weight: 3, knockRes: 0.88,
    update(e, dt, p) {
      seek(e, p.x, p.y, eSpeed(e), dt, 2);
      if (W.wave >= 14) {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = 4;
          for (let i = 0; i < 10; i++) enemyBullet(e.x, e.y, (i / 10) * TAU + e.t, 170, { color: e.color, dmg: 10 });
        }
      }
    },
  },

  spinner: {
    name: 'Spinner', hp: 60, speed: 95, r: 18, dmg: 12, score: 30, xp: 4, color: '#ff4df0', shape: 'star',
    wave: 11, weight: 4,
    update(e, dt, p) {
      e.orbit = (e.orbit === undefined ? angleTo(p.x, p.y, e.x, e.y) : e.orbit) + dt * 0.55 * e.dir;
      const tx = p.x + Math.cos(e.orbit) * 290, ty = p.y + Math.sin(e.orbit) * 290;
      seek(e, tx, ty, eSpeed(e) * 1.5, dt, 3);
      e.spin = (e.spin || 0) + dt * 3;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = 1.7;
        for (let i = 0; i < 6; i++) enemyBullet(e.x, e.y, e.spin + (i / 6) * TAU, 190, { color: e.color, dmg: 9 });
        Sound.play('enemyShoot');
      }
    },
  },

  blinker: {
    name: 'Phantom', hp: 36, speed: 100, r: 14, dmg: 12, score: 28, xp: 4, color: '#7dffef', shape: 'ring',
    wave: 13, weight: 4,
    update(e, dt, p) {
      e.timer -= dt;
      if (e.state === 0) {
        seek(e, p.x, p.y, eSpeed(e) * 0.7, dt, 3);
        if (e.timer <= 0) {
          e.state = 1; e.timer = 0.5;
          const a = frand(0, TAU), d = frand(170, 270);
          e.tx = clamp(p.x + Math.cos(a) * d, 40, ARENA_W - 40);
          e.ty = clamp(p.y + Math.sin(a) * d, 40, ARENA_H - 40);
        }
      } else if (e.state === 1) {
        brake(e, dt, 10);
        if (e.timer <= 0) {
          FX.sparks(e.x, e.y, e.color, 10, 200, 0.3);
          e.x = e.tx; e.y = e.ty;
          FX.ring(e.x, e.y, e.color, 40, 4, 0.25, 3);
          Sound.play('teleport');
          const a = angleTo(e.x, e.y, p.x, p.y);
          for (let i = -1; i <= 1; i++) enemyBullet(e.x, e.y, a + i * 0.22, 250, { color: e.color, dmg: 10 });
          e.state = 0; e.timer = rng.range(2.4, 3.6);
        }
      }
    },
    drawExtra(ctx, e) {
      if (e.state === 1) {
        const k = 1 - e.timer / 0.5;
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.tx, e.ty, lerp(40, e.r, k), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
  },
};

const ENEMY_TYPES = Object.keys(ENEMIES).filter(k => ENEMIES[k].weight > 0);

function bomberExplode(e, self) {
  e.exploded = true;
  const R = 100 * (W.sizeMult || 1);
  // party-popper blast
  FX.explosion(e.x, e.y, '#ff5ec8', 1.6);
  FX.confetti(e.x, e.y, 40, 520);
  FX.ring(e.x, e.y, '#ffb000', 10, R, 0.35, 8);
  Game.grid.impulse(e.x, e.y, 520, 220);
  shake(0.35);
  Sound.play('kill', 0.6);
  const p = W.player;
  if (self && dist(e.x, e.y, p.x, p.y) < R + p.r * 0.5) damagePlayer(22 * W.dmgScale, e.x, e.y);
  // Bomber blasts hurt other enemies too: chain reactions!
  aoeDamage(e.x, e.y, R, 45 * W.hpScale * 0.5 + 30, { exclude: e, noChain: true, color: '#ff7a00' });
  if (self && !e.dead) { e.hp = 0; killEnemy(e, { noLoot: true }); }
}

/* ---------------------------------------------------------------------------
   Spawning
   ------------------------------------------------------------------------- */
let enemyIdSeq = 1;

function spawnEnemy(type, x, y, opts = {}) {
  const def = ENEMIES[type];
  if (!def) return null;
  const elite = opts.elite !== undefined ? opts.elite : (W.wave >= 4 && rng.chance((0.02 + W.wave * 0.005) * W.diff.elite));
  const sizeMult = W.sizeMult || 1;
  const hp = def.hp * W.hpScale * (W.hpEventMult || 1) * (elite ? 4.5 : 1) * W.diff.enemyHp;
  const e = {
    id: enemyIdSeq++, type, def,
    x: clamp(x, 30, ARENA_W - 30), y: clamp(y, 30, ARENA_H - 30), vx: 0, vy: 0,
    baseR: def.r * (elite ? 1.35 : 1), r: def.r * (elite ? 1.35 : 1) * sizeMult,
    hp, maxHp: hp,
    speed: def.speed * W.spdScale * (elite ? 0.9 : 1) * W.diff.enemySpeed,
    dmg: def.dmg * W.dmgScale * (elite ? 1.3 : 1),
    color: def.color, score: def.score * (elite ? 6 : 1), xp: def.xp * (elite ? 8 : 1),
    t: 0, state: 0, timer: rng.range(0.5, 2), angle: 0, flash: 0, slow: 0, elite,
    boss: false, spawnT: opts.instant ? 0 : 0.65, knockRes: def.knockRes || 0,
    dead: false, dieAt: -1, lastOrb: -9, lastDash: -9, dir: rng.chance(0.5) ? 1 : -1, charge: 0,
    gunT: rng.range(1, 4),
  };
  W.enemies.push(e);
  return e;
}

/* Pick an off-screen spawn point near the edge of the camera view. */
function spawnPoint() {
  const p = W.player;
  const view = Game.viewRect();
  const minD = Math.max(view.w, view.h) * 0.5 + 60;
  for (let i = 0; i < 12; i++) {
    const a = rng.range(0, TAU);
    const d = minD + rng.range(0, 220);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (x > 40 && x < ARENA_W - 40 && y > 40 && y < ARENA_H - 40) return { x, y };
  }
  // fallback: farthest corner-ish
  return { x: p.x < ARENA_W / 2 ? ARENA_W - 80 : 80, y: p.y < ARENA_H / 2 ? ARENA_H - 80 : 80 };
}

function updateEnemy(e, dt) {
  const p = W.player;
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.slow > 0) e.slow -= dt;
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  if (e.boss) e.bossDef.update(e, dt, p);
  else e.def.update(e, dt, p);

  // Bullet Hell event: everybody shoots
  if (W.allShoot && !e.boss && e.def.dmg > 0) {
    e.gunT -= dt;
    if (e.gunT <= 0) {
      e.gunT = rng.range(2.2, 3.6);
      enemyBullet(e.x, e.y, angleTo(e.x, e.y, p.x, p.y), 210, { color: e.color, dmg: 8 * W.dmgScale });
    }
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx); }
  if (e.x > ARENA_W - e.r) { e.x = ARENA_W - e.r; e.vx = -Math.abs(e.vx); }
  if (e.y < e.r) { e.y = e.r; e.vy = Math.abs(e.vy); }
  if (e.y > ARENA_H - e.r) { e.y = ARENA_H - e.r; e.vy = -Math.abs(e.vy); }
}

/* ---------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */
function shapePath(ctx, shape, r, t) {
  ctx.beginPath();
  switch (shape) {
    case 'diamond':
      ctx.moveTo(r, 0); ctx.lineTo(0, r * 0.75); ctx.lineTo(-r, 0); ctx.lineTo(0, -r * 0.75); ctx.closePath();
      break;
    case 'tri':
      ctx.moveTo(r, 0); ctx.lineTo(-r * 0.8, r * 0.75); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.8, -r * 0.75); ctx.closePath();
      break;
    case 'arrow':
      ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.6, r * 0.9); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.6, -r * 0.9); ctx.closePath();
      break;
    case 'square':
      ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      ctx.moveTo(r * 0.3, 0); ctx.lineTo(r * 1.25, 0);
      break;
    case 'hex':
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath();
      break;
    case 'oct':
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath();
      ctx.moveTo(r * 0.5, 0); ctx.arc(0, 0, r * 0.5, 0, TAU);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath();
      break;
    case 'circle':
      ctx.arc(0, 0, r, 0, TAU);
      ctx.moveTo(r * 0.45, 0); ctx.arc(0, 0, r * 0.45, 0, TAU);
      break;
    case 'ring':
      ctx.arc(0, 0, r, 0, TAU);
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + (t || 0) * 3; ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); }
      break;
    default:
      ctx.arc(0, 0, r, 0, TAU);
  }
}

function enemyColor(e) {
  if (W.event && W.event.id === 'disco') return hsl((e.id * 47 + W.t * 220) % 360, 100, 60);
  if (e.slow > 0) return '#9fe8ff';
  return e.color;
}

function drawEnemy(ctx, e) {
  if (e.boss) {
    e.bossDef.draw(ctx, e);
    const p = W.player;
    drawFace(ctx, e.x, e.y, e.r * 0.55, {
      look: Math.atan2(p.y - e.y, p.x - e.x),
      mood: e.flash > 0 ? 'ouch' : e.phase > 1 ? 'mad' : 'grumpy',
      blink: (e.t % 4) < 0.14,
    });
    return;
  }
  const col = enemyColor(e);
  if (e.spawnT > 0) {
    const k = e.spawnT / 0.65;
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + k * 40, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.25 * (1 - k);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  if (e.def.drawExtra) e.def.drawExtra(ctx, e);

  // soft glow underlay
  const g = e.r * 3.2;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = e.elite ? 0.55 : 0.32;
  ctx.drawImage(FX.glow(e.elite ? '#ffd000' : e.color), e.x - g, e.y - g, g * 2, g * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.translate(e.x, e.y);
  const shape = e.def.shape;
  const rot = (shape === 'hex' || shape === 'star') ? (e.spin || 0) : (shape === 'oct' || shape === 'circle' || shape === 'ring') ? 0 : e.angle;
  ctx.rotate(rot);
  let r = e.r;
  if (shape === 'circle' && e.state === 1) r *= 1 + 0.25 * Math.abs(Math.sin(e.t * 30));
  shapePath(ctx, shape, r, e.t);
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : rgbaCache(col, 0.38);
  ctx.fill();
  ctx.lineWidth = e.elite ? 4 : 3;
  ctx.strokeStyle = e.flash > 0 ? '#ffffff' : col;
  ctx.stroke();
  if (e.charge > 0) {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = e.charge;
    ctx.beginPath(); ctx.arc(r * 1.2, 0, 4 + 4 * e.charge, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  const p = W.player;
  drawFace(ctx, e.x, e.y + e.r * 0.05, e.r * (shape === 'square' ? 0.8 : shape === 'arrow' || shape === 'tri' ? 0.75 : 0.9), {
    look: Math.atan2(p.y - e.y, p.x - e.x),
    mood: e.flash > 0 ? 'ouch' : (e.state === 1 && (e.type === 'dasher' || e.type === 'bomber')) ? 'mad' : 'grumpy',
    blink: (e.t + e.id * 0.37) % 3.4 < 0.12,
  });

  if (e.elite) {
    // a little golden crown for the fancy Grumpies
    ctx.fillStyle = '#ffd93b';
    const cx = e.x, cy = e.y - e.r - 6, w = e.r * 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy + 6); ctx.lineTo(cx - w, cy - 4); ctx.lineTo(cx - w / 2, cy + 1); ctx.lineTo(cx, cy - 8);
    ctx.lineTo(cx + w / 2, cy + 1); ctx.lineTo(cx + w, cy - 4); ctx.lineTo(cx + w, cy + 6); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd000';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -e.t * 30;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // elite hp bar
    if (e.hp < e.maxHp) {
      const w = e.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 16, w, 4);
      ctx.fillStyle = '#ffd000'; ctx.fillRect(e.x - w / 2, e.y - e.r - 16, w * (e.hp / e.maxHp), 4);
    }
  }
}

/* Cartoon face used by Grumpies, bosses and the happy floaters.
   mood: 'grumpy' | 'mad' | 'ouch' | 'happy' */
function drawFace(ctx, x, y, r, o = {}) {
  const mood = o.mood || 'grumpy';
  const ex = r * 0.38, ey = -r * 0.12, er = Math.max(2.4, r * 0.28);
  const lw = Math.max(1.6, r * 0.11);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha *= 1;
  if (mood === 'happy') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(s * ex, ey + er * 0.4, er * 0.75, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, r * 0.12, r * 0.38, 0.1 * Math.PI, 0.9 * Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,170,0.75)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.62, r * 0.12, r * 0.14, 0, TAU); ctx.fill(); }
  } else if (mood === 'ouch' || o.blink) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (mood === 'ouch') { ctx.moveTo(s * ex - er * 0.6 * s, ey - er * 0.6); ctx.lineTo(s * ex + er * 0.5 * s, ey); ctx.lineTo(s * ex - er * 0.6 * s, ey + er * 0.6); }
      else { ctx.moveTo(s * ex - er * 0.7, ey); ctx.lineTo(s * ex + er * 0.7, ey); }
      ctx.stroke();
    }
    if (mood === 'ouch' && r > 9) { ctx.fillStyle = '#1a0f3d'; ctx.beginPath(); ctx.ellipse(0, r * 0.4, r * 0.16, r * 0.2, 0, 0, TAU); ctx.fill(); }
  } else {
    const lx = Math.cos(o.look || 0) * er * 0.42, ly = Math.sin(o.look || 0) * er * 0.42;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(s * ex, ey, er, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0f3d';
      ctx.beginPath(); ctx.arc(s * ex + lx, ey + ly, er * 0.52, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(s * ex + lx - er * 0.18, ey + ly - er * 0.2, er * 0.16, 0, TAU); ctx.fill();
    }
    if (r > 9) {
      // grumpy eyebrows + pouty mouth
      ctx.strokeStyle = '#1a0f3d';
      ctx.lineWidth = lw * 1.1;
      const tilt = mood === 'mad' ? 0.75 : 0.45;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * (ex + er * 1.0), ey - er * (1.25 + tilt * 0.3));
        ctx.lineTo(s * (ex - er * 0.7), ey - er * (1.05 - tilt * 0.4));
        ctx.stroke();
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lw;
      ctx.beginPath();
      if (mood === 'mad') ctx.ellipse(0, r * 0.45, r * 0.14, r * 0.12, 0, 0, TAU);
      else ctx.arc(0, r * 0.62, r * 0.24, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

const _rgbaCache = new Map();
function rgbaCache(col, a) {
  if (col[0] !== '#') return col.replace(/[\d.]+\)$/, a + ')');
  const k = col + a;
  let v = _rgbaCache.get(k);
  if (!v) { v = rgba(col, a); _rgbaCache.set(k, v); }
  return v;
}
