import { distanceKm } from '../../../components/map/walkingGraph';
import type { FamilyItinerary, FamilyLocation, PlanActivity, PlanDraft, PlanPlace } from '../api';
import { locationRoles } from '../mapPlanning';

export type StopKind = 'meet' | 'activity' | 'destination' | 'return';
export interface ItineraryStop {
    id: string;
    kind: StopKind;
    title: string;
    startsAt: string | null;
    endsAt: string | null;
    place: (FamilyLocation & { key?: string }) | null;
    /** What the place field says when no map place is chosen (for example "Gate 2"). */
    note: string;
    activity?: PlanActivity;
    activityKind?: PlanActivity['kind'];
}
export interface Leg { from: ItineraryStop; to: ItineraryStop; minutes: number | null; km: number | null }

export const KIND_LABEL: Record<PlanActivity['kind'], string> = { MATCH: 'Match', TRAINING: 'Training', TRAVEL: 'Travel', STAY: 'Stay', MEAL: 'Meal', ACTIVITY: 'Activity' };

const stamp = (value: string | null) => (value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN);
const samePlace = (a: FamilyLocation | null, b: FamilyLocation | null) => Boolean(a && b && a.latitude === b.latitude && a.longitude === b.longitude);

/**
 * The journey in order: meet, every activity by start time, the destination when no
 * activity takes place there, then return and collection. Works for a draft and for the
 * published itinerary families see.
 */
export function stopsOf(itinerary: FamilyItinerary & { activityList?: PlanActivity[]; placeKeys?: Record<string, string> }): ItineraryStop[] {
    const located = (role: string) => itinerary.locations?.[role] ?? null;
    const activities = itinerary.activities
        .map((activity, index) => ({ activity, index }))
        .sort((a, b) => (stamp(a.activity.startsAt) - stamp(b.activity.startsAt)) || a.index - b.index);
    const stops: ItineraryStop[] = [{ id: 'meet', kind: 'meet', title: 'Meet the team', startsAt: itinerary.startsAt, endsAt: null, place: located('meeting'), note: itinerary.meetingPoint }];
    for (const { activity, index } of activities) {
        const source = itinerary.activityList?.[index];
        stops.push({ id: source?.key ?? `activity:${index}`, kind: 'activity', title: activity.title, startsAt: activity.startsAt, endsAt: activity.endsAt, place: activity.place, note: '', activity: source, activityKind: activity.kind as PlanActivity['kind'] });
    }
    const destination = located('destination');
    if (destination && !stops.some(stop => samePlace(stop.place, destination))) stops.push({ id: 'destination', kind: 'destination', title: 'Destination', startsAt: null, endsAt: null, place: destination, note: itinerary.destination });
    stops.push({ id: 'return', kind: 'return', title: 'Return and collection', startsAt: itinerary.endsAt, endsAt: null, place: located('collection'), note: itinerary.collectionPoint });
    return stops;
}

/** The draft as families would read it, keeping each activity's own record for editing. */
export function draftStops(draft: PlanDraft) {
    const place = (key?: string | null) => draft.places.find(item => item.key === key) ?? null;
    const shown = (p: PlanPlace | null) => p && { name: p.name, address: p.address, latitude: p.latitude, longitude: p.longitude, photoUrl: p.photoUrl, key: p.key };
    return stopsOf({
        title: draft.title, timezone: draft.timezone, startsAt: draft.startsAt, endsAt: draft.endsAt, destination: draft.destination, meetingPoint: draft.meetingPoint,
        collectionPoint: draft.collectionPoint, supervisionContact: draft.supervisionContact, message: draft.familyMessage,
        locations: Object.fromEntries((['meeting', 'destination', 'collection'] as const).flatMap(role => { const p = shown(place(locationRoles[role].key)); return p ? [[role, p]] : []; })),
        activities: draft.activities.map(activity => ({ title: activity.title, kind: activity.kind, startsAt: activity.startsAt, endsAt: activity.endsAt, place: shown(place(activity.placeKey)) })),
        activityList: draft.activities,
    });
}

/** Between two stops: the planned gap and the straight-line distance. Never a road route or travel estimate. */
export function legsOf(stops: ItineraryStop[]): Leg[] {
    const legs: Leg[] = [];
    for (let i = 1; i < stops.length; i++) {
        const from = stops[i - 1], to = stops[i];
        const leave = stamp(from.endsAt ?? from.startsAt), arrive = stamp(to.startsAt);
        const minutes = Number.isFinite(leave) && Number.isFinite(arrive) && arrive > leave ? Math.round((arrive - leave) / 60000) : null;
        const km = from.place && to.place && !samePlace(from.place, to.place) ? distanceKm([from.place.longitude, from.place.latitude], [to.place.longitude, to.place.latitude]) : null;
        legs.push({ from, to, minutes, km });
    }
    return legs;
}

export const durationLabel = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
export const kmLabel = (km: number) => km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;

/** Time and day in the plan's own time zone, as a fixture line shows them. */
export function stopClock(value: string | null, zone: string) {
    if (!value || !Number.isFinite(Date.parse(value))) return { time: '—', day: 'Time to confirm' };
    const date = new Date(value);
    return {
        time: new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(date),
        day: new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' }).format(date),
    };
}
export const dayKey = (value: string | null, zone: string) => value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '';

/** A new stop: after the last one (or at departure), an hour long, at the given place if any. */
export function blankActivity(draft: PlanDraft, place?: PlanPlace | null): PlanActivity {
    const last = [...draft.activities].sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))[0];
    const starts = last && Date.parse(last.endsAt) < Date.parse(draft.endsAt) ? last.endsAt : draft.startsAt;
    return { key: crypto.randomUUID(), title: place?.name ?? '', kind: 'ACTIVITY', startsAt: starts, endsAt: new Date(Math.min(Date.parse(draft.endsAt), Date.parse(starts) + 3600000)).toISOString(), placeKey: place?.key ?? null, eventId: null, sessionId: null, notes: '' };
}
