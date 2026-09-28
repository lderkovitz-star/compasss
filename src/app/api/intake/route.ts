import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel rejects request bodies over 4.5 MB before they ever reach this
// handler, and the browser reports that as "Failed to fetch". Stay under it.
const MAX_RESUME_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    let name = '';
    let email = '';
    let targetRole: string | null = null;
    let hobbiesSkills: string | null = null;
    let resumeFile: File | null = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      name = body.name?.trim() || '';
      email = body.email?.trim() || '';
      targetRole = body.targetRole ? String(body.targetRole).trim() : null;
      hobbiesSkills =
        body.hobbiesSkills !== undefined && body.hobbiesSkills !== null ? String(body.hobbiesSkills) : null;
    } else {
      const formData = await req.formData();
      name = (formData.get('name') as string)?.trim() || '';
      email = (formData.get('email') as string)?.trim() || '';
      const rawTargetRole = formData.get('targetRole') as string | null;
      targetRole = rawTargetRole ? rawTargetRole.trim() : null;
      const rawHobbies = formData.get('hobbiesSkills') as string | null;
      hobbiesSkills = rawHobbies !== null && rawHobbies !== undefined ? rawHobbies : null;
      const rawResume = formData.get('resume');
      if (rawResume && typeof rawResume === 'object' && 'arrayBuffer' in rawResume) {
        resumeFile = rawResume as File;
      }
    }

    // Validate required fields (target role is no longer collected)
    if (!name || !email) {
      return NextResponse.json({ error: 'Full name and email address are required.' }, { status: 400 });
    }

    // Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    let resumeFileUrl: string | null = null;
    let resumeUploadedAt: Date | null = null;

    if (resumeFile && resumeFile.size > 0) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      const fileNameLower = (resumeFile.name || '').toLowerCase();
      const isAllowedExt = fileNameLower.endsWith('.pdf') || fileNameLower.endsWith('.docx');

      if (!validTypes.includes(resumeFile.type) && !isAllowedExt) {
        return NextResponse.json({ error: 'Resume must be a PDF or DOCX file.' }, { status: 400 });
      }

      if (resumeFile.size > MAX_RESUME_BYTES) {
        return NextResponse.json({ error: 'Resume must be under 4MB.' }, { status: 400 });
      }

      // Stored in Vercel Blob: the filesystem on Vercel is read-only, so
      // writing into public/ would throw and lose the file.
      try {
        const ext = resumeFile.name.split('.').pop() || 'pdf';
        const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || 'candidate';
        const blob = await put(`resumes/${Date.now()}-${sanitizedName}.${ext}`, resumeFile, {
          access: 'public',
          addRandomSuffix: true,
        });

        resumeFileUrl = blob.url;
        resumeUploadedAt = new Date();
      } catch (fileErr) {
        // Never block the candidate over an optional attachment. Both fields
        // stay null so the admin panel does not claim a resume that is absent.
        console.error('[intake] resume upload failed:', fileErr);
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
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          ...(targetRole !== null ? { targetRole } : {}),
          hobbiesSkills: hobbiesSkills || null,
          ...(resumeFileUrl ? { resumeFileUrl, resumeUploadedAt } : {}),
        },
      });
    }

    // Get active assessment package
    const activePackage = await prisma.scenarioPackage.findFirst({ where: { isActive: true } });
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
      },
    });

    return NextResponse.json({ sessionId: session.id, userId: user.id }, { status: 201 });
  } catch (err: unknown) {
    console.error('[intake] error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
