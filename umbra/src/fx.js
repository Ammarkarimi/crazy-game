'use strict';
/* Particles (world space, y-up) and floating text. */

class FX {
  constructor() { this.parts = []; this.texts = []; this.flashes = []; }

  add(p) {
    if (this.parts.length > 900) this.parts.shift();
    p.life = p.max = p.life || 30;
    p.drag = p.drag ?? 0.92; p.grav = p.grav ?? 0; p.size = p.size || 3; p.rot = p.rot || 0; p.vr = p.vr || 0;
    this.parts.push(p);
    return p;
  }

  hit(x, y, dir, power, color = '#ffffff') {
    const n = Math.round(10 + power * 10);
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + rand(-0.9, 0.9);
      const sp = rand(5, 15) * (0.6 + power * 0.5);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, life: randi(8, 16), size: rand(1.5, 3.2), color, drag: 0.86 });
    }
    // ink droplets: the "blood" of shadows
    for (let i = 0; i < 6 + power * 6; i++) {
      const a = (dir > 0 ? 0 : Math.PI) + rand(-0.7, 0.7);
      const sp = rand(3, 9);
      this.add({ type: 'ink', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + rand(1, 5), life: randi(30, 55), size: rand(2, 5.5), grav: 0.45, drag: 0.98 });
    }
    this.add({ type: 'ring', x, y, life: 12, size: 12 + power * 20, color });
    this.add({ type: 'slash', x, y, life: 9, size: 40 + power * 40, rot: rand(-0.8, 0.8), color });
  }

  block(x, y, dir) {
    for (let i = 0; i < 14; i++) {
      const a = (dir > 0 ? Math.PI : 0) + rand(-1.1, 1.1);
      const sp = rand(4, 11);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 3, life: randi(10, 20), size: rand(1.4, 2.4), color: '#ffd27a', grav: 0.35, drag: 0.94 });
    }
    this.add({ type: 'ring', x, y, life: 10, size: 26, color: '#ffe9b0' });
  }

  parry(x, y) {
    for (let i = 0; i < 28; i++) {
      const a = rand(TAU), sp = rand(5, 14);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: randi(14, 26), size: rand(1.5, 3), color: '#bfe8ff', drag: 0.9 });
    }
    this.add({ type: 'ring', x, y, life: 18, size: 70, color: '#bfe8ff' });
    this.add({ type: 'ring', x, y, life: 26, size: 120, color: '#ffffff' });
  }

  dust(x, y, power = 1) {
    for (let i = 0; i < 8 * power; i++) {
      this.add({ type: 'dust', x: x + rand(-20, 20), y: y + 2, vx: rand(-3, 3) * power, vy: rand(0.5, 2.5), life: randi(20, 40), size: rand(8, 18) * power, drag: 0.93 });
    }
  }

  burst(x, y, color, n = 20, speed = 9) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), sp = rand(2, speed);
      this.add({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: randi(14, 30), size: rand(1.5, 3.5), color, drag: 0.9 });
    }
  }

  flame(x, y, n = 3) {
    for (let i = 0; i < n; i++) this.add({ type: 'flame', x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-0.6, 0.6), vy: rand(1, 3), life: randi(14, 26), size: rand(6, 12), drag: 0.95 });
  }

  smoke(x, y, n = 10, size = 30) {
    for (let i = 0; i < n; i++) this.add({ type: 'smoke', x: x + rand(-size, size) * 0.6, y: y + rand(0, size), vx: rand(-1.5, 1.5), vy: rand(0.3, 1.8), life: randi(40, 70), size: rand(size * 0.6, size * 1.3), drag: 0.96 });
  }

  text(x, y, str, color = '#ffffff', size = 28, life = 50) {
    this.texts.push({ x, y, str, color, size, life, max: life, vy: 1.4 });
  }

  update() {
    for (const p of this.parts) {
      p.life--;
      p.vx *= p.drag; p.vy *= p.drag; p.vy -= p.grav;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.type === 'ink' && p.y < 0) { p.y = 0; p.vy = 0; p.vx *= 0.5; p.grounded = true; }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.texts) { t.life--; t.y += t.vy; t.vy *= 0.95; }
    this.texts = this.texts.filter(t => t.life > 0);
  }

  draw(ctx) {
    for (const p of this.parts) {
      const a = p.life / p.max;
      switch (p.type) {
        case 'spark':
          ctx.strokeStyle = p.color; ctx.globalAlpha = Math.min(1, a * 1.5); ctx.lineWidth = p.size; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); ctx.stroke();
          break;
        case 'ink':
          ctx.fillStyle = INK; ctx.globalAlpha = Math.min(1, a * 2);
          if (p.grounded) { ctx.beginPath(); ctx.ellipse(p.x, 1, p.size * 1.6, p.size * 0.35, 0, 0, TAU); ctx.fill(); }
          else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.4), 0, TAU); ctx.fill(); }
          break;
        case 'dust': case 'smoke':
          ctx.fillStyle = p.type === 'dust' ? 'rgba(200,200,210,1)' : 'rgba(30,30,40,1)';
          ctx.globalAlpha = a * (p.type === 'dust' ? 0.18 : 0.45);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.4 - a * 0.5), 0, TAU); ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = 3 * a + 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.15 - a * 0.6), 0, TAU); ctx.stroke();
          break;
        case 'slash': {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color; ctx.globalAlpha = a;
          const L = p.size * (1.2 - a * 0.4);
          ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 3.5 * a + 1); ctx.lineTo(L, 0); ctx.lineTo(0, -3.5 * a - 1); ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
        case 'flame': {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, `rgba(255,240,180,${a})`); g.addColorStop(0.4, `rgba(255,120,30,${a * 0.8})`); g.addColorStop(1, 'rgba(255,40,0,0)');
          ctx.globalAlpha = 1; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
          break;
        }
        case 'ember':
          ctx.fillStyle = p.color || '#ffb060'; ctx.globalAlpha = a;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* Text is drawn in screen space so it is never mirrored. */
  drawTexts(ctx, cam) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const [sx, sy] = cam.toScreen(t.x, t.y);
      const a = Math.min(1, t.life / (t.max * 0.4));
      const pop = 1 + Math.max(0, (t.life - t.max + 6) / 6) * 0.5;
      ctx.globalAlpha = a;
      ctx.font = `700 ${Math.round(t.size * cam.uiScale * pop)}px Oswald, sans-serif`;
      ctx.lineWidth = 4 * cam.uiScale; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.str, sx, sy);
      ctx.fillStyle = t.color; ctx.fillText(t.str, sx, sy);
    }
    ctx.globalAlpha = 1;
  }
}
