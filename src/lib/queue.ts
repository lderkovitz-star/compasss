import { Client } from '@upstash/qstash';

/**
 * Background AI evaluation, through QStash.
 *
 * A finished sitting used to be tiered only when an admin pressed Run AI.
 * Doing it inside the candidate's last request instead would hold them on a
 * spinner for as long as the provider takes, and Vercel freezes work left
 * running after a response. So the request only drops a message here and
 * returns; QStash calls /api/queue/ai-tier, which does the evaluation.
 *
 * - One at a time: every message shares a flow-control key with parallelism 1,
 *   so a burst of completions reaches the AI provider as a steady line, not
 *   all at once.
 * - Three retries: a non-2xx from the worker is retried by QStash, up to
 *   three times after the first attempt, then lands in its dead-letter queue.
 */

/** Shared by every evaluation message; it is what limits them to one at a time. */
const FLOW_CONTROL_KEY = 'ai-evaluation';
const PARALLELISM = 1;
const RETRIES = 3;

export const AI_TIER_WORKER_PATH = '/api/queue/ai-tier';

let client: Client | null = null;

function qstash(): Client | null {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (!token) return null;
  if (!client) {
    client = new Client({
      token,
      // Unset in production, where the SDK's default is right. Locally it
      // points at the QStash dev server.
      baseUrl: process.env.QSTASH_URL?.trim() || undefined,
    });
  }
  return client;
}

/**
 * Where QStash should deliver. APP_URL when set; otherwise the origin the
 * candidate's own request arrived on, which is how invite links are built.
 */
function workerUrl(requestOrigin: string): string {
  const base = (process.env.APP_URL?.trim() || requestOrigin).replace(/\/+$/, '');
  return `${base}${AI_TIER_WORKER_PATH}`;
}

/**
 * Queues one sitting for evaluation. Never throws: a queue that is down or
 * unconfigured must not stop the candidate's sitting from completing. The
 * sitting is then simply untiered, and Run AI in the coordinator still works.
 */
export async function enqueueAiEvaluation(
  sessionId: string,
  requestOrigin: string
): Promise<boolean> {
  const qs = qstash();
  if (!qs) {
    console.warn('[queue] QSTASH_TOKEN is not set; AI evaluation was not queued for', sessionId);
    return false;
  }

  try {
    await qs.publishJSON({
      url: workerUrl(requestOrigin),
      body: { sessionId },
      retries: RETRIES,
      flowControl: { key: FLOW_CONTROL_KEY, parallelism: PARALLELISM },
      // The GET and POST paths can both finalise one sitting; this keeps that
      // to a single message, and so a single provider call.
      deduplicationId: `ai-tier-${sessionId}`,
    });
    return true;
  } catch (err) {
    console.error('[queue] could not queue AI evaluation for', sessionId, err);
    return false;
  }
}
