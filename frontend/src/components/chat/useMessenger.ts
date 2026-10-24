import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useChatWebSocket, mergeMessages } from '../../hooks/useChatWebSocket';
import { useChatReadReceipts } from '../../hooks/useChatReadReceipts';
import { useChatScroll } from '../../hooks/useChatScroll';
import { getStoredUserId, isCurrentAuthSession } from '../../utils/authStorage';
import { chatApi, type ConversationDto, type ChatMessageResponse, type UserSearchResult } from '../../api/chat';
import { useMessageCopy } from './messageCopy';
import { useConversations } from './useConversations';
import { useMessageDraft } from './useMessageDraft';

/** The inbox, the selected conversation (kept in the URL), realtime delivery and sending for one signed-in session. */
export function useMessenger() {
    const copy = useMessageCopy();
    const {sessionId} = useAuth();
    const currentUserId = Number(getStoredUserId() || 0);
    const [searchParams, setSearchParams] = useSearchParams();

    const squadParam = Number(searchParams.get('squadId'));
    const squadId = Number.isSafeInteger(squadParam) && squadParam > 0 ? squadParam : null;
    const activeConvRef = useRef<number | null>(null);
    const { conversations, setConversations, conversationsRef, sidebarLoading, listFailed, loadConversations,
        loadMore, hasMore, loadingMore } = useConversations(activeConvRef);
    const [activeConvId, setActiveConvId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Record<number, ChatMessageResponse[]>>({});
    const { input, setInput, confirmDraft } = useMessageDraft(activeConvId);
    const [showNewChat, setShowNewChat] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [profileAttempt, setProfileAttempt] = useState(0);
    const [managementError, setManagementError] = useState<string | null>(null);

    // Resolve profile links even for an empty inbox or a changed URL on this page.
    useEffect(() => {
        const targetId = Number(searchParams.get('chatWith'));
        if (!Number.isSafeInteger(targetId) || targetId <= 0 || !currentUserId || sidebarLoading || listFailed) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- a new address clears the previous address error
        setManagementError(null);
        let current = true;
        const existing = conversationsRef.current.find(
            conversation => conversation.contextType === 'DIRECT' && conversation.participants.some(person => person.userId === targetId),
        );
        const open = (conversation: ConversationDto) => {
            if (!current || !isCurrentAuthSession(sessionId)) return;
            setConversations(previous => [conversation, ...previous.filter(item => item.id !== conversation.id)]);
            setActiveConvId(conversation.id);
            const next = new URLSearchParams(searchParams);
            next.delete('chatWith');
            next.set('conversationId', String(conversation.id));
            setSearchParams(next, { replace: true });
        };
        if (existing) open(existing);
        else {
            chatApi.createConversation({ contextType: 'DIRECT', participantIds: [targetId] })
                .then(response => open(response.data))
                .catch(() => { if (current && isCurrentAuthSession(sessionId)) setManagementError('Could not open this conversation. Please try again.'); });
        }
        return () => { current = false; };
    }, [searchParams, currentUserId, sidebarLoading, listFailed, setSearchParams, profileAttempt, conversationsRef, setConversations, sessionId]);

    const messageViewportRef = useRef<HTMLDivElement>(null);

    // Keep activeConvRef in sync on every commit, before any effect or late response reads it.
    useLayoutEffect(() => { activeConvRef.current = activeConvId; });

    // ── WebSocket (skipped in mock mode) ────────────────────────────

    const latestPreviewId = useRef<Record<number, number>>({});
    const handleIncoming = useCallback((message: ChatMessageResponse) => {
        setMessages(previous => ({ ...previous, [message.conversationId]: mergeMessages(previous[message.conversationId] ?? [], [message]) }));
        if (message.id <= (latestPreviewId.current[message.conversationId] ?? 0)) return;
        latestPreviewId.current[message.conversationId] = message.id;
        setConversations(previous => previous.map(conversation => {
            if (conversation.id !== message.conversationId || (conversation.lastMessageAt && new Date(conversation.lastMessageAt).getTime() > new Date(message.createdAt).getTime())) return conversation;
            return { ...conversation, lastMessage: message.content, lastMessageSenderId: message.senderId,
                lastMessageSenderName: message.senderName, lastMessageAt: message.createdAt };
        }).sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime()));
    }, [setConversations]);
    const handleUnavailable = useCallback((id: number) => {
        setMessages(previous => ({ ...previous, [id]: [] }));
        setConversations(previous => previous.filter(conversation => conversation.id !== id));
        if (activeConvRef.current === id) {
            setActiveConvId(null);
            setShowInfo(false);
            setManagementError(copy('This conversation is no longer available.', 'ეს მიმოწერა აღარ არის ხელმისაწვდომი.'));
        }
    }, [setConversations, copy]);
    const { connected, setActiveConversation, sendMessage: saveMessage, loading: loadingMessages, error: deliveryError, sending, loadOlder, hasOlder, loadingOlder, historyError } = useChatWebSocket(handleIncoming, handleUnavailable);
    // The team chat keeps itself current (features/teamChat); the plain history is for the others.
    const teamActive = conversations.some(conversation => conversation.id === activeConvId && conversation.contextType === 'TEAM');
    useEffect(() => {
        void setActiveConversation(teamActive ? null : activeConvId);
    }, [activeConvId, teamActive, setActiveConversation]);

    useEffect(() => {
        const id = Number(searchParams.get('conversationId'));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- a new address clears the previous address error
        setManagementError(null);
        if (squadId || !Number.isSafeInteger(id) || id <= 0) { setActiveConvId(null); setShowInfo(false); return; }
        if (conversationsRef.current.some(conversation => conversation.id === id)) { setActiveConvId(id); return; }
        let current = true;
        chatApi.getConversation(id).then(response => {
            if (!current || !isCurrentAuthSession(sessionId)) return;
            // The single conversation carries no last message: keep the inbox's when it loaded first.
            setConversations(previous => {
                const listed = previous.find(item => item.id === id);
                const opened = listed ? { ...response.data, lastMessage: listed.lastMessage, lastMessageSenderId: listed.lastMessageSenderId,
                    lastMessageSenderName: listed.lastMessageSenderName, lastMessageAt: listed.lastMessageAt } : response.data;
                return [opened, ...previous.filter(item => item.id !== id)];
            });
            setActiveConvId(id);
        }).catch(() => { if (current && isCurrentAuthSession(sessionId)) setManagementError('This conversation couldn’t load. Try again, or open another chat.'); });
        return () => { current = false; };
    }, [searchParams, squadId, conversationsRef, setConversations, profileAttempt, sessionId]);

    const selectConversation = useCallback((id: number) => {
        setActiveConvId(id);
        setShowInfo(false);
        setSearchParams({conversationId:String(id)});
    }, [setSearchParams]);

    const sendMessage = useCallback(async (event?: FormEvent) => {
        event?.preventDefault();
        if (!activeConvId || !input.trim() || sending) return;
        const id = activeConvId;
        const draft = input;
        if (await saveMessage(id, draft)) {
            if (!isCurrentAuthSession(sessionId)) return;
            confirmDraft(id, draft);
            void loadConversations();
        }
    }, [activeConvId, input, sending, saveMessage, loadConversations, confirmDraft, sessionId]);

    const handleConversationCreated = useCallback(
        async (convId: number) => {
            await loadConversations();
            if (!isCurrentAuthSession(sessionId)) return;
            selectConversation(convId);
        },
        [loadConversations, selectConversation, sessionId],
    );

    // ── Derived ─────────────────────────────────────────────────────

    const activeConv = squadId ? null : conversations.find((c) => c.id === activeConvId) || null;
    const activeMessages = activeConvId ? messages[activeConvId] || [] : [];
    useChatScroll(messageViewportRef, activeConvId, !!activeConv && !loadingMessages);
    useChatReadReceipts(activeConvId, !!activeConv && !loadingMessages && !showNewChat, activeMessages, messageViewportRef);

    // Derive recent contacts from existing conversations (other participants, deduplicated)
    const recentContacts = useMemo(() => {
        const seen = new Set<number>();
        const contacts: UserSearchResult[] = [];
        for (const conv of conversations) {
            for (const p of conv.participants) {
                if (p.userId !== currentUserId && !seen.has(p.userId)) {
                    seen.add(p.userId);
                    contacts.push({
                        id: p.userId,
                        fullName: p.displayName,
                        username: '',
                        position: null,
                        userType: '',
                        avatarUrl: p.profilePictureUrl,
                        isMinor: false,
                    });
                }
            }
        }
        return contacts;
    }, [conversations, currentUserId]);

    return {
        copy, sessionId, currentUserId, searchParams, setSearchParams, squadId, activeConvRef,
        conversations, setConversations, sidebarLoading, listFailed, loadConversations, loadMore, hasMore, loadingMore,
        activeConvId, setActiveConvId, activeConv, activeMessages, input, setInput, showNewChat, setShowNewChat,
        showInfo, setShowInfo, setProfileAttempt, managementError, setManagementError, messageViewportRef,
        connected, loadingMessages, deliveryError, sending, loadOlder, hasOlder, loadingOlder, historyError,
        selectConversation, sendMessage, handleConversationCreated, recentContacts,
    };
}

export type Messenger = ReturnType<typeof useMessenger>;
