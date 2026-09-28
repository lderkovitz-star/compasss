import { prisma } from '@/lib/db';
import IntakeClient from './IntakeClient';
import { resolveBrandName } from '@/lib/constants/brand';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IntakePage() {
  // Fetch platform settings from the database server-side
  const settings = await prisma.platformSettings.findFirst();

  const platformName = resolveBrandName(settings?.platformName);


  return (
    <IntakeClient 
      platformName={platformName}
      logoUrl={settings?.logoUrl || null}
      biometricMode={settings?.biometricMode || 'disabled'}
    />
  );
}
