import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import {
  MIN_COHORT_FOR_PERCENTILES,
  HIGH_SIGNAL_PERCENTILE,
  rankRegistry,
} from '@/lib/talent-registry';

export const dynamic = 'force-dynamic';

/** The registries are master-admin only. No client role may read them. */
const MASTER_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

const PAGE_SIZE = 100;

/**
 * The talent registries.
 *
 * The Live registry is the one deliberate cross-tenant read in the product -
 * it spans every employer's candidates - so it is gated on a master role and
 * every access is written to the audit log. Employer accounts never reach this
 * endpoint; their own queries are scoped to their tenant as before.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  const sourceParam = (req.nextUrl.searchParams.get('source') ?? 'LIVE').toUpperCase();
  const source = sourceParam === 'SANDBOX' ? 'SANDBOX' : 'LIVE';
  const query = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const highSignalOnly = req.nextUrl.searchParams.get('highSignal') === 'true';

  const where = {
    source,
    ...(highSignalOnly ? { isHighSignal: true } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
            { jobContextText: { contains: query, mode: 'insensitive' as const } },
            { resumeText: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [entries, cohortSize] = await Promise.all([
    prisma.talentRegistryEntry.findMany({
      where,
      orderBy: [{ decisionScore: 'desc' }, { createdAt: 'desc' }],
      take: PAGE_SIZE,
      select: {
        id: true,
        sessionId: true,
        name: true,
        email: true,
        jobContextText: true,
        decisionScore: true,
        percentile: true,
        isHighSignal: true,
        createdAt: true,
        session: {
          select: {
            completedAt: true,
            package: { select: { name: true } },
            clientAccount: { select: { name: true } },
          },
        },
      },
    }),
    prisma.talentRegistryEntry.count({ where: { source, decisionScore: { not: null } } }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorType: 'ADMIN',
      actorId: auth.id,
      action: 'talent.registry.read',
      targetType: 'TalentRegistryEntry',
      meta: { source, query: query || null, returned: entries.length },
    },
  });

  return NextResponse.json({
    source,
    cohortSize,
    // The client should not have to know the rule to render it honestly.
    percentilesAvailable: cohortSize >= MIN_COHORT_FOR_PERCENTILES,
    minCohortForPercentiles: MIN_COHORT_FOR_PERCENTILES,
    highSignalPercentile: HIGH_SIGNAL_PERCENTILE,
    entries: entries.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      name: e.name,
      email: e.email,
      // Enough to recognise the role without dumping a whole description into
      // a table cell.
      roleSummary: e.jobContextText ? e.jobContextText.slice(0, 160) : null,
      decisionScore: e.decisionScore,
      percentile: e.percentile,
      isHighSignal: e.isHighSignal,
      packageName: e.session?.package?.name ?? null,
      employerName: e.session?.clientAccount?.name ?? null,
      completedAt: e.session?.completedAt ?? e.createdAt,
    })),
  });
}

/** Recomputes percentiles for one registry. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const sourceParam = (body?.source ?? 'LIVE').toString().toUpperCase();
  const source = sourceParam === 'SANDBOX' ? 'SANDBOX' : 'LIVE';

  const result = await rankRegistry(source);

  return NextResponse.json({
    ok: true,
    source,
    ...result,
    message: result.ranked
      ? `Ranked ${result.cohortSize} entries.`
      : `${result.cohortSize} of ${MIN_COHORT_FOR_PERCENTILES} entries needed before percentiles mean anything.`,
  });
}
