import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, WRITE_ROLES } from '@/lib/auth';

// GET — list all packages
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const isDeleted = status === 'deleted';

    const packages = await prisma.scenarioPackage.findMany({
      where: {
        deletedAt: isDeleted ? { not: null } : null
      },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { scenarios: true, sessions: true } },
      },
    });
    return NextResponse.json(packages);
  } catch (err) {
    console.error('[packages GET]', err);
    return NextResponse.json({ error: 'Failed to list packages.' }, { status: 500 });
  }
}

// POST — activate or create a package
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(WRITE_ROLES);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();

    if (body.action === 'create') {
      const { name, code, description, version } = body;
      if (!name || !code) {
        return NextResponse.json({ error: 'Name and code are required.' }, { status: 400 });
      }
      const pkg = await prisma.scenarioPackage.create({
        data: {
          name,
          code,
          description: description || '',
          version: version || '1.0.0',
        }
      });
      return NextResponse.json(pkg, { status: 201 });
    }

    const { packageId } = body;
    if (!packageId) {
      return NextResponse.json({ error: 'packageId is required for activation.' }, { status: 400 });
    }

    // Verify package exists
    const pkg = await prisma.scenarioPackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
    }

    // What a visitor practising on the public page runs is the sandbox slot,
    // and that is what this button is for - switching the live demo pack
    // mid-meeting. It used to write `isActive`, which nothing has read since
    // the three slots replaced it, so the screen claimed a pack was live while
    // the site went on serving another one.
    //
    // `isActive` is still kept in step. It decides nothing, but it is read
    // back by this screen's older callers and costs nothing to maintain.
    const settings = await prisma.platformSettings.findFirst({ select: { id: true } });

    await prisma.$transaction([
      prisma.scenarioPackage.updateMany({ data: { isActive: false } }),
      prisma.scenarioPackage.update({ where: { id: packageId }, data: { isActive: true } }),
      settings
        ? prisma.platformSettings.update({
            where: { id: settings.id },
            data: { sandboxPackageId: packageId },
          })
        : prisma.platformSettings.create({ data: { sandboxPackageId: packageId } }),
    ]);

    return NextResponse.json({ activated: packageId, name: pkg.name, slot: 'sandbox' });
  } catch (err) {
    console.error('[packages POST]', err);
    return NextResponse.json({ error: 'Failed to activate package.' }, { status: 500 });
  }
}
