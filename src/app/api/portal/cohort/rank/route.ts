import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireClient } from '@/lib/portal-auth';
import { deriveAxes, synthesise } from '@/lib/ai/synthesis';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Ranks this employer's own candidates against a job spec.
 *
 * Three things decide the order, and all three reach the model: the
 * dispositions and timing from the simulation, the resume, and the spec
 * itself. The axes are derived once from the spec and every candidate is then
 * scored on those same axes - scoring each one on its own axes would produce a
 * table whose columns mean something different in every row.
 *
 * One model call per candidate, so the whole ledger is pre-ranked on stored
 * scores and only the top of it is synthesised. Repeat questions about the
 * same person on the same model are answered from storage.
 */
const SHORTLIST = 10;

/** A dimension one scenario could move is a choice, not a measurement. */
const THIN_EVIDENCE = 3;

export async function POST(req: NextRequest) {
  const principal = await requireClient();
  if (principal instanceof NextResponse) return principal;

  const limit = await consumeRateLimit(`cohort-rank:${principal.clientAccountId}`, 6, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'That is a lot of ranking in one minute. Give it a moment.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  let jobSpec = body && typeof body.query === 'string' ? body.query.trim() : '';
  const jobContextId =
    body && typeof body.jobContextId === 'string' ? body.jobContextId : null;

  // A saved job context is the usual case: the spec was already written when
  // the invite went out, so there is nothing to retype.
  if (!jobSpec && jobContextId) {
    const context = await prisma.jobContext.findFirst({
      where: { id: jobContextId, clientAccountId: principal.clientAccountId },
      select: { title: true, descriptionText: true },
    });
    if (!context) {
      return NextResponse.json({ error: 'That role could not be found.' }, { status: 404 });
    }
    jobSpec = [context.title, context.descriptionText].filter(Boolean).join('\n\n').trim();
  }

  if (jobSpec.length < 10) {
    return NextResponse.json(
      { error: 'Describe the role in a little more detail, or pick a saved one.' },
      { status: 400 }
    );
  }

  const sessions = await prisma.assessmentSession.findMany({
    where: {
      clientAccountId: principal.clientAccountId,
      kind: 'OFFICIAL',
      status: 'COMPLETED',
    },
    orderBy: { completedAt: 'desc' },
    select: {
      id: true,
      completedAt: true,
      user: { select: { name: true, email: true, targetRole: true } },
      jobContext: { select: { title: true } },
      finalScores: {
        where: { exercised: true },
        select: { finalScore: true, scenariosScored: true },
      },
    },
  });

  if (sessions.length === 0) {
    return NextResponse.json({
      ok: true,
      axes: [],
      rows: [],
      note: 'No completed assessments in this ledger yet.',
    });
  }

  // Pre-rank on what is already stored, so the model is only asked about the
  // part of the ledger that could plausibly lead.
  const scored = sessions.map((s) => {
    const solid = s.finalScores.filter((f) => f.scenariosScored >= THIN_EVIDENCE);
    const basis = solid.length ? solid : s.finalScores;
    const decisionScore = basis.length
      ? Math.round(basis.reduce((sum, f) => sum + f.finalScore, 0) / basis.length)
      : 0;
    return { ...s, decisionScore };
  });

  const byDecision = [...scored].sort((a, b) => b.decisionScore - a.decisionScore);
  const decisionRank = new Map(byDecision.map((s, i) => [s.id, i]));
  const shortlist = byDecision.slice(0, SHORTLIST);

  try {
    const axes = await deriveAxes(jobSpec);

    const rows: {
      sessionId: string;
      name: string;
      email: string | null;
      role: string | null;
      completedAt: string | null;
      decisionScore: number;
      scores: (number | null)[];
      matchScore: number;
      profileBadge: string;
      topArchetype: string | null;
      summary: string | null;
      cached: boolean;
      isWildCard: boolean;
    }[] = [];
    const failures: string[] = [];

    for (const s of shortlist) {
      try {
        const { payload, cached } = await synthesise(s.id, jobSpec, { axes });
        rows.push({
          sessionId: s.id,
          name: s.user?.name ?? 'Candidate',
          email: s.user?.email ?? null,
          role: s.jobContext?.title ?? s.user?.targetRole ?? null,
          completedAt: s.completedAt?.toISOString() ?? null,
          decisionScore: s.decisionScore,
          scores: axes.map((_, i) => payload.radar.candidate[i] ?? null),
          matchScore: payload.matchScore,
          profileBadge: payload.profileBadge,
          topArchetype: payload.archetypes[0]?.name ?? null,
          summary: payload.archetypes[0]?.blurb ?? null,
          cached,
          isWildCard: false,
        });
      } catch {
        // One candidate the model cannot score should not empty the table.
        failures.push(s.user?.name ?? s.id.slice(0, 8));
      }
    }

    rows.sort((a, b) => b.matchScore - a.matchScore);

    // A wild card is someone this role wants who an ordinary screen would have
    // passed over: near the top on fit, in the bottom half on raw score.
    // Below a handful of candidates "top third" and "bottom half" describe the
    // same two or three people, so the flag stays off.
    const WILD_CARD_MIN_COHORT = 5;
    if (rows.length >= WILD_CARD_MIN_COHORT) {
      const topThird = Math.ceil(rows.length / 3);
      const bottomHalfStarts = Math.ceil(scored.length / 2);
      rows.forEach((row, i) => {
        const rank = decisionRank.get(row.sessionId);
        row.isWildCard = i < topThird && rank !== undefined && rank >= bottomHalfStarts;
      });
    }

    await prisma.auditLog.create({
      data: {
        actorType: 'CLIENT',
        actorId: principal.clientAccountId,
        action: 'cohort.rank',
        targetType: 'ClientAccount',
        targetId: principal.clientAccountId,
        meta: { ranked: rows.length, considered: sessions.length, axes },
      },
    });

    return NextResponse.json({
      ok: true,
      axes,
      rows,
      considered: sessions.length,
      shortlisted: shortlist.length,
      note: failures.length
        ? `${failures.length} candidate(s) could not be scored for this role: ${failures.join(', ')}.`
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'The ranking could not be produced.',
      },
      { status: 400 }
    );
  }
}
