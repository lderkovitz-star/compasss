import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { testProvider } from '@/lib/ai/evaluate';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Makes one cheap call to the provider and reports what came back.
 *
 * Without this, a wrong key or a mistyped model id is only discovered when a
 * candidate's evaluation fails, long after whoever typed it has moved on.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const key = body && typeof body.key === 'string' ? body.key.trim() : '';
  if (!key) {
    return NextResponse.json({ error: 'Which provider?' }, { status: 400 });
  }

  const result = await testProvider(key);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
