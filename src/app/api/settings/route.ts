import { NextResponse } from 'next/server';
import { getGlobalSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    const settings = await getGlobalSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching global settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
