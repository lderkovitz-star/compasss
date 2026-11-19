import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { prisma } from '@/lib/db';
import { evaluateSession } from '@/lib/ai/evaluate';

export const dynamic = 'force-dynamic';
// One provider call, retried once inside complete() if it looks transient.
export const maxDuration = 120;

/**
 * QStash worker: evaluates one completed sitting.
 *
 * Only QStash may call this. The signature check rejects anything else, which
 * matters because every accepted call spends money at the AI provider.
 *
 * The status code is the retry signal. 2xx tells QStash the message is done;
 * anything else makes it try again, up to the retry count set when the
 * message was queued (src/lib/queue.ts).
 */
/**
 * Built per request rather than with the SDK's verifySignatureAppRouter
 * wrapper, which reads the keys when the module loads and throws if they are
 * missing - failing `next build` on any environment without QStash set up.
 */
async function isFromQStash(req: Request, rawBody: string): Promise<boolean | 'unconfigured'> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!currentSigningKey || !nextSigningKey) return 'unconfigured';

  const signature = req.headers.get('upstash-signature');
  if (!signature) return false;

  try {
    return await new Receiver({ currentSigningKey, nextSigningKey }).verify({
      signature,
      body: rawBody,
    });
  } catch {
    // verify() throws on a bad signature rather than returning false.
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  const verified = await isFromQStash(req, rawBody);
  if (verified === 'unconfigured') {
    console.error('[queue ai-tier] QStash signing keys are not set; refusing to run unverified.');
    // Non-2xx, so QStash keeps the message and retries once keys are in place.
    return NextResponse.json({ error: 'Queue worker is not configured.' }, { status: 503 });
  }
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 403 });
  }

  let sessionId = '';
  try {
    const body = JSON.parse(rawBody);
    sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  } catch {
    sessionId = '';
  }

  // Nothing a retry could fix, so acknowledge rather than burn retries.
  if (!sessionId) {
    return NextResponse.json({ ok: false, skipped: 'no sessionId' });
  }

  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    select: { status: true, kind: true, aiEvaluation: true },
  });

  if (!session) {
    return NextResponse.json({ ok: false, skipped: 'session not found' });
  }
  if (session.status !== 'COMPLETED' || session.kind === 'PRACTICE') {
    return NextResponse.json({ ok: false, skipped: 'not a completed official sitting' });
  }
  // Already tiered - by Run AI, the batch, or an earlier delivery of this
  // message whose acknowledgement was lost.
  if (session.aiEvaluation !== null) {
    return NextResponse.json({ ok: true, skipped: 'already evaluated' });
  }

  try {
    // Records every attempt in AiEvaluation, failures included.
    const evaluation = await evaluateSession(sessionId);
    return NextResponse.json({ ok: true, tier: evaluation.tier });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The evaluation failed.';
    console.error('[queue ai-tier]', sessionId, message);
    // Non-2xx, so QStash retries.
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
