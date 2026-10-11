import { distanceKm } from '../../../../components/map/walkingGraph';
import type { Match, Referee } from '../../../matchExchange/api';
import { fetchMatchListings } from '../../api';
import { hasStarted, isoDayOf } from '../../format';
import { useWorldData } from '../../useWorldData';
import type { WorldArea } from '../../useWorldArea';
import { useReferees } from '../frontData';
import { useMyListings, useSquadBoards } from './coachMatches';
import { fitsGender, type MySquad, type SquadFocus } from './mySquads';

export interface OpponentOffer { match: Match; squad: MySquad; km: number | null; /** My squad already plays that day. */ busy: boolean }

/**
 * Other clubs' open listings near the area for the ages in focus, each paired with the squad of mine it suits
 * (same age group, a gender the listing admits). Listings sent to one club are not open to others and are left
 * out, as are my own club's. Soonest first.
 */
export function opponentOffers(listings: Match[], squads: MySquad[], clubIds: number[], centre: WorldArea['centre'], busyDays: Map<number, Set<string>>, now = Date.now()): OpponentOffer[] {
    const seen = new Set<number>();
    return listings.flatMap(match => {
        if (seen.has(match.event_id) || clubIds.includes(match.club_id) || match.requested_squad_id != null || match.opponent_club_id || Date.parse(match.starts_at_iso) <= now) return [];
        seen.add(match.event_id);
        const squad = squads.find(mine => mine.ageGroup === match.age_group && fitsGender(match.squad_name, mine.gender));
        if (!squad) return [];
        const km = centre && match.location_lat != null && match.location_lng != null ? distanceKm([centre.lng, centre.lat], [match.location_lng, match.location_lat]) : null;
        return [{ match, squad, km, busy: busyDays.get(squad.id)?.has(isoDayOf(match.starts_at_iso)) ?? false }];
    }).sort((a, b) => Date.parse(a.match.starts_at_iso) - Date.parse(b.match.starts_at_iso));
}

/** Opponents for the squads in focus within 50 km of the area, with the days my squads are already busy marked. */
export function useOpponentsForYou(area: WorldArea, focus: SquadFocus) {
    const boards = useSquadBoards(focus);
    const centre = area.centre;
    const key = focus.status === 'ready' && area.ready ? `opponents-for:${area.city}:${centre?.lat ?? ''}:${focus.ages.join(',')}` : null;
    const listings = useWorldData(key, async signal => (await Promise.all(focus.ages.map(age => {
        const params = new URLSearchParams({ ageGroup: age });
        if (centre) { params.set('lat', String(centre.lat)); params.set('lng', String(centre.lng)); params.set('radiusKm', '50'); }
        return fetchMatchListings(params, signal).then(page => page.items);
    }))).flat());
    const busy = new Map((boards.data ?? []).map(board => [board.squad.id, new Set(board.upcoming.flatMap(match => match.startsAt ? [isoDayOf(match.startsAt)] : []))]));
    const items = listings.data ? opponentOffers(listings.data, focus.focus, focus.clubIds, centre, busy) : [];
    return { ...listings, items };
}

/** Referees who take this format, in the area first, then volunteers, then the cheapest. Those taking neither paid nor volunteer matches are left out. */
export function refereesFor(referees: Referee[], formats: string[], city: string) {
    const local = (referee: Referee) => referee.service_area?.toLowerCase().includes(city.toLowerCase()) ? 0 : 1;
    return referees.filter(referee => referee.published !== false && (referee.accepts_paid || referee.accepts_volunteer)
        && (!formats.length || formats.some(format => referee.formats.split(',').map(value => value.trim()).includes(format))))
        .sort((a, b) => local(a) - local(b) || Number(b.accepts_volunteer) - Number(a.accepts_volunteer) || a.fee - b.fee);
}

/** Referee states that still need something: none found, asked but not answered, or withdrawn. */
const REFEREE_OPEN = new Set(['NEEDED', 'INVITED', 'REPLACEMENT_NEEDED']);

/** My squads' own listings whose referee is not settled (needed, invited or withdrawn), and referees who cover their formats. */
export function useRefereesForYou(area: WorldArea, focus: SquadFocus) {
    const listings = useMyListings();
    const referees = useReferees();
    const needing = (listings.data ?? []).filter(match => focus.focus.some(squad => squad.id === match.squad_id && squad.clubId === match.club_id)
        && match.referee_required && REFEREE_OPEN.has(match.referee_status) && !hasStarted(match.starts_at_iso) && match.event_status !== 'CANCELLED')
        .sort((a, b) => Date.parse(a.starts_at_iso) - Date.parse(b.starts_at_iso));
    const formats = [...new Set(needing.length ? needing.map(match => match.format) : focus.formats)];
    return {
        needing, /** Those waiting on me: an invited referee is waiting on them. */ toAct: needing.filter(match => match.referee_status !== 'INVITED').length,
        referees: refereesFor(referees.data?.items ?? [], formats, area.city),
        loading: listings.loading || referees.loading, error: listings.error || referees.error, retry: listings.error ? listings.retry : referees.retry,
        ready: Boolean(listings.data && referees.data),
    };
}
