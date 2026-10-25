import type { ChatChanges, ChatMessage, ChatPage } from './api';

/**
 * The part of the conversation on screen: messages in order, whether more lie before or after it, and the revision
 * the client has caught up to. Pages and changes only ever replace a message by its id, so applying the same thing
 * twice, or a push and a fetch of the same message, changes nothing. The window never grows past {@link MAX_WINDOW}
 * messages: what falls off one end can be paged back in, so a long chat costs the browser only a few pages.
 */
export interface ChatWindow { messages: ChatMessage[]; hasOlder: boolean; hasNewer: boolean; cursor: number; loaded: boolean }

export const EMPTY_WINDOW: ChatWindow = { messages: [], hasOlder: false, hasNewer: false, cursor: 0, loaded: false };

/** About three pages: enough to scroll around in, small enough to keep in memory and draw. */
export const MAX_WINDOW = 150;

const excerpt = (text: string) => text.length > 160 ? `${text.slice(0, 157)}…` : text;

/** Replies on screen quote a message as it reads now: an edit or a deletion shows in their quotes too. */
const requote = (messages: ChatMessage[], changed: ChatMessage[]) => {
    const byId = new Map(changed.map(message => [message.id, message]));
    return messages.map(message => {
        const quote = message.replyTo;
        const source = quote ? byId.get(quote.id) : undefined;
        if (!quote || !source) return message;
        return {
            ...message,
            replyTo: {
                ...quote, excerpt: source.deleted ? '' : excerpt(source.content), deleted: source.deleted,
                attachments: source.deleted ? 0 : source.attachments.length,
            },
        };
    });
};

const merge = (messages: ChatMessage[], incoming: ChatMessage[]) => {
    const byId = new Map(messages.map(message => [message.id, message]));
    // An older copy never replaces a newer one (a page read before a change arrives after it).
    for (const message of incoming) {
        const known = byId.get(message.id);
        if (!known || message.revision >= known.revision) byId.set(message.id, message);
    }
    return requote([...byId.values()].sort((a, b) => a.id - b.id), incoming.filter(message => byId.get(message.id) === message));
};

/** Over the limit, the far end is let go: the newest when reading back in time, the oldest when moving forward. */
const trim = (window: ChatWindow, keep: 'start' | 'end'): ChatWindow => {
    if (window.messages.length <= MAX_WINDOW) return window;
    return keep === 'start'
        ? { ...window, messages: window.messages.slice(0, MAX_WINDOW), hasNewer: true }
        : { ...window, messages: window.messages.slice(window.messages.length - MAX_WINDOW), hasOlder: true };
};

/** A fresh window (the newest, or around a message). Changes are asked for from the page's own revision. */
export const replaceWindow = (page: ChatPage): ChatWindow =>
    ({ messages: merge([], page.messages), hasOlder: page.hasOlder, hasNewer: page.hasNewer, cursor: page.revision, loaded: true });

/** Older messages above; the cursor steps back if the page is older than it, so nothing changed in between is missed. */
export const addOlder = (window: ChatWindow, page: ChatPage): ChatWindow =>
    trim({ ...window, messages: merge(window.messages, page.messages), hasOlder: page.hasOlder, cursor: Math.min(window.cursor, page.revision) }, 'start');

export const addNewer = (window: ChatWindow, page: ChatPage): ChatWindow =>
    trim({ ...window, messages: merge(window.messages, page.messages), hasNewer: page.hasNewer, cursor: Math.min(window.cursor, page.revision) }, 'end');

/**
 * What changed since the cursor: messages on screen are replaced; new ones join at the end only when the window
 * reaches the newest message (otherwise "Jump to the newest" brings them). Someone `following` the newest end lets
 * the oldest go when the window is full; someone reading further up keeps everything: new messages join only while
 * there is room, the rest wait behind "Jump to the newest".
 */
export const applyChanges = (window: ChatWindow, changes: ChatChanges, following = true): ChatWindow => {
    const last = window.messages.at(-1)?.id ?? 0;
    const shown = new Set(window.messages.map(message => message.id));
    let taken = changes.messages.filter(message => shown.has(message.id) || (!window.hasNewer && message.id > last));
    let hasNewer = window.hasNewer;
    if (!following) {
        const fresh = taken.filter(message => !shown.has(message.id)).sort((a, b) => a.id - b.id);
        const room = Math.max(0, MAX_WINDOW - window.messages.length);
        if (fresh.length > room) {
            const joining = new Set(fresh.slice(0, room).map(message => message.id));
            taken = taken.filter(message => shown.has(message.id) || joining.has(message.id));
            hasNewer = true;
        }
    }
    // A quoted message may lie above the window: its change still reaches the quotes on screen.
    const next = { ...window, hasNewer, messages: requote(merge(window.messages, taken), changes.messages), cursor: Math.max(window.cursor, changes.revision) };
    return following ? trim(next, 'end') : next;
};

/** A message the server just returned (sent, edited, deleted, reacted to). */
export const upsert = (window: ChatWindow, message: ChatMessage): ChatWindow => {
    const shown = window.messages.some(known => known.id === message.id);
    const last = window.messages.at(-1)?.id ?? 0;
    // Only what is on screen, or newer than all of it at the live end, joins: the window never gets a gap.
    if (shown || (!window.hasNewer && message.id > last)) return trim({ ...window, messages: merge(window.messages, [message]) }, 'end');
    return { ...window, messages: requote(window.messages, [message]) };
};
