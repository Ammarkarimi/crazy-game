'use strict';
/* ==========================================================================
   In-game HUD drawn on the canvas in screen space.
   ========================================================================== */

const HUD = {
  shownScore: 0,

  keyLabel(action) {
    const d = Input.device;
    if (action === 'overdrive') return d === 'gp' ? 'Y' : d === 'touch' ? 'OVR' : 'Q';
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

  text(ctx, str, x, y, size, color, align = 'left', weight = 800) {
    ctx.font = `${weight} ${size}px Segoe UI, Helvetica Neue, Arial, sans-serif`;
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
    this.bar(ctx, pad, top, bw, small ? 12 : 16, hpf, hpf < 0.3 ? '#ff3b6b' : '#3dff9e');
    this.text(ctx, `${Math.ceil(Math.max(0, p.hp))} / ${Math.round(p.maxHp)}`, pad + 6, top + (small ? 10 : 13), small ? 10 : 12, '#05010f', 'left', 900);
    if (p.secondWind > 0) this.text(ctx, '☥', pad + bw + 8, top + 14, 16, '#ffe600');

    // ---- chaos meter ----
    const cy = top + (small ? 18 : 24);
    const od = w.overdrive > 0;
    const cf = od ? w.overdrive / p.odDuration : w.chaos / 100;
    const ready = !od && w.chaos >= 100;
    const ccol = od ? hsl((w.t * 400) % 360, 100, 60) : ready ? (Math.floor(w.realT * 6) % 2 ? '#ff2bd6' : '#ffffff') : '#ff2bd6';
    this.bar(ctx, pad, cy, bw, small ? 8 : 10, cf, ccol);
    this.text(ctx, od ? 'OVERDRIVE' : ready ? `OVERDRIVE READY [${this.keyLabel('overdrive')}]` : 'CHAOS', pad, cy + (small ? 20 : 24), small ? 10 : 12, ready || od ? '#ff8ef0' : '#8a8fb8');

    // ---- dash ----
    const df = 1 - Math.max(0, p.dashTimer) / p.dashCd;
    this.bar(ctx, pad, cy + (small ? 26 : 32), small ? 70 : 100, 4, df, df >= 1 ? '#00f0ff' : '#2a6a80');
    this.text(ctx, 'DASH', pad + (small ? 76 : 106), cy + (small ? 31 : 37), 10, df >= 1 ? '#00f0ff' : '#8a8fb8');

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
      this.text(ctx, '⚠ ' + w.event.name, cx, top + (small ? 56 : 70), small ? 11 : 13, w.event.color, 'center', 900);
    }

    // ---- score / combo ----
    this.shownScore += (w.score - this.shownScore) * Math.min(1, w.realT > 0 ? 0.2 : 1);
    if (Math.abs(w.score - this.shownScore) < 1) this.shownScore = w.score;
    const rx = sw - pad;
    this.text(ctx, fmt(this.shownScore), rx, top + (small ? 16 : 22), small ? 18 : 26, '#ffffff', 'right', 900);
    this.text(ctx, '◆ ' + w.shards, rx, top + (small ? 32 : 42), small ? 11 : 13, '#ffe600', 'right');
    if (w.combo > 1) {
      const cm = comboMult();
      const pulse = 1 + Math.max(0, w.comboT - 2.3) * 0.8;
      this.text(ctx, `${w.combo} COMBO  x${cm.toFixed(2)}`, rx, top + (small ? 48 : 64), Math.round((small ? 12 : 15) * pulse), w.combo >= 50 ? '#ff2bd6' : '#00f0ff', 'right', 900);
      this.bar(ctx, rx - (small ? 90 : 140), top + (small ? 53 : 70), small ? 90 : 140, 3, w.comboT / 2.6, '#00f0ff');
    }

    // ---- XP bar ----
    const xpH = 6;
    const xy = sh - xpH - (small ? 4 : 0);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, xy, sw, xpH);
    const xg = ctx.createLinearGradient(0, 0, sw, 0);
    xg.addColorStop(0, '#00f0ff'); xg.addColorStop(1, '#ff2bd6');
    ctx.fillStyle = xg;
    ctx.fillRect(0, xy, sw * clamp(w.xp / w.xpNext, 0, 1), xpH);
    this.text(ctx, 'LV ' + w.level, pad, xy - 6, small ? 13 : 16, '#ffffff', 'left', 900);

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
      this.text(ctx, b.text, 0, 0, small ? 34 : 56, '#ffffff', 'center', 900);
      ctx.shadowBlur = 0;
      if (b.sub) this.text(ctx, b.sub, 0, small ? 28 : 40, small ? 13 : 18, b.color, 'center', 800);
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
