'use strict';
/* Local save: progress never leaves the device. */
const SAVE_KEY = 'umbra-save-v1';

function defaultSave() {
  const owned = {};
  for (const it of ITEMS) if (!it.price && !it.gems) owned[it.id] = 1;
  const loadouts = {};
  for (const f of FIGHTERS) loadouts[f.id] = Object.assign({}, f.start);
  return {
    version: 1,
    coins: 300,
    gems: 5,
    owned,
    fighters: ['kage'],
    fighter: 'kage',
    loadouts,
    opponents: {},
    achievements: {},
    stats: { wins: 0, losses: 0, parries: 0, bestCombo: 0, matches: 0, perfects: 0 },
    seen: { howto: false },
    settings: {
      master: 0.8, music: 0.6, sfx: 0.9,
      announcer: true, shake: 1, rounds: 3, hitNumbers: true, touch: 'auto',
    },
  };
}

function deepMerge(base, over) {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return over === undefined ? base : over;
  const out = Object.assign({}, base);
  if (over && typeof over === 'object') for (const k in over) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

const Save = {
  data: defaultSave(),
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.data = deepMerge(defaultSave(), JSON.parse(raw));
    } catch (e) { this.data = defaultSave(); }
    // make sure every fighter has a complete loadout of owned items
    for (const f of FIGHTERS) {
      const lo = this.data.loadouts[f.id] = Object.assign({}, f.start, this.data.loadouts[f.id]);
      for (const s of SLOTS) if (!this.data.owned[lo[s]]) lo[s] = f.start[s];
    }
  },
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* storage may be blocked */ } },
  reset() { this.data = defaultSave(); this.save(); },

  gearFor(fighterId) {
    const lo = this.data.loadouts[fighterId];
    const g = {};
    for (const s of SLOTS) g[s] = [lo[s], this.data.owned[lo[s]] || 1];
    return g;
  },
  record(id) { return this.data.opponents[id] || (this.data.opponents[id] = { wins: 0, losses: 0 }); },
};
