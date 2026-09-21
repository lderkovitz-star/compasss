import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, overrides } = await req.json() as {
      sessionId: string;
      overrides: Record<string, { value: number | null; note: string }>;
    };

    if (!sessionId || !overrides) {
      return NextResponse.json({ error: 'sessionId and overrides are required.' }, { status: 400 });
    }

    const session = await prisma.assessmentSession.findUnique({ where: { id: sessionId } });
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

    // Build audit-logged human overrides structure
    const now = new Date().toISOString();
    const existing = (session.humanOverrides as Record<string, any>) ?? {};
    const updated: Record<string, any> = { ...existing };

    for (const [trait, override] of Object.entries(overrides)) {
      updated[trait] = {
        value: override.value,
        overriddenBy: admin.email,
        note: override.note ?? '',
        updatedAt: now,
      };
    }

    await prisma.assessmentSession.update({
      where: { id: sessionId },
      data: { humanOverrides: updated as any },
    });

    return NextResponse.json({ success: true, humanOverrides: updated });
  } catch (err) {
    console.error('[coordinator override]', err);
    return NextResponse.json({ error: 'Failed to save overrides.' }, { status: 500 });
  }
}
