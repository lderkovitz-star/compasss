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
 * Endpoints that have told us they want `max_completion_tokens` in place of
 * `max_tokens`, keyed by endpoint and model.
 *
 * OpenAI's reasoning models reject `max_tokens` outright, while OpenRouter and
 * self-hosted endpoints still accept it - sometimes for the same model name.
 * Which one to send therefore cannot be read off the model id, and a list of
 * model prefixes would need editing every time a model ships. It is learned
 * from the one error that says so instead, and remembered for the life of the
 * process: the extra call happens once per endpoint and model after a cold
 * start, not on every request.
 */
const prefersMaxCompletionTokens = new Set<string>();

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
    const memoKey = `${base}::${provider.model}`;

    const messages: { role: string; content: string }[] = [];
    if (request.system) messages.push({ role: 'system', content: request.system });
    messages.push({ role: 'user', content: request.prompt });

    const send = (useCompletionTokens: boolean) =>
      fetchWithTimeout(
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
            ...(useCompletionTokens
              ? { max_completion_tokens: provider.maxTokens }
              : { max_tokens: provider.maxTokens }),
            ...(provider.temperature !== null ? { temperature: provider.temperature } : {}),
            messages,
          }),
        },
        request.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );

    let useCompletionTokens = prefersMaxCompletionTokens.has(memoKey);
    let response = await send(useCompletionTokens);

    // Naming the limit the wrong way comes back as a 400 that mentions both
    // parameters. Switch and try once more; every other failure is reported as
    // it stands, so a rejected key still reads as a rejected key.
    if (!response.ok && !useCompletionTokens) {
      const detail = await readDetail(response);
      if (response.status === 400 && asksForCompletionTokens(detail)) {
        prefersMaxCompletionTokens.add(memoKey);
        useCompletionTokens = true;
        response = await send(true);
      } else {
        throw new ProviderError(explain(response.status, detail, provider.model), {
          status: response.status,
          retryable: isRetryableStatus(response.status),
        });
      }
    }

    if (!response.ok) {
      throw new ProviderError(
        explain(response.status, await readDetail(response), provider.model),
        { status: response.status, retryable: isRetryableStatus(response.status) }
      );
    }

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? '';

    if (!text.trim()) {
      // A reasoning model spends the same budget on thinking as on the reply,
      // so a limit that was generous for older models can be used up before a
      // single word is returned. That is worth saying plainly - on its own,
      // "empty response" sends people looking at the prompt.
      if (data.choices?.[0]?.finish_reason === 'length') {
        throw new ProviderError(
          `The reply hit the ${provider.maxTokens} token limit before any text was produced. ` +
            'Reasoning models count their thinking towards that limit, so raise ' +
            '"Max tokens per reply" for this provider.',
          { retryable: false }
        );
      }
      throw new ProviderError('The provider returned an empty response.', { retryable: true });
    }

    return {
      text,
      inputTokens: data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.completion_tokens ?? null,
    };
  },
};

/** The error that asks for `max_completion_tokens` by name, and no other. */
function asksForCompletionTokens(detail: string): boolean {
  return /max_completion_tokens/i.test(detail) && /max_tokens/i.test(detail);
}

async function readDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message ?? '';
  } catch {
    return (await response.text().catch(() => '')).slice(0, 300);
  }
}

function explain(status: number, detail: string, model: string): string {
  if (status === 401 || status === 403) {
    return 'The API key was rejected. Check that it is correct and still active.';
  }
  if (status === 404) {
    return `The model "${model}" was not found at this endpoint. Check the model id and base URL.`;
  }
  if (status === 429) {
    return 'The provider is rate limiting these requests. Try again shortly.';
  }
  return detail || `The provider returned HTTP ${status}.`;
}
