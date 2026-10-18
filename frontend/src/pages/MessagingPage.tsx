import { conversationName, useMessageCopy } from '../components/chat/messageCopy';
import { useChatPeopleSearch } from '../components/chat/useChatPeopleSearch';
import { PeopleSearchStatus } from '../components/chat/PeopleSearchStatus';
import '../features/squadCommunication/squad-life.css';
import { MessageActions } from '../components/chat/MessageActions';
import { ConversationIntakeContext } from '../components/chat/ConversationIntakeContext';
import { MessageText } from '../components/chat/MessageText';
import { SquadInboxList, SquadInboxConversation } from '../features/squadCommunication/SquadInbox';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatTime as formatClockTime } from '../utils/formatting';
import { MediaImage } from '../components/ui/MediaImage';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChatWebSocket, mergeMessages } from '../hooks/useChatWebSocket';
import { useChatReadReceipts } from '../hooks/useChatReadReceipts';
import { useChatScroll } from '../hooks/useChatScroll';
import { OlderMessages } from '../components/chat/OlderMessages';
import { useConversations } from '../components/chat/useConversations';
import { useMessageDraft } from '../components/chat/useMessageDraft';
import { MessageSquare, Plus, Users, Info, X, Send, Circle, Search, Loader2, Crown, Ban, UserMinus, UserPlus, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { SkeletonMessageRow } from '../components/ui/SkeletonCard';
import { getStoredUserId, isCurrentAuthSession } from '../utils/authStorage';
import { chatApi, type ConversationDto, type ChatMessageResponse, type InviteSuggestion, type UserSearchResult } from '../api/chat';
import { NewChatModal } from '../components/chat/NewChatModal';


// ── Helpers ────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return formatClockTime(d);
    return formatDate(d, { month: 'short', day: 'numeric' });
}

function isSharedConversation(conv: ConversationDto): boolean {
    return conv.contextType !== 'DIRECT';
}

// ── Component ──────────────────────────────────────────────────────

export const MessagingPage = () => {
    const { sessionId } = useAuth();
    return <Messages key={sessionId} />;
};

function Messages() {
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

    // Resolve profile links even for an empty inbox or a changed URL on this page.
    useEffect(() => {
        const targetId = Number(searchParams.get('chatWith'));
        if (!Number.isSafeInteger(targetId) || targetId <= 0 || !currentUserId || sidebarLoading || listFailed) return;
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

    // Group management state
    const [suggestions, setSuggestions] = useState<InviteSuggestion[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionsFailed, setSuggestionsFailed] = useState(false);
    const [showAddPeople, setShowAddPeople] = useState(false);
    const [showSuggestUser, setShowSuggestUser] = useState(false);
    const [peopleSearchQuery, setPeopleSearchQuery] = useState('');
    const [managementError, setManagementError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [leaving, setLeaving] = useState(false);
    const leavePending = useRef(false);

    const messageViewportRef = useRef<HTMLDivElement>(null);

    // keep activeConvRef in sync
    activeConvRef.current = activeConvId;

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
    useEffect(() => {
        void setActiveConversation(activeConvId);
    }, [activeConvId, setActiveConversation]);

    useEffect(() => {
        const id = Number(searchParams.get('conversationId'));
        setManagementError(null);
        if (squadId || !Number.isSafeInteger(id) || id <= 0) { setActiveConvId(null); setShowInfo(false); return; }
        if (conversationsRef.current.some(conversation => conversation.id === id)) { setActiveConvId(id); return; }
        let current = true;
        chatApi.getConversation(id).then(response => {
            if (!current || !isCurrentAuthSession(sessionId)) return;
            setConversations(previous => [response.data, ...previous.filter(item => item.id !== id)]);
            setActiveConvId(id);
        }).catch(() => { if (current && isCurrentAuthSession(sessionId)) setManagementError('This conversation couldn’t load. Try again, or open another chat.'); });
        return () => { current = false; };
    }, [searchParams, squadId, conversationsRef, setConversations, profileAttempt, sessionId]);

    const selectConversation = useCallback((id: number) => {
        setActiveConvId(id);
        setShowInfo(false);
        setSearchParams({conversationId:String(id)});
    }, [setSearchParams]);

    const sendMessage = useCallback(async (event?: React.FormEvent) => {
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
    const peopleSearch = useChatPeopleSearch(showAddPeople || showSuggestUser ? peopleSearchQuery : '',
        [currentUserId, ...(activeConv?.participants.map(person => person.userId) ?? [])]);
    const peopleSearchResults = peopleSearch.results;
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

    // Check if the last message in a conversation was sent by the current user
    const isLastMessageFromMe = (conv: ConversationDto): boolean => {
        return conv.lastMessageSenderId === currentUserId;
    };

    // ── Group management ──────────────────────────────────────────────

    const isCreator = activeConv?.contextType === 'GROUP'
        && activeConv.participants.some((p) => p.userId === currentUserId && p.role === 'CREATOR');

    const loadSuggestions = useCallback(async () => {
        if (!activeConvId || activeConv?.contextType !== 'GROUP') return;
        setSuggestionsLoading(true);
        setSuggestionsFailed(false);
        try {
            const res = await chatApi.getPendingSuggestions(activeConvId);
            if (activeConvRef.current === activeConvId && isCurrentAuthSession(sessionId)) setSuggestions(res.data);
        } catch {
            if (activeConvRef.current === activeConvId && isCurrentAuthSession(sessionId)) setSuggestionsFailed(true);
        } finally {
            if (activeConvRef.current === activeConvId && isCurrentAuthSession(sessionId)) setSuggestionsLoading(false);
        }
    }, [activeConvId, activeConv?.contextType, sessionId]);

    useEffect(() => {
        if (showInfo && activeConvId) {
            void loadSuggestions();
        }
    }, [showInfo, activeConvId, loadSuggestions]);

    const handleKickUser = async (userId: number, displayName: string) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.removeParticipant(activeConvId, userId);
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === activeConvId
                        ? { ...c, participants: c.participants.filter((p) => p.userId !== userId), participantCount: c.participants.filter((p) => p.userId !== userId).length }
                        : c,
                ),
            );
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError(copy(`Failed to remove ${displayName}.`, `ვერ ამოიშალა: ${displayName}.`));
        }
    };

    const handleBlockUser = async (userId: number, displayName: string) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.blockUser(activeConvId, userId);
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === activeConvId
                        ? { ...c, participants: c.participants.filter((p) => p.userId !== userId), participantCount: c.participants.filter((p) => p.userId !== userId).length }
                        : c,
                ),
            );
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError(copy(`Failed to block ${displayName}.`, `ვერ დაიბლოკა: ${displayName}.`));
        }
    };

    const handleApproveSuggestion = async (suggestionId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.decideSuggestion(activeConvId, suggestionId, 'APPROVE');
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
            await loadConversations();
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError('Failed to approve suggestion.');
        }
    };

    const handleRejectSuggestion = async (suggestionId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.decideSuggestion(activeConvId, suggestionId, 'REJECT');
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError('Failed to reject suggestion.');
        }
    };

    const handleAddPeople = async (userId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.addParticipants(activeConvId, [userId]);
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setPeopleSearchQuery('');
            await loadConversations();
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError('Failed to add participant.');
        }
    };

    const handleSuggestUser = async (userId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.suggestInvite(activeConvId, userId);
            if (!isCurrentAuthSession(sessionId) || activeConvRef.current !== activeConvId) return;
            setPeopleSearchQuery('');
            setShowSuggestUser(false);
        } catch {
            if (isCurrentAuthSession(sessionId) && activeConvRef.current === activeConvId) setManagementError('This user may already be suggested or blocked.');
        }
    };

    const leaveConversation = async () => {
        if (!activeConv || leavePending.current) return;
        leavePending.current = true; setLeaving(true); setManagementError(null);
        try {
            await chatApi.leaveConversation(activeConv.id);
            if (!isCurrentAuthSession(sessionId)) return;
            if (activeConvRef.current === activeConv.id) {
                activeConvRef.current = null;
                setActiveConvId(null); setShowInfo(false); setShowAddPeople(false); setShowSuggestUser(false);
                setSearchParams({});
            }
            setConversations(previous => previous.filter(conversation => conversation.id !== activeConv.id));
            await loadConversations();
        } catch {
            if (isCurrentAuthSession(sessionId)) setManagementError('Could not leave this conversation. Try again.');
        } finally { leavePending.current = false; setLeaving(false); }
    };

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // ── Render ──────────────────────────────────────────────────────

    return (
        <div className={`chat-messenger-shell unified-messages ${squadId || activeConv ? 'has-conversation' : ''} h-full w-full flex overflow-hidden`}>
            {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
            <aside className="messages-sidebar w-[320px] shrink-0 border-r border-[var(--chat-card-border)] bg-[var(--chat-sidebar-bg)] flex flex-col">
                {/* Header */}
                <div className="h-14 px-4 border-b border-[var(--chat-card-border)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-[var(--chat-accent)]" />
                        <h2 className="font-bold text-[var(--chat-text-primary)] text-base">{copy('Chats', 'ჩატები')}</h2>
                    </div>
                    <button
                        onClick={() => setShowNewChat(true)}
                        className="p-1.5 rounded-full text-[var(--chat-text-muted)] hover:bg-[var(--chat-card-hover)] hover:text-[var(--chat-accent)] transition-colors"
                        title={copy('New chat', 'ახალი ჩატი')} aria-label={copy('New chat', 'ახალი ჩატი')}
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {/* Connection badge */}
                <div className="px-4 py-2 flex items-center gap-2 text-xs shrink-0">
                    <Circle
                        className={`w-2 h-2 ${connected ? 'text-[var(--chat-online)]' : 'text-[var(--chat-offline)]'}`}
                        fill="currentColor"
                    />
                    <span className="text-[var(--chat-text-muted)]">
                        {squadId ? copy('Squad messages refresh automatically', 'გუნდის შეტყობინებები თავისით ახლდება') : connected ? copy('Live', 'პირდაპირ') : copy('New messages are checked every half minute', 'ახალი შეტყობინებები ყოველ ნახევარ წუთში მოწმდება')}
                    </span>
                </div>

                {/* One inbox, with the existing squad membership checks. */}
                <div className="flex-1 overflow-y-auto">
                    <SquadInboxList key={sessionId} selected={squadId} />
                    <h3 className="messages-other-heading">{copy('Other conversations', 'სხვა საუბრები')}</h3>
                    {listFailed && <div className="px-4 py-3"><p role="alert">{copy('Conversations couldn’t load.', 'საუბრები ვერ ჩაიტვირთა.')}</p><button className="gk-btn gk-btn--sm" onClick={() => void loadConversations()}>{copy('Try again', 'ხელახლა ცდა')}</button></div>}
                    {managementError && (searchParams.has('chatWith') || (searchParams.has('conversationId') && !activeConv)) && <div className="px-4 py-3"><p role="alert">{copy(managementError)}</p><button className="gk-btn gk-btn--sm" onClick={() => setProfileAttempt(value => value + 1)}>{copy('Try again', 'ხელახლა ცდა')}</button></div>}
                    {sidebarLoading ? (
                        <div className="flex flex-col gap-2 px-3 py-2">
                            <SkeletonMessageRow />
                            <SkeletonMessageRow />
                            <SkeletonMessageRow />
                            <SkeletonMessageRow />
                        </div>
                    ) : conversations.length === 0 ? (listFailed ? null :
                        <div className="px-4 py-12 text-center">
                            <MessageSquare className="w-8 h-8 mx-auto mb-3 text-[var(--chat-text-muted)]" />
                            <p className="text-sm text-[var(--chat-text-secondary)] font-medium">
                                {copy('No other conversations yet', 'სხვა საუბრები ჯერ არ არის')}
                            </p>
                            <p className="text-xs text-[var(--chat-text-muted)] mt-1">
                                {copy('Start a new chat to begin.', 'დაიწყეთ ახალი ჩატი.')}
                            </p>
                        </div>
                    ) : (
                        conversations.map((conv) => {
                            const isActive = conv.id === activeConvId;
                            const fromMe = isLastMessageFromMe(conv);
                            const showSenderPreview = isSharedConversation(conv) && conv.lastMessage && conv.lastMessageSenderName;

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => selectConversation(conv.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-[3px] ${
                                        isActive
                                            ? 'border-l-[var(--chat-accent)] bg-[var(--chat-accent-soft)]'
                                            : 'border-l-transparent hover:bg-[var(--chat-card-hover)]'
                                    }`}
                                >
                                    {/* Avatar */}
                                    <div className="w-11 h-11 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-sm shrink-0 relative">
                                        {isSharedConversation(conv) ? (
                                            <Users className="w-5 h-5" />
                                        ) : conv.participants[0]?.profilePictureUrl ? (
                                            <MediaImage
                                                src={conv.participants[0].profilePictureUrl}
                                                alt=""
                                                className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : (
                                            conversationName(conv, currentUserId, copy).charAt(0).toUpperCase()
                                        )}
                                        {/* Online dot: only when the server says the other person is online, never assumed. */}
                                        {conv.contextType === 'DIRECT' && conv.participants.some(p => p.userId !== currentUserId && p.online === true) && (
                                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--chat-sidebar-bg)] bg-[var(--chat-online)]" title={copy('Online')} aria-label={copy('Online')} />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline gap-2">
                                            <h3 className="font-semibold text-[var(--chat-text-primary)] text-sm truncate">
                                                {conversationName(conv, currentUserId, copy)}
                                            </h3>
                                            <span className="text-[10px] text-[var(--chat-text-muted)] shrink-0">
                                                {formatTime(conv.lastMessageAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {/* Delivery status tick */}
                                            {fromMe && conv.lastMessage && (
                                                <span className="shrink-0">
                                                    <span title={copy('Saved')} aria-label={copy('Saved')}><Check className="w-3.5 h-3.5 text-[var(--chat-text-muted)]" /></span>
                                                </span>
                                            )}

                                            <p className="text-xs text-[var(--chat-text-muted)] truncate flex-1">
                                                {showSenderPreview ? (
                                                    <>
                                                        <span className="font-medium text-[var(--chat-text-secondary)]">
                                                            {conv.lastMessageSenderName}:{' '}
                                                        </span>
                                                        {conv.lastMessage}
                                                    </>
                                                ) : (
                                                    conv.lastMessage || copy('No messages yet', 'შეტყობინებები ჯერ არ არის')
                                                )}
                                            </p>

                                            {conv.unreadCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--chat-accent)] text-[color:var(--color-on-accent)] text-[10px] font-bold leading-none">
                                                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                    {hasMore && <button type="button" className="gk-btn gk-btn--sm w-full min-h-11" disabled={loadingMore}
                        onClick={() => void loadMore()}>
                        {loadingMore ? copy('Loading conversations…', 'მიმოწერები იტვირთება…') : copy('Load more conversations', 'მეტი მიმოწერის ჩატვირთვა')}
                    </button>}
                </div>
            </aside>

            {/* ── CHAT WINDOW ──────────────────────────────────── */}
            <section className="flex-1 flex flex-col bg-[var(--chat-surface)] min-w-0">
                {squadId ? <SquadInboxConversation key={`${sessionId}:${squadId}`} id={squadId} /> : activeConv ? (
                    <>
                        {/* Header — clickable to toggle info panel */}
                        <div className="h-14 px-5 bg-[var(--chat-card)] border-b border-[var(--chat-card-border)] flex items-center justify-between shrink-0">
                            <button className="messages-mobile-back" onClick={() => setSearchParams({})} aria-label={copy('Back to all messages', 'ყველა შეტყობინებაზე დაბრუნება')}>← {copy('Chats', 'ჩატები')}</button>
                            <button
                                onClick={() => setShowInfo(!showInfo)}
                                className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                            >
                                <div className="w-9 h-9 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-sm shrink-0">
                                    {isSharedConversation(activeConv) ? (
                                        <Users className="w-4 h-4" />
                                    ) : (
                                        conversationName(activeConv, currentUserId, copy).charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-[var(--chat-text-primary)] text-sm truncate">
                                        {conversationName(activeConv, currentUserId, copy)}
                                    </h3>
                                    <p className="text-[11px] text-[var(--chat-text-muted)]">
                                        {isSharedConversation(activeConv)
                                            ? copy(`${activeConv.participantCount} ${activeConv.participantCount === 1 ? 'member' : 'members'}`, `${activeConv.participantCount} მონაწილე`)
                                            : activeConv.participants[0]?.displayName || ''}
                                    </p>
                                </div>
                            </button>
                            <button
                                onClick={() => setShowInfo(!showInfo)}
                                className={`p-2 rounded-full transition-colors shrink-0 ${
                                    showInfo
                                        ? 'bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]'
                                        : 'text-[var(--chat-text-muted)] hover:bg-[var(--chat-card-hover)]'
                                }`}
                                title={copy('Conversation info', 'საუბრის ინფორმაცია')}
                            >
                                <Info className="w-5 h-5" />
                            </button>
                        </div>

                        <ConversationIntakeContext key={`${sessionId}:${activeConv.id}`} conversationId={activeConv.id} messageRevision={activeMessages.at(-1)?.id ?? activeConv.lastMessageAt ?? ''} />
                        {/* Messages */}
                        <div ref={messageViewportRef} role="log" aria-label={copy('Conversation messages', 'საუბრის შეტყობინებები')} style={{ overflowAnchor: 'none' }} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                            {!loadingMessages && <OlderMessages available={hasOlder} loading={loadingOlder} error={historyError} onLoad={loadOlder} />}
                            {loadingMessages ? (
                                <div className="flex items-center justify-center flex-1 gap-2 text-[var(--chat-text-muted)]">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">{copy('Loading messages…', 'შეტყობინებები იტვირთება…')}</span>
                                </div>
                            ) : activeMessages.length === 0 ? (
                                <div className="flex items-center justify-center flex-1">
                                    <p className="text-sm text-[var(--chat-text-muted)]">
                                        {copy('No messages yet. Say hello!', 'შეტყობინებები ჯერ არ არის. მიესალმეთ!')}
                                    </p>
                                </div>
                            ) : (
                                activeMessages.map((msg) => {
                                    const isMe = msg.senderId === currentUserId;
                                    return (
                                        <div
                                            key={msg.id}
                                            data-chat-message-id={msg.id}
                                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                        >
                                            {!isMe && isSharedConversation(activeConv) && (
                                                <span className="text-[11px] font-semibold text-[var(--chat-text-secondary)] ml-1 mb-0.5">
                                                    {msg.senderName}
                                                </span>
                                            )}
                                            <div
                                                className={`px-3.5 py-2 rounded-xl max-w-[70%] text-[15px] leading-relaxed ${
                                                    isMe
                                                        ? 'bg-[var(--chat-accent)] text-[var(--chat-accent-contrast)] rounded-br-sm'
                                                        : 'bg-[var(--chat-bubble-other)] text-[var(--chat-bubble-other-text)] rounded-bl-sm border border-[var(--chat-card-border)]'
                                                }`}
                                            >
                                                <p data-chat-message-content className="whitespace-pre-wrap break-words"><MessageText text={msg.content} /></p>
                                            </div>
                                            <span className="text-[10px] text-[var(--chat-text-muted)] mt-0.5 mx-1">
                                                {formatTime(msg.createdAt)}
                                            </span>
                                            {!isMe && <MessageActions messageId={msg.id} conversationId={msg.conversationId} senderId={msg.senderId} />}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Input */}
                        <div className="px-4 py-3 bg-[var(--chat-card)] border-t border-[var(--chat-card-border)] shrink-0">
                            {deliveryError && <p role="alert" className="mb-2 text-sm text-[color:var(--color-warning)]">{copy(deliveryError)}</p>}
                            <form onSubmit={sendMessage} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    aria-label={copy('Write a message')}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    disabled={sending}
                                    placeholder={
                                        sending ? copy('Sending…', 'იგზავნება…') : copy('Write a message…', 'დაწერეთ შეტყობინება…')
                                    }
                                    className="flex-1 bg-[var(--chat-input-bg)] border border-[var(--chat-card-border)] text-[var(--chat-text-primary)] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--chat-accent)]/40 transition-all disabled:opacity-50 placeholder:text-[var(--chat-text-placeholder)]"
                                />

                                {/* Emoji button removed — chat API is text-only; no emoji/attachment support (P1 W6) */}

                                <button
                                    type="submit"
                                    aria-label={copy('Send message', 'გაგზავნა')}
                                    disabled={!input.trim() || sending}
                                    className="w-10 h-10 bg-[var(--chat-accent)] hover:bg-[var(--chat-accent-hover)] disabled:opacity-40 text-[var(--chat-accent-contrast)] rounded-full flex items-center justify-center transition-colors shrink-0"
                                >
                                    <Send className="w-4 h-4 ml-0.5" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    /* Empty state — no conversation selected */
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center px-6">
                            <div className="w-16 h-16 rounded-full bg-[var(--chat-accent)]/10 flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-8 h-8 text-[var(--chat-accent)]" />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--chat-text-primary)]">
                                {copy('Your messages', 'თქვენი შეტყობინებები')}
                            </h3>
                            <p className="text-sm text-[var(--chat-text-muted)] mt-1 max-w-xs">
                                {sidebarLoading
                                    ? copy('Start a new chat to message someone.', 'დაიწყეთ ახალი ჩატი, რომ ვინმეს მისწეროთ.')
                                    : copy('Pick a conversation on the left or start a new one.', 'აირჩიეთ საუბარი მარცხნივ ან დაიწყეთ ახალი.')}
                            </p>
                            <button
                                onClick={() => setShowNewChat(true)}
                                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--chat-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--chat-accent-contrast)] transition-colors hover:bg-[var(--chat-accent-hover)]"
                            >
                                <Plus className="w-4 h-4" />
                                {copy('New chat', 'ახალი ჩატი')}
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* ── INFO / MANAGEMENT DRAWER ──────────────────────── */}
            {activeConv && (
                <aside aria-hidden={!showInfo} inert={!showInfo} className={`shrink-0 bg-[var(--chat-card)] border-l border-[var(--chat-card-border)] flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
                    showInfo ? 'w-[300px] opacity-100' : 'w-0 opacity-0 border-l-0'
                }`}>
                    {/* Header */}
                    <div className="h-14 px-4 border-b border-[var(--chat-card-border)] flex items-center gap-3 shrink-0">
                        <button
                            onClick={() => {
                                setShowInfo(false);
                                setShowAddPeople(false);
                                setShowSuggestUser(false);
                            }}
                            aria-label={copy('Close conversation info', 'საუბრის ინფორმაციის დახურვა')}
                            className="p-1.5 rounded-full text-[var(--chat-text-muted)] hover:bg-[var(--chat-card-hover)] transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <h2 className="font-semibold text-[var(--chat-text-primary)] text-sm">
                            {activeConv.contextType === 'GROUP'
                                ? copy('Group settings', 'ჯგუფის პარამეტრები')
                                : activeConv.contextType === 'MATCH_CHALLENGE'
                                    ? copy('Match chat', 'მატჩის ჩატი')
                                    : copy('Conversation', 'საუბარი')}
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* Error */}
                        {managementError && (
                            <div role="alert" className="mx-4 mt-3 px-3 py-2 rounded-lg border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)] text-xs">
                                {copy(managementError)}
                                <button onClick={() => setManagementError(null)} className="ml-2 app-text-action">{copy('Dismiss', 'დახურვა')}</button>
                            </div>
                        )}

                        {/* ── Participants ────────────────────── */}
                        <div className="p-4">
                            <button
                                onClick={() => toggleSection('participants')}
                                className="w-full flex items-center justify-between mb-3"
                            >
                                <h3 className="text-xs font-semibold uppercase text-[var(--chat-text-muted)] tracking-wide">
                                    {copy('Participants')} · {activeConv.participantCount}
                                </h3>
                                {expandedSections['participants'] ? (
                                    <ChevronUp className="w-4 h-4 text-[var(--chat-text-muted)]" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-[var(--chat-text-muted)]" />
                                )}
                            </button>

                            {(expandedSections['participants'] ?? true) && (
                                <div className="flex flex-col gap-1">
                                    {activeConv.participants.map((p) => {
                                        const isMe = p.userId === currentUserId;
                                        const isParticipantCreator = p.role === 'CREATOR';

                                        return (
                                            <div
                                                key={p.userId}
                                                className="flex items-center gap-3 px-2 py-1.5 rounded-lg group hover:bg-[var(--chat-card-hover)]"
                                            >
                                                <div className="w-9 h-9 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-xs shrink-0">
                                                    {p.profilePictureUrl ? (
                                                        <MediaImage
                                                            src={p.profilePictureUrl}
                                                            alt=""
                                                            className="w-full h-full rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        p.displayName.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-sm font-medium text-[var(--chat-text-primary)] truncate">
                                                            {p.displayName}
                                                        </p>
                                                        {isParticipantCreator && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] text-[9px] font-bold uppercase tracking-wider">
                                                                <Crown className="w-2.5 h-2.5" />
                                                                {copy('Admin', 'ადმინი')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isMe && (
                                                        <p className="text-[10px] text-[var(--chat-text-muted)]">{copy('You', 'თქვენ')}</p>
                                                    )}
                                                </div>

                                                {/* Creator actions for non-self, non-creator participants */}
                                                {isCreator && !isMe && !isParticipantCreator && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleKickUser(p.userId, p.displayName)}
                                                            title={copy('Remove', 'წაშლა')}
                                                            className="p-1 rounded text-[var(--chat-text-muted)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors"
                                                        >
                                                            <UserMinus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleBlockUser(p.userId, p.displayName)}
                                                            title={copy('Block', 'დაბლოკვა')}
                                                            className="p-1 rounded text-[var(--chat-text-muted)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors"
                                                        >
                                                            <Ban className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── Add People / Suggest (GROUP only) ── */}
                        {activeConv.contextType === 'GROUP' && (
                            <div className="px-4 pb-3 border-b border-[var(--chat-card-border)]">
                                {isCreator ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                setShowAddPeople(!showAddPeople);
                                                setShowSuggestUser(false);
                                                setPeopleSearchQuery('');
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-full border border-[var(--chat-card-border)] text-[var(--chat-text-secondary)] text-xs font-semibold hover:bg-[var(--chat-card-hover)] transition-colors"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            {copy('Add people', 'ადამიანების დამატება')}
                                        </button>
                                        {showAddPeople && (
                                            <div className="mt-2">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--chat-text-muted)]" />
                                                    <input
                                                        type="text"
                                                        value={peopleSearchQuery}
                                                        onChange={(e) => setPeopleSearchQuery(e.target.value)}
                                                        aria-label={copy('Search people')}
                                                        placeholder={copy('Search people…', 'მოძებნეთ ადამიანები…')}
                                                        className="w-full pl-8 pr-3 py-1.5 rounded-full border border-[var(--chat-card-border)] bg-[var(--chat-input-bg)] text-[var(--chat-text-primary)] text-xs placeholder:text-[var(--chat-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--chat-accent)]/40"
                                                    />
                                                </div>
                                                <PeopleSearchStatus loading={peopleSearch.loading} failed={peopleSearch.failed} onRetry={peopleSearch.retry} />
                                                <div className="max-h-32 overflow-y-auto mt-1">
                                                    {peopleSearchResults.map((u) => (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => handleAddPeople(u.id)}
                                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--chat-card-hover)] text-left transition-colors"
                                                        >
                                                            <div className="w-7 h-7 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-[10px] shrink-0">
                                                                {(u.fullName || u.username).charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-medium text-[var(--chat-text-primary)] truncate">
                                                                    {u.fullName || u.username}
                                                                </p>
                                                                <p className="text-[10px] text-[var(--chat-text-muted)]">@{u.username}</p>
                                                            </div>
                                                            <Plus className="w-3.5 h-3.5 text-[var(--chat-text-muted)]" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setShowSuggestUser(!showSuggestUser);
                                            setShowAddPeople(false);
                                            setPeopleSearchQuery('');
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-full border border-[var(--chat-card-border)] text-[var(--chat-text-secondary)] text-xs font-semibold hover:bg-[var(--chat-card-hover)] transition-colors"
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        {copy('Suggest someone', 'ვინმეს შეთავაზება')}
                                    </button>
                                )}

                                {/* Shared search for Suggest Someone */}
                                {showSuggestUser && !isCreator && (
                                    <div className="mt-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--chat-text-muted)]" />
                                            <input
                                                type="text"
                                                value={peopleSearchQuery}
                                                onChange={(e) => setPeopleSearchQuery(e.target.value)}
                                                aria-label={copy('Search people')}
                                                placeholder={copy('Search people…', 'მოძებნეთ ადამიანები…')}
                                                className="w-full pl-8 pr-3 py-1.5 rounded-full border border-[var(--chat-card-border)] bg-[var(--chat-input-bg)] text-[var(--chat-text-primary)] text-xs placeholder:text-[var(--chat-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--chat-accent)]/40"
                                            />
                                        </div>
                                        <PeopleSearchStatus loading={peopleSearch.loading} failed={peopleSearch.failed} onRetry={peopleSearch.retry} />
                                        <div className="max-h-32 overflow-y-auto mt-1">
                                            {peopleSearchResults.map((u) => (
                                                <button
                                                    key={u.id}
                                                    onClick={() => handleSuggestUser(u.id)}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--chat-card-hover)] text-left transition-colors"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-[10px] shrink-0">
                                                        {(u.fullName || u.username).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-medium text-[var(--chat-text-primary)] truncate">
                                                            {u.fullName || u.username}
                                                        </p>
                                                        <p className="text-[10px] text-[var(--chat-text-muted)]">@{u.username}</p>
                                                    </div>
                                                    <Plus className="w-3.5 h-3.5 text-[var(--chat-text-muted)]" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Pending Suggestions (creator only) ── */}
                        {activeConv.contextType === 'GROUP' && isCreator && (
                            <div className="p-4 border-b border-[var(--chat-card-border)]">
                                <button
                                    onClick={() => toggleSection('suggestions')}
                                    className="w-full flex items-center justify-between"
                                >
                                    <h3 className="text-xs font-semibold uppercase text-[var(--chat-text-muted)] tracking-wide">
                                        {copy('Invite suggestions', 'შეთავაზებული მოწვევები')}
                                        {suggestions.length > 0 && (
                                            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)] text-[9px] font-bold">
                                                {suggestions.length}
                                            </span>
                                        )}
                                    </h3>
                                    {expandedSections['suggestions'] ? (
                                        <ChevronUp className="w-4 h-4 text-[var(--chat-text-muted)]" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-[var(--chat-text-muted)]" />
                                    )}
                                </button>

                                {(expandedSections['suggestions'] ?? true) && (
                                    <>
                                        {suggestionsLoading ? (
                                            <div className="flex justify-center py-4">
                                                <Loader2 className="w-4 h-4 animate-spin text-[var(--chat-text-muted)]" />
                                            </div>
                                        ) : suggestionsFailed ? (
                                            <p role="alert" className="text-xs mt-2">{copy('Invite suggestions couldn’t load.', 'მოწვევის შეთავაზებები ვერ ჩაიტვირთა.')} <button className="app-text-action" onClick={() => void loadSuggestions()}>{copy('Try again')}</button></p>
                                        ) : suggestions.length === 0 ? (
                                            <p className="text-xs text-[var(--chat-text-muted)] mt-2 py-2 text-center">
                                                {copy('No suggestions waiting.', 'შეთავაზებები არ არის.')}
                                            </p>
                                        ) : (
                                            <div className="flex flex-col gap-2 mt-2">
                                                {suggestions.map((s) => (
                                                    <div
                                                        key={s.id}
                                                        className="flex items-center gap-2 px-2 py-2 rounded-lg bg-[var(--chat-surface)] border border-[var(--chat-card-border)]"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-[10px] shrink-0">
                                                            {(s.suggestedUserDisplayName || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-[var(--chat-text-primary)] truncate">
                                                                {s.suggestedUserDisplayName}
                                                            </p>
                                                            <p className="text-[10px] text-[var(--chat-text-muted)]">
                                                                {copy(`Suggested by ${s.suggestedByDisplayName}`, `შემოთავაზებულია: ${s.suggestedByDisplayName}`)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={() => handleApproveSuggestion(s.id)}
                                                                className="p-1 rounded-full text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10 transition-colors"
                                                                title={copy('Approve', 'დადასტურება')}
                                                            >
                                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectSuggestion(s.id)}
                                                                className="p-1 rounded-full text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors"
                                                                title={copy('Decline', 'უარყოფა')}
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Leave button */}
                    <div className="p-4 border-t border-[var(--chat-card-border)]">
                        <button
                            onClick={() => void leaveConversation()}
                            disabled={leaving}
                            aria-busy={leaving}
                            className="w-full py-2 px-4 rounded-full border border-[color:var(--color-danger)]/30 text-[color:var(--color-danger)] text-sm font-semibold hover:bg-[color:var(--color-danger)]/10 transition-colors"
                        >
                            {leaving ? copy('Leaving…') : activeConv.contextType === 'GROUP'
                                ? copy('Leave group', 'ჯგუფის დატოვება')
                                : activeConv.contextType === 'MATCH_CHALLENGE'
                                    ? copy('Leave match chat', 'მატჩის ჩატის დატოვება')
                                    : copy('Leave conversation', 'საუბრის დატოვება')}
                        </button>
                    </div>
                </aside>
            )}

            {/* ── NEW CHAT OVERLAY ──────────────────────────────── */}
            <NewChatModal
                open={showNewChat}
                onClose={() => setShowNewChat(false)}
                onConversationCreated={handleConversationCreated}
                recentContacts={recentContacts}
            />
        </div>
    );
};
