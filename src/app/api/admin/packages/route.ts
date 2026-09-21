import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET — list all packages
export async function GET(req: NextRequest) {
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

    // Deactivate all, then activate target — in a transaction
    await prisma.$transaction([
      prisma.scenarioPackage.updateMany({ data: { isActive: false } }),
      prisma.scenarioPackage.update({ where: { id: packageId }, data: { isActive: true } }),
    ]);

    return NextResponse.json({ activated: packageId, name: pkg.name });
  } catch (err) {
    console.error('[packages POST]', err);
    return NextResponse.json({ error: 'Failed to activate package.' }, { status: 500 });
  }
}
