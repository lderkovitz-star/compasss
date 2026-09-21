import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import { tierSingleCandidate, batchTierCandidates } from '@/lib/ai-sorter';

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
