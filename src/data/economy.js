// The economy in one place. Tune here, tests guard the invariants.
//
// Stardust (✦)  soft currency. Earned every run. Buys species, common/rare cosmetics, Nebula Caches.
// Void Crystals (◆) premium. Rare drops, achievements, streaks, pass, or purchase. Buys epic+ cosmetics,
//               the premium pass, Void Caches. Never required for power: species are all Stardust-earnable.
// Relic Shards  from duplicate cache pulls. Spend 10-60 to pick any shoppable cosmetic you want.

export const CURRENCIES = {
  stardust: { id: 'stardust', name: 'Stardust', glyph: '✦' },
  crystals: { id: 'crystals', name: 'Void Crystals', glyph: '◆' },
  shards: { id: 'shards', name: 'Relic Shards', glyph: '⬡' },
};

export const STARTING_WALLET = { stardust: 600, crystals: 40, shards: 0 };

export const COSMETIC_PRICES = {
  common: { stardust: 450 },
  rare: { stardust: 1400 },
  epic: { crystals: 450, stardust: 5200 },
  legendary: { crystals: 1100 },
  mythic: { crystals: 2000 },
};

export const SHARD_PRICES = { common: 10, rare: 20, epic: 35, legendary: 60, mythic: 999 };
export const DUPLICATE_SHARDS = { common: 2, rare: 5, epic: 10, legendary: 20, mythic: 30 };

// Caches: odds are published in the UI (required in many regions, and just decent).
export const CACHES = {
  nebula: {
    id: 'nebula', name: 'Nebula Cache', price: { stardust: 1800 },
    odds: { common: 0.62, rare: 0.3, epic: 0.07, legendary: 0.01 },
    pity: { epic: 12, legendary: 60 },
  },
  void: {
    id: 'void', name: 'Void Cache', price: { crystals: 160 },
    odds: { rare: 0.55, epic: 0.35, legendary: 0.1 },
    pity: { epic: 4, legendary: 20 },
  },
};

// Store packs. Real money requires a server (see src/services/payments.js). Prices in USD.
export const CRYSTAL_PACKS = [
  { id: 'pack-s', crystals: 120, bonus: 0, usd: 0.99 },
  { id: 'pack-m', crystals: 550, bonus: 50, usd: 4.99 },
  { id: 'pack-l', crystals: 1200, bonus: 200, usd: 9.99, tag: 'Popular' },
  { id: 'pack-xl', crystals: 2500, bonus: 600, usd: 19.99 },
  { id: 'pack-xxl', crystals: 6500, bonus: 2000, usd: 49.99, tag: 'Best value' },
];
export const STARTER_PACK = { id: 'starter', crystals: 400, stardust: 6000, cosmetic: 'aurora', usd: 2.99, oneTime: true };

export const EXCHANGE = { crystals: 100, stardust: 2600 };

export const PASS_PRICE = { crystals: 950 };
export const PASS_TIERS = 40;
export const PASS_XP_PER_TIER = 1000;

// Login calendar: advances each day you show up. Missing days never resets it.
export const LOGIN_REWARDS = [
  { stardust: 250 }, { stardust: 400 }, { crystals: 10 }, { stardust: 600 },
  { cache: 'nebula' }, { stardust: 900 }, { crystals: 50 },
];

export const DAILY_RIFT_REWARD = { stardust: 600, crystals: 10 };
