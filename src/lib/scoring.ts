import { prisma } from './db';

/**
 * Server-side only scoring engine.
 * NEVER import this from any client component or API route that the candidate can access during a test.
 *
 * Deterministic Rubric:
 *   - Decisiveness      (0-100): Speed of first action, dwell time, option switch frequency
 *   - Risk Tolerance    (0-100): Risk level of chosen options under time pressure
 *   - ResourcePreservation (0-100): Conservative vs aggressive option tradeoffs
 *
 * Same inputs → exact same scores every time.
 */

export interface DecisionEvent {
  optionId: string;
  event: 'hover' | 'click' | 'revisit';
  timestampMs: number;
}

export interface TraitScores {
  decisiveness: number;
  riskTolerance: number;
  resourcePreservation: number;
}

/**
 * Deterministic 3-trait rubric.
 * Called once all responses are collected for a session.
 */
export function computeDeterministicTraits(
  responses: Array<{
    timeSpentMs: number;
    timeLimitSec: number;
    decisionPath: DecisionEvent[] | null;
    optionWeightScore?: number; // raw dimension weight (positive = high risk, negative = conservative)
  }>
): TraitScores {
  if (responses.length === 0) {
    return { decisiveness: 50, riskTolerance: 50, resourcePreservation: 50 };
  }

  // ── DECISIVENESS ─────────────────────────────────────────────────────────────
  // Faster first action + fewer switches = higher decisiveness
  let totalDecisivenessPoints = 0;
  for (const r of responses) {
    const switchCount = (r.decisionPath || []).filter(e => e.event === 'revisit').length;
    const timeRatio = Math.min(1, r.timeSpentMs / (r.timeLimitSec * 1000));
    // Invert timeRatio: faster = higher score
    const speedScore = (1 - timeRatio) * 60; // max 60 points from speed
    const stabilityScore = Math.max(0, 40 - switchCount * 10); // max 40 from stability
    totalDecisivenessPoints += speedScore + stabilityScore;
  }
  const decisiveness = Math.min(100, Math.round(totalDecisivenessPoints / responses.length));

  // ── RISK TOLERANCE ────────────────────────────────────────────────────────────
  // High weight score options = high risk tolerance
  // Calculated from positive dimension weight scores
  const riskScores = responses.map(r => {
    const w = r.optionWeightScore ?? 0;
    // Normalize raw weight to 0-100: assume max possible weight per option is 100, min is -100
    return Math.min(100, Math.max(0, (w + 100) / 2));
  });
  const riskTolerance = Math.round(
    riskScores.reduce((a, b) => a + b, 0) / riskScores.length
  );

  // ── RESOURCE PRESERVATION ─────────────────────────────────────────────────────
  // Inverted risk: more conservative (lower weight score) = higher resource preservation
  const resourcePreservation = Math.min(100, Math.max(0, 100 - riskTolerance));

  return { decisiveness, riskTolerance, resourcePreservation };
}

export async function computeAndStoreScoreSnapshot(
  sessionId: string,
  scenarioId: string,
  optionId: string,
  timeSpentMs: number,
  decisionPath?: DecisionEvent[]
) {
  // Store the response with decision path telemetry
  await prisma.response.create({
    data: {
      sessionId,
      scenarioId,
      optionId,
      timeSpentMs,
      startedAt: new Date(Date.now() - timeSpentMs),
      decisionPath: decisionPath ? (decisionPath as any) : undefined,
    },
  });

  // Get all dimension scores for chosen option
  const optionScores = await prisma.optionScore.findMany({
    where: { optionId },
    include: { dimension: true },
  });

  // Get current cumulative scores for this session
  const existingSnapshots = await prisma.scoreSnapshot.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
  });

  // Build a map of latest cumulative per dimension
  const cumulMap: Record<string, number> = {};
  for (const snap of existingSnapshots) {
    if (!cumulMap[snap.dimensionId]) {
      cumulMap[snap.dimensionId] = snap.cumulativeScore;
    }
  }

  // Create new snapshots
  for (const os of optionScores) {
    const prev = cumulMap[os.dimensionId] ?? 0;
    await prisma.scoreSnapshot.create({
      data: {
        sessionId,
        scenarioId,
        dimensionId: os.dimensionId,
        cumulativeScore: prev + os.weightScore,
      },
    });
  }
}

export async function computeFinalScores(sessionId: string) {
  // Get all snapshots for this session, latest per dimension
  const snapshots = await prisma.scoreSnapshot.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
  });

  const latestPerDim: Record<string, number> = {};
  for (const s of snapshots) {
    if (!(s.dimensionId in latestPerDim)) {
      latestPerDim[s.dimensionId] = s.cumulativeScore;
    }
  }

  // Upsert final dimension scores
  for (const [dimensionId, score] of Object.entries(latestPerDim)) {
    const normalized = Math.min(100, Math.round((score / 500) * 100));
    await prisma.finalScore.upsert({
      where: { sessionId_dimensionId: { sessionId, dimensionId } } as never,
      update: { finalScore: normalized, percentileRank: Math.min(99, normalized) },
      create: {
        sessionId,
        dimensionId,
        finalScore: normalized,
        percentileRank: Math.min(99, normalized),
      },
    });
  }

  // Compute deterministic 3-trait scores from all responses in this session
  const responses = await prisma.response.findMany({
    where: { sessionId },
    include: {
      scenario: { select: { timeLimitSec: true } },
      option: {
        include: {
          scores: { select: { weightScore: true } },
        },
      },
    },
  });

  const traitInputs = responses.map(r => ({
    timeSpentMs: r.timeSpentMs,
    timeLimitSec: r.scenario?.timeLimitSec ?? 60,
    decisionPath: (r.decisionPath as DecisionEvent[] | null),
    optionWeightScore: r.option?.scores.reduce((sum, s) => sum + s.weightScore, 0) ?? 0,
  }));

  const traitScores = computeDeterministicTraits(traitInputs);

  // Mark session completed with trait scores
  await prisma.assessmentSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      traitScores: traitScores as any,
    },
  });
}
