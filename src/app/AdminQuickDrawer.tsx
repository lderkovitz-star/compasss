'use client';

import { useEffect, useState } from 'react';
import AdminSidebar from './admin/Sidebar';

/**
 * The console's settings drawer, pulled up over the public view.
 *
 * During a live demo there is no time to leave the page, type an address and
 * sign in; the pack has to change while the tablet is already in someone's
 * hand. This is the same sidebar the console uses, opened by one tap from
 * wherever the demo happens to be.
 *
 * It is rendered only when the server already recognises an admin session, so
 * a candidate or a visitor never receives this markup at all. It is a
 * convenience for someone who is signed in, not a way to get signed in - every
 * page it links to is still checked by the middleware and by the route guards.
 */
export default function AdminQuickDrawer({
  adminEmail,
  adminName,
  adminRole,
  adminImageUrl,
  platformName,
  logoUrl,
}: {
  adminEmail: string;
  adminName?: string;
  adminRole?: string;
  adminImageUrl?: string | null;
  platformName?: string;
  logoUrl?: string;
}) {
  const [open, setOpen] = useState(false);

  // A drawer that cannot be dismissed with Escape is a trap on a keyboard.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin settings"
          // Bottom left: where a thumb sits when a tablet is held up to show
          // someone, and clear of the page's own calls to action.
          className="fixed bottom-5 left-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-[#1B2740] text-white shadow-[0_10px_30px_rgba(0,0,0,0.55)] ring-1 ring-black/40 transition-transform active:scale-95 hover:border-white/40"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-[#0B1220] bg-[#35E0C8]" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <AdminSidebar
        overlay
        isOpen={open}
        onClose={() => setOpen(false)}
        adminEmail={adminEmail}
        adminName={adminName}
        adminRole={adminRole}
        adminImageUrl={adminImageUrl}
        platformName={platformName}
        logoUrl={logoUrl}
      />
    </>
  );
}
