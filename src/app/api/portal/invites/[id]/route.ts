import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireClient } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/** Revoke a link that has not been used yet. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const portal = await requireClient();
  if (portal instanceof NextResponse) return portal;

  // The tenant is part of the lookup, so an id from another account behaves
  // exactly like one that does not exist.
  const invite = await prisma.assessmentInvite.findFirst({
    where: { id: params.id, clientAccountId: portal.clientAccountId },
    select: { id: true, status: true, consumedAt: true },
  });

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found.' }, { status: 404 });
  }
  if (invite.consumedAt) {
    return NextResponse.json(
      { error: 'This link has already been used and cannot be revoked.' },
      { status: 409 }
    );
  }

  await prisma.assessmentInvite.update({
    where: { id: invite.id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      clientAccountId: portal.clientAccountId,
      actorType: 'CLIENT',
      action: 'invite.revoke',
      targetType: 'AssessmentInvite',
      targetId: invite.id,
    },
  });

  return NextResponse.json({ ok: true });
}
