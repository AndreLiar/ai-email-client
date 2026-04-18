# Performance Standards

## Gmail API

- Always batch message ID fetches. Never call `getMessageMetadata()` sequentially in a loop — use `Promise.all()` with concurrency control.
- Scan batches are capped. Never fetch unbounded message lists.
- Metadata-only requests — never fetch full message bodies unless required for unsubscribe parsing.

## AI Calls

- Classify senders in a single batch call, not one call per sender.
- Decision engine processes emails in one batch per run.
- Do not retry AI calls automatically on timeout — let the user retry at the UI level.

## SSE (Scan Stream)

- Emit `progress` events regularly during scan so the user sees live updates.
- Always emit a `complete` or `error` event to close the stream — never leave it hanging.
- The SSE endpoint must be non-blocking. Do not await all results before starting to stream.

## Database

- Use `limit(1)` on all single-record lookups.
- `getOrCreateUser` uses `onConflictDoNothing` to avoid race conditions on concurrent first-time users.
- Avoid N+1 queries. Fetch related data in joins or a single query.

## Client

- `useMemo` for expensive derived computations (sender filtering, category counts, priority scoring).
- Do not re-fetch `/api/auth/status` on every render — once on mount is sufficient.
- Optimistic UI for delete/unsubscribe: remove sender from list immediately, don't wait for API response to update state.

## Bundle

- No heavy libraries added without justification. Current UI stack is Bootstrap + minimal custom CSS.
- `@vercel/analytics` is async and non-blocking. It must never be in the render critical path.
