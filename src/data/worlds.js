// Sectors. Each one adds a single new idea so difficulty climbs in readable steps.
// Colors are OKLCH triples [L, C, H]; the renderer converts them.

export const WORLDS = [
  {
    id: 'nebula', name: 'Nebula Drift', order: 1, unlockLevel: 1,
    blurb: 'Soft gas, open space, edges that loop. Learn the coil here.',
    mechanic: 'Edges wrap around',
    size: 22, wrap: true, baseInterval: 125, scoreMult: 1.0,
    hazards: [],
    stars: [300, 900, 2000],
    spawn: { x: 11, y: 11, dir: 'right' },
    theme: { board: [0.945, 0.018, 290], dot: [0.83, 0.03, 290], star: [0.72, 0.06, 290], blob: [0.8, 0.09, 320], edge: [0.72, 0.04, 290], ink: 'dark' },
  },
  {
    id: 'asteroids', name: 'Asteroid Belt', order: 2, unlockLevel: 3,
    blurb: 'Solid walls and drifting rocks. The rocks move; you had better too.',
    mechanic: 'Drifting asteroids, solid edges',
    size: 22, wrap: false, baseInterval: 125, scoreMult: 1.2,
    hazards: ['rocks'],
    stars: [400, 1100, 2400],
    spawn: { x: 11, y: 11, dir: 'right' },
    theme: { board: [0.93, 0.025, 65], dot: [0.82, 0.035, 60], star: [0.7, 0.05, 55], blob: [0.84, 0.06, 45], edge: [0.35, 0.05, 40], rock: [0.42, 0.04, 45], rockTop: [0.55, 0.04, 50], ink: 'dark' },
  },
  {
    id: 'ion', name: 'Ion Storm', order: 3, unlockLevel: 6,
    blurb: 'Lightning cuts across the sector. It warns you first. Once.',
    mechanic: 'Telegraphed lightning severs your tail',
    size: 22, wrap: true, baseInterval: 122, scoreMult: 1.4,
    hazards: ['storms'],
    stars: [450, 1200, 2600],
    spawn: { x: 11, y: 11, dir: 'right' },
    theme: { board: [0.94, 0.022, 225], dot: [0.82, 0.035, 225], star: [0.68, 0.07, 230], blob: [0.82, 0.07, 200], edge: [0.66, 0.05, 225], bolt: [0.86, 0.17, 95], ink: 'dark' },
  },
  {
    id: 'horizon', name: 'Event Horizon', order: 4, unlockLevel: 10,
    blurb: 'A black hole eats the stardust. Wormholes fold space. Be faster than gravity.',
    mechanic: 'Wormholes and a hungry singularity',
    size: 23, wrap: false, baseInterval: 120, scoreMult: 1.6,
    hazards: ['portals', 'singularity'],
    stars: [500, 1300, 2800],
    spawn: { x: 8, y: 19, dir: 'right' },
    theme: { board: [0.21, 0.04, 285], dot: [0.33, 0.05, 285], star: [0.85, 0.05, 285], blob: [0.35, 0.11, 310], edge: [0.5, 0.06, 285], ink: 'light' },
  },
  {
    id: 'forge', name: 'Solar Forge', order: 5, unlockLevel: 14,
    blurb: 'Vents on the surface of a star breathe in rhythm. Read the pulse.',
    mechanic: 'Pulsing lava vents',
    size: 22, wrap: false, baseInterval: 118, scoreMult: 1.8,
    hazards: ['lava'],
    stars: [550, 1400, 3000],
    spawn: { x: 11, y: 11, dir: 'right' },
    theme: { board: [0.94, 0.035, 80], dot: [0.83, 0.05, 75], star: [0.72, 0.08, 70], blob: [0.86, 0.08, 55], edge: [0.4, 0.08, 40], lava: [0.66, 0.21, 32], ink: 'dark' },
  },
  {
    id: 'rift', name: 'Void Rift', order: 6, unlockLevel: 18,
    blurb: 'Something else lives here. It wants your stardust. Make it crash into you.',
    mechanic: 'A rival serpent hunts the same prey',
    size: 24, wrap: true, baseInterval: 118, scoreMult: 2.0,
    hazards: ['rival', 'pillars'],
    stars: [600, 1500, 3200],
    spawn: { x: 12, y: 12, dir: 'right' },
    theme: { board: [0.17, 0.05, 300], dot: [0.29, 0.06, 300], star: [0.8, 0.07, 300], blob: [0.32, 0.13, 330], edge: [0.45, 0.08, 300], rock: [0.36, 0.07, 300], rockTop: [0.46, 0.08, 300], ink: 'light' },
  },
];

export const worldById = (id) => WORLDS.find((w) => w.id === id) || WORLDS[0];
