'use client';

import Link from 'next/link';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type Account = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  status: string;
  accessKeyPrefix: string | null;
  accessKeyLast4: string | null;
  assignedPackageId: string | null;
  createdAt: string;
  assignedPackage: { id: string; name: string } | null;
  _count: { candidates: number; sessions: number; invites: number };
  testedCount: number;
};

type Pkg = { id: string; name: string; code: string };

export default function ClientAccountsClient({
  accounts,
  packages,
  defaultPackageId,
}: {
  accounts: Account[];
  packages: Pkg[];
  defaultPackageId: string | null;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', contactEmail: '', assignedPackageId: '' });
  /** Held in state only — the server never returns a key again. */
  const [issuedKey, setIssuedKey] = useState<{ company: string; key: string } | null>(null);

  const defaultPackageName =
    packages.find((p) => p.id === defaultPackageId)?.name ?? 'none set';

  async function createAccount() {
    if (!form.name.trim() || !form.contactEmail.trim()) {
      toast.error('Company name and contact email are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create account.');

      setIssuedKey({ company: json.account.name, key: json.accessKey });
      setForm({ name: '', contactEmail: '', assignedPackageId: '' });
      setCreating(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function rotateKey(account: Account) {
    if (!confirm(`Issue a new access key for ${account.name}? The current key stops working immediately.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clients/${account.id}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to rotate key.');
      setIssuedKey({ company: account.name, key: json.accessKey });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function patch(account: Account, data: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clients/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Update failed.');
      toast.success(message);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* The key is readable exactly once, so make that unmissable. */}
      {issuedKey && (
        <div className="card card-p mb-6 border-amber-300 bg-amber-50">
          <h3 className="font-semibold text-amber-900">
            Access key for {issuedKey.company}
          </h3>
          <p className="text-sm text-amber-800 mt-1">
            Copy this now and send it to them over a channel you trust. It cannot be shown again —
            if it is lost, issue a new one.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <code className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded font-mono text-sm text-slate-900 break-all">
              {issuedKey.key}
            </code>
            <button
              className="btn-secondary whitespace-nowrap"
              onClick={() => {
                navigator.clipboard.writeText(issuedKey.key);
                toast.success('Copied');
              }}
            >
              Copy
            </button>
            <button className="btn-ghost" onClick={() => setIssuedKey(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600">
          {accounts.length} account{accounts.length === 1 ? '' : 's'} · accounts with no package
          override follow the global default ({defaultPackageName})
        </p>
        <button className="btn-primary" onClick={() => setCreating((v) => !v)} disabled={busy}>
          {creating ? 'Cancel' : 'New client account'}
        </button>
      </div>

      {creating && (
        <div className="card card-p mb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">Company name</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Acme Corporation"
              />
            </div>
            <div>
              <label className="form-label">Contact email</label>
              <input
                className="form-input"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                placeholder="hr@acme.com"
              />
              <p className="text-xs text-slate-500 mt-1">
                Where completed assessment notifications go.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Scenario package</label>
              <select
                className="form-select"
                value={form.assignedPackageId}
                onChange={(e) => setForm((f) => ({ ...f, assignedPackageId: e.target.value }))}
              >
                <option value="">Follow the global default ({defaultPackageName})</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                An override applies to this account only. It never changes what any other account
                or the public sandbox is running.
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button className="btn-primary" onClick={createAccount} disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="card card-p text-center text-slate-500">
          No client accounts yet. Create one to issue its first access key.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="th">Company</th>
                <th className="th text-center">Access key</th>
                <th className="th text-center">Scenario package</th>
                <th className="th text-center">Candidates</th>
                <th className="th text-center">Status</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="tr">
                  <td className="td">
                    <div className="font-medium text-slate-900">{a.name}</div>
                    <div className="text-xs text-slate-500">{a.contactEmail}</div>
                  </td>
                  <td className="td text-center">
                    {a.accessKeyPrefix ? (
                      <code className="text-xs font-mono text-slate-600">
                        CMP-{a.accessKeyPrefix}-…{a.accessKeyLast4}
                      </code>
                    ) : (
                      <span className="badge-slate text-xs">none</span>
                    )}
                  </td>
                  <td className="td text-center">
                    <select
                      className="form-select text-xs"
                      value={a.assignedPackageId ?? ''}
                      disabled={busy}
                      onChange={(e) =>
                        patch(a, { assignedPackageId: e.target.value }, `${a.name} updated`)
                      }
                    >
                      <option value="">Global default — {defaultPackageName}</option>
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td text-center">
                    <span className="text-slate-900 font-medium">{a.testedCount}</span>
                    <div className="text-xs text-slate-500">
                      tested · {a._count.candidates} invited
                    </div>
                  </td>
                  <td className="td text-center">
                    <span className={a.status === 'ACTIVE' ? 'badge-green' : 'badge-amber'}>
                      {a.status}
                    </span>
                  </td>
                  <td className="td text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/admin/clients/${a.id}/cohort`}
                        className="btn-ghost text-xs inline-flex items-center"
                      >
                        Cohort AI
                      </Link>
                      <button className="btn-ghost text-xs" disabled={busy} onClick={() => rotateKey(a)}>
                        Rotate key
                      </button>
                      <button
                        className="btn-ghost text-xs"
                        disabled={busy}
                        onClick={() =>
                          patch(
                            a,
                            { status: a.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
                            a.status === 'ACTIVE' ? `${a.name} suspended` : `${a.name} reactivated`
                          )
                        }
                      >
                        {a.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
