import { prisma } from '@/lib/db';
import IntakeClient from './IntakeClient';
import { BRAND_NAME } from '@/lib/constants/brand';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IntakePage() {
  // Fetch platform settings from the database server-side
  const settings = await prisma.platformSettings.findFirst();

  // Determine the display name (e.g. CognitiveEdge or custom branding)
  const platformName = settings?.platformName && settings.platformName.toLowerCase() !== 'cognitiveedge'
    ? settings.platformName
    : BRAND_NAME;

  return (
    <IntakeClient 
      platformName={platformName}
      logoUrl={settings?.logoUrl || null}
      biometricMode={settings?.biometricMode || 'disabled'}
    />
  );
}
