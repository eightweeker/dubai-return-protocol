import { useMemo, useRef, useState, useEffect } from 'react';
import { calculateComposite } from '../lib/scoring';

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
  const [pathLen, setPathLen] = useState(0);

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
      if (path) setPathLen(path.getTotalLength());
    }, 50);
    return () => clearTimeout(timer);
  }, [data]);

  if (data.length < 2) return null;

  const W = 1200;
  const H = 300;
  const pad = { top: 8, right: 0, bottom: 32, left: 48 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  // Y-axis: 0 to 400 (Figma gridlines)
  const yMax = 400;
  const gridVals = [0, 100, 200, 300, 400];

  const xScale = (i) => pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (val) => pad.top + plotH - (Math.max(0, Math.min(yMax, val)) / yMax) * plotH;

  // Map composite 0-100 to chart 0-400 range so line uses ~bottom quarter
  const chartVal = (composite) => composite * 4;

  const points = data.map((d, i) => [xScale(i), yScale(chartVal(d.composite))]);
  const pathD = smoothPath(points);
  const areaD = pathD
    + ` L ${points[points.length - 1][0]},${pad.top + plotH}`
    + ` L ${points[0][0]},${pad.top + plotH} Z`;

  const hasLen = pathLen > 0;

  // X-axis month labels: show first, middle, last
  const monthLabel = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short' });
  };

  const xLabels = [];
  if (data.length >= 2) {
    xLabels.push({ x: xScale(0), label: monthLabel(data[0].date), anchor: 'start' });
    if (data.length > 4) {
      const mid = Math.floor(data.length / 2);
      xLabels.push({ x: xScale(mid), label: monthLabel(data[mid].date), anchor: 'middle' });
    }
    xLabels.push({ x: xScale(data.length - 1), label: monthLabel(data[data.length - 1].date), anchor: 'end' });
  }

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} className="block overflow-visible">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* Gridlines + Y labels */}
      {gridVals.map(val => {
        const y = yScale(val);
        return (
          <g key={val}>
            <line
              x1={pad.left} y1={y}
              x2={W - pad.right} y2={y}
              stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"
              strokeDasharray={val === 0 ? 'none' : '4,4'}
            />
            <text x={pad.left - 8} y={y + 4}
              fill="rgba(255,255,255,0.4)" fontSize="13"
              fontFamily="Familjen Grotesk, sans-serif" textAnchor="end">
              {val}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaD} fill="url(#chartFill)" opacity={hasLen ? 1 : 0}
        style={{ transition: 'opacity 0.8s ease 0.3s' }} />

      {/* Line */}
      <path
        data-line-id="composite"
        d={pathD}
        fill="none" stroke="white" strokeWidth="2.5"
        style={{
          strokeDasharray: pathLen || 'none',
          strokeDashoffset: 0,
          animation: pathLen ? 'drawLine 1.5s ease-out 0.1s both' : 'none',
          '--line-length': pathLen,
        }}
      />

      {/* X-axis month labels */}
      {xLabels.map((item, i) => (
        <text key={i}
          x={item.x} y={H - 4}
          fill="rgba(255,255,255,0.5)" fontSize="13"
          fontFamily="Familjen Grotesk, sans-serif"
          textAnchor={item.anchor}
        >
          {item.label}
        </text>
      ))}
    </svg>
  );
}
