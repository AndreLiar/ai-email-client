import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  decisionExecutions,
  decisionPreviews,
  processedWebhookEvents,
  subscriptions,
  users,
} from '@/db/schema';
import type { AgentAction, DecisionScoring, DecisionSummary, EmailDecision } from '@/types/agent';

export interface DecisionPreviewRecord {
  previewId: string;
  userId: string;
  query: string;
  limit: number | null;
  summary: DecisionSummary;
  scoring: DecisionScoring;
  decisions: Array<EmailDecision & { decisionId?: string }>;
  dropped?: number;
  createdAt: number;
}

export interface DecisionExecutionRecord {
  previewId: string;
  userId: string;
  selectedDecisionIds: string[];
  result: {
    applied: {
      delete: number;
      archive: number;
      keep: number;
      reply: number;
    };
    skipped: number;
    errors: number;
  };
  executedAt: number;
}

export interface GmailTokenRecord {
  accessToken: string;
  refreshToken?: string;
  updatedAt: number;
}

interface ProcessedWebhookPayload {
  [key: string]: unknown;
}

async function resolveUserByClerkId(clerkUserId: string) {
  const rows = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  return rows[0] ?? null;
}

export async function getOrCreateUser(clerkUserId: string, email?: string) {
  const existing = await resolveUserByClerkId(clerkUserId);
  if (existing) {
    if (email && existing.email !== email) {
      const updated = await db
        .update(users)
        .set({ email, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();
      return updated[0] ?? existing;
    }
    return existing;
  }

  const inserted = await db
    .insert(users)
    .values({
      clerkUserId,
      email: email ?? null,
    })
    .onConflictDoNothing({ target: users.clerkUserId })
    .returning();

  if (inserted[0]) return inserted[0];

  const fallback = await resolveUserByClerkId(clerkUserId);
  if (!fallback) throw new Error('Failed to create user record');
  return fallback;
}

export async function logAction(_userId: string, _action: AgentAction): Promise<void> {
  // Intentionally no-op. Action logging can be persisted in a dedicated table later.
}

export async function getActionHistory(_userId: string): Promise<AgentAction[]> {
  return [];
}

export async function isUserSubscribed(userId: string): Promise<boolean> {
  const user = await getOrCreateUser(userId);
  const rows = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active')))
    .limit(1);

  return rows.length > 0;
}

export async function markUserSubscribed(userId: string): Promise<void> {
  const user = await getOrCreateUser(userId);
  const now = new Date();

  await db
    .insert(subscriptions)
    .values({
      userId: user.id,
      provider: 'stripe',
      status: 'active',
      activatedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [subscriptions.userId, subscriptions.provider],
      set: {
        status: 'active',
        activatedAt: now,
        updatedAt: now,
      },
    });
}

export async function saveDecisionPreview(record: DecisionPreviewRecord): Promise<void> {
  const user = await getOrCreateUser(record.userId);

  await db.insert(decisionPreviews).values({
    previewId: record.previewId,
    userId: user.id,
    query: record.query,
    limitCount: record.limit,
    summary: record.summary,
    scoring: record.scoring,
    decisions: record.decisions,
    droppedCount: record.dropped ?? 0,
    createdAt: new Date(record.createdAt),
  });
}

export async function getDecisionPreview(previewId: string): Promise<DecisionPreviewRecord | null> {
  const rows = await db
    .select({
      previewId: decisionPreviews.previewId,
      query: decisionPreviews.query,
      limit: decisionPreviews.limitCount,
      summary: decisionPreviews.summary,
      scoring: decisionPreviews.scoring,
      decisions: decisionPreviews.decisions,
      createdAt: decisionPreviews.createdAt,
      clerkUserId: users.clerkUserId,
    })
    .from(decisionPreviews)
    .innerJoin(users, eq(decisionPreviews.userId, users.id))
    .where(eq(decisionPreviews.previewId, previewId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    previewId: row.previewId,
    userId: row.clerkUserId,
    query: row.query ?? '',
    limit: row.limit ?? null,
    summary: row.summary as DecisionSummary,
    scoring: row.scoring as DecisionScoring,
    decisions: row.decisions as Array<EmailDecision & { decisionId?: string }>,
    createdAt: row.createdAt ? row.createdAt.getTime() : Date.now(),
  };
}

export async function saveDecisionExecution(record: DecisionExecutionRecord): Promise<void> {
  const user = await getOrCreateUser(record.userId);

  await db.insert(decisionExecutions).values({
    previewId: record.previewId,
    userId: user.id,
    selectedDecisionIds: record.selectedDecisionIds,
    result: record.result,
    executedAt: new Date(record.executedAt),
  });
}

export async function getDecisionExecutions(previewId: string): Promise<DecisionExecutionRecord[]> {
  const rows = await db
    .select({
      previewId: decisionExecutions.previewId,
      selectedDecisionIds: decisionExecutions.selectedDecisionIds,
      result: decisionExecutions.result,
      executedAt: decisionExecutions.executedAt,
      clerkUserId: users.clerkUserId,
    })
    .from(decisionExecutions)
    .innerJoin(users, eq(decisionExecutions.userId, users.id))
    .where(eq(decisionExecutions.previewId, previewId))
    .orderBy(desc(decisionExecutions.executedAt));

  return rows.map(row => ({
    previewId: row.previewId,
    userId: row.clerkUserId,
    selectedDecisionIds: (row.selectedDecisionIds ?? []) as string[],
    result: row.result as DecisionExecutionRecord['result'],
    executedAt: row.executedAt ? row.executedAt.getTime() : Date.now(),
  }));
}

export async function getDecisionExecutionsForUser(userId: string): Promise<DecisionExecutionRecord[]> {
  const user = await getOrCreateUser(userId);

  const rows = await db
    .select({
      previewId: decisionExecutions.previewId,
      selectedDecisionIds: decisionExecutions.selectedDecisionIds,
      result: decisionExecutions.result,
      executedAt: decisionExecutions.executedAt,
    })
    .from(decisionExecutions)
    .where(eq(decisionExecutions.userId, user.id))
    .orderBy(desc(decisionExecutions.executedAt));

  return rows.map(row => ({
    previewId: row.previewId,
    userId,
    selectedDecisionIds: (row.selectedDecisionIds ?? []) as string[],
    result: row.result as DecisionExecutionRecord['result'],
    executedAt: row.executedAt ? row.executedAt.getTime() : Date.now(),
  }));
}

export async function saveGmailTokens(userId: string, tokens: GmailTokenRecord): Promise<void> {
  const user = await getOrCreateUser(userId);

  await db
    .update(users)
    .set({
      gmailAccessToken: tokens.accessToken,
      gmailRefreshToken: tokens.refreshToken ?? null,
      gmailUpdatedAt: new Date(tokens.updatedAt),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

export async function getGmailTokens(userId: string): Promise<GmailTokenRecord | null> {
  const user = await resolveUserByClerkId(userId);
  if (!user?.gmailAccessToken) return null;

  return {
    accessToken: user.gmailAccessToken,
    refreshToken: user.gmailRefreshToken ?? undefined,
    updatedAt: user.gmailUpdatedAt ? user.gmailUpdatedAt.getTime() : Date.now(),
  };
}

export async function clearGmailTokens(userId: string): Promise<void> {
  const user = await resolveUserByClerkId(userId);
  if (!user) return;

  await db
    .update(users)
    .set({
      gmailAccessToken: null,
      gmailRefreshToken: null,
      gmailUpdatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

export async function isEventProcessed(eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: processedWebhookEvents.id })
    .from(processedWebhookEvents)
    .where(eq(processedWebhookEvents.eventId, eventId))
    .limit(1);

  return rows.length > 0;
}

export async function markEventProcessed(
  eventId: string,
  userId: string | null,
  payload: ProcessedWebhookPayload
): Promise<void> {
  const user = userId ? await getOrCreateUser(userId) : null;

  await db
    .insert(processedWebhookEvents)
    .values({
      eventId,
      eventType: typeof payload.type === 'string' ? payload.type : 'unknown',
      userId: user?.id ?? null,
      payload,
    })
    .onConflictDoNothing({ target: processedWebhookEvents.eventId });
}
