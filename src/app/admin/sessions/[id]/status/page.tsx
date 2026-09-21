import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import LiveStatusClient from "./LiveStatusClient";

export default async function SessionLiveStatusPage({ params }: { params: { id: string } }) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      package: {
        include: {
          scenarios: {
            orderBy: { sequenceOrder: 'asc' },
            select: { id: true, narrativeText: true, sequenceOrder: true, timeLimitSec: true }
          }
        }
      }
    }
  });

  if (!session) {
    notFound();
  }

  // Pre-calculate initial data to pass to the client for immediate rendering
  const initialData = {
    status: session.status,
    currentScenarioIdx: session.currentScenarioIdx,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() || null,
  };

  return (
    <>
      <div className="topbar flex items-center gap-4 border-b border-slate-200">
        <Link href={`/admin/candidates/${session.userId}`} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-slate-900">Live Session Status</h1>
          <p className="text-xs text-slate-400">Monitoring real-time progress for {session.user.name}</p>
        </div>
      </div>

      <main className="page-content flex-1 max-w-5xl">
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{session.user.name}</h2>
              <p className="text-sm text-slate-500 mt-1">
                <strong>Package:</strong> {session.package.name} ({session.package.code})
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="relative flex h-2 w-2">
                {session.status === 'IN_PROGRESS' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </>
                ) : session.status === 'COMPLETED' ? (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                )}
              </span>
              {session.status === 'IN_PROGRESS' ? 'Monitoring Live' : session.status === 'COMPLETED' ? 'Session Completed' : 'Session Pending'}
            </div>
          </div>
        </div>

        <LiveStatusClient 
          sessionId={session.id} 
          initialData={initialData} 
          scenarios={session.package.scenarios}
          totalScenarios={session.package.scenarios.length}
        />
      </main>
    </>
  );
}
