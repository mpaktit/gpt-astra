import { html, fmt } from '../dom.js';
import { icon, CUR_ICON } from '../icons.js';
import { rewardBits, price, bar } from '../components.js';
import { app, commit, fail, toast, reveal } from '../app.js';
import { SEASON } from '../../data/pass.js';
import { PASS_PRICE, PASS_XP_PER_TIER, PASS_TIERS } from '../../data/economy.js';
import { passTier } from '../../meta/progression.js';
import { claimTier, claimAll, claimableTiers } from '../../meta/pass.js';
import { buyPass } from '../../meta/store.js';

const SEASON_END = new Date(2026, 11, 1);

function cell(p, t, track, reached) {
  const rw = t[track];
  if (!rw) return html`<div class="pcell empty"></div>`;
  const claimed = (track === 'premium' ? p.pass.claimedPremium : p.pass.claimedFree).includes(t.tier);
  const locked = track === 'premium' && !p.pass.premium;
  const ready = reached && !claimed && !locked;
  return html`<div class="pcell ${track} ${claimed ? 'claimed' : ''} ${ready ? 'ready' : ''} ${locked ? 'locked' : ''} ${rw.cosmetic ? 'cos' : ''}">
    <span class="pcell-rw">${rewardBits(rw)}</span>
    ${claimed ? html`<span class="pcell-state">${icon('check', 14)}</span>` : ready ? html`<button class="btn sm primary" data-action="claim" data-tier="${t.tier}" data-track="${track}">Claim</button>` : locked ? html`<span class="pcell-state">${icon('lock', 14)}</span>` : ''}
  </div>`;
}

export const pass = {
  id: 'pass', title: 'Season pass',
  render(app) {
    const p = app.profile;
    const tier = passTier(p);
    const days = Math.max(0, Math.ceil((SEASON_END - Date.now()) / 86400000));
    const claimable = claimableTiers(p).length;
    return html`
    <section class="pass-page">
      <header class="pass-hero">
        <div>
          <p class="eyebrow">Season ${SEASON.id} · ${days} days left</p>
          <h1 class="h-display">${SEASON.name}</h1>
          <p class="muted">Every run earns pass XP. Missions earn a lot more.</p>
        </div>
        <div class="pass-progress">
          <div class="row-b"><span>Tier <b class="big-num">${tier}</b><small>/${PASS_TIERS}</small></span><small class="muted">${tier >= PASS_TIERS ? 'Complete' : `${fmt(PASS_XP_PER_TIER - (p.pass.xp % PASS_XP_PER_TIER))} XP to next`}</small></div>
          ${bar(tier >= PASS_TIERS ? 1 : (p.pass.xp % PASS_XP_PER_TIER) / PASS_XP_PER_TIER, 'violet')}
          <div class="row">
            ${claimable ? html`<button class="btn primary" data-action="claim-all">Claim all (${claimable})</button>` : ''}
            ${p.pass.premium ? html`<span class="prem-badge">${icon('sparkle', 16)} Premium active</span>` : ''}
          </div>
        </div>
      </header>

      ${!p.pass.premium ? html`<aside class="premium-pitch">
        <div>
          <h2 class="h-sub">Premium track</h2>
          <p>Solar Crown (mythic skin), Void Silk, Black Hole finale, Binary Stars trail, 5 Void Caches, and <b>1,150 crystals back</b> over the season. Finish it and next season's pass is paid for.</p>
        </div>
        <button class="btn gold" data-action="buy-pass" data-confirm="Confirm ${fmt(PASS_PRICE.crystals)} Crystals" ${p.wallet.crystals < PASS_PRICE.crystals ? 'aria-disabled="true"' : ''}>Unlock ${price('crystals', PASS_PRICE.crystals)}</button>
      </aside>` : ''}

      <div class="track-labels"><span>Free</span><span>Premium</span></div>
      <div class="track" data-keep-scroll>
        ${SEASON.tiers.map((t) => html`<div class="tier ${t.tier <= tier ? 'reached' : ''} ${t.tier === tier + 1 ? 'next' : ''}" ${t.tier === Math.max(1, tier) ? 'data-current' : ''}>
          <span class="tier-num">${t.tier}</span>
          ${cell(p, t, 'free', t.tier <= tier)}
          ${cell(p, t, 'premium', t.tier <= tier)}
        </div>`)}
      </div>
    </section>`;
  },
  mount(root) {
    const cur = root.querySelector('[data-current]');
    const track = root.querySelector('.track');
    if (cur && track && !track.dataset.scrolled) { track.scrollLeft = Math.max(0, cur.offsetLeft - 80); track.dataset.scrolled = '1'; }
  },
  actions: {
    claim: (d) => {
      const res = commit((p) => claimTier(p, Number(d.tier), d.track));
      if (!res.ok) return fail(res.error);
      app.audio.play('buy');
      const cache = res.results.find((x) => x.kind === 'cache');
      const cos = res.results.find((x) => x.kind === 'cosmetic');
      const isMilestone = Number(d.tier) % 10 === 0;
      if (isMilestone) {
        app.audio.play('levelUp');
        toast({ title: `Tier ${d.tier} - Milestone!`, body: 'Major reward unlocked', tone: 'gold', icon: 'sparkle', ms: 2400 });
      }
      if (cache?.ok) reveal({ item: cache.item, rarity: cache.rarity, dup: cache.dup, shards: cache.shards, title: `Tier ${d.tier} cache`, onEquip: () => commit((p) => { p.equipped[cache.item.kind] = cache.item.id; }) });
      else if (cos?.item) reveal({ item: cos.item, rarity: cos.item.rarity, dup: cos.dup, shards: cos.shards, title: `Tier ${d.tier}`, onEquip: () => commit((p) => { p.equipped[cos.item.kind] = cos.item.id; }) });
      else if (!isMilestone) toast({ title: `Tier ${d.tier} claimed`, tone: 'gold', icon: 'gift' });
    },
    'claim-all': () => {
      const res = commit((p) => claimAll(p));
      app.audio.play('buy');
      toast({ title: `${res.filter((r) => r.ok).length} rewards claimed`, body: 'Check your hangar for new gear.', tone: 'gold', icon: 'gift' });
    },
    'buy-pass': (d, el) => {
      if (el.getAttribute('aria-disabled') === 'true') return fail('Not enough Void Crystals yet.');
      const res = commit((p) => buyPass(p));
      if (!res.ok) return fail(res.error);
      app.audio.play('levelUp');
      toast({ title: 'Premium unlocked', body: 'Every reached tier is now claimable.', tone: 'gold', icon: 'sparkle' });
    },
  },
};
