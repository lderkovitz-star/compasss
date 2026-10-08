import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * The AI provider key is write-only. It is never returned to the browser —
 * only whether one is set, and its last four characters so an admin can tell
 * which key is installed.
 */
function serialise(settings: { anthropicApiKey: string | null } & Record<string, unknown>) {
  const { anthropicApiKey, ...rest } = settings;
  return {
    ...rest,
    anthropicApiKeyConfigured: Boolean(anthropicApiKey),
    anthropicApiKeyLast4: anthropicApiKey ? anthropicApiKey.slice(-4) : null,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    let settings = await prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          platformName: 'Compass',
          supportEmail: 'support@continentalworks.com',
          biometricMode: 'disabled',
          antiCheat: true,
          blindUiMode: true,
        },
      });
    }
    return NextResponse.json(serialise(settings));
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const {
      platformName,
      supportEmail,
      biometricMode,
      antiCheat,
      blindUiMode,
      anthropicApiKey,
      aiPromptTemplate,
      logoUrl,
      defaultBackdropUrl,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (platformName !== undefined) updateData.platformName = platformName;
    if (supportEmail !== undefined) updateData.supportEmail = supportEmail;
    if (biometricMode !== undefined) {
      const allowed = ['disabled', 'optional', 'required'];
      if (!allowed.includes(biometricMode)) {
        return NextResponse.json({ error: 'Invalid biometric mode.' }, { status: 400 });
      }
      updateData.biometricMode = biometricMode;
    }
    if (antiCheat !== undefined) updateData.antiCheat = Boolean(antiCheat);
    if (blindUiMode !== undefined) updateData.blindUiMode = Boolean(blindUiMode);
    if (aiPromptTemplate !== undefined) updateData.aiPromptTemplate = aiPromptTemplate || null;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (defaultBackdropUrl !== undefined) updateData.defaultBackdropUrl = defaultBackdropUrl;

    // The key is never sent back to the browser, so an unchanged form posts an
    // empty value. Treat that as "leave it alone" — otherwise every unrelated
    // save would wipe the key. Clearing it is an explicit action.
    if (typeof anthropicApiKey === 'string' && anthropicApiKey.trim().length > 0) {
      updateData.anthropicApiKey = anthropicApiKey.trim();
    } else if (anthropicApiKey === null) {
      updateData.anthropicApiKey = null;
    }

    let settings = await prisma.platformSettings.findFirst();

    if (settings) {
      settings = await prisma.platformSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    } else {
      settings = await prisma.platformSettings.create({ data: updateData });
    }

    return NextResponse.json(serialise(settings));
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
