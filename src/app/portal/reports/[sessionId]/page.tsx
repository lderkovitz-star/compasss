import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getClientSession } from '@/lib/portal-auth';
import PortalShell from '../../PortalShell';
import ScoringVersionNotice from '@/components/ScoringVersionNotice';
import ReportExportButtons from '@/components/ReportExportButtons';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PortalReportPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await getClientSession();
  if (!session) redirect('/portal');

  // The tenant filter is part of the lookup, not a check afterwards. A session
  // id belonging to another employer simply does not match, so it 404s the
  // same way a made-up id would - no signal that the report exists at all.
  const report = await prisma.assessmentSession.findFirst({
    where: {
      id: params.sessionId,
      clientAccountId: session.clientAccountId,
      kind: 'OFFICIAL',
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      traitScores: true,
      scoringVersion: true,
      user: { select: { name: true, email: true, targetRole: true } },
      package: { select: { name: true, code: true } },
      jobContext: { select: { title: true } },
      finalScores: {
        orderBy: { finalScore: 'desc' },
        select: {
          finalScore: true,
          percentileRank: true,
          exercised: true,
          scenariosScored: true,
          dimension: { select: { name: true, category: true } },
        },
      },
      responses: {
        orderBy: { submittedAt: 'asc' },
        select: {
          id: true,
          timeSpentMs: true,
          scenario: { select: { sequenceOrder: true, narrativeText: true } },
          option: { select: { optionCode: true, optionText: true } },
        },
      },
    },
  });

  if (!report) notFound();

  const scored = report.finalScores.filter((s) => s.exercised);
  // A dimension only one scenario could move is a single choice, not a
  // measurement. It is still shown, flagged, but kept out of the headline
  // average so one answer cannot swing the overall figure.
  const THIN_EVIDENCE = 3;
  const wellEvidenced = scored.filter((s) => s.scenariosScored >= THIN_EVIDENCE);
  const forAverage = wellEvidenced.length ? wellEvidenced : scored;
  const overall = forAverage.length
    ? Math.round(forAverage.reduce((sum, s) => sum + s.finalScore, 0) / forAverage.length)
    : null;
  const thinCount = scored.length - wellEvidenced.length;

  return (
    <PortalShell company={session.account.name}>
      <Link
        href="/portal/candidates"
        className="text-[13px] font-medium text-slate-600 hover:text-slate-900"
      >
        ← Candidate Ledger
      </Link>

      <div className="mt-4 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{report.user?.name ?? 'Unknown'}</h1>
            <p className="text-sm text-slate-600">{report.user?.email}</p>
            <p className="text-sm text-slate-600 mt-1">
              {report.jobContext?.title ?? report.user?.targetRole ?? 'No role specified'}
              {' · '}
              {report.package?.name}
            </p>
            <div className="mt-2">
              <ScoringVersionNotice version={report.scoringVersion} />
            </div>
          </div>
          <div className="flex items-start gap-5">
            {overall !== null && (
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900">{overall}</div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                  Overall
                </div>
              </div>
            )}
            <ReportExportButtons
              candidateName={report.user?.name ?? 'Candidate'}
              candidateEmail={report.user?.email ?? ''}
              targetRole={report.jobContext?.title ?? report.user?.targetRole ?? ''}
              packageName={report.package?.name ?? ''}
              overallScore={overall ?? 0}
              sessionId={report.id}
              status={report.status}
              startedAt={report.startedAt ? report.startedAt.toISOString() : null}
              completedAt={report.completedAt ? report.completedAt.toISOString() : null}
              dimensionScores={scored.map((s) => ({
                name: s.dimension.name,
                code: s.dimension.name,
                category: s.dimension.category,
                score: Math.round(s.finalScore),
                percentile: Math.round(s.percentileRank ?? 0),
              }))}
              responses={report.responses.map((r) => ({
                id: r.id,
                scenario: r.scenario,
                option: r.option,
                timeSpentMs: r.timeSpentMs,
              }))}
            />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-slate-500 text-xs">Status</div>
            <div className="text-slate-900 font-medium">{report.status.replace('_', ' ')}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Scenarios answered</div>
            <div className="text-slate-900 font-medium">{report.responses.length}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Started</div>
            <div className="text-slate-900 font-medium">
              {report.startedAt.toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Completed</div>
            <div className="text-slate-900 font-medium">
              {report.completedAt?.toLocaleDateString() ?? '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">
            Dimension profile
            <span className="ml-2 text-sm font-normal text-slate-500">
              {scored.length} dimension{scored.length === 1 ? '' : 's'} scored
            </span>
          </h2>
          {thinCount > 0 && wellEvidenced.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {thinCount} of these {thinCount === 1 ? 'is' : 'are'} drawn from fewer than{' '}
              {THIN_EVIDENCE} scenarios and {thinCount === 1 ? 'is' : 'are'} marked below. The
              overall figure uses the {wellEvidenced.length} with broader coverage.
            </p>
          )}
        </div>
        {scored.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No dimension scores recorded for this assessment.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {scored.map((s, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {s.dimension.name}
                    {s.scenariosScored > 0 && s.scenariosScored < THIN_EVIDENCE && (
                      <span
                        className="ml-2 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                        title={`Only ${s.scenariosScored} answered scenario${s.scenariosScored === 1 ? '' : 's'} could move this dimension, so treat it as indicative rather than measured.`}
                      >
                        {s.scenariosScored} scenario{s.scenariosScored === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{s.dimension.category}</div>
                </div>
                <div className="w-32 sm:w-48 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, s.finalScore))}%` }}
                  />
                </div>
                <div className="w-10 text-right text-sm font-semibold text-slate-900">
                  {Math.round(s.finalScore)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
