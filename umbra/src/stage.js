'use strict';
/* Painted parallax arenas, generated procedurally from a seed. */

class Stage {
  constructor(def) {
    this.def = def;
    let seed = 0; for (const ch of def.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const R = this.rng = makeRng(seed);
    this.ridges = [0, 1].map(k => {
      const pts = [], ph = [R() * 9, R() * 9, R() * 9];
      for (let x = -3000; x <= 3000; x += 60) {
        const h = 160 + k * -40 + Math.sin(x * 0.0021 + ph[0]) * 110 + Math.sin(x * 0.0057 + ph[1]) * 55 + Math.sin(x * 0.013 + ph[2]) * 18;
        pts.push([x, Math.max(30, h * (def.id === 'bamboo' || def.id === 'gate' ? 0.7 : 1))]);
      }
      return pts;
    });
    this.items = this.buildItems(R);
    this.amb = [];
    for (let i = 0; i < 70; i++) this.amb.push(this.newAmb(true));
    this.time = 0;
  }

  buildItems(R) {
    const id = this.def.id, out = [];
    const span = (n, f, fn) => { for (let i = 0; i < n; i++) out.push(Object.assign({ f }, fn(i))); };
    if (id === 'bamboo') {
      span(46, 0.32, i => ({ k: 'bamboo', x: -1900 + i * 85 + R() * 50, w: 10 + R() * 6, h: 700 + R() * 300, lean: R() * 0.06 - 0.03, shade: 0.55 }));
      span(22, 0.62, i => ({ k: 'bamboo', x: -1500 + i * 140 + R() * 70, w: 16 + R() * 8, h: 900 + R() * 300, lean: R() * 0.05 - 0.025, shade: 0.85 }));
    } else if (id === 'temple') {
      out.push({ k: 'pagoda', f: 0.3, x: 260, s: 1.15 });
      span(9, 0.45, i => ({ k: 'tree', x: -1400 + i * 330 + R() * 120, s: 0.8 + R() * 0.6 }));
      out.push({ k: 'lanternPost', f: 0.7, x: -520 }, { k: 'lanternPost', f: 0.7, x: 560 });
    } else if (id === 'bridge') {
      out.push({ k: 'arch', f: 0.25, x: -200 });
      span(8, 0.6, i => ({ k: 'railPost', x: -1200 + i * 320 }));
      out.push({ k: 'rail', f: 0.6 });
      span(5, 0.6, i => ({ k: 'lantern', x: -1040 + i * 640 }));
    } else if (id === 'forge') {
      span(7, 0.35, i => ({ k: 'rock', x: -1500 + i * 480 + R() * 160, s: 0.8 + R() * 0.9 }));
      out.push({ k: 'chimney', f: 0.45, x: -380 }, { k: 'chimney', f: 0.45, x: 520 }, { k: 'anvil', f: 0.75, x: 640 });
    } else if (id === 'shrine') {
      out.push({ k: 'torii', f: 0.4, x: 0, s: 1.1, color: null });
      span(14, 0.3, i => ({ k: 'pine', x: -1800 + i * 270 + R() * 100, s: 0.8 + R() * 0.7, snow: true }));
      span(6, 0.62, i => ({ k: 'pine', x: -1500 + i * 600 + R() * 200, s: 1.1 + R() * 0.4, snow: true }));
      out.push({ k: 'stoneLantern', f: 0.7, x: -420 }, { k: 'stoneLantern', f: 0.7, x: 420 });
    } else if (id === 'gate') {
      out.push({ k: 'torii', f: 0.32, x: 0, s: 1.9, color: '#5a0f1e' });
      span(8, 0.5, i => ({ k: 'deadTree', x: -1600 + i * 430 + R() * 150, s: 0.9 + R() * 0.6 }));
      out.push({ k: 'stoneLantern', f: 0.7, x: -560 }, { k: 'stoneLantern', f: 0.7, x: 560 });
    }
    // foreground grass (in front of the fighters)
    span(26, 1.35, i => ({ k: 'grass', x: -2200 + i * 170 + R() * 80, s: 0.6 + R() * 0.8, fore: true }));
    return out;
  }

  newAmb(init) {
    const p = this.def.particles;
    const a = { x: rand(), y: init ? rand() : (p === 'embers' || p === 'fireflies' ? 1.05 : -0.05), s: rand(0.5, 1.4), ph: rand(TAU), v: rand(0.5, 1.5) };
    if (p === 'mist') { a.y = rand(0.55, 0.95); a.x = init ? rand(-0.2, 1.2) : -0.3; }
    if (p === 'fireflies') a.y = init ? rand(0.3, 0.95) : rand(0.4, 0.95);
    return a;
  }

  layerT(cam, f) {
    const zl = cam.z * (0.5 + 0.5 * f);
    return { zl, ox: cam.W / 2 - cam.x * f * zl, oy: cam.groundY };
  }

  drawBack(ctx, cam) {
    this.time++;
    const d = this.def, W = cam.W, H = cam.H, gy = cam.groundY;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, d.sky[0]); sky.addColorStop(0.6, d.sky[1]); sky.addColorStop(1, d.sky[2]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy + 2);

    // moon or sun
    const cx = W * 0.68 - cam.x * cam.z * 0.03, cy = gy * 0.32, r = Math.min(W, H) * (d.sun ? 0.11 : 0.075);
    const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 4);
    glow.addColorStop(0, rgba(d.accent, d.sun ? 0.55 : 0.35)); glow.addColorStop(1, rgba(d.accent, 0));
    ctx.fillStyle = glow; ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);
    ctx.fillStyle = d.id === 'gate' ? '#ff5a5a' : d.sun ? '#fff1c8' : mix(d.accent, '#ffffff', 0.5);
    ctx.globalAlpha = 0.92; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;

    // mountain ridges
    for (let k = 0; k < 2; k++) {
      const f = 0.06 + k * 0.1;
      const T = this.layerT(cam, f);
      ctx.setTransform(T.zl, 0, 0, -T.zl, T.ox, T.oy);
      ctx.fillStyle = k === 0 ? mix(d.far, d.sky[2], 0.35) : d.far;
      ctx.beginPath(); ctx.moveTo(-3000, -10);
      for (const [x, h] of this.ridges[k]) ctx.lineTo(x, h * (1.25 - k * 0.3));
      ctx.lineTo(3000, -10); ctx.closePath(); ctx.fill();
    }
    // haze over the ridges
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const hz = ctx.createLinearGradient(0, gy * 0.5, 0, gy);
    hz.addColorStop(0, rgba(d.sky[2], 0)); hz.addColorStop(1, rgba(d.sky[2], 0.35));
    ctx.fillStyle = hz; ctx.fillRect(0, gy * 0.5, W, gy * 0.5);

    // mid layer structures
    const sorted = this.items.filter(i => !i.fore).sort((a, b) => a.f - b.f);
    for (const it of sorted) {
      const T = this.layerT(cam, it.f);
      ctx.setTransform(T.zl, 0, 0, -T.zl, T.ox, T.oy);
      const col = mix(d.mid, d.far, clamp(1 - it.f * 1.4, 0, 0.8));
      this.drawItem(ctx, it, col);
    }

    // ground
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const gg = ctx.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0, mix(d.ground, d.mid, 0.6)); gg.addColorStop(0.15, d.ground); gg.addColorStop(1, mix(d.ground, '#000000', 0.5));
    ctx.fillStyle = gg; ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = rgba(d.accent, 0.18); ctx.fillRect(0, gy, W, Math.max(1, cam.z * 1.5));
    // floor planks / stones with perspective
    ctx.strokeStyle = rgba(d.accent, 0.05); ctx.lineWidth = 1;
    for (let i = -20; i <= 20; i++) {
      const wx = i * 120 - ((cam.x) % 120);
      const sx = W / 2 + (wx) * cam.z;
      ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(W / 2 + (wx) * cam.z * 1.9, H); ctx.stroke();
    }
    if (d.id === 'forge') {
      ctx.strokeStyle = 'rgba(255,110,30,0.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const sx = W / 2 + (-900 + i * 360 - cam.x) * cam.z;
        ctx.beginPath(); ctx.moveTo(sx, gy + 6); ctx.lineTo(sx + 40 * cam.z, gy + 20 * cam.z); ctx.lineTo(sx + 25 * cam.z, gy + 40 * cam.z); ctx.stroke();
      }
    }
    // ground fog
    const fg = ctx.createLinearGradient(0, gy - H * 0.18, 0, gy + 10);
    fg.addColorStop(0, rgba(d.sky[2], 0)); fg.addColorStop(1, rgba(d.sky[2], d.particles === 'mist' ? 0.4 : 0.2));
    ctx.fillStyle = fg; ctx.fillRect(0, gy - H * 0.18, W, H * 0.18 + 10);
  }

  drawItem(ctx, it, col) {
    ctx.fillStyle = col; ctx.strokeStyle = col;
    const d = this.def;
    switch (it.k) {
      case 'bamboo': {
        const sh = mix(d.mid, d.far, 1 - it.shade);
        ctx.fillStyle = sh;
        ctx.save(); ctx.translate(it.x, 0); ctx.rotate(it.lean);
        for (let y = 0; y < it.h; y += 70) { ctx.fillRect(-it.w / 2, y, it.w, 66); ctx.fillRect(-it.w / 2 - 1.5, y + 66, it.w + 3, 4); }
        for (let k = 0; k < 4; k++) {
          const ly = it.h * (0.55 + k * 0.12), dir = k % 2 ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(0, ly); ctx.quadraticCurveTo(dir * 40, ly + 18, dir * 90, ly - 10); ctx.quadraticCurveTo(dir * 45, ly + 2, 0, ly); ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'pagoda': {
        ctx.save(); ctx.translate(it.x, 0); ctx.scale(it.s, it.s);
        ctx.fillRect(-150, 0, 300, 30);
        let y = 30, w = 240;
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(-w * 0.32, y, w * 0.64, 70);
          ctx.beginPath(); ctx.moveTo(-w * 0.62, y + 70); ctx.quadraticCurveTo(-w * 0.4, y + 78, -w * 0.3, y + 98); ctx.lineTo(w * 0.3, y + 98); ctx.quadraticCurveTo(w * 0.4, y + 78, w * 0.62, y + 70); ctx.lineTo(w * 0.5, y + 66); ctx.lineTo(-w * 0.5, y + 66); ctx.closePath(); ctx.fill();
          y += 98; w *= 0.84;
        }
        ctx.fillRect(-3, y, 6, 90);
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(0, y + 12 + i * 12, 8, 0, TAU); ctx.fill(); }
        ctx.restore();
        break;
      }
      case 'tree': {
        ctx.save(); ctx.translate(it.x, 0); ctx.scale(it.s, it.s);
        ctx.fillRect(-9, 0, 18, 170);
        for (const [x, y, r] of [[0, 230, 90], [-70, 190, 60], [70, 200, 66], [-30, 290, 60], [40, 280, 55]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        ctx.restore();
        break;
      }
      case 'lanternPost': case 'stoneLantern': {
        ctx.save(); ctx.translate(it.x, 0);
        ctx.fillRect(-14, 0, 28, 20); ctx.fillRect(-7, 20, 14, 70); ctx.fillRect(-26, 90, 52, 10);
        ctx.fillRect(-18, 100, 36, 38);
        ctx.beginPath(); ctx.moveTo(-34, 138); ctx.lineTo(34, 138); ctx.lineTo(0, 168); ctx.closePath(); ctx.fill();
        const g = ctx.createRadialGradient(0, 119, 2, 0, 119, 60);
        g.addColorStop(0, rgba('#ffcf7a', 0.9)); g.addColorStop(0.2, rgba('#ff9a3a', 0.4)); g.addColorStop(1, rgba('#ff9a3a', 0));
        ctx.fillStyle = g; ctx.fillRect(-60, 60, 120, 120);
        ctx.fillStyle = '#ffd890'; ctx.fillRect(-9, 108, 18, 22);
        ctx.restore();
        break;
      }
      case 'arch': {
        ctx.lineWidth = 26;
        ctx.beginPath(); ctx.moveTo(-1400, 60); ctx.quadraticCurveTo(it.x, 520, 1400, 60); ctx.stroke();
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(-1400, 120); ctx.quadraticCurveTo(it.x, 580, 1400, 120); ctx.stroke();
        for (let i = -12; i <= 12; i++) { const x = i * 110, t = (x + 1400) / 2800; const y = 60 + 4 * t * (1 - t) * (230 + 0); ctx.fillRect(x - 3, y, 6, 60); }
        break;
      }
      case 'railPost': ctx.fillRect(it.x - 9, 0, 18, 120); ctx.fillRect(it.x - 13, 112, 26, 12); break;
      case 'rail': ctx.fillRect(-1300, 92, 2600, 9); ctx.fillRect(-1300, 50, 2600, 6); break;
      case 'lantern': {
        ctx.fillRect(it.x - 2, 100, 4, 60);
        const g = ctx.createRadialGradient(it.x, 85, 2, it.x, 85, 70);
        g.addColorStop(0, rgba('#ffd28a', 0.9)); g.addColorStop(0.25, rgba('#ff8a4a', 0.35)); g.addColorStop(1, rgba('#ff8a4a', 0));
        ctx.fillStyle = g; ctx.fillRect(it.x - 70, 15, 140, 140);
        ctx.fillStyle = '#ffcf8a'; ctx.beginPath(); ctx.ellipse(it.x, 85, 13, 18, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'rock': {
        ctx.save(); ctx.translate(it.x, 0); ctx.scale(it.s, it.s);
        ctx.beginPath(); ctx.moveTo(-180, 0); ctx.lineTo(-120, 160); ctx.lineTo(-60, 120); ctx.lineTo(0, 260); ctx.lineTo(60, 170); ctx.lineTo(130, 210); ctx.lineTo(200, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,20,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-10, 230); ctx.lineTo(10, 150); ctx.lineTo(-20, 80); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'chimney': {
        ctx.fillRect(it.x - 40, 0, 80, 420); ctx.fillRect(it.x - 52, 400, 104, 24);
        const g = ctx.createRadialGradient(it.x, 430, 4, it.x, 430, 90);
        g.addColorStop(0, 'rgba(255,140,40,0.7)'); g.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = g; ctx.fillRect(it.x - 90, 340, 180, 180);
        break;
      }
      case 'anvil': {
        ctx.save(); ctx.translate(it.x, 0);
        ctx.fillRect(-30, 0, 60, 30); ctx.fillRect(-14, 30, 28, 40);
        ctx.beginPath(); ctx.moveTo(-60, 70); ctx.lineTo(50, 70); ctx.quadraticCurveTo(90, 75, 100, 92); ctx.lineTo(-60, 96); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'torii': {
        ctx.save(); ctx.translate(it.x, 0); ctx.scale(it.s, it.s);
        if (it.color) ctx.fillStyle = it.color;
        ctx.fillRect(-150, 0, 26, 330); ctx.fillRect(124, 0, 26, 330);
        ctx.fillRect(-190, 268, 380, 20);
        ctx.beginPath(); ctx.moveTo(-240, 330); ctx.quadraticCurveTo(0, 312, 240, 330); ctx.lineTo(250, 352); ctx.quadraticCurveTo(0, 336, -250, 352); ctx.closePath(); ctx.fill();
        ctx.fillRect(-10, 288, 20, 40);
        if (!it.color) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(-246, 352); ctx.quadraticCurveTo(0, 338, 246, 352); ctx.lineTo(246, 356); ctx.quadraticCurveTo(0, 342, -246, 356); ctx.fill(); }
        ctx.restore();
        break;
      }
      case 'pine': {
        ctx.save(); ctx.translate(it.x, 0); ctx.scale(it.s, it.s);
        ctx.fillRect(-8, 0, 16, 60);
        for (let i = 0; i < 4; i++) {
          const y = 40 + i * 70, w = 130 - i * 26;
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.lineTo(0, y + 120); ctx.closePath(); ctx.fill();
          if (it.snow) { ctx.fillStyle = 'rgba(240,246,255,0.55)'; ctx.beginPath(); ctx.moveTo(-w * 0.55, y + 50); ctx.lineTo(0, y + 120); ctx.lineTo(w * 0.55, y + 50); ctx.lineTo(0, y + 92); ctx.closePath(); ctx.fill(); }
        }
        ctx.restore();
        break;
      }
      case 'deadTree': {
        ctx.save(); ctx.translate(it.x, 0); ctx.scale(it.s, it.s);
        ctx.lineCap = 'round';
        const br = (x, y, a, l, w, n) => {
          if (n === 0 || l < 10) return;
          const x2 = x + Math.sin(a) * l, y2 = y + Math.cos(a) * l;
          ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
          br(x2, y2, a - 0.45, l * 0.72, w * 0.68, n - 1); br(x2, y2, a + 0.38, l * 0.66, w * 0.68, n - 1);
        };
        br(0, 0, 0.05, 150, 20, 6);
        ctx.restore();
        break;
      }
      case 'grass': {
        ctx.fillStyle = '#020203';
        ctx.save(); ctx.translate(it.x, -40); ctx.scale(it.s, it.s);
        for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(i * 8 - 4, 0); ctx.quadraticCurveTo(i * 10, 40, i * 14 + 6, 70 + (i % 3) * 14); ctx.lineTo(i * 8 + 4, 0); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        break;
      }
    }
  }

  drawFront(ctx, cam) {
    const d = this.def, W = cam.W, H = cam.H;
    for (const it of this.items) {
      if (!it.fore) continue;
      const T = this.layerT(cam, it.f);
      ctx.setTransform(T.zl, 0, 0, -T.zl, T.ox, cam.H + 10);
      this.drawItem(ctx, it, '#020203');
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // ambient particles
    const p = d.particles, px = -cam.x * cam.z * 0.6;
    for (const a of this.amb) {
      a.ph += 0.02 * a.v;
      let x = ((a.x * W + px) % (W + 40) + W + 40) % (W + 40) - 20;
      let y = a.y * H;
      switch (p) {
        case 'fireflies': {
          a.x += Math.sin(a.ph) * 0.0006; a.y += Math.cos(a.ph * 0.7) * 0.0005;
          const al = (Math.sin(a.ph * 3) * 0.5 + 0.5);
          ctx.fillStyle = `rgba(210,255,170,${al * 0.9})`; ctx.shadowColor = '#c8ff9a'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(x, y, 1.8 * a.s, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
          break;
        }
        case 'petals':
          a.y += 0.0016 * a.v; a.x += 0.0008 + Math.sin(a.ph) * 0.0008;
          ctx.fillStyle = 'rgba(255,170,190,0.85)';
          ctx.beginPath(); ctx.ellipse(x, y, 4 * a.s, 2 * a.s, a.ph, 0, TAU); ctx.fill();
          break;
        case 'snow':
          a.y += 0.0013 * a.v; a.x += Math.sin(a.ph) * 0.0005;
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath(); ctx.arc(x, y, 1.6 * a.s, 0, TAU); ctx.fill();
          break;
        case 'embers':
          a.y -= 0.0018 * a.v; a.x += Math.sin(a.ph) * 0.0009;
          ctx.fillStyle = `rgba(255,${120 + Math.floor(a.s * 60)},40,0.9)`;
          ctx.fillRect(x, y, 2 * a.s, 2 * a.s);
          break;
        case 'ash':
          a.y += 0.0009 * a.v; a.x += 0.0004 + Math.sin(a.ph) * 0.0006;
          ctx.fillStyle = 'rgba(180,160,165,0.5)';
          ctx.fillRect(x, y, 2.4 * a.s, 1.4 * a.s);
          break;
        case 'mist': {
          a.x += 0.0004 * a.v;
          const r = 140 * a.s * cam.uiScale;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, rgba(d.sky[2], 0.12)); g.addColorStop(1, rgba(d.sky[2], 0));
          ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
          break;
        }
      }
      if (a.y > 1.08 || a.y < -0.08 || a.x > 1.4) Object.assign(a, this.newAmb(false));
    }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
}
