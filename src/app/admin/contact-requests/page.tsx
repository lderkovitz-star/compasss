import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FROM: Record<string, string> = {
  landing: 'Landing page',
  'practice-result': 'Practice result',
};

function formatDate(date: Date) {
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Requests for access or a demo from the public site, newest first. They hold
 * people's contact details, so platform admins only - the same as the
 * registries.
 */
export default async function ContactRequestsPage() {
  const auth = await requireAdmin(['SUPER_ADMIN', 'ADMIN']);
  if (auth instanceof NextResponse) redirect('/admin');

  const requests = await prisma.contactRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return (
    <main className="page-content flex-1">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Contact requests</h1>
        <p className="text-sm text-slate-500 mt-1">
          Requests for access or a demo from the landing page and practice results, newest first.
          Nothing is emailed automatically, so reply to each one yourself.
        </p>
      </div>

      <div className="table-wrapper">
        <div className="table-header">
          <h2 className="text-sm font-bold text-slate-900">Requests</h2>
          <span className="badge-slate text-xs">{requests.length} total</span>
        </div>
        {requests.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 text-center">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.name}
                      {r.company ? <span className="font-normal text-slate-500"> · {r.company}</span> : null}
                    </p>
                    <a href={`mailto:${r.email}`} className="text-xs text-blue-600 hover:underline break-all">
                      {r.email}
                    </a>
                  </div>
                  <div className="text-right">
                    <span className="badge-slate text-xs">{FROM[r.source] ?? r.source}</span>
                    <p className="text-xs text-slate-400 mt-1" suppressHydrationWarning>
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                </div>
                {r.message ? (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-line break-words">{r.message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
