import { useState } from 'react';
import { FACTORS } from '../lib/constants';
import { calculateComposite, getVerdict, getConflictDay, formatDateLong } from '../lib/scoring';

function ScoreSelector({ factor, value, onChange }) {
  const rubricItem = factor.rubric.find(r => r.score === value);

  return (
    <div className="py-5" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {factor.name}
            </span>
            <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded"
              style={{ background: 'var(--bg-alt)', color: 'var(--text-3)' }}>
              WT {factor.weight}
            </span>
            {factor.inverse && (
              <span className="text-[8px] font-semibold px-2 py-0.5 rounded"
                style={{ background: 'rgba(220,38,38,0.15)', color: '#F87171' }}>
                INVERSE
              </span>
            )}
          </div>
          <span className="text-[11px] mt-0.5 block" style={{ color: 'var(--text-3)' }}>
            {factor.description}
          </span>
        </div>
        <div className="text-2xl font-light tabular-nums" style={{ color: 'var(--text)' }}>
          {value}
        </div>
      </div>

      {/* Score strip */}
      <div className="flex gap-1.5 mb-3">
        {[1, 2, 3, 4, 5].map(score => {
          const isActive = score === value;
          return (
            <button
              key={score}
              onClick={() => onChange(score)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.03] active:scale-95"
              style={{
                background: isActive ? 'var(--text)' : 'var(--bg-alt)',
                color: isActive ? 'var(--bg)' : 'var(--text-3)',
                border: isActive ? 'none' : '1px solid var(--border)',
              }}
            >
              {score}
            </button>
          );
        })}
      </div>

      {/* Rubric list */}
      <div className="space-y-0.5">
        {factor.rubric.map(r => {
          const isSelected = r.score === value;
          return (
            <button
              key={r.score}
              onClick={() => onChange(r.score)}
              className="w-full text-left flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: isSelected ? 'var(--bg-alt)' : 'transparent' }}
            >
              <span className="text-[10px] font-medium w-3 flex-shrink-0 tabular-nums"
                style={{ color: isSelected ? 'var(--text)' : 'var(--text-3)' }}>
                {r.score}
              </span>
              <span className="text-[10px] font-medium w-16 flex-shrink-0"
                style={{ color: isSelected ? 'var(--text)' : 'var(--text-3)' }}>
                {r.label}
              </span>
              <span className="text-[11px]"
                style={{ color: isSelected ? 'var(--text-2)' : 'var(--text-3)' }}>
                {r.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Source links */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {factor.sources.filter(s => s.url).map(source => (
          <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] font-medium px-3 py-1 rounded-full transition-colors hover:opacity-70"
            style={{ color: 'var(--text-3)', border: '1px solid var(--border)' }}>
            {source.name} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

export default function EntryForm({ entries, date, existingEntry, onSave, onCancel }) {
  const [scores, setScores] = useState(() => {
    if (existingEntry) return { ...existingEntry.scores };
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const lastEntry = sorted[sorted.length - 1];
    if (lastEntry) return { ...lastEntry.scores };
    return FACTORS.reduce((acc, f) => ({ ...acc, [f.id]: 3 }), {});
  });

  const [note, setNote] = useState(existingEntry?.note || '');

  const composite = calculateComposite(scores);
  const verdict = getVerdict(composite);
  const conflictDay = getConflictDay(date);

  const handleSave = () => {
    onSave({ date, scores, note, timestamp: new Date().toISOString() });
  };

  return (
    <div className="animate-in min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div className="max-w-[900px] mx-auto px-6 sm:px-10 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <button onClick={onCancel}
            className="text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-60"
            style={{ color: 'var(--text-2)' }}>
            ← Back
          </button>
          <span className="label-caps-sm">
            {existingEntry ? 'Editing' : 'New Entry'}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-[900px] mx-auto px-6 sm:px-10 pb-4">
        <div className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--text-3)' }}>
          {conflictDay >= 0 ? `Day ${conflictDay} of conflict` : 'Pre-conflict'}
        </div>
        <h2 className="font-syne text-3xl sm:text-4xl font-bold leading-tight tracking-tight" style={{ color: 'var(--text)' }}>
          {formatDateLong(date)}
        </h2>
      </div>

      {/* Sticky composite preview */}
      <div className="sticky top-0 z-20" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[900px] mx-auto px-6 sm:px-10 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-syne text-3xl font-bold tabular-nums" style={{ letterSpacing: '-0.03em', color: 'var(--text)' }}>
              {composite}
            </span>
            <span className="font-mono text-[10px] font-bold px-3 py-1 rounded-full"
              style={{ background: 'var(--bg-alt)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {verdict.label}
            </span>
          </div>
          <button onClick={handleSave}
            className="font-jakarta text-xs font-medium px-5 py-2 rounded-full transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}>
            Save Entry
          </button>
        </div>
      </div>

      {/* Factor inputs */}
      <div className="max-w-[900px] mx-auto px-6 sm:px-10">
        {FACTORS.map(factor => (
          <ScoreSelector
            key={factor.id}
            factor={factor}
            value={scores[factor.id]}
            onChange={(val) => setScores(prev => ({ ...prev, [factor.id]: val }))}
          />
        ))}
      </div>

      {/* Day note */}
      <div className="max-w-[900px] mx-auto px-6 sm:px-10 py-8">
        <span className="label-caps-sm block mb-3">Day Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="1-3 sentences summarising the most significant development..."
          rows={3}
          className="font-jakarta w-full rounded-xl px-5 py-4 text-sm resize-none outline-none transition-colors"
          style={{
            background: 'var(--bg-alt)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            lineHeight: 1.7,
          }}
        />
      </div>

      {/* Bottom actions */}
      <div className="max-w-[900px] mx-auto px-6 sm:px-10 pb-16 flex gap-3">
        <button onClick={handleSave}
          className="font-jakarta flex-1 text-sm font-medium py-3 rounded-full transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}>
          Save Entry
        </button>
        <button onClick={onCancel}
          className="font-jakarta text-sm font-medium py-3 px-8 rounded-full transition-all hover:scale-[1.01]"
          style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
