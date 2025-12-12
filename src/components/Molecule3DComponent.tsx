import { useMemo } from 'react';
import { Cylinder } from '@react-three/drei';
import { Molecule3D } from '../types/molecule';
import { InteractiveAtom } from './AtomTooltip';
import * as THREE from 'three';

interface Molecule3DComponentProps {
  molecule: Molecule3D;
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

      return {
        key: `bond-${index}`,
        position: [midpoint.x, midpoint.y, midpoint.z] as [number, number, number],
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
        
        let radius: number;
        if (bondElement.bondType === 1) {
          radius = 0.1;
        } else if (bondElement.bondType === 2) {
          radius = 0.08;
        } else {
          radius = 0.06;
        }

        if (bondElement.bondType === 1) {
          // Single bond
          return (
            <Cylinder
              key={bondElement.key}
              position={bondElement.position}
              quaternion={bondElement.quaternion}
              args={[radius, radius, bondElement.length, 8]}
            >
              <meshStandardMaterial 
                color="#505050"
                metalness={0.3}
                roughness={0.7}
              />
            </Cylinder>
          );
        } else if (bondElement.bondType === 2) {
          // Double bond - two parallel cylinders
          const offset = 0.2;
          return (
            <group key={bondElement.key}>
              <Cylinder
                position={[
                  bondElement.position[0] + offset,
                  bondElement.position[1],
                  bondElement.position[2]
                ]}
                quaternion={bondElement.quaternion}
                args={[radius, radius, bondElement.length, 8]}
              >
                <meshStandardMaterial 
                  color="#505050"
                  metalness={0.3}
                  roughness={0.7}
                />
              </Cylinder>
              <Cylinder
                position={[
                  bondElement.position[0] - offset,
                  bondElement.position[1],
                  bondElement.position[2]
                ]}
                quaternion={bondElement.quaternion}
                args={[radius, radius, bondElement.length, 8]}
              >
                <meshStandardMaterial 
                  color="#505050"
                  metalness={0.3}
                  roughness={0.7}
                />
              </Cylinder>
            </group>
          );
        } else {
          // Triple bond - three parallel cylinders
          const offset = 0.15;
          return (
            <group key={bondElement.key}>
              <Cylinder
                position={bondElement.position}
                quaternion={bondElement.quaternion}
                args={[radius, radius, bondElement.length, 8]}
              >
                <meshStandardMaterial 
                  color="#505050"
                  metalness={0.3}
                  roughness={0.7}
                />
              </Cylinder>
              <Cylinder
                position={[
                  bondElement.position[0] + offset,
                  bondElement.position[1],
                  bondElement.position[2]
                ]}
                quaternion={bondElement.quaternion}
                args={[radius, radius, bondElement.length, 8]}
              >
                <meshStandardMaterial 
                  color="#505050"
                  metalness={0.3}
                  roughness={0.7}
                />
              </Cylinder>
              <Cylinder
                position={[
                  bondElement.position[0] - offset,
                  bondElement.position[1],
                  bondElement.position[2]
                ]}
                quaternion={bondElement.quaternion}
                args={[radius, radius, bondElement.length, 8]}
              >
                <meshStandardMaterial 
                  color="#505050"
                  metalness={0.3}
                  roughness={0.7}
                />
              </Cylinder>
            </group>
          );
        }
      })}
    </group>
  );
};

export default Molecule3DComponent;
