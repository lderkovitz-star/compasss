import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { deriveAxes, synthesise } from '@/lib/ai/synthesis';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MASTER_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

/**
 * Ranks a registry against a free-text query.
 *
 * The columns come from the query rather than a fixed set - ask about tempo
 * and diplomacy and those are the columns - which is why the axes are decided
 * once, up front, and every candidate is then scored against the same ones.
 * Scoring each row separately with its own axes would produce a table whose
 * columns mean something different in every line.
 *
 * One model call per candidate, so the shortlist is capped and taken from the
 * candidates who already score well. Repeat queries come from storage.
 */
const SHORTLIST = 8;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  const limit = await consumeRateLimit(`talent-rank:${auth.id}`, 10, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'That is a lot of ranking in one minute. Give it a moment.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const query = body && typeof body.query === 'string' ? body.query.trim() : '';
  const sourceParam = (body?.source ?? 'LIVE').toString().toUpperCase();
  const source = sourceParam === 'SANDBOX' ? 'SANDBOX' : 'LIVE';

  if (query.length < 3) {
    return NextResponse.json(
      { error: 'Describe what you are looking for in a little more detail.' },
      { status: 400 }
    );
  }

  const entries = await prisma.talentRegistryEntry.findMany({
    where: { source },
    orderBy: [{ decisionScore: 'desc' }, { createdAt: 'desc' }],
    take: SHORTLIST,
    select: {
      id: true,
      sessionId: true,
      name: true,
      email: true,
      decisionScore: true,
      percentile: true,
      isHighSignal: true,
    },
  });

  if (entries.length === 0) {
    return NextResponse.json({ ok: true, axes: [], rows: [], note: 'This registry is empty.' });
  }

  try {
    const axes = await deriveAxes(query);

    const rows = [];
    const failures: string[] = [];

    for (const entry of entries) {
      try {
        const { payload, cached } = await synthesise(entry.sessionId, query, { axes });
        rows.push({
          id: entry.id,
          sessionId: entry.sessionId,
          name: entry.name,
          email: entry.email,
          decisionScore: entry.decisionScore,
          percentile: entry.percentile,
          isHighSignal: entry.isHighSignal,
          // One value per axis, in the order the axes were fixed.
          scores: axes.map((_, i) => payload.radar.candidate[i] ?? null),
          matchScore: payload.matchScore,
          profileBadge: payload.profileBadge,
          topArchetype: payload.archetypes[0]?.name ?? null,
          cached,
        });
      } catch {
        // One candidate that cannot be scored should not empty the table.
        failures.push(entry.name ?? entry.sessionId.slice(0, 8));
      }
    }

    rows.sort((a, b) => b.matchScore - a.matchScore);

    await prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: auth.id,
        action: 'talent.rank',
        targetType: 'TalentRegistryEntry',
        meta: { source, query: query.slice(0, 500), ranked: rows.length, axes },
      },
    });

    return NextResponse.json({
      ok: true,
      axes,
      rows,
      considered: entries.length,
      note: failures.length
        ? `${failures.length} candidate(s) could not be scored for this query: ${failures.join(', ')}.`
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'The ranking could not be produced.' },
      { status: 400 }
    );
  }
}
