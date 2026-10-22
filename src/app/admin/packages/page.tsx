import { prisma } from "@/lib/db";
import PackageSwitcher from "./PackageSwitcher";
import AssignmentMatrix from "./AssignmentMatrix";
import Link from "next/link";
import { Trash2 } from "lucide-react";

async function getPackages() {
  return prisma.scenarioPackage.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { scenarios: true, sessions: true } } },
  });
}

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const [packages, settings, accountCount, overrideCount] = await Promise.all([
    getPackages(),
    prisma.platformSettings.findFirst({
      select: {
        sandboxPackageId: true,
        defaultClientPackageId: true,
        defaultSessionDepth: true,
      },
    }),
    prisma.clientAccount.count({ where: { deletedAt: null } }),
    prisma.clientAccount.count({ where: { deletedAt: null, assignedPackageId: { not: null } } }),
  ]);

  return (
    <>
      <main className="page-content flex-1">
        <div className="flex justify-end mb-4">
          <Link 
            href="/admin/packages/trash" 
            className="flex min-h-[44px] items-center gap-2 px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            View Trash
          </Link>
        </div>
        <AssignmentMatrix
          packages={packages.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            scenarioCount: p._count.scenarios,
          }))}
          sandboxPackageId={settings?.sandboxPackageId ?? null}
          defaultClientPackageId={settings?.defaultClientPackageId ?? null}
          defaultSessionDepth={settings?.defaultSessionDepth ?? null}
          accountCount={accountCount}
          overrideCount={overrideCount}
        />

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
