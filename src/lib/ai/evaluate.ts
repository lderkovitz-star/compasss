import { createHash } from 'crypto';
import { prisma } from '../db';
import { complete, resolveActiveProvider } from './registry';
import {
  SYSTEM_PROMPT,
  buildEvaluationPrompt,
  parseEvaluation,
  type DecisionRecord,
  type EvaluationInput,
} from './prompt';
import { ProviderError, type CandidateTier } from './types';

export type Evaluation = {
  tier: CandidateTier;
  rationale: string;
  evaluatedAt: string;
  provider: string;
  model: string;
};

type DecisionEvent = { event?: string };

/**
 * Evaluates one completed sitting.
 *
 * Every call is recorded in AiEvaluation, successes and failures alike, so a
 * report's rating can be traced to the provider, model and prompt that
 * produced it - and so a run of failures is visible rather than silent.
 */
export async function evaluateSession(
  sessionId: string,
  options: { providerKey?: string } = {}
): Promise<Evaluation> {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      completedAt: true,
      traitScores: true,
      user: {
        select: { name: true, targetRole: true, hobbiesSkills: true, resumeText: true },
      },
      package: { select: { name: true } },
      jobContext: { select: { title: true, descriptionText: true } },
      resumeDocument: { select: { parsedText: true } },
      finalScores: {
        where: { exercised: true },
        orderBy: { finalScore: 'desc' },
        select: {
          finalScore: true,
          scenariosScored: true,
          dimension: { select: { name: true } },
        },
      },
      responses: {
        orderBy: { submittedAt: 'asc' },
        select: {
          timeSpentMs: true,
          decisionPath: true,
          scenario: {
            select: {
              sequenceOrder: true,
              title: true,
              narrativeText: true,
              decisionPoint: true,
              timeLimitSec: true,
              options: {
                orderBy: [{ sortOrder: 'asc' }, { optionCode: 'asc' }],
                select: { id: true, optionCode: true, title: true, optionText: true },
              },
            },
          },
          option: { select: { id: true, optionCode: true, title: true, optionText: true } },
        },
      },
    },
  });

  if (!session) throw new Error('That assessment could not be found.');
  if (session.status !== 'COMPLETED') {
    throw new Error('This assessment is not finished yet, so there is nothing to evaluate.');
  }

  const decisions: DecisionRecord[] = session.responses.map((r) => {
    const path = (r.decisionPath as DecisionEvent[] | null) ?? [];
    return {
      sequence: r.scenario?.sequenceOrder ?? 0,
      title: r.scenario?.title ?? null,
      briefing: r.scenario?.narrativeText ?? '',
      decisionPoint: r.scenario?.decisionPoint ?? null,
      chosen: r.option
        ? { code: r.option.optionCode, title: r.option.title, text: r.option.optionText }
        : null,
      alternatives: (r.scenario?.options ?? [])
        .filter((o) => o.id !== r.option?.id)
        .map((o) => `${o.optionCode}${o.title ? ` (${o.title})` : ''}: ${o.optionText}`),
      timeSpentMs: r.timeSpentMs,
      timeLimitSec: r.scenario?.timeLimitSec ?? 90,
      revisits: path.filter((e) => e.event === 'revisit').length,
    };
  });

  const input: EvaluationInput = {
    candidateName: session.user?.name ?? 'Unnamed candidate',
    packageName: session.package?.name ?? 'Unnamed simulation',
    completedAt: (session.completedAt ?? new Date()).toISOString().slice(0, 10),
    roleTitle: session.jobContext?.title ?? session.user?.targetRole ?? null,
    jobContext: session.jobContext?.descriptionText ?? null,
    // The document attached to this sitting, falling back to whatever is on
    // the candidate record from an earlier one.
    resumeText: session.resumeDocument?.parsedText ?? session.user?.resumeText ?? null,
    candidateNotes: session.user?.hobbiesSkills ?? null,
    dimensions: session.finalScores.map((s) => ({
      name: s.dimension.name,
      score: s.finalScore,
      scenariosScored: s.scenariosScored,
    })),
    decisions,
    avgDecisionMs:
      decisions.length > 0
        ? decisions.reduce((sum, d) => sum + d.timeSpentMs, 0) / decisions.length
        : 0,
    totalRevisits: decisions.reduce((sum, d) => sum + d.revisits, 0),
  };

  const settings = await prisma.platformSettings.findFirst({
    select: { aiPromptTemplate: true },
  });

  const provider = await resolveActiveProvider(options.providerKey);
  const prompt = buildEvaluationPrompt(input, settings?.aiPromptTemplate ?? null);
  const promptHash = createHash('sha256').update(prompt).digest('hex').slice(0, 32);

  const startedAt = Date.now();

  try {
    const result = await complete(provider, { system: SYSTEM_PROMPT, prompt });
    const parsed = parseEvaluation(result.text);
    const latencyMs = Date.now() - startedAt;

    const evaluation: Evaluation = {
      tier: parsed.tier as CandidateTier,
      rationale: parsed.rationale,
      evaluatedAt: new Date().toISOString(),
      provider: provider.label,
      model: provider.model,
    };

    await prisma.aiEvaluation.create({
      data: {
        sessionId: session.id,
        providerKey: provider.key,
        providerId: provider.id,
        model: provider.model,
        tier: parsed.tier,
        rationale: parsed.rationale,
        promptHash,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs,
      },
    });

    await prisma.assessmentSession.update({
      where: { id: session.id },
      data: { aiEvaluation: evaluation as never },
    });

    return evaluation;
  } catch (err) {
    const message =
      err instanceof ProviderError || err instanceof Error
        ? err.message
        : 'The evaluation failed.';

    await prisma.aiEvaluation.create({
      data: {
        sessionId: session.id,
        providerKey: provider.key,
        providerId: provider.id,
        model: provider.model,
        promptHash,
        latencyMs: Date.now() - startedAt,
        error: message.slice(0, 1000),
      },
    });

    throw new Error(message);
  }
}

/** One cheap call, to check a key and model id from the settings panel. */
export async function testProvider(
  providerKey: string
): Promise<{ ok: true; model: string; latencyMs: number } | { ok: false; error: string }> {
  const startedAt = Date.now();
  try {
    const provider = await resolveActiveProvider(providerKey);
    const result = await complete(provider, {
      prompt: 'Reply with the single word: ready',
      timeoutMs: 20_000,
    });
    const latencyMs = Date.now() - startedAt;

    await prisma.aiProviderConfig.update({
      where: { key: providerKey },
      data: { lastTestedAt: new Date(), lastTestError: null },
    });

    // That it answered at all is what this checks - the key works, the model
    // id resolves, the endpoint is reachable. The wording does not matter.
    void result;
    return { ok: true, model: provider.model, latencyMs };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'The provider could not be reached.';
    await prisma.aiProviderConfig
      .update({
        where: { key: providerKey },
        data: { lastTestedAt: new Date(), lastTestError: error.slice(0, 500) },
      })
      .catch(() => undefined);
    return { ok: false, error };
  }
}
