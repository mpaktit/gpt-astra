// Canvas renderer. Reads engine state, never mutates it. All sizes are in cells * `cell`.
import { oklch, ok, mix } from './color.js';
import { createFx } from './fx.js';
import { createRng } from '../core/rng.js';
import { cosmeticById } from '../data/cosmetics.js';
import { ventState, stormPhase, phasing, boosting, slowed, timeLeft } from '../core/engine.js';

const TAU = Math.PI * 2;
const C = {
  orb: [0.68, 0.2, 28], orbHi: [0.88, 0.08, 40], comet: [0.8, 0.16, 85], cometHi: [0.94, 0.07, 90],
  phase: [0.72, 0.12, 210], slow: [0.7, 0.15, 150], magnet: [0.64, 0.2, 25], shield: [0.55, 0.18, 270],
  crystal: [0.58, 0.22, 300], crystalHi: [0.86, 0.1, 310], eye: [0.985, 0.005, 285], pupil: [0.2, 0.04, 280],
  rivalHead: [0.6, 0.25, 350], rivalTail: [0.38, 0.16, 310], white: [0.985, 0.006, 285], timer: [0.42, 0.2, 275],
};
const ITEM_COLOR = { orb: C.orb, comet: C.comet, phase: C.phase, slow: C.slow, magnet: C.magnet, shield: C.shield, crystal: C.crystal };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const bg = document.createElement('canvas');
  const fx = createFx();
  let size = 440, cell = 20, dpr = 1, world = null, dark = false;
  let skin = null, species = null, trail = null, finale = null;
  let settings = { showGrid: true, reducedMotion: false, colorblind: false };
  let shake = 0, headPulse = 0, flash = 0, flashColor = C.white;
  let bulges = [], beams = [];
  let flareCharge = 0, flareDir = null;

  function configure(o) {
    world = o.world;
    species = o.species;
    dark = world.theme.ink === 'light';
    const sk = o.skinId && o.skinId !== 'default' ? cosmeticById(o.skinId) : null;
    skin = sk && sk.kind === 'skin' ? sk : { head: species.palette.head, tail: species.palette.tail, pattern: 'solid' };
    trail = o.trailId ? cosmeticById(o.trailId) : null;
    finale = o.finaleId ? cosmeticById(o.finaleId) : null;
    settings = { ...settings, ...(o.settings || {}) };
    fx.reduced = !!settings.reducedMotion;
    fx.clear(); bulges = []; beams = []; shake = 0; flash = 0; flareCharge = 0; flareDir = null;
    buildBg();
  }

  function resize(px) {
    size = px;
    cell = px / world.size;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(px * dpr);
    canvas.height = Math.round(px * dpr);
    canvas.style.width = px + 'px';
    canvas.style.height = px + 'px';
    buildBg();
  }

  // -------------------------------------------------------------- background
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function buildBg() {
    if (!world) return;
    const t = world.theme;
    bg.width = Math.round(size * dpr); bg.height = Math.round(size * dpr);
    const g = bg.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = ok(t.board); g.fillRect(0, 0, size, size);
    const rng = createRng(world.order * 7919);
    for (let i = 0; i < 4; i++) {
      const x = rng.next() * size, y = rng.next() * size, r = size * (0.25 + rng.next() * 0.3);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, ok(t.blob, dark ? 0.45 : 0.35)); grd.addColorStop(1, ok(t.blob, 0));
      g.fillStyle = grd; g.fillRect(0, 0, size, size);
    }
    for (let i = 0; i < 70; i++) {
      const x = rng.next() * size, y = rng.next() * size, r = (0.3 + rng.next() * 1.1) * Math.max(1, cell / 20);
      g.fillStyle = ok(t.star, 0.3 + rng.next() * 0.6);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    if (settings.showGrid) {
      g.fillStyle = ok(t.dot);
      const r = Math.max(0.9, cell * 0.055);
      for (let y = 1; y < world.size; y++) for (let x = 1; x < world.size; x++) { g.beginPath(); g.arc(x * cell, y * cell, r, 0, TAU); g.fill(); }
    }
    const inset = Math.max(3, cell * 0.14);
    if (world.wrap) {
      g.strokeStyle = ok(t.edge); g.lineWidth = 2; g.setLineDash([cell * 0.35, cell * 0.3]);
      rr(g, inset, inset, size - inset * 2, size - inset * 2, 12); g.stroke(); g.setLineDash([]);
    } else {
      g.strokeStyle = ok(t.edge, 0.7); g.lineWidth = 3;
      rr(g, inset, inset, size - inset * 2, size - inset * 2, 12); g.stroke();
    }
  }

  // -------------------------------------------------------------- events
  function onEvents(events, s) {
    for (const e of events) {
      const cx = e.x + 0.5, cy = e.y + 0.5;
      switch (e.type) {
        case 'eat': {
          const col = ok(ITEM_COLOR[e.item] || C.orb);
          fx.burst(cx, cy, col, e.item === 'orb' ? 12 : 22, e.item === 'orb' ? 1 : 1.4);
          if (e.item === 'crystal') {
            fx.ring(cx, cy, col, 800, 4); fx.text(cx, cy - 0.4, '+1 Void Crystal', col, true);
            flash = 0.35; flashColor = C.crystal;
          } else {
            fx.text(cx, cy - 0.2, `+${e.pts}${e.combo > 1 ? '  ×' + e.combo : ''}`, col);
          }
          bulges.push(0); headPulse = 1;
          break;
        }
        case 'ability': {
          const map = { boost: C.comet, supernova: C.orb, phase: C.phase, singularity: C.shield, stasis: C.slow, flare: C.comet };
          const col = ok(map[e.id] || C.white);
          fx.ring(cx, cy, col, 650, e.radius ? e.radius + 0.5 : 2.5);
          if (e.id === 'supernova') { flash = 0.5; flashColor = C.orbHi; shake = Math.max(shake, 8); fx.burst(cx, cy, col, 40, 2.2); }
          if (e.id === 'flare' && e.charging) { flareCharge = performance.now(); fx.ring(cx, cy, ok(C.comet), 800, 2); }
          if (e.id === 'flare' && e.cells) {
            beams.push({ cells: e.cells, from: { x: cx, y: cy }, until: performance.now() + 380 });
            shake = Math.max(shake, 5);
            const mid = Math.floor(e.cells.length / 2);
            for (const [x, y] of e.cells) {
              fx.add({ x, y, max: 500, r: 0.25, shape: 'soft', color: ok(C.comet, 0.8), vx: 0, vy: 0 });
            }
            const head = e.cells[e.cells.length - 1];
            if (head) { fx.burst(head.x, head.y, ok(C.comet, 0.9), 20, 1.8); flash = 0.3; flashColor = C.comet; }
          }
          if (e.id === 'singularity') fx.ring(cx, cy, ok(C.shield, 0.6), 900, 7);
          break;
        }
        case 'shield': fx.ring(cx, cy, ok(C.shield), 700, 2); fx.text(cx, cy - 0.5, 'Shield!', ok(C.shield)); shake = Math.max(shake, 6); break;
        case 'revive': fx.ring(cx, cy, ok(C.slow), 900, 4); fx.text(cx, cy - 0.5, 'Rewind', ok(C.slow), true); flash = 0.4; flashColor = C.slow; break;
        case 'warp':
          fx.burst(e.from.x + 0.5, e.from.y + 0.5, ok(C.phase), 10, 0.8);
          fx.burst(e.to.x + 0.5, e.to.y + 0.5, ok(C.phase), 14, 1);
          break;
        case 'strike':
          shake = Math.max(shake, 5); flash = 0.25; flashColor = world.theme.bolt || C.comet;
          for (const [x, y] of e.cells) fx.burst(x + 0.5, y + 0.5, ok(world.theme.bolt || C.comet), 2, 0.8);
          break;
        case 'sever':
          for (const [x, y] of e.cells) fx.burst(x + 0.5, y + 0.5, ok(skin.tail), 4, 0.9);
          if (e.cells.length) fx.text(e.cells[0][0] + 0.5, e.cells[0][1], 'Severed', ok(world.theme.bolt || C.orb));
          break;
        case 'vent': for (const [x, y] of e.cells) fx.burst(x + 0.5, y + 0.5, ok(world.theme.lava || C.orb), 3, 0.6, { g: -0.000004 }); break;
        case 'crush': case 'swallow': case 'expire': case 'rivalEat':
          fx.burst(cx, cy, ok(dark ? [0.7, 0.03, 285] : [0.6, 0.03, 285]), 8, 0.6);
          break;
        case 'rivalDown':
          for (const [x, y] of e.cells) fx.burst(x + 0.5, y + 0.5, ok(C.rivalHead), 5, 1.2);
          if (e.cells.length) fx.text(e.cells[0][0] + 0.5, e.cells[0][1] - 0.3, 'Rival down!', ok(C.rivalHead), true);
          shake = Math.max(shake, 7);
          break;
        case 'rivalSpawn': fx.ring(cx, cy, ok(C.rivalHead), 700, 2); break;
        case 'time': fx.text(cx, cy + 0.8, '+3s', ok(C.timer)); break;
        case 'death': finaleFx(cx, cy, s); break;
        case 'finish': fx.burst(cx, cy, ok(C.comet), 30, 1.5); fx.ring(cx, cy, ok(C.comet), 800, 4); break;
      }
    }
  }

  function finaleFx(cx, cy, s) {
    const kind = finale?.fx || 'pop';
    shake = 16;
    const head = ok(skin.head), tail = ok(skin.tail);
    if (kind === 'pop') { fx.burst(cx, cy, head, 30, 1.7); fx.burst(cx, cy, ok(C.orb), 14, 1.2); }
    if (kind === 'ring') { fx.ring(cx, cy, ok(C.comet), 900, 6); fx.ring(cx, cy, head, 700, 3.5); fx.burst(cx, cy, ok(C.comet), 40, 2.4); flash = 0.6; flashColor = C.cometHi; }
    if (kind === 'confetti') {
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * TAU, sp = 0.004 + Math.random() * 0.01;
        fx.add({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.006, g: 0.00002, drag: 0.97, max: 1200, shape: 'rect', r: 0.12, spin: (Math.random() - 0.5) * 0.02, color: oklch(0.72, 0.17, Math.random() * 360) });
      }
    }
    if (kind === 'shatter') {
      for (const p of s.snake) {
        const a = Math.random() * TAU;
        fx.add({ x: p.x + 0.5, y: p.y + 0.5, vx: Math.cos(a) * 0.004, vy: Math.sin(a) * 0.004, g: 0.000012, drag: 0.98, max: 1100, shape: 'shard', r: 0.3, spin: (Math.random() - 0.5) * 0.02, color: Math.random() < 0.5 ? head : tail });
      }
    }
    if (kind === 'implode') {
      for (let i = 0; i < 50; i++) {
        const a = Math.random() * TAU, d = 2 + Math.random() * 3;
        fx.add({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vx: -Math.cos(a) * d / 600, vy: -Math.sin(a) * d / 600, drag: 1, max: 600, r: 0.1, color: ok(C.crystal) });
      }
      fx.ring(cx, cy, ok(C.crystal), 900, 5);
      flash = 0.4; flashColor = C.crystal;
    }
  }

  function onStep(s) {
    bulges = bulges.map((b) => b + 1).filter((b) => b < s.snake.length + 1);
    if (!trail || !trail.fx || !s.prev.length) return;
    const t = s.prev[s.prev.length - 1];
    const x = t.x + 0.5, y = t.y + 0.5;
    const col = trail.color;
    const j = () => (Math.random() - 0.5) * 0.4;
    switch (trail.fx) {
      case 'sparkle': fx.add({ x: x + j(), y: y + j(), max: 650, shape: 'star', r: 0.14, spin: 0.004, color: ok(col) }); break;
      case 'bubble': fx.add({ x: x + j(), y: y + j(), vy: -0.0012, drag: 1, max: 900, shape: 'bubble', r: 0.12 + Math.random() * 0.1, color: ok(col) }); break;
      case 'ember': fx.add({ x: x + j(), y: y + j(), vx: j() * 0.004, vy: -0.002, drag: 0.97, max: 700, r: 0.08, color: oklch(col[0] + Math.random() * 0.15, col[1], col[2] + Math.random() * 30) }); break;
      case 'pixel': fx.add({ x: x + j(), y: y + j(), max: 500, shape: 'rect', r: 0.13, color: oklch(col[0], col[1], (col[2] + performance.now() / 8) % 360) }); break;
      case 'streak': fx.add({ x, y, max: 380, shape: 'dot', r: 0.22, color: ok(col, 0.6) }); break;
      case 'orbit':
        fx.add({ x, y, max: 700, shape: 'orbit', r: 0.09, ox: x, oy: y, ang: 0, spin: 0.012, rad: 0.35, color: ok(col) });
        fx.add({ x, y, max: 700, shape: 'orbit', r: 0.07, ox: x, oy: y, ang: Math.PI, spin: 0.012, rad: 0.35, color: ok([0.85, 0.12, 60]) });
        break;
      case 'aurora': fx.add({ x: x + j(), y: y + j(), max: 900, r: 0.45, shape: 'soft', color: oklch(col[0], col[1], (col[2] + performance.now() / 20) % 360, 0.25) }); break;
    }
  }

  // -------------------------------------------------------------- draw helpers
  const wrapD = (d, n) => (d > n / 2 ? d - n : d < -n / 2 ? d + n : d);

  function interp(cur, prev, alpha, wrap, n) {
    const out = new Array(cur.length);
    for (let i = 0; i < cur.length; i++) {
      const c = cur[i];
      const p = prev[i] || c;
      let dx = c.x - p.x, dy = c.y - p.y;
      if (wrap) { dx = wrapD(dx, n); dy = wrapD(dy, n); }
      if (Math.abs(dx) + Math.abs(dy) > 1.01) { dx = 0; dy = 0; }
      out[i] = { x: c.x - dx * (1 - alpha), y: c.y - dy * (1 - alpha) };
    }
    return out;
  }

  function seg(a, b) {
    const dx0 = b.x - a.x, dy0 = b.y - a.y;
    ctx.beginPath();
    if (Math.abs(dx0) > 1.5 || Math.abs(dy0) > 1.5) {
      if (!world.wrap) return; // portal jump: leave a gap
      const n = world.size;
      const dx = wrapD(dx0, n), dy = wrapD(dy0, n);
      if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) return;
      ctx.moveTo((a.x + 0.5) * cell, (a.y + 0.5) * cell); ctx.lineTo((a.x + dx + 0.5) * cell, (a.y + dy + 0.5) * cell);
      ctx.moveTo((b.x - dx + 0.5) * cell, (b.y - dy + 0.5) * cell); ctx.lineTo((b.x + 0.5) * cell, (b.y + 0.5) * cell);
    } else {
      ctx.moveTo((a.x + 0.5) * cell, (a.y + 0.5) * cell); ctx.lineTo((b.x + 0.5) * cell, (b.y + 0.5) * cell);
    }
    ctx.stroke();
  }

  function serpent(pts, look, now, opt = {}) {
    const n = pts.length;
    if (!n) return;
    const { ghost = false, flashing = false, rival = false, dead = false, dir = { x: 1, y: 0 }, sp = null, pulse = 0, shield = 0, magnetR = 0 } = opt;
    const W = (i) => {
      const u = n > 1 ? i / (n - 1) : 0;
      let w = cell * (0.8 - 0.34 * u);
      if (!rival) for (const b of bulges) { const d = i - b; w += cell * 0.2 * Math.exp(-(d * d) / 1.2); }
      return w;
    };
    const colorAt = (i) => {
      const u = n > 1 ? i / (n - 1) : 0;
      if (flashing) return ok(C.orb);
      if (look.pattern === 'prism') return oklch(0.7, 0.16, (now / 12 + u * 300) % 360, ghost ? 0.5 : 1);
      let c = mix(look.head, look.tail, u);
      if (look.pattern === 'stripes' && Math.floor(i / 2) % 2) c = [Math.max(0.15, c[0] - 0.1), c[1], c[2]];
      if (ghost) return oklch(Math.min(0.9, c[0] + 0.15), 0.1, 210, 0.5);
      return ok(c);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!ghost) {
      ctx.save(); ctx.translate(0, cell * 0.14);
      ctx.strokeStyle = dark ? 'rgba(4,2,12,.4)' : oklch(0.3, 0.08, 280, 0.16);
      for (let i = n - 2; i >= 0; i--) { ctx.lineWidth = W(i); seg(pts[i], pts[i + 1]); }
      ctx.restore();
    }
    if (look.glow && !ghost && !flashing) {
      const pulseA = 0.18 + 0.08 * Math.sin(now / 260);
      ctx.strokeStyle = ok(look.glow, pulseA);
      for (let i = n - 2; i >= 0; i--) { ctx.lineWidth = W(i) * 1.7; seg(pts[i], pts[i + 1]); }
    }
    for (let i = n - 2; i >= 0; i--) { ctx.strokeStyle = colorAt(i); ctx.lineWidth = W(i); seg(pts[i], pts[i + 1]); }
    if (n === 1) { ctx.fillStyle = colorAt(0); ctx.beginPath(); ctx.arc((pts[0].x + 0.5) * cell, (pts[0].y + 0.5) * cell, W(0) / 2, 0, TAU); ctx.fill(); }

    if (!ghost && !flashing) {
      // sheen
      ctx.save(); ctx.translate(-cell * 0.08, -cell * 0.1);
      for (let i = n - 2; i >= 1; i--) { const u = i / (n - 1); ctx.strokeStyle = oklch(0.9, 0.05, look.head[2], 0.28 * (1 - u * 0.5)); ctx.lineWidth = W(i) * 0.2; seg(pts[i], pts[i + 1]); }
      ctx.restore();
      // pattern overlays
      if (look.pattern === 'dots') {
        for (let i = 2; i < n; i += 2) { ctx.fillStyle = oklch(0.95, 0.03, look.tail[2], 0.7); ctx.beginPath(); ctx.arc((pts[i].x + 0.5) * cell, (pts[i].y + 0.5) * cell, W(i) * 0.14, 0, TAU); ctx.fill(); }
      }
      if (look.pattern === 'scales') {
        ctx.strokeStyle = oklch(0.95, 0.04, look.tail[2], 0.45); ctx.lineWidth = Math.max(1, cell * 0.05);
        for (let i = 1; i < n - 1; i++) {
          const a = pts[i], b = pts[i - 1];
          let dx = b.x - a.x, dy = b.y - a.y;
          if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) continue;
          const ang = Math.atan2(dy, dx), r = W(i) * 0.28;
          ctx.beginPath(); ctx.arc((a.x + 0.5) * cell, (a.y + 0.5) * cell, r, ang + Math.PI - 0.9, ang + Math.PI + 0.9); ctx.stroke();
        }
      }
      if (look.pattern === 'galaxy') {
        for (let i = 1; i < n; i++) {
          const a = pts[i];
          for (let k = 0; k < 2; k++) {
            const ox = Math.sin(i * 12.9898 + k * 78.233) * 0.22, oy = Math.cos(i * 4.1414 + k * 13.37) * 0.22;
            ctx.fillStyle = oklch(0.95, 0.04, 280, 0.5 + 0.5 * Math.sin(now / 280 + i * 1.7 + k));
            ctx.beginPath(); ctx.arc((a.x + 0.5 + ox) * cell, (a.y + 0.5 + oy) * cell, Math.max(0.8, cell * 0.045), 0, TAU); ctx.fill();
          }
        }
      }
    }
    if (ghost) {
      ctx.setLineDash([cell * 0.2, cell * 0.16]); ctx.lineDashOffset = -now / 40;
      ctx.strokeStyle = ok(C.phase, 0.9); ctx.lineWidth = Math.max(1.2, cell * 0.05);
      for (let i = n - 2; i >= 0; i--) { seg(pts[i], pts[i + 1]); }
      ctx.setLineDash([]);
    }

    // head
    const p0 = pts[0], p1 = pts[1] || { x: p0.x - dir.x, y: p0.y - dir.y };
    let hx = p0.x - p1.x, hy = p0.y - p1.y;
    if (world.wrap) { hx = wrapD(hx, world.size); hy = wrapD(hy, world.size); }
    if (Math.abs(hx) > 1.5 || Math.abs(hy) > 1.5 || (Math.abs(hx) < 0.01 && Math.abs(hy) < 0.01)) { hx = dir.x; hy = dir.y; }
    const ang = Math.atan2(hy, hx), r = (W(0) / 2) * 1.08 * (1 + pulse * 0.16);
    const hxp = (p0.x + 0.5) * cell, hyp = (p0.y + 0.5) * cell;

    if (magnetR) {
      ctx.strokeStyle = ok(C.shield, 0.25 + 0.1 * Math.sin(now / 120)); ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.arc(hxp, hyp, magnetR * cell, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.save(); ctx.translate(hxp, hyp); ctx.rotate(ang);
    ctx.fillStyle = colorAt(0);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r, 0, 0, TAU); ctx.fill();
    if (sp && !ghost) headGear(sp, r, look, now);
    if (!dead && Math.floor(now) % 2300 < 170 && !rival) {
      ctx.strokeStyle = ok(C.orb); ctx.lineWidth = Math.max(1.5, cell * 0.06); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.lineTo(r * 1.55, 0);
      ctx.moveTo(r * 1.55, 0); ctx.lineTo(r * 1.8, -r * 0.2); ctx.moveTo(r * 1.55, 0); ctx.lineTo(r * 1.8, r * 0.2); ctx.stroke();
    }
    const blink = Math.floor(now) % 3700 < 110 || dead;
    for (const side of [-1, 1]) {
      const ex = r * 0.32, ey = side * r * 0.48, er = r * 0.3;
      ctx.fillStyle = rival ? ok([0.92, 0.1, 90]) : ok(C.eye);
      ctx.beginPath(); ctx.ellipse(ex, ey, er, blink ? er * 0.18 : er, 0, 0, TAU); ctx.fill();
      if (!blink) { ctx.fillStyle = ok(C.pupil); ctx.beginPath(); ctx.arc(ex + er * 0.35, ey, er * (rival ? 0.4 : 0.52), 0, TAU); ctx.fill(); }
      else if (dead) {
        ctx.strokeStyle = ok(C.pupil); ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.beginPath(); ctx.moveTo(ex - er * 0.6, ey - er * 0.6); ctx.lineTo(ex + er * 0.6, ey + er * 0.6);
        ctx.moveTo(ex + er * 0.6, ey - er * 0.6); ctx.lineTo(ex - er * 0.6, ey + er * 0.6); ctx.stroke();
      }
      if (rival) {
        ctx.strokeStyle = ok(C.pupil); ctx.lineWidth = Math.max(1.5, cell * 0.07);
        ctx.beginPath(); ctx.moveTo(ex - er, ey - side * er * 1.2); ctx.lineTo(ex + er, ey - side * er * 0.5); ctx.stroke();
      }
    }
    ctx.restore();

    if (shield) {
      ctx.strokeStyle = ok(C.shield, 0.7); ctx.lineWidth = Math.max(1.5, cell * 0.07);
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * TAU + now / 900; const R = r * 1.9; i ? ctx.lineTo(hxp + Math.cos(a) * R, hyp + Math.sin(a) * R) : ctx.moveTo(hxp + Math.cos(a) * R, hyp + Math.sin(a) * R); }
      ctx.stroke();
      if (shield > 1) { ctx.beginPath(); ctx.arc(hxp, hyp, r * 2.3, 0, TAU); ctx.stroke(); }
    }
  }

  function headGear(sp, r, look, now) {
    const accent = ok(mix(look.tail, [0.95, 0.05, look.tail[2]], 0.4));
    ctx.fillStyle = accent; ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1.2, r * 0.14); ctx.lineCap = 'round';
    switch (sp.id) {
      case 'nova':
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-r * 0.3, s * r * 0.75); ctx.lineTo(-r * 0.95, s * r * 1.15); ctx.lineTo(-r * 0.05, s * r * 0.9); ctx.fill(); }
        break;
      case 'phase':
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-r * 0.2, s * r * 0.7); ctx.lineTo(-r * 0.7, s * r * 1.25); ctx.stroke(); ctx.beginPath(); ctx.arc(-r * 0.75, s * r * 1.3, r * 0.14, 0, TAU); ctx.fill(); }
        break;
      case 'grav':
        ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.35, r * 1.35, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
        break;
      case 'chrono':
        ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(-r * 0.5 + Math.cos(now / 300) * r * 0.45, Math.sin(now / 300) * r * 0.45); ctx.stroke();
        break;
      case 'solar':
        for (const a of [-0.55, 0, 0.55]) {
          ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-r * 0.75, -r * 0.2); ctx.lineTo(-r * 1.45, 0); ctx.lineTo(-r * 0.75, r * 0.2); ctx.fill(); ctx.restore();
        }
        break;
    }
  }

  function drawItem(it, s, now) {
    const cx = (it.x + 0.5) * cell, cy = (it.y + 0.5) * cell, age = s.t - it.born;
    const pop = 1 - Math.pow(1 - Math.min(1, Math.max(0, age) / 260), 4);
    const bob = 1 + Math.sin(now / 280 + it.x * 1.7) * 0.05;
    const left = it.life === Infinity ? 1 : 1 - age / it.life;
    if (left < 0.28 && Math.floor(now / 110) % 2) return;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(pop * bob, pop * bob);
    ctx.fillStyle = dark ? 'rgba(0,0,0,.3)' : oklch(0.3, 0.08, 280, 0.14);
    ctx.beginPath(); ctx.ellipse(0, cell * 0.35, cell * 0.24, cell * 0.07, 0, 0, TAU); ctx.fill();
    const col = ITEM_COLOR[it.type];
    switch (it.type) {
      case 'orb': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.62);
        g.addColorStop(0, ok(col, 0.35)); g.addColorStop(1, ok(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, cell * 0.62, 0, TAU); ctx.fill();
        ctx.fillStyle = ok(col); ctx.beginPath(); ctx.arc(0, 0, cell * 0.3, 0, TAU); ctx.fill();
        ctx.fillStyle = ok(C.orbHi); ctx.beginPath(); ctx.arc(-cell * 0.1, -cell * 0.1, cell * 0.08, 0, TAU); ctx.fill();
        ctx.rotate(now / 900);
        star4(cell * 0.14, cell * 0.04, cell * 0.36, 0, ok(C.white, 0.9));
        break;
      }
      case 'comet': {
        ctx.save(); ctx.rotate(Math.PI * 0.75);
        const g = ctx.createLinearGradient(0, 0, cell * 0.9, 0);
        g.addColorStop(0, ok(col, 0.7)); g.addColorStop(1, ok(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -cell * 0.18); ctx.lineTo(cell * 0.95, 0); ctx.lineTo(0, cell * 0.18); ctx.fill();
        ctx.restore();
        ctx.rotate(Math.sin(now / 500) * 0.25);
        diamond(cell * 0.36, ok(col)); diamond(cell * 0.16, ok(C.cometHi));
        break;
      }
      case 'phase':
        ctx.rotate(now / 700);
        ctx.strokeStyle = ok(col); ctx.lineWidth = cell * 0.1; ctx.setLineDash([cell * 0.16, cell * 0.12]);
        ctx.beginPath(); ctx.arc(0, 0, cell * 0.3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = ok(col); ctx.beginPath(); ctx.arc(0, 0, cell * 0.12, 0, TAU); ctx.fill();
        break;
      case 'slow':
        ctx.rotate(Math.sin(now / 600) * 0.3);
        ctx.fillStyle = ok(col); ctx.beginPath();
        ctx.moveTo(-cell * 0.26, -cell * 0.34); ctx.lineTo(cell * 0.26, -cell * 0.34); ctx.lineTo(0, 0);
        ctx.lineTo(cell * 0.26, cell * 0.34); ctx.lineTo(-cell * 0.26, cell * 0.34); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        break;
      case 'magnet':
        ctx.rotate(Math.sin(now / 400) * 0.2);
        ctx.strokeStyle = ok(col); ctx.lineWidth = cell * 0.16; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(0, cell * 0.02, cell * 0.22, Math.PI, 0, true); ctx.stroke();
        ctx.strokeStyle = ok([0.85, 0.02, 280]);
        ctx.beginPath(); ctx.moveTo(-cell * 0.22, cell * 0.02); ctx.lineTo(-cell * 0.22, -cell * 0.2); ctx.moveTo(cell * 0.22, cell * 0.02); ctx.lineTo(cell * 0.22, -cell * 0.2); ctx.stroke();
        break;
      case 'shield':
        ctx.rotate(now / 1200);
        ctx.fillStyle = ok(col, 0.2); ctx.strokeStyle = ok(col); ctx.lineWidth = cell * 0.08;
        ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * TAU; const R = cell * 0.32; i ? ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R) : ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); }
        ctx.fill(); ctx.stroke();
        break;
      case 'crystal': {
        const pulse = 0.6 + 0.4 * Math.sin(now / 180);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cell * 0.9);
        g.addColorStop(0, ok(col, 0.45 * pulse)); g.addColorStop(1, ok(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, cell * 0.9, 0, TAU); ctx.fill();
        ctx.save(); ctx.rotate(now / 1400); star4(cell * 0.05, cell * 0.02, cell * 0.7, 0, ok(C.crystalHi, 0.7 * pulse)); ctx.restore();
        ctx.fillStyle = ok(col);
        ctx.beginPath(); ctx.moveTo(0, -cell * 0.4); ctx.lineTo(cell * 0.28, -cell * 0.1); ctx.lineTo(0, cell * 0.4); ctx.lineTo(-cell * 0.28, -cell * 0.1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = ok(C.crystalHi);
        ctx.beginPath(); ctx.moveTo(0, -cell * 0.4); ctx.lineTo(cell * 0.1, -cell * 0.1); ctx.lineTo(0, cell * 0.12); ctx.lineTo(-cell * 0.28, -cell * 0.1); ctx.closePath(); ctx.fill();
        break;
      }
    }
    ctx.restore();
    if (it.life !== Infinity && col) {
      ctx.strokeStyle = ok(col); ctx.lineWidth = Math.max(1.5, cell * 0.06); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, cell * 0.54, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, left)); ctx.stroke();
    }
  }
  function diamond(r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); }
  function star4(inner, thin, outer, rot, fill) {
    ctx.fillStyle = fill; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * TAU; const R = i % 2 ? thin : outer; ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
    ctx.closePath(); ctx.fill();
  }

  function drawWallCell(x, y, base, top) {
    const ins = cell * 0.06, rad = cell * 0.24;
    ctx.fillStyle = dark ? 'rgba(0,0,0,.35)' : oklch(0.3, 0.08, 280, 0.16);
    rr(ctx, x * cell + ins, y * cell + ins + cell * 0.12, cell - ins * 2, cell - ins * 2, rad); ctx.fill();
    ctx.fillStyle = ok(base); rr(ctx, x * cell + ins, y * cell + ins, cell - ins * 2, cell - ins * 2, rad); ctx.fill();
    ctx.fillStyle = ok(top); rr(ctx, x * cell + ins * 2.4, y * cell + ins * 2, cell - ins * 4.8, cell * 0.2, cell * 0.1); ctx.fill();
    ctx.fillStyle = ok([base[0] - 0.06, base[1], base[2]]);
    ctx.beginPath(); ctx.arc(x * cell + cell * 0.62, y * cell + cell * 0.62, cell * 0.1, 0, TAU); ctx.fill();
  }

  function drawHazards(s, now) {
    const t = world.theme;
    // static walls
    if (s.walls.size) for (const k of s.walls) drawWallCell(k % s.w, Math.floor(k / s.w), t.rock || [0.3, 0.05, 280], t.rockTop || [0.4, 0.05, 280]);
    // rocks
    for (const k of s.rockCells) drawWallCell(k % s.w, Math.floor(k / s.w), t.rock, t.rockTop);
    // singularity
    if (s.holeCenter) {
      const cx = (s.holeCenter.x + 0.5) * cell, cy = (s.holeCenter.y + 0.5) * cell;
      const g = ctx.createRadialGradient(cx, cy, cell * 0.8, cx, cy, cell * 3.2);
      g.addColorStop(0, oklch(0.55, 0.18, 320, 0.5)); g.addColorStop(1, oklch(0.4, 0.15, 300, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, cell * 3.2, 0, TAU); ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(now / (700 + i * 400) + i);
        ctx.strokeStyle = oklch(0.7 + i * 0.08, 0.16 - i * 0.03, 40 + i * 20, 0.55);
        ctx.lineWidth = Math.max(1.5, cell * (0.12 - i * 0.03));
        ctx.beginPath(); ctx.ellipse(0, 0, cell * (1.9 + i * 0.35), cell * (0.55 + i * 0.12), 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = oklch(0.08, 0.02, 290); ctx.beginPath(); ctx.arc(cx, cy, cell * 1.35, 0, TAU); ctx.fill();
      ctx.strokeStyle = oklch(0.85, 0.1, 50, 0.8); ctx.lineWidth = Math.max(1, cell * 0.06);
      ctx.beginPath(); ctx.arc(cx, cy, cell * 1.38, 0, TAU); ctx.stroke();
    }
    // portals
    for (const pr of s.portalPairs) {
      const hue = pr.hue ? 30 : 200;
      for (const p of [pr.a, pr.b]) {
        const cx = (p.x + 0.5) * cell, cy = (p.y + 0.5) * cell;
        ctx.save(); ctx.translate(cx, cy);
        ctx.fillStyle = oklch(0.15, 0.05, hue, 0.9); ctx.beginPath(); ctx.arc(0, 0, cell * 0.42, 0, TAU); ctx.fill();
        for (let i = 0; i < 2; i++) {
          ctx.rotate(now / (400 + i * 300) * (i ? -1 : 1));
          ctx.strokeStyle = oklch(0.75, 0.15, hue, 0.9 - i * 0.3); ctx.lineWidth = Math.max(1.5, cell * 0.08);
          ctx.setLineDash([cell * 0.3, cell * 0.15]);
          ctx.beginPath(); ctx.arc(0, 0, cell * (0.46 + i * 0.14), 0, TAU); ctx.stroke();
        }
        ctx.setLineDash([]); ctx.restore();
      }
    }
    // vents
    for (const v of s.vents) {
      const st = ventState(s, v);
      const phase = ((s.t + v.offset) % v.period) / v.period;
      for (const [x, y] of v.cells) {
        const ins = cell * 0.08, X = x * cell + ins, Y = y * cell + ins, S = cell - ins * 2;
        if (st === 'cool') {
          ctx.fillStyle = oklch(0.42, 0.09, 35, 0.55); rr(ctx, X, Y, S, S, cell * 0.2); ctx.fill();
          ctx.strokeStyle = oklch(0.6, 0.15, 40, 0.5); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(X + S * 0.2, Y + S * 0.3); ctx.lineTo(X + S * 0.5, Y + S * 0.55); ctx.lineTo(X + S * 0.8, Y + S * 0.4); ctx.stroke();
        } else if (st === 'warn') {
          const blink = 0.35 + 0.35 * Math.sin(now / 70);
          ctx.fillStyle = ok(t.lava, blink); rr(ctx, X, Y, S, S, cell * 0.2); ctx.fill();
          ctx.strokeStyle = ok(t.lava); ctx.lineWidth = 2; ctx.setLineDash([cell * 0.15, cell * 0.1]); rr(ctx, X, Y, S, S, cell * 0.2); ctx.stroke(); ctx.setLineDash([]);
        } else {
          ctx.fillStyle = ok(t.lava); rr(ctx, X - ins * 0.5, Y - ins * 0.5, S + ins, S + ins, cell * 0.22); ctx.fill();
          ctx.fillStyle = oklch(0.9, 0.14, 85, 0.6 + 0.3 * Math.sin(now / 90 + x)); ctx.beginPath(); ctx.arc(X + S / 2, Y + S / 2, S * 0.25, 0, TAU); ctx.fill();
          if (settings.colorblind) {
            ctx.strokeStyle = oklch(0.2, 0.05, 30, 0.7); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(X, Y + S); ctx.lineTo(X + S, Y); ctx.moveTo(X, Y + S / 2); ctx.lineTo(X + S / 2, Y); ctx.moveTo(X + S / 2, Y + S); ctx.lineTo(X + S, Y + S / 2); ctx.stroke();
          }
        }
        void phase;
      }
    }
    // storms
    for (const st of s.storms) {
      const ph = stormPhase(s, st);
      const bolt = t.bolt || C.comet;
      if (ph === 'warn') {
        const p = Math.min(1, (s.t - (st.strikeAt - 2200)) / 2200);
        const on = Math.floor(now / (220 - p * 160)) % 2 === 0;
        ctx.strokeStyle = ok([0.6, 0.2, 30]); ctx.fillStyle = ok([0.66, 0.21, 28], on ? 0.22 : 0.08);
        ctx.lineWidth = 2; ctx.setLineDash([cell * 0.18, cell * 0.12]);
        for (const [x, y] of st.cells) { rr(ctx, x * cell + cell * 0.08, y * cell + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.2); ctx.fill(); ctx.stroke(); }
        ctx.setLineDash([]);
        if (settings.colorblind) for (const [x, y] of st.cells) { ctx.fillStyle = ok([0.3, 0.05, 30]); ctx.font = `700 ${cell * 0.55}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', (x + 0.5) * cell, (y + 0.5) * cell); }
      } else if (ph === 'strike') {
        ctx.fillStyle = ok(bolt, 0.85);
        for (const [x, y] of st.cells) { rr(ctx, x * cell + cell * 0.04, y * cell + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.2); ctx.fill(); }
        ctx.strokeStyle = ok(C.white); ctx.lineWidth = Math.max(2, cell * 0.12); ctx.lineJoin = 'miter';
        ctx.beginPath();
        st.cells.forEach(([x, y], i) => {
          const jx = (x + 0.5 + (i % 2 ? 0.18 : -0.18) * (Math.random() < 0.5 ? 1 : 0.4)) * cell;
          const jy = (y + 0.5 + (i % 2 ? -0.18 : 0.18)) * cell;
          i ? ctx.lineTo(jx, jy) : ctx.moveTo(jx, jy);
        });
        ctx.stroke();
      }
    }
  }

  function drawBeams(now) {
    beams = beams.filter((b) => b.until > now);
    for (const b of beams) {
      if (!b.cells.length) continue;
      const k = (b.until - now) / 380;
      const col = ok(C.comet, 0.7 * k);
      ctx.save();
      ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = cell * 0.9 * k;
      ctx.shadowBlur = cell * 1.5; ctx.shadowColor = col;
      const last = b.cells[b.cells.length - 1];
      ctx.beginPath(); ctx.moveTo(b.from.x * cell, b.from.y * cell); ctx.lineTo((last[0] + 0.5) * cell, (last[1] + 0.5) * cell); ctx.stroke();
      ctx.strokeStyle = ok(C.white, k); ctx.lineWidth = cell * 0.35 * k; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(b.from.x * cell, b.from.y * cell); ctx.lineTo((last[0] + 0.5) * cell, (last[1] + 0.5) * cell); ctx.stroke();
      for (let i = 0; i < b.cells.length; i++) {
        if ((now + i * 30) % 120 < 30) {
          const [x, y] = b.cells[i];
          fx.add({ x, y, max: 400, r: 0.18, shape: 'soft', color: col, vx: 0, vy: 0 });
        }
      }
      ctx.restore();
    }
  }

  function beamCellsAt(s, x, y, d, len) {
    const cells = [];
    let c = { x, y };
    for (let i = 0; i < len; i++) {
      let nx = c.x + d.x, ny = c.y + d.y;
      if (s.wrap) { nx = (nx + s.w) % s.w; ny = (ny + s.h) % s.h; }
      else if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) break;
      const k = ny * s.w + nx;
      if (s.walls.has(k) || s.hole.has(k)) break;
      cells.push([nx, ny]);
      c = { x: nx, y: ny };
    }
    return cells;
  }

  function drawChargePreview(s, now) {
    if (!s.ability.charging || !flareCharge) return;
    const hd = s.snake[0];
    const cells = beamCellsAt(s, hd.x, hd.y, s.dir, 10);
    if (!cells.length) return;
    const k = 0.3 + 0.7 * Math.min(1, (now - flareCharge) / 800);
    const chargeColor = ok(C.comet, 0.8 * k);

    ctx.save();
    ctx.strokeStyle = chargeColor;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, cell * 0.7);
    ctx.shadowBlur = cell * 1.5;
    ctx.shadowColor = chargeColor;
    ctx.setLineDash([cell * 0.25, cell * 0.15]);

    const t = now - flareCharge;
    const pulse = 0.5 + 0.5 * Math.sin(t / 200);
    ctx.globalAlpha = k * (0.6 + 0.4 * pulse);
    ctx.beginPath();
    const first = cells[0];
    ctx.moveTo((first[0] + 0.5) * cell, (first[1] + 0.5) * cell);
    for (let i = 1; i < cells.length; i++) {
      ctx.lineTo((cells[i][0] + 0.5) * cell, (cells[i][1] + 0.5) * cell);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    const perpIdx = s.dir.x === 0 ? 'x' : 'y';
    for (const [x, y] of cells) {
      if (perpIdx === 'x') {
        for (const ox of [-1, 1]) {
          const nx = x + ox, ny = y;
          if (!s.walls.has(ny * s.w + nx) && !s.hole.has(ny * s.w + nx)) {
            const px = (nx + 0.5) * cell, py = (ny + 0.5) * cell;
            fx.add({ x: nx + 0.5, y: ny + 0.5, max: 300, r: 0.2, shape: 'soft', color: ok(C.comet, 0.4 * k), vx: 0, vy: 0 });
            ctx.fillStyle = chargeColor;
            ctx.fillRect(px - cell * 0.2, py - cell * 0.2, cell * 0.4, cell * 0.4);
          }
        }
      } else {
        for (const oy of [-1, 1]) {
          const nx = x, ny = y + oy;
          if (!s.walls.has(ny * s.w + nx) && !s.hole.has(ny * s.w + nx)) {
            const px = (nx + 0.5) * cell, py = (ny + 0.5) * cell;
            fx.add({ x: nx + 0.5, y: ny + 0.5, max: 300, r: 0.2, shape: 'soft', color: ok(C.comet, 0.4 * k), vx: 0, vy: 0 });
            ctx.fillStyle = chargeColor;
            ctx.fillRect(px - cell * 0.2, py - cell * 0.2, cell * 0.4, cell * 0.4);
          }
        }
      }
    }
    ctx.restore();

    for (let i = 0; i < cells.length; i++) {
      if ((t + i * 50) % 180 < 40) {
        const [x, y] = cells[i];
        fx.add({ x: x + 0.5, y: y + 0.5, max: 500, r: 0.22, shape: 'soft', color: ok(C.comet, 0.7 * k), vx: s.dir.x * 0.02, vy: s.dir.y * 0.02 });
      }
    }
    for (let i = 0; i < 8; i++) {
      const frac = (t + i * 60) % 400 / 400;
      if (frac > 0.7) continue;
      const [x, y] = cells[0];
      const spread = (frac - 0.5) * 0.4;
      fx.add({ x: x + 0.5 + (Math.random() - 0.5) * spread, y: y + 0.5 + (Math.random() - 0.5) * spread, max: 300, r: 0.15, shape: 'soft', color: ok(C.comet, 0.9 * k), vx: 0, vy: 0 });
    }
  }

  function drawParticles() {
    for (const p of fx.list) {
      const k = 1 - p.life / p.max;
      const x = p.x * cell, y = p.y * cell;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.shape === 'text' ? k * 2.2 : k));
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      switch (p.shape) {
        case 'dot': ctx.beginPath(); ctx.arc(x, y, p.r * cell * (0.5 + k * 0.5), 0, TAU); ctx.fill(); break;
        case 'soft': ctx.beginPath(); ctx.arc(x, y, p.r * cell, 0, TAU); ctx.fill(); break;
        case 'ring': { const e = 1 - Math.pow(k, 3); ctx.lineWidth = Math.max(1.5, cell * 0.12 * k); ctx.beginPath(); ctx.arc(x, y, p.size * cell * e, 0, TAU); ctx.stroke(); break; }
        case 'bubble': ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, p.r * cell, 0, TAU); ctx.stroke(); break;
        case 'rect': ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillRect(-p.r * cell, -p.r * cell * 0.6, p.r * cell * 2, p.r * cell * 1.2); ctx.restore(); break;
        case 'shard': ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(0, -p.r * cell); ctx.lineTo(p.r * cell * 0.6, p.r * cell * 0.5); ctx.lineTo(-p.r * cell * 0.6, p.r * cell * 0.4); ctx.closePath(); ctx.fill(); ctx.restore(); break;
        case 'star': ctx.save(); ctx.translate(x, y); ctx.rotate(p.life * p.spin); star4(0, p.r * cell * 0.25, p.r * cell * k + 1, 0, p.color); ctx.restore(); break;
        case 'orbit': { const a = p.ang + p.life * p.spin; ctx.beginPath(); ctx.arc((p.ox + Math.cos(a) * p.rad) * cell, (p.oy + Math.sin(a) * p.rad) * cell, p.r * cell, 0, TAU); ctx.fill(); break; }
        case 'text': {
          const e = 1 - Math.pow(1 - Math.min(1, p.life / 200), 3);
          const fs = Math.max(12, cell * (p.big ? 0.8 : 0.6)) * (0.7 + 0.3 * e);
          ctx.font = `800 ${fs}px "Bricolage Grotesque", system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
          ctx.lineWidth = 4; ctx.strokeStyle = dark ? oklch(0.15, 0.03, 285) : oklch(0.965, 0.012, 285);
          ctx.strokeText(p.text, x, y); ctx.fillText(p.text, x, y);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------- main draw
  function draw(s, alpha, now, dt, { deathAt = 0 } = {}) {
    fx.update(dt);
    shake *= Math.pow(0.86, dt / 16); if (shake < 0.3) shake = 0;
    headPulse *= Math.pow(0.86, dt / 16);
    flash *= Math.pow(0.88, dt / 16); if (flash < 0.01) flash = 0;
    if (settings.reducedMotion) shake = 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.fillStyle = ok(world.theme.board); ctx.fillRect(-30, -30, size + 60, size + 60);
    ctx.drawImage(bg, 0, 0, size, size);
    if (slowed(s) && !s.over) { ctx.fillStyle = ok(C.slow, 0.09); ctx.fillRect(-30, -30, size + 60, size + 60); }
    if (boosting(s)) { ctx.fillStyle = ok(C.comet, 0.06); ctx.fillRect(-30, -30, size + 60, size + 60); }

    drawHazards(s, now);
    for (const it of s.items) drawItem(it, s, now);

    if (s.rival && s.rival.alive && s.rival.body.length) {
      const pts = interp(s.rival.body, s.rival.prev, alpha, world.wrap, world.size);
      serpent(pts, { head: C.rivalHead, tail: C.rivalTail, pattern: 'stripes', glow: [0.6, 0.25, 350] }, now, { rival: true, dir: s.rival.dir, ghost: false });
    }

    const pts = interp(s.snake, s.prev, s.over ? 1 : alpha, world.wrap, world.size);
    const ghost = phasing(s) && !s.over;
    const ending = ghost && s.effects.phase - s.t < 1200 && Math.floor(now / 120) % 2;
    const flashing = s.over && !s.alive && Math.floor((now - deathAt) / 110) % 2 === 0;
    const magnetR = s.t < s.ability.strongMagnetUntil ? 7 : s.t < s.effects.magnet ? 5 : 0;
    serpent(pts, skin, now, { ghost: ghost && !ending, flashing, dead: s.over && !s.alive, dir: s.dir, sp: species, pulse: headPulse, shield: s.shield, magnetR });

    drawBeams(now);
    drawChargePreview(s, now);
    drawParticles();
    ctx.restore();

    if (flash) { ctx.fillStyle = ok(flashColor, flash * 0.5); ctx.fillRect(0, 0, size, size); }

    if (s.mode.timer) {
      const frac = Math.max(0, Math.min(1, timeLeft(s) / (s.mode.timer * 1000)));
      ctx.fillStyle = timeLeft(s) < 10000 ? ok(C.orb) : ok(dark ? [0.8, 0.1, 285] : C.timer);
      ctx.fillRect(0, 0, size * frac, Math.max(3, cell * 0.12));
    }
  }

  return { configure, resize, draw, onEvents, onStep, fx, get cell() { return cell; } };
}

/** Paint a static skin swatch (for shop and hangar tiles). */
export function paintSwatch(canvas, skinDef, species) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 120, h = canvas.clientHeight || 64;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const look = skinDef && skinDef.kind === 'skin' ? skinDef : { head: species.palette.head, tail: species.palette.tail, pattern: 'solid' };
  const n = 26, pts = [];
  for (let i = 0; i < n; i++) { const u = i / (n - 1); pts.push([w * 0.84 - u * w * 0.68, h / 2 + Math.sin(u * Math.PI * 2.2) * h * 0.2]); }
  g.lineCap = 'round';
  for (let i = n - 2; i >= 0; i--) {
    const u = i / (n - 1);
    let c = look.pattern === 'prism' ? [0.7, 0.16, (u * 300) % 360] : mix(look.head, look.tail, u);
    if (look.pattern === 'stripes' && Math.floor(i / 3) % 2) c = [c[0] - 0.1, c[1], c[2]];
    if (look.glow) { g.strokeStyle = ok(look.glow, 0.2); g.lineWidth = h * 0.5 * (1 - u * 0.4); g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i + 1]); g.stroke(); }
    g.strokeStyle = ok(c); g.lineWidth = h * 0.3 * (1 - u * 0.45);
    g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i + 1]); g.stroke();
  }
  if (look.pattern === 'galaxy' || look.pattern === 'dots') {
    for (let i = 2; i < n; i += 3) { g.fillStyle = oklch(0.95, 0.03, 280, 0.8); g.beginPath(); g.arc(pts[i][0], pts[i][1] + (i % 2 ? 2 : -2), 1.4, 0, TAU); g.fill(); }
  }
  const [hx, hy] = pts[0];
  g.fillStyle = ok(look.pattern === 'prism' ? [0.7, 0.16, 0] : look.head);
  g.beginPath(); g.ellipse(hx, hy, h * 0.2, h * 0.18, 0, 0, TAU); g.fill();
  g.fillStyle = ok([0.985, 0.005, 285]);
  for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + h * 0.06, hy + s * h * 0.08, h * 0.055, 0, TAU); g.fill(); }
  g.fillStyle = ok([0.2, 0.04, 280]);
  for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + h * 0.08, hy + s * h * 0.08, h * 0.03, 0, TAU); g.fill(); }
}
