import { lazy, Suspense, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MapBounds } from '../../../components/map/areaSearch';
import { getHeritageStyle } from '../../../components/map/heritageStyle';
import { Trophy } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { useWorldData } from '../useWorldData';
import { Crest } from '../Crest';
import { useAppTheme } from './canvas/useMapTheme';
import type { MapFocus, MapLine, MapReach, MapYou } from '../stage/stageContext';
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

/** Where things sit on the sketch, in percent of its box, and back: the points (and "You") centred in it. */
interface SketchFrame { place: (spot: { lat: number; lng: number }) => { left: number; top: number }; spot: (left: number, top: number) => { lat: number; lng: number } }
function sketchFrame(spots: { lat: number; lng: number }[]): SketchFrame {
    const lats = spots.map(p => p.lat), lngs = spots.map(p => p.lng);
    // Centre the points; a lone point or a tight cluster sits in the middle rather than a corner.
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2, midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.02), spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.02);
    return {
        place: spot => ({ left: 50 + ((spot.lng - midLng) / spanLng) * 84, top: 50 - ((spot.lat - midLat) / spanLat) * 60 }),
        spot: (left, top) => ({ lat: midLat - ((top - 50) / 60) * spanLat, lng: midLng + ((left - 50) / 84) * spanLng }),
    };
}
const percent = ({ left, top }: { left: number; top: number }) => ({ left: `${left}%`, top: `${top}%` });

/** Positions-only sketch: used while the street map loads and whenever it cannot, "You" included. */
function MapSketch({ points, context = [], you, selectedId, highlightId, onSelect, onHover }: { points: WorldMapPoint[]; context?: WorldMapPoint[]; you?: MapYou } & PinEvents) {
    const frame = sketchFrame([...points, ...context, ...(you ? [you] : [])]);
    const place = (point: WorldMapPoint) => percent(frame.place(point));
    return (
        <div className="gk-world-map__sketch" aria-hidden={points.length === 0 && !you}>
            {points.map(point => (
                <button key={point.id} type="button" className="gk-world-pin" {...pinData(point, point.id === selectedId || point.id === highlightId)}
                    style={place(point)} aria-label={pinLabel(point)} title={pinLabel(point)} onClick={() => onSelect(point.id)} {...pinHover(point.id, onHover)}>
                    <PinFace point={point} />
                </button>
            ))}
            {context.map(point => <span key={point.id} className="gk-world-map__sketch-context" style={place(point)}><ContextPin point={point} /></span>)}
            {you && <SketchYou you={you} frame={frame} />}
        </div>
    );
}

/** "You" on the sketch, as on the street map: dragged (or moved with the arrow keys) to search from another place. */
function SketchYou({ you, frame }: { you: MapYou; frame: SketchFrame }) {
    const t = useWorldCopy();
    const [drag, setDrag] = useState<{ left: number; top: number } | null>(null);
    const start = useRef<{ x: number; y: number; left: number; top: number; width: number; height: number } | null>(null);
    const here = frame.place(you);
    const grab = (event: PointerEvent<HTMLButtonElement>) => {
        if (!you.onMove) return;
        const box = event.currentTarget.parentElement!.getBoundingClientRect();
        start.current = { x: event.clientX, y: event.clientY, ...here, width: box.width || 1, height: box.height || 1 };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const follow = (event: PointerEvent<HTMLButtonElement>) => {
        const from = start.current;
        if (from) setDrag({ left: from.left + ((event.clientX - from.x) / from.width) * 100, top: from.top + ((event.clientY - from.y) / from.height) * 100 });
    };
    const drop = () => {
        if (start.current && drag) { const spot = frame.spot(drag.left, drag.top); you.onMove?.(spot.lat, spot.lng); }
        start.current = null; setDrag(null);
    };
    const nudge = (event: KeyboardEvent<HTMLButtonElement>) => {
        const step = ({ ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] } as Record<string, number[]>)[event.key];
        if (!step || !you.onMove) return;
        event.preventDefault();
        const spot = frame.spot(here.left + step[0], here.top + step[1]);
        you.onMove(spot.lat, spot.lng);
    };
    const hint = you.onMove ? t('Drag to search from another place') : undefined;
    return <button type="button" className="gk-world-map__sketch-you" style={percent(drag ?? here)} data-dragging={drag ? true : undefined} data-guide="you-marker"
        aria-label={hint ? `${you.label} · ${hint}` : you.label} title={hint ?? you.label}
        onPointerDown={grab} onPointerMove={follow} onPointerUp={drop} onPointerCancel={() => { start.current = null; setDrag(null); }} onKeyDown={nudge}>
        <span className="gk-world-you"><span className="gk-world-you__label">{you.label}</span><span className="gk-world-you__dot" aria-hidden="true" /></span>
    </button>;
}

/**
 * A map of World results. Uses the street map when it can load, and otherwise shows the same points on a plain
 * sketch so results stay usable without map tiles. `hero` is the big glass look of World's overview and tabs.
 */
export function WorldMap({ points, label, selectedId, highlightId, onSelect, onHover, onMoveEnd, onView, className, footer, overlay, insetRight, insetLeft, insetTop, gestures, variant, cardActions, focus, frame, card = true, context, reach, away, you }: {
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
    /** The person's own place, draggable (`StageMap.you`). */ you?: MapYou;
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
                    ? <Suspense fallback={<MapSketch points={points} context={context} you={you} {...pins} />}>
                        <WorldLiveMap style={style.data!} points={points} context={context} reach={reach} away={away} you={you} {...pins} onMoveEnd={onMoveEnd} onView={onView} onFail={() => setLiveFailed(true)}
                            insetRight={insetRight} insetLeft={insetLeft} insetTop={insetTop} gestures={gestures} focus={focus} frame={frame} onFewInView={setFewInView} />
                    </Suspense>
                    : <MapSketch points={points} context={context} you={you} {...pins} />}
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
