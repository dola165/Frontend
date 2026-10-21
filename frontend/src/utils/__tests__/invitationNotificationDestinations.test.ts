import { describe, expect, it } from 'vitest';
import { buildNotificationDestination, notificationActionLabel } from '../notifications';
import i18n from '../../i18n';
import { safeNotificationLink } from '../notificationDestinations';
import { requestDestination } from '../../features/requests/api';
import type { NotificationItem } from '../../types/notifications';

const notice = (linkPath: string | null): NotificationItem => ({ id: 72, type: 'ORGANIZATION_INVITATION_INVITED', entityType: 'organization_invitation', entityId: 9, scope: 'PERSONAL', title: 'Synthetic invitation', body: '', createdAt: '2026-10-18T00:00:00Z', isRead: false, linkPath });

describe('organization invitation destinations', () => {
    it.each([null, '/account?tab=profile&itemId=9', '/my-organizations?itemId=9', '/invite/org-9'])('opens the existing invitation inbox for %s', path => {
        expect(buildNotificationDestination(notice(path))).toBe('/my-organizations?itemId=9');
    });
    it.each(['/account?tab=profile&itemId=10', '/my-organizations?itemId=10', '/invite/org-10', '/invite/org-9?itemId=9', '/my-organizations?itemId=9&tab=team', '/my-organizations?itemId=9&itemId=9', '/my-organizations?itemId=9#receipt', '//evil.test/my-organizations?itemId=9', '/clubs/9/workspace'])('keeps mismatched or unsafe %s on its notification receipt', path => {
        expect(buildNotificationDestination(notice(path))).toBe('/notifications?itemId=72');
    });
    it('does not confuse a notification ID, invitation ID, or unrelated entity', () => {
        expect(buildNotificationDestination({ ...notice(null), entityId: null })).toBe('/notifications?itemId=72');
        expect(buildNotificationDestination({ ...notice(null), entityType: 'other' })).toBe('/notifications?itemId=72');
    });
    it('permits the same exact receipt in notifications and requests', () => {
        expect(safeNotificationLink('/my-organizations?itemId=9')?.pathname).toBe('/my-organizations');
        expect(requestDestination('/my-organizations?itemId=9')).toBe('/my-organizations?itemId=9');
    });
    it.each(['/my-organizations', '/my-organizations?itemId=0', '/my-organizations?itemId=9007199254740992', '/my-organizations?itemId=9&itemId=10', '/my-organizations?itemId=9&tab=team', '/my-organizations?itemId=9#receipt'])('rejects malformed invitation context %s in both lists', path => {
        expect(safeNotificationLink(path)).toBeNull(); expect(requestDestination(path)).toBeNull();
    });
    it('preserves existing club and joining destinations', () => {
        expect(buildNotificationDestination({ ...notice('/clubs/1'), type: 'CLUB_INVITATION_RECEIVED', entityType: 'club_membership_invite' })).toBe('/clubs/1');
        expect(buildNotificationDestination({ ...notice('/admissions'), type: 'ADMISSION_INVITATION', entityType: 'admission_invitation' })).toBe('/admissions');
    });
});

describe('page review destinations', () => {
    const review = '12345678-abcd-4000-8000-123456789012';
    const requested = `/admin/page-reviews?review=${review}`;
    const decided = `/pages/requests/${review}`;
    const reviewNotice = (type: string, linkPath: string | null): NotificationItem => ({ ...notice(linkPath), type, entityType: 'page_review', entityId: 42 });
    it('keeps numeric delivery identities separate from UUID review receipts', () => {
        expect(buildNotificationDestination(reviewNotice('PAGE_REVIEW_REQUESTED', requested))).toBe(requested);
        expect(buildNotificationDestination(reviewNotice('PAGE_REVIEW_DECIDED', decided))).toBe(decided);
    });
    it.each([null, '/admin/page-reviews', '/admin/page-reviews?review=42', `/admin/page-reviews?review=${review}&review=${review}`, `/admin/page-reviews?review=${review}&tab=team`, `${requested}#evidence`, `/account?review=${review}`])('rejects malformed reviewer destination %s', path => {
        expect(buildNotificationDestination(reviewNotice('PAGE_REVIEW_REQUESTED', path))).toBe('/notifications?itemId=72');
    });
    it.each([`${decided}?review=${review}`, `${decided}#evidence`, '/pages/requests/42'])('rejects malformed claimant destination %s', path => {
        expect(safeNotificationLink(path)).toBeNull();
    });
    it('does not map requester updates onto admin actions or infer a UUID from a delivery ID', () => {
        expect(buildNotificationDestination(reviewNotice('PAGE_REVIEW_DECIDED', requested))).toBe('/notifications?itemId=72');
        expect(buildNotificationDestination(reviewNotice('PAGE_REVIEW_REQUESTED', decided))).toBe('/notifications?itemId=72');
        expect(buildNotificationDestination(reviewNotice('PAGE_REVIEW_DECIDED', null))).toBe('/notifications?itemId=72');
    });
});

it('uses EN/KA copy for the new invitation and review actions', async () => {
    const values = [notice(null), { ...notice(null), entityType: 'page_review', type: 'PAGE_REVIEW_REQUESTED' }, { ...notice(null), entityType: 'page_review', type: 'PAGE_REVIEW_DECIDED' }];
    try {
        await i18n.changeLanguage('en');
        expect(values.map(notificationActionLabel)).toEqual(['Review invitation', 'Review page request', 'View review outcome']);
        await i18n.changeLanguage('ka');
        expect(values.map(notificationActionLabel)).toEqual(['მოწვევის განხილვა', 'გვერდის მოთხოვნის განხილვა', 'განხილვის შედეგის ნახვა']);
    } finally { await i18n.changeLanguage('en'); }
});
