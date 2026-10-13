'use strict';
/* Procedural audio. Every sound and the soundtrack (taiko, koto, flute) is synthesised
   with the Web Audio API, so the game ships with no audio files. */

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const Sound = {
  ctx: null, master: null, music: null, sfx: null, verb: null, noiseBuf: null, musicFilter: null,
  last: {},

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
    comp.connect(c.destination);
    this.master = c.createGain(); this.master.connect(comp);
    this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 18000;
    this.musicFilter.connect(this.master);
    this.music = c.createGain(); this.music.connect(this.musicFilter);
    this.sfx = c.createGain(); this.sfx.connect(this.master);

    // Small hall reverb from a generated impulse
    const len = Math.floor(c.sampleRate * 2.2);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.verb = c.createConvolver(); this.verb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.32;
    this.verb.connect(wet); wet.connect(this.master);

    const nl = c.sampleRate * 1.5;
    this.noiseBuf = c.createBuffer(1, nl, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  },

  unlock() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  applyVolumes() {
    if (!this.ctx) return;
    const s = Save.data.settings;
    this.master.gain.value = s.master;
    this.music.gain.value = s.music * 0.6;
    this.sfx.gain.value = s.sfx;
  },

  setMuffle(on) {
    if (!this.ctx) return;
    const f = this.musicFilter.frequency;
    f.cancelScheduledValues(this.ctx.currentTime);
    f.setTargetAtTime(on ? 650 : 18000, this.ctx.currentTime, 0.12);
  },

  tone(o, dest, at) {
    const c = this.ctx;
    const t = (at || c.currentTime) + (o.delay || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + (o.slide || o.dur));
    if (o.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o.vib; lg.gain.value = o.vibDepth || 4;
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + o.dur + 0.05);
    }
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
      osc.connect(f); node = f;
    }
    node.connect(g);
    g.connect(dest || this.sfx);
    if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(this.verb); }
    osc.start(t); osc.stop(t + o.dur + 0.05);
  },

  noise(o, dest, at) {
    const c = this.ctx;
    const t = (at || c.currentTime) + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
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
    if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(this.verb); }
    src.start(t, Math.random()); src.stop(t + o.dur + 0.05);
  },

  metal(freq, dur, vol, at) {
    for (const [r, v] of [[1, 1], [2.76, 0.6], [5.4, 0.35], [8.9, 0.2]]) {
      this.tone({ type: 'sine', freq: freq * r * rand(0.99, 1.01), dur: dur / Math.sqrt(r), vol: vol * v, attack: 0.001, verb: 0.4 }, null, at);
    }
  },

  play(name, p) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const def = SFX[name];
    if (!def) return;
    const now = performance.now();
    if (def.gap && this.last[name] && now - this.last[name] < def.gap) return;
    this.last[name] = now;
    try { def.fn(this, p === undefined ? 1 : p); } catch (e) { /* audio must never crash the game */ }
  },
};

const SFX = {
  swing: { gap: 30, fn: s => s.noise({ dur: 0.16, vol: 0.22, filter: rand(700, 900), filterEnd: 3200, filterType: 'bandpass', q: 3 }) },
  swingHeavy: { gap: 40, fn: s => { s.noise({ dur: 0.3, vol: 0.32, filter: 350, filterEnd: 1800, filterType: 'bandpass', q: 2.5 }); s.tone({ type: 'sine', freq: 120, freqEnd: 60, dur: 0.25, vol: 0.12 }); } },
  kick: { gap: 30, fn: s => s.noise({ dur: 0.12, vol: 0.18, filter: 500, filterEnd: 2200, filterType: 'bandpass', q: 2 }) },
  hit: { gap: 25, fn: (s, p) => {
    s.tone({ type: 'sine', freq: 140, freqEnd: 45, dur: 0.14, vol: 0.55 * p, attack: 0.001 });
    s.noise({ dur: 0.07, vol: 0.4 * p, filter: 2400, filterType: 'lowpass' });
    s.noise({ dur: 0.04, vol: 0.18 * p, filter: 3500, filterType: 'highpass' });
  } },
  hitHeavy: { gap: 30, fn: (s, p) => {
    s.tone({ type: 'sine', freq: 110, freqEnd: 32, dur: 0.32, vol: 0.75 * p, attack: 0.001 });
    s.noise({ dur: 0.18, vol: 0.5 * p, filter: 1600, filterEnd: 200 });
    s.noise({ dur: 0.06, vol: 0.25 * p, filter: 4000, filterType: 'highpass', verb: 0.3 });
  } },
  block: { gap: 25, fn: s => { s.metal(rand(780, 980), 0.35, 0.09); s.noise({ dur: 0.05, vol: 0.25, filter: 5000, filterType: 'highpass' }); } },
  parry: { gap: 40, fn: s => { s.metal(1400, 0.9, 0.12); s.tone({ type: 'sine', freq: 2600, freqEnd: 3200, dur: 0.5, vol: 0.05, verb: 0.6 }); } },
  guardBreak: { gap: 60, fn: s => { s.metal(520, 0.8, 0.14); s.noise({ dur: 0.35, vol: 0.45, filter: 2400, filterEnd: 300 }); s.tone({ type: 'sine', freq: 90, freqEnd: 40, dur: 0.4, vol: 0.4 }); } },
  throw: { gap: 40, fn: s => s.noise({ dur: 0.1, vol: 0.16, filter: 2000, filterEnd: 6000, filterType: 'bandpass', q: 4 }) },
  projHit: { gap: 30, fn: s => { s.tone({ type: 'square', freq: 300, freqEnd: 90, dur: 0.08, vol: 0.12, filter: 1500 }); s.noise({ dur: 0.05, vol: 0.2, filter: 3000 }); } },
  jump: { gap: 60, fn: s => s.noise({ dur: 0.12, vol: 0.08, filter: 400, filterEnd: 1200, filterType: 'bandpass' }) },
  land: { gap: 60, fn: (s, p) => { s.tone({ type: 'sine', freq: 90, freqEnd: 40, dur: 0.1, vol: 0.2 * p }); s.noise({ dur: 0.08, vol: 0.1 * p, filter: 600 }); } },
  roll: { gap: 80, fn: s => s.noise({ dur: 0.3, vol: 0.12, filter: 300, filterEnd: 1400, filterType: 'bandpass', q: 1.2 }) },
  cast: { gap: 80, fn: s => { for (let i = 0; i < 4; i++) s.tone({ type: 'sine', freq: 400 * (1 + i * 0.5), freqEnd: 1200 * (1 + i * 0.5), dur: 0.4, vol: 0.05, delay: i * 0.04, verb: 0.6 }); } },
  kiblast: { gap: 60, fn: s => { s.tone({ type: 'sawtooth', freq: 220, freqEnd: 660, dur: 0.3, vol: 0.08, filter: 1800, verb: 0.4 }); s.noise({ dur: 0.25, vol: 0.15, filter: 1500, filterType: 'bandpass' }); } },
  fire: { gap: 60, fn: s => { s.noise({ dur: 0.6, vol: 0.35, filter: 900, filterEnd: 300, verb: 0.3 }); s.tone({ type: 'sawtooth', freq: 90, freqEnd: 60, dur: 0.5, vol: 0.1, filter: 500 }); } },
  ice: { gap: 60, fn: s => { for (let i = 0; i < 5; i++) s.tone({ type: 'sine', freq: rand(1800, 3200), dur: 0.3, vol: 0.05, delay: i * 0.05, verb: 0.7 }); s.noise({ dur: 0.2, vol: 0.18, filter: 6000, filterType: 'highpass' }); } },
  thunder: { gap: 60, fn: s => { s.noise({ dur: 0.08, vol: 0.7, filter: 8000, filterType: 'highpass' }); s.noise({ dur: 1.4, vol: 0.5, filter: 600, filterEnd: 80, delay: 0.03, verb: 0.5 }); s.tone({ type: 'sine', freq: 70, freqEnd: 30, dur: 1, vol: 0.4 }); } },
  quake: { gap: 60, fn: s => { s.noise({ dur: 1.2, vol: 0.55, filter: 300, filterEnd: 60 }); s.tone({ type: 'sine', freq: 50, freqEnd: 28, dur: 1.1, vol: 0.5 }); } },
  shadow: { gap: 60, fn: s => { s.noise({ dur: 0.4, vol: 0.25, filter: 4000, filterEnd: 200, filterType: 'bandpass', q: 3, verb: 0.5 }); s.tone({ type: 'sine', freq: 900, freqEnd: 120, dur: 0.4, vol: 0.06 }); } },
  drain: { gap: 60, fn: s => s.tone({ type: 'sawtooth', freq: 180, freqEnd: 90, dur: 0.9, vol: 0.09, filter: 900, vib: 9, vibDepth: 30, verb: 0.5 }) },
  ko: { gap: 300, fn: s => { s.tone({ type: 'sine', freq: 70, dur: 3, vol: 0.6, attack: 0.002, verb: 0.7 }); s.metal(140, 3.2, 0.2); s.noise({ dur: 0.3, vol: 0.4, filter: 1200 }); } },
  gong: { gap: 200, fn: s => { s.metal(180, 2.6, 0.14); s.tone({ type: 'sine', freq: 90, dur: 2, vol: 0.3, verb: 0.6 }); } },
  drum: { gap: 60, fn: (s, p) => { s.tone({ type: 'sine', freq: 95, freqEnd: 50, dur: 0.4, vol: 0.6 * p, attack: 0.002, verb: 0.3 }); s.noise({ dur: 0.06, vol: 0.2 * p, filter: 900 }); } },
  hover: { gap: 40, fn: s => s.tone({ type: 'triangle', freq: 1300, dur: 0.04, vol: 0.03 }) },
  select: { gap: 60, fn: s => { s.tone({ type: 'triangle', freq: mtof(81), dur: 0.12, vol: 0.06 }); s.tone({ type: 'triangle', freq: mtof(88), dur: 0.2, vol: 0.05, delay: 0.05 }); } },
  back: { gap: 60, fn: s => s.tone({ type: 'triangle', freq: mtof(76), freqEnd: mtof(69), dur: 0.12, vol: 0.05 }) },
  deny: { gap: 120, fn: s => { s.tone({ type: 'square', freq: 140, dur: 0.12, vol: 0.06, filter: 800 }); s.tone({ type: 'square', freq: 110, dur: 0.16, vol: 0.06, delay: 0.09, filter: 800 }); } },
  buy: { gap: 80, fn: s => { [84, 88, 91, 96].forEach((m, i) => s.tone({ type: 'triangle', freq: mtof(m), dur: 0.18, vol: 0.06, delay: i * 0.05, verb: 0.3 })); } },
  upgrade: { gap: 80, fn: s => { s.metal(1100, 0.7, 0.1); s.metal(1650, 0.6, 0.06, s.ctx.currentTime + 0.12); [79, 86, 91].forEach((m, i) => s.tone({ type: 'sine', freq: mtof(m), dur: 0.35, vol: 0.05, delay: 0.2 + i * 0.06, verb: 0.5 })); } },
  coin: { gap: 50, fn: s => { s.tone({ type: 'sine', freq: mtof(93), dur: 0.08, vol: 0.05 }); s.tone({ type: 'sine', freq: mtof(100), dur: 0.16, vol: 0.05, delay: 0.06 }); } },
  achievement: { gap: 200, fn: s => { [72, 79, 84, 88, 91].forEach((m, i) => s.tone({ type: 'triangle', freq: mtof(m), dur: 0.4, vol: 0.06, delay: i * 0.07, verb: 0.5 })); } },
};

/* ---------- Music: step sequencer in the Japanese "in" scale ---------- */
const IN_SCALE = [0, 1, 5, 7, 8]; // in-sen
const scaleNote = (root, deg) => root + IN_SCALE[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5);

const TRACKS = {
  menu:  { bpm: 72, root: 57 },
  fight: { bpm: 126, root: 52 },
  boss:  { bpm: 138, root: 50 },
  win:   { bpm: 90, root: 57 },
};

const Music = {
  track: null, playing: false, step: 0, nextTime: 0, timer: null, intensity: 0.4, rootShift: 0,

  start(name, shift = 0) {
    if (!Sound.ctx) return;
    if (this.track === name && this.playing && this.rootShift === shift) return;
    this.track = name; this.rootShift = shift; this.step = 0;
    this.nextTime = Sound.ctx.currentTime + 0.08; this.playing = true;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  },
  stop() { this.playing = false; this.track = null; },

  tick() {
    if (!this.playing || !Sound.ctx || Sound.ctx.state !== 'running') return;
    const tr = TRACKS[this.track];
    const sd = 60 / tr.bpm / 4;
    if (this.nextTime < Sound.ctx.currentTime - 0.3) this.nextTime = Sound.ctx.currentTime + 0.05;
    while (this.nextTime < Sound.ctx.currentTime + 0.14) {
      try { this.playStep(tr, this.step, this.nextTime, sd); } catch (e) { /* ignore */ }
      this.nextTime += sd; this.step++;
    }
  },

  taiko(t, v = 0.8) {
    Sound.tone({ type: 'sine', freq: 82, freqEnd: 46, slide: 0.18, dur: 0.5, vol: v, attack: 0.002 }, Sound.music, t);
    Sound.noise({ dur: 0.08, vol: v * 0.35, filter: 700 }, Sound.music, t);
  },
  shime(t, v = 0.15) {
    Sound.tone({ type: 'triangle', freq: 520, freqEnd: 300, dur: 0.06, vol: v }, Sound.music, t);
    Sound.noise({ dur: 0.03, vol: v * 0.6, filter: 3000, filterType: 'highpass' }, Sound.music, t);
  },
  rim(t, v = 0.08) { Sound.noise({ dur: 0.025, vol: v, filter: 5000, filterType: 'highpass' }, Sound.music, t); },
  koto(t, m, dur, v = 0.07) {
    Sound.tone({ type: 'triangle', freq: mtof(m), dur, vol: v, attack: 0.002, verb: 0.35 }, Sound.music, t);
    Sound.tone({ type: 'sine', freq: mtof(m) * 2.01, dur: dur * 0.4, vol: v * 0.4, attack: 0.002 }, Sound.music, t);
  },
  shamisen(t, m, dur, v = 0.05) {
    Sound.tone({ type: 'sawtooth', freq: mtof(m), dur, vol: v, attack: 0.002, filter: 2200, filterEnd: 500, q: 3 }, Sound.music, t);
  },
  flute(t, m, dur, v = 0.035) {
    Sound.tone({ type: 'sine', freq: mtof(m), dur, vol: v, attack: dur * 0.25, sustain: 0.6, vib: 5.5, vibDepth: 5, verb: 0.6 }, Sound.music, t);
    Sound.noise({ dur, vol: v * 0.25, filter: mtof(m) * 2, filterType: 'bandpass', q: 6, attack: dur * 0.2 }, Sound.music, t);
  },
  drone(t, m, dur, v = 0.03) {
    Sound.tone({ type: 'sawtooth', freq: mtof(m), dur, vol: v, attack: dur * 0.3, sustain: 0.7, filter: 500 }, Sound.music, t);
    Sound.tone({ type: 'sine', freq: mtof(m - 12), dur, vol: v * 1.5, attack: dur * 0.3, sustain: 0.7 }, Sound.music, t);
  },

  playStep(tr, s, t, sd) {
    const root = tr.root + this.rootShift;
    const st = s % 16, bar = Math.floor(s / 16) % 8;
    const I = this.intensity;
    if (this.track === 'menu' || this.track === 'win') {
      if (st === 0 && bar % 2 === 0) this.drone(t, root - 12, sd * 32, 0.022);
      const arp = [0, 2, 4, 5, 4, 2, 3, 1];
      if (st % 2 === 0) this.koto(t, scaleNote(root, arp[(st / 2 + bar) % 8]), sd * 4, 0.05);
      if (st === 0) this.taiko(t, 0.35);
      if (st === 10 && bar % 2 === 1) this.taiko(t, 0.22);
      const mel = [[7, -1, -1, -1, 6, -1, 5, -1, 4, -1, -1, -1, -1, -1, -1, -1], [5, -1, 6, -1, 7, -1, -1, -1, 9, -1, 8, -1, 7, -1, -1, -1]];
      const n = mel[bar % 2][st];
      if (bar >= 2 && n >= 0) this.flute(t, scaleNote(root, n), sd * 5, 0.03);
      return;
    }
    // fight / boss
    const boss = this.track === 'boss';
    const tp = boss ? [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0] : [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0];
    if (tp[st]) this.taiko(t, st === 0 ? 0.85 : 0.6);
    if (st % 4 === 2 || (I > 0.6 && st % 2 === 1)) this.shime(t, 0.1);
    if (st === 4 || st === 12) this.rim(t, 0.12);
    if (st === 0 && bar % 4 === 0) this.drone(t, root - 12, sd * 64, 0.02);
    const riff = [0, -1, 0, 2, -1, 3, -1, 2, 0, -1, 0, 4, -1, 3, 2, -1];
    const rn = riff[st];
    if (rn >= 0) this.shamisen(t, scaleNote(root, rn + (bar % 4 === 3 ? 1 : 0)), sd * 1.4, 0.04 + I * 0.015);
    if (I > 0.35 && st % 2 === 0) this.koto(t, scaleNote(root + 12, [0, 2, 4, 2, 5, 4, 2, 4][(st / 2) % 8] + (bar % 2)), sd * 2, 0.025 + I * 0.015);
    if (I > 0.55) {
      const mel = [7, -1, -1, 6, -1, 5, -1, -1, 4, -1, 5, -1, 6, -1, -1, -1];
      const n = mel[st];
      if (n >= 0 && bar % 2 === 1) this.flute(t, scaleNote(root + 12, n), sd * 3, 0.03);
    }
  },
};

/* Announcer via the system's speech voice (optional, off by default on some systems). */
const Voice = {
  say(text) {
    if (!Save.data.settings.announcer || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = 0.55; u.rate = 0.92;
      u.volume = Math.min(1, Save.data.settings.master * 1.1);
      const voices = speechSynthesis.getVoices();
      const en = voices.find(v => /en[-_]/i.test(v.lang) && /male|daniel|david|google uk english male|alex/i.test(v.name)) || voices.find(v => /^en/i.test(v.lang));
      if (en) u.voice = en;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  },
};
