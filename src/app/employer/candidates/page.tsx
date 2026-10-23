import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getClientSession } from '@/lib/portal-auth';
import PortalShell from '../PortalShell';
import InviteGenerator from './InviteGenerator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    INVITED: 'bg-amber-50 text-amber-700 border-amber-200',
    EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
    PENDING: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
        styles[status] ?? styles.PENDING
      }`}
    >
      {status === 'INVITED' ? 'Awaiting candidate' : status.replace('_', ' ')}
    </span>
  );
}

export default async function PortalCandidatesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getClientSession();
  if (!session) redirect('/employer');

  // Searching happens in the query rather than in the browser, so a long
  // ledger stays usable and the tenant filter is never something the search
  // can widen.
  const query = (searchParams.q ?? '').trim();
  const matches = query
    ? {
        OR: [
          { user: { name: { contains: query, mode: 'insensitive' as const } } },
          { user: { email: { contains: query, mode: 'insensitive' as const } } },
          { user: { targetRole: { contains: query, mode: 'insensitive' as const } } },
          { jobContext: { title: { contains: query, mode: 'insensitive' as const } } },
          { package: { name: { contains: query, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  // Every query on this page is filtered by the tenant from the session, never
  // by anything the browser sent. A candidate belongs to exactly one account,
  // and practice runs carry no account at all, so they cannot appear here.
  const sessions = await prisma.assessmentSession.findMany({
    where: { clientAccountId: session.clientAccountId, kind: 'OFFICIAL', ...matches },
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

  // An invite that nobody has opened yet has no sitting, so it was absent from
  // this table entirely - an employer could send ten links and watch an empty
  // ledger, with no way to tell whether anything had gone out.
  const pendingInvites = await prisma.assessmentInvite.findMany({
    where: {
      clientAccountId: session.clientAccountId,
      sessionId: null,
      revokedAt: null,
      ...(query
        ? {
            OR: [
              { candidateName: { contains: query, mode: 'insensitive' as const } },
              { candidateEmail: { contains: query, mode: 'insensitive' as const } },
              { targetRole: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      targetRole: true,
      expiresAt: true,
      createdAt: true,
      package: { select: { name: true } },
    },
  });

  const now = new Date();
  type Row = {
    key: string;
    name: string;
    email: string;
    role: string;
    packageName: string;
    status: string;
    completedAt: Date | null;
    sessionId: string | null;
    sortAt: Date;
    note: string | null;
  };

  const rows: Row[] = [
    ...sessions.map((s) => ({
      key: `s:${s.id}`,
      name: s.user?.name ?? 'Unknown',
      email: s.user?.email ?? '',
      role: s.jobContext?.title ?? s.user?.targetRole ?? '—',
      packageName: s.package?.name ?? '—',
      status: s.status,
      completedAt: s.completedAt,
      sessionId: s.id,
      sortAt: s.startedAt,
      note: null,
    })),
    ...pendingInvites.map((i) => ({
      key: `i:${i.id}`,
      name: i.candidateName,
      email: i.candidateEmail,
      role: i.targetRole ?? '—',
      packageName: i.package?.name ?? '—',
      status: i.expiresAt < now ? 'EXPIRED' : 'INVITED',
      completedAt: null,
      sessionId: null,
      sortAt: i.createdAt,
      note:
        i.expiresAt < now
          ? `Link expired ${i.expiresAt.toLocaleDateString()}`
          : `Link valid until ${i.expiresAt.toLocaleDateString()}`,
    })),
  ].sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());

  const completed = sessions.filter((s) => s.status === 'COMPLETED').length;
  const awaiting = rows.filter((r) => r.status === 'INVITED').length;

  // Everything the generator offers is scoped to this account: its own saved
  // roles, and the package resolved by the Module B order - this account's
  // override first, then the global client default.
  const [account, settings, savedContexts, packages] = await Promise.all([
    prisma.clientAccount.findUnique({
      where: { id: session.clientAccountId },
      select: { assignedPackageId: true },
    }),
    prisma.platformSettings.findFirst({ select: { defaultClientPackageId: true } }),
    prisma.jobContext.findMany({
      where: { clientAccountId: session.clientAccountId, isArchived: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true },
      take: 50,
    }),
    prisma.scenarioPackage.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const defaultPackageId =
    account?.assignedPackageId ?? settings?.defaultClientPackageId ?? packages[0]?.id ?? null;

  return (
    <PortalShell company={session.account.name}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Candidate Ledger</h1>
          <p className="text-sm text-slate-600 mt-1">
            {rows.length} candidate{rows.length === 1 ? '' : 's'} · {completed} completed
            {awaiting > 0 ? ` · ${awaiting} awaiting` : ''}
            {query ? ` · matching “${query}”` : ''}
          </p>
        </div>
        <InviteGenerator
          packages={packages}
          savedContexts={savedContexts}
          defaultPackageId={defaultPackageId}
        />
      </div>

      {/* A plain GET form: it works before JavaScript loads, the result is a
          URL the employer can keep, and the filtering stays server-side. */}
      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name, email, role or assessment"
          aria-label="Search candidates"
          className="form-input flex-1 min-w-[16rem] text-slate-900"
        />
        <button type="submit" className="btn-secondary text-sm px-4 py-2">
          Search
        </button>
        {query && (
          <Link href="/employer/candidates" className="btn-ghost text-sm px-4 py-2 text-slate-600">
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-900 font-medium">
            {query ? 'No candidates match that search' : 'No candidates yet'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {query
              ? 'Try a shorter search, or clear it to see everyone.'
              : 'Generate an assessment link to invite your first candidate.'}
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
                {rows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 text-sm">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.role}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                      {row.packageName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                      {row.note && (
                        <div className="text-[11px] text-slate-400 mt-1">{row.note}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">
                      {row.completedAt ? row.completedAt.toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.status === 'COMPLETED' && row.sessionId ? (
                        <Link
                          href={`/employer/reports/${row.sessionId}`}
                          className="text-[13px] font-medium text-blue-600 hover:text-blue-700"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-[13px] text-slate-400">
                          {row.status === 'INVITED'
                            ? 'Not started'
                            : row.status === 'EXPIRED'
                              ? 'Expired'
                              : 'Not ready'}
                        </span>
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
