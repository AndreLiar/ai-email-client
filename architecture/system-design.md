# System Design

## Overview

CleanInbox AI is a Next.js 16 App Router application deployed on Vercel. It orchestrates three external systems: Gmail API, an AI provider (Gemini/Groq), and Stripe.

## Component Map

```
Browser
  │
  ├── /cleaner (client component, SSE consumer)
  ├── /sign-in, /sign-up (Clerk hosted UI)
  │
Vercel Edge (middleware)
  │  Clerk auth guards: /cleaner(.*)  /api/agent(.*)
  │
Next.js API Routes
  ├── /api/auth/*          → Gmail OAuth, token management
  ├── /api/agent/*         → Inbox scan (SSE), AI decisions, execution
  ├── /api/stripe/*        → Checkout, webhook
  │
Services Layer (src/services/)
  ├── auth.ts              → Gmail token exchange, refresh, validation
  ├── gmail.ts             → Gmail API wrapper (list, metadata, trash, unsubscribe)
  ├── ai.ts                → Gemini 2.0 Flash → Groq fallback, classify, decide
  ├── decisionEngine.ts    → Fetch → classify → score → batch decisions
  ├── decisionPreviewStore.ts → In-memory session (15min TTL) + DB fallback
  ├── storage.ts           → Drizzle ORM: all DB access
  ├── stripe.ts            → Lazy Stripe singleton
  └── subscription.ts      → Thin wrapper for subscription status
  │
PostgreSQL (Neon)
  ├── users
  ├── subscriptions
  ├── decision_previews
  ├── decision_executions
  └── processed_webhook_events
```

## Key Architectural Decisions

### Two-Auth-System Design
Clerk handles identity (session, sign-in/up). Gmail OAuth is a separate flow stored in the `users` DB table. These are intentionally decoupled: Clerk gives us a `userId`, then we look up Gmail tokens separately. Never conflate them.

### In-Memory Preview + DB Fallback
Decision previews are written to both in-memory Map (fast, 15min TTL) and DB (durable). The execute endpoint tries in-memory first; on miss, falls back to DB. This handles multi-instance and server restarts without failing users.

### SSE for Scan Progress
Scan is long-running (batched Gmail API calls). SSE lets us stream progress events to the client without websockets. The endpoint writes `progress` events during fetch and a `complete` event at the end.

### AI Provider Fallback
`ai.ts` selects Gemini 2.0 Flash as primary. If unavailable or misconfigured, it falls back to Groq. Agents should never hard-code the model — always go through `ai.ts`.

### Stripe Lazy Init
`getStripe()` in `stripe.ts` initializes Stripe only when called. This prevents build/deploy failures when `STRIPE_SECRET_KEY` is not set (e.g., during `next build` in environments without the var).

## Deployment Environments

| Environment | Branch | URL | OAuth Redirect |
|---|---|---|---|
| Production | main | ai-email-client-five.vercel.app | Same domain |
| Staging | staging | ai-email-client-git-staging-andreliars-projects.vercel.app | Same domain |
| Development | local | localhost:3000 | localhost:3000 |
