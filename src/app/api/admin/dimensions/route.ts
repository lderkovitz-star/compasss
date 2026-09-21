import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
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
