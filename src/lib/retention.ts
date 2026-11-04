import { prisma } from './db';

/**
 * Deletes practice runs past their retention date.
 *
 * Practice sittings are created with a `purgeAfter` date, and telling someone
 * their run is deleted after 30 days means something has to delete it. This
 * is that something.
 *
 * Responses, score snapshots and final scores all cascade from the sitting, so
 * removing it removes everything about it. A run that opted into the talent
 * registry is kept: the person asked for it to be, and the registry entry
 * cascades from the sitting too, so deleting it would silently withdraw them.
 */
export async function purgeExpiredPracticeRuns(): Promise<{ deleted: number; kept: number }> {
  const now = new Date();

  const expired = await prisma.assessmentSession.findMany({
    where: {
      kind: 'PRACTICE',
      purgeAfter: { lt: now },
    },
    select: { id: true, registryOptIn: true },
  });

  const toDelete = expired.filter((s) => !s.registryOptIn).map((s) => s.id);
  const kept = expired.length - toDelete.length;

  if (toDelete.length === 0) return { deleted: 0, kept };

  // Any resume uploaded for one of these is detached first - the row is
  // removed, though the stored file itself needs the storage adapter's
  // delete, which is tracked separately.
  await prisma.resumeDocument.deleteMany({ where: { sessionId: { in: toDelete } } });
  const result = await prisma.assessmentSession.deleteMany({
    where: { id: { in: toDelete } },
  });

  return { deleted: result.count, kept };
}
