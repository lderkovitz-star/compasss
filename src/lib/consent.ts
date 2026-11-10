import { prisma } from '@/lib/db';
import { resolveBrandName, resolveSupportEmail } from '@/lib/constants/brand';

/**
 * Candidate consent at intake.
 *
 * Two things are deliberate here.
 *
 * The statement is stored with the record, not just referenced by version. A
 * version number alone is only as good as our ability to reproduce the text it
 * pointed at, and the first time the wording is edited that becomes an
 * archaeology problem. Keeping the words next to the acceptance means a
 * consent record answers "to what" on its own.
 *
 * Refusal is not an error state to be worked around. A candidate who declines
 * gets no session, and nothing about them is written. The check therefore sits
 * before session creation rather than after it, so declining leaves no trace
 * to clean up.
 */

export const CONSENT_POLICY_VERSION_FALLBACK = '1.0';

/**
 * The wording shown when Master Admin has not set its own.
 *
 * Written to cover what this product actually does - stores decisions and
 * timing, reads an uploaded document, shares a result with one named employer
 * - and to promise nothing it cannot deliver. It is a default, not legal
 * advice; the client's counsel is expected to replace it, which is why it is
 * editable.
 */
export function defaultConsentStatement(opts: {
  platformName: string;
  supportEmail: string;
}): string {
  return [
    `I agree that ${opts.platformName} may record my responses to this assessment, how long I took over each decision, and the text of any document I upload, and may process them to produce an evaluation of my decision-making.`,
    `I understand that the evaluation is shared with the organisation that invited me, that it is a work-related assessment rather than a medical or psychological diagnosis, and that a person reviews it before it is acted on.`,
    `I understand I may request a copy of my data, or its deletion, by writing to ${opts.supportEmail}.`,
  ].join(' ');
}

export type ConsentPolicy = {
  required: boolean;
  version: string;
  statement: string;
};

/** The policy a candidate should be shown right now. */
export async function getConsentPolicy(): Promise<ConsentPolicy> {
  try {
    const settings = await prisma.platformSettings.findFirst({
      select: {
        platformName: true,
        supportEmail: true,
        consentRequired: true,
        consentPolicyVersion: true,
        consentStatement: true,
      },
    });

    const platformName = resolveBrandName(settings?.platformName);
    const supportEmail = resolveSupportEmail(settings?.supportEmail);
    const custom = settings?.consentStatement?.trim();

    return {
      // Absent settings means an unconfigured platform, not a licence to skip
      // consent. Defaulting to required is the safe direction to fail in.
      required: settings?.consentRequired ?? true,
      version: settings?.consentPolicyVersion?.trim() || CONSENT_POLICY_VERSION_FALLBACK,
      statement: custom || defaultConsentStatement({ platformName, supportEmail }),
    };
  } catch (err) {
    console.error('[consent] could not read the policy:', err);
    return {
      required: true,
      version: CONSENT_POLICY_VERSION_FALLBACK,
      statement: defaultConsentStatement({
        platformName: resolveBrandName(undefined),
        supportEmail: resolveSupportEmail(undefined),
      }),
    };
  }
}

/**
 * The client's IP as the proxy reports it.
 *
 * x-forwarded-for carries a chain; the first entry is the client. It is
 * spoofable by the client, which is why this is recorded as a supporting
 * detail rather than treated as proof of anything on its own.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return headers.get('x-real-ip')?.trim().slice(0, 64) ?? null;
}

/**
 * Writes the consent record for a sitting.
 *
 * Idempotent on sessionId: a retried start must not fail because consent was
 * already recorded, and must not produce a second record either.
 */
export async function recordConsent(params: {
  sessionId: string;
  userId?: string | null;
  clientAccountId?: string | null;
  policy: ConsentPolicy;
  headers: Headers;
}): Promise<void> {
  const { sessionId, userId, clientAccountId, policy, headers } = params;
  const data = {
    userId: userId ?? null,
    clientAccountId: clientAccountId ?? null,
    policyVersion: policy.version,
    statementText: policy.statement,
    ipAddress: clientIp(headers),
    userAgent: headers.get('user-agent')?.slice(0, 500) ?? null,
  };

  try {
    await prisma.candidateConsent.upsert({
      where: { sessionId },
      update: {},
      create: { sessionId, ...data },
    });
  } catch (err) {
    // A sitting that exists without its consent record is the one outcome
    // worth shouting about, so this is logged loudly rather than swallowed.
    console.error('[consent] failed to record consent for session', sessionId, err);
    throw err;
  }
}
