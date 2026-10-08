import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const scenarioId = params.id;
    
    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found.' }, { status: 404 });
    }
    if (!scenario.deletedAt) {
      return NextResponse.json({ error: 'Scenario is not deleted.' }, { status: 400 });
    }

    // Recover scenario
    await prisma.scenario.update({
      where: { id: scenarioId },
      data: { deletedAt: null }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[scenario RECOVER]', err);
    return NextResponse.json({ error: 'Failed to recover scenario.' }, { status: 500 });
  }
}
