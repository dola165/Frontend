import { useEffect, useId, useState } from 'react';
import { MessageSquare, Play } from 'lucide-react';
import { Button, Chip, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchShared, type AttachmentKind, type ChatPerson, type SharedItem } from './api';
import { ChatImage, ChatVideo, FileRow } from './Attachments';
import { Lightbox, type Viewed } from './Lightbox';
import { onSharedChanged } from './sharedSignal';
import { isMissing, problem, shortDay } from './teamChatWords';

export interface MediaFilters { all: boolean; kind: AttachmentKind | null; from: number | null }

const KINDS: [AttachmentKind | null, string, string][] = [
    [null, 'All', 'ყველა'], ['IMAGE', 'Pictures', 'სურათები'], ['VIDEO', 'Videos', 'ვიდეო'], ['FILE', 'Files', 'ფაილები'],
];

/**
 * The panel's Media: what was shared in this chat or in every chat, by one person or anyone, and by kind; pictures
 * and videos as small tiles (opening full screen, fetched as they come into view), files as rows to save. Each leads
 * back to its message, in whichever chat it came. The filters are kept in the address (mall, mkind, mfrom).
 */
export function PanelMedia({ chatId, members, filters, onFilters, onShow, onMissing, trashed = false }: {
    chatId: number; members: ChatPerson[]; filters: MediaFilters; onFilters: (filters: MediaFilters) => void;
    onShow: (chatId: number, messageId: number) => void; onMissing: () => void; trashed?: boolean;
}) {
    const copy = useJourneyCopy();
    const [items, setItems] = useState<SharedItem[] | null>(null);
    const [more, setMore] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewing, setViewing] = useState<number | null>(null);
    const personId = useId();
    const where = { chat: filters.all ? null : chatId, kind: filters.kind, from: filters.from };
    /** Goes up when something shared changed in the open chat: the first page is fetched again, quietly. */
    const [round, setRound] = useState(0);

    useEffect(() => {
        let timer: number | undefined;
        const stop = onSharedChanged(changed => {
            if (!filters.all && changed !== chatId) return;
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setRound(current => current + 1), 400);
        });
        return () => { stop(); window.clearTimeout(timer); };
    }, [chatId, filters.all]);

    useEffect(() => {
        const controller = new AbortController();
        setItems(null); setError(''); setRound(0);
        fetchShared({ chat: filters.all ? null : chatId, kind: filters.kind, from: filters.from }, controller.signal)
            .then(page => { setItems(page.items); setMore(page.more); })
            .catch(failure => {
                if (controller.signal.aborted) return;
                if (isMissing(failure)) onMissing();
                setError(problem(copy, failure, ['What was shared could not load.', 'გაზიარებული ვერ ჩაიტვირთა.']));
            });
        return () => controller.abort();
    }, [chatId, filters.all, filters.kind, filters.from, copy, onMissing]);

    // The refresh keeps what is shown until the new first page is here (no flash), then replaces it.
    useEffect(() => {
        if (!round) return;
        const controller = new AbortController();
        fetchShared({ chat: filters.all ? null : chatId, kind: filters.kind, from: filters.from }, controller.signal)
            .then(page => { setItems(page.items); setMore(page.more); })
            .catch(() => { /* The next change, or opening the panel again, tries again. */ });
        return () => controller.abort();
    }, [round, chatId, filters.all, filters.kind, filters.from]);

    const loadMore = async () => {
        const last = items?.at(-1);
        if (!last) return;
        setLoading(true);
        try {
            const page = await fetchShared({ ...where, before: last.attachment.id });
            setItems(current => [...(current ?? []), ...page.items]);
            setMore(page.more);
        }
        catch (failure) { setError(problem(copy, failure, ['More could not load.', 'მეტი ვერ ჩაიტვირთა.'])); }
        finally { setLoading(false); }
    };

    const visual = (items ?? []).filter(item => item.attachment.kind !== 'FILE');
    const files = (items ?? []).filter(item => item.attachment.kind === 'FILE');
    const caption = (item: SharedItem) => [item.sender?.name, filters.all ? item.chatName : null, shortDay(copy, item.createdAt)].filter(Boolean).join(' · ');
    // All chats lists no deleted chat; This chat may be one, and a deleted chat takes no edited copy.
    const viewed: Viewed[] = visual.map(item => ({ attachment: item.attachment, messageId: item.messageId, chatId: item.chatId, caption: caption(item), editable: filters.all || !trashed }));
    return <section className="tc-panel__section tc-pmedia" aria-labelledby={`${personId}-title`}>
        <h3 id={`${personId}-title`} className="tc-panel__title">{copy('Media', 'მედია')}</h3>
        <div className="tc-tabs tc-pmedia__scope" role="group" aria-label={copy('Which chats', 'რომელი ჩატები')}>
            <button type="button" aria-pressed={!filters.all} onClick={() => onFilters({ ...filters, all: false })}>{copy('This chat', 'ეს ჩატი')}</button>
            <button type="button" aria-pressed={filters.all} onClick={() => onFilters({ ...filters, all: true })}>{copy('All chats', 'ყველა ჩატი')}</button>
        </div>
        <div className="tc-pmedia__filters">
            <label className="tc-sr" htmlFor={personId}>{copy('Shared by', 'ვინ გააზიარა')}</label>
            <select id={personId} className="gk-input tc-pmedia__person" value={filters.from ?? ''}
                onChange={event => onFilters({ ...filters, from: event.target.value ? Number(event.target.value) : null })}>
                <option value="">{copy('Anyone', 'ნებისმიერი')}</option>
                {members.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <div className="tc-pmedia__kinds" role="group" aria-label={copy('Kind', 'სახეობა')}>
                {KINDS.map(([value, en, ka]) => <Chip key={value ?? 'all'} pressed={filters.kind === value}
                    onClick={() => onFilters({ ...filters, kind: value })}>{copy(en, ka)}</Chip>)}
            </div>
        </div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {!items && !error && <div className="tc-pmedia__grid" role="status" aria-label={copy('Loading', 'იტვირთება')}>
            <Skeleton height={88} /><Skeleton height={88} /><Skeleton height={88} />
        </div>}
        {items && !items.length && <p className="tc-faint tc-pmedia__none">
            {filters.kind || filters.from
                ? copy('Nothing like that yet.', 'ასეთი ჯერ არაფერია.')
                : copy('Pictures, videos and files sent here collect in this place.', 'აქ გაგზავნილი სურათები, ვიდეოები და ფაილები აქ გროვდება.')}
        </p>}
        {visual.length > 0 && <ul className="tc-pmedia__grid">
            {visual.map((item, index) => <li key={item.attachment.id}>
                <button type="button" className="tc-tile" onClick={() => setViewing(index)}
                    aria-label={`${item.attachment.name}, ${caption(item)}`} title={caption(item)}>
                    {item.attachment.kind === 'VIDEO'
                        ? <>
                            <ChatVideo attachment={item.attachment} className="tc-tile__media" />
                            <span className="tc-tile__play"><Play aria-hidden="true" /></span>
                        </>
                        : <ChatImage attachment={item.attachment} lazy className="tc-tile__media" />}
                </button>
            </li>)}
        </ul>}
        {files.length > 0 && <ul className="tc-pmedia__files">
            {files.map(item => <li key={item.attachment.id}>
                <FileRow attachment={item.attachment} />
                <button type="button" className="tc-link-button tc-pmedia__by" onClick={() => onShow(item.chatId, item.messageId)}
                    title={copy('Show in chat', 'ჩატში ნახვა')}>
                    <MessageSquare aria-hidden="true" /><span>{caption(item)}</span>
                </button>
            </li>)}
        </ul>}
        {more && <Button variant="ghost" size="sm" disabled={loading} onClick={() => void loadMore()}>{copy('Show more', 'მეტის ჩვენება')}</Button>}
        {viewing !== null && <Lightbox items={viewed} start={viewing} onClose={() => setViewing(null)}
            onShow={item => { setViewing(null); if (item.chatId !== null && item.messageId !== null) onShow(item.chatId, item.messageId); }} />}
    </section>;
}
