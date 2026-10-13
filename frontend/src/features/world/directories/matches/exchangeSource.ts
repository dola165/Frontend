import { wt } from '../../copy';
import type { BrowseLine, DirectorySource } from '../../directory/types';
import { codeLabel, fixtureDay, fixtureTime } from '../../format';
import { awayLine } from '../../map/away';
import { peekOf } from '../../peek/usePeek';
import { exchangeFilters, loadListings } from './listings';
import { HOSTING } from './matchBrowse';
import { listingPlace } from './matchPlaces';
import { cityGroup, dayGroup, loadMyFit, toOpenMatches, type OpenMatch } from './openMatches';
import { OpenMatchLine } from './OpenMatchLine';
import type { Places } from '../../directory/places';

/** An open match in the Browse area: the host and the open place, and who hosts. */
function openLine({ m, code, fit }: OpenMatch, places?: Places): BrowseLine {
    const hosting = HOSTING[m.venue_preference];
    return {
        when: { time: fixtureTime(m.starts_at_iso, m.timezone), day: fixtureDay(m.starts_at_iso, m.timezone) }, title: m.title, to: `/match-exchange/${m.event_id}`, action: wt('Open match'), peek: peekOf('match', code),
        sides: { home: { name: `${m.club_name} ${m.squad_name}`, crest: m.club_logo_url }, away: { name: fit ? wt('Your {squad}?', { squad: fit.name }) : wt('Opponent wanted'), crest: fit ? places?.club(fit.clubId)?.logoUrl : null } },
        fact: [codeLabel(m.age_group), hosting && wt(hosting)].filter(Boolean).join(' · '),
    };
}

/**
 * Open matches: teams looking for an opponent, as score lines with the open place to fill, by day below the map and
 * by city over it. The squad of mine that suits one shows in its empty place.
 */
export const exchange: DirectorySource<OpenMatch> = {
    id: 'exchange',
    label: 'Open matches',
    noun: ['open match', 'open matches'],
    searchLabel: 'Search open matches',
    // The backend searches the title, the host club and the city.
    searchPlaceholder: 'Club, title or city',
    layout: 'scores',
    pageSize: 24,
    signInReason: 'Teams looking for an opponent are visible to signed-in members.',
    // Age group, format and Near me first; the ground, level and dates under More filters.
    filters: exchangeFilters.map(filter => filter.key === 'ageGroup' ? { ...filter, primary: true } : filter),
    async load(query, page, { signal, sessionId }) {
        const [result, fit] = await Promise.all([loadListings(false, query, page, signal), loadMyFit(sessionId)]);
        return { ...result, items: toOpenMatches(result.items, fit) };
    },
    key: o => o.code,
    Item: OpenMatchLine,
    line: openLine,
    placeKinds: ['CLUB'],
    place: (o, places) => listingPlace(o.m, places),
    groups: { of: dayGroup },
    panel: cityGroup,
    // From my club to where the match would be played (never a ground it was only placed near).
    away: (o, places, viewer) => {
        const from = places.club(viewer.clubId), { m } = o;
        if (!from || m.club_id === viewer.clubId || m.location_lat == null || m.location_lng == null) return null;
        return awayLine({ lat: from.lat, lng: from.lng, name: from.name }, { lat: m.location_lat, lng: m.location_lng }, km => wt('≈ {km} km', { km: Math.round(km) }), wt('As the crow flies'));
    },
    empty: { title: 'No open matches right now', body: 'Teams post here when they need an opponent for a date.' },
};
