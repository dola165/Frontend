import type { ReactNode, RefObject } from 'react';
import { Info, Loader2, MessageSquare, Plus, Users } from 'lucide-react';
import type { ChatMessageResponse, ConversationDto } from '../../api/chat';
import type { AuthSessionId } from '../../utils/authStorage';
import { ConversationIntakeContext } from './ConversationIntakeContext';
import { MessageActions } from './MessageActions';
import { MessageText } from './MessageText';
import { OlderMessages } from './OlderMessages';
import { conversationName, useMessageCopy } from './messageCopy';
import { formatTime, isSharedConversation } from './messengerFormat';

type ConversationThreadProps = {
    conversation: ConversationDto; sessionId: AuthSessionId; currentUserId: number; messages: ChatMessageResponse[];
    viewportRef: RefObject<HTMLDivElement | null>; loadingMessages: boolean; hasOlder: boolean; loadingOlder: boolean;
    historyError: string | null; loadOlder: () => Promise<void>; showInfo: boolean; onToggleInfo: () => void; onBack: () => void;
    children: ReactNode;
};

/** Header, intake context and message log of the selected conversation; the composer comes in as children. */
export const ConversationThread = ({ conversation: activeConv, sessionId, currentUserId, messages: activeMessages, viewportRef,
    loadingMessages, hasOlder, loadingOlder, historyError, loadOlder, showInfo, onToggleInfo, onBack, children }: ConversationThreadProps) => {
    const copy = useMessageCopy();
    return (
        <>
            {/* Header — clickable to toggle info panel */}
            <div className="h-14 px-5 bg-[var(--chat-card)] border-b border-[var(--chat-card-border)] flex items-center justify-between shrink-0">
                <button className="messages-mobile-back" onClick={onBack} aria-label={copy('Back to all messages', 'ყველა შეტყობინებაზე დაბრუნება')}>← {copy('Chats', 'ჩატები')}</button>
                <button
                    onClick={onToggleInfo}
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
                    onClick={onToggleInfo}
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
            <div ref={viewportRef} role="log" aria-label={copy('Conversation messages', 'საუბრის შეტყობინებები')} style={{ overflowAnchor: 'none' }} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
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

            {children}
        </>
    );
};

/** Empty state — no conversation selected */
export const NoConversationSelected = ({ sidebarLoading, onNewChat }: { sidebarLoading: boolean; onNewChat: () => void }) => {
    const copy = useMessageCopy();
    return (
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
                    onClick={onNewChat}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--chat-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--chat-accent-contrast)] transition-colors hover:bg-[var(--chat-accent-hover)]"
                >
                    <Plus className="w-4 h-4" />
                    {copy('New chat', 'ახალი ჩატი')}
                </button>
            </div>
        </div>
    );
};
