import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';
import { isInUse, scenarioUse } from '@/lib/scenario-versions';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const scenarioId = params.id;

    // Answers, timings and score steps all cascade from the scenario, so
    // deleting one that candidates have seen would take their answers out of
    // their reports. Those stay in the trash.
    const use = await scenarioUse(prisma, scenarioId);
    if (isInUse(use)) {
      const why =
        use.unfinished > 0
          ? `${use.unfinished} assessment${use.unfinished === 1 ? ' under way includes' : 's under way include'} it`
          : use.answers > 0
            ? `${use.answers} answer${use.answers === 1 ? '' : 's'} in candidates' reports would be deleted with it`
            : `finished assessments include it`;
      return NextResponse.json(
        {
          error: `This scenario can't be deleted permanently: ${why}. It stays in the trash, where new candidates never get it.`,
        },
        { status: 409 }
      );
    }

    await prisma.scenario.delete({
      where: { id: scenarioId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[scenario PERMANENT DELETE]', err);
    return NextResponse.json({ error: 'Failed to permanently delete scenario.' }, { status: 500 });
  }
}
