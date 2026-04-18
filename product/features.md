# Feature Registry

## Shipped

### Gmail OAuth Connect
Connect Gmail via OAuth2 (read + modify + send scopes). Tokens stored in DB per Clerk user. Auto-refresh on 401. Disconnect clears tokens.

### Inbox Scan (SSE)
Scan unread emails older than 180 days. Grouped by sender with count, date range, and unsubscribable flag. Streamed to client via Server-Sent Events.

### Sender Priority Score
Each sender scored on: volume, recency, unsubscribable flag, and category weight. Displayed as a visual bar.

### Smart Scan Summary
After scan, AI generates category breakdown: newsletters, promos, job alerts, social, transactional, other.

### Category Bulk-Action Buttons
Select all senders of a given category with one click. Supports bulk delete or unsubscribe on the selection.

### Unsubscribe Queue
Batch unsubscribe requests. Tries: (1) RFC 8058 one-click POST, (2) mailto reply, (3) link visit.

### Bulk Delete
Move emails from selected senders to TRASH via Gmail API batch.

### AI Chat Agent
Streaming chat with tool-calling: `scanInbox`, `classifySenders`, `deleteEmailsFromSender`, `unsubscribeFromSender`.

### Decision Engine
AI-driven triage: query Gmail → extract metadata → classify action (delete/archive/keep/reply) with confidence score → preview → execute.

### Stripe Subscription
Checkout session for Pro plan. Webhook activates subscription. UI blocks >50 actions for free users with upgrade CTA.

### Execution History
View past decision executions with applied/skipped/error counts.

### Vercel Analytics
Funnel tracking: cta_connect_clicked, gmail_connected, preview_generated, apply_safe_clicked, apply_success, upgrade_clicked, upgrade_shown.

## Planned / Not Started

- Email scheduling ("clean every Monday")
- Notification: "new cleanup opportunities"
- Multi-account Gmail support
- Reply drafts for keep/reply decisions
