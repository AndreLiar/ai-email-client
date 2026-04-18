import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { getValidAccessToken } from '@/services/auth';
import { runDecisionEngine } from '@/services/decisionEngine';
import { createPreviewSession } from '@/services/decisionPreviewStore';
import { saveDecisionPreview } from '@/services/storage';

const requestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    const accessToken = await getValidAccessToken(userId);

    const batch = await runDecisionEngine({
      accessToken,
      query: parsed.data.query,
      limit: parsed.data.limit,
    });

    const { previewId, decisionsWithIds } = createPreviewSession(userId, batch.decisions);

    await saveDecisionPreview({
      previewId,
      userId,
      query: parsed.data.query,
      limit: parsed.data.limit ?? null,
      summary: batch.summary,
      scoring: batch.scoring,
      decisions: decisionsWithIds,
      dropped: batch.dropped ?? 0,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      ...batch,
      previewId,
      decisions: decisionsWithIds,
    });
  } catch (err: any) {
    if (err?.message?.includes('Gmail not connected')) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 403 });
    }

    console.error('[decide] error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to generate decisions' }, { status: 500 });
  }
}
