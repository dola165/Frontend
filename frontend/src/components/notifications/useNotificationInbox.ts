import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNotifications, fetchUnreadNotificationCount, markAllNotificationsAsRead, markNotificationAsRead } from '../../api/notifications';
import { useAuth } from '../../context/AuthContext';
import type { NotificationItem, NotificationListScope } from '../../types/notifications';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { emitNotificationsChanged, subscribeNotificationsChanged } from '../../utils/notifications';

const PAGE_SIZE = 20;
type Filter = { scope: NotificationListScope; clubId: number | null };
type Counts = Record<NotificationListScope, number | null>;
const unknownCounts = (): Counts => ({ all: null, personal: null, club: null });

/** Mounted with a key for the login and filter. Every mutation reads back real state. */
export function useNotificationInbox(filter: Filter) {
    const { sessionId } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [totalElements, setTotalElements] = useState(0);
    const [unreadCount, setUnreadCount] = useState<number | null>(null);
    const [scopeCounts, setScopeCounts] = useState<Counts>(unknownCounts);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [markingAll, setMarkingAll] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const mounted = useRef(false), pending = useRef(false), refreshing = useRef(false);
    const controller = useRef<AbortController | null>(null);
    const generation = useRef(0), pages = useRef(1);
    const current = useCallback(() => mounted.current && isCurrentAuthSession(sessionId), [sessionId]);

    const refresh = useCallback(async () => {
        if (!current()) return;
        const revision = ++generation.current;
        refreshing.current = true;
        const config = { _authSessionId: sessionId, signal: controller.current?.signal };
        try {
            const [results, all, personal, club, selected] = await Promise.all([
                Promise.all(Array.from({ length: pages.current }, (_, page) => fetchNotifications({ page, size: PAGE_SIZE, scope: filter.scope, clubId: filter.clubId }, config))),
                fetchUnreadNotificationCount({}, config),
                fetchUnreadNotificationCount({ scope: 'personal' }, config),
                fetchUnreadNotificationCount({ scope: 'club' }, config),
                filter.clubId == null ? Promise.resolve(null) : fetchUnreadNotificationCount({ scope: filter.scope, clubId: filter.clubId }, config),
            ]);
            if (!current() || revision !== generation.current) return;
            const counts = { all: all.unreadCount, personal: personal.unreadCount, club: club.unreadCount };
            setNotifications([...new Map(results.flatMap(result => result.content).map(item => [item.id, item])).values()]);
            setTotalElements(results[0].totalElements);
            pages.current = Math.max(1, Math.min(pages.current, Math.ceil(results[0].totalElements / PAGE_SIZE)));
            setUnreadCount(selected?.unreadCount ?? counts[filter.scope]);
            setScopeCounts(counts); setErrorMessage(null);
        } catch (error) {
            if (!current() || revision !== generation.current) return;
            // Unknown or revoked access is not an empty, fully read inbox.
            setNotifications([]); setTotalElements(0); setUnreadCount(null); setScopeCounts(unknownCounts());
            setErrorMessage(extractApiErrorMessage(error, 'Failed to load notifications.'));
        } finally {
            if (current() && revision === generation.current) { refreshing.current = false; setLoading(false); }
        }
    }, [current, filter.clubId, filter.scope, sessionId]);

    useEffect(() => {
        mounted.current = true; controller.current = new AbortController();
        void refresh();
        const unsubscribe = subscribeNotificationsChanged(() => {
            if (!pending.current && !refreshing.current) void refresh();
        });
        return () => { mounted.current = false; controller.current?.abort(); unsubscribe(); };
    }, [refresh]);

    const markRead = async (notification: NotificationItem): Promise<boolean> => {
        if (!current() || pending.current) return false;
        if (notification.isRead) return true;
        pending.current = true; setBusyId(notification.id); ++generation.current;
        try {
            await markNotificationAsRead(notification.id, { _authSessionId: sessionId });
            if (!current()) return false;
            await refresh();
            if (!current()) return false;
            emitNotificationsChanged(); return true;
        } catch (error) {
            if (current()) setErrorMessage(extractApiErrorMessage(error, 'Failed to update notification.'));
            return false;
        } finally { pending.current = false; if (current()) { refreshing.current = false; setBusyId(null); } }
    };

    const markAll = async () => {
        if (!current() || pending.current || unreadCount == null) return;
        pending.current = true; setMarkingAll(true); ++generation.current;
        try {
            await markAllNotificationsAsRead({ scope: filter.scope, clubId: filter.clubId }, { _authSessionId: sessionId });
            if (!current()) return;
            await refresh();
            if (current()) emitNotificationsChanged();
        } catch (error) {
            if (current()) setErrorMessage(extractApiErrorMessage(error, 'Failed to mark notifications as read.'));
        } finally { pending.current = false; if (current()) { refreshing.current = false; setMarkingAll(false); } }
    };

    const loadMore = async () => {
        if (!current() || pending.current || refreshing.current || notifications.length >= totalElements) return;
        pending.current = true; setLoadingMore(true);
        try {
            const response = await fetchNotifications({ page: pages.current, size: PAGE_SIZE, scope: filter.scope, clubId: filter.clubId }, { _authSessionId: sessionId, signal: controller.current?.signal });
            if (!current()) return;
            pages.current++;
            setNotifications(rows => [...new Map([...rows, ...response.content].map(item => [item.id, item])).values()]);
            setTotalElements(response.totalElements);
        } catch (error) {
            if (current()) setErrorMessage(extractApiErrorMessage(error, 'Failed to load more notifications.'));
        } finally { pending.current = false; if (current()) setLoadingMore(false); }
    };

    return { notifications, totalElements, unreadCount, scopeCounts, loading, loadingMore, busyId, markingAll,
        errorMessage, refresh, markRead, markAll, loadMore, isCurrent: current, hasMore: notifications.length < totalElements };
}
