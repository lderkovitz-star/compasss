import { prisma } from './db';

/**
 * The scenarios one sitting runs, fixed once and then kept.
 *
 * The set used to be recomputed on every request from whatever the package
 * contained at that moment. That is fine until the package changes while
 * someone is part-way through: re-importing an edited pack, or sending a
 * scenario to the trash, would change what the candidate is served and how
 * many they are told remain - mid-sitting, with answers already given against
 * the old set.
 *
 * So the ordered list is frozen the first time the sitting asks for it and
 * read back from the session afterwards. Editing the pack then affects the
 * next candidate rather than the one currently sitting.
 */

type SessionRef = {
  id: string;
  packageId: string;
  sessionDepth: number | null;
  scenarioOrder: unknown;
};

function asIdList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return ids.length > 0 ? ids : null;
}

export async function resolveScenarioOrder(session: SessionRef): Promise<string[]> {
  const frozen = asIdList(session.scenarioOrder);
  if (frozen) return frozen;

  const available = await prisma.scenario.findMany({
    where: { packageId: session.packageId, deletedAt: null },
    orderBy: { sequenceOrder: 'asc' },
    select: { id: true },
  });

  // A shorter sitting of a long pack takes its scenarios from the front of
  // the ordered pack, so every candidate on the same invite gets the same ones.
  const depth = session.sessionDepth ?? null;
  const chosen = depth && depth > 0 ? available.slice(0, depth) : available;
  const ids = chosen.map((s) => s.id);

  if (ids.length > 0) {
    await prisma.assessmentSession.update({
      where: { id: session.id },
      data: { scenarioOrder: ids as never },
    });
  }

  return ids;
}

export type ServedScenario = {
  id: string;
  sequenceOrder: number;
  title: string | null;
  narrativeText: string;
  decisionPoint: string | null;
  timeLimitSec: number;
  backdropImageUrl: string | null;
  options: { id: string; optionCode: string; optionText: string; title: string | null }[];
};

/** Loads the frozen scenarios, in the order they were frozen. */
export async function loadScenariosInOrder(ids: string[]): Promise<ServedScenario[]> {
  if (ids.length === 0) return [];

  const rows = await prisma.scenario.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      sequenceOrder: true,
      title: true,
      narrativeText: true,
      decisionPoint: true,
      timeLimitSec: true,
      backdropImageUrl: true,
      options: {
        select: { id: true, optionCode: true, optionText: true, title: true },
        orderBy: [{ sortOrder: 'asc' }, { optionCode: 'asc' }],
      },
    },
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  // A scenario that has since been hard-deleted simply drops out; the sitting
  // shortens rather than erroring, and the ones already answered still count.
  return ids.map((id) => byId.get(id)).filter((s): s is ServedScenario => Boolean(s));
}
