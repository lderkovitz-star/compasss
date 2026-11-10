import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';

/**
 * Completion webhook.
 *
 * Fires when one of an account's candidates finishes, so an evaluator's own
 * dashboard can react without polling. The in-app notification already
 * exists and is unaffected; this is the machine-readable twin of it.
 *
 * Three things it deliberately does not do.
 *
 * It carries no scores. The payload says who finished and where to read the
 * result, nothing more. A webhook endpoint is a URL someone typed into a form
 * and we cannot vouch for where it terminates, so sending an assessment
 * result through it would be publishing candidate data on the strength of a
 * text field.
 *
 * It does not block completion. A candidate's sitting must finish whether or
 * not the receiver is up, so a failure is logged and swallowed.
 *
 * It does not retry. One attempt with a short timeout, and the dashboard
 * notification is the fallback that is always there. Retries without a queue
 * mean either a long request or a lost one, and neither is worth it for a
 * signal that is already duplicated in the UI.
 */

const TIMEOUT_MS = 5000;

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}

/** The signature a receiver should recompute to confirm the call is ours. */
export function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/**
 * For the receiving end, and for our own tests. Compared in constant time,
 * and the timestamp is checked so a captured call cannot be replayed later.
 */
export function verifySignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
  toleranceSeconds = 300
): boolean {
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;
  const expected = signPayload(secret, timestamp, body);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Only http(s), and never an address on a private network.
 *
 * Without this the field is a server-side request forgery hole: an employer
 * could point it at 169.254.169.254 or at something on our own network and
 * use our server to reach what their browser cannot.
 *
 * Worth being honest about what this does not stop. It inspects the hostname
 * as written, so a public name that resolves to a private address, or one
 * that resolves differently on the second lookup, still gets through. Closing
 * that needs the address resolved and checked at connection time, or an
 * egress proxy. The person setting this field is an authenticated employer
 * configuring their own integration rather than an anonymous attacker, and
 * the call carries no candidate data, so the hostname check plus refusing
 * redirects is proportionate here - but it is a speed bump, not a boundary,
 * and should be upgraded if this ever accepts a URL from a less trusted
 * source.
 */
export function isAllowedWebhookUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'That is not a valid URL.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'The URL must start with https://.' };
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    return { ok: false, reason: 'The URL must use https.' };
  }

  // URL.hostname keeps the brackets on an IPv6 literal, so "[::1]" never
  // equals "::1" and the loopback check silently passed before they were
  // stripped here.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const blocked =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    // IPv4 private, loopback and link-local, including the cloud metadata
    // address every provider serves on 169.254.169.254.
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^0\./.test(host) ||
    // IPv6: loopback, unspecified, unique-local (fc00::/7) and link-local
    // (fe80::/10).
    host === '::1' ||
    host === '::' ||
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    /^fe[89ab][0-9a-f]:/.test(host) ||
    // IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1, which otherwise reaches
    // loopback past every IPv4 rule above.
    /^::ffff:/.test(host);

  // Only enforced in production: a self-hosted receiver on a private network
  // is a legitimate development setup.
  if (blocked && process.env.NODE_ENV === 'production') {
    return { ok: false, reason: 'That address is not reachable from the platform.' };
  }

  return { ok: true, url };
}

export type CompletionEvent = {
  event: 'assessment.completed';
  sessionId: string;
  candidateName: string | null;
  candidateEmail: string | null;
  packageName: string | null;
  roleTitle: string | null;
  completedAt: string;
  /** Where a human reads the result. Requires a signed-in session. */
  reportUrl: string;
};

/**
 * Posts the event. Never throws.
 *
 * Returns what happened so the caller can log it, but a caller that ignores
 * the result is behaving correctly - finishing an assessment does not depend
 * on this.
 */
export async function dispatchCompletionWebhook(
  clientAccountId: string,
  payload: CompletionEvent
): Promise<{ sent: boolean; status?: number; reason?: string }> {
  try {
    const account = await prisma.clientAccount.findUnique({
      where: { id: clientAccountId },
      select: { webhookUrl: true, webhookSecret: true },
    });
    if (!account?.webhookUrl || !account.webhookSecret) {
      return { sent: false, reason: 'no webhook configured' };
    }

    const allowed = isAllowedWebhookUrl(account.webhookUrl);
    if (!allowed.ok) {
      console.warn('[webhook] refusing to call', account.webhookUrl, allowed.reason);
      return { sent: false, reason: allowed.reason };
    }

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(allowed.url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Compass-Webhook/1',
          'X-Compass-Event': payload.event,
          'X-Compass-Timestamp': timestamp,
          'X-Compass-Signature': signPayload(account.webhookSecret, timestamp, body),
        },
        body,
        signal: controller.signal,
        redirect: 'error',
      });
      return { sent: res.ok, status: res.status };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    // Swallowed on purpose: see the note at the top.
    console.warn('[webhook] dispatch failed', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'request failed' };
  }
}
