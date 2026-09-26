import { MISSION_TEMPLATES, DAILY_REWARDS, WEEKLY_MULT, WEEKLY_REWARDS } from '../data/missions.js';
import { createRng, hashString } from '../core/rng.js';
import { dateKey, weekKey } from './time.js';
import { grant } from './wallet.js';

const tpl = (id) => MISSION_TEMPLATES.find((t) => t.id === id);

function generate(seedStr, mult) {
  const rng = createRng(hashString(seedStr));
  return rng.shuffle(MISSION_TEMPLATES).slice(0, 3).map((t, tier) => ({
    tpl: t.id, tier, target: Math.round(t.targets[tier] * (t.kind === 'sum' ? mult : 1) * (t.kind === 'best' && mult > 1 ? 1.25 : 1)),
    progress: 0, claimed: false,
  }));
}

/** Refresh daily/weekly missions when the day or week rolls over. Returns true if anything changed. */
export function ensureMissions(p, now = Date.now()) {
  const d = new Date(now);
  let changed = false;
  const day = dateKey(d), week = weekKey(d);
  if (p.missions.day !== day) {
    p.missions = { ...p.missions, day, daily: generate(`d:${p.seed}:${day}`, 1), rerolled: false };
    changed = true;
  }
  if (p.missions.week !== week) {
    p.missions = { ...p.missions, week, weekly: generate(`w:${p.seed}:${week}`, WEEKLY_MULT) };
    changed = true;
  }
  return changed;
}

export function missionText(m) { return tpl(m.tpl)?.text(m.target) ?? ''; }
export const missionDone = (m) => m.progress >= m.target;

export function progressMissions(p, run, now = Date.now()) {
  ensureMissions(p, now);
  const completed = [];
  for (const [list, weekly] of [[p.missions.daily, false], [p.missions.weekly, true]]) {
    for (const m of list) {
      const t = tpl(m.tpl);
      if (!t || missionDone(m)) continue;
      const v = run[t.stat] || 0;
      m.progress = t.kind === 'sum' ? m.progress + v : Math.max(m.progress, v);
      if (missionDone(m)) { m.progress = m.target; completed.push({ ...m, weekly, text: missionText(m) }); }
    }
  }
  return completed;
}

export function claimMission(p, weekly, index, now = Date.now()) {
  const list = weekly ? p.missions.weekly : p.missions.daily;
  const m = list[index];
  if (!m || !missionDone(m) || m.claimed) return { ok: false };
  m.claimed = true;
  const reward = (weekly ? WEEKLY_REWARDS : DAILY_REWARDS)[m.tier];
  grant(p, reward, `mission:${m.tpl}`, now);
  p.pass.xp += reward.passXp || 0;
  return { ok: true, reward };
}

export function rerollMission(p, index, now = Date.now()) {
  const m = p.missions.daily[index];
  if (!m || p.missions.rerolled || m.claimed) return { ok: false };
  const used = new Set(p.missions.daily.map((x) => x.tpl));
  const rng = createRng(hashString(`r:${p.seed}:${p.missions.day}:${index}`));
  const options = MISSION_TEMPLATES.filter((t) => !used.has(t.id));
  const t = rng.pick(options);
  p.missions.daily[index] = { tpl: t.id, tier: m.tier, target: t.targets[m.tier], progress: 0, claimed: false };
  p.missions.rerolled = true;
  return { ok: true };
}
