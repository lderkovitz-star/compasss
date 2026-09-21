import Link from 'next/link';

interface Props {
  searchParams: { session?: string };
}

export default function AssessmentCompletePage({ searchParams }: Props) {
  const sessionId = searchParams.session || '';

  return (
    <div className="min-h-screen bg-[#0B1220] text-[#F3F5FA] selection:bg-[#2E63F6] selection:text-white flex flex-col relative overflow-x-hidden font-sans">

      {/* Background gradient blobs & grid */}
      <div className="fixed inset-0 pointer-events-none opacity-30 z-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 0%, transparent 80%)',
        maskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 0%, transparent 80%)'
      }}></div>

      {/* FIXED TOP HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0B1220]/95 backdrop-blur-xl px-3 sm:px-6 py-3 shadow-2xl">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-2 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-[#2E63F6] to-[#1B3FA8] shadow-[0_0_18px_rgba(46,99,246,0.5)] border border-[#5B8CFF]/40">
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[13px] sm:text-[15px] font-bold tracking-tight text-white leading-tight truncate">CognitiveEdge</div>
              <div className="text-[8px] sm:text-[10px] text-[#5B6580] tracking-[0.08em] uppercase leading-tight mt-0.5 font-semibold truncate hidden sm:block">Assessment Protocol</div>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Completed
            </div>
            <Link 
              href="/" 
              className="text-[#97A2BE] text-[11px] sm:text-[13px] font-medium px-2.5 sm:px-3.5 py-1.5 rounded-md sm:rounded-lg hover:text-white hover:bg-white/5 border border-white/10 transition-all flex items-center gap-1 sm:gap-1.5 flex-shrink-0 shadow-sm whitespace-nowrap"
            >
              <svg className="h-3 sm:h-3.5 w-3 sm:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              <span className="hidden sm:inline">Return to Portal</span>
              <span className="sm:hidden">Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pt-24 sm:pt-28 pb-12">

        <div className="w-full max-w-lg">

          {/* Success Animation */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative mb-7">
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 scale-150 blur-xl animate-pulse" />
              {/* Middle ring */}
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 scale-125" />
              {/* Icon circle */}
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-2xl shadow-emerald-500/40">
                <svg className="h-12 w-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold uppercase tracking-widest mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Assessment Submitted
              </div>
              <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
                Assessment Complete
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                Your responses have been securely recorded and are being processed. Your evaluating organization will receive a comprehensive executive report.
              </p>
            </div>
          </div>

          {/* Info Cards */}
          <div className="space-y-3 mb-8">
            {[
              {
                icon: (
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                ),
                color: 'text-blue-400',
                bg: 'bg-blue-500/10 border-blue-500/20',
                iconBg: 'bg-blue-500/15',
                title: 'Executive Report Generated',
                desc: 'An 11-dimension psychological profile has been created for your evaluator.',
              },
              {
                icon: (
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                ),
                color: 'text-violet-400',
                bg: 'bg-violet-500/10 border-violet-500/20',
                iconBg: 'bg-violet-500/15',
                title: 'Responses Secured',
                desc: 'Your assessment data is encrypted and only accessible to authorized administrators.',
              },
              {
                icon: (
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                ),
                color: 'text-slate-400',
                bg: 'bg-white/5 border-white/8',
                iconBg: 'bg-white/8',
                title: 'Scores Are Private',
                desc: 'Individual dimension scores are not shared with candidates. Results go directly to your evaluating organization.',
              },
            ].map((item, i) => (
              <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border backdrop-blur-sm ${item.bg}`}>
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${item.iconBg} ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{item.title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Session Reference */}
          {sessionId && (
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
                <span className="text-[10px] text-slate-500 font-medium">Session ID:</span>
                <span className="text-[10px] text-slate-400 font-mono">{sessionId.slice(0, 16)}…</span>
              </div>
            </div>
          )}

          {/* CTA Button */}
          <Link 
            href="/" 
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold transition-all duration-200 hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98]"
          >
            Return to Portal
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8"/>
            </svg>
          </Link>

          <p className="text-center text-[11px] text-slate-600 mt-5">
            You may safely close this window. Your data has been saved.
          </p>
        </div>
      </main>
    </div>
  );
}
