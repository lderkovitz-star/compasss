import type { Prisma } from '@prisma/client';

/**
 * The starter demo content that prisma/seed.ts loads into a brand-new
 * database, and the one setting that decides whether anyone sees it.
 *
 * On a live deployment it sat next to real data: a sample candidate on the
 * dashboard and in the coordinator, a five-scenario sample pack shown as the
 * active package, an empty sample pack employers could send candidates into,
 * and ten sample dimensions listed beside the client pack's own (Systemic
 * Thinking next to Systems Thinking).
 *
 * It is hidden, not deleted: the rows stay in the database for testing and
 * walkthroughs. Set SHOW_DEMO_DATA=true on a deployment to show it again.
 * Unset - the default, on live and locally - it is left out of every list.
 */

/** The two sample packs: "Cabin in the Woods: Survival Protocol" and "Corporate Crisis: Executive Turnaround". */
export const DEMO_PACKAGE_CODES = ['CABIN_SURVIVAL_V1', 'CORP_CRISIS_V1'];

/** The sample candidate, Alex Mercer. */
export const DEMO_CANDIDATE_EMAILS = ['alex.mercer@apex-executive.com'];

/**
 * The seed's eleven dimensions. Risk Tolerance shares its code with the client
 * pack, so a dimension is only treated as demo while no other pack scores it.
 */
export const DEMO_DIMENSION_CODES = [
  'RISK_TOLERANCE',
  'DECISION_VELOCITY',
  'EMOTIONAL_AGILITY',
  'STRATEGIC_RESILIENCE',
  'SYSTEMIC_THINKING',
  'CONFLICT_RESOLUTION',
  'ADAPTABILITY',
  'CRISIS_COMMAND',
  'COGNITIVE_LOAD',
  'ETHICS_PRESSURE',
  'ANALYTICAL_PRECISION',
];

export function showDemoData(): boolean {
  return process.env.SHOW_DEMO_DATA?.trim().toLowerCase() === 'true';
}

/** Package codes to leave out of lists; empty when demo data is shown. */
export function hiddenDemoPackageCodes(): string[] {
  return showDemoData() ? [] : DEMO_PACKAGE_CODES;
}

/** Leaves the sample packs out of a package query. */
export function withoutDemoPackages(): Prisma.ScenarioPackageWhereInput {
  return showDemoData() ? {} : { code: { notIn: DEMO_PACKAGE_CODES } };
}

/** Leaves the sample candidate out of a candidate query. */
export function withoutDemoCandidates(): Prisma.UserWhereInput {
  return showDemoData() ? {} : { email: { notIn: DEMO_CANDIDATE_EMAILS } };
}

/**
 * Leaves the sample candidate's sitting out of a sitting query. Practice runs
 * have no candidate record and are kept.
 */
export function withoutDemoSessions(): Prisma.AssessmentSessionWhereInput {
  return showDemoData() ? {} : { NOT: { user: { email: { in: DEMO_CANDIDATE_EMAILS } } } };
}

/**
 * Leaves out the sample dimensions that nothing but the sample packs scores,
 * apart from any in `keepIds` (for example, ones the scenario being edited
 * already uses).
 */
export function withoutDemoDimensions(keepIds: string[] = []): Prisma.DimensionWhereInput {
  if (showDemoData()) return {};
  return {
    OR: [
      { code: { notIn: DEMO_DIMENSION_CODES } },
      { id: { in: keepIds } },
      { optionScores: { some: { option: { scenario: { package: { code: { notIn: DEMO_PACKAGE_CODES } } } } } } },
    ],
  };
}
