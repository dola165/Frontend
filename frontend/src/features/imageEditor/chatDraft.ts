import { useSyncExternalStore } from 'react';
import type { ChatAttachment } from '../teamChat/api';
import { onAccountChange } from './accountChange';
import type { SavedCopy } from './api';

/**
 * An edited copy saved for a team chat, on its way into that chat's message box: an unsent upload of the chat
 * (`attachment`, with the edited `file` for its preview), answering the original's message (`replyToId`). Copies wait in
 * order, any number per chat, until the chat takes them; one left untaken is an ordinary unsent upload, removed by the
 * server after a day. Signing out or switching account drops them.
 */
export interface ChatDraft { chatId: number; replyToId: number; attachment: ChatAttachment; file: File }

let waiting: ChatDraft[] = [];
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

onAccountChange(() => { if (waiting.length) { waiting = []; notify(); } });

/** Hands a copy saved in a chat to that chat's message box; Team work copies have none. Returns whether it did. */
export function handOffChatDraft(saved: SavedCopy, file: File) {
    if (saved.place !== 'CHAT' || !saved.attachment || saved.chatId === null || saved.replyToId === null) return false;
    waiting = [...waiting, { chatId: saved.chatId, replyToId: saved.replyToId, attachment: saved.attachment, file }];
    notify();
    return true;
}

/** Every copy waiting for this chat, oldest first, taken so each goes in once. */
export function takeChatDrafts(chatId: number) {
    const mine = waiting.filter(draft => draft.chatId === chatId);
    if (!mine.length) return mine;
    waiting = waiting.filter(draft => draft.chatId !== chatId);
    notify();
    return mine;
}

/** The copies waiting for this chat, oldest first, left where they are. */
export const chatDraftsFor = (chatId: number) => waiting.filter(draft => draft.chatId === chatId);

/** How many copies wait for this chat's message box. */
export function useChatDrafts(chatId: number) {
    return useSyncExternalStore(subscribe, () => waiting.filter(draft => draft.chatId === chatId).length, () => 0);
}
