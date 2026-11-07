import { prisma } from '@/lib/db';
import IntakeClient from './IntakeClient';
import { resolveBrandName } from '@/lib/constants/brand';
import { getConsentPolicy } from '@/lib/consent';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IntakePage() {
  // Fetch platform settings from the database server-side
  const settings = await prisma.platformSettings.findFirst();

  // Invitation-only by default. Someone who arrives here uninvited is sent to
  // the sandbox, which is the route built for them: anonymous, partial
  // results, and belonging to no employer.
  if (!settings?.openIntakeEnabled) redirect('/practice');

  const platformName = resolveBrandName(settings?.platformName);

  // The statement is read on the server so the candidate is shown the wording
  // that is current at the moment they sit down, and so the same text is what
  // gets stored against their record.
  const consent = await getConsentPolicy();

  return (
    <IntakeClient
      platformName={platformName}
      logoUrl={settings?.logoUrl || null}
      consentStatement={consent.statement}
      consentVersion={consent.version}
      consentRequired={consent.required}
    />
  );
}
