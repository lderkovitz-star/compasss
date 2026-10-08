import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const scenarioId = params.id;

    // Prisma handles cascading deletes automatically based on schema definition
    await prisma.scenario.delete({
      where: { id: scenarioId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[scenario PERMANENT DELETE]', err);
    return NextResponse.json({ error: 'Failed to permanently delete scenario.' }, { status: 500 });
  }
}
