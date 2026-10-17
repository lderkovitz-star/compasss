import { PrismaClient } from '@prisma/client';

/**
 * Gives every row that predates multi-tenancy an owner.
 *
 * Runs from prepare-db on each deploy. It is written to be idempotent rather
 * than guarded by a marker: every statement either upserts by a unique key or
 * only touches rows that are still unassigned, so running it twice changes
 * nothing the second time.
 */
export async function backfillLegacyTenant(prisma: PrismaClient): Promise<void> {
  const account = await prisma.clientAccount.upsert({
    where: { slug: 'continental-works' },
    update: {},
    create: {
      name: 'Continental Works',
      slug: 'continental-works',
      contactEmail: 'support@continentalworks.com',
      status: 'ACTIVE',
    },
  });

  // Candidates and their sessions. `kind` already defaults to OFFICIAL, and
  // practice runs are created with clientAccountId left null, so filtering on
  // null here cannot capture anything that should have stayed unowned.
  //
  // Raw SQL on purpose. This has to run before the migration that makes
  // users.client_account_id NOT NULL, and once that migration has been
  // generated the typed client no longer admits `clientAccountId: null` as a
  // filter - it describes the shape after the change, not before it.
  const [candidates, sessions] = await Promise.all([
    prisma.$executeRaw`UPDATE users SET client_account_id = ${account.id} WHERE client_account_id IS NULL`,
    prisma.$executeRaw`UPDATE assessment_sessions SET client_account_id = ${account.id} WHERE client_account_id IS NULL AND kind = 'OFFICIAL'`,
  ]);

  // Module B replaces the single global isActive flag with three independent
  // slots. Seed them from whatever is active today so behaviour is unchanged
  // until someone sets them deliberately.
  const settings = await prisma.platformSettings.findFirst();
  if (settings && (!settings.sandboxPackageId || !settings.defaultClientPackageId)) {
    const activePackage = await prisma.scenarioPackage.findFirst({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (activePackage) {
      await prisma.platformSettings.update({
        where: { id: settings.id },
        data: {
          sandboxPackageId: settings.sandboxPackageId ?? activePackage.id,
          defaultClientPackageId: settings.defaultClientPackageId ?? activePackage.id,
        },
      });
    }
  }

  // The seeded package description promised "biometric emotional stability",
  // which the product no longer measures. Fixing the seed file only helps a
  // fresh database; this corrects the installs that already have it. Scoped to
  // that exact phrase so nothing an operator has written since is touched.
  const reworded = await prisma.$executeRaw`
    UPDATE scenario_packages
    SET description = replace(description, 'and biometric emotional stability', 'and composure')
    WHERE description LIKE '%and biometric emotional stability%'
  `;
  if (reworded) {
    console.log(`Backfill: reworded ${reworded} package description(s) that still mentioned biometrics.`);
  }

  // Say so either way. Running this and seeing nothing leaves you unsure
  // whether it did its job or failed to find the database.
  if (candidates || sessions) {
    console.log(
      `Backfill: assigned ${candidates} candidate(s) and ${sessions} session(s) to ${account.name}.`
    );
  } else {
    console.log(`Backfill: nothing to assign - every row already belongs to a tenant.`);
  }
}

// Also runnable on its own, which is how it is used when migrating an
// existing database by hand: `npm run db:backfill`. Guarded, so importing
// this from prepare-db.ts does not run it a second time.
if (require.main === module) {
  const prisma = new PrismaClient();
  backfillLegacyTenant(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
