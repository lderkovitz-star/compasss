import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';
import { tierSingleCandidate, batchTierCandidates } from '@/lib/ai-sorter';

export const dynamic = 'force-dynamic';
// A batch run makes one provider call per candidate.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Each call costs money at the provider, so this is not something the
  // read-only ASSESSOR role may trigger.
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();

    if (body.batch) {
      // Batch tier all pending candidates
      const result = await batchTierCandidates();
      return NextResponse.json(result);
    }

    if (body.sessionId) {
      // Single candidate tier
      const evaluation = await tierSingleCandidate(body.sessionId);
      return NextResponse.json({ evaluation });
    }

    return NextResponse.json({ error: 'Provide sessionId or batch: true' }, { status: 400 });
  } catch (err) {
    console.error('[ai tier-candidates]', err);
    const message = err instanceof Error ? err.message : 'AI tiering failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
