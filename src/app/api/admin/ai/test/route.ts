import { NextResponse } from 'next/server';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';
import { testAnthropicConnection } from '@/lib/ai-sorter';

export const dynamic = 'force-dynamic';

// Spends a (tiny) paid API call, so it needs the same role as changing the key.
export async function POST() {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  // A failed test is a result, not a server error: always 200 with { ok }.
  return NextResponse.json(await testAnthropicConnection());
}
