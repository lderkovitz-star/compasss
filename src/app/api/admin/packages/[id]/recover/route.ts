import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Recover package and associated scenarios
    await prisma.$transaction(async (tx) => {
      await tx.scenarioPackage.update({
        where: { id: packageId },
        data: { deletedAt: null }
      });
      
      await tx.scenario.updateMany({
        where: { packageId: packageId },
        data: { deletedAt: null }
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[package RECOVER]', err);
    return NextResponse.json({ error: 'Failed to recover package.' }, { status: 500 });
  }
}
