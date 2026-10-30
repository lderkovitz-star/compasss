import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { consumeRateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Starts a practice run.
 *
 * Practice data is isolated structurally rather than by remembering to filter
 * it: the session carries clientAccountId = null, so every tenant query
 * (where: { clientAccountId: tid }) excludes it automatically. Seeing practice
 * data requires asking for it explicitly, which only the master registry does.
 *
 * It is open to anyone, so it is rate limited and given a retention deadline.
 */

const RUNS_PER_HOUR = 5;
const RETENTION_DAYS = 30;
const MAX_JOB_TEXT = 8000;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req.headers);
    const limit = await consumeRateLimit(`practice:${ip}`, RUNS_PER_HOUR, 3600);
    if (!limit.allowed) {
      const waitSeconds = Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000));
      const waitMinutes = Math.ceil(waitSeconds / 60);
      return NextResponse.json(
        {
          error: `That is ${RUNS_PER_HOUR} practice runs within the hour. Try again in about ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}.`,
        },
        { status: 429, headers: { 'Retry-After': String(waitSeconds) } }
      );
    }

    const settings = await prisma.platformSettings.findFirst({
      select: {
        practiceEnabled: true,
        sandboxPackageId: true,
        defaultClientPackageId: true,
        defaultSessionDepth: true,
      },
    });

    if (settings && !settings.practiceEnabled) {
      return NextResponse.json(
        { error: 'Practice runs are turned off at the moment.' },
        { status: 503 }
      );
    }

    const packageId = settings?.sandboxPackageId ?? settings?.defaultClientPackageId ?? null;
    const pkg = packageId
      ? await prisma.scenarioPackage.findFirst({
          where: { id: packageId, deletedAt: null },
          select: { id: true, name: true },
        })
      : null;

    if (!pkg) {
      return NextResponse.json(
        { error: 'No practice scenarios are available yet. Please check back shortly.' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 190) : '';
    const jobText = typeof body.jobText === 'string' ? body.jobText.trim().slice(0, MAX_JOB_TEXT) : '';
    const registryOptIn = body.registryOptIn === true;
    const resumeDocumentId =
      typeof body.resumeDocumentId === 'string' ? body.resumeDocumentId : null;

    // Joining the registry means we keep their details, so we need to be able
    // to identify the entry.
    if (registryOptIn) {
      if (!name) {
        return NextResponse.json(
          { error: 'A name is needed to join the talent registry.' },
          { status: 400 }
        );
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: 'A valid email address is needed to join the talent registry.' },
          { status: 400 }
        );
      }
    }

    const session = await prisma.assessmentSession.create({
      data: {
        // No userId and no clientAccountId: a practice run belongs to nobody's
        // ledger, which is what keeps it out of every employer's view.
        packageId: pkg.id,
        kind: 'PRACTICE',
        status: 'IN_PROGRESS',
        currentScenarioIdx: 0,
        sessionDepth: settings?.defaultSessionDepth ?? null,
        practiceName: name || null,
        practiceEmail: email || null,
        practiceJobText: jobText || null,
        registryOptIn,
        purgeAfter: new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });

    if (resumeDocumentId) {
      // Registered under open intake, so it carries no tenant.
      const document = await prisma.resumeDocument.findFirst({
        where: { id: resumeDocumentId, clientAccountId: null, sessionId: null },
        select: { id: true },
      });
      if (document) {
        await prisma.resumeDocument.update({
          where: { id: document.id },
          data: { sessionId: session.id },
        });
      }
    }

    return NextResponse.json(
      { sessionId: session.id, packageName: pkg.name, retentionDays: RETENTION_DAYS },
      { status: 201 }
    );
  } catch (error) {
    console.error('[practice start]', error);
    return NextResponse.json({ error: 'The practice run could not be started.' }, { status: 500 });
  }
}
