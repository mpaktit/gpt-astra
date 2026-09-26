import { html, $, $$, fmt } from '../dom.js';
import { icon, CUR_ICON } from '../icons.js';
import { price, rarityChip, bar, kindLabel } from '../components.js';
import { app, commit, fail, toast } from '../app.js';
import { SPECIES, speciesById, masteryLevel, MASTERY_XP } from '../../data/species.js';
import { SKINS, TRAILS, FINALES, TITLES, cosmeticById } from '../../data/cosmetics.js';
import { COSMETIC_PRICES, SHARD_PRICES } from '../../data/economy.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { RARITY_ORDER } from '../../data/rarity.js';
import { buySpecies, buyCosmetic, owns } from '../../meta/store.js';
import { createRenderer, paintSwatch } from '../../render/renderer.js';
import { createGame, tick, queueTurn, hazardAt } from '../../core/engine.js';
import { chooseDir } from '../../core/ai.js';
import { createRng } from '../../core/rng.js';

const TABS = [
  { id: 'species', label: 'Species' }, { id: 'skin', label: 'Skins', list: SKINS, slot: 'skin' },
  { id: 'trail', label: 'Trails', list: TRAILS, slot: 'trail' }, { id: 'finale', label: 'Finales', list: FINALES, slot: 'finale' },
  { id: 'title', label: 'Titles', list: TITLES, slot: 'title' },
];
export const hangarState = { tab: 'species', sel: null };
const ui = hangarState;
let stop = null;

function sourceText(item) {
  if (item.source === 'pass') return 'Season 1 pass reward';
  if (item.source === 'mastery') return `Reach mastery ${item.kind === 'title' ? 10 : 5} with ${speciesById(item.species).name}`;
  if (item.source === 'achievement') { const a = ACHIEVEMENTS.find((x) => x.reward.cosmetic === item.id); return a ? `Achievement: ${a.name}` : 'Achievement reward'; }
  return null;
}

const statBar = (label, v, min, max, fmtv) => html`<div class="stat"><span>${label}</span>${bar((v - min) / (max - min), 'indigo')}<b>${fmtv}</b></div>`;

function speciesDetail(p, sp) {
  const owned = p.owned.species.includes(sp.id);
  const equipped = p.equipped.species === sp.id;
  const mxp = p.mastery[sp.id] || 0, ml = masteryLevel(mxp);
  const nextXp = MASTERY_XP[ml] ?? null;
  return html`
    <div class="detail">
      <p class="eyebrow">${sp.origin}</p>
      <h2 class="h-world">${sp.name} ${rarityChip(sp.rarity)}</h2>
      <p class="muted blurb">${sp.blurb}</p>
      <div class="stats">
        ${statBar('Speed', sp.stats.speed, 0.94, 1.06, `${Math.round(sp.stats.speed * 100)}%`)}
        ${statBar('Stardust yield', sp.stats.yield, 0.95, 1.2, `×${sp.stats.yield.toFixed(2)}`)}
        ${statBar('Start length', sp.stats.startLen, 3, 7, sp.stats.startLen)}
      </div>
      <div class="ability-box">
        <span class="ab-ic">${icon('bolt', 20)}</span>
        <div><b>${sp.ability.name}</b> <small class="muted">${(sp.ability.cooldown / 1000).toFixed(0)}s cooldown</small><p>${sp.ability.desc}</p></div>
      </div>
      <p class="passive"><b>Passive.</b> ${sp.passive.desc}</p>
      ${owned ? html`<div class="mastery"><div class="row-b"><span>Mastery <b>${ml}</b>/10</span><small class="muted">${nextXp ? `${fmt(nextXp - mxp)} XP to ${ml + 1}` : 'Mastered'}</small></div>${bar(nextXp ? (mxp - (MASTERY_XP[ml - 1] || 0)) / (nextXp - (MASTERY_XP[ml - 1] || 0)) : 1, 'violet')}<small class="muted">Mastery 5 unlocks the Ascendant skin. Mastery 10 unlocks a title.</small></div>` : ''}
      <div class="row buy-row">
        ${equipped ? html`<button class="btn quiet" disabled>${icon('check', 18)} Flying this one</button>`
          : owned ? html`<button class="btn primary" data-action="equip-species" data-id="${sp.id}">Fly ${sp.name}</button>`
          : html`
            <button class="btn primary" data-action="buy-species" data-id="${sp.id}" data-cur="stardust" data-confirm="Confirm ${fmt(sp.price.stardust)} Stardust" ${p.wallet.stardust < sp.price.stardust ? 'aria-disabled="true"' : ''}>Unlock ${price('stardust', sp.price.stardust)}</button>
            ${sp.price.crystals ? html`<button class="btn quiet" data-action="buy-species" data-id="${sp.id}" data-cur="crystals" data-confirm="Confirm ${fmt(sp.price.crystals)} Crystals" ${p.wallet.crystals < sp.price.crystals ? 'aria-disabled="true"' : ''}>${price('crystals', sp.price.crystals)}</button>` : ''}`}
      </div>
      ${!owned && p.wallet.stardust < sp.price.stardust ? html`<p class="muted small">${fmt(sp.price.stardust - p.wallet.stardust)} more Stardust. Every run pays out.</p>` : ''}
    </div>`;
}

function cosmeticDetail(p, item, slot) {
  const own = owns(p, item.id);
  const equipped = p.equipped[slot] === item.id || (slot === 'skin' && item.id === 'default' && p.equipped.skin === 'default');
  const src = sourceText(item);
  const pr = COSMETIC_PRICES[item.rarity];
  const shardCost = SHARD_PRICES[item.rarity];
  return html`
    <div class="detail">
      <p class="eyebrow">${kindLabel(item.kind)}</p>
      <h2 class="h-world">${item.name} ${rarityChip(item.rarity)}</h2>
      ${item.kind === 'title' ? html`<p class="title-preview">${p.name} <span>${item.name}</span></p>` : ''}
      <p class="muted blurb">${item.kind === 'skin' ? 'Works on every species.' : item.kind === 'trail' ? 'Leaves a wake behind your tail.' : item.kind === 'finale' ? 'Plays when your run ends. Go out in style.' : 'Shown next to your name.'} Cosmetic only, no stat changes.</p>
      <div class="row buy-row">
        ${equipped ? html`<button class="btn quiet" disabled>${icon('check', 18)} Equipped</button>`
          : own || item.id === 'default' ? html`<button class="btn primary" data-action="equip" data-slot="${slot}" data-id="${item.id}">Equip</button>`
          : src ? html`<button class="btn quiet" disabled>${icon('lock', 18)} ${src}</button>`
          : html`
            ${pr.stardust ? html`<button class="btn primary" data-action="buy-cos" data-id="${item.id}" data-cur="stardust" data-confirm="Confirm ${fmt(pr.stardust)} Stardust" ${p.wallet.stardust < pr.stardust ? 'aria-disabled="true"' : ''}>Buy ${price('stardust', pr.stardust)}</button>` : ''}
            ${pr.crystals ? html`<button class="btn ${pr.stardust ? 'quiet' : 'primary'}" data-action="buy-cos" data-id="${item.id}" data-cur="crystals" data-confirm="Confirm ${fmt(pr.crystals)} Crystals" ${p.wallet.crystals < pr.crystals ? 'aria-disabled="true"' : ''}>${pr.stardust ? '' : 'Buy '}${price('crystals', pr.crystals)}</button>` : ''}
            <button class="btn quiet" data-action="buy-cos" data-id="${item.id}" data-cur="shards" data-confirm="Confirm ${shardCost} Shards" ${p.wallet.shards < shardCost ? 'aria-disabled="true"' : ''}>${price('shards', shardCost)}</button>`}
      </div>
    </div>`;
}

function tileVisual(item) {
  if (item.kind === 'skin') return html`<canvas class="swatch" data-swatch="${item.id}"></canvas>`;
  if (item.kind === 'title') return html`<span class="tile-title">${item.name}</span>`;
  const ic = item.kind === 'trail' ? 'sparkle' : 'bolt';
  const col = item.color ? `oklch(${item.color[0] * 100}% ${item.color[1]} ${item.color[2]})` : 'var(--ink-3)';
  return html`<span class="tile-ic" style="color:${col}">${icon(item.id === 'none' ? 'x' : ic, 30)}</span>`;
}

export const hangar = {
  id: 'hangar', title: 'Hangar',
  render(app) {
    const p = app.profile;
    const tab = TABS.find((t) => t.id === ui.tab) || TABS[0];
    let detail, catalog;
    if (tab.id === 'species') {
      const sel = speciesById(ui.sel && SPECIES.some((s) => s.id === ui.sel) ? ui.sel : p.equipped.species);
      ui.sel = sel.id;
      detail = speciesDetail(p, sel);
      catalog = html`<ul class="species-list">${SPECIES.map((sp) => {
        const owned = p.owned.species.includes(sp.id);
        return html`<li><button class="sp-row ${sp.id === sel.id ? 'on' : ''}" data-action="select" data-id="${sp.id}" aria-pressed="${sp.id === sel.id ? 'true' : 'false'}">
          <span class="species-glyph" style="--h:${sp.palette.head[2]}">${sp.name[0]}</span>
          <span class="sp-main"><b>${sp.name}</b><small>${sp.ability.name}</small></span>
          ${rarityChip(sp.rarity)}
          <span class="sp-state">${p.equipped.species === sp.id ? html`<em class="tag-on">Flying</em>` : owned ? html`<em>Owned</em>` : price('stardust', sp.price.stardust)}</span>
        </button></li>`;
      })}</ul>`;
    } else {
      const list = tab.id === 'skin' ? [{ id: 'default', kind: 'skin', name: 'Species default', rarity: 'common' }, ...tab.list] : tab.list;
      const sorted = [...list].sort((a, b) => (owns(p, b.id) || b.id === 'default') - (owns(p, a.id) || a.id === 'default') || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
      const sel = list.find((x) => x.id === ui.sel) || list.find((x) => x.id === p.equipped[tab.slot]) || list[0];
      ui.sel = sel.id;
      detail = cosmeticDetail(p, sel, tab.slot);
      catalog = html`<ul class="tiles">${sorted.map((item) => {
        const own = owns(p, item.id) || item.id === 'default';
        const eq = p.equipped[tab.slot] === item.id;
        const pr = COSMETIC_PRICES[item.rarity];
        return html`<li><button class="tile r-${item.rarity} ${item.id === sel.id ? 'on' : ''} ${own ? 'own' : ''}" data-action="select" data-id="${item.id}" aria-pressed="${item.id === sel.id ? 'true' : 'false'}">
          ${tileVisual(item)}
          <span class="tile-name">${item.name}</span>
          <span class="tile-foot">${eq ? html`<em class="tag-on">Equipped</em>` : own ? html`<em>Owned</em>` : item.source ? html`${icon('lock', 13)}` : price(pr.stardust ? 'stardust' : 'crystals', pr.stardust || pr.crystals)}</span>
        </button></li>`;
      })}</ul>`;
    }
    const counts = TABS.slice(1).map((t) => [t.id, t.list.filter((x) => owns(p, x.id)).length, t.list.length]);
    return html`
    <section class="hangar">
      <header class="page-head">
        <h1 class="h-display">Hangar</h1>
        <div class="tabs" role="tablist">
          ${TABS.map((t) => { const c = counts.find((x) => x[0] === t.id); return html`<button role="tab" aria-selected="${t.id === tab.id ? 'true' : 'false'}" data-action="tab" data-id="${t.id}">${t.label}${c ? html`<small>${c[1]}/${c[2]}</small>` : html`<small>${p.owned.species.length}/${SPECIES.length}</small>`}</button>`; })}
        </div>
      </header>
      <div class="hangar-grid">
        <div class="showcase">
          <div class="show-stage"><canvas id="show"></canvas></div>
          ${detail}
        </div>
        <div class="catalog">${catalog}</div>
      </div>
    </section>`;
  },
  mount(root, app) {
    const p = app.profile;
    const tab = ui.tab;
    const spId = tab === 'species' ? ui.sel : p.equipped.species;
    const skinId = tab === 'skin' ? ui.sel : p.equipped.skin;
    const trailId = tab === 'trail' ? ui.sel : p.equipped.trail;
    const finaleId = tab === 'finale' ? ui.sel : p.equipped.finale;
    $$('canvas[data-swatch]', root).forEach((c) => paintSwatch(c, c.dataset.swatch === 'default' ? null : cosmeticById(c.dataset.swatch), speciesById(p.equipped.species)));
    const canvas = $('#show', root);
    const r = createRenderer(canvas);
    const brain = createRng(11);
    const mk = () => {
      const s = createGame({ worldId: 'nebula', speciesId: spId, seed: Math.floor(brain.next() * 1e9) });
      return s;
    };
    let g = mk();
    r.configure({ world: g.world, species: g.species, skinId, trailId, finaleId, settings: p.settings });
    const fit = () => {
      const w = canvas.parentElement.clientWidth;
      r.resize(Math.max(154, Math.floor(Math.min(w, 380) / g.world.size) * g.world.size));
      if (p.settings.reducedMotion) r.draw(g, 1, performance.now(), 16);
    };
    fit();
    let raf = 0, last = performance.now(), acc = 0, finaleTimer = 0;
    const loop = (now) => {
      const dt = Math.min(50, now - last); last = now; acc += dt;
      if (acc > 115) {
        acc = 0;
        if (g.over) { g = mk(); }
        const blocked = (x, y) => !!hazardAt(g, x, y) || g.snake.slice(0, -1).some((q) => q.x === x && q.y === y);
        const d = chooseDir({ w: g.w, h: g.h, wrap: g.wrap, head: g.snake[0], dir: g.dir, targets: g.items, blocked, rng: brain, lookahead: 30 });
        if (d) queueTurn(g, d.y === -1 ? 0 : d.y === 1 ? 1 : d.x === -1 ? 2 : 3);
        const ev = tick(g);
        r.onEvents(ev.filter((e) => e.type !== 'death'), g);
        r.onStep(g);
      }
      if (tab === 'finale' && now - finaleTimer > 2200) { finaleTimer = now; r.onEvents([{ type: 'death', x: g.snake[0].x, y: g.snake[0].y }], g); }
      r.draw(g, Math.min(1, acc / 115), now, dt);
      raf = requestAnimationFrame(loop);
    };
    if (!p.settings.reducedMotion) raf = requestAnimationFrame(loop);
    else r.draw(g, 1, performance.now(), 16);
    const ro = new ResizeObserver(fit); ro.observe(canvas.parentElement);
    stop = () => { cancelAnimationFrame(raf); ro.disconnect(); };
  },
  unmount() { stop?.(); stop = null; },
  actions: {
    tab: (d) => { ui.tab = d.id; ui.sel = null; app.audio.play('click'); commit(null); },
    select: (d) => { ui.sel = d.id; app.audio.play('click'); commit(null); },
    'equip-species': (d) => { commit((p) => { if (p.owned.species.includes(d.id)) p.equipped.species = d.id; }); app.audio.play('buy'); },
    equip: (d) => {
      commit((p) => { if (d.id === 'default' || owns(p, d.id)) p.equipped[d.slot] = d.id; });
      app.audio.play('buy');
    },
    'buy-species': (d, el) => {
      if (el.getAttribute('aria-disabled') === 'true') return fail('Not enough currency yet.');
      const res = commit((p) => { const r = buySpecies(p, d.id, d.cur); if (r.ok) p.equipped.species = d.id; return r; });
      if (!res.ok) return fail(res.error);
      app.audio.play('buy');
      toast({ title: `${speciesById(d.id).name} joins your hangar`, body: 'Equipped and ready to fly.', tone: 'gold', icon: 'sparkle' });
    },
    'buy-cos': (d, el) => {
      if (el.getAttribute('aria-disabled') === 'true') return fail('Not enough currency yet.');
      const res = commit((p) => { const r = buyCosmetic(p, d.id, d.cur); if (r.ok) p.equipped[r.item.kind] = d.id; return r; });
      if (!res.ok) return fail(res.error);
      app.audio.play('buy');
      toast({ title: `${res.item.name} unlocked`, body: 'Equipped.', tone: 'gold', icon: 'sparkle' });
    },
  },
};
