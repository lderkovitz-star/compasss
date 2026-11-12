import { NextRequest, NextResponse } from 'next/server';
import { recordTabEvents } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

/**
 * Tab and focus changes from the assessment page, sent the moment they happen
 * (navigator.sendBeacon, which still delivers while a page is being hidden).
 * Each is stamped with the server's clock on arrival, so an answer's tab
 * record comes from here rather than from what the page reports afterwards.
 *
 * Always answers 204: a beacon's response is never read, and a page that
 * sends something odd gains nothing from being told why it was dropped.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const scenarioId = typeof body?.scenarioId === 'string' ? body.scenarioId : '';
  const events: unknown[] = Array.isArray(body?.events) ? body.events : [];

  if (scenarioId && events.length > 0) {
    try {
      await recordTabEvents(params.id, scenarioId, events);
    } catch (error) {
      console.error('[assessment telemetry]', error);
    }
  }
  return new NextResponse(null, { status: 204 });
}
