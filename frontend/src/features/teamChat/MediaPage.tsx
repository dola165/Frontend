import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { Button, Chip, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { handOffChatDraft } from '../imageEditor/chatDraft';
import type { EditableMedia } from '../imageEditor/EditImageButton';
import { fetchMedia, fetchTags, type AttachmentKind, type ChatHome, type Labelled, type MediaFilters, type MediaItem, type MediaTag } from './api';
import { LabelDialog } from './LabelDialog';
import { Lightbox, type Viewed } from './Lightbox';
import { MediaFileRow, MediaTile } from './MediaBits';
import type { MediaActions } from './mediaMenu';
import { labelTarget, mediaFiltersOf, mediaParams, narrowed, placeOf } from './mediaWords';
import { PictureEditor } from './PictureEditor';
import { taskPath } from './richText';
import { saveFile } from './saveFile';
import { onSharedChanged } from './sharedSignal';
import { problem, shortDay, type Copy } from './teamChatWords';

const KINDS: [AttachmentKind | null, string, string][] = [
    [null, 'All', 'ყველა'], ['IMAGE', 'Pictures', 'სურათები'], ['VIDEO', 'Videos', 'ვიდეო'], ['FILE', 'Files', 'ფაილები'],
];

const captionOf = (copy: Copy, item: MediaItem) => [item.sender?.name, placeOf(copy, item), shortDay(copy, item.at)].filter(Boolean).join(' · ');

/** Where an edited copy of a picture goes: its message, or its task; a kept picture is kept as it is. */
const editPlace = (item: MediaItem): EditableMedia['place'] | null =>
    item.source === 'CHAT' && item.messageId !== null ? { messageId: item.messageId } : item.source === 'TASK' && item.task ? { itemId: item.task.id } : null;

/**
 * Media: every picture, video and file shared in your chats, on Team work tasks and kept from deleted chats, in one
 * place above the chats. Filters: where (everywhere, all chats, one chat, the tasks, the Kept shelf), who shared it,
 * the kind, a tag and words in its name, all in the address (?in=, ?mfrom=, ?mkind=, ?mtag=, ?mq=). Each opens full
 * screen and leads to where it lives ("Show in chat", "Open the task"); right-click (or hold) for the rest.
 */
export function MediaPage({ home, params, set, onShow, onBack }: {
    home: ChatHome | null; params: URLSearchParams; set: (changes: Record<string, string | null>, push?: boolean) => void;
    onShow: (chatId: number, messageId: number) => void; onBack: () => void;
}) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const whereId = useId(), whoId = useId(), tagId = useId(), wordsId = useId(), tagsListId = useId();
    const filters = useMemo(() => mediaFiltersOf(params), [params]);
    const [items, setItems] = useState<MediaItem[] | null>(null);
    const [next, setNext] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [round, setRound] = useState(0);
    const [viewing, setViewing] = useState<number | null>(null);
    const [labelling, setLabelling] = useState<MediaItem | null>(null);
    const [editing, setEditing] = useState<MediaItem | null>(null);
    const [words, setWords] = useState(filters.q ?? '');
    const [tag, setTag] = useState(filters.tag ?? '');
    const [tags, setTags] = useState<MediaTag[]>([]);
    const key = JSON.stringify(filters);

    const change = useCallback((next: Partial<MediaFilters>) => set(mediaParams({ ...filters, ...next })), [filters, set]);

    // The words and the tag go to the address a moment after typing stops.
    useEffect(() => {
        const timer = window.setTimeout(() => { if ((words.trim() || null) !== filters.q) change({ q: words.trim() || null }); }, 350);
        return () => window.clearTimeout(timer);
    }, [words, filters.q, change]);
    useEffect(() => {
        const timer = window.setTimeout(() => { if ((tag.trim() || null) !== filters.tag) change({ tag: tag.trim() || null }); }, 350);
        return () => window.clearTimeout(timer);
    }, [tag, filters.tag, change]);
    useEffect(() => {
        const controller = new AbortController();
        fetchTags(undefined, controller.signal).then(setTags).catch(() => undefined);
        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const quiet = round > 0;
        if (!quiet) { setItems(null); setError(''); }
        fetchMedia(JSON.parse(key) as MediaFilters, null, controller.signal)
            .then(page => { setItems(page.items); setNext(page.next); })
            .catch(failure => { if (!controller.signal.aborted && !quiet) setError(problem(copy, failure, ['The media could not load.', 'მედია ვერ ჩაიტვირთა.'])); });
        return () => controller.abort();
    }, [key, round, copy]);

    // Something shared in a chat: the first page again, quietly, a moment later.
    useEffect(() => {
        let timer: number | undefined;
        const stop = onSharedChanged(() => { window.clearTimeout(timer); timer = window.setTimeout(() => setRound(value => value + 1), 400); });
        return () => { stop(); window.clearTimeout(timer); };
    }, []);

    const more = async () => {
        if (!next) return;
        setLoading(true);
        try { const page = await fetchMedia(filters, next); setItems(current => [...(current ?? []), ...page.items]); setNext(page.next); }
        catch (failure) { setError(problem(copy, failure, ['More could not load.', 'მეტი ვერ ჩაიტვირთა.'])); }
        finally { setLoading(false); }
    };

    const put = (item: MediaItem, labelled: Labelled) => setItems(current => (current ?? []).map(other => other.source === item.source && other.attachment.id === item.attachment.id
        ? { ...other, attachment: { ...other.attachment, ...labelled } } : other));
    const openTask = (item: MediaItem) => { if (item.task) navigate(taskPath(item.task)); };
    const visual = (items ?? []).filter(item => item.attachment.kind !== 'FILE');
    const files = (items ?? []).filter(item => item.attachment.kind === 'FILE');
    const actions = (item: MediaItem, open?: () => void): MediaActions => ({
        onOpen: open,
        onShow: item.chatId !== null && item.messageId !== null ? () => onShow(item.chatId as number, item.messageId as number) : undefined,
        onTask: item.task ? () => openTask(item) : undefined,
        onLabel: () => setLabelling(item),
        onSave: () => void saveFile(item.attachment).catch(() => setError(copy('The file could not be saved; try again.', 'ფაილი ვერ შეინახა; სცადეთ ხელახლა.'))),
        onEdit: editPlace(item) ? () => setEditing(item) : undefined,
        noEdit: editPlace(item) ? undefined : copy('A kept picture stays as it was kept.', 'შენახული სურათი ისე რჩება, როგორც შეინახა.'),
    });
    const viewed: Viewed[] = visual.map(item => ({
        attachment: item.attachment, messageId: item.messageId, chatId: item.chatId, caption: captionOf(copy, item), editable: item.source !== 'KEPT',
        itemId: item.source === 'TASK' ? item.task?.id ?? null : null, task: item.task, label: labelTarget(item),
    }));
    const where = filters.chat ? `chat-${filters.chat}` : (filters.place ?? 'ALL').toLowerCase();
    const chats = home?.chats ?? [];

    return <section className="tc-col tc-col--main tc-media" aria-labelledby={`${whereId}-title`}>
        <header className="tc-chathead">
            <button type="button" className="tc-back tc-chathead__back" onClick={onBack} aria-label={copy('Back to the chats', 'ჩატებზე დაბრუნება')}><ArrowLeft aria-hidden="true" /></button>
            <h2 id={`${whereId}-title`} className="tc-chathead__name">{copy('Media', 'მედია')}</h2>
        </header>
        <div className="tc-media__body">
            <div className="tc-media__filters" role="group" aria-label={copy('Filters', 'ფილტრები')}>
                <label className="tc-media__filter" htmlFor={whereId}><span>{copy('Where', 'სად')}</span>
                    <select id={whereId} className="gk-input" value={where} onChange={event => {
                        const value = event.target.value;
                        const chat = /^chat-(\d+)$/.exec(value);
                        change(chat ? { chat: Number(chat[1]), place: 'CHATS' } : { chat: null, place: value.toUpperCase() as MediaFilters['place'] });
                    }}>
                        <option value="all">{copy('Everywhere', 'ყველგან')}</option>
                        <option value="chats">{copy('All chats', 'ყველა ჩატი')}</option>
                        {chats.map(chat => <option key={chat.id} value={`chat-${chat.id}`}>{chat.task ? `${chat.task.key} ${chat.name}` : chat.name}</option>)}
                        <option value="tasks">{copy('Team work tasks', 'გუნდის საქმეები')}</option>
                        <option value="kept">{copy('Kept files', 'შენახული ფაილები')}</option>
                    </select>
                </label>
                <label className="tc-media__filter" htmlFor={whoId}><span>{copy('Shared by', 'ვინ')}</span>
                    <select id={whoId} className="gk-input" value={filters.from ?? ''} onChange={event => change({ from: event.target.value ? Number(event.target.value) : null })}>
                        <option value="">{copy('Anyone', 'ნებისმიერი')}</option>
                        {(home?.members ?? []).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                    </select>
                </label>
                <label className="tc-media__filter" htmlFor={tagId}><span>{copy('Tag', 'თეგი')}</span>
                    <input id={tagId} className="gk-input" list={tagsListId} value={tag} placeholder={copy('Any tag', 'ნებისმიერი')} onChange={event => setTag(event.target.value)} />
                    <datalist id={tagsListId}>{tags.map(one => <option key={one.tag} value={one.tag} />)}</datalist>
                </label>
                <label className="tc-media__filter tc-media__words" htmlFor={wordsId}><span>{copy('Name', 'სახელი')}</span>
                    <span className="tc-media__search"><Search aria-hidden="true" />
                        <input id={wordsId} type="search" className="gk-input" value={words} placeholder={copy('Words in its name or tags', 'სიტყვები სახელში ან თეგებში')} onChange={event => setWords(event.target.value)} />
                    </span>
                </label>
                <div className="tc-media__kinds" role="group" aria-label={copy('Kind', 'სახეობა')}>
                    {KINDS.map(([value, en, ka]) => <Chip key={value ?? 'all'} pressed={filters.kind === value} onClick={() => change({ kind: value })}>{copy(en, ka)}</Chip>)}
                </div>
                {narrowed(filters) && <Button size="sm" variant="ghost" onClick={() => { setWords(''); setTag(''); change({ chat: null, place: 'ALL', kind: null, from: null, tag: null, q: null }); }}>
                    {copy('Show everything', 'ყველაფრის ჩვენება')}
                </Button>}
            </div>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            {!items && !error && <div className="tc-media__grid" role="status" aria-label={copy('Loading', 'იტვირთება')}>
                <Skeleton height={140} /><Skeleton height={140} /><Skeleton height={140} /><Skeleton height={140} />
            </div>}
            {items && !items.length && <p className="tc-faint tc-media__none">
                {narrowed(filters)
                    ? copy('Nothing like that. Try another filter, or Show everything.', 'ასეთი არაფერია. სცადეთ სხვა ფილტრი, ან ყველაფრის ჩვენება.')
                    : copy('Pictures, videos and files from your chats and tasks collect here.', 'ჩატებისა და საქმეების სურათები, ვიდეოები და ფაილები აქ გროვდება.')}
            </p>}
            {visual.length > 0 && <ul className="tc-media__grid" aria-label={copy('Pictures and videos', 'სურათები და ვიდეოები')}>
                {visual.map((item, index) => <MediaTile key={`${item.source}-${item.attachment.id}`} attachment={item.attachment} caption={captionOf(copy, item)}
                    actions={actions(item, () => setViewing(index))} />)}
            </ul>}
            {files.length > 0 && <ul className="tc-media__files" aria-label={copy('Files', 'ფაილები')}>
                {files.map(item => <MediaFileRow key={`${item.source}-${item.attachment.id}`} attachment={item.attachment} caption={captionOf(copy, item)} actions={actions(item)} />)}
            </ul>}
            {next && <Button variant="ghost" size="sm" disabled={loading} onClick={() => void more()}>{copy('Show more', 'მეტის ჩვენება')}</Button>}
        </div>
        {viewing !== null && <Lightbox items={viewed} start={viewing} onClose={() => setViewing(null)}
            onShow={item => { setViewing(null); if (item.chatId !== null && item.messageId !== null) onShow(item.chatId, item.messageId); }}
            onTask={item => { setViewing(null); if (item.task) navigate(taskPath(item.task)); }}
            onLabel={item => { const found = visual.find(other => other.attachment.id === item.attachment.id && other.attachment.url === item.attachment.url); if (found) { setViewing(null); setLabelling(found); } }} />}
        {labelling && <LabelDialog target={labelTarget(labelling)} onClose={() => setLabelling(null)}
            onSaved={labelled => { put(labelling, labelled); setLabelling(null); }} />}
        {editing && <PictureEditor media={{ url: editing.attachment.url, name: editing.attachment.name, place: editPlace(editing) ?? undefined }} onClose={() => setEditing(null)}
            onSaved={(saved, image) => {
                setEditing(null);
                if (handOffChatDraft(saved, image) && saved.chatId !== null && saved.replyToId !== null) onShow(saved.chatId, saved.replyToId);
                else setRound(value => value + 1);
            }} />}
    </section>;
}
