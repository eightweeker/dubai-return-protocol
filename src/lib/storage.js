import { BASELINE_DATA } from './constants';

const STORAGE_KEY = 'dubai-return-protocol-entries';

export function loadEntries() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge any new baseline entries that aren't in localStorage yet
        const existingDates = new Set(parsed.map((e) => e.date));
        const newEntries = BASELINE_DATA.filter((e) => !existingDates.has(e.date));
        if (newEntries.length > 0) {
          const merged = [...parsed, ...newEntries];
          saveEntries(merged);
          return merged.sort((a, b) => a.date.localeCompare(b.date));
        }
        return parsed.sort((a, b) => a.date.localeCompare(b.date));
      }
    }
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
  }
  // Seed with baseline data
  saveEntries(BASELINE_DATA);
  return [...BASELINE_DATA].sort((a, b) => a.date.localeCompare(b.date));
}

export function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

export function exportJSON(entries) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dubai-protocol-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          resolve(data);
        } else {
          reject(new Error('Invalid format: expected array'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
