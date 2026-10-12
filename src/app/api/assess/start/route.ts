import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { hashInviteToken, isWellFormedInviteToken } from '@/lib/invite-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel rejects request bodies over 4.5 MB before they reach this handler.
const MAX_RESUME_BYTES = 4 * 1024 * 1024;

/**
 * Begins an invited candidate's assessment.
 *
 * The candidate supplies only a resume. Their name, email, the employer and
 * the job context all come from the invite, so none of it can be tampered
 * with from the browser.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = formData.get('token');

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

    let resumeFileUrl: string | null = null;
    let resumeUploadedAt: Date | null = null;

    const rawResume = formData.get('resume');
    const resumeFile =
      rawResume && typeof rawResume === 'object' && 'arrayBuffer' in rawResume
        ? (rawResume as File)
        : null;

    if (resumeFile && resumeFile.size > 0) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      const nameLower = (resumeFile.name || '').toLowerCase();
      const allowedExt = nameLower.endsWith('.pdf') || nameLower.endsWith('.docx');
      if (!validTypes.includes(resumeFile.type) && !allowedExt) {
        return NextResponse.json({ error: 'Resume must be a PDF or DOCX file.' }, { status: 400 });
      }
      if (resumeFile.size > MAX_RESUME_BYTES) {
        return NextResponse.json({ error: 'Resume must be under 4MB.' }, { status: 400 });
      }

      try {
        const ext = resumeFile.name.split('.').pop() || 'pdf';
        const safeName =
          invite.candidateName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || 'candidate';
        const blob = await put(
          `tenants/${invite.clientAccountId}/resumes/${Date.now()}-${safeName}.${ext}`,
          resumeFile,
          { access: 'public', addRandomSuffix: true }
        );
        resumeFileUrl = blob.url;
        resumeUploadedAt = new Date();
      } catch (fileErr) {
        // An optional attachment must never block the assessment. Both fields
        // stay null so the ledger does not claim a resume that is not there.
        console.error('[assess start] resume upload failed:', fileErr);
      }
    }

    if (resumeFileUrl) {
      await prisma.user.update({
        where: { id: user.id },
        data: { resumeFileUrl, resumeUploadedAt },
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
