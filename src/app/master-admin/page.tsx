import { Suspense } from 'react';
import { getGlobalSettings } from '@/lib/settings';
import { resolveBrandName } from '@/lib/constants/brand';
import { LoginForm } from '../admin-login/components/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * The console's sign-in screen.
 *
 * Served at /admin, which is the address that gets bookmarked; this file is
 * the page behind that rewrite, and /master-admin still reaches it so older
 * bookmarks keep working. Employers sign in at /employer.
 *
 * Neither is linked from the landing page - a candidate has no account for
 * either. The security is the login itself, a bcrypt comparison behind a rate
 * limiter, not the obscurity of the path.
 */
export default async function MasterAdminPage() {
  const settings = await getGlobalSettings();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-400 text-sm">Loading…</div>
        </div>
      }
    >
      <LoginForm
        initialPlatformName={resolveBrandName(settings.platformName)}
        initialPlatformLogo={settings.logoUrl || null}
      />
    </Suspense>
  );
}
