import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Scenario pack import.
 *
 * One pack is a whole assessment: scenarios, the options under each, and the
 * dimension weights those options carry. Packs arrive as JSON or CSV authored
 * outside the product, so nothing here trusts its input - every field is
 * checked and every problem is reported against the place it came from
 * (`scenarios[3].options[1].scores.TEAM_FOCUS`, or `row 42`) rather than
 * aborting the whole file on the first bad cell.
 *
 * The format is documented in docs/scenario-pack-format.md, which is the
 * version the client authors against.
 */

export type PackIssue = {
  path: string;
  message: string;
  /** Warnings are reported but do not block the import. */
  severity: 'error' | 'warning';
};

export type ParsedOption = {
  label: string;
  title: string | null;
  text: string;
  sortOrder: number;
  scores: Record<string, number>;
};

export type ParsedScenario = {
  sequenceOrder: number;
  externalRef: string | null;
  title: string | null;
  narrativeText: string;
  decisionPoint: string | null;
  timeLimitSec: number;
  options: ParsedOption[];
};

export type ParsedPack = {
  package: { name: string; code: string; description: string; version: string };
  dimensions: { code: string; name: string; category: string }[];
  scenarios: ParsedScenario[];
};

export type ParseResult = {
  /** Null when the file could not be understood well enough to write. */
  pack: ParsedPack | null;
  issues: PackIssue[];
};

const MIN_NARRATIVE_CHARS = 40;
const MIN_OPTIONS = 2;
const DEFAULT_TIME_LIMIT_SEC = 90;
const DIMENSION_CODE = /^[A-Z][A-Z0-9_]{1,48}$/;

function err(issues: PackIssue[], path: string, message: string) {
  issues.push({ path, message, severity: 'error' });
}
function warn(issues: PackIssue[], path: string, message: string) {
  issues.push({ path, message, severity: 'warning' });
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

/** Turns a free-text name into a usable package code. */
export function toPackageCode(name: string): string {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'PACK'
  );
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function parsePackJson(raw: unknown): ParseResult {
  const issues: PackIssue[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    err(issues, 'file', 'Expected a JSON object with "package" and "scenarios".');
    return { pack: null, issues };
  }

  const body = raw as Record<string, unknown>;
  const pkgRaw = (body.package ?? {}) as Record<string, unknown>;

  const name = str(pkgRaw.name);
  if (!name) err(issues, 'package.name', 'A package name is required.');
  const code = str(pkgRaw.code) || toPackageCode(name);
  if (code && !/^[A-Z0-9_]{2,48}$/.test(code)) {
    err(issues, 'package.code', 'Use uppercase letters, digits and underscores only.');
  }

  const dimensions: ParsedPack['dimensions'] = [];
  if (body.dimensions != null) {
    if (!Array.isArray(body.dimensions)) {
      err(issues, 'dimensions', 'Expected an array.');
    } else {
      body.dimensions.forEach((d, i) => {
        const dim = (d ?? {}) as Record<string, unknown>;
        const dCode = str(dim.code).toUpperCase();
        if (!DIMENSION_CODE.test(dCode)) {
          err(issues, `dimensions[${i}].code`, `"${dCode}" is not a valid dimension code.`);
          return;
        }
        dimensions.push({
          code: dCode,
          name: str(dim.name) || dCode.replace(/_/g, ' '),
          category: str(dim.category) || 'Imported',
        });
      });
    }
  }

  if (!Array.isArray(body.scenarios) || body.scenarios.length === 0) {
    err(issues, 'scenarios', 'At least one scenario is required.');
    return { pack: null, issues };
  }

  const scenarios: ParsedScenario[] = [];
  body.scenarios.forEach((s, i) => {
    const parsed = parseScenario(s, `scenarios[${i}]`, i + 1, issues);
    if (parsed) scenarios.push(parsed);
  });

  finalise(scenarios, dimensions, issues);

  if (scenarios.length === 0) return { pack: null, issues };

  return {
    pack: {
      package: {
        name,
        code,
        description: str(pkgRaw.description),
        version: str(pkgRaw.version) || '1.0.0',
      },
      dimensions,
      scenarios,
    },
    issues,
  };
}

function parseScenario(
  input: unknown,
  path: string,
  fallbackOrder: number,
  issues: PackIssue[]
): ParsedScenario | null {
  if (!input || typeof input !== 'object') {
    err(issues, path, 'Expected an object.');
    return null;
  }
  const s = input as Record<string, unknown>;

  const narrativeText = str(s.narrativeText ?? s.narrative);
  if (!narrativeText) {
    err(issues, `${path}.narrativeText`, 'The situation text is required.');
    return null;
  }
  if (narrativeText.length < MIN_NARRATIVE_CHARS) {
    warn(
      issues,
      `${path}.narrativeText`,
      `Only ${narrativeText.length} characters - candidates may not have enough to decide on.`
    );
  }

  const rawOrder = Number(s.sequenceOrder ?? s.sequence);
  const sequenceOrder = Number.isInteger(rawOrder) && rawOrder > 0 ? rawOrder : fallbackOrder;

  const rawLimit = Number(s.timeLimitSec ?? s.time_limit_sec);
  const timeLimitSec =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.round(rawLimit) : DEFAULT_TIME_LIMIT_SEC;

  const optionsRaw = Array.isArray(s.options) ? s.options : [];
  const options: ParsedOption[] = [];
  const seenLabels = new Set<string>();

  optionsRaw.forEach((o, j) => {
    const oPath = `${path}.options[${j}]`;
    if (!o || typeof o !== 'object') {
      err(issues, oPath, 'Expected an object.');
      return;
    }
    const opt = o as Record<string, unknown>;

    const label = str(opt.label ?? opt.optionCode).toUpperCase() || String.fromCharCode(65 + j);
    if (seenLabels.has(label)) {
      err(issues, `${oPath}.label`, `Duplicate option label "${label}" in this scenario.`);
      return;
    }
    seenLabels.add(label);

    const text = str(opt.text ?? opt.optionText ?? opt.description);
    if (!text) {
      err(issues, `${oPath}.text`, 'The choice text the candidate reads is required.');
      return;
    }

    const scores = parseScores(opt.scores, `${oPath}.scores`, issues);
    if (Object.keys(scores).length === 0) {
      warn(issues, `${oPath}.scores`, 'No dimension weights - this choice will not move any score.');
    }

    options.push({ label, title: str(opt.title) || null, text, sortOrder: j, scores });
  });

  if (options.length < MIN_OPTIONS) {
    err(
      issues,
      `${path}.options`,
      `At least ${MIN_OPTIONS} usable options are required; found ${options.length}.`
    );
    return null;
  }

  return {
    sequenceOrder,
    externalRef: str(s.externalRef ?? s.external_ref) || null,
    title: str(s.title) || null,
    narrativeText,
    decisionPoint: str(s.decisionPoint ?? s.decision_point) || null,
    timeLimitSec,
    options,
  };
}

function parseScores(input: unknown, path: string, issues: PackIssue[]): Record<string, number> {
  const scores: Record<string, number> = {};
  if (input == null) return scores;
  if (typeof input !== 'object' || Array.isArray(input)) {
    err(issues, path, 'Expected an object of dimension code to weight.');
    return scores;
  }
  for (const [rawCode, rawWeight] of Object.entries(input as Record<string, unknown>)) {
    const code = rawCode.trim().toUpperCase();
    if (!DIMENSION_CODE.test(code)) {
      err(issues, `${path}.${rawCode}`, `"${rawCode}" is not a valid dimension code.`);
      continue;
    }
    if (rawWeight === '' || rawWeight == null) continue;
    const weight = Number(rawWeight);
    if (!Number.isFinite(weight)) {
      err(issues, `${path}.${code}`, `Weight "${String(rawWeight)}" is not a number.`);
      continue;
    }
    scores[code] = weight;
  }
  return scores;
}

/** Checks that only make sense once every scenario has been read. */
function finalise(
  scenarios: ParsedScenario[],
  dimensions: ParsedPack['dimensions'],
  issues: PackIssue[]
) {
  const seenOrder = new Map<number, number>();
  scenarios.forEach((s, i) => {
    const first = seenOrder.get(s.sequenceOrder);
    if (first !== undefined) {
      err(
        issues,
        `scenarios[${i}].sequenceOrder`,
        `Sequence ${s.sequenceOrder} is already used by scenario ${first + 1}.`
      );
    } else {
      seenOrder.set(s.sequenceOrder, i);
    }
  });

  const seenRef = new Map<string, number>();
  scenarios.forEach((s, i) => {
    if (!s.externalRef) return;
    const first = seenRef.get(s.externalRef);
    if (first !== undefined) {
      err(
        issues,
        `scenarios[${i}].externalRef`,
        `"${s.externalRef}" is already used by scenario ${first + 1}.`
      );
    } else {
      seenRef.set(s.externalRef, i);
    }
  });

  // A dimension no option can move cannot be scored, so flag it here rather
  // than leaving an empty row on every report.
  const used = new Set<string>();
  for (const s of scenarios) for (const o of s.options) for (const c of Object.keys(o.scores)) used.add(c);
  for (const d of dimensions) {
    if (!used.has(d.code)) {
      warn(issues, `dimensions.${d.code}`, 'Declared but never scored by any option.');
    }
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC 4180: quoted fields may hold commas, newlines and doubled quotes. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const src = text.replace(/^﻿/, '');

  while (i < src.length) {
    const ch = src[i];

    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const CSV_FIXED = new Set([
  'sequence',
  'sequenceorder',
  'external_ref',
  'externalref',
  'title',
  'narrative',
  'narrativetext',
  'decision_point',
  'decisionpoint',
  'time_limit_sec',
  'timelimitsec',
  'option_label',
  'optionlabel',
  'label',
  'option_title',
  'optiontitle',
  'option_text',
  'optiontext',
]);

/**
 * One row per option. Scenario-level cells are repeated only on the first row
 * of each scenario; blank cells inherit from the row above, which is how
 * spreadsheets are actually authored.
 */
export function parsePackCsv(text: string, packageName?: string): ParseResult {
  const issues: PackIssue[] = [];
  const rows = parseCsvRows(text);

  if (rows.length < 2) {
    err(issues, 'file', 'The file needs a header row and at least one option row.');
    return { pack: null, issues };
  }

  const header = rows[0].map((h) => h.trim());
  const key = (h: string) => h.toLowerCase().replace(/[\s-]+/g, '_');
  const index: Record<string, number> = {};
  header.forEach((h, i) => {
    index[key(h)] = i;
  });

  const pick = (row: string[], ...names: string[]): string => {
    for (const n of names) {
      const i = index[n];
      if (i !== undefined && row[i] != null && row[i].trim() !== '') return row[i].trim();
    }
    return '';
  };

  // Every column that is not a known field is a dimension code.
  const dimensionColumns: { code: string; i: number }[] = [];
  header.forEach((h, i) => {
    const k = key(h);
    if (!h || CSV_FIXED.has(k.replace(/_/g, ''))) return;
    if (CSV_FIXED.has(k)) return;
    const code = h.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!DIMENSION_CODE.test(code)) {
      warn(issues, `column "${h}"`, 'Not a known field or a valid dimension code - ignored.');
      return;
    }
    dimensionColumns.push({ code, i });
  });

  if (dimensionColumns.length === 0) {
    err(
      issues,
      'file',
      'No dimension columns found. Every column after option_text is a dimension code.'
    );
  }

  type Group = { order: number; row: string[]; options: { row: string[]; line: number }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let carried: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1; // 1-based, counting the header

    // Blank scenario cells inherit from the row above.
    const merged = header.map((_, i) => (row[i] != null && row[i].trim() !== '' ? row[i] : carried[i] ?? ''));
    const seq = pick(merged, 'sequence', 'sequenceorder', 'sequence_order');
    const narrative = pick(merged, 'narrative', 'narrativetext', 'narrative_text');

    const startsNewScenario =
      current === null ||
      (seq !== '' && seq !== pick(current.row, 'sequence', 'sequenceorder', 'sequence_order')) ||
      (narrative !== '' && narrative !== pick(current.row, 'narrative', 'narrativetext', 'narrative_text'));

    if (startsNewScenario) {
      current = { order: groups.length + 1, row: merged, options: [] };
      groups.push(current);
      carried = merged.slice();
    }

    current!.options.push({ row, line });
  }

  const scenarios: ParsedScenario[] = [];

  for (const group of groups) {
    const base = group.row;
    const narrativeText = pick(base, 'narrative', 'narrativetext', 'narrative_text');
    const label = `scenario ${group.order}`;

    if (!narrativeText) {
      err(issues, label, 'The narrative column is empty.');
      continue;
    }

    const options: ParsedOption[] = [];
    const seenLabels = new Set<string>();

    group.options.forEach(({ row, line }, j) => {
      const optLabel =
        pick(row, 'option_label', 'optionlabel', 'label').toUpperCase() ||
        String.fromCharCode(65 + j);
      const optText = pick(row, 'option_text', 'optiontext');

      if (!optText) {
        err(issues, `row ${line}`, 'option_text is empty.');
        return;
      }
      if (seenLabels.has(optLabel)) {
        err(issues, `row ${line}`, `Duplicate option label "${optLabel}" in ${label}.`);
        return;
      }
      seenLabels.add(optLabel);

      const scores: Record<string, number> = {};
      for (const { code, i } of dimensionColumns) {
        const cell = (row[i] ?? '').trim();
        if (cell === '') continue;
        const weight = Number(cell);
        if (!Number.isFinite(weight)) {
          err(issues, `row ${line}, column ${code}`, `"${cell}" is not a number.`);
          continue;
        }
        scores[code] = weight;
      }
      if (Object.keys(scores).length === 0) {
        warn(issues, `row ${line}`, 'No dimension weights - this choice will not move any score.');
      }

      options.push({
        label: optLabel,
        title: pick(row, 'option_title', 'optiontitle') || null,
        text: optText,
        sortOrder: j,
        scores,
      });
    });

    if (options.length < MIN_OPTIONS) {
      err(issues, label, `At least ${MIN_OPTIONS} usable options are required; found ${options.length}.`);
      continue;
    }

    const seqCell = Number(pick(base, 'sequence', 'sequenceorder', 'sequence_order'));
    const limitCell = Number(pick(base, 'time_limit_sec', 'timelimitsec'));

    scenarios.push({
      sequenceOrder: Number.isInteger(seqCell) && seqCell > 0 ? seqCell : group.order,
      externalRef: pick(base, 'external_ref', 'externalref') || null,
      title: pick(base, 'title') || null,
      narrativeText,
      decisionPoint: pick(base, 'decision_point', 'decisionpoint') || null,
      timeLimitSec:
        Number.isFinite(limitCell) && limitCell > 0 ? Math.round(limitCell) : DEFAULT_TIME_LIMIT_SEC,
      options,
    });
  }

  const dimensions = dimensionColumns.map(({ code }) => ({
    code,
    name: code
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' '),
    category: 'Imported',
  }));

  finalise(scenarios, dimensions, issues);

  if (scenarios.length === 0) return { pack: null, issues };

  const name = (packageName ?? '').trim() || 'Imported pack';
  return {
    pack: {
      package: { name, code: toPackageCode(name), description: '', version: '1.0.0' },
      dimensions,
      scenarios,
    },
    issues,
  };
}

// ---------------------------------------------------------------------------
// Preview and write
// ---------------------------------------------------------------------------

export type PackPreview = {
  packageName: string;
  packageCode: string;
  codeInUse: boolean;
  scenarioCount: number;
  optionCount: number;
  scoreCount: number;
  /** Dimension codes the pack scores that do not exist yet. */
  newDimensions: string[];
  existingDimensions: string[];
  weightRange: { min: number; max: number } | null;
  optionsPerScenario: { min: number; max: number };
  issues: PackIssue[];
};

export async function previewPack(
  db: PrismaClient | Prisma.TransactionClient,
  pack: ParsedPack,
  issues: PackIssue[]
): Promise<PackPreview> {
  const usedCodes = new Set<string>();
  let optionCount = 0;
  let scoreCount = 0;
  let minWeight = Infinity;
  let maxWeight = -Infinity;
  let minOptions = Infinity;
  let maxOptions = 0;

  for (const s of pack.scenarios) {
    optionCount += s.options.length;
    minOptions = Math.min(minOptions, s.options.length);
    maxOptions = Math.max(maxOptions, s.options.length);
    for (const o of s.options) {
      for (const [code, weight] of Object.entries(o.scores)) {
        usedCodes.add(code);
        scoreCount++;
        minWeight = Math.min(minWeight, weight);
        maxWeight = Math.max(maxWeight, weight);
      }
    }
  }

  const declared = new Map(pack.dimensions.map((d) => [d.code, d]));
  const existing = await db.dimension.findMany({
    where: { code: { in: Array.from(usedCodes) } },
    select: { code: true },
  });
  const existingSet = new Set(existing.map((d) => d.code));

  const newDimensions: string[] = [];
  for (const code of Array.from(usedCodes)) {
    if (existingSet.has(code)) continue;
    newDimensions.push(code);
    if (!declared.has(code)) {
      // Creatable either way, but the pack should say what it means by it.
      warn(
        issues,
        `dimensions.${code}`,
        'Scored but not declared and not already in the platform - it will be created with a generated name.'
      );
    }
  }

  const pkg = await db.scenarioPackage.findUnique({
    where: { code: pack.package.code },
    select: { id: true },
  });

  return {
    packageName: pack.package.name,
    packageCode: pack.package.code,
    codeInUse: Boolean(pkg),
    scenarioCount: pack.scenarios.length,
    optionCount,
    scoreCount,
    newDimensions: newDimensions.sort(),
    existingDimensions: Array.from(existingSet).sort(),
    weightRange: scoreCount > 0 ? { min: minWeight, max: maxWeight } : null,
    optionsPerScenario: {
      min: minOptions === Infinity ? 0 : minOptions,
      max: maxOptions,
    },
    issues,
  };
}

const CHUNK = 500;

async function createInChunks<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>
): Promise<number> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await insert(rows.slice(i, i + CHUNK));
  }
  return rows.length;
}

export type WriteResult = {
  packageId: string;
  packageCode: string;
  scenariosCreated: number;
  scenariosUpdated: number;
  scenariosRetired: number;
  options: number;
  scores: number;
  dimensionsCreated: string[];
};

/**
 * Writes the pack.
 *
 * Inserts are batched rather than issued one row at a time: a 200-scenario pack
 * carries ~800 options and ~3,200 scores, which as individual round trips
 * exceeds the serverless function limit long before it finishes.
 *
 * Re-importing an edited pack updates the scenarios it already has rather than
 * duplicating them, matched on `externalRef`. Matching in place is what keeps
 * finished reports readable: a response points at an option row, so replacing
 * scenarios wholesale would either orphan past sessions or, because the
 * response-to-option foreign key cascades, delete their answers outright. An
 * option that has already been answered is therefore never removed - if the new
 * pack drops one, the import stops and says which, instead of quietly taking
 * the responses with it.
 */
export async function writePack(
  prisma: PrismaClient,
  pack: ParsedPack,
  opts: { replaceExisting?: boolean } = {}
): Promise<WriteResult> {
  return prisma.$transaction(
    async (tx) => {
      const dimensionsCreated: string[] = [];

      const usedCodes = new Set<string>();
      for (const s of pack.scenarios) for (const o of s.options) for (const c of Object.keys(o.scores)) usedCodes.add(c);

      const existingDims = await tx.dimension.findMany({
        where: { code: { in: Array.from(usedCodes) } },
        select: { id: true, code: true },
      });
      const dimMap = new Map(existingDims.map((d) => [d.code, d.id]));
      const declared = new Map(pack.dimensions.map((d) => [d.code, d]));

      for (const code of Array.from(usedCodes)) {
        if (dimMap.has(code)) continue;
        const spec = declared.get(code);
        const created = await tx.dimension.create({
          data: {
            code,
            name: spec?.name ?? humanise(code),
            description: '',
            category: spec?.category ?? 'Imported',
          },
          select: { id: true, code: true },
        });
        dimMap.set(created.code, created.id);
        dimensionsCreated.push(created.code);
      }

      // --- the package -----------------------------------------------------
      let packageId: string;
      const found = await tx.scenarioPackage.findUnique({
        where: { code: pack.package.code },
        select: { id: true },
      });

      if (found) {
        if (!opts.replaceExisting) {
          throw new Error(
            `Package code "${pack.package.code}" already exists. Choose a different code, or confirm replacing its contents.`
          );
        }
        packageId = found.id;
        await tx.scenarioPackage.update({
          where: { id: packageId },
          data: {
            name: pack.package.name,
            description: pack.package.description,
            version: pack.package.version,
            deletedAt: null,
          },
        });
      } else {
        const created = await tx.scenarioPackage.create({
          data: {
            name: pack.package.name,
            code: pack.package.code,
            description: pack.package.description,
            version: pack.package.version,
            sourceFormat: 'JSON',
          },
          select: { id: true },
        });
        packageId = created.id;
      }

      // --- match incoming scenarios against what is already there ----------
      const current = await tx.scenario.findMany({
        where: { packageId },
        select: {
          id: true,
          externalRef: true,
          deletedAt: true,
          options: {
            select: { id: true, optionCode: true, _count: { select: { responses: true } } },
          },
        },
      });

      const byRef = new Map<string, (typeof current)[number]>();
      for (const sc of current) if (sc.externalRef) byRef.set(sc.externalRef, sc);

      const matched = new Set<string>();
      let scenariosUpdated = 0;

      const newScenarioRows: {
        id: string;
        packageId: string;
        sequenceOrder: number;
        title: string | null;
        narrativeText: string;
        decisionPoint: string | null;
        externalRef: string | null;
        timeLimitSec: number;
      }[] = [];
      const newOptionRows: {
        id: string;
        scenarioId: string;
        optionCode: string;
        title: string | null;
        optionText: string;
        sortOrder: number;
      }[] = [];
      const newScoreRows: { optionId: string; dimensionId: string; weightScore: number }[] = [];
      const optionIdsToRescore: string[] = [];

      const queueScores = (optionId: string, scores: Record<string, number>) => {
        for (const [code, weight] of Object.entries(scores)) {
          const dimensionId = dimMap.get(code);
          if (!dimensionId) continue;
          newScoreRows.push({ optionId, dimensionId, weightScore: weight });
        }
      };

      for (const incoming of pack.scenarios) {
        const existing = incoming.externalRef ? byRef.get(incoming.externalRef) : undefined;

        if (!existing) {
          const scenarioId = crypto.randomUUID();
          newScenarioRows.push({
            id: scenarioId,
            packageId,
            sequenceOrder: incoming.sequenceOrder,
            title: incoming.title,
            narrativeText: incoming.narrativeText,
            decisionPoint: incoming.decisionPoint,
            externalRef: incoming.externalRef,
            timeLimitSec: incoming.timeLimitSec,
          });
          for (const o of incoming.options) {
            const optionId = crypto.randomUUID();
            newOptionRows.push({
              id: optionId,
              scenarioId,
              optionCode: o.label,
              title: o.title,
              optionText: o.text,
              sortOrder: o.sortOrder,
            });
            queueScores(optionId, o.scores);
          }
          continue;
        }

        matched.add(existing.id);
        scenariosUpdated++;

        await tx.scenario.update({
          where: { id: existing.id },
          data: {
            sequenceOrder: incoming.sequenceOrder,
            title: incoming.title,
            narrativeText: incoming.narrativeText,
            decisionPoint: incoming.decisionPoint,
            timeLimitSec: incoming.timeLimitSec,
            deletedAt: null,
          },
        });

        const existingByCode = new Map(existing.options.map((o) => [o.optionCode, o]));
        const incomingCodes = new Set(incoming.options.map((o) => o.label));

        for (const o of incoming.options) {
          const match = existingByCode.get(o.label);
          if (match) {
            await tx.scenarioOption.update({
              where: { id: match.id },
              data: { optionText: o.text, title: o.title, sortOrder: o.sortOrder },
            });
            optionIdsToRescore.push(match.id);
            queueScores(match.id, o.scores);
          } else {
            const optionId = crypto.randomUUID();
            newOptionRows.push({
              id: optionId,
              scenarioId: existing.id,
              optionCode: o.label,
              title: o.title,
              optionText: o.text,
              sortOrder: o.sortOrder,
            });
            queueScores(optionId, o.scores);
          }
        }

        // An option that is gone from the new pack but has been answered
        // cannot be removed - the response foreign key cascades, so deleting it
        // would delete the answer. Say so rather than destroying history.
        for (const old of existing.options) {
          if (incomingCodes.has(old.optionCode)) continue;
          if (old._count.responses > 0) {
            throw new Error(
              `Scenario "${incoming.externalRef}" option ${old.optionCode} has ${old._count.responses} recorded response(s), so it cannot be removed by re-import. Keep the option, or publish this as a new package code.`
            );
          }
          await tx.scenarioOption.delete({ where: { id: old.id } });
        }
      }

      // --- retire what the new pack no longer contains ----------------------
      const retired = current.filter((sc) => !matched.has(sc.id) && !sc.deletedAt);
      if (retired.length) {
        // externalRef is cleared alongside, so the unique index does not block
        // a future import that reintroduces the same reference.
        await tx.scenario.updateMany({
          where: { id: { in: retired.map((sc) => sc.id) } },
          data: { deletedAt: new Date(), externalRef: null },
        });
      }

      // --- bulk writes ------------------------------------------------------
      if (optionIdsToRescore.length) {
        await createInChunks(optionIdsToRescore, (batch) =>
          tx.optionScore.deleteMany({ where: { optionId: { in: batch } } })
        );
      }
      await createInChunks(newScenarioRows, (batch) => tx.scenario.createMany({ data: batch }));
      await createInChunks(newOptionRows, (batch) => tx.scenarioOption.createMany({ data: batch }));
      await createInChunks(newScoreRows, (batch) => tx.optionScore.createMany({ data: batch }));

      return {
        packageId,
        packageCode: pack.package.code,
        scenariosCreated: newScenarioRows.length,
        scenariosUpdated,
        scenariosRetired: retired.length,
        options: newOptionRows.length,
        scores: newScoreRows.length,
        dimensionsCreated,
      };
    },
    { timeout: 120_000, maxWait: 15_000 }
  );
}

function humanise(code: string): string {
  return code
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/** Round-trips a stored package back out in the documented JSON shape. */
export async function exportPack(prisma: PrismaClient, packageId: string): Promise<ParsedPack | null> {
  const pkg = await prisma.scenarioPackage.findUnique({
    where: { id: packageId },
    select: {
      name: true,
      code: true,
      description: true,
      version: true,
      scenarios: {
        where: { deletedAt: null },
        orderBy: { sequenceOrder: 'asc' },
        select: {
          sequenceOrder: true,
          title: true,
          narrativeText: true,
          decisionPoint: true,
          externalRef: true,
          timeLimitSec: true,
          options: {
            orderBy: [{ sortOrder: 'asc' }, { optionCode: 'asc' }],
            select: {
              optionCode: true,
              title: true,
              optionText: true,
              sortOrder: true,
              scores: { select: { weightScore: true, dimension: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });

  if (!pkg) return null;

  const dimensionCodes = new Set<string>();
  for (const s of pkg.scenarios) for (const o of s.options) for (const sc of o.scores) dimensionCodes.add(sc.dimension.code);

  const dimensions = await prisma.dimension.findMany({
    where: { code: { in: Array.from(dimensionCodes) } },
    select: { code: true, name: true, category: true },
    orderBy: { code: 'asc' },
  });

  return {
    package: {
      name: pkg.name,
      code: pkg.code,
      description: pkg.description,
      version: pkg.version,
    },
    dimensions,
    scenarios: pkg.scenarios.map((s) => ({
      sequenceOrder: s.sequenceOrder,
      externalRef: s.externalRef,
      title: s.title,
      narrativeText: s.narrativeText,
      decisionPoint: s.decisionPoint,
      timeLimitSec: s.timeLimitSec,
      options: s.options.map((o, i) => ({
        label: o.optionCode,
        title: o.title,
        text: o.optionText,
        sortOrder: o.sortOrder ?? i,
        scores: Object.fromEntries(o.scores.map((sc) => [sc.dimension.code, sc.weightScore])),
      })),
    })),
  };
}
