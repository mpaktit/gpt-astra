// Offline-first service worker. Bump VERSION on every release so players get fresh code.
const VERSION = 'astra-v0.1.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './styles/main.css',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './src/main.js',
  './src/core/rng.js', './src/core/ai.js', './src/core/engine.js',
  './src/data/rarity.js', './src/data/species.js', './src/data/worlds.js', './src/data/modes.js', './src/data/cosmetics.js',
  './src/data/economy.js', './src/data/pass.js', './src/data/missions.js', './src/data/achievements.js', './src/data/ranks.js',
  './src/meta/time.js', './src/meta/profile.js', './src/meta/save.js', './src/meta/wallet.js', './src/meta/store.js',
  './src/meta/progression.js', './src/meta/missions.js', './src/meta/achievements.js', './src/meta/pass.js', './src/meta/login.js',
  './src/render/color.js', './src/render/fx.js', './src/render/renderer.js',
  './src/audio/audio.js', './src/services/payments.js',
  './src/ui/dom.js', './src/ui/icons.js', './src/ui/components.js', './src/ui/app.js', './src/ui/run.js',
  './src/ui/screens/home.js', './src/ui/screens/play.js', './src/ui/screens/results.js', './src/ui/screens/hangar.js',
  './src/ui/screens/shop.js', './src/ui/screens/pass.js', './src/ui/screens/missions.js', './src/ui/screens/profile.js', './src/ui/screens/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Network first for HTML (fresh deploys), cache first for everything else.
    if (req.mode === 'navigate') {
      e.respondWith(fetch(req).then((res) => { caches.open(VERSION).then((c) => c.put(req, res.clone())); return res; }).catch(() => caches.match('./index.html')));
      return;
    }
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone())); return res; })));
  } else if (url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { caches.open(VERSION).then((c) => c.put(req, res.clone())); return res; }).catch(() => hit)));
  }
});
