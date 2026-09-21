import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const targetRole = formData.get('targetRole') as string;
    const hobbiesSkills = formData.get('hobbiesSkills') as string;
    const resumeFile = formData.get('resume') as File | null;

    // Validate required fields
    if (!name || !email || !targetRole) {
      return NextResponse.json({ error: 'Name, email, and target role are required.' }, { status: 400 });
    }

    // Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    let resumeFileUrl: string | null = null;
    let resumeUploadedAt: Date | null = null;

    // Handle file upload via Vercel Blob
    if (resumeFile && resumeFile.size > 0) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!validTypes.includes(resumeFile.type)) {
        return NextResponse.json({ error: 'Resume must be PDF or DOCX.' }, { status: 400 });
      }
      if (resumeFile.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Resume must be under 10MB.' }, { status: 400 });
      }

      const ext = resumeFile.name.split('.').pop() || 'pdf';
      const fileName = `${Date.now()}-${name.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
      
      const blob = await put(`resumes/${fileName}`, resumeFile, {
        access: 'public',
        addRandomSuffix: true,
      });

      resumeFileUrl = blob.url;
      resumeUploadedAt = new Date();
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          email,
          targetRole,
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
          targetRole,
          hobbiesSkills: hobbiesSkills || null,
          ...(resumeFileUrl && { resumeFileUrl, resumeUploadedAt }),
        },
      });
    }

    // Get active package
    const activePackage = await prisma.scenarioPackage.findFirst({ where: { isActive: true } });
    if (!activePackage) {
      return NextResponse.json({ error: 'No active assessment package configured. Contact admin.' }, { status: 503 });
    }

    // Create session
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
