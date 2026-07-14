import { http, HttpHandler, HttpResponse } from 'msw';
import { users, currentUserId } from '../data/store';
import { conversations, messages, suggestions, blocks, blockKey } from '../data/chatStore';
import { simulateLatency, paginate } from '../utils';
import type { ConversationDto, ParticipantInfo } from '../../api/chat';

const API = '*/api';

// ── Helpers ───────────────────────────────────────────────────────────

function getMyConversations(userId: number): ConversationDto[] {
    return [...conversations().values()]
        .filter((c) => c.participants.some((p) => p.userId === userId))
        .sort((a, b) => {
            const da = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const db = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return db - da;
        });
}

function isBlocked(convId: number, userId: number): boolean {
    return blocks().has(blockKey(convId, userId));
}

function isParticipant(convId: number, userId: number): boolean {
    const conv = conversations().get(convId);
    if (!conv) return false;
    return conv.participants.some((p) => p.userId === userId);
}

function isCreator(convId: number, userId: number): boolean {
    const conv = conversations().get(convId);
    if (!conv || conv.contextType !== 'GROUP') return false;
    return conv.participants.some((p) => p.userId === userId && p.role === 'CREATOR');
}

// ── Handlers ──────────────────────────────────────────────────────────

export const chatHandlers: HttpHandler[] = [

    // -- GET /chat/conversations — list my conversations ------------------
    http.get(`${API}/chat/conversations`, async ({ request }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? 0);
        const size = Number(url.searchParams.get('size') ?? 20);

        const myConvs = getMyConversations(uid);
        return HttpResponse.json(paginate(myConvs, page, size));
    }),

    // -- GET /chat/conversations/:id/messages ----------------------------
    http.get(`${API}/chat/conversations/:convId/messages`, async ({ request, params }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const convId = Number(params.convId);
        if (!isParticipant(convId, uid)) {
            return HttpResponse.json({ error: 'Not a participant' }, { status: 403 });
        }

        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? 0);
        const size = Number(url.searchParams.get('size') ?? 50);

        const msgs = messages().get(convId) || [];
        // Return in reverse chronological order (newest last) for the frontend
        // The frontend reverses them so they display oldest-first
        const sorted = [...msgs].sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return HttpResponse.json(paginate(sorted, page, size));
    }),

    // -- POST /chat/conversations — create -------------------------------
    http.post(`${API}/chat/conversations`, async ({ request }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = (await request.json()) as {
            contextType: 'DIRECT' | 'GROUP';
            name?: string;
            contextId?: number;
            participantIds: number[];
        };

        const allIds = [uid, ...body.participantIds.filter((id) => id !== uid)];
        const uniqueIds = [...new Set(allIds)];

        // Build participants list
        const participants: ParticipantInfo[] = uniqueIds.map((id, index) => {
            const u = users().get(id);
            const displayName = u?.fullName || u?.username || `User ${id}`;
            const role = body.contextType === 'GROUP' && index === 0 ? 'CREATOR' : 'MEMBER';
            return {
                userId: id,
                displayName,
                profilePictureUrl: u?.avatarUrl ?? null,
                role: body.contextType === 'GROUP' ? role : null,
            };
        });

        // For DIRECT conversations, check if one already exists with the same participants
        if (body.contextType === 'DIRECT' && uniqueIds.length === 2) {
            const otherId = uniqueIds.find((id) => id !== uid)!;
            for (const conv of conversations().values()) {
                if (conv.contextType === 'DIRECT' && conv.participants.length === 2) {
                    const convIds = conv.participants.map((p) => p.userId);
                    if (convIds.includes(uid) && convIds.includes(otherId)) {
                        return HttpResponse.json(conv, { status: 200 });
                    }
                }
            }
        }

        const newId = conversations().size > 0 ? Math.max(...conversations().keys()) + 1 : 1;
        const conv: ConversationDto = {
            id: newId,
            name: body.name ?? null,
            contextType: body.contextType,
            contextId: body.contextId ?? null,
            lastMessage: null,
            lastMessageSenderId: null,
            lastMessageSenderName: null,
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
            participantCount: participants.length,
            participants,
        };

        conversations().set(newId, conv);
        messages().set(newId, []);

        return HttpResponse.json(conv, { status: 201 });
    }),

    // -- POST /chat/conversations/:id/participants — add -----------------
    http.post(`${API}/chat/conversations/:convId/participants`, async ({ request, params }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const convId = Number(params.convId);
        const conv = conversations().get(convId);
        if (!conv) return HttpResponse.json({ error: 'Conversation not found' }, { status: 404 });

        if (!isParticipant(convId, uid)) {
            return HttpResponse.json({ error: 'Not a participant' }, { status: 403 });
        }

        const body = (await request.json()) as { userIds: number[] };

        // For GROUP, only creator can add
        if (conv.contextType === 'GROUP' && !isCreator(convId, uid)) {
            return HttpResponse.json({ error: 'Only group admin can add participants' }, { status: 403 });
        }

        const added: ParticipantInfo[] = [];
        for (const userId of body.userIds) {
            if (conv.participants.some((p) => p.userId === userId)) continue;
            if (isBlocked(convId, userId)) continue;

            const u = users().get(userId);
            const displayName = u?.fullName || u?.username || `User ${userId}`;
            const participant: ParticipantInfo = {
                userId,
                displayName,
                profilePictureUrl: u?.avatarUrl ?? null,
                role: 'MEMBER',
            };
            conv.participants.push(participant);
            added.push(participant);
        }

        conv.participantCount = conv.participants.length;
        conversations().set(convId, conv);

        return HttpResponse.json({ added }, { status: 200 });
    }),

    // -- DELETE /chat/conversations/:id/participants/:userId — remove ----
    http.delete(`${API}/chat/conversations/:convId/participants/:userId`, async ({ params }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const convId = Number(params.convId);
        const targetUserId = Number(params.userId);
        const conv = conversations().get(convId);
        if (!conv) return HttpResponse.json({ error: 'Conversation not found' }, { status: 404 });

        // Self-removal is always allowed (leave)
        if (uid !== targetUserId) {
            // Non-self removal: only creator can remove others in GROUP
            if (conv.contextType === 'GROUP' && !isCreator(convId, uid)) {
                return HttpResponse.json({ error: 'Only group admin can remove participants' }, { status: 403 });
            }
            // Cannot remove the creator
            if (isCreator(convId, targetUserId)) {
                return HttpResponse.json({ error: 'Cannot remove the group admin' }, { status: 403 });
            }
        }

        conv.participants = conv.participants.filter((p) => p.userId !== targetUserId);
        conv.participantCount = conv.participants.length;

        // If no participants left, delete the conversation
        if (conv.participants.length === 0) {
            conversations().delete(convId);
            messages().delete(convId);
        } else {
            conversations().set(convId, conv);
        }

        return HttpResponse.json({ message: 'Removed' }, { status: 200 });
    }),

    // -- DELETE /chat/conversations/:id/leave -----------------------------
    http.delete(`${API}/chat/conversations/:convId/leave`, async ({ params }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const convId = Number(params.convId);
        const conv = conversations().get(convId);
        if (!conv) return HttpResponse.json({ error: 'Conversation not found' }, { status: 404 });

        conv.participants = conv.participants.filter((p) => p.userId !== uid);
        conv.participantCount = conv.participants.length;

        if (conv.participants.length === 0) {
            conversations().delete(convId);
            messages().delete(convId);
        } else {
            conversations().set(convId, conv);
        }

        return HttpResponse.json({ message: 'Left conversation' }, { status: 200 });
    }),

    // -- POST /chat/conversations/:id/read — mark read --------------------
    http.post(`${API}/chat/conversations/:convId/read`, async ({ params }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const convId = Number(params.convId);
        const conv = conversations().get(convId);
        if (conv) {
            conv.unreadCount = 0;
            conversations().set(convId, conv);
        }

        return HttpResponse.json({ message: 'Marked as read' }, { status: 200 });
    }),

    // -- POST /chat/conversations/:id/suggestions — suggest invite --------
    http.post(`${API}/chat/conversations/:convId/suggestions`, async ({ request, params }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const convId = Number(params.convId);
        const conv = conversations().get(convId);
        if (!conv) return HttpResponse.json({ error: 'Conversation not found' }, { status: 404 });

        if (!isParticipant(convId, uid)) {
            return HttpResponse.json({ error: 'Not a participant' }, { status: 403 });
        }

        if (conv.contextType !== 'GROUP') {
            return HttpResponse.json({ error: 'Only group conversations support suggestions' }, { status: 400 });
        }

        const body = (await request.json()) as { suggestedUserId: number };
        const targetId = body.suggestedUserId;

        if (isParticipant(convId, targetId)) {
            return HttpResponse.json({ error: 'User is already a participant' }, { status: 409 });
        }

        if (isBlocked(convId, targetId)) {
            return HttpResponse.json({ error: 'User is blocked from this conversation' }, { status: 409 });
        }

        // Check for duplicate pending suggestion
        for (const s of suggestions().values()) {
            if (s.conversationId === convId && s.suggestedUserId === targetId && s.status === 'PENDING') {
                return HttpResponse.json({ error: 'User has already been suggested' }, { status: 409 });
            }
        }

        const suggester = users().get(uid);
        const target = users().get(targetId);

        const newSuggestion = {
            id: suggestions().size > 0 ? Math.max(...suggestions().keys()) + 1 : 1,
            conversationId: convId,
            suggestedBy: uid,
            suggestedByDisplayName: suggester?.fullName || suggester?.username || 'User',
            suggestedUserId: targetId,
            suggestedUserDisplayName: target?.fullName || target?.username || `User ${targetId}`,
            profilePictureUrl: target?.avatarUrl ?? null,
            status: 'PENDING' as const,
            createdAt: new Date().toISOString(),
        };

        suggestions().set(newSuggestion.id, newSuggestion);

        return HttpResponse.json(newSuggestion, { status: 201 });
    }),

    // -- GET /chat/conversations/:id/suggestions — list pending -----------
    http.get(`${API}/chat/conversations/:convId/suggestions`, async ({ params }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const convId = Number(params.convId);
        if (!isParticipant(convId, uid)) {
            return HttpResponse.json({ error: 'Not a participant' }, { status: 403 });
        }

        const pending = [...suggestions().values()].filter(
            (s) => s.conversationId === convId && s.status === 'PENDING',
        );

        return HttpResponse.json(pending, { status: 200 });
    }),

    // -- POST /chat/conversations/:id/suggestions/:sid/decide -------------
    http.post(`${API}/chat/conversations/:convId/suggestions/:sid/decide`, async ({ request, params }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const convId = Number(params.convId);
        const suggestionId = Number(params.sid);

        if (!isCreator(convId, uid)) {
            return HttpResponse.json({ error: 'Only group admin can decide on suggestions' }, { status: 403 });
        }

        const suggestion = suggestions().get(suggestionId);
        if (!suggestion || suggestion.conversationId !== convId) {
            return HttpResponse.json({ error: 'Suggestion not found' }, { status: 404 });
        }

        if (suggestion.status !== 'PENDING') {
            return HttpResponse.json({ error: 'Suggestion has already been decided' }, { status: 409 });
        }

        const body = (await request.json()) as { action: 'APPROVE' | 'REJECT' };
        const action = body.action?.toUpperCase();

        if (action === 'APPROVE') {
            const conv = conversations().get(convId)!;
            const target = users().get(suggestion.suggestedUserId);
            const displayName = target?.fullName || target?.username || `User ${suggestion.suggestedUserId}`;

            if (!conv.participants.some((p) => p.userId === suggestion.suggestedUserId)) {
                conv.participants.push({
                    userId: suggestion.suggestedUserId,
                    displayName,
                    profilePictureUrl: target?.avatarUrl ?? null,
                    role: 'MEMBER',
                });
                conv.participantCount = conv.participants.length;
                conversations().set(convId, conv);
            }

            suggestion.status = 'APPROVED';
        } else {
            suggestion.status = 'REJECTED';
        }

        suggestions().set(suggestionId, suggestion);

        return HttpResponse.json(suggestion, { status: 200 });
    }),

    // -- POST /chat/conversations/:id/block/:userId — block user ---------
    http.post(`${API}/chat/conversations/:convId/block/:userId`, async ({ params }) => {
        await simulateLatency();
        const uid = currentUserId();
        if (uid == null) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const convId = Number(params.convId);
        const targetId = Number(params.userId);

        if (!isCreator(convId, uid)) {
            return HttpResponse.json({ error: 'Only group admin can block users' }, { status: 403 });
        }

        if (uid === targetId) {
            return HttpResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
        }

        if (isCreator(convId, targetId)) {
            return HttpResponse.json({ error: 'Cannot block the group admin' }, { status: 403 });
        }

        // Remove from participants
        const conv = conversations().get(convId)!;
        conv.participants = conv.participants.filter((p) => p.userId !== targetId);
        conv.participantCount = conv.participants.length;
        conversations().set(convId, conv);

        // Add block
        blocks().set(blockKey(convId, targetId), true);

        return HttpResponse.json({ message: 'User blocked' }, { status: 200 });
    }),
];
