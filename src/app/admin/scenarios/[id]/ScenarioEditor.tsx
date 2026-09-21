'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, TrashIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface Dimension {
  id: string;
  code: string;
  name: string;
}

interface Score {
  dimensionId: string;
  weightScore: number | string;
}

interface Option {
  id: string;
  optionCode: string;
  optionText: string;
  scores: Score[];
}

interface Scenario {
  id: string;
  narrativeText: string;
  timeLimitSec: number;
  sequenceOrder: number;
  options: Option[];
}

export default function ScenarioEditor({ initialScenario, dimensions }: { initialScenario: Scenario, dimensions: Dimension[] }) {
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Helpers
  const updateScenario = (key: keyof Scenario, val: any) => setScenario(prev => ({ ...prev, [key]: val }));
  
  const updateOptionText = (optIdx: number, text: string) => {
    const newOpts = [...scenario.options];
    newOpts[optIdx].optionText = text;
    updateScenario('options', newOpts);
  };

  const addScore = (optIdx: number) => {
    const newOpts = [...scenario.options];
    if (dimensions.length > 0) {
      newOpts[optIdx].scores.push({ dimensionId: dimensions[0].id, weightScore: 1 });
      updateScenario('options', newOpts);
    }
  };

  const updateScore = (optIdx: number, scoreIdx: number, key: keyof Score, val: any) => {
    const newOpts = [...scenario.options];
    newOpts[optIdx].scores[scoreIdx] = { ...newOpts[optIdx].scores[scoreIdx], [key]: val };
    updateScenario('options', newOpts);
  };

  const removeScore = (optIdx: number, scoreIdx: number) => {
    const newOpts = [...scenario.options];
    newOpts[optIdx].scores.splice(scoreIdx, 1);
    updateScenario('options', newOpts);
  };

  async function handleSave() {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await fetch(`/api/admin/scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario),
      });
      if (!res.ok) throw new Error('Failed to save scenario');
      setMessage({ text: 'Scenario saved successfully!', type: 'success' });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {message.text && (
        <div className={`p-4 rounded-lg text-sm flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'} border`}>
          {message.text}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Scenario Details</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center">
              <label className="text-xs font-semibold text-slate-500 mr-2">Sequence</label>
              <input type="number" min={1} value={scenario.sequenceOrder} onChange={e => updateScenario('sequenceOrder', Number(e.target.value))} className="w-16 px-2 py-1 text-sm border rounded-md text-slate-900 bg-white" />
            </div>
            <div className="flex items-center">
              <label className="text-xs font-semibold text-slate-500 mr-2">Time (s)</label>
              <input type="number" min={10} value={scenario.timeLimitSec} onChange={e => updateScenario('timeLimitSec', Number(e.target.value))} className="w-20 px-2 py-1 text-sm border rounded-md text-slate-900 bg-white" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Narrative Prompt</label>
          <textarea
            className="w-full px-3 sm:px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 min-h-[140px]"
            value={scenario.narrativeText}
            onChange={e => updateScenario('narrativeText', e.target.value)}
            placeholder="Type the situational narrative here..."
          />
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {scenario.options.map((opt, oIdx) => (
          <div key={opt.id || opt.optionCode} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">

            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                {opt.optionCode}
              </div>
              <h3 className="font-bold text-slate-900">Option {opt.optionCode}</h3>
            </div>
            
            <textarea
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 min-h-[80px] mb-4"
              value={opt.optionText}
              onChange={e => updateOptionText(oIdx, e.target.value)}
              placeholder={`Enter text for option ${opt.optionCode}...`}
            />

            <div className="flex-1 bg-slate-50/50 rounded-lg border border-slate-100 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Dimension Scores</h4>
                <button onClick={() => addScore(oIdx)} className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                  <PlusIcon className="w-3 h-3" /> Add Mapping
                </button>
              </div>
              
              {opt.scores.length === 0 ? (
                <div className="text-xs text-slate-400 py-2 flex items-center gap-1">
                  <InformationCircleIcon className="w-4 h-4" /> No dimensions mapped.
                </div>
              ) : (
                <div className="space-y-2">
                  {opt.scores.map((score, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <select 
                        value={score.dimensionId} 
                        onChange={e => updateScore(oIdx, sIdx, 'dimensionId', e.target.value)}
                        className="flex-1 min-w-[140px] text-xs border border-slate-300 rounded bg-white px-2 py-1.5 outline-none text-slate-900"
                      >
                        {dimensions.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <input 
                        type="number" step="0.5"
                        value={score.weightScore}
                        onChange={e => updateScore(oIdx, sIdx, 'weightScore', e.target.value)}
                        className="w-16 text-xs border border-slate-300 rounded bg-white px-2 py-1.5 outline-none text-slate-900 text-center"
                      />
                      <button onClick={() => removeScore(oIdx, sIdx)} className="text-slate-400 hover:text-red-500 p-1">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>


      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Scenario'}
        </button>
      </div>
    </div>
  );
}
