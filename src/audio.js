'use strict';
/* ==========================================================================
   Procedural audio: every sound effect and the whole soundtrack are
   synthesised at runtime with the Web Audio API. No asset files needed.
   ========================================================================== */

const Sound = {
  ctx: null,
  master: null,
  music: null,
  musicFilter: null,
  sfx: null,
  delay: null,
  noiseBuf: null,
  last: {},

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;

    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(c.destination);

    this.master = c.createGain();
    this.master.connect(comp);

    this.musicFilter = c.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicFilter.Q.value = 0.8;
    this.musicFilter.connect(this.master);

    this.music = c.createGain();
    this.music.connect(this.musicFilter);

    this.sfx = c.createGain();
    this.sfx.connect(this.master);

    // Tempo-synced feedback delay used by the arpeggio for that synthwave shimmer
    this.delay = c.createDelay(1.5);
    this.delay.delayTime.value = 0.36;
    const fb = c.createGain(); fb.gain.value = 0.38;
    const wet = c.createGain(); wet.gain.value = 0.4;
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
    this.delay.connect(dlp); dlp.connect(fb); fb.connect(this.delay);
    dlp.connect(wet); wet.connect(this.music);

    const len = c.sampleRate * 1.5;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.applyVolumes();
  },

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  applyVolumes() {
    if (!this.ctx) return;
    const s = Save.data.settings;
    this.master.gain.value = s.master;
    this.music.gain.value = s.music * 0.55;
    this.sfx.gain.value = s.sfx * 0.9;
  },

  setMuffle(on) {
    if (!this.ctx) return;
    const f = this.musicFilter.frequency;
    f.cancelScheduledValues(this.ctx.currentTime);
    f.setTargetAtTime(on ? 700 : 18000, this.ctx.currentTime, 0.12);
  },

  /* ---- primitives ---- */
  tone(o, dest, at) {
    const c = this.ctx;
    const t = (at || c.currentTime) + (o.delay || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + (o.slide || o.dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    const v = o.vol === undefined ? 0.2 : o.vol;
    const a = Math.min(o.attack || 0.004, o.dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a);
    if (o.sustain) g.gain.setValueAtTime(Math.max(0.0002, v), t + o.dur * o.sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filterType || 'lowpass';
      f.frequency.setValueAtTime(o.filter, t);
      if (o.filterEnd) f.frequency.exponentialRampToValueAtTime(o.filterEnd, t + o.dur);
      f.Q.value = o.q || 1;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest || this.sfx);
    if (o.send) g.connect(o.send);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  },

  noise(o, dest, at) {
    const c = this.ctx;
    const t = (at || c.currentTime) + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.filterType || 'lowpass';
    f.frequency.setValueAtTime(o.filter || 3000, t);
    if (o.filterEnd) f.frequency.exponentialRampToValueAtTime(o.filterEnd, t + o.dur);
    f.Q.value = o.q || 0.8;
    const g = c.createGain();
    const v = o.vol === undefined ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + Math.min(o.attack || 0.003, o.dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfx);
    src.start(t, Math.random() * 1.0);
    src.stop(t + o.dur + 0.05);
  },

  play(name, p) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const def = SFX[name];
    if (!def) return;
    const now = performance.now();
    if (def.gap && this.last[name] && now - this.last[name] < def.gap) return;
    this.last[name] = now;
    try { def.fn(this, p === undefined ? 1 : p); } catch (e) { /* never let audio crash the game */ }
  },
};

const SFX = {
  shoot: { gap: 45, fn: (s) => s.tone({ type: 'square', freq: frand(820, 980), freqEnd: 300, dur: 0.07, vol: 0.045, filter: 3500 }) },
  enemyShoot: { gap: 60, fn: (s) => s.tone({ type: 'sine', freq: 620, freqEnd: 260, dur: 0.1, vol: 0.05 }) },
  hit: { gap: 28, fn: (s) => { s.tone({ type: 'triangle', freq: frand(260, 340), freqEnd: 90, dur: 0.06, vol: 0.09 }); } },
  crit: { gap: 50, fn: (s) => { s.tone({ type: 'square', freq: 1400, freqEnd: 500, dur: 0.06, vol: 0.05 }); } },
  kill: {
    gap: 30, fn: (s, p) => {
      s.noise({ dur: 0.22, vol: 0.22, filter: 2400, filterEnd: 200 });
      s.tone({ type: 'sine', freq: 160 * p, freqEnd: 40, dur: 0.2, vol: 0.18 });
    },
  },
  bigBoom: {
    gap: 80, fn: (s) => {
      s.noise({ dur: 0.9, vol: 0.5, filter: 3000, filterEnd: 80 });
      s.tone({ type: 'sine', freq: 110, freqEnd: 25, dur: 0.8, vol: 0.45 });
      s.tone({ type: 'sawtooth', freq: 80, freqEnd: 30, dur: 0.5, vol: 0.12, filter: 500 });
    },
  },
  pickup: { gap: 22, fn: (s, p) => s.tone({ type: 'sine', freq: 700 + Math.min(p, 40) * 25, freqEnd: 1500 + Math.min(p, 40) * 25, dur: 0.07, vol: 0.05 }) },
  shard: { gap: 40, fn: (s) => { s.tone({ type: 'triangle', freq: 1320, dur: 0.08, vol: 0.08 }); s.tone({ type: 'triangle', freq: 1980, dur: 0.12, vol: 0.07, delay: 0.06 }); } },
  heal: { gap: 100, fn: (s) => { [523, 659, 784].forEach((f, i) => s.tone({ type: 'sine', freq: f, dur: 0.18, vol: 0.09, delay: i * 0.05 })); } },
  levelUp: {
    gap: 200, fn: (s) => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => s.tone({ type: 'square', freq: f, dur: 0.16, vol: 0.06, delay: i * 0.055, filter: 4000 }));
      s.tone({ type: 'sawtooth', freq: 262, freqEnd: 524, dur: 0.4, vol: 0.05, filter: 2000 });
    },
  },
  select: { gap: 60, fn: (s) => { s.tone({ type: 'square', freq: 660, dur: 0.06, vol: 0.06, filter: 3000 }); s.tone({ type: 'square', freq: 990, dur: 0.1, vol: 0.06, delay: 0.05, filter: 3000 }); } },
  hover: { gap: 40, fn: (s) => s.tone({ type: 'sine', freq: 1200, dur: 0.035, vol: 0.03 }) },
  back: { gap: 60, fn: (s) => s.tone({ type: 'square', freq: 500, freqEnd: 300, dur: 0.08, vol: 0.05, filter: 2000 }) },
  deny: { gap: 120, fn: (s) => { s.tone({ type: 'square', freq: 150, dur: 0.14, vol: 0.07, filter: 900 }); s.tone({ type: 'square', freq: 120, dur: 0.16, vol: 0.07, delay: 0.1, filter: 900 }); } },
  buy: { gap: 80, fn: (s) => { [880, 1175, 1760].forEach((f, i) => s.tone({ type: 'triangle', freq: f, dur: 0.12, vol: 0.08, delay: i * 0.05 })); } },
  hurt: {
    gap: 120, fn: (s) => {
      s.tone({ type: 'sawtooth', freq: 240, freqEnd: 50, dur: 0.3, vol: 0.2, filter: 1600 });
      s.noise({ dur: 0.2, vol: 0.25, filter: 1500, filterEnd: 300 });
    },
  },
  dash: { gap: 80, fn: (s) => s.noise({ dur: 0.2, vol: 0.18, filter: 400, filterEnd: 4000, filterType: 'bandpass', q: 2 }) },
  overdrive: {
    gap: 300, fn: (s) => {
      s.tone({ type: 'sawtooth', freq: 110, freqEnd: 880, dur: 0.8, vol: 0.18, filter: 600, filterEnd: 6000, slide: 0.7 });
      s.tone({ type: 'sawtooth', freq: 111, freqEnd: 885, dur: 0.8, vol: 0.12, detune: 12, slide: 0.7 });
      s.noise({ dur: 1.0, vol: 0.3, filter: 200, filterEnd: 8000, filterType: 'bandpass', q: 1.5 });
      s.tone({ type: 'sine', freq: 70, freqEnd: 30, dur: 0.9, vol: 0.4 });
    },
  },
  ready: { gap: 500, fn: (s) => { [784, 988, 1175].forEach((f, i) => s.tone({ type: 'triangle', freq: f, dur: 0.15, vol: 0.08, delay: i * 0.07 })); } },
  waveStart: { gap: 300, fn: (s) => { s.tone({ type: 'sawtooth', freq: 220, freqEnd: 440, dur: 0.5, vol: 0.08, filter: 1800 }); s.tone({ type: 'square', freq: 880, dur: 0.25, vol: 0.05, delay: 0.3, filter: 3000 }); } },
  waveClear: { gap: 300, fn: (s) => { [523, 784, 1047, 1568].forEach((f, i) => s.tone({ type: 'triangle', freq: f, dur: 0.25, vol: 0.08, delay: i * 0.08 })); } },
  event: {
    gap: 300, fn: (s) => {
      for (let i = 0; i < 6; i++) s.tone({ type: 'square', freq: i % 2 ? 1400 : 700, dur: 0.07, vol: 0.05, delay: i * 0.07, filter: 3000 });
      s.tone({ type: 'sawtooth', freq: 55, freqEnd: 220, dur: 0.6, vol: 0.12, filter: 900 });
    },
  },
  warning: {
    gap: 900, fn: (s) => {
      for (let i = 0; i < 3; i++) {
        s.tone({ type: 'sawtooth', freq: 300, freqEnd: 600, dur: 0.35, vol: 0.12, delay: i * 0.42, filter: 1500, slide: 0.3 });
      }
    },
  },
  bossHit: { gap: 70, fn: (s) => s.tone({ type: 'square', freq: 120, freqEnd: 70, dur: 0.07, vol: 0.06, filter: 800 }) },
  laserCharge: { gap: 150, fn: (s) => s.tone({ type: 'sawtooth', freq: 200, freqEnd: 1200, dur: 0.6, vol: 0.06, filter: 2000, slide: 0.6 }) },
  laserFire: { gap: 150, fn: (s) => { s.noise({ dur: 0.5, vol: 0.2, filter: 1200, filterType: 'bandpass', q: 3 }); s.tone({ type: 'sawtooth', freq: 90, dur: 0.5, vol: 0.12, filter: 700 }); } },
  meteor: { gap: 120, fn: (s) => { s.noise({ dur: 0.6, vol: 0.35, filter: 1500, filterEnd: 60 }); s.tone({ type: 'sine', freq: 90, freqEnd: 30, dur: 0.5, vol: 0.3 }); } },
  zap: { gap: 50, fn: (s) => s.noise({ dur: 0.12, vol: 0.14, filter: 5000, filterEnd: 1500, filterType: 'highpass' }) },
  teleport: { gap: 80, fn: (s) => s.tone({ type: 'sine', freq: 300, freqEnd: 2000, dur: 0.15, vol: 0.06 }) },
  fuse: { gap: 150, fn: (s) => s.tone({ type: 'square', freq: 1500, dur: 0.05, vol: 0.04 }) },
  revive: {
    gap: 500, fn: (s) => {
      [262, 330, 392, 523, 659, 784].forEach((f, i) => s.tone({ type: 'sawtooth', freq: f, dur: 0.3, vol: 0.06, delay: i * 0.06, filter: 3000 }));
    },
  },
  gameOver: {
    gap: 500, fn: (s) => {
      [392, 330, 262, 196].forEach((f, i) => s.tone({ type: 'sawtooth', freq: f, freqEnd: f * 0.97, dur: 0.5, vol: 0.09, delay: i * 0.28, filter: 1400 }));
    },
  },
  victory: {
    gap: 500, fn: (s) => {
      const n = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      n.forEach((f, i) => s.tone({ type: 'square', freq: f, dur: 0.22, vol: 0.06, delay: i * 0.11, filter: 4000 }));
    },
  },
  achievement: { gap: 300, fn: (s) => { [1047, 1319, 1568, 2093].forEach((f, i) => s.tone({ type: 'triangle', freq: f, dur: 0.2, vol: 0.07, delay: i * 0.06 })); } },
};

/* ---------------------------------------------------------------------------
   Step sequencer soundtrack. Three moods: menu, game (intensity-reactive)
   and boss. Notes are MIDI numbers.
   ------------------------------------------------------------------------- */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const TRACKS = {
  menu: {
    bpm: 92,
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]],
    bass: [33, 29, 36, 31],
  },
  game: {
    bpm: 124,
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    bass: [33, 29, 36, 31],
  },
  game2: {
    bpm: 128,
    chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
    bass: [38, 34, 36, 33],
  },
  boss: {
    bpm: 146,
    chords: [[50, 53, 57], [51, 55, 58], [50, 53, 57], [49, 52, 56]],
    bass: [38, 39, 38, 37],
  },
};

const Music = {
  track: null,
  playing: false,
  step: 0,
  nextTime: 0,
  timer: null,
  intensity: 0.3,

  start(name) {
    if (!Sound.ctx) return;
    if (this.track === name && this.playing) return;
    this.track = name;
    this.step = 0;
    this.nextTime = Sound.ctx.currentTime + 0.08;
    this.playing = true;
    const tr = TRACKS[name];
    Sound.delay.delayTime.setTargetAtTime((60 / tr.bpm) * 0.75, Sound.ctx.currentTime, 0.05);
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  },

  stop() { this.playing = false; this.track = null; },

  tick() {
    if (!this.playing || !Sound.ctx || Sound.ctx.state !== 'running') return;
    const tr = TRACKS[this.track];
    const stepDur = 60 / tr.bpm / 4;
    // If the tab was throttled, skip ahead rather than spamming notes
    if (this.nextTime < Sound.ctx.currentTime - 0.3) this.nextTime = Sound.ctx.currentTime + 0.05;
    while (this.nextTime < Sound.ctx.currentTime + 0.14) {
      try { this.playStep(tr, this.step, this.nextTime, stepDur); } catch (e) { /* ignore */ }
      this.nextTime += stepDur;
      this.step++;
    }
  },

  kick(t, v = 0.9) {
    Sound.tone({ type: 'sine', freq: 150, freqEnd: 42, slide: 0.12, dur: 0.32, vol: v, attack: 0.002 }, Sound.music, t);
  },
  snare(t, v = 0.32) {
    Sound.noise({ dur: 0.17, vol: v, filter: 1800, filterType: 'highpass' }, Sound.music, t);
    Sound.tone({ type: 'triangle', freq: 200, freqEnd: 120, dur: 0.1, vol: v * 0.6 }, Sound.music, t);
  },
  hat(t, v = 0.08, open) {
    Sound.noise({ dur: open ? 0.18 : 0.04, vol: v, filter: 7500, filterType: 'highpass' }, Sound.music, t);
  },
  bass(t, m, dur, v = 0.2) {
    Sound.tone({ type: 'sawtooth', freq: mtof(m), dur: dur, vol: v, filter: 380, filterEnd: 900, q: 6, attack: 0.005 }, Sound.music, t);
    Sound.tone({ type: 'square', freq: mtof(m - 12), dur: dur, vol: v * 0.5, filter: 300 }, Sound.music, t);
  },
  arp(t, m, dur, v = 0.045) {
    Sound.tone({ type: 'square', freq: mtof(m), dur: dur, vol: v, filter: 2600, q: 2, send: Sound.delay }, Sound.music, t);
  },
  pad(t, chord, dur, v = 0.025) {
    for (const m of chord) {
      Sound.tone({ type: 'sawtooth', freq: mtof(m), dur, vol: v, attack: dur * 0.3, sustain: 0.7, filter: 1100, detune: -8 }, Sound.music, t);
      Sound.tone({ type: 'sawtooth', freq: mtof(m), dur, vol: v, attack: dur * 0.3, sustain: 0.7, filter: 1100, detune: 8 }, Sound.music, t);
    }
  },
  lead(t, m, dur, v = 0.04) {
    Sound.tone({ type: 'sawtooth', freq: mtof(m), dur, vol: v, filter: 3000, attack: 0.02, sustain: 0.6, send: Sound.delay }, Sound.music, t);
  },

  playStep(tr, s, t, sd) {
    const bar = Math.floor(s / 16) % tr.chords.length;
    const st = s % 16;
    const chord = tr.chords[bar];
    const root = tr.bass[bar];
    const I = this.intensity;

    if (this.track === 'menu') {
      if (st === 0) this.pad(t, chord, sd * 16, 0.022);
      if (st % 2 === 0) {
        const idx = [0, 1, 2, 3, 2, 1, 0, 2][(st / 2) % 8];
        this.arp(t, chord[idx % chord.length] + 12, sd * 1.6, 0.03);
      }
      if (st === 0 || st === 10) this.bass(t, root, sd * 5, 0.12);
      if (st === 0 && Math.floor(s / 16) % 2 === 1) this.kick(t, 0.5);
      if (st % 4 === 2) this.hat(t, 0.035);
      return;
    }

    if (this.track === 'boss') {
      if (st % 4 === 0) this.kick(t, 0.95);
      if (st === 4 || st === 12) this.snare(t, 0.36);
      if (st === 14 && bar === 3) this.snare(t + sd * 0.5, 0.25);
      this.hat(t, st % 2 ? 0.05 : 0.09);
      this.bass(t, root + (st % 4 === 2 ? 12 : 0), sd * 0.9, 0.17);
      const arpSeq = [0, 1, 2, 1, 0, 2, 1, 2];
      this.arp(t, chord[arpSeq[st % 8] % chord.length] + 24, sd * 0.9, 0.035);
      if (st === 0) this.pad(t, chord, sd * 16, 0.016);
      if (st === 0 && bar % 2 === 0) this.lead(t, chord[2] + 12, sd * 6, 0.03);
      if (st === 8 && bar % 2 === 1) this.lead(t, chord[0] + 24, sd * 6, 0.03);
      return;
    }

    // In-game track: layers fade in with intensity
    if (st % 4 === 0) this.kick(t, 0.85);
    if (st % 4 === 2) this.hat(t, 0.07, I > 0.75 && st === 14);
    if (I > 0.35 && st % 2 === 1) this.hat(t, 0.03);
    if (I > 0.45 && (st === 4 || st === 12)) this.snare(t, 0.3);
    const oct = st % 2 === 1 ? 12 : 0;
    this.bass(t, root + oct, sd * 0.85, 0.15);
    if (st === 0) this.pad(t, chord, sd * 16, 0.016 + I * 0.008);
    if (I > 0.25) {
      const pattern = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3];
      const idx = pattern[st];
      const note = chord[idx % chord.length] + 12 * (1 + Math.floor(idx / chord.length));
      this.arp(t, note + 12, sd * 0.8, 0.028 + I * 0.012);
    }
    if (I > 0.8 && st % 8 === 0) this.lead(t, chord[(st / 8 + bar) % chord.length] + 24, sd * 7, 0.025);
  },
};
