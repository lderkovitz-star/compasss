import Link from 'next/link';
import { prisma } from '@/lib/db';
import ScenariosClient from './ScenariosClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getData() {
  const [packages, scenarios, optionCount] = await Promise.all([
    prisma.scenarioPackage.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } }),
    prisma.scenario.findMany({
      where: { deletedAt: null },
      orderBy: [{ packageId: 'asc' }, { sequenceOrder: 'asc' }],
      include: {
        package: { select: { name: true, code: true, isActive: true } },
        _count: { select: { options: true } },
      },
    }),
    prisma.scenarioOption.count({ where: { scenario: { deletedAt: null } } }),
  ]);
  return { packages, scenarios, optionCount };
}

export default async function ScenariosPage() {
  const { packages, scenarios, optionCount } = await getData();

  // Per-package scenario counts
  const scenariosPerPackage: Record<string, number> = {};
  for (const s of scenarios) {
    scenariosPerPackage[s.packageId] = (scenariosPerPackage[s.packageId] || 0) + 1;
  }

  return (
    <>
      <main className="page-content flex-1">
        <div className="flex items-center justify-between sm:justify-end gap-2 mb-4 flex-wrap">
          <Link href="/admin/packages" className="btn-secondary text-xs px-3 sm:px-4 py-2 flex-1 sm:flex-initial justify-center">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
            <span>Manage Packages</span>
          </Link>
          <Link 
            href="/admin/scenarios/trash" 
            className="btn-secondary text-xs px-3 py-2 flex-1 sm:flex-initial justify-center items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            <span>View Trash</span>
          </Link>
        </div>
        {/* Stats — fully dynamic from DB */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <div className="stat-icon bg-blue-50">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              </div>
            </div>
            <p className="stat-value">{scenarios.length}</p>
            <p className="stat-label">Total Scenarios</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <div className="stat-icon bg-emerald-50">
                <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </div>
            </div>
            <p className="stat-value">{packages.length}</p>
            <p className="stat-label">Packages</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <div className="stat-icon bg-violet-50">
                <svg className="h-5 w-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
              </div>
            </div>
            <p className="stat-value">{optionCount}</p>
            <p className="stat-label">Total Options</p>
          </div>
        </div>

        {/* Scenarios client with edit/delete */}
        <ScenariosClient
          packages={packages.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            isActive: p.isActive,
            scenarioCount: scenariosPerPackage[p.id] || 0,
          }))}
          scenarios={scenarios.map(s => ({
            id: s.id,
            sequenceOrder: s.sequenceOrder,
            narrativeText: s.narrativeText,
            timeLimitSec: s.timeLimitSec,
            packageId: s.packageId,
            packageName: s.package?.name ?? '',
            packageCode: s.package?.code ?? '',
            packageIsActive: s.package?.isActive ?? false,
            optionCount: s._count.options,
          }))}
        />
      </main>
    </>
  );
}
