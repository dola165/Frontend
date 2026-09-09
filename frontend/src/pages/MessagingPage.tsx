import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChatWebSocket, mergeMessages } from '../hooks/useChatWebSocket';
import { useChatReadReceipts } from '../hooks/useChatReadReceipts';
import { subscribeNotificationsChanged } from '../utils/notifications';
import { MessageSquare, Plus, Users, Info, X, Send, Circle, Search, Loader2, Crown, Ban, UserMinus, UserPlus, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { SkeletonMessageRow } from '../components/ui/SkeletonCard';
import { getStoredUserId } from '../utils/authStorage';
import { chatApi, type ConversationDto, type ChatMessageResponse, type InviteSuggestion, type UserSearchResult } from '../api/chat';
import { NewChatModal } from '../components/chat/NewChatModal';


// ── Helpers ────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getDisplayName(conv: ConversationDto, currentUserId: number): string {
    if (conv.contextType !== 'DIRECT') {
        return conv.name || (conv.contextType === 'MATCH_CHALLENGE' ? 'Match Chat' : 'Group');
    }
    const other = conv.participants.find((p) => p.userId !== currentUserId);
    return other?.displayName || 'Unknown';
}

function isSharedConversation(conv: ConversationDto): boolean {
    return conv.contextType !== 'DIRECT';
}

function getAvatarLetter(conv: ConversationDto, currentUserId: number): string {
    const name = getDisplayName(conv, currentUserId);
    return name.charAt(0).toUpperCase();
}

// ── Component ──────────────────────────────────────────────────────

export const MessagingPage = () => {
    const currentUserId = Number(getStoredUserId() || 0);
    const [searchParams, setSearchParams] = useSearchParams();

    const [conversations, setConversations] = useState<ConversationDto[]>([]);
    const [activeConvId, setActiveConvId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Record<number, ChatMessageResponse[]>>({});
    const [input, setInput] = useState('');
    const [showNewChat, setShowNewChat] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [sidebarLoading, setSidebarLoading] = useState(true);

    const conversationsRef = useRef(conversations);
    conversationsRef.current = conversations;

    // Resolve profile links even for an empty inbox or a changed URL on this page.
    useEffect(() => {
        const targetId = Number(searchParams.get('chatWith'));
        if (!Number.isSafeInteger(targetId) || targetId <= 0 || !currentUserId || sidebarLoading) return;
        let current = true;
        const existing = conversationsRef.current.find(
            conversation => conversation.contextType === 'DIRECT' && conversation.participants.some(person => person.userId === targetId),
        );
        const open = (conversation: ConversationDto) => {
            if (!current) return;
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
                .catch(() => { if (current) setManagementError('Could not open this conversation. Please try again.'); });
        }
        return () => { current = false; };
    }, [searchParams, currentUserId, sidebarLoading, setSearchParams]);

    // Group management state
    const [suggestions, setSuggestions] = useState<InviteSuggestion[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [showAddPeople, setShowAddPeople] = useState(false);
    const [showSuggestUser, setShowSuggestUser] = useState(false);
    const [peopleSearchQuery, setPeopleSearchQuery] = useState('');
    const [peopleSearchResults, setPeopleSearchResults] = useState<UserSearchResult[]>([]);
    const [peopleSearchLoading, setPeopleSearchLoading] = useState(false);
    const [managementError, setManagementError] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const peopleSearchRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageViewportRef = useRef<HTMLDivElement>(null);
    const activeConvRef = useRef<number | null>(null);

    // keep activeConvRef in sync
    activeConvRef.current = activeConvId;

    // ── Load conversations ──────────────────────────────────────────

    const loadConversations = useCallback(async () => {
        try {
            const res = await chatApi.getConversations();
            setConversations(previous => {
                const selected = previous.find(item => item.id === activeConvRef.current);
                return selected && !res.data.content.some(item => item.id === selected.id)
                    ? [selected, ...res.data.content] : res.data.content;
            });
        } catch (e) {
            console.error('Failed to load conversations', e);
        } finally {
            setSidebarLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadConversations();
    }, [loadConversations]);

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
    }, []);
    const handleUnavailable = useCallback((id: number) => {
        setMessages(previous => ({ ...previous, [id]: [] }));
    }, []);
    const { connected, setActiveConversation, sendMessage: saveMessage, loading: loadingMessages, error: deliveryError, sending } = useChatWebSocket(handleIncoming, handleUnavailable);
    useEffect(() => {
        // Scroll after loaded bubbles replace the spinner; avoid sweeping unseen
        // bubbles through the viewport during a long animated history scroll.
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }, [messages, activeConvId, loadingMessages]);
    const drafts = useRef<Record<number, string>>({});
    const previousConversation = useRef<number | null>(null);

    useEffect(() => {
        if (previousConversation.current !== null) drafts.current[previousConversation.current] = input;
        previousConversation.current = activeConvId;
        setInput(activeConvId === null ? '' : drafts.current[activeConvId] ?? '');
        void setActiveConversation(activeConvId);
        // Draft changes do not restart the subscription.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeConvId, setActiveConversation]);

    useEffect(() => subscribeNotificationsChanged(() => { void loadConversations(); }), [loadConversations]);

    useEffect(() => {
        const id = Number(searchParams.get('conversationId'));
        if (!Number.isSafeInteger(id) || id <= 0) return;
        let current = true;
        chatApi.getConversation(id).then(response => {
            if (!current) return;
            setConversations(previous => [response.data, ...previous.filter(item => item.id !== id)]);
            setActiveConvId(id);
        }).catch(() => { if (current) setManagementError('This conversation is no longer available.'); });
        return () => { current = false; };
    }, [searchParams]);

    const selectConversation = useCallback((id: number) => {
        setActiveConvId(id);
        setShowInfo(false);
    }, []);

    const sendMessage = useCallback(async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!activeConvId || !input.trim() || sending) return;
        const id = activeConvId;
        const draft = input;
        if (await saveMessage(id, draft)) {
            drafts.current[id] = '';
            if (activeConvRef.current === id) setInput(current => current === draft ? '' : current);
            void loadConversations();
        }
    }, [activeConvId, input, sending, saveMessage, loadConversations]);

    const handleConversationCreated = useCallback(
        async (convId: number) => {
            await loadConversations();
            selectConversation(convId);
        },
        [loadConversations, selectConversation],
    );

    // ── Derived ─────────────────────────────────────────────────────

    const activeConv = conversations.find((c) => c.id === activeConvId) || null;
    const activeMessages = activeConvId ? messages[activeConvId] || [] : [];
    useChatReadReceipts(activeConvId, !!activeConv && !loadingMessages, activeMessages, messageViewportRef);

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
        try {
            const res = await chatApi.getPendingSuggestions(activeConvId);
            setSuggestions(res.data);
        } catch {
            // silently fail
        } finally {
            setSuggestionsLoading(false);
        }
    }, [activeConvId, activeConv?.contextType]);

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
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === activeConvId
                        ? { ...c, participants: c.participants.filter((p) => p.userId !== userId), participantCount: c.participantCount - 1 }
                        : c,
                ),
            );
        } catch {
            setManagementError(`Failed to remove ${displayName}.`);
        }
    };

    const handleBlockUser = async (userId: number, displayName: string) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.blockUser(activeConvId, userId);
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === activeConvId
                        ? { ...c, participants: c.participants.filter((p) => p.userId !== userId), participantCount: c.participantCount - 1 }
                        : c,
                ),
            );
        } catch {
            setManagementError(`Failed to block ${displayName}.`);
        }
    };

    const handleApproveSuggestion = async (suggestionId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.decideSuggestion(activeConvId, suggestionId, 'APPROVE');
            setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
            await loadConversations();
        } catch {
            setManagementError('Failed to approve suggestion.');
        }
    };

    const handleRejectSuggestion = async (suggestionId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.decideSuggestion(activeConvId, suggestionId, 'REJECT');
            setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        } catch {
            setManagementError('Failed to reject suggestion.');
        }
    };

    const handleAddPeople = async (userId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.addParticipants(activeConvId, [userId]);
            setPeopleSearchQuery('');
            setPeopleSearchResults([]);
            await loadConversations();
        } catch {
            setManagementError('Failed to add participant.');
        }
    };

    const handleSuggestUser = async (userId: number) => {
        if (!activeConvId) return;
        setManagementError(null);
        try {
            await chatApi.suggestInvite(activeConvId, userId);
            setPeopleSearchQuery('');
            setPeopleSearchResults([]);
            setShowSuggestUser(false);
        } catch {
            setManagementError('This user may already be suggested or blocked.');
        }
    };

    const searchPeople = useCallback((q: string) => {
        if (peopleSearchRef.current) clearTimeout(peopleSearchRef.current);
        if (q.trim().length < 2) {
            setPeopleSearchResults([]);
            return;
        }
        peopleSearchRef.current = setTimeout(async () => {
            setPeopleSearchLoading(true);
            try {
                const res = await chatApi.searchUsers(q.trim());
                setPeopleSearchResults(
                    res.data.content.filter(
                        (u) => u.id !== currentUserId
                            && !activeConv?.participants.some((p) => p.userId === u.id),
                    ),
                );
            } catch {
                // silently fail
            } finally {
                setPeopleSearchLoading(false);
            }
        }, 300);
    }, [currentUserId, activeConv]);

    const toggleSection = (key: string) => {
        setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // ── Render ──────────────────────────────────────────────────────

    return (
        <div className="chat-messenger-shell h-full w-full flex overflow-hidden">
            {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
            <aside className="w-[320px] shrink-0 border-r border-[var(--chat-card-border)] bg-[var(--chat-sidebar-bg)] flex flex-col">
                {/* Header */}
                <div className="h-14 px-4 border-b border-[var(--chat-card-border)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-[var(--chat-accent)]" />
                        <h2 className="font-bold text-[var(--chat-text-primary)] text-base">Chats</h2>
                    </div>
                    <button
                        onClick={() => setShowNewChat(true)}
                        className="p-1.5 rounded-full text-[var(--chat-text-muted)] hover:bg-[var(--chat-card-hover)] hover:text-[var(--chat-accent)] transition-colors"
                        title="New Chat"
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
                        {connected ? 'Live updates connected' : 'Reconnecting live updates'}
                    </span>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto">
                    {sidebarLoading ? (
                        <div className="flex flex-col gap-2 px-3 py-2">
                            <SkeletonMessageRow />
                            <SkeletonMessageRow />
                            <SkeletonMessageRow />
                            <SkeletonMessageRow />
                        </div>
                    ) : sidebarLoading ? (
                        <div className="px-4 py-12 text-center">
                            <MessageSquare className="w-8 h-8 mx-auto mb-3 text-[var(--chat-text-muted)]" />
                            <p className="text-sm text-[var(--chat-text-secondary)] font-medium">
                                No conversations yet
                            </p>
                            <p className="text-xs text-[var(--chat-text-muted)] mt-1">
                                Start a new chat to begin messaging.
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
                                            <img
                                                src={conv.participants[0].profilePictureUrl}
                                                alt=""
                                                className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : (
                                            getAvatarLetter(conv, currentUserId)
                                        )}
                                        {/* Online dot — show for DIRECT conversations */}
                                        {conv.contextType === 'DIRECT' && (
                                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--chat-sidebar-bg)] bg-[var(--chat-online)]" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline gap-2">
                                            <h3 className="font-semibold text-[var(--chat-text-primary)] text-sm truncate">
                                                {getDisplayName(conv, currentUserId)}
                                            </h3>
                                            <span className="text-[10px] text-[var(--chat-text-muted)] shrink-0">
                                                {formatTime(conv.lastMessageAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {/* Delivery status tick */}
                                            {fromMe && conv.lastMessage && (
                                                <span className="shrink-0">
                                                    <span title="Saved" aria-label="Saved"><Check className="w-3.5 h-3.5 text-[var(--chat-text-muted)]" /></span>
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
                                                    conv.lastMessage || 'No messages yet'
                                                )}
                                            </p>

                                            {conv.unreadCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--chat-accent)] text-white text-[10px] font-bold leading-none">
                                                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </aside>

            {/* ── CHAT WINDOW ──────────────────────────────────── */}
            <section className="flex-1 flex flex-col bg-[var(--chat-surface)] min-w-0">
                {activeConv ? (
                    <>
                        {/* Header — clickable to toggle info panel */}
                        <div className="h-14 px-5 bg-[var(--chat-card)] border-b border-[var(--chat-card-border)] flex items-center justify-between shrink-0">
                            <button
                                onClick={() => setShowInfo(!showInfo)}
                                className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                            >
                                <div className="w-9 h-9 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-sm shrink-0">
                                    {isSharedConversation(activeConv) ? (
                                        <Users className="w-4 h-4" />
                                    ) : (
                                        getAvatarLetter(activeConv, currentUserId)
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-[var(--chat-text-primary)] text-sm truncate">
                                        {getDisplayName(activeConv, currentUserId)}
                                    </h3>
                                    <p className="text-[11px] text-[var(--chat-text-muted)]">
                                        {isSharedConversation(activeConv)
                                            ? `${activeConv.participantCount} members`
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
                                title="Conversation info"
                            >
                                <Info className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div ref={messageViewportRef} role="log" aria-label="Conversation messages" className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center flex-1 gap-2 text-[var(--chat-text-muted)]">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Loading messages...</span>
                                </div>
                            ) : activeMessages.length === 0 ? (
                                <div className="flex items-center justify-center flex-1">
                                    <p className="text-sm text-[var(--chat-text-muted)]">
                                        No messages yet. Say hello!
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
                                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                            </div>
                                            <span className="text-[10px] text-[var(--chat-text-muted)] mt-0.5 mx-1">
                                                {formatTime(msg.createdAt)}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="px-4 py-3 bg-[var(--chat-card)] border-t border-[var(--chat-card-border)] shrink-0">
                            {deliveryError && <p role="alert" className="mb-2 text-sm text-amber-300">{deliveryError}</p>}
                            <form onSubmit={sendMessage} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    disabled={sending}
                                    placeholder={
                                        sending ? 'Sending...' : 'Type a message...'
                                    }
                                    className="flex-1 bg-[var(--chat-input-bg)] border border-[var(--chat-card-border)] text-[var(--chat-text-primary)] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--chat-accent)]/40 transition-all disabled:opacity-50 placeholder:text-[var(--chat-text-placeholder)]"
                                />

                                {/* Emoji button removed — chat API is text-only; no emoji/attachment support (P1 W6) */}

                                <button
                                    type="submit"
                                    aria-label="Send message"
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
                                Your Messages
                            </h3>
                            <p className="text-sm text-[var(--chat-text-muted)] mt-1 max-w-xs">
                                {sidebarLoading
                                    ? 'Start a new chat to begin messaging with other users.'
                                    : 'Select a conversation from the sidebar or start a new one.'}
                            </p>
                            <button
                                onClick={() => setShowNewChat(true)}
                                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--chat-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--chat-accent-contrast)] transition-colors hover:bg-[var(--chat-accent-hover)]"
                            >
                                <Plus className="w-4 h-4" />
                                New Chat
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* ── INFO / MANAGEMENT DRAWER ──────────────────────── */}
            {activeConv && (
                <aside className={`shrink-0 bg-[var(--chat-card)] border-l border-[var(--chat-card-border)] flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
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
                            className="p-1.5 rounded-full text-[var(--chat-text-muted)] hover:bg-[var(--chat-card-hover)] transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <h2 className="font-semibold text-[var(--chat-text-primary)] text-sm">
                            {activeConv.contextType === 'GROUP'
                                ? 'Group Settings'
                                : activeConv.contextType === 'MATCH_CHALLENGE'
                                    ? 'Match Chat Info'
                                    : 'Conversation Info'}
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {/* Error */}
                        {managementError && (
                            <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-600 text-xs">
                                {managementError}
                                <button onClick={() => setManagementError(null)} className="ml-2 underline">Dismiss</button>
                            </div>
                        )}

                        {/* ── Participants ────────────────────── */}
                        <div className="p-4">
                            <button
                                onClick={() => toggleSection('participants')}
                                className="w-full flex items-center justify-between mb-3"
                            >
                                <h3 className="text-xs font-semibold uppercase text-[var(--chat-text-muted)] tracking-wide">
                                    Participants · {activeConv.participantCount}
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
                                                        <img
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
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[9px] font-bold uppercase tracking-wider">
                                                                <Crown className="w-2.5 h-2.5" />
                                                                Admin
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isMe && (
                                                        <p className="text-[10px] text-[var(--chat-text-muted)]">You</p>
                                                    )}
                                                </div>

                                                {/* Creator actions for non-self, non-creator participants */}
                                                {isCreator && !isMe && !isParticipantCreator && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleKickUser(p.userId, p.displayName)}
                                                            title="Remove"
                                                            className="p-1 rounded text-[var(--chat-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                        >
                                                            <UserMinus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleBlockUser(p.userId, p.displayName)}
                                                            title="Block"
                                                            className="p-1 rounded text-[var(--chat-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
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
                                                setPeopleSearchResults([]);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-full border border-[var(--chat-card-border)] text-[var(--chat-text-secondary)] text-xs font-semibold hover:bg-[var(--chat-card-hover)] transition-colors"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            Add People
                                        </button>
                                        {showAddPeople && (
                                            <div className="mt-2">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--chat-text-muted)]" />
                                                    <input
                                                        type="text"
                                                        value={peopleSearchQuery}
                                                        onChange={(e) => {
                                                            setPeopleSearchQuery(e.target.value);
                                                            searchPeople(e.target.value);
                                                        }}
                                                        placeholder="Search users..."
                                                        className="w-full pl-8 pr-3 py-1.5 rounded-full border border-[var(--chat-card-border)] bg-[var(--chat-input-bg)] text-[var(--chat-text-primary)] text-xs placeholder:text-[var(--chat-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--chat-accent)]/40"
                                                    />
                                                </div>
                                                {peopleSearchLoading && (
                                                    <div className="flex justify-center py-2">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--chat-text-muted)]" />
                                                    </div>
                                                )}
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
                                            setPeopleSearchResults([]);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-full border border-[var(--chat-card-border)] text-[var(--chat-text-secondary)] text-xs font-semibold hover:bg-[var(--chat-card-hover)] transition-colors"
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Suggest Someone
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
                                                onChange={(e) => {
                                                    setPeopleSearchQuery(e.target.value);
                                                    searchPeople(e.target.value);
                                                }}
                                                placeholder="Search users..."
                                                className="w-full pl-8 pr-3 py-1.5 rounded-full border border-[var(--chat-card-border)] bg-[var(--chat-input-bg)] text-[var(--chat-text-primary)] text-xs placeholder:text-[var(--chat-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--chat-accent)]/40"
                                            />
                                        </div>
                                        {peopleSearchLoading && (
                                            <div className="flex justify-center py-2">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--chat-text-muted)]" />
                                            </div>
                                        )}
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
                                        Invite Suggestions
                                        {suggestions.length > 0 && (
                                            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500/15 text-amber-600 text-[9px] font-bold">
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
                                        ) : suggestions.length === 0 ? (
                                            <p className="text-xs text-[var(--chat-text-muted)] mt-2 py-2 text-center">
                                                No pending suggestions.
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
                                                                Suggested by {s.suggestedByDisplayName}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={() => handleApproveSuggestion(s.id)}
                                                                className="p-1 rounded-full text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                                                                title="Approve"
                                                            >
                                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectSuggestion(s.id)}
                                                                className="p-1 rounded-full text-red-400 hover:bg-red-500/10 transition-colors"
                                                                title="Reject"
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
                            onClick={async () => {
                                await chatApi.leaveConversation(activeConv.id);
                                setActiveConvId(null);
                                setShowInfo(false);
                                setShowAddPeople(false);
                                setShowSuggestUser(false);
                                await loadConversations();
                            }}
                            className="w-full py-2 px-4 rounded-full border border-red-500/30 text-red-500 text-sm font-semibold hover:bg-red-500/10 transition-colors"
                        >
                            Leave {activeConv.contextType === 'GROUP'
                                ? 'Group'
                                : activeConv.contextType === 'MATCH_CHALLENGE'
                                    ? 'Match Chat'
                                    : 'Conversation'}
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
