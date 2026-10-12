import { NextResponse } from 'next/server';
import { getClientSession, revokeClientSession, CLIENT_COOKIE } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

/**
 * Who is unlocked in this browser. The portal UI uses this to render the
 * unlocked state after a tab switch without the employer re-entering the key -
 * the authorization itself lives in an httpOnly cookie, never in storage a
 * script can read.
 */
export async function GET() {
  const principal = await getClientSession();
  if (!principal) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    company: principal.account.name,
    slug: principal.account.slug,
  });
}

/** Lock the ledger again. Revokes server-side, not just in the browser. */
export async function DELETE() {
  const principal = await getClientSession();
  if (principal) {
    await revokeClientSession(principal.sessionId);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CLIENT_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
