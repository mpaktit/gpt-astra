import { LOGIN_REWARDS } from '../data/economy.js';
import { dateKey } from './time.js';
import { grantReward } from './pass.js';

/** Call on boot. Marks today's login reward as claimable once per day. */
export function checkLogin(p, now = Date.now()) {
  const day = dateKey(new Date(now));
  if (p.login.last === day) return false;
  p.login.pending = true;
  return true;
}

export function claimLogin(p, now = Date.now()) {
  if (!p.login.pending) return { ok: false };
  const day = dateKey(new Date(now));
  const idx = p.login.streak % LOGIN_REWARDS.length;
  const reward = LOGIN_REWARDS[idx];
  p.login.pending = false;
  p.login.last = day;
  p.login.streak++;
  return { ok: true, day: idx + 1, reward, results: grantReward(p, reward, `login:${idx + 1}`, now) };
}
