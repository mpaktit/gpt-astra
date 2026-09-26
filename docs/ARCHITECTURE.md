# Architecture

## Principles

- **No build, no deps.** Native ES modules. What's in the repo is what ships.
- **Pure core.** `src/core/engine.js` has no DOM, no clock, and no `Math.random`. It uses a seeded mulberry32 RNG and simulated time, so replaying `(seed, config, inputLog)` always gives the same final state. Tests depend on this, and so does future server-side score verification.
- **Data-driven content.** Species, sectors, cosmetics and prices live in `src/data`. Adding a skin is a data change.
- **One write path.** Meta changes (wallet, profile, unlocks) go through `commit()` in `src/ui/app.js`, which validates, signs and saves.

## Flow

```
input → run.js (queueTurn / useAbility, logs inputs)
      → engine.tick(state, dt)  (fixed step)
      → renderer.draw(state)    (canvas, interpolated)
      → on end: summarize → progression.applyRun → commit → results screen
```

## Saves

`localStorage` holds the primary save and a backup, each with a signature. On load: verify primary → fall back to backup → otherwise start fresh and set `flags.tampered`. `profile.sanitize` clamps every field, and `migrate` handles version upgrades.

## Wallet

`wallet.spend` is atomic across currencies and fails as a whole. Every change goes into a capped ledger. The store never changes balances directly.

## Payments

`src/services/payments.js`:
- `disabled`: production default, purchase buttons explain why.
- `demo`: localhost or `?demo-store=1`, credits fake currency.
- `live`: redirects to server checkout. Credits only arrive from a server-verified entitlement. The client never credits itself.

## PWA

`sw.js` precaches every module (`npm run check` fails if one is missing) and registers only over https.
