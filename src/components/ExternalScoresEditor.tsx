'use client';

import { useState } from 'react';
import { toKey, type ExternalScore } from '@/lib/external-scores';

/**
 * Scores from outside the platform, on a candidate's profile.
 *
 * Rows, not fields. An ASVAB line score, a DLPT rating and a certification
 * date have nothing in common except that somebody wants them next to the
 * simulation result, and the moment this becomes a fixed form it stops
 * working for the next customer who measures something else.
 *
 * The key is derived from the label and shown read-only, because it is what
 * a prompt and any future integration match on — it needs to be stable and
 * predictable, and nobody should have to think about it while typing "ASVAB
 * AFQT".
 */
export default function ExternalScoresEditor({
  value,
  onChange,
  disabled,
}: {
  value: ExternalScore[];
  onChange: (next: ExternalScore[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState({ label: '', value: '', scale: '', source: '' });

  function add() {
    const label = draft.label.trim();
    const raw = draft.value.trim();
    if (!label || !raw) return;
    const numeric = Number(raw);
    const scale = Number(draft.scale);
    const entry: ExternalScore = {
      key: toKey(label),
      label,
      value: Number.isFinite(numeric) && raw !== '' ? numeric : raw,
    };
    if (Number.isFinite(scale) && scale > 0) entry.scale = scale;
    if (draft.source.trim()) entry.source = draft.source.trim();

    // Replace rather than duplicate when the same label is added twice.
    const next = value.filter((v) => v.key !== entry.key).concat(entry);
    onChange(next);
    setDraft({ label: '', value: '', scale: '', source: '' });
  }

  return (
    <div>
      <label className="form-label">
        External scores
        <span className="ml-2 text-xs font-normal text-slate-400">
          ASVAB, academic baselines, certifications — anything measured elsewhere
        </span>
      </label>

      {value.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {value.map((s) => (
            <li
              key={s.key}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {s.label}:{' '}
                  <span className="font-mono">
                    {s.value}
                    {s.scale !== undefined ? `/${s.scale}` : ''}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {s.key}
                  {s.source ? ` · ${s.source}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((v) => v.key !== s.key))}
                className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-red-600"
                aria-label={`Remove ${s.label}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          None recorded. These are shown on the report and given to the AI alongside the
          simulation result, labelled as measuring something different.
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_0.7fr_0.6fr_1fr_auto]">
        <input
          className="form-input min-h-[44px] text-sm"
          placeholder="Label — e.g. ASVAB AFQT"
          value={draft.label}
          disabled={disabled}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        />
        <input
          className="form-input min-h-[44px] text-sm"
          placeholder="Value"
          value={draft.value}
          disabled={disabled}
          onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
        />
        <input
          className="form-input min-h-[44px] text-sm"
          placeholder="/ max"
          inputMode="numeric"
          value={draft.scale}
          disabled={disabled}
          onChange={(e) => setDraft((d) => ({ ...d, scale: e.target.value }))}
        />
        <input
          className="form-input min-h-[44px] text-sm"
          placeholder="Source (optional)"
          value={draft.source}
          disabled={disabled}
          onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
        />
        <button
          type="button"
          onClick={add}
          disabled={disabled || !draft.label.trim() || !draft.value.trim()}
          className="btn-secondary min-h-[44px] justify-center whitespace-nowrap disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {draft.label.trim() && (
        <p className="mt-1 text-[11px] text-slate-500 font-mono">key: {toKey(draft.label)}</p>
      )}
    </div>
  );
}
