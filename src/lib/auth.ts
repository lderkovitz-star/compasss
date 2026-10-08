import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

const AUTH_SECRET = process.env.AUTH_SECRET;
if (process.env.NODE_ENV === 'production' && !AUTH_SECRET) {
  throw new Error('AUTH_SECRET must be set in production');
}
const SECRET = AUTH_SECRET || 'fallback-secret-key';
const COOKIE_NAME = 'ce_admin_session';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export function signToken(email: string): string {
  const payload = `${email}:${Date.now()}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return null;
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expectedSig = createHmac('sha256', SECRET).update(payload).digest('hex');
    if (sig.length !== expectedSig.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

    // The payload is `${email}:${issuedAtMs}`. The signature proves the token
    // was minted here; it says nothing about when. Without this check a token
    // captured once stays valid forever, since the cookie maxAge is only a
    // client-side hint.
    const lastColon = payload.lastIndexOf(':');
    if (lastColon === -1) return null;
    const issuedAt = Number(payload.slice(lastColon + 1));
    if (!Number.isFinite(issuedAt)) return null;
    const age = Date.now() - issuedAt;
    if (age < 0 || age > COOKIE_MAX_AGE * 1000) return null;

    return payload.slice(0, lastColon);
  } catch {
    return null;
  }
}

export function getAdminSession(): string | null {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token) !== null;
}

export async function getCurrentAdmin() {
  const email = getAdminSession();
  if (!email) return null;
  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      profileImageUrl: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!admin || !admin.isActive) return null;
  return admin;
}

export async function validateCredentials(email: string, password: string): Promise<boolean> {
  // Try database-based admin first
  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
  if (admin) {
    if (!admin.isActive) return false;
    return bcrypt.compare(password, admin.passwordHash);
  }

  // Env-based bootstrap (only when explicitly configured): logging in with
  // ADMIN_EMAIL / ADMIN_PASSWORD creates that account as a SUPER_ADMIN, so a
  // fresh deployment can be administered without running any scripts.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return false;
  if (email.toLowerCase() !== adminEmail.toLowerCase() || password !== adminPassword) return false;

  await prisma.admin.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {},
    create: {
      email: adminEmail.toLowerCase(),
      passwordHash: await hashPassword(password),
      role: 'SUPER_ADMIN',
    },
  });
  return true;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export type AdminPrincipal = NonNullable<Awaited<ReturnType<typeof getCurrentAdmin>>>;

/**
 * Route-handler guard. Returns either the signed-in admin or the response to
 * send back. Middleware only verifies the cookie signature, so it cannot tell
 * whether the account still exists, is still active, or holds the right role —
 * that check has to happen in the handler.
 *
 *   const auth = await requireAdmin();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireAdmin(
  roles?: readonly string[]
): Promise<AdminPrincipal | NextResponse> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (roles && !roles.includes(admin.role)) {
    return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
  }
  return admin;
}

/** Roles permitted to change data. ASSESSOR is read-only, as the UI advertises. */
export const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

export { COOKIE_NAME, COOKIE_MAX_AGE };
