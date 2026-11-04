import Link from "next/link";
import { prisma } from "@/lib/db";
import AdminProfileDropdown from "@/app/admin/AdminProfileDropdown";

async function getAllSessions() {
  return prisma.assessmentSession.findMany({
    orderBy: { startedAt: "desc" },
    include: { user: true, package: true },
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") return <span className="badge-green max-w-full truncate">Completed</span>;
  if (status === "IN_PROGRESS") return <span className="badge-blue max-w-full truncate">In Progress</span>;
  return <span className="badge-slate max-w-full truncate">Pending</span>;
}

export default async function ReportsListPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const sessions = await getAllSessions();
  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const inProgress = sessions.filter((s) => s.status === "IN_PROGRESS");

  let filteredSessions = sessions;
  let title = "All Sessions";

  if (searchParams.filter === "completed") {
    filteredSessions = completed;
    title = "Completed Sessions";
  } else if (searchParams.filter === "in_progress") {
    filteredSessions = inProgress;
    title = "In Progress Sessions";
  }

  return (
    <>
      <div className="page-content flex-1">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          <Link href="/admin/reports" className="stat-card p-3 sm:p-5 hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer block">
            <p className="stat-value text-lg sm:text-2xl">{sessions.length}</p>
            <p className="stat-label text-[10px] sm:text-xs truncate">Total Sessions</p>
          </Link>
          <Link href="/admin/reports?filter=completed" className="stat-card p-3 sm:p-5 hover:border-emerald-500 hover:shadow-sm transition-all cursor-pointer block">
            <p className="stat-value text-lg sm:text-2xl text-emerald-600">{completed.length}</p>
            <p className="stat-label text-[10px] sm:text-xs truncate">Completed</p>
          </Link>
          <Link href="/admin/reports?filter=in_progress" className="stat-card p-3 sm:p-5 hover:border-amber-500 hover:shadow-sm transition-all cursor-pointer block">
            <p className="stat-value text-lg sm:text-2xl text-amber-600">
              {inProgress.length}
            </p>
            <p className="stat-label text-[10px] sm:text-xs truncate">In Progress</p>
          </Link>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <div className="table-header">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{filteredSessions.length} total records</p>
            </div>
          </div>
          {/* Desktop Table View (screens >= lg) */}
          <div className="hidden lg:block w-full">
            {/* Auto layout: Package, Status and dates size to their content so they never
                clip; Candidate takes the leftover width and truncates the long email. */}
            <table className="w-full [&_th]:px-3 [&_td]:px-3">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="th w-full">Candidate</th>
                  <th className="th text-center whitespace-nowrap hidden xl:table-cell">Target Role</th>
                  <th className="th text-center whitespace-nowrap">Package</th>
                  <th className="th text-center whitespace-nowrap">Status</th>
                  <th className="th text-center whitespace-nowrap">Started</th>
                  <th className="th text-center whitespace-nowrap hidden xl:table-cell">Completed</th>
                  <th className="th text-center whitespace-nowrap">Report</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="td text-center text-slate-400 py-16">
                      <p className="text-base">No sessions found</p>
                      {searchParams.filter ? (
                        <Link href="/admin/reports" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                          Clear filters →
                        </Link>
                      ) : (
                        <Link href="/intake" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                          Register your first candidate →
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr key={s.id} className="tr">
                      <td className="td max-w-0" data-label="Candidate">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                            {s.user?.name?.charAt(0) ?? "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 leading-none truncate">{s.user?.name ?? "—"}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={s.user?.email ?? ""}>{s.user?.email ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td text-center hidden xl:table-cell" data-label="Role">
                        <div className="mx-auto min-w-[7rem] max-w-[11rem] text-xs text-slate-600 break-words line-clamp-2" title={s.user?.targetRole ?? ""}>{s.user?.targetRole ?? "—"}</div>
                      </td>
                      <td className="td text-center whitespace-nowrap" data-label="Package">
                        <span className="badge-slate text-[10px]" title={s.package?.code ?? ""}>{s.package?.code ?? "—"}</span>
                      </td>
                      <td className="td text-center whitespace-nowrap" data-label="Status">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="td text-xs text-slate-400 text-center whitespace-nowrap" suppressHydrationWarning data-label="Started">
                        {s.startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="td text-xs text-slate-400 text-center whitespace-nowrap hidden xl:table-cell" suppressHydrationWarning data-label="Completed">
                        {s.completedAt
                          ? s.completedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td className="td text-center whitespace-nowrap" data-label="Report">
                        {s.status === "COMPLETED" ? (
                          <Link
                            href={`/admin/reports/${s.id}`}
                            className="btn-secondary text-[10px] px-2.5 py-1 hover:-translate-y-[1px] transition-transform inline-block"
                          >
                            Report
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-300">Not ready</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Cards View (screens < lg) */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No sessions found.
              </div>
            ) : (
              filteredSessions.map((s) => (
                <div key={s.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white shadow-sm">
                        {s.user?.name?.charAt(0) ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{s.user?.name ?? "—"}</p>
                        <p className="text-xs text-slate-500 truncate">{s.user?.email ?? "—"}</p>
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2.5 text-xs text-slate-600">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Role & Package</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {s.user?.targetRole || "General"} • {s.package?.code ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Started</span>
                      <span className="font-medium text-slate-700 block" suppressHydrationWarning>
                        {s.startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {s.status === "COMPLETED" && (
                    <div className="flex items-center justify-end pt-1">
                      <Link
                        href={`/admin/reports/${s.id}`}
                        className="btn-secondary text-xs py-2 px-3 w-full flex items-center justify-center gap-1.5 text-blue-600 hover:bg-blue-50 font-medium"
                      >
                        <span>View Full Assessment Report</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
