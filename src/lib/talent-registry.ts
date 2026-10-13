import { prisma } from './db';

/**
 * The talent registries.
 *
 * Two of them, both master-admin only. Sandbox entries come from practice runs
 * where the person ticked the opt-in; they carry no clientAccountId, so no
 * employer ledger can see them. Live entries come from real sittings across
 * every tenant - the one deliberate cross-tenant read in the product.
 */

/**
 * A "top 10%" badge on a cohort of four is meaningless, and anyone looking at
 * a demo will notice. Percentiles stay null until there is enough to rank.
 */
export const MIN_COHORT_FOR_PERCENTILES = 30;
/** Entries at or above this percentile are flagged as high signal. */
export const HIGH_SIGNAL_PERCENTILE = 90;
/** A dimension measured by fewer scenarios than this is too thin to rank on. */
const MIN_SCENARIOS_FOR_SCORE = 3;

/**
 * One number standing in for how well the person decided.
 *
 * The mean of the dimensions this sitting could actually measure. Dimensions
 * drawn from one or two scenarios are excluded: including them would let a
 * single lucky choice move someone up the registry.
 */
export async function computeDecisionScore(sessionId: string): Promise<number | null> {
  const scores = await prisma.finalScore.findMany({
    where: { sessionId, exercised: true },
    select: { finalScore: true, scenariosScored: true },
  });

  const usable = scores.filter((s) => s.scenariosScored >= MIN_SCENARIOS_FOR_SCORE);
  const pool = usable.length > 0 ? usable : scores;
  if (pool.length === 0) return null;

  return pool.reduce((sum, s) => sum + s.finalScore, 0) / pool.length;
}

/** Writes or refreshes the registry entry for a finished sitting. */
export async function recordRegistryEntry(sessionId: string): Promise<void> {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      kind: true,
      registryOptIn: true,
      practiceName: true,
      practiceEmail: true,
      practiceJobText: true,
      user: { select: { name: true, email: true, resumeText: true } },
      jobContext: { select: { descriptionText: true } },
      resumeDocument: { select: { parsedText: true } },
    },
  });

  if (!session) return;

  const isPractice = session.kind === 'PRACTICE';
  // A practice run is only kept when the person asked for it to be.
  if (isPractice && !session.registryOptIn) return;

  const decisionScore = await computeDecisionScore(sessionId);

  const data = {
    source: isPractice ? 'SANDBOX' : 'LIVE',
    name: isPractice ? session.practiceName : (session.user?.name ?? null),
    email: isPractice ? session.practiceEmail : (session.user?.email ?? null),
    jobContextText: isPractice
      ? session.practiceJobText
      : (session.jobContext?.descriptionText ?? null),
    resumeText: session.resumeDocument?.parsedText ?? session.user?.resumeText ?? null,
    decisionScore,
  };

  await prisma.talentRegistryEntry.upsert({
    where: { sessionId },
    update: data,
    create: { sessionId, ...data },
  });

  // Adding an entry changes everyone else's standing in that cohort.
  await rankRegistry(data.source);
}

/**
 * Recomputes percentiles and the high-signal flag for one registry.
 *
 * Ranking is done over the whole cohort rather than incrementally, because a
 * new entry moves every percentile around it. The cohorts are small enough
 * that this is cheaper than keeping a running distribution correct.
 */
export async function rankRegistry(source: 'SANDBOX' | 'LIVE' | string): Promise<{
  cohortSize: number;
  ranked: boolean;
}> {
  const entries = await prisma.talentRegistryEntry.findMany({
    where: { source, decisionScore: { not: null } },
    select: { id: true, decisionScore: true },
    orderBy: { decisionScore: 'asc' },
  });

  if (entries.length < MIN_COHORT_FOR_PERCENTILES) {
    // Clear anything a larger cohort left behind, so a shrinking registry
    // cannot keep showing badges it can no longer justify.
    await prisma.talentRegistryEntry.updateMany({
      where: { source },
      data: { percentile: null, isHighSignal: false, rankedAt: new Date() },
    });
    return { cohortSize: entries.length, ranked: false };
  }

  const rankedAt = new Date();
  const total = entries.length;

  await prisma.$transaction(
    entries.map((entry, index) => {
      // The share of the cohort this entry scored at least as well as.
      const percentile = Math.round(((index + 1) / total) * 100);
      return prisma.talentRegistryEntry.update({
        where: { id: entry.id },
        data: {
          percentile,
          isHighSignal: percentile >= HIGH_SIGNAL_PERCENTILE,
          rankedAt,
        },
      });
    })
  );

  return { cohortSize: total, ranked: true };
}
