import type { PlanDraft, PlanPlace } from './api';

export type LocationRole = 'destination' | 'meeting' | 'collection';
export type PickTarget = LocationRole | 'place' | 'activity';
/** The three places every journey names: where it goes, where the team meets and where families collect. */
export const locationRoles: Record<LocationRole, { key: string; field: 'destination' | 'meetingPoint' | 'collectionPoint'; label: string }> = {
  destination: { key: 'plan:destination', field: 'destination', label: 'Destination' },
  meeting: { key: 'plan:meeting', field: 'meetingPoint', label: 'Meeting point' },
  collection: { key: 'plan:collection', field: 'collectionPoint', label: 'Collection point' },
};
export const roleForPlace = (key: string) => (Object.keys(locationRoles) as LocationRole[]).find(role => locationRoles[role].key === key);
export function putPlanningPlace(draft: PlanDraft, place: PlanPlace, target: PickTarget): Partial<PlanDraft> {
  const savedRole = target in locationRoles ? target as LocationRole : roleForPlace(place.key);
  const role = savedRole ? locationRoles[savedRole] : null;
  const saved = { ...place, key: role?.key || place.key };
  return {
    places: draft.places.some(p => p.key === saved.key) ? draft.places.map(p => p.key === saved.key ? saved : p) : [...draft.places, saved],
    ...(role ? { [role.field]: [saved.name, saved.address].filter(Boolean).join(' · ').slice(0, 400) } : {}),
  };
}
