import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, fetchUnreadNotificationCount, markAllNotificationsAsRead, markNotificationAsRead } from '../../api/notifications';
import type { NotificationItem } from '../../types/notifications';
import { buildNotificationDestination, emitNotificationsChanged, subscribeNotificationsChanged } from '../../utils/notifications';
import { extractApiErrorMessage } from '../../utils/apiError';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';

const PAGE_SIZE = 20;

/**
 * The club-scoped inbox: unread count for the navigation and the list for the Inbox page.
 * Nothing loads until management access is confirmed, and every request belongs to one
 * account session so a retired session can never update this club's inbox.
 */
export function useClubInbox(clubId: number, sessionId: AuthSessionId, canRead: boolean, listOpen: boolean) {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const active = useRef(true);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const requests = useRef(new Set<AbortController>());
    useEffect(() => {
        const pending = requests.current;
        return () => { pending.forEach(controller => controller.abort()); pending.clear(); };
    }, [canRead]);
    const current = useCallback((controller: AbortController) => !controller.signal.aborted && active.current && isCurrentAuthSession(sessionId), [sessionId]);

    const load = useCallback(async (nextPage: number, append: boolean) => {
        if (!canRead || !isCurrentAuthSession(sessionId) || !active.current) return;
        const controller = new AbortController();
        requests.current.add(controller);
        setError(null);
        if (nextPage === 0 && !append) setLoading(true); else setLoadingMore(true);
        try {
            const response = await fetchNotifications({ page: nextPage, size: PAGE_SIZE, scope: 'club', clubId }, { signal: controller.signal, _authSessionId: sessionId });
            if (current(controller)) {
                setPage(response.pageNumber);
                setTotal(response.totalElements);
                setNotifications(previous => append ? [...previous, ...response.content] : response.content);
            }
        } catch (failure) {
            if (current(controller)) setError(extractApiErrorMessage(failure, 'Could not load club inbox.'));
        } finally {
            requests.current.delete(controller);
            if (current(controller)) { setLoading(false); setLoadingMore(false); }
        }
    }, [clubId, canRead, sessionId, current]);

    const loadUnread = useCallback(async () => {
        if (!canRead || !isCurrentAuthSession(sessionId) || !active.current) return;
        const controller = new AbortController();
        requests.current.add(controller);
        try {
            const response = await fetchUnreadNotificationCount({ scope: 'club', clubId }, { signal: controller.signal, _authSessionId: sessionId });
            if (current(controller)) setUnreadCount(response.unreadCount);
        } catch { /* The count is a hint; the inbox page reports its own errors. */ }
        finally { requests.current.delete(controller); }
    }, [clubId, canRead, sessionId, current]);

    useEffect(() => {
        if (!listOpen) return;
        setPage(0);
        setNotifications([]);
        void load(0, false);
    }, [listOpen, clubId, load]);
    useEffect(() => { void loadUnread(); }, [loadUnread]);
    useEffect(() => subscribeNotificationsChanged(() => {
        void loadUnread();
        if (listOpen) void load(0, false);
    }), [loadUnread, load, listOpen]);

    const open = useCallback(async (notification: NotificationItem) => {
        setBusyId(notification.id);
        try {
            if (!notification.isRead) {
                await markNotificationAsRead(notification.id);
                setNotifications(previous => previous.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
                setUnreadCount(previous => Math.max(0, previous - 1));
                emitNotificationsChanged();
            }
        } catch { /* Opening the destination matters more than the read marker. */ }
        finally { setBusyId(null); }
        navigate(buildNotificationDestination(notification));
    }, [navigate]);
    const markAllRead = useCallback(async () => {
        try {
            await markAllNotificationsAsRead({ scope: 'club', clubId });
            setNotifications(previous => previous.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            emitNotificationsChanged();
        } catch { /* Unread markers stay as they are. */ }
    }, [clubId]);

    return {
        notifications, loading, loadingMore, error, busyId, unreadCount,
        hasMore: total > (page + 1) * PAGE_SIZE,
        loadMore: () => { void load(page + 1, true); },
        retry: () => { void load(0, false); },
        open, markAllRead,
    };
}
