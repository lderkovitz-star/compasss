'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface DecisionEvent {
  optionId: string;
  event: 'hover' | 'click' | 'revisit';
  timestampMs: number;
}

interface Scenario {
  id: string;
  sequenceOrder: number;
  narrativeText: string;
  timeLimitSec: number;
  totalScenarios: number;
  backdropImageUrl?: string | null;
  options: { id: string; optionCode: string; optionText: string }[];
}

export default function AssessmentPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const { sessionId } = params;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Backdrop cross-fade state
  const [activeBackdrop, setActiveBackdrop] = useState<string | null>(null);
  const [nextBackdrop, setNextBackdrop] = useState<string | null>(null);
  const [backdropFading, setBackdropFading] = useState(false);
  const currentBackdropRef = useRef<string | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const decisionPathRef = useRef<DecisionEvent[]>([]);
  const visitedOptionsRef = useRef<Set<string>>(new Set());

  const loadScenario = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    setError('');
    decisionPathRef.current = [];
    visitedOptionsRef.current = new Set();

    try {
      const res = await fetch(`/api/assessment/${sessionId}`);
      const data = await res.json();
      if (data.redirect) { router.push(data.redirect); return; }
      if (!res.ok) throw new Error(data.error || 'Failed to load scenario');

      setScenario(data);

      // Cross-fade backdrop: only trigger if the image actually changes
      const newUrl = data.backdropImageUrl ?? null;
      if (newUrl !== currentBackdropRef.current) {
        setNextBackdrop(newUrl);
        setBackdropFading(true);
        // Delay to allow CSS transition to finish fading out active layer
        setTimeout(() => {
          setActiveBackdrop(newUrl);
          currentBackdropRef.current = newUrl;
          setNextBackdrop(null);
          setBackdropFading(false);
        }, 500); // Matches the 500ms transition duration in CSS
      }

      // Timer Protection: Use localStorage to prevent timer resets on refresh
      const storageKey = `timer_start_${sessionId}_${data.id}`;
      const storedStart = localStorage.getItem(storageKey);
      const now = Date.now();

      let startTime = storedStart ? parseInt(storedStart, 10) : now;
      if (!storedStart) {
        localStorage.setItem(storageKey, startTime.toString());
      }

      const elapsedSec = Math.floor((now - startTime) / 1000);
      const remainingSec = Math.max(0, data.timeLimitSec - elapsedSec);

      setTimeLeft(remainingSec);
      startTimeRef.current = startTime;

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading scenario');
    } finally {
      setLoading(false);
    }
  }, [sessionId, router]);

  useEffect(() => { loadScenario(); }, [loadScenario]);

  // Track hover events for decision path telemetry
  const handleOptionHover = useCallback((optionId: string) => {
    const elapsed = Date.now() - startTimeRef.current;
    decisionPathRef.current.push({
      optionId,
      event: 'hover',
      timestampMs: elapsed,
    });
  }, []);

  // Track option selection & revisits
  const handleOptionSelect = useCallback((optionId: string) => {
    const elapsed = Date.now() - startTimeRef.current;
    const isRevisit = visitedOptionsRef.current.has(optionId) && selected !== optionId;
    visitedOptionsRef.current.add(optionId);

    decisionPathRef.current.push({
      optionId,
      event: isRevisit ? 'revisit' : 'click',
      timestampMs: elapsed,
    });

    setSelected(optionId);
  }, [selected]);

  const handleSubmit = useCallback(async (optionId: string) => {
    if (submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const timeSpentMs = Date.now() - startTimeRef.current;

    try {
      const res = await fetch(`/api/assessment/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId,
          timeSpentMs,
          decisionPath: decisionPathRef.current,
        }),
      });
      const data = await res.json();
      if (data.completed) {
        router.push(`/assessment/complete?session=${sessionId}`);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      await loadScenario();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error submitting response');
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, router, submitting, loadScenario]);

  // Timer
  useEffect(() => {
    if (!scenario || timeLeft <= 0 || submitting) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [scenario, timeLeft, submitting]);

  const answeredCount = scenario ? scenario.sequenceOrder - 1 : 0;
  const totalCount = scenario ? scenario.totalScenarios : 0;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#0B1220] text-[#F3F5FA] selection:bg-[#2E63F6] selection:text-white overflow-x-hidden font-sans relative flex flex-col">
      {/* ── BACKDROP LAYER: Dual cross-fade for smooth scenario transitions ── */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
        {/* Layer 1: Active (currently visible) backdrop */}
        <div
          className="absolute inset-0 transition-opacity ease-in-out"
          style={{
            transitionDuration: '500ms',
            opacity: backdropFading ? 0 : 1,
          }}
        >
          {activeBackdrop ? (
            <>
              {/* Fully responsive: cover on all screen sizes */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${activeBackdrop})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
              {/* Dark overlay — keeps text readable on any image color */}
              <div className="absolute inset-0 bg-[#0B1220]/80" />
              {/* Subtle vignette for premium depth */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse at center, transparent 40%, rgba(11,18,32,0.7) 100%)'
                }}
              />
            </>
          ) : (
            /* Default platform grid — shows when no backdrop set */
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(46,99,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(46,99,246,0.08) 1px, transparent 1px)',
                backgroundSize: '72px 72px',
                WebkitMaskImage: 'radial-gradient(ellipse 120% 80% at 50% 0%, black 0%, transparent 90%)',
                maskImage: 'radial-gradient(ellipse 120% 80% at 50% 0%, black 0%, transparent 90%)',
              }}
            />
          )}
        </div>

        {/* Layer 2: Next backdrop — preloads and fades in while Layer 1 fades out */}
        {nextBackdrop && (
          <div
            className="absolute inset-0 transition-opacity ease-in-out"
            style={{
              transitionDuration: '500ms',
              opacity: backdropFading ? 1 : 0,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${nextBackdrop})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat',
              }}
            />
            <div className="absolute inset-0 bg-[#0B1220]/80" />
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(11,18,32,0.7) 100%)'
              }}
            />
          </div>
        )}
      </div>

      {/* HEADER HUD */}
      {scenario && !error && (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0B1220]/90 backdrop-blur-xl px-3 sm:px-6 py-2.5 sm:py-3 shadow-2xl transition-opacity duration-500">
          <div className="mx-auto max-w-4xl flex items-center justify-between gap-2 sm:gap-6">
            {/* Left: Simulation Scenario Progress */}
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-[#2E63F6] to-[#1B3FA8] shadow-[0_0_15px_rgba(46,99,246,0.4)] border border-[#5B8CFF]/40">
                <span className="text-[11px] sm:text-[13px] font-bold text-white tracking-tight">{scenario.sequenceOrder}</span>
              </div>
              <div className="flex-1 max-w-[220px] sm:max-w-sm min-w-0">
                <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1">
                  <span className="text-[11px] sm:text-[13px] font-semibold text-white tracking-tight truncate">
                    Scenario Phase {scenario.sequenceOrder} of {scenario.totalScenarios}
                  </span>
                  <span className="text-[9px] sm:text-[11px] font-medium text-[#35E0C8] flex-shrink-0">
                    {progressPct}%
                  </span>
                </div>
                <div className="h-1.5 sm:h-2 rounded-full bg-[#10192E] overflow-hidden border border-white/10 relative">
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r from-[#2E63F6] via-[#3B82F6] to-[#35E0C8] transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Time Indicator */}
            <div className="flex items-center gap-2 flex-shrink-0 rounded-lg px-3 py-1.5 bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#35E0C8] animate-pulse" />
              <span className="text-xs font-mono font-bold text-slate-200">{formattedTime}</span>
            </div>
          </div>
        </header>
      )}

      {/* DYNAMIC MAIN CONTENT AREA */}
      {error ? (
        <main className="flex-1 flex items-center justify-center px-6 relative z-10 transition-opacity duration-500">
          <div className="max-w-sm w-full text-center bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md">
            <div className="h-14 w-14 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-5">
              <svg className="h-6 w-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h2 className="text-[16px] font-semibold text-white mb-2">Notice</h2>
            <p className="text-[13px] text-[#97A2BE] mb-6 leading-relaxed">{error}</p>
            <button onClick={loadScenario} className="w-full btn-accent text-[13.5px] px-6 py-3 rounded-xl bg-[#2E63F6] hover:bg-[#5B8CFF] text-white font-semibold transition-all shadow-md">
              Reload Scenario
            </button>
          </div>
        </main>
      ) : loading ? (
        <main className="flex-1 flex items-center justify-center relative z-10 transition-opacity duration-500">
          <div className="text-center bg-black/20 px-8 py-6 rounded-2xl backdrop-blur-sm">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <svg className="animate-spin w-full h-full text-[#2E63F6]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
            </div>
            <p className="text-[12px] text-[#5B6580] uppercase tracking-widest font-medium">Loading Simulation Scenario…</p>
          </div>
        </main>
      ) : scenario ? (
        <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 pt-24 sm:pt-28 pb-10 sm:pb-14 flex flex-col gap-5 sm:gap-8 relative z-10 animate-in fade-in duration-500">
          {/* Scenario Narrative Text Panel */}
          <div className="bg-[#10192E]/85 border border-white/10 rounded-2xl p-5 sm:p-8 backdrop-blur-md shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#2E63F6] to-transparent opacity-50"></div>
            <div className="flex items-center gap-3 mb-3.5 sm:mb-5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2E63F6]/20 border border-[#2E63F6]/30 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#5B8CFF]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5B8CFF] animate-pulse"></span>
                Operational Briefing
              </span>
            </div>
            <p className="text-sm sm:text-base md:text-[18px] font-medium text-white leading-relaxed sm:leading-[1.7] whitespace-pre-line">
              {scenario.narrativeText}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3 mb-2 px-1">
              <div className="h-[1px] flex-1 bg-white/10"></div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-[#5B6580]">Select Course of Action</p>
              <div className="h-[1px] flex-1 bg-white/10"></div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {scenario.options.map((option) => (
                <button
                  key={option.id}
                  id={`option-${option.optionCode}`}
                  type="button"
                  onMouseEnter={() => handleOptionHover(option.id)}
                  onClick={() => handleOptionSelect(option.id)}
                  disabled={submitting}
                  className={`w-full text-left bg-white/5 border border-white/10 rounded-xl p-3.5 sm:p-5 transition-all duration-200 group ${
                    selected === option.id
                      ? 'border-[#35E0C8] bg-[#35E0C8]/10 shadow-[inset_0_0_20px_rgba(53,224,200,0.05),0_0_15px_rgba(53,224,200,0.15)]'
                      : 'hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`flex h-7 w-7 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs sm:text-[13px] font-bold border transition-colors ${
                      selected === option.id
                        ? 'bg-[#35E0C8] text-[#0B1220] border-[#35E0C8]'
                        : 'bg-[#10192E] text-[#97A2BE] border-white/10 group-hover:bg-white/10 group-hover:text-white'
                    }`}>
                      {option.optionCode}
                    </div>
                    <p className={`text-xs sm:text-[14.5px] leading-relaxed pt-0.5 sm:pt-1.5 transition-colors ${
                      selected === option.id ? 'text-white font-medium' : 'text-[#97A2BE] group-hover:text-white'
                    }`}>
                      {option.optionText}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 sm:pt-6 border-t border-white/10 mt-2 gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${selected ? 'bg-[#35E0C8] shadow-[0_0_8px_#35E0C8]' : 'bg-[#5B6580]'}`}></div>
              <p className="text-xs sm:text-[12.5px] text-[#97A2BE] font-medium tracking-wide">
                {selected ? 'Course of action chosen. Ready to confirm.' : 'Select a course of action to proceed.'}
              </p>
            </div>
            <button
              id="submit-answer"
              onClick={() => selected && handleSubmit(selected)}
              disabled={!selected || submitting}
              className={`flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl text-xs sm:text-[14px] font-semibold transition-all duration-200 active:scale-[0.98] w-full sm:w-auto ${
                !selected || submitting
                  ? 'bg-white/5 text-[#5B6580] border border-white/5 cursor-not-allowed'
                  : 'bg-[#2E63F6] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_20px_-10px_rgba(46,99,246,0.6)] hover:bg-[#5B8CFF] hover:-translate-y-[1px]'
              }`}
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Processing…
                </>
              ) : (
                <>
                  Confirm Decision
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 9l3 3m0 0l-3 3m3-3H8"/>
                  </svg>
                </>
              )}
            </button>
          </div>
        </main>
      ) : null}

      {/* FOOTER */}
      {scenario && !error && (
        <footer className="border-t border-white/10 bg-[#0B1220]/90 backdrop-blur-md px-4 sm:px-6 py-2.5 sm:py-3 relative z-20 mt-auto transition-opacity duration-500">
          <div className="mx-auto max-w-4xl flex items-center justify-between">
            <div className="flex items-center gap-3 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] font-medium text-[#5B6580]">
              <span>Session Ref: {sessionId.slice(-8)}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-white/5 border border-white/5 rounded px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-[#35E0C8]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#35E0C8] animate-pulse" />
              Active Session
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
