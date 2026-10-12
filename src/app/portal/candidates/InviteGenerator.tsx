'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Pkg = { id: string; name: string };
type SavedContext = { id: string; title: string };

export default function InviteGenerator({
  packages,
  savedContexts,
  defaultPackageId,
}: {
  packages: Pkg[];
  savedContexts: SavedContext[];
  defaultPackageId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Held in state only — the link is returned once and never listed again. */
  const [generated, setGenerated] = useState<{ name: string; url: string } | null>(null);
  const [useSaved, setUseSaved] = useState(savedContexts.length > 0);

  const [form, setForm] = useState({
    candidateName: '',
    candidateEmail: '',
    packageId: defaultPackageId ?? '',
    jobContextId: savedContexts[0]?.id ?? '',
    jobTitle: '',
    jobDescription: '',
  });

  function reset() {
    setForm({
      candidateName: '',
      candidateEmail: '',
      packageId: defaultPackageId ?? '',
      jobContextId: savedContexts[0]?.id ?? '',
      jobTitle: '',
      jobDescription: '',
    });
    setError('');
  }

  async function generate() {
    setError('');
    if (!form.candidateName.trim()) return setError('Candidate name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.candidateEmail.trim())) {
      return setError('A valid candidate email is required.');
    }
    if (useSaved ? !form.jobContextId : !form.jobTitle.trim()) {
      return setError(useSaved ? 'Select a role.' : 'A role title is required.');
    }

    setBusy(true);
    try {
      const res = await fetch('/api/portal/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName: form.candidateName,
          candidateEmail: form.candidateEmail,
          packageId: form.packageId || undefined,
          ...(useSaved
            ? { jobContextId: form.jobContextId }
            : { jobTitle: form.jobTitle, jobDescription: form.jobDescription }),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not generate the link.');

      setGenerated({ name: form.candidateName.trim(), url: json.url });
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setGenerated(null);
        }}
        className="bg-blue-600 text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
      >
        Generate Candidate Assessment Link
      </button>

      {/* The link is shown once; make that unmissable. */}
      {generated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="font-semibold text-slate-900">
              Assessment link for {generated.name}
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Send this to the candidate. It opens their assessment directly — they will not be
              asked for their name or email, and they cannot see the role requirements you
              attached.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-900 break-all">
                {generated.url}
              </code>
              <button
                className="text-[13px] font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
                onClick={() => navigator.clipboard.writeText(generated.url)}
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end mt-5">
              <button
                className="text-[13px] font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5"
                onClick={() => setGenerated(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 my-8">
            <h3 className="font-semibold text-slate-900">Generate candidate assessment link</h3>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {error}
              </div>
            )}

            <div className="grid gap-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-1">
                    Candidate full name
                  </label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.candidateName}
                    onChange={(e) => setForm((f) => ({ ...f, candidateName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-1">
                    Candidate email
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.candidateEmail}
                    onChange={(e) => setForm((f) => ({ ...f, candidateEmail: e.target.value }))}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Used to identify the candidate and send their receipt.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-slate-600 mb-1">
                  Scenario package
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.packageId}
                  onChange={(e) => setForm((f) => ({ ...f, packageId: e.target.value }))}
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12px] font-medium text-slate-600">
                    Job context
                  </label>
                  {savedContexts.length > 0 && (
                    <button
                      type="button"
                      className="text-[12px] text-blue-600 hover:text-blue-700"
                      onClick={() => setUseSaved((v) => !v)}
                    >
                      {useSaved ? 'Paste a new description' : 'Use a saved role'}
                    </button>
                  )}
                </div>

                {useSaved ? (
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.jobContextId}
                    onChange={(e) => setForm((f) => ({ ...f, jobContextId: e.target.value }))}
                  >
                    {savedContexts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Role title, e.g. Chief Operating Officer"
                      value={form.jobTitle}
                      onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    />
                    <textarea
                      rows={6}
                      className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                      placeholder="Paste the job description here. The candidate never sees this — it is bundled with their assessment for the evaluation."
                      value={form.jobDescription}
                      onChange={(e) => setForm((f) => ({ ...f, jobDescription: e.target.value }))}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="text-[13px] font-medium text-slate-600 hover:text-slate-900 px-3 py-2"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                onClick={generate}
                disabled={busy}
              >
                {busy ? 'Generating…' : 'Generate link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
