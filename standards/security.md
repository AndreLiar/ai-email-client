# Security Standards

## Authentication & Authorization

- Every `/api/agent/*` route: call `await auth()` and check `userId` before any logic.
- Every `/api/auth/*` route that mutates data: same check.
- Middleware protects `/cleaner` and `/api/agent/*` at the edge. Routes must still verify independently — defense in depth.
- Never trust client-supplied `userId`. Always derive it from `auth()` server-side.

## Gmail Token Handling

- Tokens are stored in the `users` table. Never return them to the client.
- Refresh tokens must never appear in logs or error messages.
- Token refresh happens in `getValidAccessToken()`. Always use this function — never read `gmailAccessToken` directly from DB in route handlers.
- On disconnect, zero out both access and refresh tokens.

## Input Validation

- All POST body inputs validated with Zod before use.
- `selectedDecisionIds` must be deduped server-side before any DB or engine call.
- `previewId` must be a non-empty string. Validate before DB query.
- Gmail query strings passed from client must not be executed without bounds (`limit` is capped at 500).

## Stripe Webhook

- Always verify webhook signature with `stripe.webhooks.constructEvent()`. Reject if it fails.
- Use `isEventProcessed()` + `markEventProcessed()` for idempotency. Stripe can replay events.
- `userId` in webhook comes from `session.metadata.userId` — set by our checkout route. Treat as trusted only after signature verification.

## Data Isolation

- Decision previews are scoped to `userId`. The execute route verifies ownership before applying decisions.
- DB fallback for previews: verify `stored.userId === userId` before using stored decisions.
- Execution history: always filter by authenticated `userId`.

## What Never To Do

- Never log Gmail tokens, Clerk session tokens, or Stripe keys.
- Never put secrets in `NEXT_PUBLIC_*` env vars.
- Never skip Zod validation "for now" — it must be there before merge.
- Never return raw caught errors to the client (`err.message` can expose internals).
