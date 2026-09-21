import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import AdminsClient from './AdminsClient';
import AdminProfileDropdown from '@/app/admin/AdminProfileDropdown';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminsPage() {
  const currentAdmin = await getCurrentAdmin();

  if (!currentAdmin) {
    redirect('/admin-login');
  }

  // Fetch all admins
  const admins = await prisma.admin.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      profileImageUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const serializedAdmins = admins.map(a => ({
    id: a.id,
    email: a.email,
    name: a.name || 'Admin',
    role: a.role || 'ADMIN',
    profileImageUrl: a.profileImageUrl,
    isActive: a.isActive ?? true,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <>
      <main className="page-content flex-1">
        <AdminsClient
          initialAdmins={serializedAdmins}
          currentAdminId={currentAdmin.id}
          currentUserRole={currentAdmin.role || 'ADMIN'}
        />
      </main>
    </>
  );
}
