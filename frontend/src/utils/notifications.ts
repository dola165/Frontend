import type { NotificationItem, NotificationListScope, NotificationScope } from '../types/notifications';

const NOTIFICATIONS_CHANGED_EVENT = 'talanti:notifications-changed';

export const emitNotificationsChanged = () => {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
};

export const subscribeNotificationsChanged = (handler: () => void) => {
    const listener = () => handler();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
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
    const match = path.match(/^\/clubs\/(\d+)\/management(?:\?.*)?$/);
    if (!match) {
        return path;
    }

    const clubId = Number(match[1]);
    const managementTab = notification.type === 'TRYOUT_APPLICATION_RECEIVED'
        ? 'tryouts'
        : notification.type === 'CLUB_APPLICATION_RECEIVED'
            ? 'applications'
            : notification.type === 'CLUB_INVITATION_ACCEPTED' || notification.type === 'CLUB_INVITATION_DECLINED'
                ? 'invites'
                : 'personnel';

    return `/clubs/${clubId}?manageClub=1&managementTab=${managementTab}`;
};

export const buildNotificationDestination = (notification: NotificationItem) => {
    if (notification.linkPath) {
        return normalizeManagementPath(notification, notification.linkPath);
    }

    if (notification.clubId != null) {
        if (notification.type === 'TRYOUT_APPLICATION_RECEIVED') {
            return `/clubs/${notification.clubId}?manageClub=1&managementTab=tryouts`;
        }
        if (notification.type === 'CLUB_APPLICATION_RECEIVED') {
            return `/clubs/${notification.clubId}?manageClub=1&managementTab=applications`;
        }
        if (notification.type === 'CLUB_INVITATION_ACCEPTED' || notification.type === 'CLUB_INVITATION_DECLINED') {
            return `/clubs/${notification.clubId}?manageClub=1&managementTab=invites`;
        }
        if (notification.type === 'SQUAD_ASSIGNMENT' && notification.entityId != null) {
            return `/clubs/${notification.clubId}/squads?squad=${notification.entityId}`;
        }
        return `/clubs/${notification.clubId}`;
    }

    const fallbackScope: NotificationListScope = notification.scope === 'CLUB' ? 'club' : 'personal';
    const search = createNotificationSearch(fallbackScope, notification.clubId ?? null, notification.clubName ?? null);
    return search ? `/notifications?${search}` : '/notifications';
};

export const notificationActionLabel = (notification: NotificationItem) => {
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
    if (notification.linkPath || notification.clubId != null) {
        return 'Open destination';
    }
    return null;
};

export const formatNotificationTime = (timestamp: string) => {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    const diffMs = parsed.getTime() - Date.now();
    const minuteMs = 60_000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

    if (Math.abs(diffMs) < hourMs) {
        return rtf.format(Math.round(diffMs / minuteMs), 'minute');
    }
    if (Math.abs(diffMs) < dayMs) {
        return rtf.format(Math.round(diffMs / hourMs), 'hour');
    }
    if (Math.abs(diffMs) < 7 * dayMs) {
        return rtf.format(Math.round(diffMs / dayMs), 'day');
    }

    return parsed.toLocaleString(undefined, {
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
