import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { rankCohort, resolveJobSpec } from '@/lib/ai/cohort-rank';
import { compareCandidates, MAX_COMPARE } from '@/lib/ai/cohort';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MASTER_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

/**
 * The same cohort ranking the employer sees, for one company, from the master
 * console - so a company's shortlist can be pulled up in a demo without
 * holding that company's access key.
 *
 * Reading another tenant's candidates is a deliberate cross-tenant read, so it
 * is gated on a master role and every call is audited, the same way the Live
 * talent registry is.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  const limit = await consumeRateLimit(`admin-cohort:${auth.id}`, 10, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'That is a lot of ranking in one minute. Give it a moment.' },
      { status: 429 }
    );
  }

  const account = await prisma.clientAccount.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!account) {
    return NextResponse.json({ error: 'That company could not be found.' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const mode = body?.mode === 'compare' ? 'compare' : 'rank';

  const spec = await resolveJobSpec(account.id, body ?? {});
  if ('error' in spec) {
    return NextResponse.json({ error: spec.error }, { status: spec.status });
  }

  try {
    if (mode === 'compare') {
      const ids = Array.isArray(body?.sessionIds)
        ? body.sessionIds
            .filter((v: unknown): v is string => typeof v === 'string')
            .slice(0, MAX_COMPARE)
        : [];
      if (ids.length < 2) {
        return NextResponse.json(
          { error: `Pick between two and ${MAX_COMPARE} candidates to compare.` },
          { status: 400 }
        );
      }
      const comparison = await compareCandidates(ids, account.id, spec.spec);

      await prisma.auditLog.create({
        data: {
          actorType: 'MASTER',
          actorId: auth.id,
          action: 'cohort.compare',
          targetType: 'ClientAccount',
          targetId: account.id,
          meta: { company: account.name, compared: comparison.candidates.length },
        },
      });

      return NextResponse.json({ ok: true, ...comparison });
    }

    const ranking = await rankCohort(account.id, spec.spec);

    await prisma.auditLog.create({
      data: {
        actorType: 'MASTER',
        actorId: auth.id,
        action: 'cohort.rank',
        targetType: 'ClientAccount',
        targetId: account.id,
        meta: {
          company: account.name,
          ranked: ranking.rows.length,
          considered: ranking.considered,
          axes: ranking.axes,
        },
      },
    });

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
