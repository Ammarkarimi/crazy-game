'use strict';
/* ==========================================================================
   Persistent save data (localStorage). Desktop builds use the same storage.
   ========================================================================== */

const SAVE_KEY = 'hyperchaos_save_v1';

const Save = {
  data: null,

  defaults() {
    return {
      version: VERSION,
      shards: 0,
      meta: { hp: 0, dmg: 0, speed: 0, xp: 0, shard: 0, reroll: 0, chaos: 0, revive: 0, magnet: 0 },
      ships: { vector: true },
      selectedShip: 'vector',
      achievements: {},
      stats: {
        runs: 0, wins: 0, kills: 0, bossKills: 0, bestWave: 0, bestScore: 0,
        bestEndlessWave: 0, playTime: 0, overdrives: 0, shardsEarned: 0, deaths: 0, events: 0,
      },
      highscores: [],
      daily: { key: '', best: 0, played: 0 },
      settings: {
        master: 0.8, music: 0.6, sfx: 0.8,
        shake: 0.6, particles: 1, autofire: true, damageNumbers: false,
        crt: false, showFps: false, flashes: true,
        difficulty: 'easy', autoAim: true, voice: true, breakMins: 30,
      },
      seenHowTo: false,
    };
  },

  load() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { stored = null; }
    this.data = deepMerge(this.defaults(), stored || {});
    this.data.version = VERSION;
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* storage full or blocked */ }
  },

  reset() {
    const settings = this.data ? this.data.settings : null;
    this.data = this.defaults();
    if (settings) this.data.settings = settings;
    this.save();
  },

  addHighscore(entry) {
    const hs = this.data.highscores;
    hs.push(entry);
    hs.sort((a, b) => b.score - a.score);
    hs.length = Math.min(hs.length, 15);
    return hs.indexOf(entry);
  },
};
