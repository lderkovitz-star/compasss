import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Encryption for secrets we must be able to read back - provider API keys.
 *
 * Passwords are hashed because nothing ever needs the original. An API key is
 * different: we have to send it to the provider, so it is encrypted rather
 * than hashed. AES-256-GCM is authenticated, so a tampered ciphertext fails to
 * decrypt instead of yielding quiet rubbish.
 *
 * The key is derived from AUTH_SECRET. That means rotating AUTH_SECRET makes
 * stored provider keys unreadable - they have to be re-entered, which the
 * panel reports as "not configured" rather than failing mid-evaluation.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET must be set before provider keys can be stored or read.');
  }
  // A fixed label keeps this key separate from anything else derived from the
  // same secret, such as session tokens.
  return createHash('sha256').update(`compass:ai-provider-key:${secret}`).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

/** Returns null when the stored value cannot be read, rather than throwing. */
export function decryptSecret(stored: string | null): string | null {
  if (!stored) return null;
  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const [, ivPart, tagPart, dataPart] = parts;
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/** What the panel may show about a stored key. Never the key itself. */
export function last4(plaintext: string): string {
  return plaintext.slice(-4);
}
