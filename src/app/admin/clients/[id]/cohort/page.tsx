import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import CohortWorkbench from '@/components/CohortWorkbench';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * One company's cohort, from the master console.
 *
 * Reading a tenant's candidates from outside that tenant is deliberate and
 * narrow: it is how a company's shortlist gets pulled up in a demo without
 * holding their access key. Gated on a master role, and the endpoint behind it
 * audits every call.
 */
export default async function AdminCompanyCohortPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== 'SUPER_ADMIN') redirect('/admin');

  const account = await prisma.clientAccount.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!account) notFound();

  const [contexts, completed] = await Promise.all([
    prisma.jobContext.findMany({
      where: { clientAccountId: account.id, isArchived: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true },
    }),
    prisma.assessmentSession.count({
      where: { clientAccountId: account.id, kind: 'OFFICIAL', status: 'COMPLETED' },
    }),
  ]);

  return (
    <main className="page-content flex-1">
      <Link
        href="/admin/clients"
        className="inline-flex min-h-[44px] items-center text-[13px] font-medium text-slate-600 hover:text-slate-900"
      >
        ← Client accounts
      </Link>

      <div className="mt-2">
        <CohortWorkbench
          heading={`${account.name} — cohort analysis`}
          savedRoles={contexts}
          completedCount={completed}
          rankEndpoint={`/api/admin/clients/${account.id}/cohort`}
          compareEndpoint={`/api/admin/clients/${account.id}/cohort`}
          reportBase="/admin/reports"
        />
      </div>
    </main>
  );
}
