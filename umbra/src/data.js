'use strict';
/* All game content and balance numbers live here. */

/* ---------- Playable fighters ---------- */
const FIGHTERS = [
  {
    id: 'kage', name: 'KAGE', title: 'The Shadow Ninja', price: 0,
    hp: 1.0, speed: 1.1, power: 1.0,
    trait: 'doubleJump', traitName: 'Double Jump', traitDesc: 'Jump again in mid-air.',
    look: { scale: 1, build: 1, hair: 'tails', robe: false, sash: '#c0283a' },
    start: { weapon: 'bokken', armor: 'gi', helmet: 'band', ranged: 'shuriken', magic: 'kiblast' },
  },
  {
    id: 'ronin', name: 'RONIN', title: 'The Wandering Blade', price: 1500,
    hp: 1.05, speed: 1.0, power: 1.1,
    trait: 'parry', traitName: 'Perfect Parry', traitDesc: 'Block at the last moment to parry: no damage and the attacker staggers.',
    look: { scale: 1.02, build: 1.05, hair: 'topknot', robe: false, sash: '#d8b04a' },
    start: { weapon: 'bokken', armor: 'gi', helmet: 'band', ranged: 'kunai', magic: 'kiblast' },
  },
  {
    id: 'monk', name: 'SHEN', title: 'The Iron Monk', price: 2500,
    hp: 0.95, speed: 1.15, power: 0.92,
    trait: 'focus', traitName: 'Inner Focus', traitDesc: 'Magic meter fills 60% faster.',
    look: { scale: 0.97, build: 0.95, hair: 'bald', robe: true, sash: '#e2862b' },
    start: { weapon: 'wraps', armor: 'gi', helmet: 'band', ranged: 'shuriken', magic: 'kiblast' },
  },
  {
    id: 'brute', name: 'GORO', title: 'The Oni Warlord', price: 4000,
    hp: 1.3, speed: 0.86, power: 1.18,
    trait: 'ironBody', traitName: 'Iron Body', traitDesc: 'Heavy attacks cannot be interrupted.',
    look: { scale: 1.14, build: 1.3, hair: 'wild', robe: false, sash: '#7a2a2a' },
    start: { weapon: 'club', armor: 'gi', helmet: 'band', ranged: 'tAxe', magic: 'kiblast' },
  },
  {
    id: 'viper', name: 'NAGI', title: 'The Viper Assassin', price: 6000,
    hp: 0.86, speed: 1.2, power: 1.0,
    trait: 'crit', traitName: 'Killer Instinct', traitDesc: '18% chance to land a critical hit for double damage.',
    look: { scale: 0.95, build: 0.82, hair: 'pony', robe: false, sash: '#3fae6a' },
    start: { weapon: 'daggers', armor: 'gi', helmet: 'band', ranged: 'kunai', magic: 'kiblast' },
  },
  {
    id: 'mystic', name: 'AYAME', title: 'The Spirit Weaver', price: 0, gems: 60,
    hp: 0.92, speed: 1.0, power: 0.95,
    trait: 'spell', traitName: 'Spellweaver', traitDesc: 'Magic hits 50% harder and every round starts with half a meter.',
    look: { scale: 0.98, build: 0.88, hair: 'long', robe: true, sash: '#7b5cff' },
    start: { weapon: 'staff', armor: 'gi', helmet: 'band', ranged: 'shuriken', magic: 'kiblast' },
  },
];

/* ---------- Weapon classes: how a weapon changes every attack ---------- */
const WEAPON_CLASS = {
  fist:  { name: 'Fists',      speed: 1.25, reach: -28, dmg: 0.72, desc: 'Very fast, short reach' },
  dual:  { name: 'Dual Blades', speed: 1.14, reach: -12, dmg: 0.84, desc: 'Fast, bleeding combos' },
  blade: { name: 'Sword',      speed: 1.0,  reach: 0,   dmg: 1.0,  desc: 'Balanced speed and reach' },
  pole:  { name: 'Polearm',    speed: 0.88, reach: 48,  dmg: 1.02, desc: 'Long reach, keeps foes away' },
  heavy: { name: 'Heavy',      speed: 0.76, reach: 20,  dmg: 1.45, desc: 'Slow, huge damage, breaks guards' },
};

const SLOTS = ['weapon', 'armor', 'helmet', 'ranged', 'magic'];
const SLOT_NAMES = { weapon: 'WEAPONS', armor: 'ARMOR', helmet: 'HELMETS', ranged: 'RANGED', magic: 'MAGIC' };
const MAX_ITEM_LEVEL = 5;

const PERKS = {
  burn:      { name: 'Burning',    desc: 'Hits set the foe on fire.', color: '#ff7a2a' },
  freeze:    { name: 'Frost',      desc: 'Hits slow the foe down.', color: '#7fd6ff' },
  poison:    { name: 'Venom',      desc: 'Hits poison the foe.', color: '#7dff6a' },
  lifesteal: { name: 'Lifesteal',  desc: 'Heal 15% of the damage you deal.', color: '#ff3f6c' },
  shock:     { name: 'Thunder',    desc: 'Heavy hits stun the foe.', color: '#ffe95a' },
  crit:      { name: 'Keen Edge',  desc: '+12% critical hit chance.', color: '#ffffff' },
  thorns:    { name: 'Thorns',     desc: 'Attackers take 12% of melee damage back.', color: '#d77bff' },
  regen:     { name: 'Recovery',   desc: 'Slowly regain health during a round.', color: '#6aff9c' },
  focus:     { name: 'Meditation', desc: 'Magic meter fills 30% faster.', color: '#8f7bff' },
};

/* Items. weapon: atk. armor/helmet: def + hp. ranged: dmg + ammo. magic: dmg.
   price is in coins; gems > 0 means a gem item. */
const ITEMS = [
  // ---- weapons ----
  { id: 'wraps',    slot: 'weapon', name: 'Hand Wraps',      cls: 'fist',  tier: 1, price: 0,    atk: 12, look: { shape: 'wraps' } },
  { id: 'bokken',   slot: 'weapon', name: 'Bokken',          cls: 'blade', tier: 1, price: 0,    atk: 12, look: { shape: 'bokken', len: 62 } },
  { id: 'staff',    slot: 'weapon', name: 'Bo Staff',        cls: 'pole',  tier: 1, price: 0,    atk: 11, look: { shape: 'staff', len: 120 } },
  { id: 'club',     slot: 'weapon', name: 'Oak Club',        cls: 'heavy', tier: 1, price: 0,    atk: 12, look: { shape: 'club', len: 70 } },
  { id: 'daggers',  slot: 'weapon', name: 'Twin Tanto',      cls: 'dual',  tier: 1, price: 0,    atk: 12, look: { shape: 'daggers', len: 30 } },
  { id: 'knuckles', slot: 'weapon', name: 'Iron Knuckles',   cls: 'fist',  tier: 2, price: 700,  atk: 19, look: { shape: 'knuckles' } },
  { id: 'katana',   slot: 'weapon', name: 'Katana',          cls: 'blade', tier: 2, price: 800,  atk: 19, look: { shape: 'katana', len: 74 } },
  { id: 'spear',    slot: 'weapon', name: 'Yari Spear',      cls: 'pole',  tier: 2, price: 850,  atk: 18, look: { shape: 'spear', len: 132 } },
  { id: 'sai',      slot: 'weapon', name: 'Twin Sai',        cls: 'dual',  tier: 2, price: 900,  atk: 19, look: { shape: 'sai', len: 34 } },
  { id: 'axe',      slot: 'weapon', name: 'Battle Axe',      cls: 'heavy', tier: 2, price: 950,  atk: 20, look: { shape: 'axe', len: 78 } },
  { id: 'claws',    slot: 'weapon', name: 'Tiger Claws',     cls: 'fist',  tier: 3, price: 2200, atk: 26, perk: 'poison', look: { shape: 'claws' } },
  { id: 'dao',      slot: 'weapon', name: 'Ember Dao',       cls: 'blade', tier: 3, price: 2400, atk: 27, perk: 'burn', look: { shape: 'dao', len: 70, glow: '#ff7a2a' } },
  { id: 'kama',     slot: 'weapon', name: 'Twin Kama',       cls: 'dual',  tier: 3, price: 2300, atk: 26, perk: 'crit', look: { shape: 'kama', len: 36 } },
  { id: 'naginata', slot: 'weapon', name: 'Frost Naginata',  cls: 'pole',  tier: 3, price: 2600, atk: 26, perk: 'freeze', look: { shape: 'naginata', len: 136, glow: '#7fd6ff' } },
  { id: 'hammer',   slot: 'weapon', name: 'Thunder Hammer',  cls: 'heavy', tier: 4, price: 5200, atk: 37, perk: 'shock', look: { shape: 'hammer', len: 82, glow: '#ffe95a' } },
  { id: 'moon',     slot: 'weapon', name: 'Moonblade',       cls: 'blade', tier: 4, price: 5600, atk: 36, perk: 'lifesteal', look: { shape: 'katana', len: 80, glow: '#ff3f6c' } },
  { id: 'fangs',    slot: 'weapon', name: 'Serpent Fangs',   cls: 'dual',  tier: 4, price: 5400, atk: 35, perk: 'poison', look: { shape: 'sai', len: 40, glow: '#7dff6a' } },
  { id: 'dragon',   slot: 'weapon', name: 'Dragon Fang',     cls: 'blade', tier: 5, price: 0, gems: 70, atk: 50, perk: 'burn', look: { shape: 'dao', len: 84, glow: '#ff5a1f' } },
  { id: 'voidstaff',slot: 'weapon', name: 'Void Glaive',     cls: 'pole',  tier: 5, price: 0, gems: 70, atk: 48, perk: 'lifesteal', look: { shape: 'naginata', len: 140, glow: '#b45aff' } },

  // ---- armor ----
  { id: 'gi',       slot: 'armor', name: 'Training Gi',      tier: 1, price: 0,    def: 4,  hp: 0,   look: { shape: 'gi' } },
  { id: 'vest',     slot: 'armor', name: 'Leather Vest',     tier: 2, price: 650,  def: 12, hp: 30,  look: { shape: 'vest' } },
  { id: 'lamellar', slot: 'armor', name: 'Lamellar Armor',   tier: 3, price: 2000, def: 22, hp: 60,  look: { shape: 'lamellar' } },
  { id: 'shadowrobe', slot: 'armor', name: 'Shadow Robe',    tier: 3, price: 2400, def: 16, hp: 50,  perk: 'focus', look: { shape: 'robe' } },
  { id: 'yoroi',    slot: 'armor', name: 'O-Yoroi',          tier: 4, price: 5000, def: 34, hp: 100, look: { shape: 'yoroi' } },
  { id: 'dragonplate', slot: 'armor', name: 'Dragon Plate',  tier: 5, price: 0, gems: 60, def: 48, hp: 150, perk: 'thorns', look: { shape: 'dragon' } },

  // ---- helmets ----
  { id: 'band',     slot: 'helmet', name: 'Headband',        tier: 1, price: 0,    def: 2,  hp: 0,   look: { shape: 'band' } },
  { id: 'hood',     slot: 'helmet', name: 'Ninja Hood',      tier: 2, price: 500,  def: 7,  hp: 20,  look: { shape: 'hood' } },
  { id: 'straw',    slot: 'helmet', name: 'Straw Hat',       tier: 2, price: 550,  def: 6,  hp: 30,  look: { shape: 'straw' } },
  { id: 'kabuto',   slot: 'helmet', name: 'Iron Kabuto',     tier: 3, price: 1800, def: 13, hp: 45,  look: { shape: 'kabuto' } },
  { id: 'oni',      slot: 'helmet', name: 'Oni Mask',        tier: 4, price: 4200, def: 18, hp: 60,  perk: 'crit', look: { shape: 'oni' } },
  { id: 'dragonhelm', slot: 'helmet', name: 'Dragon Helm',   tier: 5, price: 0, gems: 50, def: 26, hp: 90, perk: 'regen', look: { shape: 'dragon' } },

  // ---- ranged ----
  { id: 'shuriken', slot: 'ranged', name: 'Shuriken',        tier: 1, price: 0,    dmg: 9,  ammo: 5, kind: 'shuriken' },
  { id: 'kunai',    slot: 'ranged', name: 'Kunai',           tier: 1, price: 0,    dmg: 12, ammo: 4, kind: 'kunai' },
  { id: 'tAxe',     slot: 'ranged', name: 'Throwing Axe',    tier: 1, price: 0,    dmg: 15, ammo: 3, kind: 'axe' },
  { id: 'chakram',  slot: 'ranged', name: 'Chakram',         tier: 3, price: 2000, dmg: 20, ammo: 3, kind: 'chakram' },
  { id: 'bomb',     slot: 'ranged', name: 'Smoke Bomb',      tier: 4, price: 4000, dmg: 30, ammo: 2, kind: 'bomb' },

  // ---- magic ----
  { id: 'kiblast',  slot: 'magic', name: 'Ki Blast',         tier: 1, price: 0,    dmg: 30, kind: 'kiblast' },
  { id: 'fireball', slot: 'magic', name: 'Dragon Fire',      tier: 2, price: 1200, dmg: 44, kind: 'fireball' },
  { id: 'ice',      slot: 'magic', name: 'Ice Spikes',       tier: 3, price: 2600, dmg: 50, kind: 'ice' },
  { id: 'lightning',slot: 'magic', name: 'Heaven\'s Wrath',  tier: 3, price: 3000, dmg: 56, kind: 'lightning' },
  { id: 'quake',    slot: 'magic', name: 'Earth Shatter',    tier: 4, price: 5000, dmg: 66, kind: 'quake' },
  { id: 'shadow',   slot: 'magic', name: 'Shadow Step',      tier: 4, price: 5500, dmg: 70, kind: 'shadow' },
  { id: 'drain',    slot: 'magic', name: 'Soul Drain',       tier: 5, price: 0, gems: 55, dmg: 80, kind: 'drain' },
];
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));

const MAGIC_INFO = {
  kiblast:   'Fire a ball of energy.',
  fireball:  'Hurl a dragon flame that sets the foe on fire.',
  ice:       'Ice spikes burst from the ground and slow the foe.',
  lightning: 'Lightning strikes where the foe stands and stuns them.',
  quake:     'A shockwave along the ground knocks the foe down. Jump to dodge it!',
  shadow:    'Vanish and strike from behind.',
  drain:     'A beam that steals the foe\'s health.',
};
const RANGED_INFO = {
  shuriken: 'Fast, low damage. Duck under them!',
  kunai: 'Quick and sharp.',
  axe: 'Flies in an arc and knocks the foe down.',
  chakram: 'Flies out and comes back, hitting twice.',
  bomb: 'Explodes in a cloud. Knocks the foe down.',
};

/* Stats for an item at a given upgrade level (1..MAX_ITEM_LEVEL). */
function itemStat(item, key, level) {
  const base = item[key] || 0;
  return base * (1 + 0.16 * ((level || 1) - 1));
}
function upgradeCost(item, level) {
  const base = item.gems ? 2400 + item.tier * 900 : Math.max(220, item.price);
  return Math.round(base * 0.45 * level / 10) * 10;
}

/* ---------- Opponent difficulty tiers ---------- */
const TIERS = [
  { id: 'novice', name: 'NOVICE', color: '#9be08f', reward: 60,  gems: 2,  ai: { reaction: 30, think: 18, block: 0.06, read: 0.15, aggro: 0.32, combo: 0.2,  punish: 0.05, antiAir: 0.04, ranged: 0.12, magic: 0.25, roll: 0.02, hesitate: 0.4 } },
  { id: 'easy',   name: 'EASY',   color: '#c7e86a', reward: 100, gems: 3,  ai: { reaction: 23, think: 14, block: 0.18, read: 0.3,  aggro: 0.42, combo: 0.38, punish: 0.14, antiAir: 0.12, ranged: 0.22, magic: 0.45, roll: 0.05, hesitate: 0.26 } },
  { id: 'normal', name: 'NORMAL', color: '#ffd84a', reward: 160, gems: 4,  ai: { reaction: 17, think: 11, block: 0.34, read: 0.5,  aggro: 0.52, combo: 0.55, punish: 0.3,  antiAir: 0.28, ranged: 0.32, magic: 0.6,  roll: 0.1,  hesitate: 0.16 } },
  { id: 'hard',   name: 'HARD',   color: '#ffa03a', reward: 250, gems: 5,  ai: { reaction: 13, think: 9,  block: 0.48, read: 0.66, aggro: 0.6,  combo: 0.7,  punish: 0.46, antiAir: 0.45, ranged: 0.38, magic: 0.75, roll: 0.16, hesitate: 0.1 } },
  { id: 'expert', name: 'EXPERT', color: '#ff5e3a', reward: 380, gems: 7,  ai: { reaction: 10, think: 7,  block: 0.6,  read: 0.78, aggro: 0.66, combo: 0.82, punish: 0.6,  antiAir: 0.6,  ranged: 0.42, magic: 0.85, roll: 0.22, hesitate: 0.06 } },
  { id: 'master', name: 'MASTER', color: '#ff2f6a', reward: 560, gems: 9,  ai: { reaction: 8,  think: 6,  block: 0.7,  read: 0.87, aggro: 0.7,  combo: 0.9,  punish: 0.72, antiAir: 0.7,  ranged: 0.46, magic: 0.9,  roll: 0.28, hesitate: 0.03 } },
  { id: 'legend', name: 'LEGEND', color: '#c04bff', reward: 800, gems: 12, ai: { reaction: 6,  think: 5,  block: 0.78, read: 0.93, aggro: 0.75, combo: 0.95, punish: 0.84, antiAir: 0.8,  ranged: 0.5,  magic: 0.95, roll: 0.33, hesitate: 0.01 } },
];
const TIER = Object.fromEntries(TIERS.map((t, i) => [t.id, Object.assign(t, { index: i })]));

/* ---------- Computer opponents (no levels: pick any rival, any time) ---------- */
const OPPONENTS = [
  { id: 'kenta',  name: 'Kenta',        title: 'Dojo Apprentice',     tier: 'novice', fighter: 'monk',   style: 'brawler',
    gear: { weapon: ['wraps', 1], armor: ['gi', 1], helmet: ['band', 1], ranged: ['shuriken', 1], magic: ['kiblast', 1] },
    quote: 'Sensei says I am ready. I think.' },
  { id: 'hiro',   name: 'Old Hiro',     title: 'Village Elder',       tier: 'novice', fighter: 'mystic', style: 'defensive',
    gear: { weapon: ['staff', 1], armor: ['gi', 1], helmet: ['straw', 1], ranged: ['shuriken', 1], magic: ['kiblast', 1] },
    quote: 'My back hurts, but my staff does not.' },
  { id: 'ryu',    name: 'Ryu',          title: 'Mountain Bandit',     tier: 'easy',   fighter: 'viper',  style: 'aggressive',
    gear: { weapon: ['daggers', 3], armor: ['vest', 1], helmet: ['band', 1], ranged: ['kunai', 2], magic: ['kiblast', 2] },
    quote: 'Your coins or your pride. Both, actually.' },
  { id: 'suzu',   name: 'Lady Suzu',    title: 'Teahouse Guard',      tier: 'easy',   fighter: 'ronin',  style: 'balanced',
    gear: { weapon: ['katana', 1], armor: ['gi', 2], helmet: ['band', 1], ranged: ['kunai', 1], magic: ['kiblast', 2] },
    quote: 'Please finish your tea first.' },
  { id: 'tetsu',  name: 'Tetsu',        title: 'The Anvil',           tier: 'normal', fighter: 'brute',  style: 'aggressive',
    gear: { weapon: ['axe', 2], armor: ['vest', 3], helmet: ['straw', 2], ranged: ['tAxe', 2], magic: ['kiblast', 3] },
    quote: 'I break swords. And people who hold them.' },
  { id: 'mizu',   name: 'Mizu',         title: 'River Spear',         tier: 'normal', fighter: 'kage',   style: 'zoner',
    gear: { weapon: ['spear', 3], armor: ['vest', 2], helmet: ['hood', 2], ranged: ['shuriken', 3], magic: ['fireball', 1] },
    quote: 'Stay right there. Exactly one spear away.' },
  { id: 'kuro',   name: 'Kuro',         title: 'Night Wolf',          tier: 'hard',   fighter: 'kage',   style: 'aggressive',
    gear: { weapon: ['katana', 4], armor: ['lamellar', 1], helmet: ['hood', 3], ranged: ['shuriken', 4], magic: ['fireball', 3] },
    quote: 'You will not even see me move.' },
  { id: 'raijin', name: 'Raijin',       title: 'Storm Monk',          tier: 'hard',   fighter: 'monk',   style: 'balanced',
    gear: { weapon: ['claws', 2], armor: ['shadowrobe', 2], helmet: ['band', 3], ranged: ['shuriken', 3], magic: ['lightning', 2] },
    quote: 'The storm does not ask permission.' },
  { id: 'lotus',  name: 'Black Lotus',  title: 'Poison Blossom',      tier: 'expert', fighter: 'viper',  style: 'trickster',
    gear: { weapon: ['kama', 4], armor: ['lamellar', 3], helmet: ['hood', 5], ranged: ['chakram', 2], magic: ['ice', 3] },
    quote: 'Beautiful things are often deadly.' },
  { id: 'gorou',  name: 'Iron Gorou',   title: 'Fortress Breaker',    tier: 'expert', fighter: 'brute',  style: 'defensive',
    gear: { weapon: ['hammer', 1], armor: ['yoroi', 1], helmet: ['kabuto', 3], ranged: ['tAxe', 4], magic: ['quake', 1] },
    quote: 'Walls fall. So will you.' },
  { id: 'hayabusa', name: 'Hayabusa',   title: 'Silent Falcon',       tier: 'master', fighter: 'ronin',  style: 'zoner',
    gear: { weapon: ['naginata', 5], armor: ['yoroi', 3], helmet: ['kabuto', 5], ranged: ['chakram', 4], magic: ['ice', 5] },
    quote: 'One cut. That is all it takes.' },
  { id: 'akuma',  name: 'Crimson Oni',  title: 'Demon of the Gate',   tier: 'master', fighter: 'brute',  style: 'aggressive',
    gear: { weapon: ['hammer', 4], armor: ['yoroi', 4], helmet: ['oni', 3], ranged: ['bomb', 2], magic: ['fireball', 5] },
    quote: 'The gate is closed. Forever.' },
  { id: 'yami',   name: 'Yami',         title: 'Shadow Empress',      tier: 'legend', fighter: 'mystic', style: 'trickster',
    gear: { weapon: ['voidstaff', 3], armor: ['dragonplate', 2], helmet: ['oni', 5], ranged: ['chakram', 5], magic: ['shadow', 5] },
    quote: 'You fight shadows. I AM the shadow.' },
  { id: 'kenshin', name: 'Kenshin',     title: 'The Last Sword Saint', tier: 'legend', fighter: 'ronin', style: 'balanced',
    gear: { weapon: ['dragon', 4], armor: ['dragonplate', 3], helmet: ['dragonhelm', 3], ranged: ['bomb', 4], magic: ['drain', 4] },
    quote: 'Show me why you came this far.' },
];
const OPPONENT = Object.fromEntries(OPPONENTS.map(o => [o.id, o]));

/* Fighting styles bias the bot's choices on top of its difficulty tier. */
const STYLES = {
  balanced:   { aggro: 0,     block: 0,     ranged: 0,    spacing: 0 },
  aggressive: { aggro: 0.18,  block: -0.08, ranged: -0.1, spacing: -20 },
  defensive:  { aggro: -0.14, block: 0.12,  ranged: 0,    spacing: 20 },
  zoner:      { aggro: -0.06, block: 0.04,  ranged: 0.18, spacing: 40 },
  brawler:    { aggro: 0.1,   block: -0.04, ranged: -0.06, spacing: -10 },
  trickster:  { aggro: 0.06,  block: 0,     ranged: 0.08, spacing: 0, roll: 0.1 },
};

/* ---------- Arenas ---------- */
const STAGES = [
  { id: 'bamboo',  name: 'Moonlit Bamboo',  sky: ['#0b2a3a', '#1f6b78', '#9fd8c8'], far: '#174a52', mid: '#0f3238', ground: '#0a1f22', accent: '#d8fff2', particles: 'fireflies', moon: true },
  { id: 'temple',  name: 'Sunset Temple',   sky: ['#3a1030', '#c2413a', '#ffbf6a'], far: '#7a2a34', mid: '#4a1824', ground: '#1e0a10', accent: '#ffd9a0', particles: 'petals', sun: true },
  { id: 'bridge',  name: 'Misty Bridge',    sky: ['#1a2238', '#4a5a7a', '#b8c4d8'], far: '#3a4660', mid: '#232c40', ground: '#11151f', accent: '#e8f0ff', particles: 'mist', moon: true },
  { id: 'forge',   name: 'Volcano Forge',   sky: ['#120404', '#5a1208', '#ff6a1a'], far: '#3a0c06', mid: '#220604', ground: '#0e0302', accent: '#ffb070', particles: 'embers' },
  { id: 'shrine',  name: 'Snow Shrine',     sky: ['#1c2a48', '#5f7fb0', '#dfe9f6'], far: '#6b84ad', mid: '#3a4f78', ground: '#1a2238', accent: '#ffffff', particles: 'snow', moon: true },
  { id: 'gate',    name: 'Crimson Gate',    sky: ['#14040a', '#4a0a1e', '#c8243c'], far: '#5a0e20', mid: '#300814', ground: '#12030a', accent: '#ff9aa8', particles: 'ash', moon: true },
];

/* ---------- Achievements ---------- */
const ACHIEVEMENTS = [
  { id: 'firstWin',  name: 'First Blood',       desc: 'Win your first duel.' },
  { id: 'perfect',   name: 'Untouchable',       desc: 'Win a round without taking damage.' },
  { id: 'combo5',    name: 'Combo Artist',      desc: 'Land a 5-hit combo.' },
  { id: 'combo10',   name: 'Combo Master',      desc: 'Land a 10-hit combo.' },
  { id: 'magicKo',   name: 'Spellbound',        desc: 'Finish a round with magic.' },
  { id: 'rangedKo',  name: 'Sharpshooter',      desc: 'Finish a round with a throw.' },
  { id: 'parry10',   name: 'Iron Wall',         desc: 'Parry 10 attacks in total.' },
  { id: 'beatHard',  name: 'Rising Star',       desc: 'Beat a HARD opponent.' },
  { id: 'beatExpert',name: 'Blade Expert',      desc: 'Beat an EXPERT opponent.' },
  { id: 'beatMaster',name: 'True Master',       desc: 'Beat a MASTER opponent.' },
  { id: 'beatLegend',name: 'Living Legend',     desc: 'Beat a LEGEND opponent.' },
  { id: 'beatAll',   name: 'Undefeated',        desc: 'Beat every opponent at least once.' },
  { id: 'allFighters', name: 'Full Roster',     desc: 'Unlock every fighter.' },
  { id: 'maxItem',   name: 'Master Smith',      desc: 'Upgrade an item to level 5.' },
  { id: 'gemItem',   name: 'Legendary Gear',    desc: 'Buy a legendary gem item.' },
  { id: 'comeback',  name: 'Never Give Up',     desc: 'Win a round with less than 10% health left.' },
  { id: 'versus',    name: 'Friendly Rivals',   desc: 'Play a 2-player Versus match.' },
  { id: 'rich',      name: 'Treasure Hoard',    desc: 'Hold 10,000 coins at once.' },
];
