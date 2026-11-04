import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashInviteToken, isWellFormedInviteToken } from '@/lib/invite-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Begins an invited candidate's assessment.
 *
 * The candidate supplies only a resume. Their name, email, the employer and
 * the job context all come from the invite, so none of it can be tampered
 * with from the browser.
 */
export async function POST(req: NextRequest) {
  try {
    // The resume is uploaded straight to storage by the browser and
    // registered through /api/uploads/confirm, so only its id arrives here.
    // Nothing large passes through this handler any more.
    const body = await req.json().catch(() => null);
    const token = body && typeof body === 'object' ? body.token : null;
    const resumeDocumentId =
      body && typeof body.resumeDocumentId === 'string' ? body.resumeDocumentId : null;

    if (!isWellFormedInviteToken(token)) {
      return NextResponse.json({ error: 'This invitation link is not valid.' }, { status: 400 });
    }

    const invite = await prisma.assessmentInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      select: {
        id: true,
        clientAccountId: true,
        packageId: true,
        jobContextId: true,
        candidateName: true,
        candidateEmail: true,
        targetRole: true,
        sessionDepth: true,
        status: true,
        expiresAt: true,
        revokedAt: true,
        consumedAt: true,
        sessionId: true,
        clientAccount: { select: { status: true, deletedAt: true } },
      },
    });

    if (!invite || invite.clientAccount.deletedAt || invite.clientAccount.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This invitation link is not valid.' }, { status: 404 });
    }
    if (invite.revokedAt) {
      return NextResponse.json({ error: 'This invitation has been withdrawn.' }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
    }
    // Already started: send them back to the same session rather than making a
    // second one. Refreshing the page mid-assessment should not lose progress.
    if (invite.sessionId) {
      return NextResponse.json({ sessionId: invite.sessionId });
    }

    // The candidate record belongs to the inviting employer. The same person
    // may be a candidate at two employers, so look them up within the tenant.
    let user = await prisma.user.findFirst({
      where: { email: invite.candidateEmail, clientAccountId: invite.clientAccountId },
      select: { id: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: invite.candidateEmail,
          name: invite.candidateName,
          targetRole: invite.targetRole,
          clientAccountId: invite.clientAccountId,
        },
        select: { id: true },
      });
    }

    // Attach the document the candidate uploaded, if any. It is looked up by
    // id within this tenant, so an id from another account behaves like one
    // that does not exist, and the parsed text is already stored against it.
    let resumeFileUrl: string | null = null;
    let resumeText: string | null = null;

    if (resumeDocumentId) {
      const document = await prisma.resumeDocument.findFirst({
        where: { id: resumeDocumentId, clientAccountId: invite.clientAccountId },
        select: { id: true, blobUrl: true, parsedText: true },
      });
      if (document) {
        resumeFileUrl = document.blobUrl;
        resumeText = document.parsedText;
      }
    }

    if (resumeFileUrl) {
      await prisma.user.update({
        where: { id: user.id },
        data: { resumeFileUrl, resumeUploadedAt: new Date(), resumeText },
      });
    }

    const session = await prisma.assessmentSession.create({
      data: {
        userId: user.id,
        packageId: invite.packageId,
        clientAccountId: invite.clientAccountId,
        jobContextId: invite.jobContextId,
        kind: 'OFFICIAL',
        status: 'IN_PROGRESS',
        sessionDepth: invite.sessionDepth,
        currentScenarioIdx: 0,
      },
      select: { id: true },
    });

    await prisma.assessmentInvite.update({
      where: { id: invite.id },
      data: { status: 'STARTED', consumedAt: new Date(), sessionId: session.id },
    });

    // Tie the uploaded document to this sitting so the evaluation can find it.
    if (resumeDocumentId && resumeFileUrl) {
      await prisma.resumeDocument.update({
        where: { id: resumeDocumentId },
        data: { sessionId: session.id, userId: user.id },
      });
    }

    await prisma.auditLog.create({
      data: {
        clientAccountId: invite.clientAccountId,
        actorType: 'CANDIDATE',
        action: 'invite.start',
        targetType: 'AssessmentSession',
        targetId: session.id,
      },
    });

    return NextResponse.json({ sessionId: session.id }, { status: 201 });
  } catch (error) {
    console.error('[assess start]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
