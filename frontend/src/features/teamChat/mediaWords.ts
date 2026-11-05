import type { AttachmentKind, ChatAttachment, ChatEvent, MediaFilters, MediaItem, MediaPlace } from './api';
import type { LabelTarget } from './LabelDialog';
import type { Copy } from './teamChatWords';

/** How many tags a file takes, and how long a tag and a name may be (the server's limits). */
export const MAX_TAGS = 10;
export const MAX_TAG = 40;
export const MAX_TITLE = 120;

/** What a file is called on screen: the name people gave it, else its own file name. */
export const shownName = (attachment: Pick<ChatAttachment, 'name' | 'title'>) => attachment.title?.trim() || attachment.name;

/** A tag as the server keeps it: no leading "#", one space between words, lower case. Empty when nothing is left. */
export const cleanTag = (typed: string) => typed.trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Tags added to a list: cleaned, each once, at most {@link MAX_TAGS}; too long ones are left out. */
export function withTags(current: string[], typed: string[]) {
    const tags = [...current];
    for (const one of typed) {
        const tag = cleanTag(one);
        if (!tag || tag.length > MAX_TAG || tags.includes(tag)) continue;
        if (tags.length >= MAX_TAGS) break;
        tags.push(tag);
    }
    return tags;
}

/** What a typed line holds as tags: commas (and Georgian/English semicolons) end one. */
export const splitTags = (line: string) => line.split(/[,;\n]/).map(part => part.trim()).filter(Boolean);

const names = (copy: Copy, people: ChatEvent['people']) =>
    people.map(person => person.name ?? copy('someone', 'ვიღაც')).join(', ');

/**
 * A line the chat wrote itself, in the reader's language: "Beqa added Gio", "Gio left the chat". Georgian keeps the
 * name first and says what happened after a dot, so no name has to change its ending.
 */
export function eventLine(copy: Copy, event: ChatEvent, me: number | null) {
    const by = event.by.id === me ? copy('You', 'თქვენ') : event.by.name ?? copy('Someone', 'ვიღაც');
    const them = names(copy, event.people);
    switch (event.kind) {
        case 'ADDED': return copy(`${by} added ${them}`, `${by} · დაამატა: ${them}`);
        case 'REMOVED': return copy(`${by} removed ${them}`, `${by} · ამოიღო ჩატიდან: ${them}`);
        case 'LEFT': return copy(`${by} left the chat`, `${by} · დატოვა ჩატი`);
        case 'CHOSEN': return copy(`${by} made this chat for chosen people`, `${by} · ჩატი მხოლოდ არჩეული ხალხისთვისაა`);
        default: return event.people.length
            ? copy(`${by} opened this chat to everyone on the team; ${them} joined`, `${by} · ჩატი მთელ გუნდს გაუხსნა; შემოუერთდა: ${them}`)
            : copy(`${by} opened this chat to everyone on the team`, `${by} · ჩატი მთელ გუნდს გაუხსნა`);
    }
}

const KINDS: AttachmentKind[] = ['IMAGE', 'VIDEO', 'FILE'];
const PLACES: MediaPlace[] = ['ALL', 'CHATS', 'TASKS', 'KEPT'];

/**
 * The media page's filters as the address keeps them: ?in= (all, chats, tasks, kept, or chat-12), ?mfrom=, ?mkind=,
 * ?mtag=, ?mq=. Anything unknown reads as no filter.
 */
export function mediaFiltersOf(params: URLSearchParams): MediaFilters {
    const where = params.get('in') ?? '';
    const chat = /^chat-(\d+)$/.exec(where);
    const place = PLACES.find(value => value.toLowerCase() === where) ?? 'ALL';
    return {
        chat: chat ? Number(chat[1]) : null,
        place: chat ? 'CHATS' : place,
        kind: KINDS.find(value => value === params.get('mkind')) ?? null,
        from: Number(params.get('mfrom')) || null,
        tag: params.get('mtag')?.trim() || null,
        q: params.get('mq')?.trim() || null,
    };
}

/** The address changes for these filters (null removes a key). */
export function mediaParams(filters: MediaFilters): Record<string, string | null> {
    return {
        in: filters.chat ? `chat-${filters.chat}` : filters.place && filters.place !== 'ALL' ? filters.place.toLowerCase() : null,
        mkind: filters.kind ?? null,
        mfrom: filters.from ? String(filters.from) : null,
        mtag: filters.tag || null,
        mq: filters.q || null,
    };
}

/** Whether any filter narrows the page (then an empty page says "nothing like that", not "nothing yet"). */
export const narrowed = (filters: MediaFilters) => !!(filters.chat || (filters.place && filters.place !== 'ALL') || filters.kind || filters.from || filters.tag || filters.q);

/** Where an item lives, in a few words: its chat, its task, or the deleted chat it was kept from. */
export function placeOf(copy: Copy, item: MediaItem) {
    if (item.source === 'CHAT') return item.chatName ?? copy('A chat', 'ჩატი');
    if (item.source === 'TASK') return item.task ? `${item.task.key} ${item.task.title}` : copy('A task', 'საქმე');
    return item.keptFrom ? copy(`Kept from “${item.keptFrom}”`, `შენახულია „${item.keptFrom}“-დან`) : copy('Kept files', 'შენახული ფაილები');
}

/** The file as the name-and-tags dialog takes it. */
export const labelTarget = (item: Pick<MediaItem, 'source' | 'attachment'>): LabelTarget => ({
    source: item.source, id: item.attachment.id, fileName: item.attachment.name, title: item.attachment.title ?? null, tags: item.attachment.tags ?? [],
    labelledBy: item.attachment.labelledBy ?? null, labelledAt: item.attachment.labelledAt ?? null,
});
