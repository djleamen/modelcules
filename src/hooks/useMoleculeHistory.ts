import { useState, useCallback } from 'react';
import { ChemicalIdentifiers, MoleculeEntry } from '../types/molecule';
import { loadHistory, saveHistory, getDisplayName, getMoleculeKey } from '../utils/storage';

const MAX_HISTORY = 50;

export function useMoleculeHistory() {
  const [history, setHistory] = useState<MoleculeEntry[]>(() => loadHistory());

  const addEntry = useCallback((identifiers: ChemicalIdentifiers) => {
    const key = getMoleculeKey(identifiers);
    const entry: MoleculeEntry = {
      id: key || crypto.randomUUID(),
      displayName: getDisplayName(identifiers),
      identifiers,
      timestamp: Date.now(),
    };

    setHistory(prev => {
      // Remove duplicate (same key) if it exists
      const filtered = key
        ? prev.filter(e => getMoleculeKey(e.identifiers) !== key)
        : prev;
      const next = [entry, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setHistory(prev => {
      const next = prev.filter(e => e.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, addEntry, removeEntry, clearHistory };
}
