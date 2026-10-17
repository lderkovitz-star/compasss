'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type PackageOption = { id: string; name: string; code: string; scenarioCount: number };

type Props = {
  packages: PackageOption[];
  sandboxPackageId: string | null;
  defaultClientPackageId: string | null;
  defaultSessionDepth: number | null;
  overrideCount: number;
  accountCount: number;
};

/**
 * Which pack runs where. Three independent slots, so assigning one never
 * disturbs another.
 */
export default function AssignmentMatrix({
  packages,
  sandboxPackageId,
  defaultClientPackageId,
  defaultSessionDepth,
  overrideCount,
  accountCount,
}: Props) {
  const router = useRouter();
  const [sandbox, setSandbox] = useState(sandboxPackageId ?? '');
  const [clientDefault, setClientDefault] = useState(defaultClientPackageId ?? '');
  const [depth, setDepth] = useState(defaultSessionDepth?.toString() ?? '');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function patch(field: string, value: string | null, label: string) {
    setSaving(field);
    setError('');
    setSaved('');
    try {
      const res = await fetch('/api/admin/packages/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not save that.');
        return;
      }
      setSaved(label);
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSaving(null);
    }
  }

  const usable = packages.filter((p) => p.scenarioCount > 0);
  const followingDefault = accountCount - overrideCount;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="font-semibold text-slate-900">Where each pack runs</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Three separate slots. Changing one does not affect the others, and an invite keeps the
          pack it was issued with even if a slot changes afterwards.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        <Slot
          title="Public sandbox"
          description="What anyone practising on the public page runs. Never appears in a client ledger."
          value={sandbox}
          options={usable}
          busy={saving === 'sandboxPackageId'}
          emptyLabel="Practice disabled"
          onChange={(v) => {
            setSandbox(v);
            void patch('sandboxPackageId', v || null, 'Sandbox pack updated');
          }}
        />

        <Slot
          title="Global client default"
          description={
            accountCount === 0
              ? 'What a newly onboarded client account runs.'
              : `What a client account runs unless it has its own override. ${followingDefault} of ${accountCount} ${
                  followingDefault === 1 ? 'account follows' : 'accounts follow'
                } this.`
          }
          value={clientDefault}
          options={usable}
          busy={saving === 'defaultClientPackageId'}
          emptyLabel="No default set"
          onChange={(v) => {
            setClientDefault(v);
            void patch('defaultClientPackageId', v || null, 'Client default updated');
          }}
        />

        <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">Per-company override</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {overrideCount === 0
                ? 'No account overrides the default right now.'
                : `${overrideCount} ${overrideCount === 1 ? 'account runs' : 'accounts run'} a pack of their own.`}
            </p>
          </div>
          <Link href="/admin/clients" className="btn-secondary text-xs px-3 py-1.5">
            Set per account
          </Link>
        </div>

        <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">Default sitting length</p>
            <p className="text-xs text-slate-500 mt-0.5">
              How many scenarios a candidate is given when the invite does not say. Leave it empty
              to run the whole pack. Scores are normalised against what was actually served, so a
              shorter sitting is not a lower score.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={500}
              value={depth}
              placeholder="all"
              onChange={(e) => setDepth(e.target.value)}
              className="form-input w-24 text-slate-900"
            />
            <button
              onClick={() => void patch('defaultSessionDepth', depth === '' ? null : depth, 'Sitting length updated')}
              disabled={saving === 'defaultSessionDepth'}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {saving === 'defaultSessionDepth' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {(error || saved) && (
        <div
          className={`px-5 py-3 text-[13px] border-t ${
            error
              ? 'border-red-100 bg-red-50 text-red-800'
              : 'border-emerald-100 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error || saved}
        </div>
      )}
    </div>
  );
}

function Slot({
  title,
  description,
  value,
  options,
  onChange,
  busy,
  emptyLabel,
}: {
  title: string;
  description: string;
  value: string;
  options: PackageOption[];
  onChange: (value: string) => void;
  busy: boolean;
  emptyLabel: string;
}) {
  return (
    <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <select
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="form-select text-xs max-w-[18rem]"
      >
        <option value="">{emptyLabel}</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.scenarioCount} scenarios
          </option>
        ))}
      </select>
    </div>
  );
}
