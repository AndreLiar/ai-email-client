# Backend Standards

## API Routes

- Every route handler must have a top-level `try/catch` that returns `{ error: string }` with an appropriate status code. Never let a route return an empty body.
- Return `NextResponse.json(...)` — never `new Response(...)` in route handlers.
- Auth check always first: `const { userId } = await auth(); if (!userId) return 401`.
- Validate request bodies with Zod before reading values.
- All DB calls go through `src/services/storage.ts`. No Drizzle imports in route files.

## Services

- No file longer than 300 lines. Split by responsibility if approaching limit.
- External API calls (Gmail, AI provider) must have error handling. Propagate meaningful error messages, not raw stack traces.
- Functions that call external services must be async. No sync external I/O.
- `getOrCreateUser(clerkUserId)` before any DB write that needs `users.id`.

## Error Handling Rules

- `400` — invalid/missing input (Zod failure, bad ID format)
- `401` — missing Clerk session
- `403` — authenticated but not authorized (not subscribed, Gmail not connected)
- `500` — unexpected server error (always `console.error` before returning)
- Never expose stack traces or internal error messages to the client.

## Environment Variables

- Access via `process.env.VAR_NAME` only — never hardcode values.
- If a required env var is missing, fail at call time (lazy), not at module import time (eager). See `getStripe()` pattern.
- `NEXT_PUBLIC_*` vars are browser-visible. Never put secrets there.

## Database

- Always use `drizzle-orm` query builder. No raw SQL.
- Migrations via `drizzle-kit generate` + `drizzle-kit migrate`. Never edit migration files manually.
- Use `onConflictDoNothing` for idempotent inserts (e.g. `getOrCreateUser`).
- Timestamps in DB are `Date` objects. Convert to/from epoch ms at the service boundary.

## Naming

- Route files: `src/app/api/<domain>/<action>/route.ts`
- Service files: `src/services/<domain>.ts`
- camelCase for all exported functions and variables.
