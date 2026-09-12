import { useEffect, useMemo, useState } from 'react';
import { Layer, Marker, Source, useMap } from 'react-map-gl/maplibre';
import { LAYER_CLUSTERS } from './mapLayers';
import type { ExpressionSpecification } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import type { Coordinate, WalkingRoute } from './walkingGraph';

interface Props {
    sequence: number; origin: Coordinate; targets: Coordinate[]; route: WalkingRoute | null;
    destination?: Coordinate; showOrigin: boolean; onOriginChange: (point: Coordinate) => void;
}
const lines = (paths: Coordinate[][]): FeatureCollection<LineString> => ({ type: 'FeatureCollection',
    features: paths.filter(p => p.length > 1).map(coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })) });

/** Coordinates stay geographic. MapLibre renders every camera frame, without React projection lag. */
export function MapSearchLayer(props: Props) {
    return <>
        <SearchNetwork key={props.sequence} {...props} />
        {props.showOrigin && <OriginMarker key={`${props.origin[0]}:${props.origin[1]}`} origin={props.origin} onChange={props.onOriginChange} />}
    </>;
}
// Keep the draggable start outside the timed animation. A controlled Marker
// otherwise snaps to its old coordinates on each animation render during a drag.
function OriginMarker({ origin, onChange }: { origin: Coordinate; onChange: (point: Coordinate) => void }) {
    const [point, setPoint] = useState(origin);
    return <Marker longitude={point[0]} latitude={point[1]} anchor="center" draggable
        onDrag={event => setPoint([event.lngLat.lng, event.lngLat.lat])}
        onDragEnd={event => { const next: Coordinate = [event.lngLat.lng, event.lngLat.lat]; setPoint(next); onChange(next); }}>
        <div className="atlas-origin-pin" aria-label="Search start. Drag to move." title="Your starting point · drag to move"><span /><b>Start</b></div>
    </Marker>;
}
function SearchNetwork({ sequence, origin, targets, route, destination }: Props) {
    const { current: map } = useMap();
    const beforeId = map?.getLayer(LAYER_CLUSTERS) ? LAYER_CLUSTERS : undefined;
    const [elapsed, setElapsed] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 8000 : 0);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const start = performance.now();
        const timer = window.setInterval(() => {
            const time = performance.now() - start;
            setElapsed(time);
            if (time >= 7000) window.clearInterval(timer);
        }, 40);
        return () => window.clearInterval(timer);
    }, []);
    const discoveries = useMemo(() => targets.slice(0, 24).flatMap((target, i) => {
        const dx = target[0] - origin[0], dy = target[1] - origin[1];
        const points: Coordinate[] = Array.from({ length: 13 }, (_, j) => {
            const t = j / 12, bend = Math.sin(t * Math.PI) * Math.sin(j * 1.7 + i) * .065;
            return [origin[0] + dx * t - dy * bend, origin[1] + dy * t + dx * bend];
        });
        return [points, [points[5], [points[5][0] + dx * .13 - dy * .08, points[5][1] + dy * .13 + dx * .08] as Coordinate]];
    }), [origin, targets]);
    const network = useMemo(() => lines(route ? route.branches.slice(0, 700) : discoveries), [route, discoveries]);
    const routed = useMemo(() => lines(route ? [route.coordinates] : []), [route]);
    const connectors = useMemo(() => lines(route && destination ? [
        [origin, route.coordinates[0]], [route.coordinates[route.coordinates.length - 1], destination]
    ] : []), [origin, route, destination]);
    const progress = Math.max(.00001, Math.min(1, (elapsed - 650) / 2400));
    const gradient = (color: string): ExpressionSpecification => ['step', ['line-progress'], color, progress, 'rgba(0,0,0,0)'];
    const networkOpacity = sequence === 0 ? 0 : Math.min(1, elapsed / 650) * Math.max(0, Math.min(.65, (6500 - elapsed) / 2200));
    return <>
        <Source id="atlas-network" type="geojson" data={network} lineMetrics>
            <Layer id="atlas-network-lines" beforeId={beforeId} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-width': 1.5, 'line-gradient': gradient('#709149'), 'line-opacity': networkOpacity }} />
        </Source>
        <Source id="atlas-walking-route" type="geojson" data={routed} lineMetrics>
            <Layer id="atlas-route-casing" beforeId={beforeId} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-width': 13, 'line-gradient': gradient('#ffffff') }} />
            <Layer id="atlas-route-line" beforeId={beforeId} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-width': 9, 'line-gradient': gradient('#075333') }} />
            <Layer id="atlas-route-highlight" beforeId={beforeId} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{ 'line-width': 3, 'line-gradient': gradient('#b5ff48') }} />
        </Source>
        <Source id="atlas-route-connections" type="geojson" data={connectors}>
            <Layer id="atlas-connections-casing" beforeId={beforeId} type="line" paint={{ 'line-color': '#fffdf2', 'line-width': 6, 'line-dasharray': [1, 1.5] }} />
            <Layer id="atlas-connections-dashed" beforeId={beforeId} type="line" paint={{ 'line-color': '#927958', 'line-width': 2.5, 'line-dasharray': [2, 3] }} />
        </Source>
    </>;
}
