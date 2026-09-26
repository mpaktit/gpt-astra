# Game design

## Pillars

1. **One more run.** Runs last 1 to 4 minutes, a restart takes one keypress, and every run pays something.
2. **Mastery beats money.** Skill and time unlock everything that affects gameplay. Money buys looks and saves time.
3. **Every serpent plays differently.** A species is a playstyle, not a stat bump.
4. **A reason to come back tomorrow.** Daily Rift, missions, login calendar, shop rotation, the pass.

## Species

| Species | Rarity | Ability | Price |
|---|---|---|---|
| Drift Eel | common | Afterburn: surge, 2x points for 2.5s | free |
| Nova Viper | rare | Supernova: clears hazards/rivals in radius 4 | 2,500 ✦ |
| Phase Wyrm | rare | Blink Phase: pass through everything for 3s | 6,000 ✦ |
| Grav Serpent | epic | Singularity: pulls pickups within 7 cells | 9,000 ✦ or 900 ◆ |
| Chrono Naga | epic | Time dilation | 14,000 ✦ or 1,300 ◆ |
| Solar Leviathan | legendary | Solar burst | 30,000 ✦ or 2,400 ◆ |

Mastery levels (from playing a species) unlock species-specific skins and small reward bonuses.

## Sectors

Nebula Drift (L1), Asteroid Belt (L3, rocks), Ion Storm (L6, moving storms), Event Horizon (L10, gravity well), Solar Forge (L14, lava tides), Void Rift (L18, everything at once). Each has three star goals.

## Economy

- **Stardust ✦**: earned every run. `(score/18 + orbs*2 + seconds*0.6) * species yield * mode multiplier`. Tuned with a bot simulation so a new species takes about 1 to 3 days of normal play.
- **Crystals ◆**: rare. At most 2 spawn per run (only after 12 orbs), plus missions, achievements and the pass. Also sold in packs.
- **Tokens**: for opening caches.

### The pay-to-win line

Requested: "some currency pay to win". Decision: **no**. A leaderboard game dies once players feel it can be bought. Crystals buy *time* (skip the Stardust grind on epic/legendary serpents) and *identity* (skins, trails, finales, the premium pass). `tests/meta.test.js` enforces that every species has a Stardust price.

Crystals still feel valuable because they're scarce in play, the best cosmetics are premium-only, and the pass pays back 1,150 ◆ against its 950 ◆ price, so buying it once can fund every future season.

### Caches

The odds are shown in the UI, there's a pity timer that guarantees an epic or better, and duplicates turn into Stardust. This is required on several storefronts and it builds trust.

## Retention loops

- **Session:** combo chains, near-miss feedback, star goals, a new-best celebration.
- **Daily:** Daily Rift seed, 3 daily missions, login calendar, shop rotation.
- **Weekly:** weekly missions, pass tiers.
- **Long-term:** player level unlocks sectors, species mastery, achievements, titles.
