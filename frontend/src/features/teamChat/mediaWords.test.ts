import { describe, expect, it } from 'vitest';
import type { ChatEvent } from './api';
import { cleanTag, eventLine, mediaFiltersOf, mediaParams, narrowed, shownName, splitTags, withTags } from './mediaWords';

const en = (english: string) => english;
const ka = (_: string, georgian: string) => georgian;
const beqa = { id: 1, name: 'Beqa', avatarUrl: null }, gio = { id: 2, name: 'Gio', avatarUrl: null }, ilo = { id: 3, name: 'Ilo', avatarUrl: null };

describe('names and tags', () => {
    it('shows the name people gave a file, else its own name', () => {
        expect(shownName({ name: 'IMG_2041.jpg', title: 'Dinamo arena entrance' })).toBe('Dinamo arena entrance');
        expect(shownName({ name: 'IMG_2041.jpg', title: '  ' })).toBe('IMG_2041.jpg');
        expect(shownName({ name: 'IMG_2041.jpg' })).toBe('IMG_2041.jpg');
    });
    it('keeps tags as the server does: no "#", one space, lower case, each once, at most ten', () => {
        expect(cleanTag('  #Dinamo   Arena ')).toBe('dinamo arena');
        expect(cleanTag('ფორმა')).toBe('ფორმა');
        expect(withTags(['kit'], ['KIT', '#Stadium', '', 'x'.repeat(41)])).toEqual(['kit', 'stadium']);
        expect(withTags([], Array.from({ length: 14 }, (_, n) => `tag${n}`))).toHaveLength(10);
        expect(splitTags('kit, stadium;contracts')).toEqual(['kit', 'stadium', 'contracts']);
    });
});

describe('the chat’s own lines', () => {
    const line = (event: ChatEvent, copy = en, me: number | null = 9) => eventLine(copy as never, event, me);
    it('says who did what, in English and in Georgian without changing a name’s ending', () => {
        expect(line({ kind: 'ADDED', by: beqa, people: [gio, ilo] })).toBe('Beqa added Gio, Ilo');
        expect(line({ kind: 'ADDED', by: beqa, people: [gio] }, ka as never)).toBe('Beqa · დაამატა: Gio');
        expect(line({ kind: 'REMOVED', by: beqa, people: [gio] })).toBe('Beqa removed Gio');
        expect(line({ kind: 'LEFT', by: gio, people: [] }, ka as never)).toBe('Gio · დატოვა ჩატი');
        expect(line({ kind: 'CHOSEN', by: beqa, people: [] })).toBe('Beqa made this chat for chosen people');
        expect(line({ kind: 'EVERYONE', by: beqa, people: [ilo] })).toBe('Beqa opened this chat to everyone on the team; Ilo joined');
        expect(line({ kind: 'EVERYONE', by: beqa, people: [] })).toBe('Beqa opened this chat to everyone on the team');
    });
    it('calls the reader "you"', () => {
        expect(line({ kind: 'ADDED', by: beqa, people: [gio] }, en, 1)).toBe('You added Gio');
    });
});

describe('the media page’s address', () => {
    it('reads and writes every filter, and ignores what it does not know', () => {
        const filters = mediaFiltersOf(new URLSearchParams('in=chat-51&mkind=IMAGE&mfrom=2&mtag=kit&mq=arena'));
        expect(filters).toEqual({ chat: 51, place: 'CHATS', kind: 'IMAGE', from: 2, tag: 'kit', q: 'arena' });
        expect(mediaParams(filters)).toEqual({ in: 'chat-51', mkind: 'IMAGE', mfrom: '2', mtag: 'kit', mq: 'arena' });
        expect(mediaFiltersOf(new URLSearchParams('in=tasks')).place).toBe('TASKS');
        expect(mediaFiltersOf(new URLSearchParams('in=nowhere&mkind=SOUND'))).toEqual({ chat: null, place: 'ALL', kind: null, from: null, tag: null, q: null });
        expect(mediaParams({ place: 'ALL' })).toEqual({ in: null, mkind: null, mfrom: null, mtag: null, mq: null });
        expect(narrowed({ place: 'ALL' })).toBe(false);
        expect(narrowed({ place: 'KEPT' })).toBe(true);
    });
});
