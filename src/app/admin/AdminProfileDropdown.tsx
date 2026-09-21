'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<{
    name?: string;
    role?: string;
    email: string;
    profileImageUrl: string | null;
  } | null>(null);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/admin/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin-login');
    router.refresh();
  }

  if (!profile) {
    return <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>;
  }

  const isSuperAdmin = profile.role === 'SUPER_ADMIN';

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none hover:opacity-80 transition-opacity"
      >
        {profile.profileImageUrl ? (
          <img src={profile.profileImageUrl} alt={profile.name || 'Admin'} className="w-8 h-8 rounded-full object-cover shadow-sm border border-slate-200" />
        ) : (
          <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-sm ${
            isSuperAdmin ? 'bg-violet-600' : profile.role === 'ADMIN' ? 'bg-blue-600' : 'bg-emerald-600'
          }`}>
            {(profile.name || profile.email).charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-2 border-b border-slate-100">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <p className="text-sm font-semibold text-slate-900 truncate">{profile.name || 'Admin'}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                isSuperAdmin
                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                  : profile.role === 'ADMIN'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {isSuperAdmin ? 'Super Admin' : profile.role === 'ADMIN' ? 'Admin' : 'Assessor'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{profile.email}</p>
          </div>
          
          <Link 
            href="/admin/profile" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Edit Profile
          </Link>

          <Link 
            href="/admin/admins" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Team
          </Link>
          
          <Link 
            href="/admin/settings" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>

          <div className="h-px bg-slate-100 my-1 mx-2"></div>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
