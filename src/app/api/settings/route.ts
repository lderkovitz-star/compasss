import { NextResponse } from 'next/server';
import { getPublicSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * Public branding only. This route is reachable without authentication, so it
 * must never return the whole PlatformSettings row — that row holds the AI
 * provider key and the prompt template.
 */
export async function GET() {
  try {
    return NextResponse.json(await getPublicSettings());
  } catch (error) {
    console.error('Error fetching public settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
