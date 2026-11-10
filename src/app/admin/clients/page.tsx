import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ClientAccountsClient from './ClientAccountsClient';
import { countSeatsUsedForAccounts } from '@/lib/seats';

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
        candidateSeatLimit: true,
        createdAt: true,
        assignedPackage: { select: { id: true, name: true } },
        _count: { select: { candidates: true, sessions: true, invites: true } },
        // "Tested" means finished, not invited. Counted here rather than in
        // the page so one query covers every account.
        sessions: {
          where: { kind: 'OFFICIAL', status: 'COMPLETED' },
          select: { id: true },
        },
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

  // Held seats for every account in one grouped query rather than one per row.
  const seatsUsed = await countSeatsUsedForAccounts(accounts.map((a) => a.id));

  return {
    accounts,
    packages,
    seatsUsed,
    defaultPackageId: settings?.defaultClientPackageId ?? null,
  };
}

export default async function ClientAccountsPage() {
  // Employer accounts are platform-level configuration, not tenant data.
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== 'SUPER_ADMIN') redirect('/admin');

  const { accounts, packages, seatsUsed, defaultPackageId } = await getData();

  return (
    <main className="page-content flex-1">
      <div className="alert-info flex items-start gap-3 mb-6">
        <div>
          <p className="font-medium">Each client account is an isolated employer workspace.</p>
          <p className="text-sm mt-0.5">
            Candidates, sessions and reports belong to exactly one account. An access key is shown
            once when it is issued and cannot be recovered afterwards — only rotated. Seats count
            invitations that are live or already used; withdrawing an unused one frees its seat.
          </p>
        </div>
      </div>

      <ClientAccountsClient
        accounts={accounts.map(({ sessions, ...a }) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          testedCount: sessions.length,
          seatsUsed: seatsUsed.get(a.id) ?? 0,
        }))}
        packages={packages}
        defaultPackageId={defaultPackageId}
      />
    </main>
  );
}
