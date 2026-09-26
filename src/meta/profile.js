// Player profile: shape, defaults, migrations and validation. Pure: no storage access here.
import { STARTING_WALLET } from '../data/economy.js';
import { DEFAULT_COSMETICS } from '../data/cosmetics.js';
import { SPECIES } from '../data/species.js';
import { WORLDS } from '../data/worlds.js';

export const PROFILE_VERSION = 2;
export const LEDGER_CAP = 150;

export function defaultSettings() {
  return { sfx: 0.8, music: 0.45, haptics: true, reducedMotion: false, controls: 'auto', colorblind: false, showGrid: true };
}

export function createProfile(now = Date.now(), seed = (now ^ 0x5bd1e995) >>> 0) {
  return {
    v: PROFILE_VERSION,
    createdAt: now,
    seed,
    name: 'Pilot',
    level: 1,
    xp: 0,
    wallet: { ...STARTING_WALLET },
    owned: { species: ['drift'], cosmetics: [...DEFAULT_COSMETICS] },
    equipped: { species: 'drift', skin: 'default', trail: 'none', finale: 'pop', title: 'hatchling' },
    mastery: { drift: 0 },
    stars: {},
    best: {},
    leaderboard: {},
    last: { worldId: 'nebula', modeId: 'voyage' },
    stats: { runs: 0, orbs: 0, comets: 0, crystalsFound: 0, powerups: 0, abilityUses: 0, rivals: 0, severs: 0, playMs: 0, bestScore: 0, bestCombo: 0, bestLength: 0, dailyClears: 0, deaths: {} },
    missions: { day: '', daily: [], rerolled: false, week: '', weekly: [] },
    achievements: {},
    pass: { season: 1, xp: 0, premium: false, claimedFree: [], claimedPremium: [] },
    caches: { opened: 0, sinceEpic: { nebula: 0, void: 0 }, sinceLegendary: { nebula: 0, void: 0 } },
    login: { last: '', streak: 0, pending: false },
    daily: { last: '' },
    shop: { day: '', bought: [] },
    purchases: { starter: false, receipts: [] },
    settings: defaultSettings(),
    flags: { tutorialDone: false, tampered: false },
    ledger: [],
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0, min = 0, max = 1e9) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);

/** Deep-merge a loaded blob onto defaults, clamping numbers and dropping unknown ids. Never throws. */
export function sanitizeProfile(raw, now = Date.now()) {
  const base = createProfile(now);
  if (!isObj(raw)) return base;
  const p = migrate(structuredCloneSafe(raw));
  const out = base;
  out.createdAt = num(p.createdAt, now, 0, 9e15);
  out.seed = num(p.seed, base.seed, 0, 0xffffffff) >>> 0;
  out.name = cleanName(p.name);
  out.level = Math.floor(num(p.level, 1, 1, 100));
  out.xp = Math.floor(num(p.xp, 0, 0, 1e7));
  if (isObj(p.wallet)) for (const k of Object.keys(out.wallet)) out.wallet[k] = Math.floor(num(p.wallet[k], out.wallet[k], 0, 1e8));
  const speciesIds = new Set(SPECIES.map((s) => s.id));
  if (isObj(p.owned)) {
    if (Array.isArray(p.owned.species)) out.owned.species = [...new Set(['drift', ...p.owned.species.filter((id) => speciesIds.has(id))])];
    if (Array.isArray(p.owned.cosmetics)) out.owned.cosmetics = [...new Set([...DEFAULT_COSMETICS, ...p.owned.cosmetics.filter((x) => typeof x === 'string' && x.length < 40)])];
  }
  if (isObj(p.equipped)) Object.assign(out.equipped, pickStrings(p.equipped, Object.keys(out.equipped)));
  if (!out.owned.species.includes(out.equipped.species)) out.equipped.species = 'drift';
  for (const k of ['mastery', 'stars', 'best']) if (isObj(p[k])) for (const [id, v] of Object.entries(p[k])) if (typeof id === 'string' && id.length < 40) out[k][id] = num(v, 0, 0, 1e8);
  for (const w of WORLDS) if (out.stars[w.id] != null) out.stars[w.id] = Math.min(3, out.stars[w.id]);
  if (isObj(p.leaderboard)) out.leaderboard = p.leaderboard;
  if (isObj(p.last)) Object.assign(out.last, pickStrings(p.last, ['worldId', 'modeId']));
  if (isObj(p.stats)) for (const [k, v] of Object.entries(p.stats)) if (k in out.stats && k !== 'deaths') out.stats[k] = num(v, 0, 0, 1e12);
  if (isObj(p.stats?.deaths)) out.stats.deaths = p.stats.deaths;
  for (const k of ['missions', 'achievements', 'pass', 'caches', 'login', 'daily', 'shop', 'purchases', 'flags']) if (isObj(p[k])) out[k] = { ...out[k], ...p[k] };
  if (isObj(p.settings)) {
    const d = defaultSettings();
    for (const k of Object.keys(d)) if (typeof p.settings[k] === typeof d[k]) out.settings[k] = p.settings[k];
    out.settings.sfx = num(out.settings.sfx, 0.8, 0, 1);
    out.settings.music = num(out.settings.music, 0.45, 0, 1);
  }
  if (Array.isArray(p.ledger)) out.ledger = p.ledger.slice(-LEDGER_CAP);
  out.pass.xp = num(out.pass.xp, 0, 0, 1e8);
  return out;
}

function migrate(p) {
  let v = p.v || 1;
  if (v < 2) {
    // v1 stored currencies at the top level
    p.wallet = p.wallet || { stardust: p.stardust, crystals: p.crystals, shards: 0 };
    v = 2;
  }
  p.v = PROFILE_VERSION;
  return p;
}

function structuredCloneSafe(o) {
  try { return JSON.parse(JSON.stringify(o)); } catch { return {}; }
}
function pickStrings(src, keys) {
  const o = {};
  for (const k of keys) if (typeof src[k] === 'string' && src[k].length < 40) o[k] = src[k];
  return o;
}
export function cleanName(v) {
  if (typeof v !== 'string') return 'Pilot';
  const s = v.normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16);
  return s || 'Pilot';
}

// ---------------------------------------------------------------- level curve
export const xpToNext = (level) => 450 + (level - 1) * 160;
export function addXp(p, amount) {
  let ups = 0;
  p.xp += Math.max(0, Math.floor(amount));
  while (p.level < 100 && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    ups++;
  }
  if (p.level >= 100) p.xp = 0;
  return ups;
}
