// Deterministic PRNG (mulberry32) + helpers.
// Every gameplay random roll goes through here so runs can be replayed and verified.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed = 1) {
  let a = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9;
  const rng = {
    get state() { return a; },
    set state(v) { a = v >>> 0; },
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(rng.next() * n); },
    range(min, max) { return min + rng.int(max - min + 1); },
    pick(arr) { return arr[rng.int(arr.length)]; },
    chance(p) { return rng.next() < p; },
    /** entries: [[value, weight], ...] */
    weighted(entries) {
      let total = 0;
      for (const [, w] of entries) total += w;
      let roll = rng.next() * total;
      for (const [v, w] of entries) {
        roll -= w;
        if (roll < 0) return v;
      }
      return entries[entries.length - 1][0];
    },
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
  return rng;
}
