'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TIER_VIEW, inputLabels, type StoredEvaluation } from '@/lib/ai-evaluation-view';

export default function AiEvaluationPanel({
  sessionId,
  evaluation,
  canRun,
}: {
  sessionId: string;
  evaluation: StoredEvaluation | null;
  canRun: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setRunning(true);
    setError('');
    try {
      const res = await fetch('/api/admin/ai/tier-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'AI evaluation failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI evaluation failed');
    } finally {
      setRunning(false);
    }
  }

  const tier = evaluation ? TIER_VIEW[evaluation.tier] : null;
  const based = inputLabels(evaluation?.inputs);

  return (
    <div className="card-p mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-slate-900">AI Evaluation</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {evaluation
              ? `Evaluated ${new Date(evaluation.evaluatedAt).toLocaleString()}`
              : 'Not evaluated yet'}
          </p>
        </div>
        {canRun && (
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-50"
          >
            {running ? 'Evaluating…' : evaluation ? 'Re-run evaluation' : 'Run evaluation'}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      {evaluation && tier && (
        <div className={`mt-4 p-4 rounded-lg border text-sm leading-relaxed ${tier.classes}`}>
          <p className="font-bold mb-1">{tier.label}</p>
          <p className="whitespace-pre-wrap">{evaluation.rationale}</p>
        </div>
      )}

      {based.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Based on</span>{' '}
          {based.join(' · ')}
        </p>
      )}

      {!evaluation && !canRun && (
        <p className="mt-3 text-sm text-slate-400">The candidate has not completed the assessment yet.</p>
      )}
    </div>
  );
}
