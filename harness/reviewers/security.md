# Security Reviewer Checklist

Run this against every PR that touches API routes, services, or auth.

## Authentication
- [ ] Every `/api/agent/*` route calls `await auth()` and checks `userId !== null`
- [ ] No route returns data before the auth check
- [ ] Middleware config in `middleware.ts` still covers `/cleaner(.*)` and `/api/agent(.*)`

## Authorization
- [ ] Decision execution verifies `stored.userId === userId` before applying decisions
- [ ] History endpoint filters by `userId`, not returning all records
- [ ] Subscription gating (`isUserSubscribed`) checked before protected actions

## Input Validation
- [ ] All POST bodies have a Zod schema that is checked with `.safeParse()` before use
- [ ] `selectedDecisionIds` is deduped server-side
- [ ] Numeric inputs (limit, count) are bounded before use
- [ ] No raw Gmail query strings from client executed without sanitization

## Token Safety
- [ ] Gmail tokens never returned to client in any response
- [ ] `getValidAccessToken()` used — never direct DB read of token in routes
- [ ] No tokens in `console.log` or error messages

## Stripe
- [ ] Webhook verifies signature before reading event data
- [ ] Event idempotency check (`isEventProcessed`) runs before business logic
- [ ] `userId` in webhook derived from `session.metadata.userId` (set by our checkout, trusted after sig verify)

## General
- [ ] No raw `err.message` returned to client (could expose internals)
- [ ] No `NEXT_PUBLIC_*` env vars contain secrets
- [ ] No hardcoded credentials or keys anywhere in the diff
