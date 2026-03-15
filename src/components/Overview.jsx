import { useState, useMemo, useRef } from 'react';
import { calculateComposite, getVerdict, getTodayStr, getConflictDay, formatDate, formatDateLong, checkReturnReadiness } from '../lib/scoring';
import { exportJSON, importJSON } from '../lib/storage';
import { FACTORS, ALL_SOURCE_URLS } from '../lib/constants';
import TrendChart from './TrendChart';
import heroImg from '../assets/dubai-hero.jpg';

/* ── helpers ── */
const FACTOR_CATEGORIES = {
  flights: 'LOGISTICS', incidents: 'SECURITY', hormuz: 'MARITIME',
  oil: 'ECONOMY', advisory: 'DIPLOMACY', ceasefire: 'DIPLOMACY',
  airport_threat: 'SECURITY', healthcare: 'HEALTH', exit: 'LOGISTICS',
};

function getCriticalTags(scores) {
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]);
  const seen = new Set();
  const tags = [];
  for (const [id] of sorted) {
    const cat = FACTOR_CATEGORIES[id];
    if (!seen.has(cat)) {
      seen.add(cat);
      tags.push(cat);
      if (tags.length >= 3) break;
    }
  }
  return tags;
}

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

/* ── DayRow (matches Figma table row) ── */
function DayRow({ entry, entries, prevEntry, isExpanded, onToggle, onEdit }) {
  const composite = calculateComposite(entry.scores);
  const verdict = getVerdict(composite);

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div
        className="flex items-center py-4 cursor-pointer group gap-4"
        onClick={onToggle}
      >
        {/* Date */}
        <div className="font-jakarta text-[15px] font-normal whitespace-nowrap flex-shrink-0 w-[72px]"
          style={{ color: 'var(--text)' }}>
          {formatRowDate(entry.date)}
        </div>

        {/* Note */}
        <div className="flex-1 min-w-0 font-jakarta text-[15px] font-normal leading-[20px] truncate"
          style={{ color: 'var(--text)' }}>
          {entry.note || `Assessment for ${formatDate(entry.date)}`}
        </div>

        {/* Verdict + Score */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="font-jakarta text-[15px] font-normal whitespace-nowrap"
            style={{ color: 'var(--text-2)' }}>
            {verdict.label}
          </span>
          <span className="font-jakarta text-[15px] font-bold tabular-nums whitespace-nowrap"
            style={{ color: 'var(--text)' }}>
            {composite}%
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="pb-6 animate-expand">
          <div className="flex items-center justify-between mb-4">
            <span className="label-caps">9-Factor Breakdown</span>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="text-xs font-medium px-4 py-1.5 rounded-full transition-all hover:scale-105"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}
            >
              Edit Scores
            </button>
          </div>
          <div className="grid grid-cols-1 gap-px rounded-xl overflow-hidden" style={{ background: 'var(--border)' }}>
            {FACTORS.map(factor => {
              const score = entry.scores[factor.id] || 1;
              const pct = ((score - 1) / 4) * 100;
              const rubric = factor.rubric.find(r => r.score === score);
              return (
                <div key={factor.id} className="flex items-center gap-4 px-5 py-3.5" style={{ background: 'var(--bg)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{factor.shortName}</span>
                      <span className="text-[9px] font-medium font-mono" style={{ color: 'var(--text-3)' }}>WT {factor.weight}</span>
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-2)' }}>
                      {rubric ? `${rubric.label} — ${rubric.desc}` : ''}
                    </div>
                  </div>
                  <div className="w-24 sm:w-32 flex-shrink-0">
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: score >= 4 ? '#22C55E' : score >= 3 ? '#EAB308' : score >= 2 ? '#F97316' : '#EF4444',
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-lg font-light tabular-nums flex-shrink-0 w-6 text-right" style={{ color: 'var(--text)' }}>
                    {score}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Source links */}
          <div className="flex flex-wrap gap-2 mt-4">
            {FACTORS.flatMap(f => f.sources).filter((s, i, arr) =>
              s.url && arr.findIndex(x => x.url === s.url) === i
            ).slice(0, 8).map(source => (
              <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer"
                className="text-[10px] font-medium px-3 py-1 rounded-full transition-colors hover:opacity-70"
                style={{ background: 'var(--bg-alt)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
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
    <div className="animate-in">
      {/* ═══════ HERO — Full bleed with Dubai skyline ═══════ */}
      <section className="relative w-full overflow-hidden" style={{ height: '52vh', minHeight: '420px' }}>
        {/* Background image */}
        <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {/* Dark gradient overlay — fades to bg color */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.2) 100%),
            linear-gradient(180deg, rgba(30,42,47,0) 40%, rgba(30,42,47,0.6) 70%, rgb(30,42,47) 95%)
          `,
        }} />

        {/* Header bar */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="max-w-[1344px] mx-auto px-6 sm:px-12 pt-4 pb-4 flex items-center gap-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Logo icon */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="flex-shrink-0">
              <circle cx="16" cy="16" r="15" stroke="white" strokeWidth="1" opacity="0.6" />
              <path d="M16 8L16 24M10 14L16 8L22 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
            </svg>
            <span className="font-sen font-bold text-white text-lg lowercase tracking-tight" style={{ letterSpacing: '-0.04em' }}>
              dubai travel protocol
            </span>
          </div>
        </div>

        {/* Hero title — centered */}
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6 sm:px-12">
          <h1 className="font-syne font-bold text-white text-center leading-[1.05] tracking-tight"
            style={{ fontSize: 'clamp(40px, 8vw, 120px)', letterSpacing: '-0.02em' }}>
            Is it Safe to Travel to Dubai Today?
          </h1>
        </div>
      </section>

      {/* ═══════ SCORE STRIP ═══════ */}
      <section className="max-w-[1344px] mx-auto px-6 sm:px-12 pt-8 pb-2">
        <div className="flex flex-col gap-2">
          <p className="font-grotesk font-semibold text-[17px] leading-[24px]" style={{ color: 'var(--text)' }}>
            {getRecommendation(latestVerdict)}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-syne font-bold text-[34px] leading-[40px]" style={{ letterSpacing: '-0.01em', color: 'var(--text)' }}>
              {latestComposite}%
            </span>
            {delta !== null && (
              <span className="font-mono text-[13px] leading-[16px]" style={{ color: 'var(--text-2)' }}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% yesterday
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ CHART ═══════ */}
      <section className="max-w-[1344px] mx-auto px-6 sm:px-12 pt-6 pb-6">
        <TrendChart entries={entries} />
      </section>

      {/* ═══════ TABLE ═══════ */}
      <section className="max-w-[1344px] mx-auto px-6 sm:px-12 pt-6 pb-16">
        {/* Table header */}
        <div className="flex items-center py-1 mb-0">
          <div className="flex items-center">
            <span className="font-mono font-bold text-[13px] leading-[16px]" style={{ color: 'var(--text)' }}>
              Day
            </span>
            <span className="ml-0.5" style={{ color: 'var(--text-3)' }}>▾</span>
          </div>
        </div>

        {/* Day rows */}
        <div>
          {[...sorted].reverse().map((entry, idx) => (
            <DayRow
              key={entry.date}
              entry={entry}
              entries={entries}
              prevEntry={idx < sorted.length - 1 ? [...sorted].reverse()[idx + 1] : null}
              isExpanded={expandedDate === entry.date}
              onToggle={() => setExpandedDate(prev => prev === entry.date ? null : entry.date)}
              onEdit={() => onEditDay(entry.date)}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap mt-8">
          <button
            onClick={() => onEditDay(today)}
            className="font-jakarta text-xs font-medium px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{
              background: hasTodayEntry ? 'transparent' : 'var(--text)',
              color: hasTodayEntry ? 'var(--text)' : 'var(--bg)',
              border: '1px solid var(--border)',
            }}
          >
            {hasTodayEntry ? 'Edit today\'s scores' : 'Enter today\'s scores'}
          </button>
          <button
            onClick={openAllSources}
            className="font-jakarta text-xs font-medium px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{ background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            Open all sources ↗
          </button>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-alt)' }}>
        <div className="max-w-[1344px] mx-auto px-6 sm:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <span className="label-caps-sm block mb-3">Methodology</span>
              <p className="font-jakarta text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                9 weighted factors (1–5 scale) across security, logistics, healthcare, and diplomacy.
                Composite = weighted normalisation to 0–100. Total weight: 33 points.
              </p>
            </div>
            <div>
              <span className="label-caps-sm block mb-3">Decision Rule</span>
              <p className="font-jakarta text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Never return on a single day's score. Require 3+ consecutive days of upward trend
                AND composite above 65, with Exit Viability and Healthcare each independently ≥ 4.
              </p>
            </div>
            <div>
              <span className="label-caps-sm block mb-3">Data</span>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => exportJSON(entries)}
                  className="font-jakarta text-[10px] font-medium px-3 py-1.5 rounded-full transition-colors hover:opacity-70"
                  style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  Export JSON
                </button>
                <button onClick={() => fileRef.current?.click()}
                  className="font-jakarta text-[10px] font-medium px-3 py-1.5 rounded-full transition-colors hover:opacity-70"
                  style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  Import JSON
                </button>
                <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
            style={{ borderTop: '1px solid var(--border)' }}>
            <span className="font-jakarta text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>
              Dubai Travel Protocol v1.0
            </span>
            <span className="font-jakarta text-[10px]" style={{ color: 'var(--text-3)' }}>
              Personal Decision Framework — Not Professional Advice
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
