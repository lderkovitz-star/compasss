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
  const [candidates, sessions] = await Promise.all([
    prisma.user.updateMany({
      where: { clientAccountId: null },
      data: { clientAccountId: account.id },
    }),
    prisma.assessmentSession.updateMany({
      where: { clientAccountId: null, kind: 'OFFICIAL' },
      data: { clientAccountId: account.id },
    }),
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

  if (candidates.count || sessions.count) {
    console.log(
      `Backfill: assigned ${candidates.count} candidate(s) and ${sessions.count} session(s) to ${account.name}.`
    );
  }
}
