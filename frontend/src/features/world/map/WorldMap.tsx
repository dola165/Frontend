import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getHeritageStyle } from '../../../components/map/heritageStyle';
import { Button } from '../../../design/primitives';
import { useWorldData } from '../useWorldData';
import './world-map.css';

const WorldLiveMap = lazy(() => import('./WorldLiveMap'));

export type WorldMapTone = 'club' | 'venue' | 'match' | 'trial' | 'event' | 'person';
export interface WorldMapPoint { id: string; lat: number; lng: number; label: string; meta?: string; tone: WorldMapTone; to?: string }

const TONE_LABEL: Record<WorldMapTone, string> = { club: 'Clubs', venue: 'Venues', match: 'Matches', trial: 'Trials', event: 'Events', person: 'People' };

/** Positions-only sketch: used while the street map loads and whenever it cannot. */
function MapSketch({ points, selectedId, onSelect }: { points: WorldMapPoint[]; selectedId?: string; onSelect: (id: string) => void }) {
    const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const spanLat = Math.max(maxLat - minLat, 0.01), spanLng = Math.max(maxLng - minLng, 0.01);
    const place = (point: WorldMapPoint) => ({
        left: `${8 + ((point.lng - minLng) / spanLng) * 84}%`,
        top: `${20 + (1 - (point.lat - minLat) / spanLat) * 60}%`,
    });
    return (
        <div className="gk-world-map__sketch" aria-hidden={points.length === 0}>
            {points.map(point => (
                <button key={point.id} type="button" className="gk-world-pin" data-tone={point.tone} data-selected={point.id === selectedId || undefined}
                    style={place(point)} aria-label={`${point.label}${point.meta ? `, ${point.meta}` : ''}`} title={point.label} onClick={() => onSelect(point.id)} />
            ))}
        </div>
    );
}

/**
 * A compact map of World results. Uses the street map when it can load, and otherwise shows
 * the same points on a plain sketch so results stay usable without map tiles.
 */
export function WorldMap({ points, label, selectedId, onSelect, className, footer }: {
    points: WorldMapPoint[]; label: string; selectedId?: string; onSelect?: (id?: string) => void; className?: string; footer?: ReactNode;
}) {
    const theme = typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const style = useWorldData(`map-style:${theme}`, () => getHeritageStyle(theme, { includeTerrain: false }));
    const [liveFailed, setLiveFailed] = useState(false);
    const [ownSelection, setOwnSelection] = useState<string>();
    const selected = selectedId ?? ownSelection;
    const select = (id?: string) => { setOwnSelection(id); onSelect?.(id); };
    const point = points.find(item => item.id === selected);
    const live = Boolean(style.data) && !liveFailed;
    const tones = [...new Set(points.map(item => item.tone))];
    return (
        <div className={`gk-world-map${className ? ` ${className}` : ''}`} role="region" aria-label={label}>
            <div className="gk-world-map__canvas">
                {live
                    ? <Suspense fallback={<MapSketch points={points} selectedId={selected} onSelect={select} />}>
                        <WorldLiveMap style={style.data!} points={points} selectedId={selected} onSelect={select} onFail={() => setLiveFailed(true)} />
                    </Suspense>
                    : <MapSketch points={points} selectedId={selected} onSelect={select} />}
                {tones.length > 1 && (
                    <ul className="gk-world-map__legend" aria-label="Map key">
                        {tones.map(tone => <li key={tone}><span className="gk-world-pin gk-world-pin--key" data-tone={tone} aria-hidden="true" />{TONE_LABEL[tone]}</li>)}
                    </ul>
                )}
                {!live && !style.loading && (
                    <p className="gk-world-map__note">
                        Street map unavailable, showing positions only.
                        <Button size="sm" variant="ghost" onClick={() => { setLiveFailed(false); style.retry(); }}>Retry</Button>
                    </p>
                )}
                {point && (
                    <div className="gk-world-map__card">
                        <span className="gk-world-map__card-text">
                            <strong>{point.label}</strong>
                            {point.meta && <span>{point.meta}</span>}
                        </span>
                        {point.to && <Link className="gk-section__action" to={point.to}>Open</Link>}
                        <Button size="sm" variant="ghost" onClick={() => select(undefined)} aria-label="Close">Close</Button>
                    </div>
                )}
            </div>
            {footer && <div className="gk-world-map__foot">{footer}</div>}
        </div>
    );
}
