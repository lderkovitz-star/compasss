import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';
import { bumpRevision, saveScenarioEdit } from '@/lib/scenario-versions';

// GET single scenario with options
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const scenario = await prisma.scenario.findUnique({
    where: { id: params.id },
    include: {
      options: {
        orderBy: { optionCode: 'asc' },
        include: { scores: true }
      },
      package: { select: { name: true, code: true } },
    },
  });
  if (!scenario) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(scenario);
}

// PUT — update scenario + its options. A scenario that candidates have
// answered, or that is part of a sitting under way, is saved as a new version
// instead, so those candidates and their reports keep what they saw.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
    }

    const outcome = await saveScenarioEdit(prisma, params.id, body);
    switch (outcome.kind) {
      case 'not-found':
        return NextResponse.json({ error: 'Not found.' }, { status: 404 });
      case 'superseded':
        return NextResponse.json(
          {
            error:
              'This is an earlier version of the scenario, kept unchanged for the candidates who answered it. Edit the current version instead.',
            currentId: outcome.currentId,
          },
          { status: 409 }
        );
      case 'unchanged':
        return NextResponse.json({ id: outcome.id, unchanged: true });
      case 'updated':
        return NextResponse.json({ id: outcome.id, revision: outcome.revision });
      case 'versioned':
        return NextResponse.json({
          id: outcome.id,
          previousId: outcome.previousId,
          versioned: true,
          revision: outcome.revision,
          unfinishedSittings: outcome.unfinishedSittings,
        });
    }
  } catch (err) {
    console.error('[scenario PUT]', err);
    return NextResponse.json({ error: 'Failed to update scenario.' }, { status: 500 });
  }
}

// DELETE — scenario soft delete. New sittings stop getting it; a sitting that
// already includes it keeps it to the end.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const row = await prisma.scenario.findUnique({ where: { id: params.id }, select: { packageId: true, deletedAt: true } });
    if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    if (!row.deletedAt) {
      await prisma.$transaction(async (tx) => {
        await tx.scenario.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
        await bumpRevision(tx, row.packageId);
      });
    }
    return NextResponse.json({ deleted: params.id });
  } catch (err) {
    console.error('[scenario DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete scenario.' }, { status: 500 });
  }
}
