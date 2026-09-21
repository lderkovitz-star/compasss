import { NextRequest, NextResponse } from 'next/server';

// Middleware runs in Edge Runtime — Web Crypto API available.
// We verify HMAC cookie signature here for ALL /admin/* and /api/admin/* requests.
const COOKIE_NAME = 'ce_admin_session';
const AUTH_SECRET = process.env.AUTH_SECRET;
if (process.env.NODE_ENV === 'production' && !AUTH_SECRET) {
  throw new Error('AUTH_SECRET must be set in production');
}
const SECRET = AUTH_SECRET || 'fallback-secret-key';

async function verifyHmacToken(token: string): Promise<boolean> {
  try {
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return false;

    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);

    const keyData = new TextEncoder().encode(SECRET);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const payloadData = new TextEncoder().encode(payload);
    const expectedSigBuf = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
    const expectedSig = Array.from(new Uint8Array(expectedSigBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Timing-safe comparison
    if (sig.length !== expectedSig.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rewrite /admin/login to the actual login page route
  if (pathname === '/admin/login') {
    return NextResponse.rewrite(new URL('/admin-login', req.url));
  }

  // Protect ALL /admin/* routes (except /admin/login itself)
  const isAdminPage = pathname.startsWith('/admin') && !pathname.startsWith('/admin/login');
  // Protect ALL /api/admin/* routes
  const isAdminApi = pathname.startsWith('/api/admin');

  if (isAdminPage || isAdminApi) {
    const token = req.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Cryptographically verify the HMAC signature
    const valid = await verifyHmacToken(token);
    if (!valid) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
