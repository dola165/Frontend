import type { HistoryMatch } from '../../../matchHistory/api';
import type { Match } from '../../../matchExchange/api';
import { eventDestination, type EventItem } from '../../../requests/api';
import { wt } from '../../copy';
import type { Places } from '../../directory/places';
import type { Placement } from '../../directory/types';
import { fixtureDay, fixtureTime } from '../../format';
import { zoned } from '../../scoreboard/standings';

/** When an event is, on the ground's clock (times without an offset are Georgian): all day for a tournament from midnight. */
export function eventWhen(item: EventItem) {
    const at = zoned(item.startsAt);
    return { time: item.activity === 'TOURNAMENT' && fixtureTime(at) === '00:00' ? wt('All day') : fixtureTime(at), day: fixtureDay(at) };
}

/** "Dinamo v Saburtalo", built from the clubs (a real tournament row is titled with its tournament). */
export const fixtureTitle = (m: HistoryMatch) => m.homeClubName && m.awayClubName ? `${m.homeClubName} v ${m.awayClubName}` : m.title;

/**
 * A fixture at its match's own place when the map knows it (checked against its clubs: listings and schedules share
 * those ids), else at its competition's ground, else counted at the home club. The last two are marked approximate, each
 * with where it was placed.
 */
export function fixturePlace(m: HistoryMatch, places: Places): Placement | null {
    const meta = `${fixtureDay(m.startsAt, m.timezone)} ${fixtureTime(m.startsAt, m.timezone)}`;
    const own = ownPlace(m, places);
    if (own) return { lat: own.lat, lng: own.lng, tone: 'match', label: fixtureTitle(m), meta, to: m.detailPath, noun: ['match', 'matches'] };
    const competition = places.competition(m.tournamentId);
    // A tournament's fixtures share its ground's pin, named after the tournament (its rows carry no ground of their own).
    if (competition) return { lat: competition.lat, lng: competition.lng, tone: 'match', approximate: 'ground', pin: `ground:${m.tournamentId}`, label: competition.name, meta, to: `/tournaments/${m.tournamentId}`, action: wt('Open tournament'), noun: ['match', 'matches'] };
    const home = places.club(m.homeClubId);
    return home ? { lat: home.lat, lng: home.lng, tone: 'match', approximate: 'club', pin: `club:${m.homeClubId}`, label: home.name, noun: ['match', 'matches'], to: `/clubs/${m.homeClubId}`, action: wt('Open club') } : null;
}

/** The match's own ground, when the map knows it by the match's own id (never a club's or a competition's ground). */
export function ownPlace(m: HistoryMatch, places: Places) {
    const marker = m.source !== 'TOURNAMENT' ? places.match(m.sourceId) : undefined;
    return marker && marker.clubId != null && (marker.clubId === m.homeClubId || marker.clubId === m.awayClubId) ? marker : undefined;
}

/** An open match or arrangement at its own ground, else (marked as such) at its club. */
export function listingPlace(m: Match, places: Places): Placement | null {
    const own = m.location_lat != null && m.location_lng != null ? { lat: m.location_lat, lng: m.location_lng } : null;
    const at = own ?? places.club(m.club_id);
    return at ? { lat: at.lat, lng: at.lng, approximate: own ? undefined : 'club', noun: ['match', 'matches'], label: m.title,
        meta: [`${fixtureDay(m.starts_at_iso, m.timezone)} ${fixtureTime(m.starts_at_iso, m.timezone)}`, m.location_name].filter(Boolean).join(' · '), tone: 'match', to: `/match-exchange/${m.event_id}` } : null;
}

const EVENT_PIN: Record<string, Placement['tone']> = { MATCH: 'match', TOURNAMENT: 'event', TRYOUT: 'trial', TRAINING: 'training' };
const clubOf = (destination: string) => Number(/^\/clubs\/([1-9]\d*)/.exec(destination)?.[1]) || undefined;

/**
 * An event at its own place: a match by its marker (only when the marker names the same match), a competition or
 * trial by theirs (a trial checked against its club). Otherwise a club's training or trial is counted at the club,
 * marked approximate.
 */
export function eventPlace(item: EventItem, places: Places): Placement | null {
    const club = clubOf(item.destination);
    const marker = item.kind === 'SCHEDULE' ? places.match(item.id) : item.kind === 'TOURNAMENT' ? places.competition(item.id) : item.kind === 'TRYOUT' ? places.trial(item.id) : undefined;
    const own = marker && (item.kind !== 'SCHEDULE' || marker.name === item.name) && (item.kind !== 'TRYOUT' || marker.clubId === club) ? marker : undefined;
    const at = own ?? places.club(club);
    if (!at) return null;
    const when = eventWhen(item), meta = `${when.day} ${when.time}`;
    return { lat: at.lat, lng: at.lng, tone: EVENT_PIN[item.activity] ?? 'event', approximate: own ? undefined : 'club', label: item.name, meta, to: eventDestination(item) ?? undefined, noun: ['event', 'events'] };
}
