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

  const handleInputChange = useCallback(async (field: keyof ChemicalIdentifiers, value: string) => {
    // Clear any previous errors
    setLookupError(null);
    setLookupSource(null);
    
    // If the field is being cleared, clear all fields and reset source
    if (!value.trim()) {
      if (field === sourceField) {
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
      } else {
        // User is clearing a non-source field, just clear that field
        setIdentifiers(prev => ({
          ...prev,
          [field]: ''
        }));
      }
      return;
    }

    // Set the source field and update the identifier
    setSourceField(field);
    setIdentifiers(prev => ({
      ...prev,
      [field]: value
    }));

    // Try to auto-populate other fields with enhanced lookup
    setIsLookingUp(true);
    try {
      // Clean expired cache entries before lookup
      cleanExpiredCache();
      
      // Early validation - check if input looks reasonable
      const normalizedValue = normalizeIdentifier(field, value);
      if (!validateIdentifier(field, normalizedValue)) {
        setLookupError(`Invalid ${field} format. Please check your input.`);
        setIsLookingUp(false);
        return;
      }
      
      // First try local lookup for common compounds (fastest)
      let foundIdentifiers = getLocalIdentifiers(field, value);
      let source = 'Local Database';
      
      // If not found locally, try comprehensive API lookup
      if (!foundIdentifiers) {
        const result = await lookupChemicalIdentifiers(field, value);
        if (result.success && result.identifiers) {
          foundIdentifiers = result.identifiers;
          source = result.source || 'External Database';
          
          // Log confidence score for debugging
          if (result.confidence !== undefined) {
            console.log(`Lookup confidence: ${(result.confidence * 100).toFixed(1)}%`);
          }
        } else {
          // Set error message from enhanced lookup
          setLookupError(result.error || 'Unknown lookup error');
          console.warn('Lookup failed:', result.error);
        }
      }

      if (foundIdentifiers) {
        setLookupSource(source);
        setIdentifiers(prev => ({
          ...prev,
          ...foundIdentifiers,
          [field]: value // Keep the original input value for the source field
        }));
        
        console.log(`Successfully populated identifiers from ${source}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setLookupError(errorMessage);
      console.error('Error looking up identifiers:', error);
    } finally {
      setIsLookingUp(false);
    }
  }, [sourceField]);

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
          className="absolute inset-0 bg-black/10 z-10"
          onClick={() => setIsPanelOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
