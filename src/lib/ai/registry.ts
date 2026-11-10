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

/**
 * The environment variable names a provider falls back to when nothing is
 * saved in the panel: ANTHROPIC_API_KEY / ANTHROPIC_MODEL_ID, OPENAI_API_KEY,
 * and so on. Set them in the host and a fresh deployment works without anyone
 * opening the form.
 */
function envNames(key: string): { apiKey: string; model: string } {
  const prefix = key.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return { apiKey: `${prefix}_API_KEY`, model: `${prefix}_MODEL_ID` };
}

export async function ensureProviders() {
  for (const spec of DEFAULT_PROVIDERS) {
    await prisma.aiProviderConfig.upsert({
      where: { key: spec.key },
      update: {},
      create: {
        key: spec.key,
        label: spec.label,
        providerType: spec.providerType,
        // A model id in the environment wins over the built-in default on a
        // fresh row; the panel still overrides it afterwards.
        model: process.env[envNames(spec.key).model]?.trim() || spec.model,
        baseUrl: spec.baseUrl,
        apiKeyEnvVar: envNames(spec.key).apiKey,
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
  const names = envNames(config.key);

  // The panel is the usual place for these, but an operator may prefer to keep
  // them in the host's configuration. Saved values win, so switching a model
  // mid-demo still takes effect without a redeploy.
  const model = config.model.trim() || process.env[names.model]?.trim() || '';
  if (!model) {
    throw new ProviderError(
      `No model id is set for "${config.label}". Add one in Settings, or set ${names.model}.`
    );
  }

  let apiKey = decryptSecret(config.apiKeyCipher);

  // The column is honoured first for anyone who named a variable of their own;
  // otherwise the conventional name is tried, so simply setting
  // ANTHROPIC_API_KEY works on a deployment whose rows predate that column
  // being seeded.
  if (!apiKey && config.apiKeyEnvVar) {
    apiKey = process.env[config.apiKeyEnvVar]?.trim() || null;
  }
  if (!apiKey) {
    apiKey = process.env[names.apiKey]?.trim() || null;
  }

  // The key the old single-provider settings row held, so an existing
  // deployment keeps working without re-entering it.
  if (!apiKey && config.providerType === 'ANTHROPIC' && settings?.anthropicApiKey) {
    apiKey = settings.anthropicApiKey;
  }

  if (!apiKey) {
    throw new ProviderError(
      `No API key is saved for "${config.label}". Add one in Settings → AI provider, or set ${names.apiKey} in the environment.`
    );
  }

  return {
    id: config.id,
    key: config.key,
    label: config.label,
    providerType: config.providerType as ProviderType,
    model,
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
