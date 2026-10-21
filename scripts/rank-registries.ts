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

  // Entries created before embeddings existed, or while no provider could
  // produce them, have none. Similarity search skips those, so top them up.
  const { Prisma } = await import('@prisma/client');
  const unembedded = await prisma.talentRegistryEntry.findMany({
    where: { embedding: { equals: Prisma.DbNull } },
    select: { id: true, name: true, email: true, jobContextText: true, resumeText: true },
    take: 200,
  });

  if (unembedded.length > 0) {
    try {
      const { embed, searchableText } = await import('../src/lib/ai/embeddings');
      const usable = unembedded
        .map((e) => ({ id: e.id, text: searchableText(e) }))
        .filter((e) => e.text.length >= 40);

      if (usable.length > 0) {
        const { vectors, model } = await embed(usable.map((u) => u.text));
        for (let i = 0; i < usable.length; i++) {
          await prisma.talentRegistryEntry.update({
            where: { id: usable[i].id },
            data: { embedding: vectors[i] as never, embeddingModel: model, embeddedAt: new Date() },
          });
        }
        console.log(`Embedded ${usable.length} registry entr(y/ies) with ${model}.`);
      }
    } catch (error) {
      console.log(
        `Embeddings skipped: ${error instanceof Error ? error.message : error}`
      );
    }
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
