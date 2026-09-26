// Turning a finished run into rewards. One function, easy to audit, fully tested.
import { worldById, WORLDS } from '../data/worlds.js';
import { speciesById, masteryLevel } from '../data/species.js';
import { MODES, dailyConfig } from '../data/modes.js';
import { DAILY_RIFT_REWARD, PASS_TIERS, PASS_XP_PER_TIER } from '../data/economy.js';
import { RANK_DIVISIONS } from '../data/ranks.js';
import { addXp } from './profile.js';
import { grant } from './wallet.js';
import { unlockCosmetic } from './store.js';
import { progressMissions } from './missions.js';
import { checkAchievements } from './achievements.js';
import { dateKey } from './time.js';

export const RANK_K = 32;

export function starsFor(world, score) {
  return world.stars.reduce((n, goal) => (score >= goal ? n + 1 : n), 0);
}

export function worldRating(worldId) {
  const worlds = WORLDS;
  const idx = worlds.findIndex((w) => w.id === worldId);
  return 1000 + (idx >= 0 ? idx * 60 : 0);
}

export function computeRankDelta(world, stars, scoredAny) {
  const base = RANK_K / 2;
  if (stars === 3) return RANK_K + Math.floor((worldRating(world.id) - 1000) / 20);
  if (stars === 2) return Math.floor(base / 2);
  if (stars >= 1) return scoredAny ? -Math.floor(base / 4) : -Math.floor(base / 3);
  return -RANK_K;
}

export function divisionFor(elo, current) {
  for (let i = RANK_DIVISIONS.length - 1; i >= 0; i--) {
    if (elo >= RANK_DIVISIONS[i].elo && (!current || RANK_DIVISIONS[i].id !== current)) {
      return RANK_DIVISIONS[i].id;
    }
  }
  return null;
}export function unlockedWorlds(p) {
  return WORLDS.filter((w) => p.level >= w.unlockLevel).map((w) => w.id);
}

export function applyRun(p, run, now = Date.now()) {
  const world = worldById(run.worldId);
  const mode = MODES[run.modeId] || MODES.voyage;
  const species = speciesById(run.speciesId);
  const seconds = Math.floor(run.duration / 1000);
  const out = { stardust: 0, crystals: 0, xp: 0, passXp: 0, levelUps: 0, newStars: 0, prevStars: 0, isBest: false, dailyReward: null, masteryUp: null, unlocks: [], missions: [], achievements: [], worldsUnlocked: [], rankChange: 0, newDivision: null };
  const beforeWorlds = unlockedWorlds(p);

  // Currency & XP
  out.stardust = Math.floor((run.score / 18 + run.orbs * 2 + seconds * 0.6) * species.stats.yield * mode.rewardMul);
  out.crystals = run.crystals || 0;
  out.xp = Math.floor(run.score / 3 + seconds * 2 + 40);
  out.passXp = Math.floor(out.xp * 1.2);
  grant(p, { stardust: out.stardust, crystals: out.crystals }, `run:${world.id}`, now);
  out.levelUps = addXp(p, out.xp);
  const passBefore = passTier(p);
  p.pass.xp += out.passXp;
  out.passTierUps = passTier(p) - passBefore;

  // Mastery
  const mBefore = masteryLevel(p.mastery[species.id] || 0);
  p.mastery[species.id] = (p.mastery[species.id] || 0) + out.xp;
  const mAfter = masteryLevel(p.mastery[species.id]);
  if (mAfter > mBefore) {
    out.masteryUp = { species: species.id, level: mAfter };
    if (mBefore < 5 && mAfter >= 5) { unlockCosmetic(p, `${species.id}-ascendant`); out.unlocks.push(`${species.id}-ascendant`); }
    if (mBefore < 10 && mAfter >= 10) { unlockCosmetic(p, `${species.id}-master`); out.unlocks.push(`${species.id}-master`); }
  }

  // Stars (voyage only) & bests
  if (mode.id === 'voyage') {
    out.prevStars = p.stars[world.id] || 0;
    const now3 = starsFor(world, run.score);
    if (now3 > out.prevStars) {
      out.newStars = now3 - out.prevStars;
      p.stars[world.id] = now3;
      const bonus = out.newStars * 250 * world.order;
      grant(p, { stardust: bonus }, `stars:${world.id}`, now);
      out.stardust += bonus;
    }
  }
  const bestKey = `${mode.id}:${world.id}`;
  out.prevBest = p.best[bestKey] || 0;
  if (run.score > out.prevBest) { p.best[bestKey] = run.score; out.isBest = run.score > 0; }
  const board = (p.leaderboard[bestKey] = Array.isArray(p.leaderboard[bestKey]) ? p.leaderboard[bestKey] : []);
  board.push({ score: run.score, species: species.id, at: now });
  board.sort((a, b) => b.score - a.score);
  board.length = Math.min(board.length, 10);

  // Daily Rift: one reward per day for a real attempt
  if (mode.id === 'daily') {
    const day = dateKey(new Date(now));
    const cfg = dailyConfig(day);
    if (p.daily.last !== day && run.worldId === cfg.worldId && run.score >= 200) {
      p.daily.last = day;
      p.stats.dailyClears++;
      grant(p, DAILY_RIFT_REWARD, 'daily-rift', now);
      out.dailyReward = DAILY_RIFT_REWARD;
    }
  }

   // Lifetime stats
  const st = p.stats;
  st.runs++;
  st.orbs += run.orbs; st.comets += run.comets; st.crystalsFound += run.crystals; st.powerups += run.powerups;
  st.abilityUses += run.abilityUses; st.rivals += run.rivals; st.severs += run.severs; st.playMs += run.duration;
  st.bestScore = Math.max(st.bestScore, run.score);
  st.bestCombo = Math.max(st.bestCombo, run.maxCombo);
  st.bestLength = Math.max(st.bestLength, run.maxLen || run.length);
  if (run.cause) st.deaths[run.cause] = (st.deaths[run.cause] || 0) + 1;
  p.last = { worldId: world.id, modeId: mode.id };

  // Ranked rating
  if (mode.id === 'ranked') {
    const stars = starsFor(world, run.score);
    out.prevStars = stars;
    const prevBest = p.rank.best;
    const delta = computeRankDelta(world, stars, run.score >= world.stars[0]);
    p.rank.elo += delta;
    p.rank.best = Math.max(p.rank.best, p.rank.elo);
    p.rank.matches++;

    if (delta > 0) {
      p.rank.streak = Math.min((p.rank.streak || 0) + 1, 12);
    } else if (delta < 0) {
      p.rank.streak = Math.max((p.rank.streak || 0) - 1, -12);
    } else {
      p.rank.streak = 0;
    }
    p.rank.last = now;
    out.rankChange = delta;
    out.newDivision = divisionFor(p.rank.elo, p.rank.division);
    if (out.newDivision && out.newDivision !== p.rank.division) {
      p.rank.division = out.newDivision;
    }
    if (p.rank.best > prevBest) st.bestRank = Math.max(st.bestRank || 0, p.rank.best);

    const streakBonus = Math.max(0, Math.min(Math.abs(p.rank.streak) - 2, 6));
    const streakMul = 1 + streakBonus * 0.1;
    const bonusStardust = Math.floor(out.stardust * (streakMul - 1));
    out.stardust = Math.floor(out.stardust * streakMul);
    out.xp = Math.floor(out.xp * streakMul);
    out.passXp = Math.floor(out.passXp * streakMul);
    if (bonusStardust > 0) {
      grant(p, { stardust: bonusStardust }, 'ranked-streak', now);
    }
  }

  out.missions = progressMissions(p, { ...run, seconds, runs: 1, length: run.maxLen || run.length }, now);
  out.achievements = checkAchievements(p);
  out.worldsUnlocked = unlockedWorlds(p).filter((id) => !beforeWorlds.includes(id));
  return out;
}

export const passTier = (p) => Math.min(PASS_TIERS, Math.floor(p.pass.xp / PASS_XP_PER_TIER));
