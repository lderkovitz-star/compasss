import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { synthesise, synthesisCallsToday } from '@/lib/ai/synthesis';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MASTER_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

/**
 * Dynamic archetype synthesis for one candidate.
 *
 * Master-admin only, and never reachable from a candidate or employer view -
 * this reads a candidate's full decision record and sends it to a model.
 */
export async function GET() {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  const [settings, used] = await Promise.all([
    prisma.platformSettings.findFirst({ select: { synthesisDailyCallLimit: true } }),
    synthesisCallsToday(),
  ]);

  const limit = settings?.synthesisDailyCallLimit ?? 0;
  return NextResponse.json({
    callsToday: used,
    dailyLimit: limit,
    remaining: limit > 0 ? Math.max(0, limit - used) : null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  // Each call costs money, and a query bar invites rapid typing.
  const limit = await consumeRateLimit(`synthesis:${auth.id}`, 30, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'That is a lot of queries in one minute. Give it a moment.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : '';
  const query = body && typeof body.query === 'string' ? body.query : '';

  if (!sessionId) {
    return NextResponse.json({ error: 'Which candidate?' }, { status: 400 });
  }

  try {
    const result = await synthesise(sessionId, query);

    await prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: auth.id,
        action: 'talent.synthesis',
        targetType: 'AssessmentSession',
        targetId: sessionId,
        meta: { query: query.trim().slice(0, 500), cached: result.cached, model: result.model },
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // A shape failure or a provider refusal is something the reviewer needs
    // told plainly, not a blank panel.
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'The synthesis could not be produced.',
      },
      { status: 400 }
    );
  }
}
