import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ClientAccountsClient from './ClientAccountsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getData() {
  const [accounts, packages] = await Promise.all([
    prisma.clientAccount.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        contactEmail: true,
        status: true,
        accessKeyPrefix: true,
        accessKeyLast4: true,
        assignedPackageId: true,
        createdAt: true,
        assignedPackage: { select: { id: true, name: true } },
        _count: { select: { candidates: true, sessions: true, invites: true } },
      },
    }),
    prisma.scenarioPackage.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const settings = await prisma.platformSettings.findFirst({
    select: { defaultClientPackageId: true },
  });

  return { accounts, packages, defaultPackageId: settings?.defaultClientPackageId ?? null };
}

export default async function ClientAccountsPage() {
  // Employer accounts are platform-level configuration, not tenant data.
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== 'SUPER_ADMIN') redirect('/admin');

  const { accounts, packages, defaultPackageId } = await getData();

  return (
    <main className="page-content flex-1">
      <div className="alert-info flex items-start gap-3 mb-6">
        <div>
          <p className="font-medium">Each client account is an isolated employer workspace.</p>
          <p className="text-sm mt-0.5">
            Candidates, sessions and reports belong to exactly one account. An access key is shown
            once when it is issued and cannot be recovered afterwards — only rotated.
          </p>
        </div>
      </div>

      <ClientAccountsClient
        accounts={accounts.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))}
        packages={packages}
        defaultPackageId={defaultPackageId}
      />
    </main>
  );
}
