/**
 * Embeds Talent Registry entries that have no vector yet - entries recorded
 * before pgvector, or while no embeddings provider had a key saved - and
 * stores both the JSON copy and the pgvector column, so they show up in
 * similarity search. Safe to run again: it only picks up what is missing.
 *
 *   npm run db:embed-registry               both registries
 *   npm run db:embed-registry -- SANDBOX    one registry (LIVE or SANDBOX)
 */
import { prisma } from '../src/lib/db';
import { EmbeddingsUnavailable, embed, searchableText } from '../src/lib/ai/embeddings';
import { idsWithoutVector, storeEmbeddingVector } from '../src/lib/registry-vectors';

const BATCH = 32;
// Same floor as recording an entry: less text than this says nothing useful.
const MIN_TEXT = 40;

async function main() {
  const source = process.argv[2]?.toUpperCase();
  if (source && source !== 'LIVE' && source !== 'SANDBOX') {
    console.error('Usage: npm run db:embed-registry -- [LIVE|SANDBOX]');
    process.exit(1);
  }

  const ids = await idsWithoutVector(100_000, source);
  const entries = await prisma.talentRegistryEntry.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, jobContextText: true, resumeText: true },
  });
  const work = entries
    .map((e) => ({ id: e.id, text: searchableText(e) }))
    .filter((e) => e.text.length >= MIN_TEXT);
  const tooShort = entries.length - work.length;

  let stored = 0;
  let notVector = 0;
  for (let i = 0; i < work.length; i += BATCH) {
    const batch = work.slice(i, i + BATCH);
    const { vectors, model } = await embed(batch.map((b) => b.text));
    for (let j = 0; j < batch.length; j++) {
      await prisma.talentRegistryEntry.update({
        where: { id: batch[j].id },
        data: { embedding: vectors[j] as never, embeddingModel: model, embeddedAt: new Date() },
      });
      if (await storeEmbeddingVector(batch[j].id, vectors[j])) stored++;
      else notVector++;
    }
    console.log(`  ${Math.min(i + BATCH, work.length)} of ${work.length} embedded`);
  }

  console.log(
    `\nDone${source ? ` (${source})` : ''}: ${stored} entr${stored === 1 ? 'y' : 'ies'} now searchable with pgvector.` +
      (notVector ? ` ${notVector} came back at a size the vector column does not hold and are searched from their JSON copy.` : '') +
      (tooShort ? ` ${tooShort} had too little text to embed.` : '')
  );
}

main()
  .catch((error) => {
    console.error(error instanceof EmbeddingsUnavailable ? `\n${error.message}\n` : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
