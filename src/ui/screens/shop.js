import { html, $$, fmt } from '../dom.js';
import { icon, CUR_ICON } from '../icons.js';
import { price, rarityChip, kindLabel } from '../components.js';
import { app, commit, fail, toast, reveal, go } from '../app.js';
import { CACHES, CRYSTAL_PACKS, STARTER_PACK, EXCHANGE, COSMETIC_PRICES } from '../../data/economy.js';
import { RARITIES } from '../../data/rarity.js';
import { cosmeticById } from '../../data/cosmetics.js';
import { speciesById } from '../../data/species.js';
import { dailyOffers, openCache, buyCosmetic, exchange, owns, unlockCosmetic } from '../../meta/store.js';
import { grant } from '../../meta/wallet.js';
import { msToMidnight, fmtCountdown } from '../../meta/time.js';
import { paintSwatch } from '../../render/renderer.js';

let tickTimer = 0;

function offer(p, item, big = false) {
  const own = owns(p, item.id);
  const pr = COSMETIC_PRICES[item.rarity];
  const cur = pr.stardust && item.rarity !== 'epic' ? 'stardust' : pr.crystals ? 'crystals' : 'stardust';
  const amt = pr[cur];
  return html`<li class="offer r-${item.rarity} ${big ? 'big' : ''} ${own ? 'own' : ''}">
    <div class="offer-vis">${item.kind === 'skin' ? html`<canvas data-swatch="${item.id}"></canvas>` : item.kind === 'title' ? html`<span class="tile-title">${item.name}</span>` : html`<span class="tile-ic">${icon(item.kind === 'trail' ? 'sparkle' : 'bolt', big ? 56 : 32)}</span>`}</div>
    <div class="offer-info">
      ${rarityChip(item.rarity)}
      <b class="offer-name">${item.name}</b>
      <small class="muted">${kindLabel(item.kind)}</small>
    </div>
    ${own ? html`<span class="offer-own">${icon('check', 16)} Owned</span>`
      : html`<button class="btn ${big ? 'primary' : 'quiet'} sm" data-action="buy-offer" data-id="${item.id}" data-cur="${cur}" data-confirm="Confirm ${fmt(amt)}" ${p.wallet[cur] < amt ? 'aria-disabled="true"' : ''}>${price(cur, amt)}</button>`}
  </li>`;
}

export const shop = {
  id: 'shop', title: 'Shop',
  render(app) {
    const p = app.profile;
    const { items } = dailyOffers(p);
    const demo = app.payments.mode === 'demo';
    const store = app.payments.mode !== 'disabled';
    return html`
    <section class="shop">
      <header class="page-head">
        <h1 class="h-display">Shop</h1>
        <p class="muted">Everything here is cosmetic or a shortcut. Power is earned in flight.</p>
      </header>

      <section class="shop-sec">
        <div class="sec-head"><h2 class="h-sub">Featured today</h2><span class="muted small">${icon('clock', 14)} New stock in <b id="shop-clock">${fmtCountdown(msToMidnight())}</b></span></div>
        <ul class="offers">${items.map((it, i) => offer(p, it, i === 0))}</ul>
      </section>

      <section class="shop-sec">
        <div class="sec-head"><h2 class="h-sub">Caches</h2><span class="muted small">Unowned items first. Duplicates become Relic Shards.</span></div>
        <div class="caches">
          ${Object.values(CACHES).map((c) => {
            const cur = Object.keys(c.price)[0], amt = c.price[cur];
            const toEpic = c.pity.epic - (p.caches.sinceEpic[c.id] || 0);
            const toLeg = c.pity.legendary - (p.caches.sinceLegendary[c.id] || 0);
            return html`<article class="cache cache-${c.id}">
              <div class="cache-art">${icon('box', 64)}</div>
              <div class="cache-body">
                <h3>${c.name}</h3>
                <p class="pity">Epic or better within <b>${toEpic}</b> · Legendary within <b>${toLeg}</b></p>
                <details class="odds"><summary>Drop rates</summary>
                  <ul>${Object.entries(c.odds).map(([r, v]) => html`<li><span class="rarity r-${r}">${RARITIES[r].name}</span><b>${(v * 100).toFixed(1)}%</b></li>`)}</ul>
                  <small class="muted">Pity guarantees raise these, never lower them.</small>
                </details>
                <button class="btn primary" data-action="open-cache" data-id="${c.id}" data-confirm="Open for ${fmt(amt)}" ${p.wallet[cur] < amt ? 'aria-disabled="true"' : ''}>Open ${price(cur, amt)}</button>
              </div>
            </article>`;
          })}
        </div>
      </section>

      <section class="shop-sec">
        <div class="sec-head"><h2 class="h-sub">Void Crystals</h2>${demo ? html`<span class="demo-tag">Demo store: no real charges</span>` : ''}</div>
        ${!p.purchases.starter ? html`<article class="starter">
          <div><p class="eyebrow">One time only</p><h3>Starter Pack</h3>
          <p class="rewards">${CUR_ICON.crystals(16)} <b>${STARTER_PACK.crystals}</b> · ${CUR_ICON.stardust(16)} <b>${fmt(STARTER_PACK.stardust)}</b> · <span class="rarity r-rare">${cosmeticById(STARTER_PACK.cosmetic).name}</span> skin</p></div>
          <button class="btn gold" data-action="buy-pack" data-id="starter" ${store ? '' : 'aria-disabled="true"'}>${store ? `$${STARTER_PACK.usd}` : 'At launch'}</button>
        </article>` : ''}
        <ul class="packs">
          ${CRYSTAL_PACKS.map((pk) => html`<li class="pack">
            ${pk.tag ? html`<span class="pack-tag">${pk.tag}</span>` : ''}
            <span class="pack-gem">${CUR_ICON.crystals(28)}</span>
            <b class="pack-amt">${fmt(pk.crystals + pk.bonus)}</b>
            <small class="muted">${pk.bonus ? `${fmt(pk.crystals)} + ${fmt(pk.bonus)} bonus` : 'Crystals'}</small>
            <button class="btn quiet sm" data-action="buy-pack" data-id="${pk.id}" ${store ? '' : 'aria-disabled="true"'}>${store ? `$${pk.usd}` : 'At launch'}</button>
          </li>`)}
        </ul>
        ${!store ? html`<p class="muted small">The crystal store opens with our server launch. Until then crystals drop from runs, achievements, the flight log and the pass.</p>` : ''}
      </section>

      <section class="shop-sec exchange">
        <div><h2 class="h-sub">Exchange</h2><p class="muted small">Short on Stardust for a species? Convert.</p></div>
        <button class="btn quiet" data-action="exchange" data-confirm="Confirm exchange" ${p.wallet.crystals < EXCHANGE.crystals ? 'aria-disabled="true"' : ''}>${price('crystals', EXCHANGE.crystals)} ${icon('swap', 16)} ${price('stardust', EXCHANGE.stardust)}</button>
      </section>
    </section>`;
  },
  mount(root, app) {
    $$('canvas[data-swatch]', root).forEach((c) => paintSwatch(c, cosmeticById(c.dataset.swatch), speciesById(app.profile.equipped.species)));
    const clock = root.querySelector('#shop-clock');
    tickTimer = setInterval(() => { if (clock) clock.textContent = fmtCountdown(msToMidnight()); }, 1000);
  },
  unmount() { clearInterval(tickTimer); },
  actions: {
    'buy-offer': (d, el) => {
      if (el.getAttribute('aria-disabled') === 'true') return fail(`Not enough ${d.cur === 'crystals' ? 'Void Crystals' : 'Stardust'}.`);
      const res = commit((p) => buyCosmetic(p, d.id, d.cur));
      if (!res.ok) return fail(res.error);
      app.audio.play('buy');
      reveal({ item: res.item, rarity: res.item.rarity, dup: false, title: 'Purchased', onEquip: () => commit((p) => { p.equipped[res.item.kind] = res.item.id; }) });
    },
    'open-cache': (d, el) => {
      if (el.getAttribute('aria-disabled') === 'true') return fail('Not enough currency for that cache.');
      const res = commit((p) => openCache(p, d.id));
      if (!res.ok) return fail(res.error);
      reveal({ item: res.item, rarity: res.rarity, dup: res.dup, shards: res.shards, pity: res.pity, title: CACHES[d.id].name, onEquip: () => commit((p) => { p.equipped[res.item.kind] = res.item.id; }) });
    },
    exchange: (d, el) => {
      if (el.getAttribute('aria-disabled') === 'true') return fail('Not enough Void Crystals.');
      const res = commit((p) => exchange(p));
      if (!res.ok) return fail(res.error);
      app.audio.play('buy');
      toast({ title: `+${fmt(EXCHANGE.stardust)} Stardust`, tone: 'gold', icon: 'sparkle' });
    },
    'buy-pack': async (d, el) => {
      if (el.getAttribute('aria-disabled') === 'true') return fail('The crystal store opens at launch.');
      const pack = d.id === 'starter' ? STARTER_PACK : CRYSTAL_PACKS.find((x) => x.id === d.id);
      if (!pack) return;
      el.disabled = true;
      const res = await app.payments.purchase(pack);
      el.disabled = false;
      if (!res.ok) { if (!res.pending) fail(res.error || 'Purchase failed.'); return; }
      commit((p) => {
        if (pack.oneTime && p.purchases.starter) return;
        grant(p, { crystals: pack.crystals + (pack.bonus || 0), stardust: pack.stardust || 0 }, `iap:${pack.id}${res.demo ? ':demo' : ''}`);
        if (pack.cosmetic) unlockCosmetic(p, pack.cosmetic);
        if (pack.oneTime) p.purchases.starter = true;
        p.purchases.receipts.push({ id: pack.id, receipt: res.receipt, at: Date.now(), demo: !!res.demo });
        p.purchases.receipts = p.purchases.receipts.slice(-50);
      });
      app.audio.play('buy');
      toast({ title: 'Thanks, pilot', body: `${fmt(pack.crystals + (pack.bonus || 0))} Void Crystals added${res.demo ? ' (demo)' : ''}.`, tone: 'gold', icon: 'gift' });
    },
  },
};
