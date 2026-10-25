import { getAuthSessionId, getStoredUserId, isCurrentAuthSession } from '../../utils/authStorage';
import type { ChatAttachment, ChatQuote } from './api';

/**
 * A message on its way: kept until the server confirms it, so a closed tab, a reload or a lost connection never
 * loses it. Each has its own key from the moment it is written; sending it again with that key can never make a
 * second message (the server answers with the first one).
 */
export interface Pending {
    key: string; content: string; replyTo: ChatQuote | null; attachments: ChatAttachment[]; createdAt: string;
    /** Why the server refused it (it will not be retried by itself); null while it waits or is on its way. */
    refused: string | null;
}

const prefix = 'gk-team-chat-outbox:';
const valid = (item: unknown): item is Pending => {
    const pending = item as Pending;
    return typeof pending?.key === 'string' && typeof pending.content === 'string' && typeof pending.createdAt === 'string'
        && Array.isArray(pending.attachments) && (pending.refused === null || typeof pending.refused === 'string');
};

/** The outbox of one login and one chat, in this browser. A different login (even the same account) never sees it. */
export function createOutbox(chatId: number) {
    const session = getAuthSessionId();
    const user = getStoredUserId();
    const login = `${prefix}${session ?? 'legacy'}:${user ?? 'guest'}:`;
    const key = `${login}${chatId}`;
    const current = () => isCurrentAuthSession(session) && getStoredUserId() === user;
    let memory: Pending[] = [];
    const read = (): Pending[] => {
        if (!current()) return [];
        try {
            const saved = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
            if (Array.isArray(saved)) memory = saved.filter(valid);
        } catch { /* Storage unavailable: the memory copy is all there is. */ }
        return memory;
    };
    const write = (items: Pending[]) => {
        if (!current()) return;
        memory = items;
        try {
            // Retired logins' messages are never sent later, even for the same account; other chats of this login keep theirs.
            for (const stored of Object.keys(localStorage)) if (stored.startsWith(prefix) && !stored.startsWith(login)) localStorage.removeItem(stored);
            if (items.length) localStorage.setItem(key, JSON.stringify(items));
            else localStorage.removeItem(key);
        } catch { /* Kept in memory for this page. */ }
    };
    return {
        current,
        list: read,
        add(item: Omit<Pending, 'key' | 'createdAt' | 'refused'>) {
            const pending: Pending = { ...item, key: crypto.randomUUID(), createdAt: new Date().toISOString(), refused: null };
            write([...read(), pending]);
            return pending;
        },
        /** Confirmed by the server: gone from the outbox. */
        remove(key: string) { write(read().filter(item => item.key !== key)); },
        refuse(key: string, reason: string) { write(read().map(item => item.key === key ? { ...item, refused: reason } : item)); },
        /** Try a refused message again, with the same key. */
        retry(key: string) { write(read().map(item => item.key === key ? { ...item, refused: null } : item)); },
    };
}
export type Outbox = ReturnType<typeof createOutbox>;
