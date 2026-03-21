/**
 * AtomTooltip and InteractiveAtom Components
 * This file defines two React components for use in a 3D molecular visualization:
 * 1. AtomTooltip: Displays a tooltip with information about an atom when hovered over.
 * 2. InteractiveAtom: Represents an atom in 3D space that responds to hover events by scaling up and showing the tooltip.
 * 
 * Written by DJ Leamen, 2025-2026
 */

import { useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';

interface AtomTooltipProps {
  element: string;
  bondCount: number;
  position: [number, number, number];
}

export const AtomTooltip = ({ element, bondCount, position }: AtomTooltipProps) => {
  /**
   * Get a description of the bond count
   * 
   * @param element Chemical element symbol
   * @param bondCount Number of bonds 
   * @param position 3D position of the tooltip
   * @returns Description string
   */
  const getBondDescription = (count: number) => {
    /**
     * Returns a string description based on the bond count
     * @param count Number of bonds
     * @returns Description string
     */
    if (count === 0) return 'no bonds';
    if (count === 1) return '1 bond';
    return `${count} bonds`;
  };

  const getAtomDescription = (element: string) => {
    /**
     * Returns a string description based on the element symbol
     * @param element Chemical element symbol
     * @returns Description string
     */
    if (element === 'X') return 'Complex structure';
    return `${element} atom`;
  };

  return (
    <Html
      position={position}
      distanceFactor={6}
      occlude={false}
      center
      style={{
        pointerEvents: 'none',
        transform: 'translate(10px, -40px)',
        zIndex: 1000
      }}
    >
      <div 
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#ffffff' }}>
          {getAtomDescription(element)}
        </div>
        <div style={{ color: '#dddddd', fontSize: '12px' }}>
          {getBondDescription(bondCount)}
        </div>
      </div>
    </Html>
  );
};

interface InteractiveAtomProps {
  element: string;
  bondCount: number;
  position: [number, number, number];
  radius: number;
  color: string;
  onHover?: (hovered: boolean) => void;
  children?: React.ReactNode;
}

export const InteractiveAtom = ({ 
  element, 
  bondCount, 
  position, 
  radius, 
  color, 
  onHover,
  children 
}: InteractiveAtomProps) => {
  /**
   * State to track if the atom is hovered
   * 
   * @param element Chemical element symbol
   * @param bondCount Number of bonds 
   * @param position 3D position of the atom
   * @param radius Radius of the atom sphere
   * @param color Color of the atom sphere
   * @param onHover Optional callback for hover state changes
   * @param children Optional child components (e.g., bonds)
   * @returns InteractiveAtom component
   */
  const [hovered, setHovered] = useState(false);

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    console.log(`Hovering over ${element} atom with ${bondCount} bonds`);
    setHovered(true);
    onHover?.(true);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
    onHover?.(false);
  };

  return (
    <group>
      <mesh
        position={position}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        scale={hovered ? 1.3 : 1}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial 
          color={hovered ? '#ffffff' : color}
          metalness={0.1}
          roughness={0.3}
          emissive={hovered ? '#4444ff' : '#000000'}
          emissiveIntensity={hovered ? 0.5 : 0}
        />
      </mesh>
      
      {hovered && (
        <AtomTooltip
          element={element}
          bondCount={bondCount}
          position={[position[0] + 1, position[1] + 1, position[2]]}
        />
      )}
      
      {children}
    </group>
  );
};
