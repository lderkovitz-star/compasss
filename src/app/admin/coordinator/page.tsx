import { prisma } from '@/lib/db';
import CoordinatorClient from './CoordinatorClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getCoordinatorData() {
  const sessions = await prisma.assessmentSession.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    include: {
      user: {
        select: { id: true, name: true, email: true, targetRole: true },
      },
      package: {
        select: { name: true, code: true },
      },
      responses: {
        select: {
          timeSpentMs: true,
          submittedAt: true,
          decisionPath: true,
          option: {
            select: { optionCode: true, optionText: true },
          },
          scenario: {
            select: { sequenceOrder: true, narrativeText: true },
          },
        },
        orderBy: { submittedAt: 'asc' },
      },
    },
  });

  return sessions;
}

export default async function CoordinatorPage() {
  const sessions = await getCoordinatorData();

  const sessionData = sessions.map(s => {
    const traitScores = (s.traitScores as any) ?? null;
    const humanOverrides = (s.humanOverrides as any) ?? {};
    const aiEvaluation = (s.aiEvaluation as any) ?? null;

    const totalTimeMs = s.responses.reduce((sum, r) => sum + r.timeSpentMs, 0);
    const avgLatencyMs = s.responses.length > 0
      ? Math.round(totalTimeMs / s.responses.length)
      : 0;

    const totalSwitches = s.responses.reduce((sum, r) => {
      const path = (r.decisionPath as Array<{ event: string }> | null) ?? [];
      return sum + path.filter(e => e.event === 'revisit').length;
    }, 0);

    return {
      sessionId: s.id,
      candidate: s.user,
      package: s.package,
      completedAt: s.completedAt?.toISOString() ?? '',
      traitScores,
      humanOverrides,
      aiEvaluation,
      avgLatencyMs,
      totalSwitches,
      responseCount: s.responses.length,
      responses: s.responses.map(r => ({
        scenarioOrder: r.scenario?.sequenceOrder ?? 0,
        selectedOption: r.option?.optionCode ?? '',
        timeSpentMs: r.timeSpentMs,
        decisionPath: (r.decisionPath as any[]) ?? [],
      })),
    };
  });

  return (
    <main className="page-content flex-1 h-[calc(100vh-64px)] sm:h-[calc(100vh-72px)] flex flex-col min-h-0">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">Coordinator View</h1>
        <p className="text-sm text-slate-500 mt-1">
          Per-candidate scoring, latency, decision paths, and AI tiering. Human overrides available on all trait scores.
        </p>
      </div>
      <CoordinatorClient sessions={sessionData} />
    </main>
  );
}
