import { useEffect } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import Map, { Marker, NavigationControl, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { WorldMapPoint } from './WorldMap';

function FitPoints({ points }: { points: WorldMapPoint[] }) {
    const { current: map } = useMap();
    useEffect(() => {
        if (!map || !points.length) return;
        const lngs = points.map(p => p.lng), lats = points.map(p => p.lat);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 48, maxZoom: 13, duration: 300 });
    }, [map, points]);
    return null;
}

/** The street-map layer of WorldMap. Loaded only when the map style is available. */
export default function WorldLiveMap({ style, points, selectedId, onSelect, onFail }: {
    style: StyleSpecification; points: WorldMapPoint[]; selectedId?: string; onSelect: (id?: string) => void; onFail: () => void;
}) {
    const first = points[0];
    return (
        <Map
            initialViewState={{ latitude: first?.lat ?? 41.7151, longitude: first?.lng ?? 44.8271, zoom: 11 }}
            mapStyle={style}
            style={{ width: '100%', height: '100%' }}
            onError={onFail}
            attributionControl={{ compact: true }}
            cooperativeGestures
        >
            <NavigationControl position="top-right" showCompass={false} />
            <FitPoints points={points} />
            {points.map(point => (
                <Marker key={point.id} latitude={point.lat} longitude={point.lng} anchor="center">
                    <button type="button" className="gk-world-pin" data-tone={point.tone} data-selected={point.id === selectedId || undefined}
                        aria-label={`${point.label}${point.meta ? `, ${point.meta}` : ''}`} title={point.label} onClick={() => onSelect(point.id)} />
                </Marker>
            ))}
        </Map>
    );
}
