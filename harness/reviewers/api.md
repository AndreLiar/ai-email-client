# API Reviewer Checklist

Run this against every PR touching `src/app/api/` or `src/services/`.

## Route Structure
- [ ] Every route has a top-level `try/catch`
- [ ] Every catch block returns `NextResponse.json({ error: string }, { status: 5xx })`
- [ ] No route returns an empty body under any code path
- [ ] Uses `NextResponse.json()` — not `new Response()`

## Error Codes
- [ ] 400 for invalid input (Zod fail, bad IDs)
- [ ] 401 for missing auth
- [ ] 403 for auth-ok but not authorized (not subscribed, Gmail not connected)
- [ ] 500 for unexpected server errors (always `console.error` before returning)

## DB Access
- [ ] No Drizzle imports in route files — all DB via `storage.ts`
- [ ] `getOrCreateUser(clerkUserId)` called before any insert that needs `users.id`
- [ ] Single-record lookups use `.limit(1)`

## Services
- [ ] No file exceeds 300 lines
- [ ] External API calls (Gmail, AI) have error handling
- [ ] Lazy init pattern for Stripe — no module-level throws

## Contracts
- [ ] New routes are documented in `architecture/api-contracts.md`
- [ ] Response shapes match what the client expects
- [ ] SSE endpoints always emit `complete` or `error` to close the stream
