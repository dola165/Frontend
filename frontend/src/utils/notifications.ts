import { appLocale, formatDate } from './formatting';
import type { NotificationItem, NotificationListScope, NotificationScope } from '../types/notifications';
import { notificationId, safeNotificationLink, venueBookingDestination } from './notificationDestinations';

const NOTIFICATIONS_CHANGED_EVENT = 'talanti:notifications-changed';

interface NotificationsChange {
    allRead?: boolean;
}

export const emitNotificationsChanged = (change?: NotificationsChange) => {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: change }));
};

let subscribers = 0;
let refreshTimer: number | undefined;
const refreshVisibleNotifications = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) emitNotificationsChanged();
};

export const subscribeNotificationsChanged = (handler: (change?: NotificationsChange) => void) => {
    const listener = (event: Event) => handler((event as CustomEvent<NotificationsChange>).detail);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
    if (subscribers++ === 0) {
        refreshTimer = window.setInterval(refreshVisibleNotifications, 5_000);
        window.addEventListener('focus', refreshVisibleNotifications);
        window.addEventListener('online', refreshVisibleNotifications);
        document.addEventListener('visibilitychange', refreshVisibleNotifications);
    }
    let subscribed = true;
    return () => {
        if (!subscribed) return;
        subscribed = false;
        window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
        if (--subscribers === 0) {
            window.clearInterval(refreshTimer);
            window.removeEventListener('focus', refreshVisibleNotifications);
            window.removeEventListener('online', refreshVisibleNotifications);
            document.removeEventListener('visibilitychange', refreshVisibleNotifications);
        }
    };
};

const parsePositiveNumber = (value?: string | null) => {
    if (!value) {
        return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const normalizeNotificationListScope = (value?: string | null): NotificationListScope => {
    if (value === 'personal' || value === 'club') {
        return value;
    }
    return 'all';
};

export const readNotificationFilterFromSearchParams = (searchParams: URLSearchParams) => {
    const rawScope = normalizeNotificationListScope(searchParams.get('scope'));
    const clubId = parsePositiveNumber(searchParams.get('clubId'));
    const scope = clubId != null && rawScope === 'all' ? 'club' : rawScope;

    if (scope !== 'club') {
        return {
            scope,
            clubId: null,
            clubName: null as string | null
        };
    }

    const clubName = searchParams.get('clubName');
    return {
        scope,
        clubId,
        clubName: clubName && clubName.trim() ? clubName.trim() : null
    };
};

export const createNotificationSearch = (
    scope: NotificationListScope,
    clubId?: number | null,
    clubName?: string | null
) => {
    const params = new URLSearchParams();

    if (scope !== 'all') {
        params.set('scope', scope);
    }
    if (scope === 'club' && clubId != null) {
        params.set('clubId', String(clubId));
        if (clubName && clubName.trim()) {
            params.set('clubName', clubName.trim());
        }
    }

    return params.toString();
};

export const notificationScopeLabel = (scope: NotificationScope) => (
    scope === 'CLUB' ? 'Club' : 'Personal'
);

const normalizeManagementPath = (notification: NotificationItem, path: string) => {
    // Phase 2 §4.5: legacy management paths route to the workspace tab — the
    // manage-club modal ignores managementTab, while the workspace re-syncs ?tab=.
    const workspaceTabFor = (type: string) => {
        switch (type) {
            case 'TRYOUT_APPLICATION_RECEIVED': return 'tryouts';
            case 'CLUB_APPLICATION_RECEIVED': return 'applications';
            case 'CLUB_INVITATION_ACCEPTED':
            case 'CLUB_INVITATION_DECLINED': return 'invites';
            case 'TRIALIST_OVERDUE': return 'players';
            default: return 'personnel';
        }
    };

    // Aug 17 (P2.5): the pre-Phase-2 link format /clubs/{id}?manageClub=1&managementTab=X
    // exists on rows written before the workspace-tab migration — rewrite it too.
    const legacyQueryMatch = path.match(/^\/clubs\/(\d+)\?manageClub=1&managementTab=([a-z]+)$/);
    if (legacyQueryMatch) {
        const tab = legacyQueryMatch[2] === 'players' ? 'players' : workspaceTabFor(notification.type);
        return `/clubs/${Number(legacyQueryMatch[1])}/workspace?tab=${tab}`;
    }

    const match = path.match(/^\/clubs\/(\d+)\/management(?:\?.*)?$/);
    if (!match) {
        return path;
    }

    return `/clubs/${Number(match[1])}/workspace?tab=${workspaceTabFor(notification.type)}`;
};

export const buildNotificationDestination = (notification: NotificationItem) => {
    const outcome = `/notifications?itemId=${notification.id}`;
    const entityId = notificationId(notification.entityId);
    const link = safeNotificationLink(notification.linkPath);
    const path = link ? link.pathname + link.search + link.hash : null;
    if (notification.entityType === 'admission_case' || notification.entityType === 'admission_inquiry') {
        if (!entityId) return outcome;
        const kind = notification.entityType === 'admission_case' ? 'cases' : 'inquiries';
        const queryKey = kind === 'cases' ? 'caseId' : 'inquiryId';
        const direct = link?.pathname === `/admissions/${kind}/${entityId}`;
        const club = link?.pathname.match(/^\/clubs\/([1-9]\d*)\/workspace$/)?.[1];
        const intake = club && link?.searchParams.get('tab') === 'admissions' && link.searchParams.get(queryKey) === entityId
            && (notification.clubId == null || notificationId(notification.clubId) === club);
        const conversation = kind === 'inquiries' && link?.pathname === '/messages' && !link.hash
            && Array.from(link.searchParams.keys()).length === 1 && notificationId(link.searchParams.get('conversationId'));
        return direct || intake || conversation ? path! : notification.linkPath == null ? `/admissions/${kind}/${entityId}` : outcome;
    }
    if (notification.entityType === 'admission_invitation') return entityId && (notification.linkPath == null || path === '/admissions') ? '/admissions' : outcome;
    if (notification.entityType === 'admission_governance') return entityId && (path === '/admissions' || path === '/parent') ? `${path}?player=${entityId}` : outcome;
    if (notification.type === 'CLUB_PERMISSION_REQUEST') {
        return notification.entityType === 'club_operation' && entityId
            ? `/club-operations?permissionId=${entityId}` : outcome;
    }
    if (notification.type === 'CLUB_STAFF_APPOINTMENT') {
        return notification.entityType === 'club_staff_appointment' && entityId
            ? `/club-operations?appointmentId=${entityId}` : outcome;
    }
    if (notification.entityType === 'match_result' || notification.entityType === 'match_result_suggestion') {
        const match = link?.pathname.match(/^\/match-exchange\/([1-9]\d*)$/);
        const eventId = notificationId(notification.eventId);
        return entityId && match && (notification.eventId == null || eventId === match[1]) && link?.hash === '#result' ? path! : outcome;
    }
    if (notification.type === 'REFEREE_OFFER_UPDATED' || notification.entityType === 'referee_offer') {
        return notification.entityType === 'referee_offer' && entityId && link?.pathname === '/referees/me'
            && link.hash === `#offer-${entityId}` ? path! : outcome;
    }
    if (notification.type === 'MATCH_COORDINATION_MESSAGE' || notification.entityType === 'match_coordination_message') {
        // This entity identifies a message, while the destination identifies its match.
        return notification.entityType === 'match_coordination_message' && entityId
            && link?.pathname.startsWith('/match-exchange/') && link.hash === '#coordination' ? path! : outcome;
    }
    // Explicit Match Exchange intent precedes the legacy broad SCHEDULE_* mapping.
    if (notification.type === 'MATCH_EXCHANGE_UPDATED' || notification.entityType === 'match_exchange'
        || notification.linkPath?.startsWith('/match-exchange')) {
        if (notification.linkPath != null) {
            const match = link?.pathname.match(/^\/match-exchange\/([1-9]\d*)$/);
            return match && (entityId == null ? notification.entityId == null : match[1] === entityId) ? path! : outcome;
        }
        return notification.entityType === 'match_exchange' && entityId ? `/match-exchange/${entityId}` : outcome;
    }
    if (notification.type.startsWith('VENUE_BOOKING_') || notification.entityType === 'venue_booking') {
        if (!link) return outcome;
        const venueId = link.pathname.match(/^\/stadiums\/([1-9]\d*)(?:\/manage)?$/)?.[1]
            ?? (link.pathname === '/notifications' ? link.searchParams.get('venueId') : null);
        const linkedBooking = link.searchParams.get('bookingId');
        if (!venueId || (notification.entityId != null && !entityId) || (entityId && linkedBooking && entityId !== linkedBooking)) return outcome;
        const bookingId = linkedBooking ?? entityId;
        return bookingId ? venueBookingDestination(venueId, bookingId) : outcome;
    }
    if (notification.entityType === 'squad' && link) {
        const squadId = link.pathname.match(/^\/squads\/([1-9]\d*)$/)?.[1] ?? link.searchParams.get('squadId');
        if (squadId && notification.entityId != null && squadId !== entityId) return outcome;
    }
    if (['NEW_MESSAGE', 'MATCH_CHALLENGE_CHAT_READY'].includes(notification.type) && notification.entityType === 'conversation') {
        return entityId ? `/messages?conversationId=${entityId}` : outcome;
    }
    // P1 W6 (audit H7): schedule events/challenges live on /calendar. The web
    // app has no /clubs/{id}/schedule route, so any schedule-type notification
    // (including stale rows written before the backend fix) lands there.
    if (notification.type.startsWith('SCHEDULE_EVENT_') || notification.type.startsWith('SCHEDULE_CHALLENGE_')) {
        return notification.entityType === 'schedule_event' && entityId != null
            ? `/calendar?eventId=${entityId}` : outcome;
    }

    if (notification.type === 'TRYOUT_CANCELLED') return notification.linkPath === '/parent' ? '/parent' : '/account';

    if (notification.type === 'CLUB_DISSOLVED'
        || notification.type.startsWith('TRYOUT_APPLICATION_') && notification.type !== 'TRYOUT_APPLICATION_RECEIVED'
        || ['CLUB_APPLICATION_ACCEPTED', 'CLUB_APPLICATION_DECLINED', 'MEMBERSHIP_ENDED', 'SQUAD_ASSIGNMENT', 'CLUB_ROLE_CHANGED'].includes(notification.type)) return outcome;

    if (notification.type === 'CLUB_ANNOUNCEMENT' && notification.entityType === 'post' && entityId != null) return `/posts/${entityId}`;

    if (notificationId(notification.clubId) != null && entityId != null
        && ((notification.type === 'CLUB_APPLICATION_RECEIVED' && notification.entityType === 'club_membership_application')
            || (notification.type === 'TRYOUT_APPLICATION_RECEIVED' && notification.entityType === 'tryout_application'))) {
        const tab = notification.type === 'CLUB_APPLICATION_RECEIVED' ? 'applications' : 'tryouts';
        return `/clubs/${notification.clubId}/workspace?tab=${tab}&applicationId=${entityId}`;
    }

    // P1 W4/W6: the player-journey membership notifications land on /account
    // (journey panel). Explicit mappings also override stale linkPaths.
    if (notification.type === 'CLUB_MEMBERSHIP_ACTIVATED' || notification.type === 'TRIAL_ENDED') {
        return '/account';
    }

    // Legacy agent notifications remain readable while the feature is frozen,
    // but cannot reopen the retired workspace or API surface.
    if (notification.type === 'AGENT_ENGAGEMENT_RECEIVED'
        || notification.type === 'MARKETPLACE_LISTING_CREATED') {
        return '/notifications';
    }

    if (notification.linkPath) {
        if (!path) return outcome;
        return normalizeManagementPath(notification, path.replace(/^(\/tournaments\/[1-9]\d*)\/admin(?=[?#]|$)/, '$1/workspace'));
    }

    if (notification.clubId != null) {
        // Phase 2 §4.5: club-management notifications land on the workspace tab.
        if (notification.type === 'TRYOUT_APPLICATION_RECEIVED') {
            return `/clubs/${notification.clubId}/workspace?tab=tryouts`;
        }
        if (notification.type === 'CLUB_APPLICATION_RECEIVED') {
            return `/clubs/${notification.clubId}/workspace?tab=applications`;
        }
        if (notification.type === 'CLUB_INVITATION_ACCEPTED' || notification.type === 'CLUB_INVITATION_DECLINED') {
            return `/clubs/${notification.clubId}/workspace?tab=invites`;
        }
        if (notification.type === 'SQUAD_ASSIGNMENT' && notification.entityId != null) {
            return `/clubs/${notification.clubId}/squads?squad=${notification.entityId}`;
        }
        return `/clubs/${notification.clubId}`;
    }

    const fallbackScope: NotificationListScope = notification.scope === 'CLUB' ? 'club' : 'personal';
    // Aug 17 (P2.5): a club-scoped item without a club id cannot land on a
    // meaningful club filter — plain notifications list instead of ?scope=club.
    if (fallbackScope === 'club' && notification.clubId == null) {
        return '/notifications';
    }
    const search = createNotificationSearch(fallbackScope, notification.clubId ?? null, notification.clubName ?? null);
    return search ? `/notifications?${search}` : '/notifications';
};

export const notificationActionLabel = (notification: NotificationItem) => {
    if (notification.entityType === 'admission_case') return 'View next step';
    if (notification.entityType === 'admission_inquiry') return 'Open club conversation';
    if (notification.entityType === 'admission_invitation') return 'Review joining invitation';
    if (notification.type === 'CLUB_PERMISSION_REQUEST') return 'Review permission';
    if (notification.type === 'CLUB_STAFF_APPOINTMENT') return 'Review appointment';
    if (notification.type === 'MATCH_EXCHANGE_UPDATED' || notification.linkPath?.startsWith('/match-exchange/')) return 'View match';
    if (notification.type.startsWith('VENUE_BOOKING_')) return 'View reservation';
    if (notification.type.startsWith('SCHEDULE_')) return 'View event';
    if (notification.type === 'CLUB_DISSOLVED' || notification.type === 'MEMBERSHIP_ENDED'
        || notification.type === 'SQUAD_ASSIGNMENT' || notification.type === 'CLUB_ROLE_CHANGED'
        || notification.type.startsWith('TRYOUT_APPLICATION_') && notification.type !== 'TRYOUT_APPLICATION_RECEIVED'
        || ['CLUB_APPLICATION_ACCEPTED', 'CLUB_APPLICATION_DECLINED'].includes(notification.type)) return 'View update';
    if (notification.type === 'CLUB_APPLICATION_RECEIVED') {
        return 'Review applications';
    }
    if (notification.type === 'TRYOUT_APPLICATION_RECEIVED') {
        return 'Review tryouts';
    }
    if (notification.type === 'CLUB_INVITATION_RECEIVED') {
        return 'Open invitation';
    }
    if (notification.type === 'CLUB_INVITATION_ACCEPTED' || notification.type === 'CLUB_INVITATION_DECLINED') {
        return 'Open invite log';
    }
    if (notification.type === 'SQUAD_ASSIGNMENT') {
        return 'Open squad';
    }
    if (notification.type === 'CLUB_CHALLENGE_RECEIVED') {
        return 'Open club';
    }
    if (notification.type === 'AGENT_ENGAGEMENT_RECEIVED'
        || notification.type === 'MARKETPLACE_LISTING_CREATED') {
        return null;
    }
    if (notification.linkPath || notification.clubId != null) {
        return 'Open destination';
    }
    return null;
};

export const formatNotificationTime = (timestamp: string) => {
    // Notification rows are stored in UTC; older API responses omit the offset.
    const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(timestamp) ? `${timestamp}Z` : timestamp;
    const parsed = new Date(utc);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    const diffMs = parsed.getTime() - Date.now();
    const minuteMs = 60_000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    const rtf = new Intl.RelativeTimeFormat(appLocale(), { numeric: 'auto' });

    if (Math.abs(diffMs) < hourMs) {
        return rtf.format(Math.round(diffMs / minuteMs), 'minute');
    }
    if (Math.abs(diffMs) < dayMs) {
        return rtf.format(Math.round(diffMs / hourMs), 'hour');
    }
    if (Math.abs(diffMs) < 7 * dayMs) {
        return rtf.format(Math.round(diffMs / dayMs), 'day');
    }

    return formatDate(parsed, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
};

export const notificationTypeLabel = (type: string) =>
    type
        .toLowerCase()
        .split('_')
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join(' ');
