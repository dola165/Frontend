import { useMemo } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import { groupLabel, routeGroups, routeLegs, type RouteStop } from './routeGeometry';
import type { PlacePalette } from './useMapTheme';
import './canvas.css';

/**
 * A journey drawn on the map: numbered stops in order, joined by straight dashed legs.
 * See routeLegs for how unplaced stops are drawn.
 */
export function RouteLayer({ stops, places = [], palette, selectedId, onSelect, sourceId = 'gk-route' }: {
    stops: RouteStop[]; places?: RouteStop[]; palette: PlacePalette; selectedId: string | null; onSelect?: (id: string) => void; sourceId?: string;
}) {
    const legs = useMemo(() => routeLegs(stops, selectedId), [stops, selectedId]);
    const markers = useMemo(() => routeGroups(stops), [stops]);
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
                const label = groupLabel(group);
                return (
                    <Marker key={group.map(stop => stop.id).join()} longitude={active.longitude} latitude={active.latitude} anchor="center" style={{ zIndex: group.some(stop => stop.id === selectedId) ? 3 : 2 }}>
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
