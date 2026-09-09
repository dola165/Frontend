import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BriefcaseBusiness,
    Building2,
    ShoppingBag,
    ExternalLink,
    MessageCircle,
    Minus,
    Send,
    X
} from 'lucide-react';
import { chatApi, type ChatMessageResponse, type ConversationDto, type ParticipantInfo } from '../../api/chat';
import { useChatWebSocket, mergeMessages } from '../../hooks/useChatWebSocket';
import { useChatReadReceipts } from '../../hooks/useChatReadReceipts';
import { useChatScroll } from '../../hooks/useChatScroll';
import { OlderMessages } from '../../components/chat/OlderMessages';
import { getStoredUserId } from '../../utils/authStorage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface ContactConversation {
    conversation: ConversationDto;
    participant: ParticipantInfo;
}

const formatMessageTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const RightSidebar = () => {
    const [conversations, setConversations] = useState<ConversationDto[]>([]);
    const [quickChat, setQuickChat] = useState<ContactConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [minimized, setMinimized] = useState(false);
    const messageViewportRef = useRef<HTMLDivElement | null>(null);
    const currentUserId = Number(getStoredUserId() || 0);

    const handleIncomingMessage = useCallback((message: ChatMessageResponse) => {
        setMessages((current) => mergeMessages(current, [message]));
    }, []);
    const clearUnavailable = useCallback(() => setMessages([]), []);
    const { setActiveConversation, sendMessage, loading: messagesLoading, error: deliveryError, sending, loadOlder, hasOlder, loadingOlder, historyError } = useChatWebSocket(handleIncomingMessage, clearUnavailable, true);
    useChatScroll(messageViewportRef, quickChat?.conversation.id ?? null, !minimized && !messagesLoading);
    useChatReadReceipts(quickChat?.conversation.id ?? null, !minimized && !messagesLoading, messages, messageViewportRef);
    const draftRef = useRef<Record<number, string>>({});
    const activeId = useRef<number | null>(null);

    useEffect(() => {
        let active = true;
        chatApi.getConversations(0, 8)
        .then((response) => response.data)
        .catch(() => ({ content: [], pageNumber: 0, pageSize: 8, totalElements: 0 }))
        .then((conversationPage) => {
            if (!active) return;
            setConversations(conversationPage.content ?? []);
        });
        return () => {
            active = false;
        };
    }, []);


    useEffect(() => () => { void setActiveConversation(null); }, [setActiveConversation]);

    const contacts = useMemo(() => {
        const seen = new Set<number>();
        return conversations.flatMap<ContactConversation>((conversation) => {
            const participant = conversation.participants.find((entry) => entry.userId !== currentUserId);
            if (!participant || seen.has(participant.userId)) return [];
            seen.add(participant.userId);
            return [{ conversation, participant }];
        }).slice(0, 6);
    }, [conversations, currentUserId]);

    const openQuickChat = (contact: ContactConversation) => {
        if (activeId.current !== null) draftRef.current[activeId.current] = messageInput;
        activeId.current = contact.conversation.id;
        setMessageInput(draftRef.current[contact.conversation.id] ?? '');
        setQuickChat(contact);
        setMinimized(false);
        setMessages([]);
        void setActiveConversation(contact.conversation.id);
    };

    const closeQuickChat = () => {
        if (activeId.current !== null) draftRef.current[activeId.current] = messageInput;
        activeId.current = null;
        setQuickChat(null);
        setMessages([]);
        setMessageInput('');
        void setActiveConversation(null);
    };

    const submitQuickMessage = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!quickChat || !messageInput.trim() || sending) return;
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}') as { fullName?: string; username?: string };
        const content = messageInput.trim();
        const sent = await sendMessage(quickChat.conversation.id, content, storedUser.fullName || storedUser.username || 'Me');
        if (sent) {
            draftRef.current[quickChat.conversation.id] = '';
            if (activeId.current === quickChat.conversation.id) setMessageInput(current => current.trim() === content ? '' : current);
        }
    };

    return (
        <>
            <aside className="hidden xl:block">
                <div className="sticky top-[calc(var(--app-header-height)+20px)] space-y-5">
                    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#090b0e] shadow-[var(--feed-shadow-panel)]" aria-labelledby="discover-heading">
                        <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-4">
                            <Building2 className="h-4 w-4 text-emerald-400" />
                            <h2 id="discover-heading" className="text-xs font-bold text-emerald-400">Opportunities</h2>
                        </div>

                        <div className="space-y-2.5 p-3" aria-label="Supported destinations">
                            <Link to="/store" className="block rounded-md border border-emerald-500/45 bg-emerald-500/[0.06] px-3 py-3 transition-colors hover:brightness-110">
                                <span className="flex items-center gap-2 text-xs font-bold text-emerald-300"><ShoppingBag className="h-4 w-4" />Store</span>
                                <span className="mt-1.5 block text-[11px] text-[#a1a1aa]">Browse club merchandise</span>
                            </Link>
                            <Link to="/jobs" className="block rounded-md border border-fuchsia-400/40 bg-fuchsia-400/[0.06] px-3 py-3 transition-colors hover:brightness-110">
                                <span className="flex items-center gap-2 text-xs font-bold text-fuchsia-300"><BriefcaseBusiness className="h-4 w-4" /><span className="flex-1">Jobs & volunteering</span><span className="rounded-full border border-amber-400/30 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-amber-300">Preview</span></span>
                                <span className="mt-1.5 block text-[11px] text-[#a1a1aa]">Roles published by football clubs</span>
                            </Link>
                        </div>
                    </section>

                    <section aria-labelledby="contacts-heading" className="border-t border-[var(--feed-card-border)] pt-4">
                        <div className="flex items-center border-b border-[var(--feed-card-border)] px-2 pb-3">
                            <h2 id="contacts-heading" className="text-xs font-black uppercase tracking-[0.16em] text-[var(--feed-text-primary)]">Recent contacts</h2>
                        </div>
                        {contacts.length > 0 ? (
                            <div>
                                {contacts.map((contact) => {
                                    const avatarUrl = resolveMediaUrl(contact.participant.profilePictureUrl);
                                    return (
                                        <button key={contact.conversation.id} type="button" onClick={() => void openQuickChat(contact)} className="feed-side-link recent-contact-link w-full text-left">
                                            <span className="flex min-w-0 items-center gap-3">
                                                <span className="feed-side-link__visual feed-side-link__visual--avatar">
                                                    {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : contact.participant.displayName.substring(0, 2).toUpperCase()}
                                                </span>
                                                <span className="feed-side-link__title">{contact.participant.displayName}</span>
                                            </span>
                                            <span className="h-2 w-2 rounded-full bg-[var(--feed-online)]" aria-hidden />
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <Link to="/messages" className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--feed-card-border)] px-3 py-3 text-xs text-[var(--feed-text-secondary)] hover:border-[var(--feed-accent-border)] hover:text-[var(--feed-text-primary)]">
                                <MessageCircle className="h-4 w-4 text-[var(--feed-accent)]" />
                                Start a conversation
                            </Link>
                        )}
                    </section>
                </div>
            </aside>

            {quickChat && (
                <section aria-label={`Chat with ${quickChat.participant.displayName}`} className="fixed bottom-4 right-4 z-[1300] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#202328] shadow-2xl">
                    <header className="flex h-12 items-center gap-2 border-b border-white/[0.08] px-3">
                        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#30343b] text-[10px] font-bold text-white">
                            {resolveMediaUrl(quickChat.participant.profilePictureUrl)
                                ? <img src={resolveMediaUrl(quickChat.participant.profilePictureUrl) ?? ''} alt="" className="h-full w-full object-cover" />
                                : quickChat.participant.displayName.substring(0, 2).toUpperCase()}
                        </span>
                        <button type="button" onClick={() => setMinimized((value) => !value)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-white">
                            {quickChat.participant.displayName}
                        </button>
                        <Link to={`/messages?conversationId=${quickChat.conversation.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white" aria-label="Open full conversation" title="Open full conversation">
                            <ExternalLink className="h-4 w-4" />
                        </Link>
                        <button type="button" onClick={() => setMinimized((value) => !value)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white" aria-label={minimized ? 'Restore chat' : 'Minimize chat'}>
                            <Minus className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={closeQuickChat} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white" aria-label="Close chat">
                            <X className="h-4 w-4" />
                        </button>
                    </header>

                    {!minimized && (
                        <>
                            <div ref={messageViewportRef} style={{ overflowAnchor: 'none' }} role="log" aria-label="Quick chat messages" className="flex h-64 flex-col gap-2 overflow-y-auto bg-[#181a1f] px-3 py-3">
                                {!messagesLoading && <OlderMessages available={hasOlder} loading={loadingOlder} error={historyError} onLoad={loadOlder} />}
                                {messagesLoading ? (
                                    <p className="my-auto text-center text-xs text-[#71717a]">Loading conversation…</p>
                                ) : messages.length === 0 ? (
                                    <p className="my-auto text-center text-xs text-[#71717a]">Start this conversation here.</p>
                                ) : messages.map((message) => {
                                    const mine = message.senderId === currentUserId;
                                    return (
                                        <div key={message.id} data-chat-message-id={message.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                                            <div data-chat-message-content className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-5 ${mine ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm bg-[#30343b] text-[#f4f4f5]'}`}>
                                                {message.content}
                                            </div>
                                            <span className="mt-0.5 px-1 text-[9px] text-[#71717a]">{formatMessageTime(message.createdAt)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {deliveryError && <p role="alert" className="px-3 text-xs text-amber-300">{deliveryError}</p>}
                            <form onSubmit={(event) => void submitQuickMessage(event)} className="flex items-center gap-2 border-t border-white/[0.08] bg-[#202328] p-3">
                                <input value={messageInput} onChange={(event) => setMessageInput(event.target.value)} disabled={sending} placeholder={sending ? 'Sending...' : 'Write a message...'} className="min-w-0 flex-1 rounded-full border border-white/[0.08] bg-[#30343b] px-3 py-2 text-xs text-white outline-none placeholder:text-[#8b8d94] focus:border-emerald-500/60" />
                                <button type="submit" disabled={sending || !messageInput.trim()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40" aria-label="Send message">
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                        </>
                    )}
                </section>
            )}
        </>
    );
};
