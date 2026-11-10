'use client';

import { useEffect, useState } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

type Archetype = { name: string; weightPct: number; label: string; blurb: string };
type Signature = { label: string; percentile: number | null; tier: string; blurb: string };
type Payload = {
  archetypes: Archetype[];
  radar: { axes: string[]; candidate: number[]; baseline: number[]; scaleMax: number };
  signatures: Signature[];
  matchScore: number;
  profileBadge: string;
};

/**
 * Three panels: how the candidate's decisions divide across historical
 * figures, a radar of them against a blended baseline, and capability
 * signatures.
 *
 * Nothing here is hardcoded. The archetypes, the radar axes and the signature
 * labels all come from the model and are rendered as returned, because the
 * comparison is supposed to follow the reviewer's question rather than a fixed
 * taxonomy. The envelope around them is fixed and validated server-side, which
 * is what lets this render arbitrary content without breaking.
 */
export default function CognitiveDnaModal({
  sessionId,
  candidateName,
  initialQuery,
  onClose,
}: {
  sessionId: string;
  candidateName: string;
  initialQuery: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<{ cached: boolean; model: string; latencyMs: number | null } | null>(
    null
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run() {
    setLoading(true);
    setError('');
    setPayload(null);
    try {
      const res = await fetch('/api/admin/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, query }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'The synthesis could not be produced.');
        return;
      }
      setPayload(data.payload);
      setMeta({ cached: data.cached, model: data.model, latencyMs: data.latencyMs });
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  const radarData =
    payload?.radar.axes.map((axis, i) => ({
      axis,
      candidate: payload.radar.candidate[i] ?? 0,
      baseline: payload.radar.baseline[i] ?? 0,
    })) ?? [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-3xl max-h-[95vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Cognitive DNA — {candidateName}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparison drawn from the model&apos;s own knowledge. Master admin only.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div>
            <label className="form-label">What are you comparing against?</label>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) void run();
                }}
                placeholder="e.g. Stonewall Jackson tempo + Washington resilience for crisis command"
                className="form-input flex-1 text-slate-900"
              />
              <button
                onClick={() => void run()}
                disabled={loading || query.trim().length < 3}
                className="btn-primary text-sm px-4 py-2 whitespace-nowrap"
              >
                {loading ? 'Working…' : 'Synthesise'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-[13px] font-semibold text-red-900">Synthesis unavailable</p>
              <p className="text-[13px] text-red-800 mt-1">{error}</p>
            </div>
          )}

          {payload && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[12px] font-semibold text-white">
                  {payload.profileBadge}
                </span>
                <span className="text-[13px] text-slate-600">
                  Match score <strong className="text-slate-900">{payload.matchScore}</strong>/100
                </span>
                {meta && (
                  <span className="text-xs text-slate-400">
                    {meta.cached ? 'from cache' : `${meta.model}${meta.latencyMs ? ` · ${meta.latencyMs}ms` : ''}`}
                  </span>
                )}
              </div>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Archetype contribution
                </h4>
                <div className="space-y-2.5">
                  {payload.archetypes.map((a, i) => (
                    <div key={i}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-slate-900">
                          {a.name}
                          {a.label && <span className="ml-2 text-xs text-slate-500">{a.label}</span>}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">{a.weightPct}%</span>
                      </div>
                      <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 rounded-full"
                          style={{ width: `${Math.max(0, Math.min(100, a.weightPct))}%` }}
                        />
                      </div>
                      {a.blurb && <p className="mt-1 text-xs text-slate-500">{a.blurb}</p>}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Candidate against blended baseline
                </h4>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: '#64748B', fontSize: 10 }} />
                    <PolarRadiusAxis
                      domain={[0, payload.radar.scaleMax]}
                      tick={{ fill: '#94A3B8', fontSize: 9 }}
                    />
                    <Radar
                      name="Candidate"
                      dataKey="candidate"
                      stroke="#2E63F6"
                      fill="#2E63F6"
                      fillOpacity={0.25}
                    />
                    <Radar
                      name="Baseline"
                      dataKey="baseline"
                      stroke="#94A3B8"
                      fill="#94A3B8"
                      fillOpacity={0.12}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </section>

              {payload.signatures.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Capability signatures
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {payload.signatures.map((s, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">{s.label}</span>
                          <span className="text-xs font-semibold text-slate-600">
                            {s.percentile === null ? s.tier || '—' : `${s.percentile}th`}
                          </span>
                        </div>
                        {s.tier && s.percentile !== null && (
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">
                            {s.tier}
                          </span>
                        )}
                        {s.blurb && <p className="mt-1 text-xs text-slate-500">{s.blurb}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {!payload && !error && !loading && (
            <p className="text-sm text-slate-500">
              Enter a comparison and press Synthesise. The same question about the same candidate is
              answered from storage rather than charged again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
