'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ModalPortal from '@/components/ModalPortal';

/**
 * Issues a candidate link for one client account, from the console.
 *
 * Exists so a rep sitting with a client can start a candidate without asking
 * them to read their access key out loud. The link is returned once and is
 * not listed anywhere afterwards, so the copy step is the whole point of the
 * second panel.
 */
export default function QuickInvite({
  account,
  onClose,
}: {
  account: { id: string; name: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [form, setForm] = useState({ candidateName: '', candidateEmail: '', roleTitle: '' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clients/${account.id}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not generate the invitation.');
      setLink(json.url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">Invite a candidate</h3>
            <p className="text-sm text-slate-500 mt-0.5">On behalf of {account.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-[44px] w-[44px] items-center justify-center rounded-lg text-slate-400 hover:text-slate-900"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {link ? (
          <div className="mt-5">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">Copy this now</p>
              <p className="text-xs text-amber-800 mt-0.5">
                The link is shown once and is not listed again. It expires in 14 days and can be
                withdrawn from the employer&rsquo;s ledger.
              </p>
            </div>
            <code className="mt-3 block break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-900">
              {link}
            </code>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                className="btn-primary flex-1 justify-center min-h-[48px]"
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  toast.success('Link copied');
                }}
              >
                Copy link
              </button>
              <button className="btn-secondary flex-1 justify-center min-h-[48px]" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="form-label" htmlFor="qi-name">Candidate name</label>
              <input
                id="qi-name"
                className="form-input min-h-[48px]"
                required
                value={form.candidateName}
                onChange={(e) => setForm((f) => ({ ...f, candidateName: e.target.value }))}
                placeholder="Jordan Reyes"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="qi-email">Candidate email</label>
              <input
                id="qi-email"
                type="email"
                inputMode="email"
                autoCapitalize="off"
                className="form-input min-h-[48px]"
                required
                value={form.candidateEmail}
                onChange={(e) => setForm((f) => ({ ...f, candidateEmail: e.target.value }))}
                placeholder="jordan@example.com"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="qi-role">
                Role <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="qi-role"
                className="form-input min-h-[48px]"
                value={form.roleTitle}
                onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))}
                placeholder="Chief Operating Officer"
              />
              <p className="text-xs text-slate-500 mt-1">
                Saved as a role on this account, and given to the evaluation as context.
              </p>
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full justify-center min-h-[48px] disabled:opacity-50"
            >
              {busy ? 'Generating…' : 'Generate link'}
            </button>
            <p className="text-xs text-slate-500">
              The candidate runs the pack assigned to this account. Issuing a link uses one seat.
            </p>
          </form>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
