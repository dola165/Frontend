import { useMemo, useState } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { Coordinate, WalkingRoute } from '../../../../components/map/walkingGraph';
import type { PlacePalette } from './useMapTheme';
import './canvas.css';

const lines = (paths: Coordinate[][]) => ({
    type: 'FeatureCollection' as const,
    features: paths.filter(path => path.length > 1).map(coordinates => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } })),
});

/** The draggable start keeps its own position while dragging, so it never snaps back mid-drag. */
function StartMarker({ origin, onChange }: { origin: Coordinate; onChange: (point: Coordinate) => void }) {
    const [point, setPoint] = useState(origin);
    return (
        <Marker longitude={point[0]} latitude={point[1]} anchor="center" draggable
            onDrag={event => setPoint([event.lngLat.lng, event.lngLat.lat])}
            onDragEnd={event => { const next: Coordinate = [event.lngLat.lng, event.lngLat.lat]; setPoint(next); onChange(next); }}>
            <span className="gk-map-start" role="img" aria-label="Your start. Drag to move it." title="Your start · drag to move"><span /></span>
        </Marker>
    );
}

/** Your start point and, when calculated, the walking route on mapped paths with dashed unmapped ends. */
export function WalkLayer({ origin, destination, route, palette, onOriginChange }: {
    origin: Coordinate | null; destination: Coordinate | null; route: WalkingRoute | null; palette: PlacePalette; onOriginChange: (point: Coordinate) => void;
}) {
    const path = useMemo(() => lines(route ? [route.coordinates] : []), [route]);
    const ends = useMemo(() => lines(route && origin && destination ? [[origin, route.coordinates[0]], [route.coordinates[route.coordinates.length - 1], destination]] : []), [route, origin, destination]);
    return (
        <>
            <Source id="gk-walk" type="geojson" data={path}>
                <Layer id="gk-walk-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': palette.surface, 'line-width': 9 }} />
                <Layer id="gk-walk-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': palette.accent, 'line-width': 5 }} />
            </Source>
            <Source id="gk-walk-ends" type="geojson" data={ends}>
                <Layer id="gk-walk-ends-line" type="line" paint={{ 'line-color': palette.muted, 'line-width': 2.5, 'line-dasharray': [2, 2] }} />
            </Source>
            {origin && <StartMarker key={`${origin[0]}:${origin[1]}`} origin={origin} onChange={onOriginChange} />}
        </>
    );
}
