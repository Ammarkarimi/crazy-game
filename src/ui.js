'use strict';
/* ==========================================================================
   DOM menus: title, hangar, upgrade shop, achievements, records, settings,
   pause, level-up cards, game over. Fully navigable by mouse, keyboard,
   gamepad and touch.
   ========================================================================== */

const Achievements = {
  unlock(id) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a || Save.data.achievements[id]) return;
    Save.data.achievements[id] = todayKey();
    Save.data.shards += a.reward;
    Save.save();
    UI.toast('ACHIEVEMENT UNLOCKED', a.name, a.desc + (a.reward ? `  ·  +${a.reward} ◆` : ''));
    Sound.play('achievement');
  },
  count() { return ACHIEVEMENTS.filter(a => Save.data.achievements[a.id]).length; },
};

const MENU_PARENTS = {
  hangar: 'title', shop: 'title', achievements: 'title', records: 'title',
  settings: 'title', howto: 'title', credits: 'title',
};

const SETTINGS_UI = [
  { key: 'master', label: 'Master Volume', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'music', label: 'Music', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'sfx', label: 'Sound Effects', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'shake', label: 'Screen Shake', type: 'range', min: 0, max: 1.5, step: 0.1 },
  { key: 'particles', label: 'Particles', type: 'range', min: 0.2, max: 1.5, step: 0.1 },
  { key: 'autofire', label: 'Auto-Fire', type: 'toggle' },
  { key: 'damageNumbers', label: 'Damage Numbers', type: 'toggle' },
  { key: 'flashes', label: 'Screen Flashes', type: 'toggle' },
  { key: 'crt', label: 'CRT Scanlines', type: 'toggle' },
  { key: 'showFps', label: 'Show FPS', type: 'toggle' },
  { key: '_fullscreen', label: 'Fullscreen', type: 'button' },
];

const UI = {
  current: null,
  focusIdx: 0,
  navActive: false,
  hangarMode: 'standard',
  selectedShip: null,
  levelChoices: [],
  shownAt: 0,
  settingsFrom: 'title',
  confirmAct: null,
  confirmTimer: null,

  init() {
    const root = document.getElementById('ui');
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t || t.disabled) return;
      e.preventDefault();
      this.action(t.dataset.act, t);
    });
    let lastHover = null;
    root.addEventListener('mouseover', e => {
      const t = e.target.closest('.btn, .card, .ship');
      if (t && t !== lastHover && !t.disabled) { Sound.play('hover'); this.navActive = false; this.clearFocus(); }
      lastHover = t;
    });
    root.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.key) {
        Save.data.settings[t.dataset.key] = parseFloat(t.value);
        Sound.applyVolumes();
      }
    });
    root.addEventListener('change', e => { if (e.target.dataset.key) Save.save(); });

    document.getElementById('version').textContent = 'v' + VERSION;
    document.getElementById('creditsStudio').textContent = STUDIO_NAME;
    if (window.hyperchaosDesktop) document.getElementById('btnQuit').hidden = false;
  },

  applySettings() {
    document.body.classList.toggle('no-crt', !Save.data.settings.crt);
  },

  /* ---------------- screen management ---------------- */
  show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
    const scr = document.getElementById('scr-' + id);
    if (!scr) return;
    scr.classList.add('active');
    this.current = id;
    if (!W && Game.state !== 'boot') Game.state = 'menu';
    switch (id) {
      case 'title': this.refreshTitle(); break;
      case 'hangar': this.buildHangar(); break;
      case 'shop': this.buildShop(); break;
      case 'achievements': this.buildAchievements(); break;
      case 'records': this.buildRecords(); break;
      case 'settings': this.buildSettings(); break;
    }
    this.refreshWallet();
    this.focusIdx = 0;
    this.applyFocus();
    this.shownAt = performance.now();
  },

  hideAll() {
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
    this.current = null;
  },

  back() {
    if (this.current === 'settings' && this.settingsFrom === 'pause') { this.show('pause'); return; }
    const parent = MENU_PARENTS[this.current];
    if (parent) { Sound.play('back'); this.show(parent); }
  },

  refreshWallet() {
    for (const e of document.querySelectorAll('.shards')) e.textContent = fmt(Save.data.shards);
  },

  refreshTitle() {
    const d = Save.data.daily;
    document.getElementById('dailyInfo').textContent = d.key === todayKey() && d.played ? 'BEST ' + fmt(d.best) : 'NEW';
    const be = Save.data.stats.bestEndlessWave;
    document.getElementById('endlessInfo').textContent = be ? 'BEST WAVE ' + be : '';
  },

  toast(title, name, desc) {
    const t = el('div', 'toast', `<div class="tt">${title}</div><div class="tn">${name}</div><div class="td">${desc}</div>`);
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), 4200);
  },

  confirm(act, btn, label) {
    if (this.confirmAct === act) {
      this.confirmAct = null;
      clearTimeout(this.confirmTimer);
      return true;
    }
    this.confirmAct = act;
    const orig = btn.innerHTML;
    btn.innerHTML = label;
    clearTimeout(this.confirmTimer);
    this.confirmTimer = setTimeout(() => { this.confirmAct = null; btn.innerHTML = orig; }, 2500);
    Sound.play('deny');
    return false;
  },

  /* ---------------- actions ---------------- */
  action(act, t) {
    switch (act) {
      case 'boot':
        Sound.unlock();
        Music.start('menu');
        Game.state = 'menu';
        Sound.play('select');
        this.show(Save.data.seenHowTo ? 'title' : 'howto');
        if (!Save.data.seenHowTo) { Save.data.seenHowTo = true; Save.save(); }
        break;
      case 'play': Sound.play('select'); this.hangarMode = 'standard'; this.show('hangar'); break;
      case 'endless': Sound.play('select'); this.hangarMode = 'endless'; this.show('hangar'); break;
      case 'daily': {
        Sound.play('select');
        const ship = SHIPS[hashString('ship' + todayKey()) % SHIPS.length];
        Game.startRun('daily', ship.id);
        break;
      }
      case 'shop': case 'achievements': case 'records': case 'howto': case 'credits':
        Sound.play('select'); this.show(act); break;
      case 'settings':
        Sound.play('select');
        this.settingsFrom = this.current === 'pause' ? 'pause' : 'title';
        this.show('settings');
        break;
      case 'back': this.back(); break;
      case 'ship': this.clickShip(t.dataset.id, t); break;
      case 'launch': {
        const id = this.selectedShip || Save.data.selectedShip;
        if (!Save.data.ships[id]) { Sound.play('deny'); return; }
        Save.data.selectedShip = id;
        Save.save();
        Sound.play('select');
        Game.startRun(this.hangarMode, id);
        break;
      }
      case 'buyMeta': this.buyMeta(t.dataset.id); break;
      case 'toggle': {
        const k = t.dataset.key;
        Save.data.settings[k] = !Save.data.settings[k];
        Save.save();
        this.applySettings();
        Sound.play('select');
        this.buildSettings(true);
        break;
      }
      case 'fullscreen': {
        const d = document;
        if (window.hyperchaosDesktop && window.hyperchaosDesktop.toggleFullscreen) window.hyperchaosDesktop.toggleFullscreen();
        else if (!d.fullscreenElement) d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {});
        else d.exitFullscreen && d.exitFullscreen();
        Sound.play('select');
        break;
      }
      case 'resetSave':
        if (!this.confirm(act, t, 'CLICK AGAIN TO ERASE')) return;
        Save.reset();
        Sound.play('back');
        this.toast('PROGRESS', 'Save data erased', 'A fresh start.');
        this.show('settings');
        break;
      case 'resume': Sound.play('select'); Game.resume(); break;
      case 'abandon':
        if (!this.confirm(act, t, 'CONFIRM ABANDON?')) return;
        Game.endRun(false);
        break;
      case 'pick': this.pick(parseInt(t.dataset.i, 10), true); break;
      case 'reroll': this.reroll(); break;
      case 'skipUpgrade':
        if (performance.now() - this.shownAt < 300) return;
        W.shards += 5;
        W.pendingLevels--;
        Sound.play('back');
        if (W.pendingLevels > 0) this.showLevelUp(rollUpgrades(3 + W.player.extraChoice));
        else Game.resume();
        break;
      case 'menu': Sound.play('back'); Game.quitToMenu(); break;
      case 'retry': Sound.play('select'); Game.startRun(W.startMode, W.ship.id); break;
      case 'continueEndless': Sound.play('select'); Game.continueEndless(); break;
      case 'quit': if (window.hyperchaosDesktop) window.hyperchaosDesktop.quit(); break;
    }
  },

  /* ---------------- hangar ---------------- */
  buildHangar() {
    const modeNames = { standard: 'STANDARD · Survive 20 waves', endless: 'ENDLESS · No limits, no mercy' };
    document.getElementById('hangarMode').textContent = modeNames[this.hangarMode] || '';
    const list = document.getElementById('shipList');
    list.innerHTML = '';
    const sel = this.selectedShip || Save.data.selectedShip;
    for (const s of SHIPS) {
      const owned = !!Save.data.ships[s.id];
      const st = s.stats;
      const power = (st.damage || 10) * (st.fireRate || 6) * (st.shots || 1);
      const card = el('div', 'ship' + (owned ? '' : ' locked') + (s.id === sel ? ' sel' : ''));
      card.dataset.act = 'ship';
      card.dataset.id = s.id;
      card.innerHTML = `
        <canvas width="192" height="192"></canvas>
        <div class="name" style="color:${s.color}">${s.name}</div>
        <div class="desc">${s.desc}</div>
        <div class="bars">
          HULL<div class="bar"><i style="width:${Math.min(100, (st.maxHp || 100) / 1.8)}%"></i></div>
          SPEED<div class="bar"><i style="width:${Math.min(100, (st.speed || 290) / 3.6)}%"></i></div>
          FIREPOWER<div class="bar"><i style="width:${Math.min(100, power / 1.15)}%"></i></div>
        </div>
        <div class="cost">${owned ? (s.id === sel ? 'SELECTED' : 'OWNED') : '◆ ' + fmt(s.cost)}</div>`;
      list.appendChild(card);
      const cv = card.querySelector('canvas');
      const c = cv.getContext('2d');
      c.scale(2, 2);
      drawShip(c, s.id, owned ? s.color : '#555a70', 48, 50, -Math.PI / 2, 22, { thrust: owned ? 0.8 : 0 });
    }
    const btn = document.getElementById('btnLaunch');
    btn.disabled = !Save.data.ships[sel];
  },

  clickShip(id, t) {
    const s = SHIPS.find(x => x.id === id);
    if (Save.data.ships[id]) {
      this.selectedShip = id;
      Save.data.selectedShip = id;
      Save.save();
      Sound.play('select');
    } else if (Save.data.shards >= s.cost) {
      Save.data.shards -= s.cost;
      Save.data.ships[id] = true;
      this.selectedShip = id;
      Save.data.selectedShip = id;
      Save.save();
      Sound.play('buy');
      this.toast('NEW SHIP', s.name, 'Ready for launch.');
      if (SHIPS.every(x => Save.data.ships[x.id])) Achievements.unlock('allships');
    } else {
      Sound.play('deny');
      t.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 200 });
      return;
    }
    const keep = this.focusIdx;
    this.buildHangar();
    this.refreshWallet();
    this.focusIdx = keep;
    this.applyFocus();
  },

  /* ---------------- shop ---------------- */
  buildShop() {
    const list = document.getElementById('shopList');
    list.innerHTML = '';
    for (const m of META) {
      const lvl = Save.data.meta[m.id] || 0;
      const max = m.cost.length;
      const cost = lvl < max ? m.cost[lvl] : null;
      const item = el('div', 'item');
      item.innerHTML = `
        <div class="ico" style="color:var(--cyan)">${m.ico}</div>
        <div class="txt"><div class="t">${m.name}</div><div class="d">${m.desc}</div>
          <div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn buy" data-act="buyMeta" data-id="${m.id}" ${cost === null || Save.data.shards < cost ? 'disabled' : ''}>${cost === null ? 'MAX' : '◆ ' + fmt(cost)}</button>`;
      list.appendChild(item);
    }
  },

  buyMeta(id) {
    const m = META.find(x => x.id === id);
    const lvl = Save.data.meta[id] || 0;
    if (lvl >= m.cost.length || Save.data.shards < m.cost[lvl]) { Sound.play('deny'); return; }
    Save.data.shards -= m.cost[lvl];
    Save.data.meta[id] = lvl + 1;
    Save.save();
    Sound.play('buy');
    const keep = this.focusIdx;
    this.buildShop();
    this.refreshWallet();
    this.focusIdx = keep;
    this.applyFocus();
  },

  /* ---------------- achievements / records ---------------- */
  buildAchievements() {
    const list = document.getElementById('achList');
    list.innerHTML = '';
    document.getElementById('achCount').textContent = `${Achievements.count()} / ${ACHIEVEMENTS.length} unlocked`;
    for (const a of ACHIEVEMENTS) {
      const got = !!Save.data.achievements[a.id];
      const item = el('div', 'item ' + (got ? 'unlocked' : 'locked'));
      item.innerHTML = `
        <div class="ico" style="color:${got ? 'var(--yel)' : 'var(--muted)'}">${got ? '★' : '?'}</div>
        <div class="txt"><div class="t">${a.name}</div><div class="d">${a.desc}</div>
        <div class="d" style="color:var(--yel)">${a.reward ? '+' + a.reward + ' ◆' : ''}${got ? ' · unlocked ' + Save.data.achievements[a.id] : ''}</div></div>`;
      list.appendChild(item);
    }
  },

  buildRecords() {
    const s = Save.data.stats;
    const stats = [
      ['BEST SCORE', fmt(s.bestScore)], ['BEST WAVE', s.bestWave], ['BEST ENDLESS', s.bestEndlessWave || '-'],
      ['RUNS', s.runs], ['VICTORIES', s.wins], ['TOTAL KILLS', fmt(s.kills)],
      ['BOSSES SLAIN', s.bossKills], ['OVERDRIVES', s.overdrives], ['SHARDS EARNED', fmt(s.shardsEarned)],
      ['PLAY TIME', fmtTime(s.playTime)], ['ACHIEVEMENTS', `${Achievements.count()}/${ACHIEVEMENTS.length}`], ['CHAOS EVENTS', s.events],
    ];
    document.getElementById('recStats').innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    const hs = Save.data.highscores;
    document.getElementById('recList').innerHTML = hs.length
      ? hs.map((h, i) => `<div class="rec"><span class="r">#${i + 1}</span><span>${fmt(h.score)}</span><span>W${h.wave}</span><span>${h.ship}</span><span class="d">${h.mode.toUpperCase()}</span></div>`).join('')
      : '<p class="sub">No runs yet. Go make some chaos!</p>';
  },

  /* ---------------- settings ---------------- */
  buildSettings(keepFocus) {
    const list = document.getElementById('setList');
    const keep = this.focusIdx;
    list.innerHTML = '';
    const s = Save.data.settings;
    for (const o of SETTINGS_UI) {
      const row = el('div', 'set');
      if (o.type === 'range') {
        row.innerHTML = `<label>${o.label}</label><input type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${s[o.key]}" data-key="${o.key}">`;
      } else if (o.type === 'toggle') {
        row.innerHTML = `<label>${o.label}</label><button class="btn toggle ${s[o.key] ? 'on' : ''}" data-act="toggle" data-key="${o.key}">${s[o.key] ? 'ON' : 'OFF'}</button>`;
      } else {
        row.innerHTML = `<label>${o.label}</label><button class="btn toggle" data-act="fullscreen">TOGGLE</button>`;
      }
      list.appendChild(row);
    }
    if (keepFocus) { this.focusIdx = keep; this.applyFocus(); }
  },

  /* ---------------- in-run screens ---------------- */
  showPause() {
    const b = document.getElementById('pauseBuild');
    const ids = Object.keys(W.upgrades);
    b.innerHTML = ids.length
      ? ids.map(id => { const u = UPGRADE_BY_ID[id]; return `<span class="chip ${u.r}">${u.ico} ${u.name}${W.upgrades[id] > 1 ? ' ×' + W.upgrades[id] : ''}</span>`; }).join('')
      : '<span class="sub">No upgrades yet</span>';
    this.show('pause');
  },

  showLevelUp(choices) {
    this.levelChoices = choices;
    const wrap = document.getElementById('cards');
    wrap.innerHTML = '';
    choices.forEach((u, i) => {
      const have = W.upgrades[u.id] || 0;
      const c = el('div', 'card ' + u.r);
      c.dataset.act = 'pick';
      c.dataset.i = i;
      c.innerHTML = `
        <span class="key">${i + 1}</span>
        ${have === 0 && u.id[0] !== '_' ? '<span class="new">NEW</span>' : ''}
        <div class="rar">${RARITY[u.r].label}</div>
        <div class="cico">${u.ico}</div>
        <div class="cname">${u.name}</div>
        <div class="cdesc">${u.desc}</div>
        <div class="clvl">${u.id[0] === '_' ? '' : u.max === 1 ? 'UNIQUE' : `LV ${have} → ${have + 1} / ${u.max}`}</div>`;
      wrap.appendChild(c);
    });
    const rb = document.getElementById('btnReroll');
    rb.innerHTML = `REROLL <small>${W.rerolls} left</small>`;
    rb.disabled = W.rerolls <= 0;
    document.getElementById('lvlSub').textContent = `Level ${W.level - W.pendingLevels + 1} · choose an upgrade`;
    this.show('levelup');
  },

  pick(i, fromClick) {
    if (performance.now() - this.shownAt < (fromClick ? 250 : 450)) return;
    const u = this.levelChoices[i];
    if (!u) return;
    this.shownAt = performance.now();
    Game.chooseUpgrade(u);
  },

  reroll() {
    if (!W || W.rerolls <= 0) { Sound.play('deny'); return; }
    if (performance.now() - this.shownAt < 250) return;
    W.rerolls--;
    Sound.play('select');
    this.showLevelUp(rollUpgrades(3 + W.player.extraChoice));
  },

  showGameOver(r) {
    document.getElementById('goTitle').textContent = r.victory ? 'VICTORY!' : 'GAME OVER';
    document.getElementById('goTitle').style.color = r.victory ? 'var(--yel)' : '';
    const modeTxt = { standard: 'Standard', endless: 'Endless', daily: 'Daily Chaos ' + todayKey() }[W.mode];
    document.getElementById('goSub').textContent =
      `${modeTxt} · ${W.ship.name} · Wave ${W.wave} · Level ${W.level}` + (r.isNewBest ? '  ·  NEW BEST SCORE!' : r.rank === 0 ? '' : '');
    const stats = [
      ['SCORE', fmt(W.score)], ['KILLS', fmt(W.kills)], ['MAX COMBO', W.maxCombo],
      ['TIME', fmtTime(W.realT)], ['DAMAGE DEALT', fmt(W.stats.damage)], ['BOSSES', W.bossKills],
      ['OVERDRIVES', W.odCount], ['UPGRADES', Object.values(W.upgrades).reduce((a, b) => a + b, 0)],
    ];
    document.getElementById('goStats').innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    document.getElementById('goShards').textContent = fmt(r.earned);
    document.getElementById('btnContinue').hidden = !(r.victory && W.mode !== 'endless');
    this.show('gameover');
  },

  /* ---------------- keyboard / gamepad navigation ---------------- */
  focusables() {
    if (!this.current) return [];
    const scr = document.getElementById('scr-' + this.current);
    return [...scr.querySelectorAll('.btn, .card, .ship, input[type=range]')].filter(e => !e.disabled && !e.hidden && e.offsetParent !== null);
  },

  clearFocus() {
    for (const e of document.querySelectorAll('.focus')) e.classList.remove('focus');
  },

  applyFocus() {
    this.clearFocus();
    if (!this.navActive) return;
    const f = this.focusables();
    if (!f.length) return;
    this.focusIdx = (this.focusIdx + f.length) % f.length;
    const e = f[this.focusIdx];
    e.classList.add('focus');
    if (e.scrollIntoView) e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  },

  update() {
    if (!this.current) return;
    const cur = this.current;

    if (cur === 'boot') {
      if (Input.keyHits.size || Input.hit('confirm')) this.action('boot');
      return;
    }
    if (cur === 'levelup') {
      for (let i = 0; i < 4; i++) if (Input.hit('pick' + (i + 1))) this.pick(i, false);
      if (Input.hit('reroll')) this.reroll();
    }
    if (cur === 'pause' && (Input.hit('pause') || Input.hit('back'))) { Game.resume(); return; }
    if (Input.hit('back') && MENU_PARENTS[cur]) { this.back(); return; }

    const nav = ['up', 'down', 'left', 'right'].find(d => Input.hit(d));
    const confirm = Input.hit('confirm') || (Input.keyHits.has('Space') && this.navActive);
    if (nav || confirm) {
      if (!this.navActive) {
        this.navActive = true;
        this.applyFocus();
        if (!confirm) return;
      }
    }
    const f = this.focusables();
    if (!f.length) return;
    const focused = f[this.focusIdx % f.length];
    if (nav) {
      if (focused && focused.type === 'range' && (nav === 'left' || nav === 'right')) {
        const step = parseFloat(focused.step) || 0.1;
        focused.value = clamp(parseFloat(focused.value) + (nav === 'right' ? step : -step), parseFloat(focused.min), parseFloat(focused.max));
        focused.dispatchEvent(new Event('input', { bubbles: true }));
        focused.dispatchEvent(new Event('change', { bubbles: true }));
        Sound.play('hover');
        return;
      }
      this.focusIdx += nav === 'up' || nav === 'left' ? -1 : 1;
      this.applyFocus();
      Sound.play('hover');
    }
    if (confirm && focused && this.navActive && focused.type !== 'range') {
      if ((cur === 'levelup') && performance.now() - this.shownAt < 450) return;
      focused.click();
    }
  },
};
