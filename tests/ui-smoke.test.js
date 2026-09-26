// Renders every screen to HTML in Node with a range of profile states. Catches template crashes,
// "undefined"/"NaN" leaking into copy, and unescaped user input. No browser needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = globalThis;

const { app } = await import('../src/ui/app.js');
const { createProfile } = await import('../src/meta/profile.js');
const { ensureMissions } = await import('../src/meta/missions.js');
const { checkLogin } = await import('../src/meta/login.js');
const { applyRun } = await import('../src/meta/progression.js');
const { ALL_COSMETICS } = await import('../src/data/cosmetics.js');
const { SPECIES } = await import('../src/data/species.js');
const screens = {
  home: (await import('../src/ui/screens/home.js')).home,
  play: (await import('../src/ui/screens/play.js')).play,
  results: (await import('../src/ui/screens/results.js')).results,
  hangar: (await import('../src/ui/screens/hangar.js')).hangar,
  shop: (await import('../src/ui/screens/shop.js')).shop,
  pass: (await import('../src/ui/screens/pass.js')).pass,
  missions: (await import('../src/ui/screens/missions.js')).missions,
  profile: (await import('../src/ui/screens/profile.js')).profile,
  settings: (await import('../src/ui/screens/settings.js')).settings,
};

function fresh() { const p = createProfile(Date.now(), 42); ensureMissions(p); checkLogin(p); return p; }
function veteran() {
  const p = fresh();
  p.level = 30; p.wallet = { stardust: 99999, crystals: 5000, shards: 300 };
  p.owned.species = SPECIES.map((s) => s.id);
  p.owned.cosmetics = ALL_COSMETICS.map((c) => c.id);
  p.pass.premium = true; p.pass.xp = 25500;
  p.equipped = { species: 'solar', skin: 'prism', trail: 'aurora-veil', finale: 'implode', title: 'sovereign' };
  p.name = '<script>alert(1)</script>';
  const run = { score: 2400, duration: 95000, orbs: 60, comets: 4, crystals: 1, powerups: 3, abilityUses: 5, rivals: 1, severs: 0, maxCombo: 6, length: 30, maxLen: 30, cause: 'rival', worldId: 'rift', modeId: 'voyage', speciesId: 'solar', seed: 9, steps: 900, inputs: [] };
  const result = applyRun(p, run);
  app.lastResult = { summary: run, result, before: {}, run: { worldId: 'rift', modeId: 'voyage', seed: 9, speciesId: 'solar' } };
  return p;
}

const bad = /undefined|NaN|\[object Object\]|<script>alert/;

for (const [label, make] of [['fresh', fresh], ['veteran', veteran]]) {
  for (const [id, screen] of Object.entries(screens)) {
    test(`${id} renders for a ${label} pilot`, () => {
      app.profile = make();
      app.sel = null;
      app.pendingRun = id === 'play' ? { worldId: 'ion', modeId: 'daily', modifier: 'glass', seed: 1, speciesId: app.profile.equipped.species } : null;
      if (id === 'results' && label === 'fresh') app.lastResult = null;
      const out = String(screen.render(app));
      assert.ok(out.length > 100, 'renders something');
      const m = out.match(bad);
      assert.equal(m, null, `found "${m && m[0]}" near: ${m && out.slice(Math.max(0, m.index - 80), m.index + 40)}`);
    });
  }
}

test('hangar renders every tab and item', async () => {
  const { hangarState } = await import('../src/ui/screens/hangar.js');
  for (const make of [fresh, veteran]) {
    app.profile = make();
    for (const tab of ['species', 'skin', 'trail', 'finale', 'title']) {
      hangarState.tab = tab;
      const ids = tab === 'species' ? SPECIES.map((s) => s.id) : ALL_COSMETICS.filter((c) => c.kind === tab).map((c) => c.id);
      for (const id of ids) {
        hangarState.sel = id;
        const out = String(screens.hangar.render(app));
        assert.equal(out.match(bad), null, `${tab}/${id}`);
      }
    }
  }
  hangarState.tab = 'species'; hangarState.sel = null;
});
