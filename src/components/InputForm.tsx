import { ChemicalIdentifiers } from '../types/molecule';

interface InputFormProps {
  identifiers: ChemicalIdentifiers;
  onInputChange: (field: keyof ChemicalIdentifiers, value: string) => void | Promise<void>;
  sourceField?: keyof ChemicalIdentifiers | null;
  isLookingUp?: boolean;
  onClearAll?: () => void;
  lookupError?: string | null;
  lookupSource?: string | null;
}

const inputFields = [
  { key: 'iupacName' as keyof ChemicalIdentifiers, label: 'IUPAC Name', placeholder: 'e.g., 2-methylpropane' },
  { key: 'casNumber' as keyof ChemicalIdentifiers, label: 'CAS Number', placeholder: 'e.g., 75-28-5' },
  { key: 'pubchemCID' as keyof ChemicalIdentifiers, label: 'PubChem CID', placeholder: 'e.g., 6344' },
  { key: 'unii' as keyof ChemicalIdentifiers, label: 'UNII', placeholder: 'e.g., 142M471B3J' },
  { key: 'inchi' as keyof ChemicalIdentifiers, label: 'InChI', placeholder: 'e.g., InChI=1S/C4H10/c1-3-4-2/h3-4H2,1-2H3' },
  { key: 'smiles' as keyof ChemicalIdentifiers, label: 'SMILES', placeholder: 'e.g., CCCC' },
];

const InputForm = ({ 
  identifiers, 
  onInputChange, 
  sourceField, 
  isLookingUp = false, 
  onClearAll,
  lookupError,
  lookupSource 
}: InputFormProps) => {
  return (
    <div className="p-4 h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Chemical Identifiers</h2>
          <p className="text-xs text-gray-600">Enter any identifier to visualize in 3D</p>
        </div>
        {onClearAll && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title="Clear all fields"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Clear
          </button>
        )}
      </div>

      {isLookingUp && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center gap-2">
            <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-xs text-blue-700">Looking up related identifiers...</span>
          </div>
        </div>
      )}
      
      {lookupError && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs text-red-700">Lookup failed: {lookupError}</span>
          </div>
        </div>
      )}
      
      {lookupSource && !isLookingUp && !lookupError && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-green-700">Identifiers loaded from {lookupSource}</span>
          </div>
        </div>
      )}
      
      <div className="space-y-3 mb-4">
        {inputFields.map((field) => {
          const isSourceField = sourceField === field.key;
          const isReadOnly = Boolean(sourceField && !isSourceField);
          const hasValue = identifiers[field.key].trim() !== '';
          
          let labelClassName: string;
          if (isSourceField) {
            labelClassName = 'text-blue-700';
          } else if (isReadOnly) {
            labelClassName = 'text-gray-500';
          } else {
            labelClassName = 'text-gray-700';
          }
          
          let inputClassName: string;
          if (isSourceField) {
            inputClassName = 'border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white/90';
          } else if (isReadOnly) {
            inputClassName = 'border-gray-200 bg-gray-50/90 text-gray-600 cursor-not-allowed';
          } else {
            inputClassName = 'border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white/90';
          }
          
          return (
            <div key={field.key} className="space-y-1">
              <label 
                htmlFor={field.key}
                className={`block text-xs font-medium ${labelClassName}`}
              >
                {field.label}
                {isSourceField && (
                  <span className="ml-1 text-blue-600 font-normal">(source)</span>
                )}
                {isReadOnly && hasValue && (
                  <span className="ml-1 text-gray-500 font-normal">(auto-filled)</span>
                )}
              </label>
              <input
                type="text"
                id={field.key}
                value={identifiers[field.key]}
                onChange={(e) => onInputChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                readOnly={isReadOnly}
                className={`w-full px-2 py-1.5 text-sm border rounded shadow-sm transition-colors ${inputClassName}`}
              />
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-blue-50/90 rounded border border-blue-200">
        <h3 className="text-xs font-medium text-blue-900 mb-2">Quick Examples</h3>
        <div className="space-y-1">
          <button
            onClick={() => onInputChange('smiles', 'CCO')}
            className="w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100/90 px-2 py-1 rounded transition-colors"
            disabled={isLookingUp}
          >
            <span className="font-medium">CCO</span> - Ethanol
          </button>
          <button
            onClick={() => onInputChange('smiles', 'c1ccccc1')}
            className="w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100/90 px-2 py-1 rounded transition-colors"
            disabled={isLookingUp}
          >
            <span className="font-medium">c1ccccc1</span> - Benzene
          </button>
          <button
            onClick={() => onInputChange('smiles', 'CC(=O)O')}
            className="w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100/90 px-2 py-1 rounded transition-colors"
            disabled={isLookingUp}
          >
            <span className="font-medium">CC(=O)O</span> - Acetic acid
          </button>
          <button
            onClick={() => onInputChange('smiles', 'O=C=O')}
            className="w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100/90 px-2 py-1 rounded transition-colors"
            disabled={isLookingUp}
          >
            <span className="font-medium">O=C=O</span> - Carbon dioxide
          </button>
          <button
            onClick={() => onInputChange('smiles', 'O')}
            className="w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100/90 px-2 py-1 rounded transition-colors"
            disabled={isLookingUp}
          >
            <span className="font-medium">O</span> - Water
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputForm;
