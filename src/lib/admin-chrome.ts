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
 * Never throws: a public page must still render if the database is slow or the
 * session is stale.
 */
export async function getAdminChrome(): Promise<AdminChrome | null> {
  try {
    const email = getAdminSession();
    if (!email) return null;

    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { name: true, role: true, profileImageUrl: true, isActive: true },
    });
    if (!admin || !admin.isActive) return null;

    return {
      adminEmail: email,
      adminName: admin.name || 'Admin',
      adminRole: admin.role || 'ADMIN',
      adminImageUrl: admin.profileImageUrl ?? null,
    };
  } catch {
    return null;
  }
}
