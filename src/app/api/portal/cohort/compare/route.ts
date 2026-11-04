import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireClient } from '@/lib/portal-auth';
import { compareCandidates, MAX_COMPARE } from '@/lib/ai/cohort';
import { resolveJobSpec } from '@/lib/ai/cohort-rank';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Two or three finalists, side by side, against the spec they are being read for. */
export async function POST(req: NextRequest) {
  const principal = await requireClient();
  if (principal instanceof NextResponse) return principal;

  const limit = await consumeRateLimit(`cohort-compare:${principal.clientAccountId}`, 12, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'That is a lot of comparing in one minute. Give it a moment.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.sessionIds)
    ? body.sessionIds.filter((v: unknown): v is string => typeof v === 'string').slice(0, MAX_COMPARE)
    : [];
  if (ids.length < 2) {
    return NextResponse.json(
      { error: `Pick between two and ${MAX_COMPARE} candidates to compare.` },
      { status: 400 }
    );
  }

  const spec = await resolveJobSpec(principal.clientAccountId, body ?? {});
  if ('error' in spec) {
    return NextResponse.json({ error: spec.error }, { status: spec.status });
  }

  try {
    const comparison = await compareCandidates(ids, principal.clientAccountId, spec.spec);

    await prisma.auditLog.create({
      data: {
        actorType: 'CLIENT',
        actorId: principal.clientAccountId,
        action: 'cohort.compare',
        targetType: 'ClientAccount',
        targetId: principal.clientAccountId,
        meta: { compared: comparison.candidates.length },
      },
    });

    return NextResponse.json({ ok: true, ...comparison });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'The comparison could not be produced.',
      },
      { status: 400 }
    );
  }
}
