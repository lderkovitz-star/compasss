import { prisma } from './db';
import { SUPPORT_EMAIL } from './constants/brand';

/**
 * The tenant that owns everything from before the platform had tenants.
 *
 * The backfill created this account and stamped every existing candidate and
 * sitting with it. Open intake - the original single-tenant entry point, still
 * reachable - keeps writing into it, so that every candidate row has an owner.
 * That invariant is what the tenant filter relies on: a row with no tenant is
 * a row no employer query would ever exclude.
 */
export const LEGACY_TENANT_SLUG = 'continental-works';
export const LEGACY_TENANT_NAME = 'Continental Works';

let cached: string | null = null;

/** Idempotent, and matches what prisma/backfill/001-legacy-tenant.ts creates. */
export async function resolveDefaultTenantId(): Promise<string> {
  if (cached) return cached;

  const account = await prisma.clientAccount.upsert({
    where: { slug: LEGACY_TENANT_SLUG },
    update: {},
    create: {
      name: LEGACY_TENANT_NAME,
      slug: LEGACY_TENANT_SLUG,
      contactEmail: SUPPORT_EMAIL,
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  cached = account.id;
  return account.id;
}
