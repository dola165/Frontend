import { OpportunityLink } from '../ui/OpportunityLink';
import { MotionPanel } from '../ui/MotionPanel';
import { MotionDisclosure } from '../ui/MotionDisclosure';
import { MessageText } from '../chat/MessageText';
import { MessageActions } from '../chat/MessageActions';
import { ConversationIntakeContext } from '../chat/ConversationIntakeContext';
import { formatTime } from '../../utils/formatting';
import { MediaImage } from '../ui/MediaImage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ExternalLink,
    MessageCircle,
    Minus,
    Send,
    X
} from 'lucide-react';
import { chatApi, type ChatMessageResponse, type ConversationDto, type ParticipantInfo } from '../../api/chat';
import { useMessageDraft } from '../chat/useMessageDraft';
import { useChatWebSocket, mergeMessages } from '../../hooks/useChatWebSocket';
import { useChatReadReceipts } from '../../hooks/useChatReadReceipts';
import { useChatScroll } from '../../hooks/useChatScroll';
import { OlderMessages } from '../../components/chat/OlderMessages';
import { getStoredUserId } from '../../utils/authStorage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { useAuth } from '../../context/AuthContext';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import './side-links.css';

interface ContactConversation {
    conversation: ConversationDto;
    participant: ParticipantInfo;
}

const formatMessageTime = (iso: string) => formatTime(iso);

export const RightSidebar = () => {
    const { isAuthenticated, sessionId } = useAuth();
    if (!isAuthenticated) return null;
    return <AuthenticatedRightSidebar key={sessionId ?? 'legacy'} sessionId={sessionId} />;
};

const AuthenticatedRightSidebar = ({ sessionId }: { sessionId: AuthSessionId }) => {
    const copy = useJourneyCopy();
    const [conversations, setConversations] = useState<ConversationDto[]>([]);
    const [quickChat, setQuickChat] = useState<ContactConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
    const { input: messageInput, setInput: setMessageInput, confirmDraft } = useMessageDraft(quickChat?.conversation.id ?? null);
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

    useEffect(() => {
        const controller = new AbortController();
        chatApi.getConversations(0, 8, { signal: controller.signal, _authSessionId: sessionId })
        .then((response) => response.data)
        .catch(() => ({ content: [], pageNumber: 0, pageSize: 8, totalElements: 0 }))
        .then((conversationPage) => {
            if (controller.signal.aborted || !isCurrentAuthSession(sessionId)) return;
            setConversations(conversationPage.content ?? []);
        });
        return () => {
            controller.abort();
        };
    }, [sessionId]);


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
        setQuickChat(contact);
        setMinimized(false);
        setMessages([]);
        void setActiveConversation(contact.conversation.id);
    };

    const closeQuickChat = () => {
        setQuickChat(null);
        setMessages([]);
        void setActiveConversation(null);
    };

    const submitQuickMessage = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!quickChat || !messageInput.trim() || sending) return;
        const content = messageInput;
        const sent = await sendMessage(quickChat.conversation.id, content);
        if (sent) {
            confirmDraft(quickChat.conversation.id, content);
        }
    };

    return (
        <>
            <aside className="home-side-rail home-side-rail--right hidden xl:block" aria-label={copy('Store, jobs, fundraising and contacts', 'მაღაზია, სამუშაო, ფონდები და კონტაქტები')}>
                <div className="home-side-scroll space-y-5">
                    {/* The global store, jobs and fundraising: plain names here, "Club store" and friends only on a club's page. */}
                    <nav className="home-rail-card home-opportunities-card" aria-label={copy('Store, jobs and fundraising', 'მაღაზია, სამუშაო და ფონდების მოზიდვა')}>
                        <div className="space-y-2.5 p-3">
                            <OpportunityLink kind="store" to="/store" description={copy('Kit & merchandise from clubs', 'ფორმა და ნივთები კლუბებისგან')} />
                            <OpportunityLink kind="jobs" to="/jobs" description={copy('Work and volunteer in football', 'იმუშავეთ ან იყავით მოხალისე ფეხბურთში')} />
                            <OpportunityLink kind="campaigns" to="/campaigns" description={copy('Support club projects', 'დაუჭირეთ მხარი კლუბის პროექტებს')} />
                        </div>
                    </nav>

                    <section aria-labelledby="contacts-heading" className="home-rail-card home-contacts-card">
                        <div className="flex items-center border-b border-[var(--feed-card-border)] px-2 pb-3">
                            <h2 id="contacts-heading" className="text-xs font-black uppercase tracking-[0.16em] text-[var(--feed-text-primary)]">{copy('Recent contacts', 'ბოლო კონტაქტები')}</h2>
                            <Link to="/messages" className="home-contacts-all">{copy('View all', 'ყველა')}</Link>
                        </div>
                        {contacts.length > 0 ? (
                            <div>
                                {contacts.map((contact) => {
                                    const avatarUrl = resolveMediaUrl(contact.participant.profilePictureUrl);
                                    return (
                                        <button key={contact.conversation.id} type="button" onClick={() => void openQuickChat(contact)} className="feed-side-link recent-contact-link w-full text-left">
                                            <span className="flex min-w-0 items-center gap-3">
                                                <span className="feed-side-link__visual feed-side-link__visual--avatar">
                                                    {avatarUrl ? <MediaImage src={avatarUrl} alt="" className="h-full w-full object-cover" /> : contact.participant.displayName.substring(0, 2).toUpperCase()}
                                                </span>
                                                <span className="feed-side-link__title">{contact.participant.displayName}</span>
                                            </span>
                                            <MessageCircle size={16} aria-hidden="true" className="home-contact-action" />
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <Link to="/messages" className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--feed-card-border)] px-3 py-3 text-xs text-[var(--feed-text-secondary)] hover:border-[var(--feed-accent-border)] hover:text-[var(--feed-text-primary)]">
                                <MessageCircle className="h-4 w-4 text-[var(--feed-accent)]" />
                                {copy('Start a conversation', 'დაიწყეთ საუბარი')}
                            </Link>
                        )}
                    </section>
                </div>
            </aside>


            {quickChat && (
                <MotionPanel label={copy(`Chat with ${quickChat.participant.displayName}`, `ჩატი: ${quickChat.participant.displayName}`)} onClose={closeQuickChat} className="fixed bottom-4 right-4 z-[1300] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[color:var(--color-border)]/10 bg-[var(--color-surface)] shadow-2xl">{close => <>
                    <header className="flex h-12 items-center gap-2 border-b border-[color:var(--color-border)]/[0.08] px-3">
                        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[var(--color-inset)] text-[10px] font-bold text-[color:var(--color-text)]">
                            {resolveMediaUrl(quickChat.participant.profilePictureUrl)
                                ? <MediaImage src={resolveMediaUrl(quickChat.participant.profilePictureUrl) ?? ''} alt="" className="h-full w-full object-cover" />
                                : quickChat.participant.displayName.substring(0, 2).toUpperCase()}
                        </span>
                        <button type="button" onClick={() => setMinimized((value) => !value)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[color:var(--color-text)]">
                            {quickChat.participant.displayName}
                        </button>
                        <Link to={`/messages?conversationId=${quickChat.conversation.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-secondary)] hover:bg-[color:var(--color-ink)]/[0.06] hover:text-[color:var(--color-text)]" aria-label={copy('Open full conversation', 'სრული საუბრის გახსნა')} title={copy('Open full conversation', 'სრული საუბრის გახსნა')}>
                            <ExternalLink className="h-4 w-4" />
                        </Link>
                        <button type="button" onClick={() => setMinimized((value) => !value)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-secondary)] hover:bg-[color:var(--color-ink)]/[0.06] hover:text-[color:var(--color-text)]" aria-label={minimized ? copy('Restore chat', 'ჩატის აღდგენა') : copy('Minimize chat', 'ჩატის ჩაკეცვა')}>
                            <Minus className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={close} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-secondary)] hover:bg-[color:var(--color-ink)]/[0.06] hover:text-[color:var(--color-text)]" aria-label={copy('Close chat', 'ჩატის დახურვა')}>
                            <X className="h-4 w-4" />
                        </button>
                    </header>

                    <MotionDisclosure open={!minimized} className="quick-chat-body">
                        <>
                            <ConversationIntakeContext key={`${sessionId}:${quickChat.conversation.id}`} conversationId={quickChat.conversation.id} messageRevision={messages.at(-1)?.id ?? quickChat.conversation.lastMessageAt ?? ''} />
                            <div ref={messageViewportRef} style={{ overflowAnchor: 'none' }} role="log" aria-label={copy('Quick chat messages', 'ჩატის შეტყობინებები')} className="flex h-64 flex-col gap-2 overflow-y-auto bg-[var(--color-surface)] px-3 py-3">
                                {!messagesLoading && <OlderMessages available={hasOlder} loading={loadingOlder} error={historyError} onLoad={loadOlder} />}
                                {messagesLoading ? (
                                    <p className="my-auto text-center text-xs text-[var(--color-secondary)]">{copy('Loading conversation…', 'საუბარი იტვირთება…')}</p>
                                ) : messages.length === 0 ? (
                                    <p className="my-auto text-center text-xs text-[var(--color-secondary)]">{copy('Start this conversation here.', 'დაიწყეთ საუბარი აქ.')}</p>
                                ) : messages.map((message) => {
                                    const mine = message.senderId === currentUserId;
                                    return (
                                        <div key={message.id} data-chat-message-id={message.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                                            <div data-chat-message-content className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-5 ${mine ? 'rounded-br-sm bg-[color:var(--color-accent)] text-[color:var(--color-on-accent)]' : 'rounded-bl-sm bg-[var(--color-inset)] text-[var(--color-text)]'}`}>
                                                <MessageText text={message.content} />
                                            </div>
                                            <span className="mt-0.5 px-1 text-[9px] text-[var(--color-secondary)]">{formatMessageTime(message.createdAt)}</span>
                                            {!mine && <MessageActions messageId={message.id} conversationId={message.conversationId} senderId={message.senderId} />}
                                        </div>
                                    );
                                })}
                            </div>
                            {deliveryError && <p role="alert" className="px-3 text-xs text-[color:var(--color-warning)]">{deliveryError}</p>}
                            <form onSubmit={(event) => void submitQuickMessage(event)} className="flex items-center gap-2 border-t border-[color:var(--color-border)]/[0.08] bg-[var(--color-surface)] p-3">
                                <input value={messageInput} onChange={(event) => setMessageInput(event.target.value)} disabled={sending} placeholder={sending ? copy('Sending…', 'იგზავნება…') : copy('Write a message…', 'დაწერეთ შეტყობინება…')} className="min-w-0 flex-1 rounded-full border border-[color:var(--color-border)]/[0.08] bg-[var(--color-inset)] px-3 py-2 text-xs text-[color:var(--color-text)] outline-none placeholder:text-[var(--color-secondary)] focus:border-[color:var(--color-accent)]/60" />
                                <button type="submit" disabled={sending || !messageInput.trim()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-on-accent)] transition-colors hover:bg-[color:var(--color-accent)] disabled:opacity-40" aria-label={copy('Send message', 'გაგზავნა')}>
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                        </>
                    </MotionDisclosure>
                </>}</MotionPanel>
            )}
        </>
    );
};
