'use strict';
/* ==========================================================================
   In-game HUD drawn on the canvas in screen space.
   ========================================================================== */

const HUD = {
  shownScore: 0,

  keyLabel(action) {
    const d = Input.device;
    if (action === 'overdrive') return d === 'gp' ? 'Y' : d === 'touch' ? '🌈' : 'Q';
    if (action === 'dash') return d === 'gp' ? 'A' : d === 'touch' ? 'DASH' : 'SPACE';
    return '';
  },

  bar(ctx, x, y, w, h, frac, col, bg = 'rgba(255,255,255,0.08)') {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  },

  text(ctx, str, x, y, size, color, align = 'left', weight = 700) {
    ctx.font = `${Math.min(weight, 700)} ${size}px Fredoka, Segoe UI, Helvetica Neue, Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  },

  draw(ctx) {
    const g = Game, w = W, p = w.player;
    const sw = g.w, sh = g.h;
    const small = sw < 700;
    const pad = small ? 10 : 18;
    const top = pad + (small ? 6 : 0);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // ---- low HP vignette ----
    const hpf = p.hp / p.maxHp;
    if (hpf < 0.3 && w.dying <= 0) {
      const a = (0.3 - hpf) / 0.3 * (0.35 + 0.15 * Math.sin(w.realT * 6));
      const grad = ctx.createRadialGradient(sw / 2, sh / 2, Math.min(sw, sh) * 0.3, sw / 2, sh / 2, Math.max(sw, sh) * 0.7);
      grad.addColorStop(0, 'rgba(255,0,40,0)');
      grad.addColorStop(1, `rgba(255,0,40,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, sw, sh);
    }
    if (w.overdrive > 0) {
      ctx.strokeStyle = hsl((w.t * 300) % 360, 100, 60, 0.5);
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, sw - 8, sh - 8);
    }

    // ---- HP ----
    const bw = small ? 150 : 260;
    this.bar(ctx, pad, top, bw, small ? 14 : 18, hpf, hpf < 0.3 ? '#ff5a7a' : '#4dff9a');
    this.text(ctx, `❤ ${Math.ceil(Math.max(0, p.hp))} / ${Math.round(p.maxHp)}`, pad + 6, top + (small ? 12 : 15), small ? 11 : 14, '#1a0b52', 'left', 700);


    // ---- chaos meter ----
    const cy = top + (small ? 20 : 26);
    const od = w.overdrive > 0;
    const cf = od ? w.overdrive / p.odDuration : w.chaos / 100;
    const ready = !od && w.chaos >= 100;
    const rg = ctx.createLinearGradient(pad, 0, pad + bw, 0);
    CONFETTI.forEach((c, i) => rg.addColorStop(i / (CONFETTI.length - 1), c));
    this.bar(ctx, pad, cy, bw, small ? 9 : 12, cf, ready && Math.floor(w.realT * 6) % 2 ? '#ffffff' : rg);
    this.text(ctx, od ? '🌈 RAINBOW MODE!' : ready ? `🌈 RAINBOW READY! [${this.keyLabel('overdrive')}]` : '🌈 RAINBOW', pad, cy + (small ? 22 : 28), small ? 12 : 15, ready || od ? '#ffd93b' : '#b9b3e6');

    // ---- dash ----
    const df = 1 - Math.max(0, p.dashTimer) / p.dashCd;
    this.bar(ctx, pad, cy + (small ? 29 : 37), small ? 70 : 100, 6, df, df >= 1 ? '#2ee6ff' : '#3a6a90');
    this.text(ctx, '💨 DASH', pad + (small ? 76 : 106), cy + (small ? 35 : 43), 12, df >= 1 ? '#2ee6ff' : '#b9b3e6');

    // ---- lives (under the meters, clear of the wave title on any screen size) ----
    ctx.font = `${small ? 16 : 20}px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
    ctx.textAlign = 'left';
    let hx = pad;
    const hy = cy + (small ? 56 : 68);
    for (let i = 0; i < w.lives; i++) { ctx.fillText('❤️', hx, hy); hx += small ? 20 : 25; }
    if (p.secondWind > 0) ctx.fillText('💖', hx, hy);

    // ---- wave / boss ----
    const cx = sw / 2;
    if (w.boss && !w.boss.dead) {
      const b = w.boss;
      const bbw = Math.min(sw * 0.56, 620);
      this.text(ctx, b.bossDef.name, cx, top + 14, small ? 13 : 16, b.color[0] === '#' ? b.color : '#ff2bd6', 'center', 900);
      this.bar(ctx, cx - bbw / 2, top + 22, bbw, small ? 10 : 14, b.hp / b.maxHp, b.color[0] === '#' ? b.color : '#ff2bd6');
      const ph = b.bossDef.phases;
      for (const f of ph) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx - bbw / 2 + bbw * f, top + 22, 2, small ? 10 : 14); }
      this.text(ctx, `WAVE ${w.wave}`, cx, top + (small ? 48 : 54), 11, '#8a8fb8', 'center');
    } else {
      this.text(ctx, `WAVE ${w.wave}${w.mode !== 'endless' ? ' / ' + (DEMO_MODE ? DEMO_WAVES : STANDARD_WAVES) : ''}`, cx, top + (small ? 16 : 22), small ? 16 : 22, '#ffffff', 'center', 900);
      if (w.waveState === 'fight' && !w.isBossWave) {
        const ww = small ? 120 : 200;
        this.bar(ctx, cx - ww / 2, top + (small ? 22 : 30), ww, 4, w.waveT / w.waveDuration, '#00f0ff');
        this.text(ctx, fmtTime(w.waveDuration - w.waveT), cx, top + (small ? 38 : 48), 11, '#8a8fb8', 'center');
      }
    }
    if (w.event) {
      this.text(ctx, w.event.ico + ' ' + w.event.name, cx, top + (small ? 58 : 74), small ? 13 : 17, w.event.color, 'center', 700);
    }

    // ---- score / combo ----
    this.shownScore += (w.score - this.shownScore) * Math.min(1, w.realT > 0 ? 0.2 : 1);
    if (Math.abs(w.score - this.shownScore) < 1) this.shownScore = w.score;
    const rx = sw - pad;
    this.text(ctx, fmt(this.shownScore), rx, top + (small ? 16 : 22), small ? 18 : 26, '#ffffff', 'right', 900);
    this.text(ctx, '💎 ' + w.shards, rx, top + (small ? 34 : 46), small ? 13 : 17, '#7df9ff', 'right');
    if (w.combo > 1) {
      const cm = comboMult();
      const pulse = 1 + Math.max(0, w.comboT - 2.3) * 0.8;
      this.text(ctx, `🔥 ${w.combo} COMBO  x${cm.toFixed(1)}`, rx, top + (small ? 48 : 64), Math.round((small ? 12 : 15) * pulse), w.combo >= 50 ? '#ff2bd6' : '#00f0ff', 'right', 900);
      this.bar(ctx, rx - (small ? 90 : 140), top + (small ? 53 : 70), small ? 90 : 140, 3, w.comboT / 2.6, '#00f0ff');
    }

    // ---- XP bar ----
    const xpH = 10;
    const xy = sh - xpH - (small ? 4 : 0);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, xy, sw, xpH);
    const xg = ctx.createLinearGradient(0, 0, sw, 0);
    xg.addColorStop(0, '#00f0ff'); xg.addColorStop(1, '#ff2bd6');
    ctx.fillStyle = xg;
    ctx.fillRect(0, xy, sw * clamp(w.xp / w.xpNext, 0, 1), xpH);
    this.text(ctx, '⭐ LEVEL ' + w.level, pad, xy - 8, small ? 15 : 19, '#ffd93b', 'left', 700);

    // ---- minimap ----
    if (Input.device === 'touch') this.drawMinimap(ctx, pad, xy - 30 - 80, 112);
    else if (!small || sh > 600) this.drawMinimap(ctx, sw - pad - (small ? 110 : 170), xy - (small ? 86 : 128) - 8, small ? 110 : 170);

    // ---- off-screen boss pointer ----
    if (w.boss && !w.boss.dead) {
      const s = Game.worldToScreen(w.boss.x, w.boss.y);
      const m = 46;
      if (s.x < 0 || s.x > sw || s.y < 0 || s.y > sh) {
        const ax = clamp(s.x, m, sw - m), ay = clamp(s.y, m + 60, sh - m - 20);
        const a = Math.atan2(s.y - ay, s.x - ax);
        const col = w.boss.color[0] === '#' ? w.boss.color : '#ff2bd6';
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(w.realT * 8);
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-8, 12); ctx.lineTo(-3, 0); ctx.lineTo(-8, -12); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    // ---- tutorial tip bubble ----
    if (w.hints && w.hints.length && w.waveState === 'fight') {
      const h = w.hints[0];
      const a = Math.min(1, w.hintT * 4, (4.2 - w.hintT) * 4);
      const fs = small ? 17 : 24;
      ctx.font = `700 ${fs}px Fredoka, Arial, sans-serif`;
      const tw = ctx.measureText(h.ico + '  ' + h.text).width + 40;
      const bx = cx - tw / 2, by = sh - (small ? 90 : 120);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.roundRect(bx, by, tw, fs + 26, 20); ctx.fill();
      ctx.fillStyle = '#1a0b52';
      ctx.textAlign = 'center';
      ctx.fillText(h.ico + '  ' + h.text, cx, by + fs + 6 + Math.sin(w.realT * 5) * 1.5);
      ctx.globalAlpha = 1;
    }

    // ---- banners ----
    for (const b of w.banners) {
      const k = b.t / b.dur;
      const inT = Math.min(1, b.t / 0.25);
      const out = k > 0.8 ? (1 - k) / 0.2 : 1;
      const sc = easeOutBack(inT);
      ctx.globalAlpha = out;
      ctx.save();
      ctx.translate(cx, sh * 0.32);
      ctx.scale(sc, sc);
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 24;
      this.text(ctx, b.text, 0, 0, small ? 38 : 64, '#ffffff', 'center', 700);
      ctx.shadowBlur = 0;
      if (b.sub) this.text(ctx, b.sub, 0, small ? 30 : 44, small ? 15 : 22, b.color, 'center', 700);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // ---- touch sticks ----
    if (Input.device === 'touch') {
      for (const s of [Input.touch.move, Input.touch.aim]) {
        if (s.id === null) continue;
        ctx.strokeStyle = 'rgba(0,240,255,0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.ox, s.oy, 60, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(0,240,255,0.35)';
        ctx.beginPath(); ctx.arc(s.x, s.y, 24, 0, TAU); ctx.fill();
      }
      const ob = document.getElementById('tOver');
      if (ob) ob.classList.toggle('ready', ready);
    }
    ctx.restore();
  },

  drawMinimap(ctx, x, y, mw) {
    const w = W;
    const mh = mw * ARENA_H / ARENA_W;
    const k = mw / ARENA_W;
    ctx.fillStyle = 'rgba(5,1,15,0.6)';
    ctx.fillRect(x, y, mw, mh);
    ctx.strokeStyle = 'rgba(255,43,214,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, mw - 1, mh - 1);
    const mirror = w.mirror;
    const mx = v => mirror ? x + mw - v * k : x + v * k;
    for (const e of w.enemies) {
      if (e.dead) continue;
      ctx.fillStyle = e.boss ? '#ffffff' : e.elite ? '#ffd000' : '#ff3b6b';
      const s = e.boss ? 6 : e.elite ? 3 : 2;
      ctx.fillRect(mx(e.x) - s / 2, y + e.y * k - s / 2, s, s);
    }
    for (const h of w.hazards) {
      if (h.kind === 'blackhole') { ctx.fillStyle = '#b84dff'; ctx.beginPath(); ctx.arc(mx(h.x), y + h.y * k, 4, 0, TAU); ctx.fill(); }
    }
    const v = Game.viewRect();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    const vx = mirror ? x + mw - (v.x + v.w) * k : x + v.x * k;
    ctx.strokeRect(vx, y + v.y * k, v.w * k, v.h * k);
    ctx.fillStyle = W.player.color;
    ctx.beginPath(); ctx.arc(mx(w.player.x), y + w.player.y * k, 3, 0, TAU); ctx.fill();
  },
};
