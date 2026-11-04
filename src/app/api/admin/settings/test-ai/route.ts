import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Checks the *saved* Anthropic key - the one an evaluation will actually use -
 * against Anthropic's models endpoint. Listing models costs nothing and needs
 * no prompt, so pressing Test never spends credits.
 */
export async function POST() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const settings = await prisma.platformSettings.findFirst({
    select: { anthropicApiKey: true },
  });
  const apiKey = settings?.anthropicApiKey;
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: 'No API key is saved yet. Save a key first.' });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      return NextResponse.json({ ok: true, message: 'Connected. Anthropic accepted the saved key.' });
    }

    const reasons: Record<number, string> = {
      401: 'Anthropic rejected the key. Check that it was copied correctly and has not been revoked.',
      403: 'The key is valid but does not have permission to use the API.',
      429: 'The key works, but Anthropic is rate limiting it right now. Try again shortly.',
    };
    const message =
      reasons[res.status] ??
      (res.status >= 500
        ? `Anthropic is having problems (HTTP ${res.status}). Try again in a few minutes.`
        : `Anthropic returned HTTP ${res.status}.`);
    return NextResponse.json({ ok: false, message });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    console.error('AI connection test failed:', error);
    return NextResponse.json({
      ok: false,
      message: timedOut
        ? 'Anthropic did not answer within 10 seconds. Check the server can reach api.anthropic.com.'
        : 'Could not reach Anthropic. Check the server has internet access.',
    });
  }
}
