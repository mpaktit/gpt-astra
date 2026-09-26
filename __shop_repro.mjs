import { createProfile } from './src/meta/profile.js';
import { dailyOffers, buyCosmetic } from './src/meta/store.js';
import { grant } from './src/meta/wallet.js';

const p = createProfile(Date.now(), 42);
grant(p, { stardust: 289 }, 'test'); // -> 889 stardust, 40 crystals like browser session
console.log('wallet', JSON.stringify(p.wallet));
const { items } = dailyOffers(p, new Date());
console.log('daily offers:', items.map(i => `${i.id}(${i.rarity})${i.source ? '[source]' : ''}`));
for (const item of items) {
  const cur = item.rarity === 'common' || item.rarity === 'rare' ? 'stardust' : 'crystals';
  const r = buyCosmetic(p, item.id, cur);
  console.log(`buyCosmetic(${item.id}, ${cur}):`, JSON.stringify(r));
}
