import { describe, it, expect } from 'vitest';
import { buildNotificationDestination } from '../notifications';
import type { NotificationItem } from '../../types/notifications';

const notification = (overrides: Partial<NotificationItem>): NotificationItem => ({
    id: 1,
    type: 'CLUB_APPLICATION_RECEIVED',
    scope: 'CLUB',
    clubId: null,
    clubName: null,
    entityType: null,
    entityId: null,
    title: 'New application',
    body: 'Someone applied.',
    isRead: false,
    createdAt: new Date().toISOString(),
    linkPath: null,
    ...overrides
});

describe('buildNotificationDestination — Aug 17 deep-link audit (P2.5)', () => {
    it('rewrites the legacy ?manageClub=1&managementTab= query format to a workspace tab', () => {
        const destination = buildNotificationDestination(notification({
            type: 'CLUB_APPLICATION_RECEIVED',
            linkPath: '/clubs/125?manageClub=1&managementTab=applications'
        }));
        expect(destination).toBe('/clubs/125/workspace?tab=applications');
    });

    it('rewrites the legacy management path format to a workspace tab', () => {
        const destination = buildNotificationDestination(notification({
            type: 'CLUB_INVITATION_ACCEPTED',
            linkPath: '/clubs/125/management?tab=invites'
        }));
        expect(destination).toBe('/clubs/125/workspace?tab=invites');
    });

    it('passes the new workspace linkPath format through untouched', () => {
        const destination = buildNotificationDestination(notification({
            type: 'TRYOUT_APPLICATION_RECEIVED',
            linkPath: '/clubs/126/workspace?tab=tryouts'
        }));
        expect(destination).toBe('/clubs/126/workspace?tab=tryouts');
    });

    it('maps TRIALIST_OVERDUE legacy links to the players tab', () => {
        const destination = buildNotificationDestination(notification({
            type: 'TRIALIST_OVERDUE',
            linkPath: '/clubs/7?manageClub=1&managementTab=players'
        }));
        expect(destination).toBe('/clubs/7/workspace?tab=players');
    });

    it('lands a club-scoped notification without a club id on the plain list', () => {
        const destination = buildNotificationDestination(notification({
            type: 'CLUB_APPLICATION_RECEIVED',
            scope: 'CLUB',
            clubId: null,
            linkPath: null
        }));
        expect(destination).toBe('/notifications');
    });

    it('keeps the club filter when a club id exists', () => {
        const destination = buildNotificationDestination(notification({
            type: 'CLUB_ANNOUNCEMENT',
            scope: 'CLUB',
            clubId: 42,
            clubName: 'Creekside FC',
            linkPath: null
        }));
        expect(destination).toBe('/clubs/42');
    });

    it('uses the type-based workspace mapping when no linkPath is present', () => {
        const destination = buildNotificationDestination(notification({
            type: 'TRYOUT_APPLICATION_RECEIVED',
            clubId: 3,
            linkPath: null
        }));
        expect(destination).toBe('/clubs/3/workspace?tab=tryouts');
    });
});
