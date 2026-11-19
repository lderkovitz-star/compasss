import { resolveActiveProvider } from './registry';
import {
  DEFAULT_TIMEOUT_MS,
  ProviderError,
  fetchWithTimeout,
  isRetryableStatus,
  type ResolvedProvider,
} from './types';

/**
 * Embeddings, for similarity search over the talent registries.
 *
 * Only OpenAI-compatible endpoints expose an embeddings API, so this works
 * when one of those has a key saved (live or not) and is honest about it when
 * not: the registry search falls back to matching words, and says which of
 * the two it used rather than quietly degrading.
 */

const DEFAULT_MODEL = 'text-embedding-3-small';

export class EmbeddingsUnavailable extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EmbeddingsUnavailable.prototype);
    this.name = 'EmbeddingsUnavailable';
  }
}

/**
 * The provider that does the embedding. Anthropic has no embeddings API, so
 * when it is the live provider for evaluations, embeddings come from a saved
 * OpenAI (or OpenRouter / custom) provider instead: the provider that writes
 * evaluations and the one that embeds do not have to be the same.
 */
async function resolveEmbeddingProvider(): Promise<ResolvedProvider> {
  try {
    const live = await resolveActiveProvider();
    if (live.providerType === 'OPENAI_COMPATIBLE') return live;
  } catch {
    // Not configured; try the others.
  }
  for (const key of ['openai', 'custom']) {
    try {
      const provider = await resolveActiveProvider(key);
      if (provider.providerType === 'OPENAI_COMPATIBLE') return provider;
    } catch {
      // No key saved for this one.
    }
  }
  throw new EmbeddingsUnavailable(
    'Similarity search needs an OpenAI-compatible provider with a key saved in Settings → AI provider (it does not have to be the live one).'
  );
}

export async function embeddingsAvailable(): Promise<boolean> {
  try {
    await resolveEmbeddingProvider();
    return true;
  } catch {
    return false;
  }
}

/** Embeds one or more texts. Returns one vector per input, in order. */
export async function embed(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
  if (texts.length === 0) return { vectors: [], model: DEFAULT_MODEL };

  const provider = await resolveEmbeddingProvider();

  const base = (provider.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;

  const response = await fetchWithTimeout(
    `${base}/embeddings`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'content-type': 'application/json',
        ...provider.extraHeaders,
      },
      // Inputs are truncated: an embedding of the first few thousand
      // characters of a CV carries the signal, and the whole thing would
      // often exceed the model's context.
      body: JSON.stringify({ model, input: texts.map((t) => t.slice(0, 8000)) }),
    },
    DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json())?.error?.message ?? '';
    } catch {
      detail = '';
    }
    throw new ProviderError(detail || `The embeddings endpoint returned HTTP ${response.status}.`, {
      status: response.status,
      retryable: isRetryableStatus(response.status),
    });
  }

  const data = await response.json();
  const vectors: number[][] = (data.data ?? [])
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding);

  if (vectors.length !== texts.length) {
    throw new ProviderError('The embeddings endpoint returned the wrong number of vectors.');
  }

  return { vectors, model };
}

/**
 * Cosine similarity, -1 to 1. Both vectors must have the same length, which
 * holds as long as they came from the same model - hence storing the model
 * name alongside each one.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** What a registry entry is searched on. */
export function searchableText(entry: {
  name: string | null;
  email: string | null;
  jobContextText: string | null;
  resumeText: string | null;
}): string {
  return [
    entry.name ?? '',
    entry.jobContextText ?? '',
    entry.resumeText ?? '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();
}
