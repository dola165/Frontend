import { ArrowUpRight, Footprints, Loader2, MapPin, Navigation, X } from 'lucide-react';
import type { WalkingRoute } from './walkingGraph';

export function MapWalkingPanel({ title, route, loading, picking, error, directionsUrl, onPick, onLocate, onClose }: {
    title: string; route: WalkingRoute | null; loading: boolean; picking: boolean; error: string | null;
    directionsUrl: string; onPick: () => void; onLocate: () => void; onClose: () => void;
}) {
    return <aside className="atlas-walking-panel" aria-label="Walking directions">
        <header><span className="atlas-eyebrow"><Footprints size={14} /> WALK TO FOOTBALL</span><button aria-label="Close walking directions" onClick={onClose}><X size={18} /></button></header>
        <h2>{title}</h2>
        {!route && <p>{loading ? 'Exploring nearby streets and footpaths…' : picking ? 'Tap a street on the map to choose your starting point.' : 'Choose where your walk begins.'}</p>}
        {loading && <div className="atlas-route-progress"><Loader2 className="animate-spin" size={18} /><span>Finding a connected walking route</span></div>}
        {error && <p role="alert" className="atlas-route-error">{error}</p>}
        {route && <>
            <div className="atlas-walk-stats"><strong>{route.minutes}<small>min walk</small></strong><span>{route.distanceKm.toFixed(2)} km<small>on mapped paths</small></span></div>
            <div className="atlas-route-key"><span><i />Mapped walking path</span><span><i />Unmapped connection</span></div>
            <p className="atlas-route-note">{route.startOffsetM} m from your start to the path · {route.endOffsetM} m from the path to the destination. Dashed connections are unverified and excluded from the estimate.</p>
            <ol className="atlas-walk-steps">{route.steps.map((step, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span><div>{step.name}<small>{Math.round(step.distanceM)} m</small></div></li>)}</ol>
        </>}
        <div className="atlas-walk-actions"><button onClick={onPick} disabled={loading}><MapPin size={15} />{route ? 'Change start' : 'Pick on map'}</button><button onClick={onLocate} disabled={loading}><Navigation size={15} />My location</button></div>
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer">Open directions <ArrowUpRight size={14} /></a>
        <details className="atlas-route-about"><summary>How this route is found</summary><p>Our A* search finds the shortest connected route in nearby OpenStreetMap streets and footpaths. It respects mapped walking access. Missing paths, entrances and unrecorded restrictions can affect the result. Check local access.</p><p>The branching filter animation is a visual search effect. It is not a route. Walking estimates use 4.8 km/h, without slope or crossing delays.</p></details>
        <small className="atlas-osm-credit">Paths © OpenStreetMap contributors</small>
    </aside>;
}
