import type { ChatMessage } from './api';
import { sameDay } from './teamChatWords';

export type Row =
    | { kind: 'day'; key: string; label: string }
    | { kind: 'unread'; key: string }
    | { kind: 'message'; key: string; message: ChatMessage; compact: boolean };
const GROUP_MS = 5 * 60_000;

/** Day headings, the "New" line where unread messages started, and messages grouped by writer within five minutes. */
export function rowsOf(messages: ChatMessage[], firstUnread: number | null, label: (value: string) => string): Row[] {
    const rows: Row[] = [];
    let previous: ChatMessage | null = null;
    for (const message of messages) {
        const newDay = !previous || !sameDay(previous.createdAt, message.createdAt);
        if (newDay) rows.push({ kind: 'day', key: `day-${message.id}`, label: label(message.createdAt) });
        const unread = firstUnread !== null && message.id >= firstUnread && (!previous || previous.id < firstUnread);
        if (unread) rows.push({ kind: 'unread', key: 'unread' });
        const compact = !!previous && !newDay && !unread && !message.replyTo && previous.senderId === message.senderId
            && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < GROUP_MS;
        rows.push({ kind: 'message', key: `m-${message.id}`, message, compact });
        previous = message;
    }
    return rows;
}
