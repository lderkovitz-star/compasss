'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/portal/candidates', label: 'Candidate Ledger' },
];

export default function PortalShell({
  company,
  children,
}: {
  company: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function lock() {
    await fetch('/api/portal/session', { method: 'DELETE' });
    router.replace('/portal');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{company}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-[0.08em] font-semibold">
                Enterprise Admin
              </div>
            </div>
            <nav className="flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`min-h-[44px] inline-flex items-center px-3 rounded-lg text-[13px] font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <button
            onClick={lock}
            className="min-h-[44px] inline-flex items-center text-[13px] font-medium text-slate-600 hover:text-slate-900 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            Lock ledger
          </button>
        </div>
      </header>
      <main className="max-w-[1180px] mx-auto px-4 sm:px-8 py-6 sm:py-8">{children}</main>
    </div>
  );
}
