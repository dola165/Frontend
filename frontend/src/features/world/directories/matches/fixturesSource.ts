import { getMatchHistory } from '../../../matchHistory/api';
import { appLocale } from '../../../../utils/formatting';
import { first, type DirectoryQuery, type DirectorySource } from '../../directory/types';
import { isoDay } from '../../format';
import { COACHING_ROLES } from '../../front/coach/mySquads';
import { loadMyTeams } from '../../scoreboard/myTeams';
import { clubScope, competitionScope } from '../scopes';
import { DayEmpty, DayStep, DayStrip } from './DayStrip';
import { fixtureGroup, fixtureWhere, sharedGround, toFixtures, type Fixture } from './fixtures';
import { FixtureRow } from './FixtureRow';
import { fixtureLine } from './matchBrowse';
import { loadWindow, longDay, openingDay, windowFilters } from './matchday';
import { wt } from '../../copy';
import { awayLine, farthest } from '../../map/away';
import { rememberMatches } from '../../scoreboard/matchRegistry';
import { fixturePlace, ownPlace } from './matchPlaces';
import { FixtureTools } from './NeedsYouLine';

/** The ends of the list beside the days (the latest results, everything to come, what still needs a result), as headings. */
const PERIOD_HEADING: Record<string, string> = { HISTORY: 'Results', UPCOMING: 'Upcoming', NEEDS_RESULT: 'Needs a result' };
const QUERY_KEYS = ['source', 'resultStatus', 'from', 'to', 'mine', 'clubId', 'squadId', 'tournamentId'];

/** One page of an end of the list (Results newest first, Upcoming soonest first), with each row's day. */
async function loadPeriod(query: DirectoryQuery, period: string, page: number, signal: AbortSignal, sessionId: Parameters<typeof getMatchHistory>[2]) {
    const params = new URLSearchParams({ period, page: String(page), size: '24' });
    for (const key of QUERY_KEYS) if (first(query, key)) params.set(key, first(query, key));
    if (query.q) params.set('q', query.q);
    const [result, mine] = await Promise.all([getMatchHistory(params.toString(), signal, sessionId), loadMyTeams(sessionId)]);
    rememberMatches(sessionId, result.items);
    // Placeholder knockout fixtures are not listed, and Results leaves out matches still to come (one called off sits on
    // its day): neither is counted.
    const now = Date.now();
    const items = toFixtures(result.items, mine, true).filter(f => period !== 'HISTORY' || !f.m.startsAt || Date.parse(f.m.startsAt) <= now);
    return { items, total: result.total - (result.items.length - items.length), hasMore: (page + 1) * result.pageSize < result.total };
}

/** One day's matches: from the window when the day is in it, else asked for on their own (at most 100). */
async function loadDay(query: DirectoryQuery, day: string | null, signal: AbortSignal, sessionId: Parameters<typeof getMatchHistory>[2]) {
    const today = isoDay(0), filters = windowFilters(query);
    const window = await loadWindow(sessionId, filters, today);
    // With no day named (before the opening day reaches the address), the list opens where the strip does.
    const shown = day ?? openingDay(window.counts, today);
    if (!shown) return null;
    if (window.days.includes(shown) && !window.truncated) {
        const items = window.items.filter(f => f.day === shown);
        return { items, total: items.length, hasMore: false };
    }
    const [result, mine] = await Promise.all([getMatchHistory(`period=ALL&from=${shown}&to=${shown}&size=100${filters ? `&${filters}` : ''}`, signal, sessionId), loadMyTeams(sessionId)]);
    rememberMatches(sessionId, result.items);
    const items = toFixtures(result.items, mine, false).filter(f => f.day === shown).sort((a, b) => Date.parse(a.m.startsAt!) - Date.parse(b.m.startsAt!));
    return { items, total: items.length, hasMore: false };
}

/**
 * Fixtures and results, as a score site lists them: a day at a time from the strip over the map (or an end of the
 * list: the latest results, everything to come), one card per group (my teams first, then each tournament, then
 * friendlies and club fixtures), score lines inside, every state worked out honestly.
 */
export const fixtures: DirectorySource<Fixture> = {
    id: 'fixtures',
    label: 'Fixtures & results',
    noun: ['match', 'matches'],
    searchLabel: 'Search fixtures and results',
    // The backend searches clubs, squads and tournaments, not the ground.
    searchPlaceholder: 'Club, squad or tournament',    pageSize: 24,
    signInReason: 'Fixtures and results are visible to signed-in members.',
    // Today's scores and kick-off changes arrive without a reload; other days stay as they are.
    refreshMs: query => first(query, 'day') === isoDay(0) || first(query, 'period') === 'NEEDS_RESULT' ? 30_000 : undefined,
    filters: [
        // Where the list is: a day on the strip, or one of its ends. Links from elsewhere name an end (`period=HISTORY`).
        { kind: 'choice', key: 'period', label: 'When', nav: true, options: [{ value: 'UPCOMING', label: 'Upcoming' }, { value: 'HISTORY', label: 'Results' }, { value: 'NEEDS_RESULT', label: 'Needs a result', signedIn: true }] },
        { kind: 'date', key: 'day', label: 'Day', nav: true },
        { kind: 'choice', key: 'source', label: 'Kind of match', primary: true, allLabel: 'All matches', options: [{ value: 'TOURNAMENT', label: 'Tournaments' }, { value: 'SCHEDULE', label: 'Club fixtures' }, { value: 'MATCH_EXCHANGE', label: 'Friendlies' }] },
        { kind: 'toggle', key: 'mine', label: 'My teams', primary: true },
        clubScope('clubId'),
        { kind: 'scope', key: 'squadId', label: 'One squad' },
        competitionScope('tournamentId'),
        { kind: 'choice', key: 'resultStatus', label: 'Result', allLabel: 'Any result',
            when: query => ['HISTORY', 'NEEDS_RESULT'].includes(first(query, 'period')) || Boolean(first(query, 'day') && first(query, 'day') < isoDay(0)), options: [
                { value: 'NONE', label: 'Not recorded' }, { value: 'PROPOSED', label: 'Awaiting confirmation' }, { value: 'DISPUTED', label: 'Disputed' }, { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'RECORDED', label: 'Recorded by organiser' }, { value: 'BYE', label: 'Bye' }, { value: 'LEGACY', label: 'Previously recorded' },
            ] },
        { kind: 'date', key: 'from', label: 'From', when: query => Boolean(first(query, 'period')) },
        { kind: 'date', key: 'to', label: 'Until', when: query => Boolean(first(query, 'period')) },
    ],
    async load(query, page, { signal, sessionId }) {
        const period = first(query, 'period'), day = first(query, 'day');
        if (!period) {
            const listed = await loadDay(query, day || null, signal, sessionId);
            if (listed) return listed;
        }
        return loadPeriod(query, period || 'UPCOMING', page, signal, sessionId);
    },
    heading: query => {
        const period = first(query, 'period'), day = first(query, 'day');
        return period ? wt(PERIOD_HEADING[period]) : day ? longDay(day, appLocale()) : undefined;
    },
    key: f => f.code,
    Item: FixtureRow,
    line: fixtureLine,
    placeKinds: ['MATCH', 'TOURNAMENT', 'CLUB'],
    place: (f, places) => fixturePlace(f.m, places),
    groups: { of: fixtureGroup, describe: sharedGround },
    // Over the map, matches are grouped by where they are played, each ground a pin with its kick-off range and time.
    panel: 'pin',
    where: rows => fixtureWhere(rows),
    // The away day: from the side that travels to the match's own ground (never a ground it was only placed near). When
    // one of my teams plays, that is my side; otherwise the club further away (a club fixture's "home" is only whose
    // calendar it is, not who hosts).
    away: (f, places) => {
        const to = ownPlace(f.m, places);
        const ends = (['home', 'away'] as const).filter(end => !(f.mine.home || f.mine.away) || f.mine[end]);
        const from = to && farthest(ends.flatMap(end => places.club(end === 'home' ? f.m.homeClubId : f.m.awayClubId) ?? []), to);
        return from && to ? awayLine({ lat: from.lat, lng: from.lng, name: from.name }, to, km => wt('≈ {km} km', { km: Math.round(km) }), wt('As the crow flies')) : null;
    },
    Top: DayStrip,
    HeadTools: DayStep,
    Empty: DayEmpty,
    Tools: FixtureTools,
    // Coaches and players open on their own teams' matches; parents' children are starred instead.
    defaults: ({ role }): Record<string, string[]> => COACHING_ROLES.has(role) || role === 'player' ? { mine: ['true'] } : {},
    empty: { title: 'No matches here yet', body: 'Matches appear when a team or competition organiser schedules or records them.' },
};
