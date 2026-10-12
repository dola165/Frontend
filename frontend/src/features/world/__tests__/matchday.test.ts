import { describe, expect, it } from 'vitest';
import type { HistoryMatch } from '../../matchHistory/api';
import { listingCode, matchCode, matchPagePath, parseMatchCode } from '../scoreboard/matchCode';
import { matchState, zonedMatch } from '../scoreboard/matchState';
import { sideIsMine, NO_TEAMS, type MyTeams } from '../scoreboard/myTeams';
import { arrangeGroups } from '../directory/groups';
import { fixtureGroup, fixtureWhere, sharedGround, toFixtures } from '../directories/matches/fixtures';
import { pinGroups } from '../directory/panelGroups';
import { awayLine, pairBounds } from '../map/away';
import { busyDaysOf, fitOf, fitSquads } from '../scoreboard/squadFit';
import type { Match } from '../../matchExchange/api';
import { bucketDays, nextMatchday, openingDay, shiftDay, windowRange } from '../directories/matches/matchday';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-13T08:00:00Z'); // 12:00 in Tbilisi
const at = (hours: number) => new Date(NOW + hours * HOUR).toISOString();
const match = (over: Partial<HistoryMatch> = {}): HistoryMatch => ({
    id: 'event:1', source: 'SCHEDULE', sourceId: 5722, title: 'Dinamo v Saburtalo', startsAt: at(2), endsAt: at(3.75), timezone: 'Asia/Tbilisi',
    homeClubId: 1, homeClubName: 'Dinamo', homeSquadId: 102, homeSquadName: 'U12 Mixed', awayClubId: 4, awayClubName: 'Saburtalo', awaySquadId: 9102, awaySquadName: 'U12 Mixed',
    homeScore: null, awayScore: null, resultStatus: 'NONE', fixtureStatus: 'SCHEDULED', legacy: false, detailPath: '/calendar?eventId=5722', canRecordResult: false, ...over,
});

describe('matchState: what a match is, honestly', () => {
    it('says called-off matches first, whatever their score', () => {
        expect(matchState(match({ fixtureStatus: 'CANCELLED', homeScore: 2, awayScore: 0, resultStatus: 'RECORDED' }), NOW)).toMatchObject({ code: 'cancelled', when: { word: 'Canc.', tone: 'danger' }, score: null });
        expect(matchState(match({ fixtureStatus: 'POSTPONED' }), NOW).code).toBe('postponed');
        expect(matchState(match({ fixtureStatus: 'ABANDONED' }), NOW).code).toBe('abandoned');
        expect(matchState(match({ resultStatus: 'BYE' }), NOW).when).toMatchObject({ word: 'Bye' });
    });

    it('shows a score only once it counts: never a proposed or disputed one', () => {
        expect(matchState(match({ startsAt: at(-30), endsAt: at(-28), homeScore: 3, awayScore: 1, resultStatus: 'RECORDED', fixtureStatus: 'COMPLETED' }), NOW))
            .toMatchObject({ code: 'ft', when: { word: 'FT' }, score: { home: 3, away: 1 } });
        const proposed = matchState(match({ startsAt: at(-30), endsAt: at(-28), homeScore: 0, awayScore: 1, resultStatus: 'PROPOSED' }), NOW);
        expect(proposed).toMatchObject({ code: 'proposed', score: null, tag: { word: 'Score to confirm', tone: 'neutral' } });
        expect(matchState(match({ startsAt: at(-30), endsAt: at(-28), homeScore: 0, awayScore: 1, resultStatus: 'PROPOSED', canRecordResult: true }), NOW).tag)
            .toEqual({ word: 'Score to confirm', tone: 'warning' });
        expect(matchState(match({ startsAt: at(-30), endsAt: at(-28), homeScore: 2, awayScore: 2, resultStatus: 'DISPUTED' }), NOW))
            .toMatchObject({ code: 'disputed', score: null, tag: { word: 'Disputed', tone: 'danger' } });
    });

    it('never puts an open listing without an opponent on, nor asks it for a result', () => {
        const open = { source: 'MATCH_EXCHANGE' as const, awayClubId: null, awayClubName: null, awaySquadId: null, awaySquadName: null };
        expect(matchState(match({ ...open, startsAt: at(-0.5), endsAt: at(1) }), NOW)).toMatchObject({ code: 'unplayed', when: { word: 'Not played' } });
        expect(matchState(match(open), NOW).tag).toEqual({ word: 'Opponent wanted', tone: 'neutral' });
    });

    it('marks results carried over from before GrassKickZ as faint', () => {
        expect(matchState(match({ startsAt: at(-300), endsAt: at(-298), homeScore: 1, awayScore: 0, resultStatus: 'LEGACY' }), NOW).faint).toBe(true);
        expect(matchState(match({ startsAt: at(-300), endsAt: at(-298), homeScore: 1, awayScore: 0, resultStatus: 'RECORDED', legacy: true }), NOW).faint).toBe(true);
    });

    it('waits for a date, then a kick-off, saying how soon only for my own matches', () => {
        expect(matchState(match({ startsAt: null, endsAt: null }), NOW)).toMatchObject({ code: 'tbc', when: { word: 'TBC' } });
        const before = matchState(match(), NOW);
        expect(before).toMatchObject({ code: 'before', when: { time: '14:00' } });
        expect(before.tag).toBeUndefined();
        expect(matchState(match(), NOW, true).tag).toEqual({ word: 'in {hours} h', vars: { hours: 2 }, tone: 'neutral' });
        expect(matchState(match({ startsAt: at(0.5) }), NOW, true).tag).toMatchObject({ word: 'in {minutes} min', vars: { minutes: 30 } });
        expect(matchState(match({ startsAt: at(8) }), NOW, true).tag).toBeUndefined();
    });

    it('is on now only by the schedule, and only "Started" without an end time', () => {
        expect(matchState(match({ startsAt: at(-0.5), endsAt: at(1) }), NOW)).toMatchObject({ code: 'on', when: { word: 'On now', tone: 'accent' } });
        expect(matchState(match({ source: 'TOURNAMENT', startsAt: at(-0.5), endsAt: null }), NOW)).toMatchObject({ code: 'started', when: { word: 'Started' } });
        // Long after kick-off with no end time, a fixture owes its result rather than being "started" forever.
        expect(matchState(match({ source: 'TOURNAMENT', startsAt: at(-26), endsAt: null }), NOW)).toMatchObject({ code: 'none', tag: { word: 'No result yet' } });
        expect(matchState(match({ startsAt: at(-26), endsAt: at(-24), canRecordResult: true }), NOW).tag).toEqual({ word: 'Add result', tone: 'warning' });
    });

    it('reads a time without an offset as the ground’s clock in Georgia', () => {
        const local = match({ startsAt: '2026-10-13T14:00:00', endsAt: '2026-10-13T15:45:00', timezone: null });
        expect(zonedMatch(local)).toMatchObject({ startsAt: '2026-10-13T14:00:00+04:00', endsAt: '2026-10-13T15:45:00+04:00' });
        expect(matchState(local, NOW)).toMatchObject({ code: 'before', when: { time: '14:00' } });
        expect(matchState(local, Date.parse('2026-10-13T10:30:00Z')).code).toBe('on');
        const zoned = match();
        expect(zonedMatch(zoned)).toBe(zoned);
    });
});

describe('match codes', () => {
    it('name a match by its source and id, and read back', () => {
        expect(matchCode(match())).toBe('s5722');
        expect(matchCode(match({ source: 'MATCH_EXCHANGE', sourceId: 5736 }))).toBe('x5736');
        expect(matchCode(match({ source: 'TOURNAMENT', sourceId: 7010, tournamentId: 301 }))).toBe('t301.7010');
        expect(listingCode(5854)).toBe('x5854');
        expect(parseMatchCode('t301.7010')).toEqual({ source: 'TOURNAMENT', id: 7010, tournamentId: 301 });
        expect(parseMatchCode('x5736')).toEqual({ source: 'MATCH_EXCHANGE', id: 5736 });
        expect(parseMatchCode('s5722')).toEqual({ source: 'SCHEDULE', id: 5722 });
        for (const bad of ['', 'x', 't301', 'x5.6', 'q12', 'x0', 'SCHEDULE:5722', 's-1']) expect(parseMatchCode(bad)).toBeNull();
    });

    it('send the full page without the result anchor', () => {
        expect(matchPagePath({ detailPath: '/match-exchange/5736#result' })).toBe('/match-exchange/5736');
        expect(matchPagePath({ detailPath: '/tournaments/301?fixtureId=7010' })).toBe('/tournaments/301?fixtureId=7010');
    });
});

describe('my teams', () => {
    const mine: MyTeams = { squadIds: new Set([102, 103]), clubIds: new Set([1]), arrangeClubIds: new Set([1]), names: new Map(), ages: new Set() };
    it('star a side by its squad, and by its club only when it names no squad', () => {
        expect(sideIsMine({ clubId: 1, squadId: 102 }, mine)).toBe(true);
        expect(sideIsMine({ clubId: 1, squadId: 107 }, mine)).toBe(false);
        expect(sideIsMine({ clubId: 1, squadId: null }, mine)).toBe(true);
        expect(sideIsMine({ clubId: 4, squadId: null }, mine)).toBe(false);
        expect(sideIsMine({ clubId: null, squadId: null }, mine)).toBe(false);
    });
});

describe('groups shown as score cards', () => {
    const lanes = [
        { key: 'needs', label: 'Needs you', rank: 0, empty: 'Nothing needs you' },
        { key: 'waiting', label: 'Waiting on them', rank: 1, empty: 'Nothing waiting on them' },
        { key: 'played', label: 'Played', rank: 3, empty: 'Nothing played yet' },
    ];
    it('keep always-shown groups in rank order, even empty, and describe groups from their results', () => {
        const items = [{ lane: 'played', ground: 'Digomi' }, { lane: 'needs', ground: 'Vake' }, { lane: 'played', ground: 'Digomi' }];
        const arranged = arrangeGroups(items, item => lanes.find(lane => lane.key === item.lane)!, undefined,
            { always: lanes, describe: rows => new Set(rows.map(row => row.ground)).size === 1 ? rows[0].ground : undefined });
        expect(arranged.map(({ group, items: rows }) => [group.key, rows.length, group.detail])).toEqual([['needs', 1, 'Vake'], ['waiting', 0, undefined], ['played', 2, 'Digomi']]);
        expect(arranged[1].group.empty).toBe('Nothing waiting on them');
    });
});

describe('fixtures in their cards', () => {
    const mine: MyTeams = { squadIds: new Set([102]), clubIds: new Set([1]), arrangeClubIds: new Set([1]), names: new Map(), ages: new Set() };
    it('star my teams by squad, drop fixtures with no sides yet, and keep the day only when the list spans days', () => {
        const rows = toFixtures([match(), match({ sourceId: 9, homeClubId: null, homeClubName: null, awayClubId: null, awayClubName: null }), match({ sourceId: 10, homeSquadId: 107, homeClubId: 1 })], mine, false);
        expect(rows.map(f => [f.code, f.mine.home, f.mine.away, f.showDay])).toEqual([['s5722', true, false, false], ['s10', false, false, false]]);
        expect(rows[0].day).toBe('2026-10-13');
    });
    it('put my teams first, then tournaments by first kick-off, friendlies, club fixtures and undated matches last', () => {
        const fx = (over: Partial<HistoryMatch>, own = false) => ({ m: match(over), code: matchCode(match(over)), day: null, mine: { home: own, away: false }, showDay: true });
        const groups = [
            fx({ source: 'SCHEDULE' }), fx({ source: 'MATCH_EXCHANGE', sourceId: 2 }), fx({ source: 'TOURNAMENT', sourceId: 3, tournamentId: 306, tournamentName: 'Youth Cup', startsAt: at(30) }),
            fx({ source: 'TOURNAMENT', sourceId: 4, tournamentId: 301, tournamentName: 'League', startsAt: at(4) }), fx({ startsAt: null, sourceId: 5 }), fx({ sourceId: 6 }, true),
        ].map(fixtureGroup);
        const ranked = [...new Map(groups.map(group => [group.key, group])).values()].sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9)).map(group => group.label);
        expect(ranked).toEqual(['Your teams', 'League', 'Youth Cup', 'Friendlies', 'Club fixtures', 'Date to confirm']);
        expect(groups[3].action).toEqual({ label: 'Tournament', to: '/tournaments/301', peek: 'tournament-301' });
    });
    it('name the ground a card shares', () => {
        const fx = (locationName: string | null) => ({ m: match({ locationName }), code: 's1', day: null, mine: { home: false, away: false }, showDay: true });
        expect(sharedGround([fx('Mtskheta Riverside Field, Mtskheta'), fx('Mtskheta Riverside Field, Mtskheta')])).toBe('Mtskheta Riverside Field');
        expect(sharedGround([fx('Mtskheta Riverside Field, Mtskheta'), fx('Vake Park Pitches, Tbilisi')])).toBeUndefined();
        expect(sharedGround([fx(null)])).toBeUndefined();
    });
});

describe('the matchday window', () => {
    it('spans a week either side of today, by dates only', () => {
        const range = windowRange('2026-10-12');
        expect([range.from, range.to, range.days.length]).toEqual(['2026-10-05', '2026-10-19', 15]);
        expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
        expect(shiftDay('2026-03-29', -1)).toBe('2026-03-28');
    });
    it('counts each day, stars my days, and opens on today or the next matchday', () => {
        const fx = (day: string, own = false) => ({ m: match(), code: day, day, mine: { home: own, away: false }, showDay: false });
        const { days } = windowRange('2026-10-12');
        const counts = bucketDays([fx('2026-10-06', true), fx('2026-10-13'), fx('2026-10-13', true), fx('2026-10-15'), fx('2026-11-30')], days);
        expect(counts.get('2026-10-13')).toEqual({ count: 2, mine: true });
        expect(counts.get('2026-10-15')).toEqual({ count: 1, mine: false });
        expect(counts.has('2026-11-30')).toBe(false);
        expect(openingDay(counts, '2026-10-12')).toBe('2026-10-13');
        expect(openingDay(counts, '2026-10-13')).toBe('2026-10-13');
        expect(openingDay(counts, '2026-10-16')).toBeNull();
        expect(nextMatchday(counts, '2026-10-13')).toEqual({ day: '2026-10-15', count: 1 });
        expect(nextMatchday(counts, '2026-10-15')).toBeNull();
    });
    it('reads a day from a time with or without an offset, in Georgia', () => {
        expect(toFixtures([match({ startsAt: '2026-10-12T21:30:00Z' })], NO_TEAMS, false)[0].day).toBe('2026-10-13');
        expect(toFixtures([match({ startsAt: '2026-10-13T00:30:00', timezone: null })], NO_TEAMS, false)[0].day).toBe('2026-10-13');
    });
});

describe('the Browse area by where', () => {
    it('groups results by pin in list order, names each by its place, and gathers those without one last', () => {
        const placed = { points: [{ id: 'p1', lat: 0, lng: 0, label: 'Digomi pin', tone: 'match' as const }, { id: 'p2', lat: 1, lng: 1, label: 'Vake pin', tone: 'match' as const }], pinOf: new Map([['a', 'p2'], ['b', 'p1'], ['c', 'p2']]) };
        const groups = pinGroups(['a', 'b', 'c', 'd'], item => item, placed, rows => ({ detail: `${rows.length} here`, label: rows.includes('b') ? 'Digomi' : undefined }));
        expect(groups.map(({ group, items }) => [group.key, group.label, group.detail, items])).toEqual([
            ['p2', 'Vake pin', '2 here', ['a', 'c']], ['p1', 'Digomi', '1 here', ['b']], ['~loose', 'Not on the map', undefined, ['d']]]);
    });
    it('says a ground’s kick-off range, and on its pin one match’s state or the next kick-off', () => {
        const fx = (over: Partial<HistoryMatch>) => ({ m: match(over), code: 'x', day: null, mine: { home: false, away: false }, showDay: false });
        const two = fixtureWhere([fx({ startsAt: at(5), locationName: 'Digomi, Tbilisi' }), fx({ startsAt: at(2), locationName: 'Digomi, Tbilisi' })], NOW);
        expect(two).toEqual({ label: 'Digomi', detail: '14:00–17:00', chip: '14:00' });
        expect(fixtureWhere([fx({ startsAt: at(-30), endsAt: at(-28), homeScore: 4, awayScore: 3, resultStatus: 'RECORDED' })], NOW).chip).toBe('FT 4–3');
        expect(fixtureWhere([fx({ startsAt: at(-0.5), endsAt: at(1) })], NOW).chip).toBe('On now');
        expect(fixtureWhere([fx({ fixtureStatus: 'CANCELLED' })], NOW).chip).toBe('Canc.');
    });
});

describe('the away-day line', () => {
    const label = (km: number) => `≈ ${Math.round(km)} km`;
    it('runs from the travelling club to the ground with the distance, and not for a ground next door', () => {
        const line = awayLine({ lat: 41.7631, lng: 44.7712, name: 'Dinamo' }, { lat: 41.9198, lng: 45.4732 }, label, 'As the crow flies');
        expect(line).toMatchObject({ label: '≈ 61 km', title: 'As the crow flies', from: { name: 'Dinamo' } });
        expect(pairBounds(line!)).toEqual({ west: 44.7712, south: 41.7631, east: 45.4732, north: 41.9198 });
        expect(awayLine({ lat: 41.7631, lng: 44.7712 }, { lat: 41.7632, lng: 44.7713 }, label, 'x')).toBeNull();
    });
});

describe('open matches that suit my squads', () => {
    const squads = fitSquads([{ id: 103, club_id: 1, name: 'U14 Boys', category: 'U14', club_name: 'Dinamo' }, { id: 104, club_id: 1, name: 'U14 Girls', category: 'U14', club_name: 'Dinamo' }]);
    const listing = (over: Partial<Match>) => ({ event_id: 1, club_id: 5, squad_name: 'U14 Boys', age_group: 'U14', requested_club_id: null, opponent_club_id: null, ...over }) as Match;
    it('find my squad of the same age and a gender the listing admits, never on my own club or an agreed match', () => {
        expect(fitOf(listing({}), squads)?.id).toBe(103);
        expect(fitOf(listing({ squad_name: 'U14 Girls' }), squads)?.id).toBe(104);
        expect(fitOf(listing({ age_group: 'U16' }), squads)).toBeNull();
        expect(fitOf(listing({ club_id: 1 }), squads)).toBeNull();
        expect(fitOf(listing({ opponent_club_id: 9 }), squads)).toBeNull();
        expect(fitOf(listing({ requested_club_id: 1 }), squads)).toBeNull();
    });
    it('know the days my squads already play, leaving called-off matches out', () => {
        const busy = busyDaysOf([match({ homeSquadId: 103, startsAt: '2026-10-13T07:00:00Z' }), match({ awaySquadId: 104, homeSquadId: 9, startsAt: '2026-10-14T07:00:00Z', fixtureStatus: 'CANCELLED' })], squads);
        expect([...busy.get(103)!]).toEqual(['2026-10-13']);
        expect(busy.get(104)!.size).toBe(0);
    });
});
