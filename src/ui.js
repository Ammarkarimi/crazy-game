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
    UI.toast('NEW STICKER!', a.name, a.desc + (a.reward ? `  ·  +${a.reward} 💎` : ''), a.ico);
    Sound.play('achievement');
    Voice.say('New sticker!');
  },
  count() { return ACHIEVEMENTS.filter(a => Save.data.achievements[a.id]).length; },
};

const MENU_PARENTS = {
  hangar: 'title', shop: 'title', achievements: 'title', records: 'title',
  settings: 'title', howto: 'title', credits: 'title',
};

const SETTINGS_UI = [
  { key: 'difficulty', label: '🎮 Difficulty', type: 'seg', options: [['easy', '🐣 Easy'], ['normal', '🙂 Normal'], ['hard', '🔥 Hard']] },
  { key: 'master', label: '🔊 Volume', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'music', label: '🎵 Music', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'sfx', label: '💥 Sounds', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'voice', label: '🗣️ Cheering Voice', type: 'toggle' },
  { key: 'autoAim', label: '🎯 Auto-Aim', type: 'toggle' },
  { key: 'autofire', label: '✨ Auto-Shoot', type: 'toggle' },
  { key: 'breakMins', label: '🧃 Break Reminder', type: 'seg', options: [[0, 'Off'], [15, '15m'], [30, '30m'], [60, '60m']] },
  { key: 'shake', label: '📳 Screen Shake', type: 'range', min: 0, max: 1.5, step: 0.1 },
  { key: 'particles', label: '🎊 Confetti Amount', type: 'range', min: 0.2, max: 1.5, step: 0.1 },
  { key: 'flashes', label: '⚡ Screen Flashes', type: 'toggle' },
  { key: 'damageNumbers', label: '🔢 Damage Numbers', type: 'toggle' },
  { key: 'crt', label: '📺 Retro TV Lines', type: 'toggle' },
  { key: 'showFps', label: '⏱️ Show FPS', type: 'toggle' },
  { key: '_fullscreen', label: '🖥️ Fullscreen', type: 'button' },
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
    if (this.gate) { this.gate.el.remove(); this.gate = null; }
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

  demoLocked() {
    Sound.play('deny');
    this.toast('DEMO', 'Full game only', 'Get the full game for Forever Mode, Daily Surprise and all 20 waves!', '🔒');
  },

  refreshTitle() {
    if (DEMO_MODE) {
      document.getElementById('dailyInfo').textContent = '🔒';
      document.getElementById('endlessInfo').textContent = '🔒';
      document.getElementById('version').textContent = 'v' + VERSION + ' DEMO';
      return;
    }
    const d = Save.data.daily;
    document.getElementById('dailyInfo').textContent = d.key === todayKey() && d.played ? '✔' : 'NEW!';
    const be = Save.data.stats.bestEndlessWave;
    document.getElementById('endlessInfo').textContent = be ? 'best: wave ' + be : '';
  },

  toast(title, name, desc, ico = '⭐') {
    const t = el('div', 'toast', `<div class="ti">${ico}</div><div><div class="tt">${title}</div><div class="tn">${name}</div><div class="td">${desc}</div></div>`);
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), 4200);
  },

  /* Grown-ups-only gate for destructive actions: a sum small kids can't solve yet. */
  parentGate(question, onPass) {
    const a = 6 + Math.floor(Math.random() * 7), b = 5 + Math.floor(Math.random() * 8);
    const answer = a + b;
    const opts = [answer, answer + 3, answer - 2].sort(() => Math.random() - 0.5);
    const el2 = el('section', 'screen active dim', `
      <h2>GROWN-UPS ONLY</h2>
      <p class="sub">${question}</p>
      <p class="hint">To continue, what is <b>${a} + ${b}</b>?</p>
      <div class="row">${opts.map(v => `<button class="btn yellow" data-act="gateAnswer" data-v="${v}">${v}</button>`).join('')}</div>
      <div class="row"><button class="btn" data-act="gateCancel">CANCEL</button></div>`);
    el2.style.zIndex = 20;
    document.getElementById('ui').appendChild(el2);
    this.gate = { el: el2, answer, onPass };
    Sound.play('select');
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
      case 'endless': if (DEMO_MODE) { this.demoLocked(); return; } Sound.play('select'); this.hangarMode = 'endless'; this.show('hangar'); break;
      case 'daily': {
        if (DEMO_MODE) { this.demoLocked(); return; }
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
      case 'seg': {
        const k = t.dataset.key;
        const v = t.dataset.val;
        Save.data.settings[k] = isNaN(+v) ? v : +v;
        Save.save();
        Sound.play('select');
        this.buildSettings(true);
        break;
      }
      case 'diff': {
        Save.data.settings.difficulty = t.dataset.id;
        Save.save();
        Sound.play('select');
        const keep = this.focusIdx;
        this.buildHangar();
        this.focusIdx = keep;
        this.applyFocus();
        break;
      }
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
        this.parentGate('Erase ALL progress, gems, rockets and stickers?', () => {
          Save.reset();
          Sound.play('back');
          this.toast('ALL CLEAN!', 'Starting fresh', 'Your progress was erased.', '🧽');
          this.show('settings');
        });
        break;
      case 'gateAnswer': {
        const g = this.gate;
        if (!g) return;
        const ok = +t.dataset.v === g.answer;
        g.el.remove();
        this.gate = null;
        if (ok) g.onPass(); else Sound.play('deny');
        break;
      }
      case 'gateCancel':
        if (this.gate) { this.gate.el.remove(); this.gate = null; Sound.play('back'); }
        break;
      case 'resume': Sound.play('select'); Game.resume(); break;
      case 'abandon':
        if (!this.confirm(act, t, 'REALLY GO HOME?')) return;
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
    const modeNames = { standard: DEMO_MODE ? 'Demo: play ' + DEMO_WAVES + ' waves!' : 'Cheer up the Grumpies for 20 waves!', endless: 'Forever Mode: how far can you go?' };
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
          ❤️ HEALTH<div class="bar"><i style="width:${Math.min(100, (st.maxHp || 100) / 1.8)}%"></i></div>
          👟 SPEED<div class="bar"><i style="width:${Math.min(100, (st.speed || 290) / 3.6)}%"></i></div>
          💪 POWER<div class="bar"><i style="width:${Math.min(100, power / 1.15)}%"></i></div>
        </div>
        <div class="cost">${owned ? (s.id === sel ? '✔ PICKED!' : 'TAP TO PICK') : '🔒 💎 ' + fmt(s.cost)}</div>`;
      list.appendChild(card);
      const cv = card.querySelector('canvas');
      const c = cv.getContext('2d');
      c.scale(2, 2);
      drawShip(c, s.id, owned ? s.color : '#555a70', 48, 50, -Math.PI / 2, 22, { thrust: owned ? 0.8 : 0 });
    }
    const btn = document.getElementById('btnLaunch');
    btn.disabled = !Save.data.ships[sel];
    const cur = Save.data.settings.difficulty;
    document.getElementById('diffRow').innerHTML = Object.values(DIFFICULTY).map(d =>
      `<button class="btn diff ${d.btn} ${d.id === cur ? 'sel' : ''}" data-act="diff" data-id="${d.id}"><i class="emo">${d.ico}</i>${d.name}</button>`).join('');
    document.getElementById('diffNote').textContent = (DIFFICULTY[cur] || DIFFICULTY.easy).note;
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
      this.toast('NEW ROCKET!', s.name, 'Ready to blast off!', '🚀');
      Voice.say('New rocket!');
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
        <div class="ico">${m.ico}</div>
        <div class="txt"><div class="t">${m.name}</div><div class="d">${m.desc}</div>
          <div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn buy" data-act="buyMeta" data-id="${m.id}" ${cost === null || Save.data.shards < cost ? 'disabled' : ''}>${cost === null ? 'MAX ✔' : '💎 ' + fmt(cost)}</button>`;
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
    document.getElementById('achCount').textContent = `You have ${Achievements.count()} of ${ACHIEVEMENTS.length} stickers!`;
    for (const a of ACHIEVEMENTS) {
      const got = !!Save.data.achievements[a.id];
      const item = el('div', 'sticker' + (got ? ' got' : ''));
      item.innerHTML = `<div class="big">${a.ico}</div><div class="t">${got ? a.name : '???'}</div><div class="d">${a.desc}</div>${a.reward ? `<div class="r">+${a.reward} 💎</div>` : ''}`;
      list.appendChild(item);
    }
  },

  buildRecords() {
    const s = Save.data.stats;
    const stats = [
      ['🏆 BEST SCORE', fmt(s.bestScore)], ['🌊 BEST WAVE', s.bestWave], ['♾️ FOREVER BEST', s.bestEndlessWave || '-'],
      ['🎮 GAMES', s.runs], ['👑 WINS', s.wins], ['😊 GRUMPIES CHEERED', fmt(s.kills)],
      ['🐝 BIG GRUMPIES', s.bossKills], ['🌈 RAINBOWS', s.overdrives], ['💎 GEMS FOUND', fmt(s.shardsEarned)],
      ['⏱️ PLAY TIME', fmtTime(s.playTime)], ['⭐ STICKERS', `${Achievements.count()}/${ACHIEVEMENTS.length}`], ['🎉 SURPRISES', s.events],
    ];
    document.getElementById('recStats').innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    const hs = Save.data.highscores;
    document.getElementById('recList').innerHTML = hs.length
      ? hs.map((h, i) => `<div class="rec"><span class="r">${['🥇', '🥈', '🥉'][i] || '#' + (i + 1)}</span><span>${fmt(h.score)}</span><span>Wave ${h.wave}</span><span>${h.ship}</span><span class="d">${(DIFFICULTY[h.diff] || { ico: '' }).ico} ${{ standard: 'PLAY', endless: 'FOREVER', daily: 'DAILY' }[h.mode] || ''}</span></div>`).join('')
      : '<p class="sub">No games yet. Let\'s go play! 🚀</p>';
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
      } else if (o.type === 'seg') {
        row.innerHTML = `<label>${o.label}</label><div class="seg">${o.options.map(([v, l]) =>
          `<button class="btn ${String(s[o.key]) === String(v) ? 'on primary' : ''}" data-act="seg" data-key="${o.key}" data-val="${v}">${l}</button>`).join('')}</div>`;
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
      ? ids.map(id => { const u = UPGRADE_BY_ID[id]; return `<span class="chip ${u.r}"><i class="emo">${u.ico}</i>${u.name}${W.upgrades[id] > 1 ? ' ×' + W.upgrades[id] : ''}</span>`; }).join('')
      : '<span class="sub">No powers yet. Grab some stars! ⭐</span>';
    document.getElementById('pauseNote').textContent = this.pauseNote || '';
    this.pauseNote = '';
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
        <div class="clvl">${u.id[0] === '_' ? '' : u.max === 1 ? '✨ ONE OF A KIND' : '●'.repeat(have) + '<b style="color:var(--green)">●</b>' + '○'.repeat(Math.max(0, u.max - have - 1))}</div>`;
      wrap.appendChild(c);
    });
    const rb = document.getElementById('btnReroll');
    rb.innerHTML = `<i class="emo">🎲</i>NEW CARDS <small>${W.rerolls} left</small>`;
    rb.disabled = W.rerolls <= 0;
    document.getElementById('lvlSub').textContent = `You are level ${W.level - W.pendingLevels + 1}! Pick a super power!`;
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
    const demoDone = DEMO_MODE && r.victory;
    const stars = r.victory ? 3 : 1 + (W.wave >= 5 ? 1 : 0) + (W.wave >= 12 ? 1 : 0);
    const titles = { 1: 'GOOD TRY!', 2: 'GREAT JOB!', 3: 'AMAZING!' };
    const title = demoDone ? 'DEMO DONE!' : r.victory ? 'YOU DID IT!' : titles[stars];
    const gt = document.getElementById('goTitle');
    gt.textContent = title;
    gt.style.color = r.victory ? 'var(--yel)' : '';
    document.getElementById('goStars').innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}">⭐</span>`).join('');
    const cheers = [
      'You are getting better every time!', 'The Grumpies are scared of you now!', 'So close! One more go?',
      'What a pilot! Try again?', 'Your rocket is proud of you!', 'High five! ✋',
    ];
    document.getElementById('goSub').textContent = demoDone
      ? 'Thanks for playing! 15 more waves, 3 more Big Grumpies, Forever Mode and Daily Surprises are in the full game!'
      : r.victory ? 'You cheered up King Grumpus! You are a SUPERSTAR!' + (r.isNewBest ? ' New best score!' : '')
        : (r.isNewBest ? 'NEW BEST SCORE! ' : '') + cheers[Math.floor(Math.random() * cheers.length)];
    const stats = [
      ['⭐ POINTS', fmt(W.score)], ['😊 GRUMPIES CHEERED', fmt(W.kills)], ['🔥 BEST COMBO', W.maxCombo],
      ['🌊 WAVE', W.wave], ['⏱️ TIME', fmtTime(W.realT)], ['🌈 RAINBOWS', W.odCount],
    ];
    document.getElementById('goStats').innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    document.getElementById('goShards').textContent = fmt(r.earned);
    document.getElementById('btnContinue').hidden = !(r.victory && W.mode !== 'endless') || DEMO_MODE;
    this.show('gameover');
    setTimeout(() => {
      for (let i = 0; i < stars; i++) setTimeout(() => Sound.play('shard'), 350 * i + 100);
      if (stars === 3) setTimeout(() => Sound.play('cheer'), 1150);
    }, 200);
    Voice.say(r.victory ? 'You are a superstar!' : title.toLowerCase(), true);
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
