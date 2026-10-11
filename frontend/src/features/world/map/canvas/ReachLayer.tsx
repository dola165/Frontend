import { useMemo } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { MapReach } from '../../stage/stageContext';
import { reachRing, reachTop } from '../reach';
import { useAppTheme, usePalette } from './useMapTheme';
import './canvas.css';

/** A stated reach (a referee's area) as a faint dashed ring with its label at the top: approximate by nature. */
export function ReachLayer({ reach }: { reach: MapReach }) {
    const palette = usePalette(useAppTheme());
    const { lat, lng, km } = reach;
    const data = useMemo(() => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [reachRing({ lat, lng, km, label: '' })] } }), [lat, lng, km]);
    const top = reachTop(reach);
    if (!palette) return null;
    return (
        <>
            <Source id="gk-reach" type="geojson" data={data}>
                <Layer id="gk-reach-fill" type="fill" paint={{ 'fill-color': palette.accent, 'fill-opacity': 0.06 }} />
                <Layer id="gk-reach-line" type="line" paint={{ 'line-color': palette.accent, 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [2, 2] }} />
            </Source>
            <Marker latitude={top.lat} longitude={top.lng} anchor="bottom">
                <span className="gk-map-label gk-map-label--reach">{reach.label}</span>
            </Marker>
        </>
    );
}
