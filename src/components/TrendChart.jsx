import { useMemo, useRef, useState, useEffect } from 'react';
import { calculateComposite, formatDate } from '../lib/scoring';

const LINES = [
  { id: 'composite', label: 'Composite', color: '#FFFFFF', width: 2.5, getValue: (e) => calculateComposite(e.scores) },
  { id: 'incidents', label: 'Incidents', color: '#FF4D6A', width: 1.5, getValue: (e) => ((e.scores.incidents - 1) / 4) * 100 },
  { id: 'ceasefire', label: 'Ceasefire', color: '#818CF8', width: 1.5, getValue: (e) => ((e.scores.ceasefire - 1) / 4) * 100 },
  { id: 'healthcare', label: 'Healthcare', color: '#2DD4BF', width: 1.5, getValue: (e) => ((e.scores.healthcare - 1) / 4) * 100 },
  { id: 'flights', label: 'Flights', color: '#FBBF24', width: 1.5, getValue: (e) => ((e.scores.flights - 1) / 4) * 100 },
  { id: 'exit', label: 'Exit Viability', color: '#C084FC', width: 1.5, getValue: (e) => ((e.scores.exit - 1) / 4) * 100 },
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

  // Measure path lengths for drawing animation
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
  const H = 300;
  const pad = { top: 20, right: 20, bottom: 40, left: 35 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const xScale = (i) => pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (val) => pad.top + plotH - (Math.max(0, Math.min(100, val)) / 100) * plotH;

  const hasLengths = Object.keys(pathLengths).length > 0;

  return (
    <div className="w-full rounded-2xl overflow-hidden chart-glass">
      {/* Legend */}
      <div className="flex items-center gap-5 px-6 pt-5 pb-3 flex-wrap">
        {LINES.map(line => (
          <div key={line.id} className="flex items-center gap-2">
            <div className="rounded-full" style={{
              width: line.id === 'composite' ? 16 : 12,
              height: line.id === 'composite' ? 2.5 : 1.5,
              background: line.color,
              opacity: line.id === 'composite' ? 1 : 0.7,
              boxShadow: `0 0 6px ${line.color}60`,
            }} />
            <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{line.label}</span>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5 relative">
        {/* Ambient glow orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.12) 0%, transparent 70%)', animation: 'ambientFloat 6s ease-in-out infinite' }} />
          <div className="absolute top-1/3 right-1/4 w-24 h-24 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.1) 0%, transparent 70%)', animation: 'ambientFloat 8s ease-in-out infinite 2s' }} />
          <div className="absolute bottom-1/4 left-1/2 w-28 h-28 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)', animation: 'ambientFloat 7s ease-in-out infinite 1s' }} />
        </div>

        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} className="block overflow-visible relative">
          <defs>
            <linearGradient id="compositeAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(val => (
            <g key={val}>
              <line
                x1={pad.left} y1={yScale(val)}
                x2={W - pad.right} y2={yScale(val)}
                stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"
              />
              <text x={pad.left - 6} y={yScale(val) + 3}
                fill="rgba(255,255,255,0.2)" fontSize="8" fontWeight="400" textAnchor="end">
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
            return <path d={areaD} fill="url(#compositeAreaGrad)" opacity={hasLengths ? 0.6 : 0} style={{ transition: 'opacity 1s ease 0.5s' }} />;
          })()}

          {/* Factor lines (behind composite) */}
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
                opacity={hasLengths ? 0.65 : 0.4}
                style={{
                  filter: `drop-shadow(0 0 4px ${line.color}50)`,
                  strokeDasharray: len || 'none',
                  strokeDashoffset: 0,
                  animation: len ? `drawLine 1.5s ease-out ${0.3 + idx * 0.12}s both` : 'none',
                  '--line-length': len,
                  transition: 'opacity 0.5s ease',
                }}
              />
            );
          })}

          {/* Composite line (on top) */}
          {(() => {
            const points = data.map((d, i) => [xScale(i), yScale(d.values.composite)]);
            const pathD = smoothPath(points);
            const len = pathLengths['composite'] || 0;
            return (
              <path
                data-line-id="composite"
                d={pathD}
                fill="none" stroke="#FFFFFF"
                strokeWidth="2.5"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.35)) drop-shadow(0 0 20px rgba(255,255,255,0.15))',
                  strokeDasharray: len || 'none',
                  strokeDashoffset: 0,
                  animation: len ? 'drawLine 1.8s ease-out 0.1s both' : 'none',
                  '--line-length': len,
                }}
              />
            );
          })()}

          {/* End dots with pulse */}
          {LINES.map((line, idx) => {
            const lastPt = [xScale(data.length - 1), yScale(data[data.length - 1].values[line.id])];
            const baseR = line.id === 'composite' ? 4.5 : 2.5;
            return (
              <circle key={`dot-${line.id}`}
                cx={lastPt[0]} cy={lastPt[1]}
                r={baseR}
                fill={line.color}
                opacity={hasLengths ? 1 : 0}
                style={{
                  filter: `drop-shadow(0 0 6px ${line.color}) drop-shadow(0 0 12px ${line.color}60)`,
                  transformOrigin: `${lastPt[0]}px ${lastPt[1]}px`,
                  transformBox: 'fill-box',
                  animation: hasLengths ? `pulseDot 3s ease-in-out ${1.8 + idx * 0.15}s infinite` : 'none',
                  transition: 'opacity 0.5s ease 1.5s',
                }}
              />
            );
          })}

          {/* X-axis labels */}
          {data.map((d, i) => (
            <text key={d.date}
              x={xScale(i)} y={H - 8}
              fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="500" textAnchor="middle"
            >
              {formatDate(d.date).toUpperCase()}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
