import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';
import { defaultConsentStatement } from '@/lib/consent';
import { resolveBrandName, resolveSupportEmail } from '@/lib/constants/brand';

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
    // The wording candidates see while no custom statement is set. Sent so the
    // settings panel can show it without saving it as a custom value - which
    // would freeze today's default in place the first time anyone saves.
    defaultConsentStatement: defaultConsentStatement({
      platformName: resolveBrandName(settings.platformName as string | null),
      supportEmail: resolveSupportEmail(settings.supportEmail as string | null),
    }),
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
      antiCheat,
      blindUiMode,
      anthropicApiKey,
      aiPromptTemplate,
      logoUrl,
      defaultBackdropUrl,
      consentRequired,
      consentPolicyVersion,
      consentStatement,
      openIntakeEnabled,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (platformName !== undefined) updateData.platformName = platformName;
    if (supportEmail !== undefined) updateData.supportEmail = supportEmail;
    if (antiCheat !== undefined) updateData.antiCheat = Boolean(antiCheat);
    if (blindUiMode !== undefined) updateData.blindUiMode = Boolean(blindUiMode);
    if (aiPromptTemplate !== undefined) updateData.aiPromptTemplate = aiPromptTemplate || null;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (defaultBackdropUrl !== undefined) updateData.defaultBackdropUrl = defaultBackdropUrl;

    // Consent framework. The statement is stored verbatim on each consent
    // record, so editing it here changes what the next candidate sees and
    // leaves every record already taken untouched. Blanking it restores the
    // built-in default rather than showing a candidate an empty statement.
    if (openIntakeEnabled !== undefined) {
      updateData.openIntakeEnabled = Boolean(openIntakeEnabled);
    }
    if (consentRequired !== undefined) updateData.consentRequired = Boolean(consentRequired);
    if (consentStatement !== undefined) {
      const text = typeof consentStatement === 'string' ? consentStatement.trim() : '';
      updateData.consentStatement = text.length > 0 ? text : null;
    }
    if (consentPolicyVersion !== undefined) {
      const version =
        typeof consentPolicyVersion === 'string' ? consentPolicyVersion.trim() : '';
      if (version.length > 32) {
        return NextResponse.json(
          { error: 'Consent version must be 32 characters or fewer.' },
          { status: 400 }
        );
      }
      // A blank version would detach stored records from any identifiable
      // wording, so it falls back rather than being saved empty.
      updateData.consentPolicyVersion = version || '1.0';
    }

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
