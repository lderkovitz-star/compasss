'use client';

import Link from 'next/link';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import QuickInvite from './QuickInvite';
import QuickPackUpload from './QuickPackUpload';

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
  candidateSeatLimit: number | null;
  /** Invitations currently holding a seat; see src/lib/seats.ts. */
  seatsUsed: number;
};

type Pkg = { id: string; name: string; code: string };

/**
 * Seat limit cell.
 *
 * Kept as a local draft until it is committed, because a field that saves on
 * every keystroke would fire a request for "1", "12" and "120" on the way to
 * typing 120 - and the "1" would be rejected as below the seats already used.
 */
function SeatCell({
  used,
  limit,
  disabled,
  onCommit,
}: {
  used: number;
  limit: number | null;
  disabled: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(limit === null ? '' : String(limit));

  // The row re-renders from the server after a save; follow it rather than
  // holding a stale draft.
  const [lastLimit, setLastLimit] = useState(limit);
  if (lastLimit !== limit) {
    setLastLimit(limit);
    setDraft(limit === null ? '' : String(limit));
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (limit !== null) onCommit(null);
      return;
    }
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 0) {
      toast.error('Seats must be a whole number, or blank for unlimited.');
      setDraft(limit === null ? '' : String(limit));
      return;
    }
    if (value !== limit) onCommit(value);
  }

  const over = limit !== null && used >= limit;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center gap-1">
        <span className={over ? 'font-semibold text-amber-700' : 'font-medium text-slate-900'}>
          {used}
        </span>
        <span className="text-slate-400">/</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          className="form-input text-xs text-center w-[72px] min-h-[44px]"
          placeholder="∞"
          aria-label="Candidate seat limit"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
      <div className="text-xs text-slate-500">
        {limit === null ? 'unlimited' : over ? 'at limit' : `${limit - used} left`}
      </div>
    </div>
  );
}

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
  /** Which account a modal is open for, if any. */
  const [inviting, setInviting] = useState<Account | null>(null);
  const [uploadingFor, setUploadingFor] = useState<Account | null>(null);

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

      {/* Stacks on a phone. Side by side, the sentence wraps to three lines and
          squeezes the button into a column barely wide enough for its label. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <p className="text-sm text-slate-600">
          {accounts.length} account{accounts.length === 1 ? '' : 's'} · accounts with no package
          override follow the global default ({defaultPackageName})
        </p>
        <button
          className="btn-primary w-full sm:w-auto justify-center min-h-[48px] whitespace-nowrap"
          onClick={() => setCreating((v) => !v)}
          disabled={busy}
        >
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
        <div className="table-wrapper hidden lg:block">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="th">Company</th>
                <th className="th text-center">Access key</th>
                <th className="th text-center">Scenario package</th>
                <th className="th text-center">Candidates</th>
                <th className="th text-center">Seats</th>
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
                      className="form-select text-xs min-w-[190px]"
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
                    <SeatCell
                      used={a.seatsUsed}
                      limit={a.candidateSeatLimit}
                      disabled={busy}
                      onCommit={(value) =>
                        patch(
                          a,
                          { candidateSeatLimit: value },
                          value === null
                            ? `${a.name} set to unlimited seats`
                            : `${a.name} limited to ${value} seat${value === 1 ? '' : 's'}`
                        )
                      }
                    />
                  </td>
                  <td className="td text-center">
                    <span className={a.status === 'ACTIVE' ? 'badge-green' : 'badge-amber'}>
                      {a.status}
                    </span>
                  </td>
                  <td className="td text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="btn-ghost text-xs"
                        disabled={busy}
                        onClick={() => setUploadingFor(a)}
                      >
                        Upload pack
                      </button>
                      <button
                        className="btn-ghost text-xs disabled:opacity-40"
                        disabled={
                          busy ||
                          a.status !== 'ACTIVE' ||
                          (a.candidateSeatLimit !== null && a.seatsUsed >= a.candidateSeatLimit)
                        }
                        title={
                          a.candidateSeatLimit !== null && a.seatsUsed >= a.candidateSeatLimit
                            ? 'No candidate seats remain on this account.'
                            : undefined
                        }
                        onClick={() => setInviting(a)}
                      >
                        Invite
                      </button>
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

      {/* Below lg the table becomes cards. A seven-column table on a phone is
          either a horizontal scroll nobody finds or text too small to tap, and
          this screen is the one a rep opens standing next to a client. The
          three actions they came for are full-width buttons. */}
      {accounts.length > 0 && (
        <div className="lg:hidden space-y-3">
          {accounts.map((a) => {
            const atLimit = a.candidateSeatLimit !== null && a.seatsUsed >= a.candidateSeatLimit;
            return (
              <div key={a.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{a.name}</p>
                    <p className="text-xs text-slate-500 truncate">{a.contactEmail}</p>
                  </div>
                  <span
                    className={`${a.status === 'ACTIVE' ? 'badge-green' : 'badge-amber'} flex-shrink-0`}
                  >
                    {a.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 py-2">
                    <p className="text-lg font-bold text-slate-900">{a.testedCount}</p>
                    <p className="text-[11px] text-slate-500">
                      tested · {a._count.candidates} invited
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border py-2 ${
                      atLimit ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <p
                      className={`text-lg font-bold ${atLimit ? 'text-amber-700' : 'text-slate-900'}`}
                    >
                      {a.seatsUsed}
                      <span className="text-slate-400">/</span>
                      {a.candidateSeatLimit ?? '∞'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {a.candidateSeatLimit === null
                        ? 'seats · unlimited'
                        : atLimit
                          ? 'seats · at limit'
                          : `seats · ${a.candidateSeatLimit - a.seatsUsed} left`}
                    </p>
                  </div>
                </div>

                {/* 1 — swap the assigned pack */}
                <label className="mt-3 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Scenario pack
                </label>
                <select
                  className="form-select mt-1 w-full min-h-[48px] text-sm"
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

                {/* 2 and 3 — upload a pack, and issue a candidate link */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="btn-secondary justify-center min-h-[48px] text-[13px]"
                    disabled={busy}
                    onClick={() => setUploadingFor(a)}
                  >
                    Upload pack
                  </button>
                  <button
                    className="btn-primary justify-center min-h-[48px] text-[13px] disabled:opacity-50"
                    disabled={busy || atLimit || a.status !== 'ACTIVE'}
                    title={atLimit ? 'No candidate seats remain on this account.' : undefined}
                    onClick={() => setInviting(a)}
                  >
                    Invite candidate
                  </button>
                </div>

                <details className="mt-3">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-[13px] text-slate-500">
                    More
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Access key:{' '}
                      {a.accessKeyPrefix ? (
                        <code className="font-mono">
                          CMP-{a.accessKeyPrefix}-…{a.accessKeyLast4}
                        </code>
                      ) : (
                        'none issued'
                      )}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/admin/clients/${a.id}/cohort`}
                        className="btn-ghost justify-center min-h-[44px] text-[13px] inline-flex items-center"
                      >
                        Cohort AI
                      </Link>
                      <button
                        className="btn-ghost justify-center min-h-[44px] text-[13px]"
                        disabled={busy}
                        onClick={() => rotateKey(a)}
                      >
                        Rotate key
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[13px] text-slate-600" htmlFor={`seats-${a.id}`}>
                        Seat limit
                      </label>
                      <input
                        id={`seats-${a.id}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        placeholder="∞"
                        defaultValue={a.candidateSeatLimit ?? ''}
                        disabled={busy}
                        className="form-input w-[90px] min-h-[44px] text-sm text-center"
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const next = raw === '' ? null : Number(raw);
                          if (next !== null && (!Number.isInteger(next) || next < 0)) {
                            toast.error('Seats must be a whole number, or blank for unlimited.');
                            e.target.value = a.candidateSeatLimit === null ? '' : String(a.candidateSeatLimit);
                            return;
                          }
                          if (next === a.candidateSeatLimit) return;
                          patch(
                            a,
                            { candidateSeatLimit: next },
                            next === null
                              ? `${a.name} set to unlimited seats`
                              : `${a.name} limited to ${next} seat${next === 1 ? '' : 's'}`
                          );
                        }}
                      />
                      <button
                        className="btn-ghost ml-auto min-h-[44px] text-[13px]"
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
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}

      {inviting && (
        <QuickInvite account={inviting} onClose={() => setInviting(null)} />
      )}
      {uploadingFor && (
        <QuickPackUpload account={uploadingFor} onClose={() => setUploadingFor(null)} />
      )}
    </>
  );
}
