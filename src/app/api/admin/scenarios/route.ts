import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET — list all scenarios (optionally filter by packageId)
export async function GET(req: NextRequest) {
  const packageId = req.nextUrl.searchParams.get('packageId');
  const status = req.nextUrl.searchParams.get('status');
  const isDeleted = status === 'deleted';

  const scenarios = await prisma.scenario.findMany({
    where: {
      ...(packageId ? { packageId } : {}),
      deletedAt: isDeleted ? { not: null } : null,
    },
    orderBy: [{ packageId: 'asc' }, { sequenceOrder: 'asc' }],
    include: {
      package: { select: { name: true, code: true } },
      _count: { select: { options: true } },
    },
  });
  return NextResponse.json(scenarios);
}

// POST — create new scenario
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { packageId, narrativeText, timeLimitSec, sequenceOrder, options } = body;
    if (!packageId || !narrativeText) {
      return NextResponse.json({ error: 'packageId and narrativeText required.' }, { status: 400 });
    }
    const scenario = await prisma.scenario.create({
      data: {
        packageId,
        narrativeText,
        timeLimitSec: timeLimitSec || 90,
        sequenceOrder: sequenceOrder || 1,
        options: {
          create: [
            { optionCode: 'A', optionText: options?.[0] || '' },
            { optionCode: 'B', optionText: options?.[1] || '' },
            { optionCode: 'C', optionText: options?.[2] || '' },
            { optionCode: 'D', optionText: options?.[3] || '' },
          ]
        }
      },
      include: {
        _count: { select: { options: true } },
      }
    });
    return NextResponse.json(scenario, { status: 201 });
  } catch (err) {
    console.error('[scenarios POST]', err);
    return NextResponse.json({ error: 'Failed to create scenario.' }, { status: 500 });
  }
}
