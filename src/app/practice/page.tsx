import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getPublicSettings } from '@/lib/settings';
import PracticeClient from './PracticeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Practice run',
  description: 'Try a decision simulation. Nothing is shared with any employer.',
};

export default async function PracticePage() {
  const [settings, platform] = await Promise.all([
    prisma.platformSettings.findFirst({
      select: { practiceEnabled: true, sandboxPackageId: true, defaultClientPackageId: true },
    }),
    getPublicSettings(),
  ]);

  const packageId = settings?.sandboxPackageId ?? settings?.defaultClientPackageId ?? null;
  const pack = packageId
    ? await prisma.scenarioPackage.findFirst({
        where: { id: packageId, deletedAt: null },
        select: {
          name: true,
          _count: { select: { scenarios: { where: { deletedAt: null } } } },
        },
      })
    : null;

  const unavailable = settings?.practiceEnabled === false || !pack;

  if (unavailable) {
    return (
      <main className="min-h-screen bg-[#0B1220] text-[#F3F5FA] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-white">Practice runs are not available right now</h1>
          <p className="text-[14px] text-[#97A2BE] mt-2">
            {settings?.practiceEnabled === false
              ? 'They have been turned off for the moment. Please check back later.'
              : 'No practice scenarios have been published yet.'}
          </p>
          <Link href="/" className="inline-block mt-5 text-[13px] font-semibold text-[#5B8CFF]">
            Back to {platform.platformName}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <PracticeClient
      platformName={platform.platformName}
      packageName={pack.name}
      scenarioCount={pack._count.scenarios}
    />
  );
}
