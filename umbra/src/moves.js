'use strict';
/* Poses and move data.

   Angles are in degrees. Limbs are measured from straight down, positive = toward the
   way the fighter faces (90 = straight forward, 180 = straight up, -90 = straight back).
   t = torso lean from vertical (forward +), h = head tilt, rot = whole-body pitch.
   w = weapon angle relative to the front forearm.  */

const STANCE = { t: 6, h: -4, fu: 38, ff: 100, bu: 14, bf: 78, ft: 20, fs: 2, bt: -22, bs: -12, w: 52, rot: 0 };
const P = o => Object.assign({}, STANCE, o);

/* Per weapon class guard stance */
const CLASS_STANCE = {
  fist:  P({ fu: 30, ff: 140, bu: 22, bf: 150, w: 0 }),
  dual:  P({ fu: 34, ff: 120, bu: 26, bf: 130, w: 60 }),
  blade: P({}),
  pole:  P({ fu: 46, ff: 92, bu: 30, bf: 95, w: 18 }),
  heavy: P({ fu: 18, ff: 150, bu: 22, bf: 140, w: 70, t: 10 }),
};

const POSE = {
  crouch:      P({ t: 26, h: -10, ft: 82, fs: -14, bt: 24, bs: -78, fu: 50, ff: 105, bu: 30, bf: 90 }),
  crouchGuard: P({ t: 18, h: -14, ft: 82, fs: -14, bt: 24, bs: -78, fu: 60, ff: 150, bu: 50, bf: 155, w: 20 }),
  guard:       P({ t: -4, h: -10, fu: 55, ff: 155, bu: 45, bf: 160, w: 22, ft: 26, fs: 6, bt: -24, bs: -16 }),
  jump:        P({ t: 12, ft: 84, fs: -28, bt: 40, bs: -70, fu: 60, ff: 130, bu: 40, bf: 120 }),
  fall:        P({ t: 4, ft: 40, fs: 0, bt: -10, bs: -40, fu: 70, ff: 150, bu: 60, bf: 140 }),
  hit:         P({ t: -22, h: -18, fu: -10, ff: 30, bu: -40, bf: -10, ft: 14, fs: 0, bt: -28, bs: -34, w: 40 }),
  hitLow:      P({ t: 30, h: 20, fu: 20, ff: 50, bu: 10, bf: 40, ft: 50, fs: -10, bt: -10, bs: -50, w: 40 }),
  stagger:     P({ t: -30, h: -24, fu: -30, ff: -10, bu: -50, bf: -20, ft: 22, fs: 10, bt: -34, bs: -30, w: 60 }),
  launched:    P({ rot: -40, t: -10, h: -20, fu: -40, ff: -10, bu: -60, bf: -30, ft: 30, fs: 10, bt: -20, bs: -30 }),
  down:        P({ rot: -88, t: 0, h: 6, fu: 150, ff: 170, bu: 120, bf: 150, ft: 18, fs: 6, bt: 6, bs: -6, w: 30 }),
  getup:       P({ t: 40, h: 10, ft: 90, fs: -5, bt: 10, bs: -95, fu: 70, ff: 40, bu: 60, bf: 20 }),
  roll:        P({ t: 60, h: 30, ft: 120, fs: -40, bt: 110, bs: -30, fu: 100, ff: 60, bu: 90, bf: 50 }),
  cast:        P({ t: 8, fu: 86, ff: 92, bu: 80, bf: 90, w: 110 }),
  castWind:    P({ t: -10, fu: -30, ff: 40, bu: -40, bf: 30, w: 110 }),
  win:         P({ t: -4, h: -12, fu: 160, ff: 178, bu: 30, bf: 150, w: 4, ft: 12, fs: 0, bt: -14, bs: -6 }),
  bow:         P({ t: 34, h: 18, fu: 10, ff: 40, bu: 20, bf: 120, ft: 4, fs: 0, bt: -6, bs: -4, w: 140 }),
  ko:          P({ rot: -88, t: 0, h: 10, fu: 160, ff: 175, bu: 130, bf: 150, ft: 14, fs: 0, bt: 4, bs: -10 }),
  kneel:       P({ t: 30, h: 20, ft: 88, fs: -2, bt: 20, bs: -90, fu: 10, ff: 30, bu: 0, bf: 20, w: 120 }),
  stunned:     P({ t: 20, h: 26, fu: 0, ff: 10, bu: -10, bf: 5, ft: 12, fs: 0, bt: -14, bs: -8, w: 140 }),
};

/* Moves. Frames are at 60 fps and speed 1. box = [x0, x1, y0, y1] relative to the
   fighter's feet in the facing direction. Weapon moves add the weapon's reach to x1. */
const MOVES = {
  light1: {
    kind: 'weapon', startup: 7, active: 4, recovery: 11, dmg: 1.0, height: 'mid',
    box: [14, 96, 70, 160], hitstun: 17, blockstun: 12, push: 5, blockPush: 4, chain: 'light2',
    wind: P({ t: -6, fu: 60, ff: 175, w: 40, bu: 20, bf: 120 }),
    strike: P({ t: 22, fu: 98, ff: 92, w: 4, ft: 36, fs: 8, bt: -30, bs: -22 }),
    sfx: 'swing',
  },
  light2: {
    kind: 'weapon', startup: 6, active: 4, recovery: 12, dmg: 1.0, height: 'mid',
    box: [14, 96, 60, 170], hitstun: 17, blockstun: 12, push: 5, blockPush: 4, chain: 'light3',
    wind: P({ t: 18, fu: 112, ff: 50, w: -40, ft: 34 }),
    strike: P({ t: 6, fu: 150, ff: 172, w: 6, ft: 30, fs: 6 }),
    sfx: 'swing',
  },
  light3: {
    kind: 'weapon', startup: 10, active: 5, recovery: 20, dmg: 1.55, height: 'mid',
    box: [14, 104, 40, 175], hitstun: 26, blockstun: 16, push: 14, blockPush: 9, knockback: true,
    wind: P({ t: -18, h: -10, fu: 170, ff: 205, w: 30, bu: 140, bf: 170, ft: 14, bt: -30 }),
    strike: P({ t: 36, h: 10, fu: 82, ff: 56, w: 22, bu: 60, bf: 40, ft: 56, fs: 2, bt: -38, bs: -44 }),
    sfx: 'swingHeavy', shake: 4,
  },
  lunge: {
    kind: 'weapon', startup: 12, active: 6, recovery: 18, dmg: 1.35, height: 'mid',
    box: [20, 108, 80, 150], hitstun: 22, blockstun: 14, push: 10, blockPush: 7, travel: 7.5,
    wind: P({ t: -4, fu: 12, ff: 60, w: 30, bu: 30, bf: 100, ft: 10, bt: -30 }),
    strike: P({ t: 30, fu: 92, ff: 90, w: 0, bu: -20, bf: 10, ft: 62, fs: 6, bt: -46, bs: -40 }),
    sfx: 'swing',
  },
  low: {
    kind: 'weapon', startup: 9, active: 4, recovery: 16, dmg: 0.9, height: 'low', crouch: true,
    box: [14, 100, 0, 70], hitstun: 18, blockstun: 12, push: 6, blockPush: 5,
    wind: P({ t: 20, ft: 82, fs: -14, bt: 24, bs: -78, fu: 30, ff: 140, w: 20 }),
    strike: P({ t: 36, h: 10, ft: 82, fs: -14, bt: 24, bs: -78, fu: 88, ff: 70, w: 14 }),
    sfx: 'swing',
  },
  rising: {
    kind: 'weapon', startup: 7, active: 6, recovery: 22, dmg: 1.15, height: 'mid', antiAir: true,
    box: [0, 80, 90, 250], hitstun: 24, blockstun: 12, push: 3, blockPush: 4, launch: 15,
    wind: P({ t: 26, ft: 70, fs: -10, bt: 20, bs: -70, fu: 40, ff: 30, w: 10 }),
    strike: P({ t: -14, h: -16, fu: 168, ff: 176, w: 4, bu: 40, bf: 90, ft: 10, fs: 0, bt: -20, bs: -10 }),
    sfx: 'swing',
  },
  heavy: {
    kind: 'weapon', startup: 17, active: 5, recovery: 26, dmg: 2.1, height: 'mid', guardBreak: true,
    box: [14, 112, 30, 180], hitstun: 30, blockstun: 20, push: 16, blockPush: 12, knockdown: true, travel: 2.5,
    wind: P({ t: -24, h: -12, fu: 200, ff: 230, w: 30, bu: 170, bf: 200, ft: 10, bt: -34, bs: -20 }),
    strike: P({ t: 44, h: 14, fu: 72, ff: 36, w: 26, bu: 50, bf: 30, ft: 64, fs: 0, bt: -44, bs: -50 }),
    sfx: 'swingHeavy', shake: 8, heavy: true,
  },
  air: {
    kind: 'weapon', startup: 5, active: 9, recovery: 8, dmg: 1.15, height: 'overhead', air: true,
    box: [0, 96, -10, 120], hitstun: 20, blockstun: 12, push: 6, blockPush: 5,
    wind: P({ t: -6, fu: 170, ff: 200, w: 30, ft: 70, fs: -30, bt: 30, bs: -70 }),
    strike: P({ t: 30, fu: 60, ff: 40, w: 30, ft: 70, fs: -30, bt: 30, bs: -70 }),
    sfx: 'swing',
  },
  kick: {
    kind: 'kick', startup: 8, active: 4, recovery: 14, dmg: 0.85, height: 'mid',
    box: [16, 100, 70, 140], hitstun: 16, blockstun: 12, push: 12, blockPush: 10,
    wind: P({ t: -10, ft: 96, fs: -40, bt: -10, bs: -6 }),
    strike: P({ t: -24, h: -6, ft: 98, fs: 96, bt: -8, bs: -4, fu: 20, ff: 110 }),
    sfx: 'kick',
  },
  sidekick: {
    kind: 'kick', startup: 11, active: 5, recovery: 18, dmg: 1.1, height: 'mid',
    box: [20, 112, 60, 140], hitstun: 22, blockstun: 14, push: 18, blockPush: 14, travel: 5, knockback: true,
    wind: P({ t: -16, ft: 104, fs: -56, bt: -8, bs: -6, rot: 0 }),
    strike: P({ t: -36, h: -14, ft: 92, fs: 92, bt: -12, bs: -6, fu: 0, ff: 60, rot: -6 }),
    sfx: 'kick', shake: 3,
  },
  sweep: {
    kind: 'kick', startup: 10, active: 5, recovery: 20, dmg: 0.9, height: 'low', crouch: true,
    box: [10, 118, 0, 44], hitstun: 24, blockstun: 12, push: 6, blockPush: 6, knockdown: true,
    wind: P({ t: 40, h: 20, ft: -10, fs: -30, bt: 20, bs: -90, fu: 80, ff: 40, bu: 60, bf: 20 }),
    strike: P({ t: 46, h: 20, ft: 86, fs: 88, bt: 20, bs: -90, fu: 60, ff: 20, bu: 40, bf: 0 }),
    sfx: 'kick',
  },
  airkick: {
    kind: 'kick', startup: 4, active: 22, recovery: 8, dmg: 1.0, height: 'overhead', air: true, dive: true,
    box: [10, 92, -20, 70], hitstun: 18, blockstun: 12, push: 10, blockPush: 8,
    wind: P({ t: -10, ft: 100, fs: 20, bt: 60, bs: -40 }),
    strike: P({ t: -18, h: -10, ft: 48, fs: 46, bt: 100, bs: 10, fu: 120, ff: 160, bu: 100, bf: 150 }),
    sfx: 'kick',
  },
  throw: {
    kind: 'throw', startup: 10, active: 1, recovery: 14,
    wind: P({ t: -12, fu: -60, ff: -20, w: 90, bu: 60, bf: 90 }),
    strike: P({ t: 20, fu: 96, ff: 92, w: 90, bu: -20, bf: 10, ft: 34 }),
    sfx: 'throw',
  },
  cast: {
    kind: 'cast', startup: 14, active: 1, recovery: 22,
    wind: POSE.castWind, strike: POSE.cast, sfx: 'cast',
  },
  shadowSlash: {
    kind: 'weapon', startup: 4, active: 6, recovery: 18, dmg: 0, height: 'mid', unblockable: true, magic: true,
    box: [0, 110, 30, 180], hitstun: 30, push: 18, knockdown: true,
    wind: P({ t: -20, fu: 190, ff: 220, w: 30 }),
    strike: P({ t: 40, fu: 76, ff: 40, w: 26, ft: 60, bt: -40, bs: -46 }),
    sfx: 'swingHeavy', shake: 8,
  },
};
for (const [id, m] of Object.entries(MOVES)) m.id = id;

/* Shared frame rules */
const RULES = {
  chainOpen: 0.45,      // chain window opens at this fraction of active+recovery
  buffer: 9,            // frames an input stays buffered
  walk: 4.4, walkBack: 3.4,
  jumpVy: 19.5, gravity: 1.1, jumpVx: 5.8,
  rollFrames: 24, rollDist: 200, rollInvuln: [2, 17],
  knockdownFrames: 36, getupFrames: 26,
  staggerFrames: 42,
  hitstopHit: 6, hitstopBlock: 4, hitstopHeavy: 10,
  meterHit: 9, meterTaken: 6, meterBlock: 3, meterMax: 100,
  rangedCooldown: 48,
  dmgScale: 2.2, kickScale: 0.62, rangedScale: 2.0, magicScale: 2.0,
  chip: 0.12, guardBreakDmg: 0.3,
  comboScaleStep: 0.075, comboScaleMin: 0.45,
  juggleMax: 3,
  arenaHalf: 700, pushHalf: 30,
  roundTime: 60,
};
