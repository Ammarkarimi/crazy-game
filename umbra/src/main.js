'use strict';
/* Boot, main loop, match lifecycle and rewards. */

const Game = {
  canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
  match: null, paused: false, lastSetup: null,
  menuStage: null, menuFighter: null, menuCam: null,
  acc: 0, last: 0,
  padPrev: {},

  init() {
    Save.load();
    this.canvas = $('game');
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize', () => this.resize());
    this.resize();
    Input.init();
    UI.init();
    this.menuStage = new Stage(STAGES[randi(0, STAGES.length - 1)]);
    this.menuCam = new Camera();
    this.refreshMenuFighter();
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.inMatch()) this.pause(); });
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch-on');
    window.addEventListener('touchstart', () => document.body.classList.add('touch-on'), { passive: true });
    $('tPause').addEventListener('click', () => this.togglePause());
    requestAnimationFrame(t => this.loop(t));
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.round(window.innerWidth * this.dpr);
    this.H = Math.round(window.innerHeight * this.dpr);
    this.canvas.width = this.W; this.canvas.height = this.H;
    if (this.match) this.match.cam.resize(this.W, this.H);
    if (this.menuCam) this.menuCam.resize(this.W, this.H);
  },

  boot() {
    Sound.unlock();
    Music.start('menu');
    UI.history = [];
    if (!Save.data.seen.howto) { Save.data.seen.howto = true; Save.save(); UI.show('title', false); UI.show('howto'); }
    else UI.show('title', false);
  },

  inMatch() { return !!this.match && !this.paused && !this.match.done; },

  refreshMenuFighter() {
    const id = Save.data.fighter;
    this.menuFighter = new Fighter({ fighter: id, gear: Save.gearFor(id), isPlayer: true });
    this.menuFighter.resetRound(0, -1);
    this.menuFighter.setState('idle');
    this.menuFighter.pose = Object.assign({}, CLASS_STANCE[this.menuFighter.cls]);
    this.menuT = 0;
    if (UI.current === 'title') UI.buildTitle();
  },

  /* ---------- starting matches ---------- */
  stageFor(idx) { return idx >= 0 ? STAGES[idx] : pick(STAGES); },

  startDuel(rivalId, rounds, stageIdx) {
    const o = OPPONENT[rivalId];
    const fid = Save.data.fighter;
    this.lastSetup = { kind: 'duel', rivalId, rounds, stageIdx };
    this.begin(new Match({
      mode: 'duel', rounds,
      stage: this.stageFor(stageIdx),
      p1: { fighter: fid, gear: Save.gearFor(fid), isPlayer: true, name: FIGHTERS.find(f => f.id === fid).name },
      p2: { fighter: o.fighter, gear: o.gear, name: o.name },
      brain2: new Brain(o.tier, o.style),
      onEnd: r => this.onDuelEnd(r, o),
    }), TIER[o.tier].index >= 5 ? 'boss' : 'fight');
  },

  startVersus(vs) {
    this.lastSetup = { kind: 'versus', vs: Object.assign({}, vs) };
    const a = FIGHTERS[vs.a], b = FIGHTERS[vs.b];
    this.begin(new Match({
      mode: 'versus', rounds: vs.rounds, versusLabels: true,
      stage: this.stageFor(vs.stage),
      p1: { fighter: a.id, gear: UI.vsGear(a), isPlayer: true, name: 'P1 ' + a.name },
      p2: { fighter: b.id, gear: UI.vsGear(b), isPlayer: true, name: 'P2 ' + b.name },
      onEnd: r => this.onVersusEnd(r),
    }), 'fight');
    Honors.unlock('versus');
  },

  startTraining() {
    this.lastSetup = { kind: 'training' };
    const fid = Save.data.fighter;
    const m = new Match({
      mode: 'training', rounds: 1, stage: STAGES[0],
      p1: { fighter: fid, gear: Save.gearFor(fid), isPlayer: true, name: FIGHTERS.find(f => f.id === fid).name },
      p2: { fighter: 'kage', gear: UI.starterGear(FIGHTERS[0]), name: 'Dummy' },
    });
    m.dummyMode = 'stand';
    m.brain2 = new DummyBrain('stand');
    m.trainingMeter = true;
    this.begin(m, 'menu');
  },

  cycleDummy() {
    const modes = ['stand', 'block', 'crouch', 'jump', 'attack'];
    const m = this.match;
    m.dummyMode = modes[(modes.indexOf(m.dummyMode) + 1) % modes.length];
    m.brain2 = new DummyBrain(m.dummyMode);
    Sound.play('select');
  },

  begin(match, track) {
    this.match = match;
    match.cam.resize(this.W, this.H);
    match.cam.follow(match.f1, match.f2, true);
    this.paused = false;
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
    $('wallet').hidden = true;
    UI.current = 'match';
    document.body.classList.add('in-match');
    Music.intensity = 0.4;
    Music.start(track, randi(-2, 2));
    Sound.setMuffle(false);
  },

  rematch() {
    const s = this.lastSetup;
    if (!s) return UI.home();
    if (s.kind === 'duel') this.startDuel(s.rivalId, s.rounds, s.stageIdx);
    else if (s.kind === 'versus') this.startVersus(s.vs);
    else this.startTraining();
  },

  pause() {
    if (!this.match || this.match.done) return;
    this.paused = true;
    Sound.setMuffle(true);
    UI.history = [];
    UI.show('pause', false);
  },
  resume() {
    this.paused = false;
    Sound.setMuffle(false);
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
    UI.current = 'match';
  },
  togglePause() { if (!this.match) return; if (this.paused) this.resume(); else this.pause(); },

  quitMatch() { this.toMenu(); UI.home(); },

  toMenu() {
    this.match = null; this.paused = false;
    document.body.classList.remove('in-match');
    Sound.setMuffle(false);
    Music.start('menu');
    this.refreshMenuFighter();
  },

  /* ---------- rewards ---------- */
  onDuelEnd(r, o) {
    const d = Save.data, t = TIER[o.tier], rec = Save.record(o.id);
    const won = r.winner === 1;
    let coins = 0, gems = 0, firstWin = false;
    const perfects = r.rounds.filter(x => x.winner === 1 && x.perfect).length;
    if (won) {
      coins = t.reward + perfects * Math.round(t.reward * 0.15);
      if (!rec.wins) { gems += t.gems; firstWin = true; }
      gems += Math.max(0, t.index - 3); // expert+ rivals always drop a few gems
      gems += perfects;
      rec.wins++; d.stats.wins++;
    } else {
      coins = Math.round(t.reward * 0.35);
      rec.losses++; d.stats.losses++;
    }
    d.coins += coins; d.gems += gems;
    d.stats.matches++;
    d.stats.parries += r.f1.stats.parries;
    d.stats.bestCombo = Math.max(d.stats.bestCombo, r.f1.stats.maxCombo);
    d.stats.perfects += perfects;
    Save.save();
    // honors
    if (won) Honors.unlock('firstWin');
    if (perfects) Honors.unlock('perfect');
    if (r.f1.stats.maxCombo >= 5) Honors.unlock('combo5');
    if (r.f1.stats.maxCombo >= 7) Honors.unlock('combo10');
    if (d.stats.parries >= 10) Honors.unlock('parry10');
    if (won && t.index >= 3) Honors.unlock('beatHard');
    if (won && t.index >= 4) Honors.unlock('beatExpert');
    if (won && t.index >= 5) Honors.unlock('beatMaster');
    if (won && t.index >= 6) Honors.unlock('beatLegend');
    if (OPPONENTS.every(x => Save.record(x.id).wins > 0)) Honors.unlock('beatAll');
    for (const x of r.rounds) {
      if (x.winner === 1 && x.finish === 'magic') Honors.unlock('magicKo');
      if (x.winner === 1 && x.finish === 'ranged') Honors.unlock('rangedKo');
      if (x.winner === 1 && x.hpLeft !== undefined && x.hpLeft < 0.1) Honors.unlock('comeback');
    }
    if (d.coins >= 10000) Honors.unlock('rich');
    Music.start('win');
    const score = [r.f1.roundsWon, r.f2.roundsWon];
    UI.showResults({ won, winner: r.winner, rival: o, coins, gems, firstWin, score, stats: r.f1.stats });
    Sound.play(won ? 'buy' : 'back');
  },

  onVersusEnd(r) {
    Music.start('win');
    UI.showResults({ versus: true, winner: r.winner, score: [r.f1.roundsWon, r.f2.roundsWon], names: [r.f1.name, r.f2.name] });
  },

  toggleFullscreen() {
    if (window.umbraDesktop) { window.umbraDesktop.toggleFullscreen(); return; }
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen && document.exitFullscreen();
  },

  /* ---------- gamepad menu navigation ---------- */
  pollMenuPad() {
    const pads = Input.pads();
    if (!pads.length) return;
    const p = pads[0];
    const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const now = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, a: b(0), b: b(1), start: b(9) };
    const edge = k => now[k] && !this.padPrev[k];
    if (this.inMatch()) { if (edge('start')) this.togglePause(); this.padPrev = now; return; }
    if (edge('up')) UI.nav(0, -1); if (edge('down')) UI.nav(0, 1);
    if (edge('left')) UI.nav(-1, 0); if (edge('right')) UI.nav(1, 0);
    if (edge('a')) { if (UI.current === 'boot') UI.act('boot'); else UI.activate(); }
    if (edge('b')) { if (this.paused) this.resume(); else if (!['title', 'boot', 'results'].includes(UI.current)) UI.back(); }
    if (edge('start') && this.paused) this.resume();
    this.padPrev = now;
  },

  /* ---------- loop ---------- */
  loop(t) {
    requestAnimationFrame(tt => this.loop(tt));
    const dt = Math.min(0.1, (t - (this.last || t)) / 1000);
    this.last = t;
    this.pollMenuPad();
    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < 5) {
      this.acc -= DT; steps++;
      this.step();
    }
    if (steps === 5) this.acc = 0;
    this.render();
  },

  step() {
    const m = this.match;
    if (m) {
      if (this.paused) return;
      const [c1, c2] = Input.poll(m.mode === 'versus' ? 'versus' : 'solo');
      m.update(c1, c2);
      // music intensity follows the danger
      const low = Math.min(m.f1.hp / m.f1.maxHp, m.f2.hp / m.f2.maxHp);
      Music.intensity = clamp(0.4 + (m.round - 1) * 0.15 + (1 - low) * 0.4, 0, 1);
    } else {
      const f = this.menuFighter;
      this.menuT++;
      const c = newController();
      if (f.state === 'idle' && this.menuT % 240 === 120) f.startMove(pick(['light1', 'heavy', 'rising', 'sidekick']), PREVIEW_STUB);
      if (f.state === 'attack' && f.move.chain && this.menuT % 2 === 0 && chance(0.2)) c.p.attack = true;
      f.update(c, { x: -1000, y: 0 }, PREVIEW_STUB);
      f.x = 0; f.vx = 0;
      f.updateChains(0.12);
    }
    UI.tickPreviewsStep = true;
  },

  render() {
    const ctx = this.ctx;
    if (this.match) {
      this.match.draw(ctx);
      HUD.draw(ctx, this.match);
    } else {
      const cam = this.menuCam;
      cam.resize(this.W, this.H);
      const narrow = this.W < this.H * 1.1;
      cam.z = (this.H / 620);
      cam.x = narrow ? 0 : -(this.W / cam.z) * 0.2 + Math.sin(performance.now() / 9000) * 30;
      cam.sx = cam.sy = 0;
      this.menuStage.drawBack(ctx, cam);
      cam.apply(ctx);
      const f = this.menuFighter;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(f.x, 0, 60, 10, 0, 0, TAU); ctx.fill();
      Match.prototype.drawTrail.call({}, ctx, f);
      for (const c of f.chains) c.ch.draw(ctx, c.ch.color || f.inkColor());
      Render.fighter(ctx, f);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.menuStage.drawFront(ctx, cam);
    }
    if (UI.tickPreviewsStep) { UI.tickPreviewsStep = false; UI.tickPreviews(); }
  },
};

window.addEventListener('load', () => Game.init());
