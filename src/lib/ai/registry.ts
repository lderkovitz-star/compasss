import { prisma } from '../db';
import { decryptSecret } from '../crypto/secrets';
import { anthropic } from './providers/anthropic';
import { openaiCompatible } from './providers/openai-compatible';
import {
  ProviderError,
  type CompletionRequest,
  type CompletionResult,
  type Provider,
  type ProviderType,
  type ResolvedProvider,
} from './types';

/**
 * Which model answers, and with whose key.
 *
 * The choice is read from PlatformSettings at request time rather than baked
 * in, so switching provider or model takes effect without a redeploy. The
 * previous code hardcoded claude-3-haiku-20240307 in the call itself, which
 * meant changing model meant shipping code.
 */

const ADAPTERS: Record<ProviderType, Provider> = {
  ANTHROPIC: anthropic,
  OPENAI_COMPATIBLE: openaiCompatible,
};

/** The three the client asked for. Seeded on first use so the panel is never empty. */
export const DEFAULT_PROVIDERS = [
  {
    key: 'anthropic',
    label: 'Anthropic',
    providerType: 'ANTHROPIC' as ProviderType,
    model: 'claude-sonnet-4-5',
    baseUrl: null as string | null,
  },
  {
    key: 'openai',
    label: 'OpenAI',
    providerType: 'OPENAI_COMPATIBLE' as ProviderType,
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    key: 'custom',
    label: 'OpenRouter / Custom',
    providerType: 'OPENAI_COMPATIBLE' as ProviderType,
    model: '',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
];

export async function ensureProviders() {
  for (const spec of DEFAULT_PROVIDERS) {
    await prisma.aiProviderConfig.upsert({
      where: { key: spec.key },
      update: {},
      create: {
        key: spec.key,
        label: spec.label,
        providerType: spec.providerType,
        model: spec.model,
        baseUrl: spec.baseUrl,
      },
    });
  }
}

function asHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/**
 * Loads the configured provider and its key.
 *
 * Every reason this can fail is something an operator has to go and fix, so
 * each one says which.
 */
export async function resolveActiveProvider(keyOverride?: string): Promise<ResolvedProvider> {
  const settings = await prisma.platformSettings.findFirst({
    select: { activeAiProviderKey: true, anthropicApiKey: true },
  });

  const wanted = keyOverride ?? settings?.activeAiProviderKey ?? 'anthropic';

  const config = await prisma.aiProviderConfig.findUnique({ where: { key: wanted } });
  if (!config) {
    throw new ProviderError(
      `No AI provider is configured under "${wanted}". Choose one in Settings.`
    );
  }
  if (!config.isEnabled) {
    throw new ProviderError(`The "${config.label}" provider is turned off in Settings.`);
  }
  if (!config.model.trim()) {
    throw new ProviderError(`No model id is set for "${config.label}". Add one in Settings.`);
  }

  let apiKey = decryptSecret(config.apiKeyCipher);

  // An operator may prefer to hold the key in the environment.
  if (!apiKey && config.apiKeyEnvVar) {
    apiKey = process.env[config.apiKeyEnvVar] ?? null;
  }

  // The key the old single-provider settings row held, so an existing
  // deployment keeps working without re-entering it.
  if (!apiKey && config.providerType === 'ANTHROPIC' && settings?.anthropicApiKey) {
    apiKey = settings.anthropicApiKey;
  }

  if (!apiKey) {
    throw new ProviderError(
      `No API key is saved for "${config.label}". Add one in Settings → AI provider.`
    );
  }

  return {
    id: config.id,
    key: config.key,
    label: config.label,
    providerType: config.providerType as ProviderType,
    model: config.model.trim(),
    baseUrl: config.baseUrl,
    apiKey,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    extraHeaders: asHeaders(config.extraHeaders),
  };
}

/**
 * One call, retried once if the failure looks transient.
 *
 * A rate limit or a timeout is worth a second attempt; a rejected key is not,
 * and retrying it only delays the real message.
 */
export async function complete(
  provider: ResolvedProvider,
  request: CompletionRequest
): Promise<CompletionResult> {
  const adapter = ADAPTERS[provider.providerType];
  if (!adapter) {
    throw new ProviderError(`Unknown provider type "${provider.providerType}".`);
  }

  try {
    return await adapter.complete(provider, request);
  } catch (err) {
    if (err instanceof ProviderError && err.retryable) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return adapter.complete(provider, request);
    }
    throw err;
  }
}
