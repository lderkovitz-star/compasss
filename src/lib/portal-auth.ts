import { createHmac, randomBytes, createHash, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Employer portal sessions.
 *
 * Deliberately a separate cookie and a separate verifier from the master admin
 * session in src/lib/auth.ts. One cookie carrying an "is this a master or a
 * tenant" flag is a confused-deputy bug waiting to happen; two cookies cannot
 * be mistaken for each other.
 *
 * Unlike the admin cookie, these are backed by an AuthSession row, so logging
 * out and revoking actually work instead of relying on the browser to drop a
 * cookie it was asked to drop.
 */

const AUTH_SECRET = process.env.AUTH_SECRET;
if (process.env.NODE_ENV === 'production' && !AUTH_SECRET) {
  throw new Error('AUTH_SECRET must be set in production');
}
const SECRET = AUTH_SECRET || 'fallback-secret-key';

export const CLIENT_COOKIE = 'cmp_client';
export const CLIENT_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

type ClientTokenPayload = {
  v: 2;
  aud: 'client';
  /** ClientAccount id */
  tid: string;
  /** AuthSession id, so the row can be revoked */
  sid: string;
  exp: number;
};

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function encode(payload: ClientTokenPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(`${json}.${sign(json)}`).toString('base64url');
}

function decode(token: string): ClientTokenPayload | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return null;

    const json = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = sign(json);
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    const payload = JSON.parse(json) as ClientTokenPayload;
    if (payload.v !== 2 || payload.aud !== 'client') return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Creates the AuthSession row and returns the cookie value to set. */
export async function createClientSession(
  clientAccountId: string,
  meta: { ip?: string | null; userAgent?: string | null }
): Promise<string> {
  const expiresAt = new Date(Date.now() + CLIENT_SESSION_MAX_AGE * 1000);
  const opaque = randomBytes(32).toString('base64url');

  const session = await prisma.authSession.create({
    data: {
      tokenHash: hashToken(opaque),
      subjectType: 'CLIENT',
      clientAccountId,
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
    select: { id: true },
  });

  return encode({
    v: 2,
    aud: 'client',
    tid: clientAccountId,
    sid: session.id,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });
}

export type ClientPrincipal = {
  clientAccountId: string;
  sessionId: string;
  account: { id: string; name: string; slug: string; status: string };
};

/**
 * Reads the portal session. The signature proves the cookie came from us; the
 * database lookup is what proves it has not been revoked and that the account
 * is still active.
 */
export async function getClientSession(): Promise<ClientPrincipal | null> {
  const token = cookies().get(CLIENT_COOKIE)?.value;
  if (!token) return null;

  const payload = decode(token);
  if (!payload) return null;

  const session = await prisma.authSession.findUnique({
    where: { id: payload.sid },
    select: { id: true, clientAccountId: true, revokedAt: true, expiresAt: true, subjectType: true },
  });

  if (
    !session ||
    session.subjectType !== 'CLIENT' ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.clientAccountId !== payload.tid
  ) {
    return null;
  }

  const account = await prisma.clientAccount.findFirst({
    where: { id: payload.tid, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!account) return null;

  return { clientAccountId: account.id, sessionId: session.id, account };
}

/**
 * Route-handler guard, mirroring requireAdmin().
 *
 *   const portal = await requireClient();
 *   if (portal instanceof NextResponse) return portal;
 */
export async function requireClient(): Promise<ClientPrincipal | NextResponse> {
  const principal = await getClientSession();
  if (!principal) {
    return NextResponse.json({ error: 'Enterprise access required.' }, { status: 401 });
  }
  return principal;
}

export async function revokeClientSession(sessionId: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
