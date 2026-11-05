import { describe, expect, it } from 'vitest';
import { safeNotificationLink } from '../notificationDestinations';
import { buildNotificationDestination } from '../notifications';
import type { NotificationItem } from '../../types/notifications';

const notice = (type: string, linkPath: string | null, entityType = 'squad', entityId = 12): NotificationItem => ({
    id: 7, type, scope: 'PERSONAL', clubId: null, clubName: null,
    entityType, entityId, title: 'Notice', body: '', isRead: false, createdAt: '2026-11-03T00:00:00Z', linkPath,
});

/** Step 2, M11: every notice opens its record, never "A separate detail view is not available here". */
describe('notices open their records', () => {
    it.each([
        ['/my-squads', '/my-squads'],
        ['/team-work?task=41', '/team-work?task=41'],
        ['/team-work?task=41&step=42', '/team-work?task=41&step=42'],
        ['/team-work?who=8', '/team-work?who=8'],
        ['/calendar?journey=3&journeyChild=4&date=2026-11-04', '/calendar?journey=3&journeyChild=4&date=2026-11-04'],
        ['/calendar?eventId=9#result', '/calendar?eventId=9#result'],
        ['/referees/me?competitionAppointment=7', '/referees/me?competitionAppointment=7'],
        ['/projects/12', '/projects/12'],
        ['/merge/5', '/merge/5'],
        ['/staff-invite/AbC123xy', '/staff-invite/AbC123xy'],
        ['/family-link/AbC123xy', '/family-link/AbC123xy'],
        ['/me/staff-club', '/me/staff-club'],
        ['/admin?tab=admissions', '/admin?tab=admissions'],
        ['/', '/home'],
    ])('opens %s', (path, expected) => {
        const url = safeNotificationLink(path);
        expect(url).not.toBeNull();
        expect(url!.pathname + url!.search + url!.hash).toBe(expected);
    });

    it.each([
        '/home?x=1', '/my-squads#top', '/calendar?task=4', '/team-work?journey=3', '/calendar?journey=3&date=tomorrow',
        '/referees/me?competitionAppointment=0', '/referees/me?competitionAppointment=7&tab=x', '/admin?tab=x&player=1',
        '/staff-invite/a', '/projects/0', '/calendar#result',
    ])('still refuses %s', path => {
        expect(safeNotificationLink(path)).toBeNull();
    });

    it('opens a squad placement on the squad or the child, and keeps old Account-only ones as the update', () => {
        expect(buildNotificationDestination(notice('SQUAD_ASSIGNMENT', '/squads/12'))).toBe('/squads/12');
        expect(buildNotificationDestination(notice('SQUAD_ASSIGNMENT', '/parent?player=5'))).toBe('/parent?player=5');
        expect(buildNotificationDestination(notice('SQUAD_REMOVAL', '/parent?player=5'))).toBe('/parent?player=5');
        expect(buildNotificationDestination(notice('SQUAD_HEAD_COACH', '/squads/12'))).toBe('/squads/12');
        expect(buildNotificationDestination(notice('SQUAD_ASSIGNMENT', '/account'))).toBe('/requests?view=updates&itemId=7');
    });

    it('S5: opens a squad\'s joining requests on its players tab, and nowhere else', () => {
        expect(buildNotificationDestination(notice('SQUAD_JOIN_REQUESTS', '/squads/12?tab=players&invite=1', 'squad', 12)))
            .toBe('/squads/12?tab=players&invite=1');
        for (const path of ['/squads/12?invite=1', '/squads/12?tab=chat&invite=1', '/squads/12?tab=players&invite=2',
            '/parent?invite=1', '/clubs/3?tab=players&invite=1', '/squads/12?tab=players&invite=1&sessionId=4'])
            expect(safeNotificationLink(path)).toBeNull();
    });

    it('S6: opens a club-calendar match\'s result on the calendar', () => {
        const family = { ...notice('MATCH_RESULT', '/calendar?eventId=44#result', 'match_result', 44), eventId: 44 } as NotificationItem;
        expect(buildNotificationDestination(family)).toBe('/calendar?eventId=44#result');
        const staff = { ...notice('SCHEDULE_EVENT_UPDATED', '/calendar?eventId=44#result', 'match_result', 9), eventId: 44 } as NotificationItem;
        expect(buildNotificationDestination(staff)).toBe('/calendar?eventId=44#result');
        expect(buildNotificationDestination({ ...family, eventId: 45 } as NotificationItem)).toBe('/requests?view=updates&itemId=7');
        expect(buildNotificationDestination({ ...family, linkPath: '/calendar?eventId=44' })).toBe('/requests?view=updates&itemId=7');
    });

    it('opens a family\'s result on the match and a club invitation in Requests', () => {
        const result = { ...notice('MATCH_RESULT', '/matches/44#result', 'match_result', 44), eventId: 44 } as NotificationItem;
        expect(buildNotificationDestination(result)).toBe('/matches/44#result');
        expect(buildNotificationDestination(notice('CLUB_INVITATION_RECEIVED', '/requests?view=needs-you', 'club_membership_invite', 3)))
            .toBe('/requests?view=needs-you');
    });
});
