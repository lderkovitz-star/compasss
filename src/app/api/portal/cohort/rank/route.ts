import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireClient } from '@/lib/portal-auth';
import { rankCohort, resolveJobSpec } from '@/lib/ai/cohort-rank';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Ranks this employer's own candidates against a job spec. */
export async function POST(req: NextRequest) {
  const principal = await requireClient();
  if (principal instanceof NextResponse) return principal;

  const limit = await consumeRateLimit(`cohort-rank:${principal.clientAccountId}`, 6, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'That is a lot of ranking in one minute. Give it a moment.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const spec = await resolveJobSpec(principal.clientAccountId, body ?? {});
  if ('error' in spec) {
    return NextResponse.json({ error: spec.error }, { status: spec.status });
  }

  try {
    const ranking = await rankCohort(principal.clientAccountId, spec.spec);

    if (ranking.rows.length > 0) {
      await prisma.auditLog.create({
        data: {
          actorType: 'CLIENT',
          actorId: principal.clientAccountId,
          action: 'cohort.rank',
          targetType: 'ClientAccount',
          targetId: principal.clientAccountId,
          meta: {
            ranked: ranking.rows.length,
            considered: ranking.considered,
            axes: ranking.axes,
          },
        },
      });
    }

    return NextResponse.json({ ok: true, ...ranking });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'The ranking could not be produced.',
      },
      { status: 400 }
    );
  }
}
