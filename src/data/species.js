// Playable serpent species. Every species is earnable with Stardust (free currency).
// Void Crystals are a shortcut, never a wall. Balance lives here.

export const SPECIES = [
  {
    id: 'drift', name: 'Drift Eel', rarity: 'common', origin: 'Nebula shallows',
    blurb: 'Lives in gas clouds. Forgiving, quick to learn, quietly deadly in the right hands.',
    stats: { speed: 1.0, yield: 1.0, startLen: 4, buffer: 3 },
    ability: { id: 'boost', name: 'Afterburn', desc: 'Surge forward at speed. Double points for 2.5s.', cooldown: 9000, duration: 2500 },
    passive: { id: 'buffer', desc: 'Buffers an extra turn, so tight corners stay clean.' },
    price: { stardust: 0 },
    palette: { head: [0.42, 0.2, 275], tail: [0.72, 0.12, 305] },
  },
  {
    id: 'nova', name: 'Nova Viper', rarity: 'rare', origin: 'Dying red giants',
    blurb: 'Feeds on stellar collapse. Clears hazards around itself in one blast.',
    stats: { speed: 1.02, yield: 1.0, startLen: 4, buffer: 2 },
    ability: { id: 'supernova', name: 'Supernova', desc: 'Detonate: destroys rocks, storms and rivals within 4 cells. Debris turns to stardust.', cooldown: 14000, duration: 0 },
    passive: { id: 'comet-bonus', desc: 'Comets are worth 25% more.' },
    price: { stardust: 2500 },
    palette: { head: [0.6, 0.2, 35], tail: [0.8, 0.13, 70] },
  },
  {
    id: 'phase', name: 'Phase Wyrm', rarity: 'rare', origin: 'Between dimensions',
    blurb: 'Half here, half elsewhere. Slips through its own coils and anything unstable.',
    stats: { speed: 1.0, yield: 1.05, startLen: 4, buffer: 2 },
    ability: { id: 'phase', name: 'Blink Phase', desc: 'Phase for 3s: pass through your body, rocks, storms, lava and rivals.', cooldown: 12000, duration: 3000 },
    passive: { id: 'phase-extend', desc: 'Phase pickups last 50% longer.' },
    price: { stardust: 6000 },
    palette: { head: [0.62, 0.12, 210], tail: [0.86, 0.07, 190] },
  },
  {
    id: 'grav', name: 'Grav Serpent', rarity: 'epic', origin: 'Neutron star orbit',
    blurb: 'So dense that stardust falls toward it. Farms like nothing else.',
    stats: { speed: 0.96, yield: 1.1, startLen: 4, buffer: 2 },
    ability: { id: 'singularity', name: 'Singularity', desc: 'Pull every pickup within 7 cells toward you for 3.5s.', cooldown: 12000, duration: 3500 },
    passive: { id: 'micro-grav', desc: 'Always tugs nearby pickups (2 cells).' },
    price: { stardust: 9000, crystals: 900 },
    palette: { head: [0.35, 0.09, 250], tail: [0.62, 0.14, 160] },
  },
  {
    id: 'chrono', name: 'Chrono Naga', rarity: 'epic', origin: 'The edge of causality',
    blurb: 'Remembers the future. Cheats death once per run by rewinding eight moves.',
    stats: { speed: 1.0, yield: 1.0, startLen: 4, buffer: 2 },
    ability: { id: 'stasis', name: 'Stasis', desc: 'Time crawls for 4s. Thread impossible gaps.', cooldown: 13000, duration: 4000 },
    passive: { id: 'revive', desc: 'Once per run, a fatal hit rewinds you 8 moves instead.' },
    price: { stardust: 14000, crystals: 1300 },
    palette: { head: [0.5, 0.13, 150], tail: [0.85, 0.1, 110] },
  },
  {
    id: 'solar', name: 'Solar Leviathan', rarity: 'legendary', origin: 'Born inside a star',
    blurb: 'Ancient, enormous, radiant. Breathes a lance of fire that eats everything in its path.',
    stats: { speed: 1.04, yield: 1.15, startLen: 6, buffer: 2 },
    ability: { id: 'flare', name: 'Solar Lance', desc: 'Hold E to charge, steer the aim, then release: a 10-cell, 1-cell-wide beam that vaporizes everything in its path.', cooldown: 15000, duration: 0 },
    passive: { id: 'radiant', desc: 'Starts longer. Earns 15% more Stardust.' },
    price: { stardust: 30000, crystals: 2400 },
    palette: { head: [0.68, 0.18, 55], tail: [0.62, 0.22, 25] },
  },
];

export const speciesById = (id) => SPECIES.find((s) => s.id === id) || SPECIES[0];

// Mastery: species XP thresholds for level 1..10
export const MASTERY_XP = [0, 600, 1600, 3200, 5400, 8200, 12000, 17000, 23000, 30000];
export function masteryLevel(xp = 0) {
  let lvl = 1;
  for (let i = 0; i < MASTERY_XP.length; i++) if (xp >= MASTERY_XP[i]) lvl = i + 1;
  return lvl;
}
