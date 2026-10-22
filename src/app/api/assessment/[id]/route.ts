import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeAndStoreScoreSnapshot, computeFinalScores, DecisionEvent } from '@/lib/scoring';
import { resolveScenarioOrder, loadScenariosInOrder } from '@/lib/session-scenarios';
import { getGlobalSettings } from '@/lib/settings';
import { recordRegistryEntry } from '@/lib/talent-registry';
import { queueEmail } from '@/lib/email';

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
      // A practice run has no employer and no evaluator - the person who took
      // it is the one who wanted the result, so they see it.
      return NextResponse.json(
        {
          redirect:
            session.kind === 'PRACTICE'
              ? `/practice/results/${sessionId}`
              : `/assessment/complete?session=${sessionId}`,
        },
        { status: 200 }
      );
    }

    // Fixed on first use and read back afterwards, so editing the pack does
    // not change what a candidate part-way through is served. Trashed
    // scenarios are excluded when the list is first chosen - that filter was
    // missing, so they were being served to live candidates.
    const order = await resolveScenarioOrder(session);
    const scenarios = await loadScenariosInOrder(order);

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

    // Was that the last one? Counted from the same frozen list the GET side
    // serves, or the two can disagree - and if this side thinks there are
    // more, the candidate is asked for answers that never arrive and the
    // sitting never completes.
    const totalScenarios = (await resolveScenarioOrder(session)).length;
    const answeredCount = await prisma.response.count({ where: { sessionId } });

    if (answeredCount >= totalScenarios) {
      await computeFinalScores(sessionId);

      if (session.kind === 'PRACTICE') {
        // Nobody is waiting on a practice result, so there is nothing to
        // notify about. If the person asked to join the registry, that entry
        // is the one thing their run leaves behind.
        if (session.registryOptIn) {
          await recordRegistryEntry(sessionId);
        }
      } else {
        await prisma.notification.create({
          data: {
            title: 'Assessment Completed',
            message: `${session.user?.name || 'A candidate'} has completed the ${session.package?.name || 'Assessment'} simulation.`,
            linkUrl: session.clientAccountId ? `/employer/reports/${sessionId}` : `/admin/reports/${sessionId}`,
            clientAccountId: session.clientAccountId,
            audience: session.clientAccountId ? 'CLIENT' : 'PLATFORM',
          }
        });

        // The platform-wide registry covers real sittings across every tenant.
        await recordRegistryEntry(sessionId);

        // Tell the employer their report is ready. Queued rather than sent for
        // as long as the sending domain is unverified; the in-app notification
        // above is what they actually see meanwhile.
        if (session.clientAccountId) {
          const account = await prisma.clientAccount.findUnique({
            where: { id: session.clientAccountId },
            select: { name: true, contactEmail: true },
          });
          if (account?.contactEmail) {
            await queueEmail({
              template: 'REPORT_READY',
              to: account.contactEmail,
              clientAccountId: session.clientAccountId,
              data: {
                candidateName: session.user?.name ?? 'A candidate',
                companyName: account.name,
                roleTitle: session.user?.targetRole ?? '',
                url: `/employer/reports/${sessionId}`,
              },
            });
          }
        }
      }

      return NextResponse.json({
        completed: true,
        redirect:
          session.kind === 'PRACTICE'
            ? `/practice/results/${sessionId}`
            : `/assessment/complete?session=${sessionId}`,
      });
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
