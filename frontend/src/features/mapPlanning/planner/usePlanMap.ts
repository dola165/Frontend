import { useCallback, useRef, useState, type RefObject } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { pointsBounds } from '../../world/map/canvas/viewport';
import type { PlanPlace } from '../api';
import { locationRoles, putPlanningPlace, type LocationRole, type PickTarget } from '../mapPlanning';
import type { PlanEditor } from './usePlanEditor';

const motion = () => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 700);
/** Room for the map's own furniture: on a phone the sheet covers the lower half and the controls sit on the right. */
const padding = (map: MapRef, phone: boolean) => phone
    ? { top: 48, bottom: Math.round(map.getContainer().clientHeight * 0.5) + 24, left: 40, right: 76 }
    : { top: 90, bottom: 90, left: 90, right: 110 };
export const targetLabel = (target: PickTarget | null) => target && target in locationRoles ? locationRoles[target as LocationRole].label.toLowerCase() : target === 'activity' ? 'the place for this stop' : 'a place';

/**
 * The map side of planning: choosing places by clicking the map or searching, the place
 * being confirmed, and the stop in focus. Places reach the plan only after the coach
 * names and confirms them.
 */
export function usePlanMap(editor: PlanEditor, mapRef: RefObject<MapRef | null>, phone: boolean) {
    const [pick, setPick] = useState<PickTarget | null>(null);
    const [candidate, setCandidate] = useState<PlanPlace | null>(null);
    const [selectedStop, setSelectedStop] = useState<string | null>(null);
    /** A place the coach asked to turn into a stop; the itinerary opens a new stop with it. */
    const [seed, setSeed] = useState<PlanPlace | null>(null);
    const receiver = useRef<((place: PlanPlace) => void) | null>(null);

    /** Brings a place into view; `exact` sets the zoom instead of only ever zooming in. */
    const focus = useCallback((place: { latitude: number; longitude: number }, zoom = 14, exact = false) => {
        const map = mapRef.current;
        map?.flyTo({ center: [place.longitude, place.latitude], zoom: exact ? zoom : Math.max(map.getZoom(), zoom), padding: map ? padding(map, phone) : undefined, duration: motion() });
    }, [mapRef, phone]);
    const fit = useCallback((points: { latitude: number; longitude: number }[]) => {
        const map = mapRef.current;
        if (!map || !points.length) return;
        if (points.length === 1) { focus(points[0], 13); return; }
        map.fitBounds(pointsBounds(points), {
            padding: padding(map, phone), maxZoom: 14, duration: motion(),
        });
    }, [mapRef, phone, focus]);

    const cancel = () => { setPick(null); setCandidate(null); receiver.current = null; };
    return {
        pick, candidate, selectedStop, focus, fit, seed,
        consumeSeed: () => setSeed(null),
        selectStop: (id: string | null) => setSelectedStop(id),
        /** Ask for a place; `receive` gets it once confirmed (a stop's place). */
        begin: (target: PickTarget, receive?: (place: PlanPlace) => void) => { if (!editor.canEdit) return; setPick(target); setCandidate(null); receiver.current = receive ?? null; },
        cancel,
        /** A clicked map point or search result, waiting for a name and confirmation. */
        propose: (place: PlanPlace) => { if (editor.canEdit && editor.draft) setCandidate(place); },
        use: (place: PlanPlace, as: PickTarget) => {
            const draft = editor.draft;
            if (!draft || !editor.canEdit) return;
            const patch = putPlanningPlace(draft, place, as);
            if (patch.places!.length > 60) { cancel(); editor.addPlace(place); return; }
            editor.change(patch);
            const saved = patch.places!.find(item => item.key === (as in locationRoles ? locationRoles[as as LocationRole].key : place.key));
            if (as === 'activity' && saved) { if (receiver.current) receiver.current(saved); else setSeed(saved); }
            cancel();
        },
    };
}
export type PlanMap = ReturnType<typeof usePlanMap>;
