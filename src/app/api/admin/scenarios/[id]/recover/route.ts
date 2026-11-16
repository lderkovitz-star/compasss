import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';
import { bumpRevision } from '@/lib/scenario-versions';

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
    // Bringing back an earlier version would put two copies of the same
    // scenario in front of new candidates.
    if (scenario.supersededById) {
      return NextResponse.json(
        { error: 'This is an earlier version of a scenario that was edited later. The current version is the one to use.' },
        { status: 409 }
      );
    }

    // Recover scenario
    await prisma.$transaction(async (tx) => {
      await tx.scenario.update({
        where: { id: scenarioId },
        data: { deletedAt: null }
      });
      await bumpRevision(tx, scenario.packageId);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[scenario RECOVER]', err);
    return NextResponse.json({ error: 'Failed to recover scenario.' }, { status: 500 });
  }
}
