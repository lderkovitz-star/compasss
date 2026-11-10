import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getClientSession } from '@/lib/portal-auth';
import PortalShell from '../PortalShell';
import CohortWorkbench from '@/components/CohortWorkbench';
import EvaluatorAskBox from '@/components/EvaluatorAskBox';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CohortPage() {
  const session = await getClientSession();
  if (!session) redirect('/employer');

  const [contexts, completed, askable] = await Promise.all([
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
    // The question box works on finished sittings only - an unfinished one
    // has no scores to reason about. Capped because the prompt can only hold
    // so many people at useful depth; see MAX_CANDIDATES.
    prisma.assessmentSession.findMany({
      where: {
        clientAccountId: session.clientAccountId,
        kind: 'OFFICIAL',
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: 24,
      select: {
        id: true,
        user: { select: { name: true } },
        jobContext: { select: { title: true } },
      },
    }),
  ]);

  return (
    <PortalShell company={session.account.name}>
      <CohortWorkbench
        savedRoles={contexts}
        completedCount={completed}
        rankEndpoint="/api/portal/cohort/rank"
        compareEndpoint="/api/portal/cohort/compare"
        reportBase="/employer/reports"
      />

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-900">Ask about these candidates</h2>
        <p className="mt-1 text-sm text-slate-600">
          A question in plain English, answered from the simulation records — decisions, timing,
          dimension scores and any external scores on file. It explains the evidence; the decision
          stays yours.
        </p>
        <div className="mt-5">
          <EvaluatorAskBox
            endpoint="/api/portal/ask"
            candidates={askable.map((s) => ({
              sessionId: s.id,
              name: s.user?.name ?? 'Unnamed candidate',
              roleTitle: s.jobContext?.title ?? null,
            }))}
          />
        </div>
      </section>
    </PortalShell>
  );
}
