// App shell: state, persistence, routing, chrome, actions, toasts and the reveal moment.
import { html, mount, $, $$, fmt, esc } from './dom.js';
import { icon, CUR_ICON } from './icons.js';
import { createStore } from '../meta/save.js';
import { xpToNext } from '../meta/profile.js';
import { ensureMissions } from '../meta/missions.js';
import { checkLogin } from '../meta/login.js';
import { claimableTiers } from '../meta/pass.js';
import { checkAchievements } from '../meta/achievements.js';
import { createAudio } from '../audio/audio.js';
import { createPayments } from '../services/payments.js';
import { RARITIES } from '../data/rarity.js';
import { kindLabel } from './components.js';
import { speciesById } from '../data/species.js';

const NAV = [
  { id: 'home', label: 'Play', icon: 'play' },
  { id: 'hangar', label: 'Hangar', icon: 'hangar' },
  { id: 'shop', label: 'Shop', icon: 'shop' },
  { id: 'pass', label: 'Pass', icon: 'pass' },
  { id: 'missions', label: 'Missions', icon: 'target' },
];

export const app = {
  profile: null,
  store: null,
  audio: createAudio(),
  payments: createPayments(),
  screens: {},
  current: null,
  route: 'home',
  params: {},
  pendingRun: null,
  lastResult: null,
  saveStatus: 'ok',
};

let saveTimer = 0;

export function registerScreen(s) { app.screens[s.id] = s; }

export function boot(root) {
  app.root = root;
  app.store = createStore(globalThis.localStorage);
  const { profile, status } = app.store.load();
  app.profile = profile;
  app.saveStatus = status;
  ensureMissions(profile);
  checkLogin(profile);
  checkAchievements(profile);
  applySettings();
  save(true);
  renderChrome();
  bindGlobal();
  window.addEventListener('hashchange', route);
  route();
  if (status === 'restored') toast({ title: 'Save restored', body: 'Your latest save was damaged, so we loaded the backup.', tone: 'warn' });
  if (status === 'tampered') toast({ title: 'Save looks edited', body: 'Leaderboard submissions are disabled for this profile.', tone: 'warn' });
}

export function save(now = false) {
  clearTimeout(saveTimer);
  const doit = () => app.store.save(app.profile);
  if (now) doit(); else saveTimer = setTimeout(doit, 250);
}

/** Mutate the profile, persist, refresh chrome and the current screen. */
export function commit(fn, { rerender = true } = {}) {
  const res = fn ? fn(app.profile) : undefined;
  const fresh = checkAchievements(app.profile);
  for (const a of fresh) toast({ title: 'Achievement unlocked', body: a.name, tone: 'gold', icon: 'trophy', action: { label: 'Claim', go: 'missions' } });
  save();
  renderChrome();
  if (rerender) rerenderScreen();
  return res;
}

export function applySettings() {
  const s = app.profile.settings;
  app.audio.setVolume({ sfx: s.sfx, music: s.music });
  document.documentElement.dataset.reducedMotion = String(!!s.reducedMotion);
}

// ------------------------------------------------------------------ routing
export function go(id, params = {}) {
  app.params = params;
  const target = '#/' + id;
  if (location.hash === target) route();
  else location.hash = target;
}

function route() {
  const id = (location.hash.replace(/^#\/?/, '').split('?')[0] || 'home');
  const screen = app.screens[id] || app.screens.home;
  if (app.current?.unmount) app.current.unmount();
  app.current = screen;
  app.route = screen.id;
  document.body.dataset.route = screen.id;
  const view = $('#view');
  view.classList.remove('enter');
  void view.offsetWidth;
  view.classList.add('enter');
  mount(view, screen.render(app));
  screen.mount?.(view, app);
  $$('.nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === screen.id ? 'page' : 'false'));
  document.title = screen.id === 'home' ? 'ASTRA: Serpents of the Void' : `${screen.title || screen.id} · ASTRA`;
  if (screen.id !== 'play') window.scrollTo({ top: 0 });
  view.focus({ preventScroll: true });
}

export function rerenderScreen() {
  const s = app.current;
  if (!s || s.id === 'play') return;
  const view = $('#view');
  const scroll = [...view.querySelectorAll('[data-keep-scroll]')].map((el) => el.scrollLeft);
  s.unmount?.();
  mount(view, s.render(app));
  s.mount?.(view, app);
  [...view.querySelectorAll('[data-keep-scroll]')].forEach((el, i) => { el.scrollLeft = scroll[i] || el.scrollLeft; });
}

// ------------------------------------------------------------------ chrome
export function renderChrome() {
  const p = app.profile;
  const badges = {
    missions: missionBadge(p),
    pass: claimableTiers(p).length,
  };
  const sp = speciesById(p.equipped.species);
  mount($('#topbar'), html`
    <a class="brand" href="#/home" aria-label="ASTRA home"><span class="brand-mark">astra</span><span class="brand-dot">.</span></a>
    <div class="wallet">
      <a class="cur-pill" href="#/shop" title="Stardust">${CUR_ICON.stardust(16)}<b>${fmt(p.wallet.stardust)}</b></a>
      <a class="cur-pill cur-pill-crystals" href="#/shop" title="Void Crystals">${CUR_ICON.crystals(16)}<b>${fmt(p.wallet.crystals)}</b></a>
      ${p.wallet.shards ? html`<a class="cur-pill cur-pill-shards" href="#/hangar" title="Relic Shards">${CUR_ICON.shards(16)}<b>${fmt(p.wallet.shards)}</b></a>` : ''}
    </div>
    <a class="pilot" href="#/profile" aria-label="Profile">
      <span class="lvl" style="--p:${(p.xp / xpToNext(p.level)).toFixed(3)}"><b>${p.level}</b></span>
      <span class="pilot-name"><b>${p.name}</b><small>${sp.name}</small></span>
    </a>
    <a class="icon-btn" href="#/settings" aria-label="Settings">${icon('settings', 20)}</a>
  `);
  mount($('#nav'), html`${NAV.map((n) => html`
    <a href="#/${n.id}" data-nav="${n.id}" aria-current="${app.route === n.id ? 'page' : 'false'}">
      ${icon(n.icon, 22)}<span>${n.label}</span>${badges[n.id] ? html`<i class="badge">${badges[n.id]}</i>` : ''}
    </a>`)}
    <a href="#/profile" data-nav="profile" class="nav-extra">${icon('user', 22)}<span>Profile</span></a>
  `);
}

function missionBadge(p) {
  let n = 0;
  for (const m of [...p.missions.daily, ...p.missions.weekly]) if (m.progress >= m.target && !m.claimed) n++;
  for (const st of Object.values(p.achievements)) if (st.done && !st.claimed) n++;
  if (p.login.pending) n++;
  return n;
}

// ------------------------------------------------------------------ actions
function bindGlobal() {
  document.addEventListener('pointerdown', () => app.audio.unlock(), { once: true });
  document.addEventListener('keydown', () => app.audio.unlock(), { once: true });

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const soft = el.getAttribute('aria-disabled') === 'true'; // handler explains why
    // Two-step confirm for spending: first tap arms, second tap fires. No modal needed.
    if (el.dataset.confirm && !soft && el.dataset.armed !== '1') {
      e.preventDefault();
      $$('[data-armed="1"]').forEach(disarm);
      el.dataset.armed = '1';
      el.dataset.label = el.innerHTML;
      el.innerHTML = esc(el.dataset.confirm);
      el.classList.add('armed');
      el._t = setTimeout(() => disarm(el), 3200);
      app.audio.play('click');
      return;
    }
    if (el.dataset.armed === '1') disarm(el);
    const name = el.dataset.action;
    const handler = app.current?.actions?.[name] || GLOBAL_ACTIONS[name];
    if (handler) { e.preventDefault(); handler(el.dataset, el, e); }
  });
}

function disarm(el) {
  clearTimeout(el._t);
  if (el.dataset.label != null) el.innerHTML = el.dataset.label;
  delete el.dataset.armed; delete el.dataset.label;
  el.classList.remove('armed');
}

const GLOBAL_ACTIONS = {
  go: (d) => go(d.to),
  'toast-close': (d, el) => el.closest('.toast')?.remove(),
};

// ------------------------------------------------------------------ toasts
export function toast({ title, body = '', tone = '', icon: ic = 'sparkle', action = null, ms = 4200 }) {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.setAttribute('role', 'status');
  mount(el, html`
    <span class="toast-ic">${icon(ic, 18)}</span>
    <span class="toast-txt"><b>${title}</b>${body ? html`<small>${body}</small>` : ''}</span>
    ${action ? html`<button class="toast-act" data-action="go" data-to="${action.go}">${action.label}</button>` : ''}
    <button class="toast-x" data-action="toast-close" aria-label="Dismiss">${icon('x', 14)}</button>`);
  host.appendChild(el);
  while (host.children.length > 3) host.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}

export function fail(msg) { app.audio.play('error'); toast({ title: msg, tone: 'bad', icon: 'info', ms: 2600 }); }

// ------------------------------------------------------------------ reveal (the one legit modal)
export function reveal({ item, rarity, dup, shards, pity, title = 'Cache opened', onEquip }) {
  const dlg = $('#reveal');
  const r = RARITIES[rarity || item.rarity];
  mount(dlg, html`
    <div class="reveal-stage r-${r.id}">
      <div class="reveal-cache">${icon('box', 72)}</div>
      <div class="reveal-card">
        <p class="eyebrow">${title}${pity ? ' · pity guarantee' : ''}</p>
        <span class="rarity r-${r.id}">${r.name}</span>
        <h2>${item.name}</h2>
        <p class="reveal-kind">${kindLabel(item.kind)}</p>
        ${item.kind === 'skin' ? html`<canvas class="reveal-swatch" data-swatch="${item.id}"></canvas>` : ''}
        <p class="reveal-note">${dup ? html`Duplicate, converted to ${CUR_ICON.shards(14)} <b>${shards}</b> Relic Shards.` : 'New. It is yours.'}</p>
        <div class="row">
          ${!dup && onEquip ? html`<button class="btn primary" data-reveal="equip">Equip now</button>` : ''}
          <button class="btn ${dup || !onEquip ? 'primary' : 'quiet'}" data-reveal="close">Nice</button>
        </div>
      </div>
    </div>`);
  dlg.showModal();
  app.audio.play('reveal', r.rank);
  import('../render/renderer.js').then(({ paintSwatch }) => {
    const c = dlg.querySelector('[data-swatch]');
    if (c) paintSwatch(c, item, speciesById(app.profile.equipped.species));
  });
  dlg.onclick = (e) => {
    const b = e.target.closest('[data-reveal]');
    if (!b) return;
    if (b.dataset.reveal === 'equip') onEquip?.();
    dlg.close();
  };
}
