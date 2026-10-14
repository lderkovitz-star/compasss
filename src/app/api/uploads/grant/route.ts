import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { prisma } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';
import { getClientSession } from '@/lib/portal-auth';
import { hashInviteToken, isWellFormedInviteToken } from '@/lib/invite-token';
import { getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * Issues a one-shot token so the browser uploads straight to blob storage.
 *
 * Uploads used to pass through our own API route, which put them under
 * Vercel's 4.5 MB request body limit - a limit enforced before the handler
 * runs, so the only thing the candidate saw was "Failed to fetch" with no
 * explanation. Going direct removes that ceiling entirely.
 *
 * Who may upload, and where it lands, is decided here from the caller's own
 * credentials. The client sends a token or nothing; it never says which tenant
 * it belongs to, because that is exactly the field an attacker would set.
 */

const RESUME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_RESUME_BYTES = 25 * 1024 * 1024;

type Grant = {
  prefix: string;
  clientAccountId: string | null;
  inviteId: string | null;
};

/** Resolves the caller to a storage prefix, or null if they may not upload. */
async function authorize(clientPayload: string | null): Promise<Grant | null> {
  // The folder comes from the adapter, never from the browser.
  const storage = await getStorage();
  // An invited candidate: anonymous, but holding a link we issued.
  let inviteToken: string | null = null;
  if (clientPayload) {
    try {
      const parsed = JSON.parse(clientPayload) as { inviteToken?: unknown };
      if (typeof parsed.inviteToken === 'string') inviteToken = parsed.inviteToken;
    } catch {
      // A payload we cannot read is simply no payload.
    }
  }

  if (inviteToken && isWellFormedInviteToken(inviteToken)) {
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
      invite &&
      !invite.revokedAt &&
      invite.expiresAt > new Date() &&
      !invite.clientAccount.deletedAt &&
      invite.clientAccount.status === 'ACTIVE'
    ) {
      return {
        prefix: storage.prefixFor({ kind: 'tenant', clientAccountId: invite.clientAccountId }),
        clientAccountId: invite.clientAccountId,
        inviteId: invite.id,
      };
    }
    return null;
  }

  const portal = await getClientSession();
  if (portal) {
    return {
      prefix: storage.prefixFor({ kind: 'tenant', clientAccountId: portal.clientAccountId }),
      clientAccountId: portal.clientAccountId,
      inviteId: null,
    };
  }

  const admin = await getCurrentAdmin();
  if (admin) {
    return { prefix: storage.prefixFor({ kind: 'admin' }), clientAccountId: null, inviteId: null };
  }

  // Open intake, which anyone may use. Kept separate from any tenant's folder.
  return { prefix: storage.prefixFor({ kind: 'intake' }), clientAccountId: null, inviteId: null };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const grant = await authorize(clientPayload ?? null);
        if (!grant) {
          throw new Error('This upload link is no longer valid. Ask for a new invitation.');
        }
        // The browser proposes the path, so it has to be checked rather than
        // trusted: without this, a caller could name someone else's tenant
        // folder and have the file land there.
        if (!pathname.startsWith(`${grant.prefix}/`) || pathname.includes('..')) {
          throw new Error('That upload path is not allowed.');
        }
        return {
          allowedContentTypes: RESUME_TYPES,
          maximumSizeInBytes: MAX_RESUME_BYTES,
          addRandomSuffix: true,
          // Authored here, never by the client, and returned to us on
          // completion as proof of what was authorised.
          tokenPayload: JSON.stringify(grant),
        };
      },
      onUploadCompleted: async () => {
        // Registration happens through /api/uploads/confirm instead. This hook
        // never fires on localhost, so relying on it would mean the upload
        // flow could not be tested before deploying.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload could not be authorised.' },
      { status: 400 }
    );
  }
}
