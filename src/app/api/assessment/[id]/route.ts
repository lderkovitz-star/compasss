import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeAndStoreScoreSnapshot, computeFinalScores, DecisionEvent } from '@/lib/scoring';
import { getGlobalSettings } from '@/lib/settings';

// GET — fetch current blind scenario (no scores, no dimension data)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;

  try {
    const session = await prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      include: { package: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    if (session.status === 'COMPLETED') {
      return NextResponse.json(
        { redirect: `/assessment/complete?session=${sessionId}` },
        { status: 200 }
      );
    }

    // Get scenarios in order
    const scenarios = await prisma.scenario.findMany({
      where: { packageId: session.packageId },
      orderBy: { sequenceOrder: 'asc' },
      include: {
        options: {
          select: { id: true, optionCode: true, optionText: true },
          orderBy: { optionCode: 'asc' },
        },
      },
    });

    if (scenarios.length === 0) {
      return NextResponse.json({ error: 'No scenarios found for this package.' }, { status: 404 });
    }

    // Get already answered scenario IDs
    const answeredResponses = await prisma.response.findMany({
      where: { sessionId },
      select: { scenarioId: true },
    });
    const answeredIds = new Set(answeredResponses.map(r => r.scenarioId));

    // Find next unanswered scenario
    const nextScenario = scenarios.find(s => !answeredIds.has(s.id));

    if (!nextScenario) {
      // All answered — finalize
      await computeFinalScores(sessionId);
      return NextResponse.json(
        { redirect: `/assessment/complete?session=${sessionId}` },
        { status: 200 }
      );
    }

    const settings = await getGlobalSettings();

    // ⚠️ BLIND UI RULE: return ONLY narrative text, options, timer, total count — NO scores, NO dimensions
    return NextResponse.json({
      id: nextScenario.id,
      sequenceOrder: nextScenario.sequenceOrder,
      narrativeText: nextScenario.narrativeText,
      timeLimitSec: nextScenario.timeLimitSec,
      totalScenarios: scenarios.length,
      // Backdrop for swappable visual layer (scenario-level override, package-level, or platform default)
      backdropImageUrl: nextScenario.backdropImageUrl ?? session.package.backdropImageUrl ?? (settings as any).defaultBackdropUrl ?? null,
      options: nextScenario.options.map(o => ({
        id: o.id,
        optionCode: o.optionCode,
        optionText: o.optionText,
        // ⛔ NO weight scores, NO dimension data, NO scoring metadata
      })),
      platformSettings: {
        antiCheat: settings.antiCheat,
        blindUiMode: settings.blindUiMode,
      },
    });
  } catch (err) {
    console.error('[assessment GET]', err);
    return NextResponse.json({ error: 'Failed to load scenario.' }, { status: 500 });
  }
}

// POST — submit answer with telemetry (purely server-side scoring, never exposes scores back)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id;

  try {
    const body = await req.json();
    const { optionId, timeSpentMs, decisionPath } = body as {
      optionId: string;
      timeSpentMs: number;
      decisionPath?: DecisionEvent[];
    };

    if (!optionId) {
      return NextResponse.json({ error: 'optionId is required.' }, { status: 400 });
    }

    // Verify session exists and is in progress
    const session = await prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      include: { user: true, package: true }
    });
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    if (session.status === 'COMPLETED') return NextResponse.json({ completed: true });

    // Verify option belongs to a scenario in this session's package
    const option = await prisma.scenarioOption.findUnique({
      where: { id: optionId },
      include: { scenario: true },
    });
    if (!option || option.scenario.packageId !== session.packageId) {
      return NextResponse.json({ error: 'Invalid option for this session.' }, { status: 400 });
    }

    // Ensure we don't already have a response for this scenario to prevent duplicates
    const existingResponse = await prisma.response.findFirst({
      where: { sessionId, scenarioId: option.scenarioId }
    });
    
    if (existingResponse) {
      // Race condition caught: quietly accept to avoid crashing frontend, but don't duplicate
      return NextResponse.json({ success: true, duplicateIgnored: true });
    }

    // Run server-side scoring with full telemetry capture
    // Scores NEVER returned to client
    await computeAndStoreScoreSnapshot(
      sessionId,
      option.scenarioId,
      optionId,
      timeSpentMs || 0,
      decisionPath
    );

    // Update session progress
    await prisma.assessmentSession.update({
      where: { id: sessionId },
      data: { currentScenarioIdx: { increment: 1 } },
    });

    // Check if this was the last scenario
    const totalScenarios = await prisma.scenario.count({ where: { packageId: session.packageId } });
    const answeredCount = await prisma.response.count({ where: { sessionId } });

    if (answeredCount >= totalScenarios) {
      await computeFinalScores(sessionId);

      // Create a notification for admins
      await prisma.notification.create({
        data: {
          title: 'Assessment Completed',
          message: `${session.user?.name || 'A candidate'} has completed the ${session.package?.name || 'Assessment'} simulation.`,
          linkUrl: `/admin/reports/${sessionId}`,
        }
      });

      return NextResponse.json({ completed: true });
    }

    // ⚠️ BLIND UI RULE: Return only progress, never scores
    return NextResponse.json({
      completed: false,
      answeredCount,
      totalScenarios,
    });
  } catch (err) {
    console.error('[assessment POST]', err);
    return NextResponse.json({ error: 'Failed to submit answer.' }, { status: 500 });
  }
}
