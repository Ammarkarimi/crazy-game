'use strict';
/* A fighter: stats from gear, a frame-based state machine, and the pose it shows. */

const BUTTONS = ['attack', 'kick', 'throw', 'heavy', 'magic', 'roll', 'up'];
const NEUTRAL = new Set(['idle', 'walk', 'crouch', 'land']);

function newController() {
  const z = () => ({ up: false, down: false, left: false, right: false, attack: false, kick: false, throw: false, heavy: false, magic: false, roll: false });
  return { h: z(), p: z() };
}

class Fighter {
  constructor(o) {
    this.def = FIGHTERS.find(f => f.id === o.fighter) || FIGHTERS[0];
    this.gear = o.gear;
    this.name = o.name || this.def.name;
    this.isPlayer = !!o.isPlayer;
    this.eyeColor = o.eyeColor || '#ffffff';
    this.rim = '#ffffff';
    this.look = this.def.look;
    this.scale = this.look.scale;
    this.build = this.look.build;
    this.hair = this.look.hair;
    this.robe = this.look.robe;
    this.trait = this.def.trait;
    this.computeStats();
    this.pose = Object.assign({}, CLASS_STANCE[this.cls]);
    this.time = rand(1000);
    this.roundsWon = 0;
    this.stats = { hits: 0, maxCombo: 0, parries: 0, dmgDealt: 0, dmgTaken: 0 };
  }

  computeStats() {
    const g = this.gear;
    const lvl = s => (g[s] ? g[s][1] : 1);
    const it = s => ITEM[g[s][0]];
    const w = it('weapon'), ar = it('armor'), he = it('helmet');
    this.weaponItem = w; this.weaponLook = w.look; this.cls = w.cls; this.clsDef = WEAPON_CLASS[w.cls];
    this.armor = ar.look.shape; this.helmet = he.look.shape;
    if (this.armor === 'robe') this.robe = true;
    this.atk = itemStat(w, 'atk', lvl('weapon')) * this.def.power;
    this.def_ = itemStat(ar, 'def', lvl('armor')) + itemStat(he, 'def', lvl('helmet'));
    this.dr = this.def_ / (this.def_ + 110);
    this.maxHp = Math.round(400 * this.def.hp + itemStat(ar, 'hp', lvl('armor')) + itemStat(he, 'hp', lvl('helmet')));
    this.perks = new Set([w.perk, ar.perk, he.perk].filter(Boolean));
    this.crit = (this.trait === 'crit' ? 0.18 : 0) + (this.perks.has('crit') ? 0.12 : 0);
    this.ranged = it('ranged'); this.rangedDmg = itemStat(this.ranged, 'dmg', lvl('ranged'));
    this.rangedAmmo = this.ranged.ammo + Math.floor((lvl('ranged') - 1) / 2);
    this.magic = it('magic'); this.magicDmg = itemStat(this.magic, 'dmg', lvl('magic')) * (this.trait === 'spell' ? 1.5 : 1);
    this.meterGain = (this.trait === 'focus' ? 1.6 : 1) * (this.perks.has('focus') ? 1.3 : 1);
    this.spd = this.def.speed;
    this.reach = this.clsDef.reach;
    this.power = powerRating(this.def, g);
  }

  resetRound(x, facing) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0; this.facing = facing;
    this.onGround = true; this.drawLift = Skel.hipHeight(this.scale);
    this.hp = this.maxHp; this.shownHp = this.maxHp; this.lagHp = this.maxHp;
    this.meter = this.trait === 'spell' ? 50 : 0;
    this.ammo = this.rangedAmmo; this.rangedCd = 0;
    this.state = 'intro'; this.stateT = 0;
    this.move = null; this.moveT = 0; this.moveHit = false; this.attackSerial = this.attackSerial || 0;
    this.hitstop = 0; this.stun = 0; this.flash = 0;
    this.combo = 0; this.juggles = 0; this.jumps = 0;
    this.status = { burn: 0, poison: 0, freeze: 0, sinceHit: 999 };
    this.buf = {}; for (const b of BUTTONS) this.buf[b] = 99;
    this.backAge = 99; this.backHeld = false; this.downHeld = false;
    this.vanish = 0; this.immune = false; this.lastHitBy = null;
    this.trail = []; this.walkPh = 0;
    this.pose = Object.assign({}, POSE.bow);
    this.joints = Skel.solve(this.pose, this.scale);
    this.chains = this.makeChains();
    this.tookDamage = false;
  }

  makeChains() {
    const s = this.scale, c = [];
    const sash = mix(this.look.sash, INK, 0.45);
    c.push({ at: 'hip', ch: new Chain(6, 7 * s, 5 * s, { color: sash }) });
    c.push({ at: 'hip', ch: new Chain(5, 7 * s, 4 * s, { color: sash, grav: 0.45 }) });
    if (this.helmet === 'band' || this.helmet === 'hood') c.push({ at: 'head', ch: new Chain(6, 6 * s, 3.5 * s, { grav: 0.3 }) });
    if (this.hair === 'pony' && this.helmet !== 'kabuto') c.push({ at: 'headTop', ch: new Chain(6, 7 * s, 6 * s, { grav: 0.5 }) });
    if (this.hair === 'long') c.push({ at: 'headTop', ch: new Chain(8, 8 * s, 9 * s, { grav: 0.7, taper: 0.5 }) });
    if (this.armor === 'robe' || this.armor === 'dragon') c.push({ at: 'neck', ch: new Chain(7, 9 * s, 10 * s, { grav: 0.6, taper: 0.7 }) });
    return c;
  }

  inkColor() {
    if (this.flash > 0) return this.flash > 3 ? '#ffffff' : '#9a9aa8';
    if (this.status.freeze > 0) return '#0d2436';
    if (this.status.poison > 0) return '#0b200c';
    if (this.status.burn > 0) return '#2a0c04';
    return INK;
  }

  get grounded() { return this.onGround; }
  get airborne() { return !this.onGround; }

  /* ---------- helpers for the game + AI ---------- */
  isNeutral() { return NEUTRAL.has(this.state); }
  isAttacking() { return this.state === 'attack'; }
  phase() {
    if (this.state !== 'attack') return null;
    const m = this.move;
    if (this.moveT < m.startup) return 'startup';
    if (this.moveT < m.startup + m.active) return 'active';
    return 'recovery';
  }
  isCrouching() {
    return this.state === 'crouch' || (this.state === 'blockstun' && this.crouchBlock) || (this.state === 'attack' && this.move.crouch);
  }
  invulnerable() {
    if (this.immune || this.vanish > 0) return true;
    if (this.state === 'roll') return this.stateT >= RULES.rollInvuln[0] && this.stateT <= RULES.rollInvuln[1];
    if (this.state === 'down' || this.state === 'ko' || this.state === 'intro' || this.state === 'win') return true;
    if (this.state === 'getup') return this.stateT < RULES.getupFrames - 6;
    return false;
  }
  canGuard() {
    if (!this.backHeld) return false;
    return this.state === 'idle' || this.state === 'walk' || this.state === 'crouch' || this.state === 'blockstun' || this.state === 'land';
  }
  hurtbox() {
    const s = this.scale, x = this.x, y = this.y;
    if (this.state === 'launched' || this.state === 'ko') return { x0: x - 40 * s, x1: x + 40 * s, y0: y, y1: y + 90 * s };
    const h = this.isCrouching() ? 112 : this.state === 'roll' ? 80 : 172;
    return { x0: x - 26 * s, x1: x + 26 * s, y0: y, y1: y + h * s };
  }
  hitbox() {
    const m = this.move, s = this.scale;
    const b = m.box, reach = m.kind === 'weapon' ? this.reach : 0;
    const a = b[0] * s, c = (b[1] + reach) * s;
    const x0 = this.facing > 0 ? this.x + a : this.x - c;
    const x1 = this.facing > 0 ? this.x + c : this.x - a;
    return { x0, x1, y0: this.y + b[2] * s, y1: this.y + b[3] * s };
  }
  moveSpeed(m) {
    let sp = m.kind === 'weapon' && !m.magic ? this.clsDef.speed : 1.05;
    sp *= Math.sqrt(this.spd);
    if (this.status.freeze > 0) sp *= 0.68;
    return sp;
  }
  totalFrames(m) { return m.startup + m.active + m.recovery; }

  /* ---------- input ---------- */
  readInput(c) {
    for (const b of BUTTONS) {
      if (c.p[b]) this.buf[b] = 0; else this.buf[b] = Math.min(this.buf[b] + 1, 99);
    }
    const back = this.facing > 0 ? c.h.left : c.h.right;
    const fwd = this.facing > 0 ? c.h.right : c.h.left;
    if (back && !this.backHeld) this.backAge = 0; else if (back) this.backAge++;
    this.backHeld = back; this.fwdHeld = fwd; this.downHeld = c.h.down; this.upHeld = c.h.up;
    this.ctrl = c;
  }
  take(b) { if (this.buf[b] < RULES.buffer) { this.buf[b] = 99; return true; } return false; }

  setState(s) { this.state = s; this.stateT = 0; }

  startMove(id, M) {
    const m = MOVES[id];
    this.move = m; this.moveT = 0; this.moveHit = false; this.moveSp = this.moveSpeed(m);
    this.fromPose = Object.assign({}, this.pose);
    this.attackSerial++;
    this.fired = false;
    this.setState('attack');
    if (!m.air && !m.travel) this.vx *= 0.3;
    if (M) M.onMoveStart(this, m);
  }

  /* ---------- main update, one frame ---------- */
  update(c, opp, M) {
    this.time++;
    this.readInput(c);
    if (this.flash > 0) this.flash--;
    if (this.hitstop > 0) { this.hitstop--; return; }
    this.stateT++;
    this.tickStatus(M);
    if (this.rangedCd > 0) this.rangedCd--;
    if (this.vanish > 0) { this.vanish--; if (this.vanish === 0) M.onReappear(this); }

    const fwdSign = this.facing;
    switch (this.state) {
      case 'intro': break;
      case 'idle': case 'walk': case 'crouch': case 'land':
        if (this.state === 'land' && this.stateT < 4) { this.vx *= 0.5; break; }
        this.faceOpponent(opp);
        this.neutral(opp, M);
        break;
      case 'jump':
        this.airControl(M);
        break;
      case 'attack':
        this.updateMove(opp, M);
        break;
      case 'roll': {
        const t = this.stateT / RULES.rollFrames;
        this.vx = this.rollDir * (RULES.rollDist / RULES.rollFrames) * 1.35 * (1 - t * 0.6) * Math.sqrt(this.spd);
        if (this.stateT >= RULES.rollFrames) { this.vx = 0; this.setState('idle'); this.faceOpponent(opp, true); }
        break;
      }
      case 'hitstun': case 'blockstun':
        this.vx *= 0.86;
        if (this.stateT >= this.stun) { this.setState('idle'); this.crouchBlock = false; }
        break;
      case 'stagger': case 'stunned':
        this.vx *= 0.85;
        if (this.stateT >= this.stun) this.setState('idle');
        break;
      case 'launched': case 'ko':
        if (this.onGround && this.stateT > 2) {
          if (this.state === 'ko') { this.vx *= 0.8; if (Math.abs(this.vx) < 0.5 && this.vy <= 0) this.vx = 0; break; }
          this.setState('down'); this.vx *= 0.3; M.onLand(this, true);
        }
        break;
      case 'down':
        this.vx *= 0.8; this.juggles = 0; this.immune = false;
        if (this.stateT >= RULES.knockdownFrames) this.setState('getup');
        break;
      case 'getup':
        this.vx = 0;
        if (this.stateT >= RULES.getupFrames) { this.setState('idle'); this.faceOpponent(opp, true); }
        break;
      case 'win': case 'lose':
        this.vx *= 0.8;
        break;
    }
    this.physics(M);
    this.updatePose(opp);
  }

  faceOpponent(opp, force) {
    const want = opp.x >= this.x ? 1 : -1;
    if (want !== this.facing && (force || Math.abs(opp.x - this.x) > 8)) this.facing = want;
  }

  neutral(opp, M) {
    const spd = this.spd * (this.status.freeze > 0 ? 0.65 : 1);
    if (this.meter >= RULES.meterMax && this.take('magic')) { this.startMove('cast', M); return; }
    if (this.take('heavy')) { this.startMove('heavy', M); return; }
    if (this.take('attack')) {
      this.startMove(this.downHeld ? 'low' : this.fwdHeld ? 'lunge' : this.backHeld ? 'rising' : 'light1', M); return;
    }
    if (this.take('kick')) { this.startMove(this.downHeld ? 'sweep' : this.fwdHeld ? 'sidekick' : 'kick', M); return; }
    if (this.ammo > 0 && this.rangedCd === 0 && this.take('throw')) { this.startMove('throw', M); return; }
    if (this.take('roll')) {
      this.rollDir = (this.fwdHeld ? 1 : -1) * this.facing;
      this.setState('roll'); this.fromPose = Object.assign({}, this.pose); M.sfx('roll', this); return;
    }
    if (this.upHeld) { this.jump(M); return; }
    if (this.downHeld) {
      if (this.state !== 'crouch') this.setState('crouch');
      this.vx = 0; return;
    }
    let v = 0;
    if (this.fwdHeld) v = RULES.walk * spd; else if (this.backHeld) v = -RULES.walkBack * spd;
    this.vx = v * this.facing;
    const ns = v ? 'walk' : 'idle';
    if (this.state !== ns) this.setState(ns);
  }

  jump(M) {
    const dir = this.fwdHeld ? 1 : this.backHeld ? -1 : 0;
    this.vy = RULES.jumpVy * (this.status.freeze > 0 ? 0.85 : 1);
    this.vx = dir * this.facing * RULES.jumpVx * Math.sqrt(this.spd);
    this.onGround = false;
    this.jumps = 1;
    this.buf.up = 99;
    this.setState('jump');
    M.sfx('jump', this);
  }

  airControl(M) {
    if (this.take('attack')) { this.startMove('air', M); return; }
    if (this.take('kick')) { this.startMove('airkick', M); return; }
    if (this.trait === 'doubleJump' && this.jumps < 2 && this.buf.up === 0 && this.stateT > 6) {
      this.vy = RULES.jumpVy * 0.85; this.jumps = 2;
      const dir = this.fwdHeld ? 1 : this.backHeld ? -1 : 0;
      if (dir) this.vx = dir * this.facing * RULES.jumpVx * Math.sqrt(this.spd);
      M.sfx('jump', this); M.fx.dust(this.x, this.y, 0.6);
    }
  }

  updateMove(opp, M) {
    const m = this.move;
    const prev = this.moveT;
    this.moveT += this.moveSp;
    const t = this.moveT;
    if (prev < m.startup && t >= m.startup) {
      this.fired = true;
      M.onMoveActive(this, m);
    }
    if (m.travel && t < m.startup + m.active) this.vx = this.facing * m.travel * Math.sqrt(this.spd);
    else if (!m.air) this.vx *= 0.78;
    if (m.dive && t >= m.startup && !this.onGround) { this.vx = this.facing * 9; this.vy = Math.min(this.vy, -13); }

    if (m.air && this.onGround && t > 1) { this.setState('land'); this.vx *= 0.3; M.onLand(this); return; }

    const ph = this.phase();
    if (ph === 'active' && !this.moveHit && m.box) M.checkHit(this, opp);

    const total = this.totalFrames(m);
    const winOpen = m.startup + (m.active + m.recovery) * RULES.chainOpen;
    if (t >= winOpen) {
      if (m.chain && this.take('attack')) { this.startMove(m.chain, M); return; }
      if ((m.id === 'light1' || m.id === 'light2') && this.take('kick')) { this.startMove('kick', M); return; }
    }
    if (t >= total) {
      this.move = null;
      if (this.onGround) { this.setState('idle'); this.faceOpponent(opp, true); }
      else this.setState('jump');
    }
  }

  physics(M) {
    const frozen = this.state === 'intro';
    if (!this.onGround) {
      let g = RULES.gravity;
      if (this.state === 'launched' || this.state === 'ko') g *= 0.9;
      if (this.state === 'attack' && this.move && this.move.air && !this.move.dive) g *= 0.85;
      this.vy -= g;
    }
    if (!frozen) { this.x += this.vx; this.y += this.vy; }
    if (this.y <= 0) {
      if (!this.onGround) {
        this.onGround = true; this.y = 0;
        if (this.state === 'jump') { this.setState('land'); this.vx = 0; M.onLand(this); }
        if (this.state === 'launched' || this.state === 'ko') M.onLand(this, true);
        this.vy = 0;
      } else { this.y = 0; this.vy = 0; }
    } else this.onGround = false;
    const lim = RULES.arenaHalf - 30;
    if (this.x < -lim) { this.x = -lim; if (this.vx < 0) this.vx = 0; }
    if (this.x > lim) { this.x = lim; if (this.vx > 0) this.vx = 0; }
  }

  tickStatus(M) {
    const st = this.status;
    st.sinceHit++;
    if (this.state === 'ko' || this.state === 'win' || this.state === 'intro') return;
    if (st.burn > 0) { st.burn--; if (st.burn % 15 === 0) M.dot(this, this.maxHp * 0.0045, 'burn'); }
    if (st.poison > 0) { st.poison--; if (st.poison % 20 === 0) M.dot(this, this.maxHp * 0.005, 'poison'); }
    if (st.freeze > 0) st.freeze--;
    if (this.perks.has('regen') && st.sinceHit > 120 && this.hp < this.maxHp && this.time % 20 === 0) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.002);
  }

  addMeter(v) { this.meter = Math.min(RULES.meterMax, this.meter + v * this.meterGain); }

  /* ---------- pose ---------- */
  updatePose(opp) {
    const s = this.state;
    let target = null, k = 0.32;
    const stance = CLASS_STANCE[this.cls];
    switch (s) {
      case 'intro': target = this.stateT < 50 ? POSE.bow : stance; k = 0.12; break;
      case 'idle': case 'land': {
        const br = Math.sin(this.time * 0.07);
        target = Object.assign({}, stance, { t: stance.t + br * 1.6, fu: stance.fu + br * 2, bu: stance.bu - br * 2 });
        if (this.backHeld) target = POSE.guard;
        break;
      }
      case 'walk': {
        this.walkPh += Math.abs(this.vx) * 0.09 * (this.vx * this.facing >= 0 ? 1 : -1);
        const a = Math.sin(this.walkPh), b2 = Math.cos(this.walkPh);
        const base = this.backHeld ? POSE.guard : stance;
        target = Object.assign({}, base, { ft: base.ft + a * 16, fs: base.fs + Math.max(0, b2) * -18, bt: base.bt - a * 16, bs: base.bs + Math.max(0, -b2) * -18 });
        k = 0.45;
        break;
      }
      case 'crouch': target = this.backHeld ? POSE.crouchGuard : POSE.crouch; k = 0.45; break;
      case 'jump': target = this.vy > 2 ? POSE.jump : POSE.fall; k = 0.25; break;
      case 'roll': {
        const t = clamp(this.stateT / RULES.rollFrames, 0, 1);
        const dirSign = this.rollDir * this.facing;
        target = Object.assign({}, POSE.roll, { rot: (t < 0.9 ? ease.inOut(t / 0.9) : 1) * 360 * dirSign });
        if (t >= 0.9) target = Object.assign({}, stance, { rot: 360 * dirSign });
        this.pose = Object.assign({}, target, { rot: target.rot });
        if (this.stateT >= RULES.rollFrames - 1) this.pose.rot = 0;
        target = null;
        break;
      }
      case 'hitstun': target = this.lowHit ? POSE.hitLow : POSE.hit; k = this.stateT < 3 ? 0.7 : 0.25; break;
      case 'blockstun': target = this.crouchBlock ? POSE.crouchGuard : Object.assign({}, POSE.guard, { t: POSE.guard.t - 8 }); k = 0.6; break;
      case 'stagger': target = POSE.stagger; k = 0.3; break;
      case 'stunned': target = Object.assign({}, POSE.stunned, { t: POSE.stunned.t + Math.sin(this.stateT * 0.2) * 8 }); k = 0.2; break;
      case 'launched': {
        const spin = clamp(-this.vy * 3, -60, 40);
        target = Object.assign({}, POSE.launched, { rot: -30 + spin - (this.juggles > 1 ? 30 : 0) });
        k = 0.3;
        break;
      }
      case 'ko': target = this.onGround ? POSE.ko : POSE.launched; k = this.onGround ? 0.2 : 0.3; break;
      case 'down': target = POSE.down; k = 0.35; break;
      case 'getup': {
        const t = this.stateT / RULES.getupFrames;
        target = t < 0.55 ? POSE.getup : stance; k = 0.22;
        break;
      }
      case 'win': target = this.def.id === 'monk' || this.def.id === 'mystic' ? POSE.bow : POSE.win; k = 0.1; break;
      case 'lose': target = POSE.kneel; k = 0.1; break;
      case 'attack': {
        const m = this.move, t = this.moveT;
        const strike = m.strike, wind = m.wind;
        const mStance = m.crouch ? POSE.crouch : stance;
        let p;
        if (t < m.startup) p = Skel.lerpPose(this.fromPose, wind, ease.out(clamp(t / (m.startup * 0.8), 0, 1)));
        else if (t < m.startup + 2.2) p = Skel.lerpPose(wind, strike, ease.out(clamp((t - m.startup) / 2.2, 0, 1)));
        else if (t < m.startup + m.active) p = strike;
        else {
          const r = clamp((t - m.startup - m.active) / m.recovery, 0, 1);
          const endPose = m.air ? POSE.fall : mStance;
          p = Skel.lerpPose(strike, endPose, ease.inOut(r));
        }
        this.pose = Object.assign({}, p);
        target = null;
        break;
      }
    }
    if (target) this.pose = Skel.lerpPose(this.pose, target, k);
    this.joints = Skel.solve(this.pose, this.scale);
    const want = this.onGround ? Skel.groundOffset(this.joints, this.scale) : Skel.hipHeight(this.scale) * (this.state === 'launched' || this.state === 'ko' ? 0.55 : 1);
    this.drawLift = this.onGround ? want : lerp(this.drawLift, want, 0.35);
    this.updateTrail();
  }

  updateTrail() {
    const m = this.move;
    const live = this.state === 'attack' && m && (m.kind === 'weapon' || m.kind === 'kick') && this.moveT >= m.startup - 1.5 && this.moveT <= m.startup + m.active + 1;
    if (live) {
      if (m.kind === 'weapon') this.trail.push(Render.weaponTip(this));
      else { const t = Render.footTip(this); this.trail.push({ tip: t, base: [t[0] - this.facing * 10, t[1]] }); }
      if (this.trail.length > 7) this.trail.shift();
    } else if (this.trail.length) this.trail.shift();
  }

  updateChains(wind) {
    const J = this.joints, f = this.facing;
    const W = (p) => [this.x + p[0] * f, this.y + this.drawLift + p[1]];
    const hip = W(J.hip), head = W(J.head), neck = W(J.neck);
    const R = BONE.head * this.scale;
    const back = [-J.hu[1] * f, J.hu[0]]; // roughly backward from the face
    for (const c of this.chains) {
      let a;
      if (c.at === 'hip') a = [hip[0] - f * 10 * this.scale, hip[1] + 6 * this.scale];
      else if (c.at === 'head') a = [head[0] + back[0] * R * 0.9 * f, head[1] + 3];
      else if (c.at === 'headTop') a = [head[0] - f * R * 0.6, head[1] + R * 0.6];
      else a = [neck[0] - f * 8 * this.scale, neck[1] - 4];
      c.ch.update(a[0], a[1], [-f * 0.5 - this.vx * 0.06, 0.1], wind, this.time);
    }
  }
}

/* Gear power rating shown to the player to compare against rivals. */
function powerRating(def, gear) {
  const lv = s => gear[s][1];
  const it = s => ITEM[gear[s][0]];
  const atk = itemStat(it('weapon'), 'atk', lv('weapon')) * def.power;
  const d = itemStat(it('armor'), 'def', lv('armor')) + itemStat(it('helmet'), 'def', lv('helmet'));
  const hp = 400 * def.hp + itemStat(it('armor'), 'hp', lv('armor')) + itemStat(it('helmet'), 'hp', lv('helmet'));
  const ehp = hp / (1 - d / (d + 110));
  const r = itemStat(it('ranged'), 'dmg', lv('ranged'));
  const m = itemStat(it('magic'), 'dmg', lv('magic'));
  return Math.round(Math.sqrt(atk * ehp) * 1.6 + r * 0.8 + m * 0.5);
}
