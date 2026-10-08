import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const dimensions = await prisma.dimension.findMany({
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(dimensions);
  } catch (err) {
    console.error('[dimensions GET]', err);
    return NextResponse.json({ error: 'Failed to fetch dimensions.' }, { status: 500 });
  }
}
