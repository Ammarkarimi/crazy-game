'use strict';
/* Skeleton kinematics + silhouette rendering for fighters and their equipment.
   World space is y-up. Each fighter is drawn in its own local frame: x = facing direction. */

const BONE = { thigh: 44, shin: 46, torso: 56, neck: 8, head: 12.5, upper: 32, fore: 30 };
const INK = '#040406';

const Skel = {
  dirDown(a) { const r = a * DEG; return [Math.sin(r), -Math.cos(r)]; },

  /* Returns local joint positions (x forward, y up, hip at 0,0 before ground snap). */
  solve(p, scale) {
    const B = BONE, s = scale;
    const tr = p.t * DEG, hr = (p.t + p.h) * DEG;
    const tu = [Math.sin(tr), Math.cos(tr)];
    const hu = [Math.sin(hr), Math.cos(hr)];
    const add = (a, d, l) => [a[0] + d[0] * l * s, a[1] + d[1] * l * s];
    const hip = [0, 0];
    const sh = add(hip, tu, B.torso - 5);
    const neck = add(hip, tu, B.torso);
    const head = add(neck, hu, B.neck + B.head);
    const fe = add(sh, this.dirDown(p.fu), B.upper), fh = add(fe, this.dirDown(p.ff), B.fore);
    const be = add(sh, this.dirDown(p.bu), B.upper), bh = add(be, this.dirDown(p.bf), B.fore);
    const fk = add(hip, this.dirDown(p.ft), B.thigh), ff = add(fk, this.dirDown(p.fs), B.shin);
    const bk = add(hip, this.dirDown(p.bt), B.thigh), bf = add(bk, this.dirDown(p.bs), B.shin);
    const wd = this.dirDown(p.ff + p.w), bwd = this.dirDown(p.bf + p.w);
    const fdir = this.dirDown(p.fs + 90), bdir = this.dirDown(p.bs + 90); // foot directions
    const J = { hip, sh, neck, head, fe, fh, be, bh, fk, ff, bk, bf, tu, hu, wd, bwd, fdir, bdir };
    if (p.rot) {
      const r = p.rot * DEG, c = Math.cos(r), sn = Math.sin(r);
      const rp = v => [v[0] * c + v[1] * sn, -v[0] * sn + v[1] * c];
      for (const k in J) J[k] = rp(J[k]);
    }
    return J;
  },

  /* Lift so the lowest body point rests on the ground (used while grounded). */
  groundOffset(J, scale) {
    const pts = [J.ff, J.bf, J.fk, J.bk, J.hip];
    let m = Math.min(J.head[1] - BONE.head * scale, ...pts.map(q => q[1]));
    m = Math.min(m, J.ff[1] - 3 * scale, J.bf[1] - 3 * scale);
    return -m;
  },

  /* Standing hip height, used while airborne so jumps line up with the ground pose. */
  hipHeight(scale) { return (BONE.thigh + BONE.shin) * 0.97 * scale; },

  lerpPose(a, b, t) {
    const o = {};
    for (const k in STANCE) o[k] = a[k] + (b[k] - a[k]) * t;
    return o;
  },
};

/* ---------- Cloth chains (sash tails, headband tails, hair) ---------- */
class Chain {
  constructor(n, seg, width, opts = {}) {
    this.n = n; this.seg = seg; this.width = width;
    this.p = []; this.q = [];
    this.stiff = opts.stiff || 0; this.grav = opts.grav ?? 0.55; this.color = opts.color || null;
    this.taper = opts.taper ?? 0.35;
  }
  reset(x, y) { this.p = []; this.q = []; for (let i = 0; i < this.n; i++) { this.p.push([x, y - i * this.seg]); this.q.push([x, y - i * this.seg]); } }
  update(ax, ay, bias, wind, time) {
    if (!this.p.length) this.reset(ax, ay);
    const P = this.p, Q = this.q;
    P[0][0] = ax; P[0][1] = ay; Q[0][0] = ax; Q[0][1] = ay;
    for (let i = 1; i < this.n; i++) {
      const vx = (P[i][0] - Q[i][0]) * 0.88, vy = (P[i][1] - Q[i][1]) * 0.88;
      Q[i][0] = P[i][0]; Q[i][1] = P[i][1];
      const k = i / this.n;
      P[i][0] += vx + bias[0] * k + wind * k + Math.sin(time * 0.15 + i) * 0.25 * k;
      P[i][1] += vy - this.grav + bias[1] * k;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < this.n; i++) {
        const a = P[i - 1], b = P[i];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - this.seg) / d;
        b[0] -= dx * diff; b[1] -= dy * diff;
      }
    }
  }
  draw(ctx, color) {
    const P = this.p;
    if (P.length < 2) return;
    ctx.strokeStyle = color; ctx.lineCap = 'round';
    for (let i = 1; i < P.length; i++) {
      ctx.lineWidth = this.width * (1 - (i / P.length) * (1 - this.taper));
      ctx.beginPath(); ctx.moveTo(P[i - 1][0], P[i - 1][1]); ctx.lineTo(P[i][0], P[i][1]); ctx.stroke();
    }
  }
}

/* ---------- Fighter drawing ---------- */
const Render = {
  limb(ctx, a, b, w) {
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  },

  frame(ctx, origin, dir, fn) {
    ctx.save();
    ctx.translate(origin[0], origin[1]);
    ctx.rotate(Math.atan2(dir[1], dir[0]));
    fn();
    ctx.restore();
  },

  /* Main entry: draws a fighter at world position. */
  fighter(ctx, f, opts = {}) {
    const J = f.joints;
    const s = f.scale, b = f.build;
    const ink = opts.ink || f.inkColor();
    ctx.save();
    ctx.translate(f.x, f.y + f.drawLift);
    ctx.scale(f.facing, 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = ink; ctx.fillStyle = ink;

    const backInk = opts.ink ? ink : mix(ink, '#30303c', 0.18);
    // back arm + back weapon
    ctx.strokeStyle = backInk; ctx.fillStyle = backInk;
    if (f.cls === 'dual') this.weapon(ctx, f, J.bh, J.bwd, true, backInk);
    this.limb(ctx, J.sh, J.be, 13 * b * s); this.limb(ctx, J.be, J.bh, 11 * b * s);
    this.hand(ctx, J.bh, s * b);
    // back leg
    this.limb(ctx, J.hip, J.bk, 18 * b * s); this.limb(ctx, J.bk, J.bf, 14 * b * s);
    this.foot(ctx, J.bf, J.bdir, s, b);
    ctx.strokeStyle = ink; ctx.fillStyle = ink;
    if (f.cls === 'pole' || f.cls === 'heavy') this.weapon(ctx, f, J.fh, J.wd, false, ink, true);

    // robe skirt behind legs
    if (f.robe) this.robe(ctx, f, J, ink);
    // torso
    this.torso(ctx, f, J, ink);
    // front leg
    this.limb(ctx, J.hip, J.fk, 18 * b * s); this.limb(ctx, J.fk, J.ff, 14 * b * s);
    this.foot(ctx, J.ff, J.fdir, s, b);
    this.armorLegs(ctx, f, J, ink);
    // head
    this.head(ctx, f, J, ink);
    // front arm + weapon
    if (f.cls !== 'pole' && f.cls !== 'heavy') this.weapon(ctx, f, J.fh, J.wd, false, ink);
    ctx.strokeStyle = ink; ctx.fillStyle = ink;
    this.limb(ctx, J.sh, J.fe, 13 * b * s); this.limb(ctx, J.fe, J.fh, 11 * b * s);
    this.armorArms(ctx, f, J, ink);
    this.hand(ctx, J.fh, s * b);
    if (f.cls === 'fist') this.fistGear(ctx, f, J);
    this.eyes(ctx, f, J);
    ctx.restore();
  },

  hand(ctx, p, s) { ctx.beginPath(); ctx.arc(p[0], p[1], 6.5 * s, 0, TAU); ctx.fill(); },

  foot(ctx, p, d, s, b) {
    ctx.lineWidth = 8 * s * b;
    ctx.beginPath(); ctx.moveTo(p[0] - d[0] * 3 * s, p[1] - d[1] * 3 * s); ctx.lineTo(p[0] + d[0] * 13 * s, p[1] + d[1] * 13 * s); ctx.stroke();
  },

  torso(ctx, f, J, ink) {
    const s = f.scale, b = f.build;
    const u = J.tu, n = [u[1], -u[0]]; // n = forward normal
    const hw = 13 * b * s, sw = 17 * b * s;
    const chest = f.armor === 'yoroi' || f.armor === 'dragon' ? 4 * s : 0;
    ctx.beginPath();
    ctx.moveTo(J.hip[0] - n[0] * hw, J.hip[1] - n[1] * hw);
    ctx.lineTo(J.hip[0] + n[0] * hw, J.hip[1] + n[1] * hw);
    ctx.quadraticCurveTo(J.hip[0] + u[0] * 30 * s + n[0] * (sw + 4 + chest), J.hip[1] + u[1] * 30 * s + n[1] * (sw + 4 + chest), J.sh[0] + n[0] * sw, J.sh[1] + n[1] * sw);
    ctx.lineTo(J.neck[0] + n[0] * 6 * s, J.neck[1] + n[1] * 6 * s);
    ctx.lineTo(J.neck[0] - n[0] * 7 * s, J.neck[1] - n[1] * 7 * s);
    ctx.lineTo(J.sh[0] - n[0] * sw, J.sh[1] - n[1] * sw);
    ctx.closePath(); ctx.fill();
    // neck
    this.limb(ctx, J.neck, [J.neck[0] + J.hu[0] * 8 * s, J.neck[1] + J.hu[1] * 8 * s], 10 * s * b);
    // belt / armor torso details
    const beltY = 7 * s;
    this.frame(ctx, J.hip, n, () => {
      // local: x forward(n), y up(u)
      ctx.fillStyle = ink;
      ctx.fillRect(-hw - 2, beltY - 3 * s, hw * 2 + 4, 7 * s);
      if (f.armor === 'lamellar' || f.armor === 'yoroi' || f.armor === 'dragon') {
        ctx.strokeStyle = rgba(f.rim, 0.22); ctx.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) { const yy = 16 * s + i * 8 * s; ctx.beginPath(); ctx.moveTo(-sw + 2, yy); ctx.lineTo(sw - 1, yy + 1); ctx.stroke(); }
      }
      if (f.armor === 'vest' || f.armor === 'robe') {
        ctx.strokeStyle = rgba(f.rim, 0.18); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(sw * 0.6, 44 * s); ctx.lineTo(-2, 14 * s); ctx.stroke();
      }
      if (f.armor === 'dragon') {
        ctx.strokeStyle = rgba('#ff4a2a', 0.55); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(sw * 0.8, 40 * s); ctx.lineTo(0, 28 * s); ctx.lineTo(sw * 0.8, 18 * s); ctx.stroke();
      }
    });
    ctx.fillStyle = ink; ctx.strokeStyle = ink;
  },

  robe(ctx, f, J, ink) {
    const s = f.scale;
    const sway = Math.sin(f.time * 0.12) * 3 * s;
    const fk = J.fk, bk = J.bk;
    const hemF = [fk[0] + 14 * s + sway, Math.min(fk[1], J.hip[1] - 30 * s) - 16 * s];
    const hemB = [bk[0] - 16 * s + sway, Math.min(bk[1], J.hip[1] - 30 * s) - 18 * s];
    ctx.beginPath();
    ctx.moveTo(J.hip[0] + 14 * s, J.hip[1] + 8 * s);
    ctx.quadraticCurveTo(fk[0] + 12 * s, fk[1] + 6 * s, hemF[0], hemF[1]);
    ctx.lineTo((hemF[0] + hemB[0]) / 2, Math.min(hemF[1], hemB[1]) - 4 * s);
    ctx.lineTo(hemB[0], hemB[1]);
    ctx.quadraticCurveTo(bk[0] - 12 * s, bk[1] + 6 * s, J.hip[0] - 14 * s, J.hip[1] + 8 * s);
    ctx.closePath(); ctx.fill();
  },

  armorLegs(ctx, f, J, ink) {
    if (!['lamellar', 'yoroi', 'dragon'].includes(f.armor)) return;
    const s = f.scale;
    const len = (f.armor === 'lamellar' ? 26 : 32) * s;
    ctx.fillStyle = ink;
    for (const k of [J.bk, J.fk]) {
      const d = [k[0] - J.hip[0], k[1] - J.hip[1]], l = Math.hypot(d[0], d[1]) || 1;
      const u = [d[0] / l, d[1] / l], n = [-u[1], u[0]];
      const o = [J.hip[0] + u[0] * 4, J.hip[1] + u[1] * 4];
      ctx.beginPath();
      ctx.moveTo(o[0] + n[0] * 13 * s, o[1] + n[1] * 13 * s);
      ctx.lineTo(o[0] - n[0] * 13 * s, o[1] - n[1] * 13 * s);
      ctx.lineTo(o[0] + u[0] * len - n[0] * 15 * s, o[1] + u[1] * len - n[1] * 15 * s);
      ctx.lineTo(o[0] + u[0] * len + n[0] * 15 * s, o[1] + u[1] * len + n[1] * 15 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(f.rim, 0.2); ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const t = len * i / 3;
        ctx.beginPath();
        ctx.moveTo(o[0] + u[0] * t + n[0] * 13 * s, o[1] + u[1] * t + n[1] * 13 * s);
        ctx.lineTo(o[0] + u[0] * t - n[0] * 13 * s, o[1] + u[1] * t - n[1] * 13 * s);
        ctx.stroke();
      }
    }
  },

  armorArms(ctx, f, J, ink) {
    const s = f.scale, a = f.armor;
    const d = [J.fe[0] - J.sh[0], J.fe[1] - J.sh[1]], l = Math.hypot(d[0], d[1]) || 1;
    const u = [d[0] / l, d[1] / l], n = [-u[1], u[0]];
    const sh = J.sh;
    ctx.fillStyle = ink;
    if (a === 'vest' || a === 'robe') {
      ctx.beginPath(); ctx.ellipse(sh[0] + u[0] * 4, sh[1] + u[1] * 4, 12 * s, 9 * s, Math.atan2(u[1], u[0]), 0, TAU); ctx.fill();
    }
    if (a === 'robe') {
      // wide sleeve hanging from the forearm
      const e = J.fe, h = J.fh;
      ctx.beginPath();
      ctx.moveTo(e[0], e[1] + 6 * s);
      ctx.lineTo(h[0], h[1] + 4 * s);
      ctx.lineTo(h[0] - 4 * s, h[1] - 18 * s);
      ctx.quadraticCurveTo(e[0] - 4 * s, e[1] - 24 * s, e[0] - 6 * s, e[1] - 4 * s);
      ctx.closePath(); ctx.fill();
    }
    if (a === 'lamellar' || a === 'yoroi' || a === 'dragon') {
      const w = (a === 'lamellar' ? 15 : 19) * s, L = (a === 'lamellar' ? 20 : 26) * s;
      ctx.beginPath();
      ctx.moveTo(sh[0] + n[0] * w - u[0] * 4, sh[1] + n[1] * w - u[1] * 4);
      ctx.lineTo(sh[0] - n[0] * w - u[0] * 4, sh[1] - n[1] * w - u[1] * 4);
      ctx.lineTo(sh[0] - n[0] * w + u[0] * L, sh[1] - n[1] * w + u[1] * L);
      ctx.lineTo(sh[0] + n[0] * w + u[0] * L, sh[1] + n[1] * w + u[1] * L);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(f.rim, 0.22); ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const t = L * i / 3;
        ctx.beginPath(); ctx.moveTo(sh[0] + n[0] * w + u[0] * t, sh[1] + n[1] * w + u[1] * t); ctx.lineTo(sh[0] - n[0] * w + u[0] * t, sh[1] - n[1] * w + u[1] * t); ctx.stroke();
      }
      if (a === 'dragon') {
        ctx.fillStyle = ink;
        for (let i = 0; i < 3; i++) {
          const o = [sh[0] - u[0] * 4 + n[0] * (i - 1) * 8 * s, sh[1] - u[1] * 4 + n[1] * (i - 1) * 8 * s];
          ctx.beginPath(); ctx.moveTo(o[0] + n[0] * 4 * s, o[1] + n[1] * 4 * s); ctx.lineTo(o[0] - n[0] * 4 * s, o[1] - n[1] * 4 * s); ctx.lineTo(o[0] - u[0] * 14 * s, o[1] - u[1] * 14 * s); ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.fillStyle = ink;
  },

  head(ctx, f, J, ink) {
    const s = f.scale, R = BONE.head * s;
    const u = J.hu, fwd = [u[1], -u[0]];
    this.frame(ctx, J.head, fwd, () => {
      // local: x forward, y up
      const helm = f.helmet, hair = f.hair;
      ctx.fillStyle = ink; ctx.strokeStyle = ink;
      const showHair = !['hood', 'kabuto', 'oni', 'dragon'].includes(helm);
      if (showHair) {
        if (hair === 'topknot') { ctx.beginPath(); ctx.ellipse(-R * 0.5, R * 1.05, R * 0.42, R * 0.32, -0.4, 0, TAU); ctx.fill(); }
        if (hair === 'wild') {
          ctx.beginPath(); ctx.moveTo(R * 0.6, R * 0.7);
          for (let i = 0; i < 6; i++) { const a = 0.9 + i * 0.42; ctx.lineTo(Math.cos(a) * R * 1.65, Math.sin(a) * R * 1.65); ctx.lineTo(Math.cos(a + 0.2) * R * 0.95, Math.sin(a + 0.2) * R * 0.95); }
          ctx.closePath(); ctx.fill();
        }
        if (hair === 'tails') {
          ctx.beginPath(); ctx.moveTo(-R * 0.2, R * 0.9); ctx.lineTo(-R * 1.4, R * 1.2); ctx.lineTo(-R * 0.7, R * 0.4); ctx.lineTo(-R * 1.5, R * 0.3); ctx.lineTo(-R * 0.8, -R * 0.1); ctx.closePath(); ctx.fill();
        }
      }
      // skull
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      // jaw / nose hint
      ctx.beginPath(); ctx.moveTo(R * 0.7, -R * 0.2); ctx.lineTo(R * 1.12, -R * 0.38); ctx.lineTo(R * 0.6, -R * 0.85); ctx.closePath(); ctx.fill();

      if (helm === 'band') {
        ctx.strokeStyle = rgba(f.rim, 0.25); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-R, R * 0.28); ctx.lineTo(R, R * 0.36); ctx.stroke();
      } else if (helm === 'hood') {
        ctx.beginPath(); ctx.arc(-R * 0.08, R * 0.05, R * 1.16, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-R, -R * 0.6); ctx.lineTo(-R * 1.9, -R * 1.4); ctx.lineTo(-R * 0.6, -R * 1.1); ctx.closePath(); ctx.fill();
      } else if (helm === 'straw') {
        ctx.beginPath(); ctx.moveTo(-R * 2.5, R * 0.45); ctx.lineTo(R * 2.6, R * 0.55); ctx.lineTo(R * 0.1, R * 1.75); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba(f.rim, 0.25); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-R * 1.6, R * 0.8); ctx.lineTo(R * 0.1, R * 1.6); ctx.lineTo(R * 1.7, R * 0.85); ctx.stroke();
      } else if (helm === 'kabuto' || helm === 'dragon') {
        ctx.beginPath(); ctx.arc(-R * 0.05, R * 0.12, R * 1.2, Math.PI * 0.02, Math.PI * 0.98); ctx.fill();
        // neck guard
        ctx.beginPath(); ctx.moveTo(-R * 1.1, R * 0.3); ctx.lineTo(-R * 1.9, -R * 0.7); ctx.lineTo(-R * 0.4, -R * 0.5); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 3 * s; ctx.strokeStyle = ink;
        if (helm === 'kabuto') {
          ctx.beginPath(); ctx.moveTo(R * 0.5, R * 1.1); ctx.quadraticCurveTo(R * 1.4, R * 1.5, R * 1.1, R * 2.6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(R * 0.3, R * 1.1); ctx.quadraticCurveTo(R * 0.1, R * 1.9, R * 0.6, R * 2.8); ctx.stroke();
        } else {
          for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(-R * 0.2 + k * 6, R * 1.0); ctx.quadraticCurveTo(-R * 1.4, R * 2.0, -R * 2.6 + k * 4, R * 1.9 - k * 6); ctx.stroke(); }
          ctx.fillStyle = rgba('#ff4a2a', 0.6);
          ctx.beginPath(); ctx.arc(R * 0.6, R * 0.95, 2.2 * s, 0, TAU); ctx.fill(); ctx.fillStyle = ink;
        }
      } else if (helm === 'oni') {
        ctx.beginPath(); ctx.moveTo(R * 0.6, R * 0.7); ctx.lineTo(R * 1.4, R * 2.0); ctx.lineTo(R * 0.15, R * 0.95); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-R * 0.3, R * 0.95); ctx.lineTo(-R * 0.6, R * 2.1); ctx.lineTo(-R * 0.8, R * 0.6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(R * 0.9, -R * 0.4); ctx.lineTo(R * 1.35, -R * 0.7); ctx.lineTo(R * 0.8, -R * 0.95); ctx.closePath(); ctx.fill();
      }
    });
  },

  eyes(ctx, f, J) {
    if (f.state === 'ko' && f.stateT > 20) return;
    const s = f.scale, R = BONE.head * s;
    const u = J.hu, fwd = [u[1], -u[0]];
    this.frame(ctx, J.head, fwd, () => {
      const col = f.helmet === 'oni' ? '#ff3030' : f.eyeColor;
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.fillStyle = col;
      const blink = (Math.floor(f.time) % 220) < 6 ? 0.25 : 1;
      ctx.beginPath(); ctx.ellipse(R * 0.55, R * 0.18, 3.6 * s, 1.5 * s * blink, -0.12, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    });
  },

  fistGear(ctx, f, J) {
    const s = f.scale, shape = f.weaponLook.shape;
    for (const h of [J.bh, J.fh]) {
      if (shape === 'wraps') {
        ctx.strokeStyle = rgba('#e8e2d0', 0.55); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(h[0], h[1], 5 * s, 0.3, 2.6); ctx.stroke();
      } else if (shape === 'knuckles') {
        ctx.strokeStyle = 'rgba(200,210,225,0.85)'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(h[0], h[1], 7.2 * s, -0.9, 0.9); ctx.stroke();
      }
    }
    if (shape === 'claws') {
      const d = f.joints.wd;
      for (const h of [J.bh, J.fh]) this.frame(ctx, h, d, () => {
        ctx.strokeStyle = 'rgba(210,220,235,0.9)'; ctx.lineWidth = 1.8;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(4, i * 3); ctx.quadraticCurveTo(18 * s, i * 4 + 2, 28 * s, i * 3 - 3); ctx.stroke(); }
      });
    }
  },

  /* Weapons are drawn in a frame where +x runs along the blade from the hand. */
  weapon(ctx, f, hand, dir, isBack, ink, twoHand) {
    const L = f.weaponLook, s = f.scale;
    if (!L || f.cls === 'fist') return;
    const len = (L.len || 60) * s;
    const glow = L.glow;
    this.frame(ctx, hand, dir, () => {
      ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round';
      const steel = 'rgba(214,222,236,0.92)';
      const edge = (x0, y0, x1, y1, cx, cy) => {
        if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 12; }
        ctx.strokeStyle = glow ? mix(glow, '#ffffff', 0.35) : steel; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x0, y0); if (cx !== undefined) ctx.quadraticCurveTo(cx, cy, x1, y1); else ctx.lineTo(x1, y1); ctx.stroke();
        ctx.shadowBlur = 0;
      };
      switch (L.shape) {
        case 'bokken':
          this.limb(ctx, [-10 * s, 0], [len, 3 * s], 6 * s);
          ctx.fillRect(-1, -6 * s, 3 * s, 12 * s);
          break;
        case 'katana': case 'dao': {
          this.limb(ctx, [-16 * s, 0], [0, 0], 5 * s);
          ctx.beginPath(); ctx.ellipse(1, 0, 2.5 * s, 8 * s, 0, 0, TAU); ctx.fill();
          const wide = L.shape === 'dao' ? 1.8 : 1;
          ctx.beginPath();
          ctx.moveTo(2, -2.4 * s); ctx.quadraticCurveTo(len * 0.55, -2 * s, len, 6 * s * wide);
          ctx.quadraticCurveTo(len * 0.6, 3.5 * s * wide, 2, 2.6 * s);
          ctx.closePath(); ctx.fill();
          edge(4, -2.2 * s, len - 2, 5.5 * s * wide, len * 0.55, -1.6 * s);
          break;
        }
        case 'daggers': case 'sai': {
          this.limb(ctx, [-8 * s, 0], [0, 0], 5 * s);
          if (L.shape === 'sai') {
            ctx.lineWidth = 2.6 * s;
            ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(1, -7 * s); ctx.quadraticCurveTo(4, -2, 10 * s, -9 * s); ctx.moveTo(1, 7 * s); ctx.quadraticCurveTo(4, 2, 10 * s, 9 * s); ctx.stroke();
            edge(4, 0, len, 0);
          } else {
            ctx.beginPath(); ctx.moveTo(1, -3 * s); ctx.lineTo(len, 0); ctx.lineTo(1, 3 * s); ctx.closePath(); ctx.fill();
            edge(3, -2.4 * s, len - 1, 0);
          }
          break;
        }
        case 'kama':
          this.limb(ctx, [-6 * s, 0], [len, 0], 4.5 * s);
          ctx.beginPath(); ctx.moveTo(len, 2 * s); ctx.quadraticCurveTo(len + 6 * s, -14 * s, len - 8 * s, -24 * s); ctx.quadraticCurveTo(len - 2 * s, -12 * s, len - 4 * s, 0); ctx.closePath(); ctx.fill();
          edge(len - 3 * s, -2, len - 8 * s, -23 * s, len + 4 * s, -14 * s);
          break;
        case 'staff':
          this.limb(ctx, [-len * 0.42, 0], [len * 0.58, 0], 6 * s);
          ctx.strokeStyle = rgba(f.rim, 0.25); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(len * 0.5, 2); ctx.lineTo(len * 0.56, 2); ctx.stroke();
          break;
        case 'spear': case 'naginata': {
          this.limb(ctx, [-len * 0.4, 0], [len * 0.6, 0], 5 * s);
          const tip = len * 0.6;
          if (L.shape === 'spear') {
            ctx.beginPath(); ctx.moveTo(tip - 2, -4 * s); ctx.lineTo(tip + 24 * s, 0); ctx.lineTo(tip - 2, 4 * s); ctx.closePath(); ctx.fill();
            edge(tip, -3 * s, tip + 23 * s, 0);
          } else {
            ctx.beginPath(); ctx.moveTo(tip - 2, -3 * s); ctx.quadraticCurveTo(tip + 26 * s, -6 * s, tip + 40 * s, 8 * s); ctx.quadraticCurveTo(tip + 22 * s, 4 * s, tip - 2, 4 * s); ctx.closePath(); ctx.fill();
            edge(tip + 2, -3 * s, tip + 38 * s, 7 * s, tip + 26 * s, -5 * s);
          }
          break;
        }
        case 'club':
          ctx.beginPath(); ctx.moveTo(-10 * s, -3 * s); ctx.lineTo(len, -9 * s); ctx.arc(len, 0, 9 * s, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-10 * s, 3 * s); ctx.closePath(); ctx.fill();
          ctx.fillStyle = rgba(f.rim, 0.3);
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(len * (0.5 + i * 0.14), (i % 2 ? 1 : -1) * 4 * s, 1.4, 0, TAU); ctx.fill(); }
          break;
        case 'axe':
          this.limb(ctx, [-12 * s, 0], [len, 0], 5 * s);
          ctx.beginPath(); ctx.moveTo(len - 16 * s, 2 * s); ctx.quadraticCurveTo(len - 8 * s, 24 * s, len + 6 * s, 26 * s); ctx.quadraticCurveTo(len + 2 * s, 12 * s, len + 8 * s, -2 * s); ctx.lineTo(len, -3 * s); ctx.closePath(); ctx.fill();
          edge(len - 8 * s, 22 * s, len + 7 * s, 0, len + 1 * s, 12 * s);
          break;
        case 'hammer':
          this.limb(ctx, [-12 * s, 0], [len, 0], 5.5 * s);
          ctx.fillRect(len - 8 * s, -16 * s, 22 * s, 32 * s);
          if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 14; ctx.strokeStyle = glow; ctx.lineWidth = 1.6; ctx.strokeRect(len - 6 * s, -14 * s, 18 * s, 28 * s); ctx.shadowBlur = 0; }
          break;
      }
    });
  },

  /* Weapon tip in world space, for trails. */
  weaponTip(f) {
    const J = f.joints, L = f.weaponLook, s = f.scale;
    let len;
    if (f.cls === 'fist') len = 8; else if (f.cls === 'pole') len = (L.len || 120) * 0.6 + 24; else len = (L.len || 60) + 4;
    const h = J.fh, d = J.wd;
    const lx = h[0] + d[0] * len * s, ly = h[1] + d[1] * len * s;
    const mx = h[0] + d[0] * len * s * 0.35, my = h[1] + d[1] * len * s * 0.35;
    return {
      tip: [f.x + lx * f.facing, f.y + f.drawLift + ly],
      base: [f.x + mx * f.facing, f.y + f.drawLift + my],
    };
  },

  footTip(f) {
    const J = f.joints;
    return [f.x + J.ff[0] * f.facing, f.y + f.drawLift + J.ff[1]];
  },
};
