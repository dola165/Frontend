import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

interface Result {
    key: string;
    title: string;
    entityType: string;
    subtitle: string | null;
    startsAt: string | null;
    clubId: number | null;
    distanceKm: number | null;
}

/** The same results as the pins, usable without WebGL, tiles or a pointer. */
export const MapResultsList = ({ isVisible, embedded, darkMode, records, selectedKey, loading, resultsLimited, radiusKm, onSelect, onClose }: {
    isVisible: boolean;
    embedded: boolean;
    darkMode: boolean;
    records: Result[];
    selectedKey: string | null;
    loading: boolean;
    resultsLimited: boolean;
    radiusKm: number;
    onSelect: (key: string) => void;
    onClose: () => void;
}) => {
    if (!isVisible) return null;
    return <aside aria-label="Nearby results" style={{ backgroundColor: darkMode ? '#0d1016' : '#fff' }} className={`pointer-events-auto ${embedded ? 'absolute inset-y-0' : 'fixed bottom-0 top-[var(--app-active-header-height)]'} right-0 z-[1090] flex w-[min(94vw,360px)] flex-col border-l border-[var(--map-panel-border)] bg-[var(--map-panel-bg)] text-[var(--text-primary)] shadow-xl`}>
        <header className="border-b border-[var(--map-panel-border)] p-5">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Nearby results</h2>
                <button type="button" aria-label="Close results" onClick={onClose} className="p-2"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-2 text-sm" role="status">{loading ? 'Searching…' : `${records.length} shown within ${radiusKm} km`}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Search includes up to 100 nearest results per type. {resultsLimited ? 'More exist: narrow the area or filters to find them.' : 'Counts describe this search, not the full directory.'}</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!loading && records.length === 0 && <p>No results for this search. Try another area or change the filters.</p>}
            <ol className="space-y-3">
                {records.map(record => <li key={record.key} className="rounded-xl border border-[var(--map-panel-border)] p-3">
                    <button type="button" onClick={() => onSelect(record.key)} aria-pressed={selectedKey === record.key} className="w-full text-left">
                        <span className="block text-xs text-[var(--text-secondary)]">{record.entityType}</span>
                        <span className="mt-1 block font-bold">{record.title}</span>
                        <span className="mt-1 block text-sm">{record.subtitle}</span>
                        {record.startsAt && <span className="mt-1 block text-xs">{record.startsAt}</span>}
                        {record.distanceKm != null && <span className="mt-1 block text-xs">{record.distanceKm.toFixed(1)} km away</span>}
                    </button>
                    {record.clubId != null && <Link className="mt-3 inline-block text-sm font-bold underline" to={`/clubs/${record.clubId}`}>View club</Link>}
                </li>)}
            </ol>
        </div>
    </aside>;
};
