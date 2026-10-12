import { describe, expect, it } from 'vitest';
import type { HistoryMatch } from '../../matchHistory/api';
import type { Match, Referee } from '../../matchExchange/api';
import type { Availability } from '../../venues/api';
import type { GroupStandingsRow, TournamentFixtureDto } from '../../tournaments/domain';
import { formOf, lastMeeting, tally } from '../scoreboard/form';
import { cupPath, nextFixture, tableRows, windowAround, zoned } from '../scoreboard/standings';
import { freeSlots, slotLink } from '../front/coach/slots';
import { lastPlayedOf, loadDays, restBefore, tightMatches } from '../front/coach/load';
import { orderForRole } from '../front/coach/relevance';
import { fitsGender, focusFrom, sideSizeOf, squadsFrom, type MySquad } from '../front/coach/mySquads';
import { invitationsOf } from '../front/coach/coachMatches';
import { opponentOffers, refereesFor } from '../front/coach/coachExchange';
import { trialsFor } from '../front/coach/coachCompetitions';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-11T08:00:00Z');
const match = (id: string, days: number, over: Partial<HistoryMatch> = {}): HistoryMatch => ({
    id, source: 'SCHEDULE', sourceId: 1, title: id, startsAt: new Date(NOW + days * DAY).toISOString(), endsAt: null, timezone: 'Asia/Tbilisi',
    homeClubId: 1, homeClubName: 'Dinamo', homeSquadId: 103, homeSquadName: 'U14 Boys', awayClubId: 4, awayClubName: 'Saburtalo', awaySquadId: 9125, awaySquadName: 'U14 Boys',
    homeScore: 2, awayScore: 1, resultStatus: 'RECORDED', fixtureStatus: 'COMPLETED', legacy: false, detailPath: `/m/${id}`, canRecordResult: false, ...over,
});
const squad = (over: Partial<MySquad> = {}): MySquad => ({ id: 103, clubId: 1, name: 'U14 Boys', ageGroup: 'U14', gender: 'MALE', format: '9_A_SIDE', sideSize: 9, ...over });

describe('form', () => {
    it('counts only agreed results, newest first, from my squad’s side', () => {
        const results = formOf([
            match('old', -10), match('new', -2, { homeScore: 0, awayScore: 3 }),
            match('proposed', -1, { resultStatus: 'PROPOSED' }), match('disputed', -1, { resultStatus: 'DISPUTED' }),
            match('missing', -1, { homeScore: null, awayScore: null, resultStatus: 'NONE' }), match('cancelled', -3, { fixtureStatus: 'CANCELLED' }),
        ], { clubId: 1, squadId: 103 });
        expect(results.map(result => `${result.id}:${result.outcome}`)).toEqual(['new:L', 'old:W']);
    });
    it('never reads a missing score as a draw', () => {
        expect(formOf([match('x', -1, { homeScore: null, awayScore: null, resultStatus: 'CONFIRMED' })], { clubId: 1, squadId: 103 })).toEqual([]);
    });
    it('reads the away side by squad, and tallies goals', () => {
        const results = formOf([match('a', -1), match('b', -2, { homeScore: 1, awayScore: 1 })], { clubId: null, squadId: 9125 });
        expect(results.map(result => result.outcome)).toEqual(['L', 'D']);
        expect(tally(results)).toEqual({ played: 2, scored: 2, conceded: 3, w: 0, d: 1, l: 1 });
    });
    it('finds the last meeting from my side, and keeps a meeting whose score is not agreed without a result', () => {
        const mine = { clubId: 1, squadId: 103 }, theirs = { clubId: 4, squadId: 9125 };
        expect(lastMeeting([match('a', -20), match('b', -5, { homeScore: 0, awayScore: 2 })], mine, theirs, NOW)?.result).toMatchObject({ id: 'b', outcome: 'L', scored: 0, conceded: 2 });
        const pending = lastMeeting([match('a', -20), match('b', -5, { resultStatus: 'PROPOSED' }), match('c', -1, { fixtureStatus: 'CANCELLED' })], mine, theirs, NOW);
        expect(pending?.match.id).toBe('b');
        expect(pending?.result).toBeNull();
    });
});

describe('standings', () => {
    const row = (entryId: number, points: number, goalDifference = 0): GroupStandingsRow => ({ entryId, entryName: `Team ${entryId}`, played: 4, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference, points } as GroupStandingsRow);
    it('orders by points then goal difference and marks my row', () => {
        const rows = tableRows([row(1, 5, -1), row(2, 9), row(3, 5, 4)], new Set([3]));
        expect(rows.map(entry => `${entry.rank}:${entry.entryId}:${entry.mine}`)).toEqual(['1:2:false', '2:3:true', '3:1:false']);
    });
    it('keeps a long table short around my row', () => {
        const rows = tableRows(Array.from({ length: 12 }, (_, index) => row(index + 1, 30 - index)), new Set([10]));
        expect(windowAround(rows).map(entry => entry === 'gap' ? 'gap' : entry.rank)).toEqual([1, 2, 3, 'gap', 9, 10, 11]);
        expect(windowAround(rows.slice(0, 6))).toHaveLength(6);
    });
    const fixture = (id: number, round: number, home: number, away: number, score?: [number, number]): TournamentFixtureDto => ({
        id, stageId: 1, stageName: 'Cup', homeEntryId: home, homeLabel: `T${home}`, awayEntryId: away, awayLabel: `T${away}`, winnerEntryId: null,
        homeScore: score?.[0] ?? null, awayScore: score?.[1] ?? null, roundNumber: round, scheduledAt: `2026-10-${10 + round}T18:00:00`, status: score ? 'COMPLETED' : 'SCHEDULED',
    } as TournamentFixtureDto);
    it('names knockout rounds by their size and follows my run', () => {
        const fixtures = [fixture(1, 1, 7, 2, [3, 1]), fixture(2, 1, 3, 4, [0, 1]), fixture(3, 1, 5, 6, [2, 0]), fixture(4, 1, 8, 9, [1, 0]), fixture(5, 2, 7, 4, [2, 1]), fixture(6, 2, 5, 8, [1, 0]), fixture(7, 3, 7, 5)];
        const level = cupPath([fixture(1, 1, 7, 2, [1, 1])], new Set([7]));
        expect(level.steps[0].state).toBe('level');
        expect(level.eliminated).toBe(false);
        const run = cupPath(fixtures, new Set([7]));
        expect(run.steps.map(step => `${step.round}:${step.state}`)).toEqual(['Quarter-final:W', 'Semi-final:W', 'Final:next']);
        expect(run.eliminated).toBe(false);
        expect(nextFixture(fixtures, new Set([7]))?.id).toBe(7);
        expect(cupPath(fixtures, new Set([4])).eliminated).toBe(true);
    });
    it('reads zone-less fixture times as Georgian time', () => {
        expect(zoned('2026-10-17T18:00:00')).toBe('2026-10-17T18:00:00+04:00');
        expect(zoned('2026-10-17T14:00:00Z')).toBe('2026-10-17T14:00:00Z');
    });
});

describe('free slots', () => {
    const slot = (iso: string, available = true) => ({ startsAt: iso, endsAt: iso, available, price: 80 });
    const availability: Availability = { venueId: 9, timezone: 'Asia/Tbilisi', fromDate: '2026-10-12', toDate: '2026-10-12', days: [{ date: '2026-10-12', pitches: [
        { pitchId: 1, slots: [slot('2026-10-12T12:00:00Z'), slot('2026-10-12T13:30:00Z', false), slot('2026-10-12T14:00:00Z'), slot('2026-10-12T18:30:00Z')] },
        { pitchId: 2, slots: [slot('2026-10-12T13:00:00Z'), slot('2026-10-12T14:00:00Z')] },
    ] }] } as Availability;
    it('keeps evening starts in the venue’s own time, one per start time, for pitches that suit', () => {
        // 13:00Z is 17:00 in Tbilisi; 12:00Z is 16:00 and 18:30Z is 22:30, both outside the evening.
        expect(freeSlots(availability, { now: NOW }).map(chip => `${chip.startsAt}@${chip.pitchId}`)).toEqual(['2026-10-12T13:00:00Z@2', '2026-10-12T14:00:00Z@1']);
        expect(freeSlots(availability, { now: NOW, keep: id => id === 1 }).map(chip => chip.startsAt)).toEqual(['2026-10-12T14:00:00Z']);
    });
    it('links to the venue’s calendar with the slot chosen', () => {
        expect(slotLink(9, { startsAt: 'a', endsAt: 'b', date: '2026-10-12', pitchId: 2, price: 1 })).toBe('/stadiums/9?date=2026-10-12&pitch=2&start=a&end=b');
    });
});

describe('match load', () => {
    it('flags a match less than 72 hours after the last, or the third in a week', () => {
        const sorted = [match('a', 1), match('b', 2), match('c', 6), match('d', 7.5)];
        expect(tightMatches(sorted).map(item => item.id)).toEqual(['b', 'c', 'd']);
    });
    it('counts rest from the last match played, never from a cancelled fixture', () => {
        const played = match('played', -1.5), cancelled = match('off', 0.5, { fixtureStatus: 'CANCELLED' });
        expect(lastPlayedOf([cancelled, played], NOW)?.id).toBe('played');
        const days = loadDays([match('a', 1)], { now: NOW, lastPlayed: played });
        expect(days[1]).toMatchObject({ tight: true, restDays: 2 });
    });
    it('lays two weeks out from today and counts rest from the last match played', () => {
        const days = loadDays([match('a', 1), match('b', 3.2)], { now: NOW });
        expect(days).toHaveLength(14);
        expect(days[1].matches.map(item => item.id)).toEqual(['a']);
        const rest = restBefore([match('a', 1), match('b', 3.2)], match('played', -3));
        expect(rest.get('a')).toEqual({ days: 4, tight: false });
        expect(rest.get('b')).toEqual({ days: 2, tight: true });
    });
});

describe('squads', () => {
    it('reads age, format and gender, youngest first', () => {
        const squads = squadsFrom([{ id: 105, clubId: 1, name: 'U16 Boys', category: 'U16' }, { id: 103, clubId: 1, name: 'U14 Boys', category: 'U14' }], [{ id: 103, name: 'U14 Boys', category: 'U14', gender: 'MALE' }] as never);
        expect(squads.map(item => `${item.name}:${item.ageGroup}:${item.gender}`)).toEqual(['U14 Boys:U14:MALE', 'U16 Boys:U16:null']);
        expect(sideSizeOf('9_A_SIDE')).toBe(9);
    });
    it('keeps girls’ competitions for girls and mixed squads, and the URL’s squad in focus', () => {
        expect(fitsGender('Girls', 'MALE')).toBe(false);
        expect(fitsGender('U16 Girls', 'MIXED')).toBe(true);
        expect(fitsGender('Boys', 'MALE')).toBe(true);
        expect(fitsGender('Open', 'FEMALE')).toBe(true);
        const both = [squad(), squad({ id: 105, name: 'U16 Boys' })];
        expect(focusFrom('105', both).map(item => item.id)).toEqual([105]);
        expect(focusFrom('999', both)).toHaveLength(2);
    });
});

describe('match exchange for my squads', () => {
    const listing = (over: Partial<Match>): Match => ({ event_id: 1, squad_id: 9, squad_name: 'U14 Boys', club_id: 5, club_name: 'Locomotive', club_logo_url: null,
        starts_at_iso: new Date(NOW + 2 * DAY).toISOString(), event_status: 'SCHEDULED', opponent_club_id: null, requested_squad_id: null, age_group: 'U14', format: '9_A_SIDE',
        location_lat: 41.72, location_lng: 44.8, ...over } as Match);
    it('puts requests to answer first and counts offers on my open listings', () => {
        const items = invitationsOf([
            listing({ event_id: 1, can_respond: true, requested_squad_id: 103, starts_at_iso: new Date(NOW + 5 * DAY).toISOString() }),
            listing({ event_id: 2, club_id: 1, squad_id: 103 }), listing({ event_id: 3, club_id: 1, squad_id: 103 }),
            listing({ event_id: 4, club_id: 1, squad_id: 103, opponent_club_id: 7 }),
        ], new Map([[2, listing({ event_id: 2, proposals: [{ status: 'PENDING' }, { status: 'DECLINED' }] as Match['proposals'] })]]), [squad()], NOW);
        expect(items.map(item => `${item.match.event_id}:${item.kind}:${item.offers}:${item.soon}`)).toEqual(['2:offers:1:true', '3:open:0:true', '1:reply:0:false']);
    });
    it('offers other clubs’ open listings that suit a squad, marking days it already plays', () => {
        const offers = opponentOffers([
            listing({ event_id: 1 }), listing({ event_id: 2, squad_name: 'U14 Girls' }), listing({ event_id: 3, club_id: 1 }),
            listing({ event_id: 4, requested_squad_id: 50 }), listing({ event_id: 1 }),
        ], [squad()], [1], { lat: 41.71, lng: 44.79 }, new Map([[103, new Set(['2026-10-13'])]]), NOW);
        expect(offers.map(offer => offer.match.event_id)).toEqual([1]);
        expect(offers[0].busy).toBe(true);
        expect(offers[0].km).toBeLessThan(5);
    });
    it('orders referees local first, then volunteers, then fee, for the formats needed', () => {
        const referee = (user_id: number, over: Partial<Referee>) => ({ user_id, full_name: `R${user_id}`, published: true, formats: '9_A_SIDE', service_area: 'Kutaisi', accepts_paid: true, accepts_volunteer: false, fee: 100, ...over } as Referee);
        const ordered = refereesFor([referee(1, { fee: 50 }), referee(2, { service_area: 'Tbilisi', fee: 120 }), referee(3, { accepts_volunteer: true }), referee(4, { formats: '5_A_SIDE' }), referee(5, { accepts_paid: false })], ['9_A_SIDE'], 'Tbilisi');
        expect(ordered.map(item => item.user_id)).toEqual([2, 3, 1]);
    });
});

describe('relevance', () => {
    it('puts what speaks to the role first without hiding anything', () => {
        const jobs = ['Youth coach', 'Goalkeeper coach', 'Physio'];
        expect(orderForRole(jobs, 'goalkeeper-coach', job => job)).toEqual(['Goalkeeper coach', 'Youth coach', 'Physio']);
        expect(orderForRole(jobs, 'fitness-coach', job => job)).toEqual(['Physio', 'Youth coach', 'Goalkeeper coach']);
        expect(orderForRole(jobs, 'parent', job => job)).toEqual(jobs);
    });
    it('keeps other clubs’ trials for my ages and genders', () => {
        const trial = (id: number, over: object) => ({ id, clubId: 5, title: 'Trial', position: null, ageGroup: 'U14', gender: 'MALE', ...over }) as never;
        const kept = trialsFor([trial(1, {}), trial(2, { clubId: 1 }), trial(3, { gender: 'FEMALE' }), trial(4, { ageGroup: 'U10' }), trial(5, { gender: null, title: 'Goalkeepers' })], [squad()], [1], 'goalkeeper-coach');
        expect(kept.map(item => (item as { id: number }).id)).toEqual([5, 1]);
    });
});
