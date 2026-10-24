import { Client } from '@stomp/stompjs';
import { buildWebSocketUrl } from '../../api/axiosConfig';
import { getAuthSessionId, getStoredAccessToken, isCurrentAuthSession } from '../../utils/authStorage';

export interface LiveHandlers {
    /** Something changed (a new message, an edit, a reaction): catch up. The pushes carry no message text. */
    onChanged: () => void;
    onTyping: (userId: number, typing: boolean) => void;
    onConnected: (connected: boolean) => void;
}

/**
 * The chat's live line: new messages (/topic/chat.{id}), other changes (.changes) and typing (.typing). It only
 * says that something changed; the change feed is the record, so a missed or doubled push loses nothing.
 */
export function connectLive(conversationId: number, handlers: LiveHandlers) {
    const session = getAuthSessionId();
    const client = new Client({
        brokerURL: buildWebSocketUrl('/ws-chat'),
        reconnectDelay: 5000,
        beforeConnect: () => {
            if (!isCurrentAuthSession(session)) { void client.deactivate(); return; }
            client.connectHeaders = { Authorization: `Bearer ${getStoredAccessToken(session) ?? ''}` };
        },
        onConnect: () => {
            if (!isCurrentAuthSession(session)) { void client.deactivate(); return; }
            client.subscribe(`/topic/chat.${conversationId}`, () => handlers.onChanged());
            client.subscribe(`/topic/chat.${conversationId}.changes`, () => handlers.onChanged());
            client.subscribe(`/topic/chat.${conversationId}.typing`, frame => {
                try {
                    const signal = JSON.parse(frame.body) as { userId?: number; typing?: boolean };
                    if (Number.isSafeInteger(signal.userId)) handlers.onTyping(signal.userId as number, signal.typing === true);
                } catch { /* A typing signal is only a hint. */ }
            });
            handlers.onConnected(true);
        },
        onDisconnect: () => handlers.onConnected(false),
        onWebSocketClose: () => handlers.onConnected(false),
        onStompError: () => handlers.onConnected(false),
    });
    client.activate();
    return {
        typing(typing: boolean) {
            if (client.connected) client.publish({ destination: '/app/chat.typing', body: JSON.stringify({ conversationId, typing }) });
        },
        close() { void client.deactivate(); },
    };
}
export type Live = ReturnType<typeof connectLive>;
