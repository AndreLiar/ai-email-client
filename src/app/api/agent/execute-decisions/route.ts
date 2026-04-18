import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { getValidAccessToken } from '@/services/auth';
import { executeDecisions } from '@/services/decisionEngine';
import { validateAndGetDecisions } from '@/services/decisionPreviewStore';
import { saveDecisionExecution, getDecisionPreview } from '@/services/storage';
import type { EmailDecision } from '@/types/agent';
import { isUserSubscribed } from '@/services/subscription';

const MAX_SELECTED_DECISIONS = 100;

const requestSchema = z.object({
  previewId: z.string().min(1),
  selectedDecisionIds: z.array(z.string().min(1)),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = body as { selectedDecisionIds?: unknown[] };
    const rawSelectedDecisionIds: unknown[] = Array.isArray(payload.selectedDecisionIds)
      ? payload.selectedDecisionIds
      : [];
    const dedupedSelectedDecisionIds: string[] = Array.from(
      new Set(
        rawSelectedDecisionIds.filter(
          (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0
        )
      )
    );

    if (dedupedSelectedDecisionIds.length === 0) {
      return NextResponse.json(
        { error: 'selectedDecisionIds must contain at least one decision ID.' },
        { status: 400 }
      );
    }

    if (dedupedSelectedDecisionIds.length > MAX_SELECTED_DECISIONS) {
      return NextResponse.json(
        { error: `selectedDecisionIds exceeds maximum allowed (${MAX_SELECTED_DECISIONS}).` },
        { status: 400 }
      );
    }

    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          issues: parsed.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await isUserSubscribed(userId))) {
      return NextResponse.json({ error: 'Upgrade required to execute actions' }, { status: 403 });
    }

    const accessToken = await getValidAccessToken(userId);

    let validatedDecisions: EmailDecision[];
    try {
      validatedDecisions = validateAndGetDecisions(
        parsed.data.previewId,
        dedupedSelectedDecisionIds,
        userId
      );
    } catch (inMemoryErr: any) {
      if (!inMemoryErr?.message?.includes('Invalid or expired previewId')) throw inMemoryErr;
      // In-memory session expired — fall back to DB
      const stored = await getDecisionPreview(parsed.data.previewId);
      if (!stored) throw inMemoryErr;
      if (stored.userId !== userId) {
        return NextResponse.json({ error: 'Preview session does not belong to this user.' }, { status: 403 });
      }
      const storedById = new Map(
        (stored.decisions as Array<EmailDecision & { decisionId?: string }>)
          .filter(d => d.decisionId)
          .map(d => [d.decisionId!, d])
      );
      const seen = new Set<string>();
      validatedDecisions = [];
      for (const id of dedupedSelectedDecisionIds) {
        if (seen.has(id)) return NextResponse.json({ error: `Duplicate decision ID: ${id}` }, { status: 400 });
        seen.add(id);
        const d = storedById.get(id);
        if (!d) return NextResponse.json({ error: `Unknown decision ID for preview: ${id}` }, { status: 400 });
        const { decisionId: _id, ...decision } = d;
        validatedDecisions.push(decision);
      }
    }

    const result = await executeDecisions({
      accessToken,
      decisions: validatedDecisions,
      policy: {
        deleteThreshold: 0.9,
        archiveThreshold: 0.75,
      },
    });

    await saveDecisionExecution({
      previewId: parsed.data.previewId,
      userId,
      selectedDecisionIds: dedupedSelectedDecisionIds,
      result: {
        applied: result.applied,
        skipped: result.skipped,
        errors: result.errors,
      },
      executedAt: Date.now(),
    });

    return NextResponse.json(result);
  } catch (err: any) {
    if (
      typeof err?.message === 'string' &&
      (
        err.message.includes('previewId') ||
        err.message.includes('selectedDecisionIds') ||
        err.message.includes('Unknown decision ID') ||
        err.message.includes('user scope') ||
        err.message.includes('userId') ||
        err.message.includes('this user')
      )
    ) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (err?.message?.includes('Gmail not connected')) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 403 });
    }

    console.error('[execute-decisions] error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to execute decisions' }, { status: 500 });
  }
}
