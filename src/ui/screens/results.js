import { html, fmt, fmtTime, $, countUp } from '../dom.js';
import { icon, CUR_ICON } from '../icons.js';
import { bar, stars, kbd, reward } from '../components.js';
import { app, go } from '../app.js';
import { worldById, WORLDS } from '../../data/worlds.js';
import { MODES } from '../../data/modes.js';
import { speciesById, masteryLevel } from '../../data/species.js';
import { cosmeticById } from '../../data/cosmetics.js';
import { divisionByElo } from '../../data/ranks.js';
import { xpToNext } from '../../meta/profile.js';
import { PASS_XP_PER_TIER } from '../../data/economy.js';
import { launch, freshSeed } from '../run.js';

const LINES = {
  self: ['Tail for dinner.', 'Ouroboros achieved.', 'You bit yourself.', 'Snack of regret.'],
  edge: ['Face, meet wall.', 'The edge was there.', 'Bonk.'],
  wall: ['Pillar: 1. You: 0.', 'Solid, as advertised.'],
  asteroid: ['Rock beats serpent.', 'Asteroid says hi.', 'Should have dodged.'],
  storm: ['Fried.', 'Lightning never misses twice. Once was enough.'],
  lava: ['Well done. Literally.', 'The vent breathed first.'],
  singularity: ['Spaghettified.', 'Event horizon: crossed.'],
  rival: ['Out-hunted.', 'The rival sends regards.'],
  time: ['Time.', 'Buzzer.', 'Clock wins.'],
  win: ['Board filled. Unreal.'],
};

let off = null;

export const results = {
  id: 'results', title: 'Results',
  render(app) {
    const R = app.lastResult;
    if (!R) return html`<section class="play-empty"><p>No run to show yet.</p><a class="btn primary" href="#/home">Fly one</a></section>`;
    const { summary: s, result: r, before } = R;
    const w = worldById(s.worldId), mode = MODES[s.modeId], sp = speciesById(s.speciesId);
    const lines = LINES[s.cause] || LINES.self;
    const line = lines[(s.seed + s.steps) % lines.length];
    const p = app.profile;
    const starCount = mode.id === 'voyage' ? (p.stars[w.id] || 0) : 0;
    const lvlFrac = p.xp / xpToNext(p.level);
    const mLvl = masteryLevel(p.mastery[sp.id] || 0);
    const nextWorld = r.worldsUnlocked.map((id) => worldById(id));

    return html`
    <section class="results">
      <div class="res-main">
        <p class="eyebrow">${w.name} · ${mode.name}${r.isBest ? html` <span class="pill-best">New best</span>` : ''}</p>
        <h1 class="res-line">${line}</h1>
        <div class="res-score"><b id="res-score">0</b><span class="muted">${r.prevBest && !r.isBest ? `Best ${fmt(r.prevBest)}` : ''}</span></div>
         ${mode.id === 'voyage' ? html`<div class="res-stars">${stars(starCount, 3, 34)}${r.newStars ? html`<span class="pill-new">+${r.newStars} star${r.newStars > 1 ? 's' : ''}</span>` : ''}</div>` : mode.id === 'ranked' ? html`<div class="res-rank"><span class="rank-badge" style="--rank-color:${divisionByElo(p.rank?.elo || 1000).color}">${divisionByElo(p.rank?.elo || 1000).icon}</span><b id="res-rank" class="${r.rankChange > 0 ? 'ranked-up' : r.rankChange < 0 ? 'ranked-down' : 'ranked-neutral'}">${r.rankChange > 0 ? '+' : ''}${r.rankChange}</b> <span class="muted">(${divisionByElo(p.rank?.elo || 1000).name} · ${p.rank?.streak ? `${p.rank.streak > 0 ? icon('fire', 14) : icon('snowflake', 14)} ${Math.abs(p.rank.streak)} streak` : 'no streak'})</span>${r.newDivision ? html`<span class="pill-new">Promoted to ${divisionByElo(p.rank?.elo || 1000).name}!</span>` : ''}</div>` : ''}
        <dl class="res-stats">
          <div><dt>Length</dt><dd>${s.maxLen}</dd></div>
          <div><dt>Time</dt><dd>${fmtTime(s.duration)}</dd></div>
          <div><dt>Top combo</dt><dd>×${s.maxCombo}</dd></div>
          <div><dt>Stardust orbs</dt><dd>${s.orbs}</dd></div>
          ${s.comets ? html`<div><dt>Comets</dt><dd>${s.comets}</dd></div>` : ''}
          ${s.rivals ? html`<div><dt>Rivals</dt><dd>${s.rivals}</dd></div>` : ''}
        </dl>
        <div class="row res-actions">
          <button class="btn primary" data-action="again">Fly again ${kbd('Space')}</button>
          <a class="btn quiet" href="#/hangar">Hangar</a>
          <a class="btn quiet" href="#/home">Chart</a>
        </div>
      </div>

      <div class="res-side">
        <h2 class="h-sub">Rewards</h2>
        <ul class="res-rewards">
          <li><span class="rr-ic">${CUR_ICON.stardust(22)}</span><span>Stardust</span><b>+<span id="rr-sd">0</span></b></li>
          ${r.crystals ? html`<li class="rare"><span class="rr-ic">${CUR_ICON.crystals(22)}</span><span>Void Crystals <small>found mid-flight</small></span><b>+${r.crystals}</b></li>` : ''}
          ${r.dailyReward ? html`<li class="rare"><span class="rr-ic">${icon('gift', 22)}</span><span>Daily Rift clear</span><b>${reward(r.dailyReward)}</b></li>` : ''}
        </ul>

        <div class="res-bars">
          <div>
            <div class="row-b"><span>Pilot level <b>${p.level}</b></span><small class="muted">+${fmt(r.xp)} XP</small></div>
            ${bar(lvlFrac, 'indigo')}
            ${r.levelUps ? html`<p class="lvl-up">${icon('sparkle', 16)} Level up! You're now level ${p.level}.</p>` : ''}
          </div>
          <div>
            <div class="row-b"><span>Season pass</span><small class="muted">+${fmt(r.passXp)} XP</small></div>
            ${bar((p.pass.xp % PASS_XP_PER_TIER) / PASS_XP_PER_TIER, 'violet')}
            ${r.passTierUps ? html`<p class="lvl-up">${icon('pass', 16)} ${r.passTierUps} new tier${r.passTierUps > 1 ? 's' : ''}. <a href="#/pass">Claim</a></p>` : ''}
          </div>
          <div>
            <div class="row-b"><span>${sp.name} mastery <b>${mLvl}</b></span></div>
            ${r.masteryUp ? html`<p class="lvl-up">${icon('star', 16)} Mastery ${r.masteryUp.level}!</p>` : ''}
          </div>
        </div>

        ${nextWorld.length ? html`<div class="res-unlock">${icon('sparkle', 18)}<span>New sector unlocked: <b>${nextWorld.map((x) => x.name).join(', ')}</b></span></div>` : ''}
        ${r.unlocks.length ? html`<div class="res-unlock">${icon('gift', 18)}<span>Unlocked <b>${r.unlocks.map((id) => cosmeticById(id)?.name).join(', ')}</b></span></div>` : ''}
        ${r.missions.length ? html`<div class="res-list"><h3>Missions complete</h3><ul>${r.missions.map((m) => html`<li>${icon('check', 16)} ${m.text}</li>`)}</ul><a class="link" href="#/missions">Claim rewards ${icon('chevron', 14)}</a></div>` : ''}
        ${r.achievements.length ? html`<div class="res-list"><h3>Achievements</h3><ul>${r.achievements.map((a) => html`<li>${icon('trophy', 16)} ${a.name}</li>`)}</ul></div>` : ''}
      </div>
    </section>`;
  },
  mount(root, app) {
    const R = app.lastResult;
    if (!R) return;
    countUp($('#res-score', root), R.summary.score, 1000);
    countUp($('#rr-sd', root), R.result.stardust, 900);
    const rankEl = $('#res-rank', root);
    if (rankEl && R.result.rankChange) {
      countUp(rankEl, R.result.rankChange > 0 ? '+' + R.result.rankChange : R.result.rankChange, 600);
      if (R.result.rankChange > 0) app.audio.play('levelUp');
    }
    if (R.result.levelUps) setTimeout(() => app.audio.play('levelUp'), 500);
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') { if (e.target.closest('a,button') && e.code === 'Enter') return; e.preventDefault(); results.actions.again(); } };
    document.addEventListener('keydown', onKey);
    off = () => document.removeEventListener('keydown', onKey);
    setTimeout(() => root.querySelector('[data-action="again"]')?.focus({ preventScroll: true }), 60);
  },
  unmount() { off?.(); off = null; },
  actions: {
    again: () => {
      const run = app.lastResult?.run;
      if (!run) return go('home');
      launch({ ...run, seed: run.modeId === 'daily' ? run.seed : freshSeed(), speciesId: app.profile.equipped.species });
    },
  },
};
