import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Only the platform owner may read a stored secret back. */
const MASTER_ROLES = ['SUPER_ADMIN'] as const;

/**
 * Returns the saved Anthropic key so a Super Admin can reveal it in the
 * settings form. Every other response carries only "configured" and the last
 * four characters; this is the single place the key leaves the server.
 *
 * POST rather than GET so it is never prefetched, cached or replayed as a
 * plain navigation, and each reveal is written to the audit log.
 */
export async function POST() {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const settings = await prisma.platformSettings.findFirst({
      select: { anthropicApiKey: true },
    });
    const key = settings?.anthropicApiKey ?? null;
    if (!key) {
      return NextResponse.json({ error: 'No API key is saved.' }, { status: 404 });
    }

    await prisma.auditLog.create({
      data: {
        actorType: 'MASTER',
        actorId: auth.id,
        actorEmail: auth.email,
        action: 'settings.ai_key.reveal',
      },
    });

    return NextResponse.json(
      { anthropicApiKey: key },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error revealing AI key:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
