import { useSyncExternalStore } from 'react';
import type { ChatAttachment } from '../teamChat/api';
import type { SavedCopy } from './api';

/**
 * An edited copy saved for a team chat, on its way into that chat's message box: an unsent upload of the chat
 * (`attachment`, with the edited `file` for its preview), answering the original's message (`replyToId`). The chat
 * takes it when it is open; one left untaken is an ordinary unsent upload, removed by the server after a day.
 */
export interface ChatDraft { chatId: number; replyToId: number; attachment: ChatAttachment; file: File }

let waiting: ChatDraft | null = null;
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Hands a copy saved in a chat to that chat's message box; Team work copies have none. Returns whether it did. */
export function handOffChatDraft(saved: SavedCopy, file: File) {
    if (saved.place !== 'CHAT' || !saved.attachment || saved.chatId === null || saved.replyToId === null) return false;
    waiting = { chatId: saved.chatId, replyToId: saved.replyToId, attachment: saved.attachment, file };
    notify();
    return true;
}

/** The copy waiting for this chat, taken so it goes in once. */
export function takeChatDraft(chatId: number) {
    if (waiting?.chatId !== chatId) return null;
    const draft = waiting;
    waiting = null;
    notify();
    return draft;
}

/** The copy waiting for this chat's message box, if any. */
export function useChatDraft(chatId: number) {
    return useSyncExternalStore(subscribe, () => (waiting?.chatId === chatId ? waiting : null), () => null);
}
