import { SEASON } from '../data/pass.js';
import { grant } from './wallet.js';
import { unlockCosmetic, openCache } from './store.js';
import { passTier } from './progression.js';

export function grantReward(p, reward, reason, now) {
  const results = [];
  if (!reward) return results;
  grant(p, reward, reason, now);
  if (reward.cosmetic) results.push({ kind: 'cosmetic', ...unlockCosmetic(p, reward.cosmetic) });
  if (reward.cache) results.push({ kind: 'cache', ...openCache(p, reward.cache, now, { free: true }) });
  return results;
}

export function claimTier(p, tier, track, now = Date.now()) {
  const t = SEASON.tiers[tier - 1];
  if (!t) return { ok: false, error: 'No such tier.' };
  if (tier > passTier(p)) return { ok: false, error: 'Tier not reached yet.' };
  const reward = t[track];
  if (!reward) return { ok: false, error: 'Nothing here.' };
  if (track === 'premium' && !p.pass.premium) return { ok: false, error: 'Premium pass required.' };
  const list = track === 'premium' ? p.pass.claimedPremium : p.pass.claimedFree;
  if (list.includes(tier)) return { ok: false, error: 'Already claimed.' };
  list.push(tier);
  return { ok: true, reward, results: grantReward(p, reward, `pass:${track}:${tier}`, now) };
}

export function claimableTiers(p) {
  const out = [];
  const reached = passTier(p);
  for (const t of SEASON.tiers) {
    if (t.tier > reached) break;
    if (t.free && !p.pass.claimedFree.includes(t.tier)) out.push([t.tier, 'free']);
    if (t.premium && p.pass.premium && !p.pass.claimedPremium.includes(t.tier)) out.push([t.tier, 'premium']);
  }
  return out;
}

export function claimAll(p, now = Date.now()) {
  return claimableTiers(p).map(([tier, track]) => ({ tier, track, ...claimTier(p, tier, track, now) }));
}
