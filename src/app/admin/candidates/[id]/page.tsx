import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import CandidateDetailClient from "./CandidateDetailClient";

export default async function CandidatePage({ params }: { params: { id: string } }) {
  const candidate = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      sessions: {
        include: { package: true },
        orderBy: { startedAt: "desc" }
      }
    }
  });

  if (!candidate) {
    notFound();
  }

  return (
    <>
      <main className="page-content flex-1 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/admin/candidates" className="btn-ghost text-xs px-2 py-1">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Candidates
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-900 truncate max-w-xs">{candidate.name}</span>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white">
            {candidate.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{candidate.name}</h1>
            <p className="text-sm text-slate-500">{candidate.email}</p>
          </div>
        </div>

        <CandidateDetailClient candidate={candidate} />

        <div className="table-wrapper mt-6">
          <div className="table-header">
            <h2 className="text-sm font-bold text-slate-900">Assessment Sessions</h2>
            <span className="badge-slate text-xs">{candidate.sessions.length} sessions</span>
          </div>
          {/* Desktop Table View (screens >= lg) */}
          <div className="hidden lg:block overflow-x-auto w-full">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="th">Package</th>
                  <th className="th">Status</th>
                  <th className="th">Started At</th>
                  <th className="th text-center w-32">Report</th>
                </tr>
              </thead>
              <tbody>
                {candidate.sessions.map((session) => (
                  <tr key={session.id} className="tr">
                    <td className="td">
                      <p className="text-sm font-medium text-slate-900">{session.package.name}</p>
                      <p className="text-xs text-slate-400">{session.package.code}</p>
                    </td>
                    <td className="td">
                      {session.status === "COMPLETED" ? (
                        <span className="badge-green">Completed</span>
                      ) : session.status === "IN_PROGRESS" ? (
                        <span className="badge-blue">In Progress</span>
                      ) : (
                        <span className="badge-slate">Pending</span>
                      )}
                    </td>
                    <td className="td text-xs text-slate-400" suppressHydrationWarning>
                      {session.startedAt.toLocaleDateString()}
                    </td>
                    <td className="td text-center">
                      <div className="flex justify-center items-center">
                        {session.status === "COMPLETED" ? (
                          <Link
                            href={`/admin/reports/${session.id}`}
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            View Report
                          </Link>
                        ) : session.status === "IN_PROGRESS" ? (
                          <Link
                            href={`/admin/sessions/${session.id}/status`}
                            className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors gap-1.5"
                          >
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            Live Progress
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-300">N/A</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {candidate.sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-sm">
                      No sessions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Cards View (screens < lg) */}
          <div className="lg:hidden divide-y divide-slate-100">
            {candidate.sessions.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No sessions found.
              </div>
            ) : (
              candidate.sessions.map((session) => (
                <div key={session.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{session.package.name}</p>
                      <span className="badge-slate text-[10px] mt-0.5 inline-block">{session.package.code}</span>
                    </div>
                    {session.status === "COMPLETED" ? (
                      <span className="badge-green text-xs">Completed</span>
                    ) : session.status === "IN_PROGRESS" ? (
                      <span className="badge-blue text-xs">In Progress</span>
                    ) : (
                      <span className="badge-slate text-xs">Pending</span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Started Date</span>
                    <span className="font-medium text-slate-700" suppressHydrationWarning>{session.startedAt.toLocaleDateString()}</span>
                  </div>

                  {session.status === "COMPLETED" ? (
                    <Link
                      href={`/admin/reports/${session.id}`}
                      className="btn-secondary text-xs py-2 px-3 w-full flex items-center justify-center gap-1.5 text-blue-600 hover:bg-blue-50 font-medium"
                    >
                      <span>View Report</span>
                    </Link>
                  ) : session.status === "IN_PROGRESS" ? (
                    <Link
                      href={`/admin/sessions/${session.id}/status`}
                      className="btn-secondary text-xs py-2 px-3 w-full flex items-center justify-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 font-medium"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      <span>Live Progress</span>
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </>
  );
}
