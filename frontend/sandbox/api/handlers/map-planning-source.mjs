import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import { squadSessionDto } from '../squad-session-dto.mjs';

const cancelled = status => ['CANCELLED', 'CANCELED'].includes(status);
const iso = instant => new Date(instant).toISOString();

/** Resolve existing football fixtures without creating a separate source store. */
function fixtureSource(id) {
  // Exchange records override their legacy match mirror, as they do in planning context.
  const listing = F.listingById(id), match = listing ?? W.matches.find(item => item.id === Number(id));
  if (!match) return null;
  const end = match.end ?? F.plusMin(match.start, match.minutes), venue = W.venueById(match.venueId);
  return { title: match.title, startsAt: iso(match.start), endsAt: iso(end),
    status: listing ? cancelled(listing.status) ? listing.status : end < Date.now() && listing.opponentSquadId ? 'COMPLETED' : 'SCHEDULED' : match.status ?? 'SCHEDULED',
    locationName: venue?.name ?? listing?.place?.name ?? match.locationName ?? '' };
}

/** Compose04's route-free canonical mapper after the caller's current journey authority checks. */
function sessionSource(plan, id) {
  const squad = W.squadById(plan.squad_id);
  if (!squad || squad.clubId !== plan.club_id) return null;
  const event = W.events.find(item => item.id === id && item.clubId === plan.club_id && item.squadId === squad.id
    && ['TRAINING', 'MATCH'].includes(item.type));
  if (!event) return null;
  const dto = squadSessionDto(squad, event);
  // Legacy DTO times can be display-only wall clocks. The persisted Dates are the source instants.
  return { title: dto.title, status: dto.status, startsAt: iso(event.start), endsAt: iso(event.end), locationName: dto.location ?? '' };
}

/** Current attendance availability is separate from the immutable family itinerary. */
export function publishedJourneyState(plan, publication) {
  const activities = publication.snapshot.activities.map((activity, index) => {
    const reference = publication.activities[index], linked = reference?.eventId != null || reference?.sessionId != null;
    const source = reference?.eventId != null ? fixtureSource(reference.eventId) : reference?.sessionId != null ? sessionSource(plan, reference.sessionId) : null;
    const missing = linked && !source, isCancelled = missing || Boolean(source && cancelled(source.status));
    const changed = Boolean(source && (Date.parse(source.startsAt) !== Date.parse(activity.startsAt)
      || Date.parse(source.endsAt) !== Date.parse(activity.endsAt)
      || source.locationName && source.locationName !== activity.place?.name));
    return { activity, source, missing, cancelled: isCancelled, changed,
      startsAt: source && !cancelled(source.status) ? source.startsAt : activity.startsAt,
      endsAt: source && !cancelled(source.status) ? source.endsAt : activity.endsAt };
  });
  const isCancelled = activities.some(activity => activity.cancelled), sourceChanged = activities.some(activity => activity.changed);
  const open = Date.parse(publication.snapshot.endsAt) > Date.now() && (!plan.trip_id || ['DRAFT', 'READY'].includes(plan.trip?.status));
  return { activities, cancelled: isCancelled, sourceChanged, canRespond: open && !isCancelled && !sourceChanged };
}
