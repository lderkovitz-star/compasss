import { createHash, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';

/**
 * Master key sign-in.
 *
 * A single shared secret in an environment variable, so a field rep can reach
 * the console on a phone without carrying a password. It sits alongside the
 * named admin accounts rather than replacing them, and that distinction
 * matters: a shared key cannot say who used it. Every key sign-in therefore
 * resolves to a real admin account, so role checks and audit rows still name
 * somebody - but they name the same somebody every time, which is the honest
 * limit of this mechanism and the reason named accounts stay.
 *
 * The key is never compared with ===. A plain comparison returns early at the
 * first wrong byte, and the time that takes is measurable across enough
 * requests; the comparison below always walks the same number of bytes.
 */

/**
 * Below this a key is guessable faster than the rate limiter refills, so the
 * feature refuses to turn on rather than appearing to protect something.
 */
const MIN_KEY_LENGTH = 24;

export type MasterKeyStatus =
  | { enabled: true }
  | { enabled: false; reason: 'unset' | 'too_short' | 'no_admin' };

function configuredKey(): string | null {
  const key = process.env.MASTER_ADMIN_KEY?.trim();
  return key ? key : null;
}

/** Which admin account a key sign-in becomes. */
function configuredAdminEmail(): string | null {
  const email = (process.env.MASTER_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL)?.trim();
  return email ? email.toLowerCase() : null;
}

/**
 * Whether key sign-in can be offered, and if not, why.
 *
 * The reason is for the server's own logs and for the console's settings
 * screen. What reaches a signed-out browser is the boolean alone - telling an
 * anonymous visitor "the key is configured but too short" hands them the one
 * fact worth having.
 */
export async function masterKeyStatus(): Promise<MasterKeyStatus> {
  const key = configuredKey();
  if (!key) return { enabled: false, reason: 'unset' };
  if (key.length < MIN_KEY_LENGTH) return { enabled: false, reason: 'too_short' };

  const email = configuredAdminEmail();
  if (!email) return { enabled: false, reason: 'no_admin' };

  const admin = await prisma.admin.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });
  if (!admin || !admin.isActive) return { enabled: false, reason: 'no_admin' };

  return { enabled: true };
}

/** Constant-time comparison that does not leak length either. */
function sameSecret(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // timingSafeEqual throws on a length mismatch, which would itself be a
  // timing signal. Hashing both to a fixed width first removes that: unequal
  // lengths then compare as unequal digests in constant time.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export type MasterKeyResult =
  | { ok: true; email: string; adminId: string }
  | { ok: false };

/**
 * Checks a submitted key and returns the admin it signs in as.
 *
 * Returns the same shape for "wrong key", "key not configured" and "the
 * backing account is gone", because the caller should answer all three
 * identically. Distinguishing them in the response tells an attacker whether
 * they are attacking something that exists.
 */
export async function verifyMasterKey(candidate: string): Promise<MasterKeyResult> {
  const expected = configuredKey();
  const email = configuredAdminEmail();

  // Still run a comparison when the feature is off, so an unconfigured
  // deployment does not answer measurably faster than a wrong key.
  const reference = expected && expected.length >= MIN_KEY_LENGTH ? expected : 'x'.repeat(64);
  const matches = sameSecret(candidate, reference);

  if (!expected || expected.length < MIN_KEY_LENGTH || !email || !matches) {
    return { ok: false };
  }

  const admin = await prisma.admin.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true },
  });
  if (!admin || !admin.isActive) return { ok: false };

  return { ok: true, email: admin.email, adminId: admin.id };
}
