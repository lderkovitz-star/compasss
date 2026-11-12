/**
 * Proves the pgvector registry search against a real database: rows with known
 * vectors come back nearest first with the right similarity, other models and
 * the other registry are left out, and an embedding of the wrong size is kept
 * out of the vector column. Every row it creates is removed again.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/test-registry-search.ts
 */
import { prisma } from '../src/lib/db';
import {
  VECTOR_DIMENSIONS,
  countWithoutVector,
  searchRegistryByVector,
  storeEmbeddingVector,
  toVectorLiteral,
} from '../src/lib/registry-vectors';

const MARKER = 'vector-search-rehearsal';
const MODEL = 'rehearsal-model';

let failures = 0;
const check = (label: string, pass: boolean, detail = '') => {
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
};

/** A unit vector pointing between axes a and b at the given mix. */
function direction(weights: Record<number, number>): number[] {
  const v = new Array(VECTOR_DIMENSIONS).fill(0);
  for (const [i, w] of Object.entries(weights)) v[Number(i)] = w;
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

async function cleanup() {
  const sessions = await prisma.assessmentSession.findMany({ where: { practiceJobText: MARKER }, select: { id: true } });
  if (sessions.length === 0) return;
  await prisma.talentRegistryEntry.deleteMany({ where: { sessionId: { in: sessions.map((s) => s.id) } } });
  await prisma.assessmentSession.deleteMany({ where: { id: { in: sessions.map((s) => s.id) } } });
}

async function entry(name: string, source: string, vector: number[] | null, model = MODEL) {
  const pack = await prisma.scenarioPackage.findFirst({ where: { deletedAt: null }, select: { id: true } });
  if (!pack) throw new Error('No scenario package to attach rehearsal sittings to.');
  const session = await prisma.assessmentSession.create({
    data: { packageId: pack.id, kind: 'PRACTICE', status: 'COMPLETED', registryOptIn: true, practiceJobText: MARKER },
    select: { id: true },
  });
  const row = await prisma.talentRegistryEntry.create({
    data: { sessionId: session.id, source, name, embeddingModel: vector ? model : null, embedding: (vector ?? undefined) as never },
    select: { id: true },
  });
  if (vector) await storeEmbeddingVector(row.id, vector);
  return row.id;
}

async function main() {
  await cleanup();

  console.log('\nNearest first, in the database');
  const exact = await entry('Exact match', 'SANDBOX', direction({ 0: 1 }));
  const close = await entry('Close', 'SANDBOX', direction({ 0: 1, 1: 0.5 }));
  const far = await entry('Far', 'SANDBOX', direction({ 1: 1 }));
  const otherModel = await entry('Other model', 'SANDBOX', direction({ 0: 1 }), 'some-other-model');
  const otherRegistry = await entry('Other registry', 'LIVE', direction({ 0: 1 }));
  const unembedded = await entry('No embedding', 'SANDBOX', null);

  const results = await searchRegistryByVector('SANDBOX', direction({ 0: 1 }), MODEL, 10);
  const ids = results.map((r) => r.id);
  const sim = (id: string) => results.find((r) => r.id === id)?.similarity ?? NaN;
  check('nearest first: exact, close, far', ids.join() === [exact, close, far].join(), ids.length + ' rows');
  check('identical vector has similarity 1', Math.abs(sim(exact) - 1) < 1e-6, sim(exact).toFixed(6));
  check('cosine similarity matches the maths (1/√1.25)', Math.abs(sim(close) - 1 / Math.sqrt(1.25)) < 1e-6, sim(close).toFixed(6));
  check('perpendicular vector has similarity 0', Math.abs(sim(far)) < 1e-6, sim(far).toFixed(6));
  check('another model is not compared', !ids.includes(otherModel));
  check('the other registry is not searched', !ids.includes(otherRegistry));
  check('an entry without an embedding is left out', !ids.includes(unembedded));
  check('limit is respected', (await searchRegistryByVector('SANDBOX', direction({ 0: 1 }), MODEL, 2)).length === 2);

  console.log('\nWhat cannot go in the column');
  const wrongSize = await entry('Wrong size', 'SANDBOX', null);
  check('a 768-long embedding is kept out of the vector column', (await storeEmbeddingVector(wrongSize, new Array(768).fill(0.1))) === false);
  const [{ isNull }] = await prisma.$queryRaw<{ isNull: boolean }[]>`
    SELECT "embedding_vector" IS NULL AS "isNull" FROM "talent_registry_entries" WHERE "id" = ${wrongSize}`;
  check('and the column is left empty', isNull === true);
  let refused = false;
  try {
    toVectorLiteral([0.1, Number.NaN]);
  } catch {
    refused = true;
  }
  check('a NaN in an embedding is refused', refused);
  const missing = await countWithoutVector('SANDBOX');
  check('entries without a vector are counted', missing >= 2, `${missing} in SANDBOX`);

  await cleanup();
  console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
}

main()
  .catch(async (error) => {
    console.error(error);
    failures++;
  })
  .finally(async () => {
    await cleanup().catch(() => undefined);
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
