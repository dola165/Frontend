import * as W from '../world.mjs';
import * as F from '../world-football.mjs';
import * as V from '../viewer.mjs';
import { planningScopes } from './map-planning-access.mjs';
import { canReadTrainingSession } from './club-training-calendar.mjs';

/** Existing legacy fixtures and exact exchange sides; a public fixture is not itself planning authority. */
export function fixturesForScope(scope) {
  const fixtures = new Map();
  for (const match of W.matches.filter(match => match.status === 'SCHEDULED')) {
    const host = W.squadById(match.squadId);
    if (!host) continue;
    const visiting = W.squadById(match.targetSquadId) ?? F.squadFor(match.opponentClubId, host.ageGroup, host.gender);
    const ours = [host, visiting].find(squad => squad?.clubId === scope.clubId && scope.read(squad.id));
    if (!ours) continue;
    const opponentClubId = ours === host ? match.opponentClubId : host.clubId;
    fixtures.set(match.id, { ...match, clubId: scope.clubId, squadId: ours.id, opponentClubId,
      home: ours === host ? match.home : !match.home, title: `${W.clubById(host.clubId)?.name} v ${W.clubById(match.opponentClubId)?.name}`,
      challengerSquadId: host.id, targetSquadId: visiting?.id ?? null });
  }
  for (const listing of F.exchange) {
    if (!['OPEN', 'ARRANGED'].includes(listing.status)) continue;
    const host = F.sq(listing.hostSquadId), visiting = F.sq(listing.opponentSquadId ?? listing.requestedSquadId);
    if (!host) continue;
    const ours = [host, visiting].find(squad => squad?.clubId === scope.clubId && scope.read(squad.id));
    if (!ours) continue;
    const opponentClubId = ours === host ? visiting?.clubId ?? listing.requestedClubId : host.clubId;
    fixtures.set(listing.id, { id: listing.id, clubId: scope.clubId, squadId: ours.id, opponentClubId,
      start: listing.start, end: listing.end ?? F.plusMin(listing.start, listing.minutes), status: 'SCHEDULED', venueId: listing.venueId,
      home: ours === host ? listing.hostingChoice !== 'AWAY' && listing.venuePreference !== 'AWAY' : listing.hostingChoice === 'AWAY' || listing.venuePreference === 'AWAY',
      title: listing.title ?? `${host.name} friendly`, challengerSquadId: host.id, targetSquadId: visiting?.id ?? null });
  }
  return [...fixtures.values()];
}

export const planningFixture = (scope, eventId, squadId) => fixturesForScope(scope).find(fixture => fixture.id === Number(eventId) && fixture.squadId === Number(squadId));

/** Context and record routes share the same short-lived scope, including real current finance choices. */
export function mapPlanningContext(headers) {
  return planningScopes(headers).map(scope => {
    const squads = scope.squads.filter(squad => scope.read(squad.id)), visible = new Set(squads.map(squad => squad.id));
    const settings = scope.state.settings;
    return { id: scope.clubId, name: scope.club.name,
      settings: { timezone: settings.timezone, ...(settings.currency ? { currency: settings.currency } : {}) },
      squads: squads.map(squad => ({ id: squad.id, name: squad.name, canEdit: scope.write(squad.id) })),
      participants: squads.flatMap(squad => squad.playerIds.map(id => ({ id, squad_id: squad.id, name: W.personById(id)?.fullName ?? V.account(id)?.fullName ?? 'Player' }))),
      events: fixturesForScope(scope).slice(0, 150).map(fixture => {
        const venue = W.venueById(fixture.venueId);
        return { id: fixture.id, title: fixture.title, starts_at: W.iso(fixture.start), ends_at: W.iso(fixture.end),
          challenger_squad_id: fixture.challengerSquadId, target_squad_id: fixture.targetSquadId,
          location_name: venue?.name ?? null, location_lat: venue?.lat ?? null, location_lng: venue?.lng ?? null };
      }),
      sessions: W.events.filter(event => event.type === 'TRAINING' && event.clubId === scope.clubId && visible.has(event.squadId)
        && event.start > new Date() && (!event.invitationPlan || canReadTrainingSession(event, headers))).slice(0, 40).map(event => ({
        id: event.id, title: event.title, starts_at: W.iso(event.start), ends_at: W.iso(event.end), squad_id: event.squadId,
      })),
      financeRecords: scope.state.records.filter(record => record.module === 'FINANCE' && record.club_id === scope.clubId
        && visible.has(record.squad_id) && scope.can(record.squad_id, 'FINANCE')).slice(0, 100).map(record => ({
        id: record.id, title: record.title, squad_id: record.squad_id, kind: record.kind, status: record.status,
      })),
    };
  });
}
