import type { BadgeTone } from '../../../design/primitives';
import type { HistoryMatch } from '../../matchHistory/api';
import { formats, type Match } from '../../matchExchange/api';
import { journeyLabel } from '../../matchExchange/journeyCopy';
import { eventDestination, type EventItem } from '../../requests/api';
import { isGeorgian, wt } from '../copy';
import type { Places } from '../directory/places';
import type { BrowseLine, Placement } from '../directory/types';
import { codeLabel, EVENT_BADGE, factTone, fixtureDay, fixtureTime, hasStarted } from '../format';

export const SOURCE_LABEL: Record<HistoryMatch['source'], string> = { MATCH_EXCHANGE: 'Friendly', SCHEDULE: 'Club fixture', TOURNAMENT: 'Competition' };
export const RESULT: Partial<Record<HistoryMatch['resultStatus'], { label: string; tone: BadgeTone }>> = {
    CONFIRMED: { label: 'Final', tone: 'accent' }, RECORDED: { label: 'Final', tone: 'accent' }, LEGACY: { label: 'Final', tone: 'neutral' },
    PROPOSED: { label: 'Awaiting confirmation', tone: 'warning' }, DISPUTED: { label: 'Disputed', tone: 'danger' }, BYE: { label: 'Bye', tone: 'neutral' },
};
export const HOSTING: Record<string, string> = { HOME: 'They host', AWAY: 'They travel', EITHER: 'Either ground' };
/** A listing's pitch and referee readiness in words, as the listing states them. */
export const readiness = (m: Match) => [
    m.venue_status === 'NEEDED' ? 'Pitch to arrange' : null,
    m.referee_required && m.referee_status === 'NEEDED' ? 'Referee needed' : null,
];
const ARRANGED = ['ARRANGED', 'BOOKED', 'ACCEPTED', 'COMPLETED'];
/** An arrangement's state: cancelled, or where the listing stands. */
export const arrangementState = (m: Match) => m.event_status === 'CANCELLED' ? 'CANCELLED' : m.listing_status;
export const arrangementTone = (state: string): BadgeTone => ARRANGED.includes(state) ? 'accent' : state === 'CANCELLED' ? 'danger' : state === 'OPEN' ? 'neutral' : 'warning';

const fixtureTitle = (m: HistoryMatch) => m.homeClubName && m.awayClubName ? `${m.homeClubName} v ${m.awayClubName}` : m.title;

/** A fixture or result: the score once played, otherwise the kick-off; the result's state on the right. */
export function fixtureLine(m: HistoryMatch): BrowseLine {
    const zone = m.timezone ?? undefined;
    const played = m.homeScore != null && m.awayScore != null;
    const result = RESULT[m.resultStatus];
    const past = hasStarted(m.startsAt);
    const [fact, tone] = m.fixtureStatus === 'CANCELLED' ? [wt('Cancelled'), 'danger' as const]
        : past && m.canRecordResult && (!result || result.tone === 'warning') ? [wt('Result needed'), 'warning' as const]
            : past ? (result ? [wt(result.label), factTone(result.tone)] : [wt('No result yet'), 'warning' as const])
                : [wt(SOURCE_LABEL[m.source]), undefined];
    return {
        when: { time: played ? `${m.homeScore} – ${m.awayScore}` : fixtureTime(m.startsAt, zone), day: fixtureDay(m.startsAt, zone) },
        title: fixtureTitle(m), to: m.detailPath, fact, factTone: tone,
        detail: [m.homeSquadName && m.awaySquadName && m.homeSquadName === m.awaySquadName ? m.homeSquadName : null, m.tournamentName, m.locationName].filter(Boolean).join(' · '),
    };
}

/**
 * A fixture at its match's own place when the map knows it (checked against its clubs: listings and schedules share
 * those ids), else at its competition's ground, else counted at the home club. The last two are marked approximate, each
 * with where it was placed.
 */
export function fixturePlace(m: HistoryMatch, places: Places): Placement | null {
    const meta = `${fixtureDay(m.startsAt, m.timezone)} ${fixtureTime(m.startsAt, m.timezone)}`;
    const marker = m.source !== 'TOURNAMENT' ? places.match(m.sourceId) : undefined;
    const own = marker && marker.clubId != null && (marker.clubId === m.homeClubId || marker.clubId === m.awayClubId) ? marker : undefined;
    if (own) return { lat: own.lat, lng: own.lng, tone: 'match', label: fixtureTitle(m), meta, to: m.detailPath, noun: ['match', 'matches'] };
    const competition = places.competition(m.tournamentId);
    if (competition) return { lat: competition.lat, lng: competition.lng, tone: 'match', approximate: 'ground', label: fixtureTitle(m), meta, to: m.detailPath, noun: ['match', 'matches'] };
    const home = places.club(m.homeClubId);
    return home ? { lat: home.lat, lng: home.lng, tone: 'match', approximate: 'club', pin: `club:${m.homeClubId}`, label: home.name, noun: ['match', 'matches'], to: `/clubs/${m.homeClubId}` } : null;
}

const listingWhen = (m: Match) => ({ time: fixtureTime(m.starts_at_iso, m.timezone), day: fixtureDay(m.starts_at_iso, m.timezone) });
const listingFacts = (m: Match, ...first: (string | null)[]) => [...first, wt(formats[m.format] ?? codeLabel(m.format)), m.location_name || m.city].filter(Boolean).join(' · ');

/** An open match: when, whose, and whether they host or travel. */
export function listingLine(m: Match): BrowseLine {
    const hosting = HOSTING[m.venue_preference];
    return { when: listingWhen(m), crest: { src: m.club_logo_url, name: m.club_name }, title: m.title, to: `/match-exchange/${m.event_id}`,
        detail: listingFacts(m, `${m.club_name} ${m.squad_name}`), fact: hosting && wt(hosting) };
}

/** One of my arrangements: the two sides and where it stands. */
export function arrangementLine(m: Match): BrowseLine {
    const state = arrangementState(m);
    return { when: listingWhen(m), crest: { src: m.club_logo_url, name: m.club_name }, title: m.opponent_name ? `${m.club_name} v ${m.opponent_name}` : m.title,
        to: `/match-exchange/${m.event_id}`, detail: listingFacts(m, m.squad_name),
        fact: state === 'OPEN' ? wt('Looking for an opponent') : journeyLabel(state, isGeorgian() ? 'ka' : 'en'), factTone: factTone(arrangementTone(state)) };
}

/** A published event on the fixture line, its kind on the right. */
export function eventLine(item: EventItem): BrowseLine {
    const badge = EVENT_BADGE[item.activity] ?? EVENT_BADGE.OTHER;
    const allDay = item.activity === 'TOURNAMENT' && fixtureTime(item.startsAt) === '00:00';
    return { when: { time: allDay ? wt('All day') : fixtureTime(item.startsAt), day: fixtureDay(item.startsAt) }, title: item.name,
        to: eventDestination(item) ?? undefined, detail: [item.context, item.location].filter(Boolean).join(' · '), fact: wt(badge.label), factTone: factTone(badge.tone) };
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
    const meta = `${fixtureDay(item.startsAt)} ${fixtureTime(item.startsAt)}`;
    return { lat: at.lat, lng: at.lng, tone: EVENT_PIN[item.activity] ?? 'event', approximate: own ? undefined : 'club', label: item.name, meta, to: eventDestination(item) ?? undefined, noun: ['event', 'events'] };
}
