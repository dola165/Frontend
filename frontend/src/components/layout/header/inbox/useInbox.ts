import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchNotifications, fetchUnreadNotificationCount, markAllNotificationsAsRead, markNotificationAsRead } from '../../../../api/notifications';
import { useAuth } from '../../../../context/AuthContext';
import { requests, type RequestItem } from '../../../../features/requests/api';
import type { NotificationItem } from '../../../../types/notifications';
import { emitNotificationsChanged, subscribeNotificationsChanged } from '../../../../utils/notifications';

export interface InboxCounts { needsYou: number | null; needsYouPartial: boolean; updates: number | null }

/**
 * Counts for the one Inbox button: requests waiting for the person's decision and unread updates.
 * Each source keeps the refresh rhythm it had as its own header button. Unknown stays unknown (null).
 */
export function useInboxCounts(): InboxCounts {
    const { sessionId } = useAuth();
    const { pathname } = useLocation();
    const [revision, setRevision] = useState(0);
    const [needsYou, setNeedsYou] = useState<{ count: number | null; partial: boolean }>({ count: null, partial: false });
    const [updates, setUpdates] = useState<number | null>(null);

    useEffect(() => {
        const refresh = () => setRevision(value => value + 1);
        const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
        window.addEventListener('focus', refresh);
        window.addEventListener('requests-updated', refresh);
        return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('requests-updated', refresh); };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void requests('INCOMING', 0, sessionId, controller.signal, 1)
            .then(result => { if (!controller.signal.aborted) setNeedsYou({ count: result.counts.actionable, partial: result.unavailableSources.length > 0 }); })
            .catch(() => { if (!controller.signal.aborted) setNeedsYou({ count: null, partial: false }); });
        return () => controller.abort();
    }, [sessionId, revision, pathname]);

    useEffect(() => {
        let active = true;
        const load = () => void fetchUnreadNotificationCount({}, { _authSessionId: sessionId })
            .then(result => { if (active) setUpdates(result.unreadCount); })
            .catch(() => { /* Keep the last known count; the full page reports errors. */ });
        load();
        const unsubscribe = subscribeNotificationsChanged(load);
        return () => { active = false; unsubscribe(); };
    }, [sessionId]);

    return { needsYou: needsYou.count, needsYouPartial: needsYou.partial, updates };
}

type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/** What the open Inbox panel shows: up to five decisions and the latest updates. */
export function useInboxPreview() {
    const { sessionId } = useAuth();
    const [attempt, setAttempt] = useState(0);
    const [decisions, setDecisions] = useState<{ attempt: number; value: Load<{ items: RequestItem[]; partial: boolean }> } | null>(null);
    const [updates, setUpdates] = useState<{ attempt: number; value: Load<NotificationItem[]> } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        void requests('INCOMING', 0, sessionId, controller.signal, 10)
            .then(result => { if (!controller.signal.aborted) setDecisions({ attempt, value: { status: 'ready', data: { items: result.items.filter(item => item.actionable).slice(0, 5), partial: result.unavailableSources.length > 0 } } }); })
            .catch(() => { if (!controller.signal.aborted) setDecisions({ attempt, value: { status: 'error' } }); });
        void fetchNotifications({ page: 0, size: 6 }, { _authSessionId: sessionId, signal: controller.signal })
            .then(result => { if (!controller.signal.aborted) setUpdates({ attempt, value: { status: 'ready', data: result.content ?? [] } }); })
            .catch(() => { if (!controller.signal.aborted) setUpdates({ attempt, value: { status: 'error' } }); });
        return () => controller.abort();
    }, [sessionId, attempt]);

    const retry = useCallback(() => setAttempt(value => value + 1), []);

    const markRead = useCallback(async (notification: NotificationItem) => {
        if (notification.isRead) return;
        try {
            await markNotificationAsRead(notification.id);
            setUpdates(current => current?.value.status === 'ready'
                ? { ...current, value: { status: 'ready', data: current.value.data.map(item => item.id === notification.id ? { ...item, isRead: true } : item) } }
                : current);
            emitNotificationsChanged();
        } catch {
            // Opening the destination still works; the item stays unread and the full page can retry.
        }
    }, []);

    const markAllRead = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            await markAllNotificationsAsRead();
            setUpdates(current => current?.value.status === 'ready'
                ? { ...current, value: { status: 'ready', data: current.value.data.map(item => ({ ...item, isRead: true })) } }
                : current);
            emitNotificationsChanged({ allRead: true });
        } catch {
            setError('Could not mark updates as read. Try again.');
        } finally {
            setBusy(false);
        }
    }, []);

    const current = <T,>(entry: { attempt: number; value: Load<T> } | null): Load<T> => entry && entry.attempt === attempt ? entry.value : { status: 'loading' };
    return { decisions: current(decisions), updates: current(updates), retry, markRead, markAllRead, busy, error };
}
