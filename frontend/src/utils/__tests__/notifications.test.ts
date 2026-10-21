import { describe, it, expect } from 'vitest';
import { buildNotificationDestination, notificationActionLabel } from '../notifications';
import type { NotificationItem } from '../../types/notifications';
import destinations from './notification-destinations.json';

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

describe('web / Android destination contract', () => {
    it('recovers old permission and appointment notifications using their typed identity', () => {
        expect(buildNotificationDestination(notification({type:'CLUB_PERMISSION_REQUEST',entityType:'club_operation',entityId:8,linkPath:'/club-operations'}))).toBe('/club-operations?permissionId=8');
        expect(notificationActionLabel(notification({type:'CLUB_PERMISSION_REQUEST'}))).toBe('Review permission');
        expect(buildNotificationDestination(notification({type:'CLUB_STAFF_APPOINTMENT',entityType:'club_staff_appointment',entityId:7,linkPath:'/club-operations'}))).toBe('/club-operations?appointmentId=7');
        expect(buildNotificationDestination(notification({type:'CLUB_PERMISSION_REQUEST',entityType:'post',entityId:8}))).toBe('/notifications?itemId=1');
        expect(buildNotificationDestination(notification({type:'CLUB_PERMISSION_REQUEST',entityType:'club_operation',entityId:0}))).toBe('/notifications?itemId=1');
    });
    it.each(destinations)('$name', ({ notification: input, expected }) => {
        expect(buildNotificationDestination(notification(input as Partial<NotificationItem>))).toBe(expected);
    });
});

describe('buildNotificationDestination — Aug 17 deep-link audit (P2.5)', () => {
    it('selects the exact application using typed identity instead of a stale destination', () => {
        expect(buildNotificationDestination(notification({ type: 'CLUB_APPLICATION_RECEIVED', clubId: 5, entityType: 'club_membership_application', entityId: 81, linkPath: '/account' })))
            .toBe('/clubs/5/workspace?tab=applications&applicationId=81');
        expect(buildNotificationDestination(notification({ type: 'TRYOUT_APPLICATION_RECEIVED', clubId: 5, entityType: 'tryout_application', entityId: 82 })))
            .toBe('/clubs/5/workspace?tab=tryouts&applicationId=82');
    });
    it('shows a recorded outcome when a schedule identity is missing or has the wrong type', () => {
        expect(buildNotificationDestination(notification({ type: 'SCHEDULE_EVENT_CANCELLED', entityType: 'post', entityId: 42 }))).toBe('/notifications?itemId=1');
        expect(buildNotificationDestination(notification({ type: 'SCHEDULE_EVENT_CANCELLED' }))).toBe('/notifications?itemId=1');
    });
    it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example', 'javascript:alert(1)'])('rejects unsafe stored destinations: %s', linkPath => {
        expect(buildNotificationDestination(notification({ type: 'OTHER', linkPath }))).toBe('/notifications?itemId=1');
    });
    it('opens the exact announcement post and the recorded closure outcome', () => {
        expect(buildNotificationDestination(notification({ type: 'CLUB_ANNOUNCEMENT', entityType: 'post', entityId: 91, linkPath: '/clubs/5' }))).toBe('/posts/91');
        expect(buildNotificationDestination(notification({ type: 'CLUB_DISSOLVED', entityType: 'club', entityId: 5, linkPath: '/clubs' }))).toBe('/notifications?itemId=1');
    });
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

    it('contains legacy agent engagement notifications on the notifications page', () => {
        const destination = buildNotificationDestination(notification({
            type: 'AGENT_ENGAGEMENT_RECEIVED',
            clubId: 42,
            linkPath: '/clubs/42/workspace?tab=inbox',
        }));
        expect(destination).toBe('/notifications');
    });

    it('does not offer an action into the frozen agent feature', () => {
        expect(notificationActionLabel(notification({
            type: 'AGENT_ENGAGEMENT_RECEIVED',
            clubId: 42,
        }))).toBeNull();
        expect(buildNotificationDestination(notification({
            type: 'MARKETPLACE_LISTING_CREATED',
            linkPath: '/marketplace',
        }))).toBe('/notifications');
        expect(notificationActionLabel(notification({
            type: 'MARKETPLACE_LISTING_CREATED',
            linkPath: '/marketplace',
        }))).toBeNull();
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

describe('buildNotificationDestination — P1 W6 deep-link sweep (H7 + W4 types)', () => {
    it('routes every SCHEDULE_EVENT_* type to /calendar, overriding stale club-schedule links', () => {
        for (const type of ['SCHEDULE_EVENT_CREATED', 'SCHEDULE_EVENT_UPDATED', 'SCHEDULE_EVENT_PUBLISHED']) {
            expect(buildNotificationDestination(notification({
                type,
                scope: 'CLUB',
                clubId: 7,
                entityType: 'schedule_event', entityId: 21, linkPath: '/clubs/7/schedule'
            }))).toBe('/calendar?eventId=21');
        }
    });

    it('routes every SCHEDULE_CHALLENGE_* type to /calendar even without a linkPath', () => {
        for (const type of ['SCHEDULE_CHALLENGE_RECEIVED', 'SCHEDULE_CHALLENGE_ACCEPTED', 'SCHEDULE_CHALLENGE_REJECTED']) {
            expect(buildNotificationDestination(notification({
                type,
                scope: 'CLUB',
                clubId: 9, entityType: 'schedule_event', entityId: 21,
                linkPath: null
            }))).toBe('/calendar?eventId=21');
        }
    });

    it('routes CLUB_MEMBERSHIP_ACTIVATED to /account (player journey), overriding a stale club link', () => {
        expect(buildNotificationDestination(notification({
            type: 'CLUB_MEMBERSHIP_ACTIVATED',
            scope: 'PERSONAL',
            clubId: 4,
            linkPath: '/clubs/4'
        }))).toBe('/account');
    });

    it('routes TRIAL_ENDED to /account even without a linkPath', () => {
        expect(buildNotificationDestination(notification({
            type: 'TRIAL_ENDED',
            scope: 'PERSONAL',
            clubId: 4,
            linkPath: null
        }))).toBe('/account');
    });

    it('keeps the review-marked-valid club workspace mappings intact', () => {
        expect(buildNotificationDestination(notification({
            type: 'CLUB_APPLICATION_RECEIVED',
            clubId: 3,
            linkPath: null
        }))).toBe('/clubs/3/workspace?tab=applications');
        expect(buildNotificationDestination(notification({
            type: 'CLUB_INVITATION_DECLINED',
            clubId: 5,
            linkPath: null
        }))).toBe('/clubs/5/workspace?tab=invites');
        expect(buildNotificationDestination(notification({
            type: 'SQUAD_ASSIGNMENT',
            clubId: 6,
            entityId: 12,
            linkPath: null
        }))).toBe('/notifications?itemId=1');
    });
});
