/**
 * Records registry entries for completed sittings and recomputes percentiles.
 *
 * Entries are written as sittings finish, so this exists for two cases: a
 * sitting completed before that hook existed, and the periodic re-rank, since
 * a new entry changes the standing of everyone near it. Safe to run repeatedly.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/rank-registries.ts
 */
import { prisma } from '../src/lib/db';
import { recordRegistryEntry, rankRegistry, MIN_COHORT_FOR_PERCENTILES } from '../src/lib/talent-registry';

async function main() {
  const sittings = await prisma.assessmentSession.findMany({
    where: {
      status: 'COMPLETED',
      OR: [{ kind: 'OFFICIAL' }, { kind: 'PRACTICE', registryOptIn: true }],
      registryEntry: null,
    },
    select: { id: true, kind: true },
  });

  console.log(`${sittings.length} completed sitting(s) with no registry entry.`);
  for (const sitting of sittings) {
    await recordRegistryEntry(sitting.id);
  }

  for (const source of ['LIVE', 'SANDBOX'] as const) {
    const result = await rankRegistry(source);
    console.log(
      result.ranked
        ? `${source}: ranked ${result.cohortSize} entries.`
        : `${source}: ${result.cohortSize} of ${MIN_COHORT_FOR_PERCENTILES} entries - percentiles withheld.`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
