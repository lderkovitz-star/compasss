import { Prisma } from '@prisma/client';
import { prisma } from './db';

/**
 * The pgvector side of the Talent Registry search.
 *
 * Each entry's embedding is also kept in embedding_vector, a vector(1536)
 * column, and similarity search runs in the database with cosine distance
 * (pgvector's <=> operator), returning only the nearest entries. Before, every
 * search loaded every candidate's embedding into the app and compared them
 * there. Prisma has no vector type, so these queries are written in SQL.
 */

/** The column's size: the default embedding model, text-embedding-3-small. */
export const VECTOR_DIMENSIONS = 1536;

/** pgvector's text form, [0.1,0.2,...]. Refuses anything that is not a finite number. */
export function toVectorLiteral(vector: number[]): string {
  if (!vector.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    throw new Error('An embedding contained a value that is not a finite number.');
  }
  return `[${vector.join(',')}]`;
}

/**
 * Stores an entry's vector. An embedding of another size cannot go in the
 * column, so it is cleared and the entry is searched through its JSON copy.
 */
export async function storeEmbeddingVector(entryId: string, vector: number[]): Promise<boolean> {
  if (vector.length !== VECTOR_DIMENSIONS) {
    await prisma.$executeRaw`UPDATE "talent_registry_entries" SET "embedding_vector" = NULL WHERE "id" = ${entryId}`;
    return false;
  }
  const literal = toVectorLiteral(vector);
  await prisma.$executeRaw`UPDATE "talent_registry_entries" SET "embedding_vector" = ${literal}::vector WHERE "id" = ${entryId}`;
  return true;
}

export type VectorMatch = { id: string; similarity: number };

/**
 * The entries of one registry nearest to a query vector, nearest first.
 * Only vectors from the same model are compared: vectors from different
 * models are not comparable even when they are the same length.
 */
export async function searchRegistryByVector(
  source: string,
  vector: number[],
  model: string,
  limit: number
): Promise<VectorMatch[]> {
  const literal = toVectorLiteral(vector);
  const take = Prisma.raw(String(Math.max(1, Math.floor(limit))));
  const rows = await prisma.$queryRaw<{ id: string; distance: number }[]>`
    SELECT "id", ("embedding_vector" <=> ${literal}::vector)::float8 AS "distance"
    FROM "talent_registry_entries"
    WHERE "source" = ${source}
      AND "embedding_vector" IS NOT NULL
      AND "embedding_model" = ${model}
    ORDER BY "embedding_vector" <=> ${literal}::vector
    LIMIT ${take}`;
  // Cosine distance is 1 minus cosine similarity.
  return rows.map((row) => ({ id: row.id, similarity: 1 - Number(row.distance) }));
}

/** How many entries of a registry the vector search cannot reach yet. */
export async function countWithoutVector(source: string): Promise<number> {
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS "count" FROM "talent_registry_entries"
    WHERE "source" = ${source} AND "embedding_vector" IS NULL`;
  return Number(row?.count ?? 0);
}

/** Ids of entries without a vector, oldest first, for the backfill script. */
export async function idsWithoutVector(limit: number, source?: string): Promise<string[]> {
  const take = Prisma.raw(String(Math.max(1, Math.floor(limit))));
  const filter = source ? Prisma.sql`AND "source" = ${source}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "talent_registry_entries"
    WHERE "embedding_vector" IS NULL ${filter}
    ORDER BY "created_at" ASC
    LIMIT ${take}`;
  return rows.map((row) => row.id);
}
