import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export type AdminChrome = {
  adminEmail: string;
  adminName: string;
  adminRole: string;
  adminImageUrl: string | null;
};

/**
 * The signed-in admin, for pages outside the console that offer them the
 * settings drawer. Null for everyone else, which is what keeps that markup
 * away from candidates and visitors.
 *
 * Never throws: a public page must still render if the database is slow.
 *
 * The session cookie decides. It is an HMAC this server signed, so a valid one
 * is proof enough to offer the shortcut; the lookup only fills in the name and
 * role for the drawer. An earlier version returned null whenever that lookup
 * failed, which made the control vanish on a cold start for no reason the
 * person could see - and showing it costs nothing, because every page behind
 * it is checked again anyway.
 *
 * A deactivated admin is the one case that still returns null, and that is on
 * purpose.
 */
export async function getAdminChrome(): Promise<AdminChrome | null> {
  const email = getAdminSession();
  if (!email) return null;

  const fallback: AdminChrome = {
    adminEmail: email,
    adminName: 'Admin',
    adminRole: 'ADMIN',
    adminImageUrl: null,
  };

  try {
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { name: true, role: true, profileImageUrl: true, isActive: true },
    });
    if (!admin) return fallback;
    if (!admin.isActive) return null;

    return {
      adminEmail: email,
      adminName: admin.name || 'Admin',
      adminRole: admin.role || 'ADMIN',
      adminImageUrl: admin.profileImageUrl ?? null,
    };
  } catch {
    return fallback;
  }
}
