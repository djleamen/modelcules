import { MoleculeEntry } from '../types/molecule';
import { ChemicalIdentifiers } from '../types/molecule';

interface HistoryFavouritesPanelProps {
  entries: MoleculeEntry[];
  emptyMessage: string;
  onRestore: (identifiers: ChemicalIdentifiers) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  isFavourite: (identifiers: ChemicalIdentifiers) => boolean;
  onToggleFavourite: (identifiers: ChemicalIdentifiers) => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

const HistoryFavouritesPanel = ({
  entries,
  emptyMessage,
  onRestore,
  onRemove,
  onClearAll,
  isFavourite,
  onToggleFavourite,
}: HistoryFavouritesPanelProps) => {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{entries.length} molecule{entries.length !== 1 ? 's' : ''}</span>
        <button
          onClick={onClearAll}
          className="text-xs text-red-500 hover:text-red-700 transition-colors"
        >
          Clear all
        </button>
      </div>
      <ul className="space-y-1.5">
        {entries.map(entry => (
          <li
            key={entry.id}
            className="flex items-center gap-2 p-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors group"
          >
            {/* Restore button */}
            <button
              onClick={() => onRestore(entry.identifiers)}
              className="flex-1 text-left min-w-0"
              title="Load this molecule"
            >
              <p className="text-xs font-medium text-gray-800 truncate">{entry.displayName}</p>
              <p className="text-xs text-gray-400">{formatTime(entry.timestamp)}</p>
            </button>

            {/* Favourite star */}
            <button
              onClick={() => onToggleFavourite(entry.identifiers)}
              className={`flex-shrink-0 p-0.5 transition-colors ${
                isFavourite(entry.identifiers)
                  ? 'text-yellow-400 hover:text-yellow-500'
                  : 'text-gray-300 hover:text-yellow-400'
              }`}
              title={isFavourite(entry.identifiers) ? 'Remove from favourites' : 'Add to favourites'}
              aria-label={isFavourite(entry.identifiers) ? 'Remove from favourites' : 'Add to favourites'}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>

            {/* Remove button */}
            <button
              onClick={() => onRemove(entry.id)}
              className="flex-shrink-0 p-0.5 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Remove"
              aria-label={`Remove ${entry.displayName}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HistoryFavouritesPanel;
