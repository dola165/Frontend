import { Check, Circle, MessageSquare, Plus, Users } from 'lucide-react';
import type { ConversationDto } from '../../api/chat';
import type { AuthSessionId } from '../../utils/authStorage';
import { SquadInboxList } from '../../features/squadCommunication/SquadInbox';
import { MediaImage } from '../ui/MediaImage';
import { SkeletonMessageRow } from '../ui/SkeletonCard';
import { conversationName, useMessageCopy } from './messageCopy';
import { formatTime, isSharedConversation } from './messengerFormat';

type ConversationListProps = {
    sessionId: AuthSessionId; currentUserId: number; squadId: number | null; connected: boolean;
    conversations: ConversationDto[]; activeConvId: number | null; sidebarLoading: boolean; listFailed: boolean;
    openError: string | null; hasMore: boolean; loadingMore: boolean;
    onNewChat: () => void; onSelect: (id: number) => void; onRetryList: () => void; onRetryOpen: () => void; onLoadMore: () => void;
};

/** One inbox: squad rooms first (with their membership checks), then every other conversation. */
export const ConversationList = ({ sessionId, currentUserId, squadId, connected, conversations, activeConvId, sidebarLoading,
    listFailed, openError, hasMore, loadingMore, onNewChat, onSelect, onRetryList, onRetryOpen, onLoadMore }: ConversationListProps) => {
    const copy = useMessageCopy();
    return (
        <aside className="messages-sidebar w-[320px] shrink-0 border-r border-[var(--chat-card-border)] bg-[var(--chat-sidebar-bg)] flex flex-col">
            {/* Header */}
            <div className="h-14 px-4 border-b border-[var(--chat-card-border)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[var(--chat-accent)]" />
                    <h2 className="font-bold text-[var(--chat-text-primary)] text-base">{copy('Chats', 'ჩატები')}</h2>
                </div>
                <button
                    onClick={onNewChat}
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
                {listFailed && <div className="px-4 py-3"><p role="alert">{copy('Conversations couldn’t load.', 'საუბრები ვერ ჩაიტვირთა.')}</p><button className="gk-btn gk-btn--sm" onClick={onRetryList}>{copy('Try again', 'ხელახლა ცდა')}</button></div>}
                {openError && <div className="px-4 py-3"><p role="alert">{copy(openError)}</p><button className="gk-btn gk-btn--sm" onClick={onRetryOpen}>{copy('Try again', 'ხელახლა ცდა')}</button></div>}
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
                    conversations.map((conv) => (
                        <ConversationRow key={conv.id} conv={conv} active={conv.id === activeConvId} currentUserId={currentUserId} onSelect={onSelect} />
                    ))
                )}
                {hasMore && <button type="button" className="gk-btn gk-btn--sm w-full min-h-11" disabled={loadingMore}
                    onClick={onLoadMore}>
                    {loadingMore ? copy('Loading conversations…', 'მიმოწერები იტვირთება…') : copy('Load more conversations', 'მეტი მიმოწერის ჩატვირთვა')}
                </button>}
            </div>
        </aside>
    );
};

const ConversationRow = ({ conv, active, currentUserId, onSelect }: {
    conv: ConversationDto; active: boolean; currentUserId: number; onSelect: (id: number) => void;
}) => {
    const copy = useMessageCopy();
    // Check if the last message in a conversation was sent by the current user
    const fromMe = conv.lastMessageSenderId === currentUserId;
    const showSenderPreview = isSharedConversation(conv) && conv.lastMessage && conv.lastMessageSenderName;
    return (
        <button
            onClick={() => onSelect(conv.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-[3px] ${
                active
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
                                {conv.lastMessage || copy('Sent a file', 'გაიგზავნა ფაილი')}
                            </>
                        ) : (
                            conv.lastMessage || (conv.lastMessageAt ? copy('Sent a file', 'გაიგზავნა ფაილი') : copy('No messages yet', 'შეტყობინებები ჯერ არ არის'))
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
};
