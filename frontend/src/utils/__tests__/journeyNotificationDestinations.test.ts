import { describe, expect, it } from 'vitest';
import { safeNotificationLink } from '../notificationDestinations';
import { buildNotificationDestination } from '../notifications';
import type { NotificationItem } from '../../types/notifications';

const notification = (linkPath: string, entityType = 'match_exchange', entityId = 12): NotificationItem => ({
    id: 7, type: 'MATCH_EXCHANGE_UPDATED', scope: 'PERSONAL', clubId: null, clubName: null,
    entityType, entityId, title: 'Invitation', body: '', isRead: false, createdAt: '2026-09-20T00:00:00Z', linkPath,
});

describe('journey notification destinations', () => {
    it('opens the exact own offer and scoped officials discussion', () => {
        const offer = { ...notification('/referees/me#offer-91', 'referee_offer', 91), type: 'REFEREE_OFFER_UPDATED' };
        expect(buildNotificationDestination(offer)).toBe('/referees/me#offer-91');
        expect(buildNotificationDestination({ ...offer, linkPath: '/referees/me#offer-92' })).toBe('/notifications?itemId=7');
        expect(buildNotificationDestination({ ...notification('/match-exchange/12#coordination', 'match_coordination_message', 91), type: 'MATCH_COORDINATION_MESSAGE' })).toBe('/match-exchange/12#coordination');
    });
    it.each([
        '/agent?tab=relationships&approach=31', '/profile/12?approach=31',
        '/clubs/12/workspace?tab=club-approaches&approach=31',
        '/profile/12?representation=31', '/profile/12?representationRecord=31&representationGeneration=2',
    ])('retains exact relationship notification destinations: %s', path => {
        expect(safeNotificationLink(path)).not.toBeNull();
        expect(buildNotificationDestination({ ...notification(path, 'relationship_event', 91), type: 'CLUB_APPROACH_UPDATED' })).toBe(path);
    });
    it.each([
        '/match-exchange/12#offer-91', '/referees/me#offer-01', '/referees/me#offer-9007199254740992',
        '/referees/me#coordination', '/match-exchange/12#coordination/extra',
        '/account?approach=31', '/agent?tab=legacy&approach=31',
        '/clubs/12/workspace?tab=personnel&approach=31', '/profile/12?approach=0',
        '/profile/12?representationRecord=31', '/profile/12?representationGeneration=2',
        '/profile/12?representation=31&representationRecord=31',
        '/profile/12?representationRecord=31&representationGeneration=0',
        '/profile/12?approach=31&representation=31',
    ])('rejects misplaced or malformed relationship and officials links: %s', path => {
        expect(safeNotificationLink(path)).toBeNull();
    });
    it('keeps cancelled tryouts on account or authorized family outcomes instead of stale tryout links', () => {
        expect(buildNotificationDestination({ ...notification('/tryouts/12','tryout'), type: 'TRYOUT_CANCELLED' })).toBe('/account');
        expect(buildNotificationDestination({ ...notification('/account','tryout'), type: 'TRYOUT_CANCELLED' })).toBe('/account');
        expect(buildNotificationDestination({ ...notification('/parent','tryout'), type: 'TRYOUT_CANCELLED' })).toBe('/parent');
    });
    it.each(['/match-exchange/12#appointment-91', '/referees/me#appointment-91', '/referees/me#availability'])('accepts a precise appointment destination: %s', path => {
        const result = safeNotificationLink(path);
        expect(result?.pathname + (result?.hash ?? '')).toBe(path);
    });
    it('retains the appointment anchor while validating the match identity', () => {
        expect(buildNotificationDestination(notification('/match-exchange/12#appointment-91'))).toBe('/match-exchange/12#appointment-91');
        expect(buildNotificationDestination(notification('/match-exchange/13#appointment-91'))).toBe('/notifications?itemId=7');
    });
    it.each(['0', '-1', '1.5', '01', '9007199254740992', '91#extra', '91/extra'])('rejects an invalid appointment identity: %s', id => {
        expect(safeNotificationLink(`/match-exchange/12#appointment-${id}`)).toBeNull();
        expect(safeNotificationLink(`/referees/me#appointment-${id}`)).toBeNull();
    });
    it.each(['2026-09-22T14:00:00Z', '2026-09-22T14:00:00.123Z', '2026-09-22T14:00:00.123456789Z'])('preserves authorized session navigation hints: %s', at => {
        const path = `/squads/11?tab=sessions&sessionId=9&at=${encodeURIComponent(at)}`;
        const result = safeNotificationLink(path);
        expect(result?.searchParams.get('at')).toBe(at);
        expect(buildNotificationDestination({...notification(path, 'squad', 11), type: 'SQUAD_SESSION_UPDATED'})).toBe(path);
    });
    it('retains the generic removed-invitation destination', () => {
        expect(safeNotificationLink('/squads/11?tab=sessions')?.search).toBe('?tab=sessions');
    });
    it.each([
        '/squads/11?tab=sessions&sessionId=9',
        '/squads/11?tab=sessions&at=2026-09-22T14:00:00Z',
        '/squads/11?tab=chat&sessionId=9&at=2026-09-22T14:00:00Z',
        '/calendar?tab=sessions&sessionId=9&at=2026-09-22T14:00:00Z',
        '/squads/11?tab=sessions&sessionId=9007199254740992&at=2026-09-22T14:00:00Z',
        '/squads/11?tab=sessions&sessionId=9&at=2026-02-30T14:00:00Z',
        '/squads/11?tab=sessions&sessionId=9&at=2026-09-22T25:00:00Z',
        '/squads/11?tab=sessions&sessionId=9&at=2026-09-22T14:00:00Z&at=2026-09-23T14:00:00Z',
        '/squads/11?tab=sessions&sessionId=9&at=2026-09-22T14:00:00Z&thread=2',
        '/match-exchange/12#availability', '/referees/me?tab=history#appointment-91',
        '/profile/12#appointment-91',
    ])('rejects malformed or misplaced hints: %s', path => expect(safeNotificationLink(path)).toBeNull());
});
