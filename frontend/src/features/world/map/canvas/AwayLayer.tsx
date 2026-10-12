import { useMemo } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { MapLine } from '../../stage/stageContext';
import { midpoint } from '../away';
import { useAppTheme, usePalette } from './useMapTheme';
import './canvas.css';

/** The chosen match's away day: a dashed line from the travelling club to the ground, its distance at the middle. */
export function AwayLayer({ line }: { line: MapLine }) {
    const palette = usePalette(useAppTheme());
    const { from, to } = line;
    const data = useMemo(() => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: [[from.lng, from.lat], [to.lng, to.lat]] } }),
        [from.lat, from.lng, to.lat, to.lng]);
    const middle = midpoint(line);
    if (!palette) return null;
    return (
        <>
            <Source id="gk-away" type="geojson" data={data}>
                <Layer id="gk-away-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': palette.surface, 'line-width': 6, 'line-opacity': 0.85 }} />
                <Layer id="gk-away-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': palette.route, 'line-width': 2.5, 'line-dasharray': [1.6, 1.6] }} />
            </Source>
            <Marker latitude={middle.lat} longitude={middle.lng} anchor="center">
                <span className="gk-map-label gk-map-label--away" title={line.title}>{line.label}</span>
            </Marker>
        </>
    );
}
