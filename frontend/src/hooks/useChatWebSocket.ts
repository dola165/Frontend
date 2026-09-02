import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { buildWebSocketUrl } from '../api/axiosConfig';
import { getStoredAccessToken, getStoredUserId } from '../utils/authStorage';
import type { ChatMessageResponse } from '../api/chat';

const IS_MOCK_MODE = import.meta.env.VITE_ENABLE_MOCKS === 'true';

export function useChatWebSocket(onMessage: (msg: ChatMessageResponse) => void) {
    const [connected, setConnected] = useState(false);
    const clientRef = useRef<Client | null>(null);
    const subRef = useRef<{ unsubscribe: () => void } | null>(null);
    const activeConversationRef = useRef<number | null>(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        const token = getStoredAccessToken();
        if (!token) return;

        if (IS_MOCK_MODE) {
            setConnected(true);
            return () => setConnected(false);
        }

        const client = new Client({
            brokerURL: buildWebSocketUrl('/ws-chat'),
            connectHeaders: { Authorization: `Bearer ${token}` },
            reconnectDelay: 5000,
            onConnect: () => {
                setConnected(true);
                const conversationId = activeConversationRef.current;
                if (conversationId !== null) {
                    subRef.current = client.subscribe(
                        `/topic/chat.${conversationId}`,
                        (msg) => onMessageRef.current(JSON.parse(msg.body) as ChatMessageResponse),
                    );
                }
            },
            onDisconnect: () => setConnected(false),
            onStompError: () => setConnected(false),
        });

        client.activate();
        clientRef.current = client;

        return () => {
            subRef.current?.unsubscribe();
            client.deactivate();
        };
    }, []);

    const setActiveConversation = useCallback((conversationId: number | null) => {
        activeConversationRef.current = conversationId;
        subRef.current?.unsubscribe();
        subRef.current = null;

        if (conversationId !== null && clientRef.current?.connected) {
            subRef.current = clientRef.current.subscribe(
                `/topic/chat.${conversationId}`,
                (msg) => onMessageRef.current(JSON.parse(msg.body) as ChatMessageResponse),
            );
        }
    }, []);

    const sendMessage = useCallback(async (conversationId: number, content: string, senderName = 'Me') => {
        const cleanContent = content.trim();
        if (!cleanContent) return false;

        if (IS_MOCK_MODE) {
            const { mockSendMessage } = await import('../mocks/data/chatStore');
            const storedUserId = Number(getStoredUserId() || 0);
            const message = mockSendMessage(conversationId, storedUserId, senderName, cleanContent);
            onMessageRef.current(message);
            return true;
        }

        if (!clientRef.current?.connected) return false;
        clientRef.current.publish({
            destination: '/app/chat.send',
            body: JSON.stringify({ conversationId, content: cleanContent }),
        });
        return true;
    }, []);

    return { connected, setActiveConversation, sendMessage } as const;
}
