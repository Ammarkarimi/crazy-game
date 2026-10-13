'use strict';
/* Keyboard (1 or 2 players), gamepads and touch, turned into fighter controllers. */

const KEYMAP = {
  solo: {
    up: ['KeyW', 'ArrowUp', 'Space'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    attack: ['KeyJ', 'KeyZ'], kick: ['KeyK', 'KeyX'], throw: ['KeyL', 'KeyC'], heavy: ['KeyU', 'KeyV'], magic: ['KeyI', 'KeyB'], roll: ['KeyO', 'ShiftLeft', 'ShiftRight'],
  },
  p1: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    attack: ['KeyJ'], kick: ['KeyK'], throw: ['KeyL'], heavy: ['KeyU'], magic: ['KeyI'], roll: ['KeyO', 'ShiftLeft'],
  },
  p2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    attack: ['Numpad1', 'KeyN'], kick: ['Numpad2', 'KeyM'], throw: ['Numpad3', 'Comma'], heavy: ['Numpad4', 'Period'], magic: ['Numpad5', 'Slash'], roll: ['Numpad0', 'ShiftRight'],
  },
};
const CTRL_KEYS = ['up', 'down', 'left', 'right', 'attack', 'kick', 'throw', 'heavy', 'magic', 'roll'];

const Input = {
  keys: new Set(),
  prev: [{}, {}],
  touch: { active: false, dir: { up: false, down: false, left: false, right: false }, btn: {} },
  touchMode: false,
  stick: null,

  init() {
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && Game.inMatch()) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.initTouch();
  },

  pads() {
    const out = [];
    if (!navigator.getGamepads) return out;
    for (const p of navigator.getGamepads()) if (p && p.connected) out.push(p);
    return out;
  },

  readPad(p, h) {
    const b = i => p.buttons[i] && p.buttons[i].pressed;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    h.left = h.left || ax < -0.45 || b(14);
    h.right = h.right || ax > 0.45 || b(15);
    h.up = h.up || ay < -0.6 || b(12) || b(0);
    h.down = h.down || ay > 0.55 || b(13);
    h.attack = h.attack || b(2);
    h.kick = h.kick || b(3);
    h.roll = h.roll || b(1);
    h.throw = h.throw || b(5);
    h.heavy = h.heavy || b(4);
    h.magic = h.magic || b(7) || b(6);
  },

  /* Build controllers for this frame. mode: 'solo' or 'versus'. */
  poll(mode) {
    const pads = this.pads();
    const hs = [{}, {}];
    for (const k of CTRL_KEYS) { hs[0][k] = false; hs[1][k] = false; }
    const map = mode === 'versus' ? [KEYMAP.p1, KEYMAP.p2] : [KEYMAP.solo, null];
    for (let i = 0; i < 2; i++) {
      if (!map[i]) continue;
      for (const k of CTRL_KEYS) hs[i][k] = map[i][k].some(c => this.keys.has(c));
    }
    if (mode === 'versus') {
      if (pads.length >= 2) { this.readPad(pads[0], hs[0]); this.readPad(pads[1], hs[1]); }
      else if (pads.length === 1) this.readPad(pads[0], hs[1]);
    } else for (const p of pads) this.readPad(p, hs[0]);
    if (this.touchMode && mode !== 'versus') {
      const t = this.touch;
      for (const k of ['up', 'down', 'left', 'right']) hs[0][k] = hs[0][k] || t.dir[k];
      for (const k of ['attack', 'kick', 'throw', 'heavy', 'magic', 'roll']) hs[0][k] = hs[0][k] || !!t.btn[k];
    }
    const out = [];
    for (let i = 0; i < 2; i++) {
      const c = { h: hs[i], p: {} };
      for (const k of CTRL_KEYS) c.p[k] = hs[i][k] && !this.prev[i][k];
      this.prev[i] = Object.assign({}, hs[i]);
      out.push(c);
    }
    return out;
  },

  /* ---------- touch: virtual stick on the left, buttons on the right ---------- */
  initTouch() {
    const root = document.getElementById('touch');
    if (!root) return;
    const stickEl = document.getElementById('tStick'), knob = document.getElementById('tKnob');
    let stickId = null, cx = 0, cy = 0;
    const R = () => stickEl.offsetWidth * 0.42;
    const setDir = (dx, dy) => {
      const r = R(), d = this.touch.dir;
      d.left = dx < -r * 0.35; d.right = dx > r * 0.35; d.up = dy < -r * 0.55; d.down = dy > r * 0.5;
      const m = Math.hypot(dx, dy), k = m > r ? r / m : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    };
    const zone = document.getElementById('tZone');
    zone.addEventListener('pointerdown', e => {
      this.touchMode = true; stickId = e.pointerId;
      const rect = stickEl.getBoundingClientRect();
      cx = rect.left + rect.width / 2; cy = rect.top + rect.height / 2;
      if (e.clientX > rect.right + 40 || e.clientY < rect.top - 80) { // re-centre the stick where the thumb lands
        stickEl.style.left = (e.clientX - rect.width / 2) + 'px'; stickEl.style.top = (e.clientY - rect.height / 2) + 'px'; stickEl.style.bottom = 'auto';
        cx = e.clientX; cy = e.clientY;
      }
      setDir(e.clientX - cx, e.clientY - cy);
      zone.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === stickId) setDir(e.clientX - cx, e.clientY - cy); });
    const end = e => { if (e.pointerId === stickId) { stickId = null; setDir(0, 0); } };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    for (const el of root.querySelectorAll('[data-btn]')) {
      const k = el.dataset.btn;
      el.addEventListener('pointerdown', e => { this.touchMode = true; this.touch.btn[k] = true; el.classList.add('on'); el.setPointerCapture(e.pointerId); e.preventDefault(); });
      const up = () => { this.touch.btn[k] = false; el.classList.remove('on'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    }
    window.addEventListener('touchstart', () => { this.touchMode = true; }, { passive: true });
  },
};
