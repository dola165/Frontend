import { useEffect, useEffectEvent, useRef, type CSSProperties } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import Map, { Marker, NavigationControl, useMap, type ViewStateChangeEvent } from 'react-map-gl/maplibre';
import { maplibreWorkerUrl } from '../../../components/map/maplibreWorker';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapBounds } from '../../../components/map/areaSearch';
import { prefersLightMapRendering } from '../../../components/map/mapPerformance';
import type { MapFocus, MapLine, MapReach } from '../stage/stageContext';
import { AwayLayer } from './canvas/AwayLayer';
import { ReachLayer } from './canvas/ReachLayer';
import { reducedMotion } from './canvas/useMapTheme';
import { wt } from '../copy';
import { pinData, pinHover, pinLabel } from './pins';
import { ContextPin, PinFace, type PinEvents, type WorldMapPoint } from './WorldMap';

/** Room kept clear of the panels floating over the map's sides and top. */
interface Insets { right?: number; left?: number; top?: number }
const padding = ({ right = 0, left = 0, top = 0 }: Insets) => ({ top: 64 + top, bottom: 64, left: 64 + left, right: 64 + right });
const boundsOf = (map: { getBounds: () => { getWest: () => number; getSouth: () => number; getEast: () => number; getNorth: () => number } }): MapBounds => {
    const box = map.getBounds();
    return { west: box.getWest(), south: box.getSouth(), east: box.getEast(), north: box.getNorth() };
};

/**
 * Frames the points (and the places that give them context) when the set of places changes, not on every render, so
 * a pan or zoom stays put. The insets keep them clear of a panel floating over the map's side. While the map
 * is focused on one result (`hold`) new pins do not reframe it; a new `frame` value frames every pin again.
 */
function FitPoints({ points, insets, hold, frame }: { points: WorldMapPoint[]; insets: Insets; hold: boolean; frame?: number }) {
    const { current: map } = useMap();
    const placed = points.map(p => `${p.id}@${p.lat},${p.lng}`).join('|');
    const { right = 0, left = 0, top = 0 } = insets;
    // `hold` is read when framing, not watched: letting go of a focus never makes the camera jump.
    const fit = useEffectEvent(() => {
        if (!map || !points.length || hold) return;
        const lngs = points.map(p => p.lng), lats = points.map(p => p.lat);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: padding(insets), maxZoom: 13, duration: reducedMotion() ? 0 : 300 });
    });
    useEffect(() => { fit(); }, [map, placed, right, left, top, frame]);
    return null;
}

/**
 * Goes to the focused pin once per request: it flies close, centred in the part of the map the panel leaves free, or
 * frames the focus's box (a stated area around the pin). It waits for the pin (a shared link before the results or
 * places have loaded) and goes again when the panel opens or folds. The offset applies to this move only.
 */
function FocusPoint({ points, focus, insets }: { points: WorldMapPoint[]; focus?: MapFocus; insets: Insets }) {
    const { current: map } = useMap();
    const done = useRef<string | undefined>(undefined);
    const point = focus ? points.find(p => p.id === focus.id) : undefined;
    const box = focus?.bounds;
    const { right = 0, left = 0, top = 0 } = insets;
    const go = useEffectEvent(() => {
        // With nothing to fly to, the last flight is forgotten: the same choice, made again or returned to, flies again.
        if (!focus || !point) { done.current = undefined; return; }
        if (!map) return;
        const request = `${focus.token}:${focus.id}@${right}:${left}:${box ? `${box.west},${box.south},${box.east},${box.north}` : ''}`;
        if (done.current === request) return;
        done.current = request;
        const duration = reducedMotion() ? 0 : 600;
        if (box) map.fitBounds([[box.west, box.south], [box.east, box.north]], { padding: padding(insets), maxZoom: 14, duration });
        else map.flyTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 14), offset: [(left - right) / 2, top / 2], duration });
    });
    useEffect(() => { go(); }, [map, focus?.token, focus?.id, point?.lat, point?.lng, right, left, box?.west, box?.south, box?.east, box?.north]);
    return null;
}

/** Says where the map is looking: at the start and after every move, the person's and the map's own alike. */
function ViewReport({ onView }: { onView?: (bounds: MapBounds) => void }) {
    const { current: map } = useMap();
    const latest = useRef(onView);
    useEffect(() => { latest.current = onView; });
    const listening = Boolean(onView);
    useEffect(() => {
        if (!map || !listening) return;
        const report = () => latest.current?.(boundsOf(map));
        report();
        map.on('moveend', report);
        return () => { map.off('moveend', report); };
    }, [map, listening]);
    return null;
}

/** How many pins at most may say their time at once; with more in view, only the lit one does. */
const CHIPS_IN_VIEW = 12;
/** Tells the map whether few enough pins are in view for each to say its time, as the map moves and the pins change. */
function ChipsInView({ points, onChange }: { points: WorldMapPoint[]; onChange?: (few: boolean) => void }) {
    const { current: map } = useMap();
    const latest = useRef({ points, onChange });
    useEffect(() => { latest.current = { points, onChange }; });
    const placed = points.map(p => `${p.lat},${p.lng}`).join('|');
    useEffect(() => {
        if (!map) return;
        const count = () => {
            const { points: now, onChange: report } = latest.current;
            const box = map.getBounds();
            report?.(now.filter(p => box.contains([p.lng, p.lat])).length <= CHIPS_IN_VIEW);
        };
        count();
        map.on('moveend', count);
        return () => { map.off('moveend', count); };
    }, [map, placed]);
    return null;
}

/** The street-map layer of WorldMap. Loaded only when the map style is available. */
export default function WorldLiveMap({ style, points, context = [], reach, away, selectedId, highlightId, onSelect, onHover, onMoveEnd, onView, onFail, insetRight, insetLeft, insetTop, gestures = 'cooperative', focus, frame, onFewInView }: {
    style: StyleSpecification; points: WorldMapPoint[]; onFail: () => void; insetRight?: number; insetLeft?: number; insetTop?: number;
    /** Whether few enough pins are in view for each to say its time. */ onFewInView?: (few: boolean) => void;
    /** Places that give the results context, and a stated reach to draw. */ context?: WorldMapPoint[]; reach?: MapReach;
    /** An away day to draw. */ away?: MapLine;
    /** Only moves the person made: framing the points is not one. */ onMoveEnd?: (bounds: MapBounds) => void;
    /** Every view the map settles on, the person's moves and its own alike. */ onView?: (bounds: MapBounds) => void;
    /** In a page that scrolls the wheel scrolls the page unless a key is held ('cooperative'); a map filling the screen answers it directly ('free'). */ gestures?: 'cooperative' | 'free';
    focus?: MapFocus; frame?: number;
} & PinEvents) {
    const first = points[0] ?? context[0];
    const insets: Insets = { right: insetRight, left: insetLeft, top: insetTop };
    const moved = (event: ViewStateChangeEvent) => {
        if (!onMoveEnd || !event.originalEvent) return;
        onMoveEnd(boundsOf(event.target));
    };
    return (
        <Map
            workerUrl={maplibreWorkerUrl}
            initialViewState={{ latitude: first?.lat ?? 41.7151, longitude: first?.lng ?? 44.8271, zoom: 11 }}
            mapStyle={style}
            style={{ width: '100%', height: '100%' }}
            onError={onFail}
            onMoveEnd={moved}
            attributionControl={{ compact: true }}
            cooperativeGestures={gestures === 'cooperative'}
            locale={mapWords()}
            // Phones and small devices draw fewer pixels, as the full map does; a desktop keeps its sharpness.
            pixelRatio={prefersLightMapRendering() ? Math.min(window.devicePixelRatio || 1, 1.5) : undefined}
        >
            <NavigationControl position="top-right" showCompass={false} />
            <FitPoints points={[...points, ...context]} insets={insets} hold={Boolean(focus)} frame={frame} />
            {/* After FitPoints, so a flight requested with new pins wins over their framing. */}
            <FocusPoint points={points} focus={focus} insets={insets} />
            <ViewReport onView={onView} />
            <ChipsInView points={points} onChange={onFewInView} />
            {reach && <ReachLayer reach={reach} />}
            {away && <AwayLayer line={away} />}
            {context.map(point => (
                <Marker key={`context:${point.id}`} latitude={point.lat} longitude={point.lng} anchor="center"><ContextPin point={point} /></Marker>
            ))}
            {points.map((point, index) => (
                // A lit pin (chosen or pointed at) comes in front, its chip over its neighbours.
                <Marker key={point.id} latitude={point.lat} longitude={point.lng} anchor="center" style={point.id === selectedId || point.id === highlightId ? { zIndex: 3 } : undefined}>
                    <button type="button" className="gk-world-pin" style={{ '--pin-i': index % 7 } as CSSProperties} {...pinData(point, point.id === selectedId || point.id === highlightId)}
                        aria-label={pinLabel(point)} title={pinLabel(point)} onClick={() => onSelect(point.id)} {...pinHover(point.id, onHover)}>
                        <PinFace point={point} />
                    </button>
                </Marker>
            ))}
        </Map>
    );
}

/** The map's own words (its zoom buttons and the hint to zoom with Ctrl), in the app's language when the map is made. */
const mapWords = () => ({
    'CooperativeGesturesHandler.WindowsHelpText': wt('Use Ctrl + scroll to zoom the map'),
    'CooperativeGesturesHandler.MacHelpText': wt('Use ⌘ + scroll to zoom the map'),
    'CooperativeGesturesHandler.MobileHelpText': wt('Use two fingers to move the map'),
    'NavigationControl.ZoomIn': wt('Zoom in'),
    'NavigationControl.ZoomOut': wt('Zoom out'),
    'AttributionControl.ToggleAttribution': wt('Map credits'),
});

