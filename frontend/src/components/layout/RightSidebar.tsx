import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BriefcaseBusiness,
    DollarSign,
    ExternalLink,
    HeartHandshake,
    MessageCircle,
    Minus,
    Send,
    ShoppingBag,
    X
} from 'lucide-react';
import { chatApi, type ChatMessageResponse, type ConversationDto, type ParticipantInfo } from '../../api/chat';
import { fetchStoreCatalogPage } from '../../features/store/api';
import { useChatWebSocket } from '../../hooks/useChatWebSocket';
import { getStoredUserId } from '../../utils/authStorage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

type DiscoveryTab = 'store' | 'jobs' | 'campaigns';

interface ContactConversation {
    conversation: ConversationDto;
    participant: ParticipantInfo;
}

const discoveryTabs: Array<{
    id: DiscoveryTab;
    label: string;
    subtitle: string;
    path: string;
    icon: typeof ShoppingBag;
    accent: string;
    border: string;
    soft: string;
}> = [
    { id: 'campaigns', label: 'Fundraising / Campaigns', subtitle: 'Support club and grassroots projects', path: '/campaigns', icon: HeartHandshake, accent: 'text-emerald-400', border: 'border-emerald-500/55', soft: 'bg-emerald-500/[0.07]' },
    { id: 'jobs', label: 'Jobs & Volunteering', subtitle: 'Roles around the football community', path: '/jobs', icon: BriefcaseBusiness, accent: 'text-fuchsia-300', border: 'border-fuchsia-400/45', soft: 'bg-fuchsia-400/[0.06]' },
    { id: 'store', label: 'Club Store', subtitle: 'Kits, training gear and equipment', path: '/store', icon: ShoppingBag, accent: 'text-amber-300', border: 'border-amber-400/60', soft: 'bg-amber-400/[0.06]' }
];

const formatMessageTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const RightSidebar = () => {
    const [activeTab, setActiveTab] = useState<DiscoveryTab>('store');
    const [storeCount, setStoreCount] = useState(0);
    const [conversations, setConversations] = useState<ConversationDto[]>([]);
    const [quickChat, setQuickChat] = useState<ContactConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const messageEndRef = useRef<HTMLDivElement | null>(null);
    const currentUserId = Number(getStoredUserId() || 0);

    const handleIncomingMessage = useCallback((message: ChatMessageResponse) => {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    }, []);
    const { connected, setActiveConversation, sendMessage } = useChatWebSocket(handleIncomingMessage);

    useEffect(() => {
        let active = true;
        Promise.all([
            fetchStoreCatalogPage(0, 3).catch(() => ({ content: [], totalElements: 0 })),
            chatApi.getConversations(0, 8).then((response) => response.data).catch(() => ({ content: [], pageNumber: 0, pageSize: 8, totalElements: 0 }))
        ]).then(([catalog, conversationPage]) => {
            if (!active) return;
            setStoreCount(catalog.totalElements ?? catalog.content?.length ?? 0);
            setConversations(conversationPage.content ?? []);
        });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, minimized]);

    useEffect(() => () => setActiveConversation(null), [setActiveConversation]);

    const contacts = useMemo(() => {
        const seen = new Set<number>();
        return conversations.flatMap<ContactConversation>((conversation) => {
            const participant = conversation.participants.find((entry) => entry.userId !== currentUserId);
            if (!participant || seen.has(participant.userId)) return [];
            seen.add(participant.userId);
            return [{ conversation, participant }];
        }).slice(0, 6);
    }, [conversations, currentUserId]);

    const openQuickChat = async (contact: ContactConversation) => {
        setQuickChat(contact);
        setMinimized(false);
        setMessages([]);
        setMessagesLoading(true);
        setActiveConversation(contact.conversation.id);
        try {
            const response = await chatApi.getMessages(contact.conversation.id, 0, 30);
            setMessages([...response.data.content].reverse());
            await chatApi.markAsRead(contact.conversation.id).catch(() => undefined);
        } catch (error) {
            console.error('Failed to load quick chat', error);
        } finally {
            setMessagesLoading(false);
        }
    };

    const closeQuickChat = () => {
        setQuickChat(null);
        setMessages([]);
        setMessageInput('');
        setActiveConversation(null);
    };

    const submitQuickMessage = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!quickChat || !messageInput.trim() || !connected) return;
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}') as { fullName?: string; username?: string };
        const content = messageInput.trim();
        const sent = await sendMessage(quickChat.conversation.id, content, storedUser.fullName || storedUser.username || 'Me');
        if (sent) setMessageInput('');
    };

    const activeDiscovery = discoveryTabs.find((tab) => tab.id === activeTab) ?? discoveryTabs[2];

    return (
        <>
            <aside className="hidden xl:block">
                <div className="sticky top-[calc(var(--app-header-height)+20px)] space-y-5">
                    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#090b0e] shadow-[var(--feed-shadow-panel)]" aria-labelledby="opportunities-heading">
                        <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-4">
                            <DollarSign className="h-4 w-4 text-emerald-400" />
                            <h2 id="opportunities-heading" className="text-xs font-bold text-emerald-400">Opportunities</h2>
                        </div>

                        <div className="space-y-2.5 p-3" role="tablist" aria-label="Opportunities">
                            {discoveryTabs.map((tab) => {
                                const Icon = tab.icon;
                                const active = tab.id === activeTab;
                                const count = tab.id === 'store' ? storeCount : 0;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${tab.border} ${active ? tab.soft : 'bg-transparent hover:bg-white/[0.03]'}`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <Icon className={`h-4 w-4 ${tab.accent}`} />
                                            <span className={`min-w-0 flex-1 text-xs font-bold ${tab.accent}`}>{tab.label}</span>
                                            <span className={`text-xs font-bold ${tab.accent}`}>{count}</span>
                                        </span>
                                        <span className="mt-1.5 block truncate text-[11px] text-[#a1a1aa]">{tab.subtitle}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div role="tabpanel" className="border-t border-white/[0.08] p-3">
                            <Link to={activeDiscovery.path} className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-xs font-bold transition-colors hover:bg-white/[0.04] ${activeDiscovery.border} ${activeDiscovery.accent}`}>
                                Open {activeDiscovery.label}
                                <ArrowRight className="h-3.5 w-3.5" />
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
                        <Link to={`/messages?chatWith=${quickChat.participant.userId}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white" aria-label="Open full conversation" title="Open full conversation">
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
                            <div className="flex h-64 flex-col gap-2 overflow-y-auto bg-[#181a1f] px-3 py-3">
                                {messagesLoading ? (
                                    <p className="my-auto text-center text-xs text-[#71717a]">Loading conversation…</p>
                                ) : messages.length === 0 ? (
                                    <p className="my-auto text-center text-xs text-[#71717a]">Start this conversation here.</p>
                                ) : messages.map((message) => {
                                    const mine = message.senderId === currentUserId;
                                    return (
                                        <div key={message.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                                            <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-5 ${mine ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm bg-[#30343b] text-[#f4f4f5]'}`}>
                                                {message.content}
                                            </div>
                                            <span className="mt-0.5 px-1 text-[9px] text-[#71717a]">{formatMessageTime(message.createdAt)}</span>
                                        </div>
                                    );
                                })}
                                <div ref={messageEndRef} />
                            </div>
                            <form onSubmit={(event) => void submitQuickMessage(event)} className="flex items-center gap-2 border-t border-white/[0.08] bg-[#202328] p-3">
                                <input value={messageInput} onChange={(event) => setMessageInput(event.target.value)} disabled={!connected} placeholder={connected ? 'Write a message…' : 'Connecting…'} className="min-w-0 flex-1 rounded-full border border-white/[0.08] bg-[#30343b] px-3 py-2 text-xs text-white outline-none placeholder:text-[#8b8d94] focus:border-emerald-500/60" />
                                <button type="submit" disabled={!connected || !messageInput.trim()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40" aria-label="Send message">
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
