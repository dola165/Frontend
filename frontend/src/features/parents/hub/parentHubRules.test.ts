import { describe, expect, it } from 'vitest';
import type { ChildFees, JoiningChild } from '../api';
import { safeNotificationLink } from '../../../utils/notificationDestinations';
import { birthYear, childWaiting, playingClubs } from './childFacts';
import { childPageFor, childPath, finderPath, laterSession, sessionParam } from './childParams';
import { reservedVisit, squadTag } from './familyEvents';
import { lastSettled, money, nextDue, priceLabel } from './familyMoney';

const en = (text: string) => text;
const fees: ChildFees = { status: 'DUE', amount: 150, currency: 'GEL', dueDate: '2026-11-04', period: 'November', lines: [
    { label: 'Training fee · U12', amount: 150, currency: 'GEL', dueDate: '2026-11-04', status: 'DUE', period: 'November', squadId: 102 },
    { label: 'Tournament entry', amount: 30, currency: 'GEL', dueDate: '2026-11-11', status: 'DUE', period: null, squadId: 103 },
    { label: 'Kit', amount: 85, currency: 'GEL', dueDate: '2026-10-20', status: 'OVERDUE', period: null, squadId: null },
    { label: 'Training fee · U12', amount: 150, currency: 'GEL', dueDate: '2026-10-04', status: 'PAID', period: 'October', squadId: 102 },
] };
const child = (over: Partial<JoiningChild> = {}): JoiningChild => ({
    playerId: 9611, identity: { playerId: 9611, version: 1, fullName: 'Giorgi Beridze', dateOfBirth: '2014-03-21', gender: 'MALE', photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true },
    clubs: [{ clubId: 1, clubName: 'Dinamo', cardId: 9611, affiliationStatus: 'ACTIVE', consentStatus: 'CONFIRMED', squadNames: ['U12 Mixed'], squads: [{ id: 102, name: 'U12 Mixed', price: null }], fees }],
    cases: [], inquiries: [], ...over,
} as JoiningChild);

describe('a child’s money (step 5)', () => {
    it('says what the club publishes, never an invented amount', () => {
        expect(priceLabel({ type: 'FIXED', amount: 150, currency: 'GEL', period: 'MONTH', programme: 'U12' }, en)).toBe('150 GEL a month');
        expect(priceLabel({ type: 'FREE', amount: null, currency: null, period: null, programme: null }, en)).toBe('Free');
        expect(priceLabel({ type: 'UNPUBLISHED', amount: null, currency: null, period: null, programme: null }, en)).toBe('Fee not published');
        expect(priceLabel(null, en)).toBe('No fee set by the club');
        expect(money(99.5, 'GEL')).toBe('99.50 GEL');
    });

    it('takes the squad’s own next instalment first, overdue before due, and the last one paid', () => {
        expect(nextDue(fees, 103)?.label).toBe('Tournament entry');
        expect(nextDue(fees, 102)?.label).toBe('Training fee · U12');
        // A squad with nothing of its own falls back to the club's lines (no squad), overdue first.
        expect(nextDue(fees, 999)?.label).toBe('Kit');
        expect(nextDue(null)).toBeNull();
        expect(lastSettled(fees)?.period).toBe('October');
    });
});

describe('what waits on the parent', () => {
    it('raises a payment due within a week or overdue, and a consent or an offer, from the payload alone', () => {
        const today = new Date('2026-10-29T09:00:00');
        expect(childWaiting(child(), en, today).map(item => item.key)).toEqual(['fee-1']);
        expect(childWaiting(child({ clubs: [{ ...child().clubs[0], fees: { ...fees, dueDate: '2026-11-20' } }] }), en, today)).toEqual([]);
        const overdue = childWaiting(child({ clubs: [{ ...child().clubs[0], fees: { ...fees, status: 'OVERDUE', dueDate: '2026-10-01' } }] }), en, today);
        expect(overdue[0]).toMatchObject({ tone: 'urgent', text: 'Dinamo: a payment is overdue' });
        const consent = childWaiting(child({ clubs: [{ ...child().clubs[0], consentStatus: 'PENDING', fees: null }] }), en, today);
        expect(consent[0]).toMatchObject({ tone: 'urgent', to: '/parent?tab=connections&player=9611' });
    });

    it('counts each club the child plays for once, and reads the birth year', () => {
        const twice = child({ clubs: [child().clubs[0], { ...child().clubs[0], affiliationStatus: 'ENROLLED' }, { ...child().clubs[0], clubId: 2, affiliationStatus: 'ENDED' }] });
        expect(playingClubs(twice).map(club => club.clubId)).toEqual([1]);
        expect(birthYear(child())).toBe(2014);
    });
});

describe('a child’s page address', () => {
    it('opens an old squad-page link on the same session, the updates or the calendar', () => {
        const old = (query: string) => new URLSearchParams(query);
        expect(childPageFor(102, 9611, old('tab=sessions&sessionId=55&at=2026-11-01T07:00:00Z'))).toBe('/parent?player=9611&session=102%3A55&at=2026-11-01T07%3A00%3A00Z');
        expect(childPageFor(102, 9611, old('tab=updates'))).toBe('/parent?player=9611&view=updates');
        expect(childPageFor(102, 9611, old(''), '#squad-update-9')).toBe('/parent?player=9611&view=updates#squad-update-9');
        expect(childPageFor(102, 9611, old('tab=schedule'))).toBe('/parent?player=9611&view=calendar');
        expect(childPageFor(102, 9611, old('tab=players'))).toBe('/parent?player=9611');
    });

    it('reads a session and opens the calendar on it when it is outside this week', () => {
        expect(sessionParam('102:55')).toEqual({ squadId: 102, sessionId: 55 });
        expect(sessionParam('x')).toBeNull();
        const now = new Date('2026-10-29T12:00:00');
        expect(laterSession(new URLSearchParams('session=102:55&at=2026-10-31T07:00:00Z'), now)).toBeNull();
        expect(laterSession(new URLSearchParams('session=102:55&at=2026-11-20T07:00:00Z'), now)).toMatchObject({ squadId: 102, sessionId: 55 });
        expect(laterSession(new URLSearchParams('session=102:55'), now)).toBeNull();
    });

    it('S10: opens the club pop-up on the group a link named, by its id', () => {
        expect(childPath(9612, { view: 'calendar' })).toBe('/parent?player=9612&view=calendar');
        expect(finderPath(9612)).toBe('/parent?player=9612&find=club');
        expect(finderPath(9612, 31)).toBe('/parent?player=9612&find=club&group=31');
    });

    it('S18: an old link to one update opens the full list on it', () => {
        expect(childPageFor(102, 9611, new URLSearchParams(), '#squad-update-12')).toBe('/parent?player=9611&view=updates#squad-update-12');
        expect(childPageFor(102, 9611, new URLSearchParams('tab=updates'))).toBe('/parent?player=9611&view=updates');
    });

    it('S14 and S21: a squad’s mark has no age code, and a visit waiting for the club’s checks is reserved', () => {
        expect(squadTag('U12 Mixed')).toBe('Mixed');
        expect(squadTag('Beginners')).toBe('Beginners');
        expect(squadTag('U12')).toBe('U12');
        const permission = (allowsParticipation: boolean) => ({ required: true, allowsParticipation }) as never;
        expect(reservedVisit({ status: 'INVITED', introductionPermission: permission(false) })).toBe(true);
        expect(reservedVisit({ status: 'INVITED', introductionPermission: permission(true) })).toBe(false);
        expect(reservedVisit({ status: 'CONFIRMED', introductionPermission: permission(false) })).toBe(false);
        expect(reservedVisit({ status: 'INVITED' })).toBe(false);
    });

    it('lets a notice open a child’s page on a session, and nothing looser', () => {
        expect(safeNotificationLink('/parent?player=9611&session=102:55&at=2026-11-01T07%3A00%3A00Z')?.searchParams.get('session')).toBe('102:55');
        expect(safeNotificationLink('/parent?player=9611&view=updates')).not.toBeNull();
        expect(safeNotificationLink('/parent?player=9611&session=x:1')).toBeNull();
        expect(safeNotificationLink('/parent?player=9611&at=2026-11-01T07:00:00Z')).toBeNull();
        expect(safeNotificationLink('/parent?player=9611&view=money')).toBeNull();
        expect(safeNotificationLink('/parent?player=9611&session=102:55&view=updates')).toBeNull();
        expect(safeNotificationLink('/requests?session=102:55')).toBeNull();
        expect(safeNotificationLink('/parent?player=9611&find=club')).toBeNull();
    });
});
