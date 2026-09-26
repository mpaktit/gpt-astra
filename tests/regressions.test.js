// Regressions for bugs found by playing the game in a browser (not by unit tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = globalThis;

const { app } = await import('../src/ui/app.js');
const { createProfile } = await import('../src/meta/profile.js');
const { ensureMissions } = await import('../src/meta/missions.js');
const { checkLogin } = await import('../src/meta/login.js');
const { dailyConfig } = await import('../src/data/modes.js');
const { WORLDS, worldById } = await import('../src/data/worlds.js');
const { SHOPPABLE } = await import('../src/data/cosmetics.js');
const { CACHES } = await import('../src/data/economy.js');
const { openCache, rollCache } = await import('../src/meta/store.js');
const { createRng } = await import('../src/core/rng.js');
const home = (await import('../src/ui/screens/home.js')).home;
const hangar = (await import('../src/ui/screens/hangar.js')).hangar;
const { hangarState } = await import('../src/ui/screens/hangar.js');

function fresh() { const p = createProfile(Date.now(), 42); ensureMissions(p); checkLogin(p); return p; }

// The `html` tag drops booleans so `${cond && markup}` works, which silently turned
// every `attr="${boolean}"` into attr="". State must render as literal true/false.
test('boolean aria state attributes render true/false, never empty', () => {
  app.profile = fresh();
  app.sel = null;

  // home: mode radiogroup
  let out = String(home.render(app));
  const checked = [...out.matchAll(/aria-checked="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(checked.length, 4, 'four mode radios');
  assert.ok(checked.includes('true'), 'exactly one selected mode is announced checked');
  assert.ok(checked.includes('false'), 'unselected modes are announced unchecked');
  assert.ok(!checked.includes(''), 'no radio renders aria-checked=""');

  // hangar: tabs (aria-selected) and pressed toggles
  for (const tab of ['species', 'skin', 'trail', 'finale', 'title']) {
    hangarState.tab = tab;
    hangarState.sel = null;
    out = String(hangar.render(app));
    for (const attr of ['aria-selected', 'aria-pressed']) {
      const vals = [...out.matchAll(new RegExp(`${attr}="([^"]*)"`, 'g'))].map((m) => m[1]);
      assert.ok(vals.length > 0, `${tab} renders ${attr}`);
      assert.ok(!vals.includes(''), `${tab} has no empty ${attr}`);
    }
    assert.ok(out.includes('aria-selected="true"'), `${tab} marks the active tab selected`);
  }
  hangarState.tab = 'species'; hangarState.sel = null;
});

// dailyConfig's comment claimed "first four sectors so new pilots can play it",
// but h % 4 handed out Event Horizon (level 10) on most days with no warning.
test('daily rift only ever picks a real sector, and flags locked ones in the UI', () => {
  const worlds = new Set(WORLDS.map((w) => w.id));
  for (let d = 1; d <= 400; d++) {
    const cfg = dailyConfig(`2026-${String((d % 12) + 1).padStart(2, '0')}-${String((d % 28) + 1).padStart(2, '0')}`);
    assert.ok(worlds.has(cfg.worldId), `${cfg.worldId} is a real sector`);
    assert.ok(cfg.modifier, 'has a twist');
  }

  // every sector gets its day, not just the first four
  const seen = new Set();
  for (let d = 1; d <= 60; d++) {
    const day = `2026-09-${String(d).padStart(2, '0')}`;
    seen.add(dailyConfig(day).worldId);
  }
  assert.equal(seen.size, WORLDS.length, 'all sectors appear in the daily rotation');

  // a pilot below the sector unlock is told it is a preview, not silently launched
  const p = fresh();
  app.profile = p;
  app.sel = null;
  const day = dailyConfig('2026-09-26');
  app.sel = { ...app.sel, modeId: 'daily' };
  const out = String(home.render(app));
  const sector = worldById(day.worldId);
  if (p.level < sector.unlockLevel) {
    assert.ok(out.includes('daily-preview'), 'locked daily sector is labelled a preview');
    assert.ok(out.includes(`level ${sector.unlockLevel}`), 'preview states the unlock level');
  } else {
    assert.ok(!out.includes('daily-preview'), 'unlocked daily sector shows no preview notice');
  }
});

// A cache tier with no stock used to hand back undefined and corrupt the save.
test('every cache rarity has stock, and a cache never yields a null item', () => {
  for (const c of Object.values(CACHES)) {
    for (const rarity of Object.keys(c.odds)) {
      const pool = SHOPPABLE.filter((x) => x.rarity === rarity && x.id !== 'none');
      assert.ok(pool.length > 0, `${rarity} must have at least one shappable cosmetic`);
    }
  }
  const p = fresh();
  p.wallet = { stardust: 999999, crystals: 99999, shards: 9999 };
  for (let i = 0; i < 400; i++) {
    const res = openCache(p, 'nebula');
    assert.ok(res.ok, 'cache opens');
    assert.ok(res.item && res.item.id, 'cache always returns a real item');
    assert.ok(p.owned.cosmetics.includes(res.item.id), 'item is granted');
  }
  // even with everything owned, the roll stays valid
  p.owned.cosmetics = SHOPPABLE.map((x) => x.id);
  const roll = rollCache(p, 'void', createRng(5));
  assert.ok(roll.item, 'roll still returns an item when the tier is complete');
});
