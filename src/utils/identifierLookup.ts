import { ChemicalIdentifiers } from '../types/molecule';

export interface IdentifierLookupResult {
  success: boolean;
  identifiers?: Partial<ChemicalIdentifiers>;
  error?: string;
  source?: string; // Which database provided the result
  confidence?: number; // Confidence score 0-1
}

export interface DatabaseConfig {
  name: string;
  baseUrl: string;
  priority: number; // Higher number = higher priority
  timeout: number;
  retries: number;
}

// Multiple database configurations for redundancy
const DATABASES: DatabaseConfig[] = [
  {
    name: 'PubChem',
    baseUrl: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug',
    priority: 10,
    timeout: 5000,
    retries: 2
  },
  {
    name: 'NCI/CACTUS',
    baseUrl: 'https://cactus.nci.nih.gov/chemical/structure',
    priority: 6,
    timeout: 7000,
    retries: 1
  }
];

// Cache for previously looked up compounds
const identifierCache = new Map<string, { identifiers: Partial<ChemicalIdentifiers>; timestamp: number; source: string }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Validation patterns for different identifier types
const VALIDATION_PATTERNS: Partial<Record<keyof ChemicalIdentifiers, RegExp>> = {
  casNumber: /^\d{2,7}-\d{2}-\d$/,
  pubchemCID: /^\d+$/,
  unii: /^[A-Z0-9]{10}$/,
  chemSpider: /^\d+$/,
  ecNumber: /^\d{3}-\d{3}-\d$/,
  eNumber: /^E\d{3,4}[a-z]?$/i,
  smiles: /^[A-Za-z0-9@+\-\[\]()=#$:.\\\/]+$/,
  inchi: /^InChI=1S?\//,
  rtecsNumber: /^[A-Z]{2}\d{7}$/,
  compToxDashboard: /^DTXSID\d{7,}$/
};

// Normalizes identifiers to standard formats
export function normalizeIdentifier(type: keyof ChemicalIdentifiers, value: string): string {
  const trimmed = value.trim();
  
  switch (type) {
    case 'casNumber':
      // Add hyphens if missing: 123456789 -> 12345-67-8
      if (/^\d{8,9}$/.test(trimmed)) {
        return trimmed.length === 8 
          ? `${trimmed.slice(0, 5)}-${trimmed.slice(5, 7)}-${trimmed.slice(7)}`
          : `${trimmed.slice(0, 6)}-${trimmed.slice(6, 8)}-${trimmed.slice(8)}`;
      }
      return trimmed;
    
    case 'pubchemCID':
    case 'chemSpider':
      return trimmed.replace(/^CID:?/i, '').replace(/^CSID:?/i, '');
    
    case 'inchi':
      return trimmed.startsWith('InChI=') ? trimmed : `InChI=${trimmed}`;
    
    case 'eNumber':
      return trimmed.toUpperCase().replace(/^E?/, 'E');
    
    case 'unii':
    case 'rtecsNumber':
      return trimmed.toUpperCase();
    
    case 'compToxDashboard':
      return trimmed.toUpperCase().replace(/^DTXSID:?/i, 'DTXSID');
    
    default:
      return trimmed;
  }
}

// Validates if an identifier matches expected format
export function validateIdentifier(type: keyof ChemicalIdentifiers, value: string): boolean {
  const pattern = VALIDATION_PATTERNS[type];
  if (!pattern) return true; // No validation pattern defined
  
  const normalized = normalizeIdentifier(type, value);
  return pattern.test(normalized);
}

// Generate cache key for an identifier
function getCacheKey(type: keyof ChemicalIdentifiers, value: string): string {
  return `${type}:${normalizeIdentifier(type, value).toLowerCase()}`;
}

// Check if cached data is still valid
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION;
}

// Pre-validation: Check if input seems reasonable for the identifier type
function isReasonableInput(type: keyof ChemicalIdentifiers, value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  
  // Check for obvious gibberish patterns
  if (trimmed.length < 2) return false;
  if (/^[^a-z0-9\-\[\]()=\s]+$/i.test(trimmed)) return false; // Only special chars
  if (/^[a-z]{1,3}$/.test(trimmed) && !['o', 'c', 'n', 'h'].includes(trimmed)) return false; // Very short unless common atoms
  
  switch (type) {
    case 'iupacName':
      // IUPAC names should contain reasonable chemical characters
      if (!/[a-z]/i.test(trimmed)) return false; // Must contain letters
      if (trimmed.length < 2) return false; // Too short for any real molecule
      // Allow single atoms and simple molecules
      if (['o', 'c', 'n', 'h', 'f', 'cl', 'br', 'i', 's', 'p'].includes(trimmed)) return true;
      // For longer names, check for reasonable patterns
      if (trimmed.length >= 3) {
        // Must contain at least one vowel or be a known chemical term
        if (!/[aeiouy]/i.test(trimmed)) {
          const exceptions = ['ch4', 'nh3', 'hcl', 'h2o', 'co2', 'h2s', 'hf', 'hbr', 'hi'];
          if (!exceptions.includes(trimmed)) return false;
        }
        // Reject obvious gibberish (too many consonants in a row)
        if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(trimmed)) return false;
      }
      return true;
      
    case 'casNumber':
      // Must match CAS pattern exactly
      return /^\d{2,7}-\d{2}-\d$/.test(trimmed);
      
    case 'pubchemCID':
    case 'chemSpider':
      // Must be numeric
      return /^\d+$/.test(trimmed) && parseInt(trimmed) > 0;
      
    case 'smiles':
      // SMILES should contain valid SMILES characters
      return /^[A-Za-z0-9@+\-\[\]()=#$:.\\\/]+$/.test(trimmed);
      
    case 'inchi':
      // InChI must start with InChI=
      return trimmed.startsWith('inchi=');
      
    case 'unii':
      // UNII is exactly 10 alphanumeric characters
      return /^[A-Z0-9]{10}$/i.test(trimmed);
      
    default:
      // For other types, just check basic sanity
      return trimmed.length >= 2 && /[a-z0-9]/i.test(trimmed);
  }
}

export async function lookupChemicalIdentifiers(
  sourceType: keyof ChemicalIdentifiers,
  sourceValue: string
): Promise<IdentifierLookupResult> {
  if (!sourceValue.trim()) {
    return { success: false, error: 'Empty identifier provided' };
  }

  // Pre-validation for obvious gibberish
  if (!isReasonableInput(sourceType, sourceValue)) {
    return {
      success: false,
      error: `Invalid ${sourceType}. Please enter a valid chemical identifier.`
    };
  }

  // Normalize and validate input
  const normalizedValue = normalizeIdentifier(sourceType, sourceValue);
  if (!validateIdentifier(sourceType, normalizedValue)) {
    return { 
      success: false, 
      error: `Invalid format for ${sourceType}: ${sourceValue}` 
    };
  }

  // Check cache first
  const cacheKey = getCacheKey(sourceType, normalizedValue);
  const cached = identifierCache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return {
      success: true,
      identifiers: cached.identifiers,
      source: `${cached.source} (cached)`,
      confidence: 1.0
    };
  }

  // Try multiple databases in order of priority
  const errors: string[] = [];
  
  // First try local lookup (fastest)
  const localResult = getLocalIdentifiers(sourceType, normalizedValue);
  if (localResult) {
    const cacheData = { identifiers: localResult, timestamp: Date.now(), source: 'Local Database' };
    identifierCache.set(cacheKey, cacheData);
    return {
      success: true,
      identifiers: localResult,
      source: 'Local Database',
      confidence: 1.0
    };
  }

  // Try external databases
  for (const db of DATABASES.sort((a, b) => b.priority - a.priority)) {
    try {
      const result = await lookupFromDatabase(db, sourceType, normalizedValue);
      if (result.success && result.identifiers) {
        // Cache successful result
        const cacheData = { identifiers: result.identifiers, timestamp: Date.now(), source: db.name };
        identifierCache.set(cacheKey, cacheData);
        
        return {
          ...result,
          source: db.name,
          confidence: calculateConfidence(result.identifiers, sourceType)
        };
      }
    } catch (error) {
      errors.push(`${db.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.warn(`Database ${db.name} failed:`, error);
    }
  }

  return {
    success: false,
    error: `Unable to find "${sourceValue}" in chemical databases. Please check the spelling or try a different identifier type.`
  };
}

// Calculate confidence score based on how many identifiers were found
function calculateConfidence(identifiers: Partial<ChemicalIdentifiers>, sourceType: keyof ChemicalIdentifiers): number {
  const identifierCount = Object.keys(identifiers).length;
  const hasSourceType = Boolean(identifiers[sourceType]);
  
  // Base confidence on number of identifiers found
  let confidence = Math.min(identifierCount / 8, 1.0); // Max confidence with 8+ identifiers
  
  // Boost confidence if source identifier is confirmed
  if (hasSourceType) {
    confidence = Math.min(confidence + 0.2, 1.0);
  }
  
  // Minimum confidence for any successful lookup
  return Math.max(confidence, 0.3);
}

// Lookup from a specific database with retry logic
async function lookupFromDatabase(
  db: DatabaseConfig, 
  sourceType: keyof ChemicalIdentifiers, 
  sourceValue: string
): Promise<IdentifierLookupResult> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= db.retries; attempt++) {
    try {
      if (db.name === 'PubChem') {
        return await lookupFromPubChem(sourceType, sourceValue, db);
      } else if (db.name === 'NCI/CACTUS') {
        return await lookupFromNCICACTUS(sourceType, sourceValue, db);
      } else {
        throw new Error(`Unsupported database: ${db.name}`);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      if (attempt < db.retries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${db.retries + 1} attempts`);
}

// PubChem database lookup implementation
async function lookupFromPubChem(
  sourceType: keyof ChemicalIdentifiers, 
  sourceValue: string, 
  db: DatabaseConfig
): Promise<IdentifierLookupResult> {
  try {
    // First, get the PubChem CID from the source identifier
    const cid = await getPubChemCID(sourceType, sourceValue, db);
    if (!cid) {
      return { success: false, error: 'Could not find compound in PubChem database' };
    }

    // Then fetch all available identifiers for this compound
    const identifiers = await getAllIdentifiersFromPubChemCID(cid, db);
    
    return {
      success: true,
      identifiers
    };
  } catch (error) {
    throw new Error(`PubChem lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// NCI CACTUS database lookup implementation
async function lookupFromNCICACTUS(
  _sourceType: keyof ChemicalIdentifiers, 
  sourceValue: string, 
  db: DatabaseConfig
): Promise<IdentifierLookupResult> {
  try {
    const identifiers: Partial<ChemicalIdentifiers> = {};
    const baseUrl = 'https://cactus.nci.nih.gov/chemical/structure';
    
    // NCI CACTUS can convert between many formats
    const conversions = [
      { from: sourceValue, to: 'smiles', target: 'smiles' as keyof ChemicalIdentifiers },
      { from: sourceValue, to: 'iupac_name', target: 'iupacName' as keyof ChemicalIdentifiers },
      { from: sourceValue, to: 'cas', target: 'casNumber' as keyof ChemicalIdentifiers },
      { from: sourceValue, to: 'stdinchi', target: 'inchi' as keyof ChemicalIdentifiers }
    ];

    for (const conversion of conversions) {
      try {
        const url = `${baseUrl}/${encodeURIComponent(conversion.from)}/${conversion.to}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), db.timeout);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result = await response.text();
          if (result && !result.includes('Page not found')) {
            identifiers[conversion.target] = result.trim();
          }
        }
      } catch (error) {
        // Continue with other conversions even if one fails
        console.warn(`NCI CACTUS conversion failed for ${conversion.to}:`, error);
      }
    }

    if (Object.keys(identifiers).length === 0) {
      return { success: false, error: 'No identifiers found in NCI CACTUS database' };
    }

    return {
      success: true,
      identifiers
    };
  } catch (error) {
    throw new Error(`NCI CACTUS lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Cache management utilities
export function clearIdentifierCache(): void {
  identifierCache.clear();
}

export function getCacheSize(): number {
  return identifierCache.size;
}

export function getCacheStats(): { size: number; entries: Array<{ key: string; age: number }> } {
  const now = Date.now();
  const entries = Array.from(identifierCache.entries()).map(([key, data]) => ({
    key,
    age: now - data.timestamp
  }));
  
  return {
    size: identifierCache.size,
    entries
  };
}

// Clean expired entries from cache
export function cleanExpiredCache(): number {
  let removed = 0;
  
  for (const [key, data] of identifierCache.entries()) {
    if (!isCacheValid(data.timestamp)) {
      identifierCache.delete(key);
      removed++;
    }
  }
  
  return removed;
}

// Get PubChem CID from various identifier types
async function getPubChemCID(
  sourceType: keyof ChemicalIdentifiers,
  sourceValue: string,
  db: DatabaseConfig
): Promise<string | null> {
  try {
    let url: string;
    const baseUrl = db.baseUrl;
    
    switch (sourceType) {
      case 'pubchemCID':
        return sourceValue; // Already have the CID
      
      case 'iupacName':
        url = `${baseUrl}/compound/name/${encodeURIComponent(sourceValue)}/cids/JSON`;
        break;
      
      case 'casNumber':
        // Remove any spaces or hyphens for API call
        const cleanCAS = sourceValue.replace(/[\s-]/g, '');
        url = `${baseUrl}/compound/name/${encodeURIComponent(cleanCAS)}/cids/JSON`;
        break;
      
      case 'smiles':
        url = `${baseUrl}/compound/smiles/${encodeURIComponent(sourceValue)}/cids/JSON`;
        break;
      
      case 'inchi':
        url = `${baseUrl}/compound/inchi/${encodeURIComponent(sourceValue)}/cids/JSON`;
        break;
      
      default:
        // For other identifiers, try using the name endpoint
        url = `${baseUrl}/compound/name/${encodeURIComponent(sourceValue)}/cids/JSON`;
        break;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), db.timeout);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.IdentifierList?.CID?.[0]?.toString() || null;
  } catch (error) {
    console.error('Error getting CID:', error);
    return null;
  }
}

// Get all identifiers from PubChem CID
async function getAllIdentifiersFromPubChemCID(cid: string, db: DatabaseConfig): Promise<Partial<ChemicalIdentifiers>> {
  const identifiers: Partial<ChemicalIdentifiers> = {};

  try {
    // Get compound properties (includes IUPAC name, SMILES, InChI, etc.)
    const propsUrl = `${db.baseUrl}/compound/cid/${cid}/property/IUPACName,CanonicalSMILES,InChI,MolecularFormula/JSON`;
    
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), db.timeout);
    const propsResponse = await fetch(propsUrl, { signal: controller1.signal });
    clearTimeout(timeoutId1);
    
    if (propsResponse.ok) {
      const propsData = await propsResponse.json();
      const props = propsData.PropertyTable?.Properties?.[0];
      
      if (props) {
        if (props.IUPACName) identifiers.iupacName = props.IUPACName;
        if (props.CanonicalSMILES) identifiers.smiles = props.CanonicalSMILES;
        if (props.InChI) identifiers.inchi = props.InChI;
      }
    }

    // Get synonyms (includes CAS numbers and other identifiers)
    const synonymsUrl = `${db.baseUrl}/compound/cid/${cid}/synonyms/JSON`;
    
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), db.timeout);
    const synonymsResponse = await fetch(synonymsUrl, { signal: controller2.signal });
    clearTimeout(timeoutId2);
    
    if (synonymsResponse.ok) {
      const synonymsData = await synonymsResponse.json();
      const synonyms = synonymsData.InformationList?.Information?.[0]?.Synonym || [];
      
      // Extract various identifier types from synonyms
      for (const synonym of synonyms) {
        // CAS numbers (format: XXX-XX-X or XXXXXX-XX-X)
        if (!identifiers.casNumber && VALIDATION_PATTERNS.casNumber?.test(synonym)) {
          identifiers.casNumber = synonym;
        }
        
        // UNII codes
        if (!identifiers.unii && VALIDATION_PATTERNS.unii?.test(synonym)) {
          identifiers.unii = synonym;
        }
        
        // EC numbers
        if (!identifiers.ecNumber && VALIDATION_PATTERNS.ecNumber?.test(synonym)) {
          identifiers.ecNumber = synonym;
        }
        
        // E numbers
        if (!identifiers.eNumber && VALIDATION_PATTERNS.eNumber?.test(synonym)) {
          identifiers.eNumber = synonym;
        }
        
        // RTECS numbers
        if (!identifiers.rtecsNumber && VALIDATION_PATTERNS.rtecsNumber?.test(synonym)) {
          identifiers.rtecsNumber = synonym;
        }
      }
    }

    // Set the PubChem CID
    identifiers.pubchemCID = cid;

    return identifiers;
  } catch (error) {
    console.error('Error fetching identifiers from CID:', error);
    return identifiers;
  }
}

// Enhanced local lookup for common compounds (expanded database)
export function getLocalIdentifiers(
  sourceType: keyof ChemicalIdentifiers,
  sourceValue: string
): Partial<ChemicalIdentifiers> | null {
  const lowerValue = sourceValue.toLowerCase().trim();
  
  // Comprehensive database of common compounds
  const commonCompounds: { [key: string]: Partial<ChemicalIdentifiers> } = {
    // Water - H2O
    'water': {
      iupacName: 'water',
      smiles: 'O',
      inchi: 'InChI=1S/H2O/h1H2',
      casNumber: '7732-18-5',
      pubchemCID: '962',
      unii: '059QF0KO0R'
    },
    'h2o': {
      iupacName: 'water',
      smiles: 'O',
      inchi: 'InChI=1S/H2O/h1H2',
      casNumber: '7732-18-5',
      pubchemCID: '962',
      unii: '059QF0KO0R'
    },
    'o': {
      iupacName: 'water',
      smiles: 'O',
      inchi: 'InChI=1S/H2O/h1H2',
      casNumber: '7732-18-5',
      pubchemCID: '962',
      unii: '059QF0KO0R'
    },
    '7732-18-5': {
      iupacName: 'water',
      smiles: 'O',
      inchi: 'InChI=1S/H2O/h1H2',
      casNumber: '7732-18-5',
      pubchemCID: '962',
      unii: '059QF0KO0R'
    },
    
    // Carbon dioxide - CO2
    'carbon dioxide': {
      iupacName: 'carbon dioxide',
      smiles: 'O=C=O',
      inchi: 'InChI=1S/CO2/c2-1-3',
      casNumber: '124-38-9',
      pubchemCID: '280',
      unii: '142M471B3J'
    },
    'co2': {
      iupacName: 'carbon dioxide',
      smiles: 'O=C=O',
      inchi: 'InChI=1S/CO2/c2-1-3',
      casNumber: '124-38-9',
      pubchemCID: '280',
      unii: '142M471B3J'
    },
    'o=c=o': {
      iupacName: 'carbon dioxide',
      smiles: 'O=C=O',
      inchi: 'InChI=1S/CO2/c2-1-3',
      casNumber: '124-38-9',
      pubchemCID: '280',
      unii: '142M471B3J'
    },
    '124-38-9': {
      iupacName: 'carbon dioxide',
      smiles: 'O=C=O',
      inchi: 'InChI=1S/CO2/c2-1-3',
      casNumber: '124-38-9',
      pubchemCID: '280',
      unii: '142M471B3J'
    },
    
    // Methane - CH4
    'methane': {
      iupacName: 'methane',
      smiles: 'C',
      inchi: 'InChI=1S/CH4/h1H4',
      casNumber: '74-82-8',
      pubchemCID: '297',
      unii: 'OP0UW79H66'
    },
    'ch4': {
      iupacName: 'methane',
      smiles: 'C',
      inchi: 'InChI=1S/CH4/h1H4',
      casNumber: '74-82-8',
      pubchemCID: '297',
      unii: 'OP0UW79H66'
    },
    'c': {
      iupacName: 'methane',
      smiles: 'C',
      inchi: 'InChI=1S/CH4/h1H4',
      casNumber: '74-82-8',
      pubchemCID: '297',
      unii: 'OP0UW79H66'
    },
    '74-82-8': {
      iupacName: 'methane',
      smiles: 'C',
      inchi: 'InChI=1S/CH4/h1H4',
      casNumber: '74-82-8',
      pubchemCID: '297',
      unii: 'OP0UW79H66'
    },

    // Ethanol - C2H6O
    'ethanol': {
      iupacName: 'ethanol',
      smiles: 'CCO',
      inchi: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3',
      casNumber: '64-17-5',
      pubchemCID: '702',
      unii: '3K9958V90M'
    },
    'ethyl alcohol': {
      iupacName: 'ethanol',
      smiles: 'CCO',
      inchi: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3',
      casNumber: '64-17-5',
      pubchemCID: '702',
      unii: '3K9958V90M'
    },
    'cco': {
      iupacName: 'ethanol',
      smiles: 'CCO',
      inchi: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3',
      casNumber: '64-17-5',
      pubchemCID: '702',
      unii: '3K9958V90M'
    },
    '64-17-5': {
      iupacName: 'ethanol',
      smiles: 'CCO',
      inchi: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3',
      casNumber: '64-17-5',
      pubchemCID: '702',
      unii: '3K9958V90M'
    },

    // Benzene - C6H6
    'benzene': {
      iupacName: 'benzene',
      smiles: 'c1ccccc1',
      inchi: 'InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H',
      casNumber: '71-43-2',
      pubchemCID: '241',
      unii: 'J64922108F'
    },
    'c1ccccc1': {
      iupacName: 'benzene',
      smiles: 'c1ccccc1',
      inchi: 'InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H',
      casNumber: '71-43-2',
      pubchemCID: '241',
      unii: 'J64922108F'
    },
    '71-43-2': {
      iupacName: 'benzene',
      smiles: 'c1ccccc1',
      inchi: 'InChI=1S/C6H6/c1-2-4-6-5-3-1/h1-6H',
      casNumber: '71-43-2',
      pubchemCID: '241',
      unii: 'J64922108F'
    },

    // Acetic acid - C2H4O2
    'acetic acid': {
      iupacName: 'acetic acid',
      smiles: 'CC(=O)O',
      inchi: 'InChI=1S/C2H4O2/c1-2(3)4/h1H3,(H,3,4)',
      casNumber: '64-19-7',
      pubchemCID: '176',
      unii: 'Q40Q9N063P'
    },
    'cc(=o)o': {
      iupacName: 'acetic acid',
      smiles: 'CC(=O)O',
      inchi: 'InChI=1S/C2H4O2/c1-2(3)4/h1H3,(H,3,4)',
      casNumber: '64-19-7',
      pubchemCID: '176',
      unii: 'Q40Q9N063P'
    },
    '64-19-7': {
      iupacName: 'acetic acid',
      smiles: 'CC(=O)O',
      inchi: 'InChI=1S/C2H4O2/c1-2(3)4/h1H3,(H,3,4)',
      casNumber: '64-19-7',
      pubchemCID: '176',
      unii: 'Q40Q9N063P'
    },

    // Formic acid - CH2O2
    'formic acid': {
      iupacName: 'formic acid',
      smiles: 'C(=O)O',
      inchi: 'InChI=1S/CH2O2/c2-1-3/h1H,(H,2,3)',
      casNumber: '64-18-6',
      pubchemCID: '284',
      unii: '0YIW783RG1'
    },
    'methanoic acid': {
      iupacName: 'formic acid',
      smiles: 'C(=O)O',
      inchi: 'InChI=1S/CH2O2/c2-1-3/h1H,(H,2,3)',
      casNumber: '64-18-6',
      pubchemCID: '284',
      unii: '0YIW783RG1'
    },
    'c(=o)o': {
      iupacName: 'formic acid',
      smiles: 'C(=O)O',
      inchi: 'InChI=1S/CH2O2/c2-1-3/h1H,(H,2,3)',
      casNumber: '64-18-6',
      pubchemCID: '284',
      unii: '0YIW783RG1'
    },
    '64-18-6': {
      iupacName: 'formic acid',
      smiles: 'C(=O)O',
      inchi: 'InChI=1S/CH2O2/c2-1-3/h1H,(H,2,3)',
      casNumber: '64-18-6',
      pubchemCID: '284',
      unii: '0YIW783RG1'
    },

    // Methanol - CH4O
    'methanol': {
      iupacName: 'methanol',
      smiles: 'CO',
      inchi: 'InChI=1S/CH4O/c1-2/h2H,1H3',
      casNumber: '67-56-1',
      pubchemCID: '887',
      unii: 'Y4S76JWI15'
    },
    'methyl alcohol': {
      iupacName: 'methanol',
      smiles: 'CO',
      inchi: 'InChI=1S/CH4O/c1-2/h2H,1H3',
      casNumber: '67-56-1',
      pubchemCID: '887',
      unii: 'Y4S76JWI15'
    },
    'co': {
      iupacName: 'methanol',
      smiles: 'CO',
      inchi: 'InChI=1S/CH4O/c1-2/h2H,1H3',
      casNumber: '67-56-1',
      pubchemCID: '887',
      unii: 'Y4S76JWI15'
    },
    '67-56-1': {
      iupacName: 'methanol',
      smiles: 'CO',
      inchi: 'InChI=1S/CH4O/c1-2/h2H,1H3',
      casNumber: '67-56-1',
      pubchemCID: '887',
      unii: 'Y4S76JWI15'
    },

    // Ammonia - NH3
    'ammonia': {
      iupacName: 'ammonia',
      smiles: 'N',
      inchi: 'InChI=1S/H3N/h1H3',
      casNumber: '7664-41-7',
      pubchemCID: '222',
      unii: '5138Q19F1X'
    },
    'nh3': {
      iupacName: 'ammonia',
      smiles: 'N',
      inchi: 'InChI=1S/H3N/h1H3',
      casNumber: '7664-41-7',
      pubchemCID: '222',
      unii: '5138Q19F1X'
    },
    'n': {
      iupacName: 'ammonia',
      smiles: 'N',
      inchi: 'InChI=1S/H3N/h1H3',
      casNumber: '7664-41-7',
      pubchemCID: '222',
      unii: '5138Q19F1X'
    },
    '7664-41-7': {
      iupacName: 'ammonia',
      smiles: 'N',
      inchi: 'InChI=1S/H3N/h1H3',
      casNumber: '7664-41-7',
      pubchemCID: '222',
      unii: '5138Q19F1X'
    },

    // Common alkanes
    'ethane': {
      iupacName: 'ethane',
      smiles: 'CC',
      inchi: 'InChI=1S/C2H6/c1-2/h1-2H3',
      casNumber: '74-84-0',
      pubchemCID: '6324',
      unii: 'L99N5N533T'
    },
    'cc': {
      iupacName: 'ethane',
      smiles: 'CC',
      inchi: 'InChI=1S/C2H6/c1-2/h1-2H3',
      casNumber: '74-84-0',
      pubchemCID: '6324',
      unii: 'L99N5N533T'
    },
    '74-84-0': {
      iupacName: 'ethane',
      smiles: 'CC',
      inchi: 'InChI=1S/C2H6/c1-2/h1-2H3',
      casNumber: '74-84-0',
      pubchemCID: '6324',
      unii: 'L99N5N533T'
    },

    'propane': {
      iupacName: 'propane',
      smiles: 'CCC',
      inchi: 'InChI=1S/C3H8/c1-3-2/h3H2,1-2H3',
      casNumber: '74-98-6',
      pubchemCID: '6334',
      unii: 'T75W9KEA2A'
    },
    'ccc': {
      iupacName: 'propane',
      smiles: 'CCC',
      inchi: 'InChI=1S/C3H8/c1-3-2/h3H2,1-2H3',
      casNumber: '74-98-6',
      pubchemCID: '6334',
      unii: 'T75W9KEA2A'
    },
    '74-98-6': {
      iupacName: 'propane',
      smiles: 'CCC',
      inchi: 'InChI=1S/C3H8/c1-3-2/h3H2,1-2H3',
      casNumber: '74-98-6',
      pubchemCID: '6334',
      unii: 'T75W9KEA2A'
    },

    'butane': {
      iupacName: 'butane',
      smiles: 'CCCC',
      inchi: 'InChI=1S/C4H10/c1-3-4-2/h3-4H2,1-2H3',
      casNumber: '106-97-8',
      pubchemCID: '7843',
      unii: 'VR7E826LM6'
    },
    'cccc': {
      iupacName: 'butane',
      smiles: 'CCCC',
      inchi: 'InChI=1S/C4H10/c1-3-4-2/h3-4H2,1-2H3',
      casNumber: '106-97-8',
      pubchemCID: '7843',
      unii: 'VR7E826LM6'
    },
    '106-97-8': {
      iupacName: 'butane',
      smiles: 'CCCC',
      inchi: 'InChI=1S/C4H10/c1-3-4-2/h3-4H2,1-2H3',
      casNumber: '106-97-8',
      pubchemCID: '7843',
      unii: 'VR7E826LM6'
    },

    // Isobutane
    'isobutane': {
      iupacName: '2-methylpropane',
      smiles: 'CC(C)C',
      inchi: 'InChI=1S/C4H10/c1-4(2)3/h4H,1-3H3',
      casNumber: '75-28-5',
      pubchemCID: '6344',
      unii: 'BXN20XJN5I'
    },
    '2-methylpropane': {
      iupacName: '2-methylpropane',
      smiles: 'CC(C)C',
      inchi: 'InChI=1S/C4H10/c1-4(2)3/h4H,1-3H3',
      casNumber: '75-28-5',
      pubchemCID: '6344',
      unii: 'BXN20XJN5I'
    },
    'cc(c)c': {
      iupacName: '2-methylpropane',
      smiles: 'CC(C)C',
      inchi: 'InChI=1S/C4H10/c1-4(2)3/h4H,1-3H3',
      casNumber: '75-28-5',
      pubchemCID: '6344',
      unii: 'BXN20XJN5I'
    },
    '75-28-5': {
      iupacName: '2-methylpropane',
      smiles: 'CC(C)C',
      inchi: 'InChI=1S/C4H10/c1-4(2)3/h4H,1-3H3',
      casNumber: '75-28-5',
      pubchemCID: '6344',
      unii: 'BXN20XJN5I'
    },

    // Toluene
    'toluene': {
      iupacName: 'toluene',
      smiles: 'Cc1ccccc1',
      inchi: 'InChI=1S/C7H8/c1-7-5-3-2-4-6-7/h2-6H,1H3',
      casNumber: '108-88-3',
      pubchemCID: '1140',
      unii: '3FPU23BG52'
    },
    'methylbenzene': {
      iupacName: 'toluene',
      smiles: 'Cc1ccccc1',
      inchi: 'InChI=1S/C7H8/c1-7-5-3-2-4-6-7/h2-6H,1H3',
      casNumber: '108-88-3',
      pubchemCID: '1140',
      unii: '3FPU23BG52'
    },
    'cc1ccccc1': {
      iupacName: 'toluene',
      smiles: 'Cc1ccccc1',
      inchi: 'InChI=1S/C7H8/c1-7-5-3-2-4-6-7/h2-6H,1H3',
      casNumber: '108-88-3',
      pubchemCID: '1140',
      unii: '3FPU23BG52'
    },
    '108-88-3': {
      iupacName: 'toluene',
      smiles: 'Cc1ccccc1',
      inchi: 'InChI=1S/C7H8/c1-7-5-3-2-4-6-7/h2-6H,1H3',
      casNumber: '108-88-3',
      pubchemCID: '1140',
      unii: '3FPU23BG52'
    },

    // Glucose
    'glucose': {
      iupacName: 'D-glucose',
      smiles: 'C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O',
      inchi: 'InChI=1S/C6H12O6/c7-1-2-3(8)4(9)5(10)6(11)12-2/h2-11H,1H2/t2-,3-,4+,5-,6+/m1/s1',
      casNumber: '50-99-7',
      pubchemCID: '5793',
      unii: 'IY9XDZ35W2'
    },
    'd-glucose': {
      iupacName: 'D-glucose',
      smiles: 'C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O',
      inchi: 'InChI=1S/C6H12O6/c7-1-2-3(8)4(9)5(10)6(11)12-2/h2-11H,1H2/t2-,3-,4+,5-,6+/m1/s1',
      casNumber: '50-99-7',
      pubchemCID: '5793',
      unii: 'IY9XDZ35W2'
    },
    '50-99-7': {
      iupacName: 'D-glucose',
      smiles: 'C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O',
      inchi: 'InChI=1S/C6H12O6/c7-1-2-3(8)4(9)5(10)6(11)12-2/h2-11H,1H2/t2-,3-,4+,5-,6+/m1/s1',
      casNumber: '50-99-7',
      pubchemCID: '5793',
      unii: 'IY9XDZ35W2'
    },

    // Caffeine
    'caffeine': {
      iupacName: '1,3,7-trimethylpurine-2,6-dione',
      smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
      inchi: 'InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3',
      casNumber: '58-08-2',
      pubchemCID: '2519',
      unii: '3G6A5W338E'
    },
    '58-08-2': {
      iupacName: '1,3,7-trimethylpurine-2,6-dione',
      smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
      inchi: 'InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3',
      casNumber: '58-08-2',
      pubchemCID: '2519',
      unii: '3G6A5W338E'
    },

    // Aspirin
    'aspirin': {
      iupacName: '2-acetoxybenzoic acid',
      smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O',
      inchi: 'InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)',
      casNumber: '50-78-2',
      pubchemCID: '2244',
      unii: 'R16CO5Y76E'
    },
    'acetylsalicylic acid': {
      iupacName: '2-acetoxybenzoic acid',
      smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O',
      inchi: 'InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)',
      casNumber: '50-78-2',
      pubchemCID: '2244',
      unii: 'R16CO5Y76E'
    },
    '50-78-2': {
      iupacName: '2-acetoxybenzoic acid',
      smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O',
      inchi: 'InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)',
      casNumber: '50-78-2',
      pubchemCID: '2244',
      unii: 'R16CO5Y76E'
    }
  };

  // Try direct lookup first
  const compound = commonCompounds[lowerValue];
  if (compound) {
    return compound;
  }

  // Try to find by any matching identifier field
  for (const [, identifiers] of Object.entries(commonCompounds)) {
    for (const [idType, idValue] of Object.entries(identifiers)) {
      if (idType === sourceType && idValue?.toLowerCase() === lowerValue) {
        return identifiers;
      }
    }
  }

  return null;
}
