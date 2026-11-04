import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { encryptSecret, last4 } from '@/lib/crypto/secrets';
import { ensureProviders } from '@/lib/ai/registry';

export const dynamic = 'force-dynamic';

/** Only a superuser may change which model sees candidate data, or hold its key. */
const SUPERUSER = ['SUPER_ADMIN'] as const;

/**
 * The provider panel.
 *
 * No response from here ever contains an API key. A saved key is reported as
 * `configured` plus its last four characters - enough to tell which key is in
 * place, useless to anyone who intercepts it. The previous settings endpoint
 * deliberately sent the full key to the browser.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  await ensureProviders();

  const [providers, settings] = await Promise.all([
    prisma.aiProviderConfig.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.platformSettings.findFirst({ select: { activeAiProviderKey: true } }),
  ]);

  return NextResponse.json({
    activeProviderKey: settings?.activeAiProviderKey ?? 'anthropic',
    providers: providers.map((p) => ({
      key: p.key,
      label: p.label,
      providerType: p.providerType,
      model: p.model,
      baseUrl: p.baseUrl,
      maxTokens: p.maxTokens,
      isEnabled: p.isEnabled,
      keyConfigured: Boolean(p.apiKeyCipher) || Boolean(p.apiKeyEnvVar),
      keyLast4: p.apiKeyLast4,
      lastTestedAt: p.lastTestedAt,
      lastTestError: p.lastTestError,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(SUPERUSER);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const key = typeof body.key === 'string' ? body.key.trim() : '';

    // Switching which provider is live, without editing it.
    if (!key && typeof body.activeProviderKey === 'string') {
      const wanted = body.activeProviderKey.trim();
      const exists = await prisma.aiProviderConfig.findUnique({
        where: { key: wanted },
        select: { label: true, model: true, apiKeyCipher: true, apiKeyEnvVar: true },
      });
      if (!exists) {
        return NextResponse.json({ error: 'No such provider.' }, { status: 400 });
      }
      if (!exists.model.trim()) {
        return NextResponse.json(
          { error: `Set a model id for ${exists.label} before making it live.` },
          { status: 400 }
        );
      }
      if (!exists.apiKeyCipher && !exists.apiKeyEnvVar) {
        return NextResponse.json(
          { error: `Save an API key for ${exists.label} before making it live.` },
          { status: 400 }
        );
      }

      const current = await prisma.platformSettings.findFirst({ select: { id: true } });
      const saved = current
        ? await prisma.platformSettings.update({
            where: { id: current.id },
            data: { activeAiProviderKey: wanted },
          })
        : await prisma.platformSettings.create({ data: { activeAiProviderKey: wanted } });

      await prisma.auditLog.create({
        data: {
          actorType: 'ADMIN',
          actorId: auth.id,
          action: 'ai.provider.activate',
          targetType: 'PlatformSettings',
          targetId: saved.id,
          meta: { providerKey: wanted },
        },
      });

      return NextResponse.json({ ok: true, activeProviderKey: wanted });
    }

    if (!key) {
      return NextResponse.json({ error: 'Which provider?' }, { status: 400 });
    }

    const existing = await prisma.aiProviderConfig.findUnique({ where: { key } });
    if (!existing) {
      return NextResponse.json({ error: 'No such provider.' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};

    if (typeof body.model === 'string') {
      // Free text on purpose: model names change constantly and a fixed list
      // goes stale, leaving an operator unable to use a model that exists.
      data.model = body.model.trim();
    }

    if (body.baseUrl !== undefined) {
      const raw = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
      if (raw) {
        let parsed: URL;
        try {
          parsed = new URL(raw);
        } catch {
          return NextResponse.json({ error: 'That base URL is not a valid URL.' }, { status: 400 });
        }
        if (parsed.protocol !== 'https:') {
          return NextResponse.json(
            { error: 'The base URL must use https, so the key is not sent in the clear.' },
            { status: 400 }
          );
        }
        data.baseUrl = raw.replace(/\/$/, '');
      } else {
        data.baseUrl = null;
      }
    }

    if (body.maxTokens !== undefined) {
      const tokens = Number(body.maxTokens);
      if (!Number.isInteger(tokens) || tokens < 128 || tokens > 32_000) {
        return NextResponse.json(
          { error: 'Max tokens must be a whole number between 128 and 32000.' },
          { status: 400 }
        );
      }
      data.maxTokens = tokens;
    }

    if (body.isEnabled !== undefined) data.isEnabled = Boolean(body.isEnabled);

    // Write-only. An empty string leaves the stored key alone; null clears it.
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      const plaintext = body.apiKey.trim();
      data.apiKeyCipher = encryptSecret(plaintext);
      data.apiKeyLast4 = last4(plaintext);
      data.lastTestError = null;
    } else if (body.apiKey === null) {
      data.apiKeyCipher = null;
      data.apiKeyLast4 = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
    }

    const saved = await prisma.aiProviderConfig.update({ where: { key }, data });

    await prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: auth.id,
        action: 'ai.provider.update',
        targetType: 'AiProviderConfig',
        targetId: saved.id,
        // The key itself is never recorded, only that one was set.
        meta: {
          providerKey: key,
          fields: Object.keys(data).map((f) => (f === 'apiKeyCipher' ? 'apiKey' : f)),
        },
      },
    });

    return NextResponse.json({
      ok: true,
      provider: {
        key: saved.key,
        label: saved.label,
        providerType: saved.providerType,
        model: saved.model,
        baseUrl: saved.baseUrl,
        maxTokens: saved.maxTokens,
        isEnabled: saved.isEnabled,
        keyConfigured: Boolean(saved.apiKeyCipher) || Boolean(saved.apiKeyEnvVar),
        keyLast4: saved.apiKeyLast4,
      },
    });
  } catch (error) {
    console.error('[ai providers PATCH]', error);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }
}
