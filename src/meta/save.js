// Persistence with a signature and a rolling backup. A client-side signature cannot stop a
// determined cheater; it catches corruption and casual editing. Real protection = server wallet.
import { sanitizeProfile, createProfile } from './profile.js';

const KEY = 'astra.save.v2';
const BACKUP = 'astra.save.v2.bak';
const SALT = 'astra/first-light/2026';

export function signature(json) {
  // FNV-1a over salt + payload, two lanes for a 64-bit-ish digest
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x9e3779b9;
  const s = SALT + json;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519) ^ (h2 >>> 13);
  }
  return (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36);
}

export function encode(profile) {
  const data = JSON.stringify(profile);
  return JSON.stringify({ data, sig: signature(data) });
}

/** Returns { profile, status } where status is 'ok' | 'new' | 'restored' | 'tampered'. */
export function decode(text, now = Date.now()) {
  if (!text) return { profile: null, status: 'missing' };
  try {
    const wrap = JSON.parse(text);
    if (typeof wrap?.data !== 'string') return { profile: null, status: 'corrupt' };
    const ok = signature(wrap.data) === wrap.sig;
    const profile = sanitizeProfile(JSON.parse(wrap.data), now);
    return { profile, status: ok ? 'ok' : 'tampered' };
  } catch {
    return { profile: null, status: 'corrupt' };
  }
}

export function createStore(storage) {
  const mem = new Map();
  const get = (k) => { try { return storage ? storage.getItem(k) : mem.get(k); } catch { return mem.get(k); } };
  const set = (k, v) => { mem.set(k, v); try { storage && storage.setItem(k, v); } catch { /* quota or private mode */ } };
  return {
    load(now = Date.now()) {
      const main = decode(get(KEY), now);
      if (main.status === 'ok') return { profile: main.profile, status: 'ok' };
      const bak = decode(get(BACKUP), now);
      if (bak.status === 'ok') return { profile: bak.profile, status: 'restored' };
      if (main.profile) {
        main.profile.flags.tampered = true;
        return { profile: main.profile, status: 'tampered' };
      }
      return { profile: createProfile(now), status: 'new' };
    },
    save(profile) {
      const prev = get(KEY);
      if (prev && decode(prev).status === 'ok') set(BACKUP, prev);
      set(KEY, encode(profile));
    },
    exportText(profile) { return btoaSafe(encode(profile)); },
    importText(text, now = Date.now()) {
      const raw = atobSafe(String(text || '').trim());
      const res = decode(raw, now);
      if (!res.profile) return { ok: false, error: 'That code is not an Astra save.' };
      if (res.status === 'tampered') res.profile.flags.tampered = true;
      return { ok: true, profile: res.profile, tampered: res.status === 'tampered' };
    },
    wipe() { set(KEY, ''); set(BACKUP, ''); },
  };
}

function btoaSafe(s) {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)));
  return Buffer.from(s, 'utf8').toString('base64');
}
function atobSafe(s) {
  try {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(s)));
    return Buffer.from(s, 'base64').toString('utf8');
  } catch { return ''; }
}
