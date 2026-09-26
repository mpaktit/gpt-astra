import { app, go } from './app.js';
import { dailyConfig } from '../data/modes.js';
import { worldById } from '../data/worlds.js';
import { unlockedWorlds } from '../meta/progression.js';
import { dateKey } from '../meta/time.js';

export function freshSeed() {
  const a = new Uint32Array(1);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return a[0];
}

export function currentSelection() {
  const p = app.profile;
  app.sel = app.sel || { worldId: p.last.worldId, modeId: p.last.modeId };
  const unlocked = unlockedWorlds(p);
  if (!unlocked.includes(app.sel.worldId)) app.sel.worldId = 'nebula';
  if (!['voyage', 'blitz', 'daily', 'ranked'].includes(app.sel.modeId)) app.sel.modeId = 'voyage';
  return app.sel;
}

export function buildRun(sel = currentSelection()) {
  const p = app.profile;
  if (sel.modeId === 'daily') {
    const cfg = dailyConfig(dateKey());
    return { worldId: cfg.worldId, modeId: 'daily', modifier: cfg.modifier, seed: cfg.seed, speciesId: p.equipped.species };
  }
  return { worldId: worldById(sel.worldId).id, modeId: sel.modeId, modifier: null, seed: freshSeed(), speciesId: p.equipped.species };
}

export function launch(opts = buildRun()) {
  app.pendingRun = opts;
  go('play');
}
