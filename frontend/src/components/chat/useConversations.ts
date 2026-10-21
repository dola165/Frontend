import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { chatApi, type ConversationDto } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { subscribeNotificationsChanged } from '../../utils/notifications';

/** Keep a failed inbox read distinct from an empty inbox, and discard answers from an old session. */
export function useConversations(activeConversation: RefObject<number | null>) {
    const { sessionId } = useAuth();
    const [conversations, setConversations] = useState<ConversationDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const active = useRef(false);
    const pages = useRef(1);
    const sequence = useRef(0);
    const morePending = useRef(false);
    const conversationsRef = useRef(conversations);
    conversationsRef.current = conversations;
    const load = useCallback(async (more = false) => {
        if (!active.current || !isCurrentAuthSession(sessionId)) return;
        if (morePending.current) return;
        const request = ++sequence.current;
        const current = () => active.current && isCurrentAuthSession(sessionId) && sequence.current === request;
        morePending.current = more;
        if (more) setLoadingMore(true);
        try {
            const items = new Map<number, ConversationDto>();
            const count = pages.current + (more ? 1 : 0);
            let lastPage = 0, total = 0;
            for (let page = 0; page < count; page++) {
                const res = await chatApi.getConversations(page, 20, { _authSessionId: sessionId });
                if (!current()) return;
                res.data.content.forEach(item => items.set(item.id, item));
                total = res.data.totalElements ?? items.size;
                lastPage = page;
                if (!res.data.content.length || (page + 1) * 20 >= total) break;
            }
            // An older selected room may lie beyond these pages. Revalidate it instead of retaining stale access.
            const selected = activeConversation.current;
            if (selected !== null && !items.has(selected)) {
                try {
                    const res = await chatApi.getConversation(selected);
                    if (!current()) return;
                    items.set(selected, res.data);
                } catch (cause) {
                    const status = (cause as { response?: { status?: number } }).response?.status;
                    if (status !== 403 && status !== 404) throw cause;
                }
            }
            if (!current()) return;
            pages.current = lastPage + 1;
            setConversations([...items.values()]);
            setHasMore(pages.current * 20 < total);
            setFailed(false);
        } catch {
            if (current()) setFailed(true);
        } finally {
            morePending.current = false;
            if (current()) { setLoading(false); setLoadingMore(false); }
        }
    }, [sessionId, activeConversation]);
    const loadConversations = useCallback(() => load(), [load]);
    const loadMore = useCallback(() => load(true), [load]);
    useEffect(() => {
        active.current = true;
        void loadConversations();
        const unsubscribe = subscribeNotificationsChanged(() => { void loadConversations(); });
        const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine) void loadConversations(); };
        const timer = window.setInterval(refresh, 30_000);
        window.addEventListener('focus', refresh);
        window.addEventListener('online', refresh);
        return () => {
            active.current = false; unsubscribe(); window.clearInterval(timer);
            window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh);
        };
    }, [loadConversations]);
    return { conversations, setConversations, conversationsRef, sidebarLoading: loading, listFailed: failed, loadConversations,
        loadMore, hasMore, loadingMore };
}
