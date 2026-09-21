'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

interface Package {
  id: string;
  name: string;
  code: string;
  description: string;
  version: string;
  isActive: boolean;
  scenarioCount: number;
  sessionCount: number;
  createdAt: string;
  backdropImageUrl?: string | null;
}

export default function PackageSwitcher({ packages }: { packages: Package[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createVersion, setCreateVersion] = useState('1.0.0');
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingBackgroundId, setUploadingBackgroundId] = useState<string | null>(null);

  async function uploadBackground(packageId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBackgroundId(packageId);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'package-backdrop');

      const uploadRes = await fetch('/api/admin/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Failed to upload background');
      }

      const { url } = await uploadRes.json();

      const updateRes = await fetch(`/api/admin/packages/${packageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backdropImageUrl: url }),
      });

      if (!updateRes.ok) {
        throw new Error('Failed to update package with background image');
      }

      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error uploading background');
    } finally {
      setUploadingBackgroundId(null);
    }
  }

  async function activate(packageId: string) {
    setActivating(packageId);
    setError('');
    try {
      const res = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      if (!res.ok) throw new Error('Failed to activate package');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setActivating(null);
    }
  }

  async function createPackage() {
    if (!createName || !createCode) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: createName,
          code: createCode,
          description: createDescription,
          version: createVersion,
        }),
      });
      if (!res.ok) throw new Error('Failed to create package');
      setIsCreating(false);
      setCreateName('');
      setCreateCode('');
      setCreateDescription('');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setCreating(false);
    }
  }

  async function deletePackage(packageId: string) {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/packages/${packageId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete package');
      }
      setConfirmDelete(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <button onClick={() => setIsCreating(true)} className="btn-primary text-xs px-4 py-2">
          <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Create Package
        </button>
      </div>

      {error && (
        <div className="alert-danger">{error}</div>
      )}
      {packages.length === 0 && (
        <div className="card-p text-center py-16 text-slate-400">
          <p className="text-base font-semibold">No packages found</p>
          <p className="text-sm mt-1">Run the seed script to populate scenario packages.</p>
        </div>
      )}
      {packages.map((pkg) => (
        <div
          key={pkg.id}
          className={`card transition-all duration-200 ${pkg.isActive ? 'border-emerald-300 ring-1 ring-emerald-200' : ''}`}
        >
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start justify-between gap-4">
            {/* Left */}
            <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
              <div className={`flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl text-base sm:text-lg font-black ${pkg.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {pkg.code.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-none">{pkg.name}</h3>
                  {pkg.isActive && (
                    <span className="badge-green text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                      ACTIVE
                    </span>
                  )}
                  <span className="badge-slate text-[10px]">v{pkg.version}</span>
                  <span className="badge-blue text-[10px]">{pkg.code}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">{pkg.description}</p>
                <div className="flex gap-4 sm:gap-5 flex-wrap">
                  <div>
                    <p className="text-lg sm:text-xl font-black text-slate-900">{pkg.scenarioCount}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Scenarios</p>
                  </div>
                  <div className="w-px bg-slate-200" />
                  <div>
                    <p className="text-lg sm:text-xl font-black text-slate-900">{pkg.sessionCount}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Sessions Run</p>
                  </div>
                  <div className="w-px bg-slate-200" />
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      {new Date(pkg.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Added</p>
                  </div>
                </div>

                {/* Background Upload Section */}
                <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-4">
                  {pkg.backdropImageUrl ? (
                    <img src={pkg.backdropImageUrl} alt="Backdrop preview" className="h-10 w-16 object-cover rounded shadow-sm" />
                  ) : (
                    <div className="h-10 w-16 bg-slate-200 rounded flex items-center justify-center text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-700">Package Background</p>
                    <p className="text-[10px] text-slate-500">Visible on candidate assessment screen</p>
                  </div>
                  <div>
                    <label className={`btn-secondary text-xs px-3 py-1.5 cursor-pointer ${uploadingBackgroundId === pkg.id ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploadingBackgroundId === pkg.id ? 'Uploading...' : 'Change'}
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp" 
                        className="hidden" 
                        onChange={(e) => uploadBackground(pkg.id, e)}
                      />
                    </label>
                  </div>
                </div>

              </div>
            </div>

            {/* Action */}
            <div className="flex-shrink-0 self-stretch sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              {pkg.isActive ? (
                <div className="flex items-center justify-end gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Currently Active
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setConfirmDelete(pkg.id)}
                    className="btn-danger text-xs px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 border-none"
                    title="Delete Package"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button
                    id={`activate-${pkg.code}`}
                    onClick={() => activate(pkg.id)}
                    disabled={activating === pkg.id}
                    className="btn-primary text-xs px-4 py-2 disabled:opacity-50"
                  >
                    {activating === pkg.id ? (
                      <>
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Activating…
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                        Set as Active
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}


      {/* Create Modal */}
      {mounted && isCreating && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Create New Package</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">Package Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. Sales Executive Assessment"
                  className="form-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Code</label>
                  <input
                    type="text"
                    value={createCode}
                    onChange={e => setCreateCode(e.target.value)}
                    placeholder="e.g. SALES_V1"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Version</label>
                  <input
                    type="text"
                    value={createVersion}
                    onChange={e => setCreateVersion(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea
                  value={createDescription}
                  onChange={e => setCreateDescription(e.target.value)}
                  placeholder="Describe the purpose of this package..."
                  className="form-textarea h-24"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => setIsCreating(false)} className="btn-ghost text-sm px-4 py-2 text-slate-600">Cancel</button>
              <button onClick={createPackage} disabled={creating || !createName || !createCode} className="btn-primary text-sm px-5 py-2">
                {creating ? 'Creating...' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirm Modal */}
      {mounted && confirmDelete && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm animate-fade-in p-6 text-center relative z-50">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 mx-auto mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">Delete Package?</h3>
            <p className="text-xs text-slate-500 mb-5">This will permanently delete the package and all its scenarios. This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => deletePackage(confirmDelete)}
                disabled={deleting}
                className="btn-danger text-sm disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
