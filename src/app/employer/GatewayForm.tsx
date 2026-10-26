'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GatewayForm({
  supportEmail,
  from,
}: {
  supportEmail: string;
  from?: string;
}) {
  const router = useRouter();
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!accessKey.trim()) {
      setError('Enter your authorization key.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/portal/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey }),
      });

      let json: { error?: string } = {};
      try {
        json = await res.json();
      } catch {
        // A non-JSON body means the platform rejected the request before it
        // reached us; fall through to the status-based message.
      }

      if (!res.ok) {
        throw new Error(json.error || `Could not verify the key (HTTP ${res.status}).`);
      }

      // The authorization lives in an httpOnly cookie, so a full navigation
      // picks it up and it survives tab switches without anything in storage
      // a script could read.
      router.replace(from || '/employer/candidates');
      router.refresh();
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Network connection interrupted. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-xl"
    >
      <h2 className="text-[15px] font-semibold text-white">Enterprise Admin Locked</h2>
      <p className="text-[13px] text-[#97A2BE] mt-1.5">
        Enter your authorization key to unlock your organization&apos;s candidate ledger and
        reports.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <label className="block text-[12px] font-medium text-[#97A2BE] mt-5 mb-1.5" htmlFor="accessKey">
        Authorization key
      </label>
      <input
        id="accessKey"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={accessKey}
        onChange={(e) => setAccessKey(e.target.value)}
        placeholder="CMP-XXXXXXXX-..."
        className="w-full rounded-xl border border-white/10 bg-[#0B0F17]/50 px-3.5 py-3 text-sm font-mono text-white placeholder-[#5B6580] outline-none transition-all focus:border-[#5B8CFF] focus:ring-1 focus:ring-[#5B8CFF]"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-5 bg-[#2E63F6] text-white text-[14px] font-semibold px-4 py-3 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_rgba(46,99,246,0.4)] hover:bg-[#5B8CFF] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Verifying…' : 'Unlock ledger'}
      </button>

      <p className="text-[11.5px] text-[#5B6580] mt-5 text-center">
        No key? Contact{' '}
        <a href={`mailto:${supportEmail}`} className="text-[#5B8CFF] hover:underline">
          {supportEmail}
        </a>{' '}
        to acquire enterprise access.
      </p>
    </form>
  );
}
