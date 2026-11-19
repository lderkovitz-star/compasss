import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import {
  MIN_COHORT_FOR_PERCENTILES,
  HIGH_SIGNAL_PERCENTILE,
  rankRegistry,
} from '@/lib/talent-registry';
import { VECTOR_DIMENSIONS, countWithoutVector, searchRegistryByVector } from '@/lib/registry-vectors';

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

  // Similarity search when the configured provider can embed, matching on
  // meaning rather than on the words someone happened to type. Which of the
  // two ran is reported, because a search that silently changed behaviour
  // would be worse than one that did less.
  let semantic: { ids: string[]; scores: Map<string, number> } | null = null;
  let searchMode: 'similarity' | 'words' = 'words';
  let searchNote: string | null = null;

  if (query) {
    try {
      const { embed, cosineSimilarity } = await import('@/lib/ai/embeddings');
      const { vectors, model } = await embed([query]);
      const target = vectors[0];
      let matches: { id: string; similarity: number }[] = [];
      let unsearchable = 0;

      if (target.length === VECTOR_DIMENSIONS) {
        // pgvector: the database returns the nearest entries by cosine
        // distance, so no candidate's vector has to leave it.
        matches = await searchRegistryByVector(source, target, model, PAGE_SIZE);
        unsearchable = await countWithoutVector(source);
      } else {
        // A model of another size has no vector column; compare the JSON
        // copies here, as before.
        const embedded = await prisma.talentRegistryEntry.findMany({
          where: { source, NOT: { embedding: { equals: Prisma.DbNull } } },
          select: { id: true, embedding: true, embeddingModel: true },
        });
        matches = embedded
          // Vectors from different models are not comparable.
          .filter((row) => (!row.embeddingModel || row.embeddingModel === model) && Array.isArray(row.embedding))
          .map((row) => ({ id: row.id, similarity: cosineSimilarity(target, row.embedding as unknown as number[]) }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, PAGE_SIZE);
        unsearchable = await prisma.talentRegistryEntry.count({
          where: { source, embedding: { equals: Prisma.DbNull } },
        });
      }

      if (matches.length > 0) {
        semantic = { ids: matches.map((m) => m.id), scores: new Map(matches.map((m) => [m.id, m.similarity])) };
        searchMode = 'similarity';
        if (unsearchable > 0) {
          searchNote = `${unsearchable} entr${unsearchable === 1 ? 'y has' : 'ies have'} no embedding yet and ${unsearchable === 1 ? 'was' : 'were'} not included in the similarity search.`;
        }
      } else {
        searchNote = 'No entries in this registry have embeddings yet, so this matched on words.';
      }
    } catch (error) {
      // Not set up is explained by the error itself; anything else (the
      // embeddings provider down, a bad key) says what went wrong.
      const { EmbeddingsUnavailable } = await import('@/lib/ai/embeddings');
      searchNote =
        error instanceof EmbeddingsUnavailable
          ? error.message
          : `Similarity search failed (${error instanceof Error ? error.message : 'unknown error'}), so this matched on words.`;
    }
  }

  const effectiveWhere = semantic ? { source, id: { in: semantic.ids } } : where;

  const [entries, cohortSize] = await Promise.all([
    prisma.talentRegistryEntry.findMany({
      where: effectiveWhere,
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

  // Similarity order is lost by the database query, so restore it here.
  const ordered = semantic
    ? semantic.ids.map((id) => entries.find((e) => e.id === id)).filter((e): e is (typeof entries)[number] => Boolean(e))
    : entries;

  return NextResponse.json({
    source,
    searchMode,
    searchNote,
    cohortSize,
    // The client should not have to know the rule to render it honestly.
    percentilesAvailable: cohortSize >= MIN_COHORT_FOR_PERCENTILES,
    minCohortForPercentiles: MIN_COHORT_FOR_PERCENTILES,
    highSignalPercentile: HIGH_SIGNAL_PERCENTILE,
    entries: ordered.map((e) => ({
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
      similarity: semantic ? Math.round((semantic.scores.get(e.id) ?? 0) * 100) : null,
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
