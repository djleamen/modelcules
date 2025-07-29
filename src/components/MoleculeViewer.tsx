import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { MoleculeData, Molecule3D, ChemicalIdentifiers } from '../types/molecule';
import Molecule3DComponent from './Molecule3DComponent';
import { parseMolecule } from '../utils/moleculeParser';

interface MoleculeViewerProps {
  molecule: MoleculeData | null;
  allIdentifiers?: Partial<ChemicalIdentifiers>;
}

const MoleculeViewer: React.FC<MoleculeViewerProps> = ({ molecule, allIdentifiers }) => {
  const [molecule3D, setMolecule3D] = useState<Molecule3D | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMolecule = async () => {
      if (!molecule || !molecule.value.trim()) {
        setMolecule3D(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await parseMolecule(molecule.type, molecule.value, allIdentifiers);
        setMolecule3D(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse molecule');
        setMolecule3D(null);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the parsing to avoid too many requests while typing
    const timeoutId = setTimeout(loadMolecule, 300);
    return () => clearTimeout(timeoutId);
  }, [molecule, allIdentifiers]);

  if (!molecule || !molecule.value.trim()) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="text-white/60 mb-6">
            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
            </svg>
          </div>
          <h2 className="text-white text-2xl font-light mb-4">Enter a chemical identifier</h2>
          <p className="text-white/80 text-lg">Start typing in the panel to view 3D molecular structures</p>
          <p className="text-white/60 text-sm mt-4">Use the button in the top-left to open the identifier panel</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white/60 mx-auto mb-6"></div>
          <p className="text-white text-lg">Parsing molecule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="text-red-400 mb-6">
            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-red-400 text-xl mb-4">Unable to parse molecule</h2>
          <p className="text-red-300 text-sm max-w-md mx-auto">{error}</p>
        </div>
      </div>
    );
  }

  if (!molecule3D || molecule3D.atoms.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="text-center">
          <div className="text-yellow-400 mb-6">
            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-yellow-400 text-xl mb-4">No structure found</h2>
          <p className="text-yellow-300 text-sm max-w-md mx-auto">The molecule could not be converted to 3D coordinates</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [10, 10, 10], fov: 50 }}
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)' }}
      >
        <Suspense fallback={
          <Text
            position={[0, 0, 0]}
            color="white"
            fontSize={1}
            maxWidth={200}
            lineHeight={1}
            letterSpacing={0.02}
            textAlign="center"
            font="https://fonts.gstatic.com/s/raleway/v14/1Ptrg8zYS_SKggPNwK4vaqI.woff"
          >
            Loading 3D Model...
          </Text>
        }>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <pointLight position={[-10, -10, -5]} intensity={0.5} />
          
          <Molecule3DComponent molecule={molecule3D} />
          
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={50}
          />
        </Suspense>
      </Canvas>
      
      {/* Info overlay */}
      <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm text-white px-4 py-2 rounded-lg">
        <p className="text-sm">{molecule3D.atoms.length} atoms, {molecule3D.bonds.length} bonds</p>
        <p className="text-xs text-white/80 mt-1">Drag to rotate • Scroll to zoom • Right-click to pan</p>
      </div>
    </div>
  );
};

export default MoleculeViewer;
