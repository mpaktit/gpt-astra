// OKLCH -> sRGB with a small cache. The whole game palette is authored in OKLCH.
const cache = new Map();
export function oklch(L, C, H, a = 1) {
  const k = `${L.toFixed(3)}|${C.toFixed(3)}|${H.toFixed(1)}|${a.toFixed(3)}`;
  let v = cache.get(k);
  if (v) return v;
  const h = (H * Math.PI) / 180, A = C * Math.cos(h), B = C * Math.sin(h);
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const f = (x) => { x = Math.max(0, Math.min(1, x)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); };
  v = `rgba(${f(r)},${f(g)},${f(b)},${a})`;
  if (cache.size > 4000) cache.clear();
  cache.set(k, v);
  return v;
}
export const ok = (t, a = 1) => oklch(t[0], t[1], t[2], a);
export function mix(a, b, u) {
  let dh = b[2] - a[2];
  if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, (a[2] + dh * u + 360) % 360];
}
