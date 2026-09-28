'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Image from 'next/image';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // General Settings
  const [platformName, setPlatformName] = useState('Compass');
  const [supportEmail, setSupportEmail] = useState('support@compass.com');
  const [biometricMode, setBiometricMode] = useState('disabled');

  // Media / Branding
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBackdrop, setUploadingBackdrop] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLInputElement>(null);

  // AI Config
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiPromptTemplate, setAiPromptTemplate] = useState('');
  const [savingAI, setSavingAI] = useState(false);

  // Packages State
  const [packages, setPackages] = useState<any[]>([]);
  const [uploadingPackageId, setUploadingPackageId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/settings', { cache: 'no-store' }).then(res => res.json()),
      fetch('/api/admin/packages', { cache: 'no-store' }).then(res => res.json())
    ])
      .then(([settingsData, packagesData]) => {
        if (settingsData && !settingsData.error) {
          setPlatformName(settingsData.platformName ?? 'Compass');
          setSupportEmail(settingsData.supportEmail ?? 'support@compass.com');
          setBiometricMode(settingsData.biometricMode ?? 'disabled');
          setLogoUrl(settingsData.logoUrl ?? null);
          setBackdropUrl(settingsData.defaultBackdropUrl ?? null);
          setAnthropicApiKey(settingsData.anthropicApiKey ?? '');
          setAiPromptTemplate(settingsData.aiPromptTemplate ?? '');
        }
        if (Array.isArray(packagesData)) {
          setPackages(packagesData);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const triggerSave = async (updates: any = {}) => {
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          platformName, 
          supportEmail, 
          biometricMode, 
          logoUrl, 
          defaultBackdropUrl: backdropUrl, 
          ...updates 
        }),
      });
      toast.success('Settings saved');
      router.refresh();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSave();
  };

  const handleAISave = async () => {
    setSavingAI(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformName, supportEmail, biometricMode,
          anthropicApiKey,
          aiPromptTemplate,
        }),
      });
      toast.success('AI configuration saved');
      router.refresh();
    } catch {
      toast.error('Failed to save AI config');
    } finally {
      setSavingAI(false);
    }
  };

  async function handleMediaUpload(file: File, type: 'logo' | 'backdrop') {
    if (type === 'logo') setUploadingLogo(true);
    else setUploadingBackdrop(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);

      const res = await fetch('/api/admin/media/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Upload failed');
      }
      const data = await res.json();
      if (type === 'logo') setLogoUrl(data.url);
      else setBackdropUrl(data.url);
      toast.success(`${type === 'logo' ? 'Logo' : 'Backdrop'} uploaded successfully`);
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else setUploadingBackdrop(false);
    }
  }

  async function handlePackageBackdropUpload(packageId: string, file: File) {
    setUploadingPackageId(packageId);
    try {
      // 1. Upload the image
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'package-backdrop');

      const uploadRes = await fetch('/api/admin/media/upload', { method: 'POST', body: fd });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();

      // 2. Save the URL to the package
      const saveRes = await fetch(`/api/admin/packages/${packageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backdropImageUrl: uploadData.url }),
      });
      if (!saveRes.ok) throw new Error('Failed to save to package');

      // 3. Update local state
      setPackages(prev => prev.map(p => 
        p.id === packageId ? { ...p, backdropImageUrl: uploadData.url } : p
      ));
      toast.success('Package background updated');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update package background');
    } finally {
      setUploadingPackageId(null);
    }
  }

  async function handleRemovePackageBackdrop(packageId: string) {
    try {
      const saveRes = await fetch(`/api/admin/packages/${packageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backdropImageUrl: null }),
      });
      if (!saveRes.ok) throw new Error('Failed to remove package background');

      setPackages(prev => prev.map(p => 
        p.id === packageId ? { ...p, backdropImageUrl: null } : p
      ));
      toast.success('Package background removed');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove package background');
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Platform Settings</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Configure global platform behavior, branding, and integrations.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Saving...
            </>
          ) : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* ── General Settings ────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900">General Information</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Platform Name</label>
                <input
                  type="text"
                  value={platformName}
                  onChange={e => setPlatformName(e.target.value)}
                  placeholder="e.g. Compass"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm text-slate-900 bg-white font-medium placeholder:text-slate-400 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Support Contact Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={e => setSupportEmail(e.target.value)}
                  placeholder="support@compass.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-sm text-slate-900 bg-white font-medium placeholder:text-slate-400 shadow-sm"
                />
              </div>
            </div>
          </section>

          {/* ── Graphics & Media Manager ─────────────────────────── */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900">Graphics & Media Manager</h2>
              <p className="text-xs text-slate-500 mt-0.5">Upload scenario backdrops and platform logos. Changes apply immediately to the candidate experience.</p>
            </div>
            <div className="p-5 space-y-6">

              {/* Logo Upload */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">Platform Logo</p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain transition-opacity duration-500 opacity-100" />
                    ) : (
                      <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input ref={logoRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'logo'); }} />
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => logoRef.current?.click()}
                        disabled={uploadingLogo}
                        className="w-full sm:w-auto justify-center px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition text-slate-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {uploadingLogo ? (
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                          </svg>
                        )}
                        {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                      </button>
                      
                      {logoUrl && (
                        <button
                          onClick={() => {
                            setLogoUrl(null);
                            triggerSave({ logoUrl: null });
                          }}
                          className="w-full sm:w-auto justify-center px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">PNG, SVG, JPG · Max 5MB</p>
                    {logoUrl && <p className="text-xs text-emerald-600 font-medium truncate max-w-xs">{logoUrl}</p>}
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* Backdrop Upload */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Default Scenario Backdrop</p>
                <p className="text-xs text-slate-400 mb-3">This backdrop appears on the candidate assessment screen. You can also set per-scenario backdrops in the Scenario Editor.</p>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="w-32 h-20 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center flex-shrink-0">
                    {backdropUrl ? (
                      <img src={backdropUrl} alt="Backdrop" className="w-full h-full object-cover transition-opacity duration-500 opacity-100" />
                    ) : (
                      <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input ref={backdropRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], 'backdrop'); }} />
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => backdropRef.current?.click()}
                        disabled={uploadingBackdrop}
                        className="w-full sm:w-auto justify-center px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition text-slate-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {uploadingBackdrop ? (
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                          </svg>
                        )}
                        {uploadingBackdrop ? 'Uploading…' : 'Upload Backdrop'}
                      </button>
                      
                      {backdropUrl && (
                        <button
                          onClick={() => {
                            setBackdropUrl(null);
                            triggerSave({ defaultBackdropUrl: null });
                          }}
                          className="w-full sm:w-auto justify-center px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">PNG, JPG, WebP · Max 5MB · Recommended 1920×1080</p>
                    {backdropUrl && <p className="text-xs text-emerald-600 font-medium truncate max-w-xs">{backdropUrl}</p>}
                  </div>
                </div>
              </div>

              {packages.length > 0 && (
                <>
                  <div className="h-px bg-slate-100" />
                  
                  {/* Package-Specific Backdrops */}
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Package-Specific Backdrops</p>
                    <p className="text-xs text-slate-400 mb-4">Assign a custom background to each package. Overrides the default backdrop above.</p>
                    
                    <div className="space-y-3">
                      {packages.map((pkg) => (
                        <div key={pkg.id} className="rounded-lg border border-slate-100 bg-slate-50/50 overflow-hidden">
                          {/* Card: thumbnail row */}
                          <div className="flex items-center gap-3 p-3">
                            {/* Thumbnail */}
                            <div className="w-14 h-9 sm:w-16 sm:h-10 rounded border border-slate-200 overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                              {pkg.backdropImageUrl ? (
                                <img src={pkg.backdropImageUrl} alt={pkg.name} className="w-full h-full object-cover" />
                              ) : (
                                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                </svg>
                              )}
                            </div>
                            {/* Package info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{pkg.name}</p>
                              <p className="text-[10px] sm:text-xs text-slate-400 font-mono mt-0.5 truncate">{pkg.code}</p>
                            </div>
                            {/* Buttons — hidden on very small screens, shown inline on sm+ */}
                            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                id={`upload-${pkg.id}`}
                                onChange={e => {
                                  if (e.target.files?.[0]) handlePackageBackdropUpload(pkg.id, e.target.files[0]);
                                }}
                              />
                              <button
                                onClick={() => document.getElementById(`upload-${pkg.id}`)?.click()}
                                disabled={uploadingPackageId === pkg.id}
                                className="px-3 py-1.5 text-xs font-medium border border-slate-300 text-slate-600 rounded bg-white hover:bg-slate-50 disabled:opacity-50 transition whitespace-nowrap"
                              >
                                {uploadingPackageId === pkg.id ? 'Uploading...' : (pkg.backdropImageUrl ? 'Change' : 'Upload')}
                              </button>
                              {pkg.backdropImageUrl && (
                                <button
                                  onClick={() => handleRemovePackageBackdrop(pkg.id)}
                                  disabled={uploadingPackageId === pkg.id}
                                  className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded bg-white hover:bg-red-50 disabled:opacity-50 transition flex items-center gap-1 whitespace-nowrap"
                                >
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                  </svg>
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Mobile-only: full-width action buttons below the info row */}
                          <div className="sm:hidden border-t border-slate-100 px-3 py-2 flex gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id={`upload-mobile-${pkg.id}`}
                              onChange={e => {
                                if (e.target.files?.[0]) handlePackageBackdropUpload(pkg.id, e.target.files[0]);
                              }}
                            />
                            <button
                              onClick={() => document.getElementById(`upload-mobile-${pkg.id}`)?.click()}
                              disabled={uploadingPackageId === pkg.id}
                              className="flex-1 py-2 text-xs font-medium border border-slate-300 text-slate-600 rounded bg-white hover:bg-slate-50 disabled:opacity-50 transition text-center"
                            >
                              {uploadingPackageId === pkg.id ? 'Uploading...' : (pkg.backdropImageUrl ? 'Change' : 'Upload')}
                            </button>
                            {pkg.backdropImageUrl && (
                              <button
                                onClick={() => handleRemovePackageBackdrop(pkg.id)}
                                disabled={uploadingPackageId === pkg.id}
                                className="flex-1 py-2 text-xs font-medium border border-red-200 text-red-600 rounded bg-white hover:bg-red-50 disabled:opacity-50 transition flex items-center justify-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>



          {/* ── AI Backend Configuration ─────────────────────────── */}
          <section className="bg-white rounded-xl border border-violet-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-violet-100 bg-violet-50/50">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <h2 className="text-sm font-bold text-slate-900">AI Backend Configuration</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 ml-6">Powers the background candidate tiering in the Coordinator View. Never runs during candidate sessions.</p>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Anthropic API Key
                  <span className="ml-2 text-xs text-slate-400 font-normal">(sk-ant-...)</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={anthropicApiKey}
                    onChange={e => setAnthropicApiKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm font-mono text-slate-900 bg-white placeholder:text-slate-400 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showApiKey ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Your key is stored securely in the database. It is never sent to the candidate&apos;s browser.</p>
              </div>

              <div>
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    AI Prompt Template
                    <span className="ml-2 text-xs text-slate-400 font-normal">(Optional — leave blank for default)</span>
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const data = {
                          prompt: `Evaluate the candidate's performance.\nCandidate: {{candidate_name}}\nRole: {{target_role}}\n\nMetrics:\n- Decisiveness: {{decisiveness}}/100\n- Risk Tolerance: {{risk_tolerance}}/100\n- Resource Preservation: {{resource_preservation}}/100\n- Avg Time: {{avg_time_ms}}ms\n\nBased on these metrics, provide a performance tier (e.g., HIGH, MEDIUM, LOW) and a brief rationale.`
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'sample-prompt.json';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex-1 justify-center px-3 py-2 sm:py-1.5 text-xs font-medium border border-violet-200 text-violet-700 rounded-lg bg-violet-50 hover:bg-violet-100 transition flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                      </svg>
                      Download Sample JSON
                    </button>
                    
                    <input
                      type="file"
                      accept=".json,.txt"
                      id="prompt-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          try {
                            if (file.name.endsWith('.json')) {
                              const parsed = JSON.parse(content);
                              if (parsed.prompt) {
                                setAiPromptTemplate(parsed.prompt);
                              } else {
                                alert("Invalid JSON format. Expected a 'prompt' key.");
                              }
                            } else {
                              setAiPromptTemplate(content);
                            }
                          } catch (err) {
                            alert("Failed to parse file.");
                          }
                        };
                        reader.readAsText(file);
                        e.target.value = ''; // Reset input
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('prompt-upload')?.click()}
                      className="flex-1 justify-center px-3 py-2 sm:py-1.5 text-xs font-medium border border-slate-300 text-slate-700 rounded-lg bg-white hover:bg-slate-50 transition flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                      Upload JSON / Text
                    </button>
                  </div>
                </div>
                <textarea
                  value={aiPromptTemplate}
                  onChange={e => setAiPromptTemplate(e.target.value)}
                  rows={9}
                  placeholder={`Available variables:\n{{candidate_name}}, {{target_role}}, {{intake_context}}, {{package_name}}\n{{decisiveness}}, {{risk_tolerance}}, {{resource_preservation}}\n{{avg_time_ms}}, {{total_switches}}, {{completed_at}}`}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm font-mono resize-y text-slate-900 bg-white placeholder:text-slate-400 shadow-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 sm:pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Uses <strong className="text-violet-700">Claude 3 Haiku</strong> — fast, cost-effective batch model.
                </p>
                <button
                  onClick={handleAISave}
                  disabled={savingAI}
                  className="w-full sm:w-auto justify-center px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {savingAI ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  )}
                  {savingAI ? 'Saving…' : 'Save AI Config'}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: System Status */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900">System Integrations</h2>
            </div>
            <div className="p-5 space-y-4">
              {[
                { icon: '🗂️', label: 'Local File System', status: 'Active', detail: 'Resumes & Media assets', color: 'text-slate-500', bg: 'bg-slate-100' },
                { icon: '🤖', label: 'Anthropic Claude', status: anthropicApiKey ? 'Key Configured' : 'Key Not Set', detail: 'Background AI Tiering', color: anthropicApiKey ? 'text-emerald-600' : 'text-amber-600', bg: anthropicApiKey ? 'bg-emerald-50' : 'bg-amber-50' },
                { icon: '📄', label: 'react-pdf/renderer', status: 'Active', detail: 'Report Generation Engine', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { icon: '🗄️', label: 'PostgreSQL', status: 'Connected', detail: 'Prisma ORM Managed', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded ${item.bg} flex items-center justify-center flex-shrink-0 text-base`}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className={`text-xs mt-0.5 font-medium ${item.color}`}>{item.status}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
