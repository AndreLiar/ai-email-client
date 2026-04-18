# User Flows

## Flow 1: First-Time Onboarding

```
Landing (/) 
  → click "Connect Gmail & See My Cleanup Plan"  [track: cta_connect_clicked]
  → /sign-in (Clerk)
  → /api/auth/gmail-connect  (Google OAuth consent)
  → /api/oauth2callback  (exchange code → save tokens → redirect /cleaner)
  → /cleaner  (ConnectGmail shown if not connected, else ScanTerminal)
```

## Flow 2: Inbox Scan

```
/cleaner  [gmail connected]
  → click "SCAN INBOX"
  → GET /api/agent/scan-senders  (SSE stream)
      progress events → update terminal
      complete event → ScanResult (senders[])
  → classify senders  POST /api/agent/classify-all
  → AnalyticsReport rendered
  → SenderList rendered with priority scores
```

## Flow 3: Bulk Delete / Unsubscribe

```
SenderList → select sender chips
  → click "DELETE SELECTED" or "UNSUBSCRIBE SELECTED"
  → POST /api/agent/bulk-delete  or  POST /api/agent/unsubscribe
  → sender removed from list immediately (optimistic UI)
```

## Flow 4: AI Decision Engine (Pro Path)

```
/cleaner  [scan done]
  → click "Generate AI Plan"
  → POST /api/agent/decide  { query, limit }
  → DecisionPreview rendered (delete/archive/keep per email)
  → user selects decisions
  → click "Apply Safe Actions"
    → if >50 selected AND free user → upgrade gate  [track: upgrade_shown]
    → else → POST /api/agent/execute-decisions  { previewId, selectedDecisionIds }
  → ExecutionResult shown  [track: apply_success]
```

## Flow 5: Upgrade to Pro

```
Upgrade CTA clicked  [track: upgrade_clicked]
  → POST /api/stripe/checkout
  → redirect to Stripe hosted checkout
  → on success → /cleaner?success=true
  → CleanerPage polls /api/auth/status every 2s (max 30s)
  → paymentPending banner shown until subscribed=true
  → needsUpgrade cleared, full apply unlocked
```

## Flow 6: Returning User

```
/cleaner  [already authenticated + gmail connected]
  → fetch /api/auth/status  → { connected: true, subscribed: bool }
  → skip ConnectGmail, go directly to ScanTerminal
```

## Error States

| Situation | Behavior |
|---|---|
| Gmail not connected | Show ConnectGmail component |
| Not signed in | Redirect to /sign-in |
| Auth status fetch fails | setGmailConnected(false), show ConnectGmail |
| Decision preview expired | Server falls back to DB |
| Stripe price not configured | Return 500 with "Stripe price not configured" |
| Webhook delayed | paymentPending banner polls for 30s |
