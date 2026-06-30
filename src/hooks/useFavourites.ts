import { useState, useCallback } from 'react';
import { ChemicalIdentifiers, MoleculeEntry } from '../types/molecule';
import { loadFavourites, saveFavourites, getDisplayName, getMoleculeKey } from '../utils/storage';

export function useFavourites() {
  const [favourites, setFavourites] = useState<MoleculeEntry[]>(() => loadFavourites());

  const isFavourite = useCallback(
    (identifiers: ChemicalIdentifiers): boolean => {
      const key = getMoleculeKey(identifiers);
      if (!key) return false;
      return favourites.some(e => getMoleculeKey(e.identifiers) === key);
    },
    [favourites]
  );

  const toggleFavourite = useCallback((identifiers: ChemicalIdentifiers) => {
    const key = getMoleculeKey(identifiers);
    // Refuse to toggle when there's no stable key — we'd have no way to unstar it
    if (!key) return;
    setFavourites(prev => {
      let next: MoleculeEntry[];
      if (prev.some(e => getMoleculeKey(e.identifiers) === key)) {
        next = prev.filter(e => getMoleculeKey(e.identifiers) !== key);
      } else {
        const entry: MoleculeEntry = {
          id: key,
          displayName: getDisplayName(identifiers),
          identifiers,
          timestamp: Date.now(),
        };
        next = [entry, ...prev];
      }
      saveFavourites(next);
      return next;
    });
  }, []);

  const clearFavourites = useCallback(() => {
    setFavourites([]);
    saveFavourites([]);
  }, []);

  return { favourites, isFavourite, toggleFavourite, clearFavourites };
}
