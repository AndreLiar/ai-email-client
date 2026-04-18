# Policy Tests

These are behavioral tests and structural invariants that must hold across the entire codebase. Each item here was added in response to a real bug or failure pattern.

## Origin of Each Rule

| Rule | Added Because |
|---|---|
| Every route has try/catch | Routes were returning empty bodies on unhandled throws, causing client JSON parse errors |
| Auth status fetch has .catch() | Transient network errors were leaving the page stuck in "initializing" state |
| DB fallback for preview sessions | In-memory sessions expired after server restarts/instance changes, blocking execution |
| Stripe lazy init | Module-level throw on missing key was breaking `next build` in environments without Stripe configured |
| droppedCount persisted from engine | droppedCount was always 0 in DB because it wasn't passed through |
| Webhook idempotency | Stripe replays events; without idempotency users were getting double-subscribed |

## Invariants to Verify on Every Deploy

### API
- `GET /api/auth/status` always returns `{ connected: boolean, subscribed: boolean }` — never empty, never throws to client
- `POST /api/agent/execute-decisions` with an expired previewId still works (loads from DB)
- `POST /api/stripe/checkout` without `STRIPE_PRICE_ID` returns 500 with error message, not a crash

### Auth
- Visiting `/cleaner` without being signed in redirects to `/sign-in`
- Visiting `/api/agent/scan-senders` without auth returns 401

### Subscription
- Free user applying >50 decisions gets a 403, not a silent failure
- After Stripe checkout success, subscription activates within 30s (webhook latency)

### Frontend
- After a server restart, generating a new decision preview still works (in-memory cleared)
- `?success=true` in URL shows payment pending banner and polls until subscribed

## When a New Bug Is Fixed

1. Identify the class of failure (missing error handling, wrong assumption, state leak, etc.)
2. Add a row to the table above
3. Add the invariant to the "Invariants to Verify" section
4. Add a lint or reviewer check in `harness/lints/` or `harness/reviewers/` so it's caught before merge next time
