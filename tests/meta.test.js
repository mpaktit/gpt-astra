import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, sanitizeProfile, addXp, xpToNext, cleanName } from '../src/meta/profile.js';
import { createStore, encode, decode } from '../src/meta/save.js';
import { spend, grant, canAfford } from '../src/meta/wallet.js';
import { buySpecies, buyCosmetic, openCache, rollCache, exchange, buyPass, dailyOffers } from '../src/meta/store.js';
import { applyRun, starsFor } from '../src/meta/progression.js';
import { ensureMissions, claimMission, rerollMission } from '../src/meta/missions.js';
import { claimTier, claimAll } from '../src/meta/pass.js';
import { checkLogin, claimLogin } from '../src/meta/login.js';
import { claimAchievement } from '../src/meta/achievements.js';
import { CACHES } from '../src/data/economy.js';
import { SEASON } from '../src/data/pass.js';
import { SPECIES } from '../src/data/species.js';
import { worldById } from '../src/data/worlds.js';
import { cosmeticById } from '../src/data/cosmetics.js';
import { createRng } from '../src/core/rng.js';
import { dailyConfig } from '../src/data/modes.js';

const NOW = new Date(2026, 8, 26, 12).getTime();
const run = (o = {}) => ({ score: 500, duration: 60000, orbs: 30, comets: 2, crystals: 0, powerups: 1, abilityUses: 2, rivals: 0, severs: 0, maxCombo: 3, length: 20, maxLen: 20, cause: 'self', worldId: 'nebula', modeId: 'voyage', speciesId: 'drift', ...o });

test('spend is atomic and rejects bad input', () => {
  const p = createProfile(NOW);
  assert.equal(spend(p, { stardust: 999999 }, 'x'), false);
  assert.equal(p.wallet.stardust, 600);
  assert.equal(spend(p, { stardust: -5 }, 'x'), false);
  assert.equal(spend(p, { stardust: 1.5 }, 'x'), false);
  assert.equal(spend(p, { gold: 1 }, 'x'), false);
  assert.equal(spend(p, { stardust: 100, crystals: 9999 }, 'x'), false, 'no partial spend');
  assert.equal(p.wallet.stardust, 600);
  assert.equal(spend(p, { stardust: 100 }, 'x'), true);
  assert.equal(p.wallet.stardust, 500);
  assert.equal(p.ledger.at(-1).amt, -100);
});

test('every species is earnable with stardust alone (no pay-to-win walls)', () => {
  for (const sp of SPECIES) assert.ok(sp.price.stardust !== undefined, sp.id);
});

test('buying species and cosmetics', () => {
  const p = createProfile(NOW);
  grant(p, { stardust: 5000 }, 'test');
  assert.equal(buySpecies(p, 'nova', 'stardust').ok, true);
  assert.equal(buySpecies(p, 'nova', 'stardust').ok, false, 'no double buy');
  assert.equal(buySpecies(p, 'solar', 'crystals').ok, false, 'cannot afford');
  assert.equal(buyCosmetic(p, 'tidal', 'stardust').ok, true);
  assert.equal(buyCosmetic(p, 'solar-crown', 'crystals').ok, false, 'pass exclusive not for sale');
  assert.equal(buyCosmetic(p, 'nope', 'stardust').ok, false);
});

test('cache odds sum to 1 and pity guarantees an epic', () => {
  for (const c of Object.values(CACHES)) {
    const sum = Object.values(c.odds).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, c.id);
  }
  const p = createProfile(NOW);
  const rng = { weighted: () => 'common', pick: (a) => a[0], next: () => 0 };
  let sawEpic = false;
  for (let i = 0; i < CACHES.nebula.pity.epic; i++) if (rollCache(p, 'nebula', rng).rarity === 'epic') sawEpic = true;
  assert.ok(sawEpic);
  const q = createProfile(NOW);
  let sawLeg = false;
  for (let i = 0; i < CACHES.nebula.pity.legendary; i++) if (rollCache(q, 'nebula', rng).rarity === 'legendary') sawLeg = true;
  assert.ok(sawLeg);
});

test('opening caches: duplicates convert to shards', () => {
  const p = createProfile(NOW);
  grant(p, { stardust: 1e6 }, 'test');
  for (let i = 0; i < 80; i++) assert.equal(openCache(p, 'nebula', NOW).ok, true);
  assert.ok(p.wallet.shards > 0, 'eventually duplicates give shards');
  assert.equal(p.caches.opened, 80);
});

test('cache odds are roughly honest over many rolls', () => {
  const p = createProfile(NOW);
  const rng = createRng(77);
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const N = 20000;
  for (let i = 0; i < N; i++) counts[rollCache(p, 'nebula', rng).rarity]++;
  assert.ok(counts.common / N > 0.5 && counts.common / N < 0.66);
  assert.ok(counts.legendary / N >= 0.01, 'pity can only raise legendary rate');
});

test('exchange and pass purchase', () => {
  const p = createProfile(NOW);
  assert.equal(buyPass(p).ok, false);
  grant(p, { crystals: 2000 }, 'test');
  assert.equal(exchange(p).ok, true);
  assert.equal(buyPass(p).ok, true);
  assert.equal(buyPass(p).ok, false);
  assert.equal(p.pass.premium, true);
});

test('level curve', () => {
  const p = createProfile(NOW);
  const ups = addXp(p, xpToNext(1) + xpToNext(2) + 5);
  assert.equal(ups, 2);
  assert.equal(p.level, 3);
  assert.equal(p.xp, 5);
});

test('applyRun grants rewards, stars, bests, stats', () => {
  const p = createProfile(NOW);
  const w = worldById('nebula');
  const r = applyRun(p, run({ score: w.stars[1] }), NOW);
  assert.ok(r.stardust > 0 && r.xp > 0);
  assert.equal(p.stars.nebula, 2);
  assert.equal(r.newStars, 2);
  assert.equal(r.isBest, true);
  assert.equal(p.stats.runs, 1);
  const again = applyRun(p, run({ score: 10 }), NOW);
  assert.equal(again.newStars, 0);
  assert.equal(again.isBest, false);
  assert.equal(starsFor(w, 0), 0);
  assert.equal(starsFor(w, 1e9), 3);
});

test('mastery 5 unlocks the ascendant skin', () => {
  const p = createProfile(NOW);
  p.mastery.drift = 5300;
  const r = applyRun(p, run({ score: 3000 }), NOW);
  assert.ok(r.unlocks.includes('drift-ascendant'));
  assert.ok(p.owned.cosmetics.includes('drift-ascendant'));
});

test('daily rift pays once per day', () => {
  const p = createProfile(NOW);
  const cfg = dailyConfig('2026-09-26');
  const a = applyRun(p, run({ modeId: 'daily', worldId: cfg.worldId, score: 900 }), NOW);
  assert.ok(a.dailyReward);
  const b = applyRun(p, run({ modeId: 'daily', worldId: cfg.worldId, score: 900 }), NOW);
  assert.equal(b.dailyReward, null);
});

test('missions: deterministic per day, progress, claim once, reroll once', () => {
  const p = createProfile(NOW, 123);
  const q = createProfile(NOW, 123);
  ensureMissions(p, NOW); ensureMissions(q, NOW);
  assert.deepEqual(p.missions.daily, q.missions.daily);
  assert.equal(p.missions.daily.length, 3);
  assert.equal(p.missions.weekly.length, 3);
  p.missions.daily[0].progress = p.missions.daily[0].target;
  const before = p.wallet.stardust;
  assert.equal(claimMission(p, false, 0, NOW).ok, true);
  assert.ok(p.wallet.stardust > before);
  assert.equal(claimMission(p, false, 0, NOW).ok, false);
  assert.equal(rerollMission(p, 1, NOW).ok, true);
  assert.equal(rerollMission(p, 2, NOW).ok, false);
  const tomorrow = NOW + 86400000;
  ensureMissions(p, tomorrow);
  assert.equal(p.missions.rerolled, false);
});

test('pass: tiers gate on xp and premium, claim once', () => {
  const p = createProfile(NOW);
  assert.equal(claimTier(p, 2, 'free', NOW).ok, false);
  p.pass.xp = 10000;
  assert.equal(claimTier(p, 2, 'free', NOW).ok, true);
  assert.equal(claimTier(p, 2, 'free', NOW).ok, false);
  assert.equal(claimTier(p, 3, 'premium', NOW).ok, false);
  p.pass.premium = true;
  const res = claimAll(p, NOW);
  assert.ok(res.length > 3 && res.every((r) => r.ok));
  const premiumCrystals = SEASON.tiers.reduce((a, t) => a + (t.premium?.crystals || 0), 0);
  assert.ok(premiumCrystals >= 950, 'premium track pays for next season');
  for (const t of SEASON.tiers) for (const tr of ['free', 'premium']) if (t[tr]?.cosmetic) assert.ok(cosmeticById(t[tr].cosmetic), t[tr].cosmetic);
});

test('login calendar: once a day, never resets', () => {
  const p = createProfile(NOW);
  assert.equal(checkLogin(p, NOW), true);
  assert.equal(claimLogin(p, NOW).ok, true);
  assert.equal(checkLogin(p, NOW), false);
  assert.equal(claimLogin(p, NOW).ok, false);
  checkLogin(p, NOW + 5 * 86400000);
  assert.equal(claimLogin(p, NOW + 5 * 86400000).day, 2);
});

test('achievements unlock and claim once', () => {
  const p = createProfile(NOW);
  const r = applyRun(p, run(), NOW);
  assert.ok(r.achievements.some((a) => a.id === 'first-flight'));
  assert.equal(claimAchievement(p, 'first-flight', NOW).ok, true);
  assert.equal(claimAchievement(p, 'first-flight', NOW).ok, false);
});

test('save: roundtrip, tamper detection, backup restore, import validation', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const store = createStore(storage);
  const fresh = store.load(NOW);
  assert.equal(fresh.status, 'new');
  const p = fresh.profile;
  p.wallet.crystals = 77;
  store.save(p);
  store.save(p);
  assert.equal(store.load(NOW).profile.wallet.crystals, 77);
  // tamper the main slot
  const wrap = JSON.parse(mem.get('astra.save.v2'));
  wrap.data = wrap.data.replace('"crystals":77', '"crystals":999999');
  mem.set('astra.save.v2', JSON.stringify(wrap));
  const loaded = store.load(NOW);
  assert.equal(loaded.status, 'restored');
  assert.equal(loaded.profile.wallet.crystals, 77);
  assert.equal(store.importText('garbage').ok, false);
  const code = store.exportText(p);
  assert.equal(store.importText(code, NOW).ok, true);
  assert.equal(decode(encode(p)).status, 'ok');
});

test('sanitize clamps hostile data and cleans names', () => {
  const p = sanitizeProfile({ wallet: { stardust: -50, crystals: 1e20 }, level: 9999, owned: { species: ['drift', 'hacker', 'solar'] }, equipped: { species: 'hacker' }, name: '<img src=x onerror=alert(1)>' }, NOW);
  assert.equal(p.wallet.stardust, 0);
  assert.equal(p.wallet.crystals, 1e8);
  assert.equal(p.level, 100);
  assert.deepEqual(p.owned.species, ['drift', 'solar']);
  assert.equal(p.equipped.species, 'drift');
  assert.ok(!/[<>=]/.test(p.name));
  assert.equal(cleanName('   '), 'Pilot');
  assert.equal(sanitizeProfile(null).level, 1);
});

test('daily shop is stable for a day and varies across days', () => {
  const p = createProfile(NOW, 55);
  const a = dailyOffers(p, new Date(NOW));
  const b = dailyOffers(p, new Date(NOW + 3600000));
  const c = dailyOffers(p, new Date(NOW + 86400000 * 3));
  assert.deepEqual(a.items.map((i) => i.id), b.items.map((i) => i.id));
  assert.equal(a.items.length, 6);
  assert.notDeepEqual(a.items.map((i) => i.id), c.items.map((i) => i.id));
});
