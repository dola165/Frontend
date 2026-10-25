import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeNotificationsChanged } from '../../utils/notifications';
import { fetchHome, type ChatHome, type ChatSummary } from './api';
import { isMissing } from './teamChatWords';

export type HomeStatus = 'loading' | 'ready' | 'missing' | 'error';

/**
 * The list of chats: loaded once, then kept current by polling (every half minute, on focus and whenever the
 * person's notifications change), never by a live line of its own. Only the open chat has a live line; the list
 * sees new activity at the next look. A chat the panel or the list just changed is put in place at once.
 */
export function useChats() {
    const [home, setHome] = useState<ChatHome | null>(null);
    const [status, setStatus] = useState<HomeStatus>('loading');
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

    const loading = useRef(false);
    const refresh = useCallback(async () => {
        if (loading.current) return;
        loading.current = true;
        try {
            const next = await fetchHome();
            if (!alive.current) return;
            setHome(next);
            setStatus('ready');
        } catch (error) {
            if (!alive.current) return;
            if (isMissing(error)) setStatus('missing');
            else setStatus(current => current === 'ready' ? current : 'error');
        } finally {
            loading.current = false;
        }
    }, []);

    useEffect(() => {
        void refresh();
        const look = () => { if (document.visibilityState === 'visible' && navigator.onLine) void refresh(); };
        const timer = window.setInterval(look, 30_000);
        window.addEventListener('focus', look);
        window.addEventListener('online', look);
        const stop = subscribeNotificationsChanged(look);
        return () => { window.clearInterval(timer); window.removeEventListener('focus', look); window.removeEventListener('online', look); stop(); };
    }, [refresh]);

    /** A chat as the server just returned it: into the right list, the other list rid of it. */
    const put = useCallback((chat: ChatSummary) => setHome(current => {
        if (!current) return current;
        const deleted = chat.deletesAt !== null;
        const without = (list: ChatSummary[]) => list.filter(known => known.id !== chat.id);
        const into = (list: ChatSummary[]) => {
            const next = list.some(known => known.id === chat.id) ? list.map(known => known.id === chat.id ? chat : known) : [chat, ...list];
            return next.sort((a, b) => Number(a.unreadCount === 0) - Number(b.unreadCount === 0) || b.lastActivityAt.localeCompare(a.lastActivityAt));
        };
        return {
            ...current,
            chats: deleted ? without(current.chats) : into(current.chats),
            deleted: deleted ? into(current.deleted) : without(current.deleted),
        };
    }), []);

    /** A chat is gone for good (purged while the page was open). */
    const drop = useCallback((id: number) => setHome(current => current
        ? { ...current, chats: current.chats.filter(chat => chat.id !== id), deleted: current.deleted.filter(chat => chat.id !== id) }
        : current), []);

    return { home, status, refresh, put, drop };
}
export type Chats = ReturnType<typeof useChats>;
