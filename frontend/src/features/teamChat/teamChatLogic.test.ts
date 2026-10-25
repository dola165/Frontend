import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatLimits, ChatMessage, ChatTaskRef } from './api';
import { addNewer, addOlder, applyChanges, EMPTY_WINDOW, MAX_WINDOW, replaceWindow, upsert } from './chatWindow';
import { rowsOf } from './chatRows';
import { createOutbox } from './outbox';
import { createReader, lastSeen, unseenBelow } from './reading';
import { parts } from './richText';
import { kindOf } from './useChatUploads';

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 24, 10, minutes)).toISOString();
const message = (id: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
    id, senderId: 1, senderName: 'Beqa', content: `message ${id}`, createdAt: at(id), editedAt: null, deleted: false, replyTo: null,
    attachments: [], reactions: [], mentions: [], tasks: [], revision: id, clientMessageId: null, ...extra,
});
const page = (ids: number[], extra: { hasOlder?: boolean; hasNewer?: boolean; revision?: number } = {}) =>
    ({ messages: ids.map(id => message(id)), hasOlder: false, hasNewer: false, revision: Math.max(0, ...ids), ...extra });

describe('the window of messages', () => {
    it('applies the same change twice without doubling and never lets an older copy win', () => {
        let view = replaceWindow(page([1, 2, 3]));
        const edited = message(2, { content: 'edited', revision: 10 });
        view = applyChanges(view, { messages: [edited, message(4, { revision: 11 })], revision: 11, more: false });
        view = applyChanges(view, { messages: [edited], revision: 11, more: false });
        expect(view.messages.map(found => found.id)).toEqual([1, 2, 3, 4]);
        view = upsert(view, message(2, { content: 'stale', revision: 5 }));
        expect(view.messages[1].content).toBe('edited');
        expect(view.cursor).toBe(11);
    });

    it('keeps new messages out while it shows an older part, and steps its cursor back for older pages', () => {
        let view = replaceWindow(page([40, 41], { hasNewer: true, hasOlder: true, revision: 50 }));
        view = applyChanges(view, { messages: [message(60, { revision: 60 }), message(41, { content: 'changed', revision: 61 })], revision: 61, more: false });
        expect(view.messages.map(found => found.id)).toEqual([40, 41]);
        expect(view.messages[1].content).toBe('changed');
        view = addOlder(view, page([38, 39], { hasOlder: false, revision: 55 }));
        expect(view.messages.map(found => found.id)).toEqual([38, 39, 40, 41]);
        expect(view.cursor).toBe(55);
        expect(upsert(view, message(70)).messages).toHaveLength(4);
        expect(EMPTY_WINDOW.loaded).toBe(false);
    });
});

describe('a long chat in memory', () => {
    const ids = (from: number, count: number) => Array.from({ length: count }, (_, index) => from + index);

    it('holds a few pages at most: moving back lets the newest go, moving forward the oldest', () => {
        let view = replaceWindow(page(ids(201, 100), { hasOlder: true, revision: 400 }));
        view = addOlder(view, page(ids(101, 100), { hasOlder: true, revision: 400 }));
        expect(view.messages).toHaveLength(MAX_WINDOW);
        expect(view.messages[0].id).toBe(101);
        expect(view.hasNewer).toBe(true);
        view = addNewer(view, page(ids(251, 50), { hasNewer: false, revision: 400 }));
        expect(view.messages).toHaveLength(MAX_WINDOW);
        expect(view.messages.at(-1)?.id).toBe(300);
        expect(view.hasOlder).toBe(true);
    });

    it('lets the oldest go for someone at the newest end, but never under someone reading further up', () => {
        const full = replaceWindow(page(ids(1, MAX_WINDOW), { revision: 500 }));
        const fresh = { messages: ids(MAX_WINDOW + 1, 5).map(id => message(id, { revision: 600 + id })), revision: 800, more: false };
        const following = applyChanges(full, fresh, true);
        expect(following.messages).toHaveLength(MAX_WINDOW);
        expect(following.messages.at(-1)?.id).toBe(MAX_WINDOW + 5);
        expect(following.hasNewer).toBe(false);
        const reading = applyChanges(full, fresh, false);
        expect(reading.messages[0].id).toBe(1);
        expect(reading.messages).toHaveLength(MAX_WINDOW);
        // The newest wait behind "Jump to the newest".
        expect(reading.hasNewer).toBe(true);
    });
});

describe('quotes', () => {
    it('follow an edit or a deletion of the quoted message, even when it lies above the window', () => {
        const reply = message(9, { replyTo: { id: 2, senderId: 1, senderName: 'Beqa', excerpt: 'message 2', deleted: false, attachments: 0 } });
        let view = replaceWindow({ messages: [reply], hasOlder: true, hasNewer: false, revision: 9 });
        view = applyChanges(view, { messages: [message(2, { content: 'better words', revision: 20 })], revision: 20, more: false });
        expect(view.messages[0].replyTo).toMatchObject({ excerpt: 'better words', deleted: false });
        view = upsert(view, message(2, { content: '', deleted: true, revision: 21 }));
        expect(view.messages.map(found => found.id)).toEqual([9]);
        expect(view.messages[0].replyTo).toMatchObject({ excerpt: '', deleted: true });
    });
});

describe('the outbox', () => {
    beforeEach(() => { localStorage.clear(); localStorage.setItem('gk-session-id', 'one'); localStorage.setItem('userId', '7'); });

    it('keeps a message with its own key until the server confirms it, also after a reload', () => {
        const outbox = createOutbox(50);
        const first = outbox.add({ content: 'hello', replyTo: null, attachments: [] });
        expect(createOutbox(50).list()).toEqual([first]);
        expect(createOutbox(51).list()).toEqual([]);
        outbox.refuse(first.key, 'refused');
        expect(createOutbox(50).list()[0].refused).toBe('refused');
        outbox.retry(first.key);
        expect(createOutbox(50).list()[0]).toEqual(first);
        outbox.remove(first.key);
        expect(createOutbox(50).list()).toEqual([]);
    });

    it('never hands one login’s messages to another, even on the same account', () => {
        createOutbox(50).add({ content: 'from the first login', replyTo: null, attachments: [] });
        createOutbox(51).add({ content: 'and another chat', replyTo: null, attachments: [] });
        localStorage.setItem('gk-session-id', 'two');
        const second = createOutbox(50);
        expect(second.list()).toEqual([]);
        second.add({ content: 'second', replyTo: null, attachments: [] });
        expect(Object.keys(localStorage).filter(key => key.startsWith('gk-team-chat-outbox:'))).toEqual(['gk-team-chat-outbox:two:7:50']);
    });
});

describe('the words of a message', () => {
    const gio = { id: 2, name: 'Gio', avatarUrl: null }, gioBeridze = { id: 3, name: 'Gio Beridze', avatarUrl: null };
    const task: ChatTaskRef = { id: 12, key: 'GK-12', title: 'Registration', status: 'IN_PROGRESS', parentId: null };

    it('marks the mentioned (longest name first, any case), links known tasks and links, and leaves e-mail addresses alone', () => {
        const found = parts('@gio beridze and @Gio: GK-12, GK-99 and https://example.com/a. Mail beqa@Gio.ge', [gio, gioBeridze], [task], 'https://app.test');
        expect(found.filter(part => part.kind === 'mention').map(part => part.kind === 'mention' && part.person.id)).toEqual([3, 2]);
        expect(found.filter(part => part.kind === 'task').map(part => part.text)).toEqual(['GK-12']);
        expect(found.find(part => part.kind === 'url')).toMatchObject({ text: 'https://example.com/a', internal: null });
        expect(found.map(part => part.text).join('')).toBe('@gio beridze and @Gio: GK-12, GK-99 and https://example.com/a. Mail beqa@Gio.ge');
    });

    it('keeps the app’s own links inside the app', () => {
        expect(parts('see https://app.test/team-work?task=3', [], [], 'https://app.test')[1]).toMatchObject({ kind: 'url', internal: '/team-work?task=3' });
    });

    it('marks nobody who was not counted as mentioned', () => {
        expect(parts('@Gio hello', [], []).every(part => part.kind === 'text')).toBe(true);
    });
});

describe('rows', () => {
    it('groups a writer’s messages within five minutes and puts the New line before the first unread', () => {
        const rows = rowsOf([message(1), message(2), message(9), message(10, { senderId: 2 })], 9, () => 'Today');
        expect(rows.map(row => row.kind === 'message' ? `${row.message.id}${row.compact ? 'c' : ''}` : row.kind))
            .toEqual(['day', '1', '2c', 'unread', '9', '10']);
    });

    it('draws the New line only where the unread messages really start, never on top of a later part of the chat', () => {
        const kinds = (rows: ReturnType<typeof rowsOf>) => rows.map(row => row.kind === 'message' ? String(row.message.id) : row.kind);
        // Unread from message 3, but the part loaded starts at 9 (earlier messages are not loaded): no line at its top.
        expect(kinds(rowsOf([message(9), message(10)], 3, () => 'Today', true))).toEqual(['day', '9', '10']);
        // The part loaded starts exactly at the first unread, or is the start of the chat: the line is real.
        expect(kinds(rowsOf([message(3), message(4)], 3, () => 'Today', true))).toEqual(['day', 'unread', '3', '4']);
        expect(kinds(rowsOf([message(9), message(10)], 3, () => 'Today', false))).toEqual(['day', 'unread', '9', '10']);
    });
});

describe('reading', () => {
    it('counts as seen the newest message whose top is on screen', () => {
        const rows = [{ id: 4, top: 100 }, { id: 5, top: 500 }, { id: 6, top: 790 }, { id: 7, top: 1200 }];
        expect(lastSeen(rows, 800)).toBe(5);
        expect(lastSeen(rows, 900)).toBe(6);
        expect(lastSeen(rows, 50)).toBeNull();
    });

    it('counts the new messages from others below what has been on screen', () => {
        const messages = [message(4, { senderId: 2 }), message(5, { senderId: 2 }), message(6), message(7, { senderId: 3, deleted: true }), message(8, { senderId: 3 })];
        expect(unseenBelow(messages, 4, 1)).toBe(2);
        expect(unseenBelow(messages, 8, 1)).toBe(0);
    });

    it('never loses a read: one asked for while another is on its way goes next, a failed one is tried again', async () => {
        const sent: number[] = [];
        const answers: Array<{ resolve: () => void; reject: () => void }> = [];
        const read = createReader(upTo => { sent.push(upTo); return new Promise<void>((resolve, reject) => answers.push({ resolve, reject })); }, () => undefined);
        read(5);
        read(7);
        read(9);
        expect(sent).toEqual([5]);
        answers[0].resolve();
        await Promise.resolve(); await Promise.resolve();
        expect(sent).toEqual([5, 9]);
        answers[1].reject();
        await Promise.resolve(); await Promise.resolve();
        read(9);
        expect(sent).toEqual([5, 9, 9]);
        answers[2].resolve();
        await Promise.resolve(); await Promise.resolve();
        read(8);
        expect(sent).toEqual([5, 9, 9]);
    });
});

describe('upload kinds', () => {
    const limits: ChatLimits = {
        pictureMb: 10, videoMb: 90, fileMb: 25, videoTypes: ['video/mp4', 'video/webm'], fileExtensions: ['pdf', 'txt'], maxLength: 2000, maxAttachments: 10,
        maxDecision: 200,
    };
    it('routes pictures, videos and the team’s file kinds, and refuses anything else', () => {
        expect(kindOf(new File(['x'], 'a.png', { type: 'image/png' }), limits)).toBe('IMAGE');
        expect(kindOf(new File(['x'], 'a.webm', { type: 'video/webm' }), limits)).toBe('VIDEO');
        expect(kindOf(new File(['x'], 'plan.PDF', { type: 'application/pdf' }), limits)).toBe('FILE');
        expect(kindOf(new File(['x'], 'tool.exe', { type: 'application/x-msdownload' }), limits)).toBeNull();
    });
});
