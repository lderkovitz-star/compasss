import crypto from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Scenario versions: what a candidate reads and is scored on never changes
 * underneath them.
 *
 * A sitting freezes its list of scenario ids when it starts
 * (session-scenarios.ts). The rows behind those ids, though, used to be edited
 * in place - by a pack import and by the scenario editor - and could be
 * deleted outright. A candidate part-way through then got the new wording,
 * lost options they had been shown, and was scored on a mix of old and new
 * weights; finished reports showed wording the candidate never saw; and
 * deleting a scenario for good deleted every answer to it.
 *
 * So a scenario that any sitting depends on is never changed in place. An edit
 * writes a new version - a new row with its own options and weights - and
 * retires the old one, which stays exactly as it was for the sittings and
 * reports that use it. The pack's revision goes up, and sittings that start
 * from then on get the new version.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Ids of this pack's scenarios that a sitting depends on: answered, or in a frozen order. */
export async function scenarioIdsInUse(db: Db, packageId: string): Promise<Set<string>> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT r.scenario_id AS id
      FROM responses r
      JOIN scenarios s ON s.id = r.scenario_id
     WHERE s.package_id = ${packageId}
    UNION
    SELECT jsonb_array_elements_text(a.scenario_order) AS id
      FROM assessment_sessions a
     WHERE a.package_id = ${packageId}
       AND jsonb_typeof(a.scenario_order) = 'array'`;
  return new Set(rows.map((r) => r.id));
}

export type ScenarioUse = {
  /** Answers recorded against this scenario. */
  answers: number;
  /** Sittings whose frozen order includes it, finished or not. */
  sittings: number;
  /** Of those, the ones still under way. */
  unfinished: number;
};

export async function scenarioUse(db: Db, scenarioId: string): Promise<ScenarioUse> {
  const [row] = await db.$queryRaw<ScenarioUse[]>`
    SELECT
      (SELECT count(*)::int FROM responses WHERE scenario_id = ${scenarioId}) AS answers,
      (SELECT count(*)::int FROM assessment_sessions
        WHERE jsonb_typeof(scenario_order) = 'array'
          AND scenario_order @> to_jsonb(${scenarioId}::text)) AS sittings,
      (SELECT count(*)::int FROM assessment_sessions
        WHERE status <> 'COMPLETED'
          AND jsonb_typeof(scenario_order) = 'array'
          AND scenario_order @> to_jsonb(${scenarioId}::text)) AS unfinished`;
  return row;
}

export const isInUse = (use: ScenarioUse) => use.answers > 0 || use.sittings > 0;

/** Sittings still under way whose frozen order includes any of these scenarios. */
export async function unfinishedSittingsOn(db: Db, scenarioIds: string[]): Promise<number> {
  if (scenarioIds.length === 0) return 0;
  const [row] = await db.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
      FROM assessment_sessions
     WHERE status <> 'COMPLETED'
       AND jsonb_typeof(scenario_order) = 'array'
       AND scenario_order ?| ${scenarioIds}::text[]`;
  return row.n;
}

export async function bumpRevision(db: Db, packageId: string): Promise<number> {
  const pkg = await db.scenarioPackage.update({
    where: { id: packageId },
    data: { revision: { increment: 1 } },
    select: { revision: true },
  });
  return pkg.revision;
}

/** What a candidate is shown and scored on. Scores are keyed by dimension id. */
export type ScenarioContent = {
  sequenceOrder: number;
  title: string | null;
  narrativeText: string;
  decisionPoint: string | null;
  timeLimitSec: number;
  options: {
    code: string;
    title: string | null;
    text: string;
    sortOrder: number;
    scores: Record<string, number>;
  }[];
};

type StoredScenario = {
  sequenceOrder: number;
  title: string | null;
  narrativeText: string;
  decisionPoint: string | null;
  timeLimitSec: number;
  options: {
    optionCode: string;
    title: string | null;
    optionText: string;
    sortOrder: number;
    scores: { dimensionId: string; weightScore: number }[];
  }[];
};

export function contentOf(row: StoredScenario): ScenarioContent {
  return {
    sequenceOrder: row.sequenceOrder,
    title: row.title,
    narrativeText: row.narrativeText,
    decisionPoint: row.decisionPoint,
    timeLimitSec: row.timeLimitSec,
    options: row.options.map((o) => ({
      code: o.optionCode,
      title: o.title,
      text: o.optionText,
      sortOrder: o.sortOrder,
      scores: Object.fromEntries(o.scores.map((s) => [s.dimensionId, s.weightScore])),
    })),
  };
}

const norm = (v: string | null | undefined) => v ?? null;

export function sameContent(a: ScenarioContent, b: ScenarioContent): boolean {
  if (
    a.sequenceOrder !== b.sequenceOrder ||
    norm(a.title) !== norm(b.title) ||
    a.narrativeText !== b.narrativeText ||
    norm(a.decisionPoint) !== norm(b.decisionPoint) ||
    a.timeLimitSec !== b.timeLimitSec ||
    a.options.length !== b.options.length
  ) {
    return false;
  }
  const byCode = new Map(b.options.map((o) => [o.code, o]));
  for (const o of a.options) {
    const other = byCode.get(o.code);
    if (!other) return false;
    if (norm(o.title) !== norm(other.title) || o.text !== other.text || o.sortOrder !== other.sortOrder) return false;
    const dims = Object.keys(o.scores);
    if (dims.length !== Object.keys(other.scores).length) return false;
    for (const d of dims) if (other.scores[d] !== o.scores[d]) return false;
  }
  return true;
}

/**
 * Writes `content` as a new version of `previous` and retires `previous`,
 * which keeps its id, options and weights for the sittings that use it.
 * Returns the new version's id.
 */
export async function writeNewVersion(
  db: Db,
  previous: { id: string; packageId: string; externalRef: string | null; backdropImageUrl: string | null; deletedAt: Date | null },
  content: ScenarioContent,
  externalRef: string | null = previous.externalRef
): Promise<string> {
  const id = crypto.randomUUID();
  // The reference moves to the new version, and the unique index on it means
  // the old row has to let go first.
  await db.scenario.update({
    where: { id: previous.id },
    data: { deletedAt: previous.deletedAt ?? new Date(), externalRef: null, supersededById: id },
  });
  await db.scenario.create({
    data: {
      id,
      packageId: previous.packageId,
      sequenceOrder: content.sequenceOrder,
      title: content.title,
      narrativeText: content.narrativeText,
      decisionPoint: content.decisionPoint,
      externalRef,
      timeLimitSec: content.timeLimitSec,
      backdropImageUrl: previous.backdropImageUrl,
      // Editing something in the trash leaves the new version in the trash.
      deletedAt: previous.deletedAt,
    },
  });
  for (const o of content.options) {
    const optionId = crypto.randomUUID();
    await db.scenarioOption.create({
      data: { id: optionId, scenarioId: id, optionCode: o.code, title: o.title, optionText: o.text, sortOrder: o.sortOrder },
    });
    const scores = Object.entries(o.scores).map(([dimensionId, weightScore]) => ({ optionId, dimensionId, weightScore }));
    if (scores.length) await db.optionScore.createMany({ data: scores });
  }
  return id;
}

/** The fields the scenario editor sends. */
export type ScenarioEdit = {
  narrativeText?: unknown;
  timeLimitSec?: unknown;
  sequenceOrder?: unknown;
  options?: unknown;
};

export type EditOutcome =
  | { kind: 'not-found' }
  | { kind: 'superseded'; currentId: string | null }
  | { kind: 'unchanged'; id: string }
  | { kind: 'updated'; id: string; revision: number | null }
  | { kind: 'versioned'; id: string; previousId: string; revision: number | null; unfinishedSittings: number };

const finite = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Saves an edit from the scenario editor: in place while nobody depends on the
 * scenario, otherwise as a new version.
 */
export async function saveScenarioEdit(db: PrismaClient, scenarioId: string, edit: ScenarioEdit): Promise<EditOutcome> {
  return db.$transaction(async (tx) => {
    const row = await tx.scenario.findUnique({
      where: { id: scenarioId },
      select: {
        id: true,
        packageId: true,
        externalRef: true,
        backdropImageUrl: true,
        deletedAt: true,
        supersededById: true,
        sequenceOrder: true,
        title: true,
        narrativeText: true,
        decisionPoint: true,
        timeLimitSec: true,
        options: {
          orderBy: [{ sortOrder: 'asc' }, { optionCode: 'asc' }],
          select: {
            id: true,
            optionCode: true,
            title: true,
            optionText: true,
            sortOrder: true,
            scores: { select: { dimensionId: true, weightScore: true } },
          },
        },
      },
    });
    if (!row) return { kind: 'not-found' };
    if (row.supersededById) return { kind: 'superseded', currentId: row.supersededById };

    const before = contentOf(row);
    type OptionEdit = { id?: unknown; optionText?: unknown; scores?: unknown };
    const edits = new Map<string, OptionEdit>();
    if (Array.isArray(edit.options)) {
      for (const o of edit.options as OptionEdit[]) if (o && typeof o.id === 'string') edits.set(o.id, o);
    }
    const after: ScenarioContent = {
      ...before,
      narrativeText: typeof edit.narrativeText === 'string' ? edit.narrativeText : before.narrativeText,
      timeLimitSec: finite(edit.timeLimitSec) ?? before.timeLimitSec,
      sequenceOrder: finite(edit.sequenceOrder) ?? before.sequenceOrder,
      options: row.options.map((o, i) => {
        const e = edits.get(o.id);
        const scores = Array.isArray(e?.scores)
          ? Object.fromEntries(
              (e!.scores as { dimensionId?: unknown; weightScore?: unknown }[])
                .filter((s) => s && typeof s.dimensionId === 'string' && finite(s.weightScore) !== null)
                .map((s) => [s.dimensionId as string, finite(s.weightScore) as number])
            )
          : before.options[i].scores;
        return { ...before.options[i], text: typeof e?.optionText === 'string' ? e.optionText : o.optionText, scores };
      }),
    };

    if (sameContent(before, after)) return { kind: 'unchanged', id: row.id };
    const live = row.deletedAt === null;
    const use = await scenarioUse(tx, row.id);

    if (!isInUse(use)) {
      await tx.scenario.update({
        where: { id: row.id },
        data: { narrativeText: after.narrativeText, timeLimitSec: after.timeLimitSec, sequenceOrder: after.sequenceOrder },
      });
      for (let i = 0; i < row.options.length; i++) {
        const o = row.options[i];
        await tx.scenarioOption.update({ where: { id: o.id }, data: { optionText: after.options[i].text } });
        await tx.optionScore.deleteMany({ where: { optionId: o.id } });
        const scores = Object.entries(after.options[i].scores).map(([dimensionId, weightScore]) => ({ optionId: o.id, dimensionId, weightScore }));
        if (scores.length) await tx.optionScore.createMany({ data: scores });
      }
      return { kind: 'updated', id: row.id, revision: live ? await bumpRevision(tx, row.packageId) : null };
    }

    const id = await writeNewVersion(tx, row, after);
    return {
      kind: 'versioned',
      id,
      previousId: row.id,
      revision: live ? await bumpRevision(tx, row.packageId) : null,
      unfinishedSittings: use.unfinished,
    };
  });
}
