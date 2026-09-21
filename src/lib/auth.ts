import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
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
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    return payload.split(':')[0]; // return email
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

export { COOKIE_NAME, COOKIE_MAX_AGE };
