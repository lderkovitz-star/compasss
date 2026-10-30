import {
  DEFAULT_TIMEOUT_MS,
  ProviderError,
  fetchWithTimeout,
  isRetryableStatus,
  type CompletionRequest,
  type CompletionResult,
  type Provider,
  type ResolvedProvider,
} from '../types';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';

export const anthropic: Provider = {
  async complete(
    provider: ResolvedProvider,
    request: CompletionRequest
  ): Promise<CompletionResult> {
    const base = (provider.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

    const response = await fetchWithTimeout(
      `${base}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'x-api-key': provider.apiKey,
          'anthropic-version': API_VERSION,
          'content-type': 'application/json',
          ...provider.extraHeaders,
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: provider.maxTokens,
          ...(provider.temperature !== null ? { temperature: provider.temperature } : {}),
          ...(request.system ? { system: request.system } : {}),
          messages: [{ role: 'user', content: request.prompt }],
        }),
      },
      request.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    if (!response.ok) {
      throw new ProviderError(await describe(response, provider.model), {
        status: response.status,
        retryable: isRetryableStatus(response.status),
      });
    }

    const data = await response.json();
    const text = Array.isArray(data.content)
      ? data.content
          .filter((block: { type?: string }) => block?.type === 'text')
          .map((block: { text?: string }) => block.text ?? '')
          .join('')
      : '';

    if (!text.trim()) {
      throw new ProviderError('The provider returned an empty response.', { retryable: true });
    }

    return {
      text,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
    };
  },
};

/** Turns a provider's error body into something an operator can act on. */
async function describe(response: Response, model: string): Promise<string> {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message ?? '';
  } catch {
    detail = (await response.text().catch(() => '')).slice(0, 300);
  }

  if (response.status === 401) {
    return 'The API key was rejected. Check that it is correct and still active.';
  }
  if (response.status === 404) {
    return `The model "${model}" was not found. Check the model id.`;
  }
  if (response.status === 429) {
    return 'The provider is rate limiting these requests. Try again shortly.';
  }
  return detail || `The provider returned HTTP ${response.status}.`;
}
