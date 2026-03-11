import { useMemo } from 'react';
import { calculateComposite, formatDate } from '../lib/scoring';

const LINES = [
  { id: 'composite', label: 'Composite', color: '#1A1A1A', width: 2.5, getValue: (e) => calculateComposite(e.scores) },
  { id: 'incidents', label: 'Incidents', color: '#E8536D', width: 1.5, getValue: (e) => ((e.scores.incidents - 1) / 4) * 100 },
  { id: 'ceasefire', label: 'Ceasefire', color: '#6366F1', width: 1.5, getValue: (e) => ((e.scores.ceasefire - 1) / 4) * 100 },
  { id: 'healthcare', label: 'Healthcare', color: '#14B8A6', width: 1.5, getValue: (e) => ((e.scores.healthcare - 1) / 4) * 100 },
  { id: 'flights', label: 'Flights', color: '#F59E0B', width: 1.5, getValue: (e) => ((e.scores.flights - 1) / 4) * 100 },
  { id: 'exit', label: 'Exit Viability', color: '#A855F7', width: 1.5, getValue: (e) => ((e.scores.exit - 1) / 4) * 100 },
];

function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function TrendChart({ entries }) {
  const sorted = useMemo(() =>
    [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  );

  const data = useMemo(() =>
    sorted.map(entry => {
      const values = {};
      LINES.forEach(line => {
        values[line.id] = line.getValue(entry);
      });
      return { date: entry.date, values };
    }),
    [sorted]
  );

  if (data.length < 2) return null;

  const W = 760;
  const H = 300;
  const pad = { top: 20, right: 20, bottom: 40, left: 10 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const xScale = (i) => pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (val) => pad.top + plotH - (Math.max(0, Math.min(100, val)) / 100) * plotH;

  return (
    <div className="w-full rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-alt)', borderColor: 'var(--border)' }}>
      {/* Legend */}
      <div className="flex items-center gap-5 px-6 pt-5 pb-3 flex-wrap">
        {LINES.map(line => (
          <div key={line.id} className="flex items-center gap-2">
            <div className="rounded-full" style={{
              width: line.id === 'composite' ? 16 : 12,
              height: line.id === 'composite' ? 2.5 : 1.5,
              background: line.color,
              opacity: line.id === 'composite' ? 1 : 0.7,
            }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>{line.label}</span>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block overflow-visible">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(val => (
            <line key={val}
              x1={pad.left} y1={yScale(val)}
              x2={W - pad.right} y2={yScale(val)}
              stroke="var(--border)" strokeWidth="0.5"
            />
          ))}

          {/* Factor lines (behind composite) */}
          {LINES.filter(l => l.id !== 'composite').map(line => {
            const points = data.map((d, i) => [xScale(i), yScale(d.values[line.id])]);
            return (
              <path key={line.id}
                d={smoothPath(points)}
                fill="none" stroke={line.color}
                strokeWidth={line.width} opacity="0.5"
              />
            );
          })}

          {/* Composite line (on top) */}
          {(() => {
            const points = data.map((d, i) => [xScale(i), yScale(d.values.composite)]);
            return (
              <path
                d={smoothPath(points)}
                fill="none" stroke="#1A1A1A"
                strokeWidth="2.5"
              />
            );
          })()}

          {/* End dots */}
          {LINES.map(line => {
            const lastPt = [xScale(data.length - 1), yScale(data[data.length - 1].values[line.id])];
            return (
              <circle key={`dot-${line.id}`}
                cx={lastPt[0]} cy={lastPt[1]}
                r={line.id === 'composite' ? 4 : 2.5}
                fill={line.color}
                opacity={line.id === 'composite' ? 1 : 0.7}
              />
            );
          })}

          {/* X-axis labels */}
          {data.map((d, i) => (
            <text key={d.date}
              x={xScale(i)} y={H - 8}
              fill="var(--text-3)" fontSize="9" fontWeight="500" textAnchor="middle"
            >
              {formatDate(d.date).toUpperCase()}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
