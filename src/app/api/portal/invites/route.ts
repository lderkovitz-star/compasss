import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireClient } from '@/lib/portal-auth';
import { generateInviteToken, buildInviteUrl } from '@/lib/invite-token';
import { queueEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const DEFAULT_EXPIRY_DAYS = 14;

export async function GET() {
  const portal = await requireClient();
  if (portal instanceof NextResponse) return portal;

  const invites = await prisma.assessmentInvite.findMany({
    where: { clientAccountId: portal.clientAccountId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      targetRole: true,
      status: true,
      expiresAt: true,
      openedAt: true,
      consumedAt: true,
      revokedAt: true,
      createdAt: true,
      sessionId: true,
      package: { select: { name: true } },
      jobContext: { select: { title: true } },
    },
  });

  // Tokens are never listed. The link is shown once, when it is generated.
  return NextResponse.json({ invites });
}

export async function POST(req: NextRequest) {
  const portal = await requireClient();
  if (portal instanceof NextResponse) return portal;

  try {
    const body = await req.json();
    const candidateName = String(body.candidateName ?? '').trim();
    const candidateEmail = String(body.candidateEmail ?? '').trim().toLowerCase();
    const jobTitle = String(body.jobTitle ?? '').trim();
    const jobDescription = String(body.jobDescription ?? '').trim();
    const jobContextId = body.jobContextId ? String(body.jobContextId) : null;

    if (!candidateName) {
      return NextResponse.json({ error: 'Candidate name is required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
      return NextResponse.json({ error: 'A valid candidate email is required.' }, { status: 400 });
    }

    // Job context: either an existing one belonging to this account, or a new
    // one from the pasted description. The candidate never sees this - it is
    // bundled with their assessment for the evaluation.
    let contextId = null as string | null;
    if (jobContextId) {
      const existing = await prisma.jobContext.findFirst({
        where: { id: jobContextId, clientAccountId: portal.clientAccountId },
        select: { id: true, title: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Job context not found.' }, { status: 400 });
      }
      contextId = existing.id;
    } else if (jobTitle || jobDescription) {
      if (!jobTitle) {
        return NextResponse.json({ error: 'A role title is required.' }, { status: 400 });
      }
      const created = await prisma.jobContext.create({
        data: {
          clientAccountId: portal.clientAccountId,
          title: jobTitle,
          descriptionText: jobDescription,
        },
        select: { id: true },
      });
      contextId = created.id;
    } else {
      return NextResponse.json(
        { error: 'Select a saved role or paste a job description.' },
        { status: 400 }
      );
    }

    // Which package this candidate runs. Resolution order is the Module B one:
    // the account's own assignment, then the global client default. Whatever it
    // resolves to is snapshotted on the invite, so reassigning a package later
    // never changes an assessment that has already gone out.
    const [account, settings] = await Promise.all([
      prisma.clientAccount.findUnique({
        where: { id: portal.clientAccountId },
        select: { assignedPackageId: true },
      }),
      prisma.platformSettings.findFirst({
        select: { defaultClientPackageId: true, defaultSessionDepth: true },
      }),
    ]);

    const requestedPackageId = body.packageId ? String(body.packageId) : null;
    const packageId =
      requestedPackageId ?? account?.assignedPackageId ?? settings?.defaultClientPackageId ?? null;

    if (!packageId) {
      return NextResponse.json(
        { error: 'No scenario package is assigned to this account yet.' },
        { status: 409 }
      );
    }

    const pkg = await prisma.scenarioPackage.findFirst({
      where: { id: packageId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!pkg) {
      return NextResponse.json({ error: 'Scenario package not found.' }, { status: 400 });
    }

    const depth = Number.isInteger(body.sessionDepth) && body.sessionDepth > 0
      ? Number(body.sessionDepth)
      : settings?.defaultSessionDepth ?? null;

    const expiresInDays = Number.isInteger(body.expiresInDays) && body.expiresInDays > 0
      ? Number(body.expiresInDays)
      : DEFAULT_EXPIRY_DAYS;

    const { token, tokenHash } = generateInviteToken();
    const context = contextId
      ? await prisma.jobContext.findUnique({ where: { id: contextId }, select: { title: true } })
      : null;

    const invite = await prisma.assessmentInvite.create({
      data: {
        clientAccountId: portal.clientAccountId,
        packageId: pkg.id,
        jobContextId: contextId,
        candidateName,
        candidateEmail,
        targetRole: context?.title ?? null,
        tokenHash,
        sessionDepth: depth,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      },
      select: { id: true, candidateName: true, expiresAt: true },
    });

    await prisma.auditLog.create({
      data: {
        clientAccountId: portal.clientAccountId,
        actorType: 'CLIENT',
        action: 'invite.create',
        targetType: 'AssessmentInvite',
        targetId: invite.id,
        meta: { candidateEmail, package: pkg.name },
      },
    });

    const origin = req.nextUrl.origin;
    const url = buildInviteUrl(origin, token);

    // Queue the invitation. Nothing sends until the sending domain is
    // verified, so the employer copies the link from the UI meanwhile - but
    // the message is written now, because the raw token exists only here.
    //
    // That does mean a queued invitation holds a working link, which hashing
    // tokenHash was meant to avoid. It is bounded the same way the email
    // itself would be: the link expires, it works once, and it can be
    // revoked. Draining the queue is what closes the window.
    const employer = await prisma.clientAccount.findUnique({
      where: { id: portal.clientAccountId },
      select: { name: true },
    });
    await queueEmail({
      template: 'CANDIDATE_INVITE',
      to: candidateEmail,
      clientAccountId: portal.clientAccountId,
      data: {
        candidateName,
        companyName: employer?.name ?? 'the company',
        roleTitle: context?.title ?? '',
        url,
        expiresAt: invite.expiresAt.toISOString().slice(0, 10),
      },
    });

    // The only time the raw token is readable.
    return NextResponse.json({ invite, url }, { status: 201 });
  } catch (error) {
    console.error('[invites POST]', error);
    return NextResponse.json({ error: 'Failed to generate the invite link.' }, { status: 500 });
  }
}
