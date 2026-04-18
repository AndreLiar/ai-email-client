# API Contracts

All routes return `application/json`. Errors always return `{ error: string }`.
Protected routes (`/api/agent/*`) require a valid Clerk session.

---

## Auth Routes

### GET /api/auth/status
Returns Gmail connection and subscription state.
```json
// 200
{ "connected": boolean, "subscribed": boolean }
```

### GET /api/auth/gmail-connect
Redirects to Google OAuth consent screen. No body.

### GET /api/oauth2callback?code=&state=
Exchanges code for tokens, saves to DB, redirects to `/cleaner`.

### POST /api/auth/disconnect
Clears Gmail tokens for the authenticated user.
```json
// 200
{ "ok": true }
```

---

## Agent Routes (require Clerk auth)

### GET /api/agent/scan-senders
Server-Sent Events stream. Each event is `data: <JSON>\n\n`.

Event types:
```json
{ "type": "progress", "message": "string", "count": number }
{ "type": "complete", "senders": SenderInfo[], "total": number }
{ "type": "error", "message": "string" }
```

### POST /api/agent/bulk-delete
```json
// Request
{ "senderEmail": "string", "messageIds": ["string"] }
// 200
{ "trashed": number }
```

### POST /api/agent/unsubscribe
```json
// Request
{ "senderEmail": "string", "messageId": "string" }
// 200
{ "method": "one-click-post" | "mailto" | "link" | "none", "success": boolean }
```

### POST /api/agent/decide
Runs AI decision engine. Creates in-memory + DB preview session.
```json
// Request
{ "query": "string", "limit": number }
// 200
{
  "previewId": "uuid",
  "decisions": EmailDecision[],
  "summary": DecisionSummary,
  "scoring": DecisionScoring,
  "dropped": number
}
```

### POST /api/agent/execute-decisions
Executes selected decisions. Requires Pro subscription (>50 actions).
```json
// Request
{ "previewId": "uuid", "selectedDecisionIds": ["uuid"] }
// 200
{ "applied": { delete, archive, keep, reply }, "skipped": number[], "errors": string[] }
// 403 — not subscribed or Gmail not connected
// 400 — invalid/expired previewId, duplicate IDs, unknown decision ID
```

### GET /api/agent/history
Returns past executions for the authenticated user.
```json
// 200
{ "executions": DecisionExecutionRecord[] }
```

---

## Stripe Routes

### POST /api/stripe/checkout
Creates a Stripe checkout session.
```json
// 200
{ "url": "string" }
// 500 — Stripe price not configured
```

### POST /api/stripe/webhook
Stripe webhook handler. Verifies signature. Idempotent (skips replayed events).
```json
// 200
{ "received": true }
```

---

## Error Codes

| Status | Meaning |
|---|---|
| 400 | Invalid input / validation failed |
| 401 | Not authenticated (Clerk) |
| 403 | Subscribed required OR Gmail not connected |
| 500 | Internal error (always logged server-side) |
