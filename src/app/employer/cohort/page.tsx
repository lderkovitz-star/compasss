import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getClientSession } from '@/lib/portal-auth';
import PortalShell from '../PortalShell';
import CohortClient from './CohortClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CohortPage() {
  const session = await getClientSession();
  if (!session) redirect('/employer');

  const [contexts, completed] = await Promise.all([
    prisma.jobContext.findMany({
      where: { clientAccountId: session.clientAccountId, isArchived: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true },
    }),
    prisma.assessmentSession.count({
      where: {
        clientAccountId: session.clientAccountId,
        kind: 'OFFICIAL',
        status: 'COMPLETED',
      },
    }),
  ]);

  return (
    <PortalShell company={session.account.name}>
      <CohortClient savedRoles={contexts} completedCount={completed} />
    </PortalShell>
  );
}
