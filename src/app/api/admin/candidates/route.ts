import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const candidates = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { sessions: true }
        }
      }
    });

    return NextResponse.json(candidates);
  } catch (err) {
    console.error('[candidates GET]', err);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}
