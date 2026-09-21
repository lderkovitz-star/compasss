'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

type CandidateTier = 'TOP_TIER' | 'MID_TIER' | 'LOWER_TIER';

interface TraitScores {
  decisiveness: number;
  riskTolerance: number;
  resourcePreservation: number;
}

interface HumanOverride {
  value: number | null;
  overriddenBy: string;
  note: string;
  updatedAt: string;
}

interface SessionData {
  sessionId: string;
  candidate: { id: string; name: string; email: string; targetRole: string | null };
  package: { name: string; code: string };
  completedAt: string;
  traitScores: TraitScores | null;
  humanOverrides: Record<string, HumanOverride>;
  aiEvaluation: { tier: CandidateTier; rationale: string; evaluatedAt: string } | null;
  avgLatencyMs: number;
  totalSwitches: number;
  responseCount: number;
  responses: Array<{
    scenarioOrder: number;
    selectedOption: string;
    timeSpentMs: number;
    decisionPath: Array<{ optionId: string; event: string; timestampMs: number }>;
  }>;
}

const TIER_CONFIG: Record<CandidateTier, { label: string; color: string; bg: string }> = {
  TOP_TIER: { label: 'Top Tier', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  MID_TIER: { label: 'Mid Tier', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  LOWER_TIER: { label: 'Lower Tier', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

function TraitScoreBar({ label, value, isOverridden }: { label: string; value: number | null; isOverridden: boolean }) {
  if (value === null) return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-40 flex-shrink-0">{label}</span>
      <span className="text-xs text-slate-400 italic">Nullified by coordinator</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs w-40 flex-shrink-0 ${isOverridden ? 'text-amber-600 font-semibold' : 'text-slate-600'}`}>
        {label} {isOverridden && '(Override)'}
      </span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isOverridden ? 'bg-amber-400' : 'bg-blue-500'}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-700 w-8 text-right">{value}</span>
    </div>
  );
}

function OverrideModal({
  sessionId,
  traitScores,
  overrides,
  onClose,
  onSaved,
}: {
  sessionId: string;
  traitScores: TraitScores | null;
  overrides: Record<string, HumanOverride>;
  onClose: () => void;
  onSaved: (newOverrides: Record<string, HumanOverride>) => void;
}) {
  const traits: Array<{ key: keyof TraitScores; label: string }> = [
    { key: 'decisiveness', label: 'Decisiveness' },
    { key: 'riskTolerance', label: 'Risk Tolerance' },
    { key: 'resourcePreservation', label: 'Resource Preservation' },
  ];

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of traits) {
      const ov = overrides[t.key];
      init[t.key] = ov !== undefined ? (ov.value === null ? '' : String(ov.value)) : String(traitScores?.[t.key] ?? 50);
    }
    return init;
  });

  const [nulled, setNulled] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const t of traits) {
      init[t.key] = overrides[t.key]?.value === null;
    }
    return init;
  });

  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, { value: number | null; note: string }> = {};
      for (const t of traits) {
        payload[t.key] = {
          value: nulled[t.key] ? null : Math.min(100, Math.max(0, parseInt(values[t.key]) || 0)),
          note,
        };
      }

      const res = await fetch('/api/admin/coordinator/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, overrides: payload }),
      });

      if (!res.ok) throw new Error('Failed to save overrides');
      const data = await res.json();
      toast.success('Overrides saved successfully');
      onSaved(data.humanOverrides);
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto p-6 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Human Override — Trait Scores</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-2 space-y-5">
          <p className="text-xs text-slate-500">
            Override, adjust, or nullify any system-generated trait score. Overrides are audit-logged.
          </p>

          <div className="space-y-4">
            {traits.map(t => (
              <div key={t.key} className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700 w-36 sm:w-44 flex-shrink-0">{t.label}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={nulled[t.key]}
                  value={nulled[t.key] ? '' : values[t.key]}
                  onChange={e => setValues(v => ({ ...v, [t.key]: e.target.value }))}
                  className="w-20 sm:w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-40 disabled:bg-slate-100 shadow-sm"
                  placeholder="0-100"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nulled[t.key]}
                    onChange={e => setNulled(v => ({ ...v, [t.key]: e.target.checked }))}
                    className="rounded h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  Nullify
                </label>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Coordinator Notes (Justification)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional: explain the reason for this override..."
              rows={3}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none shadow-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Overrides'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}

export default function CoordinatorClient({ sessions }: { sessions: SessionData[] }) {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<SessionData | null>(null);
  const [sessionOverrides, setSessionOverrides] = useState<Record<string, Record<string, HumanOverride>>>({});
  const [runningAI, setRunningAI] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, SessionData['aiEvaluation']>>({});
  const [batchRunning, setBatchRunning] = useState(false);

  const getEffectiveTraits = (s: SessionData) => {
    const base = s.traitScores ?? { decisiveness: 0, riskTolerance: 0, resourcePreservation: 0 };
    const ov = sessionOverrides[s.sessionId] ?? s.humanOverrides;
    return {
      decisiveness: ov['decisiveness'] !== undefined ? ov['decisiveness'].value : base.decisiveness,
      riskTolerance: ov['riskTolerance'] !== undefined ? ov['riskTolerance'].value : base.riskTolerance,
      resourcePreservation: ov['resourcePreservation'] !== undefined ? ov['resourcePreservation'].value : base.resourcePreservation,
    };
  };

  const getAI = (s: SessionData) => aiResults[s.sessionId] !== undefined ? aiResults[s.sessionId] : s.aiEvaluation;

  async function handleRunAI(sessionId: string) {
    setRunningAI(sessionId);
    try {
      const res = await fetch('/api/admin/ai/tier-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'AI tiering failed');
      }
      const data = await res.json();
      setAiResults(r => ({ ...r, [sessionId]: data.evaluation }));
      toast.success('AI tiering complete');
    } catch (err: any) {
      toast.error(err.message ?? 'AI tiering failed');
    } finally {
      setRunningAI(null);
    }
  }

  async function handleBatchAI() {
    setBatchRunning(true);
    try {
      const res = await fetch('/api/admin/ai/tier-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: true }),
      });
      if (!res.ok) throw new Error('Batch tiering failed');
      const data = await res.json();
      // Update local state with batch results
      const newResults: Record<string, SessionData['aiEvaluation']> = {};
      for (const r of data.results ?? []) {
        if (r.tier) {
          newResults[r.sessionId] = {
            tier: r.tier,
            rationale: r.rationale ?? '',
            evaluatedAt: r.evaluatedAt ?? new Date().toISOString(),
          };
        }
      }
      setAiResults(prev => ({ ...prev, ...newResults }));
      toast.success(`Batch complete: ${data.processed} processed, ${data.errors} errors`);
    } catch (err: any) {
      toast.error(err.message ?? 'Batch tiering failed');
    } finally {
      setBatchRunning(false);
    }
  }

  const pendingAI = sessions.filter(s => !getAI(s)).length;

  const renderExpandedDetails = (s: SessionData) => {
    const ai = getAI(s);
    return (
      <div className="p-5 space-y-4 bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-900">Decision Trail — {s.candidate.name}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Trait Scores</p>
            <div className="space-y-2">
              {(['decisiveness', 'riskTolerance', 'resourcePreservation'] as const).map(t => {
                const traits = getEffectiveTraits(s);
                const ov = (sessionOverrides[s.sessionId] ?? s.humanOverrides)[t];
                return (
                  <TraitScoreBar
                    key={t}
                    label={t === 'decisiveness' ? 'Decisiveness' : t === 'riskTolerance' ? 'Risk Tolerance' : 'Resource Pres.'}
                    value={traits[t]}
                    isOverridden={!!ov}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Scenario Response Trail</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {s.responses.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center font-bold text-slate-600 flex-shrink-0">
                    {r.scenarioOrder}
                  </span>
                  <span className="font-semibold text-slate-700">Option {r.selectedOption}</span>
                  <span className="text-slate-400">{(r.timeSpentMs / 1000).toFixed(1)}s</span>
                  {r.decisionPath.filter(e => e.event === 'revisit').length > 0 && (
                    <span className="text-amber-500 text-[10px]">
                      {r.decisionPath.filter(e => e.event === 'revisit').length} revisit(s)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {ai && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">AI Rationale</p>
              <div className={`p-3 rounded-lg border text-xs leading-relaxed ${TIER_CONFIG[ai.tier].bg} ${TIER_CONFIG[ai.tier].color}`}>
                <p className="font-bold mb-1">{TIER_CONFIG[ai.tier].label}</p>
                <p>{ai.rationale}</p>
              </div>
            </div>
          )}
        </div>

        {/* Coordinator Notes */}
        {(() => {
          const overrides = sessionOverrides[s.sessionId] ?? s.humanOverrides;
          const notes = Object.values(overrides)
            .filter((ov: HumanOverride) => ov.note && ov.note.trim())
            .map((ov: HumanOverride) => ({ note: ov.note, by: ov.overriddenBy, at: ov.updatedAt }));
          // Deduplicate (same note text)
          const uniqueNotes = notes.filter((n, i, arr) => arr.findIndex(x => x.note === n.note) === i);
          if (uniqueNotes.length === 0) return null;
          return (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Coordinator Notes</p>
              <div className="space-y-2">
                {uniqueNotes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50/60 border border-amber-100 rounded-lg">
                    <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed">{n.note}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        by {n.by} {n.at ? `· ${new Date(n.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4 pb-4">
      {/* Header Actions */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="badge-slate text-xs whitespace-nowrap">{sessions.length} completed candidates</span>
          {pendingAI > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap shadow-sm">
              {pendingAI} pending AI evaluation
            </span>
          )}
        </div>
        <button
          onClick={handleBatchAI}
          disabled={batchRunning || pendingAI === 0}
          className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-50"
        >
          {batchRunning ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          )}
          {batchRunning ? 'Running AI Tiering…' : `Run Batch AI Tiering (${pendingAI})`}
        </button>
      </div>

      {/* Candidate Table */}
      <div className="hidden lg:flex flex-col flex-1 min-h-0 border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
        <div className="flex-1 min-h-0 w-full overflow-auto">
          <table className="w-full whitespace-nowrap">
            <thead className="bg-slate-50/90 sticky top-0 z-10 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <tr>
                <th className="th">Candidate</th>
                <th className="th text-center">Package</th>
                <th className="th text-center">Avg Latency</th>
                <th className="th text-center">Decisiveness</th>
                <th className="th text-center">Risk Tol.</th>
                <th className="th text-center">Res. Pres.</th>
                <th className="th text-center">AI Tier</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No completed assessments yet.
                  </td>
                </tr>
              )}
              {sessions.map(s => {
                const traits = getEffectiveTraits(s);
                const ai = getAI(s);
                const hasOverrides = Object.keys(sessionOverrides[s.sessionId] ?? s.humanOverrides).length > 0;
                const tierConfig = ai ? TIER_CONFIG[ai.tier] : null;
                const isExpanded = selectedSession === s.sessionId;

                return (
                  <React.Fragment key={s.sessionId}>
                    <tr className="tr">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                            {s.candidate.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{s.candidate.name}</p>
                            <p className="text-xs text-slate-400">{s.candidate.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td text-center">
                        <span className="badge-slate text-xs">{s.package.code}</span>
                      </td>
                      <td className="td text-center">
                        <span className="text-sm font-mono text-slate-700">{(s.avgLatencyMs / 1000).toFixed(1)}s</span>
                      </td>
                      {(['decisiveness', 'riskTolerance', 'resourcePreservation'] as const).map(trait => (
                        <td key={trait} className="td text-center">
                          {traits[trait] === null ? (
                            <span className="text-xs text-slate-400 italic">—</span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-sm font-bold ${hasOverrides ? 'text-amber-600' : 'text-slate-800'}`}>
                                {traits[trait]}
                              </span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${hasOverrides ? 'bg-amber-400' : 'bg-blue-500'}`}
                                  style={{ width: `${traits[trait] ?? 0}%` }} />
                              </div>
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="td text-center">
                        {ai ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${tierConfig?.bg} ${tierConfig?.color}`}>
                            {tierConfig?.label}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRunAI(s.sessionId)}
                            disabled={runningAI === s.sessionId}
                            className="text-xs text-violet-600 hover:text-violet-700 underline underline-offset-2 disabled:opacity-50"
                          >
                            {runningAI === s.sessionId ? 'Running…' : 'Run AI'}
                          </button>
                        )}
                      </td>
                      <td className="td text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setOverrideTarget(s)}
                            className="btn-ghost text-xs px-2 py-1 text-amber-600 hover:bg-amber-50"
                            title="Override Scores"
                          >
                            Override
                          </button>
                          <button
                            onClick={() => setSelectedSession(isExpanded ? null : s.sessionId)}
                            className="btn-ghost text-xs px-2 py-1 text-blue-600 hover:bg-blue-50"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-0 border-t border-slate-100">
                          {renderExpandedDetails(s)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile & Tablet Cards View (screens < lg) */}
      <div className="lg:hidden flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm">
        {sessions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No completed assessments yet.
            </div>
          ) : (
            sessions.map(s => {
              const traits = getEffectiveTraits(s);
              const ai = getAI(s);
              const hasOverrides = Object.keys(sessionOverrides[s.sessionId] ?? s.humanOverrides).length > 0;
              const tierConfig = ai ? TIER_CONFIG[ai.tier] : null;

              return (
                <div key={s.sessionId} className="p-4 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                        {s.candidate.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{s.candidate.name}</p>
                        <p className="text-xs text-slate-500 truncate">{s.candidate.email}</p>
                      </div>
                    </div>
                    <span className="badge-slate text-[10px] shrink-0">{s.package.code}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Avg Latency</span>
                      <span className="font-mono text-slate-700">{(s.avgLatencyMs / 1000).toFixed(1)}s</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">AI Tier</span>
                      {ai ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tierConfig?.bg} ${tierConfig?.color}`}>
                          {tierConfig?.label}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRunAI(s.sessionId)}
                          disabled={runningAI === s.sessionId}
                          className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50"
                        >
                          {runningAI === s.sessionId ? 'Running…' : 'Run AI'}
                        </button>
                      )}
                    </div>
                    
                    <div className="col-span-2 pt-2 mt-1 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Traits: Dec / Risk / Res</span>
                      <div className="flex items-center gap-3 font-bold text-[11px]">
                        <span className={traits.decisiveness === null ? 'text-slate-400 font-normal italic' : hasOverrides ? 'text-amber-600' : 'text-slate-700'}>{traits.decisiveness ?? '—'}</span>
                        <span className={traits.riskTolerance === null ? 'text-slate-400 font-normal italic' : hasOverrides ? 'text-amber-600' : 'text-slate-700'}>{traits.riskTolerance ?? '—'}</span>
                        <span className={traits.resourcePreservation === null ? 'text-slate-400 font-normal italic' : hasOverrides ? 'text-amber-600' : 'text-slate-700'}>{traits.resourcePreservation ?? '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setOverrideTarget(s)}
                      className="btn-ghost text-xs py-2 px-3 text-amber-600 hover:bg-amber-50"
                    >
                      Override
                    </button>
                    <button
                      onClick={() => setSelectedSession(selectedSession === s.sessionId ? null : s.sessionId)}
                      className="btn-secondary text-xs py-2 px-3 text-blue-600 hover:bg-blue-50"
                    >
                      {selectedSession === s.sessionId ? 'Hide Details' : 'View Details'}
                    </button>
                  </div>
                  
                  {/* Inline details for mobile */}
                  {selectedSession === s.sessionId && (
                     <div className="mt-2 border border-slate-100 rounded-xl overflow-hidden">
                       {renderExpandedDetails(s)}
                     </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      {/* Override Modal */}
      {overrideTarget && (
        <OverrideModal
          sessionId={overrideTarget.sessionId}
          traitScores={overrideTarget.traitScores}
          overrides={sessionOverrides[overrideTarget.sessionId] ?? overrideTarget.humanOverrides}
          onClose={() => setOverrideTarget(null)}
          onSaved={(newOverrides) => {
            setSessionOverrides(prev => ({ ...prev, [overrideTarget.sessionId]: newOverrides }));
            setOverrideTarget(null);
          }}
        />
      )}
    </div>
  );
}
