import type { CandidateTier, EvaluationInputs } from './ai-sorter';

/** Plain-data view of a stored AssessmentSession.aiEvaluation, shared by the admin and employer reports. */
export interface StoredEvaluation {
  tier: CandidateTier;
  rationale: string;
  evaluatedAt: string;
  inputs?: EvaluationInputs;
}

export const TIER_VIEW: Record<CandidateTier, { label: string; classes: string }> = {
  TOP_TIER: { label: 'Top Tier', classes: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  MID_TIER: { label: 'Mid Tier', classes: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  LOWER_TIER: { label: 'Lower Tier', classes: 'bg-red-50 border-red-200 text-red-700' },
};

/** Reads the JSON column defensively: anything that is not a complete evaluation is "none". */
export function readEvaluation(value: unknown): StoredEvaluation | null {
  const v = value as Partial<StoredEvaluation> | null;
  if (!v || typeof v !== 'object' || !v.tier || !(v.tier in TIER_VIEW) || typeof v.rationale !== 'string') {
    return null;
  }
  return v as StoredEvaluation;
}

/** What the evaluation was given, as short labels. Evaluations saved before inputs were recorded have none. */
export function inputLabels(inputs: EvaluationInputs | undefined): string[] {
  if (!inputs) return [];
  return [
    inputs.roleRequirements ? 'Role requirements' : null,
    inputs.intakeContext ? 'Intake context' : null,
    inputs.resume === 'read' ? 'Resume' : inputs.resume === 'unreadable' ? 'Resume (unreadable)' : null,
    inputs.scenarioChoices ? `${inputs.scenarioChoices} scenario choices` : null,
    inputs.dimensionScores ? `${inputs.dimensionScores} dimension scores` : null,
  ].filter((label): label is string => label !== null);
}
