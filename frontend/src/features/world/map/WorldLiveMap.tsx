import { useEffect, useEffectEvent, type CSSProperties } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import Map, { Marker, NavigationControl, useMap, type ViewStateChangeEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapBounds } from '../../../components/map/areaSearch';
import { pinHover, pinLabel } from './pins';
import type { PinEvents, WorldMapPoint } from './WorldMap';

/**
 * Frames the points when the set of places changes, not on every render, so a pan or zoom stays put. `insetRight`
 * keeps them clear of a panel floating over the map's right side.
 */
function FitPoints({ points, insetRight = 0 }: { points: WorldMapPoint[]; insetRight?: number }) {
    const { current: map } = useMap();
    const placed = points.map(p => `${p.id}@${p.lat},${p.lng}`).join('|');
    const fit = useEffectEvent(() => {
        if (!map || !points.length) return;
        const lngs = points.map(p => p.lng), lats = points.map(p => p.lat);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: { top: 64, bottom: 64, left: 64, right: 64 + insetRight }, maxZoom: 13, duration: 300 });
    });
    useEffect(() => { fit(); }, [map, placed, insetRight]);
    return null;
}

/** The street-map layer of WorldMap. Loaded only when the map style is available. */
export default function WorldLiveMap({ style, points, selectedId, highlightId, onSelect, onHover, onMoveEnd, onFail, insetRight }: {
    style: StyleSpecification; points: WorldMapPoint[]; onFail: () => void; insetRight?: number;
    /** Only moves the person made: framing the points is not one. */ onMoveEnd?: (bounds: MapBounds) => void;
} & PinEvents) {
    const first = points[0];
    const moved = (event: ViewStateChangeEvent) => {
        if (!onMoveEnd || !event.originalEvent) return;
        const box = event.target.getBounds();
        onMoveEnd({ west: box.getWest(), south: box.getSouth(), east: box.getEast(), north: box.getNorth() });
    };
    return (
        <Map
            initialViewState={{ latitude: first?.lat ?? 41.7151, longitude: first?.lng ?? 44.8271, zoom: 11 }}
            mapStyle={style}
            style={{ width: '100%', height: '100%' }}
            onError={onFail}
            onMoveEnd={moved}
            attributionControl={{ compact: true }}
            cooperativeGestures
        >
            <NavigationControl position="top-right" showCompass={false} />
            <FitPoints points={points} insetRight={insetRight} />
            {points.map((point, index) => (
                <Marker key={point.id} latitude={point.lat} longitude={point.lng} anchor="center">
                    <button type="button" className="gk-world-pin" data-tone={point.tone} style={{ '--pin-i': index % 7 } as CSSProperties}
                        data-selected={point.id === selectedId || point.id === highlightId || undefined}
                        data-count={point.count && point.count > 1 ? point.count : undefined} data-approx={point.approximate || undefined}
                        aria-label={pinLabel(point)} title={pinLabel(point)} onClick={() => onSelect(point.id)} {...pinHover(point.id, onHover)}>
                        {point.count && point.count > 1 ? <span className="gk-world-pin__count">{point.count}</span> : null}
                    </button>
                </Marker>
            ))}
        </Map>
    );
}
