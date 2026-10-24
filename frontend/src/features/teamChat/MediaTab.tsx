import { useEffect, useState } from 'react';
import { MessageSquare, Play } from 'lucide-react';
import { Button, Chip, EmptyNote, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchShared, type AttachmentKind, type SharedItem } from './api';
import { ChatImage, ChatVideo, FileRow } from './Attachments';
import { Lightbox } from './Lightbox';
import { fullTime, isMissing, problem } from './teamChatWords';

const KINDS: [AttachmentKind | null, string, string][] = [[null, 'Everything', 'ყველა'], ['IMAGE', 'Pictures', 'სურათები'], ['VIDEO', 'Videos', 'ვიდეო'], ['FILE', 'Files', 'ფაილები']];

/**
 * Everything shared in the chat, newest first: pictures and videos as tiles (opening full screen), files as rows to
 * save; each leads back to the message it came in. The kind is kept in the address (?kind=).
 */
export function MediaTab({ kind, onKind, onShow, onMissing }: { kind: AttachmentKind | null; onKind: (kind: AttachmentKind | null) => void; onShow: (messageId: number) => void; onMissing: () => void }) {
    const copy = useJourneyCopy();
    const [items, setItems] = useState<SharedItem[] | null>(null);
    const [more, setMore] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewing, setViewing] = useState<number | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setItems(null); setError('');
        fetchShared(kind, undefined, controller.signal).then(page => { setItems(page.items); setMore(page.more); })
            .catch(failure => { if (controller.signal.aborted) return; if (isMissing(failure)) onMissing(); setError(problem(copy, failure, ['What was shared could not load.', 'გაზიარებული ვერ ჩაიტვირთა.'])); });
        return () => controller.abort();
    }, [kind, copy, onMissing]);

    const loadMore = async () => {
        const last = items?.at(-1);
        if (!last) return;
        setLoading(true);
        try { const page = await fetchShared(kind, last.attachment.id); setItems(current => [...(current ?? []), ...page.items]); setMore(page.more); }
        catch (failure) { setError(problem(copy, failure, ['More could not load.', 'მეტი ვერ ჩაიტვირთა.'])); }
        finally { setLoading(false); }
    };

    const visual = (items ?? []).filter(item => item.attachment.kind !== 'FILE');
    const files = (items ?? []).filter(item => item.attachment.kind === 'FILE');
    const caption = (item: SharedItem) => `${item.sender?.name ?? ''} · ${fullTime(copy, item.createdAt)}`;
    return <section className="tc-media" aria-label={copy('Shared in the chat', 'ჩატში გაზიარებული')}>
        <div className="tc-media__kinds" role="group" aria-label={copy('Show', 'ჩვენება')}>
            {KINDS.map(([value, en, ka]) => <Chip key={value ?? 'all'} pressed={kind === value} onClick={() => onKind(value)}>{copy(en, ka)}</Chip>)}
        </div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {!items && !error && <div role="status" aria-label={copy('Loading', 'იტვირთება')} className="tc-media__loading"><Skeleton height={120} /><Skeleton height={120} /></div>}
        {items && !items.length && <EmptyNote title={kind === null ? copy('Nothing shared yet', 'ჯერ არაფერია გაზიარებული') : copy('None of these yet', 'ასეთი ჯერ არ არის')}>
            {copy('Pictures, videos and files sent in the chat collect here.', 'ჩატში გაგზავნილი სურათები, ვიდეოები და ფაილები აქ გროვდება.')}
        </EmptyNote>}
        {visual.length > 0 && <ul className="tc-media__grid">
            {visual.map(item => <li key={item.attachment.id}>
                <button type="button" className="tc-tile" onClick={() => setViewing(visual.indexOf(item))} aria-label={`${item.attachment.name}, ${caption(item)}`}>
                    {item.attachment.kind === 'VIDEO'
                        ? <><ChatVideo attachment={item.attachment} className="tc-tile__media" /><span className="tc-tile__play"><Play aria-hidden="true" /></span></>
                        : <ChatImage attachment={item.attachment} className="tc-tile__media" />}
                </button>
                <button type="button" className="tc-media__by" title={copy('Show in chat', 'ჩატში ნახვა')} onClick={() => onShow(item.messageId)}>
                    <MessageSquare aria-hidden="true" /><span>{caption(item)}</span>
                </button>
            </li>)}
        </ul>}
        {files.length > 0 && <ul className="tc-media__files">
            {files.map(item => <li key={item.attachment.id}>
                <FileRow attachment={item.attachment} />
                <span className="tc-faint">{caption(item)}</span>
                <button type="button" className="tc-link-button" onClick={() => onShow(item.messageId)}><MessageSquare aria-hidden="true" />{copy('Show in chat', 'ჩატში ნახვა')}</button>
            </li>)}
        </ul>}
        {more && <Button variant="ghost" size="sm" disabled={loading} onClick={() => void loadMore()}>{copy('Show more', 'მეტის ჩვენება')}</Button>}
        {viewing !== null && <Lightbox items={visual.map(item => ({ attachment: item.attachment, messageId: item.messageId, caption: caption(item) }))} start={viewing}
            onClose={() => setViewing(null)} onShow={id => { setViewing(null); onShow(id); }} />}
    </section>;
}
