import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let name = '';
    let email = '';
    let targetRole: string | null = null;
    let hobbiesSkills: string | null = null;

    // The resume is uploaded straight to storage by the browser and registered
    // through /api/uploads/confirm, so only its id arrives here. Nothing large
    // passes through this handler, which is what the 4.5 MB body limit used to
    // break - and it broke with a bare "Failed to fetch".
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
    }
    name = typeof body.name === 'string' ? body.name.trim() : '';
    email = typeof body.email === 'string' ? body.email.trim() : '';
    targetRole = typeof body.targetRole === 'string' ? body.targetRole.trim() : null;
    hobbiesSkills = typeof body.hobbiesSkills === 'string' ? body.hobbiesSkills : null;
    const resumeDocumentId =
      typeof body.resumeDocumentId === 'string' ? body.resumeDocumentId : null;

    // Validate required fields (target role is no longer collected)
    if (!name || !email) {
      return NextResponse.json({ error: 'Full name and email address are required.' }, { status: 400 });
    }

    // Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Attach the document the candidate uploaded, if any. Its text was
    // extracted when it was registered, so it is ready for the evaluation.
    let resumeFileUrl: string | null = null;
    let resumeUploadedAt: Date | null = null;
    let resumeText: string | null = null;

    if (resumeDocumentId) {
      const document = await prisma.resumeDocument.findFirst({
        where: { id: resumeDocumentId, clientAccountId: null },
        select: { blobUrl: true, parsedText: true, uploadedAt: true },
      });
      if (document) {
        resumeFileUrl = document.blobUrl;
        resumeUploadedAt = document.uploadedAt;
        resumeText = document.parsedText;
      }
    }

    // Find or create candidate user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          email,
          targetRole: targetRole || null,
          hobbiesSkills: hobbiesSkills || null,
          resumeFileUrl,
          resumeUploadedAt,
          resumeText,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          ...(targetRole !== null ? { targetRole } : {}),
          hobbiesSkills: hobbiesSkills || null,
          ...(resumeFileUrl ? { resumeFileUrl, resumeUploadedAt, resumeText } : {}),
        },
      });
    }

    // Which pack this open sitting runs. Resolved through the assignment slots
    // rather than the retired isActive flag, which one switch used to control
    // for every candidate at once.
    const settings = await prisma.platformSettings.findFirst({
      select: { sandboxPackageId: true, defaultClientPackageId: true, defaultSessionDepth: true },
    });
    const preferredId = settings?.sandboxPackageId ?? settings?.defaultClientPackageId ?? null;
    const activePackage = preferredId
      ? await prisma.scenarioPackage.findFirst({ where: { id: preferredId, deletedAt: null } })
      : await prisma.scenarioPackage.findFirst({ where: { isActive: true, deletedAt: null } });
    if (!activePackage) {
      return NextResponse.json(
        { error: 'No active assessment package configured. Please contact platform support.' },
        { status: 503 }
      );
    }

    // Create candidate assessment session
    const session = await prisma.assessmentSession.create({
      data: {
        userId: user.id,
        packageId: activePackage.id,
        status: 'IN_PROGRESS',
        currentScenarioIdx: 0,
        sessionDepth: settings?.defaultSessionDepth ?? null,
      },
      select: { id: true },
    });

    // Tie the uploaded document to this sitting so the evaluation can find it.
    if (resumeDocumentId && resumeFileUrl) {
      await prisma.resumeDocument.update({
        where: { id: resumeDocumentId },
        data: { sessionId: session.id, userId: user.id },
      });
    }

    return NextResponse.json({ sessionId: session.id, userId: user.id }, { status: 201 });
  } catch (err: unknown) {
    console.error('[intake] error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
