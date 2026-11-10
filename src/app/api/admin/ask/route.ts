import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { askEvaluator, MAX_CANDIDATES } from '@/lib/ai/evaluator-query';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const ASK_LIMIT = 60;
const WINDOW_SECONDS = 60 * 60;

/**
 * The console's question box.
 *
 * Reading is enough: asking a question about candidates changes nothing, and
 * an ASSESSOR is meant to be able to review. The cross-account reach is the
 * part that needs saying out loud - a master query with no clientAccountId
 * can draw on candidates from more than one employer, which is deliberate for
 * a training command comparing intakes and wrong for anybody else. It is
 * gated on the console session and every question is audited.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const limit = await consumeRateLimit(`ask:admin:${auth.id}`, ASK_LIMIT, WINDOW_SECONDS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'You have reached this hour’s question limit.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const question = typeof body?.question === 'string' ? body.question : '';
    const sessionIds = Array.isArray(body?.sessionIds)
      ? body.sessionIds.filter((x: unknown): x is string => typeof x === 'string').slice(0, MAX_CANDIDATES + 1)
      : [];
    // Optional: scope the question to one account. Absent means platform-wide.
    const clientAccountId =
      typeof body?.clientAccountId === 'string' && body.clientAccountId ? body.clientAccountId : null;

    const result = await askEvaluator({
      question,
      sessionIds,
      clientAccountId,
      asker: { id: auth.id, email: auth.email },
    });

    await prisma.auditLog.create({
      data: {
        clientAccountId,
        actorType: 'MASTER',
        actorId: auth.id,
        actorEmail: auth.email,
        action: 'evaluator.ask',
        targetType: 'EvaluatorQuery',
        meta: {
          question: question.trim().slice(0, 300),
          candidates: result.considered.length,
          cached: result.cached,
          crossAccount: clientAccountId === null,
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The question could not be answered.';
    console.error('[admin ask]', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
