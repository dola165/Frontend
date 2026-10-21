import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MapBounds } from '../../../components/map/areaSearch';
import { getHeritageStyle } from '../../../components/map/heritageStyle';
import { Trophy } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useWorldData } from '../useWorldData';
import { Crest } from '../Crest';
import { useAppTheme } from './canvas/useMapTheme';
import type { MapFocus, MapLine, MapReach } from '../stage/stageContext';
import { pinData, pinHover, pinLabel, shownCount } from './pins';
import './world-map.css';

const WorldLiveMap = lazy(() => import('./WorldLiveMap'));

export type WorldMapTone = 'club' | 'venue' | 'match' | 'tournament' | 'trial' | 'event' | 'training' | 'person' | 'mixed';
/** Why a pin is not at the result's own place: it is at its club, at its competition's ground, or counted at a city. */
export type Approximate = 'club' | 'ground' | 'area';
const APPROXIMATE: Record<Approximate, string> = { club: 'Placed at its club', ground: 'Placed at its competition’s ground', area: 'Counted at a city' };
export interface WorldMapPoint {
    id: string; lat: number; lng: number; label: string; meta?: string; tone: WorldMapTone; to?: string;
    /** Several results at one place (three jobs at a club): the pin shows how many. */ count?: number;
    /** Placed near rather than at its own place (its own place is not known): drawn as a ring, and the card says where. */ approximate?: Approximate;
    /** The kinds of result at a pin that holds several (its tone is then "mixed"). */ tones?: WorldMapTone[];
    /** What the card calls opening `to` ("Open club"); "Open" when absent. */ action?: string;
    /** The crest of the club the pin is (people counted at their club). */ crest?: string | null;
    /** A few characters beside the pin ("11:00", "FT 4–3"), shown while few pins are in view or when it is lit. */ chip?: string;
}

const TONE_LABEL: Record<WorldMapTone, string> = { club: 'Clubs', venue: 'Venues', match: 'Matches', tournament: 'Tournaments', trial: 'Trials', event: 'Events', training: 'Training', person: 'People', mixed: 'Several kinds' };

/** What every way of drawing a pin needs: which pins are lit, and what pointing at or choosing one does. */
export interface PinEvents { selectedId?: string; highlightId?: string; onSelect: (id: string) => void; onHover?: (id?: string) => void }

/** What a pin shows inside: a club's crest when it is one, a trophy for a tournament, and how many results it holds. */
export function PinFace({ point }: { point: WorldMapPoint }) {
    const count = shownCount(point);
    return <>
        {point.crest && <Crest src={point.crest} name={point.label} size={24} round />}
        {point.tone === 'tournament' && !point.crest && count == null && <Trophy className="gk-world-pin__glyph" aria-hidden="true" />}
        {count != null && <span className="gk-world-pin__count">{count}</span>}
        {point.chip && <span className="gk-world-pin__chip" aria-hidden="true">{point.chip}</span>}
    </>;
}

/** A place that is not a result (the ground of the match being staffed): bright, named, never chosen. */
export function ContextPin({ point }: { point: WorldMapPoint }) {
    return <span className="gk-world-pin gk-world-pin--context" data-tone={point.tone} role="img" aria-label={pinLabel(point)}><span className="gk-world-pin__name">{point.label}</span></span>;
}

/** Positions-only sketch: used while the street map loads and whenever it cannot. */
function MapSketch({ points, context = [], selectedId, highlightId, onSelect, onHover }: { points: WorldMapPoint[]; context?: WorldMapPoint[] } & PinEvents) {
    const all = [...points, ...context];
    const lats = all.map(p => p.lat), lngs = all.map(p => p.lng);
    // Centre the points; a lone point or a tight cluster sits in the middle rather than a corner.
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2, midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.02), spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.02);
    const place = (point: WorldMapPoint) => ({
        left: `${50 + ((point.lng - midLng) / spanLng) * 84}%`,
        top: `${50 - ((point.lat - midLat) / spanLat) * 60}%`,
    });
    return (
        <div className="gk-world-map__sketch" aria-hidden={points.length === 0}>
            {points.map(point => (
                <button key={point.id} type="button" className="gk-world-pin" {...pinData(point, point.id === selectedId || point.id === highlightId)}
                    style={place(point)} aria-label={pinLabel(point)} title={pinLabel(point)} onClick={() => onSelect(point.id)} {...pinHover(point.id, onHover)}>
                    <PinFace point={point} />
                </button>
            ))}
            {context.map(point => <span key={point.id} className="gk-world-map__sketch-context" style={place(point)}><ContextPin point={point} /></span>)}
        </div>
    );
}

/**
 * A map of World results. Uses the street map when it can load, and otherwise shows the same points on a plain
 * sketch so results stay usable without map tiles. `hero` is the big glass look of World's overview and tabs.
 */
export function WorldMap({ points, label, selectedId, highlightId, onSelect, onHover, onMoveEnd, onView, className, footer, overlay, insetRight, insetLeft, insetTop, gestures, variant, cardActions, focus, frame, card = true, context, reach, away }: {
    points: WorldMapPoint[]; label: string; selectedId?: string; /** A point to emphasise, such as the result under the pointer. */ highlightId?: string;
    onSelect?: (id?: string) => void; /** The pointer or focus is on a pin (or left it). */ onHover?: (id?: string) => void;
    /** The person panned or zoomed the map (framing the points does not count). */ onMoveEnd?: (bounds: MapBounds) => void;
    /** Every view the map settles on, its own moves included, for a list that follows what is on screen. */ onView?: (bounds: MapBounds) => void;
    className?: string; footer?: ReactNode;
    /** Things floating on the map itself, such as counts and the way to the full map. */ overlay?: ReactNode;
    /** Room kept free on the right or the left for a panel floating over the map (pixels). */ insetRight?: number; insetLeft?: number;
    /** Room kept free at the top for something floating over the map (pixels). */ insetTop?: number;
    /** Whether the wheel needs a key held to zoom (in a scrolling page) or zooms directly (a map filling the screen). */ gestures?: 'cooperative' | 'free';
    variant?: 'hero';
    /** More ways on from the chosen pin's card, besides Open and Close. */ cardActions?: (point: WorldMapPoint) => ReactNode;
    /** Fly to one pin (see `StageMap.focus`); a new `frame` frames every pin again. */ focus?: MapFocus; frame?: number;
    /** False while the page shows the chosen result itself, so the card stays hidden. */ card?: boolean;
    /** Places that give the results context (see `StageMap.context`), and a stated reach to draw (`StageMap.reach`). */ context?: WorldMapPoint[]; reach?: MapReach;
    /** An away day to draw (`StageMap.away`). */ away?: MapLine;
}) {
    const t = useWorldCopy();
    const theme = useAppTheme();
    const style = useWorldData(`map-style:${theme}`, () => getHeritageStyle(theme, { includeTerrain: false }));
    const [liveFailed, setLiveFailed] = useState(false);
    const [ownSelection, setOwnSelection] = useState<string>();
    // Pins say their time only while few are in view (the live map counts them as it moves; the sketch shows them all).
    const [fewInView, setFewInView] = useState(true);
    // A page that handles choosing owns the selection, so a pin chosen on another page never stays chosen here.
    const selected = onSelect ? selectedId : ownSelection;
    const select = (id?: string) => { setOwnSelection(id); onSelect?.(id); };
    const point = card ? points.find(item => item.id === selected) : undefined;
    const live = Boolean(style.data) && !liveFailed;
    const tones = [...new Set(points.flatMap(item => item.tone === 'mixed' ? [...(item.tones ?? []), item.tone] : [item.tone]))];
    const approximate = [...new Set(points.flatMap(item => item.approximate ? [item.approximate] : []))];
    const pins: PinEvents = { selectedId: selected, highlightId, onSelect: select, onHover };
    return (
        <div className={`gk-world-map${variant ? ` gk-world-map--${variant}` : ''}${className ? ` ${className}` : ''}`} role="region" aria-label={label}>
            <div className="gk-world-map__canvas" data-card={point ? true : undefined} data-chips={(live ? fewInView : points.length <= 12) || undefined}>
                {live
                    ? <Suspense fallback={<MapSketch points={points} context={context} {...pins} />}>
                        <WorldLiveMap style={style.data!} points={points} context={context} reach={reach} away={away} {...pins} onMoveEnd={onMoveEnd} onView={onView} onFail={() => setLiveFailed(true)}
                            insetRight={insetRight} insetLeft={insetLeft} insetTop={insetTop} gestures={gestures} focus={focus} frame={frame} onFewInView={setFewInView} />
                    </Suspense>
                    : <MapSketch points={points} context={context} {...pins} />}
                {(tones.length > 1 || approximate.length > 0) && (
                    <ul className="gk-world-map__legend" aria-label={t('Map key')}>
                        {tones.length > 1 && tones.map(tone => <li key={tone}><span className="gk-world-pin gk-world-pin--key" data-tone={tone} aria-hidden="true" />{t(TONE_LABEL[tone])}</li>)}
                        {approximate.map(reason => <li key={reason}><span className="gk-world-pin gk-world-pin--key" data-tone={points.find(item => item.approximate === reason)!.tone} data-approx aria-hidden="true" />{t(APPROXIMATE[reason])}</li>)}
                    </ul>
                )}
                {!live && !style.loading && (
                    <p className="gk-world-map__note">
                        {t('Street map unavailable, showing positions only.')}
                        <Button size="sm" variant="ghost" onClick={() => { setLiveFailed(false); style.retry(); }}>{t('Retry')}</Button>
                    </p>
                )}
                {overlay}
                {point && (
                    <div className="gk-world-map__card">
                        <span className="gk-world-map__card-text">
                            <strong>{point.label}</strong>
                            {(point.meta || point.approximate) && <span>{[point.meta, point.approximate ? t(APPROXIMATE[point.approximate]) : ''].filter(Boolean).join(' · ')}</span>}
                        </span>
                        {cardActions?.(point)}
                        {point.to && <Link className="gk-section__action" to={point.to}>{point.action ?? t('Open')}</Link>}
                        <Button size="sm" variant="ghost" onClick={() => select(undefined)}>{t('Close')}</Button>
                    </div>
                )}
            </div>
            {footer && <div className="gk-world-map__foot">{footer}</div>}
        </div>
    );
}
