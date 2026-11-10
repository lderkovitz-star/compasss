'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ModalPortal from '@/components/ModalPortal';

type Issue = { path: string; message: string; severity: string };
/** The importer's PackPreview, as /api/admin/scenarios/import returns it. */
type Preview = {
  packageName: string;
  packageCode: string;
  codeInUse: boolean;
  scenarioCount: number;
  optionCount: number;
  scoreCount: number;
  newDimensions: string[];
  existingDimensions: string[];
  weightRange: { min: number; max: number } | null;
  issues: Issue[];
};

/**
 * Pack upload from the account list.
 *
 * The full importer lives at /admin/scenarios. This is the short path a rep
 * needs in front of a client: pick a file from the device, see what is in it,
 * write it, and point this account at it - without leaving the screen they
 * are already on.
 *
 * The dry run is not skippable. A pack that half-imports is worse than one
 * that is refused, and on a phone the counts are the only way to tell that
 * the file Grok produced is the file you meant to send.
 */
export default function QuickPackUpload({
  account,
  onClose,
}: {
  account: { id: string; name: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assign, setAssign] = useState(true);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const errors = (preview?.issues ?? []).filter((i) => i.severity === 'error');
  const warnings = (preview?.issues ?? []).filter((i) => i.severity !== 'error');

  async function send(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('dryRun', dryRun ? 'true' : 'false');
      body.append('replaceExisting', replaceExisting ? 'true' : 'false');

      const res = await fetch('/api/admin/scenarios/import', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));

      if (res.status === 409 && !replaceExisting) {
        // A code clash is a question, not a failure: the same pack re-uploaded
        // after an edit is the common case.
        setError(`${json.error ?? 'That package code already exists.'} Tick "replace existing" to overwrite it.`);
        return;
      }
      if (!res.ok) throw new Error(json.error || 'The upload was refused.');

      if (dryRun) {
        setPreview(json.preview ?? null);
        return;
      }

      // Written. Point this account at it if asked.
      const newPackageId = json.result?.packageId ?? null;
      if (assign && newPackageId) {
        const patch = await fetch(`/api/admin/clients/${account.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedPackageId: newPackageId }),
        });
        if (!patch.ok) {
          toast.success('Pack imported');
          toast.error(`Imported, but could not assign it to ${account.name}.`);
          router.refresh();
          onClose();
          return;
        }
        toast.success(`Pack imported and assigned to ${account.name}`);
      } else {
        toast.success('Pack imported');
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function choose(f: File | null) {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith('.json') && !name.endsWith('.csv')) {
      setError('Pick a .json or .csv pack file.');
      return;
    }
    setFile(f);
    setPreview(null);
    setError('');
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
            <h3 className="font-semibold text-slate-900">Upload a scenario pack</h3>
            <p className="text-sm text-slate-500 mt-0.5">For {account.name}</p>
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

        {/* On iOS this opens Files, so a pack sent over email or saved from a
            chat can be picked without a laptop. */}
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={`mt-5 w-full rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors min-h-[96px] ${
            file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}
        >
          {file ? (
            <>
              <p className="text-sm font-semibold text-slate-900 break-all">{file.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {(file.size / 1024).toFixed(0)} KB · tap to choose another
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">Choose a pack from this device</p>
              <p className="text-xs text-slate-500 mt-0.5">.json or .csv, up to 8 MB</p>
            </>
          )}
        </button>

        {preview && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">
              {preview.packageName}{' '}
              <span className="font-mono text-xs font-normal text-slate-500">
                {preview.packageCode}
              </span>
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[
                ['Scenarios', preview.scenarioCount],
                ['Options', preview.optionCount],
                ['Scores', preview.scoreCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-md bg-white border border-slate-200 py-2">
                  <p className="text-base font-bold text-slate-900">{value ?? 0}</p>
                  <p className="text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            {preview.newDimensions.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                {/* The point the client asked about: a pack naming traits we
                    have never seen creates them, it is not rejected. */}
                New traits this pack adds:{' '}
                <span className="font-mono">{preview.newDimensions.join(', ')}</span>
              </p>
            )}
            {preview.codeInUse && (
              <p className="mt-2 text-xs text-amber-700">
                A pack with this code already exists — tick &ldquo;replace existing&rdquo; to
                overwrite it.
              </p>
            )}
            {errors.length > 0 && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2">
                <p className="text-xs font-semibold text-red-800">
                  {errors.length} problem{errors.length === 1 ? '' : 's'} — nothing was written
                </p>
                <ul className="mt-1 space-y-0.5">
                  {errors.slice(0, 5).map((i, n) => (
                    <li key={n} className="text-[11px] text-red-700">
                      <span className="font-mono">{i.path}</span> — {i.message}
                    </li>
                  ))}
                </ul>
                {errors.length > 5 && (
                  <p className="text-[11px] text-red-700 mt-1">…and {errors.length - 5} more.</p>
                )}
              </div>
            )}
            {warnings.length > 0 && errors.length === 0 && (
              <p className="mt-2 text-[11px] text-amber-700">
                {warnings.length} warning{warnings.length === 1 ? '' : 's'} — the pack will import.
              </p>
            )}
          </div>
        )}

        <label className="mt-4 flex items-start gap-3 cursor-pointer">
          <span className="flex h-[44px] w-[24px] flex-shrink-0 items-center justify-center">
            <input
              type="checkbox"
              checked={assign}
              onChange={(e) => setAssign(e.target.checked)}
              className="h-[18px] w-[18px] rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </span>
          <span className="text-sm text-slate-700">
            Assign to {account.name} once imported
            <span className="block text-xs text-slate-500">
              Affects this account only. In-flight invitations keep the pack they were issued with.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <span className="flex h-[44px] w-[24px] flex-shrink-0 items-center justify-center">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="h-[18px] w-[18px] rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </span>
          <span className="text-sm text-slate-700">
            Replace a pack with the same code
            <span className="block text-xs text-slate-500">
              Scenarios already answered are updated in place, never deleted.
            </span>
          </span>
        </label>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => send(true)}
            className="btn-secondary flex-1 justify-center min-h-[48px] disabled:opacity-50"
          >
            {busy && !preview ? 'Checking…' : 'Check file'}
          </button>
          <button
            type="button"
            disabled={!file || busy || !preview || errors.length > 0}
            onClick={() => send(false)}
            className="btn-primary flex-1 justify-center min-h-[48px] disabled:opacity-50"
          >
            {busy && preview ? 'Importing…' : 'Import'}
          </button>
        </div>
        {!preview && (
          <p className="mt-2 text-xs text-slate-500">
            Check the file first. Import stays disabled until it parses cleanly.
          </p>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
