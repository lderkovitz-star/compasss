import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import ScenarioEditor from './ScenarioEditor';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ScenarioBuilderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { saved?: string; kept?: string; rev?: string };
}) {
  const scenario = await prisma.scenario.findUnique({
    where: { id: params.id },
    include: {
      options: { 
        orderBy: { optionCode: 'asc' },
        include: { scores: true }
      },
      package: { select: { name: true, code: true } },
    },
  });

  if (!scenario) notFound();

  // An earlier version, kept for the candidates who saw it: point at the
  // version in use now.
  let currentId: string | null = null;
  for (let next = scenario.supersededById, hops = 0; next && hops < 50; hops++) {
    currentId = next;
    next = (await prisma.scenario.findUnique({ where: { id: next }, select: { supersededById: true } }))?.supersededById ?? null;
  }
  const kept = Number(searchParams?.kept ?? 0);

  const dimensions = await prisma.dimension.findMany({
    orderBy: { code: 'asc' },
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/scenarios" className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Scenario Builder</h1>
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <span className="badge badge-blue">{scenario.package.code}</span>
              Sequence: #{scenario.sequenceOrder}
            </p>
          </div>
        </div>
      </div>
      
      {searchParams?.saved === 'version' && (
        <div className="mb-6 p-4 rounded-lg text-sm bg-emerald-50 text-emerald-700 border border-emerald-100">
          Saved as a new version{searchParams.rev ? ` (pack revision ${searchParams.rev})` : ''}. New candidates
          get this version. Candidates had already seen the earlier one, so it is kept unchanged for them and
          their reports
          {kept > 0 ? `, including ${kept} assessment${kept === 1 ? '' : 's'} still under way` : ''}.
        </div>
      )}
      {currentId && (
        <div className="mb-6 p-4 rounded-lg text-sm bg-amber-50 text-amber-900 border border-amber-200">
          This is an earlier version, kept unchanged for the candidates who saw it.{' '}
          <Link href={`/admin/scenarios/${currentId}`} className="font-semibold underline">
            Open the current version
          </Link>
          .
        </div>
      )}
      <ScenarioEditor key={scenario.id} initialScenario={scenario} dimensions={dimensions} />
    </div>
  );
}
