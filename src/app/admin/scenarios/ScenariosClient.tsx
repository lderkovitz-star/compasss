'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';

interface Package { id: string; name: string; code: string; isActive: boolean; scenarioCount: number; }
interface Scenario {
  id: string;
  sequenceOrder: number;
  narrativeText: string;
  timeLimitSec: number;
  packageId: string;
  packageName: string;
  packageCode: string;
  packageIsActive: boolean;
  optionCount: number;
}

const SAMPLE_SCENARIOS_JSON = [
  {
    "sequenceOrder": 1,
    "narrativeText": "A massive data breach has just been reported in the European division, exposing 2 million customer records. The GDPR reporting window of 72 hours has begun. The Chief Legal Officer advises staying silent until the full scope is known, while the PR Director urges an immediate public apology.",
    "timeLimitSec": 90,
    "options": [
      {
        "label": "A",
        "title": "Issue an immediate public apology and notify regulators, risking early lawsuits.",
        "scores": { "ETHICS_PRESSURE": 95, "RISK_TOLERANCE": 80, "DECISION_VELOCITY": 90, "STRATEGIC_RESILIENCE": 40 }
      },
      {
        "label": "B",
        "title": "Follow Legal's advice: Wait 48 hours to investigate before any public disclosure.",
        "scores": { "ANALYTICAL_PRECISION": 85, "RISK_TOLERANCE": -50, "ETHICS_PRESSURE": -30, "SYSTEMIC_THINKING": 70 }
      },
      {
        "label": "C",
        "title": "Leak a partial story to a friendly journalist to control the narrative while investigating.",
        "scores": { "ETHICS_PRESSURE": -80, "CRISIS_COMMAND": 75, "ADAPTABILITY": 60, "RISK_TOLERANCE": 90 }
      },
      {
        "label": "D",
        "title": "Notify regulators privately but delay public notification until the fix is deployed.",
        "scores": { "SYSTEMIC_THINKING": 85, "CONFLICT_RESOLUTION": 70, "ETHICS_PRESSURE": 50, "DECISION_VELOCITY": 40 }
      }
    ]
  },
  {
    "sequenceOrder": 2,
    "narrativeText": "Your company's stock has plummeted 30% following rumors of a hostile takeover by a rival firm (ApexCorp). Your CFO suggests a 'poison pill' strategy that will incur massive debt but save the company's independence. Board members are divided.",
    "timeLimitSec": 120,
    "options": [
      {
        "label": "A",
        "title": "Execute the poison pill strategy immediately to block ApexCorp.",
        "scores": { "RISK_TOLERANCE": 95, "CRISIS_COMMAND": 85, "STRATEGIC_RESILIENCE": 70, "SYSTEMIC_THINKING": -20 }
      },
      {
        "label": "B",
        "title": "Open back-channel negotiations with ApexCorp to secure favorable buyout terms.",
        "scores": { "ADAPTABILITY": 90, "CONFLICT_RESOLUTION": 80, "STRATEGIC_RESILIENCE": -40, "EMOTIONAL_AGILITY": 70 }
      },
      {
        "label": "C",
        "title": "Call an emergency shareholder meeting to rally support against the takeover.",
        "scores": { "EMOTIONAL_AGILITY": 85, "SYSTEMIC_THINKING": 60, "DECISION_VELOCITY": 50, "CRISIS_COMMAND": 70 }
      },
      {
        "label": "D",
        "title": "Seek an alternative 'white knight' investor to outbid ApexCorp.",
        "scores": { "STRATEGIC_RESILIENCE": 90, "SYSTEMIC_THINKING": 80, "RISK_TOLERANCE": 60, "DECISION_VELOCITY": -30 }
      }
    ]
  },
  {
    "sequenceOrder": 3,
    "narrativeText": "A key supplier in Asia has suddenly gone bankrupt, halting production of your flagship product just 4 weeks before the holiday season. Alternative suppliers demand a 40% premium and require a 2-year contract.",
    "timeLimitSec": 90,
    "options": [
      {
        "label": "A",
        "title": "Sign the 2-year premium contract immediately to save the holiday season.",
        "scores": { "DECISION_VELOCITY": 95, "RISK_TOLERANCE": 85, "STRATEGIC_RESILIENCE": -50, "SYSTEMIC_THINKING": -30 }
      },
      {
        "label": "B",
        "title": "Cancel the holiday product launch and focus on existing inventory.",
        "scores": { "STRATEGIC_RESILIENCE": 80, "ANALYTICAL_PRECISION": 75, "RISK_TOLERANCE": -60, "EMOTIONAL_AGILITY": 60 }
      },
      {
        "label": "C",
        "title": "Attempt to buy out the bankrupt supplier's factory and manage it directly.",
        "scores": { "RISK_TOLERANCE": 100, "CRISIS_COMMAND": 90, "SYSTEMIC_THINKING": 70, "ADAPTABILITY": 40 }
      },
      {
        "label": "D",
        "title": "Redesign the product slightly to use domestically available components.",
        "scores": { "ADAPTABILITY": 95, "SYSTEMIC_THINKING": 85, "DECISION_VELOCITY": -40, "COGNITIVE_LOAD": 70 }
      }
    ]
  },
  {
    "sequenceOrder": 4,
    "narrativeText": "An anonymous whistleblower has leaked documents showing your VP of Sales has been inflating revenue numbers. Firing them will miss Wall Street projections and tank the stock. Keeping them risks federal fraud charges if discovered.",
    "timeLimitSec": 60,
    "options": [
      {
        "label": "A",
        "title": "Fire the VP immediately, restate earnings, and take the stock hit.",
        "scores": { "ETHICS_PRESSURE": 100, "STRATEGIC_RESILIENCE": 90, "RISK_TOLERANCE": 70, "CRISIS_COMMAND": 85 }
      },
      {
        "label": "B",
        "title": "Quietly transition the VP out over 6 months to minimize stock impact.",
        "scores": { "ETHICS_PRESSURE": -60, "SYSTEMIC_THINKING": 75, "CONFLICT_RESOLUTION": 80, "RISK_TOLERANCE": -40 }
      },
      {
        "label": "C",
        "title": "Hire an external auditor to independently verify the claims before acting.",
        "scores": { "ANALYTICAL_PRECISION": 90, "DECISION_VELOCITY": -50, "COGNITIVE_LOAD": 70, "ETHICS_PRESSURE": 60 }
      },
      {
        "label": "D",
        "title": "Confront the VP privately and demand they fix the numbers without public disclosure.",
        "scores": { "ETHICS_PRESSURE": -90, "RISK_TOLERANCE": 85, "CONFLICT_RESOLUTION": -30, "CRISIS_COMMAND": 50 }
      }
    ]
  },
  {
    "sequenceOrder": 5,
    "narrativeText": "Your company is targeted by a sophisticated ransomware attack. Core operations are paralyzed. The hackers demand $5 Million in crypto within 12 hours, or they delete all internal databases permanently.",
    "timeLimitSec": 90,
    "options": [
      {
        "label": "A",
        "title": "Pay the ransom immediately to restore operations and avoid catastrophic data loss.",
        "scores": { "RISK_TOLERANCE": -50, "DECISION_VELOCITY": 85, "ETHICS_PRESSURE": -40, "STRATEGIC_RESILIENCE": -60 }
      },
      {
        "label": "B",
        "title": "Refuse to pay. Shut down all networks and rebuild from 3-day-old offline backups.",
        "scores": { "STRATEGIC_RESILIENCE": 95, "ETHICS_PRESSURE": 80, "SYSTEMIC_THINKING": 85, "RISK_TOLERANCE": 75 }
      },
      {
        "label": "C",
        "title": "Engage cyber-negotiators to stall for time while IT tries to isolate the decryption key.",
        "scores": { "ADAPTABILITY": 90, "COGNITIVE_LOAD": 85, "ANALYTICAL_PRECISION": 80, "DECISION_VELOCITY": -20 }
      },
      {
        "label": "D",
        "title": "Publicly announce the attack and ask industry partners for emergency computing resources.",
        "scores": { "EMOTIONAL_AGILITY": 85, "SYSTEMIC_THINKING": 70, "CRISIS_COMMAND": 60, "CONFLICT_RESOLUTION": 50 }
      }
    ]
  },
  {
    "sequenceOrder": 6,
    "narrativeText": "A viral social media campaign is calling for a boycott of your brand due to an insensitive ad campaign launched by a junior marketing team. The CEO wants to defend the campaign to show 'strength', but store foot traffic is already down 15%.",
    "timeLimitSec": 60,
    "options": [
      {
        "label": "A",
        "title": "Support the CEO publicly, risking further boycott but maintaining internal unity.",
        "scores": { "CONFLICT_RESOLUTION": -40, "STRATEGIC_RESILIENCE": 50, "RISK_TOLERANCE": 80, "ETHICS_PRESSURE": -50 }
      },
      {
        "label": "B",
        "title": "Pull the ad immediately and issue an unconditional apology, defying the CEO.",
        "scores": { "ETHICS_PRESSURE": 85, "CRISIS_COMMAND": 90, "RISK_TOLERANCE": 75, "EMOTIONAL_AGILITY": 70 }
      },
      {
        "label": "C",
        "title": "Suspend the junior marketing team and launch an 'internal review' to stall.",
        "scores": { "DECISION_VELOCITY": -30, "CONFLICT_RESOLUTION": 60, "ADAPTABILITY": 40, "ETHICS_PRESSURE": -20 }
      },
      {
        "label": "D",
        "title": "Pivot the marketing budget entirely to a charity campaign to distract the public.",
        "scores": { "ADAPTABILITY": 95, "SYSTEMIC_THINKING": 80, "EMOTIONAL_AGILITY": 75, "ANALYTICAL_PRECISION": 50 }
      }
    ]
  },
  {
    "sequenceOrder": 7,
    "narrativeText": "A new disruptive technology has just been patented by a startup, rendering your core product obsolete in 2 years. You have the cash to buy them, but the startup's founders notoriously hate your corporate culture.",
    "timeLimitSec": 90,
    "options": [
      {
        "label": "A",
        "title": "Launch a hostile takeover bid to acquire the startup by force.",
        "scores": { "RISK_TOLERANCE": 90, "CRISIS_COMMAND": 85, "CONFLICT_RESOLUTION": -70, "STRATEGIC_RESILIENCE": 60 }
      },
      {
        "label": "B",
        "title": "Double your R&D budget immediately to build a superior competing technology.",
        "scores": { "STRATEGIC_RESILIENCE": 95, "SYSTEMIC_THINKING": 85, "ANALYTICAL_PRECISION": 80, "RISK_TOLERANCE": 70 }
      },
      {
        "label": "C",
        "title": "Approach them humbly, offering them autonomous control of a new independent division.",
        "scores": { "ADAPTABILITY": 90, "CONFLICT_RESOLUTION": 95, "EMOTIONAL_AGILITY": 85, "CRISIS_COMMAND": -20 }
      },
      {
        "label": "D",
        "title": "Begin aggressive lobbying to have their new technology heavily regulated by the government.",
        "scores": { "ETHICS_PRESSURE": -95, "SYSTEMIC_THINKING": 75, "RISK_TOLERANCE": 60, "STRATEGIC_RESILIENCE": 50 }
      }
    ]
  },
  {
    "sequenceOrder": 8,
    "narrativeText": "During a critical merger negotiation, your lead negotiator suffers a mild heart attack. The opposing firm issues a 'take it or leave it' ultimatum expiring in 4 hours, demanding a 15% reduction in valuation.",
    "timeLimitSec": 60,
    "options": [
      {
        "label": "A",
        "title": "Walk away from the merger completely. You won't be bullied under pressure.",
        "scores": { "STRATEGIC_RESILIENCE": 85, "RISK_TOLERANCE": 90, "CRISIS_COMMAND": 80, "EMOTIONAL_AGILITY": 60 }
      },
      {
        "label": "B",
        "title": "Accept the 15% reduction to secure the deal and save the company's long-term plan.",
        "scores": { "DECISION_VELOCITY": 90, "SYSTEMIC_THINKING": 75, "RISK_TOLERANCE": -40, "STRATEGIC_RESILIENCE": -30 }
      },
      {
        "label": "C",
        "title": "Step in personally and counter-offer a 5% reduction, calling their bluff.",
        "scores": { "CRISIS_COMMAND": 95, "ADAPTABILITY": 85, "EMOTIONAL_AGILITY": 90, "RISK_TOLERANCE": 75 }
      },
      {
        "label": "D",
        "title": "Leak the ultimatum to the press to publicly shame the opposing firm into backing down.",
        "scores": { "ETHICS_PRESSURE": -80, "RISK_TOLERANCE": 95, "SYSTEMIC_THINKING": -20, "CONFLICT_RESOLUTION": -60 }
      }
    ]
  },
  {
    "sequenceOrder": 9,
    "narrativeText": "A major hurricane is bearing down on your primary manufacturing hub. Evacuating now means losing $20M in work-in-progress inventory. Waiting 12 hours allows you to save the inventory but risks trapping 500 employees if the storm accelerates.",
    "timeLimitSec": 45,
    "options": [
      {
        "label": "A",
        "title": "Order immediate evacuation. Human life outweighs inventory cost absolutely.",
        "scores": { "ETHICS_PRESSURE": 95, "DECISION_VELOCITY": 90, "CRISIS_COMMAND": 85, "RISK_TOLERANCE": -20 }
      },
      {
        "label": "B",
        "title": "Wait 12 hours to secure the inventory, betting the storm won't accelerate.",
        "scores": { "RISK_TOLERANCE": 100, "ETHICS_PRESSURE": -90, "ANALYTICAL_PRECISION": -50, "SYSTEMIC_THINKING": -40 }
      },
      {
        "label": "C",
        "title": "Offer triple overtime pay for a 'skeleton crew' of volunteers to stay and secure the goods.",
        "scores": { "ADAPTABILITY": 75, "ETHICS_PRESSURE": -40, "CONFLICT_RESOLUTION": 60, "CRISIS_COMMAND": 50 }
      },
      {
        "label": "D",
        "title": "Evacuate non-essential staff immediately, but personally stay behind with senior leaders to secure the facility.",
        "scores": { "CRISIS_COMMAND": 100, "EMOTIONAL_AGILITY": 90, "RISK_TOLERANCE": 85, "STRATEGIC_RESILIENCE": 80 }
      }
    ]
  },
  {
    "sequenceOrder": 10,
    "narrativeText": "You discover a critical flaw in your software product that could theoretically allow hackers to access client bank accounts. No one has exploited it yet. Fixing it requires rewriting the core engine, delaying your IPO by a year.",
    "timeLimitSec": 120,
    "options": [
      {
        "label": "A",
        "title": "Delay the IPO and fix the core engine. Transparency and security are paramount.",
        "scores": { "ETHICS_PRESSURE": 100, "STRATEGIC_RESILIENCE": 95, "SYSTEMIC_THINKING": 85, "RISK_TOLERANCE": 60 }
      },
      {
        "label": "B",
        "title": "Proceed with the IPO, and quietly patch the flaw over the next 6 months without telling clients.",
        "scores": { "ETHICS_PRESSURE": -100, "RISK_TOLERANCE": 95, "DECISION_VELOCITY": 60, "SYSTEMIC_THINKING": -40 }
      },
      {
        "label": "C",
        "title": "Release a 'band-aid' patch immediately that degrades performance but secures the vulnerability, proceeding with the IPO.",
        "scores": { "ADAPTABILITY": 85, "CRISIS_COMMAND": 70, "ANALYTICAL_PRECISION": 60, "ETHICS_PRESSURE": 50 }
      },
      {
        "label": "D",
        "title": "Hire an external red team to test how easily the flaw can actually be exploited before making a decision.",
        "scores": { "ANALYTICAL_PRECISION": 95, "COGNITIVE_LOAD": 80, "DECISION_VELOCITY": -30, "EMOTIONAL_AGILITY": 70 }
      }
    ]
  }
];


export default function ScenariosClient({ packages, scenarios }: { packages: Package[]; scenarios: Scenario[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importPackageId, setImportPackageId] = useState(packages[0]?.id || '');
  const [createPackageId, setCreatePackageId] = useState(packages[0]?.id || '');
  const [createNarrativeText, setCreateNarrativeText] = useState('');
  const [createTimeLimit, setCreateTimeLimit] = useState(90);
  const [createOrder, setCreateOrder] = useState(1);
  const [createOptions, setCreateOptions] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState('');

  const filtered = filter === 'all' ? scenarios : scenarios.filter(s => s.packageId === filter);

  function openEdit(id: string) {
    router.push(`/admin/scenarios/${id}`);
  }

  function downloadSampleJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(SAMPLE_SCENARIOS_JSON, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "sample_scenarios.json");
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImportJson(event.target.result as string);
      }
    };
    reader.readAsText(file);
  }

  function openCreate() {
    setIsCreating(true);
    setCreatePackageId(filter !== 'all' ? filter : packages[0]?.id || '');
    setCreateNarrativeText('');
    setCreateTimeLimit(90);
    setCreateOrder(scenarios.length + 1);
    setCreateOptions(['', '', '', '']);
    setError('');
  }

  async function saveCreate() {
    if (!createPackageId || !createNarrativeText) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: createPackageId,
          narrativeText: createNarrativeText,
          timeLimitSec: createTimeLimit,
          sequenceOrder: createOrder,
          options: createOptions,
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      const newScenario = await res.json();
      
      setIsCreating(false);
      router.refresh();
    } catch {
      setError('Failed to create scenario.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteScenario(id: string) {
    setDeleting(id);
    setError('');
    try {
      const res = await fetch(`/api/admin/scenarios/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setConfirmDelete(null);
      router.refresh();
    } catch {
      setError('Failed to delete scenario.');
    } finally {
      setDeleting(null);
    }
  }

  async function saveImport() {
    if (!importJson) return;
    setSaving(true);
    setError('');
    try {
      const parsed = JSON.parse(importJson);
      
      const payload = {
        packageId: importPackageId,
        isNewPackage: false,
        packageData: {},
        scenarios: parsed.scenarios || parsed, // Handle both root array and { scenarios: [] } formats
      };

      const res = await fetch(`/api/admin/scenarios/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to import');
      }

      setIsImporting(false);
      setImportJson('');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid JSON or Import failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="animate-slide-up">
        {error && <div className="alert-danger mb-4">{error}</div>}

      {/* Filter Bar & Actions */}
      <div className="card-p mb-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Filter & Manage</h2>
              <p className="text-[11px] text-slate-400">Filter by package or perform bulk actions</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={downloadSampleJson}
              className="btn-ghost py-2 px-2.5 sm:px-3 text-xs flex-1 sm:flex-initial justify-center"
            >
              <svg className="h-4 w-4 mr-1.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              JSON
            </button>
            <button
              onClick={() => setIsImporting(true)}
              className="btn-secondary py-2 px-2.5 sm:px-3 text-xs flex-1 sm:flex-initial justify-center"
            >
              <svg className="h-4 w-4 mr-1.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              Import
            </button>
            <button
              onClick={openCreate}
              className="btn-primary py-2 px-3 sm:px-4 text-xs w-full sm:w-auto justify-center"
            >
              <svg className="h-4 w-4 mr-1.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Scenario
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-slate-100"></div>

        <div className="flex items-start md:items-center gap-3 flex-col md:flex-row">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Package Filter:</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`badge text-xs cursor-pointer transition-colors ${filter === 'all' ? 'badge-blue border-blue-400 shadow-sm' : 'badge-slate hover:border-slate-300 hover:bg-slate-50'}`}
            >
              All ({scenarios.length})
            </button>
            {packages.map(p => (
              <button
                key={p.id}
                onClick={() => setFilter(p.id)}
                className={`badge text-xs cursor-pointer transition-colors ${filter === p.id ? 'badge-blue border-blue-400 shadow-sm' : 'badge-slate hover:border-slate-300 hover:bg-slate-50'}`}
              >
                {p.code} ({p.scenarioCount})
                {p.isActive && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block shadow-[0_0_4px_rgba(16,185,129,0.4)]"/>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table & Responsive Cards */}
      <div className="table-wrapper">
        <div className="table-header">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Scenarios</h2>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} shown</p>
          </div>
        </div>

        {/* Desktop Table View (screens >= md) */}
        <div className="hidden md:block w-full">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-slate-50/80">
              <tr>
                <th className="th" style={{ width: '5%' }}>#</th>
                <th className="th" style={{ width: '50%' }}>Narrative Text</th>
                <th className="th text-center" style={{ width: '15%' }}>Package</th>
                <th className="th text-center" style={{ width: '10%' }}>Timer</th>
                <th className="th text-center" style={{ width: '10%' }}>Options</th>
                <th className="th text-center" style={{ width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="td text-center text-slate-400 py-12">No scenarios found.</td>
                </tr>
              )}
              {filtered.map((s, index) => (
                <tr key={s.id} className="tr">
                  <td className="td text-xs font-bold text-slate-400">{index + 1}</td>
                  <td className="td">
                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 max-w-full" title={s.narrativeText}>
                      {s.narrativeText}
                    </p>
                  </td>
                  <td className="td text-center">
                    <span className={`badge text-[10px] inline-block ${s.packageIsActive ? 'badge-green' : 'badge-slate'}`}>
                      {s.packageCode}
                    </span>
                  </td>
                  <td className="td text-xs text-slate-600 text-center">{s.timeLimitSec}s</td>
                  <td className="td text-xs text-slate-600 text-center">{s.optionCount}</td>
                  <td className="td text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openEdit(s.id)}
                        className="btn-ghost text-xs px-2.5 py-1.5 text-blue-600 hover:bg-blue-50"
                        title="Edit"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(s.id)}
                        className="btn-ghost text-xs px-2.5 py-1.5 text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile & Tablet Cards View (screens < md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No scenarios found.
            </div>
          ) : (
            filtered.map((s, index) => (
              <div key={s.id} className="p-4 sm:p-5 bg-white hover:bg-slate-50/50 transition-colors flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700">
                      #{index + 1}
                    </span>
                    <span className={`badge text-[10px] ${s.packageIsActive ? 'badge-green' : 'badge-slate'}`}>
                      {s.packageCode || 'PACKAGE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <polyline points="12 6 12 12 16 14" strokeWidth="2"/>
                      </svg>
                      {s.timeLimitSec}s
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                      {s.optionCount} options
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal bg-slate-50/80 p-3 sm:p-4 rounded-xl border border-slate-100">
                  {s.narrativeText}
                </p>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => openEdit(s.id)}
                    className="btn-secondary text-xs py-2 px-3.5 flex-1 sm:flex-initial justify-center gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50/50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setConfirmDelete(s.id)}
                    className="btn-ghost text-xs py-2 px-3.5 flex-1 sm:flex-initial justify-center gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>



      </div>

      {/* Create Modal */}
      {mounted && isCreating && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-xl animate-fade-in relative z-[101] max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-slate-900">Create New Scenario</h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="form-label">Package</label>
                <select
                  value={createPackageId}
                  onChange={e => setCreatePackageId(e.target.value)}
                  className="form-input"
                >
                  <option value="" disabled>Select a package...</option>
                  {packages.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Narrative Text</label>
                <textarea
                  value={createNarrativeText}
                  onChange={e => setCreateNarrativeText(e.target.value)}
                  className="form-textarea min-h-[120px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Time Limit (sec)</label>
                  <input
                    type="number"
                    value={createTimeLimit}
                    onChange={e => setCreateTimeLimit(Number(e.target.value))}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Sequence Order</label>
                  <input
                    type="number"
                    value={createOrder}
                    onChange={e => setCreateOrder(Number(e.target.value))}
                    className="form-input"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <label className="form-label">Options (A, B, C, D)</label>
                {createOptions.map((opt, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <input
                      type="text"
                      value={opt}
                      placeholder={`Option ${String.fromCharCode(65 + idx)} text...`}
                      onChange={e => {
                        const newOpts = [...createOptions];
                        newOpts[idx] = e.target.value;
                        setCreateOptions(newOpts);
                      }}
                      className="form-input"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
              <button onClick={() => setIsCreating(false)} className="btn-ghost text-sm px-4 py-2 text-slate-600">Cancel</button>
              <button onClick={saveCreate} disabled={saving || !createNarrativeText || !createPackageId} className="btn-primary text-sm px-5 py-2">
                {saving ? 'Saving...' : 'Create Scenario'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirm Modal */}
      {mounted && confirmDelete && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm animate-fade-in p-6 text-center relative z-[101]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 mx-auto mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">Delete Scenario?</h3>
            <p className="text-xs text-slate-500 mb-5">This will permanently delete the scenario, its options, and all associated responses. This cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={() => deleteScenario(confirmDelete)}
                disabled={!!deleting}
                className="btn-danger text-sm disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import Modal */}
      {mounted && isImporting && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl animate-fade-in relative z-[101] max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-slate-900">Import Scenarios (JSON)</h3>
              <button onClick={() => { setIsImporting(false); setImportJson(''); }} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="form-label">Select Package</label>
                <select
                  value={importPackageId}
                  onChange={e => setImportPackageId(e.target.value)}
                  className="form-input text-slate-900"
                >
                  {packages.map(p => (
                    <option key={p.id} value={p.id} className="text-slate-900">{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">JSON Payload</label>
                  <div>
                    <input
                      type="file"
                      accept=".json"
                      id="json-upload"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="json-upload" className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-1.5 transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                      Upload File
                    </label>
                  </div>
                </div>
                <textarea
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                  placeholder="Paste your JSON array of scenarios here..."
                  className="form-textarea min-h-[300px] font-mono text-[11px] text-slate-900"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
              <button onClick={() => { setIsImporting(false); setImportJson(''); }} className="btn-ghost text-sm px-4 py-2 text-slate-600">Cancel</button>
              <button onClick={saveImport} disabled={saving || !importJson} className="btn-primary text-sm px-5 py-2">
                {saving ? 'Importing...' : 'Import Data'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
