import Link from "next/link";
import { prisma } from "@/lib/db";

async function getDashboardData(filter?: string) {
  const [totalSessions, completedSessions, inProgressSessions, totalPackages] = await Promise.all([
    prisma.assessmentSession.count(),
    prisma.assessmentSession.count({ where: { status: "COMPLETED" } }),
    prisma.assessmentSession.count({ where: { status: "IN_PROGRESS" } }),
    prisma.scenarioPackage.count(),
  ]);

  let sessionWhere: any = {};
  if (filter === "COMPLETED") sessionWhere.status = "COMPLETED";
  if (filter === "IN_PROGRESS") sessionWhere.status = "IN_PROGRESS";

  const recentSessions = await prisma.assessmentSession.findMany({
    take: 8,
    where: sessionWhere,
    orderBy: { startedAt: "desc" },
    include: { user: true, package: true },
  });

  const activePackage = await prisma.scenarioPackage.findFirst({ where: { isActive: true } });

  return { totalSessions, completedSessions, inProgressSessions, totalPackages, recentSessions, activePackage };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED")
    return <span className="badge-green">Completed</span>;
  if (status === "IN_PROGRESS")
    return <span className="badge-blue">In Progress</span>;
  return <span className="badge-slate">Pending</span>;
}

function formatTime(date: Date) {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = searchParams.filter;
  const data = await getDashboardData(filter);
  const completionRate = data.totalSessions > 0
    ? Math.round((data.completedSessions / data.totalSessions) * 100)
    : 0;

  return (
    <>
      {/* Content */}
      <main className="p-4 sm:p-6 lg:p-8 flex-1 min-w-0 max-w-full">
        {/* Stat Cards — Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
          {/* Total Sessions */}
          <Link href="/admin" className={`block stat-card p-3 sm:p-5 hover:border-blue-200 transition-colors ${!filter || filter === 'ALL' ? 'ring-2 ring-blue-500 border-transparent' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="stat-icon h-8 w-8 sm:h-10 sm:w-10 bg-blue-50">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <span className="stat-trend-up text-[9px] sm:text-xs">↑ All</span>
            </div>
            <p className="stat-value text-xl sm:text-2xl mt-1">{data.totalSessions}</p>
            <p className="stat-label text-[10px] sm:text-xs truncate">Total Sessions</p>
          </Link>

          {/* Completed */}
          <Link href="?filter=COMPLETED" className={`block stat-card p-3 sm:p-5 hover:border-emerald-200 transition-colors ${filter === 'COMPLETED' ? 'ring-2 ring-emerald-500 border-transparent' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="stat-icon h-8 w-8 sm:h-10 sm:w-10 bg-emerald-50">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <span className="stat-trend-up text-[9px] sm:text-xs">{completionRate}%</span>
            </div>
            <p className="stat-value text-xl sm:text-2xl mt-1">{data.completedSessions}</p>
            <p className="stat-label text-[10px] sm:text-xs truncate">Completed</p>
          </Link>

          {/* In Progress */}
          <Link href="?filter=IN_PROGRESS" className={`block stat-card p-3 sm:p-5 hover:border-amber-200 transition-colors ${filter === 'IN_PROGRESS' ? 'ring-2 ring-amber-500 border-transparent' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="stat-icon h-8 w-8 sm:h-10 sm:w-10 bg-amber-50">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              {data.inProgressSessions > 0 && (
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"/>Live
                </span>
              )}
            </div>
            <p className="stat-value text-xl sm:text-2xl mt-1">{data.inProgressSessions}</p>
            <p className="stat-label text-[10px] sm:text-xs truncate">In Progress</p>
          </Link>

          {/* Packages */}
          <Link href="/admin/packages" className="block stat-card p-3 sm:p-5 hover:border-violet-200 transition-colors">
            <div className="flex items-start justify-between">
              <div className="stat-icon h-8 w-8 sm:h-10 sm:w-10 bg-violet-50">
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
            </div>
            <p className="stat-value text-xl sm:text-2xl mt-1">{data.totalPackages}</p>
            <p className="stat-label text-[10px] sm:text-xs truncate">
              Packages
              {data.activePackage && (
                <span className="ml-1 badge-green text-[9px] px-1 py-0.2">1 Active</span>
              )}
            </p>
          </Link>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Sessions Table — 2 cols */}
          <div className="lg:col-span-2 table-wrapper">
            <div className="table-header">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {filter === 'COMPLETED' ? 'Completed Sessions' : filter === 'IN_PROGRESS' ? 'Live Sessions' : 'Recent Assessment Sessions'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {filter ? `Filtered results (${data.recentSessions.length})` : `Latest ${data.recentSessions.length} sessions`}
                </p>
              </div>
              <Link href="/admin/reports" className="btn-ghost text-xs px-3 py-1.5">
                View All →
              </Link>
            </div>
            {/* Desktop Table View (screens >= xl) */}
            <div className="hidden xl:block w-full">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="th" style={{ width: '30%' }}>Candidate</th>
                    <th className="th text-center" style={{ width: '15%' }}>Package</th>
                    <th className="th text-center" style={{ width: '20%' }}>Status</th>
                    <th className="th text-center" style={{ width: '20%' }}>Started</th>
                    <th className="th text-center" style={{ width: '15%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="td text-center text-slate-400 py-10">
                        No sessions yet. <Link href="/intake" className="text-blue-600 hover:underline">Start one →</Link>
                      </td>
                    </tr>
                  ) : (
                    data.recentSessions.map((session) => (
                      <tr key={session.id} className="tr">
                        <td className="td" data-label="Candidate">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                              {session.user?.name?.charAt(0) ?? "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 leading-none truncate">{session.user?.name ?? "—"}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{session.user?.email ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="td text-center" data-label="Package">
                          <span className="badge-slate text-[10px] inline-block">{session.package?.code ?? "—"}</span>
                        </td>
                        <td className="td text-center" data-label="Status">
                          <div className="inline-block"><StatusBadge status={session.status} /></div>
                        </td>
                        <td className="td text-xs text-slate-400 text-center" suppressHydrationWarning data-label="Started">{formatTime(session.startedAt)}</td>
                        <td className="td text-center" data-label="Actions">
                          <div className="flex items-center justify-center">
                            {session.status === "COMPLETED" ? (
                              <Link 
                                href={`/admin/reports/${session.id}`} 
                                className="btn-secondary text-[10px] px-2.5 py-1 hover:-translate-y-[1px] transition-transform"
                              >
                                Report
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Cards View (screens < xl) */}
            <div className="xl:hidden divide-y divide-slate-100">
              {data.recentSessions.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No sessions yet. <Link href="/intake" className="text-blue-600 hover:underline font-semibold">Start one →</Link>
                </div>
              ) : (
                data.recentSessions.map((session) => (
                  <div key={session.id} className="p-3.5 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm">
                          {session.user?.name?.charAt(0) ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{session.user?.name ?? "—"}</p>
                          <p className="text-[10px] text-slate-400 truncate">{session.user?.email ?? "—"}</p>
                        </div>
                      </div>
                      <StatusBadge status={session.status} />
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg text-slate-500">
                      <span className="text-[10px] font-semibold text-slate-600">Package: <span className="text-slate-900 font-bold">{session.package?.code ?? "—"}</span></span>
                      <span className="text-[10px] text-slate-400" suppressHydrationWarning>{formatTime(session.startedAt)}</span>
                    </div>

                    {session.status === "COMPLETED" && (
                      <div className="flex justify-end pt-1">
                        <Link 
                          href={`/admin/reports/${session.id}`} 
                          className="btn-secondary text-xs py-1.5 px-3 w-full text-center flex items-center justify-center gap-1 text-blue-600 hover:bg-blue-50"
                        >
                          View Assessment Report →
                        </Link>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>


          {/* Right Column */}
          <div className="flex flex-col gap-5">
            {/* Active Package Card */}
            <div className="card-p">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Active Package</h3>
                <Link href="/admin/packages" className="text-xs text-blue-600 font-semibold hover:underline">Manage</Link>
              </div>
              {data.activePackage ? (
                <div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-bold">
                      {data.activePackage.code.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 leading-tight">{data.activePackage.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">v{data.activePackage.version} · Code: {data.activePackage.code}</p>
                      <span className="badge-green text-[10px] mt-1 inline-flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>Active
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-xs text-red-700 font-medium">⚠️ No active package set.</p>
                  <p className="text-[10px] text-red-500 mt-1">New sessions cannot start without an active package.</p>
                  <Link href="/admin/packages" className="text-xs text-red-600 font-semibold hover:underline mt-2 inline-block">
                    Activate a package →
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="card-p">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link href="/intake" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">New Assessment</p>
                    <p className="text-[10px] text-slate-400">Register new candidate</p>
                  </div>
                </Link>
                <Link href="/admin/packages" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 group-hover:bg-violet-100">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Manage Packages</p>
                    <p className="text-[10px] text-slate-400">Switch scenario package</p>
                  </div>
                </Link>
                <Link href="/admin/reports" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">All Reports</p>
                    <p className="text-[10px] text-slate-400">View candidate reports</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Session Summary */}
            <div className="card-p">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Session Health</h3>
              <div className="space-y-3">
                {[
                  { label: "Completed", value: data.completedSessions, total: data.totalSessions, color: "bg-emerald-500" },
                  { label: "In Progress", value: data.inProgressSessions, total: data.totalSessions, color: "bg-blue-500" },
                  { label: "Pending", value: Math.max(0, data.totalSessions - data.completedSessions - data.inProgressSessions), total: data.totalSessions, color: "bg-slate-300" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">{item.label}</span>
                      <span className="font-bold text-slate-900">{item.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-700`}
                        style={{ width: item.total > 0 ? `${(item.value / item.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
