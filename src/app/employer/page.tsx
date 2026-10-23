import { redirect } from 'next/navigation';
import { getClientSession } from '@/lib/portal-auth';
import { getPublicSettings } from '@/lib/settings';
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
    <main className="min-h-screen bg-[#0B1220] text-[#F3F5FA] flex items-center justify-center px-4 py-12">
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
      </div>
    </main>
  );
}
