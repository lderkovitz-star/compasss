'use client';

import { useEffect, useState } from 'react';

type Message = {
  id: string;
  template: string;
  to: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  body: string | null;
  createdAt: string;
  sentAt: string | null;
};

type State = {
  configured: boolean;
  provider: string;
  from: string | null;
  queued: number;
  sent: number;
  failed: number;
  messages: Message[];
};

/**
 * What would have been emailed.
 *
 * Mail from an unverified domain lands in spam, which is worse than not
 * sending it, so nothing is delivered until DNS on the sending domain is in
 * place. Messages are written as they arise, and this is where an operator
 * reads them - including retrieving an invitation by hand if a candidate says
 * theirs never arrived.
 */
export default function EmailQueuePanel() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/email', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setState(data))
      .catch(() => setState(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading the queue…</p>;
  if (!state) return <p className="text-sm text-slate-500">The queue could not be loaded.</p>;

  return (
    <div className="space-y-4">
      {!state.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <p className="text-[13px] font-semibold text-amber-900">Sending is not switched on</p>
          <p className="text-[13px] text-amber-800 mt-1">
            Messages are written and held here. Mail from a domain without DNS records in place is
            filtered as spam, so holding them is better than sending them. Once the sending domain
            is verified, these go out with nothing re-entered.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Held', value: state.queued },
          { label: 'Sent', value: state.sent },
          { label: 'Failed', value: state.failed },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 p-3">
            <div className="text-xl font-bold text-slate-900">{stat.value}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {state.messages.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing queued yet.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {state.messages.map((m) => (
            <div key={m.id}>
              <button
                onClick={() => setOpen(open === m.id ? null : m.id)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-slate-900 truncate">
                      {m.subject}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {m.to} · {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      m.status === 'SENT'
                        ? 'bg-emerald-50 text-emerald-700'
                        : m.status === 'FAILED'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {m.status === 'QUEUED' ? 'Held' : m.status}
                  </span>
                </div>
              </button>
              {open === m.id && (
                <div className="px-4 pb-4 bg-slate-50/60">
                  {m.lastError && (
                    <p className="text-xs text-red-700 mb-2">Last error: {m.lastError}</p>
                  )}
                  <pre className="whitespace-pre-wrap text-xs text-slate-700 font-sans leading-relaxed">
                    {m.body ?? 'No body was recorded for this message.'}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
