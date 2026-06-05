import type { ConversationDto, ChatMessageResponse, ParticipantInfo, InviteSuggestion, UserSearchResult } from '../../api/chat';

// ── In-memory chat store ──────────────────────────────────────────────

let _conversations: Map<number, ConversationDto> | null = null;
let _messages: Map<number, ChatMessageResponse[]> | null = null; // convId → messages
let _suggestions: Map<number, InviteSuggestion> | null = null;
let _blocks: Map<string, boolean> | null = null; // key: "convId_userId"
let _nextMsgId = 1000;

export const conversations = () => { if (!_conversations) _conversations = new Map(); return _conversations; };
export const messages = () => { if (!_messages) _messages = new Map(); return _messages; };
export const suggestions = () => { if (!_suggestions) _suggestions = new Map(); return _suggestions; };
export const blocks = () => { if (!_blocks) _blocks = new Map(); return _blocks; };
export const nextMsgId = () => _nextMsgId++;

export function blockKey(convId: number, userId: number) { return `${convId}_${userId}`; }

export function resetChatStore() {
    _conversations = null;
    _messages = null;
    _suggestions = null;
    _blocks = null;
    _nextMsgId = 1000;
}

// ── Helper: build a display name for a conversation ───────────────────
export function getConvDisplayName(conv: ConversationDto, currentUserId: number): string {
    if (conv.contextType === 'GROUP') return conv.name || 'Group';
    const other = conv.participants.find((p) => p.userId !== currentUserId);
    return other?.displayName || 'Unknown';
}

// ── Mock send message (bypasses WebSocket) ────────────────────────────

export function mockSendMessage(
    conversationId: number,
    senderId: number,
    senderName: string,
    content: string,
): ChatMessageResponse {
    const msg: ChatMessageResponse = {
        id: nextMsgId(),
        conversationId,
        senderId,
        senderName,
        content,
        createdAt: new Date().toISOString(),
    };

    // Store in messages map
    if (!_messages) _messages = new Map();
    const existing = _messages.get(conversationId) || [];
    existing.push(msg);
    _messages.set(conversationId, existing);

    // Update conversation lastMessage
    const conv = _conversations?.get(conversationId);
    if (conv) {
        conv.lastMessage = content;
        conv.lastMessageSenderName = senderName;
        conv.lastMessageAt = msg.createdAt;
    }

    return msg;
}
