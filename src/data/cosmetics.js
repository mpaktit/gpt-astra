// Cosmetics: pure flex, zero stat impact. This is where the premium currency earns its keep.
// Skins describe how the renderer paints the body: two OKLCH stops + a pattern.

import { SPECIES } from './species.js';

const skin = (id, name, rarity, head, tail, pattern, extra = {}) => ({ id, kind: 'skin', name, rarity, head, tail, pattern, ...extra });

export const SKINS = [
  skin('tidal', 'Tidal', 'common', [0.5, 0.14, 240], [0.78, 0.09, 215], 'dots'),
  skin('moss', 'Moonmoss', 'common', [0.48, 0.12, 150], [0.76, 0.1, 125], 'scales'),
  skin('dune', 'Dune Runner', 'common', [0.6, 0.09, 70], [0.82, 0.06, 85], 'stripes'),
  skin('aurora', 'Aurora', 'rare', [0.62, 0.13, 180], [0.58, 0.18, 305], 'stripes'),
  skin('ember', 'Ember', 'rare', [0.6, 0.2, 35], [0.8, 0.15, 75], 'glow'),
  skin('candy', 'Candy Comet', 'rare', [0.66, 0.18, 350], [0.9, 0.05, 350], 'stripes'),
  skin('first-light', 'First Light', 'rare', [0.78, 0.12, 90], [0.62, 0.15, 250], 'dots', { source: 'pass' }),
  skin('obsidian', 'Obsidian Pulse', 'epic', [0.28, 0.05, 300], [0.36, 0.08, 330], 'glow', { glow: [0.66, 0.24, 340] }),
  skin('tempest', 'Tempest', 'epic', [0.45, 0.16, 250], [0.9, 0.08, 95], 'scales', { glow: [0.86, 0.17, 95] }),
  skin('void-silk', 'Void Silk', 'epic', [0.3, 0.12, 290], [0.45, 0.16, 320], 'galaxy', { source: 'pass' }),
  skin('prism', 'Prism', 'legendary', [0.7, 0.16, 0], [0.7, 0.16, 0], 'prism'),
  skin('galaxy', 'Andromeda', 'legendary', [0.25, 0.08, 280], [0.3, 0.12, 250], 'galaxy'),
  skin('solar-crown', 'Solar Crown', 'mythic', [0.82, 0.16, 85], [0.65, 0.21, 35], 'glow', { glow: [0.9, 0.15, 90], source: 'pass' }),
  // Mastery skins: earned only by playing a species to mastery 5.
  ...SPECIES.map((sp) => skin(`${sp.id}-ascendant`, `${sp.name.split(' ')[0]} Ascendant`, 'epic', sp.palette.tail, sp.palette.head, 'scales', { source: 'mastery', species: sp.id, glow: sp.palette.tail })),
];

export const TRAILS = [
  { id: 'none', kind: 'trail', name: 'No trail', rarity: 'common', source: 'default' },
  { id: 'stardust', kind: 'trail', name: 'Stardust', rarity: 'common', fx: 'sparkle', color: [0.8, 0.12, 90] },
  { id: 'bubbles', kind: 'trail', name: 'Nebula Bubbles', rarity: 'rare', fx: 'bubble', color: [0.75, 0.1, 220] },
  { id: 'embers', kind: 'trail', name: 'Embers', rarity: 'rare', fx: 'ember', color: [0.68, 0.2, 40] },
  { id: 'pixels', kind: 'trail', name: '8-Bit Wake', rarity: 'epic', fx: 'pixel', color: [0.62, 0.2, 300] },
  { id: 'comet-tail', kind: 'trail', name: 'Comet Tail', rarity: 'epic', fx: 'streak', color: [0.85, 0.13, 85] },
  { id: 'binary', kind: 'trail', name: 'Binary Stars', rarity: 'epic', fx: 'orbit', color: [0.75, 0.14, 200], source: 'pass' },
  { id: 'aurora-veil', kind: 'trail', name: 'Aurora Veil', rarity: 'legendary', fx: 'aurora', color: [0.75, 0.15, 170] },
];

export const FINALES = [
  { id: 'pop', kind: 'finale', name: 'Pop', rarity: 'common', source: 'default', fx: 'pop' },
  { id: 'confetti', kind: 'finale', name: 'Confetti', rarity: 'rare', fx: 'confetti' },
  { id: 'supernova', kind: 'finale', name: 'Supernova', rarity: 'rare', fx: 'ring' },
  { id: 'shatter', kind: 'finale', name: 'Shatter', rarity: 'epic', fx: 'shatter' },
  { id: 'implode', kind: 'finale', name: 'Black Hole', rarity: 'legendary', fx: 'implode', source: 'pass' },
];

export const TITLES = [
  { id: 'hatchling', kind: 'title', name: 'Hatchling', rarity: 'common', source: 'default' },
  { id: 'stargazer', kind: 'title', name: 'Stargazer', rarity: 'common' },
  { id: 'comet-chaser', kind: 'title', name: 'Comet Chaser', rarity: 'rare' },
  { id: 'void-walker', kind: 'title', name: 'Void Walker', rarity: 'epic' },
  { id: 'combo-architect', kind: 'title', name: 'Combo Architect', rarity: 'epic', source: 'achievement' },
  { id: 'rival-breaker', kind: 'title', name: 'Rival Breaker', rarity: 'epic', source: 'achievement' },
  { id: 'first-light', kind: 'title', name: 'First Light Pioneer', rarity: 'legendary', source: 'pass' },
  { id: 'sovereign', kind: 'title', name: 'Sector Sovereign', rarity: 'legendary', source: 'achievement' },
  ...SPECIES.map((sp) => ({ id: `${sp.id}-master`, kind: 'title', name: `${sp.name} Master`, rarity: 'legendary', source: 'mastery', species: sp.id })),
];

export const ALL_COSMETICS = [...SKINS, ...TRAILS, ...FINALES, ...TITLES];
export const cosmeticById = (id) => ALL_COSMETICS.find((c) => c.id === id) || null;
export const DEFAULT_COSMETICS = ['none', 'pop', 'hatchling'];

/** Items that can appear in the rotating shop and in caches (no pass, mastery or achievement exclusives). */
export const SHOPPABLE = ALL_COSMETICS.filter((c) => !c.source);
