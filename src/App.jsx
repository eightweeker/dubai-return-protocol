import { useState, useEffect, useCallback } from 'react';
import { loadEntries, saveEntries } from './lib/storage';
import { getTodayStr } from './lib/scoring';
import Overview from './components/Overview';
import EntryForm from './components/EntryForm';

export default function App() {
  const [entries, setEntries] = useState([]);
  const [view, setView] = useState('overview');
  const [editDate, setEditDate] = useState(null);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const updateEntries = useCallback((newEntries) => {
    const sorted = [...newEntries].sort((a, b) => a.date.localeCompare(b.date));
    setEntries(sorted);
    saveEntries(sorted);
  }, []);

  const handleEditDay = useCallback((date) => {
    setEditDate(date || getTodayStr());
    setView('entry');
  }, []);

  const handleSaveEntry = useCallback((entry) => {
    const existing = entries.filter(e => e.date !== entry.date);
    updateEntries([...existing, entry]);
    setView('overview');
  }, [entries, updateEntries]);

  if (view === 'entry') {
    return (
      <EntryForm
        entries={entries}
        date={editDate}
        existingEntry={entries.find(e => e.date === editDate)}
        onSave={handleSaveEntry}
        onCancel={() => setView('overview')}
      />
    );
  }

  return (
    <Overview
      entries={entries}
      onEditDay={handleEditDay}
      onUpdateEntries={updateEntries}
    />
  );
}
