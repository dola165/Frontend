import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { chatApi } from '../../../api/chat';
import { useAuth } from '../../../context/AuthContext';

/**
 * Conversations with unread messages, from the first page of the conversation list (most recent first).
 * Refreshes every minute while visible, when the person returns to the app, and on entering or leaving
 * Messages (where reading a thread clears it), rather than on every page change.
 */
export function useUnreadMessages(): number | null {
    const { sessionId } = useAuth();
    const { pathname } = useLocation();
    const [revision, setRevision] = useState(0);
    const [count, setCount] = useState<number | null>(null);
    // Entering and leaving Messages refresh it; other page changes do not.
    const inMessages = pathname === '/messages';

    useEffect(() => {
        const refresh = () => setRevision(value => value + 1);
        const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
        window.addEventListener('focus', refresh);
        return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void chatApi.getConversations(0, 50, { _authSessionId: sessionId, signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setCount(response.data.content.filter(conversation => conversation.unreadCount > 0).length); })
            .catch(() => { /* Keep the last known count; Messages reports its own errors. */ });
        return () => controller.abort();
    }, [sessionId, revision, inMessages]);

    return count;
}
