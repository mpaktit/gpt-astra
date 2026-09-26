// Particle system in cell units. Cheap, capped, and silent when reduced motion is on.
const TAU = Math.PI * 2;
export function createFx() {
  const ps = [];
  const cap = 600;
  const api = {
    reduced: false,
    list: ps,
    clear() { ps.length = 0; },
    add(p) { if (ps.length < cap) ps.push({ life: 0, vx: 0, vy: 0, g: 0, drag: 0.93, r: 0.08, shape: 'dot', spin: 0, rot: 0, ...p }); },
    burst(x, y, color, n = 12, power = 1, extra = {}) {
      if (api.reduced) n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = (0.003 + Math.random() * 0.011) * power;
        api.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: 380 + Math.random() * 420, color, r: 0.05 + Math.random() * 0.1, ...extra });
      }
    },
    ring(x, y, color, max = 600, size = 3) { api.add({ x, y, shape: 'ring', color, max, size }); },
    text(x, y, text, color, big = false) { api.add({ x, y, vy: -0.0014, drag: 1, shape: 'text', text, color, max: 950, big }); },
    update(dt) {
      const k = Math.pow(0.93, dt / 16);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life += dt;
        if (p.life >= p.max) { ps.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += p.g * dt;
        if (p.drag !== 1) { const d = p.drag === 0.93 ? k : Math.pow(p.drag, dt / 16); p.vx *= d; p.vy *= d; }
        p.rot += p.spin * dt;
      }
    },
  };
  return api;
}
