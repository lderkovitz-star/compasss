import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

// Runs during the Vercel build (see "vercel-build" in package.json), before
// `next build`. Creates or updates the database tables, then loads the starter
// assessment content if - and only if - the database is brand new.

if (!process.env.DATABASE_URL) {
  console.error(
    '\nDATABASE_URL is not set.\n' +
      'Connect a Neon Postgres database to this project from the Vercel Storage tab, then redeploy.\n'
  );
  process.exit(1);
}

// Schema changes need a direct (unpooled) connection. Neon provides one as
// DATABASE_URL_UNPOOLED; other providers fall back to DATABASE_URL.
const directUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

function run(command: string) {
  execSync(command, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: directUrl } });
}

async function main() {
  run('npx prisma db push --skip-generate');

  // seed.ts clears every content table before inserting, so it must never run
  // against a database that already holds data. Every other table it clears
  // depends on one of these three through a required foreign key, so if all
  // three are empty, nothing can be lost.
  const prisma = new PrismaClient({ datasourceUrl: directUrl });
  const [dimensions, packages, users] = await Promise.all([
    prisma.dimension.count(),
    prisma.scenarioPackage.count(),
    prisma.user.count(),
  ]);
  await prisma.$disconnect();

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
