import { html, fmt, $, mount } from '../dom.js';
import { icon, CUR_ICON } from '../icons.js';
import { bar, reward, stars, kbd, rarityChip } from '../components.js';
import { app, commit, reveal, toast, fail } from '../app.js';
import { WORLDS, worldById } from '../../data/worlds.js';
import { MODES, MODIFIERS, dailyConfig } from '../../data/modes.js';
import { divisionByElo } from '../../data/ranks.js';
import { speciesById } from '../../data/species.js';
import { LOGIN_REWARDS, PASS_XP_PER_TIER, PASS_TIERS, DAILY_RIFT_REWARD } from '../../data/economy.js';
import { missionText } from '../../meta/missions.js';
import { claimLogin } from '../../meta/login.js';
import { passTier, unlockedWorlds } from '../../meta/progression.js';
import { claimableTiers } from '../../meta/pass.js';
import { dateKey, msToMidnight, fmtCountdown } from '../../meta/time.js';
import { currentSelection, launch, buildRun } from '../run.js';
import { createGame, tick, queueTurn, hazardAt, interval } from '../../core/engine.js';
import { chooseDir } from '../../core/ai.js';
import { createRng } from '../../core/rng.js';
import { createRenderer } from '../../render/renderer.js';

const NODES = { nebula: [70, 300], asteroids: [185, 196], ion: [310, 262], horizon: [318, 104], forge: [455, 188], rift: [548, 78] };
const HAZARD_LABEL = { rocks: 'Drifting rocks', storms: 'Lightning', portals: 'Wormholes', singularity: 'Black hole', lava: 'Lava vents', rival: 'Rival serpent', pillars: 'Pillars' };

let preview = null;

function chart(p, sel, unlocked) {
  const path = WORLDS.map((w) => NODES[w.id].join(',')).join(' ');
  return html`
  <svg class="chart-svg" viewBox="0 0 620 380" role="list" aria-label="Sector chart">
    <defs><pattern id="chart-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" class="chart-dot"/></pattern></defs>
    <rect x="0" y="0" width="620" height="380" fill="url(#chart-dots)"/>
    <circle cx="470" cy="300" r="90" class="chart-orbit"/><circle cx="140" cy="90" r="60" class="chart-orbit"/>
    <polyline points="${path}" class="chart-path"/>
    ${WORLDS.map((w) => {
      const [x, y] = NODES[w.id];
      const open = unlocked.includes(w.id);
      const on = sel.worldId === w.id && sel.modeId !== 'daily';
      const r = 18 + w.order * 2;
      return html`<g class="node ${open ? 'open' : 'locked'} ${on ? 'on' : ''}" role="listitem" tabindex="${open ? 0 : -1}" data-action="${open ? 'pick-world' : 'locked-world'}" data-id="${w.id}" aria-label="${w.name}${open ? '' : `, unlocks at level ${w.unlockLevel}`}" transform="translate(${x} ${y})">
        <circle r="${r + 10}" class="node-halo"/>
        <circle r="${r}" class="node-body" style="--h:${w.theme.blob[2]}"/>
        ${open ? html`<text class="node-num" y="5">${w.order}</text>` : html`<g transform="translate(-9 -10) scale(.75)" class="node-lock"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g>`}
        <text class="node-label" y="${r + 22}">${w.name}</text>
        <text class="node-sub" y="${r + 38}">${open ? '★'.repeat(p.stars[w.id] || 0) + '☆'.repeat(3 - (p.stars[w.id] || 0)) : `Level ${w.unlockLevel}`}</text>
      </g>`;
    })}
  </svg>`;
}

export const home = {
  id: 'home', title: 'Play',
  render(app) {
    const p = app.profile;
    const sel = currentSelection();
    const unlocked = unlockedWorlds(p);
    const daily = dailyConfig(dateKey());
    const isDaily = sel.modeId === 'daily';
    const w = worldById(isDaily ? daily.worldId : sel.worldId);
    const mode = MODES[sel.modeId];
    const sp = speciesById(p.equipped.species);
    const best = p.best[`${mode.id}:${w.id}`] || 0;
    const tier = passTier(p);
    const claimTiers = claimableTiers(p).length;
    const dailyDone = p.daily.last === dateKey();
    const firstTime = p.stats.runs === 0;
    const loginIdx = p.login.streak % LOGIN_REWARDS.length;
    // Today's rift can land on a sector this pilot has not reached yet. It is a
    // preview run, not a bypass, so say so instead of failing silently at launch.
    const dailyLocked = isDaily && !unlocked.includes(w.id);

    return html`
    <section class="home">
      ${firstTime ? html`<div class="welcome">
        <p class="eyebrow">Welcome, pilot</p>
        <p class="welcome-line">Steer with <b>arrows</b>, <b>WASD</b> or <b>swipe</b>. Eat stardust, grow, don't bite yourself. Hit ${kbd('E')} to fire your species' ability.</p>
      </div>` : ''}

      <div class="home-main">
        <div class="chart">
          <div class="chart-head">
            <h1 class="h-display">Sector chart</h1>
            <p class="muted">${unlocked.length} of ${WORLDS.length} sectors open. Level up to reach deeper space.</p>
          </div>
          ${chart(p, sel, unlocked)}
        </div>

        <div class="launch">
          <div class="modes" role="radiogroup" aria-label="Mode">
            ${Object.values(MODES).map((m) => html`<button role="radio" aria-checked="${sel.modeId === m.id ? 'true' : 'false'}" data-action="pick-mode" data-id="${m.id}">${m.name}${m.id === 'daily' && !dailyDone ? html`<i class="dot-new" aria-label="reward available"></i>` : ''}</button>`)}
          </div>

          <div class="preview-wrap"><canvas id="preview" aria-hidden="true"></canvas>
            <span class="preview-tag">${w.mechanic}</span>
          </div>

          <div class="launch-info">
            <p class="eyebrow">Sector ${w.order} · ${mode.name}${isDaily ? ` · ${MODIFIERS[daily.modifier].name}` : ''}</p>
            <h2 class="h-world">${w.name}</h2>
            ${dailyLocked ? html`<p class="daily-preview">${icon('lock', 14)} Sector preview &mdash; unlocks at level ${w.unlockLevel}. This rift still counts.</p>` : ''}
            <p class="muted blurb">${isDaily ? MODIFIERS[daily.modifier].desc + ' Same seed for every pilot today.' : mode.id === 'blitz' ? mode.desc : mode.id === 'ranked' ? mode.desc + ` Current rating: ${p.rank?.elo || 1000} (${divisionByElo(p.rank?.elo || 1000).name}). Streak: ${p.rank?.streak || 0}.` : w.blurb}</p>
            <div class="chips">
              ${w.hazards.length ? w.hazards.map((h) => html`<span class="chip-s">${HAZARD_LABEL[h]}</span>`) : html`<span class="chip-s">No hazards</span>`}
              <span class="chip-s">${w.wrap ? 'Edges loop' : 'Solid edges'}</span>
              <span class="chip-s">Score ×${w.scoreMult}</span>
            </div>
            ${mode.id === 'voyage' ? html`<ol class="goals">
              ${w.stars.map((g, i) => html`<li class="${(p.stars[w.id] || 0) > i ? 'done' : ''}">${stars(i + 1, i + 1, 14)}<b>${fmt(g)}</b></li>`)}
            </ol>` : isDaily ? html`<p class="daily-reward">${dailyDone ? html`${icon('check', 16)} Today's reward claimed. Play for glory.` : html`Score 200+ to earn ${reward(DAILY_RIFT_REWARD)}`}</p>` : ''}
          </div>

          <a class="species-row" href="#/hangar">
            <span class="species-glyph" style="--h:${sp.palette.head[2]}">${sp.name[0]}</span>
            <span><b>${sp.name}</b> ${rarityChip(sp.rarity)}<small>${sp.ability.name}: ${sp.ability.desc}</small></span>
            ${icon('chevron', 18)}
          </a>
          ${mode.id === 'ranked' ? html`<div class="rank-preview">${icon('trophy', 16)}<span class="rank-badge" style="--rank-color:${divisionByElo(p.rank?.elo || 1000).color}">${divisionByElo(p.rank?.elo || 1000).icon}</span><b>${p.rank?.elo || 1000}</b> <span class="muted">(${divisionByElo(p.rank?.elo || 1000).name}) · ${p.rank?.matches || 0} matches</span></div>` : ''}

          <button class="btn primary launch-btn" data-action="launch">${firstTime ? 'Launch mission' : 'Quick play'} ${kbd('Space')}</button>
          <p class="best-line">${best ? html`Best here: <b>${fmt(best)}</b>` : 'No runs here yet. Make history.'}</p>
        </div>
      </div>

      <div class="today">
        <section class="today-col">
          <header><h3>Daily missions</h3><span class="muted small">${icon('clock', 14)} ${fmtCountdown(msToMidnight())}</span></header>
          <ul class="mini-missions">
            ${p.missions.daily.map((m) => html`<li class="${m.claimed ? 'claimed' : m.progress >= m.target ? 'ready' : ''}">
              <span>${missionText(m)}</span>${bar(m.progress / m.target, m.progress >= m.target ? 'good' : '')}
            </li>`)}
          </ul>
          <a class="link" href="#/missions">All missions ${icon('chevron', 14)}</a>
        </section>
        <section class="today-col">
          <header><h3>Flight log</h3><span class="muted small">Day ${loginIdx + 1} of 7</span></header>
          <ol class="streak">${LOGIN_REWARDS.map((_, i) => html`<li class="${i < loginIdx ? 'got' : ''} ${i === loginIdx ? (p.login.pending ? 'now' : 'next') : ''}">${i + 1}</li>`)}</ol>
          ${p.login.pending
            ? html`<button class="btn gold" data-action="claim-login">${icon('gift', 18)} Claim day ${loginIdx + 1} ${reward(LOGIN_REWARDS[loginIdx])}</button>`
            : html`<p class="muted small">Next: ${reward(LOGIN_REWARDS[loginIdx])} tomorrow. Missing a day never resets you.</p>`}
        </section>
        <section class="today-col">
          <header><h3>Season 1 · First Light</h3><span class="muted small">Tier ${tier}/${PASS_TIERS}</span></header>
          ${bar(tier >= PASS_TIERS ? 1 : (p.pass.xp % PASS_XP_PER_TIER) / PASS_XP_PER_TIER, 'violet')}
          <p class="muted small">${tier >= PASS_TIERS ? 'Season complete. Legend.' : `${fmt(PASS_XP_PER_TIER - (p.pass.xp % PASS_XP_PER_TIER))} XP to tier ${tier + 1}`}</p>
          <a class="link" href="#/pass">${claimTiers ? html`<b>${claimTiers} reward${claimTiers > 1 ? 's' : ''} to claim</b>` : 'View pass'} ${icon('chevron', 14)}</a>
        </section>
      </div>
    </section>`;
  },

  mount(root, app) {
    const canvas = $('#preview', root);
    const sel = currentSelection();
    const run = buildRun(sel);
    const p = app.profile;
    const r = createRenderer(canvas);
    const s = createGame({ worldId: run.worldId, modeId: 'voyage', speciesId: p.equipped.species, seed: 7 });
    r.configure({ world: s.world, species: s.species, skinId: p.equipped.skin, trailId: p.equipped.trail, finaleId: 'pop', settings: p.settings });
    const brain = createRng(3);
    const fit = () => {
      const wrap = canvas.parentElement;
      const px = Math.max(160, Math.floor(Math.min(wrap.clientWidth, 340) / s.world.size) * s.world.size);
      r.resize(px);
      if (p.settings.reducedMotion) r.draw(s, 1, performance.now(), 16);
    };
    fit();
    let acc = 0, last = performance.now(), raf = 0, game = s;
    const reset = () => {
      game = createGame({ worldId: run.worldId, modeId: 'voyage', speciesId: p.equipped.species, seed: Math.floor(brain.next() * 1e9) });
    };
    const loop = (now) => {
      const dt = Math.min(50, now - last); last = now;
      acc += dt;
      const iv = interval(game);
      if (acc >= iv) {
        acc -= iv; if (acc > iv) acc = 0;
        if (game.over) reset();
        else {
          const blocked = (x, y) => !!hazardAt(game, x, y) || game.snake.slice(0, -1).some((q) => q.x === x && q.y === y);
          const d = chooseDir({ w: game.w, h: game.h, wrap: game.wrap, head: game.snake[0], dir: game.dir, targets: game.items, blocked, rng: brain, lookahead: 30 });
          if (d) queueTurn(game, d.y === -1 ? 0 : d.y === 1 ? 1 : d.x === -1 ? 2 : 3);
          const ev = tick(game);
          r.onEvents(ev.filter((e) => e.type !== 'death'), game);
          r.onStep(game);
          if (game.over) setTimeout(reset, 600);
        }
      }
      r.draw(game, Math.min(1, acc / interval(game)), now, dt);
      raf = requestAnimationFrame(loop);
    };
    if (!p.settings.reducedMotion) raf = requestAnimationFrame(loop);
    else r.draw(game, 1, performance.now(), 16);
    const ro = new ResizeObserver(fit); ro.observe(canvas.parentElement);
    const onKey = (e) => {
      if (e.target.closest('input,textarea,select')) return;
      if (e.key === ' ' || e.key === 'Enter') { if (e.target.closest('button,a,[tabindex]') && e.key === 'Enter') return; e.preventDefault(); launch(buildRun()); }
    };
    document.addEventListener('keydown', onKey);
    root.querySelectorAll('.node.open').forEach((n) => n.addEventListener('keydown', (e) => { if (e.key === 'Enter') n.dispatchEvent(new MouseEvent('click', { bubbles: true })); }));
    preview = () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('keydown', onKey); };
  },
  unmount() { preview?.(); preview = null; },

  actions: {
    'pick-world': (d) => { app.sel.worldId = d.id; if (app.sel.modeId === 'daily') app.sel.modeId = 'voyage'; app.audio.play('click'); commit(null); },
    'locked-world': (d) => fail(`${worldById(d.id).name} unlocks at pilot level ${worldById(d.id).unlockLevel}.`),
    'pick-mode': (d) => { app.sel.modeId = d.id; app.audio.play('click'); commit(null); },
    launch: () => launch(buildRun()),
    'claim-login': () => {
      const res = commit((p) => claimLogin(p));
      if (!res?.ok) return;
      app.audio.play('buy');
      const cache = res.results.find((x) => x.kind === 'cache');
      if (cache?.ok) reveal({ item: cache.item, rarity: cache.rarity, dup: cache.dup, shards: cache.shards, title: `Day ${res.day} reward` });
      else toast({ title: `Day ${res.day} claimed`, body: 'See you tomorrow, pilot.', tone: 'gold', icon: 'gift' });
    },
  },
};
