'use client';

import { useState } from 'react';

type Candidate = { sessionId: string; name: string; roleTitle?: string | null };
type Considered = { sessionId: string; ref: string; name: string };

/**
 * Ask a question about the candidates in scope.
 *
 * The selection is shown as numbered chips because the answer refers to
 * people as "Candidate 1", "Candidate 2" — the numbering has to be visible
 * and stable or a sentence like "candidate 2 committed faster" cannot be
 * checked against anyone. The order the evaluator picks is the order sent.
 *
 * Suggested questions are there because an empty box next to the words "ask
 * anything" is the least useful control in software; they are examples of
 * what this can answer, and they vanish once something is typed.
 */
export default function EvaluatorAskBox({
  endpoint,
  candidates,
  clientAccountId,
  tone = 'light',
}: {
  endpoint: string;
  candidates: Candidate[];
  clientAccountId?: string | null;
  tone?: 'light' | 'dark';
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    candidates.slice(0, 4).map((c) => c.sessionId)
  );
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [considered, setConsidered] = useState<Considered[]>([]);
  const [cached, setCached] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dark = tone === 'dark';

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q) {
      setError('Type a question first.');
      return;
    }
    if (selected.length === 0) {
      setError('Pick at least one candidate.');
      return;
    }
    setBusy(true);
    setError('');
    setAnswer(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          sessionIds: selected,
          ...(clientAccountId ? { clientAccountId } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'The question could not be answered.');
      setAnswer(json.answer);
      setConsidered(json.considered ?? []);
      setCached(Boolean(json.cached));
      if (text) setQuestion(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const suggestions = [
    selected.length > 1 ? 'Why candidate 1 over candidate 2?' : 'What stands out about this candidate?',
    'Who adapts fastest to an unfamiliar situation, and what shows it?',
    'Where is the evidence thin enough that I should not rely on it?',
  ];

  if (candidates.length === 0) {
    return (
      <div className={dark ? 'text-[13px] text-[#5B6580]' : 'text-sm text-slate-500'}>
        No completed assessments to ask about yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p
          className={`text-[11px] font-semibold uppercase tracking-wide ${
            dark ? 'text-[#5B6580]' : 'text-slate-400'
          }`}
        >
          In scope — {selected.length} of {candidates.length}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {candidates.map((c) => {
            const index = selected.indexOf(c.sessionId);
            const on = index !== -1;
            return (
              <button
                key={c.sessionId}
                type="button"
                onClick={() => toggle(c.sessionId)}
                disabled={busy}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 text-[12.5px] transition-colors ${
                  on
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : dark
                      ? 'border-[#2A3550] text-[#8E99B4] hover:border-[#39415A]'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400'
                }`}
              >
                {on && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                )}
                <span className="max-w-[160px] truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="evaluator-question"
          className={`block text-[11px] font-semibold uppercase tracking-wide ${
            dark ? 'text-[#5B6580]' : 'text-slate-400'
          }`}
        >
          Your question
        </label>
        <textarea
          id="evaluator-question"
          rows={3}
          value={question}
          disabled={busy}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask in plain English — e.g. why one candidate over another, who handles ambiguity best, or where the evidence is weakest."
          className={`mt-2 w-full resize-y rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
            dark
              ? 'border border-[#2A3550] bg-[#0B1220] text-white placeholder-[#39415A] focus:border-[#5B8CFF]'
              : 'border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
          }`}
        />
      </div>

      {!question.trim() && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => ask(s)}
              className={`min-h-[44px] rounded-lg border px-3 text-[12px] text-left transition-colors ${
                dark
                  ? 'border-[#1C2436] text-[#8E99B4] hover:border-[#2A3550]'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => ask()}
        disabled={busy}
        className="btn-primary w-full justify-center min-h-[48px] sm:w-auto disabled:opacity-50"
      >
        {busy ? 'Thinking…' : 'Ask'}
      </button>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {answer && (
        <div
          className={`rounded-xl border p-4 ${
            dark ? 'border-[#1C2436] bg-[#0E1626]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {considered.map((c) => (
              <span
                key={c.sessionId}
                className={`text-[11px] ${dark ? 'text-[#5B6580]' : 'text-slate-500'}`}
              >
                {c.ref} = {c.name}
              </span>
            ))}
          </div>
          {answer.split(/\n{2,}/).map((para, i) => (
            <p
              key={i}
              className={`text-[13.5px] leading-relaxed ${
                dark ? 'text-[#C6CEE2]' : 'text-slate-700'
              } ${i > 0 ? 'mt-3' : ''}`}
            >
              {para}
            </p>
          ))}
          <p className={`mt-3 text-[11px] ${dark ? 'text-[#39415A]' : 'text-slate-400'}`}>
            {/* Said on every answer, not buried in a policy page. The model
                explains evidence; it does not decide, and it has not seen
                anything the evaluator cannot open themselves. */}
            Generated from this cohort&rsquo;s simulation records. It explains the evidence — it
            does not make the decision, and it can be wrong. Check anything it claims against the
            report.{cached ? ' Answered from a previous identical question.' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
