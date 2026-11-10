import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';
import { generateInviteToken, buildInviteUrl } from '@/lib/invite-token';
import { assertSeatAvailable, SeatLimitError, getSeatUsage } from '@/lib/seats';
import { queueEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const DEFAULT_EXPIRY_DAYS = 14;

/**
 * Issues an invitation on behalf of a client account, from the console.
 *
 * The employer can already do this for themselves at /employer/candidates.
 * This exists because a rep sitting with a client should not have to ask them
 * for their access key to get a candidate started - which in practice means
 * the key gets read aloud, and then it is not a secret.
 *
 * Same rules as the employer's own route: the seat check runs before anything
 * is written, the package is snapshotted onto the invitation, and the raw
 * token is readable exactly once, in this response.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const account = await prisma.clientAccount.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true, name: true, status: true, assignedPackageId: true },
    });
    if (!account) {
      return NextResponse.json({ error: 'Client account not found.' }, { status: 404 });
    }
    if (account.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `${account.name} is ${account.status.toLowerCase()}. Reactivate it before inviting candidates.` },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const candidateName = String(body?.candidateName ?? '').trim();
    const candidateEmail = String(body?.candidateEmail ?? '').trim().toLowerCase();
    const roleTitle = String(body?.roleTitle ?? '').trim();

    if (!candidateName) {
      return NextResponse.json({ error: 'Candidate name is required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
      return NextResponse.json({ error: 'A valid candidate email is required.' }, { status: 400 });
    }

    // Before any write, so a refusal leaves no job context behind.
    await assertSeatAvailable(account.id);

    const settings = await prisma.platformSettings.findFirst({
      select: { defaultClientPackageId: true, defaultSessionDepth: true },
    });
    const packageId = account.assignedPackageId ?? settings?.defaultClientPackageId ?? null;
    if (!packageId) {
      return NextResponse.json(
        { error: `No scenario package is assigned to ${account.name} yet.` },
        { status: 409 }
      );
    }
    const pkg = await prisma.scenarioPackage.findFirst({
      where: { id: packageId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!pkg) {
      return NextResponse.json({ error: 'The assigned scenario package is missing.' }, { status: 409 });
    }

    // A role title typed here becomes a job context for that account, so the
    // evaluation has something to judge against and the employer sees it in
    // their own saved roles afterwards.
    let jobContextId: string | null = null;
    if (roleTitle) {
      const context = await prisma.jobContext.create({
        data: {
          clientAccountId: account.id,
          title: roleTitle,
          descriptionText: String(body?.roleDescription ?? '').trim(),
        },
        select: { id: true },
      });
      jobContextId = context.id;
    }

    const { token, tokenHash } = generateInviteToken();
    const invite = await prisma.assessmentInvite.create({
      data: {
        clientAccountId: account.id,
        packageId: pkg.id,
        jobContextId,
        candidateName,
        candidateEmail,
        targetRole: roleTitle || null,
        tokenHash,
        sessionDepth: settings?.defaultSessionDepth ?? null,
        expiresAt: new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        createdByAdminId: auth.id,
      },
      select: { id: true, candidateName: true, expiresAt: true },
    });

    await prisma.auditLog.create({
      data: {
        clientAccountId: account.id,
        actorType: 'MASTER',
        actorId: auth.id,
        actorEmail: auth.email,
        action: 'invite.create',
        targetType: 'AssessmentInvite',
        targetId: invite.id,
        meta: { candidateEmail, package: pkg.name, onBehalfOf: account.name },
      },
    });

    const url = buildInviteUrl(req.nextUrl.origin, token);

    await queueEmail({
      template: 'CANDIDATE_INVITE',
      to: candidateEmail,
      clientAccountId: account.id,
      data: {
        candidateName,
        companyName: account.name,
        roleTitle: roleTitle || '',
        url,
        expiresAt: invite.expiresAt.toISOString().slice(0, 10),
      },
    });

    return NextResponse.json(
      { invite, url, seats: await getSeatUsage(account.id) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SeatLimitError) {
      return NextResponse.json({ error: error.message, seats: error.usage }, { status: 409 });
    }
    console.error('[admin invites POST]', error);
    return NextResponse.json({ error: 'Failed to generate the invitation.' }, { status: 500 });
  }
}
