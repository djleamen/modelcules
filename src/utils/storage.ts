import { ChemicalIdentifiers, MoleculeEntry } from '../types/molecule';

const HISTORY_KEY = 'modelcules_history';
const FAVOURITES_KEY = 'modelcules_favourites';

export function getDisplayName(identifiers: ChemicalIdentifiers): string {
  return (
    identifiers.iupacName ||
    (identifiers.casNumber ? `CAS: ${identifiers.casNumber}` : '') ||
    (identifiers.pubchemCID ? `PubChem: ${identifiers.pubchemCID}` : '') ||
    (identifiers.smiles ? `SMILES: ${identifiers.smiles.substring(0, 20)}` : '') ||
    (identifiers.inchi ? `InChI: ${identifiers.inchi.substring(0, 20)}` : '') ||
    'Unknown Molecule'
  );
}

export function loadHistory(): MoleculeEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as MoleculeEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: MoleculeEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable or full — silently ignore
  }
}

export function loadFavourites(): MoleculeEntry[] {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY);
    return raw ? (JSON.parse(raw) as MoleculeEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveFavourites(entries: MoleculeEntry[]): void {
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable or full — silently ignore
  }
}

export function getMoleculeKey(identifiers: ChemicalIdentifiers): string {
  return identifiers.smiles || identifiers.inchi || identifiers.casNumber || identifiers.pubchemCID || '';
}
