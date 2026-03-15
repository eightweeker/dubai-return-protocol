import { useState, useMemo, useRef } from 'react';
import { calculateComposite, getVerdict, getTodayStr, formatDate } from '../lib/scoring';
import { exportJSON, importJSON } from '../lib/storage';
import { FACTORS, ALL_SOURCE_URLS } from '../lib/constants';
import TrendChart from './TrendChart';
import heroImg from '../assets/dubai-hero.jpg';

/* ── helpers ── */
function formatRowDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}.${mm}.${yy}`;
}

function getRecommendation(verdict) {
  if (!verdict) return 'Awaiting data';
  const map = {
    'GO': 'Safe to travel.',
    'CONDITIONAL GO': 'Travel with caution.',
    'HOLD': 'Delay travel plans.',
    'NO GO': 'Do not travel today.',
    'RED': 'Do not travel — high risk.',
  };
  return map[verdict.label] || verdict.meaning;
}

/* ── DayRow ── */
function DayRow({ entry, isExpanded, onToggle, onEdit }) {
  const composite = calculateComposite(entry.scores);
  const verdict = getVerdict(composite);

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="flex items-center py-[20px] sm:py-[18px] cursor-pointer group gap-3 sm:gap-4" onClick={onToggle}>
        {/* Date */}
        <span className="font-jakarta text-[14px] sm:text-[15px] font-normal leading-[20px] text-white w-[72px] sm:w-[80px] flex-shrink-0">
          {formatRowDate(entry.date)}
        </span>

        {/* Note — fills remaining space */}
        <span className="font-jakarta text-[14px] sm:text-[15px] font-normal leading-[20px] text-white flex-1 min-w-0 truncate">
          {entry.note || `Assessment for ${formatDate(entry.date)}`}
        </span>

        {/* Verdict */}
        <span className="font-jakarta text-[14px] sm:text-[15px] font-normal leading-[20px] text-white whitespace-nowrap flex-shrink-0">
          {verdict.label}
        </span>

        {/* Score — bold */}
        <span className="font-jakarta text-[14px] sm:text-[15px] font-bold leading-[20px] text-white tabular-nums flex-shrink-0 w-[44px] sm:w-[48px] text-right">
          {composite}%
        </span>
      </div>

      {/* Expanded breakdown */}
      {isExpanded && (
        <div className="pb-6 animate-expand">
          <div className="flex items-center justify-between mb-4">
            <span className="label-caps">9-Factor Breakdown</span>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="font-jakarta text-xs font-medium px-4 py-1.5 rounded-full transition-all hover:scale-105"
              style={{ background: 'white', color: '#1E2A2F' }}
            >
              Edit Scores
            </button>
          </div>
          <div className="grid grid-cols-1 gap-px rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            {FACTORS.map(factor => {
              const score = entry.scores[factor.id] || 1;
              const pct = ((score - 1) / 4) * 100;
              const rubric = factor.rubric.find(r => r.score === score);
              return (
                <div key={factor.id} className="flex items-center gap-4 px-5 py-3.5" style={{ background: 'rgba(30,42,47,0.85)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{factor.shortName}</span>
                      <span className="font-mono text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>WT {factor.weight}</span>
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {rubric ? `${rubric.label} — ${rubric.desc}` : ''}
                    </div>
                  </div>
                  <div className="w-24 sm:w-32 flex-shrink-0">
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: score >= 4 ? '#22C55E' : score >= 3 ? '#EAB308' : score >= 2 ? '#F97316' : '#EF4444',
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-lg font-light tabular-nums flex-shrink-0 w-6 text-right text-white">
                    {score}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {FACTORS.flatMap(f => f.sources).filter((s, i, arr) =>
              s.url && arr.findIndex(x => x.url === s.url) === i
            ).slice(0, 8).map(source => (
              <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-medium px-3 py-1 rounded-full transition-colors hover:opacity-70"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {source.name} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Overview ── */
export default function Overview({ entries, onEditDay, onUpdateEntries }) {
  const [expandedDate, setExpandedDate] = useState(null);
  const fileRef = useRef(null);
  const today = getTodayStr();

  const sorted = useMemo(() =>
    [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries]
  );

  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const prevEntry = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const latestComposite = latest ? calculateComposite(latest.scores) : 0;
  const prevComposite = prevEntry ? calculateComposite(prevEntry.scores) : null;
  const delta = prevComposite !== null ? latestComposite - prevComposite : null;
  const latestVerdict = latest ? getVerdict(latestComposite) : null;
  const hasTodayEntry = entries.some(e => e.date === today);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importJSON(file);
      onUpdateEntries(data);
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }
    e.target.value = '';
  };

  const openAllSources = () => {
    ALL_SOURCE_URLS.forEach(s => { if (s.url) window.open(s.url, '_blank'); });
  };

  return (
    <div className="animate-in relative" style={{ background: '#1E2A2F' }}>
      {/* ═══ FULL-PAGE BACKGROUND — image pinned at top, gradient fades to solid ═══ */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden" style={{ height: '100vh' }}>
        <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 30%' }} />
        {/* Uniform dark tint */}
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.2)' }} />
        {/* Bottom fade to #1E2A2F */}
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(180deg,
            rgba(30,42,47,0) 52%,
            rgb(30,42,47) 83%
          )`,
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(180deg,
            rgba(30,42,47,0) 61%,
            rgb(30,42,47) 86%
          )`,
        }} />
      </div>

      {/* ═══ CONTENT CONTAINER — max 1344px centered ═══ */}
      <div className="relative max-w-[1344px] mx-auto px-6 sm:px-12 lg:px-[64px]">

        {/* ── HEADER ── */}
        <header className="flex items-center gap-[8px] h-[72px] pt-[20px] pb-[20px]"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {/* Logomark — compass/arrow circle */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="flex-shrink-0">
            <circle cx="16" cy="16" r="14.5" stroke="white" strokeWidth="1" opacity="0.7" />
            <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="0.5" opacity="0.3" />
            <path d="M16 6L16 26" stroke="white" strokeWidth="1" opacity="0.5" />
            <path d="M6 16L26 16" stroke="white" strokeWidth="1" opacity="0.5" />
            <path d="M16 4L18 8L16 7L14 8Z" fill="white" opacity="0.8" />
          </svg>
          <span className="font-sen font-bold text-white text-[28px] lowercase" style={{ letterSpacing: '-1.12px' }}>
            dubai travel protocol
          </span>
        </header>

        {/* ── HERO TITLE ── */}
        <div className="pt-[200px] sm:pt-[120px] pb-[176px] sm:pb-[72px] text-center">
          <h1 className="font-syne font-bold text-white leading-[1] tracking-[-2.4px]"
            style={{ fontSize: 'clamp(34px, 8.3vw, 120px)' }}>
            Is it Safe to Travel to<br />Dubai Today?
          </h1>
        </div>

        {/* ── DASHBOARD CHART SECTION ── */}
        <div className="py-[16px]">
          <div className="pt-[32px] pb-[56px]">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <p className="font-grotesk font-semibold text-[17px] leading-[24px] text-white">
                {getRecommendation(latestVerdict)}
              </p>
            </div>

            {/* Score + delta */}
            <div className="flex items-baseline gap-[10px] mt-[20px]">
              <span className="font-syne font-bold text-[34px] leading-[40px] text-white" style={{ letterSpacing: '-0.34px' }}>
                {latestComposite}%
              </span>
              {delta !== null && (
                <span className="font-mono text-[13px] leading-[16px] text-white">
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% yesterday
                </span>
              )}
            </div>

            {/* Chart */}
            <div className="mt-[40px]">
              <TrendChart entries={entries} />
            </div>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="py-[32px]">
          {/* Table header */}
          <div className="flex items-center py-[8px]">
            <span className="font-mono font-bold text-[13px] leading-[16px] text-white">Day</span>
            <span className="text-white/35 ml-0.5">▾</span>
          </div>

          {/* Rows */}
          <div>
            {[...sorted].reverse().map(entry => (
              <DayRow
                key={entry.date}
                entry={entry}
                isExpanded={expandedDate === entry.date}
                onToggle={() => setExpandedDate(prev => prev === entry.date ? null : entry.date)}
                onEdit={() => onEditDay(entry.date)}
              />
            ))}
          </div>
        </div>

        {/* ── ACTION BUTTONS ── */}
        <div className="flex items-center gap-3 flex-wrap pt-10 pb-20">
          <button
            onClick={() => onEditDay(today)}
            className="font-jakarta text-xs font-medium px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{
              background: hasTodayEntry ? 'transparent' : 'white',
              color: hasTodayEntry ? 'white' : '#1E2A2F',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            {hasTodayEntry ? 'Edit today\'s scores' : 'Enter today\'s scores'}
          </button>
          <button
            onClick={openAllSources}
            className="font-jakarta text-xs font-medium px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            Open all sources ↗
          </button>
        </div>

        {/* ── FOOTER ── */}
        <footer className="pb-16 pt-12" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <span className="label-caps-sm block mb-3">Methodology</span>
              <p className="font-jakarta text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                9 weighted factors (1–5 scale) across security, logistics, healthcare, and diplomacy.
                Composite = weighted normalisation to 0–100. Total weight: 33 points.
              </p>
            </div>
            <div>
              <span className="label-caps-sm block mb-3">Decision Rule</span>
              <p className="font-jakarta text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Never return on a single day's score. Require 3+ consecutive days of upward trend
                AND composite above 65, with Exit Viability and Healthcare each independently ≥ 4.
              </p>
            </div>
            <div>
              <span className="label-caps-sm block mb-3">Data</span>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => exportJSON(entries)}
                  className="font-jakarta text-[10px] font-medium px-3 py-1.5 rounded-full transition-colors hover:opacity-70"
                  style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  Export JSON
                </button>
                <button onClick={() => fileRef.current?.click()}
                  className="font-jakarta text-[10px] font-medium px-3 py-1.5 rounded-full transition-colors hover:opacity-70"
                  style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  Import JSON
                </button>
                <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="font-jakarta text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Dubai Travel Protocol v1.0
            </span>
            <span className="font-jakarta text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Personal Decision Framework — Not Professional Advice
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
