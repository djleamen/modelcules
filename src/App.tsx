import { useState, useCallback, useMemo } from 'react';
import MoleculeViewer from './components/MoleculeViewer';
import InputForm from './components/InputForm';
import { ChemicalIdentifiers } from './types/molecule';
import { lookupChemicalIdentifiers, getLocalIdentifiers, cleanExpiredCache, validateIdentifier, normalizeIdentifier } from './utils/identifierLookup';
import { useMoleculeHistory } from './hooks/useMoleculeHistory';
import { useFavourites } from './hooks/useFavourites';
import HistoryFavouritesPanel from './components/HistoryFavouritesPanel';

type PanelTab = 'search' | 'history' | 'favourites';

function App() {
  const [identifiers, setIdentifiers] = useState<ChemicalIdentifiers>({
    iupacName: '',
    casNumber: '',
    chemSpider: '',
    echaInfoCard: '',
    ecNumber: '',
    eNumber: '',
    pubchemCID: '',
    rtecsNumber: '',
    unii: '',
    compToxDashboard: '',
    inchi: '',
    smiles: ''
  });

  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<PanelTab>('search');
  const [sourceField, setSourceField] = useState<keyof ChemicalIdentifiers | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSource, setLookupSource] = useState<string | null>(null);

  const { history, addEntry: addHistoryEntry, removeEntry: removeHistoryEntry, clearHistory } = useMoleculeHistory();
  const { favourites, isFavourite, toggleFavourite, clearFavourites } = useFavourites();

  const clearIdentifiers = useCallback(() => {
    setIdentifiers({
      iupacName: '',
      casNumber: '',
      chemSpider: '',
      echaInfoCard: '',
      ecNumber: '',
      eNumber: '',
      pubchemCID: '',
      rtecsNumber: '',
      unii: '',
      compToxDashboard: '',
      inchi: '',
      smiles: ''
    });
    setSourceField(null);
  }, []);

  const performLookup = useCallback(async (field: keyof ChemicalIdentifiers, value: string) => {
    const normalizedValue = normalizeIdentifier(field, value);
    if (!validateIdentifier(field, normalizedValue)) {
      return { error: `Invalid ${field} format. Please check your input.` };
    }

    let foundIdentifiers = getLocalIdentifiers(field, value);
    let source = 'Local Database';

    if (!foundIdentifiers) {
      const result = await lookupChemicalIdentifiers(field, value);
      if (result.success && result.identifiers) {
        foundIdentifiers = result.identifiers;
        source = result.source || 'External Database';
        
        if (result.confidence !== undefined) {
          console.log(`Lookup confidence: ${(result.confidence * 100).toFixed(1)}%`);
        }
      } else {
        return { error: result.error || 'Unknown lookup error' };
      }
    }

    if (foundIdentifiers) {
      console.log(`Successfully populated identifiers from ${source}`);
      return { identifiers: foundIdentifiers, source };
    }
    
    return { error: 'No identifiers found' };
  }, []);

  const handleInputChange = useCallback(async (field: keyof ChemicalIdentifiers, value: string) => {
    setLookupError(null);
    setLookupSource(null);
    
    if (!value.trim()) {
      if (field === sourceField) {
        clearIdentifiers();
      } else {
        setIdentifiers(prev => ({ ...prev, [field]: '' }));
      }
      return;
    }

    setSourceField(field);
    setIdentifiers(prev => ({ ...prev, [field]: value }));

    setIsLookingUp(true);
    try {
      cleanExpiredCache();
      
      const result = await performLookup(field, value);
      
      if (result.error) {
        setLookupError(result.error);
        console.warn('Lookup failed:', result.error);
      } else if (result.identifiers) {
        setLookupSource(result.source || null);
        const merged = { ...identifiers, ...result.identifiers, [field]: value };
        setIdentifiers(prev => ({
          ...prev,
          ...result.identifiers,
          [field]: value
        }));
        addHistoryEntry(merged);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setLookupError(errorMessage);
      console.error('Error looking up identifiers:', error);
    } finally {
      setIsLookingUp(false);
    }
  }, [sourceField, clearIdentifiers, performLookup, addHistoryEntry, identifiers]);

  const restoreEntry = useCallback((restoredIdentifiers: ChemicalIdentifiers) => {
    setIdentifiers(restoredIdentifiers);
    setSourceField(null);
    setLookupError(null);
    setLookupSource(null);
    setActiveTab('search');
  }, []);

  const handleClearAll = useCallback(() => {
    setIdentifiers({
      iupacName: '',
      casNumber: '',
      chemSpider: '',
      echaInfoCard: '',
      ecNumber: '',
      eNumber: '',
      pubchemCID: '',
      rtecsNumber: '',
      unii: '',
      compToxDashboard: '',
      inchi: '',
      smiles: ''
    });
    setSourceField(null);
    setLookupError(null);
    setLookupSource(null);
  }, []);

  // Get the first non-empty identifier for molecule rendering
  const currentMolecule = useMemo(() => {
    const fields: (keyof ChemicalIdentifiers)[] = ['smiles', 'inchi', 'iupacName', 'casNumber', 'pubchemCID'];
    for (const field of fields) {
      if (identifiers[field]) {
        console.log(`Using ${field} for molecule rendering:`, identifiers[field]);
        return { type: field, value: identifiers[field] };
      }
    }
    return null;
  }, [identifiers]);

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Full-screen 3D Viewer */}
      <div className="absolute inset-0">
        <MoleculeViewer molecule={currentMolecule} allIdentifiers={identifiers} />
      </div>

      {/* Header with Title */}
      <div className="absolute top-4 left-4 z-20">
        <h1 className="text-4xl font-bold text-white drop-shadow-lg">Modelcules</h1>
        <p className="text-lg text-white/90 drop-shadow">3D Molecular Visualization</p>
      </div>

      {/* Current Molecule Info - positioned below hamburger menu */}
      {currentMolecule && (
        <div className="absolute top-20 right-4 z-20 bg-black/50 backdrop-blur-sm text-white px-3 py-2 rounded-lg max-w-xs">
          <p className="text-xs">
            <span className="font-medium">{currentMolecule.type}:</span> {currentMolecule.value.substring(0, 25)}
            {currentMolecule.value.length > 25 ? '...' : ''}
          </p>
        </div>
      )}

      {/* Hamburger Menu Button */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute top-4 right-4 z-30 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white p-3 rounded-lg shadow-lg transition-all duration-200"
        aria-label={isPanelOpen ? "Close menu" : "Open menu"}
      >
        <div className="w-6 h-6 flex flex-col justify-center space-y-1">
          <div className={`w-6 h-0.5 bg-white transition-all duration-300 ${isPanelOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-white transition-all duration-300 ${isPanelOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-6 h-0.5 bg-white transition-all duration-300 ${isPanelOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
        </div>
      </button>

      {/* Dropdown Panel */}
      <div className={`absolute top-16 right-4 z-20 w-80 transform transition-all duration-300 ease-in-out origin-top-right ${
        isPanelOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
      }`}>
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-white/20 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            {(['search', 'history', 'favourites'] as PanelTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
                {tab === 'history' && history.length > 0 && (
                  <span className="ml-1 text-gray-400">({history.length})</span>
                )}
                {tab === 'favourites' && favourites.length > 0 && (
                  <span className="ml-1 text-yellow-500">({favourites.length})</span>
                )}
              </button>
            ))}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {activeTab === 'search' && (
              <InputForm
                identifiers={identifiers}
                onInputChange={handleInputChange}
                sourceField={sourceField}
                isLookingUp={isLookingUp}
                onClearAll={handleClearAll}
                lookupError={lookupError}
                lookupSource={lookupSource}
                isFavourite={isFavourite(identifiers)}
                onToggleFavourite={() => toggleFavourite(identifiers)}
              />
            )}
            {activeTab === 'history' && (
              <HistoryFavouritesPanel
                entries={history}
                emptyMessage="No history yet. Search for a molecule to get started."
                onRestore={restoreEntry}
                onRemove={removeHistoryEntry}
                onClearAll={clearHistory}
                isFavourite={isFavourite}
                onToggleFavourite={toggleFavourite}
              />
            )}
            {activeTab === 'favourites' && (
              <HistoryFavouritesPanel
                entries={favourites}
                emptyMessage="No favourites yet. Star a molecule to save it here."
                onRestore={restoreEntry}
                onRemove={(id) => {
                  const entry = favourites.find(e => e.id === id);
                  if (entry) toggleFavourite(entry.identifiers);
                }}
                onClearAll={clearFavourites}
                isFavourite={isFavourite}
                onToggleFavourite={toggleFavourite}
              />
            )}
          </div>
        </div>
      </div>

      {/* Backdrop overlay */}
      {isPanelOpen && (
        <div 
          role="button"
          tabIndex={0}
          className="absolute inset-0 bg-black/10 z-10"
          onClick={() => setIsPanelOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsPanelOpen(false);
            }
          }}
          aria-label="Close menu"
        />
      )}
    </div>
  );
}

export default App;
