import { prisma } from './db';
import { resolveBrandName, resolveSupportEmail } from './constants/brand';

/**
 * Outbound email.
 *
 * Nothing is sent yet: the sending domain on continentalworks.com is not
 * verified, and mail from an unverified domain lands in spam, which is worse
 * than not sending it. So messages are queued with their rendered subject and
 * body, and the people who need to know are told in the app meanwhile.
 *
 * When DNS is ready, a provider is configured and the queue drains - the
 * messages are already written, nothing needs re-deriving, and the queue shows
 * exactly what would have gone out.
 */

export type EmailTemplate =
  | 'CANDIDATE_INVITE'
  | 'CANDIDATE_REMINDER'
  | 'REPORT_READY'
  | 'PRACTICE_RESULT';

type QueueInput = {
  template: EmailTemplate;
  to: string;
  clientAccountId?: string | null;
  /** Everything the body needs, kept so it can be re-rendered or inspected. */
  data: Record<string, unknown>;
};

export type RenderedEmail = { subject: string; body: string };

function brand(): string {
  return resolveBrandName(null);
}

/**
 * Bodies are plain text on purpose. Until the domain is verified these are
 * read in the admin queue rather than in a mail client, and plain text is
 * legible in both.
 */
export function renderEmail(template: EmailTemplate, data: Record<string, unknown>): RenderedEmail {
  const str = (key: string, fallback = ''): string => {
    const value = data[key];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  };

  const platform = brand();
  const support = resolveSupportEmail(null);
  const company = str('companyName', 'the company');
  const candidate = str('candidateName', 'there');
  const role = str('roleTitle');

  switch (template) {
    case 'CANDIDATE_INVITE':
      return {
        subject: role
          ? `${company} has invited you to a decision assessment — ${role}`
          : `${company} has invited you to a decision assessment`,
        body: [
          `Hello ${candidate},`,
          '',
          role
            ? `${company} would like you to complete a short decision assessment as part of their process for the ${role} role.`
            : `${company} would like you to complete a short decision assessment as part of their process.`,
          '',
          'It runs in your browser and puts you in a series of situations where you have to decide with incomplete information and a clock running. There is no preparation to do, and no right answer to look up.',
          '',
          `Start here: ${str('url', '[link]')}`,
          '',
          `The link is for you alone and expires on ${str('expiresAt', 'the date given in your invitation')}.`,
          '',
          `If anything goes wrong, reply to ${company} directly, or write to ${support}.`,
          '',
          `— ${platform}`,
        ].join('\n'),
      };

    case 'CANDIDATE_REMINDER':
      return {
        subject: `A reminder: your ${company} assessment is still open`,
        body: [
          `Hello ${candidate},`,
          '',
          `Your decision assessment for ${company} has not been started yet, and the link expires on ${str('expiresAt', 'the date in your invitation')}.`,
          '',
          `Start here: ${str('url', '[link]')}`,
          '',
          `— ${platform}`,
        ].join('\n'),
      };

    case 'REPORT_READY':
      return {
        subject: `${candidate} has completed their assessment`,
        body: [
          `${candidate} finished their decision assessment${role ? ` for the ${role} role` : ''}.`,
          '',
          `Their report is ready: ${str('url', '[link]')}`,
          '',
          `— ${platform}`,
        ].join('\n'),
      };

    case 'PRACTICE_RESULT':
      return {
        subject: `Your ${platform} practice run is complete`,
        body: [
          `Hello ${candidate},`,
          '',
          'Your practice run is finished. Nothing from it has been shared with any employer.',
          '',
          `— ${platform}`,
        ].join('\n'),
      };
  }
}

/**
 * Queues one message. Never throws into the caller: an assessment must not
 * fail because a notification could not be written.
 */
export async function queueEmail(input: QueueInput): Promise<string | null> {
  try {
    const to = input.to.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;

    const { subject, body } = renderEmail(input.template, input.data);

    const row = await prisma.emailLog.create({
      data: {
        clientAccountId: input.clientAccountId ?? null,
        template: input.template,
        toAddress: to,
        subject,
        status: 'QUEUED',
        payload: { ...input.data, body } as never,
      },
      select: { id: true },
    });

    return row.id;
  } catch (error) {
    console.error('[email queue]', error);
    return null;
  }
}

export type DeliveryState = {
  /** Whether a provider is configured at all. */
  configured: boolean;
  provider: string;
  from: string | null;
  queued: number;
  sent: number;
  failed: number;
};

export async function deliveryState(): Promise<DeliveryState> {
  const [settings, counts] = await Promise.all([
    prisma.platformSettings.findFirst({ select: { emailProvider: true, emailFrom: true } }),
    prisma.emailLog.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const byStatus = new Map(counts.map((c) => [c.status, c._count._all]));
  const provider = settings?.emailProvider ?? 'NONE';

  return {
    configured: provider !== 'NONE',
    provider,
    from: settings?.emailFrom ?? null,
    queued: byStatus.get('QUEUED') ?? 0,
    sent: byStatus.get('SENT') ?? 0,
    failed: byStatus.get('FAILED') ?? 0,
  };
}
