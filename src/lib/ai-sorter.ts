/**
 * Candidate tiering. Runs after a sitting finishes, never during it, and is
 * never shown to the candidate.
 *
 * The work now lives in src/lib/ai - provider selection, prompt assembly and
 * the call itself - because all three were hardcoded here: one vendor, one
 * model id written into the request, and a prompt that saw three aggregate
 * numbers and nothing the candidate actually did.
 *
 * This file stays as the entry point its callers already use.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { evaluateSession, type Evaluation } from './ai/evaluate';
import type { CandidateTier } from './ai/types';

export type { CandidateTier };

export interface AIEvaluation {
  tier: CandidateTier;
  rationale: string;
  evaluatedAt: string;
  provider?: string;
  model?: string;
}

export async function tierSingleCandidate(sessionId: string): Promise<AIEvaluation> {
  const evaluation: Evaluation = await evaluateSession(sessionId);
  return evaluation;
}

type BatchRow = {
  sessionId: string;
  candidateName: string;
  tier?: CandidateTier;
  rationale?: string;
  evaluatedAt?: string;
  error?: string;
};

/** How many sittings one batch run will attempt. */
const BATCH_LIMIT = 50;
/** Consecutive failures after which the batch stops. */
const GIVE_UP_AFTER = 5;

export async function batchTierCandidates(): Promise<{
  processed: number;
  errors: number;
  results: BatchRow[];
}> {
  const sessions = await prisma.assessmentSession.findMany({
    where: {
      status: 'COMPLETED',
      aiEvaluation: { equals: Prisma.AnyNull },
    },
    select: { id: true, user: { select: { name: true } } },
    orderBy: { completedAt: 'asc' },
    take: BATCH_LIMIT,
  });

  const results: BatchRow[] = [];
  let errors = 0;
  let consecutiveFailures = 0;

  for (const session of sessions) {
    const candidateName = session.user?.name ?? 'Unnamed candidate';
    try {
      const evaluation = await tierSingleCandidate(session.id);
      consecutiveFailures = 0;
      results.push({
        sessionId: session.id,
        candidateName,
        tier: evaluation.tier,
        rationale: evaluation.rationale,
        evaluatedAt: evaluation.evaluatedAt,
      });
    } catch (err) {
      errors++;
      consecutiveFailures++;
      results.push({
        sessionId: session.id,
        candidateName,
        error: err instanceof Error ? err.message : 'The evaluation failed.',
      });

      // A missing key or a wrong model id fails identically for every row.
      // Carrying on would spend the remaining attempts proving the same point.
      if (consecutiveFailures >= GIVE_UP_AFTER) {
        results.push({
          sessionId: '',
          candidateName: '',
          error: `Stopped after ${GIVE_UP_AFTER} consecutive failures. Fix the provider configuration and run this again.`,
        });
        break;
      }
    }
  }

  return { processed: results.filter((r) => r.tier).length, errors, results };
}
