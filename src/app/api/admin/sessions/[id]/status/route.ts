import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const session = await prisma.assessmentSession.findUnique({
      where: { id: params.id },
      select: {
        status: true,
        startedAt: true,
        currentScenarioIdx: true,
        completedAt: true,
        _count: { select: { responses: true } },
        responses: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
          select: { submittedAt: true, timeSpentMs: true }
        }
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    const lastActivityAt = session.responses.length > 0 
      ? session.responses[0].submittedAt 
      : session.startedAt;

    return NextResponse.json({
      status: session.status,
      currentScenarioIdx: session.currentScenarioIdx,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      lastActivityAt,
      completedResponsesCount: session._count.responses
    });
  } catch (err) {
    console.error('[session STATUS]', err);
    return NextResponse.json({ error: 'Failed to fetch session status.' }, { status: 500 });
  }
}
