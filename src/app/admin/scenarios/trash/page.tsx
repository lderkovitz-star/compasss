import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TrashClient from "./TrashClient";

async function getDeletedScenarios() {
  return prisma.scenario.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: {
      package: { select: { name: true, code: true } },
    },
  });
}

export default async function ScenariosTrashPage() {
  const scenarios = await getDeletedScenarios();

  return (
    <>
      <div className="topbar flex items-center gap-4">
        <Link href="/admin/scenarios" className="py-2 pr-4 text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Scenarios</span>
        </Link>
        <div>
          <h1 className="text-base font-bold text-slate-900">Scenarios Trash</h1>
          <p className="text-xs text-slate-400">Items are permanently deleted after 30 days</p>
        </div>
      </div>

      <main className="page-content flex-1">
        {scenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-200 rounded-lg">
            <p className="text-sm font-medium text-slate-500">Trash is empty</p>
            <p className="text-xs text-slate-400 mt-1">No deleted scenarios found.</p>
          </div>
        ) : (
          <TrashClient scenarios={scenarios.map(s => ({
            id: s.id,
            sequenceOrder: s.sequenceOrder,
            narrativeText: s.narrativeText,
            deletedAt: s.deletedAt?.toISOString() || '',
            packageName: s.package?.name ?? 'Unknown Package'
          }))} />
        )}
      </main>
    </>
  );
}
