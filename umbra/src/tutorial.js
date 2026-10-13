'use strict';
/* Interactive first-fight tutorial: one move at a time on a training dummy,
   each step completes when the player actually does it. */

const TUTORIAL_STEPS = [
  {
    title: 'MOVE', dummy: 'stand',
    keys: 'Hold <D> or <→> to walk toward your rival',
    pad: 'Push the left stick toward your rival',
    touch: 'Drag on the left side of the screen to walk',
    check: (m) => Math.abs(m.f1.x - m.f2.x) < 170,
  },
  {
    title: 'COMBO', dummy: 'stand',
    keys: 'Press <J> three times quickly for a 3-hit combo',
    pad: 'Press <X> three times quickly',
    touch: 'Tap ATTACK three times quickly',
    check: (m, T) => T.hitsSince(1, 'hit') >= 3,
  },
  {
    title: 'KICK', dummy: 'stand',
    keys: 'Press <K> to kick',
    pad: 'Press <Y> to kick',
    touch: 'Tap KICK',
    check: (m) => m.f1.move && m.f1.move.kind === 'kick' && m.f1.moveHit,
  },
  {
    title: 'BLOCK', dummy: 'attack',
    keys: 'Your rival attacks! Hold <A> or <←> (away from them) to block twice',
    pad: 'Your rival attacks! Hold the stick away from them to block twice',
    touch: 'Your rival attacks! Drag AWAY from them to block twice',
    check: (m, T) => T.hitsSince(2, 'block') >= 2,
  },
  {
    title: 'BREAK THE GUARD', dummy: 'block',
    keys: 'Your rival is blocking. Press <U> for a HEAVY attack that breaks any guard',
    pad: 'Your rival is blocking. Press <LB> for a HEAVY attack that breaks any guard',
    touch: 'Your rival is blocking. Tap HEAVY to break the guard',
    check: (m, T) => T.hitsSince(1, 'guardbreak') >= 1,
  },
  {
    title: 'AIR ATTACK', dummy: 'stand',
    keys: 'Jump with <W>, then press <J> or <K> in the air',
    pad: 'Jump with <A>, then press <X> or <Y> in the air',
    touch: 'Drag UP to jump, then tap ATTACK or KICK',
    check: (m) => m.f1.move && m.f1.move.air && m.f1.moveHit,
  },
  {
    title: 'MAGIC', dummy: 'stand', meter: true,
    keys: 'Your magic meter is full! Press <I> to cast',
    pad: 'Your magic meter is full! Press <RT> to cast',
    touch: 'Your magic meter is full! Tap MAGIC',
    check: (m) => m.lastMagicHit,
  },
  {
    title: 'FINISH IT', dummy: 'stand', final: true,
    keys: 'Knock your rival out with everything you have learned!',
    pad: 'Knock your rival out with everything you have learned!',
    touch: 'Knock your rival out with everything you have learned!',
    check: () => false,
  },
];

class Tutorial {
  constructor(m) {
    this.m = m; this.i = 0; this.doneT = 0; this.final = false;
    this.enter();
  }
  get step() { return TUTORIAL_STEPS[this.i]; }
  get total() { return TUTORIAL_STEPS.length; }

  enter() {
    const m = this.m, s = this.step;
    this.mark = m.hitLog.length;
    m.lastMagicHit = false;
    m.dummyMode = s.dummy;
    m.brain2 = new DummyBrain(s.dummy);
    if (s.meter) m.f1.meter = RULES.meterMax;
    if (s.final) { this.final = true; m.f2.hp = m.f2.maxHp * 0.3; m.f2.lagHp = m.f2.hp; }
  }

  hitsSince(att, type) {
    let n = 0;
    for (let k = this.mark; k < this.m.hitLog.length; k++) { const h = this.m.hitLog[k]; if (h.att === att && h.type === type) n++; }
    return n;
  }

  update() {
    const m = this.m;
    if (this.doneT > 0) {
      if (--this.doneT === 0) { this.i++; if (this.i < this.total) this.enter(); }
      return;
    }
    if (this.step.check(m, this)) {
      this.doneT = 55;
      m.sfx('achievement');
      if (!m.sim) m.fx.text(m.f1.x, m.f1.y + 240 * m.f1.scale, pick(['NICE!', 'GREAT!', 'PERFECT!', 'AWESOME!']), '#7dffa0', 44, 55);
    }
  }

  device() {
    if (Input.touchMode) return 'touch';
    if (Input.pads().length) return 'pad';
    return 'keys';
  }
  text() { return this.step[this.device()]; }
}
