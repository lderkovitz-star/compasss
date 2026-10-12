import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getClientSession } from '@/lib/portal-auth';
import PortalShell from '../PortalShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    PENDING: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
        styles[status] ?? styles.PENDING
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export default async function PortalCandidatesPage() {
  const session = await getClientSession();
  if (!session) redirect('/portal');

  // Every query on this page is filtered by the tenant from the session, never
  // by anything the browser sent. A candidate belongs to exactly one account,
  // and practice runs carry no account at all, so they cannot appear here.
  const sessions = await prisma.assessmentSession.findMany({
    where: { clientAccountId: session.clientAccountId, kind: 'OFFICIAL' },
    orderBy: { startedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      user: { select: { name: true, email: true, targetRole: true } },
      package: { select: { name: true, code: true } },
      jobContext: { select: { title: true } },
    },
  });

  const completed = sessions.filter((s) => s.status === 'COMPLETED').length;

  return (
    <PortalShell company={session.account.name}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Candidate Ledger</h1>
        <p className="text-sm text-slate-600 mt-1">
          {sessions.length} assessment{sessions.length === 1 ? '' : 's'} · {completed} completed
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-900 font-medium">No candidates yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Assessments appear here as soon as a candidate opens their invite link.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                    Candidate
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                    Role
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Package
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                    Completed
                  </th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                    Report
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 text-sm">
                        {s.user?.name ?? 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-500">{s.user?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {s.jobContext?.title ?? s.user?.targetRole ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                      {s.package?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">
                      {s.completedAt ? s.completedAt.toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status === 'COMPLETED' ? (
                        <Link
                          href={`/portal/reports/${s.id}`}
                          className="text-[13px] font-medium text-blue-600 hover:text-blue-700"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-[13px] text-slate-400">Not ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
