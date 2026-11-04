import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { deliveryState } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * The outbound queue.
 *
 * Until the sending domain is verified nothing is delivered, so this is how an
 * operator sees what would have gone out - and, if a candidate says they never
 * got their invitation, retrieves the exact message to pass on by hand.
 */
export async function GET() {
  const auth = await requireAdmin(['SUPER_ADMIN', 'ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const [state, messages] = await Promise.all([
    deliveryState(),
    prisma.emailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        template: true,
        toAddress: true,
        subject: true,
        status: true,
        attempts: true,
        lastError: true,
        payload: true,
        createdAt: true,
        sentAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    ...state,
    messages: messages.map((m) => {
      const payload = (m.payload ?? {}) as Record<string, unknown>;
      return {
        id: m.id,
        template: m.template,
        to: m.toAddress,
        subject: m.subject,
        status: m.status,
        attempts: m.attempts,
        lastError: m.lastError,
        body: typeof payload.body === 'string' ? payload.body : null,
        createdAt: m.createdAt,
        sentAt: m.sentAt,
      };
    }),
  });
}
