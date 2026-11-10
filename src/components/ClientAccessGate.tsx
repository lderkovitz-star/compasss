'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ModalPortal from './ModalPortal';

/**
 * The footer entrance to the console.
 *
 * A link rather than a hidden gesture. The previous plan was a key chord,
 * which does not exist on a tablet - and the protection was never the
 * obscurity of the entrance anyway, it is the rate-limited comparison behind
 * it. A visible link that a candidate ignores costs nothing and is the only
 * version a field rep can use one-handed.
 *
 * Whether key sign-in is offered at all is asked of the server when the modal
 * opens, not baked into the page: a deployment with no key configured shows
 * the password route instead of a box that cannot work.
 */
export default function ClientAccessGate({ label = 'Client Access' }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    let cancelled = false;
    fetch('/api/auth/master-key', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setEnabled(Boolean(d?.enabled));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open && enabled) inputRef.current?.focus();
  }, [open, enabled]);

  // Escape closes. Expected of a modal, and on a tablet keyboard it is the
  // only way out that does not need a precise tap.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyValue.trim()) {
      setError('Enter your access key.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/master-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyValue.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'That access key was not recognised.');
      // Straight to the account list - the screen a rep opened this for.
      router.push('/admin/clients');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setKeyValue('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center text-[12.5px] text-[#39415A] transition-colors hover:text-[#8E99B4]"
      >
        {label}
      </button>

      {open && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#05070C]/80 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Client access"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[#1C2436] bg-[#0E1626] p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[15px] font-semibold text-white">Client Access</h2>
                <p className="mt-1 text-[12.5px] text-[#8E99B4]">
                  For Continental Works staff. Candidates do not need this.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 flex h-[44px] w-[44px] items-center justify-center rounded-lg text-[#5B6580] transition-colors hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {enabled === null && (
              <p className="mt-6 text-[13px] text-[#5B6580]">Checking…</p>
            )}

            {enabled === false && (
              <div className="mt-5">
                <p className="text-[13px] leading-relaxed text-[#97A2BE]">
                  Key access is not configured on this deployment. Sign in with your console
                  account instead.
                </p>
                <a
                  href="/admin"
                  className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#2E63F6] text-[14px] font-semibold text-white transition-colors hover:bg-[#5B8CFF]"
                >
                  Go to sign in
                </a>
              </div>
            )}

            {enabled === true && (
              <form onSubmit={submit} className="mt-5">
                <label htmlFor="master-key" className="block text-[12px] font-medium text-[#97A2BE]">
                  Access key
                </label>
                <input
                  ref={inputRef}
                  id="master-key"
                  name="master-key"
                  type="password"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={keyValue}
                  disabled={busy}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="mt-2 min-h-[48px] w-full rounded-xl border border-[#2A3550] bg-[#0B1220] px-4 text-[15px] text-white placeholder-[#39415A] outline-none transition-colors focus:border-[#5B8CFF] focus:ring-1 focus:ring-[#5B8CFF]"
                />

                {error && (
                  <p className="mt-3 rounded-lg border border-[#5A2733] bg-[#2A1119] px-3 py-2 text-[12.5px] text-[#FF8E8E]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#2E63F6] text-[14px] font-semibold text-white transition-colors hover:bg-[#5B8CFF] disabled:opacity-50"
                >
                  {busy ? 'Checking…' : 'Unlock console'}
                </button>

                <a
                  href="/admin"
                  className="mt-3 flex min-h-[44px] items-center justify-center text-[12.5px] text-[#5B6580] transition-colors hover:text-[#8E99B4]"
                >
                  Sign in with email instead
                </a>
              </form>
            )}
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
