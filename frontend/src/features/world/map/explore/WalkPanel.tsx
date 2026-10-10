import { ArrowLeft, Footprints, LocateFixed, MapPin } from 'lucide-react';
import { Button, Skeleton, StatTile } from '../../../../design/primitives';
import type { Walking } from './useWalking';

/** Walking directions on mapped paths, with an honest note on how they are found. */
export function WalkPanel({ walking, onBack }: { walking: Walking; onBack: () => void }) {
    const { target, route, loading, error, picking, origin } = walking;
    if (!target) return null;
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}&travelmode=walking${origin ? `&origin=${origin[1]},${origin[0]}` : ''}`;
    return (
        <section className="gk-map-place" aria-label="Walking directions">
            <div className="gk-map-place__nav"><Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft aria-hidden="true" />Back to the place</Button></div>
            <header className="gk-map-place__head">
                <span className="gk-map-glyph" data-tone="venue"><Footprints aria-hidden="true" /></span>
                <div className="gk-map-place__titles"><h2>Walk to {target.title}</h2>
                    <p>{route ? 'On mapped streets and paths' : loading ? 'Finding a connected walking route…' : picking ? 'Click the map where your walk begins.' : 'Choose where your walk begins.'}</p>
                </div>
            </header>
            {loading && <div className="gk-stack gk-stack--tight" role="status" aria-label="Finding a route"><Skeleton height={72} /><Skeleton height={16} width="70%" /></div>}
            {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
            {walking.locationError && <div className="gk-notice gk-notice--warning" role="alert">{walking.locationError}</div>}
            {route && (
                <>
                    <div className="gk-stats">
                        <StatTile label="Walk" value={<>{route.minutes}<small className="gk-map-unit"> min</small></>} />
                        <StatTile label="Distance" value={<>{route.distanceKm.toFixed(1)}<small className="gk-map-unit"> km</small></>} />
                    </div>
                    <p className="gk-faint">{route.startOffsetM} m from your start to the nearest path and {route.endOffsetM} m from the path to the destination are drawn dashed and not counted.</p>
                    <ol className="gk-map-steps">
                        {route.steps.map((step, index) => <li key={index}><span className="gk-num">{index + 1}</span><span>{step.name}</span><small className="gk-num">{Math.round(step.distanceM)} m</small></li>)}
                    </ol>
                </>
            )}
            <div className="gk-map-place__actions">
                <Button onClick={walking.beginPicking} disabled={loading}><MapPin aria-hidden="true" />{route ? 'Change start' : 'Choose on the map'}</Button>
                <Button onClick={walking.locateAndWalk} disabled={loading || walking.locating}><LocateFixed aria-hidden="true" />{walking.locating ? 'Finding you…' : 'Use my location'}</Button>
                <a className="gk-btn gk-btn--ghost" href={directions} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
            </div>
            <details className="gk-map-about">
                <summary>How this route is found</summary>
                <p>The shortest connected route through nearby OpenStreetMap streets and footpaths, respecting mapped walking access. Missing paths, entrances and unrecorded restrictions can change the real route. Times use 4.8 km/h without slopes or crossings.</p>
                <p className="gk-faint">Paths © OpenStreetMap contributors</p>
            </details>
        </section>
    );
}
