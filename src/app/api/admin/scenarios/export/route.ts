import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { exportPack } from '@/lib/pack-import';

export const dynamic = 'force-dynamic';

/**
 * Exports a package in the same shape the importer accepts, so a pack can be
 * downloaded, edited and uploaded back without anything being retyped.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const packageId = req.nextUrl.searchParams.get('packageId');
  if (!packageId) {
    return NextResponse.json({ error: 'packageId is required.' }, { status: 400 });
  }

  const pack = await exportPack(prisma, packageId);
  if (!pack) {
    return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
  }

  const filename = `${pack.package.code.toLowerCase().replace(/_/g, '-')}.json`;
  return new NextResponse(JSON.stringify(pack, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
