import { useMemo } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { PlacePalette } from './useMapTheme';
import './canvas.css';

export interface RouteStop { id: string; label: string; title: string; latitude: number | null; longitude: number | null; kind: 'meet' | 'stop' | 'match' | 'return' | 'place' }

/**
 * A journey drawn on the map: numbered stops in order, joined by straight dashed legs.
 * Legs are links between planned stops, never road directions. A stop without a place
 * breaks the line rather than inventing where it is.
 */
export function RouteLayer({ stops, places = [], palette, selectedId, onSelect, sourceId = 'gk-route' }: {
    stops: RouteStop[]; places?: RouteStop[]; palette: PlacePalette; selectedId: string | null; onSelect?: (id: string) => void; sourceId?: string;
}) {
    const legs = useMemo(() => {
        const features: { type: 'Feature'; properties: { active: boolean }; geometry: { type: 'LineString'; coordinates: number[][] } }[] = [];
        for (let i = 1; i < stops.length; i++) {
            const a = stops[i - 1], b = stops[i];
            if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) continue;
            if (a.latitude === b.latitude && a.longitude === b.longitude) continue;
            // Take the short way round, also across the date line.
            const end = a.longitude + ((b.longitude - a.longitude + 540) % 360 - 180);
            features.push({ type: 'Feature', properties: { active: b.id === selectedId || a.id === selectedId }, geometry: { type: 'LineString', coordinates: [[a.longitude, a.latitude], [end, b.latitude]] } });
        }
        return { type: 'FeatureCollection' as const, features };
    }, [stops, selectedId]);
    // Stops at the same place share one marker that lists every number.
    const markers = useMemo(() => {
        const groups = new Map<string, RouteStop[]>();
        for (const stop of stops) {
            if (stop.latitude == null || stop.longitude == null) continue;
            const key = `${stop.latitude.toFixed(5)},${stop.longitude.toFixed(5)}`;
            groups.set(key, [...(groups.get(key) ?? []), stop]);
        }
        return [...groups.values()];
    }, [stops]);
    return (
        <>
            <Source id={sourceId} type="geojson" data={legs}>
                <Layer id={`${sourceId}-casing`} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': palette.surface, 'line-width': ['case', ['get', 'active'], 8, 6], 'line-opacity': 0.9 }} />
                <Layer id={`${sourceId}-line`} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                    paint={{ 'line-color': palette.route, 'line-width': ['case', ['get', 'active'], 4, 2.5], 'line-dasharray': [1.6, 1.6], 'line-opacity': ['case', ['get', 'active'], 1, 0.8] }} />
            </Source>
            {places.filter(place => place.latitude != null && place.longitude != null).map(place => (
                <Marker key={place.id} longitude={place.longitude!} latitude={place.latitude!} anchor="center">
                    <button type="button" className="gk-route-place" aria-label={`Saved place: ${place.title}`} title={place.title} onClick={event => { event.stopPropagation(); onSelect?.(place.id); }} />
                </Marker>
            ))}
            {markers.map(group => {
                const active = group.find(stop => stop.id === selectedId) ?? group[0];
                const label = group.length > 3 ? `${group[0].label}–${group.at(-1)!.label}` : group.map(stop => stop.label).join('·');
                return (
                    <Marker key={group.map(stop => stop.id).join()} longitude={active.longitude!} latitude={active.latitude!} anchor="center" style={{ zIndex: group.some(stop => stop.id === selectedId) ? 3 : 2 }}>
                        <button type="button" className="gk-route-stop" data-kind={active.kind} aria-current={group.some(stop => stop.id === selectedId) ? 'step' : undefined}
                            aria-label={group.map(stop => `Stop ${stop.label}: ${stop.title}`).join('; ')} title={group.map(stop => stop.title).join(' · ')}
                            onClick={event => { event.stopPropagation(); onSelect?.(active.id); }}>
                            {label}
                        </button>
                    </Marker>
                );
            })}
        </>
    );
}
