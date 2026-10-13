'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Issue = { path: string; message: string; severity: 'error' | 'warning' };

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
  optionsPerScenario: { min: number; max: number };
  issues: Issue[];
};

type Result = {
  packageCode: string;
  scenariosCreated: number;
  scenariosUpdated: number;
  scenariosRetired: number;
  options: number;
  scores: number;
  dimensionsCreated: string[];
};

const SAMPLE = {
  package: {
    name: 'Fleet Operations Crisis',
    code: 'FLEET_OPS_V1',
    description: 'High-tempo crisis command simulation',
    version: '1.0.0',
  },
  dimensions: [
    { code: 'FLEET_TEMPO', name: 'Tempo Under Load', category: 'Execution' },
    { code: 'FLEET_CANDOUR', name: 'Candour', category: 'Governance' },
  ],
  scenarios: [
    {
      sequenceOrder: 1,
      externalRef: 'FLEET-001',
      title: 'Dock Fire',
      narrativeText:
        'A fire breaks out in the forward hold while the ship is still taking on fuel at the pier, with forty crew aboard.',
      decisionPoint: 'What is your first order?',
      timeLimitSec: 90,
      options: [
        {
          label: 'A',
          title: 'Pull the fuel line',
          text: 'You stop bunkering immediately and order the line disconnected before anything else.',
          scores: { FLEET_TEMPO: 8, FLEET_CANDOUR: 3 },
        },
        {
          label: 'B',
          title: 'Fight it first',
          text: 'You send the duty party forward with hoses and keep bunkering, betting the fire is small.',
          scores: { FLEET_TEMPO: -4, FLEET_CANDOUR: 2 },
        },
      ],
    },
  ],
};

const SAMPLE_CSV = `sequence,title,narrative,decision_point,time_limit_sec,option_label,option_title,option_text,FLEET_TEMPO,FLEET_CANDOUR
1,Dock Fire,"A fire breaks out in the forward hold while the ship is still taking on fuel at the pier, with forty crew aboard.","What is your first order?",90,A,Pull the fuel line,"You stop bunkering immediately and order the line disconnected before anything else.",8,3
1,,,,,B,Fight it first,"You send the duty party forward with hoses and keep bunkering, betting the fire is small.",-4,2
`;

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PackUploader({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const errors = preview?.issues.filter((i) => i.severity === 'error') ?? [];
  const warnings = preview?.issues.filter((i) => i.severity === 'warning') ?? [];

  const check = useCallback(
    async (chosen: File, overrideName?: string, overrideCode?: string) => {
      setChecking(true);
      setError('');
      setPreview(null);
      setResult(null);
      setReplaceConfirmed(false);
      try {
        const body = new FormData();
        body.set('file', chosen);
        body.set('dryRun', 'true');
        if (overrideName) body.set('packageName', overrideName);
        if (overrideCode) body.set('packageCode', overrideCode);

        const res = await fetch('/api/admin/scenarios/import', { method: 'POST', body });
        const data = await res.json();
        if (data.preview) {
          setPreview(data.preview);
          setName((current) => current || data.preview.packageName);
          setCode((current) => current || data.preview.packageCode);
        }
        if (!res.ok && !data.preview) setError(data.error ?? 'That file could not be read.');
      } catch {
        setError('The file could not be uploaded. Check your connection and try again.');
      } finally {
        setChecking(false);
      }
    },
    []
  );

  function accept(chosen: File | undefined) {
    if (!chosen) return;
    setFile(chosen);
    setName('');
    setCode('');
    void check(chosen);
  }

  async function runImport() {
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('dryRun', 'false');
      if (name) body.set('packageName', name);
      if (code) body.set('packageCode', code);
      if (replaceConfirmed) body.set('replaceExisting', 'true');

      const res = await fetch('/api/admin/scenarios/import', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'The import failed.');
        if (data.preview) setPreview(data.preview);
        return;
      }
      setResult(data.result);
      router.refresh();
    } catch {
      setError('The import could not be sent. Check your connection and try again.');
    } finally {
      setImporting(false);
    }
  }

  const blocked = errors.length > 0 || (preview?.codeInUse && !replaceConfirmed);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl relative z-[101] max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Upload a scenario pack</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              JSON or CSV. Nothing is saved until you accept the summary.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {result ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">
                {result.packageCode} imported
              </p>
              <ul className="mt-2 text-[13px] text-emerald-800 space-y-0.5">
                <li>{result.scenariosCreated} scenarios added</li>
                {result.scenariosUpdated > 0 && <li>{result.scenariosUpdated} updated in place</li>}
                {result.scenariosRetired > 0 && <li>{result.scenariosRetired} retired</li>}
                <li>
                  {result.options} options and {result.scores} dimension weights written
                </li>
                {result.dimensionsCreated.length > 0 && (
                  <li>New dimensions: {result.dimensionsCreated.join(', ')}</li>
                )}
              </ul>
              <p className="mt-3 text-xs text-emerald-800">
                This pack is not live until it is assigned — to the public sandbox, as the global
                client default, or to a specific client account.
              </p>
            </div>
          ) : (
            <>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  accept(e.dataTransfer.files?.[0]);
                }}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  className="hidden"
                  onChange={(e) => accept(e.target.files?.[0])}
                />
                <p className="text-sm font-medium text-slate-900">
                  {file ? file.name : 'Drop a .json or .csv file here'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {file
                    ? `${(file.size / 1024).toFixed(0)} KB — click to choose a different file`
                    : 'or click to choose one'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => download('sample-pack.json', JSON.stringify(SAMPLE, null, 2), 'application/json')}
                  className="btn-ghost px-3 py-1.5 text-blue-600"
                >
                  Download JSON template
                </button>
                <button
                  type="button"
                  onClick={() => download('sample-pack.csv', SAMPLE_CSV, 'text/csv')}
                  className="btn-ghost px-3 py-1.5 text-blue-600"
                >
                  Download CSV template
                </button>
              </div>

              {checking && <p className="text-sm text-slate-500">Reading the file…</p>}

              {preview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="form-label">Package name</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="form-input text-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="form-label">Package code</span>
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="form-input text-slate-900 font-mono text-[13px]"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-[13px]">
                    <Row label="Scenarios" value={String(preview.scenarioCount)} />
                    <Row
                      label="Options"
                      value={`${preview.optionCount} (${
                        preview.optionsPerScenario.min === preview.optionsPerScenario.max
                          ? `${preview.optionsPerScenario.min} per scenario`
                          : `${preview.optionsPerScenario.min}–${preview.optionsPerScenario.max} per scenario`
                      })`}
                    />
                    <Row label="Dimension weights" value={String(preview.scoreCount)} />
                    {preview.weightRange && (
                      <Row
                        label="Weight scale"
                        value={`${preview.weightRange.min} to ${preview.weightRange.max}`}
                      />
                    )}
                    {preview.existingDimensions.length > 0 && (
                      <Row
                        label="Existing dimensions"
                        value={preview.existingDimensions.join(', ')}
                      />
                    )}
                    {preview.newDimensions.length > 0 && (
                      <Row
                        label="New dimensions"
                        value={preview.newDimensions.join(', ')}
                        hint="These will be created."
                      />
                    )}
                  </div>

                  {preview.codeInUse && (
                    <label className="flex gap-2 items-start rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <input
                        type="checkbox"
                        checked={replaceConfirmed}
                        onChange={(e) => setReplaceConfirmed(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span className="text-[13px] text-amber-900">
                        <strong>{preview.packageCode}</strong> already exists. Replace its contents
                        with this file. Scenarios already in it are updated rather than duplicated,
                        and anything the file no longer contains is retired. Assessments already
                        completed keep their reports.
                      </span>
                    </label>
                  )}

                  {errors.length > 0 && (
                    <IssueList
                      title={`${errors.length} problem${errors.length === 1 ? '' : 's'} to fix`}
                      tone="error"
                      issues={errors}
                    />
                  )}
                  {warnings.length > 0 && (
                    <IssueList
                      title={`${warnings.length} thing${warnings.length === 1 ? '' : 's'} worth checking`}
                      tone="warning"
                      issues={warnings}
                    />
                  )}
                </div>
              )}

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          {result ? (
            <button onClick={onClose} className="btn-primary text-sm px-5 py-2">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="btn-ghost text-sm px-4 py-2 text-slate-600">
                Cancel
              </button>
              <button
                onClick={runImport}
                disabled={!preview || blocked || importing || checking}
                className="btn-primary text-sm px-5 py-2"
                title={blocked ? 'Fix the problems listed above first.' : undefined}
              >
                {importing
                  ? 'Importing…'
                  : preview
                    ? `Import ${preview.scenarioCount} scenarios`
                    : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-900 font-medium">
        {value}
        {hint && <span className="block text-xs font-normal text-slate-500">{hint}</span>}
      </span>
    </div>
  );
}

function IssueList({
  title,
  tone,
  issues,
}: {
  title: string;
  tone: 'error' | 'warning';
  issues: Issue[];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? issues : issues.slice(0, 8);
  const palette =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <div className={`rounded-xl border p-3 ${palette}`}>
      <p className="text-[13px] font-semibold">{title}</p>
      <ul className="mt-1.5 space-y-1 text-xs">
        {shown.map((issue, i) => (
          <li key={i}>
            <span className="font-mono">{issue.path}</span> — {issue.message}
          </li>
        ))}
      </ul>
      {issues.length > shown.length && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs font-semibold underline"
        >
          Show {issues.length - shown.length} more
        </button>
      )}
    </div>
  );
}
