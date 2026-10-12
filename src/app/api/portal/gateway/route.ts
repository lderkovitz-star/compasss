import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseAccessKey, verifyAccessKeySecret } from '@/lib/access-key';
import { createClientSession, CLIENT_COOKIE, CLIENT_SESSION_MAX_AGE } from '@/lib/portal-auth';
import { consumeRateLimit, clientIp } from '@/lib/rate-limit';
import { getGlobalSettings } from '@/lib/settings';
import { resolveSupportEmail } from '@/lib/constants/brand';

export const dynamic = 'force-dynamic';

/**
 * Unlocks an employer's ledger with their company access key.
 *
 * Every failure returns the same message. Telling an attacker that a prefix
 * exists but the secret is wrong turns one unknown into two, and hands them a
 * way to enumerate which companies are on the platform.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);

  try {
    const { accessKey } = await req.json();
    const settings = await getGlobalSettings();
    const support = resolveSupportEmail(settings.supportEmail);
    const denied = NextResponse.json(
      { error: `Invalid access key. Contact ${support} to acquire enterprise access.` },
      { status: 401 }
    );

    // Per-IP limit first, so a broad sweep is throttled even across accounts.
    const byIp = await consumeRateLimit(`gateway:ip:${ip}`, 10, 15 * 60);
    if (!byIp.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again shortly.' },
        { status: 429 }
      );
    }

    const parsed = typeof accessKey === 'string' ? parseAccessKey(accessKey) : null;
    if (!parsed) return denied;

    // Then per-prefix, so one targeted account cannot be ground down from
    // many addresses.
    const byPrefix = await consumeRateLimit(`gateway:prefix:${parsed.prefix}`, 5, 15 * 60);
    if (!byPrefix.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again shortly.' },
        { status: 429 }
      );
    }

    const account = await prisma.clientAccount.findFirst({
      where: { accessKeyPrefix: parsed.prefix, deletedAt: null },
      select: { id: true, name: true, status: true, accessKeyHash: true },
    });

    const ok =
      account?.accessKeyHash != null &&
      account.status === 'ACTIVE' &&
      (await verifyAccessKeySecret(parsed.secret, account.accessKeyHash));

    if (!ok) {
      await prisma.auditLog.create({
        data: {
          clientAccountId: account?.id ?? null,
          actorType: 'CLIENT',
          action: 'gateway.fail',
          ip,
          userAgent: req.headers.get('user-agent'),
          meta: { prefix: parsed.prefix },
        },
      });
      return denied;
    }

    const token = await createClientSession(account!.id, {
      ip,
      userAgent: req.headers.get('user-agent'),
    });

    await prisma.auditLog.create({
      data: {
        clientAccountId: account!.id,
        actorType: 'CLIENT',
        action: 'gateway.success',
        ip,
        userAgent: req.headers.get('user-agent'),
      },
    });

    const res = NextResponse.json({ ok: true, company: account!.name });
    res.cookies.set(CLIENT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: CLIENT_SESSION_MAX_AGE,
      path: '/',
    });
    return res;
  } catch (error) {
    console.error('[portal gateway]', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
