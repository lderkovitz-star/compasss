import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { hiddenDemoPackageCodes } from './demo-data';

/**
 * Which packs a candidate can be sent into.
 *
 * A pack with no live scenarios used to be offered like any other. An employer
 * could invite a candidate into it, and the candidate gave consent and then
 * met "No scenarios found for this package" with no way forward, while the
 * employer's ledger showed them as in progress. The starter seed's "Corporate
 * Crisis" pack is exactly that: a name and no scenarios.
 *
 * So a pack is offered for new assessments only when it is not in the trash,
 * has at least one scenario that is not in the trash, and is not hidden demo
 * content. The same rule is checked on the server wherever a pack is chosen
 * for someone - an invitation, an assignment, the start of a sitting - so
 * hiding it from a form is never the only protection.
 */

export const EMPTY_PACK_MESSAGE =
  'That package has no scenarios yet, so a candidate would have nothing to answer. Choose another package.';

/** Packs that can be offered for new assessments. */
export function offeredPackageWhere(): Prisma.ScenarioPackageWhereInput {
  const hidden = hiddenDemoPackageCodes();
  return {
    deletedAt: null,
    scenarios: { some: { deletedAt: null } },
    ...(hidden.length > 0 ? { code: { notIn: hidden } } : {}),
  };
}

export type PackRefusal = 'missing' | 'empty';

/**
 * Why a pack cannot be chosen for a new assessment, or null if it can. A pack
 * in the trash, and hidden demo content, count as missing.
 */
export async function packRefusal(packageId: string): Promise<PackRefusal | null> {
  const hidden = hiddenDemoPackageCodes();
  const pkg = await prisma.scenarioPackage.findFirst({
    where: { id: packageId, deletedAt: null, ...(hidden.length > 0 ? { code: { notIn: hidden } } : {}) },
    select: { _count: { select: { scenarios: { where: { deletedAt: null } } } } },
  });
  if (!pkg) return 'missing';
  return pkg._count.scenarios > 0 ? null : 'empty';
}

/**
 * Why a pack cannot be assigned to an account or a platform slot, as the
 * message to show, or null if it can.
 */
export async function assignmentRefusal(packageId: string): Promise<string | null> {
  const refusal = await packRefusal(packageId);
  if (refusal === 'missing') return 'That package no longer exists.';
  if (refusal === 'empty') return 'That package has no scenarios yet, so an assessment would have nothing to run.';
  return null;
}

/**
 * Whether a sitting on this pack could be served anything. Used when a sitting
 * starts from an invitation already sent, so demo content still counts: hiding
 * it must not break a link someone already holds.
 */
export async function packHasLiveScenarios(packageId: string): Promise<boolean> {
  const live = await prisma.scenario.count({
    where: { packageId, deletedAt: null, package: { deletedAt: null } },
  });
  return live > 0;
}
