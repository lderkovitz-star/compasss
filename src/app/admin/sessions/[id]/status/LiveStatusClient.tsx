"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, Activity } from "lucide-react";

interface StatusData {
  status: string;
  currentScenarioIdx: number;
  startedAt: string;
  completedAt: string | null;
  lastActivityAt?: string;
  completedResponsesCount?: number;
}

interface ScenarioMeta {
  id: string;
  narrativeText: string;
  sequenceOrder: number;
  timeLimitSec: number;
}

export default function LiveStatusClient({
  sessionId,
  initialData,
  scenarios,
  totalScenarios
}: {
  sessionId: string;
  initialData: StatusData;
  scenarios: ScenarioMeta[];
  totalScenarios: number;
}) {
  const [data, setData] = useState<StatusData>(initialData);
  const [elapsedTime, setElapsedTime] = useState<string>("00:00");
  const [isPolling, setIsPolling] = useState(data.status === "IN_PROGRESS");

  // Format elapsed time function
  const formatElapsed = (start: Date, end: Date = new Date()) => {
    const diff = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    const m = Math.floor(diff / 60).toString().padStart(2, "0");
    const s = (diff % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Poll for updates every 5 seconds if IN_PROGRESS
  useEffect(() => {
    if (!isPolling) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/admin/sessions/${sessionId}/status`);
        if (res.ok) {
          const newData = await res.json();
          setData(newData);
          if (newData.status !== "IN_PROGRESS") {
            setIsPolling(false);
          }
        }
      } catch (err) {
        console.error("Failed to poll session status", err);
      }
    };

    const intervalId = setInterval(fetchStatus, 5000);
    return () => clearInterval(intervalId);
  }, [sessionId, isPolling]);

  // Real-time elapsed time ticker
  useEffect(() => {
    if (data.status === "PENDING") {
      setElapsedTime("Not started");
      return;
    }
    
    if (data.status === "COMPLETED" && data.completedAt) {
      setElapsedTime(formatElapsed(new Date(data.startedAt), new Date(data.completedAt)));
      return;
    }

    // For IN_PROGRESS, tick every second
    const tick = () => {
      setElapsedTime(formatElapsed(new Date(data.startedAt)));
    };
    
    tick(); // initial call
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [data.startedAt, data.completedAt, data.status]);

  const progressPercentage = totalScenarios > 0 
    ? Math.min(100, Math.round((data.currentScenarioIdx / totalScenarios) * 100)) 
    : 0;

  // Determine current active scenario
  const currentScenario = scenarios[data.currentScenarioIdx] || null;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Activity className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Overall Progress</h3>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-end justify-between mb-2">
              <span className="text-3xl font-black text-slate-900">{progressPercentage}%</span>
              <span className="text-sm font-medium text-slate-500 mb-1">
                {data.currentScenarioIdx} of {totalScenarios} Scenarios
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-in-out" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Clock className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Time Elapsed</h3>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-3xl font-black text-slate-900 font-mono">{elapsedTime}</span>
            {data.lastActivityAt && data.status === "IN_PROGRESS" && (
              <span className="text-xs text-slate-500 mt-1">
                Last activity: {new Date(data.lastActivityAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Responses Logged</h3>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-3xl font-black text-slate-900">
              {data.completedResponsesCount ?? data.currentScenarioIdx}
            </span>
            <span className="text-xs text-slate-500 mt-1">Saved successfully to DB</span>
          </div>
        </div>
      </div>

      {/* Current Scenario Focus */}
      <div className="bg-slate-900 rounded-xl p-6 shadow-md text-white">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
          Current Focus {data.status === 'COMPLETED' ? '(Final)' : ''}
        </h3>
        
        {data.status === 'COMPLETED' ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
            <p className="text-lg font-medium text-slate-200">Assessment completely finished!</p>
          </div>
        ) : currentScenario ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                Scenario {currentScenario.sequenceOrder}
              </span>
              <span className="text-xs text-slate-400">
                Expected Time: {currentScenario.timeLimitSec}s
              </span>
            </div>
            <p className="text-lg font-medium leading-relaxed mt-4">
              {currentScenario.narrativeText}
            </p>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">Waiting for candidate to begin...</div>
        )}
      </div>
    </div>
  );
}
