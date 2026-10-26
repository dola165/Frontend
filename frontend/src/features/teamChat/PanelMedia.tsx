import { useEffect, useId, useState } from 'react';
import { Images } from 'lucide-react';
import { Button, Chip, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { handOffChatDraft } from '../imageEditor/chatDraft';
import { fetchShared, type AttachmentKind, type ChatPerson, type Labelled, type SharedItem } from './api';
import { LabelDialog } from './LabelDialog';
import { Lightbox, type Viewed } from './Lightbox';
import { MediaFileRow, MediaTile } from './MediaBits';
import type { MediaActions } from './mediaMenu';
import { labelTarget } from './mediaWords';
import { PictureEditor } from './PictureEditor';
import { saveFile } from './saveFile';
import { onSharedChanged } from './sharedSignal';
import { isMissing, problem, shortDay } from './teamChatWords';

export interface MediaFilters { kind: AttachmentKind | null; from: number | null }

const KINDS: [AttachmentKind | null, string, string][] = [
    [null, 'All', 'ყველა'], ['IMAGE', 'Pictures', 'სურათები'], ['VIDEO', 'Videos', 'ვიდეო'], ['FILE', 'Files', 'ფაილები'],
];

/**
 * The panel's Media: what was shared in this chat, by one person or anyone, and by kind; pictures and videos as small
 * tiles (opening full screen, fetched as they come into view), files as rows to save. Each leads back to its message;
 * everything shared in every chat and on tasks is on the Media page (above the chats). The filters are kept in the
 * address (mkind, mfrom). Right-click (or hold) a tile for the rest.
 */
export function PanelMedia({ chatId, members, filters, onFilters, onShow, onMedia, onMissing, trashed = false }: {
    chatId: number; members: ChatPerson[]; filters: MediaFilters; onFilters: (filters: MediaFilters) => void;
    onShow: (chatId: number, messageId: number) => void; onMedia: () => void; onMissing: () => void; trashed?: boolean;
}) {
    const copy = useJourneyCopy();
    const [items, setItems] = useState<SharedItem[] | null>(null);
    const [more, setMore] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewing, setViewing] = useState<number | null>(null);
    const [labelling, setLabelling] = useState<SharedItem | null>(null);
    const [editing, setEditing] = useState<SharedItem | null>(null);
    const personId = useId();
    const where = { chat: chatId, kind: filters.kind, from: filters.from };
    /** Goes up when something shared changed in the open chat: the first page is fetched again, quietly. */
    const [round, setRound] = useState(0);

    useEffect(() => {
        let timer: number | undefined;
        const stop = onSharedChanged(changed => {
            if (changed !== chatId) return;
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setRound(current => current + 1), 400);
        });
        return () => { stop(); window.clearTimeout(timer); };
    }, [chatId]);

    useEffect(() => {
        const controller = new AbortController();
        setItems(null); setError(''); setRound(0);
        fetchShared({ chat: chatId, kind: filters.kind, from: filters.from }, controller.signal)
            .then(page => { setItems(page.items); setMore(page.more); })
            .catch(failure => {
                if (controller.signal.aborted) return;
                if (isMissing(failure)) onMissing();
                setError(problem(copy, failure, ['What was shared could not load.', 'გაზიარებული ვერ ჩაიტვირთა.']));
            });
        return () => controller.abort();
    }, [chatId, filters.kind, filters.from, copy, onMissing]);

    // The refresh keeps what is shown until the new first page is here (no flash), then replaces it.
    useEffect(() => {
        if (!round) return;
        const controller = new AbortController();
        fetchShared({ chat: chatId, kind: filters.kind, from: filters.from }, controller.signal)
            .then(page => { setItems(page.items); setMore(page.more); })
            .catch(() => { /* The next change, or opening the panel again, tries again. */ });
        return () => controller.abort();
    }, [round, chatId, filters.kind, filters.from]);

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

    const put = (item: SharedItem, labelled: Labelled) => setItems(current => (current ?? []).map(other => other.attachment.id === item.attachment.id
        ? { ...other, attachment: { ...other.attachment, ...labelled } } : other));
    const visual = (items ?? []).filter(item => item.attachment.kind !== 'FILE');
    const files = (items ?? []).filter(item => item.attachment.kind === 'FILE');
    const caption = (item: SharedItem) => [item.sender?.name, shortDay(copy, item.createdAt)].filter(Boolean).join(' · ');
    const actions = (item: SharedItem, open?: () => void): MediaActions => ({
        onOpen: open,
        onShow: () => onShow(item.chatId, item.messageId),
        onMedia,
        onLabel: trashed ? undefined : () => setLabelling(item),
        onSave: () => void saveFile(item.attachment).catch(() => setError(copy('The file could not be saved; try again.', 'ფაილი ვერ შეინახა; სცადეთ ხელახლა.'))),
        onEdit: trashed ? undefined : () => setEditing(item),
        noEdit: trashed ? copy('The chat is in Recently deleted.', 'ჩატი ბოლოს წაშლილებშია.') : undefined,
    });
    // A deleted chat takes no edited copy, and no new names.
    const viewed: Viewed[] = visual.map(item => ({
        attachment: item.attachment, messageId: item.messageId, chatId: item.chatId, caption: caption(item), editable: !trashed,
        label: trashed ? undefined : labelTarget({ source: 'CHAT', attachment: item.attachment }),
    }));
    return <section className="tc-panel__section tc-pmedia" aria-labelledby={`${personId}-title`}>
        <h3 id={`${personId}-title`} className="tc-panel__title">{copy('Media', 'მედია')}
            <button type="button" className="tc-link-button tc-pmedia__all" onClick={onMedia}><Images aria-hidden="true" />{copy('All media', 'მთელი მედია')}</button>
        </h3>
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
            {visual.map((item, index) => <MediaTile key={item.attachment.id} attachment={item.attachment} caption={caption(item)} named={false}
                actions={actions(item, () => setViewing(index))} />)}
        </ul>}
        {files.length > 0 && <ul className="tc-pmedia__files">
            {files.map(item => <MediaFileRow key={item.attachment.id} attachment={item.attachment} caption={caption(item)} actions={actions(item)}
                place={<button type="button" className="tc-link-button tc-pmedia__by" onClick={() => onShow(item.chatId, item.messageId)}>{copy('Show in chat', 'ჩატში ნახვა')}</button>} />)}
        </ul>}
        {more && <Button variant="ghost" size="sm" disabled={loading} onClick={() => void loadMore()}>{copy('Show more', 'მეტის ჩვენება')}</Button>}
        {viewing !== null && <Lightbox items={viewed} start={viewing} onClose={() => setViewing(null)}
            onShow={item => { setViewing(null); if (item.chatId !== null && item.messageId !== null) onShow(item.chatId, item.messageId); }}
            onLabel={item => { const found = visual.find(other => other.attachment.id === item.attachment.id); if (found) { setViewing(null); setLabelling(found); } }} />}
        {labelling && <LabelDialog target={labelTarget({ source: 'CHAT', attachment: labelling.attachment })} onClose={() => setLabelling(null)}
            onSaved={labelled => { put(labelling, labelled); setLabelling(null); }} />}
        {editing && <PictureEditor media={{ url: editing.attachment.url, name: editing.attachment.name, place: { messageId: editing.messageId } }} onClose={() => setEditing(null)}
            onSaved={(saved, image) => { setEditing(null); if (handOffChatDraft(saved, image) && saved.chatId !== null && saved.replyToId !== null) onShow(saved.chatId, saved.replyToId); }} />}
    </section>;
}
