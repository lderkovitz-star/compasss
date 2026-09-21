import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import ScenarioEditor from './ScenarioEditor';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ScenarioBuilderPage({ params }: { params: { id: string } }) {
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
      
      <ScenarioEditor initialScenario={scenario} dimensions={dimensions} />
    </div>
  );
}
