import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Public registration is disabled. Please contact your Super Administrator.' },
    { status: 403 }
  );
}
