/**
 * Anthropic AI Candidate Sorter
 * Background batch tiering engine — runs ONLY after assessment completion,
 * NEVER during the candidate's session, NEVER visible to the candidate.
 *
 * Produces:
 *   - Tier: TOP_TIER | MID_TIER | LOWER_TIER
 *   - Rationale: 1-paragraph human-readable summary per candidate
 */

import { prisma } from './db';

export type CandidateTier = 'TOP_TIER' | 'MID_TIER' | 'LOWER_TIER';

export interface AIEvaluation {
  tier: CandidateTier;
  rationale: string;
  evaluatedAt: string;
}

interface CandidateTrace {
  candidateName: string;
  candidateEmail: string;
  targetRole: string;
  intakeContext: string;
  packageName: string;
  traitScores: {
    decisiveness: number;
    riskTolerance: number;
    resourcePreservation: number;
  };
  avgTimeSpentMs: number;
  totalSwitches: number;
  completedAt: string;
}

async function getSettings() {
  const settings = await prisma.platformSettings.findFirst();
  return {
    apiKey: settings?.anthropicApiKey ?? null,
    promptTemplate: settings?.aiPromptTemplate ?? null,
  };
}

function buildPrompt(candidate: CandidateTrace, template: string | null): string {
  const defaultTemplate = `You are a senior talent evaluator reviewing a behavioral simulation assessment.

Candidate Information:
- Name: {{candidate_name}}
- Target Role: {{target_role}}
- Assessment Package: {{package_name}}
- Completion Date: {{completed_at}}

Candidate Intake Context (free text the candidate submitted - extract the role
title and any job requirements from it yourself):
{{intake_context}}

Behavioral Metrics:
- Decisiveness Score: {{decisiveness}}/100
- Risk Tolerance Score: {{risk_tolerance}}/100
- Resource Preservation Score: {{resource_preservation}}/100
- Average Decision Time: {{avg_time_ms}}ms
- Option Switches/Revisits: {{total_switches}}

Based on these behavioral metrics from the simulation assessment, classify this candidate into exactly one tier:
- TOP_TIER: Strong performer, recommended for immediate consideration
- MID_TIER: Average performer, worth further review
- LOWER_TIER: Below threshold, deprioritize

Respond ONLY in this exact JSON format with no additional text:
{
  "tier": "TOP_TIER" | "MID_TIER" | "LOWER_TIER",
  "rationale": "One clear paragraph (3-4 sentences) summarizing the candidate's behavioral profile and justifying the tier assignment."
}`;

  const prompt = (template || defaultTemplate)
    .replace('{{candidate_name}}', candidate.candidateName)
    .replace('{{target_role}}', candidate.targetRole)
    .replace('{{intake_context}}', candidate.intakeContext)
    .replace('{{package_name}}', candidate.packageName)
    .replace('{{completed_at}}', candidate.completedAt)
    .replace('{{decisiveness}}', String(candidate.traitScores.decisiveness))
    .replace('{{risk_tolerance}}', String(candidate.traitScores.riskTolerance))
    .replace('{{resource_preservation}}', String(candidate.traitScores.resourcePreservation))
    .replace('{{avg_time_ms}}', String(Math.round(candidate.avgTimeSpentMs)))
    .replace('{{total_switches}}', String(candidate.totalSwitches));

  return prompt;
}

async function callAnthropicAPI(apiKey: string, prompt: string): Promise<AIEvaluation> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307', // Fast, cost-effective for batch processing
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '';

  // Parse JSON response from Claude
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Anthropic response did not contain valid JSON');

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.tier || !parsed.rationale) {
    throw new Error('Anthropic response missing tier or rationale fields');
  }

  return {
    tier: parsed.tier as CandidateTier,
    rationale: parsed.rationale,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Tier a single candidate session using Anthropic AI.
 * Stores the result in AssessmentSession.aiEvaluation.
 */
export async function tierSingleCandidate(sessionId: string): Promise<AIEvaluation> {
  const { apiKey, promptTemplate } = await getSettings();
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Please add it in Admin Settings → AI Backend Config.');
  }

  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
      package: true,
      responses: {
        include: {
          option: { include: { scores: true } },
        },
      },
    },
  });

  if (!session) throw new Error('Session not found');
  if (session.status !== 'COMPLETED') throw new Error('Session is not completed yet');

  const traitScores = (session.traitScores as any) ?? {
    decisiveness: 50,
    riskTolerance: 50,
    resourcePreservation: 50,
  };

  const avgTimeSpentMs =
    session.responses.length > 0
      ? session.responses.reduce((sum, r) => sum + r.timeSpentMs, 0) / session.responses.length
      : 0;

  const totalSwitches = session.responses.reduce((sum, r) => {
    const path = (r as any).decisionPath as Array<{ event: string }> | null;
    return sum + (path?.filter(e => e.event === 'revisit').length ?? 0);
  }, 0);

  const trace: CandidateTrace = {
    candidateName: session.user.name,
    candidateEmail: session.user.email,
    targetRole: session.user.targetRole ?? 'Not specified',
    intakeContext: session.user.hobbiesSkills?.trim() || 'Not provided',
    packageName: session.package.name,
    traitScores,
    avgTimeSpentMs,
    totalSwitches,
    completedAt: session.completedAt?.toISOString() ?? new Date().toISOString(),
  };

  const prompt = buildPrompt(trace, promptTemplate);
  const evaluation = await callAnthropicAPI(apiKey, prompt);

  // Save evaluation to database
  await prisma.assessmentSession.update({
    where: { id: sessionId },
    data: { aiEvaluation: evaluation as any },
  });

  return evaluation;
}

/**
 * Batch tier all completed candidates that haven't been evaluated yet.
 * Returns summary of results.
 */
import { Prisma } from '@prisma/client';

export async function batchTierCandidates(): Promise<{
  processed: number;
  errors: number;
  results: Array<{ sessionId: string; candidateName: string; tier?: CandidateTier; rationale?: string; evaluatedAt?: string; error?: string }>;
}> {
  const { apiKey } = await getSettings();
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Please add it in Admin Settings → AI Backend Config.');
  }

  // Find completed sessions without AI evaluation
  const sessions = await prisma.assessmentSession.findMany({
    where: {
      status: 'COMPLETED',
      // In Prisma, filtering JSON fields for null uses Prisma.DbNull
      aiEvaluation: { equals: Prisma.AnyNull },
    },
    include: { user: true },
    take: 50, // Process up to 50 at a time
  });

  const results = [];
  let errors = 0;

  for (const session of sessions) {
    try {
      const evaluation = await tierSingleCandidate(session.id);
      results.push({
        sessionId: session.id,
        candidateName: session.user.name,
        tier: evaluation.tier,
        rationale: evaluation.rationale,
        evaluatedAt: evaluation.evaluatedAt,
      });
    } catch (err) {
      errors++;
      results.push({
        sessionId: session.id,
        candidateName: session.user.name,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { processed: sessions.length - errors, errors, results };
}
