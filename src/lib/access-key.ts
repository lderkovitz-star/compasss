import { randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Company access keys: CMP-<prefix>-<secret>
 *
 * The prefix identifies which account a key belongs to, so the gateway can
 * find the right row from a single input box without the employer having to
 * name their company first. Only a bcrypt hash of the secret is stored, so a
 * database leak does not hand over anyone's portal.
 */

const PREFIX_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
const PREFIX_LENGTH = 8;
const SECRET_BYTES = 24; // 32 base64url characters

export type IssuedAccessKey = {
  /** Shown to the admin once and never recoverable afterwards. */
  plaintext: string;
  prefix: string;
  hash: string;
  last4: string;
};

function randomPrefix(): string {
  const bytes = randomBytes(PREFIX_LENGTH);
  let out = '';
  for (let i = 0; i < PREFIX_LENGTH; i++) {
    out += PREFIX_ALPHABET[bytes[i] % PREFIX_ALPHABET.length];
  }
  return out;
}

export async function issueAccessKey(prefix?: string): Promise<IssuedAccessKey> {
  const keyPrefix = prefix ?? randomPrefix();
  const secret = randomBytes(SECRET_BYTES).toString('base64url');
  return {
    plaintext: `CMP-${keyPrefix}-${secret}`,
    prefix: keyPrefix,
    hash: await bcrypt.hash(secret, 12),
    last4: secret.slice(-4),
  };
}

export function generateAccessKeyPrefix(): string {
  return randomPrefix();
}

/** Splits a pasted key without revealing whether any part of it is valid. */
export function parseAccessKey(input: string): { prefix: string; secret: string } | null {
  const trimmed = input.trim();
  const match = /^CMP-([A-Z0-9]{8})-([A-Za-z0-9_-]{16,})$/.exec(trimmed);
  if (!match) return null;
  return { prefix: match[1], secret: match[2] };
}

export async function verifyAccessKeySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

/**
 * Constant-time string compare, for the places where we compare something
 * other than a bcrypt hash.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
