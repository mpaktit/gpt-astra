# Security

## Threat model (current, client-only)

A browser game with local saves can't stop a determined player from editing their own save. The goals for now are: make casual tampering fail safely, never trust the client with money, and keep the code free of injection bugs.

| Risk | Mitigation |
|---|---|
| XSS | All DOM strings go through the escaping `html` tag. No `innerHTML` with raw data, no inline handlers (checked by `npm run check`). Strict CSP in `index.html` |
| Save editing | Signed saves with a backup slot and a sanitizer that clamps values. Tampering sets a flag (useful for leaderboard exclusion later) |
| Fake purchases | The client can never grant paid currency in production. Demo mode is limited to localhost / an explicit flag |
| Score forgery | Deterministic engine and input logs make server replay verification possible (see roadmap) |
| Supply chain | Zero dependencies |

The signature key ships in the client, so it only protects against casual edits. That's fine while nothing is competitive or paid.

## Required before real money or global leaderboards

1. Server-side wallet (e.g. Supabase/Postgres with row-level security, or Firebase with rules). The client sends intents and the server holds balances.
2. Payments through Stripe Checkout, with credits applied **only** from a signed webhook. Idempotent by event id.
3. Score submission includes `(seed, config, inputLog)`. The server replays it in the same engine (it's pure JS and runs in Node) and rejects any mismatch.
4. Rate limits, auth (magic link / OAuth), and an audit log on the ledger.
5. Storefront compliance: published cache odds (already in the UI), age gating where required, and refunds.
