import type { ChatMessage } from './api';

/** How much of a message must be on screen for it to count as seen. */
const SEEN_PX = 16;

/**
 * The newest message on screen: the last row whose top has come above the list's bottom edge (by a little), in a list
 * of rows top to bottom. Null when none has.
 */
export function lastSeen(rows: { id: number; top: number }[], viewBottom: number): number | null {
    let seen: number | null = null;
    for (const row of rows) {
        if (row.top > viewBottom - SEEN_PX) break;
        seen = row.id;
    }
    return seen;
}

/** Messages from others below what has been on screen: the "N new messages" waiting under the person's place. */
export const unseenBelow = (messages: ChatMessage[], seenTo: number, me: number | null) =>
    messages.filter(message => message.id > seenTo && message.senderId !== me && !message.deleted).length;

/**
 * Marks a chat read up to a message, one request at a time and never losing one: a read asked for while another is on
 * its way goes next (only the newest asked for); a failed one is tried again on the next ask.
 */
export function createReader(send: (upTo: number) => Promise<unknown>, onRead: (upTo: number) => void) {
    let done = 0, wanted = 0, busy = false;
    const pump = async () => {
        if (busy) return;
        busy = true;
        try {
            while (wanted > done) {
                const upTo = wanted;
                try {
                    await send(upTo);
                } catch {
                    return;
                }
                done = Math.max(done, upTo);
                onRead(done);
            }
        } finally {
            busy = false;
        }
    };
    return (upTo: number) => {
        if (upTo <= done) return;
        wanted = Math.max(wanted, upTo);
        void pump();
    };
}
