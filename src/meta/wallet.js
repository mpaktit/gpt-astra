import { LEDGER_CAP } from './profile.js';

export function canAfford(p, price) {
  return Object.entries(price).every(([cur, amt]) => (p.wallet[cur] ?? 0) >= amt);
}

/** Atomic spend: all or nothing. Returns false and changes nothing if unaffordable or invalid. */
export function spend(p, price, reason, now = Date.now()) {
  const entries = Object.entries(price || {});
  if (!entries.length || entries.some(([c, a]) => !(c in p.wallet) || !Number.isInteger(a) || a < 0)) return false;
  if (!canAfford(p, price)) return false;
  for (const [cur, amt] of entries) {
    p.wallet[cur] -= amt;
    log(p, { t: now, cur, amt: -amt, reason });
  }
  return true;
}

export function grant(p, bundle, reason, now = Date.now()) {
  for (const cur of ['stardust', 'crystals', 'shards']) {
    const amt = Math.floor(bundle?.[cur] || 0);
    if (amt > 0) {
      p.wallet[cur] = Math.min(1e8, p.wallet[cur] + amt);
      log(p, { t: now, cur, amt, reason });
    }
  }
}

function log(p, entry) {
  p.ledger.push(entry);
  if (p.ledger.length > LEDGER_CAP) p.ledger.splice(0, p.ledger.length - LEDGER_CAP);
}
