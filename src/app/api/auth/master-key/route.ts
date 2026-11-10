import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';
import { masterKeyStatus, verifyMasterKey } from '@/lib/master-key';
import { consumeRateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Attempts allowed from one IP per window, and how long that window is. */
const ATTEMPT_LIMIT = 8;
const WINDOW_SECONDS = 15 * 60;

/**
 * Whether the console offers key sign-in.
 *
 * A boolean and nothing else. The reason a key is unusable - unset, too
 * short, no backing account - is for the operator, not for whoever opened the
 * modal, so it is logged rather than returned.
 */
export async function GET() {
  const status = await masterKeyStatus();
  return NextResponse.json({ enabled: status.enabled });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);

  // Rate limited before the key is even read. One shared secret is a single
  // thing to guess at, so throttling is the control that matters most here.
  const limit = await consumeRateLimit(`master-key:${ip}`, ATTEMPT_LIMIT, WINDOW_SECONDS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)) } }
    );
  }

  let candidate = '';
  try {
    const body = await req.json();
    candidate = typeof body?.key === 'string' ? body.key.trim() : '';
  } catch {
    candidate = '';
  }

  if (!candidate) {
    return NextResponse.json({ error: 'Enter your access key.' }, { status: 400 });
  }

  const result = await verifyMasterKey(candidate);

  if (!result.ok) {
    // Every failure is recorded. A shared key cannot tell you who tried it,
    // but it can tell you that someone did, and from where.
    await prisma.auditLog
      .create({
        data: {
          actorType: 'MASTER',
          action: 'master_key.denied',
          targetType: 'Session',
          ip,
          userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
          meta: { remaining: limit.remaining },
        },
      })
      .catch(() => {});

    // One message for a wrong key and for a key that was never configured.
    return NextResponse.json({ error: 'That access key was not recognised.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, signToken(result.email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  await prisma.auditLog
    .create({
      data: {
        actorType: 'MASTER',
        actorId: result.adminId,
        actorEmail: result.email,
        action: 'master_key.signin',
        targetType: 'Session',
        targetId: result.adminId,
        ip,
        userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
        // So a key sign-in is distinguishable from a password one when
        // somebody reads the log back.
        meta: { method: 'master_key' },
      },
    })
    .catch(() => {});

  return res;
}
