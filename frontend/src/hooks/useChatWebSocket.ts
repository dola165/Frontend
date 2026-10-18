import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { buildWebSocketUrl } from '../api/axiosConfig';
import { getAuthSessionId, getStoredAccessToken, getStoredUserId, isCurrentAuthSession } from '../utils/authStorage';
import { chatApi, type ChatMessageResponse } from '../api/chat';
import { createMessageRecovery } from '../components/chat/messageRecovery';

const IS_MOCK_MODE = import.meta.env.VITE_ENABLE_MOCKS === 'true';

export const mergeMessages = (existing: ChatMessageResponse[], incoming: ChatMessageResponse[]) =>
    [...new Map([...existing, ...incoming].map(message => [message.id, message])).values()].sort((a, b) => a.id - b.id);

export function useChatWebSocket(onMessage: (msg: ChatMessageResponse) => void, onUnavailable?: (id: number) => void, freshHistoryOnSelect = false) {
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [sendError, setSendError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [hasOlder, setHasOlder] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const history = useRef<Record<number, { oldest: number; hasOlder: boolean }>>({});
    const olderFlights = useRef(new Set<string>());
    const clientRef = useRef<Client | null>(null);
    const subRef = useRef<{ unsubscribe: () => void } | null>(null);
    const activeRef = useRef<number | null>(null);
    const generation = useRef(0);
    const onMessageRef = useRef(onMessage);
    const unavailableRef = useRef(onUnavailable);
    onMessageRef.current = onMessage;
    unavailableRef.current = onUnavailable;
    // Only REST responses advance this cursor. A newer push must not hide a missed older message.
    const cursor = useRef<Record<number, number>>({});
    const inFlight = useRef(new Set<string>());
    const [recovery] = useState(createMessageRecovery);
    const mounted = useRef(false);
    const sendingRef = useRef(false);

    useEffect(() => {
        mounted.current = true;
        const lifecycle = generation;
        return () => { mounted.current = false; lifecycle.current++; };
    }, []);

    const catchUp = useCallback(async () => {
        const id = activeRef.current;
        if (id === null || !mounted.current || !recovery.current()) return;
        const version = generation.current;
        const flight = `${id}:${version}`;
        if (inFlight.current.has(flight)) return;
        inFlight.current.add(flight);
        const current = () => mounted.current && recovery.current() && version === generation.current && activeRef.current === id;
        setLoading(cursor.current[id] === undefined);
        try {
            if (cursor.current[id] === undefined) {
                const response = await chatApi.getMessages(id);
                if (!current()) return;
                const messages = mergeMessages([], response.data.content);
                messages.forEach(message => onMessageRef.current(message));
                cursor.current[id] = messages.at(-1)?.id ?? 0;
                history.current[id] = { oldest: messages[0]?.id ?? 0, hasOlder: messages.length === 50 };
                setHasOlder(history.current[id].hasOlder);
            }
            // Bound each pass; subsequent ticks resume from the last confirmed page.
            for (let page = 0; page < 10; page++) {
                const response = await chatApi.getMessagesAfter(id, cursor.current[id]);
                if (!current()) return;
                const batch = response.data;
                batch.forEach(message => onMessageRef.current(message));
                if (batch.length) cursor.current[id] = batch[batch.length - 1].id;
                if (batch.length < 100) break;
            }
            if (current()) {
                setRefreshError(null);
            }
        } catch (cause) {
            if (!current()) return;
            const status = (cause as { response?: { status?: number } }).response?.status;
            if (status === 401 || status === 403 || status === 404) {
                // Discard any concurrent recovery/history response after access is denied.
                generation.current++;
                setLoading(false);
                setLoadingOlder(false);
                delete cursor.current[id];
                delete history.current[id];
                setHasOlder(false);
                unavailableRef.current?.(id);
                subRef.current?.unsubscribe();
                subRef.current = null;
            }
            setRefreshError('Could not refresh this conversation. We will retry when the connection returns.');
        } finally {
            inFlight.current.delete(flight);
            if (current()) setLoading(false);
        }
    }, [recovery]);

    const loadOlder = useCallback(async () => {
        const id = activeRef.current;
        if (id === null || !mounted.current || !recovery.current() || !history.current[id]?.hasOlder) return;
        const version = generation.current;
        const flight = `${id}:${version}`;
        if (olderFlights.current.has(flight)) return;
        olderFlights.current.add(flight);
        const current = () => mounted.current && recovery.current() && version === generation.current && activeRef.current === id;
        setLoadingOlder(true);
        setHistoryError(null);
        try {
            const response = await chatApi.getMessagesBefore(id, history.current[id].oldest);
            if (!current()) return;
            const batch = mergeMessages([], response.data);
            batch.forEach(message => onMessageRef.current(message));
            history.current[id] = { oldest: batch[0]?.id ?? history.current[id].oldest, hasOlder: batch.length === 50 };
            setHasOlder(history.current[id].hasOlder);
        } catch (cause) {
            if (!current()) return;
            const status = (cause as { response?: { status?: number } }).response?.status;
            if (status === 401 || status === 403 || status === 404) {
                // Discard any concurrent recovery/history response after access is denied.
                generation.current++;
                setLoading(false);
                setLoadingOlder(false);
                delete cursor.current[id];
                delete history.current[id];
                setHasOlder(false);
                unavailableRef.current?.(id);
                subRef.current?.unsubscribe();
                subRef.current = null;
            }
            setHistoryError('Could not load older messages. Please try again.');
        } finally {
            olderFlights.current.delete(flight);
            if (current()) setLoadingOlder(false);
        }
    }, [recovery]);

    const subscribe = useCallback(() => {
        subRef.current?.unsubscribe();
        subRef.current = null;
        const id = activeRef.current;
        if (id === null || !recovery.current() || !clientRef.current?.connected) return;
        subRef.current = clientRef.current.subscribe(`/topic/chat.${id}`, frame => {
            if (!mounted.current || !recovery.current() || activeRef.current !== id) return;
            try {
                const message = JSON.parse(frame.body) as ChatMessageResponse;
                if (message.conversationId === id && Number.isSafeInteger(message.id)) onMessageRef.current(message);
            } catch { /* The authoritative history pass recovers malformed or missed pushes. */ }
        });
    }, [recovery]);

    useEffect(() => {
        if (!getStoredAccessToken()) return;
        if (IS_MOCK_MODE) { setConnected(true); return; }
        const sessionId = getAuthSessionId();
        const client = new Client({
            brokerURL: buildWebSocketUrl('/ws-chat'),
            reconnectDelay: 5000,
            beforeConnect: () => {
                if (!isCurrentAuthSession(sessionId)) { void client.deactivate(); return; }
                client.connectHeaders = { Authorization: `Bearer ${getStoredAccessToken(sessionId) ?? ''}` };
            },
            onConnect: () => {
                if (!isCurrentAuthSession(sessionId)) { void client.deactivate(); return; }
                setConnected(true); subRef.current = null; subscribe(); void catchUp();
            },
            onDisconnect: () => setConnected(false),
            onWebSocketClose: () => { setConnected(false); subRef.current = null; },
            onStompError: () => setConnected(false),
        });
        clientRef.current = client;
        client.activate();
        const lifecycle = generation;
        return () => {
            lifecycle.current++;
            subRef.current?.unsubscribe();
            subRef.current = null;
            clientRef.current = null;
            void client.deactivate();
        };
    }, [catchUp, subscribe]);

    useEffect(() => {
        const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine) void catchUp(); };
        const timer = window.setInterval(refresh, 30_000);
        window.addEventListener('focus', refresh);
        window.addEventListener('online', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', refresh);
            window.removeEventListener('online', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [catchUp]);

    const setActiveConversation = useCallback((id: number | null) => {
        if (!recovery.current()) return Promise.resolve();
        activeRef.current = id;
        generation.current++;
        setRefreshError(null);
        setSendError(null);
        setLoading(false);
        setLoadingOlder(false);
        setHistoryError(null);
        if (id !== null && freshHistoryOnSelect) {
            delete cursor.current[id];
            delete history.current[id];
        }
        setHasOlder(id !== null && !!history.current[id]?.hasOlder);
        subscribe();
        return catchUp();
    }, [catchUp, subscribe, freshHistoryOnSelect, recovery]);

    const sendMessage = useCallback(async (id: number, content: string, senderName = 'Me') => {
        const clean = content.trim();
        if (!clean || sendingRef.current || !mounted.current || !recovery.current()) return false;
        sendingRef.current = true;
        setSending(true);
        setSendError(null);
        try {
            // Save the exact retry identity before dispatch, including across a page reload.
            const request = recovery.prepare(id, clean);
            const message = IS_MOCK_MODE
                ? (await import('../mocks/data/chatStore')).mockSendMessage(id, Number(getStoredUserId() || 0), senderName, clean)
                : (await chatApi.sendMessage(id, clean, request.key)).data;
            if (!recovery.current()) return false;
            recovery.confirm(id, request);
            if (!mounted.current) return false;
            if (activeRef.current === id) onMessageRef.current(message);
            return true;
        } catch {
            if (mounted.current && recovery.current() && activeRef.current === id) setSendError('Message was not confirmed. Your draft is kept; press Send to retry.');
            return false;
        } finally {
            sendingRef.current = false;
            if (mounted.current && recovery.current()) setSending(false);
        }
    }, [recovery]);

    return { connected, setActiveConversation, sendMessage, loading, error: sendError ?? refreshError, sending, catchUp,
        loadOlder, hasOlder, loadingOlder, historyError } as const;
}
