'use strict';
/* Menus, previews, rewards and achievements. */

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const coinsHtml = n => `<span class="coin">${fmt(n)}</span>`;
const gemsHtml = n => `<span class="gem">${fmt(n)}</span>`;
const priceHtml = it => it.gems ? gemsHtml(it.gems) : coinsHtml(it.price);
const starsHtml = (lvl, max = MAX_ITEM_LEVEL) => `<span class="stars">${'★'.repeat(lvl)}<span class="off">${'★'.repeat(max - lvl)}</span></span>`;

/* ---------- animated fighter previews ---------- */
const PREVIEW_STUB = {
  onMoveStart() {}, onMoveActive() {}, onLand() {}, checkHit() {}, sfx() {}, dot() {}, onReappear() {},
  fx: { dust() {}, burst() {} },
};
class Preview {
  constructor(canvas, fighterId, gear, opts = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts;
    this.t = randi(0, 60);
    this.set(fighterId, gear);
  }
  set(fighterId, gear) {
    this.f = new Fighter({ fighter: fighterId, gear, eyeColor: this.opts.eye || '#ffffff' });
    this.f.resetRound(0, this.opts.face || 1);
    this.f.setState('idle');
    this.f.pose = Object.assign({}, CLASS_STANCE[this.f.cls]);
    this.opp = { x: (this.opts.face || 1) * 1000, y: 0 };
    this.combo = 0;
  }
  tick() {
    const f = this.f;
    this.t++;
    const c = newController();
    if (f.state === 'idle' && this.t % 150 === 90 && !this.opts.still) {
      const seq = ['light1', 'heavy', 'kick', 'lunge', 'rising', 'sidekick'];
      f.startMove(this.combo ? 'light1' : seq[randi(0, seq.length - 1)], PREVIEW_STUB);
      this.combo = 0;
    }
    if (f.state === 'attack' && f.move.chain && f.moveT > f.move.startup + f.move.active && chance(0.08)) c.p.attack = true;
    f.update(c, this.opp, PREVIEW_STUB);
    f.x = 0; f.vx = 0;
    f.updateChains(0.12);
  }
  draw() {
    const cv = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const z = (h * dpr) / 235 * (this.opts.zoom || 1);
    const gy = h * dpr * 0.93;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(w * dpr / 2, gy, 70 * z, 10 * z, 0, 0, TAU); ctx.fill();
    ctx.setTransform(z, 0, 0, -z, w * dpr / 2, gy);
    const f = this.f;
    Match.prototype.drawTrail.call({}, ctx, f);
    for (const c of f.chains) c.ch.draw(ctx, c.ch.color || f.inkColor());
    Render.fighter(ctx, f);
  }
}

/* ---------- achievements ---------- */
const Honors = {
  unlock(id) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a || Save.data.achievements[id]) return false;
    Save.data.achievements[id] = Date.now();
    Save.data.gems += 5;
    Save.save();
    UI.toast(`HONOR: ${a.name}`, `${a.desc}  +5 gems`);
    Sound.play('achievement');
    UI.updateWallet();
    return true;
  },
};

const UI = {
  current: 'boot',
  history: [],
  previews: [],
  rivalTier: 'all', rivalSel: null, rivalRounds: null, rivalStage: -1,
  forgeSlot: 'weapon', forgeSel: null,
  vs: { a: 0, b: 1, stage: -1, rounds: 3 },
  focusEl: null,

  init() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t || t.disabled) return;
      Sound.unlock();
      this.act(t.dataset.act, t);
    });
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('.btn, .card, .item, .tab');
      if (t && t !== this.lastHover && !t.disabled) { this.lastHover = t; Sound.play('hover'); }
    });
    window.addEventListener('keydown', e => this.key(e));
    $('verLabel').textContent = `v${VERSION}${DEMO_MODE ? ' DEMO' : ''} · ${STUDIO_NAME}`;
    if (window.umbraDesktop) $('btnQuit').hidden = false;
  },

  show(id, push = true) {
    if (push && this.current && this.current !== id) this.history.push(this.current);
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
    const scr = $('scr-' + id);
    scr.classList.add('active');
    this.current = id;
    this.previews = [];
    const builders = { title: 'buildTitle', rivals: 'buildRivals', dojo: 'buildDojo', forge: 'buildForge', versus: 'buildVersus', settings: 'buildSettings', howto: 'buildHowto', achievements: 'buildHonors', pause: 'buildPause' };
    if (builders[id]) this[builders[id]]();
    $('wallet').hidden = !['title', 'rivals', 'dojo', 'forge', 'results'].includes(id);
    this.updateWallet();
    this.setFocus(null);
    document.querySelectorAll('.gate').forEach(g => g.remove());
  },

  back() {
    Sound.play('back');
    if (this.current === 'pause') { Game.resume(); return; }
    const prev = this.history.pop() || 'title';
    this.show(prev === 'boot' ? 'title' : prev, false);
  },

  home() { this.history = []; this.show('title', false); },

  updateWallet() { $('wCoins').textContent = fmt(Save.data.coins); $('wGems').textContent = fmt(Save.data.gems); },

  toast(title, sub) {
    const t = el('div', 'toast', `<b>${title}</b><span>${sub || ''}</span>`);
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3700);
  },

  tickPreviews() { for (const p of this.previews) { p.tick(); p.draw(); } },

  myPower() { const id = Save.data.fighter; return powerRating(FIGHTERS.find(f => f.id === id), Save.gearFor(id)); },

  /* ---------- actions ---------- */
  act(a, t) {
    switch (a) {
      case 'boot': Sound.play('select'); Game.boot(); break;
      case 'rivals': case 'forge': case 'dojo': case 'versus': case 'settings': case 'howto': case 'achievements':
        Sound.play('select'); this.show(a); break;
      case 'training': Sound.play('select'); Game.startTraining(); break;
      case 'tutorial': Sound.play('select'); Game.startTutorial(); break;
      case 'nextDuel': case 'firstDuel': {
        const o = Game.nextRival();
        Sound.play('select'); Game.toMenu(); Game.startDuel(o.id, Save.data.settings.rounds, -1); break;
      }
      case 'claimDaily': {
        const g = Game.dailyGift();
        if (g) { Game.claimDaily(g); Sound.play('buy'); this.toast(`DAY ${g.day} GIFT CLAIMED`, `+${fmt(g.coins)} coins${g.gems ? ` +${g.gems} gems` : ''}`); }
        document.querySelectorAll('.gate').forEach(x => x.remove());
        this.updateWallet(); this.buildTitle();
        break;
      }
      case 'back': this.back(); break;
      case 'install': PWA.install(); break;
      case 'quit': if (window.umbraDesktop) window.umbraDesktop.quit(); break;
      case 'resume': Game.resume(); break;
      case 'forfeit': Sound.play('back'); Game.quitMatch(); break;
      case 'movelist': this.show('howto'); break;
      case 'dummy': Game.cycleDummy(); this.buildPause(); break;
      case 'tier': this.rivalTier = t.dataset.v; Sound.play('select'); this.buildRivals(); break;
      case 'rival': this.rivalSel = t.dataset.v; Sound.play('select'); this.buildRivals(); break;
      case 'rivalRounds': this.rivalRounds = +t.dataset.v; this.buildRivals(); break;
      case 'rivalStage': this.rivalStage = ((this.rivalStage + 2) % (STAGES.length + 1)) - 1; Sound.play('hover'); this.buildRivals(); break;
      case 'fight': Sound.play('select'); Game.startDuel(this.rivalSel, this.rivalRounds || Save.data.settings.rounds, this.rivalStage); break;
      case 'slot': this.forgeSlot = t.dataset.v; this.forgeSel = null; Sound.play('select'); this.buildForge(); break;
      case 'item': this.forgeSel = t.dataset.v; Sound.play('hover'); this.buildForge(); break;
      case 'buy': this.buyItem(this.forgeSel); break;
      case 'upgrade': this.upgradeItem(this.forgeSel); break;
      case 'equip': this.equipItem(this.forgeSel); break;
      case 'pickFighter': this.pickFighter(t.dataset.v); break;
      case 'unlockFighter': this.unlockFighter(t.dataset.v); break;
      case 'vsCycle': {
        const [side, d] = t.dataset.v.split(':');
        this.vs[side] = (this.vs[side] + +d + FIGHTERS.length) % FIGHTERS.length; Sound.play('hover'); this.buildVersus(); break;
      }
      case 'vsStage': this.vs.stage = ((this.vs.stage + 2) % (STAGES.length + 1)) - 1; Sound.play('hover'); this.buildVersus(); break;
      case 'vsRounds': this.vs.rounds = +t.dataset.v; this.buildVersus(); break;
      case 'vsStart': Sound.play('select'); Game.startVersus(this.vs); break;
      case 'rematch': Sound.play('select'); Game.rematch(); break;
      case 'menu': this.home(); Game.toMenu(); break;
      case 'resToRivals': Game.toMenu(); this.history = ['title']; this.show('rivals', false); break;
      case 'resToForge': Game.toMenu(); this.history = ['title']; this.show('forge', false); break;
      case 'seg': {
        const k = t.dataset.k; let v = t.dataset.v; if (!isNaN(+v)) v = +v;
        Save.data.settings[k] = v; Save.save(); Sound.applyVolumes(); Sound.play('select'); this.buildSettings(); break;
      }
      case 'toggle': { const k = t.dataset.k; Save.data.settings[k] = !Save.data.settings[k]; Save.save(); Sound.play('select'); this.buildSettings(); break; }
      case 'fullscreen': Game.toggleFullscreen(); break;
      case 'reset': this.confirmReset(); break;
    }
  },

  /* ---------- title ---------- */
  buildTitle() {
    const nx = Game.nextRival();
    $('nextInfo').innerHTML = `vs ${nx.name} · <span style="color:${TIER[nx.tier].color}">${TIER[nx.tier].name}</span>`;
    const gift = Game.dailyGift();
    if (gift && !document.querySelector('.gate')) setTimeout(() => this.showDailyGift(gift), 350);
    const d = FIGHTERS.find(f => f.id === Save.data.fighter);
    $('meCard').innerHTML = `<div class="tt">YOUR FIGHTER</div><div class="nm">${d.name}</div><div class="tt">${d.title.toUpperCase()}</div><div class="pw">POWER <b>${this.myPower()}</b></div>`;
  },

  /* ---------- rivals ---------- */
  buildRivals() {
    const my = this.myPower();
    $('myPower').innerHTML = `YOUR POWER <b>${my}</b>`;
    const tabs = $('tierTabs'); tabs.innerHTML = '';
    for (const t of [{ id: 'all', name: 'ALL' }].concat(TIERS)) {
      const b = el('button', 'tab' + (this.rivalTier === t.id ? ' sel' : ''), t.name);
      b.dataset.act = 'tier'; b.dataset.v = t.id;
      if (t.color) b.style.color = this.rivalTier === t.id ? '#fff' : t.color;
      tabs.appendChild(b);
    }
    const grid = $('rivalGrid'); grid.innerHTML = '';
    const list = OPPONENTS.filter(o => this.rivalTier === 'all' || o.tier === this.rivalTier);
    if (!this.rivalSel || !list.find(o => o.id === this.rivalSel)) this.rivalSel = (list.find(o => !Save.record(o.id).wins) || list[0]).id;
    for (const o of list) {
      const t = TIER[o.tier], rec = Save.record(o.id);
      const fd = FIGHTERS.find(f => f.id === o.fighter);
      const p = powerRating(fd, o.gear);
      const cmp = this.compare(p, my);
      const c = el('div', 'card' + (o.id === this.rivalSel ? ' sel' : ''));
      c.dataset.act = 'rival'; c.dataset.v = o.id; c.tabIndex = -1;
      const locked = DEMO_MODE && t.index > 2;
      c.innerHTML = `<div class="tier" style="color:${t.color}">${t.name}</div><div class="nm">${o.name}</div><div class="tt">${o.title}</div>
        <div class="row2"><span class="${cmp.cls}">POWER ${p}</span><span>${coinsHtml(t.reward)}</span></div>
        ${rec.wins ? '<div class="beat">WON</div>' : ''}${locked ? '<div class="tt">FULL GAME</div>' : ''}`;
      grid.appendChild(c);
    }
    // detail
    const o = OPPONENT[this.rivalSel], t = TIER[o.tier], rec = Save.record(o.id), fd = FIGHTERS.find(f => f.id === o.fighter);
    const p = powerRating(fd, o.gear), cmp = this.compare(p, my);
    const D = $('rivalDetail'); D.innerHTML = '';
    const cv = el('canvas'); D.appendChild(cv);
    this.previews.push(new Preview(cv, o.fighter, o.gear, { eye: '#ff4040', face: -1 }));
    const g = o.gear;
    const rounds = this.rivalRounds || Save.data.settings.rounds;
    const stageName = this.rivalStage < 0 ? 'RANDOM' : STAGES[this.rivalStage].name.toUpperCase();
    const locked = DEMO_MODE && t.index > 2;
    D.insertAdjacentHTML('beforeend', `
      <div><span class="badge" style="background:${t.color}">${t.name}</span></div>
      <h3>${o.name}</h3>
      <div class="q">"${o.quote}"</div>
      <div class="kv">
        <span>FIGHTER</span><span>${fd.name} · ${fd.traitName}</span>
        <span>WEAPON</span><span>${ITEM[g.weapon[0]].name} ${starsHtml(g.weapon[1])}</span>
        <span>MAGIC</span><span>${ITEM[g.magic[0]].name}</span>
        <span>STYLE</span><span>${o.style.toUpperCase()}</span>
        <span>POWER</span><span class="${cmp.cls}">${p} · ${cmp.label}</span>
        <span>REWARD</span><span>${coinsHtml(t.reward)} ${rec.wins ? '' : ` + ${gemsHtml(t.gems)} first win`}</span>
        <span>RECORD</span><span>${rec.wins} W · ${rec.losses} L</span>
      </div>
      <div class="act">
        <div class="row"><span class="seg">${[1, 3].map(n => `<button data-act="rivalRounds" data-v="${n}" class="${rounds === n ? 'sel' : ''}">${n === 1 ? '1 ROUND' : 'BEST OF 3'}</button>`).join('')}</span>
        <button class="btn small ghost" data-act="rivalStage">ARENA: ${stageName}</button></div>
        <button class="btn primary big" data-act="fight" ${locked ? 'disabled' : ''}>${locked ? 'FULL GAME ONLY' : 'FIGHT'}</button>
      </div>`);
  },

  compare(p, my) {
    const r = p / my;
    if (r < 0.88) return { cls: 'cmp-good', label: 'WEAKER THAN YOU' };
    if (r < 1.15) return { cls: 'cmp-even', label: 'EVEN MATCH' };
    if (r < 1.5) return { cls: 'cmp-bad', label: 'STRONGER' };
    return { cls: 'cmp-bad', label: 'MUCH STRONGER' };
  },

  /* ---------- dojo ---------- */
  buildDojo() {
    const L = $('fighterList'); L.innerHTML = '';
    for (const f of FIGHTERS) {
      const owned = Save.data.fighters.includes(f.id), cur = Save.data.fighter === f.id;
      const c = el('div', 'fcard' + (cur ? ' cur' : ''));
      const cv = el('canvas'); c.appendChild(cv);
      this.previews.push(new Preview(cv, f.id, owned ? Save.gearFor(f.id) : this.starterGear(f)));
      const bar = (lbl, v) => `<span>${lbl}</span><div class="bar"><i style="width:${Math.round(clamp(v, 0, 1) * 100)}%"></i></div>`;
      c.insertAdjacentHTML('beforeend', `<div class="nm">${f.name}</div><div class="tt">${f.title.toUpperCase()}</div>
        <div class="bars">${bar('HEALTH', (f.hp - 0.7) / 0.7)}${bar('SPEED', (f.speed - 0.7) / 0.6)}${bar('POWER', (f.power - 0.7) / 0.6)}</div>
        <div class="trait"><b>${f.traitName.toUpperCase()}</b> · ${f.traitDesc}</div>`);
      let b;
      if (cur) b = el('button', 'btn gold', 'SELECTED');
      else if (owned) { b = el('button', 'btn primary', 'SELECT'); b.dataset.act = 'pickFighter'; b.dataset.v = f.id; }
      else {
        const can = f.gems ? Save.data.gems >= f.gems : Save.data.coins >= f.price;
        b = el('button', 'btn' + (can ? ' primary' : ''), `UNLOCK ${f.gems ? gemsHtml(f.gems) : coinsHtml(f.price)}`);
        b.dataset.act = 'unlockFighter'; b.dataset.v = f.id;
        if (DEMO_MODE && f.id !== 'ronin') { b.disabled = true; b.innerHTML = 'FULL GAME'; }
      }
      c.appendChild(b);
      L.appendChild(c);
    }
  },

  starterGear(f) { const g = {}; for (const s of SLOTS) g[s] = [f.start[s], 1]; return g; },

  pickFighter(id) {
    Save.data.fighter = id; Save.save(); Sound.play('select'); this.buildDojo(); Game.refreshMenuFighter();
  },
  unlockFighter(id) {
    const f = FIGHTERS.find(x => x.id === id), d = Save.data;
    if (f.gems ? d.gems < f.gems : d.coins < f.price) { Sound.play('deny'); this.toast('NOT ENOUGH ' + (f.gems ? 'GEMS' : 'COINS'), 'Win duels to earn more.'); return; }
    if (f.gems) d.gems -= f.gems; else d.coins -= f.price;
    d.fighters.push(id); d.fighter = id;
    for (const s of SLOTS) if (!d.owned[f.start[s]]) d.owned[f.start[s]] = 1;
    Save.save(); Sound.play('buy');
    this.toast(`${f.name} JOINS YOU`, f.title);
    if (d.fighters.length === FIGHTERS.length) Honors.unlock('allFighters');
    this.buildDojo(); this.updateWallet(); Game.refreshMenuFighter();
  },

  /* ---------- forge ---------- */
  buildForge() {
    const d = Save.data, fid = d.fighter, fdef = FIGHTERS.find(f => f.id === fid);
    const lo = d.loadouts[fid];
    $('forgePower').innerHTML = `${fdef.name} · POWER <b>${this.myPower()}</b>`;
    const tabs = $('slotTabs'); tabs.innerHTML = '';
    for (const s of SLOTS) { const b = el('button', 'tab' + (this.forgeSlot === s ? ' sel' : ''), SLOT_NAMES[s]); b.dataset.act = 'slot'; b.dataset.v = s; tabs.appendChild(b); }
    const items = ITEMS.filter(i => i.slot === this.forgeSlot);
    if (!this.forgeSel || !items.find(i => i.id === this.forgeSel)) this.forgeSel = lo[this.forgeSlot];
    const L = $('itemList'); L.innerHTML = '';
    for (const it of items) {
      const lvl = d.owned[it.id], eq = lo[it.slot] === it.id;
      const row = el('div', 'item' + (it.id === this.forgeSel ? ' sel' : '') + (eq ? ' eq' : '') + (lvl ? '' : ' locked'));
      row.dataset.act = 'item'; row.dataset.v = it.id; row.tabIndex = -1;
      const sub = it.slot === 'weapon' ? WEAPON_CLASS[it.cls].name : it.slot === 'magic' ? 'Magic' : it.slot === 'ranged' ? `Ammo ${it.ammo}` : `Tier ${it.tier}`;
      row.innerHTML = `<div class="nm">${it.name}</div><div class="rt">${lvl ? starsHtml(lvl) : priceHtml(it)}</div>
        <div class="sub">${sub}${it.perk ? ` · <span class="perk">${PERKS[it.perk].name}</span>` : ''}</div><div class="rt sub">${eq ? 'EQUIPPED' : lvl ? 'OWNED' : ''}</div>`;
      L.appendChild(row);
    }
    // detail
    const it = ITEM[this.forgeSel], lvl = d.owned[it.id] || 0, eq = lo[it.slot] === it.id;
    const D = $('itemDetail'); D.innerHTML = '';
    const cv = el('canvas'); D.appendChild(cv);
    const gear = Save.gearFor(fid); gear[it.slot] = [it.id, Math.max(1, lvl)];
    this.previews.push(new Preview(cv, fid, gear));
    const L1 = Math.max(1, lvl), L2 = Math.min(MAX_ITEM_LEVEL, L1 + 1);
    const stat = (label, key, mult = 1, fmtF = v => Math.round(v)) => {
      if (!it[key]) return '';
      const a = itemStat(it, key, L1) * mult, b = itemStat(it, key, L2) * mult;
      return `<span>${label}</span><span>${fmtF(a)}${lvl && lvl < MAX_ITEM_LEVEL ? ` <span class="up">→ ${fmtF(b)}</span>` : ''}</span>`;
    };
    let rows = '';
    if (it.slot === 'weapon') rows += stat('ATTACK', 'atk') + `<span>TYPE</span><span>${WEAPON_CLASS[it.cls].name} · ${WEAPON_CLASS[it.cls].desc}</span>`;
    if (it.slot === 'armor' || it.slot === 'helmet') rows += stat('DEFENSE', 'def') + stat('HEALTH', 'hp');
    if (it.slot === 'ranged') rows += stat('DAMAGE', 'dmg', RULES.rangedScale) + `<span>AMMO</span><span>${it.ammo} per round</span><span>INFO</span><span>${RANGED_INFO[it.kind]}</span>`;
    if (it.slot === 'magic') rows += stat('DAMAGE', 'dmg', RULES.magicScale) + `<span>INFO</span><span>${MAGIC_INFO[it.kind]}</span>`;
    if (it.perk) rows += `<span>PERK</span><span class="perk">${PERKS[it.perk].name}: ${PERKS[it.perk].desc}</span>`;
    rows += `<span>LEVEL</span><span>${lvl ? starsHtml(lvl) : 'Not owned'}</span>`;
    D.insertAdjacentHTML('beforeend', `<h3>${it.name}</h3><div class="kv">${rows}</div><div class="act" id="forgeAct"></div>`);
    const A = $('forgeAct');
    const locked = DEMO_MODE && it.tier > 2;
    if (!lvl) {
      const can = it.gems ? d.gems >= it.gems : d.coins >= it.price;
      const b = el('button', 'btn big ' + (can ? 'primary' : ''), locked ? 'FULL GAME' : `BUY ${priceHtml(it)}`);
      b.dataset.act = 'buy'; if (locked) b.disabled = true; A.appendChild(b);
    } else {
      if (lvl < MAX_ITEM_LEVEL) {
        const cost = upgradeCost(it, lvl);
        const b = el('button', 'btn ' + (d.coins >= cost ? 'gold' : ''), `UPGRADE ${starsHtml(lvl + 1)} ${coinsHtml(cost)}`);
        b.dataset.act = 'upgrade'; A.appendChild(b);
      } else A.appendChild(el('div', 'pw', 'FULLY UPGRADED'));
      const e = el('button', 'btn ' + (eq ? '' : 'primary'), eq ? 'EQUIPPED' : `EQUIP ON ${fdef.name}`);
      if (!eq) e.dataset.act = 'equip'; else e.disabled = true;
      A.appendChild(e);
    }
  },

  buyItem(id) {
    const it = ITEM[id], d = Save.data;
    if (d.owned[id]) return;
    if (it.gems ? d.gems < it.gems : d.coins < it.price) { Sound.play('deny'); this.toast('NOT ENOUGH ' + (it.gems ? 'GEMS' : 'COINS'), 'Beat rivals to earn more. Stronger rivals pay more!'); return; }
    if (it.gems) d.gems -= it.gems; else d.coins -= it.price;
    d.owned[id] = 1;
    d.loadouts[d.fighter][it.slot] = id;
    Save.save(); Sound.play('buy');
    this.toast(`${it.name.toUpperCase()} FORGED`, 'Equipped');
    if (it.gems) Honors.unlock('gemItem');
    this.buildForge(); this.updateWallet(); Game.refreshMenuFighter();
  },
  upgradeItem(id) {
    const it = ITEM[id], d = Save.data, lvl = d.owned[id];
    if (!lvl || lvl >= MAX_ITEM_LEVEL) return;
    const cost = upgradeCost(it, lvl);
    if (d.coins < cost) { Sound.play('deny'); this.toast('NOT ENOUGH COINS', `Upgrade costs ${fmt(cost)}`); return; }
    d.coins -= cost; d.owned[id] = lvl + 1;
    Save.save(); Sound.play('upgrade');
    if (lvl + 1 === MAX_ITEM_LEVEL) Honors.unlock('maxItem');
    this.buildForge(); this.updateWallet(); Game.refreshMenuFighter();
  },
  equipItem(id) {
    const it = ITEM[id], d = Save.data;
    if (!d.owned[id]) return;
    d.loadouts[d.fighter][it.slot] = id; Save.save(); Sound.play('select');
    this.buildForge(); Game.refreshMenuFighter();
  },

  /* ---------- versus ---------- */
  buildVersus() {
    const P = $('vsPanel'); P.innerHTML = '';
    const side = (k, label, keys) => {
      const f = FIGHTERS[this.vs[k]];
      const s = el('div', 'side');
      s.innerHTML = `<div class="pw">${label}</div>`;
      const cv = el('canvas'); s.appendChild(cv);
      this.previews.push(new Preview(cv, f.id, this.vsGear(f), { face: k === 'a' ? 1 : -1, eye: k === 'a' ? '#ffffff' : '#7fd6ff' }));
      s.insertAdjacentHTML('beforeend', `<div class="cycle"><button class="btn ghost" data-act="vsCycle" data-v="${k}:-1">&lsaquo;</button><div class="nm">${f.name}</div><button class="btn ghost" data-act="vsCycle" data-v="${k}:1">&rsaquo;</button></div><div class="trait"><b>${f.traitName.toUpperCase()}</b></div><div class="keys">${keys}</div>`);
      return s;
    };
    P.appendChild(side('a', 'PLAYER 1', 'Move <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · Attack <kbd>J</kbd> Kick <kbd>K</kbd> Throw <kbd>L</kbd><br>Heavy <kbd>U</kbd> Magic <kbd>I</kbd> Roll <kbd>O</kbd> · or gamepad 1'));
    const mid = el('div', 'mid');
    const stageName = this.vs.stage < 0 ? 'RANDOM' : STAGES[this.vs.stage].name.toUpperCase();
    mid.innerHTML = `<div class="vsword">VS</div><span class="seg">${[1, 3].map(n => `<button data-act="vsRounds" data-v="${n}" class="${this.vs.rounds === n ? 'sel' : ''}">${n === 1 ? '1 ROUND' : 'BEST OF 3'}</button>`).join('')}</span>
      <button class="btn small ghost" data-act="vsStage">ARENA: ${stageName}</button><button class="btn primary big" data-act="vsStart">FIGHT</button>`;
    P.appendChild(mid);
    P.appendChild(side('b', 'PLAYER 2', 'Move <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> · Attack <kbd>N</kbd> Kick <kbd>M</kbd> Throw <kbd>,</kbd><br>Heavy <kbd>.</kbd> Magic <kbd>/</kbd> Roll <kbd>R-Shift</kbd> · or numpad 1-5, 0 · or gamepad'));
  },
  vsGear(f) { const g = {}; for (const s of SLOTS) g[s] = [f.start[s], 3]; return g; },

  /* ---------- results ---------- */
  showResults(r) {
    const P = $('resultPanel'); P.innerHTML = '';
    const head = r.versus ? `<h2 class="win">${r.winner === 0 ? 'DRAW' : `PLAYER ${r.winner} WINS`}</h2>` :
      `<h2 class="${r.won ? 'win' : 'lose'}">${r.won ? 'VICTORY' : r.winner === 0 ? 'DRAW' : 'DEFEAT'}</h2>`;
    let html = head;
    html += `<div class="sum">${r.versus ? `${r.names[0]} vs ${r.names[1]}` : `vs ${r.rival.name} · <span style="color:${TIER[r.rival.tier].color}">${TIER[r.rival.tier].name}</span>`} · ROUNDS ${r.score[0]} - ${r.score[1]}</div>`;
    if (!r.versus) {
      html += `<div class="rewards"><div>${coinsHtml(r.coins)}</div>${r.gems ? `<div>${gemsHtml(r.gems)}</div>` : ''}</div>`;
      if (r.firstWin) html += `<div class="rewards"><span class="first">FIRST VICTORY BONUS</span></div>`;
      if (r.streak >= 2) html += `<div class="rewards"><span class="first streak">WIN STREAK ×${r.streak} · +${Math.round(r.streakBonus * 100)}% COINS</span></div>`;
      if (!r.won) html += `<div class="sum">Tip: upgrade your gear in the FORGE, or pick a rival closer to your power.</div>`;
      if (r.stats) html += `<div class="sum">BEST COMBO ${r.stats.maxCombo} · HITS ${r.stats.hits} · DAMAGE ${fmt(r.stats.dmgDealt)}</div>`;
    }
    const nx = !r.versus && r.won ? Game.nextRival() : null;
    const nextBtn = nx && nx.id !== r.rival.id ? `<button class="btn primary" data-act="nextDuel">NEXT: ${nx.name.toUpperCase()}</button>` : '';
    html += `<div class="menu">${nextBtn}<button class="btn ${nextBtn ? '' : 'primary'}" data-act="rematch">REMATCH</button>${r.versus ? '' : '<button class="btn" data-act="resToRivals">RIVALS</button><button class="btn" data-act="resToForge">FORGE</button>'}<button class="btn" data-act="menu">MENU</button></div>`;
    P.innerHTML = html;
    this.history = [];
    this.show('results', false);
  },

  showDailyGift(g) {
    if (this.current !== 'title' || document.querySelector('.gate')) return;
    const days = [100, 150, 200, 250, 300, 400, 500];
    const gate = el('div', 'gate');
    gate.innerHTML = `<div class="panel daily"><h2>DAILY GIFT</h2><p class="sum">Come back every day for bigger gifts.</p>
      <div class="days">${days.map((c, i) => `<div class="day ${i + 1 < g.day ? 'got' : i + 1 === g.day ? 'today' : ''}"><b>DAY ${i + 1}</b>${coinsHtml(c)}${i === 6 ? gemsHtml(5) : (i + 1) % 3 === 0 ? gemsHtml(1) : ''}</div>`).join('')}</div>
      <div class="row" style="justify-content:center"><button class="btn primary big" data-act="claimDaily">CLAIM</button></div></div>`;
    document.getElementById('ui').appendChild(gate);
    Sound.play('coin');
  },

  showTutorialDone(first) {
    const nx = Game.nextRival();
    const P = $('resultPanel');
    P.innerHTML = `<h2 class="win">TRAINING COMPLETE</h2>
      <div class="sum">You know the basics. Now prove it.</div>
      ${first ? `<div class="rewards"><div>${coinsHtml(150)}</div></div>` : ''}
      <div class="sum">Your first rival: <b style="color:${TIER[nx.tier].color}">${nx.name}</b>, ${nx.title}</div>
      <div class="menu"><button class="btn primary big" data-act="firstDuel">FIGHT ${nx.name.toUpperCase()}</button><button class="btn" data-act="menu">MENU</button></div>`;
    this.history = [];
    this.show('results', false);
  },

  /* ---------- pause ---------- */
  buildPause() {
    const tr = Game.match && Game.match.training;
    $('btnDummy').hidden = !tr;
    if (tr) $('btnDummy').textContent = `DUMMY: ${Game.match.dummyMode.toUpperCase()}`;
    $('btnForfeit').textContent = Game.match && Game.match.tutorial ? 'SKIP TUTORIAL' : tr ? 'LEAVE TRAINING' : 'QUIT MATCH';
    if (Game.match && Game.match.tutorial) $('btnDummy').hidden = true;
  },

  /* ---------- settings ---------- */
  buildSettings() {
    const s = Save.data.settings, L = $('settingsList'); L.innerHTML = '';
    const row = (label, ctl) => { const r = el('div', 'set'); r.innerHTML = `<label>${label}</label>`; r.appendChild(ctl); L.appendChild(r); };
    for (const [k, label] of [['master', 'MASTER VOLUME'], ['music', 'MUSIC'], ['sfx', 'SOUND EFFECTS']]) {
      const r = el('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.05; r.value = s[k];
      r.addEventListener('input', () => { s[k] = +r.value; Sound.applyVolumes(); Save.save(); });
      row(label, r);
    }
    const seg = (k, opts) => { const g = el('span', 'seg'); for (const [v, l] of opts) { const b = el('button', s[k] === v ? 'sel' : '', l); b.dataset.act = 'seg'; b.dataset.k = k; b.dataset.v = v; g.appendChild(b); } return g; };
    const tog = k => { const b = el('button', 'btn small ' + (s[k] ? 'primary' : ''), s[k] ? 'ON' : 'OFF'); b.dataset.act = 'toggle'; b.dataset.k = k; return b; };
    row('ANNOUNCER VOICE', tog('announcer'));
    row('DAMAGE NUMBERS', tog('hitNumbers'));
    row('SCREEN SHAKE', seg('shake', [[0, 'OFF'], [0.5, 'LOW'], [1, 'FULL']]));
    row('DEFAULT ROUNDS', seg('rounds', [[1, '1'], [3, 'BEST OF 3']]));
    const fs = el('button', 'btn small', 'TOGGLE'); fs.dataset.act = 'fullscreen'; row('FULLSCREEN', fs);
  },

  confirmReset() {
    const g = el('div', 'gate');
    g.innerHTML = `<div class="panel"><h2>ERASE PROGRESS?</h2><p>All coins, gear, fighters and honors will be lost.</p><div class="row"><button class="btn" id="gNo">KEEP</button><button class="btn danger" id="gYes">ERASE</button></div></div>`;
    document.getElementById('ui').appendChild(g);
    g.querySelector('#gNo').onclick = () => { g.remove(); Sound.play('back'); };
    g.querySelector('#gYes').onclick = () => { g.remove(); Save.reset(); Sound.play('deny'); this.toast('PROGRESS ERASED', ''); Game.refreshMenuFighter(); this.home(); };
  },

  /* ---------- how to play ---------- */
  buildHowto() {
    $('howtoBody').innerHTML = `
      <div><h4>CONTROLS</h4><table>
        <tr><td>Move / Jump / Crouch</td><td><kbd>A</kbd><kbd>D</kbd> <kbd>W</kbd> <kbd>S</kbd> or arrows</td></tr>
        <tr><td>Attack (weapon)</td><td><kbd>J</kbd></td></tr>
        <tr><td>Kick</td><td><kbd>K</kbd></td></tr>
        <tr><td>Heavy (breaks guard)</td><td><kbd>U</kbd></td></tr>
        <tr><td>Throw</td><td><kbd>L</kbd></td></tr>
        <tr><td>Magic (meter full)</td><td><kbd>I</kbd></td></tr>
        <tr><td>Roll (dodge)</td><td><kbd>O</kbd> or <kbd>Shift</kbd></td></tr>
        <tr><td>Block</td><td>Hold <b>back</b> (away from your rival)</td></tr>
        <tr><td>Pause</td><td><kbd>Esc</kbd> or <kbd>P</kbd></td></tr>
        <tr><td>Gamepad</td><td>X attack · Y kick · A jump · B roll · LB heavy · RB throw · RT magic</td></tr>
        <tr><td>Touch</td><td>Drag on the left to move, buttons on the right</td></tr>
      </table></div>
      <div><h4>MOVES</h4><table>
        <tr><td>Attack ×3</td><td>3-hit combo</td></tr>
        <tr><td>Forward + Attack</td><td>Lunge (long reach)</td></tr>
        <tr><td>Back + Attack</td><td>Rising slash (anti-air, launches)</td></tr>
        <tr><td>Down + Attack</td><td>Low slash (block it crouching)</td></tr>
        <tr><td>Forward + Kick</td><td>Side kick (knock back)</td></tr>
        <tr><td>Down + Kick</td><td>Sweep (knocks down)</td></tr>
        <tr><td>Jump + Attack / Kick</td><td>Overhead (block it standing)</td></tr>
        <tr><td>Attack, Attack, Kick</td><td>Combo finisher</td></tr>
      </table></div>
      <div><h4>THE WAY OF UMBRA</h4><table>
        <tr><td>Blocking</td><td>Hold back. Low attacks must be blocked crouching, jump attacks standing.</td></tr>
        <tr><td>Heavy</td><td>Breaks any guard and staggers the rival.</td></tr>
        <tr><td>Throws</td><td>Shuriken and kunai fly high: crouch under them.</td></tr>
        <tr><td>Magic</td><td>Fill the purple meter by fighting, then unleash it.</td></tr>
        <tr><td>Roll</td><td>Briefly untouchable. Roll through attacks.</td></tr>
        <tr><td>Rivals</td><td>No levels to grind: fight any rival at any time. Stronger rivals pay more.</td></tr>
        <tr><td>Forge</td><td>Spend coins on new weapons, armor and magic, and upgrade them to ★★★★★.</td></tr>
      </table></div>`;
  },

  buildHonors() {
    const L = $('honorList'); L.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const got = !!Save.data.achievements[a.id];
      L.appendChild(el('div', 'honor' + (got ? ' got' : ''), `<b>${got ? '✦ ' : ''}${a.name}</b><span>${a.desc}</span>`));
    }
  },

  /* ---------- keyboard / gamepad navigation ---------- */
  focusables() {
    const scr = document.querySelector('.gate') || $('scr-' + this.current);
    if (!scr) return [];
    return [...scr.querySelectorAll('.btn:not(:disabled), .card, .item, .tab, .seg button, input[type=range]')].filter(e => e.offsetParent !== null);
  },
  setFocus(e) {
    if (this.focusEl) this.focusEl.classList.remove('focus');
    this.focusEl = e;
    if (e) { e.classList.add('focus'); e.scrollIntoView({ block: 'nearest' }); if (e.tagName === 'INPUT') e.focus(); }
  },
  nav(dx, dy) {
    const list = this.focusables();
    if (!list.length) return;
    if (!this.focusEl || !list.includes(this.focusEl)) { this.setFocus(list.find(e => e.classList.contains('primary')) || list[0]); return; }
    if (this.focusEl.tagName === 'INPUT' && dx) { const r = this.focusEl; r.value = clamp(+r.value + dx * 0.05, 0, 1); r.dispatchEvent(new Event('input')); return; }
    const a = this.focusEl.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bd = Infinity;
    for (const e of list) {
      if (e === this.focusEl) continue;
      const b = e.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const ddx = bx - ax, ddy = by - ay;
      if (dx && Math.sign(ddx) !== dx) continue;
      if (dy && Math.sign(ddy) !== dy) continue;
      const along = dx ? Math.abs(ddx) : Math.abs(ddy), across = dx ? Math.abs(ddy) : Math.abs(ddx);
      const d = along + across * 2.2;
      if (d < bd && along > 2) { bd = d; best = e; }
    }
    if (best) { this.setFocus(best); Sound.play('hover'); }
  },
  activate() { if (this.focusEl) { Sound.unlock(); this.focusEl.click(); } },

  key(e) {
    if (Game.inMatch()) {
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); Game.togglePause(); }
      if (e.code === 'KeyT' && Game.match && Game.match.training && !Game.paused) Game.cycleDummy();
      return;
    }
    const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
    if (map[e.code]) { e.preventDefault(); this.nav(...map[e.code]); return; }
    if (e.code === 'Enter' || e.code === 'Space') {
      if (this.current === 'boot') { this.act('boot'); return; }
      if (this.focusEl) { e.preventDefault(); this.activate(); }
      return;
    }
    if (e.code === 'Escape' || e.code === 'Backspace') {
      const gate = document.querySelector('.gate');
      if (gate) { gate.remove(); return; }
      if (Game.paused) { Game.resume(); return; }
      if (!['title', 'boot', 'results'].includes(this.current)) this.back();
    }
  },
};
