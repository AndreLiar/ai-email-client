# CleanInbox AI

An AI agent that scans your entire Gmail mailbox, identifies every newsletter and promo sender you've never opened in 6+ months, and lets you bulk-unsubscribe and delete them in one click.

**Live:** https://ai-email-client-five.vercel.app

---

## The Problem

Most inboxes have thousands of unread emails from senders you forgot you subscribed to — job alerts, newsletters, promotional lists. They pile up silently for months or years. Cleaning them manually is tedious.

**CleanInbox AI** scans your full mailbox, surfaces the worst offenders with an analytics report, and lets you wipe them out in seconds.

---

## Features

**AI-Powered Scan**
- Scans your entire Gmail for unread emails older than 6 months
- Fetches up to 5,000 emails with real-time streaming progress (live terminal UI)
- Groups results by sender, filters to repetitive senders (2+ emails)

**Scan Analytics Report**
- Total stale emails found, unique senders, auto-unsubscribable count
- Oldest unread email age
- Age breakdown: 6–12 months / 1–2 years / 2+ years
- Actionable insights and a plain-language recommendation

**Bulk Actions**
- Trash all emails from a sender in one click (up to 1,000 per batch via Gmail `batchModify`)
- Unsubscribe + Trash: fires the unsubscribe request first, then trashes all emails

**Auto-Unsubscribe (3 methods, in priority order)**
1. One-click HTTP POST (RFC 8058) — instant, no email sent
2. Mailto — sends an unsubscribe email via Gmail API
3. Link — returns the unsubscribe URL for manual action

**AI Agent Chat**
- Powered by Gemini 1.5 Flash via Vercel AI SDK v6 (streaming)
- Tool-calling loop: `scanInbox` → `classifySenders` → `deleteEmailsFromSender` → `unsubscribeFromSender`
- Say *"delete all job alerts"* and it handles everything

**No Account Required**
- Auth is Gmail OAuth only — no sign-up, no passwords
- Tokens stored in HTTP-only cookies (secure, not accessible via JS)
- Disconnect clears all cookies instantly

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| AI Agent | Vercel AI SDK v6 + Gemini 1.5 Flash (`@ai-sdk/google`) |
| Email | Gmail API (OAuth2, read + modify scopes) |
| Auth | Gmail OAuth2 → HTTP-only cookies (no Clerk, no Supabase) |
| Streaming | Server-Sent Events (scan progress) + AI streaming responses |
| Styling | Bootstrap 5 + custom dark terminal CSS (no Tailwind) |
| Fonts | Syne + Space Mono via `next/font/google` |
| Deployment | Vercel (Hobby plan) |

---

## How It Works

```
User clicks "Connect Gmail"
  → Google OAuth2 flow
  → Tokens stored in HTTP-only cookies
  → Redirected to /cleaner

User clicks "Scan Inbox"
  → GET /api/agent/scan-senders (SSE stream)
  → Fetches all unread emails older than 180 days (paginated, up to 5,000)
  → Streams progress live to the terminal UI
  → Groups by sender, filters to repetitive senders
  → Returns analytics + sender table

User selects senders → clicks "UNSUB + TRASH"
  → POST /api/agent/unsubscribe  (fires unsubscribe request)
  → POST /api/agent/bulk-delete  (batchModify → TRASH label)
```

---

## Local Setup

```bash
git clone https://github.com/AndreLiar/ai-email-client.git
cd ai-email-client
npm install
cp .env.example .env.local   # fill in your values
npm run dev
```

---

## Environment Variables

```env
# Google OAuth2 (Gmail API)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth2callback

# AI
GEMINI_API_KEY=
```

Set `GOOGLE_REDIRECT_URI` to your production URL when deploying:
```
https://your-domain.vercel.app/api/oauth2callback
```

Make sure this URI is also added to **Authorized redirect URIs** in your Google Cloud Console OAuth client.

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/auth/gmail-connect` | GET | Redirects to Google OAuth consent screen |
| `/api/oauth2callback` | GET | Handles OAuth callback, stores tokens in cookies |
| `/api/auth/status` | GET | Checks if Gmail is connected (cookie exists) |
| `/api/auth/disconnect` | POST | Clears Gmail token cookies |
| `/api/agent/scan-senders` | GET | Streams scan progress + returns grouped senders |
| `/api/agent/bulk-delete` | POST | Moves all emails from a sender to Trash |
| `/api/agent/unsubscribe` | POST | Fires unsubscribe request for a sender |
| `/api/agent/cleaner` | POST | Streaming AI agent (Gemini tool-calling loop) |

---

## Development Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
```
