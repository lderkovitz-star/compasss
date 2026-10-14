import Link from "next/link";
import StealthEntry from "./StealthEntry";
import { getGlobalSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { resolveBrandName } from "@/lib/constants/brand";
import { Fraunces, IBM_Plex_Mono } from 'next/font/google';

const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', style: ['normal', 'italic'] });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap' });

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** The pack a visitor would run: the practice slot, or the client default. */
async function getHeadlineCounts(): Promise<{
  scenarioCount: number | null;
  dimensionCount: number | null;
}> {
  try {
    const slots = await prisma.platformSettings.findFirst({
      select: { sandboxPackageId: true, defaultClientPackageId: true },
    });
    const packageId = slots?.sandboxPackageId ?? slots?.defaultClientPackageId ?? null;
    if (!packageId) return { scenarioCount: null, dimensionCount: null };

    const scenarios = await prisma.scenario.findMany({
      where: { packageId, deletedAt: null },
      select: { options: { select: { scores: { select: { dimensionId: true } } } } },
    });
    if (scenarios.length === 0) return { scenarioCount: null, dimensionCount: null };

    const dimensions = new Set<string>();
    for (const scenario of scenarios) {
      for (const option of scenario.options) {
        for (const score of option.scores) dimensions.add(score.dimensionId);
      }
    }

    return { scenarioCount: scenarios.length, dimensionCount: dimensions.size };
  } catch {
    // The homepage must render whether or not the database answers.
    return { scenarioCount: null, dimensionCount: null };
  }
}

export default async function Home() {
  const settings = await getGlobalSettings();
  // Both counts used to be written into the page - "11 dimensions", "5+
  // scenarios" - from back when one pack was the only pack. They are whatever
  // the pack a visitor would actually run contains, so they are read from it.
  const { scenarioCount, dimensionCount } = await getHeadlineCounts();
  
  return (
    <div className="min-h-screen bg-[#0B1220] text-[#F3F5FA] selection:bg-[#2E63F6] selection:text-white overflow-x-hidden font-sans">
      {/* FIXED NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B1220]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-[1180px] mx-auto px-3 sm:px-8 py-3 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-[#2E63F6] to-[#1B3FA8] shadow-[0_0_18px_rgba(46,99,246,0.5)] border border-[#5B8CFF]/40 overflow-hidden">
              {settings.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a tenant-supplied URL, not a bundled asset
                <img src={settings.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] sm:text-[15px] font-bold tracking-tight text-white leading-tight truncate">{resolveBrandName(settings.platformName)}</div>
              <div className="text-[8px] sm:text-[10px] text-[#5B6580] tracking-[0.08em] uppercase leading-tight mt-0.5 font-semibold truncate hidden sm:block">Executive Assessment</div>
            </div>
          </Link>
          <div className="flex items-center flex-shrink-0">
            <Link href="/intake" className="bg-[#2E63F6] text-white text-[11px] sm:text-[13.5px] font-semibold px-3 sm:px-[18px] py-1.5 sm:py-2.5 rounded sm:rounded-lg inline-flex items-center whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_rgba(46,99,246,0.4)] hover:bg-[#5B8CFF] hover:-translate-y-[1px] transition-all">
              Begin assessment &rarr;
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-24 sm:pt-32 md:pt-[130px] pb-12 sm:pb-16 md:pb-[88px] border-b border-white/10 overflow-hidden">

        <div className="absolute inset-0 opacity-50" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 0%, transparent 75%)',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 0%, transparent 75%)'
        }}></div>
        
        <div className="relative max-w-[780px] mx-auto px-4 sm:px-8 text-center">

          <h1 className={`text-3xl sm:text-4xl md:text-[58px] leading-[1.12] sm:leading-[1.06] font-semibold tracking-tight text-white ${fraunces.className}`}>
            Decision-making,<br/>measured under <em className="italic text-[#5B8CFF] font-medium">real pressure.</em>
          </h1>
          <p className="mt-4 sm:mt-[26px] max-w-[560px] mx-auto text-sm sm:text-base md:text-[17px] leading-relaxed sm:leading-[1.65] text-[#97A2BE]">
            Scenario-driven crisis simulations, a dimension profile defined by your own scenario pack, and decision telemetry down to the millisecond — read candidates the way a room full of assessors would, minus the room.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8 sm:mt-10">
            <Link href="/intake" className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm sm:text-[14.5px] font-semibold bg-[#2E63F6] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_28px_-12px_rgba(46,99,246,0.55)] hover:bg-[#5B8CFF] transition-colors">
              Start candidate assessment
            </Link>
            <Link href="/practice" className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm sm:text-[14.5px] font-semibold border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-colors">
              Take a practice run
            </Link>
            <Link href="/portal" className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm sm:text-[14.5px] font-semibold text-[#97A2BE] hover:text-white transition-colors">
              Employer sign in
            </Link>
          </div>

          <div className="relative mt-8 sm:mt-12 md:mt-[72px] h-14 sm:h-20 md:h-[92px]">
            {/* A route through three decisions: at each one the path could have
                gone either way, and one way was taken. This replaced a heart-rate
                trace, which outlasted the biometrics it was drawn for. */}
            <svg viewBox="0 0 1000 92" preserveAspectRatio="none" className="w-full h-full block" aria-hidden="true">
              <defs>
                <linearGradient id="decisionPathGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2E63F6" stopOpacity="0"/>
                  <stop offset="15%" stopColor="#2E63F6" stopOpacity="0.6"/>
                  <stop offset="50%" stopColor="#35E0C8"/>
                  <stop offset="85%" stopColor="#2E63F6" stopOpacity="0.6"/>
                  <stop offset="100%" stopColor="#2E63F6" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* The branches not taken. */}
              <g fill="none" stroke="#5B6580" strokeWidth="1.2" strokeOpacity="0.3" strokeDasharray="3 5" strokeLinecap="round">
                <path d="M190,46 L230,64 L270,46"/>
                <path d="M450,46 L490,28 L530,46"/>
                <path d="M710,46 L750,64 L790,46"/>
              </g>
              {/* The route actually taken. */}
              <path
                d="M0,46 L190,46 L230,28 L270,46 L450,46 L490,64 L530,46 L710,46 L750,28 L790,46 L1000,46"
                fill="none"
                stroke="url(#decisionPathGrad)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(53,224,200,0.35))' }}
              />
              {/* The moments of choice. */}
              <g fill="#35E0C8" style={{ filter: 'drop-shadow(0 0 8px rgba(53,224,200,0.55))' }}>
                <circle cx="190" cy="46" r="3"/>
                <circle cx="450" cy="46" r="3"/>
                <circle cx="710" cy="46" r="3"/>
              </g>
            </svg>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 border border-white/10 rounded-[14px] overflow-hidden -mt-2 relative bg-white/[0.015]">
            <div className="p-4 sm:p-[26px_20px] md:border-r border-b md:border-b-0 border-white/10 text-center">
              <div className="text-xl sm:text-[26px] font-semibold tracking-tight text-[#5B8CFF]">{dimensionCount ?? '—'}</div>
              <div className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] tracking-[0.06em] uppercase text-[#5B6580] font-medium">Dimensions measured</div>
            </div>
            <div className="p-4 sm:p-[26px_20px] md:border-r border-b md:border-b-0 border-white/10 text-center">
              <div className="text-xl sm:text-[26px] font-semibold tracking-tight text-[#5B8CFF]">{scenarioCount ?? '—'}</div>
              <div className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] tracking-[0.06em] uppercase text-[#5B6580] font-medium">Crisis scenarios</div>
            </div>
            <div className="p-4 sm:p-[26px_20px] md:border-r border-white/10 text-center">
              <div className="text-xl sm:text-[26px] font-semibold tracking-tight text-[#35E0C8]">ms</div>
              <div className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] tracking-[0.06em] uppercase text-[#5B6580] font-medium">Decision latency</div>
            </div>
            <div className="p-4 sm:p-[26px_20px] text-center">
              <div className="text-xl sm:text-[26px] font-semibold tracking-tight text-[#F5B95C]">100%</div>
              <div className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] tracking-[0.06em] uppercase text-[#5B6580] font-medium">Blind UI enforcement</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: ARCHITECTURE */}
      <section className="py-12 sm:py-16 md:py-[96px] border-b border-white/10">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8">
          <div className="max-w-[620px] mb-8 sm:mb-[56px]">
            <span className="text-[11.5px] font-semibold text-[#5B8CFF] uppercase tracking-[0.1em] mb-2 sm:mb-3.5 block">Architecture</span>
            <h2 className="text-2xl sm:text-[26px] md:text-[34px] leading-[1.18] font-semibold tracking-tight text-white">Four systems, one assessment.</h2>
            <p className="mt-3 sm:mt-4 text-sm sm:text-[15.5px] leading-relaxed sm:leading-[1.7] text-[#97A2BE]">
              Each module runs independently so the platform stays swappable — new scenario packs, new dimensions, new hardware — without touching the core.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-[1px] bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            <div className="bg-[#10192E] p-6 sm:p-9 relative md:row-span-2 flex flex-col justify-between">
              <div>
                <span className={`text-[11px] text-[#5B6580] tracking-[0.08em] mb-3 sm:mb-[22px] block ${plexMono.className}`}>MODULE A</span>
                <div className="text-lg sm:text-[19px] font-semibold text-white tracking-tight">Blind candidate UI</div>
                <div className="mt-2.5 text-xs sm:text-[13.5px] leading-relaxed sm:leading-[1.65] text-[#97A2BE]">
                  The test screen shows scenario text, choices, and a timer — nothing else. No trait meters, no live scores, no stress charts. Scoring happens entirely server-side, invisible until the candidate submits.
                </div>
                <span className="inline-block mt-4 sm:mt-5 text-[10.5px] font-semibold tracking-[0.06em] uppercase px-2.5 py-1.5 rounded-md text-[#F5B95C] bg-[#F5B95C]/10 border border-[#F5B95C]/25">
                  Zero visible scoring
                </span>
              </div>
              <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-end gap-1.5 h-[52px]">
                  <div className="flex-1 bg-gradient-to-b from-[#5B8CFF] to-[#2E63F6] rounded-t-sm opacity-85 h-[40%]"></div>
                  <div className="flex-1 bg-gradient-to-b from-[#5B8CFF] to-[#2E63F6] rounded-t-sm opacity-15 h-[60%]"></div>
                  <div className="flex-1 bg-gradient-to-b from-[#5B8CFF] to-[#2E63F6] rounded-t-sm opacity-15 h-[80%]"></div>
                  <div className="flex-1 bg-gradient-to-b from-[#5B8CFF] to-[#2E63F6] rounded-t-sm opacity-15 h-[50%]"></div>
                  <div className="flex-1 bg-gradient-to-b from-[#5B8CFF] to-[#2E63F6] rounded-t-sm opacity-15 h-[100%]"></div>
                  <div className="flex-1 bg-gradient-to-b from-[#5B8CFF] to-[#2E63F6] rounded-t-sm opacity-15 h-[30%]"></div>
                </div>
              </div>
            </div>

            <div className="bg-[#10192E] p-6 sm:p-9 relative border-t md:border-t-0 border-white/10">
              <span className={`text-[11px] text-[#5B6580] tracking-[0.08em] mb-3 sm:mb-[22px] block ${plexMono.className}`}>MODULE B</span>
              <div className="text-lg sm:text-[19px] font-semibold text-white tracking-tight">Dynamic scenario engine</div>
              <div className="mt-2.5 text-xs sm:text-[13.5px] leading-relaxed sm:leading-[1.65] text-[#97A2BE]">
                Every scenario, choice, and scoring weight loads from the database. Swap &quot;wilderness expedition&quot; for &quot;corporate crisis&quot; from the admin panel — no redeploy.
              </div>
              <span className="inline-block mt-4 sm:mt-5 text-[10.5px] font-semibold tracking-[0.06em] uppercase px-2.5 py-1.5 rounded-md text-[#5B8CFF] bg-[#5B8CFF]/10 border border-[#5B8CFF]/25">
                No hardcoding
              </span>
            </div>

            <div className="bg-[#10192E] p-6 sm:p-9 relative border-t border-white/10">
              <span className={`text-[11px] text-[#5B6580] tracking-[0.08em] mb-3 sm:mb-[22px] block ${plexMono.className}`}>MODULE D</span>
              <div className="text-lg sm:text-[19px] font-semibold text-white tracking-tight">Decision telemetry</div>
              <div className="mt-2.5 text-xs sm:text-[13.5px] leading-relaxed sm:leading-[1.65] text-[#97A2BE]">
                How long each call took, which options were revisited, and where the candidate hesitated — recorded per decision and carried into the executive report.
              </div>
              <span className="inline-block mt-4 sm:mt-5 text-[10.5px] font-semibold tracking-[0.06em] uppercase px-2.5 py-1.5 rounded-md text-[#35E0C8] bg-[#35E0C8]/10 border border-[#35E0C8]/25">
                Per-decision timing
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: FLOW */}
      <section className="py-12 sm:py-16 md:py-[96px] border-b border-white/10">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8">
          <div className="max-w-[620px] mb-8 sm:mb-[56px]">
            <span className="text-[11.5px] font-semibold text-[#5B8CFF] uppercase tracking-[0.1em] mb-2 sm:mb-3.5 block">Flow</span>
            <h2 className="text-2xl sm:text-[26px] md:text-[34px] leading-[1.18] font-semibold tracking-tight text-white">From intake to executive report.</h2>
          </div>
          
          <div className="flex flex-col md:flex-row items-stretch">
            <div className="flex-1 p-5 sm:p-7 relative border border-white/10 md:border-l md:border-r-0 md:rounded-l-xl rounded-t-xl md:rounded-tr-none">
              <span className={`text-[11px] text-[#35E0C8] mb-2 sm:mb-3.5 block ${plexMono.className}`}>01</span>
              <div className="text-sm sm:text-[14.5px] font-semibold text-white">Intake</div>
              <div className="mt-1.5 sm:mt-2 text-xs sm:text-[12.5px] leading-[1.6] text-[#5B6580]">Candidate profile, target role, resume — stored, not parsed.</div>
              <div className="absolute left-1/2 -bottom-3 md:left-auto md:-right-3 md:top-1/2 -translate-x-1/2 md:translate-x-0 md:-translate-y-1/2 w-[22px] h-[22px] rounded-full bg-[#0B1220] border border-white/15 flex items-center justify-center z-10 rotate-90 md:rotate-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#5B6580" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
            </div>
            
            <div className="flex-1 p-5 sm:p-7 relative border-x border-b md:border-b-y md:border-l md:border-r-0 border-white/10">
              <span className={`text-[11px] text-[#35E0C8] mb-2 sm:mb-3.5 block ${plexMono.className}`}>02</span>
              <div className="text-sm sm:text-[14.5px] font-semibold text-white">Assessment</div>
              <div className="mt-1.5 sm:mt-2 text-xs sm:text-[12.5px] leading-[1.6] text-[#5B6580]">Timed scenarios, one-way navigation, silent telemetry.</div>
              <div className="absolute left-1/2 -bottom-3 md:left-auto md:-right-3 md:top-1/2 -translate-x-1/2 md:translate-x-0 md:-translate-y-1/2 w-[22px] h-[22px] rounded-full bg-[#0B1220] border border-white/15 flex items-center justify-center z-10 rotate-90 md:rotate-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#5B6580" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
            </div>
            
            <div className="flex-1 p-5 sm:p-7 relative border-x border-b md:border-b-y md:border-l md:border-r-0 border-white/10">
              <span className={`text-[11px] text-[#35E0C8] mb-2 sm:mb-3.5 block ${plexMono.className}`}>03</span>
              <div className="text-sm sm:text-[14.5px] font-semibold text-white">Scoring</div>
              <div className="mt-1.5 sm:mt-2 text-xs sm:text-[12.5px] leading-[1.6] text-[#5B6580]">11 dimensions weighted server-side against responses.</div>
              <div className="absolute left-1/2 -bottom-3 md:left-auto md:-right-3 md:top-1/2 -translate-x-1/2 md:translate-x-0 md:-translate-y-1/2 w-[22px] h-[22px] rounded-full bg-[#0B1220] border border-white/15 flex items-center justify-center z-10 rotate-90 md:rotate-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#5B6580" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
            </div>
            
            <div className="flex-1 p-5 sm:p-7 relative border-x border-b md:border-b-y md:border-l border-white/10 rounded-b-xl md:rounded-bl-none md:rounded-r-xl">
              <span className={`text-[11px] text-[#35E0C8] mb-2 sm:mb-3.5 block ${plexMono.className}`}>04</span>
              <div className="text-sm sm:text-[14.5px] font-semibold text-white">Report</div>
              <div className="mt-1.5 sm:mt-2 text-xs sm:text-[12.5px] leading-[1.6] text-[#5B6580]">Radar breakdown, stress timeline, exportable PDF.</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 md:py-[100px] text-center px-4 sm:px-8">
        <h2 className="text-2xl sm:text-[28px] md:text-[38px] font-semibold tracking-tight text-white max-w-[600px] mx-auto leading-[1.15]">Ready to see how a candidate performs under pressure?</h2>
        <p className="mt-3 sm:mt-4 text-[#97A2BE] text-sm sm:text-[15px]">Set up takes minutes. The report writes itself.</p>
        <div className="flex flex-wrap items-center justify-center gap-3.5 mt-6 sm:mt-9">
          <Link href="/intake" className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm sm:text-[14.5px] font-semibold bg-[#2E63F6] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_28px_-12px_rgba(46,99,246,0.55)] hover:bg-[#5B8CFF] transition-colors">
            Start candidate assessment
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-6 sm:py-7">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs sm:text-[12.5px] text-[#5B6580] text-center sm:text-left">
          <StealthEntry label={`© 2026 ${resolveBrandName(settings.platformName)}`} />
          <span className={plexMono.className}>v2.0 — executive platform</span>
        </div>
      </footer>
    </div>
  );
}

