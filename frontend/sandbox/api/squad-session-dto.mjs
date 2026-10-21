// Canonical session mapping without router registration. Callers still enforce their endpoint/selected-player policy.
import * as W from './world.mjs';
import * as S from './world-social.mjs';
import * as P from './world-profile.mjs';
import * as V from './viewer.mjs';
import { squadAccess, canReadSquadSession, canSelectSessionPlayer } from './squad-access.mjs';

const displayName = id => W.personById(id)?.fullName ?? V.account(id)?.fullName ?? 'GrassKickZ member';
const defaultResponse = (event, playerId) => {
  // A newly saved invitation has no answer until somebody actually records one.
  if (event.invitationPlan) return 'UNANSWERED';
  const h = (event.id * 31 + playerId * 17) % 20;
  if (event.start < W.NOW) return h < 18 ? 'GOING' : 'NOT_GOING';
  const days = (event.start - W.NOW) / 86400000;
  return days > 6 ? (h < 6 ? 'GOING' : 'UNANSWERED') : h < 16 ? 'GOING' : h < 18 ? 'NOT_GOING' : 'UNANSWERED';
};
// Existing seeded opt-out attendance stays unchanged.
const optOutDefault = (event, playerId) => { const r = defaultResponse(event, playerId); return r === 'GOING' && !P.confirmationRequested(event) ? 'UNANSWERED' : r; };
export const sessionResponseOf = (event, playerId, { source = 'LEGACY' } = {}) => S.sessionResponses.get(`${event.id}:${playerId}`) ?? (source === 'LEGACY' ? optOutDefault(event, playerId) : 'UNANSWERED');

/** Raw canonical DTO for already-authorized handlers. Preserve each source's ordinary-single/legacy policy. */
export function squadSessionDto(s, e, { source = 'LEGACY' } = {}) {
  const venue = W.venueById(e.venueId);
  const requested = P.confirmation.has(e.id) ? P.confirmationRequested(e) : typeof e.response_requested === 'boolean' ? e.response_requested
    : typeof e.responseRequested === 'boolean' ? e.responseRequested : source === 'LEGACY' && !e.invitationPlan ? P.confirmationRequested(e) : false;
  const response = id => sessionResponseOf(e, id, { source });
  return {
    id: e.id, title: e.title, event_type: e.type, description: e.type === 'MATCH' ? `${e.competition} · ${e.kind === 'LEAGUE' ? 'League match' : 'Friendly'}` : e.notes ?? null,
    starts_at: e.invitationPlan ? e.start.toISOString() : W.local(e.start), ends_at: e.invitationPlan ? e.end.toISOString() : W.local(e.end), location: e.location ?? (venue ? `${venue.name}${e.pitch ? ` · ${e.pitch}` : ''}` : null),
    status: e.cancelled ? 'CANCELLED' : 'SCHEDULED', cancellation_reason: e.cancelled ?? null, revision: e.revision ?? 1, response_revision: e.response_revision ?? e.responseRevision ?? 1, response_kind: 'INTENT',
    response_requested: requested, series_id: e.invitationPlan ? e.seriesId : e.seriesId !== undefined ? e.seriesId : source !== 'SINGLE' && e.type === 'TRAINING' ? `squad-${s.id}-training` : null,
    attendance: (e.invitedPlayerIds ?? s.playerIds).map(id => ({ id, name: displayName(id), response: response(id), reason: response(id) === 'NOT_GOING' ? P.replyReasons.get(`${e.id}:${id}`) ?? (S.sessionResponses.has(`${e.id}:${id}`) || source !== 'LEGACY' ? null : P.defaultReason(e.id, id)) : null,
      active: s.playerIds.includes(id), response_status: s.playerIds.includes(id) ? 'CURRENT' : 'INVALIDATED', response_valid: s.playerIds.includes(id), previous_response: null, recorded_by: response(id) === 'UNANSWERED' ? null : 'PLAYER', responded_at: null })),
    venue_reservation: e.venue_reservation ?? null, introductory_visitors: e.introductory_visitors ?? [],
  };
}

export { squadSessionDto as sessionDto };

/** Staff history is separate; family output contains only currently eligible active own/self participants. */
export function projectSquadSession(squad, dto, access, { selectedPlayerId, staffRead = false } = {}) {
  if (!canSelectSessionPlayer(squad, access, selectedPlayerId, { staffRead })) return null;
  const selected = selectedPlayerId == null ? null : Number(selectedPlayerId);
  const staff = access?.canManage || staffRead === true;
  if (staff && selected == null) return dto;
  const visible = new Set(access?.playerIds ?? access?.childIds ?? []);
  const attendance = dto.attendance.filter(player => (selected == null || player.id === selected) &&
    (staff || player.active !== false && squad.playerIds.includes(player.id) && visible.has(player.id)));
  if (!attendance.length) return null;
  const result = { ...dto, attendance, introductory_visitors: [] };
  if (!staff) { delete result.created_by; delete result.request_id; }
  return result;
}

/** staffRead must come from a current confirmed scoped server permission; it grants no management/write right. */
export function squadSessionForViewer(squad, event, headers, options = {}) {
  if (!squad || (event.squadId ?? event.squad?.id) !== squad.id || (event.clubId ?? event.squad?.clubId) !== squad.clubId) return null;
  const access = squadAccess(squad, headers);
  if (options.staffRead !== true && !canReadSquadSession(event, access)) return null;
  return projectSquadSession(squad, squadSessionDto(squad, event, options), access, options);
}
