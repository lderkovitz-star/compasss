"use client";

import { useState } from "react";
import { RefreshCw, Trash } from "lucide-react";
import { useRouter } from "next/navigation";

interface DeletedPackage {
  id: string;
  name: string;
  code: string;
  deletedAt: string;
  scenarioCount: number;
}

export default function TrashClient({ packages }: { packages: DeletedPackage[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [packageToDelete, setPackageToDelete] = useState<string | null>(null);

  const handleRecover = async (id: string) => {
    setLoadingId('recover-' + id);
    try {
      const res = await fetch(`/api/admin/packages/${id}/recover`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed to recover");
      router.refresh();
    } catch (err) {
      alert("Error recovering package");
    } finally {
      setLoadingId(null);
    }
  };

  const confirmDelete = (id: string) => {
    setPackageToDelete(id);
  };

  const handlePermanentDelete = async () => {
    if (!packageToDelete) return;
    setLoadingId('delete-' + packageToDelete);
    try {
      const res = await fetch(`/api/admin/packages/${packageToDelete}/permanent`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch (err) {
      alert("Error permanently deleting package");
    } finally {
      setLoadingId(null);
      setPackageToDelete(null);
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
              <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ width: '40%' }}>Package</th>
              <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ width: '20%' }}>Deleted Date</th>
              <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ width: '20%' }}>Auto-Delete</th>
              <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" style={{ width: '20%' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.map((pkg) => {
              const date = new Date(pkg.deletedAt);
              const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
              const daysLeft = calculateDaysLeft(pkg.deletedAt);

              return (
                <tr key={pkg.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-900">{pkg.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Code: <span className="font-medium text-slate-700">{pkg.code}</span> • {pkg.scenarioCount} scenarios</p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 text-xs" suppressHydrationWarning>{formattedDate}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${daysLeft <= 7 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                      {daysLeft} days
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleRecover(pkg.id)}
                        disabled={loadingId !== null}
                        className="btn-secondary text-xs px-3 py-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingId === 'recover-' + pkg.id ? 'animate-spin' : ''}`} />
                        <span>Recover</span>
                      </button>
                      <button
                        onClick={() => confirmDelete(pkg.id)}
                        disabled={loadingId !== null}
                        className="btn-ghost text-xs px-2.5 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <Trash className={`w-3.5 h-3.5 ${loadingId === 'delete-' + pkg.id ? 'opacity-50' : ''}`} />
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
        {packages.map((pkg) => {
          const date = new Date(pkg.deletedAt);
          const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          const daysLeft = calculateDaysLeft(pkg.deletedAt);

          return (
            <div key={pkg.id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{pkg.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Code: <span className="font-semibold text-slate-700">{pkg.code}</span> • {pkg.scenarioCount} scenarios</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${daysLeft <= 7 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                  Auto-delete in {daysLeft}d
                </span>
              </div>

              <div className="text-[11px] text-slate-400" suppressHydrationWarning>
                Deleted: {formattedDate}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                <button
                  onClick={() => handleRecover(pkg.id)}
                  disabled={loadingId !== null}
                  className="btn-secondary text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingId === 'recover-' + pkg.id ? 'animate-spin' : ''}`} />
                  <span>Recover</span>
                </button>
                <button
                  onClick={() => confirmDelete(pkg.id)}
                  disabled={loadingId !== null}
                  className="btn-ghost text-xs py-2 px-3 flex items-center justify-center gap-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash className={`w-3.5 h-3.5 ${loadingId === 'delete-' + pkg.id ? 'opacity-50' : ''}`} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {packageToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Permanently Delete Package?</h3>
              <p className="text-sm text-slate-500">
                Are you sure you want to permanently delete this package? This cannot be undone and all associated data will be permanently removed.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setPackageToDelete(null)}
                disabled={loadingId !== null}
                className="btn-secondary px-4 py-2 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={loadingId !== null}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

