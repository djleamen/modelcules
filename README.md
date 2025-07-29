# Modelcules 🧬

**3D Molecular Visualization Platform**

Modelcules is a sophisticated web application for visualizing 3D molecular structures from chemical identifiers. Built with React, Three.js, and TypeScript, it offers real-time 3D rendering of molecules with an intelligent multi-database chemical lookup system.

![Modelcules Screenshot](https://via.placeholder.com/800x400?text=Modelcules+3D+Molecular+Visualization)

## ✨ Features

### 🔍 **Multi-Database Chemical Lookup**
- **Comprehensive Identifier Support**: IUPAC names, CAS numbers, PubChem CIDs, SMILES, InChI, UNII codes, and more
- **Multi-Database Integration**: PubChem API and NCI/CACTUS with intelligent failover
- **Local Database**: Fast lookup for 50+ common compounds (caffeine, aspirin, glucose, etc.)
- **Smart Caching**: 1-hour TTL with automatic cleanup to minimize API calls
- **Input Validation**: Pre-validation to prevent unnecessary database queries
- **Confidence Scoring**: Quality assessment of lookup results

### 🎨 **3D Visualization Engine**
- **Real-time 3D Rendering**: Powered by Three.js and React Three Fiber
- **CPK Color Scheme**: Standard atomic coloring (C=gray, N=blue, O=red, etc.)
- **Van der Waals Radii**: Scientifically accurate atomic sizes
- **Interactive Controls**: Mouse/touch orbit, zoom, and pan
- **Bond Visualization**: Single, double, and triple bond representation
- **Responsive Design**: Adapts to any screen size

### 🧠 **Intelligent Parsing System**
- **Multi-Format Support**: SMILES, InChI, IUPAC names, CAS numbers, PubChem CIDs
- **Fallback Mechanisms**: Automatic fallback from unknown CIDs to SMILES/InChI
- **Structure Library**: Hand-crafted 3D coordinates for complex molecules
- **Dynamic Molecular Assembly**: Algorithmic generation for simple compounds

### 🎯 **User Experience**
- **Real-time Auto-population**: Enter any identifier and watch other fields fill automatically
- **Source Tracking**: Visual indicators showing data source (Local/PubChem/NCI CACTUS)
- **Error Handling**: User-friendly error messages with suggestions
- **Loading States**: Smooth loading animations during API calls
- **Responsive UI**: Clean, modern interface with Tailwind CSS

## 🏗️ Architecture

### **Frontend Stack**
```
React 18 + TypeScript
├── Three.js (3D Graphics Engine)
├── React Three Fiber (React Three.js Integration)
├── React Three Drei (3D Components & Helpers)
├── Tailwind CSS (Styling Framework)
└── Vite (Build Tool & Dev Server)
```

### **Project Structure**
```
src/
├── components/           # React Components
│   ├── AtomTooltip.tsx      # Atom information display
│   ├── InputForm.tsx        # Chemical identifier input form
│   ├── Molecule3DComponent.tsx  # 3D molecule renderer
│   └── MoleculeViewer.tsx   # Main visualization container
├── types/               # TypeScript Definitions
│   └── molecule.ts         # Chemical data structures
├── utils/               # Core Logic
│   ├── identifierLookup.ts # Multi-database lookup system
│   └── moleculeParser.ts   # SMILES/structure parsing
├── App.tsx             # Main application component
└── main.tsx           # Application entry point
```

### **Data Flow Architecture**
```
User Input → Validation → Cache Check → Database Lookup → Structure Parsing → 3D Rendering
     ↓            ↓           ↓             ↓              ↓             ↓
InputForm → identifierLookup → Local DB → PubChem API → moleculeParser → Three.js
                                    ↓
                               NCI/CACTUS API
```

### **Core Systems**

#### **1. Chemical Identifier Lookup (`identifierLookup.ts`)**
- **Multi-Database Architecture**: Hierarchical database priority system
- **Caching Layer**: Map-based cache with TTL and automatic cleanup
- **Validation Engine**: Pre-validation patterns for each identifier type
- **Error Handling**: Graceful degradation with user-friendly messages
- **Confidence Scoring**: Quality assessment based on data completeness

#### **2. Molecular Structure Parser (`moleculeParser.ts`)**
- **SMILES Parser**: Pattern matching for common molecular structures
- **3D Coordinate Generation**: Hand-crafted coordinates for accurate visualization
- **Fallback System**: Multiple parsing strategies for unknown compounds
- **Structure Library**: 70+ pre-defined molecular structures

#### **3. 3D Rendering Engine (`Molecule3DComponent.tsx`)**
- **Atomic Representation**: Spheres with CPK coloring and van der Waals radii
- **Bond Rendering**: Cylinders representing single/double/triple bonds
- **Molecular Centering**: Automatic centering and scaling
- **Interactive Controls**: Orbit controls for user interaction

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ 
- npm or yarn package manager

### **Installation**
```bash
# Clone the repository
git clone https://github.com/djleamen/modelcules.git
cd modelcules

# Install dependencies
npm install

# Start development server
npm run dev
```

### **Usage**
1. **Open the application** in your browser (typically `http://localhost:5173`)
2. **Click the menu button** (top-right) to open the identifier panel
3. **Enter any chemical identifier**:
   - IUPAC Name: `caffeine`, `aspirin`, `glucose`
   - CAS Number: `58-08-2` (caffeine)
   - PubChem CID: `2519` (caffeine)
   - SMILES: `CN1C=NC2=C1C(=O)N(C(=O)N2C)C`
4. **Watch the 3D structure render** automatically
5. **Interact with the molecule**: rotate, zoom, and explore

### **Build for Production**
```bash
npm run build
npm run preview
```

## 📊 Supported Chemical Identifiers

| Identifier Type | Example | Description |
|----------------|---------|-------------|
| **IUPAC Name** | `1,3,7-trimethylpurine-2,6-dione` | Standard chemical nomenclature |
| **CAS Number** | `58-08-2` | Chemical Abstracts Service registry |
| **PubChem CID** | `2519` | PubChem compound identifier |
| **SMILES** | `CN1C=NC2=C1C(=O)N(C(=O)N2C)C` | Simplified molecular input line entry |
| **InChI** | `InChI=1S/C8H10N4O2/c1-10-4-9-6...` | International chemical identifier |
| **UNII** | `3G6A5W338E` | FDA unique ingredient identifier |
| **ChemSpider** | `2424` | Royal Society of Chemistry database |

## 🎯 Current Capabilities

### **Molecule Library** (70+ Structures)
- **Simple Molecules**: Water, methane, ethanol, benzene
- **Pharmaceuticals**: Caffeine, aspirin, glucose
- **Organic Compounds**: Alkanes, alkenes, alcohols, acids
- **Complex Structures**: Purine derivatives, sugar molecules

### **Database Integration**
- **Local Database**: 50+ common compounds for instant lookup
- **PubChem API**: Millions of chemical compounds
- **NCI/CACTUS**: Structure conversion and validation
- **Intelligent Failover**: Automatic fallback between databases

## ⚠️ Current Issues & Limitations

### **Known Issues**
1. **Limited SMILES Parser**: Only supports ~20 common SMILES patterns
   - Complex molecules default to fallback structures
   - Stereochemistry information is not preserved
   
2. **Static 3D Coordinates**: Most structures use hand-crafted coordinates
   - No automatic 3D structure generation from SMILES
   - Some molecules may have suboptimal geometries

3. **API Rate Limiting**: No rate limiting implemented for external APIs
   - Potential for hitting PubChem/NCI rate limits
   - No retry strategies for failed requests

4. **Browser Compatibility**: Limited testing on older browsers
   - WebGL requirements for 3D rendering
   - Modern JavaScript features may not work on legacy browsers

5. **Performance Issues**: 
   - Large molecules (>100 atoms) may cause rendering lag
   - No Level-of-Detail (LOD) optimization for complex structures

### **UX/UI Limitations**
- No search history or favorites system
- Limited keyboard shortcuts
- No full-screen mode for 3D viewer
- No export functionality (screenshots, models)

## 🚧 Future Enhancements

### **High Priority**
- [ ] **Advanced SMILES Parser**: Implement comprehensive SMILES parsing library
- [ ] **Automatic 3D Generation**: Integrate RDKit or similar for structure generation
- [ ] **Search History**: Local storage for recently viewed molecules
- [ ] **Export Features**: PNG/SVG export, 3D model download
- [ ] **Performance Optimization**: Level-of-detail rendering for large molecules

### **Medium Priority**
- [ ] **Additional Databases**: ChEMBL, DrugBank, ZINC database integration
- [ ] **Molecular Properties**: Display molecular weight, formula, properties
- [ ] **Animation System**: Molecular vibrations, conformational changes
- [ ] **Comparison Mode**: Side-by-side molecule comparison
- [ ] **Mobile Optimization**: Touch-friendly controls and responsive design

### **Low Priority**
- [ ] **Protein Support**: PDB file import and protein visualization
- [ ] **Reaction Visualization**: Chemical reaction animation
- [ ] **Educational Features**: Orbital visualization, electron density maps
- [ ] **Collaborative Features**: Share molecule links, comments
- [ ] **API Development**: REST API for programmatic access

## 🔧 Development

### **Scripts**
```bash
npm run dev      # Start development server
npm run build    # Build for production  
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### **Key Technologies**
- **React 18**: Component framework with hooks
- **TypeScript**: Type-safe JavaScript development
- **Three.js**: WebGL-based 3D graphics library
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework

### **Contributing**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PubChem**: For providing free chemical data API
- **NCI/CACTUS**: For chemical structure conversion services
- **Three.js Community**: For excellent 3D graphics tools
- **React Three Fiber**: For seamless React-Three.js integration
- **Chemical Data Sources**: CAS, ChemSpider, and other chemical databases