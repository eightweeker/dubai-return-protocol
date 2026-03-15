import { useMemo, useRef, useState, useEffect } from 'react';
import { calculateComposite, formatDate } from '../lib/scoring';

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
    sorted.map(entry => ({
      date: entry.date,
      composite: calculateComposite(entry.scores),
    })),
    [sorted]
  );

  useEffect(() => {
    if (!svgRef.current) return;
    const timer = setTimeout(() => {
      const path = svgRef.current.querySelector('[data-line-id="composite"]');
      if (path) {
        setPathLengths({ composite: path.getTotalLength() });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [data]);

  if (data.length < 2) return null;

  const W = 1200;
  const H = 320;
  const pad = { top: 24, right: 16, bottom: 40, left: 48 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxVal = 100;
  const gridLines = [0, 100, 200, 300, 400];

  const xScale = (i) => pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (val) => pad.top + plotH - (Math.max(0, Math.min(maxVal, val)) / maxVal) * plotH;

  const points = data.map((d, i) => [xScale(i), yScale(d.composite)]);
  const pathD = smoothPath(points);
  const areaD = pathD
    + ` L ${points[points.length - 1][0]},${pad.top + plotH}`
    + ` L ${points[0][0]},${pad.top + plotH} Z`;

  const len = pathLengths.composite || 0;
  const hasLen = len > 0;

  // X-axis labels: first, middle, last
  const xLabels = [];
  if (data.length > 0) {
    const firstDate = new Date(data[0].date + 'T12:00:00');
    const lastDate = new Date(data[data.length - 1].date + 'T12:00:00');
    const midIdx = Math.floor(data.length / 2);
    const midDate = new Date(data[midIdx].date + 'T12:00:00');
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short' });
    xLabels.push({ x: xScale(0), label: fmt(firstDate) });
    if (data.length > 4) xLabels.push({ x: xScale(midIdx), label: fmt(midDate) });
    xLabels.push({ x: xScale(data.length - 1), label: fmt(lastDate) });
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ padding: '24px 0 48px' }}>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} className="block overflow-visible">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Grid lines + Y labels */}
        {gridLines.map(val => {
          const y = pad.top + plotH - (val / 400) * plotH;
          return (
            <g key={val}>
              <line
                x1={pad.left} y1={y}
                x2={W - pad.right} y2={y}
                stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"
                strokeDasharray={val === 0 ? 'none' : '4,4'}
              />
              <text x={pad.left - 8} y={y + 4}
                fill="rgba(255,255,255,0.4)" fontSize="13" fontFamily="Familjen Grotesk" textAnchor="end">
                {val}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#areaFill)" opacity={hasLen ? 1 : 0}
          style={{ transition: 'opacity 0.8s ease 0.4s' }} />

        {/* Line */}
        <path
          data-line-id="composite"
          d={pathD}
          fill="none" stroke="white"
          strokeWidth="2.5"
          style={{
            strokeDasharray: len || 'none',
            strokeDashoffset: 0,
            animation: len ? 'drawLine 1.5s ease-out 0.1s both' : 'none',
            '--line-length': len,
          }}
        />

        {/* X-axis labels */}
        {xLabels.map((item, i) => (
          <text key={i}
            x={item.x} y={H - 4}
            fill="rgba(255,255,255,0.5)" fontSize="13" fontFamily="Familjen Grotesk"
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
          >
            {item.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
