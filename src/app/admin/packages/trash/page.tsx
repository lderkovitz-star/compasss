import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";
import TrashClient from "./TrashClient";

async function getDeletedPackages() {
  return prisma.scenarioPackage.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: { _count: { select: { scenarios: true, sessions: true } } },
  });
}

export default async function PackagesTrashPage() {
  const packages = await getDeletedPackages();

  return (
    <>
      <div className="topbar flex flex-col sm:flex-row sm:items-center items-start gap-2 sm:gap-4 pb-2 sm:pb-0">
        <Link href="/admin/packages" className="py-1 sm:py-2 pr-4 text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 sm:gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[13px] sm:text-sm font-medium">Back to Packages</span>
        </Link>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight mb-0.5">Packages Trash</h1>
          <p className="text-[11px] sm:text-xs text-slate-400">Items are permanently deleted after 30 days</p>
        </div>
      </div>

      <main className="page-content flex-1">
        {packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm font-medium text-slate-500">Trash is empty</p>
            <p className="text-xs text-slate-400 mt-1">No deleted packages found.</p>
          </div>
        ) : (
          <TrashClient packages={packages.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            deletedAt: p.deletedAt?.toISOString() || '',
            scenarioCount: p._count.scenarios
          }))} />
        )}
      </main>
    </>
  );
}
