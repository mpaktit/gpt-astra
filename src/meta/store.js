// Buying things: species, cosmetics, caches, exchange, pass. Every function validates and is atomic.
import { speciesById } from '../data/species.js';
import { cosmeticById, SHOPPABLE } from '../data/cosmetics.js';
import { COSMETIC_PRICES, CACHES, SHARD_PRICES, DUPLICATE_SHARDS, EXCHANGE, PASS_PRICE } from '../data/economy.js';
import { spend, grant } from './wallet.js';
import { createRng, hashString } from '../core/rng.js';
import { dateKey } from './time.js';

export const owns = (p, id) => p.owned.cosmetics.includes(id) || p.owned.species.includes(id);

export function buySpecies(p, id, currency, now) {
  const sp = speciesById(id);
  if (sp.id !== id) return { ok: false, error: 'Unknown species.' };
  if (p.owned.species.includes(id)) return { ok: false, error: 'Already yours.' };
  const amount = sp.price[currency];
  if (!amount) return { ok: false, error: 'Not sold for that currency.' };
  if (!spend(p, { [currency]: amount }, `species:${id}`, now)) return { ok: false, error: 'Not enough ' + currency + '.' };
  p.owned.species.push(id);
  p.mastery[id] = p.mastery[id] || 0;
  return { ok: true };
}

export function priceOf(item) {
  return item ? COSMETIC_PRICES[item.rarity] : null;
}

export function buyCosmetic(p, id, currency, now) {
  const item = cosmeticById(id);
  if (!item || item.source) return { ok: false, error: 'Not for sale.' };
  if (owns(p, id)) return { ok: false, error: 'Already yours.' };
  const amount = currency === 'shards' ? SHARD_PRICES[item.rarity] : priceOf(item)?.[currency];
  if (!amount) return { ok: false, error: 'Not sold for that currency.' };
  if (!spend(p, { [currency]: amount }, `cosmetic:${id}`, now)) return { ok: false, error: 'Not enough ' + currency + '.' };
  p.owned.cosmetics.push(id);
  return { ok: true, item };
}

export function unlockCosmetic(p, id) {
  const item = cosmeticById(id);
  if (!item) return { dup: false, item: null };
  if (owns(p, id)) {
    const shards = DUPLICATE_SHARDS[item.rarity] || 2;
    grant(p, { shards }, `dup:${id}`);
    return { dup: true, shards, item };
  }
  p.owned.cosmetics.push(id);
  return { dup: false, item };
}

/** Roll a cache. Pity counters guarantee an epic/legendary within N opens. Deterministic given rng. */
export function rollCache(p, cacheId, rng) {
  const c = CACHES[cacheId];
  p.caches.sinceEpic[cacheId] = (p.caches.sinceEpic[cacheId] || 0) + 1;
  p.caches.sinceLegendary[cacheId] = (p.caches.sinceLegendary[cacheId] || 0) + 1;
  let rarity = rng.weighted(Object.entries(c.odds));
  let pity = false;
  if (p.caches.sinceLegendary[cacheId] >= c.pity.legendary) { rarity = 'legendary'; pity = true; }
  else if (p.caches.sinceEpic[cacheId] >= c.pity.epic && rarity !== 'legendary' && rarity !== 'epic') { rarity = 'epic'; pity = true; }
  if (rarity === 'legendary') { p.caches.sinceLegendary[cacheId] = 0; p.caches.sinceEpic[cacheId] = 0; }
  if (rarity === 'epic') p.caches.sinceEpic[cacheId] = 0;
  const pool = SHOPPABLE.filter((x) => x.rarity === rarity && x.id !== 'none');
  // Prefer unowned items so caches feel generous; duplicates only when the tier is complete.
  const fresh = pool.filter((x) => !owns(p, x.id));
  // An empty pool would hand back undefined and corrupt the save, so fall back to
  // the best rarity that does have stock rather than crashing the open.
  const item = rng.pick(fresh.length ? fresh : pool) || rng.pick(SHOPPABLE.filter((x) => x.id !== 'none'));
  if (!item) return { rarity, item: null, pity };
  p.caches.opened++;
  return { rarity, item, pity };
}

export function openCache(p, cacheId, now = Date.now(), { free = false } = {}) {
  const c = CACHES[cacheId];
  if (!c) return { ok: false, error: 'Unknown cache.' };
  if (!free && !spend(p, c.price, `cache:${cacheId}`, now)) return { ok: false, error: 'Not enough currency.' };
  const rng = createRng(hashString(`${p.seed}:${cacheId}:${p.caches.opened}`));
  const roll = rollCache(p, cacheId, rng);
  if (!roll.item) return { ok: false, error: 'That cache is empty. Try again soon.' };
  const res = unlockCosmetic(p, roll.item.id);
  return { ok: true, ...roll, dup: res.dup, shards: res.shards || 0 };
}

export function exchange(p, now) {
  if (!spend(p, { crystals: EXCHANGE.crystals }, 'exchange', now)) return { ok: false, error: 'Not enough crystals.' };
  grant(p, { stardust: EXCHANGE.stardust }, 'exchange', now);
  return { ok: true };
}

export function buyPass(p, now) {
  if (p.pass.premium) return { ok: false, error: 'You already have the premium pass.' };
  if (!spend(p, PASS_PRICE, 'pass:premium', now)) return { ok: false, error: 'Not enough crystals.' };
  p.pass.premium = true;
  return { ok: true };
}

/** Today's rotating featured shop. Same for a given pilot seed + date, refreshes at local midnight. */
export function dailyOffers(p, d = new Date()) {
  const day = dateKey(d);
  const rng = createRng(hashString(`shop:${p.seed}:${day}`));
  const byRarity = (r) => SHOPPABLE.filter((x) => x.rarity === r && x.id !== 'none');
  const picks = [];
  const take = (r) => {
    const pool = byRarity(r).filter((x) => !picks.includes(x));
    if (pool.length) picks.push(rng.pick(pool));
  };
  take(rng.chance(0.35) ? 'legendary' : 'epic');
  take('epic'); take('rare'); take('rare'); take('common'); take('common');
  return { day, items: picks };
}
