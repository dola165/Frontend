import type { MapBounds } from '../../../components/map/areaSearch';
import { distanceKm } from '../../../components/map/walkingGraph';
import type { MapLine } from '../stage/stageContext';

interface Point { lat: number; lng: number; name?: string }

/**
 * The away day of a match: a straight line from where the travelling side comes from to the ground, labelled with
 * the distance as the crow flies. No line when the two are under a kilometre apart (a home ground, a derby).
 */
export function awayLine(from: Point, to: Point, label: (km: number) => string, title: string): MapLine | null {
    const km = distanceKm([from.lng, from.lat], [to.lng, to.lat]);
    return km < 1 ? null : { from, to, label: label(km), title };
}

/** Of several places, the one furthest from a point: where the travelling side comes from. */
export function farthest<T extends Point>(points: T[], to: Point): T | undefined {
    const km = (point: Point) => distanceKm([point.lng, point.lat], [to.lng, to.lat]);
    return points.reduce<T | undefined>((best, point) => !best || km(point) > km(best) ? point : best, undefined);
}

/** The box that keeps both ends of a line in view. */
export const pairBounds = ({ from, to }: MapLine): MapBounds => ({
    west: Math.min(from.lng, to.lng), south: Math.min(from.lat, to.lat), east: Math.max(from.lng, to.lng), north: Math.max(from.lat, to.lat),
});

/** The middle of a line, where its label sits. */
export const midpoint = ({ from, to }: MapLine): Point => ({ lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 });
