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
    // Sittings cascade from their package, so deleting one that candidates
    // have taken would delete their reports; invite links point at it too.
    const [sittings, invites] = await Promise.all([
      prisma.assessmentSession.count({ where: { packageId } }),
      prisma.assessmentInvite.count({ where: { packageId } }),
    ]);
    if (sittings > 0 || invites > 0) {
      const why = sittings > 0
        ? `${sittings} assessment${sittings === 1 ? ' was' : 's were'} taken on it, and deleting it would delete ${sittings === 1 ? 'that report' : 'those reports'}`
        : `${invites} invite link${invites === 1 ? ' points' : 's point'} at it`;
      return NextResponse.json(
        { error: `This package can't be deleted permanently: ${why}. It stays in the trash, where employers and new candidates never see it.` },
        { status: 409 }
      );
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
