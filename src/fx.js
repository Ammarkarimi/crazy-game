'use strict';
/* ==========================================================================
   Visual effects: additive particles, shockwave rings, floating text,
   lightning bolts, cached glow sprites and the reactive warp grid.
   ========================================================================== */

const MAX_PARTICLES = 2600;
const CONFETTI = ['#ff5a7a', '#ff9b3d', '#ffd93b', '#4dff9a', '#2ee6ff', '#4aa8ff', '#c46bff', '#ff5ec8'];

/* Convert any CSS colour to a hex string with coarse channel steps so that
   animated (hsl) colours still hit a small, bounded sprite cache. */
const _colorCtx = document.createElement('canvas').getContext('2d');
const _quantCache = new Map();
function quantizeColor(css) {
  let v = _quantCache.get(css);
  if (v) return v;
  _colorCtx.fillStyle = '#000';
  _colorCtx.fillStyle = css;
  const hex = _colorCtx.fillStyle;
  if (hex[0] !== '#') return '#ffffff';
  const q = hexToRgb(hex).map(c => Math.min(255, Math.round(c / 51) * 51));
  v = '#' + q.map(c => c.toString(16).padStart(2, '0')).join('');
  if (_quantCache.size < 4000) _quantCache.set(css, v);
  return v;
}

const FX = {
  particles: [],
  rings: [],
  texts: [],
  bolts: [],
  glowCache: new Map(),

  quality() { return Save.data.settings.particles; },

  glow(color, size = 64) {
    if (color[0] !== '#') color = quantizeColor(color);
    const key = color + size;
    let c = this.glowCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.45, rgba(color, 0.35));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    this.glowCache.set(key, c);
    return c;
  },

  clear() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    this.bolts.length = 0;
  },

  /* Directional streak sparks */
  sparks(x, y, color, count, speed = 300, life = 0.5, opts = {}) {
    count = Math.round(count * this.quality());
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = opts.angle !== undefined ? opts.angle + frand(-opts.spread, opts.spread) : frand(0, TAU);
      const s = speed * frand(0.3, 1);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * frand(0.6, 1), max: life, size: opts.size || frand(1.5, 3),
        color, drag: opts.drag || 3.2, type: opts.type || 'spark', grav: opts.grav || 0,
      });
    }
  },

  /* Soft glowing dots */
  dots(x, y, color, count, speed = 120, life = 0.8, size = 10) {
    count = Math.round(count * this.quality());
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = frand(0, TAU), s = speed * frand(0.2, 1);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * frand(0.5, 1), max: life, size: size * frand(0.6, 1.2),
        color, drag: 2, type: 'glow', grav: 0,
      });
    }
  },

  /* Tumbling polygon debris for enemy deaths */
  debris(x, y, color, count, speed = 260, size = 6) {
    count = Math.round(count * this.quality());
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = frand(0, TAU), s = speed * frand(0.3, 1);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: frand(0.5, 1.1), max: 1.1, size: size * frand(0.5, 1.2),
        color, drag: 2.2, type: 'shard', rot: frand(0, TAU), vr: frand(-12, 12), grav: 0,
      });
    }
  },

  /* A cheered-up Grumpy: a smiling face that floats away */
  happy(x, y, color, size) {
    let n = 0;
    for (const p of this.particles) if (p.type === 'happy') n++;
    if (n > 30) return;
    this.particles.push({
      x, y, vx: frand(-30, 30), vy: -frand(60, 100), life: 1.1, max: 1.1,
      size: Math.max(9, size), color: color[0] === '#' ? color : quantizeColor(color), drag: 0.8, type: 'happy', grav: 0, rot: frand(-0.3, 0.3), vr: frand(-1, 1),
    });
  },

  confetti(x, y, count, speed = 300) {
    count = Math.round(count * this.quality());
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = frand(0, TAU), s = speed * frand(0.3, 1);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: frand(0.7, 1.3), max: 1.3,
        size: frand(3, 6), color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
        drag: 2.2, type: 'confetti', grav: 420, rot: frand(0, TAU), vr: frand(-14, 14),
      });
    }
  },

  stars(x, y, count, color = '#ffd93b', speed = 220) {
    count = Math.round(count * this.quality());
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = frand(0, TAU), s = speed * frand(0.3, 1);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: frand(0.4, 0.8), max: 0.8, size: frand(4, 7), color, drag: 3, type: 'star', grav: 0, rot: frand(0, TAU), vr: frand(-6, 6) });
    }
  },

  trail(x, y, color, size = 6, life = 0.3) {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({ x, y, vx: 0, vy: 0, life, max: life, size, color, drag: 0, type: 'glow', grav: 0 });
  },

  ring(x, y, color, r0, r1, life = 0.4, width = 4) {
    this.rings.push({ x, y, color, r0, r1, life, max: life, width });
  },

  text(x, y, str, color = '#fff', size = 16, life = 0.8, opts = {}) {
    if (this.texts.length > 120) this.texts.shift();
    this.texts.push({ x, y, str, color, size, life, max: life, vy: opts.vy === undefined ? -70 : opts.vy, pop: opts.pop || 0 });
  },

  bolt(x1, y1, x2, y2, color = '#9ff', life = 0.18, jag = 22) {
    const pts = [[x1, y1]];
    const segs = Math.max(3, Math.floor(dist(x1, y1, x2, y2) / 26));
    const nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < segs; i++) {
      const t = i / segs, off = frand(-jag, jag);
      pts.push([lerp(x1, x2, t) + nx / nl * off, lerp(y1, y2, t) + ny / nl * off]);
    }
    pts.push([x2, y2]);
    this.bolts.push({ pts, color, life, max: life });
  },

  explosion(x, y, color, scale = 1) {
    this.sparks(x, y, color, 22 * scale, 420 * Math.sqrt(scale), 0.55);
    this.sparks(x, y, '#ffffff', 8 * scale, 260 * Math.sqrt(scale), 0.3);
    this.dots(x, y, color, 6 * scale, 90 * scale, 0.6, 18 * Math.sqrt(scale));
    this.ring(x, y, color, 6, 60 * scale, 0.35, 5);
  },

  update(dt) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += p.vr * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.life -= dt; t.y += t.vy * dt; t.vy *= Math.exp(-3 * dt);
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.life -= dt;
      if (b.life <= 0) this.bolts.splice(i, 1);
    }
  },

  draw(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const t = p.life / p.max;
      if (p.type === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = Math.min(1, t * 1.5);
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      } else if (p.type === 'glow') {
        const s = p.size * (0.4 + t * 0.8) * 2;
        ctx.globalAlpha = t;
        ctx.drawImage(this.glow(p.color), p.x - s, p.y - s, s * 2, s * 2);
      } else if (p.type === 'star') {
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        starPath(ctx, p.size); ctx.fill();
        ctx.restore();
      } else if (p.type === 'shard') {
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        const s = p.size, c = Math.cos(p.rot) * s, sn = Math.sin(p.rot) * s;
        ctx.beginPath();
        ctx.moveTo(p.x + c, p.y + sn);
        ctx.lineTo(p.x - sn * 0.6, p.y + c * 0.6);
        ctx.lineTo(p.x - c, p.y - sn);
        ctx.closePath();
        ctx.stroke();
      }
    }
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const rad = lerp(r.r0, r.r1, easeOutCubic(t));
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }
    for (const b of this.bolts) {
      const a = b.life / b.max;
      for (const [w, col, al] of [[7, b.color, 0.35], [2.5, '#ffffff', 1]]) {
        ctx.globalAlpha = a * al;
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(b.pts[0][0], b.pts[0][1]);
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // solid (non-additive) pass: confetti and happy faces
    for (const p of this.particles) {
      if (p.type !== 'confetti' && p.type !== 'happy') continue;
      const t = p.life / p.max;
      if (p.type === 'confetti') {
        ctx.globalAlpha = Math.min(1, t * 2.5);
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.45 * Math.abs(Math.cos(p.rot * 1.7)) - 0.5, p.size * 2, p.size * 0.9 * Math.abs(Math.cos(p.rot * 1.7)) + 1);
        ctx.restore();
      } else {
        const age = 1 - t;
        const s = p.size * (age < 0.15 ? 0.6 + age / 0.15 * 0.5 : 1.1);
        ctx.globalAlpha = Math.min(1, t * 2.2);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(age * 10) * 0.25);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        drawFace(ctx, 0, 0, s, { mood: 'happy' });
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  },

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const age = t.max - t.life;
      const pop = age < 0.12 ? 1 + (1 - age / 0.12) * (0.6 + t.pop) : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `700 ${Math.round(t.size * pop)}px Fredoka, Segoe UI, Arial, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color === 'rainbow' ? hsl((performance.now() / 3 + t.x) % 360, 100, 65) : t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  },
};

function starPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i / 10 * TAU, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

/* ---------------------------------------------------------------------------
   Warp grid: a spring-mass mesh behind the action that ripples from every
   explosion, dash and black hole. The signature HYPERCHAOS look.
   ------------------------------------------------------------------------- */
class WarpGrid {
  constructor(w, h, spacing) {
    this.sp = spacing;
    this.cols = Math.floor(w / spacing) + 1;
    this.rows = Math.floor(h / spacing) + 1;
    const n = this.cols * this.rows;
    this.ox = new Float32Array(n); this.oy = new Float32Array(n);
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        this.ox[i] = this.x[i] = c * spacing;
        this.oy[i] = this.y[i] = r * spacing;
      }
    }
  }

  /* force > 0 pushes outward, < 0 pulls inward */
  impulse(x, y, force, radius) {
    const sp = this.sp;
    const c0 = Math.max(0, Math.floor((x - radius) / sp)), c1 = Math.min(this.cols - 1, Math.ceil((x + radius) / sp));
    const r0 = Math.max(0, Math.floor((y - radius) / sp)), r1 = Math.min(this.rows - 1, Math.ceil((y + radius) / sp));
    const r2 = radius * radius;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        const dx = this.x[i] - x, dy = this.y[i] - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2 || d2 < 1) continue;
        const d = Math.sqrt(d2);
        const f = force * (1 - d / radius);
        this.vx[i] += dx / d * f;
        this.vy[i] += dy / d * f;
      }
    }
  }

  update(dt) {
    const k = 34, damp = Math.exp(-4.2 * dt), n = this.x.length;
    for (let i = 0; i < n; i++) {
      this.vx[i] = (this.vx[i] + (this.ox[i] - this.x[i]) * k * dt) * damp;
      this.vy[i] = (this.vy[i] + (this.oy[i] - this.y[i]) * k * dt) * damp;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      // keep displacement sane
      const dx = this.x[i] - this.ox[i], dy = this.y[i] - this.oy[i];
      if (dx > 70) this.x[i] = this.ox[i] + 70; else if (dx < -70) this.x[i] = this.ox[i] - 70;
      if (dy > 70) this.y[i] = this.oy[i] + 70; else if (dy < -70) this.y[i] = this.oy[i] - 70;
    }
  }

  draw(ctx, vx0, vy0, vx1, vy1, color, alpha) {
    const sp = this.sp, cols = this.cols;
    const c0 = Math.max(0, Math.floor(vx0 / sp) - 1), c1 = Math.min(cols - 1, Math.ceil(vx1 / sp) + 1);
    const r0 = Math.max(0, Math.floor(vy0 / sp) - 1), r1 = Math.min(this.rows - 1, Math.ceil(vy1 / sp) + 1);
    ctx.lineWidth = 1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = pass === 0 ? alpha : alpha * 2.4;
      ctx.lineWidth = pass === 0 ? 1 : 1.6;
      ctx.beginPath();
      for (let r = r0; r <= r1; r++) {
        if ((r % 4 === 0) !== (pass === 1)) continue;
        let i = r * cols + c0;
        ctx.moveTo(this.x[i], this.y[i]);
        for (let c = c0 + 1; c <= c1; c++) { i = r * cols + c; ctx.lineTo(this.x[i], this.y[i]); }
      }
      for (let c = c0; c <= c1; c++) {
        if ((c % 4 === 0) !== (pass === 1)) continue;
        let i = r0 * cols + c;
        ctx.moveTo(this.x[i], this.y[i]);
        for (let r = r0 + 1; r <= r1; r++) { i = r * cols + c; ctx.lineTo(this.x[i], this.y[i]); }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
