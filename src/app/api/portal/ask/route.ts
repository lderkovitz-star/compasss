import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireClient } from '@/lib/portal-auth';
import { askEvaluator, MAX_CANDIDATES } from '@/lib/ai/evaluator-query';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/** Questions one employer may ask per hour. Each one is a model call. */
const ASK_LIMIT = 40;
const WINDOW_SECONDS = 60 * 60;

export async function POST(req: NextRequest) {
  const portal = await requireClient();
  if (portal instanceof NextResponse) return portal;

  const limit = await consumeRateLimit(
    `ask:client:${portal.clientAccountId}`,
    ASK_LIMIT,
    WINDOW_SECONDS
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'You have reached this hour’s question limit. Answers already given are still on screen.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const question = typeof body?.question === 'string' ? body.question : '';
    const sessionIds = Array.isArray(body?.sessionIds)
      ? body.sessionIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, MAX_CANDIDATES + 1)
      : [];

    const result = await askEvaluator({
      question,
      sessionIds,
      // Always this employer's own id. The browser does not get to say which
      // tenant it is asking about.
      clientAccountId: portal.clientAccountId,
      asker: null,
    });

    await prisma.auditLog.create({
      data: {
        clientAccountId: portal.clientAccountId,
        actorType: 'CLIENT',
        action: 'evaluator.ask',
        targetType: 'EvaluatorQuery',
        meta: {
          question: question.trim().slice(0, 300),
          candidates: result.considered.length,
          cached: result.cached,
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The question could not be answered.';
    console.error('[portal ask]', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
