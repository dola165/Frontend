import { describe, expect, it } from 'vitest';
import type { Squad } from '../../api';
import type { Ground } from '../api';
import { addMinutes, buildArrangement, buildTerms, defaultFormat, defaultMinutes, draftFromMatch, placeGround, problemsWith, suggestOurSquad, suggestTheirSquad, weekendDays, type Draft } from '../matchPlan';
import type { Match } from '../../api';

const squad = (id: number, name: string, category: string): Squad => ({ id, name, category, club_id: 1, club_name: 'Dinamo' });
const ours = [squad(103, 'U14 Boys', 'U14'), squad(104, 'U14 Girls', 'U14'), squad(105, 'U16 Boys', 'U16'), squad(101, 'First Team', 'SENIOR')];
const ground: Ground = { key: 'venue:202', venueId: 202, name: 'Dinamo Academy Training Centre', city: 'Tbilisi', detail: 'Club-owned', latitude: 41.76, longitude: 44.77 };
const draft = (value: Partial<Draft> = {}): Draft => ({
    opponent: { id: 3, name: 'Riverside Academy' }, targetSquadId: 112, squadId: 103, date: '2099-10-17', time: '11:00', minutes: null, format: null,
    ground: { kind: 'LATER', city: 'Tbilisi' }, referee: 'US', refereeName: '', note: '', title: '', matchType: 'FRIENDLY', level: 'DEVELOPMENT', timezone: 'Asia/Tbilisi', requestId: 'req-1', ...value,
});

describe('match length and format by age group', () => {
    it('uses youth formats and adds half-time to the playing time', () => {
        expect([defaultFormat('U8'), defaultFormat('U12'), defaultFormat('U14'), defaultFormat('U16'), defaultFormat('SENIOR')]).toEqual(['5_A_SIDE', '7_A_SIDE', '9_A_SIDE', '11_A_SIDE', '11_A_SIDE']);
        expect([defaultMinutes('U8'), defaultMinutes('U14'), defaultMinutes('U16'), defaultMinutes('SENIOR')]).toEqual([50, 80, 95, 105]);
    });
    it('adds minutes to a wall-clock time without shifting time zones, across midnight', () => {
        expect(addMinutes('2026-10-17T11:00', 80)).toBe('2026-10-17T12:20');
        expect(addMinutes('2026-10-17T23:30', 105)).toBe('2026-10-18T01:15');
    });
    it('offers the next two weekends as quick days', () => {
        expect(weekendDays('2026-10-10')).toEqual(['2026-10-17', '2026-10-18', '2026-10-24']); // a Saturday: next weekend onwards
        expect(weekendDays('2026-10-15')).toEqual(['2026-10-17', '2026-10-18', '2026-10-24']);
    });
});

describe('prefilling squads only when the choice is obvious', () => {
    it('picks our only squad of that age, preferring the squads I coach when the opponent is mixed', () => {
        expect(suggestOurSquad(ours, [103, 105], { id: 112, name: 'U14 Mixed', category: 'U14', gender: 'MIXED' })).toBe(103);
        expect(suggestOurSquad(ours, [], { id: 113, name: 'U14 Girls', category: 'U14', gender: 'FEMALE' })).toBe(104);
        expect(suggestOurSquad(ours, [], { id: 112, name: 'U14 Mixed', category: 'U14', gender: 'MIXED' })).toBe(0);
    });
    it('without an opponent, prefills only a single coached squad', () => {
        expect(suggestOurSquad(ours, [105], null)).toBe(105);
        expect(suggestOurSquad(ours, [103, 105], null)).toBe(0);
    });
    it('matches their squad by age, never pairing boys with girls', () => {
        const theirs = [{ id: 111, name: 'U16 Boys', category: 'U16' }, { id: 112, name: 'U14 Mixed', category: 'U14' }, { id: 113, name: 'U14 Girls', category: 'U14' }];
        expect(suggestTheirSquad(theirs, ours[0])).toBe(112);
        expect(suggestTheirSquad(theirs, ours[1])).toBe(113);
        expect(suggestTheirSquad(theirs, ours[3])).toBe(0);
    });
});

describe('the arrangement sent to the API', () => {
    it('sends a direct invitation with hosting from the ground and never a booking', () => {
        const body = buildArrangement(draft({ ground: { kind: 'OURS', ground } }), ours[0], 'direct');
        expect(body).toMatchObject({ targetClubId: 3, targetSquadId: 112, bookingId: null, hostingChoice: 'HOME', officialMode: 'LATER', officialResponsibility: 'HOST' });
        expect(body.match).toMatchObject({ squadId: 103, venueId: 202, locationName: 'Dinamo Academy Training Centre', city: 'Tbilisi', startsAt: '2099-10-17T11:00', endsAt: '2099-10-17T12:20', format: '9_A_SIDE', venuePreference: 'HOME', title: 'U14 Boys v Riverside Academy', revision: 0 });
    });
    it('leaves the squad choice to them, their ground means we travel, and they can own the referee', () => {
        const body = buildArrangement(draft({ targetSquadId: 0, ground: { kind: 'THEIRS', ground }, referee: 'THEM' }), ours[0], 'direct');
        expect(body).toMatchObject({ targetSquadId: null, hostingChoice: 'AWAY', officialResponsibility: 'OPPONENT', match: { venuePreference: 'AWAY' } });
    });
    it('posts an open match without a target club and with an editable length', () => {
        const body = buildArrangement(draft({ minutes: 60, format: '7_A_SIDE', ground: { kind: 'LATER', city: 'Rustavi' }, referee: 'NONE' }), ours[0], 'open');
        expect(body).toMatchObject({ targetClubId: null, targetSquadId: null, hostingChoice: 'FLEXIBLE', officialMode: 'NONE', match: { endsAt: '2099-10-17T12:00', format: '7_A_SIDE', city: 'Rustavi', locationName: 'Ground to be arranged', venueId: null, refereeRequired: false, venuePreference: 'EITHER' } });
    });
});

describe('what must be filled in', () => {
    const now = new Date('2026-10-10T08:00:00Z');
    it('asks for the opponent, kick-off and a pin, in plain words', () => {
        const problems = problemsWith(draft({ opponent: null, date: '', time: '', ground: { kind: 'PIN', name: 'School pitch', city: 'Tbilisi', latitude: '', longitude: '' } }), 'direct', now);
        expect(problems).toEqual({ opponent: 'Search for the club you want to play.', date: 'Choose the match day.', time: 'Choose the kick-off time.', ground: 'Drop a pin on the ground, or choose another option.' });
    });
    it('rejects a kick-off in the past and an unnamed external referee', () => {
        expect(problemsWith(draft({ date: '2026-10-09', referee: 'EXTERNAL' }), 'direct', now)).toEqual({ date: 'Kick-off must be in the future.', referee: 'Name the referee you have arranged.' });
    });
    it('does not need an opponent for an open match', () => {
        expect(problemsWith(draft({ opponent: null }), 'open', now)).toEqual({});
    });
});

describe('editing a published match', () => {
    const match = { event_id: 9, squad_id: 103, title: 'U14 Boys v Riverside', description: 'Bring bibs', starts_at: '2099-10-17T11:00:00', ends_at: '2099-10-17T12:20:00', timezone: 'Asia/Tbilisi',
        city: 'Tbilisi', location_name: 'Dinamo Academy Training Centre', location_lat: 41.76, location_lng: 44.77, venue_id: 202, format: '9_A_SIDE', level: 'COMPETITIVE', referee_required: false,
        opponent_club_id: 3, opponent_name: 'Riverside Academy', target_squad_id: 112 } as Match;
    it('reads the stored terms back into the form and shows our venue as our ground', () => {
        const value = draftFromMatch(match);
        expect(value).toMatchObject({ date: '2099-10-17', time: '11:00', minutes: 80, format: '9_A_SIDE', referee: 'NONE', note: 'Bring bibs', level: 'COMPETITIVE', opponent: { id: 3 } });
        expect(placeGround(value.ground, [ground], [])).toEqual({ kind: 'OURS', ground, city: 'Tbilisi' });
    });
    it('keeps a "We travel" match at their ground when edited, never "either ground"', () => {
        const travel = draftFromMatch({ ...match, venue_id: null, location_name: 'At the opponent’s ground', location_lat: null, location_lng: null, hosting_choice: 'AWAY', venue_preference: 'AWAY' });
        expect(travel.ground).toEqual({ kind: 'TRAVEL', city: 'Tbilisi' });
        expect(buildTerms(travel, ours[0], 'edit', 3).venuePreference).toBe('AWAY');
    });
    it('keeps a ground both clubs use where the match was agreed', () => {
        const shared = draftFromMatch({ ...match, hosting_choice: 'AWAY' });
        expect(placeGround(shared.ground, [ground], [ground], shared.hosting)).toMatchObject({ kind: 'THEIRS' });
        expect(buildTerms({ ...shared, ground: placeGround(shared.ground, [ground], [ground], shared.hosting) }, ours[0], 'edit').venuePreference).toBe('AWAY');
    });
    it('asks for the city of a listed ground that has none, instead of being refused by the server', () => {
        const blank = { ...ground, city: '' };
        expect(problemsWith(draft({ ground: { kind: 'OTHER', ground: blank } }), 'direct', new Date('2026-10-10T08:00:00Z')).ground).toBe('Add the city of this ground.');
        expect(problemsWith(draft({ ground: { kind: 'OTHER', ground: blank, city: 'Rustavi' } }), 'direct', new Date('2026-10-10T08:00:00Z')).ground).toBeUndefined();
    });
    it('keeps a ground recorded without a pin', () => {
        const value = draftFromMatch({ ...match, venue_id: null, location_name: 'School No. 51 pitch', location_lat: null, location_lng: null });
        expect(value.ground).toEqual({ kind: 'PIN', name: 'School No. 51 pitch', city: 'Tbilisi', latitude: '', longitude: '' });
        expect(problemsWith(value, 'edit', new Date('2026-10-10T08:00:00Z'))).toEqual({});
    });
});

describe('the restored fields', () => {
    const now = new Date('2026-10-10T08:00:00Z');
    it('plays at another age group, and any length from 20 minutes to 12 hours', () => {
        const terms = buildTerms(draft({ ageGroup: 'U16', minutes: 600 }), ours[0], 'direct');
        expect(terms).toMatchObject({ ageGroup: 'U16', format: '11_A_SIDE', endsAt: '2099-10-17T21:00' });
        expect(problemsWith(draft({ minutes: 721 }), 'direct', now).length).toBe('A match lasts from 20 minutes to 12 hours.');
    });
    it('says who hosts where the ground does not', () => {
        expect(buildArrangement(draft({ ground: { kind: 'LATER', city: 'Tbilisi' } }), ours[0], 'direct').hostingChoice).toBe('FLEXIBLE');
        expect(buildArrangement(draft({ ground: { kind: 'LATER', city: 'Tbilisi' }, hosting: 'HOME' }), ours[0], 'direct')).toMatchObject({ hostingChoice: 'HOME', match: { venuePreference: 'HOME' } });
        // At our own ground we host, whatever was chosen for another ground.
        expect(buildArrangement(draft({ ground: { kind: 'OURS', ground }, hosting: 'AWAY' }), ours[0], 'direct').hostingChoice).toBe('HOME');
    });
    it('invites a referee as the match is sent, or asks referees nearby, with the terms offered', () => {
        const referee = { id: 41, name: 'Nino Beridze', fee: 60, currency: 'GEL', acceptsVolunteer: false, acceptsPaid: true };
        expect(problemsWith(draft({ referee: 'INVITE' }), 'direct', now).referee).toBe('Choose the referee to invite.');
        expect(problemsWith(draft({ referee: 'INVITE', invited: referee }), 'direct', now).referee).toBe('Nino Beridze does not take volunteer matches.');
        expect(buildArrangement(draft({ referee: 'INVITE', invited: referee, volunteer: false, fee: '70', currency: 'GEL' }), ours[0], 'direct'))
            .toMatchObject({ officialMode: 'INVITE', officialResponsibility: 'HOST', refereeId: 41, volunteer: false, fee: 70, currency: 'GEL', match: { refereeRequired: true } });
        expect(buildArrangement(draft({ referee: 'OPEN' }), ours[0], 'open')).toMatchObject({ officialMode: 'OPEN', refereeId: null, volunteer: true, fee: 0 });
        expect(buildArrangement(draft({ referee: 'THEM' }), ours[0], 'direct')).toMatchObject({ officialMode: 'LATER', officialResponsibility: 'OPPONENT' });
    });
});
