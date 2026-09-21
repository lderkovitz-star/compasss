import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete packages older than 30 days
    // Due to cascading deletion set in Prisma schema on scenarios related to package, 
    // it will delete scenarios and options of those packages as well, if we use hard delete.
    // However, if some scenarios were soft-deleted but their package was not, we should also delete them.
    
    // Hard delete soft-deleted scenarios older than 30 days
    const scenariosRes = await prisma.scenario.deleteMany({
      where: {
        deletedAt: {
          lte: thirtyDaysAgo
        }
      }
    });

    // Hard delete soft-deleted packages older than 30 days
    const packagesRes = await prisma.scenarioPackage.deleteMany({
      where: {
        deletedAt: {
          lte: thirtyDaysAgo
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      purgedScenarios: scenariosRes.count,
      purgedPackages: packagesRes.count
    });
  } catch (err) {
    console.error('[system PURGE]', err);
    return NextResponse.json({ error: 'Failed to purge data.' }, { status: 500 });
  }
}
