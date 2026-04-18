import { randomUUID } from 'crypto';
import type { EmailDecision } from '@/types/agent';

const PREVIEW_TTL_MS = 15 * 60 * 1000;

export interface PreviewDecision extends EmailDecision {
  decisionId: string;
}

export interface PreviewSession {
  previewId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  decisionsById: Map<string, PreviewDecision>;
}

export interface CreatePreviewSessionResult {
  previewId: string;
  decisionsWithIds: PreviewDecision[];
}

const previewSessions = new Map<string, PreviewSession>();

function isExpired(session: PreviewSession, now = Date.now()): boolean {
  return session.expiresAt <= now;
}

function cleanupExpiredSessions(now = Date.now()): void {
  for (const [previewId, session] of previewSessions.entries()) {
    if (isExpired(session, now)) {
      previewSessions.delete(previewId);
    }
  }
}

export function createPreviewSession(
  userId: string,
  decisions: EmailDecision[]
): CreatePreviewSessionResult {
  cleanupExpiredSessions();

  if (!userId || !userId.trim()) {
    throw new Error('userId is required.');
  }

  const previewId = randomUUID();
  const now = Date.now();
  const decisionsWithIds: PreviewDecision[] = decisions.map(decision => ({
    ...decision,
    decisionId: randomUUID(),
  }));

  const decisionsById = new Map<string, PreviewDecision>(
    decisionsWithIds.map(decision => [decision.decisionId, decision])
  );

  const session: PreviewSession = {
    previewId,
    userId,
    createdAt: now,
    expiresAt: now + PREVIEW_TTL_MS,
    decisionsById,
  };

  previewSessions.set(previewId, session);

  return {
    previewId,
    decisionsWithIds,
  };
}

export function getPreviewSession(previewId: string): PreviewSession | null {
  cleanupExpiredSessions();

  if (!previewId) return null;

  const session = previewSessions.get(previewId);
  if (!session) return null;

  if (isExpired(session)) {
    previewSessions.delete(previewId);
    return null;
  }

  return session;
}

export function validateAndGetDecisions(
  previewId: string,
  selectedDecisionIds: string[],
  userId: string
): EmailDecision[] {
  cleanupExpiredSessions();

  if (!previewId) {
    throw new Error('previewId is required.');
  }

  if (!userId || !userId.trim()) {
    throw new Error('userId is required.');
  }

  if (!Array.isArray(selectedDecisionIds) || selectedDecisionIds.length === 0) {
    throw new Error('selectedDecisionIds must contain at least one decision ID.');
  }

  const session = getPreviewSession(previewId);
  if (!session) {
    throw new Error('Invalid or expired previewId.');
  }

  if (session.userId !== userId) {
    throw new Error('Preview session does not belong to this user.');
  }

  const seen = new Set<string>();
  const validDecisions: EmailDecision[] = [];

  for (const decisionId of selectedDecisionIds) {
    if (!decisionId) {
      throw new Error('selectedDecisionIds contains an empty decision ID.');
    }

    if (seen.has(decisionId)) {
      throw new Error(`Duplicate decision ID: ${decisionId}`);
    }
    seen.add(decisionId);

    const previewDecision = session.decisionsById.get(decisionId);
    if (!previewDecision) {
      throw new Error(`Unknown decision ID for preview: ${decisionId}`);
    }

    const { decisionId: _decisionId, ...decision } = previewDecision;
    validDecisions.push(decision);
  }

  return validDecisions;
}
