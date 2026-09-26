// Minimal, safe templating. Every interpolation is escaped unless explicitly wrapped in raw().
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));

function flat(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(flat).join('');
  return esc(v);
}

export function html(strings, ...vals) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < vals.length) out += flat(vals[i]);
  }
  return new Raw(out);
}

export function mount(el, tpl) { el.innerHTML = tpl instanceof Raw ? tpl.s : esc(tpl); }
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const fmt = (n) => Math.floor(n).toLocaleString('en-US');
export const fmtTime = (ms) => { const s = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const cls = (...xs) => xs.filter(Boolean).join(' ');

export function countUp(el, to, ms = 900) {
  if (!el) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reducedMotion === 'true';
  if (reduce || to <= 0) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const stepFn = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(stepFn);
  };
  requestAnimationFrame(stepFn);
}
