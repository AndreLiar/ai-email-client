# Database Schema

ORM: Drizzle. Dialect: PostgreSQL (Neon). Schema: `src/db/schema.ts`. Migrations: `drizzle/`.

## Tables

### users
| Column | Type | Notes |
|---|---|---|
| id | serial PK | Internal auto-increment |
| clerkUserId | text UNIQUE NOT NULL | Clerk's userId — primary lookup key |
| email | text | Optional, set at OAuth callback |
| gmailAccessToken | text | Encrypted at rest by Neon |
| gmailRefreshToken | text | Used to auto-refresh on 401 |
| gmailUpdatedAt | timestamp | Last token update |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### subscriptions
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| userId | integer FK → users.id | |
| status | enum('active','canceled','past_due','trialing') | |
| provider | text | 'stripe' |
| stripeCustomerId | text | |
| stripeSubscriptionId | text | |
| currentPeriodStart | timestamp | |
| currentPeriodEnd | timestamp | |
| canceledAt | timestamp | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### decision_previews
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| previewId | uuid UNIQUE NOT NULL | Used by client to reference the session |
| userId | integer FK → users.id | |
| query | text | Gmail query used |
| limit_count | integer | Max emails queried |
| summary | jsonb | DecisionSummary |
| scoring | jsonb | DecisionScoring |
| decisions | jsonb | `Array<EmailDecision & { decisionId: uuid }>` |
| dropped_count | integer | Emails dropped during metadata fetch |
| createdAt | timestamp | |

### decision_executions
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| previewId | uuid FK → decision_previews.previewId | |
| userId | integer FK → users.id | |
| selectedDecisionIds | jsonb | Array of decisionId UUIDs |
| result | jsonb | `{ applied, skipped, errors }` |
| executedAt | timestamp | |

### processed_webhook_events
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| eventId | text UNIQUE NOT NULL | Stripe event ID — idempotency key |
| eventType | text | e.g. `checkout.session.completed` |
| userId | integer FK → users.id nullable | |
| payload | jsonb | Raw event metadata |
| processedAt | timestamp | |

## Conventions

- All DB access goes through `src/services/storage.ts`. No direct Drizzle calls in route handlers.
- `getOrCreateUser(clerkUserId)` is the canonical way to resolve a user row. Never assume the user exists.
- `clerkUserId` is the external identity. `users.id` is the internal FK used in all other tables.
