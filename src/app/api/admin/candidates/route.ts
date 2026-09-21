import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const adminEmail = getAdminSession();
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
