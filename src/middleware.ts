import { NextRequest, NextResponse } from 'next/server';

// Middleware runs in Edge Runtime — Web Crypto API available.
// We verify HMAC cookie signature here for ALL /admin/* and /api/admin/* requests.
const COOKIE_NAME = 'ce_admin_session';
const AUTH_SECRET = process.env.AUTH_SECRET;
if (process.env.NODE_ENV === 'production' && !AUTH_SECRET) {
  throw new Error('AUTH_SECRET must be set in production');
}
const SECRET = AUTH_SECRET || 'fallback-secret-key';
// Must match COOKIE_MAX_AGE in src/lib/auth.ts (8 hours).
const COOKIE_MAX_AGE_MS = 60 * 60 * 8 * 1000;
// Employer portal cookie. Deliberately separate from the admin one - see
// src/lib/portal-auth.ts.
const CLIENT_COOKIE = 'cmp_client';

/**
 * Signature and expiry only. The payload is JSON here rather than the admin
 * cookie's `email:timestamp`, so it needs its own reader.
 */
async function verifyClientToken(token: string): Promise<boolean> {
  try {
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return false;

    const json = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);

    const keyData = new TextEncoder().encode(SECRET);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const expectedBuf = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(json));
    const expected = Array.from(new Uint8Array(expectedBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return false;

    const payload = JSON.parse(json) as { aud?: string; exp?: number };
    return payload.aud === 'client' && typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

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
    if (diff !== 0) return false;

    // Expiry. Kept in step with verifyToken() in src/lib/auth.ts — the payload
    // is `${email}:${issuedAtMs}` and a valid signature alone says nothing
    // about age.
    const lastColon = payload.lastIndexOf(':');
    if (lastColon === -1) return false;
    const issuedAt = Number(payload.slice(lastColon + 1));
    if (!Number.isFinite(issuedAt)) return false;
    const age = Date.now() - issuedAt;
    return age >= 0 && age <= COOKIE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The historical login path resolves to the master console's entry. The
  // matcher below does not cover /admin-login, which redirects in its own page
  // component instead.
  if (pathname === '/admin/login') {
    return NextResponse.rewrite(new URL('/master-admin', req.url));
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
      const loginUrl = new URL('/master-admin', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Cryptographically verify the HMAC signature
    const valid = await verifyHmacToken(token);
    if (!valid) {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
      const loginUrl = new URL('/master-admin', req.url);
      loginUrl.searchParams.set('from', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
  }

  // Employer portal. A cheap signature check here keeps unauthenticated
  // traffic off the pages; whether the session is still valid, the account
  // still active and which tenant it belongs to is settled by requireClient()
  // in the handlers, which can reach the database. Edge middleware cannot.
  const isPortalPage = pathname.startsWith('/portal') && pathname !== '/portal';
  const isPortalApi =
    pathname.startsWith('/api/portal') &&
    !pathname.startsWith('/api/portal/gateway') &&
    !pathname.startsWith('/api/portal/session');

  if (isPortalPage || isPortalApi) {
    const token = req.cookies.get(CLIENT_COOKIE)?.value;
    const valid = token ? await verifyClientToken(token) : false;
    if (!valid) {
      if (isPortalApi) {
        return NextResponse.json({ error: 'Enterprise access required.' }, { status: 401 });
      }
      const url = new URL('/portal', req.url);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/portal/:path*', '/api/portal/:path*'],
};
