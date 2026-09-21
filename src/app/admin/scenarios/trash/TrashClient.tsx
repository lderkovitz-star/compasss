"use client";

import { useState } from "react";
import { RefreshCw, Trash } from "lucide-react";
import { useRouter } from "next/navigation";

interface DeletedScenario {
  id: string;
  sequenceOrder: number;
  narrativeText: string;
  deletedAt: string;
  packageName: string;
}

export default function TrashClient({ scenarios }: { scenarios: DeletedScenario[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRecover = async (id: string) => {
    setLoadingId('recover-' + id);
    try {
      const res = await fetch(`/api/admin/scenarios/${id}/recover`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed to recover");
      router.refresh();
    } catch (err) {
      alert("Error recovering scenario");
    } finally {
      setLoadingId(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this scenario? This cannot be undone.")) return;
    setLoadingId('delete-' + id);
    try {
      const res = await fetch(`/api/admin/scenarios/${id}/permanent`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch (err) {
      alert("Error permanently deleting scenario");
    } finally {
      setLoadingId(null);
    }
  };

  const calculateDaysLeft = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const thirtyDaysLater = new Date(deletedDate);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const diff = thirtyDaysLater.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
      {/* Desktop Table View */}
      <div className="hidden md:block w-full">
        <table className="w-full text-left text-sm" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-slate-50/80 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ width: '40%' }}>Scenario</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ width: '15%' }}>Package</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ width: '15%' }}>Deleted Date</th>
              <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ width: '15%' }}>Auto-Delete</th>
              <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ width: '15%' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scenarios.map((scenario) => {
              const date = new Date(scenario.deletedAt);
              const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
              const daysLeft = calculateDaysLeft(scenario.deletedAt);

              return (
                <tr key={scenario.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-900 line-clamp-2 max-w-full" title={scenario.narrativeText}>
                      {scenario.narrativeText || `Scenario ${scenario.sequenceOrder}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium">Sequence: #{scenario.sequenceOrder}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="badge-slate text-xs font-semibold">{scenario.packageName}</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 font-medium" suppressHydrationWarning>{formattedDate}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${daysLeft <= 7 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                      {daysLeft} days
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleRecover(scenario.id)}
                        disabled={loadingId !== null}
                        className="btn-secondary text-xs px-3 py-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingId === 'recover-' + scenario.id ? 'animate-spin' : ''}`} />
                        <span>Recover</span>
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(scenario.id)}
                        disabled={loadingId !== null}
                        className="btn-ghost text-xs px-2.5 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <Trash className={`w-3.5 h-3.5 ${loadingId === 'delete-' + scenario.id ? 'opacity-50' : ''}`} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden divide-y divide-slate-100">
        {scenarios.map((scenario) => {
          const date = new Date(scenario.deletedAt);
          const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          const daysLeft = calculateDaysLeft(scenario.deletedAt);

          return (
            <div key={scenario.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 mb-1">
                    #{scenario.sequenceOrder}
                  </span>
                  <span className="badge-slate text-[10px]">{scenario.packageName}</span>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${daysLeft <= 7 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                  Auto-delete in {daysLeft}d
                </span>
              </div>

              <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg">
                {scenario.narrativeText || `Scenario ${scenario.sequenceOrder}`}
              </p>

              <div className="text-[11px] text-slate-400" suppressHydrationWarning>
                Deleted: {formattedDate}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                <button
                  onClick={() => handleRecover(scenario.id)}
                  disabled={loadingId !== null}
                  className="btn-secondary text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingId === 'recover-' + scenario.id ? 'animate-spin' : ''}`} />
                  <span>Recover</span>
                </button>
                <button
                  onClick={() => handlePermanentDelete(scenario.id)}
                  disabled={loadingId !== null}
                  className="btn-ghost text-xs py-2 px-3 flex items-center justify-center gap-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash className={`w-3.5 h-3.5 ${loadingId === 'delete-' + scenario.id ? 'opacity-50' : ''}`} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

