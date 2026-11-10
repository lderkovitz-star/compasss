'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Rank a cohort against one role, then combine any selection of them into a
 * single comparative table.
 *
 * The same workbench serves the employer portal and the master console; they
 * differ only in which endpoint they post to and where a report link points.
 */

export type Row = {
  sessionId: string;
  name: string;
  email: string | null;
  role: string | null;
  decisionScore: number;
  scores: (number | null)[];
  matchScore: number;
  profileBadge: string;
  topArchetype: string | null;
  summary: string | null;
  isWildCard: boolean;
};

type Comparison = {
  verdict: string;
  candidates: {
    sessionId: string;
    name: string;
    standsOutFor: string;
    reservation: string;
    bestFitFor: string;
  }[];
};

const MAX_COMPARE = 6;

export default function CohortWorkbench({
  savedRoles,
  completedCount,
  rankEndpoint,
  compareEndpoint,
  reportBase,
  heading = 'Cohort analysis',
}: {
  savedRoles: { id: string; title: string }[];
  completedCount: number;
  rankEndpoint: string;
  compareEndpoint: string;
  reportBase: string;
  heading?: string;
}) {
  const [useSaved, setUseSaved] = useState(savedRoles.length > 0);
  const [roleId, setRoleId] = useState(savedRoles[0]?.id ?? '');
  const [spec, setSpec] = useState('');

  const [ranking, setRanking] = useState<{ axes: string[]; rows: Row[]; note: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [picked, setPicked] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [comparing, setComparing] = useState(false);

  function specBody() {
    return useSaved ? { jobContextId: roleId } : { query: spec };
  }

  async function rank() {
    setBusy(true);
    setError('');
    setComparison(null);
    setPicked([]);
    try {
      const res = await fetch(rankEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...specBody(), mode: 'rank' }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || 'The ranking failed.');
      setRanking({ axes: json.axes ?? [], rows: json.rows ?? [], note: json.note ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function combine() {
    setComparing(true);
    setError('');
    try {
      const res = await fetch(compareEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...specBody(), mode: 'compare', sessionIds: picked }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error || 'The comparison failed.');
      setComparison({ verdict: json.verdict, candidates: json.candidates });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setComparing(false);
    }
  }

  function toggle(id: string) {
    setComparison(null);
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_COMPARE ? p : [...p, id]
    );
  }

  function selectTop(n: number) {
    setComparison(null);
    setPicked((ranking?.rows ?? []).slice(0, n).map((r) => r.sessionId));
  }

  // The comparison returns the AI's reading; the scores came back with the
  // ranking. One table needs both, matched up by session.
  const merged =
    comparison && ranking
      ? comparison.candidates
          .map((c) => ({ ...c, row: ranking.rows.find((r) => r.sessionId === c.sessionId) }))
          .filter((c) => c.row)
      : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[19px] font-bold tracking-tight text-slate-900">{heading}</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Rank everyone who has completed an assessment against one role, then combine any of them
          into a single comparison. {completedCount} completed{' '}
          {completedCount === 1 ? 'assessment' : 'assessments'} in this ledger.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[12px] font-medium text-slate-600">Role to rank against</label>
          {savedRoles.length > 0 && (
            <button
              type="button"
              onClick={() => setUseSaved((v) => !v)}
              className="min-h-[44px] inline-flex items-center px-2 text-[12px] font-medium text-blue-600 hover:underline"
            >
              {useSaved ? 'Paste a spec instead' : 'Use a saved role'}
            </button>
          )}
        </div>

        {useSaved ? (
          <select
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            {savedRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        ) : (
          <textarea
            rows={5}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Paste the job spec. What the role has to do, what it is judged on, what would go wrong in it."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        <button
          onClick={rank}
          disabled={busy || (useSaved ? !roleId : spec.trim().length < 10)}
          className="btn-primary text-sm px-5 py-2 mt-3 disabled:opacity-50"
        >
          {busy ? 'Ranking…' : 'Rank the cohort'}
        </button>

        <p className="text-[11px] text-slate-500 mt-2">
          The ranking reads three things together: how they behaved in the simulation, their
          resume, and this spec.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {ranking && ranking.rows.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-[13px] text-slate-500">
          {ranking.note ?? 'Nothing to rank yet.'}
        </div>
      )}

      {ranking && ranking.rows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-slate-500">
                {picked.length} selected · up to {MAX_COMPARE}
              </span>
              {ranking.rows.length >= 3 && (
                <button
                  onClick={() => selectTop(Math.min(4, ranking.rows.length))}
                  className="min-h-[44px] inline-flex items-center px-2 text-[12px] font-medium text-blue-600 hover:underline"
                >
                  Select top {Math.min(4, ranking.rows.length)}
                </button>
              )}
              {picked.length > 0 && (
                <button
                  onClick={() => {
                    setPicked([]);
                    setComparison(null);
                  }}
                  className="min-h-[44px] inline-flex items-center px-2 text-[12px] font-medium text-slate-500 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={combine}
              disabled={picked.length < 2 || comparing}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
            >
              {comparing ? 'Combining…' : 'Combine & Compare'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Candidate
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Match
                  </th>
                  {ranking.axes.map((a) => (
                    <th
                      key={a}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 hidden md:table-cell"
                    >
                      {a}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Report
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranking.rows.map((row) => (
                  <tr key={row.sessionId} className={picked.includes(row.sessionId) ? 'bg-blue-50/60' : ''}>
                    <td className="px-4 py-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={picked.includes(row.sessionId)}
                          onChange={() => toggle(row.sessionId)}
                          disabled={!picked.includes(row.sessionId) && picked.length >= MAX_COMPARE}
                          className="mt-1"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-900">{row.name}</span>
                          <span className="block text-[12px] text-slate-500">{row.role ?? '—'}</span>
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            {row.isWildCard && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Wild card
                              </span>
                            )}
                            {row.profileBadge && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {row.profileBadge}
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-slate-900">{row.matchScore}</span>
                      <span className="block text-[11px] text-slate-400">
                        decision {row.decisionScore}
                      </span>
                    </td>
                    {row.scores.map((v, i) => (
                      <td key={i} className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                        {v ?? '—'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${reportBase}/${row.sessionId}`}
                        className="inline-flex min-h-[44px] items-center px-3 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ranking.note && (
            <p className="px-4 py-3 text-[12px] text-slate-500 border-t border-slate-100">
              {ranking.note}
            </p>
          )}
        </div>
      )}

      {comparison && merged.length > 0 && ranking && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-4 border-b border-slate-200">
            <h2 className="text-[15px] font-bold text-slate-900">
              Combined comparison · {merged.length} candidates
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-700">{comparison.verdict}</p>
          </div>

          {/* One table, candidates as columns, so the rows line up and can be
              read across rather than held in your head between cards. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-40" />
                  {merged.map((c) => (
                    <th key={c.sessionId} className="px-4 py-3 text-left">
                      <span className="block text-sm font-bold text-slate-900">{c.name}</span>
                      {c.row?.isWildCard && (
                        <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Wild card
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/50">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Match
                  </th>
                  {merged.map((c) => (
                    <td key={c.sessionId} className="px-4 py-2.5 text-sm font-bold text-slate-900">
                      {c.row?.matchScore}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Decision score
                  </th>
                  {merged.map((c) => (
                    <td key={c.sessionId} className="px-4 py-2.5 text-sm text-slate-700">
                      {c.row?.decisionScore}
                    </td>
                  ))}
                </tr>
                {ranking.axes.map((axis, i) => (
                  <tr key={axis}>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {axis}
                    </th>
                    {merged.map((c) => (
                      <td key={c.sessionId} className="px-4 py-2.5 text-sm text-slate-700">
                        {c.row?.scores[i] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-emerald-50/40">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-emerald-700 align-top">
                    Stands out for
                  </th>
                  {merged.map((c) => (
                    <td key={c.sessionId} className="px-4 py-3 text-[12.5px] leading-relaxed text-slate-700 align-top">
                      {c.standsOutFor}
                    </td>
                  ))}
                </tr>
                <tr className="bg-amber-50/40">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-amber-700 align-top">
                    Reservation
                  </th>
                  {merged.map((c) => (
                    <td key={c.sessionId} className="px-4 py-3 text-[12.5px] leading-relaxed text-slate-700 align-top">
                      {c.reservation}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 align-top">
                    Best fit for
                  </th>
                  {merged.map((c) => (
                    <td key={c.sessionId} className="px-4 py-3 text-[12.5px] leading-relaxed text-slate-700 align-top">
                      {c.bestFitFor}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
