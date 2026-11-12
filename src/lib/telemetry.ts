import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { computeAndStoreScoreSnapshot, type DecisionEvent } from './scoring';

/**
 * Decision timing that the candidate's browser cannot shorten.
 *
 * The clock that counts is the server's: it starts when a scenario is first
 * served (recorded once, so a reload does not restart it) and stops when the
 * answer arrives. The browser still measures with performance.now() - active
 * time, time with the tab hidden, tab switches - and sends tab changes the
 * moment they happen. Those measurements are kept beside the server's and
 * used to raise flags when the two disagree; they never shorten a decision.
 */

// What a page may report. 'unload' is the page itself going away (reload,
// closed tab, navigating off), which is not a tab switch.
export const TAB_EVENT_TYPES = ['hidden', 'visible', 'blur', 'focus', 'unload'] as const;
export type TabEventType = (typeof TAB_EVENT_TYPES)[number];

// Written by the server each time it serves the scenario; never accepted from
// a page. A serve after the page went away is the candidate coming back.
const SERVE_EVENT = 'serve';

/** What the browser measured for one scenario. */
export type ClientTiming = {
  activeMs?: number;
  hiddenMs?: number;
  tabSwitches?: number;
  focusLosses?: number;
};

export type TimingFlag =
  | 'left_tab' // the tab was hidden at least once
  | 'lost_focus' // another window took focus while the tab stayed visible
  | 'reloaded' // the scenario was served more than once
  | 'timing_mismatch' // the browser's own total disagrees with the server clock
  | 'tab_events_missing' // the browser counted tab changes the server never received
  | 'no_client_timing' // the page sent no measurements of its own
  | 'no_server_start'; // served before server-side timing existed

export type DecisionTiming = {
  /** What scoring and reports use. */
  timeSpentMs: number;
  startedAt: Date;
  serverElapsedMs: number | null;
  /** Time with the tab hidden (switched away), not counting reloads. */
  hiddenMs: number;
  tabSwitches: number;
  focusLosses: number;
  /** Time the page was gone between leaving it and being served it again. */
  leftPageMs: number;
  serveCount: number | null;
  flags: TimingFlag[];
  client: ClientTiming | null;
};

// What sits between the two clocks and is nobody's decision time: the
// scenario's trip to the browser, rendering, and the answer's trip back.
const CLOCK_SLACK_MS = 3000;
const CLOCK_SLACK_RATIO = 0.2;
const MAX_INT = 2_147_483_647;
const MAX_EVENTS_PER_SCENARIO = 200;
const MAX_EVENTS_PER_REQUEST = 20;

function ms(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.min(MAX_INT, Math.round(value));
}

/** Keeps only sane, non-negative numbers from whatever the page sent. */
export function cleanClientTiming(value: unknown): ClientTiming | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const clean: ClientTiming = {
    activeMs: ms(v.activeMs),
    hiddenMs: ms(v.hiddenMs),
    tabSwitches: ms(v.tabSwitches),
    focusLosses: ms(v.focusLosses),
  };
  return Object.values(clean).some((x) => x !== undefined) ? clean : null;
}

/**
 * Works out how long a decision took and what happened meanwhile. Pure, so the
 * rules can be checked without a database (scripts/test-telemetry.ts).
 */
export function measureDecision(input: {
  firstServedAt: Date | null;
  serveCount: number | null;
  receivedAt: Date;
  events: { type: string; receivedAt: Date; clientAtMs?: number | null }[];
  client: ClientTiming | null;
  legacyTimeSpentMs?: number | null;
}): DecisionTiming {
  const flags = new Set<TimingFlag>();
  const end = input.receivedAt.getTime();
  const client = input.client;

  // Hidden time and tab switches from events the server received as they
  // happened, on the server's clock.
  const events = [...input.events].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || (a.clientAtMs ?? 0) - (b.clientAtMs ?? 0)
  );
  let serverHiddenMs = 0;
  let leftPageMs = 0;
  let serverSwitches = 0;
  let serverFocusLosses = 0;
  // The absence in progress: the tab hidden, or the page gone altogether.
  let away: { since: number; kind: 'hidden' | 'unload' } | null = null;
  const endAway = (t: number) => {
    if (!away) return;
    const span = Math.max(0, t - away.since);
    if (away.kind === 'hidden') serverHiddenMs += span;
    else leftPageMs += span;
    away = null;
  };
  for (const e of events) {
    const t = e.receivedAt.getTime();
    switch (e.type) {
      case 'hidden':
        if (!away) {
          away = { since: t, kind: 'hidden' };
          serverSwitches += 1;
        }
        break;
      case 'unload':
        // The page itself going away. A hidden event just before it was this,
        // not a tab switch (some browsers report hidden first).
        if (!away) {
          away = { since: t, kind: 'unload' };
        } else if (away.kind === 'hidden') {
          away.kind = 'unload';
          serverSwitches -= 1;
        }
        break;
      case 'visible':
        endAway(t);
        break;
      case SERVE_EVENT:
        // Served again: the candidate came back by reloading or reopening.
        // Whatever was open was the page going away, not a tab switch.
        if (away && away.kind === 'hidden') {
          away.kind = 'unload';
          serverSwitches -= 1;
        }
        endAway(t);
        break;
      case 'blur':
        serverFocusLosses += 1;
        break;
    }
  }
  if (away) {
    // The page answered, so it was back on screen, but that event never came.
    endAway(end);
    flags.add('tab_events_missing');
  }

  // Either source can show a switch; the larger count is the one reported.
  const tabSwitches = Math.max(serverSwitches, client?.tabSwitches ?? 0);
  const focusLosses = Math.max(serverFocusLosses, client?.focusLosses ?? 0);
  const hiddenMs = Math.min(MAX_INT, Math.max(serverHiddenMs, client?.hiddenMs ?? 0));
  if (tabSwitches > 0) flags.add('left_tab');
  if (focusLosses > 0) flags.add('lost_focus');
  if ((client?.tabSwitches ?? 0) > serverSwitches) flags.add('tab_events_missing');
  if (!client) flags.add('no_client_timing');

  if (input.firstServedAt) {
    const serverElapsedMs = Math.min(MAX_INT, Math.max(0, end - input.firstServedAt.getTime()));
    if ((input.serveCount ?? 1) > 1) {
      // A reload restarts the page's own clock, so a mismatch is expected.
      flags.add('reloaded');
    } else if (client?.activeMs !== undefined) {
      const clientTotal = client.activeMs + (client.hiddenMs ?? 0);
      const slack = Math.max(CLOCK_SLACK_MS, serverElapsedMs * CLOCK_SLACK_RATIO);
      if (Math.abs(serverElapsedMs - clientTotal) > slack) flags.add('timing_mismatch');
    }
    return {
      timeSpentMs: serverElapsedMs,
      startedAt: input.firstServedAt,
      serverElapsedMs,
      hiddenMs,
      tabSwitches,
      focusLosses,
      leftPageMs: Math.min(MAX_INT, leftPageMs),
      serveCount: input.serveCount,
      flags: Array.from(flags),
      client,
    };
  }

  // Served before scenarios were timed on the server (a sitting that spans
  // the deploy). Fall back to the browser's figure and say so.
  flags.add('no_server_start');
  const fallback =
    client?.activeMs !== undefined ? client.activeMs + (client.hiddenMs ?? 0) : (input.legacyTimeSpentMs ?? 0);
  const timeSpentMs = Math.min(MAX_INT, Math.max(0, Math.round(fallback)));
  return {
    timeSpentMs,
    startedAt: new Date(end - timeSpentMs),
    serverElapsedMs: null,
    hiddenMs,
    tabSwitches,
    focusLosses,
    leftPageMs: Math.min(MAX_INT, leftPageMs),
    serveCount: input.serveCount,
    flags: Array.from(flags),
    client,
  };
}

/**
 * Starts the decision clock for a scenario the first time it is served. Later
 * serves (a reload, a second tab) leave the start where it was and are counted.
 */
export async function markScenarioServed(sessionId: string, scenarioId: string): Promise<void> {
  const now = new Date();
  const where = { sessionId_scenarioId: { sessionId, scenarioId } };
  const update = { lastServedAt: now, serveCount: { increment: 1 } };
  try {
    await prisma.scenarioView.upsert({
      where,
      create: { sessionId, scenarioId, firstServedAt: now, lastServedAt: now },
      update,
    });
  } catch (error) {
    // Two first serves at once: one insert wins, the other is just a serve.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    await prisma.scenarioView.update({ where, data: update });
  }
  // Each serve is also an event, so a reload shows up in the timeline exactly
  // where it happened and ends the absence that came before it.
  await prisma.telemetryEvent.create({
    data: { sessionId, scenarioId, type: SERVE_EVENT, receivedAt: now },
  });
}

/**
 * Stores tab and focus events for the scenario currently on screen, stamped
 * with the server's clock. Ignored for a scenario that was never served or is
 * already answered, and capped per scenario so a page cannot flood the table.
 */
export async function recordTabEvents(sessionId: string, scenarioId: string, events: unknown[]): Promise<number> {
  const valid = events
    .slice(0, MAX_EVENTS_PER_REQUEST)
    .filter(
      (e): e is { type: TabEventType; atMs?: unknown } =>
        !!e && typeof e === 'object' && TAB_EVENT_TYPES.includes((e as { type?: unknown }).type as TabEventType)
    );
  if (valid.length === 0) return 0;

  const [session, view, answered, stored] = await Promise.all([
    prisma.assessmentSession.findUnique({ where: { id: sessionId }, select: { status: true } }),
    prisma.scenarioView.findUnique({ where: { sessionId_scenarioId: { sessionId, scenarioId } }, select: { id: true } }),
    prisma.response.findFirst({ where: { sessionId, scenarioId }, select: { id: true } }),
    // The cap is on what pages send; the server's own serve events don't count.
    prisma.telemetryEvent.count({ where: { sessionId, scenarioId, type: { not: SERVE_EVENT } } }),
  ]);
  if (!session || session.status === 'COMPLETED' || !view || answered) return 0;

  const room = Math.max(0, MAX_EVENTS_PER_SCENARIO - stored);
  const receivedAt = new Date();
  const rows = valid.slice(0, room).map((e) => ({
    sessionId,
    scenarioId,
    type: e.type,
    clientAtMs: ms(e.atMs) ?? null,
    receivedAt,
  }));
  if (rows.length === 0) return 0;
  await prisma.telemetryEvent.createMany({ data: rows });
  return rows.length;
}

export type AnswerOutcome = { duplicate: true } | { duplicate: false; timing: DecisionTiming };

/**
 * Stores one answer, timed by the server, exactly once.
 *
 * The session row is locked for the duration, so two copies of the same answer
 * (a retry after a dropped connection, a second tab) cannot both pass the
 * "already answered?" check: the second waits, then sees the first and is
 * reported as a duplicate. Before, both were stored and progress moved twice.
 */
export async function recordAnswer(args: {
  sessionId: string;
  scenarioId: string;
  optionId: string;
  clientEventId: string | null;
  client: ClientTiming | null;
  legacyTimeSpentMs: number | null;
  decisionPath?: DecisionEvent[];
}): Promise<AnswerOutcome> {
  const receivedAt = new Date();
  const { sessionId, scenarioId, optionId, clientEventId } = args;

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "assessment_sessions" WHERE id = ${sessionId} FOR UPDATE`;

      const already = await tx.response.findFirst({
        where: {
          OR: [{ sessionId, scenarioId }, ...(clientEventId ? [{ clientEventId }] : [])],
        },
        select: { id: true },
      });
      if (already) return { duplicate: true } as const;

      const [view, events] = await Promise.all([
        tx.scenarioView.findUnique({ where: { sessionId_scenarioId: { sessionId, scenarioId } } }),
        tx.telemetryEvent.findMany({
          where: { sessionId, scenarioId },
          select: { type: true, receivedAt: true, clientAtMs: true },
        }),
      ]);

      const timing = measureDecision({
        firstServedAt: view?.firstServedAt ?? null,
        serveCount: view?.serveCount ?? null,
        receivedAt,
        events,
        client: args.client,
        legacyTimeSpentMs: args.legacyTimeSpentMs,
      });

      await computeAndStoreScoreSnapshot(
        sessionId,
        scenarioId,
        optionId,
        timing.timeSpentMs,
        args.decisionPath,
        {
          startedAt: timing.startedAt,
          clientEventId,
          serverElapsedMs: timing.serverElapsedMs,
          hiddenMs: timing.hiddenMs,
          tabSwitches: timing.tabSwitches,
          telemetry: {
            flags: timing.flags,
            focusLosses: timing.focusLosses,
            leftPageMs: timing.leftPageMs,
            serveCount: timing.serveCount,
            client: timing.client,
          } as Prisma.InputJsonValue,
        },
        tx
      );

      await tx.assessmentSession.update({
        where: { id: sessionId },
        data: { currentScenarioIdx: { increment: 1 } },
      });

      return { duplicate: false, timing } as const;
    },
    { maxWait: 10_000, timeout: 20_000 }
  );
}
