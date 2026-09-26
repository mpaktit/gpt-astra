// ASTRA game simulation. Pure and deterministic: no DOM, no Date, no Math.random.
// Same (options, input log) => same run, bit for bit. That is what makes
// server-side score verification possible later (see docs/SECURITY.md).

import { createRng } from './rng.js';
import { chooseDir } from './ai.js';
import { worldById } from '../data/worlds.js';
import { speciesById } from '../data/species.js';
import { MODES } from '../data/modes.js';

export const DIRS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const DIR_CODE = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];
export const INPUT_ABILITY = 4;

export const ITEMS = {
  orb:     { pts: 10, grow: 1, label: 'Stardust' },
  comet:   { pts: 50, grow: 2, label: 'Comet' },
  phase:   { pts: 20, grow: 0, label: 'Phase', power: true },
  slow:    { pts: 20, grow: 0, label: 'Slow', power: true },
  magnet:  { pts: 20, grow: 0, label: 'Magnet', power: true },
  shield:  { pts: 20, grow: 0, label: 'Shield', power: true },
  crystal: { pts: 0,  grow: 0, label: 'Void Crystal' },
};
export const COMBO_WINDOW = 1900;
export const MAX_COMBO = 8;
const EFFECT_MS = { phase: 6000, slow: 6000, magnet: 8000 };
const SPECIAL_LIFE = 7000;

// ---------------------------------------------------------------- setup

export function createGame(opts = {}) {
  const world = worldById(opts.worldId);
  const mode = MODES[opts.modeId] || MODES.voyage;
  const species = speciesById(opts.speciesId);
  const modifier = opts.modifier || null;
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = createRng(seed);
  const w = world.size, h = world.size;

  const s = {
    seed, world, mode, species, modifier, rng, w, h, wrap: world.wrap,
    t: 0, steps: 0, over: false, alive: true, cause: null,
    snake: [], prev: [], dir: { ...DIRS[world.spawn.dir] }, queue: [], grow: 0,
    items: [], nextItemId: 1,
    walls: new Set(), hole: new Set(), holeCenter: null,
    rocks: [], rockCells: new Set(),
    storms: [], nextStormAt: 3500,
    portals: new Map(), portalPairs: [],
    vents: [],
    rival: null,
    score: 0, combo: 1, maxCombo: 1, lastEat: -1e9, eaten: 0, timeBonus: 0,
    effects: { phase: 0, slow: 0, magnet: 0 }, shield: 0,
    ability: { cdUntil: 0, activeUntil: 0, strongMagnetUntil: 0 },
    pendingAbility: false, reviveUsed: false, history: [],
    stats: { orbs: 0, comets: 0, crystals: 0, powerups: 0, abilityUses: 0, maxLen: 0, rivals: 0, severs: 0, shieldsUsed: 0 },
    inputs: [], events: [],
  };

  const startLen = modifier === 'giant' ? 12 : species.stats.startLen;
  const sp = world.spawn;
  const back = DIRS[sp.dir];
  for (let i = 0; i < startLen; i++) {
    let x = sp.x - back.x * i, y = sp.y - back.y * i;
    if (s.wrap) { x = (x + w) % w; y = (y + h) % h; }
    s.snake.push({ x: Math.max(0, x), y: Math.max(0, y) });
  }
  s.prev = s.snake.map((p) => ({ ...p }));
  s.stats.maxLen = s.snake.length;

  buildWorld(s);
  const orbCount = modifier === 'feast' ? 3 : mode.orbs;
  for (let i = 0; i < orbCount; i++) spawnItem(s, 'orb');
  return s;
}

const key = (s, x, y) => y * s.w + x;

function buildWorld(s) {
  const hz = s.world.hazards;
  const safe = (x, y) => {
    const hd = s.snake[0];
    return Math.abs(x - hd.x) + Math.abs(y - hd.y) > 5 && !s.snake.some((p) => p.x === x && p.y === y);
  };

  if (hz.includes('pillars')) {
    const q = [[5, 5], [17, 5], [5, 17], [17, 17]];
    for (const [px, py] of q) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) s.walls.add(key(s, px + dx, py + dy));
  }

  if (hz.includes('singularity')) {
    const c = s.w >> 1;
    s.holeCenter = { x: c, y: c };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s.hole.add(key(s, c + dx, c + dy));
  }

  if (hz.includes('portals')) {
    const m = s.w - 4;
    const pairs = [[{ x: 3, y: 3 }, { x: m, y: m }], [{ x: m, y: 3 }, { x: 3, y: m }]];
    pairs.forEach(([a, b], i) => {
      s.portalPairs.push({ a, b, hue: i });
      s.portals.set(key(s, a.x, a.y), b);
      s.portals.set(key(s, b.x, b.y), a);
    });
  }

  if (hz.includes('rocks')) {
    const shapes = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1]], [[0, 0]]];
    for (const shape of shapes) {
      for (let tries = 0; tries < 200; tries++) {
        const x = s.rng.int(s.w - 2), y = s.rng.int(s.h - 2);
        const cells = shape.map(([dx, dy]) => [x + dx, y + dy]);
        if (!cells.every(([cx, cy]) => safe(cx, cy) && !s.rockCells.has(key(s, cx, cy)) && !s.walls.has(key(s, cx, cy)))) continue;
        const axis = s.rng.int(2);
        const sign = s.rng.chance(0.5) ? 1 : -1;
        const rock = { shape, x, y, dx: axis ? 0 : sign, dy: axis ? sign : 0, every: s.rng.range(3, 6), spin: s.rng.next() };
        s.rocks.push(rock);
        cells.forEach(([cx, cy]) => s.rockCells.add(key(s, cx, cy)));
        break;
      }
    }
  }

  if (hz.includes('lava')) {
    const clusters = 8;
    for (let c = 0; c < clusters; c++) {
      for (let tries = 0; tries < 200; tries++) {
        const x = s.rng.range(1, s.w - 3), y = s.rng.range(1, s.h - 3);
        const cells = [[x, y]];
        const n = s.rng.range(1, 3);
        for (let i = 0; i < n; i++) {
          const [lx, ly] = cells[cells.length - 1];
          const d = s.rng.pick([[1, 0], [0, 1], [-1, 0], [0, -1]]);
          const nx = Math.min(s.w - 1, Math.max(0, lx + d[0])), ny = Math.min(s.h - 1, Math.max(0, ly + d[1]));
          if (!cells.some(([a, b]) => a === nx && b === ny)) cells.push([nx, ny]);
        }
        if (!cells.every(([cx, cy]) => safe(cx, cy) && !s.vents.some((v) => v.cells.some(([a, b]) => a === cx && b === cy)))) continue;
        s.vents.push({ cells, period: 4200, offset: s.rng.int(4200), suppressUntil: 0 });
        break;
      }
    }
  }

  if (hz.includes('rival')) s.rival = { body: [], prev: [], dir: { x: -1, y: 0 }, alive: false, grow: 0, respawnAt: 4000 };
}

// ---------------------------------------------------------------- queries

export const phasing = (s) => s.t < s.effects.phase;
export const slowed = (s) => s.t < s.effects.slow;
export const boosting = (s) => s.species.ability.id === 'boost' && s.t < s.ability.activeUntil;

export function ventState(s, v) {
  if (s.t < v.suppressUntil) return 'cool';
  const p = (s.t + v.offset) % v.period;
  if (p < 2400) return 'cool';
  if (p < 3300) return 'warn';
  return 'hot';
}

export function stormPhase(s, st) {
  if (s.t < st.strikeAt) return 'warn';
  if (s.t < st.endAt) return 'strike';
  return 'done';
}

function ventHotAt(s, x, y) {
  for (const v of s.vents) if (ventState(s, v) === 'hot' && v.cells.some(([a, b]) => a === x && b === y)) return true;
  return false;
}
function stormAt(s, x, y) {
  for (const st of s.storms) if (stormPhase(s, st) === 'strike' && st.cells.some(([a, b]) => a === x && b === y)) return true;
  return false;
}
function rivalAt(s, x, y) {
  const r = s.rival;
  return !!(r && r.alive && r.body.some((p) => p.x === x && p.y === y));
}

/** What kills the head at (x, y)? null if safe. Walls and the singularity ignore phase. */
export function hazardAt(s, x, y) {
  const k = key(s, x, y);
  if (s.walls.has(k)) return 'wall';
  if (s.hole.has(k)) return 'singularity';
  if (phasing(s)) return null;
  if (s.rockCells.has(k)) return 'asteroid';
  if (stormAt(s, x, y)) return 'storm';
  if (ventHotAt(s, x, y)) return 'lava';
  if (rivalAt(s, x, y)) return 'rival';
  return null;
}

export function interval(s) {
  let iv = s.world.baseInterval * s.mode.speedMul - Math.min(s.eaten, 45) * 1.6;
  iv = Math.max(60, iv) / s.species.stats.speed;
  if (s.modifier === 'overdrive') iv *= 0.8;
  if (slowed(s)) iv *= 1.6;
  if (boosting(s)) iv *= 0.62;
  return Math.round(iv);
}

export function timeLeft(s) {
  return s.mode.timer ? s.mode.timer * 1000 + s.timeBonus - s.t : Infinity;
}

export function abilityReady(s) { return s.alive && s.t >= s.ability.cdUntil; }
export function abilityProgress(s) {
  const cd = s.species.ability.cooldown;
  return s.t >= s.ability.cdUntil ? 1 : 1 - (s.ability.cdUntil - s.t) / cd;
}

function occupied(s, x, y) {
  const k = key(s, x, y);
  if (s.walls.has(k) || s.hole.has(k) || s.rockCells.has(k) || s.portals.has(k)) return true;
  if (s.snake.some((p) => p.x === x && p.y === y)) return true;
  if (s.items.some((it) => it.x === x && it.y === y)) return true;
  if (s.vents.some((v) => v.cells.some(([a, b]) => a === x && b === y))) return true;
  if (rivalAt(s, x, y)) return true;
  return false;
}

function freeCells(s, minDist = 0) {
  const out = [];
  const hd = s.snake[0];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    if (occupied(s, x, y)) continue;
    if (minDist && Math.abs(x - hd.x) + Math.abs(y - hd.y) <= minDist) continue;
    out.push([x, y]);
  }
  return out;
}

function spawnItem(s, type, life = Infinity) {
  let cells = freeCells(s, 2);
  if (!cells.length) cells = freeCells(s, 0);
  if (!cells.length) return null;
  const [x, y] = s.rng.pick(cells);
  const it = { id: s.nextItemId++, type, x, y, born: s.t, life };
  s.items.push(it);
  return it;
}

// ---------------------------------------------------------------- input

export function queueTurn(s, code) {
  if (s.over) return false;
  const d = DIR_CODE[code];
  if (!d) return false;
  const ref = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  if ((ref.x === d.x && ref.y === d.y) || (ref.x === -d.x && ref.y === -d.y)) return false;
  if (s.queue.length >= s.species.stats.buffer) return false;
  s.queue.push(d);
  s.inputs.push([s.steps, code]);
  return true;
}

export function useAbility(s) {
  if (!abilityReady(s) || s.pendingAbility) return false;
  s.pendingAbility = true;
  s.inputs.push([s.steps, INPUT_ABILITY]);
  return true;
}

// ---------------------------------------------------------------- tick

export function tick(s) {
  if (s.over) return [];
  const ev = (s.events = []);

  s.history.push({ snake: s.snake.map((p) => ({ ...p })), dir: { ...s.dir }, grow: s.grow });
  if (s.history.length > 9) s.history.shift();

  if (s.pendingAbility) { s.pendingAbility = false; activateAbility(s); }
  if (s.queue.length) s.dir = s.queue.shift();

  s.t += interval(s);
  s.steps++;
  s.prev = s.snake.map((p) => ({ ...p }));
  if (s.rival) s.rival.prev = s.rival.body.map((p) => ({ ...p }));

  moveSnake(s);
  if (!s.over) {
    updateRocks(s);
    updateStorms(s);
    updateVents(s);
    updateGravity(s);
    updateMagnet(s);
    updateRival(s);
    updateItems(s);
    checkHeadHazards(s);
  }
  if (!s.over && s.mode.timer && timeLeft(s) <= 0) endRun(s, 'time');
  s.stats.maxLen = Math.max(s.stats.maxLen, s.snake.length);
  return ev;
}

function nextCell(s, x, y, d) {
  let nx = x + d.x, ny = y + d.y;
  if (s.wrap) { nx = (nx + s.w) % s.w; ny = (ny + s.h) % s.h; }
  else if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) return null;
  return { x: nx, y: ny };
}

function moveSnake(s) {
  const hd = s.snake[0];
  let n = nextCell(s, hd.x, hd.y, s.dir);
  if (!n) return fatal(s, 'edge');
  const exit = s.portals.get(key(s, n.x, n.y));
  if (exit) {
    s.events.push({ type: 'warp', from: { ...n }, to: { ...exit } });
    n = { x: exit.x, y: exit.y };
  }
  const cause = hazardAt(s, n.x, n.y);
  if (cause) return fatal(s, cause);
  if (!phasing(s)) {
    const len = s.grow > 0 ? s.snake.length : s.snake.length - 1;
    for (let i = 0; i < len; i++) if (s.snake[i].x === n.x && s.snake[i].y === n.y) return fatal(s, 'self');
  }
  s.snake.unshift(n);
  if (s.grow > 0) s.grow--;
  else s.snake.pop();

  const idx = s.items.findIndex((it) => it.x === n.x && it.y === n.y);
  if (idx >= 0) eat(s, s.items.splice(idx, 1)[0]);
}

function checkHeadHazards(s) {
  // Hazards can arrive under a head that stood still in time (storm strike, vent flare).
  const hd = s.snake[0];
  if (phasing(s)) return;
  let cause = null;
  if (stormAt(s, hd.x, hd.y)) cause = 'storm';
  else if (ventHotAt(s, hd.x, hd.y)) cause = 'lava';
  if (cause) fatal(s, cause, true);
}

function fatal(s, cause, inPlace = false) {
  if (s.shield > 0) {
    s.shield--;
    s.stats.shieldsUsed++;
    s.effects.phase = Math.max(s.effects.phase, s.t + 1200);
    s.events.push({ type: 'shield', x: s.snake[0].x, y: s.snake[0].y });
    if (!inPlace) {
      const hd = s.snake[0];
      const perp = s.dir.x ? [DIRS.up, DIRS.down] : [DIRS.left, DIRS.right];
      const ok = perp.find((d) => { const c = nextCell(s, hd.x, hd.y, d); return c && !s.walls.has(key(s, c.x, c.y)) && !s.hole.has(key(s, c.x, c.y)); });
      if (ok) s.dir = { ...ok };
      s.queue = [];
    }
    return;
  }
  if (s.species.passive.id === 'revive' && !s.reviveUsed && s.history.length > 1) {
    const snap = s.history[0];
    s.reviveUsed = true;
    s.snake = snap.snake.map((p) => ({ ...p }));
    s.prev = s.snake.map((p) => ({ ...p }));
    s.dir = { ...snap.dir };
    s.grow = snap.grow;
    s.queue = [];
    s.history = [];
    s.effects.phase = Math.max(s.effects.phase, s.t + 1600);
    s.events.push({ type: 'revive', x: s.snake[0].x, y: s.snake[0].y, cause });
    return;
  }
  endRun(s, cause);
}

function endRun(s, cause) {
  s.over = true;
  s.cause = cause;
  s.alive = cause === 'time' || cause === 'win';
  s.events.push({ type: cause === 'time' || cause === 'win' ? 'finish' : 'death', cause, x: s.snake[0].x, y: s.snake[0].y });
}

function eat(s, it) {
  const def = ITEMS[it.type];
  s.combo = s.t - s.lastEat < COMBO_WINDOW ? Math.min(s.combo + 1, MAX_COMBO) : 1;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  s.lastEat = s.t;
  let pts = def.pts * s.combo;
  if (it.type === 'comet' && s.species.passive.id === 'comet-bonus') pts *= 1.25;
  if (boosting(s)) pts *= 2;
  pts *= s.world.scoreMult;
  if (s.modifier === 'overdrive') pts *= 1.3;
  if (s.modifier === 'glass') pts *= 1.25;
  pts = Math.round(pts);
  s.score += pts;
  s.grow += def.grow;

  switch (it.type) {
    case 'orb': s.eaten++; s.stats.orbs++; break;
    case 'comet':
      s.eaten++; s.stats.comets++;
      if (s.mode.timer) { s.timeBonus += 3000; s.events.push({ type: 'time', x: it.x, y: it.y, ms: 3000 }); }
      break;
    case 'phase': s.effects.phase = Math.max(s.effects.phase, s.t + EFFECT_MS.phase * (s.species.passive.id === 'phase-extend' ? 1.5 : 1)); break;
    case 'slow': s.effects.slow = Math.max(s.effects.slow, s.t + EFFECT_MS.slow); break;
    case 'magnet': s.effects.magnet = Math.max(s.effects.magnet, s.t + EFFECT_MS.magnet); break;
    case 'shield': s.shield = Math.min(2, s.shield + 1); break;
    case 'crystal': s.stats.crystals++; break;
  }
  if (def.power) s.stats.powerups++;
  s.events.push({ type: 'eat', item: it.type, x: it.x, y: it.y, pts, combo: s.combo });

  if (it.type === 'orb') {
    const target = s.modifier === 'feast' ? 3 : s.mode.orbs;
    const orbs = s.items.filter((i) => i.type === 'orb').length;
    for (let i = orbs; i < target; i++) {
      if (!spawnItem(s, 'orb') && !s.items.some((x) => x.type === 'orb')) { endRun(s, 'win'); return; }
    }
  }
}

// ---------------------------------------------------------------- abilities

function activateAbility(s) {
  const ab = s.species.ability;
  const hd = s.snake[0];
  s.ability.cdUntil = s.t + ab.cooldown;
  s.stats.abilityUses++;
  const e = { type: 'ability', id: ab.id, x: hd.x, y: hd.y };
  switch (ab.id) {
    case 'boost': s.ability.activeUntil = s.t + ab.duration; break;
    case 'phase': s.effects.phase = Math.max(s.effects.phase, s.t + ab.duration); s.ability.activeUntil = s.t + ab.duration; break;
    case 'stasis': s.effects.slow = Math.max(s.effects.slow, s.t + ab.duration); s.ability.activeUntil = s.t + ab.duration; break;
    case 'singularity': s.ability.strongMagnetUntil = s.t + ab.duration; s.ability.activeUntil = s.t + ab.duration; break;
    case 'supernova': {
      const R = 4;
      const near = (x, y) => {
        let dx = Math.abs(x - hd.x), dy = Math.abs(y - hd.y);
        if (s.wrap) { dx = Math.min(dx, s.w - dx); dy = Math.min(dy, s.h - dy); }
        return Math.max(dx, dy) <= R;
      };
      const debris = [];
      s.rocks = s.rocks.filter((r) => {
        const cells = rockCellsOf(r);
        if (!cells.some(([x, y]) => near(x, y))) return true;
        debris.push(...cells);
        return false;
      });
      rebuildRockCells(s);
      s.storms = s.storms.filter((st) => !st.cells.some(([x, y]) => near(x, y)));
      for (const v of s.vents) if (v.cells.some(([x, y]) => near(x, y))) v.suppressUntil = s.t + 6000;
      if (s.rival && s.rival.alive && s.rival.body.some((p) => near(p.x, p.y))) killRival(s, 'nova');
      debris.slice(0, 3).forEach(([x, y]) => {
        if (!occupied(s, x, y)) s.items.push({ id: s.nextItemId++, type: 'orb', x, y, born: s.t, life: 6000, bonus: true });
      });
      e.radius = R;
      break;
    }
    case 'flare': {
      const cells = [];
      let c = { x: hd.x, y: hd.y };
      for (let i = 0; i < 8; i++) {
        c = nextCell(s, c.x, c.y, s.dir);
        if (!c) break;
        const k = key(s, c.x, c.y);
        if (s.walls.has(k) || s.hole.has(k)) break;
        cells.push([c.x, c.y]);
      }
      const hit = (x, y) => cells.some(([a, b]) => a === x && b === y);
      const grabbed = s.items.filter((it) => hit(it.x, it.y));
      s.items = s.items.filter((it) => !hit(it.x, it.y));
      s.rocks = s.rocks.filter((r) => !rockCellsOf(r).some(([x, y]) => hit(x, y)));
      rebuildRockCells(s);
      s.storms = s.storms.filter((st) => !st.cells.some(([x, y]) => hit(x, y)));
      if (s.rival && s.rival.alive && s.rival.body.some((p) => hit(p.x, p.y))) killRival(s, 'flare');
      e.cells = cells;
      s.events.push(e);
      for (const it of grabbed) eat(s, it);
      return;
    }
  }
  s.events.push(e);
}

// ---------------------------------------------------------------- hazards

const rockCellsOf = (r) => r.shape.map(([dx, dy]) => [r.x + dx, r.y + dy]);
function rebuildRockCells(s) {
  s.rockCells = new Set();
  for (const r of s.rocks) for (const [x, y] of rockCellsOf(r)) s.rockCells.add(key(s, x, y));
}

function updateRocks(s) {
  if (!s.rocks.length) return;
  let moved = false;
  for (const r of s.rocks) {
    if (s.steps % r.every) continue;
    const own = new Set(rockCellsOf(r).map(([x, y]) => key(s, x, y)));
    const next = r.shape.map(([dx, dy]) => [r.x + r.dx + dx, r.y + r.dy + dy]);
    const blocked = next.some(([x, y]) => {
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) return true;
      const k = key(s, x, y);
      if (s.walls.has(k) || (s.rockCells.has(k) && !own.has(k))) return true;
      return s.snake.some((p) => p.x === x && p.y === y);
    });
    if (blocked) { r.dx = -r.dx; r.dy = -r.dy; continue; }
    r.x += r.dx; r.y += r.dy;
    moved = true;
    // Rocks grind items to dust; they respawn elsewhere.
    const crushed = s.items.filter((it) => next.some(([x, y]) => x === it.x && y === it.y));
    if (crushed.length) {
      s.items = s.items.filter((it) => !crushed.includes(it));
      for (const it of crushed) {
        s.events.push({ type: 'crush', x: it.x, y: it.y, item: it.type });
        if (it.type === 'orb') spawnItem(s, 'orb');
      }
    }
    rebuildRockCells(s);
  }
  if (moved) rebuildRockCells(s);
}

function updateStorms(s) {
  if (!s.world.hazards.includes('storms')) return;
  s.storms = s.storms.filter((st) => stormPhase(s, st) !== 'done');
  if (s.t >= s.nextStormAt) {
    const len = Math.min(16, 7 + Math.floor(s.t / 15000));
    const horiz = s.rng.chance(0.5);
    const hd = s.snake[0];
    let line;
    for (let tries = 0; tries < 30; tries++) {
      const fixed = s.rng.int(horiz ? s.h : s.w);
      if ((horiz ? hd.y : hd.x) === fixed && tries < 20) continue; // not directly under the head at birth
      const start = s.rng.int(s.w);
      line = [];
      for (let i = 0; i < len; i++) {
        const v = (start + i) % s.w;
        line.push(horiz ? [v, fixed] : [fixed, v]);
      }
      break;
    }
    s.storms.push({ cells: line, strikeAt: s.t + 2200, endAt: s.t + 3100, struck: false });
    s.events.push({ type: 'stormWarn' });
    s.nextStormAt = s.t + Math.max(2600, 6500 - s.t / 40) + s.rng.int(1500);
  }
  for (const st of s.storms) {
    if (!st.struck && s.t >= st.strikeAt) {
      st.struck = true;
      s.events.push({ type: 'strike', cells: st.cells });
      if (phasing(s)) continue;
      // Lightning severs the body where it crosses (never shorter than 3).
      for (let i = 1; i < s.snake.length; i++) {
        const p = s.snake[i];
        if (st.cells.some(([a, b]) => a === p.x && b === p.y)) {
          const cut = Math.max(3, i);
          if (cut < s.snake.length) {
            const lost = s.snake.slice(cut);
            s.snake.length = cut;
            s.prev.length = Math.min(s.prev.length, cut);
            s.grow = 0;
            s.stats.severs++;
            s.events.push({ type: 'sever', cells: lost.map((c) => [c.x, c.y]) });
          }
          break;
        }
      }
    }
  }
}

function updateVents(s) {
  for (const v of s.vents) {
    const st = ventState(s, v);
    if (st === 'hot' && v.last !== 'hot') s.events.push({ type: 'vent', cells: v.cells });
    v.last = st;
  }
}

function updateGravity(s) {
  if (!s.holeCenter || s.steps % 7) return;
  const c = s.holeCenter;
  const eaten = [];
  for (const it of s.items) {
    const dx = c.x - it.x, dy = c.y - it.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 7) continue;
    const nx = it.x + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0);
    const ny = it.y + (Math.abs(dx) >= Math.abs(dy) ? 0 : Math.sign(dy));
    if (s.hole.has(key(s, nx, ny))) { eaten.push(it); continue; }
    if (!occupied(s, nx, ny)) { it.x = nx; it.y = ny; }
  }
  if (eaten.length) {
    s.items = s.items.filter((it) => !eaten.includes(it));
    for (const it of eaten) {
      s.events.push({ type: 'swallow', x: it.x, y: it.y, item: it.type });
      if (it.type === 'orb') spawnItem(s, 'orb');
    }
  }
}

function magnetRadius(s) {
  if (s.t < s.ability.strongMagnetUntil) return 7;
  if (s.t < s.effects.magnet) return 5;
  if (s.species.passive.id === 'micro-grav' && s.steps % 3 === 0) return 2;
  return 0;
}

function updateMagnet(s) {
  const R = magnetRadius(s);
  if (!R) return;
  const hd = s.snake[0];
  const grab = [];
  for (const it of s.items) {
    let dx = hd.x - it.x, dy = hd.y - it.y;
    if (s.wrap) {
      if (Math.abs(dx) > s.w / 2) dx -= Math.sign(dx) * s.w;
      if (Math.abs(dy) > s.h / 2) dy -= Math.sign(dy) * s.h;
    }
    if (Math.max(Math.abs(dx), Math.abs(dy)) > R || (dx === 0 && dy === 0)) continue;
    let nx = it.x + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0);
    let ny = it.y + (Math.abs(dx) >= Math.abs(dy) ? 0 : Math.sign(dy));
    if (s.wrap) { nx = (nx + s.w) % s.w; ny = (ny + s.h) % s.h; }
    if (nx === hd.x && ny === hd.y) { grab.push(it); continue; }
    if (!occupied(s, nx, ny)) { it.x = nx; it.y = ny; }
  }
  if (grab.length) {
    s.items = s.items.filter((it) => !grab.includes(it));
    for (const it of grab) eat(s, it);
  }
}

function updateItems(s) {
  const expired = s.items.filter((it) => s.t - it.born > it.life);
  if (expired.length) {
    s.items = s.items.filter((it) => !expired.includes(it));
    for (const it of expired) s.events.push({ type: 'expire', x: it.x, y: it.y, item: it.type });
  }
  const hasSpecial = s.items.some((it) => it.type !== 'orb' && it.type !== 'crystal');
  if (s.eaten >= 3 && !hasSpecial) {
    const p = s.modifier === 'shower' ? 0.03 : 0.014;
    if (s.rng.chance(p)) {
      let table = [['comet', 40], ['phase', 15], ['slow', 12], ['magnet', 15], ['shield', 12]];
      if (s.modifier === 'shower') table = [['comet', 90], ['magnet', 10]];
      if (s.modifier === 'glass') table = table.filter(([t]) => t !== 'shield' && t !== 'phase');
      spawnItem(s, s.rng.weighted(table), SPECIAL_LIFE);
    }
  }
  // Void Crystals: genuinely rare. Roughly one every few minutes of good play, max two per run.
  if (s.eaten >= 12 && s.stats.crystals + s.items.filter((i) => i.type === 'crystal').length < 2 && !s.items.some((i) => i.type === 'crystal')) {
    if (s.rng.chance(0.00028)) spawnItem(s, 'crystal', 5000);
  }
}

// ---------------------------------------------------------------- rival

function updateRival(s) {
  const r = s.rival;
  if (!r) return;
  if (!r.alive) {
    if (s.t >= r.respawnAt) spawnRival(s);
    return;
  }
  if (s.steps % 5 === 0) return; // 80% of your speed: catchable, not trivial
  const hd = r.body[0];
  const playerCells = new Set(s.snake.map((p) => key(s, p.x, p.y)));
  const ownCells = new Set(r.body.slice(0, -1).map((p) => key(s, p.x, p.y)));
  const blocked = (x, y) => {
    const k = key(s, x, y);
    return s.walls.has(k) || s.hole.has(k) || s.rockCells.has(k) || ownCells.has(k) || playerCells.has(k) || ventHotAt(s, x, y) || stormAt(s, x, y);
  };
  const d = chooseDir({ w: s.w, h: s.h, wrap: s.wrap, head: hd, dir: r.dir, targets: s.items, blocked, rng: s.rng, lookahead: 40 });
  if (!d) {
    // Boxed in. If the only way out is through you, it crashes: that is your kill.
    killRival(s, 'trapped');
    return;
  }
  r.dir = d;
  const n = nextCell(s, hd.x, hd.y, d);
  r.body.unshift(n);
  if (r.grow > 0) r.grow--; else r.body.pop();
  const idx = s.items.findIndex((it) => it.x === n.x && it.y === n.y);
  if (idx >= 0) {
    const it = s.items.splice(idx, 1)[0];
    if (r.body.length < 16) r.grow++;
    s.events.push({ type: 'rivalEat', x: it.x, y: it.y, item: it.type });
    if (it.type === 'orb') spawnItem(s, 'orb');
  }
}

function spawnRival(s) {
  const hd = s.snake[0];
  const cells = freeCells(s, 8);
  if (!cells.length) { s.rival.respawnAt = s.t + 2000; return; }
  const [x, y] = s.rng.pick(cells);
  const r = s.rival;
  r.body = [{ x, y }];
  r.prev = [{ x, y }];
  r.grow = 4;
  r.alive = true;
  r.dir = Math.abs(hd.x - x) > Math.abs(hd.y - y) ? { x: Math.sign(hd.x - x) || 1, y: 0 } : { x: 0, y: Math.sign(hd.y - y) || 1 };
  s.events.push({ type: 'rivalSpawn', x, y });
}

function killRival(s, how) {
  const r = s.rival;
  r.alive = false;
  r.respawnAt = s.t + 9000;
  s.stats.rivals++;
  const drops = [];
  for (const p of r.body) {
    if (drops.length >= 3) break;
    const k = key(s, p.x, p.y);
    if (s.walls.has(k) || s.hole.has(k) || s.rockCells.has(k) || s.portals.has(k)) continue;
    if (s.snake.some((q) => q.x === p.x && q.y === p.y) || s.items.some((i) => i.x === p.x && i.y === p.y)) continue;
    if (drops.some((d) => d.x === p.x && d.y === p.y)) continue;
    drops.push({ id: s.nextItemId++, type: 'comet', x: p.x, y: p.y, born: s.t, life: 8000 });
  }
  const body = r.body.map((p) => [p.x, p.y]);
  r.body = [];
  s.items.push(...drops);
  s.events.push({ type: 'rivalDown', how, cells: body });
}

// ---------------------------------------------------------------- summary & replay

export function summarize(s) {
  return {
    score: s.score, cause: s.cause, duration: s.t, steps: s.steps,
    worldId: s.world.id, modeId: s.mode.id, speciesId: s.species.id, modifier: s.modifier, seed: s.seed,
    maxCombo: s.maxCombo, length: s.snake.length,
    ...s.stats,
    inputs: s.inputs.slice(),
  };
}

/** Re-simulate a run from its seed and input log. A server can do exactly this to verify a score. */
export function replay(opts, inputs, maxSteps = 200000) {
  const s = createGame(opts);
  let i = 0;
  while (!s.over && s.steps < maxSteps) {
    while (i < inputs.length && inputs[i][0] === s.steps) {
      const [, code] = inputs[i++];
      if (code === INPUT_ABILITY) useAbility(s); else queueTurn(s, code);
    }
    tick(s);
  }
  return s;
}
