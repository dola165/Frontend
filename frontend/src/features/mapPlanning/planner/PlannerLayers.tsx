import { useEffect, useRef } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { RouteLayer } from '../../world/map/canvas/RouteLayer';
import type { PlacePalette } from '../../world/map/canvas/useMapTheme';
import type { Planner } from './usePlanner';

/** The journey on the map: numbered stops and legs, spare saved places, and a place being chosen. */
export function PlannerLayers({ planner, palette }: { planner: Planner; palette: PlacePalette }) {
    const { stops, places, routeKey, planMap } = planner;
    const framed = useRef('');
    const { fit } = planMap;
    // Frame the whole journey when a plan or journey opens, not on every edit.
    useEffect(() => {
        if (routeKey === 'none' || framed.current === routeKey) return;
        const points = [...stops, ...places].filter(stop => stop.latitude != null && stop.longitude != null).map(stop => ({ latitude: stop.latitude!, longitude: stop.longitude! }));
        if (!points.length) return;
        framed.current = routeKey;
        fit(points);
    }, [routeKey, stops, places, fit]);
    return (
        <>
            <RouteLayer stops={stops} places={places} palette={palette} selectedId={planMap.selectedStop}
                onSelect={id => { planMap.selectStop(id); const stop = [...stops, ...places].find(item => item.id === id); if (stop?.latitude != null && stop.longitude != null) planMap.focus({ latitude: stop.latitude, longitude: stop.longitude }); }} />
            {planMap.candidate && (
                <Marker longitude={planMap.candidate.longitude} latitude={planMap.candidate.latitude} anchor="center">
                    <span className="gk-map-pick" role="img" aria-label="Place being chosen" />
                </Marker>
            )}
        </>
    );
}
