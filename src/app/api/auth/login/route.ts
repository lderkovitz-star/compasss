import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required.' }, { status: 400 });
    }
    if (!(await validateCredentials(email, password))) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }
    const token = signToken(email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
