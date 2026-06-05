import { apiClient } from './axiosConfig';

// ── Types (mirrors backend DTOs) ─────────────────────────────────

export interface ParticipantInfo {
    userId: number;
    displayName: string;
    profilePictureUrl: string | null;
    role: 'CREATOR' | 'MEMBER' | null;
}

export interface ConversationDto {
    id: number;
    name: string | null;
    contextType: 'DIRECT' | 'GROUP';
    contextId: number | null;
    lastMessage: string | null;
    lastMessageSenderName: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    participantCount: number;
    participants: ParticipantInfo[];
}

export interface ChatMessageResponse {
    id: number;
    conversationId: number;
    senderId: number;
    senderName: string;
    content: string;
    createdAt: string;
}

export interface InviteSuggestion {
    id: number;
    conversationId: number;
    suggestedBy: number;
    suggestedByDisplayName: string;
    suggestedUserId: number;
    suggestedUserDisplayName: string;
    profilePictureUrl: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
}

export interface PageResult<T> {
    content: T[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
}

export interface UserSearchResult {
    id: number;
    fullName: string;
    username: string;
    position: string | null;
    userType: string;
    avatarUrl: string | null;
}

export interface PageParams {
    page?: number;
    size?: number;
}

// ── API functions ────────────────────────────────────────────────

export const chatApi = {
    getConversations(page = 0, size = 20) {
        return apiClient.get<PageResult<ConversationDto>>('/chat/conversations', {
            params: { page, size },
        });
    },

    getMessages(conversationId: number, page = 0, size = 50) {
        return apiClient.get<PageResult<ChatMessageResponse>>(
            `/chat/conversations/${conversationId}/messages`,
            { params: { page, size } },
        );
    },

    createConversation(data: {
        contextType: 'DIRECT' | 'GROUP';
        name?: string;
        contextId?: number;
        participantIds: number[];
    }) {
        return apiClient.post<ConversationDto>('/chat/conversations', data);
    },

    addParticipants(conversationId: number, userIds: number[]) {
        return apiClient.post(`/chat/conversations/${conversationId}/participants`, {
            userIds,
        });
    },

    removeParticipant(conversationId: number, userId: number) {
        return apiClient.delete(
            `/chat/conversations/${conversationId}/participants/${userId}`,
        );
    },

    leaveConversation(conversationId: number) {
        return apiClient.delete(`/chat/conversations/${conversationId}/leave`);
    },

    markAsRead(conversationId: number) {
        return apiClient.post(`/chat/conversations/${conversationId}/read`);
    },

    searchUsers(query: string, page = 0, size = 10) {
        return apiClient.get<PageResult<UserSearchResult>>('/users/search', {
            params: { query, page, size },
        });
    },

    suggestInvite(conversationId: number, suggestedUserId: number) {
        return apiClient.post<InviteSuggestion>(
            `/chat/conversations/${conversationId}/suggestions`,
            { suggestedUserId },
        );
    },

    getPendingSuggestions(conversationId: number) {
        return apiClient.get<InviteSuggestion[]>(
            `/chat/conversations/${conversationId}/suggestions`,
        );
    },

    decideSuggestion(conversationId: number, suggestionId: number, action: 'APPROVE' | 'REJECT') {
        return apiClient.post<InviteSuggestion>(
            `/chat/conversations/${conversationId}/suggestions/${suggestionId}/decide`,
            { action },
        );
    },

    blockUser(conversationId: number, userId: number) {
        return apiClient.post(`/chat/conversations/${conversationId}/block/${userId}`);
    },
};
