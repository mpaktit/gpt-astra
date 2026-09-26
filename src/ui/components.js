import { html, fmt, raw } from './dom.js';
import { CUR_ICON, icon } from './icons.js';
import { RARITIES } from '../data/rarity.js';
import { cosmeticById } from '../data/cosmetics.js';
import { CACHES } from '../data/economy.js';

export const price = (cur, amt, extra = '') => html`<span class="price price-${cur} ${extra}">${CUR_ICON[cur](14)}<b>${fmt(amt)}</b></span>`;

export const rarityChip = (r) => html`<span class="rarity r-${r}">${RARITIES[r]?.name || r}</span>`;

export const bar = (frac, tone = '') => html`<span class="bar ${tone}"><i style="transform:scaleX(${Math.max(0, Math.min(1, frac)).toFixed(4)})"></i></span>`;

const KIND_LABEL = { skin: 'Skin', trail: 'Trail', finale: 'Finale', title: 'Title' };

/** Human label for a reward bundle, e.g. pass tiers, missions, login days. */
export function rewardBits(r) {
  if (!r) return [];
  const bits = [];
  if (r.stardust) bits.push(html`<span class="rw">${CUR_ICON.stardust(14)}${fmt(r.stardust)}</span>`);
  if (r.crystals) bits.push(html`<span class="rw rw-crystals">${CUR_ICON.crystals(14)}${fmt(r.crystals)}</span>`);
  if (r.shards) bits.push(html`<span class="rw">${CUR_ICON.shards(14)}${fmt(r.shards)}</span>`);
  if (r.passXp) bits.push(html`<span class="rw rw-xp">+${fmt(r.passXp)} pass XP</span>`);
  if (r.cache) bits.push(html`<span class="rw">${icon('box', 14)}${CACHES[r.cache].name}</span>`);
  if (r.cosmetic) {
    const c = cosmeticById(r.cosmetic);
    if (c) bits.push(html`<span class="rw rw-cos r-${c.rarity}">${icon('sparkle', 14)}${c.name} <small>${KIND_LABEL[c.kind]}</small></span>`);
  }
  return bits;
}
export const reward = (r) => html`<span class="rewards">${rewardBits(r)}</span>`;

export const kindLabel = (k) => KIND_LABEL[k] || k;

export function stars(n, total = 3, size = 18) {
  let out = '';
  for (let i = 0; i < total; i++) out += `<span class="st ${i < n ? 'on' : ''}">${icon('star', size).s}</span>`;
  return raw(`<span class="stars" aria-label="${n} of ${total} stars">${out}</span>`);
}

export const kbd = (k) => html`<kbd>${k}</kbd>`;
