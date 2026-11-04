import { requireAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import TalentClient from './TalentClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TalentPage() {
  const auth = await requireAdmin(['SUPER_ADMIN', 'ADMIN']);
  if (auth instanceof NextResponse) redirect('/admin');

  return (
    <main className="page-content flex-1">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Talent Registry</h1>
        <p className="text-sm text-slate-500 mt-1">
          Platform-wide, visible only here. Employer accounts see their own candidates and nothing
          else.
        </p>
      </div>
      <TalentClient />
    </main>
  );
}
