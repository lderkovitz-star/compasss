'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

type Provider = {
  key: string;
  label: string;
  providerType: 'ANTHROPIC' | 'OPENAI_COMPATIBLE';
  model: string;
  baseUrl: string | null;
  maxTokens: number;
  isEnabled: boolean;
  keyConfigured: boolean;
  keyLast4: string | null;
  lastTestedAt: string | null;
  lastTestError: string | null;
};

/**
 * Which model evaluates candidates, and with whose key.
 *
 * The model id is free text rather than a dropdown on purpose: model names
 * change constantly, and a fixed list goes stale and leaves an operator unable
 * to select a model that exists.
 */
export default function AiProviderPanel({ canEdit }: { canEdit: boolean }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeKey, setActiveKey] = useState('anthropic');
  const [selected, setSelected] = useState('anthropic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [draft, setDraft] = useState({ model: '', baseUrl: '', maxTokens: 1024 });

  const current = providers.find((p) => p.key === selected) ?? null;
  const needsBaseUrl = current?.providerType === 'OPENAI_COMPATIBLE';

  async function load() {
    try {
      const res = await fetch('/api/admin/ai/providers');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProviders(data.providers);
      setActiveKey(data.activeProviderKey);
      setSelected((s) => (data.providers.some((p: Provider) => p.key === s) ? s : data.activeProviderKey));
    } catch {
      toast.error('Could not load the AI providers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!current) return;
    setDraft({
      model: current.model,
      baseUrl: current.baseUrl ?? '',
      maxTokens: current.maxTokens,
    });
    setApiKey('');
  }, [selected, current?.model, current?.baseUrl, current?.maxTokens]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(payload: Record<string, unknown>, success: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save that.');
        return false;
      }
      toast.success(success);
      await load();
      return true;
    } catch {
      toast.error('Could not reach the server.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!current) return;
    const payload: Record<string, unknown> = {
      key: current.key,
      model: draft.model,
      maxTokens: Number(draft.maxTokens),
    };
    if (needsBaseUrl) payload.baseUrl = draft.baseUrl;
    if (apiKey.trim()) payload.apiKey = apiKey.trim();
    const ok = await patch(payload, `${current.label} saved`);
    if (ok) setApiKey('');
  }

  async function test() {
    if (!current) return;
    setTesting(true);
    try {
      const res = await fetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: current.key }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`${current.label} answered in ${data.latencyMs}ms using ${data.model}`);
      } else {
        toast.error(data.error ?? 'The provider did not answer.');
      }
      await load();
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading providers…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="form-label">Provider</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="form-input text-slate-900"
        >
          {providers.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
              {p.key === activeKey ? ' — live' : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1.5">
          {selected === activeKey
            ? 'This is the provider evaluations currently use.'
            : `Evaluations currently use ${providers.find((p) => p.key === activeKey)?.label ?? activeKey}.`}
        </p>
      </div>

      {current && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={needsBaseUrl ? '' : 'sm:col-span-2'}>
              <label className="form-label">Model ID</label>
              <input
                value={draft.model}
                onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                disabled={!canEdit}
                placeholder={current.providerType === 'ANTHROPIC' ? 'claude-sonnet-4-5' : 'gpt-4o-mini'}
                className="form-input text-slate-900 font-mono text-[13px]"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Typed in rather than chosen from a list, because model names change often.
              </p>
            </div>

            {needsBaseUrl && (
              <div>
                <label className="form-label">Base URL</label>
                <input
                  value={draft.baseUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                  disabled={!canEdit}
                  placeholder="https://openrouter.ai/api/v1"
                  className="form-input text-slate-900 font-mono text-[13px]"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Must be https. Any endpoint speaking the OpenAI chat format works here.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="form-label">API key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={!canEdit}
                autoComplete="off"
                placeholder={
                  current.keyConfigured
                    ? `Saved — ends ${current.keyLast4 ?? '••••'}. Type a new one to replace it.`
                    : 'Paste the key'
                }
                className="form-input text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Stored encrypted and never sent back to this page — only whether one is saved and
                its last four characters.
              </p>
            </div>

            <div>
              <label className="form-label">Max tokens per reply</label>
              <input
                type="number"
                min={128}
                max={32000}
                value={draft.maxTokens}
                onChange={(e) => setDraft((d) => ({ ...d, maxTokens: Number(e.target.value) }))}
                disabled={!canEdit}
                className="form-input text-slate-900"
              />
            </div>
          </div>

          {current.lastTestError && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">
              Last test failed: {current.lastTestError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={save}
              disabled={!canEdit || saving}
              className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save provider'}
            </button>
            <button
              onClick={test}
              disabled={!canEdit || testing || !current.keyConfigured}
              title={current.keyConfigured ? undefined : 'Save a key first.'}
              className="btn-secondary text-sm px-4 py-2"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            {selected !== activeKey && (
              <button
                onClick={() => void patch({ activeProviderKey: selected }, `${current.label} is now live`)}
                disabled={!canEdit || saving}
                className="btn-secondary text-sm px-4 py-2"
              >
                Make this provider live
              </button>
            )}
          </div>

          {!canEdit && (
            <p className="text-xs text-slate-500">
              Only a super admin can change the provider or its key.
            </p>
          )}
        </>
      )}
    </div>
  );
}
