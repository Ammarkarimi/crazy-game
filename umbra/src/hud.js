'use strict';
/* In-fight HUD drawn on the canvas in screen space. */

const HUD = {
  draw(ctx, M) {
    const cam = M.cam, W = cam.W, u = cam.uiScale;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const small = W < 700;
    const m = 18 * u, top = 36 * u;
    const bw = Math.min(W * (small ? 0.38 : 0.36), 540 * u), bh = (small ? 16 : 22) * u;
    this.side(ctx, M, M.f1, m, top, bw, bh, 1, u);
    this.side(ctx, M, M.f2, W - m - bw, top, bw, bh, -1, u);
    // timer
    const cx = W / 2, cy = top + bh * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.arc(cx, cy, 28 * u, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2 * u; ctx.stroke();
    ctx.fillStyle = M.timer < 10 * FPS && this.blink(M) ? '#ff5a4a' : '#ffffff';
    ctx.font = `700 ${Math.round(28 * u)}px Oswald, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(M.training ? '∞' : Math.max(0, Math.ceil(M.timer / FPS)).toString(), cx, cy + 1 * u);
    // round pips
    for (const [f, dir] of [[M.f1, -1], [M.f2, 1]]) {
      for (let i = 0; i < M.roundsToWin; i++) {
        const px = cx + dir * (44 + i * 18) * u, py = cy + 18 * u;
        ctx.beginPath(); ctx.arc(px, py, 6 * u, 0, TAU);
        ctx.fillStyle = i < f.roundsWon ? '#ffd84a' : 'rgba(0,0,0,0.6)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2 * u; ctx.stroke();
      }
    }
    // banner
    if (M.banner) this.banner(ctx, M, u);
    if (M.training) this.trainingBox(ctx, M, u);
    ctx.restore();
  },

  blink(M) { return Math.floor(M.frame / 15) % 2 === 0; },

  side(ctx, M, f, x, y, bw, bh, dir, u) {
    const sk = 10 * u; // slant
    const path = (x0, w) => {
      ctx.beginPath();
      if (dir > 0) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.lineTo(x0 + w - sk, y + bh); ctx.lineTo(x0 + sk * 0, y + bh); }
      else { ctx.moveTo(x0 + bw - w, y); ctx.lineTo(x0 + bw, y); ctx.lineTo(x0 + bw, y + bh); ctx.lineTo(x0 + bw - w + sk, y + bh); }
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; path(x, bw); ctx.fill();
    const lag = clamp(f.lagHp / f.maxHp, 0, 1), hp = clamp(f.shownHp / f.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(255,240,220,0.85)'; path(x, bw * lag); ctx.fill();
    const g = ctx.createLinearGradient(x, y, x, y + bh);
    const low = hp < 0.25;
    g.addColorStop(0, low ? '#ff7a5a' : '#ffcf5a'); g.addColorStop(1, low ? '#c0182a' : '#e2581f');
    ctx.fillStyle = g; path(x, bw * hp); ctx.fill();
    if (low && this.blink(M)) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; path(x, bw * hp); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5 * u; path(x, bw); ctx.stroke();

    // name
    ctx.font = `700 ${Math.round(17 * u)}px Oswald, sans-serif`; ctx.textBaseline = 'bottom';
    ctx.textAlign = dir > 0 ? 'left' : 'right';
    const nx = dir > 0 ? x + 2 * u : x + bw - 2 * u;
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6 * u;
    ctx.fillText(f.name.toUpperCase(), nx, y - 4 * u);
    ctx.shadowBlur = 0;
    // hp number
    ctx.font = `700 ${Math.round(12 * u)}px Oswald, sans-serif`; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText(`${Math.ceil(f.hp)}`, dir > 0 ? x + 8 * u : x + bw - 8 * u, y + bh / 2 + 1);

    // magic meter
    const my = y + bh + 6 * u, mw = bw * 0.62, mh = 9 * u;
    const mx = dir > 0 ? x : x + bw - mw;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(mx, my, mw, mh);
    const full = f.meter >= RULES.meterMax;
    const mg = ctx.createLinearGradient(mx, 0, mx + mw, 0);
    mg.addColorStop(0, '#5a3cff'); mg.addColorStop(1, full ? '#e6b8ff' : '#9a7bff');
    ctx.fillStyle = mg;
    const fillW = mw * (f.meter / RULES.meterMax);
    ctx.fillRect(dir > 0 ? mx : mx + mw - fillW, my, fillW, mh);
    if (full) {
      ctx.shadowColor = '#c9a6ff'; ctx.shadowBlur = 12 * u * (0.6 + 0.4 * Math.sin(M.frame * 0.2));
      ctx.strokeStyle = '#e6d4ff'; ctx.lineWidth = 1.5 * u; ctx.strokeRect(mx, my, mw, mh); ctx.shadowBlur = 0;
    }
    ctx.font = `700 ${Math.round(11 * u)}px Oswald, sans-serif`; ctx.textBaseline = 'top';
    ctx.textAlign = dir > 0 ? 'left' : 'right';
    ctx.fillStyle = full ? '#e6d4ff' : 'rgba(255,255,255,0.6)';
    const magicKey = f.isPlayer && !M.o.versusLabels ? (Input.touchMode ? 'MAGIC' : '[I]') : '';
    ctx.fillText(full ? `${f.magic.name.toUpperCase()} READY ${magicKey}` : f.magic.name.toUpperCase(), dir > 0 ? mx : mx + mw, my + mh + 3 * u);
    // ammo
    for (let i = 0; i < f.rangedAmmo; i++) {
      const ax = dir > 0 ? mx + mw + 10 * u + i * 11 * u : mx - 10 * u - i * 11 * u, ay = my + mh / 2;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = i < f.ammo ? '#ffffff' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(-3 * u, -3 * u, 6 * u, 6 * u); ctx.restore();
    }
    // status icons
    const st = [];
    if (f.status.burn > 0) st.push(['BURN', '#ff7a2a']);
    if (f.status.poison > 0) st.push(['VENOM', '#7dff6a']);
    if (f.status.freeze > 0) st.push(['SLOW', '#7fd6ff']);
    if (f.state === 'stunned') st.push(['STUN', '#ffe95a']);
    ctx.textAlign = dir > 0 ? 'left' : 'right';
    st.forEach((s, i) => {
      ctx.fillStyle = s[1];
      ctx.fillText(s[0], dir > 0 ? x + bw * 0.66 + i * 46 * u : x + bw * 0.34 - i * 46 * u, my + mh + 3 * u);
    });
    // combo
    if (f.combo >= 2) {
      const cy = my + 54 * u;
      ctx.font = `italic 700 ${Math.round(34 * u)}px Oswald, sans-serif`; ctx.textBaseline = 'middle';
      ctx.textAlign = dir > 0 ? 'left' : 'right';
      const cxp = dir > 0 ? x + 4 * u : x + bw - 4 * u;
      ctx.lineWidth = 5 * u; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(`${f.combo} HITS`, cxp, cy);
      ctx.fillStyle = f.combo >= 5 ? '#ffd84a' : '#ffffff';
      ctx.fillText(`${f.combo} HITS`, cxp, cy);
    }
  },

  banner(ctx, M, u) {
    const b = M.banner, W = M.cam.W, H = M.cam.H;
    const t = b.t, inT = Math.min(1, t / 8), outT = Math.min(1, (b.frames - t) / 10);
    const a = Math.min(inT, outT);
    const scale = 1 + (1 - inT) * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, H * 0.42); ctx.scale(scale, scale);
    // brush stroke behind
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.moveTo(-W * 0.5, -46 * u); ctx.lineTo(W * 0.5, -36 * u); ctx.lineTo(W * 0.48, 40 * u); ctx.lineTo(-W * 0.48, 50 * u); ctx.closePath(); ctx.fill();
    ctx.font = `700 ${Math.round(72 * u)}px Cinzel, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = b.color; ctx.shadowBlur = 24 * u;
    ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
    ctx.shadowBlur = 0;
    if (b.sub) {
      ctx.font = `700 ${Math.round(20 * u)}px Oswald, sans-serif`;
      ctx.fillStyle = '#ffffff'; ctx.fillText(b.sub.toUpperCase(), 0, 66 * u);
    }
    ctx.restore();
  },

  trainingBox(ctx, M, u) {
    const lines = [
      `DUMMY: ${M.dummyMode.toUpperCase()}   (press T to change)`,
      'J attack · K kick · U heavy · L throw · I magic · O roll',
      'Forward/Back/Down + attack or kick = different moves · Hold back to block',
    ];
    ctx.font = `400 ${Math.round(13 * u)}px Oswald, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const y = M.cam.H - 34 * u;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(M.cam.W / 2 - 300 * u, y - 30 * u, 600 * u, 56 * u);
    lines.forEach((l, i) => { ctx.fillStyle = i ? 'rgba(255,255,255,0.75)' : '#ffd84a'; ctx.fillText(l, M.cam.W / 2, y - 16 * u + i * 17 * u); });
  },
};
