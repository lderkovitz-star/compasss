import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { getClientSession } from '@/lib/portal-auth';
import { hashInviteToken, isWellFormedInviteToken } from '@/lib/invite-token';
import { extractResumeText, isSupportedResume } from '@/lib/resume-parse';
import { getStorage, StorageConfigError } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Registers a document the browser uploaded directly, and reads its text.
 *
 * This is the primary registration path rather than blob storage's own
 * completion webhook, which never fires against localhost - depending on it
 * would make the upload flow untestable until it was already deployed.
 *
 * Nothing the client says about the file is taken at face value: the size,
 * type and existence all come from asking storage, and the path the file
 * landed on has to be one this caller was entitled to write to. Otherwise
 * anyone could register a blob under someone else's tenant folder and have it
 * attached to their candidate.
 */

type Caller =
  | { kind: 'invite'; prefix: string; clientAccountId: string; inviteId: string }
  | { kind: 'portal'; prefix: string; clientAccountId: string }
  | { kind: 'admin'; prefix: string }
  | { kind: 'intake'; prefix: string };

async function identify(inviteToken: string | null): Promise<Caller | null> {
  const storage = await getStorage();
  if (inviteToken) {
    if (!isWellFormedInviteToken(inviteToken)) return null;
    const invite = await prisma.assessmentInvite.findUnique({
      where: { tokenHash: hashInviteToken(inviteToken) },
      select: {
        id: true,
        clientAccountId: true,
        expiresAt: true,
        revokedAt: true,
        clientAccount: { select: { status: true, deletedAt: true } },
      },
    });
    if (
      !invite ||
      invite.revokedAt ||
      invite.expiresAt <= new Date() ||
      invite.clientAccount.deletedAt ||
      invite.clientAccount.status !== 'ACTIVE'
    ) {
      return null;
    }
    return {
      kind: 'invite',
      prefix: storage.prefixFor({ kind: 'tenant', clientAccountId: invite.clientAccountId }),
      clientAccountId: invite.clientAccountId,
      inviteId: invite.id,
    };
  }

  const portal = await getClientSession();
  if (portal) {
    return {
      kind: 'portal',
      prefix: storage.prefixFor({ kind: 'tenant', clientAccountId: portal.clientAccountId }),
      clientAccountId: portal.clientAccountId,
    };
  }

  const admin = await getCurrentAdmin();
  if (admin) return { kind: 'admin', prefix: storage.prefixFor({ kind: 'admin' }) };

  return { kind: 'intake', prefix: storage.prefixFor({ kind: 'intake' }) };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
    }

    const blobUrl = typeof body.blobUrl === 'string' ? body.blobUrl : '';
    const fileName = typeof body.fileName === 'string' ? body.fileName.slice(0, 255) : 'resume';
    const inviteToken = typeof body.inviteToken === 'string' ? body.inviteToken : null;

    if (!blobUrl) {
      return NextResponse.json({ error: 'blobUrl is required.' }, { status: 400 });
    }

    const caller = await identify(inviteToken);
    if (!caller) {
      return NextResponse.json(
        { error: 'This upload link is no longer valid. Ask for a new invitation.' },
        { status: 401 }
      );
    }

    // Storage is the authority on what was actually uploaded - not the
    // browser, which could claim any size or type it liked.
    const storage = await getStorage();
    let meta;
    try {
      meta = await storage.describe(blobUrl);
    } catch {
      return NextResponse.json(
        { error: 'That upload could not be found. Please try attaching the file again.' },
        { status: 404 }
      );
    }

    if (!meta.pathname.startsWith(`${caller.prefix}/`)) {
      // The upload exists but was not authorised for this caller.
      return NextResponse.json({ error: 'That upload does not belong to you.' }, { status: 403 });
    }

    const contentType = meta.contentType;
    if (!isSupportedResume(contentType, fileName)) {
      return NextResponse.json({ error: 'A resume must be a PDF or DOCX file.' }, { status: 400 });
    }

    let parsed;
    try {
      parsed = await extractResumeText(await storage.read(blobUrl), contentType, fileName);
    } catch (err) {
      parsed = {
        status: 'FAILED' as const,
        text: null,
        error: err instanceof Error ? err.message : 'The file could not be read.',
      };
    }

    const document = await prisma.resumeDocument.create({
      data: {
        clientAccountId: 'clientAccountId' in caller ? caller.clientAccountId : null,
        blobUrl,
        pathname: meta.pathname,
        fileName,
        contentType,
        byteSize: meta.byteSize,
        parsedText: parsed.text,
        parseStatus: parsed.status,
        parseError: parsed.error,
        parsedAt: new Date(),
      },
      select: { id: true, parseStatus: true, parseError: true, parsedText: true },
    });

    return NextResponse.json({
      ok: true,
      documentId: document.id,
      blobUrl,
      parseStatus: document.parseStatus,
      // Enough to tell the candidate whether their file was readable, without
      // sending the whole document back to the browser.
      charactersRead: document.parsedText?.length ?? 0,
      message:
        document.parseStatus === 'OK'
          ? null
          : document.parseError ??
            'The file was saved but its text could not be read. Your evaluator will still receive the document.',
    });
  } catch (error) {
    if (error instanceof StorageConfigError) {
      // Nothing the candidate did; say what is actually wrong.
      console.error('[uploads confirm] storage misconfigured:', error.message);
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[uploads confirm]', error);
    return NextResponse.json({ error: 'The upload could not be registered.' }, { status: 500 });
  }
}
