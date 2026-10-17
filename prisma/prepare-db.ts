import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { backfillLegacyTenant } from './backfill/001-legacy-tenant';

// Runs during the Vercel build (see "vercel-build" in package.json), before
// `next build`. Checks the required settings, creates or updates the database
// tables, then loads the starter assessment content if - and only if - the
// database is brand new.

function fail(lines: string[]): never {
  console.error(['', ...lines, '', 'See DEPLOY.md, then redeploy.', ''].join('\n'));
  process.exit(1);
}

// Checked here so a missing setting stops the build with a clear message at the
// top of the log, instead of a "Failed to collect page data" error later on.
const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development'
const missing: string[] = [];
if (!process.env.DATABASE_URL) {
  missing.push('  DATABASE_URL - connect a Neon Postgres database from the Storage tab (Step 2)');
}
if (!process.env.AUTH_SECRET) {
  missing.push('  AUTH_SECRET  - add it under Settings -> Environment Variables (Step 4)');
}
if (missing.length > 0) {
  fail([
    'These environment variables are not set:',
    ...missing,
    ...(vercelEnv && vercelEnv !== 'production'
      ? [
          '',
          `This is a ${vercelEnv} deployment. Environment variables are set per`,
          'environment in Vercel - tick Preview as well as Production when adding them.',
        ]
      : []),
  ]);
}

// Schema changes need a direct (unpooled) connection. Neon provides one as
// DATABASE_URL_UNPOOLED; other providers fall back to DATABASE_URL.
const directUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

function run(command: string) {
  execSync(command, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: directUrl } });
}

/** Host and database name, for the log. Never the credentials. */
function describeDatabase(url: string | undefined): string {
  if (!url) return 'unknown';
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return 'unparseable';
  }
}

/**
 * Why a connection string could not be read, in words the person who pasted
 * it can act on. Neon's Connect panel offers a ready-made `psql` command, and
 * copying the whole line - command, quotes and all - is the usual cause.
 */
function explainUnparseable(name: string, value: string): string[] {
  const trimmed = value.trim();
  if (/^psql\b/i.test(trimmed)) {
    return [
      `${name} starts with "psql", so the whole command line was copied.`,
      'In Neon, use the connection string on its own - not the psql command.',
    ];
  }
  if (/^["']|["']$/.test(trimmed)) {
    return [
      `${name} has quotes around it. Vercel stores the value literally, so the`,
      'quotes became part of the string. Paste it without them.',
    ];
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return [
      `${name} does not begin with postgresql:// - it looks like a hostname`,
      'rather than a full connection string.',
    ];
  }
  return [`${name} is not a connection string this can read.`];
}

/**
 * The same database, whether reached through the pooler or directly.
 *
 * Neon gives the two connections different hostnames - the pooled one carries
 * a `-pooler` suffix on the endpoint - so they have to be compared with that
 * removed, or every correct setup looks like a mismatch.
 */
function sameDatabase(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return true;
  const normalise = (url: string) => {
    try {
      const parsed = new URL(url);
      return `${parsed.host.replace('-pooler', '')}${parsed.pathname}`;
    } catch {
      return url;
    }
  };
  return normalise(a) === normalise(b);
}

async function main() {
  const target = describeDatabase(directUrl);

  // A value that cannot be read at all is its own problem, and reporting it
  // as "two different databases" sends someone looking for the wrong thing.
  for (const name of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'] as const) {
    const value = process.env[name];
    if (!value) continue;
    try {
      new URL(value);
    } catch {
      fail([
        ...explainUnparseable(name, value),
        '',
        'It should look like:',
        '  postgresql://user:password@host.neon.tech/neondb?sslmode=require',
        '',
        `Set it under Vercel -> Settings -> Environment Variables, scoped to`,
        `${vercelEnv ?? 'this environment'}. Nothing has been changed.`,
      ]);
    }
  }

  // Prisma's datasource reads DATABASE_URL; only migrations here use
  // DATABASE_URL_UNPOOLED. If the two name different databases, the schema
  // gets changed in one place while the application reads another - the
  // application then fails against a database that was never migrated, and
  // nothing says why. Easy to do by accident when setting up a preview
  // branch, so it is checked rather than trusted.
  if (!sameDatabase(process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED)) {
    fail([
      'DATABASE_URL and DATABASE_URL_UNPOOLED point at different databases:',
      '',
      `  DATABASE_URL          ${describeDatabase(process.env.DATABASE_URL)}   (what the app reads)`,
      `  DATABASE_URL_UNPOOLED ${describeDatabase(process.env.DATABASE_URL_UNPOOLED)}   (what migrations would change)`,
      '',
      'They must be the pooled and direct connections of the same database.',
      'This usually means one of them was given a preview branch while the',
      'other still points somewhere else. Nothing has been changed.',
    ]);
  }

  // Preview builds get whatever DATABASE_URL the Preview environment holds,
  // which by default is the production one. Migrating or seeding from a
  // feature branch would then alter live data, so those steps are production
  // only unless previews have been given their own database.
  //
  // Opting in names the database rather than just saying yes: set
  // ALLOW_PREVIEW_DB_WRITES to a distinctive part of the preview database's
  // host, and if DATABASE_URL has not actually been repointed, the value will
  // not match and the build stops. Enabling the flag and forgetting to change
  // the URL is the mistake worth engineering against, because it is silent and
  // it lands on production.
  const previewOptIn = process.env.ALLOW_PREVIEW_DB_WRITES?.trim();
  const isPreview = Boolean(vercelEnv) && vercelEnv !== 'production';

  let mayWriteSchema = !vercelEnv || vercelEnv === 'production';

  if (isPreview && previewOptIn) {
    if (previewOptIn === '1') {
      mayWriteSchema = true;
      console.warn(
        [
          '',
          `WARNING: this ${vercelEnv} build will migrate and seed ${target}.`,
          'ALLOW_PREVIEW_DB_WRITES is set to "1", which does not check which',
          'database that is. Set it to a distinctive part of the preview',
          "database's host instead, and this will refuse to run if the URL is",
          'ever pointed somewhere else.',
          '',
        ].join('\n')
      );
    } else if (target.includes(previewOptIn)) {
      mayWriteSchema = true;
      console.log(`${vercelEnv} deployment - preparing its own database (${target}).`);
    } else {
      fail([
        `This ${vercelEnv} deployment is set up to prepare its own database,`,
        `but DATABASE_URL points at ${target}, which does not contain`,
        `"${previewOptIn}".`,
        '',
        'Nothing has been changed. To fix it, in Vercel:',
        '',
        '  Settings -> Environment Variables -> DATABASE_URL',
        `  Scope: ${vercelEnv} only. Value: the pooled connection string of the`,
        `  "${previewOptIn}" branch, from Neon -> Branches -> Connect.`,
        '',
        '  DATABASE_URL_UNPOOLED, same scope, is that branch\'s direct string.',
        '',
        'If instead this deployment should use the database it already has,',
        'remove ALLOW_PREVIEW_DB_WRITES and it will leave it untouched.',
      ]);
    }
  }

  if (!mayWriteSchema) {
    console.log(
      `${vercelEnv} deployment - leaving ${target} untouched. ` +
        'Give previews their own database and set ALLOW_PREVIEW_DB_WRITES to part of its host to change that.'
    );
    return;
  }

  console.log(`Preparing ${target}.`);

  const prisma = new PrismaClient({ datasourceUrl: directUrl });

  // This project was deployed with `prisma db push` for months, so the live
  // database has tables but no migration history. Adopt it on the first run
  // that sees that combination: mark the baseline as already applied, then let
  // `migrate deploy` carry every later migration. Without the baseline,
  // `migrate deploy` would try to create tables that already exist.
  const [{ adopted }] = await prisma.$queryRaw<{ adopted: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    ) AS adopted
  `;
  const [{ populated }] = await prisma.$queryRaw<{ populated: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'platform_settings'
    ) AS populated
  `;

  if (!adopted && populated) {
    // Adopting the baseline records "0_init is already applied". If the live
    // schema has drifted from schema.prisma, that record is a lie and the next
    // migration fails against a shape nobody expected. Check before claiming it.
    const drift = execSync(
      'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script',
      { encoding: 'utf8', env: { ...process.env, DATABASE_URL: directUrl } }
    ).trim();

    const clean = drift.split('\n').every((line) => line.trim() === '' || line.startsWith('--'));
    if (!clean) {
      fail([
        'The live database does not match prisma/schema.prisma, so the migration',
        'baseline cannot be adopted safely. Differences found:',
        '',
        ...drift.split('\n').slice(0, 20).map((l) => '  ' + l),
        '',
        'Reconcile these before deploying again.',
      ]);
    }

    console.log('Existing database matches the schema - adopting the migration baseline.');
    run('npx prisma migrate resolve --applied 0_init');
  }

  run('npx prisma migrate deploy');

  // Idempotent; gives rows that predate multi-tenancy an owner.
  await backfillLegacyTenant(prisma);

  // Practice runs carry a retention date; something has to honour it. Doing it
  // here means a regularly deployed instance needs no scheduler.
  try {
    const { purgeExpiredPracticeRuns } = await import('../src/lib/retention');
    const { deleted, kept } = await purgeExpiredPracticeRuns();
    if (deleted || kept) {
      console.log(`Purge: deleted ${deleted} expired practice run(s); kept ${kept} that joined the registry.`);
    }
  } catch (error) {
    // Retention is housekeeping. It must never fail a deploy.
    console.warn('Purge skipped:', error instanceof Error ? error.message : error);
  }

  const [admins, dimensions, packages, users] = await Promise.all([
    prisma.admin.count(),
    prisma.dimension.count(),
    prisma.scenarioPackage.count(),
    prisma.user.count(),
  ]);
  await prisma.$disconnect();

  // The first sign-in with ADMIN_EMAIL / ADMIN_PASSWORD creates the Super Admin
  // account. With no admin yet and neither set, nobody could ever sign in.
  if (admins === 0 && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) {
    fail([
      'No admin account exists yet, and ADMIN_EMAIL / ADMIN_PASSWORD are not set.',
      '  Add both under Settings -> Environment Variables (Step 4).',
    ]);
  }

  // seed.ts clears every content table before inserting, so it must never run
  // against a database that already holds data. Every other table it clears
  // depends on one of these three through a required foreign key, so if all
  // three are empty, nothing can be lost.
  if (dimensions > 0 || packages > 0 || users > 0) {
    console.log('Database already has data - skipping starter content.');
    return;
  }

  console.log('Empty database - loading starter assessment content...');
  run('npx prisma db seed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
