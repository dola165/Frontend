import { useEffect, useRef, type RefObject } from 'react';
import { chatApi, type ChatMessageResponse } from '../api/chat';
import { emitNotificationsChanged } from '../utils/notifications';
import { getStoredUserId } from '../utils/authStorage';

/** Delivery is independent of reading. Only visible incoming bubbles are acknowledged. */
export function useChatReadReceipts(
    conversationId: number | null,
    enabled: boolean,
    messages: ChatMessageResponse[],
    viewport: RefObject<HTMLDivElement | null>,
) {
    const confirmed = useRef(new Map<number, Set<number>>());

    useEffect(() => {
        const root = viewport.current;
        if (conversationId === null || !enabled || !root || typeof IntersectionObserver === 'undefined') return;
        const userId = Number(getStoredUserId());
        const eligible = new Set(messages.filter(message => message.conversationId === conversationId && message.senderId !== userId).map(message => message.id));
        const acknowledged = confirmed.current.get(conversationId) ?? new Set<number>();
        confirmed.current.set(conversationId, acknowledged);
        const visible = new Map<number, HTMLElement>();
        let active = true;
        let sending = false;
        let timer: number | undefined;
        const canRead = () => active && document.visibilityState === 'visible' && document.hasFocus();

        const isVisible = (element: HTMLElement) => {
            const bubble = element.getBoundingClientRect();
            const panel = root.getBoundingClientRect();
            const height = Math.min(bubble.bottom, panel.bottom, window.innerHeight) - Math.max(bubble.top, panel.top, 0);
            const width = Math.min(bubble.right, panel.right, window.innerWidth) - Math.max(bubble.left, panel.left, 0);
            // Large messages can exceed the viewport; require a meaningful visible portion.
            return height > 0 && width > 0 && height >= Math.min(bubble.height, panel.height) / 2;
        };
        const schedule = () => {
            if (!canRead() || sending || timer !== undefined) return;
            timer = window.setTimeout(() => { timer = undefined; void flush(); }, 200);
        };
        const flush = async () => {
            if (!canRead() || sending) return;
            const ids = [...visible].filter(([id, element]) => !acknowledged.has(id) && isVisible(element)).map(([id]) => id).slice(0, 100);
            if (!ids.length) return;
            sending = true;
            let saved = false;
            try {
                await chatApi.markAsRead(conversationId, ids);
                ids.forEach(id => acknowledged.add(id));
                saved = true;
                // Badges refresh only after the server confirms the read.
                emitNotificationsChanged();
            } catch {
                // Preserve unread state and retry on visibility/connection changes or the next tick.
            } finally {
                sending = false;
                if (saved) schedule();
            }
        };
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                const element = entry.target as HTMLElement;
                const id = Number(element.dataset.chatMessageId);
                if (entry.isIntersecting) visible.set(id, element);
                else visible.delete(id);
            }
            schedule();
        }, { threshold: [0, 0.5, 1] });
        root.querySelectorAll<HTMLElement>('[data-chat-message-id]').forEach(element => {
            if (eligible.has(Number(element.dataset.chatMessageId))) observer.observe(element);
        });
        const retry = window.setInterval(schedule, 30_000);
        root.addEventListener('scroll', schedule);
        window.addEventListener('focus', schedule);
        window.addEventListener('online', schedule);
        document.addEventListener('visibilitychange', schedule);
        return () => {
            active = false;
            observer.disconnect();
            window.clearTimeout(timer);
            window.clearInterval(retry);
            root.removeEventListener('scroll', schedule);
            window.removeEventListener('focus', schedule);
            window.removeEventListener('online', schedule);
            document.removeEventListener('visibilitychange', schedule);
        };
    }, [conversationId, enabled, messages, viewport]);
}
