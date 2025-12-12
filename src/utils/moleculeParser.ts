import { ChemicalIdentifiers, Molecule3D, Atom, Bond } from '../types/molecule';

// Multi-format molecule parser with support for various chemical identifiers
// This is a simplified implementation - in production you'd want to use RDKit or similar
export async function parseMolecule(
  type: keyof ChemicalIdentifiers,
  value: string,
  allIdentifiers?: Partial<ChemicalIdentifiers>
): Promise<Molecule3D> {
  const cleanValue = value.trim();
  
  if (!cleanValue) {
    throw new Error('Empty identifier provided');
  }

  try {
    switch (type) {
      case 'smiles':
        return parseSMILES(cleanValue);
      
      case 'iupacName':
        return await parseIUPACName(cleanValue, allIdentifiers);
      
      case 'casNumber':
        return parseCASNumber(cleanValue, allIdentifiers);
      
      case 'pubchemCID':
        return parsePubChemCID(cleanValue, allIdentifiers);
      
      case 'inchi':
        return parseInChI(cleanValue);
      
      case 'chemSpider':
        return parseChemSpiderID(cleanValue, allIdentifiers);
      
      case 'unii':
        return parseUNII(cleanValue, allIdentifiers);
      
      case 'ecNumber':
      case 'eNumber':
      case 'echaInfoCard':
      case 'rtecsNumber':
      case 'compToxDashboard':
        return parseOtherIdentifiers(type, cleanValue, allIdentifiers);
      
      default:
        throw new Error(`Parsing for ${type} is not yet implemented`);
    }
  } catch (error) {
    // If primary parsing fails, try fallback using SMILES if available
    if (allIdentifiers?.smiles && type !== 'smiles') {
      console.warn(`Primary parsing failed for ${type}, falling back to SMILES:`, error);
      return parseSMILES(allIdentifiers.smiles);
    }
    throw error;
  }
}

// Helper function for partial name matching
function tryPartialMatches(lowerName: string): Molecule3D | null {
  if (lowerName.includes('methyl') && lowerName.includes('benzene')) {
    return createToluene();
  }
  if (lowerName.includes('alcohol') || lowerName.includes('ol')) {
    return createEthanol(); // Default alcohol
  }
  if (lowerName.includes('acid')) {
    return createAceticAcid(); // Default acid
  }
  return null;
}

// Helper function for alkene pattern matching
function tryMatchAlkene(lowerName: string): Molecule3D | null {
  if (!lowerName.includes('ene')) return null;
  
  if (lowerName.includes('hex')) return createHexene();
  if (lowerName.includes('but')) return createButene();
  if (lowerName.includes('prop')) return createPropene();
  if (lowerName.includes('eth')) return createEthene();
  return createEthene(); // Default alkene
}

// Helper function for alkane pattern matching
function tryMatchAlkane(lowerName: string): Molecule3D | null {
  if (!lowerName.includes('ane')) return null;
  
  if (lowerName.includes('hex')) return createHexane();
  if (lowerName.includes('pent')) return createPentane();
  if (lowerName.includes('but')) return createButane();
  if (lowerName.includes('prop')) return createPropane();
  if (lowerName.includes('eth')) return createEthane();
  if (lowerName.includes('meth')) return createMethane();
  return null;
}

// IUPAC Name parser - converts common IUPAC names to 3D structures
async function parseIUPACName(iupacName: string, _allIdentifiers?: Partial<ChemicalIdentifiers>): Promise<Molecule3D> {
  const lowerName = iupacName.toLowerCase().trim();
  
  const nameToMolecule: { [key: string]: () => Molecule3D } = {
    // Basic alkanes
    'methane': createMethane,
    'ethane': createEthane,
    'propane': createPropane,
    'butane': createButane,
    'pentane': createPentane,
    'hexane': createHexane,
    
    // Alkenes
    'ethene': createEthene,
    'ethylene': createEthene,
    'propene': createPropene,
    'propylene': createPropene,
    '1-butene': createButene,
    '2-butene': createButene,
    'butene': createButene,
    '1-hexene': createHexene,
    '2-hexene': createHexene,
    'hexene': createHexene,
    
    // Branched alkanes
    'isobutane': createIsobutane,
    '2-methylpropane': createIsobutane,
    'isopentane': createIsopentane,
    '2-methylbutane': createIsopentane,
    
    // Alcohols
    'methanol': createMethanol,
    'ethanol': createEthanol,
    'propanol': createPropanol,
    '1-propanol': createPropanol,
    '2-propanol': createIsopropanol,
    'isopropanol': createIsopropanol,
    
    // Aromatic compounds
    'benzene': createBenzene,
    'toluene': createToluene,
    'methylbenzene': createToluene,
    'xylene': createXylene,
    '1,2-dimethylbenzene': createXylene,
    
    // Acids
    'acetic acid': createAceticAcid,
    'ethanoic acid': createAceticAcid,
    'formic acid': createFormicAcid,
    'methanoic acid': createFormicAcid,
    
    // Simple inorganics
    'water': createWater,
    'carbon dioxide': createCarbonDioxide,
    'ammonia': createAmmonia,
    'hydrogen': createHydrogen,
    'oxygen': createOxygen,
    'nitrogen': createNitrogen,
  };

  const moleculeBuilder = nameToMolecule[lowerName];
  if (moleculeBuilder) {
    return moleculeBuilder();
  }

  // Try to get SMILES from PubChem for complex molecules
  try {
    const smiles = await getSmikesFromIUPAC(iupacName);
    if (smiles) {
      return parseSMILES(smiles);
    }
  } catch (error) {
    console.warn('Failed to lookup SMILES from PubChem:', error);
  }

  // Try partial matches for common patterns
  const partialMatch = tryPartialMatches(lowerName);
  if (partialMatch) return partialMatch;
  
  // Pattern matching for alkenes
  const alkeneMatch = tryMatchAlkene(lowerName);
  if (alkeneMatch) return alkeneMatch;
  
  // Pattern matching for alkanes
  const alkaneMatch = tryMatchAlkane(lowerName);
  if (alkaneMatch) return alkaneMatch;

  // For very complex molecules, return a placeholder
  if (lowerName.length > 20 || lowerName.includes('lambda') || lowerName.includes('phosphane')) {
    return createComplexMoleculePlaceholder();
  }

  throw new Error(`Unable to parse molecule "${iupacName}". Please check the spelling or try a different identifier type (SMILES, CAS number, etc.).`);
}

// Helper function to get SMILES from IUPAC name using PubChem
async function getSmikesFromIUPAC(iupacName: string): Promise<string | null> {
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(iupacName)}/property/CanonicalSMILES/JSON`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.PropertyTable?.Properties?.[0]?.CanonicalSMILES || null;
  } catch (error) {
    console.error('Error fetching SMILES from PubChem:', error);
    return null;
  }
}

// CAS Number parser - maps known CAS numbers to structures
function parseCASNumber(casNumber: string, _allIdentifiers?: Partial<ChemicalIdentifiers>): Molecule3D {
  const cleanCAS = casNumber.replaceAll(' ', '');
  
  const casToMolecule: { [key: string]: () => Molecule3D } = {
    // Common molecules with their CAS numbers
    '74-82-8': createMethane,      // Methane
    '74-84-0': createEthane,       // Ethane
    '74-98-6': createPropane,      // Propane
    '106-97-8': createButane,      // Butane
    '75-28-5': createIsobutane,    // Isobutane
    '64-17-5': createEthanol,      // Ethanol
    '67-56-1': createMethanol,     // Methanol
    '71-43-2': createBenzene,      // Benzene
    '108-88-3': createToluene,     // Toluene
    '64-19-7': createAceticAcid,   // Acetic acid
    '7732-18-5': createWater,      // Water
    '124-38-9': createCarbonDioxide, // Carbon dioxide
    '7664-41-7': createAmmonia,    // Ammonia
    '1333-74-0': createHydrogen,   // Hydrogen
    '7782-44-7': createOxygen,     // Oxygen
    '7727-37-9': createNitrogen,   // Nitrogen
  };

  const moleculeBuilder = casToMolecule[cleanCAS];
  if (moleculeBuilder) {
    return moleculeBuilder();
  }

  throw new Error(`Unknown CAS number: ${casNumber}`);
}

// PubChem CID parser - maps compound IDs to structures
function parsePubChemCID(cid: string, allIdentifiers?: Partial<ChemicalIdentifiers>): Molecule3D {
  const cleanCID = cid.trim();
  
  const cidToMolecule: { [key: string]: () => Molecule3D } = {
    '280': createCarbonDioxide,   // CO2
    '962': createWater,           // H2O
    '6344': createIsobutane,      // Isobutane (2-methylpropane)
    '702': createEthanol,         // Ethanol
    '887': createMethanol,        // Methanol
    '241': createBenzene,         // Benzene
    '1140': createToluene,        // Toluene
    '176': createAceticAcid,      // Acetic acid
    '297': createMethane,         // Methane
    '6324': createEthane,         // Ethane
    '6334': createPropane,        // Propane
    '7843': createButane,         // Butane
    '222': createAmmonia,         // Ammonia
    '284': createFormicAcid,      // Formic acid
    '5793': createGlucose,        // D-glucose
    '2519': createCaffeine,       // Caffeine
    '2244': createAspirin,        // Aspirin
    '634': createRibose,          // D-ribose (CID 634)
  };

  const moleculeBuilder = cidToMolecule[cleanCID];
  if (moleculeBuilder) {
    return moleculeBuilder();
  }

  // If CID not found, try using SMILES from allIdentifiers
  if (allIdentifiers?.smiles) {
    console.log(`Unknown CID ${cid}, falling back to SMILES: ${allIdentifiers.smiles}`);
    return parseSMILES(allIdentifiers.smiles);
  }

  // If no SMILES available, try using InChI
  if (allIdentifiers?.inchi) {
    console.log(`Unknown CID ${cid}, falling back to InChI: ${allIdentifiers.inchi}`);
    return parseInChI(allIdentifiers.inchi);
  }

  throw new Error(`Unknown PubChem CID: ${cid}. No SMILES or InChI available for fallback.`);
}

// InChI parser - basic InChI string parsing
function parseInChI(inchi: string): Molecule3D {
  const cleanInChI = inchi.trim();
  
  // Simple InChI patterns for common molecules
  const inchiPatterns: { [key: string]: () => Molecule3D } = {
    'InChI=1S/CH4/h1H4': createMethane,
    'InChI=1S/C2H6/c1-2/h1-2H3': createEthane,
    'InChI=1S/C3H8/c1-2-3/h2H2,1,3H3': createPropane,
    'InChI=1S/C4H10/c1-3-4-2/h3-4H2,1-2H3': createButane,
    'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3': createEthanol,
    'InChI=1S/CH4O/c1-2/h2H,1H3': createMethanol,
    'InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H': createBenzene,
    'InChI=1S/H2O/h1H2': createWater,
    'InChI=1S/CO2/c2-1-3': createCarbonDioxide,
    'InChI=1S/H3N/h1H3': createAmmonia,
  };

  const moleculeBuilder = inchiPatterns[cleanInChI];
  if (moleculeBuilder) {
    return moleculeBuilder();
  }

  // Try to parse molecular formula from InChI
  const formulaRegex = /InChI=1S\/([^/]+)/;
  const formulaMatch = formulaRegex.exec(cleanInChI);
  if (formulaMatch) {
    const formula = formulaMatch[1];
    return parseByFormula(formula);
  }

  throw new Error(`Cannot parse InChI: ${inchi}`);
}

// ChemSpider ID parser
function parseChemSpiderID(chemSpiderID: string, _allIdentifiers?: Partial<ChemicalIdentifiers>): Molecule3D {
  const cleanID = chemSpiderID.trim();
  
  const chemSpiderToMolecule: { [key: string]: () => Molecule3D } = {
    '6091': createMethane,        // Methane
    '6089': createEthane,         // Ethane  
    '6095': createPropane,        // Propane
    '6309': createIsobutane,      // Isobutane
    '682': createEthanol,         // Ethanol
    '864': createMethanol,        // Methanol
    '236': createBenzene,         // Benzene
    '1108': createToluene,        // Toluene
    '171': createAceticAcid,      // Acetic acid
    '937': createWater,           // Water
    '274': createCarbonDioxide,   // Carbon dioxide
    '217': createAmmonia,         // Ammonia
  };

  const moleculeBuilder = chemSpiderToMolecule[cleanID];
  if (moleculeBuilder) {
    return moleculeBuilder();
  }

  throw new Error(`Unknown ChemSpider ID: ${chemSpiderID}`);
}

// UNII parser
function parseUNII(unii: string, _allIdentifiers?: Partial<ChemicalIdentifiers>): Molecule3D {
  const cleanUNII = unii.trim().toUpperCase();
  
  const uniiToMolecule: { [key: string]: () => Molecule3D } = {
    'OP0UW79H66': createMethane,        // Methane
    'L99N5N533T': createEthane,         // Ethane
    'T75W9KEF2D': createPropane,        // Propane
    'BF27H04Q8B': createIsobutane,      // Isobutane
    '3K9958V90M': createEthanol,        // Ethanol
    'Y4S76JWI15': createMethanol,       // Methanol
    'J64922108F': createBenzene,        // Benzene
    '3FPU23BG52': createToluene,        // Toluene
    'Q40Q9N063P': createAceticAcid,     // Acetic acid
    '059QF0KO0R': createWater,          // Water
    '142M471B3J': createCarbonDioxide,  // Carbon dioxide
    '5138Q19F1X': createAmmonia,        // Ammonia
  };

  const moleculeBuilder = uniiToMolecule[cleanUNII];
  if (moleculeBuilder) {
    return moleculeBuilder();
  }

  throw new Error(`Unknown UNII: ${unii}`);
}

// Parser for other identifier types
function parseOtherIdentifiers(type: keyof ChemicalIdentifiers, value: string, _allIdentifiers?: Partial<ChemicalIdentifiers>): Molecule3D {
  // For demonstration, we'll map some common values for each identifier type
  
  if (type === 'ecNumber') {
    const ecToMolecule: { [key: string]: () => Molecule3D } = {
      '200-812-7': createMethane,
      '200-816-9': createEthane,
      '200-827-9': createPropane,
      '200-857-2': createIsobutane,
      '200-578-6': createEthanol,
      '200-659-6': createMethanol,
      '200-753-7': createBenzene,
    };
    
    const builder = ecToMolecule[value.trim()];
    if (builder) return builder();
  }
  
  if (type === 'eNumber') {
    const eToMolecule: { [key: string]: () => Molecule3D } = {
      'E290': createCarbonDioxide,
      'E948': createOxygen,
      'E941': createNitrogen,
    };
    
    const builder = eToMolecule[value.trim().toUpperCase()];
    if (builder) return builder();
  }

  // For other types, return a default molecule
  console.warn(`Limited support for ${type}, returning default molecule`);
  return createMethane();
}

// Helper function to parse by molecular formula
function parseByFormula(formula: string): Molecule3D {
  const formulaToMolecule: { [key: string]: () => Molecule3D } = {
    'CH4': createMethane,
    'C2H6': createEthane,
    'C3H8': createPropane,
    'C4H10': createButane,
    'C2H6O': createEthanol,
    'CH4O': createMethanol,
    'C6H6': createBenzene,
    'C7H8': createToluene,
    'C2H4O2': createAceticAcid,
    'H2O': createWater,
    'CO2': createCarbonDioxide,
    'NH3': createAmmonia,
    'H2': createHydrogen,
    'O2': createOxygen,
    'N2': createNitrogen,
  };

  const moleculeBuilder = formulaToMolecule[formula];
  if (moleculeBuilder) {
    return moleculeBuilder();
  }

  // Default fallback
  return createMethane();
}

// Very simplified SMILES parser for demonstration
function parseSMILES(smiles: string): Molecule3D {
  // Clean the SMILES string - preserve case for complex molecules
  const cleanSmiles = smiles.trim();
  
  // Simple patterns for common molecules
  const patterns: { [key: string]: Molecule3D } = {
    'CCO': createEthanol(),
    'C1CCCCC1': createBenzene(),
    'CC(=O)O': createAceticAcid(),
    'C(=O)O': createFormicAcid(),
    'O=C=O': createCarbonDioxide(),
    'O': createWater(),
    'CC': createEthane(),
    'CCC': createPropane(),
    'CCCC': createButane(),
    'C(C)(C)C': createIsobutane(),
    'CC(C)CC': createIsopentane(),
    'CO': createMethanol(),
    'CCL4': createCarbonTetrachloride(),
    'N': createAmmonia(),
    'C': createMethane(),
    // Complex molecules
    'CN1C=NC2=C1C(=O)N(C(=O)N2C)C': createCaffeineFromSMILES(),
    'CC(=O)OC1=CC=CC=C1C(=O)O': createAspirinFromSMILES(),
    'C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O': createGlucoseFromSMILES(),
  };

  // Check for exact matches first (case-sensitive for complex molecules)
  if (patterns[cleanSmiles]) {
    return patterns[cleanSmiles];
  }
  
  // Try uppercase patterns for simple molecules
  const upperSmiles = cleanSmiles.toUpperCase();
  if (patterns[upperSmiles]) {
    return patterns[upperSmiles];
  }

  // If no pattern match, try to parse simple alkanes
  if (/^C+$/i.test(cleanSmiles)) {
    return createSimpleAlkane(cleanSmiles.length);
  }

  // Default fallback - create a simple methane molecule
  return createMethane();
}

// Helper functions to create 3D coordinates for common molecules

function createMethane(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'H', x: 1.09, y: 0, z: 0 },
      { id: 2, element: 'H', x: -0.36, y: 1.03, z: 0 },
      { id: 3, element: 'H', x: -0.36, y: -0.51, z: 0.89 },
      { id: 4, element: 'H', x: -0.36, y: -0.51, z: -0.89 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
    ]
  };
}

function createEthanol(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: -1.2, y: 0, z: 0 },
      { id: 1, element: 'C', x: 0, y: 0, z: 0 },
      { id: 2, element: 'O', x: 1.4, y: 0, z: 0 },
      { id: 3, element: 'H', x: -1.6, y: 1.03, z: 0 },
      { id: 4, element: 'H', x: -1.6, y: -0.51, z: 0.89 },
      { id: 5, element: 'H', x: -1.6, y: -0.51, z: -0.89 },
      { id: 6, element: 'H', x: 0, y: 1.03, z: 0 },
      { id: 7, element: 'H', x: 0, y: -0.51, z: 0.89 },
      { id: 8, element: 'H', x: 1.8, y: 0, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 8, bondType: 1 },
    ]
  };
}

function createBenzene(): Molecule3D {
  const radius = 1.4;
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];

  // Create hexagonal ring
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    // Add carbon and hydrogen atoms together
    atoms.push(
      {
        id: i,
        element: 'C',
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        z: 0
      },
      {
        id: i + 6,
        element: 'H',
        x: (radius + 1.1) * Math.cos(angle),
        y: (radius + 1.1) * Math.sin(angle),
        z: 0
      }
    );

    // Add C-H bond and C-C bond together
    const nextCarbon = (i + 1) % 6;
    bonds.push(
      { atomIndex1: i, atomIndex2: i + 6, bondType: 1 },
      { atomIndex1: i, atomIndex2: nextCarbon, bondType: i % 2 === 0 ? 2 : 1 }
    );
  }

  return { atoms, bonds };
}

function createAceticAcid(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: -1.3, y: 0, z: 0 },
      { id: 1, element: 'C', x: 0, y: 0, z: 0 },
      { id: 2, element: 'O', x: 0.7, y: 1.1, z: 0 },
      { id: 3, element: 'O', x: 0.7, y: -1.1, z: 0 },
      { id: 4, element: 'H', x: -1.7, y: 1.03, z: 0 },
      { id: 5, element: 'H', x: -1.7, y: -0.51, z: 0.89 },
      { id: 6, element: 'H', x: -1.7, y: -0.51, z: -0.89 },
      { id: 7, element: 'H', x: 1.6, y: -1.1, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 2 },
      { atomIndex1: 1, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 7, bondType: 1 },
    ]
  };
}

function createCarbonDioxide(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'O', x: -1.2, y: 0, z: 0 },
      { id: 1, element: 'C', x: 0, y: 0, z: 0 },
      { id: 2, element: 'O', x: 1.2, y: 0, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 2 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 2 },
    ]
  };
}

function createWater(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'O', x: 0, y: 0, z: 0 },
      { id: 1, element: 'H', x: 0.96, y: 0, z: 0 },
      { id: 2, element: 'H', x: -0.24, y: 0.93, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
    ]
  };
}

function createEthane(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: -0.75, y: 0, z: 0 },
      { id: 1, element: 'C', x: 0.75, y: 0, z: 0 },
      { id: 2, element: 'H', x: -1.15, y: 1.03, z: 0 },
      { id: 3, element: 'H', x: -1.15, y: -0.51, z: 0.89 },
      { id: 4, element: 'H', x: -1.15, y: -0.51, z: -0.89 },
      { id: 5, element: 'H', x: 1.15, y: 1.03, z: 0 },
      { id: 6, element: 'H', x: 1.15, y: -0.51, z: 0.89 },
      { id: 7, element: 'H', x: 1.15, y: -0.51, z: -0.89 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
    ]
  };
}

function createPropane(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: -1.5, y: 0, z: 0 },
      { id: 1, element: 'C', x: 0, y: 0, z: 0 },
      { id: 2, element: 'C', x: 1.5, y: 0, z: 0 },
      { id: 3, element: 'H', x: -1.9, y: 1.03, z: 0 },
      { id: 4, element: 'H', x: -1.9, y: -0.51, z: 0.89 },
      { id: 5, element: 'H', x: -1.9, y: -0.51, z: -0.89 },
      { id: 6, element: 'H', x: 0, y: 1.03, z: 0 },
      { id: 7, element: 'H', x: 0, y: -0.51, z: 0.89 },
      { id: 8, element: 'H', x: 1.9, y: 1.03, z: 0 },
      { id: 9, element: 'H', x: 1.9, y: -0.51, z: 0.89 },
      { id: 10, element: 'H', x: 1.9, y: -0.51, z: -0.89 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 10, bondType: 1 },
    ]
  };
}

function createButane(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: -2.25, y: 0, z: 0 },
      { id: 1, element: 'C', x: -0.75, y: 0, z: 0 },
      { id: 2, element: 'C', x: 0.75, y: 0, z: 0 },
      { id: 3, element: 'C', x: 2.25, y: 0, z: 0 },
      { id: 4, element: 'H', x: -2.65, y: 1.03, z: 0 },
      { id: 5, element: 'H', x: -2.65, y: -0.51, z: 0.89 },
      { id: 6, element: 'H', x: -2.65, y: -0.51, z: -0.89 },
      { id: 7, element: 'H', x: -0.75, y: 1.03, z: 0 },
      { id: 8, element: 'H', x: -0.75, y: -0.51, z: 0.89 },
      { id: 9, element: 'H', x: 0.75, y: 1.03, z: 0 },
      { id: 10, element: 'H', x: 0.75, y: -0.51, z: 0.89 },
      { id: 11, element: 'H', x: 2.65, y: 1.03, z: 0 },
      { id: 12, element: 'H', x: 2.65, y: -0.51, z: 0.89 },
      { id: 13, element: 'H', x: 2.65, y: -0.51, z: -0.89 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 10, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 11, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 12, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 13, bondType: 1 },
    ]
  };
}

function createIsobutane(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'C', x: 1.5, y: 0, z: 0 },
      { id: 2, element: 'C', x: -0.75, y: 1.3, z: 0 },
      { id: 3, element: 'C', x: -0.75, y: -1.3, z: 0 },
      { id: 4, element: 'H', x: 0, y: 0, z: 1.09 },
      { id: 5, element: 'H', x: 1.9, y: 1.03, z: 0 },
      { id: 6, element: 'H', x: 1.9, y: -0.51, z: 0.89 },
      { id: 7, element: 'H', x: 1.9, y: -0.51, z: -0.89 },
      { id: 8, element: 'H', x: -1.15, y: 1.73, z: 0.89 },
      { id: 9, element: 'H', x: -1.15, y: 1.73, z: -0.89 },
      { id: 10, element: 'H', x: -0.35, y: 2.33, z: 0 },
      { id: 11, element: 'H', x: -1.15, y: -1.73, z: 0.89 },
      { id: 12, element: 'H', x: -1.15, y: -1.73, z: -0.89 },
      { id: 13, element: 'H', x: -0.35, y: -2.33, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 10, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 11, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 12, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 13, bondType: 1 },
    ]
  };
}

function createMethanol(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'O', x: 1.4, y: 0, z: 0 },
      { id: 2, element: 'H', x: -0.36, y: 1.03, z: 0 },
      { id: 3, element: 'H', x: -0.36, y: -0.51, z: 0.89 },
      { id: 4, element: 'H', x: -0.36, y: -0.51, z: -0.89 },
      { id: 5, element: 'H', x: 1.8, y: 0, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 5, bondType: 1 },
    ]
  };
}

function createCarbonTetrachloride(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'Cl', x: 1.8, y: 0, z: 0 },
      { id: 2, element: 'Cl', x: -0.6, y: 1.7, z: 0 },
      { id: 3, element: 'Cl', x: -0.6, y: -0.85, z: 1.47 },
      { id: 4, element: 'Cl', x: -0.6, y: -0.85, z: -1.47 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
    ]
  };
}

function createAmmonia(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'N', x: 0, y: 0, z: 0 },
      { id: 1, element: 'H', x: 1.01, y: 0, z: 0 },
      { id: 2, element: 'H', x: -0.33, y: 0.94, z: 0 },
      { id: 3, element: 'H', x: -0.33, y: -0.47, z: 0.82 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
    ]
  };
}

function createSimpleAlkane(length: number): Molecule3D {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  
  // Create carbon chain
  for (let i = 0; i < length; i++) {
    atoms.push({
      id: i,
      element: 'C',
      x: i * 1.5,
      y: 0,
      z: 0
    });
    
    if (i > 0) {
      bonds.push({ atomIndex1: i - 1, atomIndex2: i, bondType: 1 });
    }
  }
  
  // Add hydrogens
  let hydrogenId = length;
  for (let i = 0; i < length; i++) {
    const numHydrogens = (i === 0 || i === length - 1) ? 3 : 2;
    
    for (let j = 0; j < numHydrogens; j++) {
      const angle = (j * 2 * Math.PI) / numHydrogens;
      atoms.push({
        id: hydrogenId,
        element: 'H',
        x: i * 1.5 + 1.1 * Math.cos(angle),
        y: 1.1 * Math.sin(angle),
        z: 0
      });
      
      bonds.push({ atomIndex1: i, atomIndex2: hydrogenId, bondType: 1 });
    }
  }
  
  return { atoms, bonds };
}

// Additional molecule creation functions for expanded parser support

function createPentane(): Molecule3D {
  return createSimpleAlkane(5);
}

function createHexane(): Molecule3D {
  return createSimpleAlkane(6);
}

function createIsopentane(): Molecule3D {
  // 2-methylbutane structure
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },       // Central carbon
      { id: 1, element: 'C', x: 1.5, y: 0, z: 0 },     // C2
      { id: 2, element: 'C', x: 3, y: 0, z: 0 },     // C3
      { id: 3, element: 'C', x: 4.5, y: 0, z: 0 },     // C4
      { id: 4, element: 'C', x: 1.5, y: 1.5, z: 0 },   // Methyl branch
      // Hydrogens for C1
      { id: 5, element: 'H', x: -0.5, y: 0.5, z: 0.5 },
      { id: 6, element: 'H', x: -0.5, y: -0.5, z: 0.5 },
      { id: 7, element: 'H', x: -0.5, y: 0, z: -1 },
      // Hydrogens for C2 (has branch)
      { id: 8, element: 'H', x: 1.5, y: -1, z: 0.5 },
      // Hydrogens for C3
      { id: 9, element: 'H', x: 3, y: 0.5, z: 0.5 },
      { id: 10, element: 'H', x: 3, y: -0.5, z: 0.5 },
      // Hydrogens for C4
      { id: 11, element: 'H', x: 5, y: 0.5, z: 0.5 },
      { id: 12, element: 'H', x: 5, y: -0.5, z: 0.5 },
      { id: 13, element: 'H', x: 5, y: 0, z: -1 },
      // Hydrogens for methyl branch
      { id: 14, element: 'H', x: 1, y: 2, z: 0.5 },
      { id: 15, element: 'H', x: 2, y: 2, z: 0.5 },
      { id: 16, element: 'H', x: 1.5, y: 2, z: -1 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 4, bondType: 1 },
      // C1 hydrogens
      { atomIndex1: 0, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 7, bondType: 1 },
      // C2 hydrogen
      { atomIndex1: 1, atomIndex2: 8, bondType: 1 },
      // C3 hydrogens
      { atomIndex1: 2, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 10, bondType: 1 },
      // C4 hydrogens
      { atomIndex1: 3, atomIndex2: 11, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 12, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 13, bondType: 1 },
      // Methyl branch hydrogens
      { atomIndex1: 4, atomIndex2: 14, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 15, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 16, bondType: 1 },
    ]
  };
}

function createPropanol(): Molecule3D {
  // 1-propanol structure
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'C', x: 1.5, y: 0, z: 0 },
      { id: 2, element: 'C', x: 3, y: 0, z: 0 },
      { id: 3, element: 'O', x: 4, y: 0, z: 0 },
      // Hydrogens
      { id: 4, element: 'H', x: -0.5, y: 0.5, z: 0.5 },
      { id: 5, element: 'H', x: -0.5, y: -0.5, z: 0.5 },
      { id: 6, element: 'H', x: -0.5, y: 0, z: -1 },
      { id: 7, element: 'H', x: 1.5, y: 0.5, z: 0.5 },
      { id: 8, element: 'H', x: 1.5, y: -0.5, z: 0.5 },
      { id: 9, element: 'H', x: 3, y: 0.5, z: 0.5 },
      { id: 10, element: 'H', x: 3, y: -0.5, z: 0.5 },
      { id: 11, element: 'H', x: 4.5, y: 0, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 10, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 11, bondType: 1 },
    ]
  };
}

function createIsopropanol(): Molecule3D {
  // 2-propanol structure
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'C', x: 1.5, y: 0, z: 0 },
      { id: 2, element: 'C', x: 3, y: 0, z: 0 },
      { id: 3, element: 'O', x: 1.5, y: 1.2, z: 0 },
      // Hydrogens
      { id: 4, element: 'H', x: -0.5, y: 0.5, z: 0.5 },
      { id: 5, element: 'H', x: -0.5, y: -0.5, z: 0.5 },
      { id: 6, element: 'H', x: -0.5, y: 0, z: -1 },
      { id: 7, element: 'H', x: 1.5, y: -1, z: 0 },
      { id: 8, element: 'H', x: 3.5, y: 0.5, z: 0.5 },
      { id: 9, element: 'H', x: 3.5, y: -0.5, z: 0.5 },
      { id: 10, element: 'H', x: 3.5, y: 0, z: -1 },
      { id: 11, element: 'H', x: 1.5, y: 1.8, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 10, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 11, bondType: 1 },
    ]
  };
}

function createToluene(): Molecule3D {
  // Toluene (methylbenzene) structure
  return {
    atoms: [
      // Benzene ring
      { id: 0, element: 'C', x: 0, y: 1.2, z: 0 },
      { id: 1, element: 'C', x: 1.04, y: 0.6, z: 0 },
      { id: 2, element: 'C', x: 1.04, y: -0.6, z: 0 },
      { id: 3, element: 'C', x: 0, y: -1.2, z: 0 },
      { id: 4, element: 'C', x: -1.04, y: -0.6, z: 0 },
      { id: 5, element: 'C', x: -1.04, y: 0.6, z: 0 },
      // Methyl group
      { id: 6, element: 'C', x: 0, y: 2.7, z: 0 },
      // Hydrogens on benzene ring
      { id: 7, element: 'H', x: 1.85, y: 1.07, z: 0 },
      { id: 8, element: 'H', x: 1.85, y: -1.07, z: 0 },
      { id: 9, element: 'H', x: 0, y: -2.14, z: 0 },
      { id: 10, element: 'H', x: -1.85, y: -1.07, z: 0 },
      { id: 11, element: 'H', x: -1.85, y: 1.07, z: 0 },
      // Hydrogens on methyl group
      { id: 12, element: 'H', x: 0.5, y: 3.2, z: 0.5 },
      { id: 13, element: 'H', x: -0.5, y: 3.2, z: 0.5 },
      { id: 14, element: 'H', x: 0, y: 3.2, z: -1 },
    ],
    bonds: [
      // Benzene ring bonds
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 2 },
      { atomIndex1: 2, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 4, bondType: 2 },
      { atomIndex1: 4, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 5, atomIndex2: 0, bondType: 2 },
      // Methyl group
      { atomIndex1: 0, atomIndex2: 6, bondType: 1 },
      // Hydrogen bonds
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 10, bondType: 1 },
      { atomIndex1: 5, atomIndex2: 11, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 12, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 13, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 14, bondType: 1 },
    ]
  };
}

function createXylene(): Molecule3D {
  // o-Xylene (1,2-dimethylbenzene) structure
  return {
    atoms: [
      // Benzene ring
      { id: 0, element: 'C', x: 0, y: 1.2, z: 0 },
      { id: 1, element: 'C', x: 1.04, y: 0.6, z: 0 },
      { id: 2, element: 'C', x: 1.04, y: -0.6, z: 0 },
      { id: 3, element: 'C', x: 0, y: -1.2, z: 0 },
      { id: 4, element: 'C', x: -1.04, y: -0.6, z: 0 },
      { id: 5, element: 'C', x: -1.04, y: 0.6, z: 0 },
      // First methyl group
      { id: 6, element: 'C', x: 0, y: 2.7, z: 0 },
      // Second methyl group
      { id: 7, element: 'C', x: 2.5, y: 1.2, z: 0 },
      // Hydrogens on benzene ring
      { id: 8, element: 'H', x: 1.85, y: -1.07, z: 0 },
      { id: 9, element: 'H', x: 0, y: -2.14, z: 0 },
      { id: 10, element: 'H', x: -1.85, y: -1.07, z: 0 },
      { id: 11, element: 'H', x: -1.85, y: 1.07, z: 0 },
      // Hydrogens on first methyl group
      { id: 12, element: 'H', x: 0.5, y: 3.2, z: 0.5 },
      { id: 13, element: 'H', x: -0.5, y: 3.2, z: 0.5 },
      { id: 14, element: 'H', x: 0, y: 3.2, z: -1 },
      // Hydrogens on second methyl group
      { id: 15, element: 'H', x: 3, y: 1.7, z: 0.5 },
      { id: 16, element: 'H', x: 3, y: 0.7, z: 0.5 },
      { id: 17, element: 'H', x: 3, y: 1.2, z: -1 },
    ],
    bonds: [
      // Benzene ring bonds
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 2 },
      { atomIndex1: 2, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 4, bondType: 2 },
      { atomIndex1: 4, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 5, atomIndex2: 0, bondType: 2 },
      // Methyl groups
      { atomIndex1: 0, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
      // Hydrogen bonds
      { atomIndex1: 2, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 10, bondType: 1 },
      { atomIndex1: 5, atomIndex2: 11, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 12, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 13, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 14, bondType: 1 },
      { atomIndex1: 7, atomIndex2: 15, bondType: 1 },
      { atomIndex1: 7, atomIndex2: 16, bondType: 1 },
      { atomIndex1: 7, atomIndex2: 17, bondType: 1 },
    ]
  };
}

function createFormicAcid(): Molecule3D {
  // HCOOH structure
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'O', x: 1.2, y: 0, z: 0 },
      { id: 2, element: 'O', x: -0.6, y: 1.04, z: 0 },
      { id: 3, element: 'H', x: 0, y: -1, z: 0 },
      { id: 4, element: 'H', x: -1.5, y: 1.04, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 2 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 4, bondType: 1 },
    ]
  };
}

function createHydrogen(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'H', x: 0, y: 0, z: 0 },
      { id: 1, element: 'H', x: 0.74, y: 0, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
    ]
  };
}

// Create a placeholder molecule for complex structures that can't be parsed
function createComplexMoleculePlaceholder(): Molecule3D {
  // Create a simple representation showing this is a complex molecule
  const atoms = [];
  const bonds: Array<{ atomIndex1: number; atomIndex2: number; bondType: number }> = [];
  
  // Central carbon with surrounding atoms to indicate complexity
  atoms.push({ id: 0, element: 'C', x: 0, y: 0, z: 0 });
  
  // Add surrounding atoms in a tetrahedral arrangement
  const positions = [
    { x: 1.2, y: 0.8, z: 0.8 },
    { x: -1.2, y: -0.8, z: 0.8 },
    { x: 1.2, y: -0.8, z: -0.8 },
    { x: -1.2, y: 0.8, z: -0.8 }
  ];
  
  positions.forEach((pos, i) => {
    atoms.push({ id: i + 1, element: 'X', x: pos.x, y: pos.y, z: pos.z });
    bonds.push({ atomIndex1: 0, atomIndex2: i + 1, bondType: 1 });
  });
  
  return { atoms, bonds };
}

// D-ribose (CID 634) - simplified ring structure
function createRibose(): Molecule3D {
  const atoms = [];
  const bonds: Array<{ atomIndex1: number; atomIndex2: number; bondType: number }> = [];
  
  // Simplified ribose ring (furanose form)
  // Add all atoms at once
  atoms.push(
    { id: 0, element: 'C', x: 0, y: 0, z: 0 },     // C1
    { id: 1, element: 'C', x: 1.4, y: 0.8, z: 0 }, // C2
    { id: 2, element: 'C', x: 2.2, y: -0.5, z: 0 }, // C3
    { id: 3, element: 'C', x: 1.2, y: -1.5, z: 0 }, // C4
    { id: 4, element: 'O', x: 0.2, y: -1.2, z: 0.8 }, // Ring oxygen
    { id: 5, element: 'O', x: -0.8, y: 0.8, z: 0 },   // OH on C1
    { id: 6, element: 'H', x: -1.5, y: 0.5, z: 0 },   // H on OH
    { id: 7, element: 'O', x: 1.8, y: 1.8, z: 0 },    // OH on C2
    { id: 8, element: 'H', x: 2.5, y: 2.2, z: 0 },    // H on OH
    { id: 9, element: 'O', x: 3.2, y: -0.2, z: 0 },   // OH on C3
    { id: 10, element: 'H', x: 3.8, y: -0.8, z: 0 },  // H on OH
    { id: 11, element: 'C', x: 1.5, y: -2.8, z: 0 },  // CH2
    { id: 12, element: 'O', x: 2.5, y: -3.5, z: 0 },  // OH
    { id: 13, element: 'H', x: 3.2, y: -3.2, z: 0 },  // H on OH
    { id: 14, element: 'H', x: 0.2, y: 0.2, z: 1 }, // H on C1
    { id: 15, element: 'H', x: 1, y: 1, z: -1 }, // H on C2
    { id: 16, element: 'H', x: 2.5, y: -0.8, z: -1 }, // H on C3
    { id: 17, element: 'H', x: 0.8, y: -1.8, z: -1 }, // H on C4
    { id: 18, element: 'H', x: 0.8, y: -3.2, z: 0 },   // H on CH2
    { id: 19, element: 'H', x: 1.8, y: -3.2, z: -0.8 } // H on CH2
  );
  
  // Add all bonds at once
  bonds.push(
    { atomIndex1: 0, atomIndex2: 1, bondType: 1 }, // C1-C2
    { atomIndex1: 1, atomIndex2: 2, bondType: 1 }, // C2-C3
    { atomIndex1: 2, atomIndex2: 3, bondType: 1 }, // C3-C4
    { atomIndex1: 3, atomIndex2: 4, bondType: 1 }, // C4-O
    { atomIndex1: 4, atomIndex2: 0, bondType: 1 }, // O-C1
    { atomIndex1: 0, atomIndex2: 5, bondType: 1 }, // C1-OH
    { atomIndex1: 5, atomIndex2: 6, bondType: 1 }, // OH-H
    { atomIndex1: 1, atomIndex2: 7, bondType: 1 }, // C2-OH
    { atomIndex1: 7, atomIndex2: 8, bondType: 1 }, // OH-H
    { atomIndex1: 2, atomIndex2: 9, bondType: 1 }, // C3-OH
    { atomIndex1: 9, atomIndex2: 10, bondType: 1 }, // OH-H
    { atomIndex1: 3, atomIndex2: 11, bondType: 1 }, // C4-CH2
    { atomIndex1: 11, atomIndex2: 12, bondType: 1 }, // CH2-OH
    { atomIndex1: 12, atomIndex2: 13, bondType: 1 }, // OH-H
    { atomIndex1: 0, atomIndex2: 14, bondType: 1 }, // C1-H
    { atomIndex1: 1, atomIndex2: 15, bondType: 1 }, // C2-H
    { atomIndex1: 2, atomIndex2: 16, bondType: 1 }, // C3-H
    { atomIndex1: 3, atomIndex2: 17, bondType: 1 }, // C4-H
    { atomIndex1: 11, atomIndex2: 18, bondType: 1 }, // CH2-H
    { atomIndex1: 11, atomIndex2: 19, bondType: 1 }  // CH2-H
  );
  
  return { atoms, bonds };
}

// Placeholder functions for complex molecules (will use SMILES fallback)
function createGlucose(): Molecule3D {
  // For now, create a placeholder - the SMILES fallback will handle the real structure
  return createComplexMoleculePlaceholder();
}

function createCaffeine(): Molecule3D {
  // For now, create a placeholder - the SMILES fallback will handle the real structure
  return createComplexMoleculePlaceholder();
}

function createAspirin(): Molecule3D {
  // For now, create a placeholder - the SMILES fallback will handle the real structure
  return createComplexMoleculePlaceholder();
}

function createOxygen(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'O', x: 0, y: 0, z: 0 },
      { id: 1, element: 'O', x: 1.21, y: 0, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 2 },
    ]
  };
}

// Alkene creation functions
function createEthene(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'C', x: 1.34, y: 0, z: 0 },
      { id: 2, element: 'H', x: -0.5, y: 0.8, z: 0 },
      { id: 3, element: 'H', x: -0.5, y: -0.8, z: 0 },
      { id: 4, element: 'H', x: 1.84, y: 0.8, z: 0 },
      { id: 5, element: 'H', x: 1.84, y: -0.8, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 2 }, // C=C double bond
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 5, bondType: 1 },
    ]
  };
}

function createPropene(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'C', x: 1.34, y: 0, z: 0 },
      { id: 2, element: 'C', x: 2.2, y: 1, z: 0 },
      { id: 3, element: 'H', x: -0.5, y: 0.8, z: 0 },
      { id: 4, element: 'H', x: -0.5, y: -0.8, z: 0 },
      { id: 5, element: 'H', x: 1.84, y: -0.8, z: 0 },
      { id: 6, element: 'H', x: 1.7, y: 1.8, z: 0 },
      { id: 7, element: 'H', x: 2.7, y: 1.3, z: 0.8 },
      { id: 8, element: 'H', x: 2.7, y: 1.3, z: -0.8 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 2 }, // C=C double bond
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 8, bondType: 1 },
    ]
  };
}

function createButene(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'C', x: 1.34, y: 0, z: 0 },
      { id: 2, element: 'C', x: 2.2, y: 1, z: 0 },
      { id: 3, element: 'C', x: 3.5, y: 0.8, z: 0 },
      { id: 4, element: 'H', x: -0.5, y: 0.8, z: 0 },
      { id: 5, element: 'H', x: -0.5, y: -0.8, z: 0 },
      { id: 6, element: 'H', x: 1.84, y: -0.8, z: 0 },
      { id: 7, element: 'H', x: 1.7, y: 1.8, z: 0 },
      { id: 8, element: 'H', x: 3.8, y: 1.6, z: 0 },
      { id: 9, element: 'H', x: 4.2, y: 0.3, z: 0.8 },
      { id: 10, element: 'H', x: 4.2, y: 0.3, z: -0.8 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 2 }, // C=C double bond
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 10, bondType: 1 },
    ]
  };
}

function createHexene(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'C', x: 1.34, y: 0, z: 0 },
      { id: 2, element: 'C', x: 2.2, y: 1, z: 0 },
      { id: 3, element: 'C', x: 3.5, y: 0.8, z: 0 },
      { id: 4, element: 'C', x: 4.3, y: 1.8, z: 0 },
      { id: 5, element: 'C', x: 5.6, y: 1.6, z: 0 },
      { id: 6, element: 'H', x: -0.5, y: 0.8, z: 0 },
      { id: 7, element: 'H', x: -0.5, y: -0.8, z: 0 },
      { id: 8, element: 'H', x: 1.84, y: -0.8, z: 0 },
      { id: 9, element: 'H', x: 1.7, y: 1.8, z: 0 },
      { id: 10, element: 'H', x: 3.8, y: 1.6, z: 0 },
      { id: 11, element: 'H', x: 3.2, y: 0, z: 0 },
      { id: 12, element: 'H', x: 3.9, y: 2.6, z: 0 },
      { id: 13, element: 'H', x: 4.6, y: 2, z: 0.8 },
      { id: 14, element: 'H', x: 6, y: 2.4, z: 0 },
      { id: 15, element: 'H', x: 6.2, y: 1, z: 0.8 },
      { id: 16, element: 'H', x: 6.2, y: 1, z: -0.8 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 2 }, // C=C double bond (2-hexene)
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 10, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 11, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 12, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 13, bondType: 1 },
      { atomIndex1: 5, atomIndex2: 14, bondType: 1 },
      { atomIndex1: 5, atomIndex2: 15, bondType: 1 },
      { atomIndex1: 5, atomIndex2: 16, bondType: 1 },
    ]
  };
}

function createNitrogen(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'N', x: 0, y: 0, z: 0 },
      { id: 1, element: 'N', x: 1.1, y: 0, z: 0 },
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 3 },
    ]
  };
}

// SMILES-based structure creators for complex molecules
function createCaffeineFromSMILES(): Molecule3D {
  // Caffeine structure: CN1C=NC2=C1C(=O)N(C(=O)N2C)C
  // A purine alkaloid with two fused rings
  return {
    atoms: [
      // Purine ring system atoms
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },        // methyl group on N1
      { id: 1, element: 'N', x: 1.5, y: 0, z: 0 },      // N1
      { id: 2, element: 'C', x: 2.2, y: 1.2, z: 0 },    // C2
      { id: 3, element: 'N', x: 3.7, y: 1.2, z: 0 },    // N3
      { id: 4, element: 'C', x: 4.4, y: 0, z: 0 },      // C4
      { id: 5, element: 'C', x: 3.7, y: -1.2, z: 0 },   // C5
      { id: 6, element: 'C', x: 5.9, y: 0, z: 0 },      // C6 (carbonyl)
      { id: 7, element: 'O', x: 6.6, y: 1.2, z: 0 },    // O6
      { id: 8, element: 'N', x: 6.6, y: -1.2, z: 0 },   // N7
      { id: 9, element: 'C', x: 8.1, y: -1.2, z: 0 },   // methyl on N7
      { id: 10, element: 'C', x: 5.9, y: -2.4, z: 0 },  // C8 (carbonyl)
      { id: 11, element: 'O', x: 6.6, y: -3.6, z: 0 },  // O8
      { id: 12, element: 'N', x: 4.4, y: -2.4, z: 0 },  // N9
      { id: 13, element: 'C', x: 3.7, y: -3.6, z: 0 },  // methyl on N9
      // Ring closure
      { id: 14, element: 'C', x: 2.2, y: -1.2, z: 0 },  // C6 ring closure
      // Hydrogens
      { id: 15, element: 'H', x: -0.5, y: 0.8, z: 0 },
      { id: 16, element: 'H', x: -0.5, y: -0.8, z: 0 },
      { id: 17, element: 'H', x: 0.5, y: 0, z: 0.8 },
      { id: 18, element: 'H', x: 2.2, y: 2.2, z: 0 },
      { id: 19, element: 'H', x: 8.6, y: -0.4, z: 0 },
      { id: 20, element: 'H', x: 8.6, y: -2, z: 0 },
      { id: 21, element: 'H', x: 8.4, y: -1.2, z: 0.8 },
      { id: 22, element: 'H', x: 3.2, y: -4.4, z: 0 },
      { id: 23, element: 'H', x: 4.2, y: -3.6, z: 0.8 },
      { id: 24, element: 'H', x: 4.2, y: -3.6, z: -0.8 },
    ],
    bonds: [
      // Main purine ring bonds
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },    // methyl-N1
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },    // N1-C2
      { atomIndex1: 2, atomIndex2: 3, bondType: 2 },    // C2=N3
      { atomIndex1: 3, atomIndex2: 4, bondType: 1 },    // N3-C4
      { atomIndex1: 4, atomIndex2: 5, bondType: 2 },    // C4=C5
      { atomIndex1: 5, atomIndex2: 14, bondType: 1 },   // C5-C6_ring
      { atomIndex1: 14, atomIndex2: 1, bondType: 1 },   // C6_ring-N1
      
      // 6-membered ring completion
      { atomIndex1: 4, atomIndex2: 6, bondType: 1 },    // C4-C6
      { atomIndex1: 6, atomIndex2: 7, bondType: 2 },    // C6=O
      { atomIndex1: 6, atomIndex2: 8, bondType: 1 },    // C6-N7
      { atomIndex1: 8, atomIndex2: 9, bondType: 1 },    // N7-methyl
      { atomIndex1: 8, atomIndex2: 10, bondType: 1 },   // N7-C8
      { atomIndex1: 10, atomIndex2: 11, bondType: 2 },  // C8=O
      { atomIndex1: 10, atomIndex2: 12, bondType: 1 },  // C8-N9
      { atomIndex1: 12, atomIndex2: 13, bondType: 1 },  // N9-methyl
      { atomIndex1: 12, atomIndex2: 5, bondType: 1 },   // N9-C5
      
      // Hydrogen bonds
      { atomIndex1: 0, atomIndex2: 15, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 16, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 17, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 18, bondType: 1 },
      { atomIndex1: 9, atomIndex2: 19, bondType: 1 },
      { atomIndex1: 9, atomIndex2: 20, bondType: 1 },
      { atomIndex1: 9, atomIndex2: 21, bondType: 1 },
      { atomIndex1: 13, atomIndex2: 22, bondType: 1 },
      { atomIndex1: 13, atomIndex2: 23, bondType: 1 },
      { atomIndex1: 13, atomIndex2: 24, bondType: 1 },
    ]
  };
}

function createAspirinFromSMILES(): Molecule3D {
  // Aspirin: CC(=O)OC1=CC=CC=C1C(=O)O
  // Simplified benzene ring with acetyl and carboxyl groups
  return {
    atoms: [
      // Benzene ring
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'C', x: 1.4, y: 0, z: 0 },
      { id: 2, element: 'C', x: 2.1, y: 1.2, z: 0 },
      { id: 3, element: 'C', x: 1.4, y: 2.4, z: 0 },
      { id: 4, element: 'C', x: 0, y: 2.4, z: 0 },
      { id: 5, element: 'C', x: -0.7, y: 1.2, z: 0 },
      
      // Carboxyl group on C1
      { id: 6, element: 'C', x: -2.2, y: 1.2, z: 0 },
      { id: 7, element: 'O', x: -2.9, y: 2.4, z: 0 },
      { id: 8, element: 'O', x: -2.9, y: 0, z: 0 },
      { id: 9, element: 'H', x: -3.9, y: 0, z: 0 },
      
      // Acetyl ester on C2
      { id: 10, element: 'O', x: 2.1, y: -1.2, z: 0 },
      { id: 11, element: 'C', x: 3.6, y: -1.2, z: 0 },
      { id: 12, element: 'O', x: 4.3, y: 0, z: 0 },
      { id: 13, element: 'C', x: 4.3, y: -2.4, z: 0 },
      
      // Hydrogens
      { id: 14, element: 'H', x: 3.1, y: 1.2, z: 0 },
      { id: 15, element: 'H', x: 1.9, y: 3.3, z: 0 },
      { id: 16, element: 'H', x: -0.5, y: 3.3, z: 0 },
      { id: 17, element: 'H', x: 3.8, y: -3.3, z: 0 },
      { id: 18, element: 'H', x: 5.3, y: -2.4, z: 0 },
      { id: 19, element: 'H', x: 4.3, y: -2.4, z: 0.8 },
    ],
    bonds: [
      // Benzene ring
      { atomIndex1: 0, atomIndex2: 1, bondType: 2 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 3, bondType: 2 },
      { atomIndex1: 3, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 5, bondType: 2 },
      { atomIndex1: 5, atomIndex2: 0, bondType: 1 },
      
      // Carboxyl group
      { atomIndex1: 5, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 7, bondType: 2 },
      { atomIndex1: 6, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 8, atomIndex2: 9, bondType: 1 },
      
      // Acetyl ester
      { atomIndex1: 1, atomIndex2: 10, bondType: 1 },
      { atomIndex1: 10, atomIndex2: 11, bondType: 1 },
      { atomIndex1: 11, atomIndex2: 12, bondType: 2 },
      { atomIndex1: 11, atomIndex2: 13, bondType: 1 },
      
      // Hydrogens
      { atomIndex1: 2, atomIndex2: 14, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 15, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 16, bondType: 1 },
      { atomIndex1: 13, atomIndex2: 17, bondType: 1 },
      { atomIndex1: 13, atomIndex2: 18, bondType: 1 },
      { atomIndex1: 13, atomIndex2: 19, bondType: 1 },
    ]
  };
}

function createGlucoseFromSMILES(): Molecule3D {
  // Glucose in chair conformation (simplified)
  // C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O
  return {
    atoms: [
      // Ring atoms (chair conformation)
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },      // C1
      { id: 1, element: 'C', x: 1.4, y: 0.8, z: 0 },  // C2
      { id: 2, element: 'C', x: 2.8, y: 0, z: 0 },    // C3
      { id: 3, element: 'C', x: 2.8, y: -1.6, z: 0 }, // C4
      { id: 4, element: 'C', x: 1.4, y: -2.4, z: 0 }, // C5
      { id: 5, element: 'O', x: 0, y: -1.6, z: 0 },   // O ring
      
      // CH2OH group on C5
      { id: 6, element: 'C', x: 1.4, y: -3.9, z: 0 },
      { id: 7, element: 'O', x: 0, y: -4.7, z: 0 },
      
      // OH groups
      { id: 8, element: 'O', x: -1.4, y: 0.8, z: 0 },  // OH on C1
      { id: 9, element: 'O', x: 1.4, y: 2.3, z: 0 },   // OH on C2
      { id: 10, element: 'O', x: 4.2, y: 0.8, z: 0 },  // OH on C3
      { id: 11, element: 'O', x: 4.2, y: -2.4, z: 0 }, // OH on C4
      
      // Hydrogens
      { id: 12, element: 'H', x: 0, y: 0, z: 1.1 },    // H on C1
      { id: 13, element: 'H', x: 1.4, y: 0.8, z: -1.1 }, // H on C2
      { id: 14, element: 'H', x: 2.8, y: 0, z: 1.1 },  // H on C3
      { id: 15, element: 'H', x: 2.8, y: -1.6, z: -1.1 }, // H on C4
      { id: 16, element: 'H', x: 1.4, y: -2.4, z: 1.1 }, // H on C5
      { id: 17, element: 'H', x: 2.3, y: -4.3, z: 0 },   // H on CH2
      { id: 18, element: 'H', x: 1.4, y: -3.9, z: 1.1 }, // H on CH2
      { id: 19, element: 'H', x: -1.8, y: 0.8, z: 0 },   // H on OH1
      { id: 20, element: 'H', x: 1.8, y: 2.7, z: 0 },    // H on OH2
      { id: 21, element: 'H', x: 4.6, y: 0.8, z: 0 },    // H on OH3
      { id: 22, element: 'H', x: 4.6, y: -2.4, z: 0 },   // H on OH4
      { id: 23, element: 'H', x: -0.4, y: -5.1, z: 0 },  // H on OH6
    ],
    bonds: [
      // Ring bonds
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 5, atomIndex2: 0, bondType: 1 },
      
      // CH2OH group
      { atomIndex1: 4, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 7, bondType: 1 },
      
      // OH groups
      { atomIndex1: 0, atomIndex2: 8, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 9, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 10, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 11, bondType: 1 },
      
      // Hydrogens
      { atomIndex1: 0, atomIndex2: 12, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 13, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 14, bondType: 1 },
      { atomIndex1: 3, atomIndex2: 15, bondType: 1 },
      { atomIndex1: 4, atomIndex2: 16, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 17, bondType: 1 },
      { atomIndex1: 6, atomIndex2: 18, bondType: 1 },
      { atomIndex1: 8, atomIndex2: 19, bondType: 1 },
      { atomIndex1: 9, atomIndex2: 20, bondType: 1 },
      { atomIndex1: 10, atomIndex2: 21, bondType: 1 },
      { atomIndex1: 11, atomIndex2: 22, bondType: 1 },
      { atomIndex1: 7, atomIndex2: 23, bondType: 1 },
    ]
  };
}
