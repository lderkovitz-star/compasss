import { Suspense } from 'react';
import { getGlobalSettings } from '@/lib/settings';
import { LoginForm } from './components/LoginForm';

// admin-login page with proper icons and layout
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const settings = await getGlobalSettings();

  return (
    <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-400 text-sm">Loading security interface...</div>
        </div>
    }>
      <LoginForm 
        initialPlatformName={settings.platformName || 'CognitiveEdge'} 
        initialPlatformLogo={settings.logoUrl || null} 
      />
    </Suspense>
  );
}
