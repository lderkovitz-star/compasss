import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  // Permanently deletes soft-deleted content. Super admins only.
  const auth = await requireAdmin(['SUPER_ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Hard delete soft-deleted scenarios older than 30 days - but only ones no
    // candidate depends on. Answers cascade from the scenario, so deleting one
    // that was answered, or that a sitting under way includes, would take it
    // out of candidates' reports and assessments.
    const scenariosRes = await prisma.$executeRaw`
      DELETE FROM scenarios s
       WHERE s.deleted_at <= ${thirtyDaysAgo}
         AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.scenario_id = s.id)
         AND NOT EXISTS (
           SELECT 1 FROM assessment_sessions a
            WHERE jsonb_typeof(a.scenario_order) = 'array'
              AND a.scenario_order @> to_jsonb(s.id))`;

    // Hard delete soft-deleted packages older than 30 days, except those with
    // sittings (their reports cascade from the package) or invite links.
    const packagesRes = await prisma.scenarioPackage.deleteMany({
      where: {
        deletedAt: { lte: thirtyDaysAgo },
        sessions: { none: {} },
        invites: { none: {} },
      },
    });

    return NextResponse.json({
      success: true,
      purgedScenarios: scenariosRes,
      purgedPackages: packagesRes.count
    });
  } catch (err) {
    console.error('[system PURGE]', err);
    return NextResponse.json({ error: 'Failed to purge data.' }, { status: 500 });
  }
}
