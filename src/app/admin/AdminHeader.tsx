'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, { title: string; desc: string }> = {
  '/admin': { title: 'Operational Overview', desc: 'Real-time assessment metrics and system health' },
  '/admin/reports': { title: 'Assessment Reports', desc: 'View and analyze candidate session results' },
  '/admin/packages': { title: 'Scenario Packages', desc: 'Manage and configure assessment packages' },
  '/admin/scenarios': { title: 'Scenarios', desc: 'Build and manage assessment scenarios' },
  '/admin/settings': { title: 'System Settings', desc: 'Configure platform behavior and integrations' },
  '/admin/admins': { title: 'Admins & Team', desc: 'Manage administrator accounts and roles' },
  '/admin/profile': { title: 'My Profile', desc: 'Update your account information' },
};

interface AdminHeaderProps {
  adminEmail: string;
  adminName?: string | null;
  adminRole?: string | null;
  adminImageUrl?: string | null;
  onMenuToggle?: () => void;
}

export default function AdminHeader({ adminEmail, adminName, adminRole, adminImageUrl, onMenuToggle }: AdminHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const pageInfo = PAGE_TITLES[pathname] ?? { title: 'Admin Panel', desc: 'Compass Management Console' };
  const displayName = adminName || adminEmail.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();
  const role = adminRole || 'ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const roleLabel = isSuperAdmin ? 'Super Admin' : role === 'ADMIN' ? 'Admin' : 'Assessor';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin-login');
    router.refresh();
  }

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/admin/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    }
    
    // Fetch initially
    fetchNotifications();
    
    // Poll every 5 seconds
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <header className="h-[64px] sm:h-[72px] bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between fixed top-0 right-0 left-0 lg:left-60 z-40 shadow-sm">
      
      {/* Left: Mobile Hamburger & Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
        {/* Mobile Hamburger Toggle Button */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none flex-shrink-0"
          title="Open Menu"
          aria-label="Open Navigation Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-xs sm:text-[15px] font-bold text-slate-900 leading-tight truncate">{pageInfo.title}</h1>
          <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight mt-0.5 truncate hidden sm:block">{pageInfo.desc}</p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={async () => {
              const nextState = !isNotifOpen;
              setIsNotifOpen(nextState);
              if (nextState && unreadCount > 0) {
                // Mark all as read when opening
                await fetch('/api/admin/notifications', { method: 'PATCH' });
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
              }
            }}
            className="relative p-2 sm:p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:border-slate-300 transition-all focus:outline-none shadow-sm"
            title="Notifications"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-[-50px] sm:right-0 mt-2 w-[280px] sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in origin-top-right">
              <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900">Notifications</p>
                  {unreadCount > 0 && (
                    <span className="h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">{unreadCount}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      await fetch('/api/admin/notifications', { method: 'DELETE' });
                      setNotifications([]);
                    }}
                    className="text-[11px] text-red-600 font-semibold hover:underline"
                  >
                    Clear all
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsNotifOpen(false);
                    }}
                    className="text-slate-400 hover:text-slate-600 transition p-1 -mr-1 rounded-full hover:bg-slate-100"
                    title="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              
              <div className="max-h-[280px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-slate-400">No new notifications.</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`group relative px-4 py-3 border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${!n.isRead ? 'bg-blue-50/30' : ''}`}>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          await fetch(`/api/admin/notifications/${n.id}`, { method: 'DELETE' });
                          setNotifications(prev => prev.filter(x => x.id !== n.id));
                        }}
                        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
                        title="Dismiss"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>

                      <Link href={n.linkUrl || '#'} onClick={() => setIsNotifOpen(false)} className="block">
                        <div className="flex items-start gap-3">
                          <span className="text-base mt-0.5">✅</span>
                          <div className="flex-1 min-w-0 pr-4">
                            <p className={`text-xs ${!n.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>{n.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">{new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />}
                        </div>
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 sm:gap-3 py-1.5 px-2 pl-2 pr-2 sm:pr-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/90 hover:border-slate-300 transition-all shadow-sm group focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <div className="relative">
              {adminImageUrl ? (
                <img src={adminImageUrl} alt={displayName} className="w-8 h-8 rounded-xl object-cover ring-2 ring-white shadow-sm" />
              ) : (
                <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center text-xs font-bold ring-2 ring-white shadow-sm ${
                  isSuperAdmin ? 'bg-gradient-to-br from-violet-600 to-indigo-600' : 'bg-gradient-to-br from-blue-600 to-blue-700'
                }`}>
                  {initials}
                </div>
              )}
            </div>

            <div className="text-left hidden md:block">
              <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">{displayName}</p>
              <p className="text-[10px] font-medium text-slate-400 leading-tight mt-0.5">{roleLabel}</p>
            </div>

            <svg className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform hidden md:block ${isOpen ? 'rotate-180 text-blue-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-[260px] sm:w-64 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in divide-y divide-slate-100 origin-top-right">
              {/* Header Profile Card */}
              <div className="p-4 bg-gradient-to-b from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  {adminImageUrl ? (
                    <img src={adminImageUrl} alt={displayName} className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-200/80 shadow-sm" />
                  ) : (
                    <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center text-sm font-bold ring-2 ring-slate-200/80 shadow-sm ${
                      isSuperAdmin ? 'bg-gradient-to-br from-violet-600 to-indigo-600' : 'bg-gradient-to-br from-blue-600 to-blue-700'
                    }`}>
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex-shrink-0 ${

                        isSuperAdmin 
                          ? 'bg-violet-100/80 text-violet-700 border border-violet-200/60' 
                          : 'bg-blue-100/80 text-blue-700 border border-blue-200/60'
                      }`}>
                        {roleLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5" title={adminEmail}>{adminEmail}</p>
                  </div>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="p-1.5 space-y-0.5">
                <Link 
                  href="/admin/profile" 
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-600">My Profile</p>
                    <p className="text-[10px] text-slate-400">Account details & picture</p>
                  </div>
                </Link>

                <Link 
                  href="/admin/admins" 
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-600">Admins & Team</p>
                    <p className="text-[10px] text-slate-400">Manage administrator roles</p>
                  </div>
                </Link>

                <Link 
                  href="/admin/settings" 
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-600">Settings</p>
                    <p className="text-[10px] text-slate-400">Platform preferences</p>
                  </div>
                </Link>
              </div>

              {/* Sign Out Action */}
              <div className="p-1.5">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-all group text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-600">Sign Out</p>
                    <p className="text-[10px] text-red-400">Exit admin session</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

