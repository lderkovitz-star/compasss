'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import CognitiveDnaModal from './CognitiveDnaModal';

type Entry = {
  id: string;
  sessionId: string;
  name: string | null;
  email: string | null;
  roleSummary: string | null;
  decisionScore: number | null;
  percentile: number | null;
  isHighSignal: boolean;
  packageName: string | null;
  employerName: string | null;
  completedAt: string;
};

type Registry = {
  source: 'SANDBOX' | 'LIVE';
  cohortSize: number;
  percentilesAvailable: boolean;
  minCohortForPercentiles: number;
  highSignalPercentile: number;
  entries: Entry[];
};

/**
 * Two registries, one view.
 *
 * Sandbox holds practice runs where the person opted in - useful for demos and
 * testing, and belonging to no employer. Live spans real candidates across
 * every tenant, which is the one deliberate cross-tenant read in the product.
 */
export default function TalentClient() {
  const [source, setSource] = useState<'LIVE' | 'SANDBOX'>('LIVE');
  const [search, setSearch] = useState('');
  const [highSignalOnly, setHighSignalOnly] = useState(false);
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dnaFor, setDnaFor] = useState<Entry | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ source });
      if (search.trim()) params.set('q', search.trim());
      if (highSignalOnly) params.set('highSignal', 'true');

      const res = await fetch(`/api/admin/talent?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'The registry could not be loaded.');
        return;
      }
      setRegistry(data);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [source, search, highSignalOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function rerank() {
    const res = await fetch('/api/admin/talent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });
    const data = await res.json();
    setError(data.message ?? '');
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(['LIVE', 'SANDBOX'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={`px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              source === s
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s === 'LIVE' ? 'Live registry' : 'Sandbox registry'}
          </button>
        ))}
        <span className="text-xs text-slate-500 ml-1">
          {source === 'LIVE'
            ? 'Real candidates, every employer.'
            : 'Practice runs that opted in. No employer sees these.'}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, email, or wording in the role or resume"
            className="form-input flex-1 min-w-[16rem] text-slate-900"
          />
          <label className="flex items-center gap-2 text-[13px] text-slate-600 px-2">
            <input
              type="checkbox"
              checked={highSignalOnly}
              onChange={(e) => setHighSignalOnly(e.target.checked)}
            />
            High signal only
          </label>
          <button onClick={() => void rerank()} className="btn-secondary text-xs px-3 py-2">
            Recompute percentiles
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100">
          <label className="form-label">Comparison query</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Stonewall Jackson tempo + Metternich diplomacy for fleet crisis command"
            className="form-input text-slate-900"
          />
          <p className="text-xs text-slate-500 mt-1.5">
            Typed in free text. Open a candidate&apos;s Cognitive DNA below and this question frames
            the comparison - the axes come back from the model, not from a fixed list.
          </p>
        </div>
      </div>

      {registry && !registry.percentilesAvailable && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
          {registry.cohortSize} of {registry.minCohortForPercentiles} entries. Percentiles and the
          high-signal flag stay hidden until the cohort is large enough for them to mean anything.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-700">
          {error}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">
            {source === 'LIVE' ? 'Live' : 'Sandbox'} entries
            <span className="ml-2 text-sm font-normal text-slate-500">
              {registry?.entries.length ?? 0} shown of {registry?.cohortSize ?? 0} scored
            </span>
          </h2>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
        ) : !registry || registry.entries.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            {search || highSignalOnly
              ? 'Nothing matches those filters.'
              : source === 'SANDBOX'
                ? 'No practice runs have opted in yet.'
                : 'No completed candidates yet.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {registry.entries.map((entry) => (
              <div key={entry.id} className="px-5 py-3 flex flex-wrap items-center gap-4">
                <div
                  className="h-9 w-9 flex-shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-[13px] font-semibold text-slate-600"
                  aria-hidden
                >
                  {(entry.name ?? '?').trim().charAt(0).toUpperCase() || '?'}
                </div>

                <div className="flex-1 min-w-[12rem]">
                  <div className="text-sm font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                    {entry.name ?? 'Unnamed'}
                    {entry.isHighSignal && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        High signal
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {entry.email ?? 'no email'}
                    {entry.employerName ? ` · ${entry.employerName}` : ''}
                    {entry.packageName ? ` · ${entry.packageName}` : ''}
                  </div>
                  {entry.roleSummary && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">{entry.roleSummary}</div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {entry.decisionScore === null ? '—' : Math.round(entry.decisionScore)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Decision</div>
                </div>

                <div className="text-right w-20">
                  <div className="text-sm font-semibold text-slate-900">
                    {entry.percentile === null ? '—' : `${entry.percentile}th`}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Percentile
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDnaFor(entry)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Cognitive DNA
                  </button>
                  <Link
                    href={`/admin/reports/${entry.sessionId}`}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    Report
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Percentiles reflect real-time comparison against evaluated platform candidates.
      </p>

      {dnaFor && (
        <CognitiveDnaModal
          sessionId={dnaFor.sessionId}
          candidateName={dnaFor.name ?? 'Unnamed candidate'}
          initialQuery={query}
          onClose={() => setDnaFor(null)}
        />
      )}
    </div>
  );
}
