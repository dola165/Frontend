import type { MapBounds } from '../../../components/map/areaSearch';
import type { MapReach } from '../stage/stageContext';

const KM_PER_DEGREE_LAT = 110.574, KM_PER_DEGREE_LNG = 111.32;
const spans = ({ lat, km }: MapReach) => ({ lat: km / KM_PER_DEGREE_LAT, lng: km / (KM_PER_DEGREE_LNG * Math.cos(lat * Math.PI / 180)) });

/** The ring of `km` around a place, as a closed line of [lng, lat] points. */
export function reachRing(reach: MapReach, steps = 64): [number, number][] {
    const d = spans(reach);
    return Array.from({ length: steps + 1 }, (_, i) => {
        const angle = (i / steps) * 2 * Math.PI;
        return [reach.lng + d.lng * Math.cos(angle), reach.lat + d.lat * Math.sin(angle)];
    });
}

/** The box around a reach and any places that must stay in view with it (the ground being staffed). */
export function reachBounds(reach: MapReach, also: { lat: number; lng: number }[] = []): MapBounds {
    const d = spans(reach);
    const lats = [reach.lat - d.lat, reach.lat + d.lat, ...also.map(p => p.lat)], lngs = [reach.lng - d.lng, reach.lng + d.lng, ...also.map(p => p.lng)];
    return { west: Math.min(...lngs), south: Math.min(...lats), east: Math.max(...lngs), north: Math.max(...lats) };
}

/** Where a reach's label sits: on its top edge. */
export const reachTop = (reach: MapReach) => ({ lat: reach.lat + spans(reach).lat, lng: reach.lng });
