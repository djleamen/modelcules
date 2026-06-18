import { ChemicalIdentifiers, Molecule3D } from '../types/molecule';

type IdentifierInput = {
  type: keyof ChemicalIdentifiers;
  value: string;
};

type PubChemCompound = {
  atoms?: {
    aid?: number[];
    element?: number[];
  };
  bonds?: {
    aid1?: number[];
    aid2?: number[];
    order?: number[];
  };
  coords?: Array<{
    aid?: number[];
    conformers?: Array<{
      x?: number[];
      y?: number[];
      z?: number[];
    }>;
  }>;
};

const PUBCHEM_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const parseCache = new Map<string, Promise<Molecule3D>>();

const COMMON_OFFLINE_FALLBACKS: Record<string, Molecule3D> = {
  'smiles:o': createWater(),
  'smiles:c': createMethane(),
  'smiles:n': createAmmonia(),
  'smiles:o=c=o': createCarbonDioxide(),
  'smiles:c1ccccc1': createBenzene(),
  'smiles:cco': createEthanol(),
  'iupacname:water': createWater(),
  'iupacname:methane': createMethane(),
  'iupacname:ammonia': createAmmonia(),
  'iupacname:carbon dioxide': createCarbonDioxide(),
  'iupacname:benzene': createBenzene(),
  'iupacname:ethanol': createEthanol(),
  'casnumber:7732-18-5': createWater(),
  'casnumber:74-82-8': createMethane(),
  'casnumber:7664-41-7': createAmmonia(),
  'casnumber:124-38-9': createCarbonDioxide(),
  'casnumber:71-43-2': createBenzene(),
  'casnumber:64-17-5': createEthanol()
};

const ATOMIC_NUMBER_TO_SYMBOL = new Map<number, string>([
  [1, 'H'], [2, 'He'], [3, 'Li'], [4, 'Be'], [5, 'B'], [6, 'C'], [7, 'N'], [8, 'O'], [9, 'F'], [10, 'Ne'],
  [11, 'Na'], [12, 'Mg'], [13, 'Al'], [14, 'Si'], [15, 'P'], [16, 'S'], [17, 'Cl'], [18, 'Ar'], [19, 'K'], [20, 'Ca'],
  [21, 'Sc'], [22, 'Ti'], [23, 'V'], [24, 'Cr'], [25, 'Mn'], [26, 'Fe'], [27, 'Co'], [28, 'Ni'], [29, 'Cu'], [30, 'Zn'],
  [31, 'Ga'], [32, 'Ge'], [33, 'As'], [34, 'Se'], [35, 'Br'], [36, 'Kr'], [37, 'Rb'], [38, 'Sr'], [39, 'Y'], [40, 'Zr'],
  [41, 'Nb'], [42, 'Mo'], [43, 'Tc'], [44, 'Ru'], [45, 'Rh'], [46, 'Pd'], [47, 'Ag'], [48, 'Cd'], [49, 'In'], [50, 'Sn'],
  [51, 'Sb'], [52, 'Te'], [53, 'I'], [54, 'Xe'], [55, 'Cs'], [56, 'Ba'], [57, 'La'], [58, 'Ce'], [59, 'Pr'], [60, 'Nd'],
  [61, 'Pm'], [62, 'Sm'], [63, 'Eu'], [64, 'Gd'], [65, 'Tb'], [66, 'Dy'], [67, 'Ho'], [68, 'Er'], [69, 'Tm'], [70, 'Yb'],
  [71, 'Lu'], [72, 'Hf'], [73, 'Ta'], [74, 'W'], [75, 'Re'], [76, 'Os'], [77, 'Ir'], [78, 'Pt'], [79, 'Au'], [80, 'Hg'],
  [81, 'Tl'], [82, 'Pb'], [83, 'Bi'], [84, 'Po'], [85, 'At'], [86, 'Rn'], [87, 'Fr'], [88, 'Ra'], [89, 'Ac'], [90, 'Th'],
  [91, 'Pa'], [92, 'U'], [93, 'Np'], [94, 'Pu'], [95, 'Am'], [96, 'Cm'], [97, 'Bk'], [98, 'Cf'], [99, 'Es'], [100, 'Fm'],
  [101, 'Md'], [102, 'No'], [103, 'Lr'], [104, 'Rf'], [105, 'Db'], [106, 'Sg'], [107, 'Bh'], [108, 'Hs'], [109, 'Mt'],
  [110, 'Ds'], [111, 'Rg'], [112, 'Cn'], [113, 'Nh'], [114, 'Fl'], [115, 'Mc'], [116, 'Lv'], [117, 'Ts'], [118, 'Og']
]);

export async function parseMolecule(
  type: keyof ChemicalIdentifiers,
  value: string,
  allIdentifiers?: Partial<ChemicalIdentifiers>
): Promise<Molecule3D> {
  const cleanValue = value.trim();
  if (!cleanValue) {
    throw new Error('Empty identifier provided');
  }

  const candidates = buildCandidateInputs(type, cleanValue, allIdentifiers);
  const failureMessages: string[] = [];

  for (const candidate of candidates) {
    try {
      return await parseCandidate(candidate);
    } catch (error) {
      failureMessages.push(error instanceof Error ? error.message : String(error));
    }
  }

  const offlineFallback = findOfflineFallback(candidates);
  if (offlineFallback) {
    return offlineFallback;
  }

  throw new Error(
    `Unable to parse molecule "${cleanValue}". No structure data was found for the provided identifiers.`
      + (failureMessages.length > 0 ? ` Last error: ${failureMessages[0]}` : '')
  );
}

function buildCandidateInputs(
  type: keyof ChemicalIdentifiers,
  value: string,
  allIdentifiers?: Partial<ChemicalIdentifiers>
): IdentifierInput[] {
  const primary: IdentifierInput = { type, value };
  const preferredOrder: Array<keyof ChemicalIdentifiers> = [
    'pubchemCID',
    'smiles',
    'inchi',
    'iupacName',
    'casNumber',
    'chemSpider',
    'unii',
    'ecNumber',
    'eNumber',
    'echaInfoCard',
    'rtecsNumber',
    'compToxDashboard'
  ];

  const fromIdentifiers = preferredOrder
    .map((identifierType) => ({
      type: identifierType,
      value: allIdentifiers?.[identifierType]?.trim() ?? ''
    }))
    .filter((entry) => entry.value.length > 0);

  const unique = new Map<string, IdentifierInput>();
  for (const entry of [primary, ...fromIdentifiers]) {
    const key = getIdentifierKey(entry.type, entry.value);
    if (!unique.has(key)) {
      unique.set(key, entry);
    }
  }

  return [...unique.values()];
}

async function parseCandidate(candidate: IdentifierInput): Promise<Molecule3D> {
  const cacheKey = getIdentifierKey(candidate.type, candidate.value);
  const cachedPromise = parseCache.get(cacheKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  const parsePromise = parseCandidateUncached(candidate);
  parseCache.set(cacheKey, parsePromise);

  try {
    return await parsePromise;
  } catch (error) {
    parseCache.delete(cacheKey);
    throw error;
  }
}

function getIdentifierKey(type: keyof ChemicalIdentifiers, value: string): string {
  const trimmed = value.trim();
  if (type === 'smiles') {
    return `${type}:${trimmed}`;
  }
  return `${type}:${trimmed.toLowerCase()}`;
}

async function parseCandidateUncached(candidate: IdentifierInput): Promise<Molecule3D> {
  const cid = await resolveCid(candidate);
  const compound = await fetchCompoundWithCoordinates(cid);
  return compoundToMolecule3D(compound);
}

async function resolveCid(candidate: IdentifierInput): Promise<number> {
  if (candidate.type === 'pubchemCID') {
    const cid = Number.parseInt(candidate.value, 10);
    if (!Number.isNaN(cid) && cid > 0) {
      return cid;
    }
    throw new Error(`Invalid PubChem CID: ${candidate.value}`);
  }

  const encodedValue = encodeURIComponent(candidate.value);
  const cidLookupUrls = getCidLookupUrls(candidate.type, encodedValue);

  for (const url of cidLookupUrls) {
    try {
      const json = await fetchJson(url) as { IdentifierList?: { CID?: number[] } };
      const cid = json.IdentifierList?.CID?.[0];
      if (typeof cid === 'number' && cid > 0) {
        return cid;
      }
    } catch {
      // Continue trying the next endpoint.
    }
  }

  throw new Error(`No PubChem CID found for ${candidate.type}: ${candidate.value}`);
}

function getCidLookupUrls(type: keyof ChemicalIdentifiers, encodedValue: string): string[] {
  const nameUrl = `${PUBCHEM_BASE_URL}/compound/name/${encodedValue}/cids/JSON`;

  switch (type) {
    case 'smiles':
      return [
        `${PUBCHEM_BASE_URL}/compound/smiles/${encodedValue}/cids/JSON`,
        nameUrl
      ];
    case 'inchi':
      return [
        `${PUBCHEM_BASE_URL}/compound/inchi/${encodedValue}/cids/JSON`,
        nameUrl
      ];
    case 'casNumber':
      return [
        `${PUBCHEM_BASE_URL}/compound/xref/RN/${encodedValue}/cids/JSON`,
        nameUrl
      ];
    case 'unii':
      return [
        `${PUBCHEM_BASE_URL}/compound/xref/RegistryID/${encodedValue}/cids/JSON`,
        nameUrl
      ];
    case 'chemSpider':
      return [
        `${PUBCHEM_BASE_URL}/compound/xref/ExternalID/${encodedValue}/cids/JSON`,
        nameUrl
      ];
    default:
      return [nameUrl];
  }
}

async function fetchCompoundWithCoordinates(cid: number): Promise<PubChemCompound> {
  const urls = [
    `${PUBCHEM_BASE_URL}/compound/cid/${cid}/record/JSON?record_type=3d`,
    `${PUBCHEM_BASE_URL}/compound/cid/${cid}/record/JSON`
  ];

  for (const url of urls) {
    try {
      const json = await fetchJson(url) as { PC_Compounds?: PubChemCompound[] };
      const compound = json.PC_Compounds?.[0];
      if (compound && hasUsableCoordinates(compound)) {
        return compound;
      }
    } catch {
      // Continue to the next record type.
    }
  }

  throw new Error(`No coordinate data found for PubChem CID ${cid}`);
}

function hasUsableCoordinates(compound: PubChemCompound): boolean {
  const conformer = compound.coords?.find((entry) => entry.conformers?.[0]?.x?.length)?.conformers?.[0];
  return Boolean(conformer?.x?.length && conformer?.y?.length);
}

function compoundToMolecule3D(compound: PubChemCompound): Molecule3D {
  const atomIds = compound.atoms?.aid ?? [];
  const atomicNumbers = compound.atoms?.element ?? [];
  const coordinateSet = compound.coords?.find((entry) => entry.conformers?.[0]?.x?.length);
  const conformer = coordinateSet?.conformers?.[0];
  const coordinateAtomIds = coordinateSet?.aid ?? atomIds;
  const xValues = conformer?.x ?? [];
  const yValues = conformer?.y ?? [];
  const zValues = conformer?.z ?? [];

  if (atomIds.length === 0 || atomicNumbers.length !== atomIds.length || xValues.length === 0 || yValues.length === 0) {
    throw new Error('PubChem structure payload is missing required atom or coordinate data');
  }

  const coordinateIndexByAid = new Map<number, number>();
  coordinateAtomIds.forEach((aid, index) => {
    coordinateIndexByAid.set(aid, index);
  });

  const atoms = atomIds.map((aid, index) => {
    const coordinateIndex = coordinateIndexByAid.get(aid) ?? index;
    const atomicNumber = atomicNumbers[index];
    return {
      id: index,
      element: toElementSymbol(atomicNumber),
      x: xValues[coordinateIndex] ?? 0,
      y: yValues[coordinateIndex] ?? 0,
      z: zValues[coordinateIndex] ?? 0
    };
  });

  const aidToAtomIndex = new Map<number, number>();
  atomIds.forEach((aid, index) => {
    aidToAtomIndex.set(aid, index);
  });

  const bondAid1 = compound.bonds?.aid1 ?? [];
  const bondAid2 = compound.bonds?.aid2 ?? [];
  const bondOrders = compound.bonds?.order ?? [];
  const bonds = bondAid1.map((aid1, index) => {
    const aid2 = bondAid2[index];
    const atomIndex1 = aidToAtomIndex.get(aid1);
    const atomIndex2 = aidToAtomIndex.get(aid2);

    if (atomIndex1 === undefined || atomIndex2 === undefined) {
      return null;
    }

    const order = bondOrders[index] ?? 1;
    return {
      atomIndex1,
      atomIndex2,
      bondType: order === 2 || order === 3 ? order : 1
    };
  }).filter((bond): bond is NonNullable<typeof bond> => bond !== null);

  return { atoms, bonds };
}

function toElementSymbol(atomicNumber: number): string {
  return ATOMIC_NUMBER_TO_SYMBOL.get(atomicNumber) ?? 'X';
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PubChem request failed (${response.status})`);
  }
  return response.json();
}

function findOfflineFallback(candidates: IdentifierInput[]): Molecule3D | null {
  for (const candidate of candidates) {
    const key = `${candidate.type}:${candidate.value.trim().toLowerCase()}`;
    const fallback = COMMON_OFFLINE_FALLBACKS[key];
    if (fallback) {
      return fallback;
    }
  }
  return null;
}

function createMethane(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: 0, y: 0, z: 0 },
      { id: 1, element: 'H', x: 1.09, y: 0, z: 0 },
      { id: 2, element: 'H', x: -0.36, y: 1.03, z: 0 },
      { id: 3, element: 'H', x: -0.36, y: -0.51, z: 0.89 },
      { id: 4, element: 'H', x: -0.36, y: -0.51, z: -0.89 }
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 }
    ]
  };
}

function createWater(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'O', x: 0, y: 0, z: 0 },
      { id: 1, element: 'H', x: 0.76, y: 0.59, z: 0 },
      { id: 2, element: 'H', x: -0.76, y: 0.59, z: 0 }
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 }
    ]
  };
}

function createAmmonia(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'N', x: 0, y: 0, z: 0.2 },
      { id: 1, element: 'H', x: 0.94, y: 0, z: -0.2 },
      { id: 2, element: 'H', x: -0.47, y: 0.81, z: -0.2 },
      { id: 3, element: 'H', x: -0.47, y: -0.81, z: -0.2 }
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 }
    ]
  };
}

function createCarbonDioxide(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'O', x: -1.16, y: 0, z: 0 },
      { id: 1, element: 'C', x: 0, y: 0, z: 0 },
      { id: 2, element: 'O', x: 1.16, y: 0, z: 0 }
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 2 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 2 }
    ]
  };
}

function createBenzene(): Molecule3D {
  const atoms: Molecule3D['atoms'] = [];
  const bonds: Molecule3D['bonds'] = [];
  const carbonRadius = 1.4;
  const hydrogenRadius = 2.45;

  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI) / 3;
    atoms.push(
      { id: i, element: 'C', x: carbonRadius * Math.cos(angle), y: carbonRadius * Math.sin(angle), z: 0 },
      { id: i + 6, element: 'H', x: hydrogenRadius * Math.cos(angle), y: hydrogenRadius * Math.sin(angle), z: 0 }
    );
  }

  for (let i = 0; i < 6; i += 1) {
    bonds.push(
      { atomIndex1: i, atomIndex2: (i + 1) % 6, bondType: i % 2 === 0 ? 2 : 1 },
      { atomIndex1: i, atomIndex2: i + 6, bondType: 1 }
    );
  }

  return { atoms, bonds };
}

function createEthanol(): Molecule3D {
  return {
    atoms: [
      { id: 0, element: 'C', x: -1.2, y: 0, z: 0 },
      { id: 1, element: 'C', x: 0, y: 0, z: 0 },
      { id: 2, element: 'O', x: 1.3, y: 0, z: 0 },
      { id: 3, element: 'H', x: -1.6, y: 1.03, z: 0 },
      { id: 4, element: 'H', x: -1.6, y: -0.51, z: 0.89 },
      { id: 5, element: 'H', x: -1.6, y: -0.51, z: -0.89 },
      { id: 6, element: 'H', x: 0, y: 1.03, z: 0 },
      { id: 7, element: 'H', x: 0, y: -0.51, z: 0.89 },
      { id: 8, element: 'H', x: 1.7, y: 0, z: 0 }
    ],
    bonds: [
      { atomIndex1: 0, atomIndex2: 1, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 2, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 3, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 4, bondType: 1 },
      { atomIndex1: 0, atomIndex2: 5, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 6, bondType: 1 },
      { atomIndex1: 1, atomIndex2: 7, bondType: 1 },
      { atomIndex1: 2, atomIndex2: 8, bondType: 1 }
    ]
  };
}
