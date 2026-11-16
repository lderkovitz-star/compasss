'use client';

import { useState } from 'react';

/**
 * "Request access or a demo", for the landing page and the practice result.
 *
 * Posts to /api/contact, which saves the request for the Master Admin's
 * Contact requests page. Nothing is emailed, so the confirmation says a reply
 * will come, not when.
 *
 * The "website" field is a honeypot: moved off-screen, out of the tab order
 * and hidden from screen readers, so only a bot fills it in.
 */
export default function ContactForm({ source }: { source: 'landing' | 'practice-result' }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setError('Please enter a valid email address.');
    }
    setBusy(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Your request could not be sent. Please try again.');
      setSent({ name: form.name.trim(), email: form.email.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border border-[#35E0C8]/25 bg-[#35E0C8]/[0.07] px-5 py-4 text-left">
        <p className="text-[14px] font-semibold text-[#35E0C8]">Thank you, {sent.name}.</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#97A2BE]">
          We have your request and will reply to {sent.email}.
        </p>
      </div>
    );
  }

  const id = (field: string) => `${source}-contact-${field}`;
  const label = 'block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B8CFF]';
  const input =
    'mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-[14px] text-white placeholder:text-[#5B6580] focus:border-[#5B8CFF] focus:outline-none';

  return (
    <form data-contact-form onSubmit={submit} noValidate className="relative space-y-4 text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id('name')} className={label}>
            Your name
          </label>
          <input id={id('name')} value={form.name} onChange={set('name')} maxLength={120} autoComplete="name" className={input} />
        </div>
        <div>
          <label htmlFor={id('email')} className={label}>
            Work email
          </label>
          <input
            id={id('email')}
            type="email"
            value={form.email}
            onChange={set('email')}
            maxLength={190}
            autoComplete="email"
            className={input}
          />
        </div>
      </div>
      <div>
        <label htmlFor={id('company')} className={label}>
          Company
          <span className="ml-2 font-normal tracking-normal text-[#5B6580] normal-case">Optional</span>
        </label>
        <input id={id('company')} value={form.company} onChange={set('company')} maxLength={160} autoComplete="organization" className={input} />
      </div>
      <div>
        <label htmlFor={id('message')} className={label}>
          What would you like?
          <span className="ml-2 font-normal tracking-normal text-[#5B6580] normal-case">Optional</span>
        </label>
        <textarea
          id={id('message')}
          value={form.message}
          onChange={set('message')}
          rows={3}
          maxLength={2000}
          placeholder="Access for your team, a demo, or a question."
          className={input}
        />
      </div>

      <div aria-hidden="true" className="absolute -left-[10000px] top-0 h-px w-px overflow-hidden">
        <label htmlFor={id('website')}>Website</label>
        <input id={id('website')} name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="min-h-[48px] w-full sm:w-auto px-6 rounded-xl text-[14px] font-semibold bg-[#2E63F6] text-white hover:bg-[#5B8CFF] transition-colors disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}
