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

function formatDateCompact(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
}

function formatHeroDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const year = d.getFullYear();
  const suffix = [11, 12, 13].includes(day % 100) ? 'th'
    : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
  return `${weekday}, ${day}${suffix} ${month} ${year}`;
}

function getRecommendation(verdict) {
  if (!verdict) return 'Awaiting data';
  const map = {
    'GO': 'Safe to travel',
    'CONDITIONAL GO': 'Travel with caution',
    'HOLD': 'Delay travel plans',
    'NO GO': 'Do not travel today',
    'RED': 'Do not travel — high risk',
  };
  return map[verdict.label] || verdict.meaning;
}

/* ── DayRow ── */
function DayRow({ entry, entries, isExpanded, onToggle, onEdit }) {
  const composite = calculateComposite(entry.scores);
  const verdict = getVerdict(composite);
  const tags = getCriticalTags(entry.scores);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Row header */}
      <div
        className="flex items-center py-5 cursor-pointer group"
        onClick={onToggle}
      >
        {/* Left: date + note + verdict */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
            {formatDateCompact(entry.date)}
          </div>
          <div className="text-sm font-medium mt-1 line-clamp-2 leading-snug" style={{ color: 'var(--text)' }}>
            {entry.note || `Assessment for ${formatDate(entry.date)}`}
          </div>
          <div className="text-[11px] mt-1.5 font-medium" style={{ color: 'var(--text-3)' }}>
            {verdict.label}
          </div>
        </div>

        {/* Tags */}
        <div className="hidden sm:flex items-center gap-2 mr-6 flex-shrink-0">
          {tags.map(tag => (
            <span key={tag} className="tag-pill">{tag}</span>
          ))}
        </div>

        {/* Score */}
        <div className="text-3xl sm:text-4xl font-light tabular-nums mr-4 flex-shrink-0"
          style={{ letterSpacing: '-0.03em', color: 'var(--text)', minWidth: '48px', textAlign: 'right' }}>
          {composite}
        </div>

        {/* Expand */}
        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
          <span className="label-caps-sm hidden sm:inline">EXPAND</span>
          <span className="text-xs transition-transform" style={{
            display: 'inline-block',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-3)',
          }}>↓</span>
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
                      <span className="text-sm font-medium">{factor.shortName}</span>
                      <span className="text-[9px] font-medium" style={{ color: 'var(--text-3)' }}>WT {factor.weight}</span>
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-2)' }}>
                      {rubric ? `${rubric.label} — ${rubric.desc}` : ''}
                    </div>
                  </div>
                  {/* Progress bar */}
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
                  <div className="text-lg font-light tabular-nums flex-shrink-0 w-6 text-right">
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
  const latestComposite = latest ? calculateComposite(latest.scores) : 0;
  const latestVerdict = latest ? getVerdict(latestComposite) : null;
  const readiness = checkReturnReadiness(entries);

  const hasTodayEntry = entries.some(e => e.date === today);

  const readinessChecks = [
    { label: '3+ day uptrend', met: readiness.uptrend, detail: `${readiness.consecutiveDays} days` },
    { label: 'Composite > 65', met: readiness.above65, detail: `Currently ${readiness.composite ?? '—'}` },
    { label: 'Exit viability ≥ 4', met: readiness.exitOk, detail: readiness.exitOk ? 'Available' : 'Insufficient' },
    { label: 'Healthcare ≥ 4', met: readiness.healthcareOk, detail: readiness.healthcareOk ? 'Accessible' : 'Limited' },
  ];

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
      {/* ═══════ HERO ═══════ */}
      <section className="relative w-full overflow-hidden" style={{ height: '100vh', minHeight: '600px' }}>
        {/* Background */}
        <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.3) 80%, rgba(0,0,0,0.5) 100%)',
        }} />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-start px-6 sm:px-10 pt-8 sm:pt-10">
          <div>
            <div className="text-white/90 text-[11px] font-medium tracking-[0.2em] uppercase">Dubai Travel</div>
            <div className="text-white text-[11px] font-bold tracking-[0.2em] uppercase">Dashboard</div>
          </div>
          <div className="text-white/70 text-[11px] font-medium text-right tracking-wide">
            {formatHeroDate(today)}
          </div>
        </div>

        {/* Score */}
        <div className="absolute left-6 sm:left-10 z-10 animate-score" style={{ bottom: '30%' }}>
          <div className="text-white font-extralight leading-[0.85] tracking-[-0.04em]"
            style={{ fontSize: 'clamp(100px, 22vw, 300px)' }}>
            {latestComposite}<span className="text-[0.65em]">%</span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="absolute left-6 sm:left-10 bottom-16 sm:bottom-20 z-10">
          <p className="text-white/60 text-sm mb-1">Recommendation:</p>
          <p className="text-white text-xl sm:text-2xl font-light leading-snug">
            {getRecommendation(latestVerdict)}
          </p>
        </div>

        {/* Right panel — readiness conditions */}
        <div className="absolute right-6 sm:right-10 bottom-16 sm:bottom-20 z-10 hidden md:block">
          <div className="rounded-xl px-5 py-4 space-y-2.5"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            {readinessChecks.map(check => (
              <div key={check.label} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                  background: check.met ? '#22C55E' : 'rgba(255,255,255,0.3)',
                }} />
                <span className="text-white/60 text-[11px]">
                  {check.label}: <span className="text-white/90">{check.detail}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute left-6 sm:left-10 bottom-6 z-10">
          <span className="text-white/30 text-[9px] tracking-[0.3em] uppercase font-medium">Scroll</span>
        </div>
      </section>

      {/* ═══════ CHART ═══════ */}
      <section className="max-w-[1100px] mx-auto px-6 sm:px-10 pt-16 pb-8">
        <TrendChart entries={entries} />
      </section>

      {/* ═══════ ACTIONS ═══════ */}
      <section className="max-w-[1100px] mx-auto px-6 sm:px-10 pb-12">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => onEditDay(today)}
            className="text-xs font-medium px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95"
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
            className="text-xs font-medium px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{ background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            Open all sources ↗
          </button>
        </div>
      </section>

      {/* ═══════ DAYS ═══════ */}
      <section className="max-w-[1100px] mx-auto px-6 sm:px-10 pb-16">
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-4xl sm:text-5xl font-extralight leading-none tracking-tight">Days</h2>
          <div className="flex items-center gap-6">
            <span className="label-caps-sm">{entries.length} days tracked</span>
          </div>
        </div>

        {/* Day rows */}
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {[...sorted].reverse().map(entry => (
            <DayRow
              key={entry.date}
              entry={entry}
              entries={entries}
              isExpanded={expandedDate === entry.date}
              onToggle={() => setExpandedDate(prev => prev === entry.date ? null : entry.date)}
              onEdit={() => onEditDay(entry.date)}
            />
          ))}
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}>
        <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <span className="label-caps-sm block mb-3">Methodology</span>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                9 weighted factors (1–5 scale) across security, logistics, healthcare, and diplomacy.
                Composite = weighted normalisation to 0–100. Total weight: 33 points.
              </p>
            </div>
            <div>
              <span className="label-caps-sm block mb-3">Decision Rule</span>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Never return on a single day's score. Require 3+ consecutive days of upward trend
                AND composite above 65, with Exit Viability and Healthcare each independently ≥ 4.
              </p>
            </div>
            <div>
              <span className="label-caps-sm block mb-3">Data</span>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => exportJSON(entries)}
                  className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-colors hover:opacity-70"
                  style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  Export JSON
                </button>
                <button onClick={() => fileRef.current?.click()}
                  className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-colors hover:opacity-70"
                  style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                  Import JSON
                </button>
                <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
            style={{ borderColor: 'var(--border)' }}>
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>
              Dubai Return Protocol v1.0
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
              Personal Decision Framework — Not Professional Advice
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
