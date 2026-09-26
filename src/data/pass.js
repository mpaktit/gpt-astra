// Season 1: First Light. 40 tiers. The premium track refunds 1,150 crystals over the season,
// so a pilot who finishes it can buy next season's pass without paying again.

import { PASS_TIERS } from './economy.js';

const FREE = {
  2: { stardust: 400 }, 4: { cosmetic: 'stargazer' }, 6: { stardust: 600 }, 8: { crystals: 20 },
  10: { cosmetic: 'first-light' }, 12: { stardust: 800 }, 14: { cache: 'nebula' }, 16: { crystals: 30 },
  18: { stardust: 1000 }, 20: { cosmetic: 'comet-chaser' }, 22: { stardust: 1200 }, 24: { crystals: 30 },
  26: { cache: 'nebula' }, 28: { stardust: 1500 }, 30: { crystals: 40 }, 32: { stardust: 1800 },
  34: { cache: 'nebula' }, 36: { stardust: 2000 }, 38: { crystals: 50 }, 40: { stardust: 4000 },
};
const PREMIUM = {
  1: { cosmetic: 'binary' }, 3: { crystals: 100 }, 5: { cosmetic: 'bubbles' }, 7: { stardust: 1500 },
  9: { cache: 'void' }, 10: { crystals: 100 }, 12: { cosmetic: 'embers' }, 15: { crystals: 150 },
  17: { stardust: 2500 }, 20: { cosmetic: 'void-silk' }, 22: { cache: 'void' }, 24: { crystals: 150 },
  25: { cosmetic: 'implode' }, 27: { stardust: 3500 }, 29: { cache: 'void' }, 30: { crystals: 200 },
  32: { cosmetic: 'tempest' }, 33: { stardust: 4000 }, 35: { crystals: 200 }, 37: { cache: 'void' },
  38: { crystals: 250 }, 40: { cosmetic: 'solar-crown' },
};

export const SEASON = {
  id: 1, name: 'First Light',
  tiers: Array.from({ length: PASS_TIERS }, (_, i) => ({ tier: i + 1, free: FREE[i + 1] || null, premium: PREMIUM[i + 1] || null })),
};
