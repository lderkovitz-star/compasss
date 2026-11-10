import { redirect } from 'next/navigation';
import { getClientSession } from '@/lib/portal-auth';
import { getPublicSettings } from '@/lib/settings';
import Link from 'next/link';
import GatewayForm from './GatewayForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PortalGatewayPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  // Already unlocked in this browser - no reason to ask again.
  const session = await getClientSession();
  if (session) redirect(searchParams.from || '/employer/candidates');

  const settings = await getPublicSettings();

  return (
    <main className="min-h-screen bg-[#0B0F17] text-[#F3F5FA] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#2E63F6] to-[#1B3FA8] shadow-[0_0_18px_rgba(46,99,246,0.5)] border border-[#5B8CFF]/40 mb-4">
            <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">{settings.platformName}</h1>
          <p className="text-[12px] text-[#5B6580] tracking-[0.08em] uppercase mt-1 font-semibold">
            Enterprise Admin
          </p>
        </div>

        <GatewayForm supportEmail={settings.supportEmail} from={searchParams.from} />

        {/* Partner Access.
            Deliberately quiet: a business client signing in has no use for it,
            and whoever runs the platform knows it is here. Being visible is not
            a weakness - the console is protected by its own login, a bcrypt
            comparison behind a rate limiter, exactly as it was when the path
            was unlisted. */}
        <div className="mt-10 border-t border-white/[0.07] pt-5 text-center">
          <Link
            href="/admin"
            className="inline-flex min-h-[44px] items-center px-3 text-[11.5px] text-[#39415A] transition-colors hover:text-[#8E99B4]"
          >
            Partner Access
          </Link>
        </div>
      </div>
    </main>
  );
}
