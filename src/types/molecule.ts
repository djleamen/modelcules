export interface ChemicalIdentifiers {
  iupacName: string;
  casNumber: string;
  chemSpider: string;
  echaInfoCard: string;
  ecNumber: string;
  eNumber: string;
  pubchemCID: string;
  rtecsNumber: string;
  unii: string;
  compToxDashboard: string;
  inchi: string;
  smiles: string;
}

export interface MoleculeData {
  type: keyof ChemicalIdentifiers;
  value: string;
}

export interface Atom {
  element: string;
  x: number;
  y: number;
  z: number;
  id: number;
}

export interface Bond {
  atomIndex1: number;
  atomIndex2: number;
  bondType: number; // 1 = single, 2 = double, 3 = triple
}

export interface Molecule3D {
  atoms: Atom[];
  bonds: Bond[];
}
