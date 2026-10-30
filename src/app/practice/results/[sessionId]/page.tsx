import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getPublicSettings } from '@/lib/settings';
import PracticeResultCharts from './PracticeResultCharts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * What someone sees after a practice run.
 *
 * A practice run has no employer and no evaluator - the person who took it is
 * the one who wanted the result. Sending them to the candidate completion
 * screen, which exists to withhold scores from candidates on behalf of an
 * employer, withheld them from the only person entitled to see them.
 *
 * The lookup is restricted to PRACTICE sittings. An official one belongs to an
 * employer and is reached through their portal, behind their sign-in; it must
 * never be readable from here just because someone has the id.
 */
export default async function PracticeResultsPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const [settings, session] = await Promise.all([
    getPublicSettings(),
    prisma.assessmentSession.findFirst({
      where: { id: params.sessionId, kind: 'PRACTICE' },
      select: {
        id: true,
        status: true,
        completedAt: true,
        practiceName: true,
        practiceJobText: true,
        registryOptIn: true,
        purgeAfter: true,
        package: { select: { name: true } },
        finalScores: {
          orderBy: { finalScore: 'desc' },
          select: {
            finalScore: true,
            exercised: true,
            scenariosScored: true,
            dimension: { select: { name: true, category: true } },
          },
        },
        responses: { select: { timeSpentMs: true, decisionPath: true } },
      },
    }),
  ]);

  if (!session) notFound();

  if (session.status !== 'COMPLETED') {
    return (
      <main className="min-h-screen bg-[#0B1220] text-[#F3F5FA] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-white">This run is not finished</h1>
          <p className="text-[14px] text-[#97A2BE] mt-2">
            Go back and answer the remaining scenarios, and the result will appear here.
          </p>
          <Link href={`/assessment/${session.id}`} className="inline-block mt-5 text-[13px] font-semibold text-[#5B8CFF]">
            Continue the run
          </Link>
        </div>
      </main>
    );
  }

  const scored = session.finalScores.filter((s) => s.exercised);
  const THIN = 3;
  const wellEvidenced = scored.filter((s) => s.scenariosScored >= THIN);
  const forAverage = wellEvidenced.length ? wellEvidenced : scored;
  const overall = forAverage.length
    ? Math.round(forAverage.reduce((sum, s) => sum + s.finalScore, 0) / forAverage.length)
    : null;
  const thin = scored.length - wellEvidenced.length;

  const avgMs = session.responses.length
    ? Math.round(session.responses.reduce((sum, r) => sum + r.timeSpentMs, 0) / session.responses.length)
    : 0;
  const revisits = session.responses.reduce((sum, r) => {
    const path = (r.decisionPath as { event?: string }[] | null) ?? [];
    return sum + path.filter((e) => e.event === 'revisit').length;
  }, 0);

  return (
    <main className="min-h-screen bg-[#0B1220] text-[#F3F5FA] px-4 py-10 sm:py-14">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-[13px] font-medium text-[#97A2BE] hover:text-white">
          ← {settings.platformName}
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Your practice result
            </h1>
            <p className="mt-2 text-[14px] text-[#97A2BE]">
              {session.practiceName ? `${session.practiceName} · ` : ''}
              {session.package?.name} · {session.responses.length} scenario
              {session.responses.length === 1 ? '' : 's'} answered
            </p>
          </div>
          {overall !== null && (
            <div className="text-right">
              <div className="text-4xl font-bold text-white">{overall}</div>
              <div className="text-[11px] uppercase tracking-wider text-[#5B6580] font-semibold">
                Overall
              </div>
            </div>
          )}
        </div>

        {scored.length === 0 ? (
          <p className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5 text-[14px] text-[#97A2BE]">
            No dimension could be scored from this run.
          </p>
        ) : (
          <>
            <PracticeResultCharts
              dimensions={scored.map((s) => ({
                name: s.dimension.name,
                score: Math.round(s.finalScore),
                scenariosScored: s.scenariosScored,
              }))}
            />

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="font-semibold text-white">Dimension profile</h2>
                {thin > 0 && wellEvidenced.length > 0 && (
                  <p className="mt-1 text-xs text-[#97A2BE]">
                    {thin} of these came from fewer than {THIN} scenarios and are marked. The overall
                    figure uses the {wellEvidenced.length} with broader coverage.
                  </p>
                )}
              </div>
              <div className="divide-y divide-white/5">
                {scored.map((s, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">
                        {s.dimension.name}
                        {s.scenariosScored > 0 && s.scenariosScored < THIN && (
                          <span
                            className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#97A2BE]"
                            title={`Only ${s.scenariosScored} scenario could move this, so treat it as indicative.`}
                          >
                            {s.scenariosScored} scenario{s.scenariosScored === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#5B6580]">{s.dimension.category}</div>
                    </div>
                    <div className="w-28 sm:w-44 bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-[#35E0C8] rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, s.finalScore))}%` }}
                      />
                    </div>
                    <div className="w-9 text-right text-sm font-semibold text-white">
                      {Math.round(s.finalScore)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Average per decision', value: `${(avgMs / 1000).toFixed(1)}s` },
            { label: 'Option revisits', value: String(revisits) },
            {
              label: 'Kept until',
              value: session.registryOptIn
                ? 'Kept — you joined the registry'
                : session.purgeAfter
                  ? session.purgeAfter.toLocaleDateString()
                  : '—',
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-lg font-semibold text-white">{stat.value}</div>
              <div className="text-[11px] uppercase tracking-wide text-[#5B6580] mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-[#5B6580]">
          This was a practice run. It belongs to no employer and appears in no company&apos;s
          candidate list.
          {session.registryOptIn
            ? ' You asked to join the talent registry, so it has been kept.'
            : ' It is deleted automatically on the date above.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/practice"
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-[#2E63F6] text-white hover:bg-[#5B8CFF] transition-colors"
          >
            Run another
          </Link>
        </div>
      </div>
    </main>
  );
}
