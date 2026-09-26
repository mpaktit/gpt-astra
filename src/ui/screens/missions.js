import { html, fmt } from '../dom.js';
import { icon } from '../icons.js';
import { bar, reward } from '../components.js';
import { app, commit, fail, toast, reveal } from '../app.js';
import { DAILY_REWARDS, WEEKLY_REWARDS } from '../../data/missions.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { LOGIN_REWARDS } from '../../data/economy.js';
import { missionText, claimMission, rerollMission } from '../../meta/missions.js';
import { claimAchievement } from '../../meta/achievements.js';
import { claimLogin } from '../../meta/login.js';
import { msToMidnight, fmtCountdown } from '../../meta/time.js';

const TIER = ['Easy', 'Medium', 'Hard'];

function missionRow(p, m, i, weekly) {
  const done = m.progress >= m.target;
  const rw = (weekly ? WEEKLY_REWARDS : DAILY_REWARDS)[m.tier];
  return html`<li class="mission ${m.claimed ? 'claimed' : done ? 'ready' : ''}">
    <span class="m-tier t${m.tier}">${TIER[m.tier]}</span>
    <div class="m-main">
      <b>${missionText(m)}</b>
      <div class="m-prog">${bar(m.progress / m.target, done ? 'good' : '')}<small>${fmt(Math.min(m.progress, m.target))}/${fmt(m.target)}</small></div>
      ${reward(rw)}
    </div>
    <div class="m-act">
      ${m.claimed ? html`<span class="muted small">${icon('check', 16)} Claimed</span>`
        : done ? html`<button class="btn primary sm" data-action="claim-m" data-i="${i}" data-w="${weekly ? 1 : 0}">Claim</button>`
        : !weekly && !p.missions.rerolled ? html`<button class="btn quiet sm" data-action="reroll" data-i="${i}" title="Swap this mission (once per day)">${icon('refresh', 16)} Swap</button>` : ''}
    </div>
  </li>`;
}

export const missions = {
  id: 'missions', title: 'Missions',
  render(app) {
    const p = app.profile;
    const idx = p.login.streak % LOGIN_REWARDS.length;
    const achs = [...ACHIEVEMENTS].sort((a, b) => {
      const sa = p.achievements[a.id], sb = p.achievements[b.id];
      const rank = (s) => (s?.done && !s.claimed ? 0 : !s?.done ? 1 : 2);
      return rank(sa) - rank(sb);
    });
    const doneCount = Object.values(p.achievements).filter((x) => x.done).length;
    return html`
    <section class="missions-page">
      <header class="page-head"><h1 class="h-display">Missions</h1><p class="muted">Missions pay Stardust and a lot of pass XP. Achievements pay Void Crystals.</p></header>
      <div class="missions-grid">
        <div>
          <section class="m-sec">
            <div class="sec-head"><h2 class="h-sub">Daily</h2><span class="muted small">${icon('clock', 14)} Resets in ${fmtCountdown(msToMidnight())}</span></div>
            <ul class="mission-list">${p.missions.daily.map((m, i) => missionRow(p, m, i, false))}</ul>
          </section>
          <section class="m-sec">
            <div class="sec-head"><h2 class="h-sub">Weekly</h2><span class="muted small">Resets Monday</span></div>
            <ul class="mission-list">${p.missions.weekly.map((m, i) => missionRow(p, m, i, true))}</ul>
          </section>
        </div>
        <div>
          <section class="m-sec">
            <div class="sec-head"><h2 class="h-sub">Flight log</h2><span class="muted small">Show up, get paid. Never resets.</span></div>
            <ol class="login-cal">${LOGIN_REWARDS.map((rw, i) => html`<li class="${i < idx ? 'got' : ''} ${i === idx ? (p.login.pending ? 'now' : 'next') : ''}">
              <span class="day">Day ${i + 1}</span>${reward(rw)}${i < idx ? html`<span class="got-ic">${icon('check', 14)}</span>` : ''}
            </li>`)}</ol>
            ${p.login.pending ? html`<button class="btn gold" data-action="claim-login">${icon('gift', 18)} Claim day ${idx + 1}</button>` : html`<p class="muted small">Come back tomorrow for day ${idx + 1}.</p>`}
          </section>
          <section class="m-sec">
            <div class="sec-head"><h2 class="h-sub">Achievements</h2><span class="muted small">${doneCount}/${ACHIEVEMENTS.length}</span></div>
            <ul class="ach-list">${achs.map((a) => {
              const st = p.achievements[a.id];
              return html`<li class="ach ${st?.claimed ? 'claimed' : st?.done ? 'ready' : 'todo'}">
                <span class="ach-ic">${icon(st?.done ? 'trophy' : 'lock', 18)}</span>
                <div><b>${a.name}</b><small>${a.desc}</small>${reward(a.reward)}</div>
                ${st?.done && !st.claimed ? html`<button class="btn primary sm" data-action="claim-a" data-id="${a.id}">Claim</button>` : st?.claimed ? html`<span class="muted small">${icon('check', 14)}</span>` : ''}
              </li>`;
            })}</ul>
          </section>
        </div>
      </div>
    </section>`;
  },
  actions: {
    'claim-m': (d) => {
      const res = commit((p) => claimMission(p, d.w === '1', Number(d.i)));
      if (!res.ok) return fail('Cannot claim that yet.');
      app.audio.play('buy');
      toast({ title: 'Mission reward claimed', tone: 'gold', icon: 'check', ms: 2200 });
    },
    reroll: (d) => {
      const res = commit((p) => rerollMission(p, Number(d.i)));
      if (!res.ok) return fail('One swap per day.');
      app.audio.play('click');
    },
    'claim-a': (d) => {
      const res = commit((p) => claimAchievement(p, d.id));
      if (!res.ok) return fail('Not yet.');
      app.audio.play('buy');
      toast({ title: 'Achievement claimed', tone: 'gold', icon: 'trophy', ms: 2200 });
    },
    'claim-login': () => {
      const res = commit((p) => claimLogin(p));
      if (!res?.ok) return;
      app.audio.play('buy');
      const cache = res.results.find((x) => x.kind === 'cache');
      if (cache?.ok) reveal({ item: cache.item, rarity: cache.rarity, dup: cache.dup, shards: cache.shards, title: `Day ${res.day} reward` });
      else toast({ title: `Day ${res.day} claimed`, tone: 'gold', icon: 'gift' });
    },
  },
};
