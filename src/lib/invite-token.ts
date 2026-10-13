import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Candidate invite tokens.
 *
 * The raw token only ever exists in the URL the employer sends. What we store
 * is an HMAC of it, so a database leak yields no working links - the same
 * reasoning as password hashing, except we need to look rows up by the value,
 * which is why it is a keyed HMAC rather than bcrypt.
 */

const AUTH_SECRET = process.env.AUTH_SECRET;
if (process.env.NODE_ENV === 'production' && !AUTH_SECRET) {
  throw new Error('AUTH_SECRET must be set in production');
}
const SECRET = AUTH_SECRET || 'fallback-secret-key';

const TOKEN_BYTES = 24; // 32 base64url characters

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHmac('sha256', SECRET).update(token).digest('hex');
}

/** Rejects anything that is not the shape we issue, before it reaches the database. */
export function isWellFormedInviteToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{30,64}$/.test(token);
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** The link an employer copies. */
export function buildInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/assess?token=${token}`;
}
