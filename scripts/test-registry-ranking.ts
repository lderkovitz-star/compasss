/**
 * Proves the percentile floor and the ranking maths against a synthetic
 * cohort - the only practical way to reach thirty entries without running
 * thirty assessments. Every row it creates is removed again.
 */
import { prisma } from '../src/lib/db';
import { rankRegistry, MIN_COHORT_FOR_PERCENTILES, HIGH_SIGNAL_PERCENTILE } from '../src/lib/talent-registry';

const MARKER = 'ranking-rehearsal';

async function cleanup() {
  const sessions = await prisma.assessmentSession.findMany({
    where: { practiceJobText: MARKER },
    select: { id: true },
  });
  if (sessions.length === 0) return;
  await prisma.talentRegistryEntry.deleteMany({
    where: { sessionId: { in: sessions.map((s) => s.id) } },
  });
  await prisma.assessmentSession.deleteMany({ where: { id: { in: sessions.map((s) => s.id) } } });
}

async function main() {
  await cleanup();

  const pack = await prisma.scenarioPackage.findFirst({
    where: { deletedAt: null },
    select: { id: true },
  });
  if (!pack) throw new Error('No scenario package to attach rehearsal sittings to.');

  const before = await rankRegistry('SANDBOX');
  console.log(`\nBefore: ${before.cohortSize} sandbox entries, ranked=${before.ranked}`);

  // A spread of scores so percentile ordering is checkable.
  const scores = Array.from({ length: 34 }, (_, i) => 10 + i * 2.5);

  for (const score of scores) {
    const session = await prisma.assessmentSession.create({
      data: {
        packageId: pack.id,
        kind: 'PRACTICE',
        status: 'COMPLETED',
        completedAt: new Date(),
        registryOptIn: true,
        practiceJobText: MARKER,
        practiceName: `Rehearsal ${score}`,
      },
      select: { id: true },
    });
    await prisma.talentRegistryEntry.create({
      data: {
        sessionId: session.id,
        source: 'SANDBOX',
        name: `Rehearsal ${score}`,
        decisionScore: score,
      },
    });
  }

  const after = await rankRegistry('SANDBOX');
  console.log(`After:  ${after.cohortSize} sandbox entries, ranked=${after.ranked}`);

  const ranked = await prisma.talentRegistryEntry.findMany({
    where: { source: 'SANDBOX', decisionScore: { not: null } },
    orderBy: { decisionScore: 'desc' },
    select: { name: true, decisionScore: true, percentile: true, isHighSignal: true },
  });

  let failures = 0;
  const check = (label: string, pass: boolean, detail = '') => {
    console.log(`${pass ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
    if (!pass) failures++;
  };

  console.log(`\nCohort of ${ranked.length} (floor is ${MIN_COHORT_FOR_PERCENTILES})`);
  check('percentiles are now computed', ranked.every((r) => r.percentile !== null));
  check(
    'a higher score never gets a lower percentile',
    ranked.every((r, i) => i === 0 || (r.percentile ?? 0) <= (ranked[i - 1].percentile ?? 0))
  );
  check('the top entry is at the 100th percentile', ranked[0].percentile === 100, `got ${ranked[0].percentile}`);

  const flagged = ranked.filter((r) => r.isHighSignal);
  check(
    `high signal covers roughly the top ${100 - HIGH_SIGNAL_PERCENTILE}%`,
    flagged.length > 0 && flagged.length <= Math.ceil(ranked.length * 0.15),
    `${flagged.length} of ${ranked.length} flagged`
  );
  check(
    'every flagged entry is at or above the threshold',
    flagged.every((r) => (r.percentile ?? 0) >= HIGH_SIGNAL_PERCENTILE)
  );

  console.log('\n  top of the registry:');
  for (const r of ranked.slice(0, 4)) {
    console.log(`    ${r.name}: score ${r.decisionScore}, ${r.percentile}th${r.isHighSignal ? ', HIGH SIGNAL' : ''}`);
  }

  await cleanup();
  const restored = await rankRegistry('SANDBOX');
  const leftover = await prisma.talentRegistryEntry.findMany({
    where: { source: 'SANDBOX' },
    select: { percentile: true, isHighSignal: true },
  });
  console.log(`\nAfter removing the rehearsal rows: ${restored.cohortSize} entries, ranked=${restored.ranked}`);
  check(
    'a registry that shrinks below the floor drops its badges',
    leftover.every((r) => r.percentile === null && !r.isHighSignal)
  );

  console.log(`\n${failures === 0 ? 'All ranking checks passed.' : `${failures} check(s) failed.`}\n`);
  await prisma.$disconnect();
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (err) => {
  console.error(err);
  await cleanup();
  await prisma.$disconnect();
  process.exit(1);
});
