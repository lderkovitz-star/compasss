/**
 * Fails if a tenant-facing file queries the database without naming a tenant.
 *
 * Isolation here is carried by the queries themselves - every employer-facing
 * lookup includes `clientAccountId` as part of the `where`, so a row from
 * another account behaves like one that does not exist. That holds today
 * because each query was written that way, and nothing stops the next one
 * from being written differently. One missed clause is not a cosmetic bug; it
 * shows one employer another's candidates.
 *
 * So this reads the portal routes and pages and insists that any Prisma call
 * mentioning a tenant-owned model also mentions the tenant - or carries an
 * explicit waiver saying why it does not.
 *
 *   npm run check:tenant-scoping
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOTS = ['src/app/portal', 'src/app/api/portal'];

/** Models whose rows belong to one employer. */
const TENANT_MODELS = [
  'user',
  'assessmentSession',
  'assessmentInvite',
  'jobContext',
  'resumeDocument',
  'response',
  'finalScore',
  'scoreSnapshot',
  'notification',
  'emailLog',
  'auditLog',
];

/** Reading these is not tenant-specific. */
const SHARED_MODELS = ['scenarioPackage', 'scenario', 'scenarioOption', 'dimension', 'platformSettings', 'clientAccount'];

const WAIVER = 'tenant-scoping-ok';

type Finding = { file: string; line: number; text: string; reason: string };

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

/** Takes the text of one Prisma call, from `prisma.` to its closing paren. */
function callText(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start, start + 600);
}

function main() {
  const findings: Finding[] = [];
  const pattern = /prisma\.(\w+)\.(findMany|findFirst|findUnique|count|aggregate|groupBy|update|updateMany|delete|deleteMany|create|createMany|upsert)\s*\(/g;

  for (const root of ROOTS) {
    let files: string[];
    try {
      files = walk(root);
    } catch {
      continue;
    }

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');

      for (const match of Array.from(source.matchAll(pattern))) {
        const [, model] = match;
        if (!TENANT_MODELS.includes(model)) {
          if (SHARED_MODELS.includes(model)) continue;
          // An unrecognised model is worth a look rather than a pass.
        }

        const index = match.index ?? 0;
        const lineNo = source.slice(0, index).split('\n').length;
        const call = callText(source, index);

        if (call.includes('clientAccountId')) continue;

        // A waiver on the call's line, or the line above it.
        const nearby = [lines[lineNo - 1], lines[lineNo - 2], lines[lineNo - 3]].join('\n');
        if (nearby.includes(WAIVER)) continue;

        findings.push({
          file: relative(process.cwd(), file),
          line: lineNo,
          text: call.split('\n')[0].trim(),
          reason: TENANT_MODELS.includes(model)
            ? `${model} is tenant-owned but this call does not mention clientAccountId`
            : `${model} is not a known model - confirm whether it is tenant-owned`,
        });
      }
    }
  }

  if (findings.length === 0) {
    console.log('Tenant scoping: every employer-facing query names its tenant.');
    return;
  }

  console.error(`Tenant scoping: ${findings.length} query(ies) need attention.\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}`);
    console.error(`    ${f.text}`);
    console.error(`    ${f.reason}\n`);
  }
  console.error(
    `If a call is genuinely not tenant-specific, put "${WAIVER}" in a comment above it with the reason.`
  );
  process.exit(1);
}

main();
