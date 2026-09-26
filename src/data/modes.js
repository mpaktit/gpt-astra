import { hashString } from '../core/rng.js';
import { WORLDS } from './worlds.js';

export const MODES = {
  voyage: { id: 'voyage', name: 'Voyage', desc: 'Survive, grow, chase the three star goals.', orbs: 1, timer: 0, speedMul: 1, rewardMul: 1 },
  blitz:  { id: 'blitz',  name: 'Blitz',  desc: '60 seconds, three orbs at once. Comets add time.', orbs: 3, timer: 60, speedMul: 0.9, rewardMul: 1.1 },
  daily:  { id: 'daily',  name: 'Daily Rift', desc: 'Same seed for every pilot today, plus a twist.', orbs: 1, timer: 0, speedMul: 1, rewardMul: 1.25 },
};

export const MODIFIERS = {
  feast:     { id: 'feast',     name: 'Feast',        desc: 'Three orbs on the board at all times.' },
  overdrive: { id: 'overdrive', name: 'Overdrive',    desc: 'Everything is 20% faster. Score x1.3.' },
  shower:    { id: 'shower',    name: 'Comet Shower', desc: 'Comets fall three times as often.' },
  glass:     { id: 'glass',     name: 'Glass Cannon', desc: 'No shields or phase pickups. Score x1.25.' },
  giant:     { id: 'giant',     name: 'Giant',        desc: 'Start at length 12. Good luck turning.' },
};

/**
 * Daily Rift config is pure: same date key -> same world, twist and seed for everyone.
 * The pool is every sector, so each one gets its day. A pilot below the sector's
 * unlock level still gets a preview run, so the UI labels it as one (see home.js).
 */
export function dailyConfig(dateKey) {
  const h = hashString('astra-daily-' + dateKey);
  const mods = Object.keys(MODIFIERS);
  const world = WORLDS[h % WORLDS.length];
  return { dateKey, worldId: world.id, modifier: mods[(h >>> 8) % mods.length], seed: h };
}
