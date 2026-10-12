'use strict';
/* ==========================================================================
   Unified input: keyboard + mouse, standard gamepads and touch twin-sticks.
   ========================================================================== */

const ACTIONS = {
  dash: { keys: ['Space', 'ShiftLeft', 'ShiftRight'], gp: [0, 4, 6] },
  overdrive: { keys: ['KeyQ', 'KeyE'], gp: [3, 5], mouse: 2 },
  pause: { keys: ['Escape', 'KeyP'], gp: [9] },
  up: { keys: ['ArrowUp', 'KeyW'], gp: [12] },
  down: { keys: ['ArrowDown', 'KeyS'], gp: [13] },
  left: { keys: ['ArrowLeft', 'KeyA'], gp: [14] },
  right: { keys: ['ArrowRight', 'KeyD'], gp: [15] },
  confirm: { keys: ['Enter', 'NumpadEnter'], gp: [0] },
  back: { keys: ['Escape', 'Backspace'], gp: [1] },
  pick1: { keys: ['Digit1', 'Numpad1'] },
  pick2: { keys: ['Digit2', 'Numpad2'] },
  pick3: { keys: ['Digit3', 'Numpad3'] },
  pick4: { keys: ['Digit4', 'Numpad4'] },
  reroll: { keys: ['KeyR'], gp: [2] },
};

const Input = {
  keys: new Set(),
  keyHits: new Set(),
  mouse: { x: 0, y: 0, down: false, right: false, hitRight: false, moved: false },
  gpButtons: [],
  gpPrev: [],
  gpAxes: [0, 0, 0, 0],
  gpStickNav: { x: 0, y: 0, timer: 0 },
  device: 'kb', // 'kb' | 'gp' | 'touch'
  hits: new Set(),
  touch: {
    move: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
    aim: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
    dashHit: false, overHit: false, pauseHit: false,
  },

  init(canvas) {
    window.addEventListener('keydown', e => {
      if (e.code === 'Tab') e.preventDefault();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && e.target === document.body) e.preventDefault();
      if (!e.repeat) this.keyHits.add(e.code);
      this.keys.add(e.code);
      this.setDevice('kb');
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.mouse.right = false; });

    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true;
      if (this.device !== 'kb' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) this.setDevice('kb');
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) { this.mouse.right = true; this.mouse.hitRight = true; }
      this.setDevice('kb');
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());

    // ---- touch twin sticks ----
    const tStart = e => {
      this.setDevice('touch');
      for (const t of e.changedTouches) {
        const left = t.clientX < window.innerWidth * 0.5;
        const stick = left ? this.touch.move : this.touch.aim;
        if (stick.id === null) {
          stick.id = t.identifier;
          stick.ox = stick.x = t.clientX;
          stick.oy = stick.y = t.clientY;
        }
      }
      e.preventDefault();
    };
    const tMove = e => {
      for (const t of e.changedTouches) {
        for (const stick of [this.touch.move, this.touch.aim]) {
          if (stick.id === t.identifier) {
            stick.x = t.clientX; stick.y = t.clientY;
            // floating stick: drag origin along when pulled too far
            const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
            const d = Math.hypot(dx, dy), max = 70;
            if (d > max) { stick.ox = stick.x - dx / d * max; stick.oy = stick.y - dy / d * max; }
          }
        }
      }
      e.preventDefault();
    };
    const tEnd = e => {
      for (const t of e.changedTouches) {
        for (const stick of [this.touch.move, this.touch.aim]) if (stick.id === t.identifier) stick.id = null;
      }
    };
    canvas.addEventListener('touchstart', tStart, { passive: false });
    canvas.addEventListener('touchmove', tMove, { passive: false });
    canvas.addEventListener('touchend', tEnd);
    canvas.addEventListener('touchcancel', tEnd);

    const bindBtn = (id, flag) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('touchstart', e => { this.touch[flag] = true; this.setDevice('touch'); e.preventDefault(); e.stopPropagation(); }, { passive: false });
      b.addEventListener('mousedown', e => { this.touch[flag] = true; e.stopPropagation(); });
    };
    bindBtn('tDash', 'dashHit');
    bindBtn('tOver', 'overHit');
    bindBtn('tPause', 'pauseHit');
    window.addEventListener('touchstart', () => this.setDevice('touch'), { passive: true });
  },

  setDevice(d) {
    if (this.device === d) return;
    this.device = d;
    document.body.classList.toggle('touch', d === 'touch');
    document.body.classList.toggle('hide-cursor', d === 'gp');
  },

  /* Called once per frame before game logic */
  update(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    this.gpPrev = this.gpButtons;
    this.gpButtons = [];
    if (gp) {
      for (let i = 0; i < gp.buttons.length; i++) {
        const b = gp.buttons[i];
        this.gpButtons[i] = b.pressed || b.value > 0.5;
      }
      for (let i = 0; i < 4; i++) this.gpAxes[i] = gp.axes[i] || 0;
      const active = this.gpButtons.some(Boolean) || this.gpAxes.some(a => Math.abs(a) > 0.4);
      if (active) this.setDevice('gp');
    } else {
      this.gpAxes.fill(0);
    }

    // Build this frame's action hits
    this.hits.clear();
    for (const name in ACTIONS) {
      const a = ACTIONS[name];
      let hit = false;
      if (a.keys) for (const k of a.keys) if (this.keyHits.has(k)) hit = true;
      if (a.gp) for (const b of a.gp) if (this.gpButtons[b] && !this.gpPrev[b]) hit = true;
      if (a.mouse === 2 && this.mouse.hitRight) hit = true;
      if (hit) this.hits.add(name);
    }
    if (this.touch.dashHit) this.hits.add('dash');
    if (this.touch.overHit) this.hits.add('overdrive');
    if (this.touch.pauseHit) this.hits.add('pause');

    // Left stick as menu navigation with repeat
    const nav = this.gpStickNav;
    const ax = this.gpAxes[0], ay = this.gpAxes[1];
    const dir = Math.abs(ax) > 0.6 ? (ax > 0 ? 'right' : 'left') : Math.abs(ay) > 0.6 ? (ay > 0 ? 'down' : 'up') : null;
    if (dir) {
      nav.timer -= dt;
      if (nav.timer <= 0 || nav.dir !== dir) { this.hits.add(dir); nav.timer = nav.dir === dir ? 0.16 : 0.35; }
      nav.dir = dir;
    } else { nav.dir = null; nav.timer = 0; }
  },

  /* Called at the end of the frame */
  endFrame() {
    this.keyHits.clear();
    this.mouse.hitRight = false;
    this.touch.dashHit = this.touch.overHit = this.touch.pauseHit = false;
  },

  hit(action) { return this.hits.has(action); },
  held(action) {
    const a = ACTIONS[action];
    if (a.keys) for (const k of a.keys) if (this.keys.has(k)) return true;
    if (a.gp) for (const b of a.gp) if (this.gpButtons[b]) return true;
    return false;
  },

  moveVector() {
    let x = 0, y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    const lx = this.gpAxes[0], ly = this.gpAxes[1];
    if (Math.hypot(lx, ly) > 0.18) { x += lx; y += ly; }
    if (this.gpButtons[14]) x -= 1;
    if (this.gpButtons[15]) x += 1;
    if (this.gpButtons[12]) y -= 1;
    if (this.gpButtons[13]) y += 1;
    const m = this.touch.move;
    if (m.id !== null) {
      const dx = (m.x - m.ox) / 60, dy = (m.y - m.oy) / 60;
      if (Math.hypot(dx, dy) > 0.12) { x += dx; y += dy; }
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  },

  /* Returns { mode: 'mouse' } | { mode: 'dir', angle } | { mode: 'auto' } */
  aim() {
    if (this.device === 'gp') {
      const rx = this.gpAxes[2], ry = this.gpAxes[3];
      if (Math.hypot(rx, ry) > 0.3) return { mode: 'dir', angle: Math.atan2(ry, rx) };
      return { mode: 'auto' };
    }
    if (this.device === 'touch') {
      const a = this.touch.aim;
      if (a.id !== null && Math.hypot(a.x - a.ox, a.y - a.oy) > 12) return { mode: 'dir', angle: Math.atan2(a.y - a.oy, a.x - a.ox) };
      return { mode: 'auto' };
    }
    return { mode: 'mouse' };
  },

  firing(autofire) {
    if (autofire) return true;
    if (this.mouse.down) return true;
    if (this.gpButtons[7]) return true;
    if (this.device === 'gp' && Math.hypot(this.gpAxes[2], this.gpAxes[3]) > 0.3) return true;
    if (this.touch.aim.id !== null) return true;
    return false;
  },
};
