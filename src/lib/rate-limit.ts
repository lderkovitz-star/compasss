import { prisma } from '@/lib/db';

/**
 * Fixed-window rate limiting backed by a table.
 *
 * There is no Redis in this stack and the volumes here are small - a handful
 * of gateway attempts per employer - so a row per window is adequate. Windows
 * are coarse on purpose: an attacker gets at most `limit` tries per window,
 * and old rows are cheap to sweep.
 */

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

export async function consumeRateLimit(
  bucketKey: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: { bucketKey_windowStart: { bucketKey, windowStart } },
    update: { count: { increment: 1 } },
    create: { bucketKey, windowStart, count: 1 },
    select: { count: true },
  });

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt,
  };
}

/** Best-effort cleanup of windows nobody will look at again. */
export async function sweepRateLimits(olderThanHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const { count } = await prisma.rateLimitBucket.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return count;
}

/** Derives a client IP from the proxy headers Vercel sets. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
