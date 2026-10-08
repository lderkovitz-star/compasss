import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

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

async function main() {
  // Preview builds share whatever DATABASE_URL the Preview environment holds,
  // which is usually the production one. Pushing the schema or seeding from a
  // feature branch would then alter live data, so those steps are production
  // only. Set ALLOW_PREVIEW_DB_WRITES=1 if previews ever get their own branch
  // database.
  const mayWriteSchema =
    !vercelEnv || vercelEnv === 'production' || process.env.ALLOW_PREVIEW_DB_WRITES === '1';

  if (!mayWriteSchema) {
    console.log(
      `${vercelEnv} deployment - skipping schema push and seeding so the production database is left alone.`
    );
    return;
  }

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
