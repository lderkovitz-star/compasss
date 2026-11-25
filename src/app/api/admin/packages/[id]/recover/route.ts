import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';
import { bumpRevision } from '@/lib/scenario-versions';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const packageId = params.id;
    
    // Ensure the package exists and is deleted
    const pkg = await prisma.scenarioPackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
    }
    if (!pkg.deletedAt) {
      return NextResponse.json({ error: 'Package is not deleted.' }, { status: 400 });
    }

    // Recover package and the scenarios trashed with it. Deleting a package
    // stamps its live scenarios with the package's own time (packages older
    // than that change were stamped a moment later, hence the window), so
    // scenarios retired before then, and earlier versions kept for candidates'
    // reports, stay where they are.
    const at = pkg.deletedAt.getTime();
    await prisma.$transaction(async (tx) => {
      await tx.scenarioPackage.update({
        where: { id: packageId },
        data: { deletedAt: null }
      });
      
      await tx.scenario.updateMany({
        where: {
          packageId: packageId,
          supersededById: null,
          deletedAt: { gte: new Date(at - 60_000), lte: new Date(at + 60_000) },
        },
        data: { deletedAt: null }
      });
      await bumpRevision(tx, packageId);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[package RECOVER]', err);
    return NextResponse.json({ error: 'Failed to recover package.' }, { status: 500 });
  }
}
