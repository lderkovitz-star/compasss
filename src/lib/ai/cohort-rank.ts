import { prisma } from '@/lib/db';
import { deriveAxes, synthesise } from './synthesis';

/**
 * Ranks one employer's candidates against a job spec.
 *
 * Three things decide the order and all three reach the model: the
 * dispositions and timing from the simulation, the resume, and the spec. The
 * axes are derived once from the spec and every candidate is scored on those
 * same axes - scoring each one on its own axes would produce a table whose
 * columns mean something different in every row.
 *
 * One model call per candidate, so the whole ledger is pre-ranked on stored
 * scores and only the top of it is synthesised. Repeat questions about the
 * same person on the same model are answered from storage.
 *
 * The employer portal and the master console both rank the same way; they
 * differ only in who is allowed to ask and for which account.
 */

const SHORTLIST = 10;

/** A dimension one scenario could move is a choice, not a measurement. */
const THIN_EVIDENCE = 3;

/**
 * Below a handful of candidates "top third" and "bottom half" describe the
 * same two people, so the wild-card flag stays off - the same rule the
 * high-signal badge follows.
 */
const WILD_CARD_MIN_COHORT = 5;

export type CohortRow = {
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
};

export type CohortRanking = {
  axes: string[];
  rows: CohortRow[];
  considered: number;
  shortlisted: number;
  note: string | null;
};

export async function rankCohort(
  clientAccountId: string,
  jobSpec: string
): Promise<CohortRanking> {
  const sessions = await prisma.assessmentSession.findMany({
    where: { clientAccountId, kind: 'OFFICIAL', status: 'COMPLETED' },
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
    return {
      axes: [],
      rows: [],
      considered: 0,
      shortlisted: 0,
      note: 'No completed assessments in this ledger yet.',
    };
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

  const axes = await deriveAxes(jobSpec);

  const rows: CohortRow[] = [];
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
  if (rows.length >= WILD_CARD_MIN_COHORT) {
    const topThird = Math.ceil(rows.length / 3);
    const bottomHalfStarts = Math.ceil(scored.length / 2);
    rows.forEach((row, i) => {
      const rank = decisionRank.get(row.sessionId);
      row.isWildCard = i < topThird && rank !== undefined && rank >= bottomHalfStarts;
    });
  }

  return {
    axes,
    rows,
    considered: sessions.length,
    shortlisted: shortlist.length,
    note: failures.length
      ? `${failures.length} candidate(s) could not be scored for this role: ${failures.join(', ')}.`
      : null,
  };
}

/** Resolves a saved job context, or the pasted text, into one spec string. */
export async function resolveJobSpec(
  clientAccountId: string,
  raw: { query?: unknown; jobContextId?: unknown }
): Promise<{ spec: string } | { error: string; status: number }> {
  let spec = typeof raw.query === 'string' ? raw.query.trim() : '';
  const jobContextId = typeof raw.jobContextId === 'string' ? raw.jobContextId : null;

  if (!spec && jobContextId) {
    const context = await prisma.jobContext.findFirst({
      where: { id: jobContextId, clientAccountId },
      select: { title: true, descriptionText: true },
    });
    if (!context) return { error: 'That role could not be found.', status: 404 };
    spec = [context.title, context.descriptionText].filter(Boolean).join('\n\n').trim();
  }

  if (spec.length < 10) {
    return {
      error: 'Describe the role in a little more detail, or pick a saved one.',
      status: 400,
    };
  }
  return { spec };
}
