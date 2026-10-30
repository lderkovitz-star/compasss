'use client';

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface DimensionScore { name: string; code: string; category: string; score: number; percentile: number; }

interface Props {
  dimensionScores: DimensionScore[];
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

export default function ReportCharts({ dimensionScores }: Props) {
  const radarData = dimensionScores.map(d => ({
    dimension: d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name,
    score: d.score,
  }));

  return (
    <div className="space-y-5">
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Radar */}
        <div className="card-p">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Psychological Radar</h3>
          <p className="text-xs text-slate-400 mb-4">
            {dimensionScores.length}-dimension cognitive profile
          </p>
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

    </div>
  );
}
