import { decideEmailActions, type DecisionEmailInput, type DecisionPolicy } from '@/services/ai';
import { formatEmailAsMime } from '@/lib/formatEmailAsMime';
import { batchArchive, batchTrash, createDraft, getMessageMetadata, listMessages, parseFromHeader } from '@/services/gmail';
import type { DecisionBatch, DecisionSummary, EmailDecision, DecisionAction, DecisionScoring, DecisionGroups, LowConfidenceDecision } from '@/types/agent';
import type { GmailMessage } from '@/types/email';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const DEFAULT_POLICY: DecisionPolicy = {
  deleteThreshold: 0.9,
  archiveThreshold: 0.75,
  allowReply: true,
  highRiskKeywords: ['invoice', 'bank', 'password', 'security'],
};

const ARCHIVE_GUARDRAIL_KEYWORDS = ['invoice', 'bank', 'password', 'security', 'payment', 'account'];

const METADATA_HEADERS = ['From', 'Subject'];

interface GmailMetadata extends GmailMessage {
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
}

export interface DecisionExecutionItem {
  messageId: string;
  action: DecisionAction;
  status: 'applied' | 'skipped' | 'error';
  reason?: string;
  confidence: number;
}

export interface ExecuteDecisionsResult {
  applied: {
    delete: number;
    archive: number;
    keep: number;
    reply: number;
  };
  skipped: number;
  errors: number;
  results: DecisionExecutionItem[];
}

export interface RunDecisionEngineInput {
  accessToken: string;
  query: string;
  limit?: number;
  policy?: Partial<DecisionPolicy>;
}

export interface ExecuteDecisionsInput {
  accessToken: string;
  decisions: EmailDecision[];
  policy?: Partial<DecisionPolicy>;
}

function normalizeLimit(limit?: number): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

function headerValue(headers: { name: string; value: string }[] | undefined, name: string): string {
  if (!headers) return '';
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value?.trim() ?? '';
}

function toAgeDays(internalDate?: string): number | undefined {
  if (!internalDate) return undefined;
  const dateMs = Number(internalDate);
  if (!Number.isFinite(dateMs) || dateMs <= 0) return undefined;
  const diffMs = Date.now() - dateMs;
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function fetchMessageIds(accessToken: string, query: string, limit: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const data = await listMessages(accessToken, query, Math.min(500, limit - ids.length), pageToken);
    ids.push(...(data.messages || []).map(m => m.id));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < limit);

  return ids.slice(0, limit);
}

async function fetchMetadataBatch(
  accessToken: string,
  ids: string[]
): Promise<{ messages: GmailMetadata[]; dropped: number; droppedReasons: string[] }> {
  let dropped = 0;
  const droppedReasons = new Set<string>();

  const metadataList = await Promise.all(
    ids.map(async id => {
      try {
        return await getMessageMetadata(accessToken, id, METADATA_HEADERS) as GmailMetadata;
      } catch {
        dropped += 1;
        droppedReasons.add('metadata_fetch_failed');
        return null;
      }
    })
  );

  return {
    messages: metadataList.filter(Boolean) as GmailMetadata[],
    dropped,
    droppedReasons: Array.from(droppedReasons),
  };
}

function normalizeForAi(messages: GmailMetadata[]): DecisionEmailInput[] {
  return messages.map(message => {
    const headers = message.payload?.headers || [];
    const fromRaw = headerValue(headers, 'From');
    const subject = headerValue(headers, 'Subject');
    const { email } = parseFromHeader(fromRaw);

    return {
      messageId: message.id,
      threadId: message.threadId,
      from: email || fromRaw || 'unknown@unknown',
      subject: subject || '(no subject)',
      snippet: (message.snippet || '').trim(),
      labels: message.labelIds || [],
      ageDays: toAgeDays(message.internalDate),
    };
  });
}

function summarize(decisions: EmailDecision[]): DecisionSummary {
  const summary: Record<DecisionAction, number> = {
    delete: 0,
    archive: 0,
    keep: 0,
    reply: 0,
  };

  for (const decision of decisions) {
    summary[decision.action] += 1;
  }

  return summary;
}

function groupByAction(decisions: EmailDecision[]): DecisionGroups {
  const groups: DecisionGroups = {
    delete: [],
    archive: [],
    keep: [],
    reply: [],
  };

  for (const decision of decisions) {
    groups[decision.action].push(decision);
  }

  return groups;
}

function getActionThreshold(action: DecisionAction, policy: DecisionPolicy): number | null {
  if (action === 'delete') return policy.deleteThreshold;
  if (action === 'archive') return policy.archiveThreshold;
  return null;
}

function buildScoring(decisions: EmailDecision[], policy: DecisionPolicy): DecisionScoring {
  const byAction = groupByAction(decisions);
  const sortedByConfidence = [...decisions].sort((a, b) => b.confidence - a.confidence);
  const lowConfidence: LowConfidenceDecision[] = decisions
    .map(decision => {
      const threshold = getActionThreshold(decision.action, policy);
      if (threshold === null) return null;
      if (decision.confidence >= threshold) return null;
      return { ...decision, threshold };
    })
    .filter(Boolean) as LowConfidenceDecision[];

  return {
    byAction,
    sortedByConfidence,
    lowConfidence,
  };
}

export async function runDecisionEngine({
  accessToken,
  query,
  limit,
  policy,
}: RunDecisionEngineInput): Promise<DecisionBatch> {
  const effectiveLimit = normalizeLimit(limit);
  const effectivePolicy: DecisionPolicy = { ...DEFAULT_POLICY, ...(policy || {}) };
  console.info('[decisionEngine] run start', { query, limit: effectiveLimit });

  const messageIds = await fetchMessageIds(accessToken, query, effectiveLimit);
  if (messageIds.length === 0) {
    const emptyScoring: DecisionScoring = {
      byAction: { delete: [], archive: [], keep: [], reply: [] },
      sortedByConfidence: [],
      lowConfidence: [],
    };
    console.info('[decisionEngine] run done (no messages)', { query });
    return {
      query,
      scanned: 0,
      dropped: 0,
      droppedReasons: [],
      decisions: [],
      summary: { delete: 0, archive: 0, keep: 0, reply: 0 },
      scoring: emptyScoring,
    };
  }

  const { messages, dropped, droppedReasons } = await fetchMetadataBatch(accessToken, messageIds);
  const aiInputs = normalizeForAi(messages);
  const decisions = await decideEmailActions({
    policy: effectivePolicy,
    emails: aiInputs,
  });

  const summary = summarize(decisions);
  const scoring = buildScoring(decisions, effectivePolicy);
  console.info('[decisionEngine] decisions made', {
    query,
    scanned: aiInputs.length,
    dropped,
    droppedReasons,
    summary,
    lowConfidence: scoring.lowConfidence.length,
  });

  return {
    query,
    scanned: aiInputs.length,
    dropped,
    droppedReasons,
    decisions,
    summary,
    scoring,
  };
}

async function buildReplyDraft(
  accessToken: string,
  decision: EmailDecision
): Promise<
  | { ok: true; raw: string; threadId?: string }
  | { ok: false; reason: 'metadata_fetch_failed' | 'unsafe_reply_recipient' }
> {
  let message: GmailMetadata;
  try {
    message = await getMessageMetadata(accessToken, decision.messageId, ['Reply-To', 'From', 'Subject']) as GmailMetadata;
  } catch (err: any) {
    console.error('[decisionEngine] reply metadata fetch failed', {
      messageId: decision.messageId,
      error: err?.message || err,
    });
    return { ok: false, reason: 'metadata_fetch_failed' };
  }

  const headers = message.payload?.headers || [];
  const replyToRaw = headerValue(headers, 'Reply-To');
  const fromRaw = headerValue(headers, 'From');
  const subject = headerValue(headers, 'Subject');
  const preferredRecipientRaw = replyToRaw || fromRaw;
  const { email } = parseFromHeader(preferredRecipientRaw);
  const to = (email || preferredRecipientRaw || '').trim();
  const toLower = to.toLowerCase();

  if (
    !to ||
    toLower.includes('noreply') ||
    toLower.includes('no-reply') ||
    toLower.includes('do-not-reply')
  ) {
    return { ok: false, reason: 'unsafe_reply_recipient' };
  }

  const draftSubject = decision.replyDraft?.subject?.trim() || `Re: ${subject || ''}`.trim();
  const draftBody = decision.replyDraft?.body?.trim() || '';
  const raw = formatEmailAsMime(to, draftSubject || 'Re:', draftBody);
  return { ok: true, raw, threadId: message.threadId };
}

async function findRiskKeywords(
  accessToken: string,
  messageId: string,
  keywords: string[]
): Promise<{ ok: true; riskHits: string[] } | { ok: false; reason: 'metadata_fetch_failed' }> {
  if (keywords.length === 0) return { ok: true, riskHits: [] };

  try {
    const message = await getMessageMetadata(accessToken, messageId, ['Subject']) as GmailMetadata;
    const subject = headerValue(message.payload?.headers, 'Subject').toLowerCase();
    const snippet = (message.snippet || '').toLowerCase();
    const haystack = `${subject}\n${snippet}`;
    const riskHits = keywords.filter(keyword => haystack.includes(keyword.toLowerCase()));
    return { ok: true, riskHits };
  } catch (err: any) {
    console.error('[decisionEngine] risk keyword metadata fetch failed', {
      messageId,
      error: err?.message || err,
    });
    return { ok: false, reason: 'metadata_fetch_failed' };
  }
}

export async function executeDecisions({
  accessToken,
  decisions,
  policy,
}: ExecuteDecisionsInput): Promise<ExecuteDecisionsResult> {
  const effectivePolicy: DecisionPolicy = { ...DEFAULT_POLICY, ...(policy || {}) };
  console.info('[decisionEngine] execution start', { requested: decisions.length });
  const results: DecisionExecutionItem[] = [];
  const deleteIds: string[] = [];
  const archiveIds: string[] = [];
  const replyDrafts: { messageId: string; confidence: number; raw: string; threadId?: string }[] = [];

  // Phase 1: planning (validate and prepare, no Gmail writes)
  for (const decision of decisions) {
    if (decision.action === 'keep') {
      console.info('[decisionEngine] skipped keep action', { messageId: decision.messageId });
      results.push({
        messageId: decision.messageId,
        action: 'keep',
        status: 'skipped',
        reason: 'No action required.',
        confidence: decision.confidence,
      });
      continue;
    }

    if (decision.action === 'delete' && decision.confidence < effectivePolicy.deleteThreshold) {
      console.warn('[decisionEngine] skipped delete by confidence', {
        messageId: decision.messageId,
        confidence: decision.confidence,
        threshold: effectivePolicy.deleteThreshold,
      });
      results.push({
        messageId: decision.messageId,
        action: 'delete',
        status: 'skipped',
        reason: `Delete blocked: confidence ${decision.confidence.toFixed(2)} < ${effectivePolicy.deleteThreshold.toFixed(2)}.`,
        confidence: decision.confidence,
      });
      continue;
    }

    if (decision.action === 'archive' && decision.confidence < effectivePolicy.archiveThreshold) {
      console.warn('[decisionEngine] skipped archive by confidence', {
        messageId: decision.messageId,
        confidence: decision.confidence,
        threshold: effectivePolicy.archiveThreshold,
      });
      results.push({
        messageId: decision.messageId,
        action: 'archive',
        status: 'skipped',
        reason: `Archive blocked: confidence ${decision.confidence.toFixed(2)} < ${effectivePolicy.archiveThreshold.toFixed(2)}.`,
        confidence: decision.confidence,
      });
      continue;
    }

    if (decision.action === 'delete') {
      const riskCheck = await findRiskKeywords(
        accessToken,
        decision.messageId,
        effectivePolicy.highRiskKeywords
      );

      if (!riskCheck.ok) {
        results.push({
          messageId: decision.messageId,
          action: 'delete',
          status: 'error',
          reason: 'metadata_fetch_failed',
          confidence: decision.confidence,
        });
        continue;
      }

      const riskHits = riskCheck.riskHits;

      if (riskHits.length > 0) {
        console.warn('[decisionEngine] skipped delete by keyword guardrail', {
          messageId: decision.messageId,
          riskHits,
        });
        results.push({
          messageId: decision.messageId,
          action: 'delete',
          status: 'skipped',
          reason: `Delete blocked by risk keywords: ${riskHits.join(', ')}.`,
          confidence: decision.confidence,
        });
        continue;
      }

      deleteIds.push(decision.messageId);
      results.push({
        messageId: decision.messageId,
        action: 'delete',
        status: 'applied',
        confidence: decision.confidence,
      });
      continue;
    }

    if (decision.action === 'archive') {
      const riskCheck = await findRiskKeywords(
        accessToken,
        decision.messageId,
        ARCHIVE_GUARDRAIL_KEYWORDS
      );

      if (!riskCheck.ok) {
        results.push({
          messageId: decision.messageId,
          action: 'archive',
          status: 'error',
          reason: 'metadata_fetch_failed',
          confidence: decision.confidence,
        });
        continue;
      }

      if (riskCheck.riskHits.length > 0) {
        console.warn('[decisionEngine] skipped archive by keyword guardrail', {
          messageId: decision.messageId,
          riskHits: riskCheck.riskHits,
        });
        results.push({
          messageId: decision.messageId,
          action: 'archive',
          status: 'skipped',
          reason: 'archive_guardrail_blocked',
          confidence: decision.confidence,
        });
        continue;
      }

      archiveIds.push(decision.messageId);
      results.push({
        messageId: decision.messageId,
        action: 'archive',
        status: 'applied',
        confidence: decision.confidence,
      });
      continue;
    }

    if (decision.action === 'reply') {
      if (!effectivePolicy.allowReply) {
        console.warn('[decisionEngine] skipped reply by policy', { messageId: decision.messageId });
        results.push({
          messageId: decision.messageId,
          action: 'reply',
          status: 'skipped',
          reason: 'Reply action is disabled by policy.',
          confidence: decision.confidence,
        });
        continue;
      }

      if (!decision.replyDraft) {
        console.warn('[decisionEngine] skipped reply due to missing draft', { messageId: decision.messageId });
        results.push({
          messageId: decision.messageId,
          action: 'reply',
          status: 'skipped',
          reason: 'Missing replyDraft content.',
          confidence: decision.confidence,
        });
        continue;
      }

      const draft = await buildReplyDraft(accessToken, decision);
      if (!draft.ok) {
        const status = draft.reason === 'unsafe_reply_recipient' ? 'skipped' : 'error';
        results.push({
          messageId: decision.messageId,
          action: 'reply',
          status,
          reason: draft.reason,
          confidence: decision.confidence,
        });
        continue;
      }

      replyDrafts.push({
        messageId: decision.messageId,
        confidence: decision.confidence,
        raw: draft.raw,
        threadId: draft.threadId,
      });
      results.push({
        messageId: decision.messageId,
        action: 'reply',
        status: 'applied',
        reason: 'Reply draft planned (not sent).',
        confidence: decision.confidence,
      });
    }
  }

  console.info('[decisionEngine] execution summary', {
    requested: decisions.length,
    deleteQueued: deleteIds.length,
    archiveQueued: archiveIds.length,
    replyDraftsQueued: replyDrafts.length,
  });

  // Phase 2: execution (perform Gmail writes)
  if (deleteIds.length > 0) {
    try {
      await batchTrash(accessToken, deleteIds);
    } catch (err: any) {
      console.error('[decisionEngine] batchTrash failed', {
        count: deleteIds.length,
        error: err?.message || err,
      });
      for (const item of results) {
        if (item.action === 'delete' && item.status === 'applied') {
          item.status = 'error';
          item.reason = err?.message || 'Failed to trash message(s).';
        }
      }
    }
  }

  if (archiveIds.length > 0) {
    try {
      await batchArchive(accessToken, archiveIds);
    } catch (err: any) {
      console.error('[decisionEngine] batchArchive failed', {
        count: archiveIds.length,
        error: err?.message || err,
      });
      for (const item of results) {
        if (item.action === 'archive' && item.status === 'applied') {
          item.status = 'error';
          item.reason = err?.message || 'Failed to archive message(s).';
        }
      }
    }
  }

  if (replyDrafts.length > 0) {
    for (const draft of replyDrafts) {
      try {
        await createDraft(accessToken, draft.raw, draft.threadId);
        console.info('[decisionEngine] drafted reply', { messageId: draft.messageId });
        for (const item of results) {
          if (item.action === 'reply' && item.messageId === draft.messageId && item.status === 'applied') {
            item.reason = 'Reply drafted (not sent).';
          }
        }
      } catch (err: any) {
        console.error('[decisionEngine] reply draft failed', {
          messageId: draft.messageId,
          error: err?.message || err,
        });
        for (const item of results) {
          if (item.action === 'reply' && item.messageId === draft.messageId && item.status === 'applied') {
            item.status = 'error';
            item.reason = err?.message || 'Failed to create reply draft.';
          }
        }
      }
    }
  }

  const executionResult: ExecuteDecisionsResult = {
    applied: {
      delete: results.filter(r => r.action === 'delete' && r.status === 'applied').length,
      archive: results.filter(r => r.action === 'archive' && r.status === 'applied').length,
      keep: results.filter(r => r.action === 'keep' && r.status === 'applied').length,
      reply: results.filter(r => r.action === 'reply' && r.status === 'applied').length,
    },
    skipped: results.filter(r => r.status === 'skipped').length,
    errors: results.filter(r => r.status === 'error').length,
    results,
  };

  console.info('[decisionEngine] execution results', {
    applied: executionResult.applied,
    skipped: executionResult.skipped,
    errors: executionResult.errors,
  });

  return executionResult;
}
