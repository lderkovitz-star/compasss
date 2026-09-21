'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
// Heroicons for UI icons
import {
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface LoginFormProps {
  initialPlatformName: string;
  initialPlatformLogo: string | null;
}

export function LoginForm({ initialPlatformName, initialPlatformLogo }: LoginFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.push(from);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A192F] p-12 flex-col items-center justify-center relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          {initialPlatformLogo ? (
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2E63F6] to-[#1B3FA8] shadow-[0_0_25px_rgba(46,99,246,0.5)] border border-[#5B8CFF]/40 overflow-hidden">
              <img src={initialPlatformLogo} alt="Platform Logo" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="bg-blue-500 p-4 rounded-2xl shadow-lg">
              <ShieldCheckIcon className="text-white w-8 h-8" />
            </div>
          )}
          <div className="mt-2">
            <h2 className="text-white text-3xl font-bold tracking-tight">{initialPlatformName}</h2>
            <p className="text-blue-400 text-[11px] font-bold tracking-[0.2em] uppercase mt-2">Admin Portal</p>
          </div>
          <div className="w-8 h-1 bg-cyan-400 rounded-full mt-4 mb-4"></div>
          <p className="text-slate-300 text-sm max-w-sm leading-relaxed">
            Evaluate cognitive abilities, track candidate performance, and gain actionable insights with our advanced assessment platform.
          </p>
        </div>
      </div>

      {/* Right Panel - Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-white">
        <div className="w-full max-w-lg">
          <div className="mb-8 sm:mb-10 text-center lg:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sign in to your account</h1>
            <p className="text-slate-500 mt-2 text-xs sm:text-sm">Access the {initialPlatformName} administration dashboard.</p>
          </div>


          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100 flex items-center gap-2">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-700 mb-1.5" htmlFor="email">Email Address</label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-slate-900"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-700 mb-1.5" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="w-full pl-4 pr-12 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-slate-900"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A192F] text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>

          {/* Footer Links */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col items-center gap-4">
            <Link href="/" className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-2">
              <ArrowLeftIcon className="w-4 h-4" /> Return to Candidate Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
