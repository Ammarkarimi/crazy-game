'use strict';
/* Computer opponent. It sees the world through a reaction delay and presses the same
   virtual buttons a player would, so every difficulty plays by the same rules. */

class Brain {
  constructor(tierId, styleId) {
    const t = TIER[tierId] || TIER.normal;
    const st = STYLES[styleId] || STYLES.balanced;
    this.p = Object.assign({}, t.ai);
    this.p.aggro = clamp(this.p.aggro + st.aggro, 0.05, 0.95);
    this.p.block = clamp(this.p.block + st.block, 0, 0.95);
    this.p.ranged = clamp(this.p.ranged + st.ranged, 0, 0.9);
    this.p.roll = clamp(this.p.roll + (st.roll || 0), 0, 0.6);
    this.spacing = st.spacing;
    this.hist = [];
    this.now = 0;
    this.think = 0;
    this.intent = 'idle';
    this.guardUntil = -1; this.guardLow = false;
    this.decided = -1; this.projDecided = new Set();
    this.attackTimes = []; this.seenSerial = -1; this.prevState = 'idle';
    this.chainSerial = -1; this.airSerial = -1;
    this.oppBlocks = 0; this.myAttacks = 0;
    this.pressQueue = [];
    this.c = newController();
    this.lastUp = false;
  }

  snapshot(o) {
    const m = o.move;
    let reachEnd = 0;
    if (o.state === 'attack' && m && m.box) reachEnd = (m.box[1] + (m.kind === 'weapon' ? o.reach : 0)) * o.scale + (m.travel ? m.travel * 10 : 0);
    return {
      x: o.x, y: o.y, facing: o.facing, state: o.state, phase: o.phase(), serial: o.attackSerial,
      move: m ? m.id : null, height: m ? m.height : null, guardBreak: m && m.guardBreak, kind: m ? m.kind : null,
      onGround: o.onGround, vy: o.vy, reachEnd, crouch: o.isCrouching(), stateT: o.stateT,
      inv: o.invulnerable(),
    };
  }

  view() {
    const i = Math.max(0, this.hist.length - 1 - Math.round(this.p.reaction * rand(0.8, 1.2)));
    return this.hist[i];
  }

  press(b) { this.c.p[b] = true; }

  update(me, opp, M) {
    this.now++;
    this.hist.push(this.snapshot(opp));
    if (this.hist.length > 60) this.hist.shift();
    const c = this.c;
    for (const k in c.h) { c.h[k] = false; c.p[k] = false; }
    const v = this.view();
    const toOpp = sign(opp.x - me.x);
    const fwdKey = toOpp > 0 ? 'right' : 'left', backKey = toOpp > 0 ? 'left' : 'right';
    const dist = Math.abs(opp.x - me.x);
    const gap = dist - 26 * opp.scale;
    const P = this.p;

    if (M.phase !== 'fight') return c;

    // ---- read the opponent's habits: how often have they attacked lately? ----
    if (v.state === 'attack' && v.serial !== this.seenSerial && v.kind !== 'cast') { this.seenSerial = v.serial; this.attackTimes.push(this.now); }
    while (this.attackTimes.length && this.attackTimes[0] < this.now - 150) this.attackTimes.shift();
    const pressure = Math.min(1, this.attackTimes.length / 5);
    const blockP = Math.min(0.95, P.block + pressure * P.read * 0.55);

    // ---- block, then punish: strike back the moment blockstun ends ----
    const was = this.prevState; this.prevState = me.state;
    if (was === 'blockstun' && me.isNeutral() && gap < 140 && chance(P.punish * 0.9)) {
      this.press(chance(0.25) ? 'heavy' : 'attack');
      return c;
    }
    // ---- after taking a hit, smarter fighters raise their guard ----
    if (was === 'hitstun' && me.isNeutral() && chance(P.read * 0.6)) { this.guardUntil = this.now + 18; this.guardLow = false; }

    // ---- keep guarding through blockstun ----
    if (me.state === 'blockstun') { c.h[backKey] = true; if (me.crouchBlock) c.h.down = true; return c; }
    if (!me.isNeutral() && me.state !== 'attack' && me.state !== 'jump') { this.think = 0; return c; }

    // ---- combo continuation ----
    if (me.state === 'attack') {
      const m = me.move;
      if (m.chain && me.moveT >= m.startup + (m.active + m.recovery) * RULES.chainOpen && this.chainSerial !== me.attackSerial) {
        this.chainSerial = me.attackSerial;
        const go = me.moveHit ? chance(P.combo) : chance(P.combo * 0.35);
        if (go && me.moveHit && chance(P.combo * 0.3)) {
          // fancy cancel: launcher or sweep
          if (chance(0.5)) { c.h[backKey] = true; this.press('attack'); } else { c.h.down = true; this.press('kick'); }
        } else if (go) {
          if (m.id === 'light2' && chance(0.22)) this.press('kick');
          else this.press('attack');
        }
      }
      return c;
    }

    // ---- air: attack when close ----
    if (me.state === 'jump') {
      if (!this.airDecided && dist < 160 && me.vy < 6) {
        this.airDecided = true;
        if (chance(0.3 + P.aggro * 0.5)) this.press(chance(0.5) ? 'kick' : 'attack');
      }
      if (this.jumpDir) c.h[this.jumpDir] = true;
      return c;
    }
    this.airDecided = false; this.jumpDir = null;

    // ---- defense ----
    const threat = v.state === 'attack' && (v.phase === 'startup' || v.phase === 'active') && v.facing === toOpp * -1 && v.kind !== 'throw' && v.kind !== 'cast'
      && gap <= v.reachEnd + 24;
    if (threat && this.decided !== v.serial) {
      this.decided = v.serial;
      const r = Math.random();
      if (v.guardBreak && chance(P.read * 0.7)) {
        this.doRoll(me, backKey, fwdKey, c, M);
        return c;
      }
      if (r < blockP) {
        this.guardUntil = this.now + 22;
        if (v.height === 'low') this.guardLow = chance(P.read);
        else if (v.height === 'overhead') this.guardLow = !chance(P.read);
        else this.guardLow = chance(0.25);
      } else if (r < blockP + P.roll * 0.5) {
        this.doRoll(me, backKey, fwdKey, c, M);
        return c;
      } else if (gap < 110 && chance(P.punish * 0.25)) {
        this.press('attack'); // try to trade / interrupt
        return c;
      }
    }
    // projectiles and magic
    for (const pr of M.projectiles) {
      if (pr.owner === me || pr.dead || pr.age < P.reaction || this.projDecided.has(pr.id)) continue;
      const toward = sign(pr.vx) === sign(me.x - pr.x) || pr.kind === 'quake';
      const pd = Math.abs(pr.x - me.x);
      if (!toward || pd > 340) continue;
      this.projDecided.add(pr.id);
      if (pr.kind === 'quake' || pr.kind === 'ice') {
        if (chance(P.read)) { this.jumpDir = null; c.p.up = true; c.h.up = true; return c; }
        continue;
      }
      if (pr.kind === 'lightning') { if (chance(P.read)) { this.doRoll(me, chance(0.5) ? backKey : fwdKey, fwdKey, c, M); return c; } continue; }
      if (chance(P.block + 0.1)) {
        this.guardUntil = this.now + 26;
        this.guardLow = pr.y > 112 * me.scale && chance(P.read);
      } else if (chance(P.roll)) { this.doRoll(me, fwdKey, fwdKey, c, M); return c; }
    }
    if (this.now < this.guardUntil) {
      c.h[backKey] = true;
      if (this.guardLow) { c.h.down = true; if (gap < 90 && chance(P.punish * 0.06)) this.press('kick'); }
      return c;
    }

    // ---- offense / footsies ----
    if (--this.think <= 0) this.decide(me, opp, v, gap, M);
    switch (this.intent) {
      case 'approach': c.h[fwdKey] = true; break;
      case 'retreat': c.h[backKey] = true; break;
      case 'guard': c.h[backKey] = true; break;
      case 'crouch': c.h.down = true; c.h[backKey] = true; break;
    }
    if (this.intent === 'approach' && gap <= this.idealGap(me)) this.intent = 'idle';
    return c;
  }

  idealGap(me) {
    const reach = (MOVES.light1.box[1] + me.reach) * me.scale;
    return Math.max(30, reach * 0.8 + this.spacing);
  }

  doRoll(me, dirKey, fwdKey, c, M) {
    if (me.x * (dirKey === 'left' ? -1 : 1) > RULES.arenaHalf - 140) dirKey = fwdKey; // cornered: roll through
    c.h[dirKey] = true; this.press('roll');
  }

  decide(me, opp, v, gap, M) {
    const P = this.p;
    this.think = Math.round(P.think * rand(0.7, 1.4));
    this.intent = 'idle';
    const c = this.c;
    const toOpp = sign(opp.x - me.x);
    const fwdKey = toOpp > 0 ? 'right' : 'left', backKey = toOpp > 0 ? 'left' : 'right';
    const s = me.scale;
    const lightR = (MOVES.light1.box[1] + me.reach) * s;
    const lungeR = (MOVES.lunge.box[1] + me.reach) * s + MOVES.lunge.travel * 12;
    const kickR = MOVES.kick.box[1] * s;

    if (chance(P.hesitate)) { this.intent = chance(0.5) ? 'idle' : 'retreat'; return; }

    const vulnerable = !v.inv && (v.phase === 'recovery' || v.state === 'stagger' || v.state === 'stunned' || v.state === 'land' || (v.state === 'getup' && v.stateT > RULES.getupFrames - 8));
    if (vulnerable && gap <= lungeR && chance(P.punish)) {
      if ((v.state === 'stagger' || v.state === 'stunned') && gap <= lightR) this.press('heavy');
      else if (gap > lightR) { c.h[fwdKey] = true; this.press('attack'); }
      else this.press('attack');
      this.myAttacks++;
      return;
    }

    // magic
    if (me.meter >= RULES.meterMax && chance(P.magic * 0.35) && !v.inv) {
      const k = me.magic.kind;
      const ok = (k === 'quake' || k === 'ice') ? opp.onGround : k === 'drain' ? gap < 520 : k === 'shadow' || k === 'lightning' ? true : gap > 90;
      if (ok) { this.press('magic'); return; }
    }

    // anti-air
    if (!v.onGround && gap < lightR + 40 && chance(P.antiAir)) { c.h[backKey] = true; this.press('attack'); return; }

    // corner escape
    const cornered = Math.abs(me.x) > RULES.arenaHalf - 150 && sign(me.x) === -toOpp;
    if (cornered && gap < 120 && chance(P.roll)) { if (chance(0.5)) { c.h[fwdKey] = true; this.press('roll'); } else { this.jumpDir = fwdKey; c.h[fwdKey] = true; c.h.up = true; c.p.up = true; } return; }

    const ideal = this.idealGap(me);
    if (gap > lightR + 50) {
      if (me.ammo > 0 && me.rangedCd === 0 && gap > 220 && chance(P.ranged)) { this.press('throw'); return; }
      if (gap < lungeR && chance(P.aggro * 0.45)) { c.h[fwdKey] = true; this.press('attack'); this.myAttacks++; return; }
      if (gap < 340 && chance(P.aggro * 0.12)) { this.jumpDir = fwdKey; c.h[fwdKey] = true; c.h.up = true; c.p.up = true; return; }
      if (this.spacing > 30 && gap < ideal + 80 && chance(0.4)) { this.intent = 'guard'; return; }
      this.intent = 'approach';
      return;
    }

    if (gap <= lightR + 12) {
      if (chance(P.aggro)) {
        this.myAttacks++;
        const blockRate = this.myAttacks > 4 ? this.oppBlocks / this.myAttacks : 0.2;
        const crouchy = v.crouch;
        const w = [
          ['light1', 0.42],
          ['kick', gap < kickR ? 0.16 : 0.02],
          ['low', 0.1 + (crouchy ? 0 : blockRate * 0.25)],
          ['sweep', 0.07 + (crouchy ? 0 : blockRate * 0.15)],
          ['heavy', 0.06 + blockRate * 0.35],
          ['lunge', 0.05],
          ['jumpin', crouchy ? 0.12 : 0.03],
        ];
        let tot = w.reduce((a, b) => a + b[1], 0), r = rand(tot), pickId = 'light1';
        for (const [id, wt] of w) { if ((r -= wt) <= 0) { pickId = id; break; } }
        switch (pickId) {
          case 'light1': this.press('attack'); break;
          case 'kick': this.press('kick'); break;
          case 'low': c.h.down = true; this.press('attack'); break;
          case 'sweep': c.h.down = true; this.press('kick'); break;
          case 'heavy': this.press('heavy'); break;
          case 'lunge': c.h[fwdKey] = true; this.press('attack'); break;
          case 'jumpin': this.jumpDir = fwdKey; c.h[fwdKey] = true; c.h.up = true; c.p.up = true; break;
        }
        return;
      }
      const r = Math.random();
      if (r < 0.4) this.intent = 'guard';
      else if (r < 0.55) this.intent = 'crouch';
      else if (r < 0.8) this.intent = 'retreat';
      else this.intent = 'idle';
      return;
    }
    // mid range
    if (chance(P.aggro * 0.5)) {
      this.myAttacks++;
      if (chance(0.55)) { c.h[fwdKey] = true; this.press('attack'); } else { c.h[fwdKey] = true; this.press('kick'); }
      return;
    }
    this.intent = gap > ideal ? 'approach' : chance(0.5) ? 'guard' : 'idle';
  }

  onOpponentBlocked() { this.oppBlocks++; }
}

/* Training dummy behaviours */
class DummyBrain {
  constructor(mode) { this.mode = mode; this.c = newController(); this.t = 0; this.lastAttack = -99; }
  update(me, opp, M) {
    const c = this.c; this.t++;
    for (const k in c.h) { c.h[k] = false; c.p[k] = false; }
    const backKey = opp.x > me.x ? 'left' : 'right', fwdKey = backKey === 'left' ? 'right' : 'left';
    const d = Math.abs(opp.x - me.x);
    if (this.mode === 'attack') {
      // walk up and swing every second or so, so the player can practise blocking
      const reach = (MOVES.light1.box[1] + me.reach) * me.scale + 12;
      if (d > reach) c.h[fwdKey] = true;
      else if (me.isNeutral() && this.t - this.lastAttack > 55) { c.p.attack = true; this.lastAttack = this.t; }
      return c;
    }
    // the dummy walks back to you after being knocked away, so practice never stalls
    if (d > 112 && this.mode !== 'jump' && me.isNeutral()) { c.h[fwdKey] = true; return c; }
    if (this.mode === 'block') c.h[backKey] = true;
    if (this.mode === 'crouch') { c.h.down = true; c.h[backKey] = true; }
    if (this.mode === 'jump' && this.t % 70 === 0) { c.p.up = true; c.h.up = true; }
    return c;
  }
}
