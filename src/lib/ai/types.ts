export type ProviderType = 'ANTHROPIC' | 'OPENAI_COMPATIBLE';

export type CandidateTier = 'TOP_TIER' | 'MID_TIER' | 'LOWER_TIER';

export type ResolvedProvider = {
  id: string | null;
  key: string;
  label: string;
  providerType: ProviderType;
  model: string;
  baseUrl: string | null;
  apiKey: string;
  maxTokens: number;
  temperature: number | null;
  extraHeaders: Record<string, string>;
};

export type CompletionRequest = {
  system?: string;
  prompt: string;
  /** Hard ceiling for one call; the caller gives up after this. */
  timeoutMs?: number;
};

export type CompletionResult = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export interface Provider {
  complete(provider: ResolvedProvider, request: CompletionRequest): Promise<CompletionResult>;
}

/** A provider said no for a reason the operator can act on. */
export class ProviderError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number | null; retryable?: boolean } = {}) {
    super(message);
    // Restores instanceof, which subclassing a built-in loses when this is
    // compiled down to ES5 - and the retry decision below depends on it.
    Object.setPrototypeOf(this, ProviderError.prototype);
    this.name = 'ProviderError';
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
  }
}

export const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProviderError(`The provider did not respond within ${Math.round(timeoutMs / 1000)}s.`, {
        retryable: true,
      });
    }
    throw new ProviderError(
      err instanceof Error ? err.message : 'The provider could not be reached.',
      { retryable: true }
    );
  } finally {
    clearTimeout(timer);
  }
}

/** 429 and 5xx are worth another attempt; a 401 or 404 is not. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
