import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, queueTurn, useAbility, replay, summarize, hazardAt, interval, timeLeft, INPUT_ABILITY } from '../src/core/engine.js';
import { chooseDir } from '../src/core/ai.js';
import { createRng } from '../src/core/rng.js';
import { WORLDS } from '../src/data/worlds.js';
import { SPECIES } from '../src/data/species.js';

const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3;
const run = (s, n) => { for (let i = 0; i < n && !s.over; i++) tick(s); return s; };

test('snake moves one cell per tick in its direction', () => {
  const s = createGame({ worldId: 'nebula', seed: 1 });
  const x = s.snake[0].x;
  tick(s);
  assert.equal(s.snake[0].x, x + 1);
  assert.equal(s.snake.length, 4);
});

test('cannot reverse into itself; queue respects buffer size', () => {
  const s = createGame({ worldId: 'nebula', seed: 1 });
  assert.equal(queueTurn(s, LEFT), false);
  assert.equal(queueTurn(s, UP), true);
  assert.equal(queueTurn(s, UP), false, 'duplicate direction rejected');
  assert.equal(queueTurn(s, LEFT), true);
  assert.equal(queueTurn(s, DOWN), true, 'drift eel has a 3-turn buffer');
  assert.equal(queueTurn(s, RIGHT), false, 'buffer full');
});

test('edges wrap in Nebula and kill in Asteroid Belt', () => {
  const a = createGame({ worldId: 'nebula', seed: 2 });
  run(a, 30);
  assert.equal(a.over, false);
  const b = createGame({ worldId: 'asteroids', seed: 2 });
  b.rocks = []; b.rockCells = new Set();
  run(b, 30);
  assert.equal(b.over, true);
  assert.equal(b.cause, 'edge');
});

test('eating an orb grows the snake, scores, and respawns an orb', () => {
  const s = createGame({ worldId: 'nebula', seed: 3 });
  const hd = s.snake[0];
  s.items = [{ id: 99, type: 'orb', x: hd.x + 1, y: hd.y, born: 0, life: Infinity }];
  tick(s); tick(s);
  assert.equal(s.snake.length, 5);
  assert.equal(s.score, 10);
  assert.equal(s.items.filter((i) => i.type === 'orb').length, 1);
});

test('combo multiplies points inside the window', () => {
  const s = createGame({ worldId: 'nebula', seed: 4 });
  const hd = s.snake[0];
  s.items = [
    { id: 1, type: 'orb', x: hd.x + 1, y: hd.y, born: 0, life: Infinity },
    { id: 2, type: 'orb', x: hd.x + 2, y: hd.y, born: 0, life: Infinity },
  ];
  tick(s); tick(s);
  assert.equal(s.combo, 2);
  assert.equal(s.score, 10 + 20);
});

test('self collision ends the run; phase lets you pass', () => {
  const mk = () => {
    const s = createGame({ worldId: 'nebula', seed: 5, modifier: 'giant' });
    s.items = [];
    return s;
  };
  const s = mk();
  queueTurn(s, UP); tick(s); queueTurn(s, LEFT); tick(s); queueTurn(s, DOWN); tick(s);
  assert.equal(s.over, true);
  assert.equal(s.cause, 'self');
  const p = mk();
  p.effects.phase = 1e9;
  queueTurn(p, UP); tick(p); queueTurn(p, LEFT); tick(p); queueTurn(p, DOWN); tick(p);
  assert.equal(p.over, false);
});

test('shield absorbs one fatal hit', () => {
  const s = createGame({ worldId: 'asteroids', seed: 6 });
  s.rocks = []; s.rockCells = new Set(); s.items = [];
  s.shield = 1;
  run(s, 40);
  assert.equal(s.stats.shieldsUsed, 1);
  assert.ok(s.steps > 11, 'survived the first wall');
});

test('Chrono Naga rewinds once instead of dying', () => {
  const s = createGame({ worldId: 'asteroids', speciesId: 'chrono', seed: 7 });
  s.rocks = []; s.rockCells = new Set(); s.items = [];
  run(s, 12);
  assert.equal(s.reviveUsed, true);
  assert.equal(s.over, false);
  run(s, 30);
  assert.equal(s.over, true, 'second hit is fatal');
});

test('Blitz ends on the clock and comets add time', () => {
  const s = createGame({ worldId: 'nebula', modeId: 'blitz', seed: 8 });
  s.items = [];
  const hd = s.snake[0];
  s.items.push({ id: 5, type: 'comet', x: hd.x + 1, y: hd.y, born: 0, life: Infinity });
  tick(s);
  assert.equal(s.timeBonus, 3000);
  let guard = 0;
  while (!s.over && guard++ < 5000) { if (s.steps % 20 === 0) queueTurn(s, s.dir.x ? UP : RIGHT); tick(s); }
  assert.equal(s.cause, 'time');
  assert.ok(timeLeft(s) <= 0);
});

test('abilities: every species can fire, cooldown blocks spam', () => {
  for (const sp of SPECIES) {
    const s = createGame({ worldId: 'nebula', speciesId: sp.id, seed: 9 });
    assert.equal(useAbility(s), true, sp.id);
    tick(s);
    assert.equal(s.stats.abilityUses, 1, sp.id);
    assert.equal(useAbility(s), false, `${sp.id} cooldown`);
  }
});

test('Solar Lance charges then fires a beam that collects pickups', () => {
  const s = createGame({ worldId: 'nebula', speciesId: 'solar', seed: 10 });
  const hd = s.snake[0];
  s.items = [{ id: 1, type: 'orb', x: hd.x + 10, y: hd.y, born: 0, life: Infinity }];
  useAbility(s); tick(s);
  assert.equal(s.ability.charging, true, 'starts charging');
  let i = 0;
  while (s.ability.charging && i < 20 && !s.over) { tick(s); i++; }
  assert.equal(s.stats.orbs, 1, 'charged beam collected the orb');
  assert.equal(s.ability.charging, false, 'no longer charging');
});

test('Afterburn speeds up the snake', () => {
  const s = createGame({ worldId: 'nebula', speciesId: 'drift', seed: 11 });
  const before = interval(s);
  useAbility(s); tick(s);
  assert.ok(interval(s) < before);
});

test('storm warns before it strikes and severs the tail', () => {
  const s = createGame({ worldId: 'ion', seed: 12, modifier: 'giant' });
  s.items = []; s.nextStormAt = 1e12;
  const tailCell = s.snake[8];
  s.storms.push({ cells: [[tailCell.x, tailCell.y]], strikeAt: s.t + 1, endAt: s.t + 900, struck: false });
  assert.equal(hazardAt(s, tailCell.x, tailCell.y), null, 'harmless while warning');
  tick(s);
  assert.equal(s.stats.severs, 1);
  assert.ok(s.snake.length <= 9);
});

test('portals teleport the head', () => {
  const s = createGame({ worldId: 'horizon', seed: 13 });
  s.items = [];
  const pair = s.portalPairs[0];
  s.snake = [{ x: pair.a.x - 1, y: pair.a.y }, { x: pair.a.x - 2, y: pair.a.y }, { x: pair.a.x - 3, y: pair.a.y }];
  s.dir = { x: 1, y: 0 };
  const ev = tick(s);
  assert.ok(ev.some((e) => e.type === 'warp'));
  assert.deepEqual(s.snake[0], { x: pair.b.x, y: pair.b.y });
});

test('determinism: same seed + inputs replays to the same result', () => {
  const opts = { worldId: 'rift', speciesId: 'grav', seed: 424242 };
  const s = createGame(opts);
  const pilot = createRng(99); // the player's brain must not touch the game's RNG
  let guard = 0;
  while (!s.over && guard++ < 3000) {
    const blocked = (x, y) => !!hazardAt(s, x, y) || s.snake.slice(0, -1).some((p) => p.x === x && p.y === y);
    const d = chooseDir({ w: s.w, h: s.h, wrap: s.wrap, head: s.snake[0], dir: s.dir, targets: s.items, blocked, rng: pilot });
    if (d) { const code = d.y === -1 ? UP : d.y === 1 ? DOWN : d.x === -1 ? LEFT : RIGHT; queueTurn(s, code); }
    if (s.steps % 97 === 0) useAbility(s);
    tick(s);
  }
  const a = summarize(s);
  assert.ok(a.inputs.length > 10);
  const r = replay(opts, a.inputs, s.steps);
  assert.equal(r.score, a.score);
  assert.equal(r.steps, a.steps);
  assert.equal(r.cause, a.cause);
  assert.ok(a.inputs.some(([, c]) => c === INPUT_ABILITY));
});

test('fuzz: AI plays every world x species without breaking invariants', () => {
  for (const w of WORLDS) for (const sp of SPECIES) {
    const s = createGame({ worldId: w.id, speciesId: sp.id, seed: w.order * 131 + sp.id.length });
    let guard = 0;
    while (!s.over && guard++ < 1500) {
      const blocked = (x, y) => !!hazardAt(s, x, y) || s.snake.slice(0, -1).some((p) => p.x === x && p.y === y);
      const d = chooseDir({ w: s.w, h: s.h, wrap: s.wrap, head: s.snake[0], dir: s.dir, targets: s.items, blocked, rng: s.rng, lookahead: 30 });
      if (d) queueTurn(s, d.y === -1 ? UP : d.y === 1 ? DOWN : d.x === -1 ? LEFT : RIGHT);
      if (guard % 60 === 0) useAbility(s);
      tick(s);
      for (const p of s.snake) assert.ok(p.x >= 0 && p.y >= 0 && p.x < s.w && p.y < s.h, `${w.id}/${sp.id} out of bounds`);
      for (const it of s.items) assert.ok(it.x >= 0 && it.y >= 0 && it.x < s.w && it.y < s.h);
      assert.ok(Number.isFinite(s.score) && s.score >= 0);
      assert.ok(interval(s) >= 30);
    }
    assert.ok(s.steps > 5, `${w.id}/${sp.id} survived a few steps`);
  }
});
