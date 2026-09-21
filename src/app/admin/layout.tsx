import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AdminShell from './AdminShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const email = getAdminSession();
  if (!email) {
    redirect('/admin-login');
  }

  // Fetch admin profile data and system settings from DB
  const [admin, settings] = await Promise.all([
    prisma.admin.findUnique({
      where: { email },
      select: { name: true, role: true, profileImageUrl: true },
    }),
    prisma.platformSettings.findFirst()
  ]);

  return (
    <AdminShell
      adminEmail={email}
      adminName={admin?.name || 'Admin'}
      adminRole={admin?.role || 'ADMIN'}
      adminImageUrl={admin?.profileImageUrl}
      platformName={settings?.platformName || undefined}
      logoUrl={settings?.logoUrl || undefined}
    >
      {children}
    </AdminShell>
  );
}
