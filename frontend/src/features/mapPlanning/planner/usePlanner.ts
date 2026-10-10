import { useMemo, useState, type RefObject } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { useSearchParams } from 'react-router-dom';
import type { RouteStop } from '../../world/map/canvas/routeGeometry';
import type { FamilyItinerary, PlanPlace } from '../api';
import type { PlaceRecord } from '../../world/map/explore/records';
import { useFamilyJourneys } from '../journey/useFamilyJourneys';
import { draftItinerary } from '../journeyModel';
import { locationRoles } from '../mapPlanning';
import { draftStops, stopsOf, type ItineraryStop } from './itinerary';
import { usePlanEditor } from './usePlanEditor';
import { usePlanMap } from './usePlanMap';

export type PlannerMode = 'start' | 'edit' | 'preview' | 'family';

export const routeOf = (stops: ItineraryStop[]): RouteStop[] => stops.map((stop, index) => ({
    id: stop.id, label: String(index + 1), title: stop.title, latitude: stop.place?.latitude ?? null, longitude: stop.place?.longitude ?? null,
    kind: stop.kind === 'meet' ? 'meet' : stop.kind === 'return' ? 'return' : stop.activityKind === 'MATCH' ? 'match' : 'stop',
    bridge: stop.activityKind === 'TRAVEL',
}));

/**
 * Journey planning on the World map (`?plans=staff` or `?plans=family`): which view is
 * open, the plan being edited, journeys shared with you, and the route the map draws.
 */
export function usePlanner({ enabled, mapRef, phone, clubId }: { enabled: boolean; mapRef: RefObject<MapRef | null>; phone: boolean; clubId?: number | null }) {
    const [params, setParams] = useSearchParams();
    const kind = params.get('plans');
    const staff = enabled && kind !== 'family';
    const editor = usePlanEditor({ enabled: staff, initialClubId: clubId });
    const planMap = usePlanMap(editor, mapRef, phone);
    const family = useFamilyJourneys(enabled && (kind === 'family' || editor.contexts?.length === 0));
    const view = params.get('view');
    const journeyId = Number(params.get('journey')) || 0, journeyChild = Number(params.get('journeyChild')) || 0;
    const selectedJourney = family.items.find(item => item.plan_id === journeyId && (!journeyChild || item.child_id === journeyChild)) ?? null;

    const mode: PlannerMode = !enabled ? 'start' : kind === 'family' ? 'family' : (view === 'journey' || view === 'draft') && editor.draft ? 'preview' : editor.draft || params.has('plan') || params.has('draft') ? 'edit' : 'start';
    const preview: FamilyItinerary | null = view === 'journey' && editor.plan?.published ? editor.plan.published : editor.draft ? draftItinerary(editor.draft) : null;

    const { stops, places, routeKey } = useMemo(() => {
        if (mode === 'edit' && editor.draft) {
            const used = new Set([...editor.draft.activities.map(item => item.placeKey), ...Object.values(locationRoles).map(role => role.key)]);
            return {
                stops: routeOf(draftStops(editor.draft)),
                places: editor.draft.places.filter(place => !used.has(place.key)).map((place): RouteStop => ({ id: place.key, label: '', title: place.name, latitude: place.latitude, longitude: place.longitude, kind: 'place' })),
                routeKey: `edit:${editor.plan?.id ?? params.get('draft')}`,
            };
        }
        if (mode === 'preview' && preview) return { stops: routeOf(stopsOf(preview)), places: [], routeKey: `preview:${view}:${editor.plan?.id ?? ''}` };
        if (mode === 'family' && selectedJourney) return { stops: routeOf(stopsOf(selectedJourney.itinerary)), places: [], routeKey: `family:${selectedJourney.id}:${selectedJourney.version}` };
        return { stops: [] as RouteStop[], places: [] as RouteStop[], routeKey: 'none' };
        // The draft, preview and selection are the inputs; the key captures which plan.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, editor.draft, editor.plan, preview, selectedJourney, view]);

    // A place saved from the explore map waits here until the coach picks the journey for it.
    const [pendingPlace, setPendingPlace] = useState<PlanPlace | null>(null);
    const route = (mutate: (next: URLSearchParams) => void, replace = false) => setParams(current => { const next = new URLSearchParams(current); mutate(next); return next; }, { replace });
    return {
        mode, editor, planMap, family, stops, places, routeKey, preview, selectedJourney, view, pendingPlace,
        /** A journey link that names a journey this person does not have (withdrawn, or another account's). */
        missingJourney: Boolean(journeyId) && !selectedJourney && !family.loading && !family.error,
        clearPending: () => setPendingPlace(null),
        /** "Save to a journey" from a place on the map: open planning with the place waiting to be added. */
        save: (record: PlaceRecord) => {
            if (record.latitude == null || record.longitude == null) return;
            setPendingPlace({ key: record.key, name: record.title, address: record.address || record.city || '', latitude: record.latitude, longitude: record.longitude, type: (record.marker?.entityType === 'CLUB_NEED' ? 'MANUAL' : record.marker?.entityType ?? 'MANUAL') as PlanPlace['type'], entityId: record.marker?.entityId ?? null, notes: '' });
            route(next => { ['place', 'at', 'venue', 'opportunity'].forEach(name => next.delete(name)); next.set('plans', 'staff'); });
        },
        setPreview: (source: 'draft' | 'journey' | null) => route(next => { if (source) next.set('view', source); else next.delete('view'); }),
        openJourney: (journey: { plan_id: number; child_id: number } | null) => route(next => {
            if (journey) { next.set('journey', String(journey.plan_id)); next.set('journeyChild', String(journey.child_id)); } else { next.delete('journey'); next.delete('journeyChild'); }
        }),
        toFamily: () => route(next => { ['plan', 'draft', 'view', 'step'].forEach(name => next.delete(name)); next.set('plans', 'family'); }),
        toStaff: () => route(next => { ['journey', 'journeyChild'].forEach(name => next.delete(name)); next.set('plans', 'staff'); }),
    };
}
export type Planner = ReturnType<typeof usePlanner>;
