# Product Requirements — CleanInbox AI

## Problem

Gmail users accumulate thousands of unread emails from newsletters, promos, and job alerts. The Gmail UI was not built for bulk cleanup. Users need an AI-powered agent that understands their inbox, groups noise by sender, and acts on their behalf.

## Target User

Someone with 1,000+ unread emails, most of which are older than 6 months, who wants to reclaim their inbox in one session rather than email by email.

## Core Value Proposition

> "Connect Gmail. Get a cleanup plan. Approve it. Done."

## Business Model

Freemium SaaS:
- **Free**: scan inbox, view decisions, apply up to 50 actions
- **Pro**: unlimited apply, full decision engine, priority AI

Payment: Stripe subscription (`STRIPE_PRICE_ID` env var, monthly)

## Success Metrics

- Time from connect → first scan complete < 30s
- % users who reach "apply" step after preview
- Churn rate on Pro within 30 days
- Unsubscribe success rate (one-click vs mailto fallback)

## Non-Goals

- Not a full email client
- No email compose (except automated unsubscribe replies)
- No mobile app (web only, responsive not required)
