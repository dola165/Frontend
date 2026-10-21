import * as W from './world.mjs';
import * as V from './viewer.mjs';
import { familyOf, familyRequest, U12 } from './world-family.mjs';
import { pages, canEdit } from './pages-data.mjs';

/** Seeded squad authority follows the current actor and confirmed roster links, never a persona cookie alone. */
export function squadAccess(squad, headers) {
  if (!squad) return null;
  const viewer = V.viewerId(headers);
  const childIds = (familyOf(headers) ?? []).map(child => child.id).filter(id => squad.playerIds.includes(id));
  const page = pages.get(`club:${squad.clubId}`);
  const canManage = squad.clubId === 1 ? viewer === W.ME_ID && !(familyRequest(headers) && squad.id === U12)
    : !!page?.managed && (canEdit(page, viewer) || squad.headCoachId === viewer);
  const canAssignCoach = canManage && (squad.clubId === 1 || canEdit(page, viewer));
  const playerIds = [...new Set([...childIds, ...(squad.playerIds.includes(viewer) ? [viewer] : [])])];
  return canManage || playerIds.length ? { viewer, canManage, canAssignCoach, childIds, playerIds } : null;
}

/** A later roster/guardian link does not add somebody to an already frozen invitation list. */
export const canReadSquadSession = (event, access) => !!access && (access.canManage || !event.invitationPlan ||
  event.invitedPlayerIds?.some(id => (access.playerIds ?? access.childIds).includes(id)) === true);

/** staffRead is a trusted server-side scoped read grant, never a request-body/query capability. */
export function canSelectSessionPlayer(squad, access, selected, { staffRead = false } = {}) {
  if (!access && staffRead !== true) return false;
  if (selected == null) return true;
  const id = Number(selected);
  return Number.isSafeInteger(id) && id > 0 && (staffRead === true || access?.canManage ? squad.playerIds.includes(id) : (access?.playerIds ?? access?.childIds ?? []).includes(id));
}
