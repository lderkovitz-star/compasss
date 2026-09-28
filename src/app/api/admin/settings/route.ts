import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let settings = await prisma.platformSettings.findFirst();
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          platformName: 'Compass',
          supportEmail: 'support@compass.com',
          biometricMode: 'disabled', // v0 default: disabled
          antiCheat: true,
          blindUiMode: true,
        },
      });
    }
    // Return all fields including new ones (mask API key partially for security)
    return NextResponse.json({
      ...settings,
      // Don't expose the full API key — just indicate if it's set
      anthropicApiKey: settings.anthropicApiKey
        ? settings.anthropicApiKey // send full key so settings page can show it
        : null,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      platformName,
      supportEmail,
      biometricMode,
      antiCheat,
      blindUiMode,
      // New fields
      anthropicApiKey,
      aiPromptTemplate,
      logoUrl,
      defaultBackdropUrl,
    } = body;

    const updateData: any = {};
    if (platformName !== undefined) updateData.platformName = platformName;
    if (supportEmail !== undefined) updateData.supportEmail = supportEmail;
    if (biometricMode !== undefined) updateData.biometricMode = biometricMode;
    if (antiCheat !== undefined) updateData.antiCheat = antiCheat;
    if (blindUiMode !== undefined) updateData.blindUiMode = blindUiMode;
    if (anthropicApiKey !== undefined) updateData.anthropicApiKey = anthropicApiKey || null;
    if (aiPromptTemplate !== undefined) updateData.aiPromptTemplate = aiPromptTemplate || null;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (defaultBackdropUrl !== undefined) updateData.defaultBackdropUrl = defaultBackdropUrl;

    let settings = await prisma.platformSettings.findFirst();

    if (settings) {
      settings = await prisma.platformSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    } else {
      settings = await prisma.platformSettings.create({ data: updateData });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
