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
const missing: string[] = [];
if (!process.env.DATABASE_URL) {
  missing.push('  DATABASE_URL - connect a Neon Postgres database from the Storage tab (Step 2)');
}
if (!process.env.AUTH_SECRET) {
  missing.push('  AUTH_SECRET  - add it under Settings -> Environment Variables (Step 4)');
}
if (missing.length > 0) {
  fail(['These environment variables are not set:', ...missing]);
}

// Schema changes need a direct (unpooled) connection. Neon provides one as
// DATABASE_URL_UNPOOLED; other providers fall back to DATABASE_URL.
const directUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

function run(command: string) {
  execSync(command, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: directUrl } });
}

async function main() {
  run('npx prisma db push --skip-generate');

  const prisma = new PrismaClient({ datasourceUrl: directUrl });
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
