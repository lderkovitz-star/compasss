import { prisma } from '@/lib/db';
import { resolveBrandName, resolveSupportEmail } from '@/lib/constants/brand';

/**
 * The fields that are safe to hand to an unauthenticated caller.
 *
 * getGlobalSettings() returns the whole row, including anthropicApiKey and
 * aiPromptTemplate. Spreading that across a trust boundary is how the key
 * became readable from the public /api/settings route, so anything serving a
 * browser goes through this projection instead.
 */
export type PublicSettings = {
  platformName: string;
  supportEmail: string;
  logoUrl: string | null;
  defaultBackdropUrl: string | null;
};

export async function getPublicSettings(): Promise<PublicSettings> {
  const settings = await getGlobalSettings();
  return {
    platformName: resolveBrandName(settings.platformName),
    supportEmail: resolveSupportEmail(settings.supportEmail),
    logoUrl: settings.logoUrl ?? null,
    defaultBackdropUrl: settings.defaultBackdropUrl ?? null,
  };
}

export async function getGlobalSettings() {
  try {
    let settings = await prisma.platformSettings.findFirst();
    
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          platformName: 'Compass',
          supportEmail: 'support@continentalworks.com',
          antiCheat: true,
          blindUiMode: true,
        }
      });
    }
    
    return settings;
  } catch (err) {
    console.error('Error fetching global settings:', err);
    return {
      id: 'fallback-settings',
      platformName: 'Compass',
      supportEmail: 'support@continentalworks.com',
      antiCheat: true,
      blindUiMode: true,
      logoUrl: null,
      defaultBackdropUrl: null,
      anthropicApiKey: null,
      aiPromptTemplate: null,
      updatedAt: new Date(),
    };
  }
}
