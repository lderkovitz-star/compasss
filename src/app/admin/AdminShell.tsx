'use client';

import { useState } from 'react';
import AdminSidebar from './Sidebar';
import AdminHeader from './AdminHeader';

interface AdminShellProps {
  adminEmail: string;
  adminName?: string;
  adminRole?: string;
  adminImageUrl?: string | null;
  platformName?: string;
  logoUrl?: string;
  children: React.ReactNode;
}

export default function AdminShell({
  adminEmail,
  adminName = 'Admin',
  adminRole = 'ADMIN',
  adminImageUrl,
  platformName,
  logoUrl,
  children,
}: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] overflow-x-hidden">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Fixed on Desktop, Slide-over Drawer on Mobile/Tablet) */}
      <AdminSidebar
        adminEmail={adminEmail}
        adminName={adminName}
        adminRole={adminRole}
        adminImageUrl={adminImageUrl}
        platformName={platformName}
        logoUrl={logoUrl}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full ml-0 lg:ml-60 transition-all duration-300">
        <AdminHeader
          adminEmail={adminEmail}
          adminName={adminName}
          adminRole={adminRole}
          adminImageUrl={adminImageUrl}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 min-w-0 w-full overflow-x-hidden pt-[64px] sm:pt-[72px]">
          <div className="animate-fade-in h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
