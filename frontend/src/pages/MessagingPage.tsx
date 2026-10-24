import './messaging.css';
import '../features/squadCommunication/squad-life.css';
import { SquadInboxConversation } from '../features/squadCommunication/SquadInbox';
import { useAuth } from '../context/AuthContext';
import { useMessenger } from '../components/chat/useMessenger';
import { useConversationManagement } from '../components/chat/useConversationManagement';
import { ConversationList } from '../components/chat/ConversationList';
import { ConversationThread, NoConversationSelected } from '../components/chat/ConversationThread';
import { MessageComposer } from '../components/chat/MessageComposer';
import { ConversationInfoPanel } from '../components/chat/ConversationInfoPanel';
import { NewChatModal } from '../components/chat/NewChatModal';
import { TeamChatInMessages } from '../features/teamChat/TeamChatPage';

export const MessagingPage = () => {
    const { sessionId } = useAuth();
    return <Messages key={sessionId} />;
};

function Messages() {
    const chat = useMessenger();
    const manage = useConversationManagement(chat);
    const { sessionId, currentUserId, searchParams, setSearchParams, squadId, activeConv, managementError, showInfo, setShowInfo } = chat;
    // A failed profile link or conversation address is retried from the inbox.
    const openFailed = searchParams.has('chatWith') || (searchParams.has('conversationId') && !activeConv);

    return (
        <div className={`chat-messenger-shell unified-messages ${squadId || activeConv ? 'has-conversation' : ''} h-full w-full flex overflow-hidden`}>
            <ConversationList sessionId={sessionId} currentUserId={currentUserId} squadId={squadId} connected={chat.connected}
                conversations={chat.conversations} activeConvId={chat.activeConvId} sidebarLoading={chat.sidebarLoading}
                listFailed={chat.listFailed} openError={openFailed ? managementError : null} hasMore={chat.hasMore}
                loadingMore={chat.loadingMore} onNewChat={() => chat.setShowNewChat(true)} onSelect={chat.selectConversation}
                onRetryList={() => void chat.loadConversations()} onRetryOpen={() => chat.setProfileAttempt(value => value + 1)}
                onLoadMore={() => void chat.loadMore()} />

            {/* ── CHAT WINDOW ──────────────────────────────────── */}
            <section className="flex-1 flex flex-col bg-[var(--chat-surface)] min-w-0">
                {squadId ? <SquadInboxConversation key={`${sessionId}:${squadId}`} id={squadId} /> : activeConv?.contextType === 'TEAM' ? (
                    <TeamChatInMessages key={sessionId} onBack={() => setSearchParams({})} />
                ) : activeConv ? (
                    <ConversationThread conversation={activeConv} sessionId={sessionId} currentUserId={currentUserId}
                        messages={chat.activeMessages} viewportRef={chat.messageViewportRef} loadingMessages={chat.loadingMessages}
                        hasOlder={chat.hasOlder} loadingOlder={chat.loadingOlder} historyError={chat.historyError} loadOlder={chat.loadOlder}
                        showInfo={showInfo} onToggleInfo={() => setShowInfo(!showInfo)} onBack={() => setSearchParams({})}>
                        <MessageComposer input={chat.input} setInput={chat.setInput} sending={chat.sending}
                            deliveryError={chat.deliveryError} onSubmit={chat.sendMessage} />
                    </ConversationThread>
                ) : (
                    <NoConversationSelected sidebarLoading={chat.sidebarLoading} onNewChat={() => chat.setShowNewChat(true)} />
                )}
            </section>

            {activeConv && activeConv.contextType !== 'TEAM' && (
                <ConversationInfoPanel conversation={activeConv} currentUserId={currentUserId} showInfo={showInfo}
                    managementError={managementError} onDismissError={() => chat.setManagementError(null)} manage={manage} />
            )}

            <NewChatModal
                open={chat.showNewChat}
                onClose={() => chat.setShowNewChat(false)}
                onConversationCreated={chat.handleConversationCreated}
                recentContacts={chat.recentContacts}
            />
        </div>
    );
}
