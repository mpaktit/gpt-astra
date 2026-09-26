import { html } from '../dom.js';
import { icon } from '../icons.js';
import { app, commit, applySettings, toast, fail, save } from '../app.js';
import { createProfile } from '../../meta/profile.js';
import { ensureMissions } from '../../meta/missions.js';
import { checkLogin } from '../../meta/login.js';

const VERSION = '0.1.0';

export const settings = {
  id: 'settings', title: 'Settings',
  render(app) {
    const s = app.profile.settings;
    const toggle = (key, label, hint) => html`<label class="set-row"><span><b>${label}</b><small>${hint}</small></span><input type="checkbox" class="switch" data-set="${key}" ${s[key] ? 'checked' : ''}></label>`;
    return html`
    <section class="settings-page">
      <header class="page-head"><h1 class="h-display">Settings</h1></header>
      <div class="settings-grid">
        <section class="set-sec">
          <h2 class="h-sub">Sound</h2>
          <label class="set-row"><span><b>Effects</b></span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-set="sfx"></label>
          <label class="set-row"><span><b>Music</b><small>Generated live for each sector.</small></span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music"></label>
          ${toggle('haptics', 'Haptics', 'Vibration on phones that support it.')}
        </section>
        <section class="set-sec">
          <h2 class="h-sub">Play</h2>
          <label class="set-row"><span><b>Touch controls</b><small>Swipe anywhere, or show a D-pad.</small></span>
            <select data-set="controls">${[['auto', 'Automatic'], ['swipe', 'Swipe only'], ['dpad', 'Always show D-pad']].map(([v, l]) => html`<option value="${v}" ${s.controls === v ? 'selected' : ''}>${l}</option>`)}</select></label>
          ${toggle('showGrid', 'Grid dots', 'Helps judge distance.')}
          ${toggle('reducedMotion', 'Reduced motion', 'No screen shake, fewer particles, calmer menus.')}
          ${toggle('colorblind', 'Hazard patterns', 'Adds shapes to warnings so they never rely on color alone.')}
        </section>
        <section class="set-sec">
          <h2 class="h-sub">Your data</h2>
          <p class="muted small">Everything is saved on this device. Nothing is sent anywhere. Move your progress with a save code.</p>
          <div class="row"><button class="btn quiet" data-action="export">${icon('copy', 16)} Copy save code</button></div>
          <label class="stack"><span class="label">Import a save code</span><textarea id="imp" rows="3" spellcheck="false" placeholder="Paste code here"></textarea></label>
          <div class="row"><button class="btn quiet" data-action="import">Import</button></div>
          <label class="stack danger"><span class="label">Reset all progress</span><input id="wipe" placeholder="Type RESET to confirm" autocomplete="off"></label>
          <div class="row"><button class="btn danger" data-action="wipe">Reset progress</button></div>
        </section>
        <section class="set-sec">
          <h2 class="h-sub">About</h2>
          <p class="muted small">ASTRA ${VERSION}. Keyboard: arrows or WASD to steer, E or Shift for ability, Space to pause, R to restart, M to mute.</p>
        </section>
      </div>
    </section>`;
  },
  mount(root) {
    root.querySelectorAll('[data-set]').forEach((el) => {
      const handler = () => {
        const k = el.dataset.set;
        const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
        commit((p) => { p.settings[k] = v; }, { rerender: false });
        applySettings();
        if (k === 'sfx') app.audio.play('click');
      };
      el.addEventListener(el.type === 'range' ? 'input' : 'change', handler);
    });
  },
  actions: {
    export: async () => {
      const code = app.store.exportText(app.profile);
      try { await navigator.clipboard.writeText(code); toast({ title: 'Save code copied', body: 'Paste it on another device.', icon: 'copy' }); }
      catch { const t = document.getElementById('imp'); t.value = code; t.select(); toast({ title: 'Copy the code from the box', icon: 'copy' }); }
    },
    import: () => {
      const text = document.getElementById('imp').value;
      const res = app.store.importText(text);
      if (!res.ok) return fail(res.error);
      app.profile = res.profile;
      ensureMissions(app.profile); checkLogin(app.profile);
      save(true);
      applySettings();
      commit(null);
      toast({ title: 'Save imported', body: res.tampered ? 'This save looks edited. Leaderboards disabled.' : 'Welcome back, pilot.', tone: res.tampered ? 'warn' : 'gold' });
    },
    wipe: () => {
      if (document.getElementById('wipe').value.trim() !== 'RESET') return fail('Type RESET to confirm.');
      const keep = app.profile.settings;
      app.profile = createProfile(Date.now());
      app.profile.settings = keep;
      ensureMissions(app.profile); checkLogin(app.profile);
      app.sel = null;
      save(true);
      commit(null);
      toast({ title: 'Fresh start', body: 'All progress cleared.', icon: 'refresh' });
    },
  },
};
