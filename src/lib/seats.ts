import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/db';

/**
 * Candidate seats per employer account.
 *
 * What counts as a consumed seat is the whole design decision here, and the
 * obvious answers are both wrong. Counting candidate rows undercounts, because
 * a candidate who never opens their link has still had a seat committed to
 * them. Counting every invite ever issued overcounts, because a typo in an
 * email address would cost the employer a seat permanently.
 *
 * So a seat is held by an invitation that is still capable of producing an
 * assessment, or has already produced one:
 *
 *   - used      -> the candidate started; the seat is spent
 *   - live      -> not revoked, not past its expiry; the seat is reserved
 *   - revoked   -> released, so a mistake costs nothing
 *   - lapsed    -> released, because an unopened link that expired consumed
 *                  nothing of value
 *
 * That makes the number an employer sees match what they would expect to be
 * billed for, and makes the two ways of freeing a seat ones they can act on.
 */

export type SeatUsage = {
  used: number;
  limit: number | null;
  /** Null when there is no limit; never negative. */
  remaining: number | null;
  atLimit: boolean;
};

type Db = PrismaClient | typeof defaultPrisma;

/** How many seats this account is currently holding. */
export async function countSeatsUsed(
  clientAccountId: string,
  db: Db = defaultPrisma
): Promise<number> {
  const now = new Date();
  return db.assessmentInvite.count({
    where: {
      clientAccountId,
      revokedAt: null,
      OR: [{ consumedAt: { not: null } }, { expiresAt: { gt: now } }],
    },
  });
}

/** Seats used and remaining for one account. */
export async function getSeatUsage(
  clientAccountId: string,
  db: Db = defaultPrisma
): Promise<SeatUsage> {
  const [account, used] = await Promise.all([
    db.clientAccount.findUnique({
      where: { id: clientAccountId },
      select: { candidateSeatLimit: true },
    }),
    countSeatsUsed(clientAccountId, db),
  ]);

  return summariseSeats(used, account?.candidateSeatLimit ?? null);
}

/** Shapes a count and a limit into the figures the UI shows. */
export function summariseSeats(used: number, limit: number | null): SeatUsage {
  if (limit === null) {
    return { used, limit: null, remaining: null, atLimit: false };
  }
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    atLimit: used >= limit,
  };
}

/**
 * Counts held seats for several accounts in one query.
 *
 * The accounts table lists every employer, so doing this per row would mean a
 * query per account on every page load.
 */
export async function countSeatsUsedForAccounts(
  clientAccountIds: string[],
  db: Db = defaultPrisma
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of clientAccountIds) counts.set(id, 0);
  if (clientAccountIds.length === 0) return counts;

  const now = new Date();
  const grouped = await db.assessmentInvite.groupBy({
    by: ['clientAccountId'],
    where: {
      clientAccountId: { in: clientAccountIds },
      revokedAt: null,
      OR: [{ consumedAt: { not: null } }, { expiresAt: { gt: now } }],
    },
    _count: { _all: true },
  });

  for (const row of grouped) {
    counts.set(row.clientAccountId, row._count._all);
  }
  return counts;
}

export class SeatLimitError extends Error {
  readonly usage: SeatUsage;

  constructor(usage: SeatUsage) {
    super(
      `This account has used all ${usage.limit} of its candidate seats. Withdraw an unused invitation to free one, or ask the platform team to raise the limit.`
    );
    // Subclassing Error loses instanceof under an ES5 target; see ProviderError.
    Object.setPrototypeOf(this, SeatLimitError.prototype);
    this.name = 'SeatLimitError';
    this.usage = usage;
  }
}

/** Throws SeatLimitError when no seat is available. */
export async function assertSeatAvailable(
  clientAccountId: string,
  db: Db = defaultPrisma
): Promise<SeatUsage> {
  const usage = await getSeatUsage(clientAccountId, db);
  if (usage.atLimit) throw new SeatLimitError(usage);
  return usage;
}
