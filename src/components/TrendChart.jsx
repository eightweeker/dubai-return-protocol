import { useMemo, useRef, useState, useEffect } from 'react';
import { calculateComposite, formatDate } from '../lib/scoring';

const LINES = [
  { id: 'composite', label: 'Composite', color: '#1A1A1A', width: 2.5, getValue: (e) => calculateComposite(e.scores) },
  { id: 'incidents', label: 'Incidents', color: '#E87461', width: 1.2, getValue: (e) => ((e.scores.incidents - 1) / 4) * 100 },
  { id: 'ceasefire', label: 'Ceasefire', color: '#7C8CF8', width: 1.2, getValue: (e) => ((e.scores.ceasefire - 1) / 4) * 100 },
  { id: 'healthcare', label: 'Healthcare', color: '#34B89C', width: 1.2, getValue: (e) => ((e.scores.healthcare - 1) / 4) * 100 },
  { id: 'flights', label: 'Flights', color: '#E5A63B', width: 1.2, getValue: (e) => ((e.scores.flights - 1) / 4) * 100 },
  { id: 'exit', label: 'Exit Viability', color: '#A78BDB', width: 1.2, getValue: (e) => ((e.scores.exit - 1) / 4) * 100 },
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
  const svgRef = useRef(null);
  const [pathLengths, setPathLengths] = useState({});

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

  useEffect(() => {
    if (!svgRef.current) return;
    const timer = setTimeout(() => {
      const paths = svgRef.current.querySelectorAll('[data-line-id]');
      const lengths = {};
      paths.forEach(p => {
        lengths[p.dataset.lineId] = p.getTotalLength();
      });
      setPathLengths(lengths);
    }, 50);
    return () => clearTimeout(timer);
  }, [data]);

  if (data.length < 2) return null;

  const W = 760;
  const H = 280;
  const pad = { top: 20, right: 16, bottom: 36, left: 32 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const xScale = (i) => pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (val) => pad.top + plotH - (Math.max(0, Math.min(100, val)) / 100) * plotH;

  const hasLengths = Object.keys(pathLengths).length > 0;

  return (
    <div className="w-full rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.04)',
      }}>
      {/* Legend */}
      <div className="flex items-center gap-5 px-6 pt-5 pb-2 flex-wrap">
        {LINES.map(line => (
          <div key={line.id} className="flex items-center gap-2">
            <div className="rounded-full" style={{
              width: line.id === 'composite' ? 16 : 12,
              height: line.id === 'composite' ? 2.5 : 1.5,
              background: line.color,
              opacity: line.id === 'composite' ? 1 : 0.6,
            }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>{line.label}</span>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4">
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} className="block overflow-visible">
          <defs>
            <linearGradient id="compositeAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(26,26,26,0.08)" />
              <stop offset="100%" stopColor="rgba(26,26,26,0)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(val => (
            <g key={val}>
              <line
                x1={pad.left} y1={yScale(val)}
                x2={W - pad.right} y2={yScale(val)}
                stroke="rgba(0,0,0,0.05)" strokeWidth="0.5"
                strokeDasharray={val === 0 ? 'none' : '4,3'}
              />
              <text x={pad.left - 6} y={yScale(val) + 3}
                fill="var(--text-3)" fontSize="8" fontWeight="400" textAnchor="end">
                {val}
              </text>
            </g>
          ))}

          {/* Composite area fill */}
          {(() => {
            const points = data.map((d, i) => [xScale(i), yScale(d.values.composite)]);
            const pathD = smoothPath(points);
            const areaD = pathD
              + ` L ${points[points.length - 1][0]},${pad.top + plotH}`
              + ` L ${points[0][0]},${pad.top + plotH} Z`;
            return <path d={areaD} fill="url(#compositeAreaGrad)" opacity={hasLengths ? 1 : 0} style={{ transition: 'opacity 0.8s ease 0.4s' }} />;
          })()}

          {/* Factor lines */}
          {LINES.filter(l => l.id !== 'composite').map((line, idx) => {
            const points = data.map((d, i) => [xScale(i), yScale(d.values[line.id])]);
            const pathD = smoothPath(points);
            const len = pathLengths[line.id] || 0;
            return (
              <path key={line.id}
                data-line-id={line.id}
                d={pathD}
                fill="none" stroke={line.color}
                strokeWidth={line.width}
                opacity={hasLengths ? 0.45 : 0.2}
                style={{
                  strokeDasharray: len || 'none',
                  strokeDashoffset: 0,
                  animation: len ? `drawLine 1.2s ease-out ${0.2 + idx * 0.1}s both` : 'none',
                  '--line-length': len,
                  transition: 'opacity 0.5s ease',
                }}
              />
            );
          })}

          {/* Composite line */}
          {(() => {
            const points = data.map((d, i) => [xScale(i), yScale(d.values.composite)]);
            const pathD = smoothPath(points);
            const len = pathLengths['composite'] || 0;
            return (
              <path
                data-line-id="composite"
                d={pathD}
                fill="none" stroke="#1A1A1A"
                strokeWidth="2.5"
                style={{
                  strokeDasharray: len || 'none',
                  strokeDashoffset: 0,
                  animation: len ? 'drawLine 1.5s ease-out 0.1s both' : 'none',
                  '--line-length': len,
                }}
              />
            );
          })()}

          {/* End dots */}
          {LINES.map((line) => {
            const lastPt = [xScale(data.length - 1), yScale(data[data.length - 1].values[line.id])];
            const isComposite = line.id === 'composite';
            return (
              <circle key={`dot-${line.id}`}
                cx={lastPt[0]} cy={lastPt[1]}
                r={isComposite ? 4 : 2.5}
                fill={isComposite ? '#1A1A1A' : line.color}
                opacity={hasLengths ? (isComposite ? 1 : 0.6) : 0}
                style={{ transition: 'opacity 0.5s ease 1.2s' }}
              />
            );
          })}

          {/* X-axis labels */}
          {data.map((d, i) => (
            <text key={d.date}
              x={xScale(i)} y={H - 6}
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
