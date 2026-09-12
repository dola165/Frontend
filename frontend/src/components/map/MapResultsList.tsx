import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, Footprints, MapPin, ShieldCheck, X } from 'lucide-react';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
interface Result {
    key: string; title: string; entityType: string; subtitle: string | null; startsAt: string | null;
    clubId: number | null; distanceKm: number | null; official?: boolean; logoUrl?: string | null;
    cityName?: string | null; locationName?: string | null;
}
/** Pin and list selection use the same keys. The list remains usable when tiles are unavailable. */
export const MapResultsList = ({ isVisible, records, selectedKey, loading, resultsLimited, coverageSummary, areaSearch, hasOrigin, onSelect, onWalk, onClose, onLoadMore, loadingMore }: {
    isVisible: boolean; embedded: boolean; darkMode: boolean; records: Result[]; selectedKey: string | null;
    loading: boolean; resultsLimited: boolean; coverageSummary: string; areaSearch?: boolean; hasOrigin?: boolean;
    onSelect: (key: string) => void; onWalk: (key: string) => void; onClose: () => void;
    onLoadMore?: () => void; loadingMore?: boolean;
}) => {
    const [sort, setSort] = useState('nearest');
    const sorted = useMemo(() => [...records].sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title)
        : (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.title.localeCompare(b.title)), [records, sort]);
    if (!isVisible) return null;
    return <aside aria-label="Nearby results" className="atlas-results">
        <header>
            <div className="atlas-results-heading"><span className="atlas-eyebrow"><MapPin size={14} /> EXPLORE THE AREA</span><button aria-label="Close results" onClick={onClose}><X size={18} /></button></div>
            <h2>Find your people<span>.</span></h2>
            <div className="atlas-results-summary"><p role="status"><strong>{loading ? '…' : records.length}</strong> {coverageSummary}</p><label><span className="sr-only">Sort nearby results</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="nearest">Nearest first</option><option value="name">Name A–Z</option></select></label></div>
            {resultsLimited && <p className="atlas-limit-note">{onLoadMore ? 'More clubs in this neighborhood. Keep exploring below.' : 'More exist in this area. Zoom closer or refine your filters to explore beyond the nearest 100 per type.'}</p>}
        </header>
        <div className="atlas-results-scroll">
            {!loading && records.length === 0 && <div className="atlas-results-empty"><Building2 size={28} /><h3>A little further afield?</h3><p>No results for this search. Move the map or loosen a filter, then search again.</p></div>}
            <ol>{sorted.map((record, i) => <li key={record.key} className={selectedKey === record.key ? 'is-selected' : ''}>
                <button className="atlas-result-main" onClick={() => onSelect(record.key)} aria-label={`Show ${record.title} on map`} aria-pressed={selectedKey === record.key}>
                    <span className="atlas-result-logo">{record.logoUrl ? <img src={resolveMediaUrl(record.logoUrl)} alt="" /> : <Building2 size={23} />}<small>{String(i + 1).padStart(2, '0')}</small></span>
                    <span className="atlas-result-copy"><span className="atlas-result-type">{record.entityType === 'CLUB' ? record.subtitle || 'Football club' : record.entityType.toLowerCase()}{record.official && <ShieldCheck size={13} />}</span><strong>{record.title}</strong><span className="atlas-result-address">{record.locationName || record.cityName || record.subtitle}</span></span>
                    <ArrowUpRight size={17} />
                </button>
                <div className="atlas-result-footer"><span>{record.distanceKm != null ? `${record.distanceKm < 1 ? Math.round(record.distanceKm * 1000) + ' m' : record.distanceKm.toFixed(1) + ' km'} from ${hasOrigin ? 'your location' : 'search region'}` : 'Explore club'}</span><button onClick={() => onWalk(record.key)} aria-label={`Walk to ${record.title}`}><Footprints size={14} />Walk here</button></div>
                {record.clubId != null && <Link className="atlas-result-link" to={`/clubs/${record.clubId}`}>View club <ArrowUpRight size={12} /></Link>}
            </li>)}</ol>
            {onLoadMore && <button className="atlas-load-more" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? 'Loading more clubs…' : 'Load more clubs'}<ArrowUpRight size={15} /></button>}
        </div>
        <footer><span className="atlas-live-dot" />{areaSearch ? 'Move the map. Discover another neighborhood.' : 'Zoom closer. There’s more to discover.'}</footer>
    </aside>;
};
