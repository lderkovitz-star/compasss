/**
 * Converts the client's authored pack into our import format.
 *
 * They delivered it as raw SQL written against a different database design:
 * `schema.sql` (11 tables and a view) plus `seed.sql` (1 package, 50 scenarios,
 * 200 options, 796 scores). Neither file can be run against our database -
 * nine of their table names are also ours, so `CREATE TABLE` would fail, and
 * anyone who "fixed" that by dropping first would take the live data with it.
 *
 * So we read their INSERTs as data and emit the JSON documented in
 * docs/scenario-pack-format.md.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' \
 *     scripts/convert-client-pack.ts "<path to seed.sql>" [--apply]
 *
 * Without --apply it writes the JSON and prints a report. With --apply it also
 * imports it, through the same code path the uploader uses.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { ParsedPack, ParsedScenario, ParsedOption } from '../src/lib/pack-import';

type Row = (string | number | null)[];

/**
 * Reads one VALUES (...) tuple. A hand-rolled reader rather than a regex
 * because the narratives contain commas, parentheses and `''` escapes.
 */
function readTuple(src: string, start: number): { values: Row; end: number } | null {
  let i = src.indexOf('(', start);
  if (i === -1) return null;
  i++;

  const values: Row = [];
  let token = '';
  let inString = false;
  // Whether this value was quoted, tracked separately so an empty string stays
  // distinct from NULL and so leading whitespace before the quote is harmless.
  let wasQuoted = false;

  const push = () => {
    values.push(wasQuoted ? token : bareValue(token));
    token = '';
    wasQuoted = false;
  };

  while (i < src.length) {
    const ch = src[i];

    if (inString) {
      if (ch === "'") {
        if (src[i + 1] === "'") {
          token += "'";
          i += 2;
          continue;
        }
        inString = false;
        i++;
        continue;
      }
      token += ch;
      i++;
      continue;
    }

    if (ch === "'") {
      inString = true;
      wasQuoted = true;
      token = '';
      i++;
      continue;
    }
    if (ch === ',') {
      push();
      i++;
      continue;
    }
    if (ch === ')') {
      push();
      return { values, end: i + 1 };
    }
    token += ch;
    i++;
  }
  return null;
}

function bareValue(token: string): string | number | null {
  const t = token.trim();
  if (t === '' || t.toUpperCase() === 'NULL') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : t;
}

function readInserts(sql: string, table: string): Row[] {
  const rows: Row[] = [];
  const marker = `INSERT INTO ${table} `;
  let at = 0;
  for (;;) {
    const found = sql.indexOf(marker, at);
    if (found === -1) break;
    const valuesAt = sql.indexOf('VALUES', found);
    if (valuesAt === -1) break;
    const tuple = readTuple(sql, valuesAt);
    if (!tuple) break;
    rows.push(tuple.values);
    at = tuple.end;
  }
  return rows;
}

const s = (v: string | number | null): string => (v == null ? '' : String(v).trim());

/**
 * Their generator split hyphenated option names across the title and
 * description columns, leaving 18 of 200 options with a truncated title and a
 * description that opens on the rest of it plus an unmatched bracket:
 *
 *   title: "The Stay"   description: "Put Order): You tell everyone to stay..."
 *
 * Every instance is a hyphenated compound ("The Stay-Put Order", "The
 * De-escalating Greeting"), so the two halves are rejoined with the hyphen and
 * the bracket dropped. No words are invented or discarded, and each repair is
 * listed in the report for the client to confirm.
 */
const SPLIT_TITLE = /^([^:().]{1,45})\):\s+/;

type Repair = { scenario: number; label: string; before: string; after: string };

/**
 * One scenario of the fifty opens by restating its own heading inside the
 * narrative ("Scenario 18: The Compressed Margin\n..."). We store the title in
 * its own column and render it above the text, so left in place the candidate
 * would read the heading twice.
 */
const TITLE_PREFIX = /^Scenario\s+\d+\s*:[^\n]*\n+/;

function stripTitlePrefix(narrative: string): { text: string; stripped: string | null } {
  const match = narrative.match(TITLE_PREFIX);
  if (!match) return { text: narrative, stripped: null };
  return { text: narrative.slice(match[0].length).trim(), stripped: match[0].trim() };
}

function repairOption(title: string, description: string): { title: string; text: string; repaired: boolean } {
  const match = description.match(SPLIT_TITLE);
  if (!match || !title) return { title, text: description, repaired: false };
  return {
    title: `${title}-${match[1].trim()}`,
    text: description.slice(match[0].length).trim(),
    repaired: true,
  };
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const seedPath = args.find((a) => !a.startsWith('--'));
  if (!seedPath) {
    console.error('Usage: convert-client-pack.ts <path to seed.sql> [--apply]');
    process.exit(1);
  }

  const sql = readFileSync(resolve(seedPath), 'utf8');

  // scenario_packages (id, name, description, total_scenarios)
  const pkgRow = readInserts(sql, 'scenario_packages')[0];
  if (!pkgRow) {
    console.error('No scenario_packages INSERT found - is this the right file?');
    process.exit(1);
  }

  // dimensions (id, package_id, name, display_name, sort_order)
  const dimRows = readInserts(sql, 'dimensions');
  const dimensionById = new Map<string, { code: string; name: string; sort: number }>();
  for (const r of dimRows) {
    const id = s(r[0]);
    const code = s(r[2]).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    dimensionById.set(id, {
      code,
      name: s(r[3]) || code.replace(/_/g, ' '),
      sort: Number(r[4]) || 0,
    });
  }

  // option_scores (id, option_id, dimension_id, score)
  const scoresByOption = new Map<string, Record<string, number>>();
  let droppedScores = 0;
  for (const r of readInserts(sql, 'option_scores')) {
    const optionId = s(r[1]);
    const dim = dimensionById.get(s(r[2]));
    const weight = Number(r[3]);
    if (!dim || !Number.isFinite(weight)) {
      droppedScores++;
      continue;
    }
    const bucket = scoresByOption.get(optionId) ?? {};
    bucket[dim.code] = weight;
    scoresByOption.set(optionId, bucket);
  }

  // scenarios (id, package_id, sequence_number, title, narrative_text, decision_point)
  const scenarioRows = readInserts(sql, 'scenarios');
  const orderById = new Map<string, number>();
  for (const r of scenarioRows) orderById.set(s(r[0]), Number(r[2]) || 0);

  // options (id, scenario_id, label, title, description)
  const optionsByScenario = new Map<string, ParsedOption[]>();
  const repairs: Repair[] = [];

  for (const r of readInserts(sql, 'options')) {
    const optionId = s(r[0]);
    const scenarioId = s(r[1]);
    const label = s(r[2]).toUpperCase();
    const rawTitle = s(r[3]);
    const rawText = s(r[4]);

    const fixed = repairOption(rawTitle, rawText);
    if (fixed.repaired) {
      repairs.push({
        scenario: orderById.get(scenarioId) ?? 0,
        label,
        before: rawTitle,
        after: fixed.title,
      });
    }

    const list = optionsByScenario.get(scenarioId) ?? [];
    list.push({
      label,
      title: fixed.title || null,
      text: fixed.text,
      sortOrder: list.length,
      scores: scoresByOption.get(optionId) ?? {},
    });
    optionsByScenario.set(scenarioId, list);
  }

  const strippedHeadings: { scenario: number; heading: string }[] = [];

  const scenarios: ParsedScenario[] = scenarioRows
    .map((r): ParsedScenario => {
      const id = s(r[0]);
      const narrative = stripTitlePrefix(s(r[4]));
      if (narrative.stripped) {
        strippedHeadings.push({ scenario: Number(r[2]) || 0, heading: narrative.stripped });
      }
      const options = (optionsByScenario.get(id) ?? [])
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((o, i) => ({ ...o, sortOrder: i }));
      return {
        sequenceOrder: Number(r[2]) || 0,
        // Keeps their own id, so re-importing an edited pack updates these
        // scenarios instead of creating a second copy.
        externalRef: `CW-${String(Number(r[2]) || 0).padStart(3, '0')}`,
        title: s(r[3]) || null,
        narrativeText: narrative.text,
        decisionPoint: s(r[5]) || null,
        timeLimitSec: 90,
        options,
      };
    })
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const usedCodes = new Set<string>();
  for (const sc of scenarios) for (const o of sc.options) for (const c of Object.keys(o.scores)) usedCodes.add(c);

  const pack: ParsedPack = {
    package: {
      name: s(pkgRow[1]),
      code: 'CABIN_IN_THE_WOODS',
      description: s(pkgRow[2]),
      version: '1.0.0',
    },
    dimensions: Array.from(dimensionById.values())
      .sort((a, b) => a.sort - b.sort)
      .map((d) => ({ code: d.code, name: d.name, category: 'Disposition' })),
    scenarios,
  };

  const out = resolve(__dirname, '../prisma/packs/cabin-in-the-woods.json');
  writeFileSync(out, JSON.stringify(pack, null, 2) + '\n', 'utf8');

  const optionCount = scenarios.reduce((n, sc) => n + sc.options.length, 0);
  const scoreCount = scenarios.reduce(
    (n, sc) => n + sc.options.reduce((m, o) => m + Object.keys(o.scores).length, 0),
    0
  );
  const weights = scenarios.flatMap((sc) => sc.options.flatMap((o) => Object.values(o.scores)));
  const optionCounts = scenarios.map((sc) => sc.options.length);
  const noScores = scenarios.flatMap((sc) =>
    sc.options.filter((o) => Object.keys(o.scores).length === 0).map((o) => `${sc.sequenceOrder}${o.label}`)
  );

  console.log(`\nPack:        ${pack.package.name}  (${pack.package.code})`);
  console.log(`Declared:    ${Number(pkgRow[3]) || '?'} scenarios`);
  console.log(`Converted:   ${scenarios.length} scenarios, ${optionCount} options, ${scoreCount} scores`);
  console.log(`Dimensions:  ${pack.dimensions.length} declared, ${usedCodes.size} actually scored`);
  console.log(`Options:     ${Math.min(...optionCounts)}-${Math.max(...optionCounts)} per scenario`);
  console.log(`Weights:     ${Math.min(...weights)} to ${Math.max(...weights)}`);
  if (droppedScores) console.log(`Dropped:     ${droppedScores} scores with an unknown dimension`);
  if (noScores.length) console.log(`No weights:  ${noScores.join(', ')}`);

  const declaredCodes = new Set(pack.dimensions.map((d) => d.code));
  const unscored = Array.from(declaredCodes).filter((c) => !usedCodes.has(c));
  if (unscored.length) console.log(`Never scored: ${unscored.join(', ')}`);

  const missingNarrative = scenarios.filter((sc) => sc.narrativeText.length < 40);
  if (missingNarrative.length) {
    console.log(`Short narrative: scenarios ${missingNarrative.map((sc) => sc.sequenceOrder).join(', ')}`);
  }

  console.log(`\nOption names rejoined (${repairs.length}):`);
  for (const r of repairs) {
    console.log(`  ${String(r.scenario).padStart(2)}${r.label}  "${r.before}"  ->  "${r.after}"`);
  }

  if (strippedHeadings.length) {
    console.log(`\nDuplicated headings removed from the narrative (${strippedHeadings.length}):`);
    for (const h of strippedHeadings) console.log(`  ${String(h.scenario).padStart(2)}  "${h.heading}"`);
  }

  console.log(`\nWrote ${out}`);

  if (!apply) {
    console.log('Run again with --apply to import it.');
    return;
  }

  void (async () => {
    const { prisma } = await import('../src/lib/db');
    const { previewPack, writePack } = await import('../src/lib/pack-import');
    const preview = await previewPack(prisma, pack, []);
    console.log(
      `\nImporting: code in use = ${preview.codeInUse}, new dimensions = ${preview.newDimensions.join(', ') || 'none'}`
    );
    const result = await writePack(prisma, pack, { replaceExisting: true });
    console.log(
      `Imported: ${result.scenariosCreated} scenarios created, ${result.scenariosUpdated} updated, ` +
        `${result.scenariosRetired} retired; ${result.options} options written, ${result.scores} scores` +
        (result.dimensionsCreated.length ? `; ${result.dimensionsCreated.length} dimensions created` : '')
    );
    await prisma.$disconnect();
  })();
}

main();
