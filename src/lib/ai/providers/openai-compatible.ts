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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * Covers OpenAI, OpenRouter and anything else that speaks the same
 * chat-completions shape - which is most hosted inference now. One adapter
 * rather than one per vendor, with the endpoint as configuration.
 */
export const openaiCompatible: Provider = {
  async complete(
    provider: ResolvedProvider,
    request: CompletionRequest
  ): Promise<CompletionResult> {
    const base = (provider.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

    const messages: { role: string; content: string }[] = [];
    if (request.system) messages.push({ role: 'system', content: request.system });
    messages.push({ role: 'user', content: request.prompt });

    const response = await fetchWithTimeout(
      `${base}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'content-type': 'application/json',
          ...provider.extraHeaders,
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: provider.maxTokens,
          ...(provider.temperature !== null ? { temperature: provider.temperature } : {}),
          messages,
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
    const text: string = data.choices?.[0]?.message?.content ?? '';

    if (!text.trim()) {
      throw new ProviderError('The provider returned an empty response.', { retryable: true });
    }

    return {
      text,
      inputTokens: data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.completion_tokens ?? null,
    };
  },
};

async function describe(response: Response, model: string): Promise<string> {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message ?? '';
  } catch {
    detail = (await response.text().catch(() => '')).slice(0, 300);
  }

  if (response.status === 401 || response.status === 403) {
    return 'The API key was rejected. Check that it is correct and still active.';
  }
  if (response.status === 404) {
    return `The model "${model}" was not found at this endpoint. Check the model id and base URL.`;
  }
  if (response.status === 429) {
    return 'The provider is rate limiting these requests. Try again shortly.';
  }
  return detail || `The provider returned HTTP ${response.status}.`;
}
