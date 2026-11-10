import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { issueAccessKey } from '@/lib/access-key';
import { isAllowedWebhookUrl, generateWebhookSecret } from '@/lib/webhook';

export const dynamic = 'force-dynamic';

const MASTER_ROLES = ['SUPER_ADMIN'] as const;

/** Update status, contact details, or the Module B package override. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.contactEmail !== undefined) data.contactEmail = String(body.contactEmail).trim().toLowerCase();
    if (body.status !== undefined) {
      const allowed = ['ACTIVE', 'SUSPENDED', 'ARCHIVED'];
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      data.status = body.status;
    }
    // Module B: this account's package override. null means "follow the
    // global client default", and it affects no other account.
    if (body.assignedPackageId !== undefined) {
      data.assignedPackageId = body.assignedPackageId || null;
    }
    // Candidate seats. An empty value clears the limit rather than setting it
    // to zero - "unlimited" and "none allowed" are opposite instructions and
    // a blank box should never mean the second one.
    if (body.candidateSeatLimit !== undefined) {
      if (body.candidateSeatLimit === null || body.candidateSeatLimit === '') {
        data.candidateSeatLimit = null;
      } else {
        const seats = Number(body.candidateSeatLimit);
        if (!Number.isInteger(seats) || seats < 0 || seats > 1_000_000) {
          return NextResponse.json(
            { error: 'Seat limit must be a whole number, or blank for unlimited.' },
            { status: 400 }
          );
        }
        data.candidateSeatLimit = seats;
      }
    }

    // Completion webhook. Clearing the URL also clears the secret, so a URL
    // set again later gets a fresh one rather than silently reusing a secret
    // that may have been shared with whoever ran the old endpoint.
    let issuedSecret: string | null = null;
    if (body.webhookUrl !== undefined) {
      const raw = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
      if (!raw) {
        data.webhookUrl = null;
        data.webhookSecret = null;
      } else {
        const allowed = isAllowedWebhookUrl(raw);
        if (!allowed.ok) {
          return NextResponse.json({ error: allowed.reason }, { status: 400 });
        }
        data.webhookUrl = allowed.url.toString();
        const existing = await prisma.clientAccount.findUnique({
          where: { id: params.id },
          select: { webhookUrl: true, webhookSecret: true },
        });
        // A new secret only when there was none, or the URL changed.
        if (!existing?.webhookSecret || existing.webhookUrl !== data.webhookUrl) {
          issuedSecret = generateWebhookSecret();
          data.webhookSecret = issuedSecret;
        }
      }
    }

    const account = await prisma.clientAccount.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        name: true,
        status: true,
        assignedPackageId: true,
        candidateSeatLimit: true,
        webhookUrl: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        clientAccountId: account.id,
        actorType: 'MASTER',
        actorId: auth.id,
        actorEmail: auth.email,
        action: 'client_account.update',
        targetType: 'ClientAccount',
        targetId: account.id,
        // The secret is stripped: an audit row is read by more people than
        // the settings screen is.
        meta: { ...data, webhookSecret: undefined } as object,
      },
    });

    // Returned once, like an access key, so it can be copied into the
    // receiving system. It is never listed afterwards.
    return NextResponse.json({ account, ...(issuedSecret ? { webhookSecret: issuedSecret } : {}) });
  } catch (error) {
    console.error('[clients PATCH]', error);
    return NextResponse.json({ error: 'Failed to update client account.' }, { status: 500 });
  }
}

/** Issue a fresh access key. The previous one stops working immediately. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const existing = await prisma.clientAccount.findUnique({
      where: { id: params.id },
      select: { id: true, accessKeyPrefix: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Client account not found.' }, { status: 404 });
    }

    // Keep the prefix so the employer's saved bookmark of "which key is this"
    // still lines up; only the secret changes.
    const key = await issueAccessKey(existing.accessKeyPrefix ?? undefined);

    await prisma.clientAccount.update({
      where: { id: params.id },
      data: {
        accessKeyPrefix: key.prefix,
        accessKeyHash: key.hash,
        accessKeyLast4: key.last4,
        accessKeyRotatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        clientAccountId: params.id,
        actorType: 'MASTER',
        actorId: auth.id,
        actorEmail: auth.email,
        action: 'client_account.rotate_key',
        targetType: 'ClientAccount',
        targetId: params.id,
      },
    });

    return NextResponse.json({ accessKey: key.plaintext });
  } catch (error) {
    console.error('[clients rotate]', error);
    return NextResponse.json({ error: 'Failed to rotate access key.' }, { status: 500 });
  }
}

/** Soft delete, so candidate history is never orphaned. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    await prisma.clientAccount.update({
      where: { id: params.id },
      data: { deletedAt: new Date(), status: 'ARCHIVED', accessKeyHash: null },
    });

    await prisma.auditLog.create({
      data: {
        clientAccountId: params.id,
        actorType: 'MASTER',
        actorId: auth.id,
        actorEmail: auth.email,
        action: 'client_account.archive',
        targetType: 'ClientAccount',
        targetId: params.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[clients DELETE]', error);
    return NextResponse.json({ error: 'Failed to archive client account.' }, { status: 500 });
  }
}
