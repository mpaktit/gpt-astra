# ASTRA: Serpents of the Void

A space snake game made to be played every day. Pilot one of six cosmic serpents across six sectors of a hand-drawn star atlas. Each serpent has its own ability, and the game adds combos, rival AI serpents, daily seeded rifts, a 40-tier season pass and a wardrobe of skins, trails and finales.

Plain web platform: no build step, no dependencies. It installs as an app, runs offline and deploys to GitHub Pages in one push.

## Play locally

```bash
npm run serve          # http://localhost:5173
# or, with no Node:
python3 -m http.server 5173
```

On localhost the **demo store** is on, so crystal purchases credit fake currency and you can test the whole economy. On any other host it stays off unless `?demo-store=1` is set.

Controls: arrows / WASD to steer, Space for the species ability, P or Esc to pause. On mobile, swipe to steer and tap the ability button.

## What's inside

| System | Summary |
|---|---|
| Species | 6 serpents (Drift Eel to Solar Leviathan), each with an ability, a passive, and 10 mastery levels |
| Sectors | Nebula, Asteroid Belt, Ion Storm, Event Horizon (gravity well), Solar Forge (lava), Void Rift. Unlocked by level |
| Modes | Voyage, Blitz (60s), Daily Rift (same seed for everyone, plus a twist). 5 run modifiers |
| Rivals | AI serpents with greedy pathing and flood-fill survival |
| Economy | Stardust (earned), Crystals (rare/premium), Tokens (caches). Every species can be earned with Stardust |
| Cosmetics | Skins, trails, death finales, titles. Rarity tiers from common to mythic |
| Caches | Published odds, a pity timer, and duplicates converted to Stardust |
| Season pass | 40 tiers, free and premium tracks. The premium track pays back more crystals than it costs |
| Retention | Daily/weekly missions, 7-day login calendar, streaks, 19 achievements, daily shop rotation |
| Feel | Procedural audio and music per sector, particles, screen shake, reduced-motion support |

## Scripts

```bash
npm test        # node --test tests/*.test.js  (engine, economy, save integrity, UI smoke)
npm run check   # syntax, import graph, service worker coverage, banned patterns
npm run ci      # both
```

## Deploy

1. Push to `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. `.github/workflows/pages.yml` runs the checks and publishes. CI runs on every PR.

## Layout

```
src/core      deterministic engine, seeded RNG, rival AI
src/data      species, sectors, modes, cosmetics, economy, pass, missions, achievements
src/meta      profile, signed saves, wallet + ledger, store, progression
src/render    canvas renderer, OKLCH color, particles
src/audio     procedural SFX and music
src/services  payments boundary (disabled / demo / live)
src/ui        router, components, screens
tests         node:test suites
docs          design, architecture, security, roadmap
```

See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/ROADMAP.md](docs/ROADMAP.md).
