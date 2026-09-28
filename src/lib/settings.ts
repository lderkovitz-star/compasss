import { prisma } from '@/lib/db';

export async function getGlobalSettings() {
  try {
    let settings = await prisma.platformSettings.findFirst();
    
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          platformName: 'Compass',
          supportEmail: 'support@compass.com',
          biometricMode: 'optional',
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
      supportEmail: 'support@compass.com',
      biometricMode: 'optional',
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
