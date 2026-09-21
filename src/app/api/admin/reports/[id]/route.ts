import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET — full report data (admin only)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;

  try {
    const session = await prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            targetRole: true,
            hobbiesSkills: true,
            resumeFileUrl: true,
            createdAt: true,
          },
        },
        package: { select: { name: true, code: true, version: true } },
        finalScores: {
          include: { dimension: true },
          orderBy: { finalScore: 'desc' },
        },
        responses: {
          include: {
            scenario: { select: { sequenceOrder: true, narrativeText: true, timeLimitSec: true } },
            option: { select: { optionCode: true, optionText: true } },
          },
          orderBy: { submittedAt: 'asc' },
        },
        biometrics: { orderBy: { recordedAt: 'asc' } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    // Serialize BigInt fields for JSON
    const serialized = {
      ...session,
      biometrics: session.biometrics.map(b => ({
        ...b,
        recordedAt: Number(b.recordedAt),
      })),
    };

    return NextResponse.json(serialized);
  } catch (err) {
    console.error('[admin report GET]', err);
    return NextResponse.json({ error: 'Failed to load report.' }, { status: 500 });
  }
}
