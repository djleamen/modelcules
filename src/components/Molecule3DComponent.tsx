import { useMemo } from 'react';
import { Cylinder } from '@react-three/drei';
import { Molecule3D } from '../types/molecule';
import { InteractiveAtom } from './AtomTooltip';
import * as THREE from 'three';

interface Molecule3DComponentProps {
  molecule: Molecule3D;
}

type Vec3 = [number, number, number];

const BOND_COLOR = '#505050';

// One bond cylinder. Factored out so the single/double/triple cases below
// don't each repeat the mesh + material markup.
function BondCylinder({
  position,
  quaternion,
  radius,
  length,
}: {
  position: Vec3;
  quaternion: [number, number, number, number];
  radius: number;
  length: number;
}) {
  return (
    <Cylinder position={position} quaternion={quaternion} args={[radius, radius, length, 8]}>
      <meshStandardMaterial color={BOND_COLOR} metalness={0.3} roughness={0.7} />
    </Cylinder>
  );
}

// Shift a point along an axis by a signed distance — used to place the
// parallel cylinders of a double/triple bond beside the bond line.
function shiftAlong(position: Vec3, axis: Vec3, distance: number): Vec3 {
  return [
    position[0] + axis[0] * distance,
    position[1] + axis[1] * distance,
    position[2] + axis[2] * distance,
  ];
}

// Element colors (CPK coloring scheme)
const elementColors: { [key: string]: string } = {
  'H': '#FFFFFF',   // White
  'C': '#909090',   // Gray
  'N': '#3050F8',   // Blue
  'O': '#FF0D0D',   // Red
  'F': '#90E050',   // Green
  'Cl': '#1FF01F',  // Green
  'Br': '#A62929',  // Brown
  'I': '#940094',   // Purple
  'S': '#FFFF30',   // Yellow
  'P': '#FF8000',   // Orange
  'B': '#FFB5B5',   // Pink
  'Si': '#F0C8A0',  // Tan
  'X': '#FF69B4',   // Hot pink for placeholder/unknown atoms
  'default': '#FF1493' // Hot pink for unknown elements
};

// Van der Waals radii (in Angstroms, scaled down for visualization)
const elementRadii: { [key: string]: number } = {
  'H': 0.4,
  'C': 0.7,
  'N': 0.65,
  'O': 0.6,
  'F': 0.57,
  'Cl': 0.99,
  'Br': 1.14,
  'I': 1.33,
  'S': 1,
  'P': 1,
  'B': 0.85,
  'Si': 1.1,
  'X': 0.8,   // Placeholder atoms
  'default': 0.8
};

const Molecule3DComponent = ({ molecule }: Molecule3DComponentProps) => {
  const { atoms, bonds } = molecule;

  // Calculate bond count for each atom
  const atomBondCounts = useMemo(() => {
    const counts: { [atomId: number]: number } = {};
    atoms.forEach(atom => {
      counts[atom.id] = 0;
    });
    bonds.forEach(bond => {
      counts[bond.atomIndex1] = (counts[bond.atomIndex1] || 0) + 1;
      counts[bond.atomIndex2] = (counts[bond.atomIndex2] || 0) + 1;
    });
    return counts;
  }, [atoms, bonds]);

  // Center the molecule
  const centeredAtoms = useMemo(() => {
    if (atoms.length === 0) return atoms;

    const center = atoms.reduce(
      (acc, atom) => ({
        x: acc.x + atom.x / atoms.length,
        y: acc.y + atom.y / atoms.length,
        z: acc.z + atom.z / atoms.length,
      }),
      { x: 0, y: 0, z: 0 }
    );

    return atoms.map(atom => ({
      ...atom,
      x: atom.x - center.x,
      y: atom.y - center.y,
      z: atom.z - center.z,
    }));
  }, [atoms]);

  // Calculate bond positions and orientations
  const bondElements = useMemo(() => {
    return bonds.map((bond, index) => {
      const atom1 = centeredAtoms[bond.atomIndex1];
      const atom2 = centeredAtoms[bond.atomIndex2];
      
      if (!atom1 || !atom2) return null;

      const start = new THREE.Vector3(atom1.x, atom1.y, atom1.z);
      const end = new THREE.Vector3(atom2.x, atom2.y, atom2.z);
      const direction = new THREE.Vector3().subVectors(end, start);
      const distance = direction.length();
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

      // Create rotation matrix to align cylinder with bond direction
      const quaternion = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      quaternion.setFromUnitVectors(up, direction.normalize());

      // Axis to separate the parallel cylinders of a double/triple bond. It
      // must be perpendicular to the bond, otherwise the cylinders are offset
      // *along* the bond and overlap (e.g. CO2's axis-aligned O=C=O). Cross the
      // bond direction with an up vector, falling back to another axis when the
      // bond is itself vertical.
      let perp = new THREE.Vector3().crossVectors(direction, up);
      if (perp.lengthSq() < 1e-6) {
        perp = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(1, 0, 0));
      }
      perp.normalize();

      return {
        key: `bond-${index}`,
        position: [midpoint.x, midpoint.y, midpoint.z] as [number, number, number],
        offsetAxis: [perp.x, perp.y, perp.z] as [number, number, number],
        quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] as [number, number, number, number],
        length: distance,
        bondType: bond.bondType
      };
    }).filter(Boolean);
  }, [bonds, centeredAtoms]);

  return (
    <group>
      {/* Render atoms */}
      {centeredAtoms.map((atom) => (
        <InteractiveAtom
          key={`atom-${atom.id}`}
          element={atom.element}
          bondCount={atomBondCounts[atom.id] || 0}
          position={[atom.x, atom.y, atom.z]}
          radius={elementRadii[atom.element] || elementRadii.default}
          color={elementColors[atom.element] || elementColors.default}
        />
      ))}

      {/* Render bonds */}
      {bondElements.map((bondElement) => {
        if (!bondElement) return null;

        const { key, position, quaternion, offsetAxis, length, bondType } = bondElement;
        let radius: number;
        if (bondType === 1) {
          radius = 0.1;
        } else if (bondType === 2) {
          radius = 0.08;
        } else {
          radius = 0.06;
        }

        if (bondType === 1) {
          // Single bond
          return (
            <BondCylinder key={key} position={position} quaternion={quaternion} radius={radius} length={length} />
          );
        }

        // Double/triple bonds: parallel cylinders offset perpendicular to the
        // bond; a triple bond also keeps one cylinder on the bond line.
        const offset = bondType === 2 ? 0.2 : 0.15;
        return (
          <group key={key}>
            {bondType === 3 && (
              <BondCylinder position={position} quaternion={quaternion} radius={radius} length={length} />
            )}
            <BondCylinder position={shiftAlong(position, offsetAxis, offset)} quaternion={quaternion} radius={radius} length={length} />
            <BondCylinder position={shiftAlong(position, offsetAxis, -offset)} quaternion={quaternion} radius={radius} length={length} />
          </group>
        );
      })}
    </group>
  );
};

export default Molecule3DComponent;
