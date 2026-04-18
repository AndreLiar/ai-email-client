import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'inactive',
  'active',
  'past_due',
  'canceled',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email'),
  gmailAccessToken: text('gmail_access_token'),
  gmailRefreshToken: text('gmail_refresh_token'),
  gmailUpdatedAt: timestamp('gmail_updated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: subscriptionStatusEnum('status').notNull().default('inactive'),
    provider: text('provider').notNull().default('stripe'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    userProviderUnique: unique('subscriptions_user_provider_unique').on(table.userId, table.provider),
  })
);

export const decisionPreviews = pgTable('decision_previews', {
  id: uuid('id').defaultRandom().primaryKey(),
  previewId: text('preview_id').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  query: text('query'),
  limitCount: integer('limit_count'),
  summary: jsonb('summary').notNull(),
  scoring: jsonb('scoring'),
  decisions: jsonb('decisions').notNull(),
  droppedCount: integer('dropped_count').notNull().default(0),
  droppedReasons: jsonb('dropped_reasons'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const decisionExecutions = pgTable('decision_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  previewId: text('preview_id')
    .notNull()
    .references(() => decisionPreviews.previewId, { onDelete: 'restrict' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  selectedDecisionIds: jsonb('selected_decision_ids').notNull(),
  result: jsonb('result').notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const processedWebhookEvents = pgTable('processed_webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: text('provider').notNull().default('stripe'),
  eventId: text('event_id').notNull().unique(),
  eventType: text('event_type').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  payload: jsonb('payload'),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const schema = {
  users,
  subscriptions,
  decisionPreviews,
  decisionExecutions,
  processedWebhookEvents,
};
