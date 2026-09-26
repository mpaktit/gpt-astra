// Tiny serpent brain: greedy toward nearest target, with flood-fill so it avoids trapping itself.
// Used for the rival in Void Rift, the attract-mode demo, and the fuzz tests.

export const DIR_LIST = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
];

export function chooseDir({ w, h, wrap, head, dir, targets, blocked, rng, lookahead = 60 }) {
  const norm = (x, y) => (wrap ? [(x + w) % w, (y + h) % h] : [x, y]);
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const dist = (ax, ay, bx, by) => {
    let dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    if (wrap) { dx = Math.min(dx, w - dx); dy = Math.min(dy, h - dy); }
    return dx + dy;
  };
  let target = null, td = Infinity;
  for (const t of targets) {
    const d = dist(head.x, head.y, t.x, t.y);
    if (d < td) { td = d; target = t; }
  }
  const flood = (sx, sy, limit) => {
    const seen = new Set([sy * w + sx]);
    const q = [sx, sy];
    let qi = 0, count = 0;
    while (qi < q.length && count < limit) {
      const cx = q[qi++], cy = q[qi++];
      count++;
      for (const d of DIR_LIST) {
        let [nx, ny] = norm(cx + d.x, cy + d.y);
        if (!inBounds(nx, ny)) continue;
        const k = ny * w + nx;
        if (seen.has(k) || blocked(nx, ny)) continue;
        seen.add(k);
        q.push(nx, ny);
      }
    }
    return count;
  };
  let best = null, bestScore = -Infinity;
  for (const d of DIR_LIST) {
    if (d.x === -dir.x && d.y === -dir.y) continue;
    const [nx, ny] = norm(head.x + d.x, head.y + d.y);
    if (!inBounds(nx, ny) || blocked(nx, ny)) continue;
    const space = flood(nx, ny, lookahead);
    let score = (space >= lookahead ? 200 : space * 2);
    if (target) score -= dist(nx, ny, target.x, target.y);
    if (d.x === dir.x && d.y === dir.y) score += 0.4;
    score += (rng ? rng.next() : 0) * 0.3;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best; // null means trapped
}
