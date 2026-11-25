import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { withoutDemoDimensions } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const dimensions = await prisma.dimension.findMany({
      where: withoutDemoDimensions(),
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(dimensions);
  } catch (err) {
    console.error('[dimensions GET]', err);
    return NextResponse.json({ error: 'Failed to fetch dimensions.' }, { status: 500 });
  }
}
