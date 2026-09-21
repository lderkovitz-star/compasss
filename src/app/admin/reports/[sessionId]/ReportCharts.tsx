'use client';

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';

interface DimensionScore { name: string; code: string; category: string; score: number; percentile: number; }
interface BPMPoint { t: number; bpm: number; time: string; }

interface Props {
  dimensionScores: DimensionScore[];
  biometricData: BPMPoint[];
}

function getColor(score: number) {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
      <p className="font-bold text-slate-900 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function ReportCharts({ dimensionScores, biometricData }: Props) {
  const radarData = dimensionScores.map(d => ({
    dimension: d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name,
    score: d.score,
  }));

  const avgBpm = biometricData.length
    ? Math.round(biometricData.reduce((a, b) => a + b.bpm, 0) / biometricData.length)
    : 72;

  return (
    <div className="space-y-5">
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Radar */}
        <div className="card-p">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Psychological Radar</h3>
          <p className="text-xs text-slate-400 mb-4">11-dimension cognitive profile</p>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="dimension" tick={{ fill: '#64748B', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 9 }} />
              <Radar name="Score" dataKey="score" stroke="#2563EB" fill="#2563EB" fillOpacity={0.15} strokeWidth={2} />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Horizontal Bar */}
        <div className="card-p">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Dimension Breakdown</h3>
          <p className="text-xs text-slate-400 mb-4">Score per dimension (0–100)</p>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[280px]">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dimensionScores} layout="vertical" barSize={10} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#475569', fontSize: 8 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]}>
                    {dimensionScores.map((d, i) => (
                      <Cell key={i} fill={getColor(d.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>

      {/* Biometric Timeline */}
      {biometricData.length > 0 && (
        <div className="card-p">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Biometric Stress Timeline</h3>
              <p className="text-xs text-slate-400 mt-0.5">Heart rate correlated to assessment decision points</p>
            </div>
            <div className="flex gap-5 text-center">
              <div>
                <p className="text-lg font-black text-emerald-600">{avgBpm}</p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Avg BPM</p>
              </div>
              <div>
                <p className="text-lg font-black text-amber-600">{Math.max(...biometricData.map(b => b.bpm))}</p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Peak BPM</p>
              </div>
              <div>
                <p className="text-lg font-black text-red-600">
                  {biometricData.filter(b => b.bpm > avgBpm + 20).length}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Stress Spikes</p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={biometricData}>
              <defs>
                <linearGradient id="bpmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="time" tick={{ fill: '#94A3B8', fontSize: 9 }} />
              <YAxis domain={[50, 140]} tick={{ fill: '#94A3B8', fontSize: 9 }} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={avgBpm} stroke="#CBD5E1" strokeDasharray="4 4" />
              <ReferenceLine y={avgBpm + 20} stroke="#FCA5A5" strokeDasharray="4 4"
                label={{ value: 'Stress', fill: '#EF4444', fontSize: 9, position: 'right' }} />
              <Area type="monotone" dataKey="bpm" name="BPM" stroke="#3B82F6" strokeWidth={2}
                fill="url(#bpmGrad)"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const spike = payload.bpm > avgBpm + 20;
                  return (
                    <circle key={`dot-${cx}`} cx={cx} cy={cy} r={spike ? 5 : 2.5}
                      fill={spike ? '#EF4444' : '#3B82F6'}
                      stroke={spike ? '#FCA5A5' : '#93C5FD'} strokeWidth={1} />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-400 mt-2">● Red dots = stress spikes (&gt;{avgBpm + 20} BPM) correlated with decision pressure.</p>
        </div>
      )}
    </div>
  );
}
