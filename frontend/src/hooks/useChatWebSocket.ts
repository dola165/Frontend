import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { buildWebSocketUrl } from '../api/axiosConfig';
import { getStoredAccessToken } from '../utils/authStorage';
import type { ChatMessageResponse } from '../api/chat';

export function useChatWebSocket(onMessage: (msg: ChatMessageResponse) => void) {
    const [connected, setConnected] = useState(false);
    const clientRef = useRef<Client | null>(null);
    const subRef = useRef<{ unsubscribe: () => void } | null>(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        const token = getStoredAccessToken();
        if (!token) return;

        const client = new Client({
            brokerURL: buildWebSocketUrl('/ws-chat'),
            connectHeaders: { Authorization: `Bearer ${token}` },
            reconnectDelay: 5000,
            onConnect: () => setConnected(true),
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
        subRef.current?.unsubscribe();
        subRef.current = null;

        if (conversationId !== null && clientRef.current?.connected) {
            subRef.current = clientRef.current.subscribe(
                `/topic/chat.${conversationId}`,
                (msg) => onMessageRef.current(JSON.parse(msg.body) as ChatMessageResponse),
            );
        }
    }, []);

    return { connected, setActiveConversation } as const;
}
