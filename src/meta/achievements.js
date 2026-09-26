import { ACHIEVEMENTS } from '../data/achievements.js';
import { grant } from './wallet.js';
import { unlockCosmetic } from './store.js';

/** Marks newly-met achievements as done (claim is separate so the UI can celebrate it). */
export function checkAchievements(p) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]?.done) continue;
    let ok = false;
    try { ok = a.test(p); } catch { ok = false; }
    if (ok) { p.achievements[a.id] = { done: true, claimed: false }; fresh.push(a); }
  }
  return fresh;
}

export function claimAchievement(p, id, now = Date.now()) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  const st = p.achievements[id];
  if (!a || !st?.done || st.claimed) return { ok: false };
  st.claimed = true;
  grant(p, a.reward, `ach:${id}`, now);
  if (a.reward.cosmetic) unlockCosmetic(p, a.reward.cosmetic);
  return { ok: true, reward: a.reward };
}
