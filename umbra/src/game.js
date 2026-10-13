'use strict';
/* A duel: rounds, hit resolution, projectiles, magic, camera and drawing. */

class Camera {
  constructor() { this.x = 0; this.z = 1; this.W = 1280; this.H = 720; this.groundY = 600; this.uiScale = 1; this.shake = 0; this.sx = 0; this.sy = 0; this.zoomBoost = 1; this.focus = null; }
  resize(W, H) { this.W = W; this.H = H; this.groundY = Math.round(H * 0.84); this.uiScale = Math.min(W, H) / 720; }
  follow(a, b, snap) {
    const mid = this.focus !== null ? this.focus : (a.x + b.x) / 2;
    const dist = Math.abs(a.x - b.x);
    const maxY = Math.max(a.y, b.y);
    let viewW = clamp(dist + 600, 860, 1520);
    let z = this.W / viewW;
    z = Math.min(z, (this.H * 0.8) / (330 + maxY * 0.9));
    z *= this.zoomBoost;
    const half = this.W / (2 * z);
    let tx = mid;
    const lim = RULES.arenaHalf + 60 - half;
    tx = lim > 0 ? clamp(tx, -lim, lim) : 0;
    if (snap) { this.x = tx; this.z = z; } else { this.x = lerp(this.x, tx, 0.12); this.z = lerp(this.z, z, 0.08); }
    if (this.shake > 0) {
      const s = this.shake * Save.data.settings.shake * this.uiScale;
      this.sx = rand(-s, s); this.sy = rand(-s, s); this.shake *= 0.85; if (this.shake < 0.3) this.shake = 0;
    } else { this.sx = this.sy = 0; }
  }
  toScreen(x, y) { return [this.W / 2 + (x - this.x) * this.z + this.sx, this.groundY - y * this.z + this.sy]; }
  apply(ctx) { ctx.setTransform(this.z, 0, 0, -this.z, this.W / 2 - this.x * this.z + this.sx, this.groundY + this.sy); }
}

let projSerial = 0;

class Match {
  constructor(o) {
    this.o = o;
    this.mode = o.mode;
    this.sim = !!o.sim;
    this.f1 = new Fighter(Object.assign({ eyeColor: '#ffffff' }, o.p1));
    this.f2 = new Fighter(Object.assign({ eyeColor: o.mode === 'versus' ? '#7fd6ff' : '#ff4040' }, o.p2));
    this.brain2 = o.brain2 || null;
    this.brain1 = o.brain1 || null;
    this.stageDef = o.stage || pick(STAGES);
    if (!this.sim) this.stage = new Stage(this.stageDef);
    this.fx = new FX();
    this.cam = new Camera();
    this.projectiles = [];
    this.round = 0;
    this.roundsToWin = o.rounds === 1 ? 1 : 2;
    this.results = [];
    this.frame = 0;
    this.slow = 0;
    this.flashScreen = 0;
    this.banner = null;
    this.finishKind = null;
    this.paused = false;
    this.done = false;
    this.training = this.mode === 'training';
    this.hitLog = [];
    this.startRound();
  }

  get fighters() { return [this.f1, this.f2]; }
  other(f) { return f === this.f1 ? this.f2 : this.f1; }

  sfx(name, f, p) { if (!this.sim) Sound.play(name, p); }
  announce(t) { if (!this.sim) Voice.say(t); }

  startRound() {
    this.round++;
    this.f1.resetRound(-230, 1);
    this.f2.resetRound(230, -1);
    this.projectiles = [];
    this.timer = RULES.roundTime * FPS;
    this.phase = 'intro'; this.phaseT = 0;
    this.finishKind = null;
    this.cam.zoomBoost = 1; this.cam.focus = null;
    this.cam.resize(this.cam.W, this.cam.H);
    this.cam.follow(this.f1, this.f2, true);
    for (const f of this.fighters) for (const c of f.chains) c.ch.p = [];
    if (this.training) { this.phase = 'fight'; this.f1.setState('idle'); this.f2.setState('idle'); this.timer = Infinity; }
  }

  setBanner(text, sub, color, frames) { this.banner = { text, sub, color: color || '#ffffff', t: 0, frames }; }

  /* ---------- per frame ---------- */
  update(c1, c2) {
    this.frame++;
    this.phaseT++;
    if (this.banner) { this.banner.t++; if (this.banner.t > this.banner.frames) this.banner = null; }
    if (this.flashScreen > 0) this.flashScreen--;

    if (this.phase === 'intro') {
      if (this.phaseT === 1) { this.setBanner(`ROUND ${this.round}`, this.round === 1 ? `${this.f1.name}  vs  ${this.f2.name}` : '', '#ffffff', 75); this.sfx('drum'); this.announce(`Round ${this.round}`); }
      if (this.phaseT === 80) { this.setBanner('FIGHT!', '', '#ff4a3a', 40); this.sfx('gong'); this.announce('Fight!'); }
      if (this.phaseT >= 92) { this.phase = 'fight'; this.phaseT = 0; for (const f of this.fighters) f.setState('idle'); }
    }

    const slowStep = this.slow > 0 ? (this.slow--, this.frame % 3 === 0) : true;
    if (!slowStep) { this.cam.follow(this.f1, this.f2); return; }

    const fighting = this.phase === 'fight';
    const empty = newController();
    let i1 = fighting ? (this.brain1 ? this.brain1.update(this.f1, this.f2, this) : c1) : empty;
    let i2 = fighting ? (this.brain2 ? this.brain2.update(this.f2, this.f1, this) : c2) : empty;
    // alternate update order so neither side always acts first
    if (this.frame % 2) { this.f1.update(i1, this.f2, this); this.f2.update(i2, this.f1, this); }
    else { this.f2.update(i2, this.f1, this); this.f1.update(i1, this.f2, this); }

    this.separate();
    this.updateProjectiles();
    for (const f of this.fighters) {
      const o = this.other(f);
      if (!['hitstun', 'launched', 'down', 'stagger', 'stunned', 'blockstun'].includes(o.state) && o.state !== 'ko') f.combo = 0;
    }
    if (fighting && !this.training) {
      this.timer--;
      if (this.timer <= 0) this.timeUp();
    }
    if (this.training) {
      for (const f of this.fighters) if (f.hp < f.maxHp && f.status.sinceHit > 90) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.02);
      this.f1.meter = Math.max(this.f1.meter, this.trainingMeter ? 100 : 0);
      if (this.f1.ammo < this.f1.rangedAmmo && this.frame % 90 === 0) this.f1.ammo++;
    }
    if (this.phase === 'ko' && this.phaseT > 75) this.endRound();
    if (this.phase === 'roundOver') {
      if (this.phaseT === 50 && this.roundWinner) { this.roundWinner.setState('win'); }
      if (this.phaseT > 150) {
        if (this.f1.roundsWon >= this.roundsToWin || this.f2.roundsWon >= this.roundsToWin) { this.phase = 'matchOver'; this.phaseT = 0; }
        else this.startRound();
      }
    }
    if (this.phase === 'matchOver' && this.phaseT === 70 && !this.done) {
      this.done = true;
      if (this.o.onEnd) this.o.onEnd(this.result());
    }
    // meter display smoothing
    for (const f of this.fighters) {
      f.shownHp = lerp(f.shownHp, f.hp, 0.35);
      if (f.status.sinceHit > 30) f.lagHp = lerp(f.lagHp, f.hp, 0.06); else f.lagHp = Math.max(f.lagHp, f.hp);
      if (!this.sim) f.updateChains(this.stageDef.particles === 'mist' ? 0.25 : 0.12);
    }
    if (!this.sim) {
      this.fx.update();
      this.cam.follow(this.f1, this.f2);
    }
  }

  separate() {
    const a = this.f1, b = this.f2;
    if (a.state === 'roll' || b.state === 'roll' || a.vanish || b.vanish) return;
    if (Math.abs(a.y - b.y) > 110) return;
    const minD = RULES.pushHalf * (a.scale + b.scale);
    const dx = b.x - a.x;
    const d = Math.abs(dx);
    if (d < minD) {
      const push = (minD - d) / 2;
      const s = dx === 0 ? (a.facing > 0 ? 1 : -1) : sign(dx);
      a.x -= push * s; b.x += push * s;
      const lim = RULES.arenaHalf - 30;
      // a fighter pinned to a wall pushes the other one out instead
      for (const [f, g] of [[a, b], [b, a]]) {
        if (Math.abs(f.x) > lim) { const over = Math.abs(f.x) - lim; f.x = sign(f.x) * lim; g.x -= sign(f.x) * over; }
      }
    }
  }

  /* ---------- callbacks from fighters ---------- */
  onMoveStart(f, m) {
    if (m.kind === 'cast') { f.meter = 0; this.sfx('cast', f); this.fx.burst(f.x, f.y + 100 * f.scale, '#b9a6ff', 16, 6); }
    if (f.trait === 'ironBody' && m.heavy) f.armorUntil = f.time + 30;
  }

  onMoveActive(f, m) {
    if (m.kind === 'throw') { this.spawnThrown(f); return; }
    if (m.kind === 'cast') { this.spawnMagic(f); return; }
    this.sfx(m.sfx || 'swing', f);
  }

  onLand(f, hard) {
    if (this.sim) return;
    this.fx.dust(f.x, 0, hard ? 1.4 : 0.6);
    this.sfx('land', f, hard ? 1 : 0.5);
    if (hard) this.cam.shake = Math.max(this.cam.shake, 5);
  }

  onReappear(f) {
    const o = this.other(f);
    f.x = clamp(o.x - o.facing * 80 * f.scale, -RULES.arenaHalf + 40, RULES.arenaHalf - 40);
    f.y = 0; f.onGround = true;
    f.facing = o.x >= f.x ? 1 : -1;
    f.startMove('shadowSlash', this);
    if (!this.sim) { this.fx.smoke(f.x, 60, 14, 34); this.fx.burst(f.x, 100, '#b45aff', 20, 8); }
  }

  dot(f, amount, kind) {
    if (f.state === 'ko' || this.phase !== 'fight') return;
    this.damage(f, amount, this.other(f), kind);
    if (!this.sim) {
      if (kind === 'burn') this.fx.flame(f.x, f.y + 100 * f.scale, 4);
      if (kind === 'poison') this.fx.burst(f.x, f.y + 110 * f.scale, '#7dff6a', 5, 3);
    }
  }

  /* ---------- hits ---------- */
  overlap(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }

  checkHit(att, def) {
    if (def.invulnerable()) return;
    const m = att.move;
    if (!this.overlap(att.hitbox(), def.hurtbox())) return;
    att.moveHit = true;
    let dmg;
    if (m.magic) dmg = att.magicDmg * RULES.magicScale;
    else if (m.kind === 'weapon') dmg = att.atk * att.clsDef.dmg * m.dmg * RULES.dmgScale;
    else dmg = att.atk * RULES.kickScale * m.dmg * RULES.dmgScale;
    const guardBreak = m.guardBreak || (att.cls === 'heavy' && m.id === 'light3');
    const hb = att.hitbox(), hu = def.hurtbox();
    const ix = (Math.max(hb.x0, hu.x0) + Math.min(hb.x1, hu.x1)) / 2;
    const iy = (Math.max(hb.y0, hu.y0) + Math.min(hb.y1, hu.y1)) / 2;
    this.applyHit(att, def, {
      dmg, height: m.height, hitstun: m.hitstun, blockstun: m.blockstun || 12, push: m.push, blockPush: m.blockPush || 4,
      knockdown: m.knockdown, launch: m.launch, guardBreak, unblockable: m.unblockable, melee: true,
      weapon: m.kind === 'weapon' && !m.magic, heavy: m.heavy || m.id === 'light3', magic: m.magic, x: ix, y: iy, dir: att.facing, move: m,
    });
  }

  applyHit(att, def, h) {
    if (def.invulnerable()) return { type: 'miss' };
    if (h.magic) this.lastMagicHit = true;
    const dir = h.dir;
    let guarding = !h.unblockable && def.canGuard();
    const crouching = def.isCrouching() || (def.state === 'blockstun' && def.crouchBlock);
    if (guarding) {
      if (h.height === 'low' && !crouching) guarding = false;
      else if (h.height === 'overhead' && crouching) guarding = false;
    }
    const brainOf = f => (f === this.f2 ? this.brain2 : this.brain1);

    if (guarding) {
      // perfect parry: the Ronin's trait (melee only)
      if (def.trait === 'parry' && h.melee && !h.guardBreak && def.backAge <= 8) {
        def.stats.parries++;
        att.setState('stagger'); att.stun = 34; att.vx = -dir * 3; att.move = null;
        def.hitstop = att.hitstop = 8;
        def.addMeter(12);
        this.sfx('parry'); if (!this.sim) { this.fx.parry(h.x, h.y); this.fx.text(h.x, h.y + 60, 'PARRY!', '#bfe8ff', 34); this.cam.shake = 6; }
        this.log('parry', att, def);
        return { type: 'parry' };
      }
      const b = brainOf(att); if (b && b.onOpponentBlocked) b.onOpponentBlocked();
      if (h.guardBreak) {
        this.damage(def, h.dmg * RULES.guardBreakDmg * (1 - def.dr), att, h.magic ? 'magic' : h.melee ? 'melee' : 'ranged');
        if (def.state !== 'ko') { def.setState('stagger'); def.stun = RULES.staggerFrames; def.vx = dir * 6; }
        def.hitstop = att.hitstop = RULES.hitstopHeavy;
        this.sfx('guardBreak'); if (!this.sim) { this.fx.block(h.x, h.y, dir); this.fx.burst(h.x, h.y, '#ffd27a', 24, 12); this.fx.text(h.x, h.y + 70, 'GUARD BREAK!', '#ffb347', 30); this.cam.shake = 9; }
        this.log('guardbreak', att, def);
        return { type: 'guardbreak' };
      }
      this.damage(def, h.dmg * RULES.chip * (1 - def.dr), att, 'chip');
      if (def.state !== 'ko') {
        def.crouchBlock = crouching;
        def.setState('blockstun'); def.stun = h.blockstun; def.vx = dir * h.blockPush;
      }
      def.addMeter(RULES.meterBlock);
      def.hitstop = att.hitstop = RULES.hitstopBlock;
      this.sfx('block'); if (!this.sim) this.fx.block(h.x, h.y, dir);
      this.log('block', att, def);
      return { type: 'block' };
    }

    // ---- clean hit ----
    let dmg = h.dmg;
    const counter = def.state === 'attack' && def.phase() === 'startup';
    if (counter) dmg *= 1.25;
    const crit = !h.magic && chance(att.crit);
    if (crit) dmg *= 2;
    const comboing = ['hitstun', 'launched', 'stagger', 'stunned'].includes(def.state);
    att.combo = comboing ? att.combo + 1 : 1;
    const scale = Math.max(RULES.comboScaleMin, 1 - (att.combo - 1) * RULES.comboScaleStep);
    dmg *= scale * (1 - def.dr);
    this.damage(def, dmg, att, h.magic ? 'magic' : h.ranged ? 'ranged' : 'melee');
    att.stats.hits++;
    att.stats.maxCombo = Math.max(att.stats.maxCombo, att.combo);
    att.addMeter(RULES.meterHit); def.addMeter(RULES.meterTaken);

    // perks + status
    if (h.weapon) {
      const P = att.perks;
      if (P.has('lifesteal')) att.hp = Math.min(att.maxHp, att.hp + dmg * 0.15);
      if (P.has('burn')) def.status.burn = 150;
      if (P.has('poison')) def.status.poison = 200;
      if (P.has('freeze')) def.status.freeze = 140;
    }
    if (h.melee && def.perks.has('thorns')) this.damage(att, dmg * 0.12, def, 'thorns');
    if (h.status) Object.assign(def.status, h.status);

    const ironArmor = def.armorUntil && def.time < def.armorUntil && def.state === 'attack' && !h.knockdown && !h.launch;
    if (def.state !== 'ko' && !ironArmor) {
      const shock = h.weapon && att.perks.has('shock') && h.heavy;
      if (h.stun || shock) {
        def.setState('stunned'); def.stun = h.stun || 45; def.vx = dir * 4; def.move = null;
        if (!this.sim) this.fx.burst(h.x, h.y, '#ffe95a', 18, 10);
      } else if (h.knockdown || h.launch || def.airborne) {
        def.juggles++;
        def.setState('launched'); def.move = null;
        def.onGround = false;
        def.vy = h.launch || (def.airborne ? 9 : h.knockdown ? 10 : 8);
        def.vx = dir * (h.push * 0.55 + 2);
        if (def.juggles >= RULES.juggleMax) def.immune = true;
      } else {
        def.setState('hitstun'); def.stun = h.hitstun + (counter ? 6 : 0); def.vx = dir * h.push; def.move = null;
        def.lowHit = h.height === 'low';
      }
    }
    def.flash = 6;
    const big = h.heavy || h.knockdown || crit || h.magic;
    def.hitstop = att.hitstop = big ? RULES.hitstopHeavy : RULES.hitstopHit;
    if (h.ranged || h.magic) att.hitstop = 0;

    if (!this.sim) {
      this.sfx(big ? 'hitHeavy' : 'hit', att, 1);
      const col = h.weapon && att.weaponLook.glow ? att.weaponLook.glow : '#ffffff';
      this.fx.hit(h.x, h.y, dir, big ? 1.4 : 0.8, col);
      this.cam.shake = Math.max(this.cam.shake, big ? 9 : 4);
      if (counter) this.fx.text(h.x, h.y + 70, 'COUNTER', '#ffb347', 26);
      if (crit) this.fx.text(h.x, h.y + 90, 'CRITICAL!', '#ff4a4a', 30);
      if (Save.data.settings.hitNumbers) this.fx.text(h.x + rand(-20, 20), h.y + 30, Math.round(dmg).toString(), crit ? '#ff6a6a' : '#ffffff', 22, 40);
      if (big) this.flashScreen = 4;
    }
    this.log(crit ? 'crit' : 'hit', att, def, dmg);
    return { type: 'hit', dmg, crit, counter };
  }

  log(type, att, def, dmg) { if (this.hitLog.length < 4000) this.hitLog.push({ t: this.frame, type, att: att === this.f1 ? 1 : 2, dmg: dmg || 0 }); }

  damage(def, amt, att, kind) {
    if (amt <= 0 || def.state === 'ko' || this.phase !== 'fight') return;
    if (this.training && def === this.f1) amt = 0;
    def.hp -= amt;
    def.tookDamage = true;
    def.status.sinceHit = 0;
    def.stats.dmgTaken += amt; att.stats.dmgDealt += amt;
    if (def.hp <= 0) {
      if (this.training) { def.hp = def.maxHp; return; }
      def.hp = 0;
      this.ko(def, att, kind);
    }
  }

  ko(loser, winner, kind) {
    loser.setState('ko'); loser.move = null;
    loser.onGround = false; loser.vy = 13; loser.vx = (loser.x >= winner.x ? 1 : -1) * 8;
    this.phase = 'ko'; this.phaseT = 0;
    this.finishKind = kind;
    this.slow = this.sim ? 0 : 75;
    this.roundWinner = winner;
    if (!this.sim) {
      this.sfx('ko'); this.cam.zoomBoost = 1.22; this.cam.focus = loser.x; this.flashScreen = 8; this.cam.shake = 14;
      this.setBanner('K.O.', '', '#ff3a3a', 100); this.announce('K.O.');
      for (let i = 0; i < 3; i++) this.fx.hit(loser.x, loser.y + 100, -loser.facing, 1.6, '#ffffff');
    }
  }

  timeUp() {
    const a = this.f1, b = this.f2;
    const pa = a.hp / a.maxHp, pb = b.hp / b.maxHp;
    this.phase = 'ko'; this.phaseT = 0; this.finishKind = 'time';
    if (Math.abs(pa - pb) < 0.001) { this.roundWinner = null; this.setBanner('DRAW', 'Time up', '#ffffff', 90); }
    else {
      this.roundWinner = pa > pb ? a : b;
      const loser = this.other(this.roundWinner);
      loser.setState('lose');
      this.setBanner('TIME', `${this.roundWinner.name} wins the round`, '#ffd84a', 90);
    }
    this.sfx('gong');
  }

  endRound() {
    const w = this.roundWinner;
    this.phase = 'roundOver'; this.phaseT = 0;
    this.cam.zoomBoost = 1; this.cam.focus = null;
    if (w) {
      w.roundsWon++;
      const l = this.other(w);
      const perfect = !w.tookDamage;
      this.results.push({ winner: w === this.f1 ? 1 : 2, perfect, finish: this.finishKind, hpLeft: w.hp / w.maxHp });
      if (perfect && !this.sim) { this.setBanner('PERFECT', '', '#ffe9a0', 90); this.announce('Perfect'); }
      if (l.state !== 'ko') l.setState('lose');
    } else {
      this.results.push({ winner: 0 });
      this.f1.roundsWon++; this.f2.roundsWon++;
    }
  }

  result() {
    const w = this.f1.roundsWon > this.f2.roundsWon ? 1 : this.f2.roundsWon > this.f1.roundsWon ? 2 : 0;
    return { winner: w, rounds: this.results, f1: this.f1, f2: this.f2, frames: this.frame };
  }

  /* ---------- projectiles & magic ---------- */
  spawnThrown(f) {
    if (f.ammo <= 0) return;
    f.ammo--; f.rangedCd = RULES.rangedCooldown;
    const k = f.ranged.kind, s = f.scale, dir = f.facing;
    const p = { id: ++projSerial, owner: f, kind: k, x: f.x + dir * 40 * s, y: f.y + 128 * s, vx: 0, vy: 0, grav: 0, r: 10, age: 0, life: 120, rot: 0,
      dmg: f.rangedDmg * RULES.rangedScale, hitstun: 14, push: 6, ranged: true };
    switch (k) {
      case 'shuriken': p.vx = dir * 16; p.r = 9; p.highOnly = true; break;
      case 'kunai': p.vx = dir * 18; p.r = 8; p.highOnly = true; p.hitstun = 16; break;
      case 'axe': p.vx = dir * 10; p.vy = 9; p.grav = 0.42; p.r = 14; p.knockdown = true; p.push = 10; break;
      case 'chakram': p.vx = dir * 15; p.dir0 = dir; p.r = 14; p.chakram = true; p.life = 160; p.y = f.y + 115 * s; break;
      case 'bomb': p.vx = dir * 8.5; p.vy = 12; p.grav = 0.55; p.r = 12; p.bomb = true; break;
    }
    this.projectiles.push(p);
    this.sfx('throw', f);
  }

  spawnMagic(f) {
    const k = f.magic.kind, s = f.scale, dir = f.facing, o = this.other(f);
    const dmg = f.magicDmg * RULES.magicScale;
    const base = { id: ++projSerial, owner: f, kind: k, x: f.x + dir * 50 * s, y: f.y + 115 * s, vx: 0, vy: 0, grav: 0, r: 20, age: 0, life: 140, dmg, magic: true, hitstun: 24, push: 12 };
    switch (k) {
      case 'kiblast': this.projectiles.push(Object.assign(base, { vx: dir * 12, r: 20 })); this.sfx('kiblast', f); break;
      case 'fireball': this.projectiles.push(Object.assign(base, { vx: dir * 10.5, r: 28, status: { burn: 200 }, knockdown: true })); this.sfx('fire', f); break;
      case 'ice': this.projectiles.push(Object.assign(base, { x: f.x, y: 0, r: 0, life: 70, ice: true, dir, step: 0, height: 'low', status: { freeze: 200 } })); this.sfx('ice', f); break;
      case 'lightning': this.projectiles.push(Object.assign(base, { x: o.x, y: 0, r: 0, life: 52, bolt: true, unblockable: true, stun: 55 })); break;
      case 'quake': this.projectiles.push(Object.assign(base, { x: f.x + dir * 40, y: 0, vx: dir * 13, r: 0, life: 80, quake: true, unblockable: true, knockdown: true })); this.sfx('quake', f); if (!this.sim) this.cam.shake = 10; break;
      case 'shadow': f.vanish = 24; f.move = null; f.setState('idle'); this.sfx('shadow', f); if (!this.sim) this.fx.smoke(f.x, 80, 16, 36); break;
      case 'drain': this.projectiles.push(Object.assign(base, { x: f.x, y: f.y + 110 * s, life: 30, beam: true, dir, unblockable: true, drain: true, highOnly: true })); this.sfx('drain', f); break;
    }
  }

  updateProjectiles() {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.age++;
      const target = this.other(p.owner);
      if (p.ice) {
        if (p.age % 5 === 1 && p.step < 9) {
          p.step++;
          const sx = p.owner.x + p.dir * (40 + p.step * 62);
          if (!this.sim) { this.fx.burst(sx, 30, '#bfeaff', 6, 5); }
          (p.spikes = p.spikes || []).push({ x: sx, t: 0 });
          if (!p.hit && Math.abs(target.x - sx) < 40 && target.y < 80) this.projHit(p, target, sx, 40);
        }
        if (p.spikes) for (const sp of p.spikes) sp.t++;
      } else if (p.bolt) {
        if (p.age === 32) {
          this.sfx('thunder');
          if (!this.sim) { this.flashScreen = 6; this.cam.shake = 12; this.fx.burst(p.x, 0, '#fff7a8', 30, 14); }
          if (Math.abs(target.x - p.x) < 48) this.projHit(p, target, p.x, 100);
        }
      } else if (p.beam) {
        if (p.age === 2) {
          const hu = target.hurtbox();
          const x0 = p.dir > 0 ? p.x : p.x - 560, x1 = p.dir > 0 ? p.x + 560 : p.x;
          if (hu.x1 > x0 && hu.x0 < x1 && hu.y1 > p.y - 18 && hu.y0 < p.y + 18) {
            p.hitX = target.x;
            const r = this.projHit(p, target, target.x, p.y);
            if (r && r.type === 'hit') p.owner.hp = Math.min(p.owner.maxHp, p.owner.hp + r.dmg * 0.5);
          }
        }
      } else if (p.quake) {
        p.x += p.vx;
        if (!this.sim && p.age % 3 === 0) this.fx.dust(p.x, 0, 0.7);
        if (!p.hit && Math.abs(target.x - p.x) < 40 && target.y < 30) this.projHit(p, target, p.x, 20);
      } else {
        p.vy -= p.grav; p.x += p.vx; p.y += p.vy; p.rot += 0.45;
        if (p.chakram) {
          if (!p.returning) { p.vx -= p.dir0 * 0.3; if (p.vx * p.dir0 <= 2) p.returning = true; }
          else { const d = p.owner.x - p.x; p.vx = lerp(p.vx, sign(d) * 15, 0.1); p.y = lerp(p.y, p.owner.y + 115 * p.owner.scale, 0.1); if (Math.abs(d) < 30) p.dead = true; }
        }
        if (p.kind === 'fireball' && !this.sim) this.fx.flame(p.x, p.y, 2);
        const hu = target.hurtbox();
        const hit = p.x + p.r > hu.x0 && p.x - p.r < hu.x1 && p.y + p.r > hu.y0 && p.y - p.r < hu.y1;
        if (hit && p.bomb) { this.explode(p, target); continue; }
        if (hit && !target.invulnerable() && (!p.hitOnce || p.hitOnce !== (p.returning ? 2 : 1))) {
          this.projHit(p, target, p.x, p.y);
          if (p.chakram) p.hitOnce = p.returning ? 2 : 1; else p.dead = true;
        }
        if (p.bomb && (p.y <= 0 || p.dead)) this.explode(p, target);
        if (p.y < -20 || Math.abs(p.x) > RULES.arenaHalf + 200) p.dead = true;
      }
      if (p.age > p.life) p.dead = true;
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  explode(p, target) {
    p.dead = true;
    if (!this.sim) { this.fx.smoke(p.x, 20, 18, 46); this.fx.burst(p.x, 30, '#ffb060', 26, 12); this.cam.shake = 8; }
    this.sfx('hitHeavy');
    if (!p.exploded && Math.abs(target.x - p.x) < 100 && target.y < 120) { p.exploded = true; this.projHit(Object.assign({}, p, { knockdown: true }), target, target.x, 60); }
  }

  projHit(p, target, x, y) {
    if (target.invulnerable()) return null;
    if (p.highOnly && target.isCrouching() && y > 112 * target.scale && !p.beam) return null;
    if (p.beam && target.isCrouching()) return null;
    p.hit = true;
    const dir = p.vx ? sign(p.vx) : (target.x >= p.owner.x ? 1 : -1);
    const r = this.applyHit(p.owner, target, {
      dmg: p.dmg, height: p.height || 'mid', hitstun: p.hitstun, blockstun: 12, push: p.push, blockPush: 6,
      knockdown: p.knockdown, unblockable: p.unblockable, ranged: p.ranged, magic: p.magic, status: p.status, stun: p.stun,
      x, y, dir, melee: false,
    });
    if (!this.sim && r.type !== 'miss') this.sfx('projHit');
    if (this.phase === 'ko' && r.type === 'hit') this.finishKind = p.magic ? 'magic' : 'ranged';
    return r;
  }

  /* ---------- drawing ---------- */
  draw(ctx) {
    const cam = this.cam;
    ctx.save();
    this.stage.drawBack(ctx, cam);
    cam.apply(ctx);
    // shadows
    for (const f of this.fighters) {
      const k = clamp(1 - f.y / 400, 0.3, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.5 * k})`;
      ctx.beginPath(); ctx.ellipse(f.x, 0, 52 * f.scale * k, 9 * k, 0, 0, TAU); ctx.fill();
    }
    // magic under fighters (telegraphs, ground waves)
    this.drawGroundMagic(ctx);
    // fighters: the one attacking is drawn on top
    const order = this.f1.isAttacking() && !this.f2.isAttacking() ? [this.f2, this.f1] : [this.f1, this.f2];
    for (const f of order) {
      if (f.vanish > 0) continue;
      this.drawTrail(ctx, f);
      for (const c of f.chains) c.ch.draw(ctx, f.flash > 0 ? f.inkColor() : (c.ch.color || f.inkColor()));
      Render.fighter(ctx, f);
      if (f.status.burn > 0 && this.frame % 4 === 0) this.fx.flame(f.x + rand(-20, 20), f.y + rand(40, 150) * f.scale, 1);
      if (f.state === 'stunned' && this.frame % 6 === 0) this.fx.burst(f.x, f.y + 190 * f.scale, '#ffe95a', 2, 3);
    }
    this.drawProjectiles(ctx);
    this.fx.draw(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.stage.drawFront(ctx, cam);
    this.fx.drawTexts(ctx, cam);
    if (this.flashScreen > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flashScreen / 14})`; ctx.fillRect(0, 0, cam.W, cam.H); }
    ctx.restore();
  }

  drawTrail(ctx, f) {
    const T = f.trail;
    if (T.length < 2) return;
    const col = f.weaponLook && f.weaponLook.glow && f.move && f.move.kind === 'weapon' ? f.weaponLook.glow : '#ffffff';
    for (let i = 1; i < T.length; i++) {
      const a = T[i - 1], b = T[i];
      ctx.fillStyle = rgba(col, 0.08 + (i / T.length) * 0.32);
      ctx.beginPath();
      ctx.moveTo(a.base[0], a.base[1]); ctx.lineTo(a.tip[0], a.tip[1]); ctx.lineTo(b.tip[0], b.tip[1]); ctx.lineTo(b.base[0], b.base[1]);
      ctx.closePath(); ctx.fill();
    }
  }

  drawGroundMagic(ctx) {
    for (const p of this.projectiles) {
      if (p.bolt) {
        const t = p.age / 32;
        if (p.age < 32) {
          ctx.strokeStyle = `rgba(255,240,140,${0.3 + t * 0.6})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(p.x, 2, 55 * (1.2 - t * 0.3), 10, 0, 0, TAU); ctx.stroke();
        }
      }
      if (p.quake) {
        ctx.fillStyle = 'rgba(255,190,120,0.25)';
        ctx.beginPath(); ctx.ellipse(p.x, 0, 50, 14, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = INK;
        for (let i = 0; i < 4; i++) { const x = p.x - sign(p.vx) * i * 22; ctx.beginPath(); ctx.moveTo(x - 14, 0); ctx.lineTo(x, 26 + rand(10) - i * 5); ctx.lineTo(x + 14, 0); ctx.fill(); }
      }
    }
  }

  drawProjectiles(ctx) {
    for (const p of this.projectiles) {
      ctx.save();
      switch (p.kind) {
        case 'shuriken':
          ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = INK;
          ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 4 : 13; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(220,230,240,0.7)'; ctx.lineWidth = 1; ctx.stroke();
          break;
        case 'kunai':
          ctx.translate(p.x, p.y); ctx.scale(sign(p.vx), 1); ctx.fillStyle = INK;
          ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(2, 5); ctx.lineTo(2, -5); ctx.closePath(); ctx.fill(); ctx.fillRect(-14, -2, 16, 4);
          ctx.strokeStyle = 'rgba(220,230,240,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(3, 4); ctx.stroke();
          break;
        case 'axe':
          ctx.translate(p.x, p.y); ctx.rotate(-p.rot * sign(p.vx)); ctx.fillStyle = INK;
          ctx.fillRect(-16, -2.5, 32, 5); ctx.beginPath(); ctx.moveTo(8, 0); ctx.quadraticCurveTo(14, 18, 24, 16); ctx.lineTo(18, 0); ctx.fill();
          break;
        case 'chakram':
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(220,230,240,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU * 0.7); ctx.stroke();
          break;
        case 'bomb':
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(p.x + 6, p.y + 12, 3 + Math.random() * 2, 0, TAU); ctx.fill();
          break;
        case 'kiblast': case 'fireball': {
          const col = p.kind === 'fireball' ? ['#fff4c0', '#ff8a2a', 'rgba(255,60,0,0)'] : ['#ffffff', '#9fd8ff', 'rgba(80,140,255,0)'];
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.8);
          g.addColorStop(0, col[0]); g.addColorStop(0.35, col[1]); g.addColorStop(1, col[2]);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.8, 0, TAU); ctx.fill();
          break;
        }
        case 'ice':
          if (p.spikes) for (const sp of p.spikes) {
            const h = Math.min(1, sp.t / 4) * (1 - Math.max(0, sp.t - 25) / 20) * 90;
            if (h <= 0) continue;
            ctx.fillStyle = 'rgba(190,235,255,0.85)';
            ctx.beginPath(); ctx.moveTo(sp.x - 18, 0); ctx.lineTo(sp.x - 4, h); ctx.lineTo(sp.x + 2, h * 0.7); ctx.lineTo(sp.x + 16, 0); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
          }
          break;
        case 'lightning':
          if (p.age >= 32 && p.age < 44) {
            ctx.strokeStyle = '#fffbe0'; ctx.shadowColor = '#ffe95a'; ctx.shadowBlur = 20; ctx.lineWidth = 5;
            ctx.beginPath(); let x = p.x, y = 900; ctx.moveTo(x, y);
            while (y > 0) { y -= rand(40, 90); x = p.x + rand(-30, 30); ctx.lineTo(x, Math.max(0, y)); }
            ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
          }
          break;
        case 'drain':
          if (p.age < 26) {
            const a = 1 - p.age / 26, x1 = p.x + p.dir * (p.hitX !== undefined ? Math.abs(p.hitX - p.x) : 560);
            ctx.strokeStyle = `rgba(200,60,255,${a})`; ctx.shadowColor = '#c04bff'; ctx.shadowBlur = 18; ctx.lineWidth = 10 * a + 2;
            ctx.beginPath(); ctx.moveTo(p.x, p.y);
            for (let i = 1; i <= 12; i++) { const t = i / 12; ctx.lineTo(lerp(p.x, x1, t), p.y + Math.sin(t * 20 + p.age) * 8 * a); }
            ctx.stroke();
          }
          break;
      }
      ctx.restore();
    }
  }
}
