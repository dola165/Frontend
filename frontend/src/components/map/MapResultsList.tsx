import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, Footprints, MapPin, ShieldCheck, X } from 'lucide-react';
import { MediaImage } from '../ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import type { Opportunity } from '../../features/admissions/types';
import { useAdmissionCopy } from '../../features/admissions/applicant/copy';
import { playerPath } from '../../features/parents/playerSelection';
interface Result {
    opportunity?:Opportunity;applicantPlayerId?:number;matchingOpportunities?:Opportunity[];
    key: string; title: string; entityType: string; subtitle: string | null; startsAt: string | null;
    clubId: number | null; distanceKm: number | null; official?: boolean; logoUrl?: string | null;
    rawMapMarker?: { entityId: number; fee?: string };
    cityName?: string | null; locationName?: string | null;
}
/** Pin and list selection use the same keys. The list remains usable when tiles are unavailable. */
export const MapResultsList = ({ isVisible, records, selectedPlayerId, selectedKey, loading, resultsLimited, coverageSummary, areaSearch, hasOrigin, onSelect, onWalk, onSavePlace, onClose, onLoadMore, loadingMore }: {
    selectedPlayerId?:number;
    isVisible: boolean; embedded: boolean; darkMode: boolean; records: Result[]; selectedKey: string | null;
    loading: boolean; resultsLimited: boolean; coverageSummary: string; areaSearch?: boolean; hasOrigin?: boolean;
    onSelect: (key: string) => void; onWalk: (key: string) => void; onClose: () => void;
    onLoadMore?: () => void; loadingMore?: boolean;
    onSavePlace?: (key:string) => void;
}) => {
    const {copy,availability}=useAdmissionCopy();
    const [sort, setSort] = useState('nearest');
    const sorted = useMemo(() => [...records].sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title)
        : (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.title.localeCompare(b.title)), [records, sort]);
    if (!isVisible) return null;
    return <aside aria-label="Nearby results" className="atlas-results">
        <header>
            <div className="atlas-results-heading"><span className="atlas-eyebrow"><MapPin size={14} /> EXPLORE THE AREA</span><button aria-label="Close results" onClick={onClose}><X size={18} /></button></div>
            <h2>Find your next game<span>.</span></h2>
            <div className="atlas-results-summary"><p role="status"><strong>{loading ? '…' : records.length}</strong> {coverageSummary}</p><label><span className="sr-only">Sort nearby results</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="nearest">Nearest first</option><option value="name">Name A–Z</option></select></label></div>
        </header>
        <div className="atlas-results-scroll">
            {resultsLimited && <p className="atlas-limit-note">{onLoadMore ? 'More clubs in this neighborhood. Keep exploring below.' : 'More exist in this area. Zoom closer or refine your filters to explore beyond the nearest 100 per type.'}</p>}
            {!loading && records.length === 0 && <div className="atlas-results-empty"><Building2 size={28} /><h3>A little further afield?</h3><p>No results for this search. Move the map or loosen a filter, then search again.</p></div>}
            <ol>{sorted.map((record, i) => <li key={record.key} className={selectedKey === record.key ? 'is-selected' : ''}>
                <button className="atlas-result-main" onClick={() => onSelect(record.key)} aria-label={`Show ${record.title} on map`} aria-pressed={selectedKey === record.key}>
                    <span className="atlas-result-logo">{record.logoUrl ? <MediaImage src={resolveMediaUrl(record.logoUrl)} alt="" /> : <Building2 size={23} />}<small>{String(i + 1).padStart(2, '0')}</small></span>
                    <span className="atlas-result-copy"><span className="atlas-result-type">{record.entityType === 'CLUB' ? record.subtitle || 'Football club' : record.entityType.toLowerCase()}{record.official && <ShieldCheck size={13} />}</span><strong>{record.title}</strong><span className="atlas-result-address">{record.locationName || record.cityName || record.subtitle}</span></span>
                    <ArrowUpRight size={17} />
                </button>
                <div className="atlas-result-footer"><span>{record.distanceKm != null ? `${record.distanceKm < 1 ? Math.round(record.distanceKm * 1000) + ' m' : record.distanceKm.toFixed(1) + ' km'} from ${hasOrigin ? 'your location' : 'search region'}` : 'Explore club'}</span><button onClick={() => onWalk(record.key)} aria-label={`Walk to ${record.title}`}><Footprints size={14} />Walk here</button></div>
                {record.rawMapMarker?.fee && <p className="atlas-training-price">{record.rawMapMarker.fee}</p>}
                {record.opportunity&&<div className="admission-map-entry"><span className="admission-badge">{availability(record.opportunity.availability)}</span><p>{copy('Born','დაბადების წელი')} {record.opportunity.birthYearFrom}–{record.opportunity.birthYearTo} · {record.opportunity.schedule}</p><p>{record.opportunity.terms.feesKnown?record.opportunity.terms.charges.map(c=>`${c.amount} ${c.currency} · ${c.frequency}`).join(' + ')||copy('No mandatory charges','სავალდებულო გადასახადი არ არის'):copy('Price to be confirmed','ფასი დასაზუსტებელია')}</p><Link to={`/admissions/opportunities/${record.opportunity.id}${record.applicantPlayerId?`?player=${record.applicantPlayerId}`:''}`}>{copy('View joining arrangements','მონაწილეობის პირობების ნახვა')} →</Link></div>}
                {!record.opportunity&&record.matchingOpportunities?.map(o=><div className="admission-map-entry" key={o.id}><strong>{o.name}</strong><p>{o.location.name} · {availability(o.availability)}</p><Link to={playerPath(`/admissions/opportunities/${o.id}`,record.applicantPlayerId??selectedPlayerId)}>{copy('View group at its training venue','ჯგუფის ნახვა სავარჯიშო ადგილას')} →</Link></div>)}
                {onSavePlace && <button className="atlas-result-link" onClick={()=>onSavePlace(record.key)}>Save to a journey plan <ArrowUpRight size={12}/></button>}
                {record.entityType === 'STADIUM' && <Link className="atlas-result-link" to={`/stadiums/${record.rawMapMarker?.entityId}`}>View availability <ArrowUpRight size={12} /></Link>}
                {record.clubId != null && <Link className="atlas-result-link" to={playerPath(`/clubs/${record.clubId}`,selectedPlayerId)}>View club <ArrowUpRight size={12} /></Link>}
            </li>)}</ol>
            {onLoadMore && <button className="atlas-load-more" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? copy('Loading more clubs and groups…','მეტი კლუბი და ჯგუფი იტვირთება…') : copy('Load more clubs and groups','მეტი კლუბისა და ჯგუფის ჩატვირთვა')}<ArrowUpRight size={15} /></button>}
        </div>
        <footer><span className="atlas-live-dot" />{areaSearch ? 'Move the map. Discover another neighborhood.' : 'Zoom closer. There’s more to discover.'}</footer>
    </aside>;
};
