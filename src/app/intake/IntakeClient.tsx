'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface FormState {
  name: string;
  email: string;
  hobbiesSkills: string;
}

interface IntakeClientProps {
  platformName: string;
  logoUrl?: string | null;
  biometricMode: string;
}

export default function IntakeClient({
  platformName,
  logoUrl,
  biometricMode,
}: IntakeClientProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({ name: '', email: '', hobbiesSkills: '' });
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [biometricConnected, setBiometricConnected] = useState(false);

  const displayBrand = platformName || 'Compass';

  async function connectBiometrics() {
    try {
      const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { bluetooth?: { requestDevice: (opts: unknown) => Promise<{ name?: string }> } }) : null;
      if (!nav?.bluetooth) {
        setError('Bluetooth is not supported in this browser. Use Chrome or Edge.');
        return;
      }
      
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        acceptAllDevices: false
      });
      console.log('Bluetooth Device connected:', device.name);
      setBiometricConnected(true);
      setError('');
    } catch (err: unknown) {
      console.error('Bluetooth error:', err);
      setError('Failed to connect to biometric device. Please ensure Bluetooth is enabled and you selected a device.');
    }
  }

  function handleFile(f: File | null) {
    if (!f) return;
    const valid = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const nameLower = f.name.toLowerCase();
    const isAllowedExt = nameLower.endsWith('.pdf') || nameLower.endsWith('.docx');

    if (!valid.includes(f.type) && !isAllowedExt) {
      setError('Please upload a PDF or DOCX file.');
      return;
    }
    // Vercel rejects request bodies over 4.5 MB before they reach the server,
    // which the browser reports as "Failed to fetch".
    if (f.size > 4 * 1024 * 1024) {
      setError('File must be under 4MB.');
      return;
    }
    setFile(f);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();

    if (!trimmedName) {
      setError('Full name is required.');
      return;
    }
    if (!trimmedEmail) {
      setError('Email address is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }
    if (biometricMode === 'required' && !biometricConnected) {
      setError('Biometric connection is required to proceed. Please connect your Heart Rate Monitor.');
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const fd = new FormData();
      fd.append('name', trimmedName);
      fd.append('email', trimmedEmail);
      if (form.hobbiesSkills) {
        fd.append('hobbiesSkills', form.hobbiesSkills);
      }
      if (file) {
        fd.append('resume', file);
      }

      const res = await fetch('/api/intake', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let json: any = null;
      try {
        json = await res.json();
      } catch (jsonErr) {
        console.error('Failed to parse response JSON:', jsonErr);
      }

      if (!res.ok) {
        throw new Error(json?.error || `Submission failed (HTTP ${res.status}).`);
      }

      if (!json?.sessionId) {
        throw new Error('Assessment session initialization failed. Missing session identifier.');
      }

      router.push(`/assessment/${json.sessionId}`);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      console.error('[intake submission error]:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Submission timed out. The server took too long to process. Please check your connection and try again.');
      } else if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) {
        setError('Network connection interrupted. Please verify server status and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1220] text-[#F3F5FA] selection:bg-[#2E63F6] selection:text-white overflow-x-hidden font-sans relative">
      {/* BACKGROUND EFFECT */}
      <div className="fixed inset-0 pointer-events-none opacity-40 z-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% -20%, black 0%, transparent 75%)',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% -20%, black 0%, transparent 75%)'
      }}></div>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B1220]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-[1180px] mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-[#2E63F6] to-[#1B3FA8] shadow-[0_0_18px_rgba(46,99,246,0.5)] border border-[#5B8CFF]/40 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] sm:text-[15px] font-bold tracking-tight text-white leading-tight truncate">{displayBrand}</div>
              <div className="text-[8px] sm:text-[10px] text-[#5B6580] tracking-[0.08em] uppercase leading-tight mt-0.5 font-semibold truncate hidden sm:block">Candidate Intake</div>
            </div>
          </Link>
          <Link href="/" className="text-[#97A2BE] text-[11px] sm:text-[13px] font-medium px-2.5 sm:px-3.5 py-1.5 rounded-md sm:rounded-lg hover:text-white hover:bg-white/5 border border-white/10 transition-all flex items-center gap-1 sm:gap-1.5 flex-shrink-0 shadow-sm whitespace-nowrap">
            <svg className="h-3 sm:h-3.5 w-3 sm:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            <span className="hidden sm:inline">Return to Portal</span>
            <span className="sm:hidden">Portal</span>
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-24 sm:pt-28 pb-12 sm:pb-16 relative z-10">

        {/* Header */}
        <div className="mb-8 sm:mb-12 text-center animate-fade-in">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white tracking-tight leading-tight">
            Establish your <em className="italic text-[#5B8CFF] font-medium">profile.</em>
          </h1>
          <p className="mt-3 sm:mt-4 max-w-[560px] mx-auto text-xs sm:text-sm md:text-[15px] leading-relaxed sm:leading-[1.65] text-[#97A2BE]">
            Complete your profile to begin the cognitive assessment. Your data is stored securely and shared only with your evaluating organization.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 animate-slide-up">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 sm:p-4 text-xs sm:text-[14px] text-red-400 flex items-center gap-3 backdrop-blur-md">
              <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Personal Details */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-md shadow-xl">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B8CFF] border-b border-white/10 pb-3 sm:pb-4 mb-4 sm:mb-5">Personal Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="block text-[12px] font-medium text-[#97A2BE] mb-1.5 sm:mb-2" htmlFor="name">Full Name *</label>
                <input
                  id="name"
                  className="w-full rounded-xl border border-white/10 bg-[#0B1220]/50 px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-[14px] text-white placeholder-[#5B6580] outline-none transition-all focus:border-[#5B8CFF] focus:ring-1 focus:ring-[#5B8CFF]"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#97A2BE] mb-1.5 sm:mb-2" htmlFor="email">Email Address *</label>
                <input
                  id="email"
                  type="email"
                  className="w-full rounded-xl border border-white/10 bg-[#0B1220]/50 px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-[14px] text-white placeholder-[#5B6580] outline-none transition-all focus:border-[#5B8CFF] focus:ring-1 focus:ring-[#5B8CFF]"
                  placeholder="Your email address"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
            </div>
          </div>

          {/* AI Intake Section */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-md shadow-xl">
            <div className="border-b border-white/10 pb-3 sm:pb-4 mb-4 sm:mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B8CFF]">AI Intake Context</h2>
                <p className="text-[12px] text-[#97A2BE] mt-0.5">Role titles, job requirements, skills & experience context</p>
              </div>
              <span className="text-[10px] font-medium text-[#97A2BE] uppercase tracking-[0.08em] bg-white/5 border border-white/10 px-2 py-0.5 sm:py-1 rounded-md">Optional</span>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#97A2BE] mb-1.5 sm:mb-2" htmlFor="hobbiesSkills">
                Target Role & Qualifications Context
              </label>
              <textarea
                id="hobbiesSkills"
                rows={6}
                className="w-full rounded-xl border border-white/10 bg-[#0B1220]/50 px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-[14px] text-white placeholder-[#5B6580] outline-none transition-all focus:border-[#5B8CFF] focus:ring-1 focus:ring-[#5B8CFF] min-h-[140px] resize-y whitespace-pre-wrap leading-relaxed"
                placeholder="Include target role title, executive competencies, job requirements, or background highlights for our AI to extract automatically...&#10;&#10;e.g.&#10;Target Role: Chief Operating Officer (COO)&#10;Key Competencies: P&L management, crisis operations, cross-border restructuring&#10;Background: 15+ years enterprise leadership across operations and transformation..."
                value={form.hobbiesSkills}
                onChange={e => setForm(f => ({ ...f, hobbiesSkills: e.target.value }))}
                wrap="soft"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mt-2.5 text-[11px] text-[#5B6580]">
                <span>
                  Our AI pipeline automatically identifies role titles, competencies, and evaluation traits.
                </span>
                <span className="font-mono text-[10.5px] text-[#97A2BE]/70 flex-shrink-0">
                  {form.hobbiesSkills.trim() ? `${form.hobbiesSkills.trim().split(/\s+/).filter(Boolean).length} words · ` : ''}{form.hobbiesSkills.length.toLocaleString()} characters
                </span>
              </div>
            </div>
          </div>

          {/* Biometric Integration */}
          {biometricMode !== 'disabled' && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-md shadow-xl animate-fade-in">
              <div className="border-b border-white/10 pb-3 sm:pb-4 mb-4 sm:mb-5 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#35E0C8]">Biometric Telemetry</h2>
                <span className={`text-[10px] font-medium uppercase tracking-[0.08em] px-2 py-0.5 sm:py-1 rounded-md ${biometricMode === 'required' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white/5 text-[#97A2BE] border border-white/10'}`}>
                  {biometricMode === 'required' ? 'Required' : 'Optional'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-xs sm:text-[13px] text-[#97A2BE] leading-relaxed mb-4">
                    Connect a Bluetooth Low Energy (BLE) Heart Rate Monitor. This telemetry data is used to analyze stress responses and cognitive load during high-pressure scenarios.
                  </p>
                  <button
                    type="button"
                    onClick={connectBiometrics}
                    className={`px-5 py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold transition-all flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto ${
                      biometricConnected 
                        ? 'bg-[#35E0C8]/20 text-[#35E0C8] border border-[#35E0C8]/30 cursor-default'
                        : 'bg-[#2E63F6] text-white hover:bg-[#5B8CFF] shadow-[0_4px_14px_0_rgba(46,99,246,0.39)]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {biometricConnected ? 'Telemetry Stream Active' : 'Connect BLE Device'}
                  </button>
                </div>
                {biometricConnected && (
                  <div className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 flex items-center justify-center rounded-full bg-[#35E0C8]/10 border border-[#35E0C8]/30 shadow-[0_0_15px_rgba(53,224,200,0.2)]">
                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#35E0C8] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resume Upload */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 md:p-8 backdrop-blur-md shadow-xl">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B8CFF] border-b border-white/10 pb-4 mb-5">Resume / CV</h2>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                dragging ? 'border-[#5B8CFF] bg-[#5B8CFF]/10' : file ? 'border-[#35E0C8] bg-[#35E0C8]/10' : 'border-white/15 bg-[#0B1220]/50 hover:border-white/30'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0] ?? null); }}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden" onChange={e => handleFile(e.target.files?.[0] ?? null)} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#35E0C8]/20 border border-[#35E0C8]/30">
                    <svg className="h-5 w-5 text-[#35E0C8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-[14px] font-semibold text-white">{file.name}</p>
                    <p className="text-[12px] text-[#97A2BE]">{(file.size / 1024).toFixed(0)} KB · Ready to upload</p>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} className="ml-3 text-[#5B6580] hover:text-[#FF6B6B] transition-colors p-1">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <div className="h-10 w-10 mx-auto rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                    <svg className="h-5 w-5 text-[#97A2BE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-white mb-1">Drag & drop your resume here</p>
                  <p className="text-[11.5px] text-[#5B6580]">or click to browse — PDF or DOCX, max 4MB</p>
                </>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-6 pb-12">
            <button
              id="submit-intake"
              type="submit"
              disabled={loading || (biometricMode === 'required' && !biometricConnected)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-[14.5px] font-semibold bg-[#2E63F6] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_28px_-12px_rgba(46,99,246,0.55)] hover:bg-[#5B8CFF] transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#2E63F6] disabled:active:scale-100"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Initializing simulation…
                </>
              ) : (
                <>
                  Begin Assessment Simulation
                  <svg className="h-4 w-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 9l3 3m0 0l-3 3m3-3H8"/>
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
