import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * The two platform-wide package slots.
 *
 * These replace the single `isActive` flag, which was the whole problem: one
 * switch decided what every candidate ran, so assigning a pack to one client
 * changed it for the public sandbox and for everyone else too. Three
 * independent slots - sandbox, global client default, and a per-account
 * override on ClientAccount - cannot clobber each other, because there is no
 * longer anything shared to clobber.
 *
 * Resolution order when an invite is issued:
 *   account.assignedPackageId ?? settings.defaultClientPackageId
 *
 * Invites snapshot the package they resolved to, so changing a slot never
 * alters a link already sent or a sitting already in progress.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const settings = await prisma.platformSettings.findFirst({
    select: {
      sandboxPackageId: true,
      defaultClientPackageId: true,
      defaultSessionDepth: true,
    },
  });
  return NextResponse.json({
    sandboxPackageId: settings?.sandboxPackageId ?? null,
    defaultClientPackageId: settings?.defaultClientPackageId ?? null,
    defaultSessionDepth: settings?.defaultSessionDepth ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    for (const field of ['sandboxPackageId', 'defaultClientPackageId'] as const) {
      if (body[field] === undefined) continue;
      const value = body[field] ? String(body[field]) : null;
      if (value) {
        const pkg = await prisma.scenarioPackage.findFirst({
          where: { id: value, deletedAt: null },
          select: { id: true, _count: { select: { scenarios: true } } },
        });
        if (!pkg) {
          return NextResponse.json({ error: 'That package no longer exists.' }, { status: 400 });
        }
        if (pkg._count.scenarios === 0) {
          return NextResponse.json(
            { error: 'That package has no scenarios yet, so an assessment would have nothing to run.' },
            { status: 400 }
          );
        }
      }
      data[field] = value;
    }

    if (body.defaultSessionDepth !== undefined) {
      const raw = body.defaultSessionDepth;
      if (raw === null || raw === '') {
        data.defaultSessionDepth = null;
      } else {
        const depth = Number(raw);
        if (!Number.isInteger(depth) || depth < 1 || depth > 500) {
          return NextResponse.json(
            { error: 'Session depth must be a whole number between 1 and 500, or left empty to run the whole pack.' },
            { status: 400 }
          );
        }
        data.defaultSessionDepth = depth;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
    }

    const current = await prisma.platformSettings.findFirst({ select: { id: true } });
    const saved = current
      ? await prisma.platformSettings.update({ where: { id: current.id }, data })
      : await prisma.platformSettings.create({ data });

    await prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: auth.id,
        action: 'packages.assign',
        targetType: 'PlatformSettings',
        targetId: saved.id,
        meta: data as never,
      },
    });

    return NextResponse.json({
      ok: true,
      sandboxPackageId: saved.sandboxPackageId ?? null,
      defaultClientPackageId: saved.defaultClientPackageId ?? null,
      defaultSessionDepth: saved.defaultSessionDepth ?? null,
    });
  } catch (error) {
    console.error('[packages assignments PATCH]', error);
    return NextResponse.json({ error: 'Could not save the assignment.' }, { status: 500 });
  }
}
