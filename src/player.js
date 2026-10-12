'use strict';
/* ==========================================================================
   Player ship: movement, dash, aiming, weapons, orbitals, drones, thunder.
   ========================================================================== */

function makePlayer(ship) {
  const m = Save.data.meta;
  const s = ship.stats;
  const p = {
    ship: ship.id, color: ship.color,
    x: ARENA_W / 2, y: ARENA_H / 2, vx: 0, vy: 0, r: 13, angle: -Math.PI / 2,
    maxHp: (s.maxHp || 100) + m.hp * 10, hp: 0,
    speed: (s.speed || 290) * (1 + m.speed * 0.04),
    fireRate: s.fireRate || 6, fireCd: 0,
    damage: (s.damage || 10) * (1 + m.dmg * 0.06),
    bulletSpeed: 820, bulletLife: s.bulletLife || 0.85, bulletSize: 5,
    shots: s.shots || 1, spread: s.spread || 0.1,
    pierce: 0, bounce: 0, crit: 0.05, critMult: 2,
    homing: s.homing || 0, explosive: 0, chain: 0, freeze: 0, lifesteal: 0,
    magnet: 120 * (1 + m.magnet * 0.15), regen: 0, armor: s.armor || 0,
    dashCd: s.dashCd || 1.5, dashTimer: 0, dashTime: 0, dashDamage: !!s.dashDamage, dashId: 0,
    iframes: 0, orbitals: s.orbitals || 0, orbAngle: 0, drones: 0, droneList: [],
    novaOnHit: 0, backShot: 0, thunder: 0, thunderT: 3, secondWind: m.revive ? 1 : 0,
    chaosGain: s.chaosGain || 1, luck: 0, xpMult: 1 + m.xp * 0.08, shardMult: 1 + m.shard * 0.1,
    midas: false, hydra: false, odDuration: 6, extraChoice: s.extraChoice || 0,
    hurtT: 0, muzzle: 0, autoTarget: null, autoT: 0, thrust: 0,
  };
  p.hp = p.maxHp;
  return p;
}

function nearestEnemy(x, y, maxR, exclude) {
  let best = null, bd = maxR * maxR;
  for (const e of W.enemies) {
    if (e.dead || e.spawnT > 0 || e === exclude || e.dieAt >= 0) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const _near = [];

function updatePlayer(p, dt) {
  const mv = Input.moveVector();
  p.r = W.tiny ? 7 : 13;
  const spd = p.speed * (W.tiny ? 1.2 : 1);
  p.thrust = Math.hypot(mv.x, mv.y);

  // ---- movement / dash ----
  if (p.dashTime > 0) {
    p.dashTime -= dt;
    FX.trail(p.x, p.y, p.color, 11, 0.35);
    if (p.dashDamage) {
      Game.sgrid.query(p.x, p.y, p.r + 18, _near);
      for (const e of _near) {
        if (e.dead || e.spawnT > 0 || e.lastDash === p.dashId) continue;
        if (dist2(p.x, p.y, e.x, e.y) < (p.r + e.r + 18) ** 2) {
          e.lastDash = p.dashId;
          damageEnemy(e, p.damage * 3.2, { kx: p.vx * 0.3, ky: p.vy * 0.3, color: p.color });
        }
      }
    }
    if (p.dashTime <= 0) { p.vx *= 0.3; p.vy *= 0.3; }
  } else {
    const k = 1 - Math.exp(-14 * dt);
    p.vx += (mv.x * spd - p.vx) * k;
    p.vy += (mv.y * spd - p.vy) * k;
  }
  p.x = clamp(p.x + p.vx * dt, p.r, ARENA_W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, ARENA_H - p.r);

  p.dashTimer -= dt;
  if (Input.hit('dash') && p.dashTimer <= 0) {
    const a = p.thrust > 0.2 ? Math.atan2(mv.y, mv.x) : p.angle;
    p.vx = Math.cos(a) * 1050; p.vy = Math.sin(a) * 1050;
    p.dashTime = 0.17;
    p.dashTimer = p.dashCd;
    p.dashId++;
    p.iframes = Math.max(p.iframes, 0.28);
    Sound.play('dash');
    FX.ring(p.x, p.y, p.color, 8, 50, 0.25, 3);
    Game.grid.impulse(p.x, p.y, 380, 140);
  }

  // ---- aiming ----
  const aim = Input.aim();
  let hasTarget = true;
  if (aim.mode === 'mouse') {
    const w = Game.screenToWorld(Input.mouse.x, Input.mouse.y);
    p.angle = angleTo(p.x, p.y, w.x, w.y);
  } else if (aim.mode === 'dir') {
    p.angle = W.mirror ? Math.PI - aim.angle : aim.angle;
  } else {
    p.autoT -= dt;
    if (p.autoT <= 0 || !p.autoTarget || p.autoTarget.dead) {
      p.autoTarget = nearestEnemy(p.x, p.y, 720);
      p.autoT = 0.15;
    }
    const t = p.autoTarget;
    if (t && !t.dead) {
      // light lead on the target
      const d = dist(p.x, p.y, t.x, t.y), tt = d / p.bulletSpeed;
      const want = angleTo(p.x, p.y, t.x + t.vx * tt, t.y + t.vy * tt);
      p.angle += angDiff(p.angle, want) * Math.min(1, dt * 18);
    } else {
      hasTarget = false;
      if (p.thrust > 0.2) p.angle += angDiff(p.angle, Math.atan2(mv.y, mv.x)) * Math.min(1, dt * 8);
    }
  }

  // ---- shooting ----
  const od = W.overdrive > 0;
  const rate = p.fireRate * (od ? 2.5 : 1);
  const wantFire = Input.firing(Save.data.settings.autofire) && (aim.mode !== 'auto' || hasTarget);
  p.fireCd -= dt;
  if (wantFire) {
    let n = 0;
    while (p.fireCd <= 0 && n < 4) { firePlayer(p); p.fireCd += 1 / rate; n++; }
  }
  if (p.fireCd < 0) p.fireCd = 0;
  if (p.muzzle > 0) p.muzzle -= dt;

  // ---- passives ----
  if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  if (p.iframes > 0) p.iframes -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;

  updateOrbitals(p, dt);
  updateDrones(p, dt);
  updateThunder(p, dt);

  if (od && frand(0, 1) < 0.7) FX.trail(p.x - Math.cos(p.angle) * 10, p.y - Math.sin(p.angle) * 10, hsl((W.t * 400) % 360, 100, 60), 9, 0.4);
  else if (p.thrust > 0.2 && frand(0, 1) < 0.5) FX.trail(p.x - Math.cos(p.angle) * 12, p.y - Math.sin(p.angle) * 12, p.color, 5, 0.2);
}

function bulletArc(n, spread) { return n <= 1 ? 0 : Math.min(1.3, spread * (n - 1)); }

function firePlayer(p) {
  const n = p.shots;
  const arc = bulletArc(n, p.spread);
  for (let i = 0; i < n; i++) {
    const a = p.angle + (n === 1 ? 0 : (i / (n - 1) - 0.5) * arc) + frand(-0.025, 0.025);
    spawnBullet(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14, a, p, 1);
  }
  for (let k = 0; k < p.backShot; k++) {
    const a = p.angle + Math.PI + (p.backShot === 1 ? 0 : (k - 0.5) * 0.25);
    spawnBullet(p.x, p.y, a, p, 0.8);
  }
  p.muzzle = 0.05;
  Sound.play('shoot');
}

function spawnBullet(x, y, a, p, dmgMult, opts) {
  if (W.bullets.length > 900) return;
  const spd = (opts && opts.speed) || p.bulletSpeed;
  W.bullets.push({
    x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
    r: p.bulletSize * (W.sizeMult || 1) * ((opts && opts.size) || 1),
    dmg: p.damage * dmgMult,
    life: (opts && opts.life) || p.bulletLife,
    pierce: p.pierce + (W.overdrive > 0 ? 2 : 0),
    bounce: p.bounce,
    homing: p.homing,
    hits: [],
    child: !!(opts && opts.child),
    color: (opts && opts.color) || null,
    target: null, retarget: 0,
  });
}

function orbitalRadius(p) { return 62 + p.orbitals * 5; }

function updateOrbitals(p, dt) {
  if (p.orbitals <= 0) return;
  p.orbAngle += dt * (3 + p.orbitals * 0.15) * (W.overdrive > 0 ? 1.8 : 1);
  const R = orbitalRadius(p), br = 12 * (W.sizeMult || 1);
  for (let i = 0; i < p.orbitals; i++) {
    const a = p.orbAngle + i / p.orbitals * TAU;
    const bx = p.x + Math.cos(a) * R, by = p.y + Math.sin(a) * R;
    Game.sgrid.query(bx, by, br, _near);
    for (const e of _near) {
      if (e.dead || e.spawnT > 0) continue;
      if (W.t - e.lastOrb < 0.33) continue;
      if (dist2(bx, by, e.x, e.y) < (br + e.r) ** 2) {
        e.lastOrb = W.t;
        damageEnemy(e, p.damage * 0.9, { kx: Math.cos(a + Math.PI / 2) * 160, ky: Math.sin(a + Math.PI / 2) * 160, color: '#ffffff' });
      }
    }
    // blades eat enemy bullets
    for (const b of W.ebullets) {
      if (b.delay > 0) continue;
      if (dist2(bx, by, b.x, b.y) < (br + b.r) ** 2) { b.life = 0; FX.sparks(b.x, b.y, '#fff', 3, 150, 0.2); }
    }
  }
}

function updateDrones(p, dt) {
  while (p.droneList.length < p.drones) p.droneList.push({ x: p.x, y: p.y, cd: frand(0, 0.5), angle: 0 });
  const n = p.droneList.length;
  for (let i = 0; i < n; i++) {
    const d = p.droneList[i];
    const a = W.t * 1.2 + i / n * TAU;
    const tx = p.x + Math.cos(a) * 46, ty = p.y + Math.sin(a) * 46;
    const k = 1 - Math.exp(-8 * dt);
    d.x += (tx - d.x) * k; d.y += (ty - d.y) * k;
    d.cd -= dt * (W.overdrive > 0 ? 2 : 1);
    const t = nearestEnemy(d.x, d.y, 520);
    if (t) d.angle = angleTo(d.x, d.y, t.x, t.y);
    if (t && d.cd <= 0) {
      d.cd = 0.5;
      spawnBullet(d.x, d.y, d.angle, p, 0.55, { speed: 760, life: 0.8, size: 0.8, color: '#3dff9e' });
    }
  }
}

function updateThunder(p, dt) {
  if (p.thunder <= 0) return;
  p.thunderT -= dt;
  if (p.thunderT > 0) return;
  p.thunderT = 3.2 / (1 + 0.45 * (p.thunder - 1));
  const view = Game.viewRect();
  const cands = W.enemies.filter(e => !e.dead && e.spawnT <= 0 && e.x > view.x && e.x < view.x + view.w && e.y > view.y && e.y < view.y + view.h);
  const strikes = Math.min(cands.length, p.thunder);
  for (let i = 0; i < strikes; i++) {
    const e = cands.splice(Math.floor(frand(0, cands.length)), 1)[0];
    FX.bolt(e.x + frand(-80, 80), e.y - 700, e.x, e.y, '#9fd8ff', 0.25, 40);
    FX.ring(e.x, e.y, '#9fd8ff', 6, 70, 0.3, 4);
    aoeDamage(e.x, e.y, 70, p.damage * 2, { color: '#9fd8ff' });
    damageEnemy(e, p.damage * 5, { color: '#9fd8ff' });
    Game.grid.impulse(e.x, e.y, 300, 120);
  }
  if (strikes) { Sound.play('zap'); shake(0.15); }
}

/* ---------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */
function shipPath(ctx, id, r) {
  ctx.beginPath();
  switch (id) {
    case 'razor':
      ctx.moveTo(r * 1.6, 0); ctx.lineTo(-r * 0.9, r * 0.55); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.9, -r * 0.55);
      break;
    case 'bulwark':
      ctx.moveTo(r * 1.1, -r * 0.35); ctx.lineTo(r * 1.1, r * 0.35); ctx.lineTo(r * 0.3, r * 1.05); ctx.lineTo(-r * 0.9, r * 0.9);
      ctx.lineTo(-r * 0.6, 0); ctx.lineTo(-r * 0.9, -r * 0.9); ctx.lineTo(r * 0.3, -r * 1.05);
      break;
    case 'prism':
      ctx.moveTo(r * 1.3, 0); ctx.lineTo(0, r * 0.85); ctx.lineTo(-r * 0.9, 0); ctx.lineTo(0, -r * 0.85);
      ctx.closePath();
      ctx.moveTo(r * 0.5, 0); ctx.lineTo(0, r * 0.35); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(0, -r * 0.35);
      break;
    case 'glitch':
      ctx.moveTo(r * 1.35, 0); ctx.lineTo(r * 0.2, r * 0.4); ctx.lineTo(r * 0.1, r * 1.0); ctx.lineTo(-r * 0.5, r * 0.5);
      ctx.lineTo(-r * 1.0, r * 0.8); ctx.lineTo(-r * 0.7, 0); ctx.lineTo(-r * 1.0, -r * 0.8); ctx.lineTo(-r * 0.5, -r * 0.5);
      ctx.lineTo(r * 0.1, -r * 1.0); ctx.lineTo(r * 0.2, -r * 0.4);
      break;
    default: // vector
      ctx.moveTo(r * 1.35, 0); ctx.lineTo(-r * 0.9, r * 0.85); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r * 0.9, -r * 0.85);
  }
  ctx.closePath();
}

function drawShip(ctx, id, color, x, y, angle, r, opts = {}) {
  const g = r * 4;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5;
  ctx.drawImage(FX.glow(color), x - g, y - g, g * 2, g * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (opts.thrust > 0.2) {
    const fl = r * (0.8 + Math.random() * 0.7) * opts.thrust;
    ctx.fillStyle = opts.flame || '#ffb000';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.3); ctx.lineTo(-r * 0.55 - fl, 0); ctx.lineTo(-r * 0.55, -r * 0.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  shipPath(ctx, id, r);
  ctx.fillStyle = rgba(color, 0.25);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = opts.flash ? '#ffffff' : color;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(r * 0.15, 0, r * 0.18, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, p) {
  if (W.dying > 0) return;
  // orbitals
  if (p.orbitals > 0) {
    const R = orbitalRadius(p), br = 12 * (W.sizeMult || 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
    for (let i = 0; i < p.orbitals; i++) {
      const a = p.orbAngle + i / p.orbitals * TAU;
      const bx = p.x + Math.cos(a) * R, by = p.y + Math.sin(a) * R;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(FX.glow('#ffffff'), bx - br * 2.2, by - br * 2.2, br * 4.4, br * 4.4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a * 3);
      ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) { const aa = k / 3 * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(aa) * br, Math.sin(aa) * br); }
      ctx.stroke();
      ctx.restore();
    }
  }
  // drones
  for (const d of p.droneList) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    ctx.strokeStyle = '#3dff9e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, 5); ctx.lineTo(-6, -5); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  const blink = p.iframes > 0 && p.dashTime <= 0 && Math.floor(W.t * 20) % 2 === 0;
  if (!blink) {
    const col = W.overdrive > 0 ? hsl((W.t * 400) % 360, 100, 65) : p.color;
    drawShip(ctx, p.ship, col[0] === '#' ? col : quantizeColor(col), p.x, p.y, p.angle, p.r * 1.2, { thrust: p.thrust, flash: p.hurtT > 0 });
  }
  if (W.overdrive > 0) {
    ctx.strokeStyle = hsl((W.t * 400 + 180) % 360, 100, 65);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4 + Math.sin(W.t * 20) * 3, 0, TAU); ctx.stroke();
  }
  // aim tick
  ctx.strokeStyle = rgba(p.color, 0.5); ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
  ctx.lineTo(p.x + Math.cos(p.angle) * 40, p.y + Math.sin(p.angle) * 40);
  ctx.stroke();
}
