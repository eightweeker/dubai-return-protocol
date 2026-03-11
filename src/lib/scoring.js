import { FACTORS, TOTAL_WEIGHT, VERDICTS, CONFLICT_START } from './constants';

export function calculateComposite(scores) {
  let weightedSum = 0;
  for (const factor of FACTORS) {
    const score = scores[factor.id] || 1;
    weightedSum += ((score - 1) / 4) * factor.weight;
  }
  return Math.round((weightedSum / TOTAL_WEIGHT) * 100);
}

export function getVerdict(composite) {
  for (const v of VERDICTS) {
    if (composite >= v.min && composite <= v.max) return v;
  }
  return VERDICTS[VERDICTS.length - 1];
}

export function getConflictDay(dateStr) {
  const start = new Date(CONFLICT_START);
  const current = new Date(dateStr);
  const diff = Math.floor((current - start) / (1000 * 60 * 60 * 24));
  return diff;
}

export function getDayOfWeek(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function getTodayStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export function checkReturnReadiness(entries) {
  if (entries.length === 0) return { uptrend: false, above65: false, exitOk: false, healthcareOk: false, consecutiveDays: 0 };

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const latestComposite = calculateComposite(latest.scores);
  const latestVerdict = getVerdict(latestComposite);

  // Check 3+ consecutive days of upward trend
  let consecutiveUp = 0;
  for (let i = sorted.length - 1; i >= 1; i--) {
    const curr = calculateComposite(sorted[i].scores);
    const prev = calculateComposite(sorted[i - 1].scores);
    if (curr > prev) {
      consecutiveUp++;
    } else {
      break;
    }
  }

  // Check composite above 65
  const above65 = latestComposite >= 65;

  // Check Exit Viability >= 4
  const exitOk = (latest.scores.exit || 0) >= 4;

  // Check Healthcare >= 4
  const healthcareOk = (latest.scores.healthcare || 0) >= 4;

  return {
    uptrend: consecutiveUp >= 3,
    consecutiveDays: consecutiveUp,
    above65,
    exitOk,
    healthcareOk,
    composite: latestComposite,
    verdict: latestVerdict,
  };
}

export function calculate7DayAverage(entries, index) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const start = Math.max(0, index - 6);
  const slice = sorted.slice(start, index + 1);
  if (slice.length === 0) return 0;
  const sum = slice.reduce((acc, e) => acc + calculateComposite(e.scores), 0);
  return Math.round(sum / slice.length);
}
