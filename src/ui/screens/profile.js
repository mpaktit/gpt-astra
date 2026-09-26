import { html, fmt, fmtTime } from '../dom.js';
import { icon } from '../icons.js';
import { bar, stars } from '../components.js';
import { app, commit, toast } from '../app.js';
import { WORLDS } from '../../data/worlds.js';
import { MODES } from '../../data/modes.js';
import { SPECIES, speciesById, masteryLevel, MASTERY_XP } from '../../data/species.js';
import { TITLES, cosmeticById } from '../../data/cosmetics.js';
import { xpToNext, cleanName } from '../../meta/profile.js';
import { owns } from '../../meta/store.js';

const ui = { board: 'voyage:nebula' };

export const profile = {
  id: 'profile', title: 'Profile',
  render(app) {
    const p = app.profile;
    const title = cosmeticById(p.equipped.title);
    const lb = p.leaderboard[ui.board] || [];
    const st = p.stats;
    const topDeath = Object.entries(st.deaths).sort((a, b) => b[1] - a[1])[0];
    return html`
    <section class="profile-page">
      <header class="pilot-card">
        <span class="lvl big" style="--p:${(p.xp / xpToNext(p.level)).toFixed(3)}"><b>${p.level}</b></span>
        <div class="pilot-id">
          <label class="name-edit"><span class="sr">Pilot name</span><input id="pname" value="${p.name}" maxlength="16" autocomplete="off" spellcheck="false" data-change="rename"></label>
          <p class="title-line">${title?.name || 'Hatchling'}</p>
          <p class="muted small">${fmt(p.xp)} / ${fmt(xpToNext(p.level))} XP to level ${p.level + 1}</p>
        </div>
        <label class="title-pick"><span class="label">Title</span>
          <select data-change="title">${TITLES.filter((t) => owns(p, t.id)).map((t) => html`<option value="${t.id}" ${p.equipped.title === t.id ? 'selected' : ''}>${t.name}</option>`)}</select>
        </label>
      </header>

      <div class="profile-grid">
        <section>
          <h2 class="h-sub">Career</h2>
          <dl class="career">
            <div><dt>Runs</dt><dd>${fmt(st.runs)}</dd></div>
            <div><dt>Flight time</dt><dd>${fmtTime(st.playMs)}</dd></div>
            <div><dt>Best score</dt><dd>${fmt(st.bestScore)}</dd></div>
            <div><dt>Best combo</dt><dd>×${st.bestCombo}</dd></div>
            <div><dt>Longest</dt><dd>${st.bestLength}</dd></div>
            <div><dt>Orbs eaten</dt><dd>${fmt(st.orbs)}</dd></div>
            <div><dt>Comets</dt><dd>${fmt(st.comets)}</dd></div>
            <div><dt>Crystals found</dt><dd>${fmt(st.crystalsFound)}</dd></div>
            <div><dt>Rivals beaten</dt><dd>${fmt(st.rivals)}</dd></div>
            <div><dt>Nemesis</dt><dd>${topDeath ? topDeath[0] : 'None yet'}</dd></div>
          </dl>

          <h2 class="h-sub">Sectors</h2>
          <table class="sectors">
            <thead><tr><th>Sector</th><th>Stars</th><th>Voyage</th><th>Blitz</th></tr></thead>
            <tbody>${WORLDS.map((w) => html`<tr class="${p.level >= w.unlockLevel ? '' : 'locked'}"><td>${w.name}</td><td>${stars(p.stars[w.id] || 0, 3, 14)}</td><td>${fmt(p.best['voyage:' + w.id] || 0)}</td><td>${fmt(p.best['blitz:' + w.id] || 0)}</td></tr>`)}</tbody>
          </table>
        </section>

        <section>
          <h2 class="h-sub">Species mastery</h2>
          <ul class="mastery-list">${SPECIES.filter((s) => p.owned.species.includes(s.id)).map((s) => {
            const xp = p.mastery[s.id] || 0, lv = masteryLevel(xp), next = MASTERY_XP[lv];
            return html`<li><span class="species-glyph sm" style="--h:${s.palette.head[2]}">${s.name[0]}</span><div><div class="row-b"><b>${s.name}</b><small>Lv ${lv}</small></div>${bar(next ? (xp - MASTERY_XP[lv - 1]) / (next - MASTERY_XP[lv - 1]) : 1, 'violet')}</div></li>`;
          })}</ul>

          <div class="sec-head"><h2 class="h-sub">Personal leaderboard</h2>
            <select data-change="board" aria-label="Leaderboard">${WORLDS.flatMap((w) => ['voyage', 'blitz'].map((m) => html`<option value="${m}:${w.id}" ${ui.board === `${m}:${w.id}` ? 'selected' : ''}>${w.name} · ${MODES[m].name}</option>`))}</select>
          </div>
          ${lb.length ? html`<ol class="lb">${lb.map((e, i) => html`<li><span class="lb-rank">${i + 1}</span><b>${fmt(e.score)}</b><small class="muted">${speciesById(e.species).name} · ${new Date(e.at).toLocaleDateString()}</small></li>`)}</ol>`
            : html`<p class="muted">No runs here yet. Global leaderboards arrive with the server launch.</p>`}
        </section>
      </div>
    </section>`;
  },
  mount(root, app) {
    root.querySelectorAll('[data-change]').forEach((el) => {
      const ev = el.tagName === 'INPUT' ? 'change' : 'change';
      el.addEventListener(ev, () => {
        const k = el.dataset.change;
        if (k === 'rename') { const name = cleanName(el.value); commit((p) => { p.name = name; }, { rerender: false }); el.value = name; toast({ title: 'Name saved', ms: 1400, icon: 'check' }); }
        if (k === 'title') commit((p) => { if (owns(p, el.value)) p.equipped.title = el.value; });
        if (k === 'board') { ui.board = el.value; commit(null); }
      });
      if (el.tagName === 'INPUT') el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); });
    });
  },
};
