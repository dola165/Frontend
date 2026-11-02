import { describe, expect, it } from 'vitest';
import { isJobDestination, safeNotificationLink } from '../notificationDestinations';
import { buildNotificationDestination } from '../notifications';
import { requestDestination } from '../../features/requests/api';
import type { NotificationItem } from '../../types/notifications';
import fixtures from './notification-job-destinations.json';

const notification: NotificationItem = { id: 2, type: 'PUBLIC_JOB_RESPONSE', entityType: 'public_job_response', entityId: 30, scope: 'PERSONAL', title: 'Work response update', body: 'A work response was updated.', isRead: false, createdAt: '2026-10-30T12:00:00Z' };

describe('shared Jobs destination contract', () => {
    it.each(fixtures)('$path → $allowed', ({ path, allowed }) => {
        expect(isJobDestination(path)).toBe(allowed);
        expect(safeNotificationLink(path) !== null).toBe(allowed);
        expect(requestDestination(path)).toBe(allowed ? path : null);
        expect(buildNotificationDestination({ ...notification, linkPath: path })).toBe(allowed ? path : '/requests?view=updates&itemId=2');
    });
    it('requires the typed response identity and never treats its id as a listing id', () => {
        expect(buildNotificationDestination({ ...notification, linkPath: '/jobs/101' })).toBe('/jobs/101');
        for (const bad of [{ entityType: 'post' }, { type: 'OTHER' }, { entityId: 0 }, { entityId: null }, { entityId: Number.MAX_SAFE_INTEGER + 1 }]) {
            expect(buildNotificationDestination({ ...notification, ...bad, linkPath: '/jobs/101' })).toBe('/requests?view=updates&itemId=2');
        }
        expect(buildNotificationDestination({ ...notification, linkPath: null })).toBe('/requests?view=updates&itemId=2');
    });
});
