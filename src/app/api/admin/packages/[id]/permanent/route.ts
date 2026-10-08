import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const packageId = params.id;
    
    // Ensure we don't delete an active package permanently
    const pkg = await prisma.scenarioPackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
    }
    if (pkg.isActive) {
      return NextResponse.json({ error: 'Cannot permanently delete an active package.' }, { status: 400 });
    }

    await prisma.scenarioPackage.delete({
      where: { id: packageId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[package PERMANENT DELETE]', err);
    return NextResponse.json({ error: 'Failed to permanently delete package.' }, { status: 500 });
  }
}
