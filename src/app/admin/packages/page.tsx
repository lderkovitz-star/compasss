import { prisma } from "@/lib/db";
import PackageSwitcher from "./PackageSwitcher";
import Link from "next/link";
import { Trash2 } from "lucide-react";

async function getPackages() {
  return prisma.scenarioPackage.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { scenarios: true, sessions: true } } },
  });
}

export default async function PackagesPage() {
  const packages = await getPackages();

  return (
    <>
      <main className="page-content flex-1">
        <div className="flex justify-end mb-4">
          <Link 
            href="/admin/packages/trash" 
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            View Trash
          </Link>
        </div>
        {/* Info Banner */}
        <div className="alert-info flex items-start gap-3 mb-6">
          <svg className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-blue-900">Zero-Downtime Package Switching</p>
            <p className="text-xs text-blue-700 mt-0.5">Only one package can be active at a time. Existing in-progress sessions are not affected by switching.</p>
          </div>
        </div>

        {/* Packages Grid */}
        <PackageSwitcher
          packages={packages.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            description: p.description,
            version: p.version,
            isActive: p.isActive,
            scenarioCount: p._count.scenarios,
            sessionCount: p._count.sessions,
            createdAt: p.createdAt.toISOString(),
            backdropImageUrl: p.backdropImageUrl,
          }))}
        />
      </main>
    </>
  );
}
