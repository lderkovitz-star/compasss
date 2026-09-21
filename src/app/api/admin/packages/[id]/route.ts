import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const packageId = params.id;
    
    // Ensure we don't delete the active package
    const pkg = await prisma.scenarioPackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
    }
    if (pkg.isActive) {
      return NextResponse.json({ error: 'Cannot delete an active package. Set another package as active first.' }, { status: 400 });
    }

    // Perform soft delete in a transaction to cascade to scenarios
    await prisma.$transaction(async (tx) => {
      await tx.scenarioPackage.update({
        where: { id: packageId },
        data: { deletedAt: new Date() }
      });
      
      await tx.scenario.updateMany({
        where: { packageId: packageId },
        data: { deletedAt: new Date() }
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[package DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete package.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const packageId = params.id;
    const body = await req.json();
    const { backdropImageUrl } = body;

    const pkg = await prisma.scenarioPackage.update({
      where: { id: packageId },
      data: {
        backdropImageUrl: backdropImageUrl !== undefined ? backdropImageUrl : undefined
      }
    });

    return NextResponse.json(pkg);
  } catch (err) {
    console.error('[package PUT]', err);
    return NextResponse.json({ error: 'Failed to update package.' }, { status: 500 });
  }
}
