import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { issueAccessKey } from '@/lib/access-key';

export const dynamic = 'force-dynamic';

/** Only platform admins manage employer accounts. */
const MASTER_ROLES = ['SUPER_ADMIN'] as const;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export async function GET() {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  const accounts = await prisma.clientAccount.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      contactEmail: true,
      status: true,
      accessKeyPrefix: true,
      accessKeyLast4: true,
      accessKeyRotatedAt: true,
      assignedPackageId: true,
      createdAt: true,
      assignedPackage: { select: { id: true, name: true } },
      _count: { select: { candidates: true, sessions: true, invites: true } },
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(MASTER_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const { name, contactEmail, assignedPackageId } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Company name is required.' }, { status: 400 });
    }
    if (!contactEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: 'A valid contact email is required.' }, { status: 400 });
    }

    let slug = slugify(name);
    if (!slug) {
      return NextResponse.json({ error: 'Company name must contain letters or numbers.' }, { status: 400 });
    }
    // Slugs are unique; a second "Acme Corp" becomes acme-corp-2.
    for (let n = 2; await prisma.clientAccount.findUnique({ where: { slug } }); n++) {
      slug = `${slugify(name)}-${n}`;
    }

    const key = await issueAccessKey();

    const account = await prisma.clientAccount.create({
      data: {
        name: name.trim(),
        slug,
        contactEmail: contactEmail.trim().toLowerCase(),
        accessKeyPrefix: key.prefix,
        accessKeyHash: key.hash,
        accessKeyLast4: key.last4,
        accessKeyRotatedAt: new Date(),
        assignedPackageId: assignedPackageId || null,
      },
      select: { id: true, name: true, slug: true, contactEmail: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        clientAccountId: account.id,
        actorType: 'MASTER',
        actorId: auth.id,
        actorEmail: auth.email,
        action: 'client_account.create',
        targetType: 'ClientAccount',
        targetId: account.id,
        meta: { name: account.name },
      },
    });

    // The only time the key is ever readable.
    return NextResponse.json({ account, accessKey: key.plaintext }, { status: 201 });
  } catch (error) {
    console.error('[clients POST]', error);
    return NextResponse.json({ error: 'Failed to create client account.' }, { status: 500 });
  }
}
