import type { PlanDraft, PlanPlace } from './api';

export type LocationRole = 'destination' | 'meeting' | 'collection';
export type PickTarget = LocationRole | 'place' | 'activity';
export const locationRoles: Record<LocationRole, { key: string; field: 'destination' | 'meetingPoint' | 'collectionPoint'; label: string; marker: string }> = {
  destination: { key: 'plan:destination', field: 'destination', label: 'Destination', marker: 'D' },
  meeting: { key: 'plan:meeting', field: 'meetingPoint', label: 'Meeting place', marker: 'M' },
  collection: { key: 'plan:collection', field: 'collectionPoint', label: 'Collection place', marker: 'C' },
};
export const roleForPlace = (key: string) => (Object.keys(locationRoles) as LocationRole[]).find(role => locationRoles[role].key === key);
/** Schematic links between chosen stops, never a road route or a travel estimate. */
export function planningStops(draft:Pick<PlanDraft,'places'|'activities'>):PlanPlace[]{
  const result:PlanPlace[]=[];
  const add=(key:string)=>{const place=draft.places.find(p=>p.key===key),last=result.at(-1);if(place&&(!last||last.latitude!==place.latitude||last.longitude!==place.longitude))result.push(place);};
  add(locationRoles.meeting.key);
  [...draft.activities].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).forEach(a=>{if(a.placeKey)add(a.placeKey);});
  if(!result.some(p=>p.key===locationRoles.destination.key))add(locationRoles.destination.key);
  add(locationRoles.collection.key);
  return result;
}
export function putPlanningPlace(draft: PlanDraft, place: PlanPlace, target: PickTarget): Partial<PlanDraft> {
  const savedRole = target in locationRoles ? target as LocationRole : roleForPlace(place.key);
  const role = savedRole ? locationRoles[savedRole] : null;
  const saved = { ...place, key: role?.key || place.key };
  return {
    places: draft.places.some(p => p.key === saved.key) ? draft.places.map(p => p.key === saved.key ? saved : p) : [...draft.places, saved],
    ...(role ? { [role.field]: [saved.name, saved.address].filter(Boolean).join(' · ').slice(0, 400) } : {}),
  };
}
