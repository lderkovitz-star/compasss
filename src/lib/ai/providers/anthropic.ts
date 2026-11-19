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

/**
 * Claude models from the 5 generation on (Sonnet 5.5, Opus 5.5, Haiku 5.5,
 * Fable and so on) think before they answer unless told otherwise, and that
 * thinking counts toward max_tokens. Every call here asks for a short answer
 * (a tier and a few sentences, a ranking, a reply to one question), so those
 * models are asked for low effort: the thinking stays short, replies come back
 * sooner, and "Max tokens per reply" is left for the answer itself.
 *
 * Older models do not think unless asked, and some reject the effort setting,
 * so their requests are left exactly as they were.
 */
const THINKING_EFFORT = 'low';

export function thinksByDefault(model: string): boolean {
  const id = model.trim().toLowerCase().replace(/^anthropic\./, '');
  if (/^claude-(fable|mythos)-/.test(id)) return true;
  const family = /^claude-(opus|sonnet|haiku)-(\d+)/.exec(id);
  return family !== null && Number(family[2]) >= 5;
}

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
          ...(thinksByDefault(provider.model) ? { output_config: { effort: THINKING_EFFORT } } : {}),
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
      // Neither of these gets better on a second try, so say what happened
      // rather than retrying and reporting an empty response.
      if (data.stop_reason === 'max_tokens') {
        throw new ProviderError(
          `The model used all ${provider.maxTokens} tokens before it answered. Raise "Max tokens per reply" in Settings → AI provider.`
        );
      }
      if (data.stop_reason === 'refusal') {
        throw new ProviderError('The model declined to answer this request.');
      }
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
