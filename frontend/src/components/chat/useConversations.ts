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
    const active = useRef(false);
    const conversationsRef = useRef(conversations);
    conversationsRef.current = conversations;
    const loadConversations = useCallback(async () => {
        if (!active.current || !isCurrentAuthSession(sessionId)) return;
        try {
            const res = await chatApi.getConversations(0, 20, { _authSessionId: sessionId });
            if (!active.current || !isCurrentAuthSession(sessionId)) return;
            setConversations(previous => {
                const selected = previous.find(item => item.id === activeConversation.current);
                return selected && !res.data.content.some(item => item.id === selected.id)
                    ? [selected, ...res.data.content] : res.data.content;
            });
            setFailed(false);
        } catch {
            if (active.current && isCurrentAuthSession(sessionId)) setFailed(true);
        } finally {
            if (active.current && isCurrentAuthSession(sessionId)) setLoading(false);
        }
    }, [sessionId, activeConversation]);
    useEffect(() => {
        active.current = true;
        void loadConversations();
        const unsubscribe = subscribeNotificationsChanged(() => { void loadConversations(); });
        return () => { active.current = false; unsubscribe(); };
    }, [loadConversations]);
    return { conversations, setConversations, conversationsRef, sidebarLoading: loading, listFailed: failed, loadConversations };
}
