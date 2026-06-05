import { useEffect, useState, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { MessageSquare, Plus, Users, Info, X, Send, Circle, Search, Loader2, Crown, Ban, UserMinus, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { buildWebSocketUrl } from '../api/axiosConfig';
import { getStoredAccessToken, getStoredUserId } from '../utils/authStorage';
import { chatApi, type ConversationDto, type ChatMessageResponse, type InviteSuggestion, type UserSearchResult } from '../api/chat';
import { NewChatModal } from '../components/chat/NewChatModal';

const IS_MOCK_MODE = import.meta.env.VITE_ENABLE_MOCKS === 'true';

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
    if (conv.contextType === 'GROUP') return conv.name || 'Group';
    const other = conv.participants.find((p) => p.userId !== currentUserId);
    return other?.displayName || 'Unknown';
}

function getAvatarLetter(conv: ConversationDto, currentUserId: number): string {
    const name = getDisplayName(conv, currentUserId);
    return name.charAt(0).toUpperCase();
}

// ── Component ──────────────────────────────────────────────────────

export const MessagingPage = () => {
    const currentUserId = Number(getStoredUserId() || 0);
    const token = getStoredAccessToken();

    const [conversations, setConversations] = useState<ConversationDto[]>([]);
    const [activeConvId, setActiveConvId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Record<number, ChatMessageResponse[]>>({});
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sidebarLoading, setSidebarLoading] = useState(true);

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
    const peopleSearchRef = useRef<ReturnType<typeof setTimeout>>();

    const clientRef = useRef<Client | null>(null);
    const subRef = useRef<{ unsubscribe: () => void } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeConvRef = useRef<number | null>(null);

    // keep activeConvRef in sync
    activeConvRef.current = activeConvId;

    // ── Auto-scroll ─────────────────────────────────────────────────

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeConvId]);

    // ── Load conversations ──────────────────────────────────────────

    const loadConversations = useCallback(async () => {
        try {
            const res = await chatApi.getConversations();
            setConversations(res.data.content);
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

    useEffect(() => {
        if (!token) return;

        if (IS_MOCK_MODE) {
            setConnected(true);
            return;
        }

        const client = new Client({
            brokerURL: buildWebSocketUrl('/ws-chat'),
            connectHeaders: { Authorization: `Bearer ${token}` },
            reconnectDelay: 5000,
            onConnect: () => setConnected(true),
            onDisconnect: () => setConnected(false),
            onStompError: () => setConnected(false),
        });

        client.activate();
        clientRef.current = client;

        return () => {
            subRef.current?.unsubscribe();
            client.deactivate();
        };
    }, [token]);

    const subscribeToConv = useCallback(
        (convId: number) => {
            if (IS_MOCK_MODE) return;

            subRef.current?.unsubscribe();
            if (!clientRef.current?.connected) return;

            subRef.current = clientRef.current.subscribe(
                `/topic/chat.${convId}`,
                (msg) => {
                    const parsed = JSON.parse(msg.body) as ChatMessageResponse;
                    setMessages((prev) => ({
                        ...prev,
                        [convId]: [...(prev[convId] || []), parsed],
                    }));

                    // update sidebar: move this convo to top with latest message
                    setConversations((prev) => {
                        const updated = prev.map((c) =>
                            c.id === convId
                                ? {
                                      ...c,
                                      lastMessage: parsed.content,
                                      lastMessageSenderName: parsed.senderName,
                                      lastMessageAt: parsed.createdAt,
                                      unreadCount:
                                          activeConvRef.current === convId
                                              ? 0
                                              : c.unreadCount + 1,
                                  }
                                : c,
                        );
                        // sort by lastMessageAt desc
                        updated.sort((a, b) => {
                            const da = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                            const db = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                            return db - da;
                        });
                        return updated;
                    });
                },
            );
        },
        [],
    );

    // ── Select conversation ─────────────────────────────────────────

    const selectConversation = useCallback(
        async (convId: number) => {
            setActiveConvId(convId);
            setShowInfo(false);

            // subscribe to WebSocket for this conversation
            subscribeToConv(convId);

            // lazy-load messages if not already loaded
            if (!messages[convId]) {
                setLoadingMessages(true);
                try {
                    const res = await chatApi.getMessages(convId);
                    setMessages((prev) => ({
                        ...prev,
                        [convId]: [...res.data.content].reverse(),
                    }));
                } catch (e) {
                    console.error('Failed to load messages', e);
                } finally {
                    setLoadingMessages(false);
                }
            }

            // mark as read + clear unread in sidebar
            try {
                await chatApi.markAsRead(convId);
                setConversations((prev) =>
                    prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)),
                );
            } catch {
                // silently fail — read receipts are non-critical
            }
        },
        [messages, subscribeToConv],
    );

    // ── Send message ────────────────────────────────────────────────

    const sendMessage = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || !activeConvId) return;

        if (IS_MOCK_MODE) {
            const { mockSendMessage } = await import('../mocks/data/chatStore');
            const user = JSON.parse(localStorage.getItem('grasskickz_user') || '{}');
            const senderName = user?.fullName || user?.username || 'Me';
            const msg = mockSendMessage(activeConvId, currentUserId, senderName, input.trim());

            setMessages((prev) => ({
                ...prev,
                [activeConvId]: [...(prev[activeConvId] || []), msg],
            }));

            setConversations((prev) => {
                const updated = prev.map((c) =>
                    c.id === activeConvId
                        ? { ...c, lastMessage: msg.content, lastMessageSenderName: msg.senderName, lastMessageAt: msg.createdAt }
                        : c,
                );
                updated.sort((a, b) => {
                    const da = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                    const db = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                    return db - da;
                });
                return updated;
            });

            setInput('');
            return;
        }

        if (!clientRef.current?.connected) return;

        clientRef.current.publish({
            destination: '/app/chat.send',
            body: JSON.stringify({ conversationId: activeConvId, content: input.trim() }),
        });
        setInput('');
    }, [input, activeConvId, currentUserId]);

    // ── New conversation created ────────────────────────────────────

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
            const res = await chatApi.decideSuggestion(activeConvId, suggestionId, 'APPROVE');
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
                        {connected ? 'Connected' : 'Connecting...'}
                    </span>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto">
                    {sidebarLoading ? (
                        <div className="flex items-center justify-center py-12 gap-2 text-[var(--chat-text-muted)]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs">Loading chats...</span>
                        </div>
                    ) : conversations.length === 0 ? (
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
                                    <div className="w-11 h-11 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-sm shrink-0">
                                        {conv.contextType === 'GROUP' ? (
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
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-[var(--chat-text-muted)] truncate flex-1">
                                                {conv.lastMessage || 'No messages yet'}
                                            </p>
                                            {conv.unreadCount > 0 && (
                                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--chat-accent)] text-[var(--chat-accent-contrast)] text-[10px] font-bold leading-none">
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
                        {/* Header */}
                        <div className="h-14 px-5 bg-[var(--chat-card)] border-b border-[var(--chat-card-border)] flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-[var(--chat-accent)]/15 flex items-center justify-center text-[var(--chat-accent)] font-bold text-sm shrink-0">
                                    {activeConv.contextType === 'GROUP' ? (
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
                                        {activeConv.contextType === 'GROUP'
                                            ? `${activeConv.participantCount} members`
                                            : activeConv.participants[0]?.displayName || ''}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowInfo(!showInfo)}
                                className={`p-2 rounded-full transition-colors ${
                                    showInfo
                                        ? 'bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]'
                                        : 'text-[var(--chat-text-muted)] hover:bg-[var(--chat-card-hover)]'
                                }`}
                            >
                                <Info className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
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
                                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                        >
                                            {!isMe && activeConv.contextType === 'GROUP' && (
                                                <span className="text-[11px] font-semibold text-[var(--chat-text-secondary)] ml-1 mb-0.5">
                                                    {msg.senderName}
                                                </span>
                                            )}
                                            <div
                                                className={`px-3.5 py-2 rounded-2xl max-w-[70%] text-[15px] leading-relaxed ${
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
                            <form onSubmit={sendMessage} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    disabled={!connected}
                                    placeholder={
                                        connected ? 'Type a message...' : 'Connecting...'
                                    }
                                    className="flex-1 bg-[var(--chat-input-bg)] border border-[var(--chat-card-border)] text-[var(--chat-text-primary)] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--chat-accent)]/40 transition-all disabled:opacity-50 placeholder:text-[var(--chat-text-placeholder)]"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || !connected}
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
                                {conversations.length === 0
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
            {showInfo && activeConv && (
                <aside className="w-[300px] shrink-0 bg-[var(--chat-card)] border-l border-[var(--chat-card-border)] flex flex-col">
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
                            {activeConv.contextType === 'GROUP' ? 'Group Settings' : 'Conversation Info'}
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
                            Leave {activeConv.contextType === 'GROUP' ? 'Group' : 'Conversation'}
                        </button>
                    </div>
                </aside>
            )}

            {/* ── NEW CHAT MODAL ────────────────────────────────── */}
            <NewChatModal
                open={showNewChat}
                onClose={() => setShowNewChat(false)}
                onConversationCreated={handleConversationCreated}
            />
        </div>
    );
};
