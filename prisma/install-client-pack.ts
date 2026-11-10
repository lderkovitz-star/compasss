import { readFileSync } from 'fs';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';

/**
 * Puts the client's authored assessment into the database on deploy.
 *
 * Their 50-scenario pack lives in the repository as prisma/packs, converted
 * from the SQL they delivered. Until now it had to be uploaded by hand from
 * the console, which meant every fresh database - production, a preview
 * branch - came up running the five-scenario demo instead, and looked like
 * the engine could not do more than five.
 *
 * Idempotent: scenarios are matched on their external reference, so running
 * this on every deploy updates the pack rather than duplicating it.
 */
export async function installClientPack(prisma: PrismaClient): Promise<void> {
  const file = join(__dirname, 'packs', 'cabin-in-the-woods.json');

  let pack;
  try {
    pack = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // The pack is optional; a deployment without it is still a valid one.
    return;
  }

  const { parsePackJson, writePack } = await import('../src/lib/pack-import');
  const parsed = parsePackJson(pack);
  if (!parsed.pack) return;

  const errors = parsed.issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    console.warn(
      `Client pack not installed - ${errors.length} problem(s) in the file: ${errors[0].path} ${errors[0].message}`
    );
    return;
  }

  const result = await writePack(prisma, parsed.pack, { replaceExisting: true });
  if (result.scenariosCreated || result.scenariosUpdated) {
    console.log(
      `Client pack: ${result.scenariosCreated} scenario(s) added, ${result.scenariosUpdated} updated (${result.packageCode}).`
    );
  }

  // Having the pack in the database is no use if nothing runs it. If the slots
  // still point at the seeded demo - or at nothing - move them across. An
  // operator who has deliberately chosen a pack keeps their choice.
  const demo = await prisma.scenarioPackage.findUnique({
    where: { code: 'CABIN_SURVIVAL_V1' },
    select: { id: true },
  });
  const settings = await prisma.platformSettings.findFirst({
    select: { id: true, sandboxPackageId: true, defaultClientPackageId: true },
  });

  // The settings row is created lazily, the first time something reads it, so
  // on a fresh deployment it does not exist yet - and the pack would land with
  // nothing pointing at it.
  if (!settings) {
    await prisma.platformSettings.create({
      data: {
        sandboxPackageId: result.packageId,
        defaultClientPackageId: result.packageId,
      },
    });
    console.log('Client pack is what the sandbox and the client default now run.');
    return;
  }

  const isUnsetOrDemo = (slot: string | null) => slot === null || (demo ? slot === demo.id : false);
  const data: Record<string, string> = {};
  if (isUnsetOrDemo(settings.sandboxPackageId)) data.sandboxPackageId = result.packageId;
  if (isUnsetOrDemo(settings.defaultClientPackageId)) data.defaultClientPackageId = result.packageId;

  if (Object.keys(data).length > 0) {
    await prisma.platformSettings.update({ where: { id: settings.id }, data });
    console.log(`Client pack is now what ${Object.keys(data).join(' and ')} run.`);
  }
}
