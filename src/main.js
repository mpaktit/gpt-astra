import { boot, registerScreen } from './ui/app.js';
import { home } from './ui/screens/home.js';
import { play } from './ui/screens/play.js';
import { results } from './ui/screens/results.js';
import { hangar } from './ui/screens/hangar.js';
import { shop } from './ui/screens/shop.js';
import { pass } from './ui/screens/pass.js';
import { missions } from './ui/screens/missions.js';
import { profile } from './ui/screens/profile.js';
import { settings } from './ui/screens/settings.js';

[home, play, results, hangar, shop, pass, missions, profile, settings].forEach(registerScreen);

try {
  boot(document.getElementById('app'));
} catch (err) {
  console.error(err);
  const view = document.getElementById('view');
  view.innerHTML = '<div class="crash"><h1>Something broke on launch.</h1><p>Your save is safe. Reload to try again.</p><button class="btn primary" id="crash-reload">Reload</button></div>';
  document.getElementById('crash-reload').addEventListener('click', () => location.reload());
}

// Only on https (GitHub Pages etc.). Skipped on localhost so dev reloads always show fresh code.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
