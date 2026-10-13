import { Suspense } from 'react';
import { getGlobalSettings } from '@/lib/settings';
import { resolveBrandName } from '@/lib/constants/brand';
import { LoginForm } from '../admin-login/components/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * The master console's entry point.
 *
 * Employers sign in at /portal; this is for whoever runs the platform, and it
 * is not linked from anywhere a candidate or employer would look. The security
 * is the login itself - a bcrypt comparison behind a rate limiter - not the
 * obscurity of the path, so this page is deliberately plain about nothing.
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
