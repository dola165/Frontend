import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Marker, Source, useMap } from 'react-map-gl/maplibre';
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import type { PlacePalette } from './useMapTheme';
import { reducedMotion } from './useMapTheme';
import { wt } from '../../copy';
import './canvas.css';

export interface MapPlace { key: string; latitude: number; longitude: number; title: string; tone: 'club' | 'venue' | 'match' | 'trial' | 'competition' }

export const PLACES_SOURCE = 'gk-places';
export const PLACES_LAYER = 'gk-places-points';
interface Cluster { id: number; longitude: number; latitude: number; count: number }

/** Clusters are buttons: readable counts without map fonts, and each one zooms in on click. */
function useClusters(sourceId: string, signature: string) {
    const { current: map } = useMap();
    const [clusters, setClusters] = useState<Cluster[]>([]);
    useEffect(() => {
        if (!map) return;
        const raw = map.getMap();
        const update = () => {
            if (!raw.getSource(sourceId) || !raw.isSourceLoaded(sourceId)) return;
            const seen = new Map<number, Cluster>();
            for (const feature of raw.querySourceFeatures(sourceId, { filter: ['has', 'point_count'] })) {
                const id = Number(feature.properties?.cluster_id);
                if (seen.has(id) || feature.geometry.type !== 'Point') continue;
                const [longitude, latitude] = feature.geometry.coordinates;
                seen.set(id, { id, longitude, latitude, count: Number(feature.properties?.point_count) || 0 });
            }
            setClusters([...seen.values()]);
        };
        update();
        // Idle comes after the camera stops and the clustered tiles for the new zoom are ready.
        raw.on('idle', update);
        return () => { raw.off('idle', update); };
    }, [map, sourceId, signature]);
    return clusters;
}

/**
 * Places on the map: coloured points per kind, cluster bubbles, and a highlight shared with
 * the results list (hovering a row lights its point; hovering a point lights its row).
 */
export function PlacesLayer({ places, palette, selectedKey, hoveredKey, onSelect, onHover, interactive = true, faded = false }: {
    places: MapPlace[]; palette: PlacePalette; selectedKey: string | null; hoveredKey: string | null;
    onSelect: (key: string) => void; onHover: (key: string | null) => void; interactive?: boolean; faded?: boolean;
}) {
    const { current: map } = useMap();
    const data = useMemo(() => ({
        type: 'FeatureCollection' as const,
        features: places.map(place => ({ type: 'Feature' as const, properties: { key: place.key, tone: place.tone, title: place.title }, geometry: { type: 'Point' as const, coordinates: [place.longitude, place.latitude] } })),
    }), [places]);
    const signature = useMemo(() => places.map(place => place.key).join('|'), [places]);
    const clusters = useClusters(PLACES_SOURCE, signature);
    const handlers = useRef({ onSelect, onHover, interactive });
    useEffect(() => { handlers.current = { onSelect, onHover, interactive }; }, [onSelect, onHover, interactive]);

    useEffect(() => {
        if (!map) return;
        const raw = map.getMap();
        const click = (event: MapLayerMouseEvent) => { if (handlers.current.interactive) { const key = event.features?.[0]?.properties?.key; if (typeof key === 'string') handlers.current.onSelect(key); } };
        const enter = (event: MapLayerMouseEvent) => {
            if (!handlers.current.interactive) return;
            raw.getCanvas().style.cursor = 'pointer';
            const key = event.features?.[0]?.properties?.key;
            handlers.current.onHover(typeof key === 'string' ? key : null);
        };
        const leave = () => { raw.getCanvas().style.cursor = ''; handlers.current.onHover(null); };
        raw.on('click', PLACES_LAYER, click);
        raw.on('mousemove', PLACES_LAYER, enter);
        raw.on('mouseleave', PLACES_LAYER, leave);
        return () => { raw.off('click', PLACES_LAYER, click); raw.off('mousemove', PLACES_LAYER, enter); raw.off('mouseleave', PLACES_LAYER, leave); };
    }, [map]);

    const tone: ExpressionSpecification = ['match', ['get', 'tone'], 'venue', palette.venue, 'match', palette.match, 'trial', palette.trial, 'competition', palette.competition, palette.club];
    const lit = [selectedKey, hoveredKey].filter(Boolean) as string[];
    const isLit: ExpressionSpecification = ['in', ['get', 'key'], ['literal', lit]];
    const selected = places.find(place => place.key === selectedKey);
    const zoomInto = (cluster: Cluster) => {
        const source = map?.getMap().getSource(PLACES_SOURCE) as GeoJSONSource | undefined;
        void source?.getClusterExpansionZoom(cluster.id).then(zoom => map?.easeTo({ center: [cluster.longitude, cluster.latitude], zoom: Math.min(zoom + 0.2, 17), duration: reducedMotion() ? 0 : 450 }));
    };
    return (
        <>
            <Source id={PLACES_SOURCE} type="geojson" data={data} cluster clusterMaxZoom={13} clusterRadius={44}>
                <Layer id="gk-places-halo" type="circle" filter={['all', ['!', ['has', 'point_count']], isLit]}
                    paint={{ 'circle-radius': 15, 'circle-color': tone, 'circle-opacity': 0.22, 'circle-stroke-width': 2, 'circle-stroke-color': tone }} />
                <Layer id={PLACES_LAYER} type="circle" filter={['!', ['has', 'point_count']]}
                    paint={{
                        // Zoom must drive the outermost expression; the highlight is decided at each stop.
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, ['case', isLit, 7, 4.5], 12, ['case', isLit, 8.5, 6.5], 15, ['case', isLit, 10, 8]],
                        'circle-color': tone, 'circle-stroke-width': 2, 'circle-stroke-color': palette.surface,
                        'circle-opacity': faded ? 0.45 : 1, 'circle-stroke-opacity': faded ? 0.45 : 1,
                    }} />
            </Source>
            {clusters.map(cluster => (
                <Marker key={cluster.id} longitude={cluster.longitude} latitude={cluster.latitude} anchor="center">
                    <button type="button" className="gk-map-cluster" data-size={cluster.count >= 50 ? 'lg' : cluster.count >= 10 ? 'md' : 'sm'}
                        aria-label={wt('{count} places here. Zoom in', { count: cluster.count })} onClick={event => { event.stopPropagation(); zoomInto(cluster); }}>
                        {cluster.count > 99 ? '99+' : cluster.count}
                    </button>
                </Marker>
            ))}
            {selected && (
                <Marker longitude={selected.longitude} latitude={selected.latitude} anchor="bottom" offset={[0, -14]} style={{ pointerEvents: 'none' }}>
                    <span className="gk-map-label">{selected.title}</span>
                </Marker>
            )}
        </>
    );
}
