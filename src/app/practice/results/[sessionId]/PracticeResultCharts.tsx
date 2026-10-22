'use client';

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

type Dimension = { name: string; score: number; scenariosScored: number };

/**
 * The radar a practice run produces, shown to the person who ran it.
 *
 * Dimensions drawn from one or two scenarios are plotted but marked, because
 * a point sitting at 100 off a single choice reads as a strength and is not
 * one.
 */
export default function PracticeResultCharts({ dimensions }: { dimensions: Dimension[] }) {
  if (dimensions.length < 3) return null;

  const data = dimensions.map((d) => ({
    axis: d.name.length > 16 ? `${d.name.slice(0, 15)}…` : d.name,
    score: Math.round(d.score),
    thin: d.scenariosScored < 3,
  }));

  const thinCount = data.filter((d) => d.thin).length;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="font-semibold text-white">Decision profile</h2>
      <p className="text-xs text-[#97A2BE] mt-0.5">
        {dimensions.length} dimensions, scored against what this run could actually measure.
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(255,255,255,0.12)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: '#97A2BE', fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#5B6580', fontSize: 9 }} />
          <Radar
            name="You"
            dataKey="score"
            stroke="#35E0C8"
            fill="#35E0C8"
            fillOpacity={0.22}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              background: '#10192E',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: '#F3F5FA',
              fontSize: 12,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
      {thinCount > 0 && (
        <p className="text-xs text-[#5B6580]">
          {thinCount} of these points comes from fewer than three scenarios — read it as indicative
          rather than measured.
        </p>
      )}
    </div>
  );
}
