import * as W from '../world.mjs';
import * as V from '../viewer.mjs';
import * as P from '../pages-data.mjs';
import { familyOf, familyRequest, U12 } from '../world-family.mjs';

/** Legacy timetable rows carry no publication flag; their parent page still has to be live. */
export function publicTrainingClub(clubId) {
  const club = W.clubById(clubId), page = P.pages.get(`club:${Number(clubId)}`);
  return Boolean(club && (page ? page.status === 'LIVE' : !club.draft));
}

export const trainingVisibility = (event, fallback = 'PRIVATE') => !publicTrainingClub(event.clubId ?? event.squad?.clubId)
  || event.invitationPlan || (event.visibility != null && event.visibility !== 'PUBLIC')
  || (event.publicationState != null && event.publicationState !== 'PUBLIC')
  ? 'PRIVATE' : event.visibility === 'PUBLIC' ? 'PUBLIC' : fallback;

function trainingAccess(squad, headers) {
  const actor = V.viewerId(headers), page = P.pages.get(`club:${squad.clubId}`);
  // Same current manager/child authority as lane04's squadAccess; a demo cookie cannot confer another account's children.
  const manager = squad.clubId === 1 ? actor === W.ME_ID && !(familyRequest(headers) && squad.id === U12)
    : Boolean(page?.managed && (P.canEdit(page, actor) || squad.headCoachId === actor));
  const children = actor === W.ME_ID ? familyOf(headers) : V.account(actor)?.children;
  return { actor, page, manager, childIds: (children ?? []).map(child => child.id).filter(id => squad.playerIds.includes(id)) };
}

export function canReadTraining(squad, visibility, headers) {
  if (visibility === 'PUBLIC') return true;
  if (!squad) return false;
  const { actor, page, childIds } = trainingAccess(squad, headers);
  const leadership = squad.clubId === 1 ? actor === W.ME_ID : page && ['OWNER', 'ADMIN', 'CLUB_ADMIN'].includes(P.roleOf(page, actor));
  const guardian = childIds.length > 0
    || W.parents.some(link => link.parentId === actor && squad.playerIds.includes(link.childId));
  return Boolean(leadership || squad.headCoachId === actor || squad.playerIds.includes(actor) || guardian);
}

/** Planning references obey the canonical invitation audience as well as current squad authority. */
export function canReadTrainingSession(event, headers) {
  const squad = W.squadById(event.squadId);
  if (!squad || squad.clubId !== event.clubId) return false;
  if (!event.invitationPlan) return canReadTraining(squad, trainingVisibility(event), headers);
  const { actor, manager, childIds } = trainingAccess(squad, headers);
  return Boolean(manager || (childIds.length && event.invitedPlayerIds?.some(id => id === actor || childIds.includes(id))));
}

/** Invitation plans come only from the canonical SQUAD_SESSION reader, with its complete session/audience object. */
export function clubTrainingEvents(clubId, headers, occurrence) {
  const id = Number(clubId);
  if (!P.isPageClub(id)) return [];
  return W.events.filter(event => event.clubId === id && event.type === 'TRAINING' && !event.invitationPlan).flatMap(event => {
    const squad = W.squadById(event.squadId);
    if (!squad || squad.clubId !== id) return [];
    const visibility = trainingVisibility(event);
    if (!canReadTraining(squad, visibility, headers)) return [];
    return [occurrence({ ...event, eventType: 'TRAINING', locationName: event.location ?? event.locationName ?? null,
      visibility, recurring: Boolean(event.seriesId || event.recurring), status: event.cancelled ? 'CANCELLED' : event.status,
    }, { occurrenceId: `squad:${squad.id}:${event.id}` })];
  });
}
