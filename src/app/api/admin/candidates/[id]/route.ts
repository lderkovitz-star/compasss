import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const adminEmail = getAdminSession();
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const candidate = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        sessions: {
          include: { package: true },
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    return NextResponse.json(candidate);
  } catch (err) {
    console.error('[candidate GET]', err);
    return NextResponse.json({ error: 'Failed to fetch candidate' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const adminEmail = getAdminSession();
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const candidate = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: data.name,
        email: data.email,
        targetRole: data.targetRole,
        hobbiesSkills: data.hobbiesSkills,
      }
    });
    return NextResponse.json(candidate);
  } catch (err) {
    console.error('[candidate PUT]', err);
    return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const adminEmail = getAdminSession();
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.user.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[candidate DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete candidate' }, { status: 500 });
  }
}
