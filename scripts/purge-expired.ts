/**
 * Deletes practice runs past their retention date.
 *
 *   npm run db:purge-expired
 *
 * Also runs from prepare-db on each deploy, so a regularly deployed instance
 * needs no scheduler.
 */
import { prisma } from '../src/lib/db';
import { purgeExpiredPracticeRuns } from '../src/lib/retention';

async function main() {
  const { deleted, kept } = await purgeExpiredPracticeRuns();
  console.log(
    deleted || kept
      ? `Purge: deleted ${deleted} expired practice run(s); kept ${kept} that joined the registry.`
      : 'Purge: nothing has expired.'
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
