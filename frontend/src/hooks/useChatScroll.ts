import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Keep the visible bubble in place during prepends and arrivals while reading history. */
export function useChatScroll(viewport: RefObject<HTMLDivElement | null>, conversationId: number | null, ready: boolean) {
    const previous = useRef<{ root: HTMLDivElement; id: number; bottom: boolean; anchor?: HTMLElement; offset: number } | null>(null);
    useLayoutEffect(() => {
        const root = viewport.current;
        if (!root || conversationId === null || !ready) {
            previous.current = null;
            return;
        }
        const snapshot = () => {
            const top = root.getBoundingClientRect().top;
            const anchor = [...root.querySelectorAll<HTMLElement>('[data-chat-message-id]')]
                .find(element => element.getBoundingClientRect().bottom > top);
            previous.current = { root, id: conversationId,
                bottom: root.scrollHeight - root.clientHeight - root.scrollTop < 32,
                anchor, offset: anchor ? anchor.getBoundingClientRect().top - top : 0 };
        };
        const saved = previous.current;
        if (!saved || saved.root !== root || saved.id !== conversationId || saved.bottom) {
            root.scrollTo({ top: root.scrollHeight, behavior: 'instant' });
        } else if (saved.anchor?.isConnected) {
            root.scrollTo({ top: root.scrollTop + saved.anchor.getBoundingClientRect().top - root.getBoundingClientRect().top - saved.offset, behavior: 'instant' });
        }
        snapshot();
        root.addEventListener('scroll', snapshot);
        return () => root.removeEventListener('scroll', snapshot);
    });
}
