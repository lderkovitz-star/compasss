import Link from "next/link";
import { prisma } from "@/lib/db";
import { Eye } from "lucide-react";

async function getCandidates() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { sessions: true }
      }
    }
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function CandidatesPage() {
  const candidates = await getCandidates();

  return (
    <>
    <div className="page-content flex-1">
      <div className="table-wrapper animate-slide-up">
        <div className="table-header">
          <h2 className="text-sm font-bold text-slate-900">Registered Candidates</h2>
          <span className="badge-slate text-xs">{candidates.length} total</span>
        </div>
        {/* Desktop Table View (screens >= lg) */}
        <div className="hidden lg:block w-full">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-slate-50/80">
              <tr>
                <th className="th" style={{ width: '30%' }}>Candidate Name</th>
                <th className="th text-center" style={{ width: '25%' }}>Target Role</th>
                <th className="th text-center" style={{ width: '15%' }}>Sessions</th>
                <th className="th text-center" style={{ width: '15%' }}>Joined Date</th>
                <th className="th text-center" style={{ width: '15%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="tr group">
                  <td className="td" data-label="Candidate">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                        <p className="text-xs text-slate-500 truncate">{c.email}</p>
                      </div>
                    </div>
                  </td>
                    <td className="td text-center" data-label="Target Role">
                      <span className="badge-slate text-xs inline-block truncate max-w-full">{c.targetRole ?? "—"}</span>
                    </td>
                    <td className="td text-sm font-medium text-slate-600 text-center" data-label="Sessions">
                      {c._count.sessions}
                    </td>
                    <td className="td text-xs text-slate-400 text-center" suppressHydrationWarning data-label="Joined">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="td text-center" data-label="Actions">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/admin/candidates/${c.id}`}
                          className="btn-ghost text-xs px-2.5 py-1.5 text-blue-600 hover:bg-blue-50"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <Link
                          href={`/admin/candidates/${c.id}`}
                          className="btn-ghost text-xs px-2.5 py-1.5 text-blue-600 hover:bg-blue-50"
                          title="Edit"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {candidates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm">
                      No candidates found. Register a candidate via the Intake portal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Cards View (screens < lg) */}
          <div className="lg:hidden divide-y divide-slate-100">
            {candidates.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-500 text-sm">
                No candidates found. Register a candidate via the Intake portal.
              </div>
            ) : (
              candidates.map((c) => (
                <div key={c.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-sm">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{c.name}</p>
                        <p className="text-xs text-slate-500 truncate">{c.email}</p>
                      </div>
                    </div>
                    <span className="badge-slate text-[10px] font-medium flex-shrink-0">
                      {c.targetRole ?? "General"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-2.5 text-xs text-slate-600">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Sessions</span>
                      <span className="font-semibold text-slate-800">{c._count.sessions} {c._count.sessions === 1 ? 'session' : 'sessions'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Joined Date</span>
                      <span className="font-medium text-slate-700" suppressHydrationWarning>{formatDate(c.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                    <Link
                      href={`/admin/candidates/${c.id}`}
                      className="btn-secondary text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5 text-blue-600 hover:bg-blue-50"
                    >
                      <Eye className="h-3.5 w-3.5 text-blue-600" />
                      <span>View Details</span>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
