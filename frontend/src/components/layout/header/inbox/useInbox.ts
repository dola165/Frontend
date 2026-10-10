import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchNotifications, fetchUnreadNotificationCount, markAllNotificationsAsRead, markNotificationAsRead } from '../../../../api/notifications';
import { useAuth } from '../../../../context/AuthContext';
import { requests, type RequestItem } from '../../../../features/requests/api';
import type { NotificationItem } from '../../../../types/notifications';
import { emitNotificationsChanged, subscribeNotificationsChanged } from '../../../../utils/notifications';
import type { Copy } from '../pins/describeRoute';

/**
 * `needsYou`: requests waiting for the person's decision; null when they could not load.
 * `needsYouPartial`: some request types could not load, so the real number may be higher.
 * `updates`: unread notifications; null until known.
 */
export interface InboxCounts { needsYou: number | null; needsYouPartial: boolean; updates: number | null }

/** What the Inbox button shows: a count of decisions only, a dot for unread updates, and never an invented zero. */
export function inboxBadge({ needsYou, needsYouPartial, updates }: InboxCounts): { count: number; atLeast: boolean } | 'dot' | null {
    if (needsYou) return { count: needsYou, atLeast: needsYouPartial };
    return updates ? 'dot' : null;
}

/** The button's accessible name says exactly what is known: decisions, unread updates, and what could not load. */
export function inboxLabel({ needsYou, needsYouPartial, updates }: InboxCounts, copy: Copy) {
    const decisions = needsYou === null
        ? copy('requests could not load', 'მოთხოვნები ვერ ჩაიტვირთა')
        : needsYouPartial
            ? copy(`at least ${needsYou} need you, some requests could not load`, `მინიმუმ ${needsYou} გელოდებათ, ზოგი მოთხოვნა ვერ ჩაიტვირთა`)
            : copy(`${needsYou} need you`, `${needsYou} გელოდებათ`);
    const news = updates === null ? null : copy(`${updates} unread updates`, `${updates} წაუკითხავი სიახლე`);
    return `${copy('Inbox', 'შემოსულები')}: ${news ? `${decisions}, ${news}` : decisions}`;
}

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

/** What the open Inbox panel shows: up to five decisions and the latest updates, kept current while it is open. */
export function useInboxPreview() {
    const { sessionId } = useAuth();
    const [attempt, setAttempt] = useState(0);
    const [revision, setRevision] = useState(0);
    const [decisions, setDecisions] = useState<{ attempt: number; value: Load<{ items: RequestItem[]; partial: boolean }> } | null>(null);
    const [updates, setUpdates] = useState<{ attempt: number; value: Load<NotificationItem[]> } | null>(null);
    const [busy, setBusy] = useState(false);
    const [markAllFailed, setMarkAllFailed] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        void requests('INCOMING', 0, sessionId, controller.signal, 10)
            .then(result => { if (!controller.signal.aborted) setDecisions({ attempt, value: { status: 'ready', data: { items: result.items.filter(item => item.actionable).slice(0, 5), partial: result.unavailableSources.length > 0 } } }); })
            .catch(() => { if (!controller.signal.aborted) setDecisions({ attempt, value: { status: 'error' } }); });
        return () => controller.abort();
    }, [sessionId, attempt]);

    // Updates refresh quietly whenever notifications change elsewhere; the list stays on screen meanwhile.
    useEffect(() => subscribeNotificationsChanged(() => setRevision(value => value + 1)), []);
    useEffect(() => {
        const controller = new AbortController();
        void fetchNotifications({ page: 0, size: 6 }, { _authSessionId: sessionId, signal: controller.signal })
            .then(result => { if (!controller.signal.aborted) setUpdates({ attempt, value: { status: 'ready', data: result.content ?? [] } }); })
            .catch(() => { if (!controller.signal.aborted) setUpdates(current => current?.attempt === attempt && current.value.status === 'ready' ? current : { attempt, value: { status: 'error' } }); });
        return () => controller.abort();
    }, [sessionId, attempt, revision]);

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
        setMarkAllFailed(false);
        try {
            await markAllNotificationsAsRead();
            setUpdates(current => current?.value.status === 'ready'
                ? { ...current, value: { status: 'ready', data: current.value.data.map(item => ({ ...item, isRead: true })) } }
                : current);
            emitNotificationsChanged({ allRead: true });
        } catch {
            setMarkAllFailed(true);
        } finally {
            setBusy(false);
        }
    }, []);

    const current = <T,>(entry: { attempt: number; value: Load<T> } | null): Load<T> => entry && entry.attempt === attempt ? entry.value : { status: 'loading' };
    return { decisions: current(decisions), updates: current(updates), retry, markRead, markAllRead, busy, markAllFailed };
}
