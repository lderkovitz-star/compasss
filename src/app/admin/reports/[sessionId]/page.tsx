import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import dynamic from "next/dynamic";
import ExportButtons from "./ExportButtons";

const ReportCharts = dynamic(() => import("./ReportCharts"), { 
  ssr: false,
  loading: () => <div className="h-[280px] w-full animate-pulse bg-slate-100 rounded-2xl"></div>
});

interface DBDimension {
  name: string;
  code: string;
  category: string;
}

interface DBFinalScore {
  dimension: DBDimension;
  finalScore: number;
  percentileRank: number | null;
}

interface DBBiometric {
  bpm: number;
}

interface DBResponse {
  id: string;
  scenario: {
    sequenceOrder: number;
    narrativeText: string;
  } | null;
  option: {
    optionCode: string;
    optionText: string;
  } | null;
  timeSpentMs: number;
}

async function getReport(sessionId: string) {
  return prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      user: true,
      package: true,
      finalScores: {
        include: { dimension: true },
        orderBy: { finalScore: "desc" },
      },
      responses: {
        include: { scenario: true, option: true },
        orderBy: { submittedAt: "asc" },
      },
      biometrics: { orderBy: { recordedAt: "asc" } },
    },
  });
}

export default async function ReportPage({ params }: { params: { sessionId: string } }) {
  const session = await getReport(params.sessionId);
  if (!session) notFound();

  const dimensionScores = ((session.finalScores || []) as unknown as DBFinalScore[]).map((fs) => ({
    name: fs.dimension.name,
    code: fs.dimension.code,
    category: fs.dimension.category,
    score: Math.round(fs.finalScore),
    percentile: Math.round(fs.percentileRank ?? 0),
  }));

  const biometricData = ((session.biometrics || []) as unknown as DBBiometric[]).map((b, i: number) => ({
    t: i,
    bpm: b.bpm,
    time: `T+${Math.floor(i * 15 / 60)}m`,
  }));

  const overallScore = dimensionScores.length > 0
    ? Math.round(dimensionScores.reduce((acc: number, item: { score: number }) => acc + item.score, 0) / dimensionScores.length)
    : 0;

  return (
    <>
      <main className="page-content flex-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Link href="/admin/reports" className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
              Reports
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-slate-900 truncate max-w-xs">{session.user?.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
            <ExportButtons
              candidateName={session.user?.name ?? "Candidate"}
              candidateEmail={session.user?.email ?? ""}
              targetRole={session.user?.targetRole ?? ""}
              packageName={session.package?.name ?? ""}
              overallScore={overallScore}
              sessionId={params.sessionId}
              status={session.status}
              startedAt={session.startedAt ? session.startedAt.toISOString() : null}
              completedAt={session.completedAt ? session.completedAt.toISOString() : null}
              candidateNotes={session.user?.hobbiesSkills ?? null}
              dimensionScores={dimensionScores}
              biometricData={biometricData}
              responses={((session.responses || []) as unknown as DBResponse[]).map(r => ({
                id: r.id,
                scenario: r.scenario ? { sequenceOrder: r.scenario.sequenceOrder, narrativeText: r.scenario.narrativeText } : null,
                option: r.option ? { optionCode: r.option.optionCode, optionText: r.option.optionText } : null,
                timeSpentMs: r.timeSpentMs
              }))}
            />
          </div>
        </div>

        {/* Candidate Header */}
        <div className="card-p mb-6">
          <div className="flex items-start justify-between flex-col md:flex-row gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg sm:text-xl font-black text-white">
                {session.user?.name?.charAt(0) ?? "?"}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{session.user?.name}</h1>
                <p className="text-xs sm:text-sm text-slate-500 truncate">{session.user?.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="badge-slate text-xs">{session.user?.targetRole ?? "—"}</span>
                  <span className="badge-blue text-xs">{session.package?.name}</span>
                  {session.status === "COMPLETED"
                    ? <span className="badge-green text-xs">Completed</span>
                    : <span className="badge-amber text-xs">In Progress</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-4 sm:gap-6 text-center self-stretch sm:self-auto justify-around sm:justify-start border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
              <div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">{overallScore}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Overall Score</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">{dimensionScores.length}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Dimensions</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">{session.responses.length}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Responses</p>
              </div>
            </div>
          </div>
          {session.user?.hobbiesSkills && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Candidate Notes</p>
              <p className="text-sm text-slate-600">{session.user.hobbiesSkills}</p>
            </div>
          )}
        </div>

        {/* Dimension Score Grid */}
        {dimensionScores.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5 sm:gap-3 mb-6">
              {dimensionScores.map((d) => (
                <div key={d.code} className="card-p text-center p-3 sm:p-4">
                  <div className="text-xl sm:text-2xl font-black text-slate-900 mb-1">{d.score}</div>
                  <div className="text-[10px] font-bold text-slate-900 leading-tight mb-1 truncate" title={d.name}>{d.name}</div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-2 truncate" title={d.category}>{d.category}</div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${d.score}%`,
                        background: d.score >= 80
                          ? "#10B981"
                          : d.score >= 60
                          ? "#3B82F6"
                          : d.score >= 40
                          ? "#F59E0B"
                          : "#EF4444",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <ReportCharts dimensionScores={dimensionScores} biometricData={biometricData} />
          </>
        ) : (
          <div className="card-p text-center py-16 text-slate-400 mb-6">
            <p className="text-base font-semibold">No dimension scores available</p>
            <p className="text-sm mt-1">This session may not be completed yet.</p>
          </div>
        )}

        {/* Response Log */}
        {session.responses.length > 0 && (
          <div className="table-wrapper mt-6">
            <div className="table-header">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Response Log</h2>
                <p className="text-xs text-slate-400 mt-0.5">{session.responses.length} answers recorded</p>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block w-full">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="th text-center" style={{ width: '5%' }}>#</th>
                    <th className="th" style={{ width: '50%' }}>Scenario</th>
                    <th className="th" style={{ width: '30%' }}>Selected Choice</th>
                    <th className="th text-center" style={{ width: '15%' }}>Time Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {((session.responses || []) as unknown as DBResponse[]).map((r) => (
                    <tr key={r.id} className="tr">
                      <td className="td text-xs font-bold text-slate-400 text-center">{r.scenario?.sequenceOrder ?? "—"}</td>
                      <td className="td">
                        <p className="text-xs text-slate-700 leading-relaxed max-w-full line-clamp-2" title={r.scenario?.narrativeText}>
                          {r.scenario?.narrativeText ?? "—"}
                        </p>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <span className="badge-blue text-xs font-bold px-2 py-0.5 shrink-0">{r.option?.optionCode}</span>
                          <span className="text-xs text-slate-600 truncate max-w-full" title={r.option?.optionText}>
                            {r.option?.optionText}
                          </span>
                        </div>
                      </td>
                      <td className="td text-xs text-slate-500 text-center font-medium">
                        {r.timeSpentMs ? `${Math.round(r.timeSpentMs / 1000)}s` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {((session.responses || []) as unknown as DBResponse[]).map((r, idx) => (
                <div key={r.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700">
                        #{r.scenario?.sequenceOrder ?? idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800">Scenario {r.scenario?.sequenceOrder ?? idx + 1}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <polyline points="12 6 12 12 16 14" strokeWidth="2"/>
                      </svg>
                      {r.timeSpentMs ? `${Math.round(r.timeSpentMs / 1000)}s` : "—"}
                    </span>
                  </div>

                  {r.scenario?.narrativeText && (
                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {r.scenario.narrativeText}
                    </p>
                  )}

                  <div className="flex items-start gap-2 bg-blue-50/60 border border-blue-100/80 p-2.5 rounded-xl">
                    <span className="badge-blue text-xs font-bold px-2 py-0.5 flex-shrink-0">
                      Option {r.option?.optionCode ?? "—"}
                    </span>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                      {r.option?.optionText ?? "No text recorded"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </>
  );
}
