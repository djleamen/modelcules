import { useState, useCallback, useMemo } from 'react';
import MoleculeViewer from './components/MoleculeViewer';
import InputForm from './components/InputForm';
import { ChemicalIdentifiers } from './types/molecule';
import { lookupChemicalIdentifiers, getLocalIdentifiers, cleanExpiredCache, validateIdentifier, normalizeIdentifier } from './utils/identifierLookup';

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
  const [sourceField, setSourceField] = useState<keyof ChemicalIdentifiers | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSource, setLookupSource] = useState<string | null>(null);

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
        setIdentifiers(prev => ({
          ...prev,
          ...result.identifiers,
          [field]: value
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setLookupError(errorMessage);
      console.error('Error looking up identifiers:', error);
    } finally {
      setIsLookingUp(false);
    }
  }, [sourceField, clearIdentifiers, performLookup]);

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
      <div className={`absolute top-16 right-4 z-20 w-80 max-h-96 transform transition-all duration-300 ease-in-out origin-top-right ${
        isPanelOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
      }`}>
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-white/20 overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <InputForm 
              identifiers={identifiers}
              onInputChange={handleInputChange}
              sourceField={sourceField}
              isLookingUp={isLookingUp}
              onClearAll={handleClearAll}
              lookupError={lookupError}
              lookupSource={lookupSource}
            />
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
