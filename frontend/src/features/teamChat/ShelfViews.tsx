import { useEffect, useState } from 'react';
import { ArrowLeft, Download, FolderDown, MessageSquare, Play, RotateCcw } from 'lucide-react';
import { Button, EmptyNote, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchKept, keptPlayLink, restoreChat, zipPath, type ChatSummary, type KeptFile } from './api';
import { ChatImage, ChatVideo, FileRow } from './Attachments';
import { FilePicker } from './FilePicker';
import { Lightbox, type Viewed } from './Lightbox';
import { saveFromApi } from './saveFile';
import { onDate, onlyDeleters, problem, shortDay } from './teamChatWords';

function ViewHead({ title, onBack }: { title: string; onBack: () => void }) {
    const copy = useJourneyCopy();
    return <header className="tc-chathead">
        <button type="button" className="tc-back tc-chathead__back" onClick={onBack} aria-label={copy('Back to the chats', 'ჩატებზე დაბრუნება')}><ArrowLeft aria-hidden="true" /></button>
        <h2 className="tc-chathead__name">{title}</h2>
    </header>;
}

/** One deleted chat: when it goes, who deleted it, and what can still be done. */
function DeletedRow({ chat, onOpen, onChat }: { chat: ChatSummary; onOpen: (id: number) => void; onChat: (chat: ChatSummary) => void }) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [keeping, setKeeping] = useState(false);
    const run = async (work: () => Promise<void>, what: [string, string]) => {
        setBusy(true); setError('');
        try { await work(); } catch (failure) { setError(problem(copy, failure, what)); } finally { setBusy(false); }
    };
    return <li className="tc-shelfrow">
        <button type="button" className="tc-shelfrow__open" onClick={() => onOpen(chat.id)}>
            {chat.task && <span className="tc-chatrow__key gk-num">{chat.task.key}</span>}
            <span className="tc-shelfrow__name">{chat.name}</span>
        </button>
        <p className="tc-shelfrow__when">
            {chat.deletesAt && <strong>{copy(`Deleted for good ${onDate(copy, chat.deletesAt)}`, `საბოლოოდ წაიშლება ${onDate(copy, chat.deletesAt)}`)}</strong>}
            <span className="tc-faint"> · {copy(`deleted by ${chat.deletedBy?.name ?? 'someone'}`, `წაშალა ${chat.deletedBy?.name ?? 'ვიღაცამ'}`)} · {copy(`${chat.messageCount} messages`, `${chat.messageCount} შეტყობინება`)}</span>
        </p>
        <div className="tc-shelfrow__actions">
            {chat.canDelete && <Button size="sm" variant="primary" disabled={busy} onClick={() => void run(async () => onChat(await restoreChat(chat.id)), ['The chat was not restored.', 'ჩატი ვერ აღდგა.'])}><RotateCcw aria-hidden="true" />{copy('Restore', 'აღდგენა')}</Button>}
            <Button size="sm" disabled={busy} onClick={() => setKeeping(true)}><FolderDown aria-hidden="true" />{copy('Save files', 'ფაილების შენახვა')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => saveFromApi(zipPath(chat.id), `${chat.name}.zip`), ['The files could not be downloaded.', 'ფაილები ვერ ჩამოიტვირთა.'])}><Download aria-hidden="true" />{copy('Download all (zip)', 'ყველას ჩამოტვირთვა (zip)')}</Button>
            <Button size="sm" variant="ghost" onClick={() => onOpen(chat.id)}><MessageSquare aria-hidden="true" />{copy('Read it', 'წაკითხვა')}</Button>
        </div>
        {!chat.canDelete && <p className="tc-shelfrow__when tc-faint">{onlyDeleters(copy, chat, 'restore')}</p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {keeping && <FilePicker chat={chat} mode="keep" onClose={() => setKeeping(false)} onDone={next => { setKeeping(false); onChat(next); }} />}
    </li>;
}

/**
 * Recently deleted: every deleted chat for seven days, with the day it goes for good. Anyone in it can restore it,
 * save its files (onto its task, or the Kept files shelf) or download them all; it can still be read.
 */
export function DeletedView({ chats, onOpen, onChat, onBack }: { chats: ChatSummary[]; onOpen: (id: number) => void; onChat: (chat: ChatSummary) => void; onBack: () => void }) {
    const copy = useJourneyCopy();
    return <section className="tc-col tc-col--main tc-shelf" aria-label={copy('Recently deleted', 'ბოლოს წაშლილი')}>
        <ViewHead title={copy('Recently deleted', 'ბოლოს წაშლილი')} onBack={onBack} />
        <div className="tc-shelf__body">
            <p className="tc-faint">{copy('A deleted chat waits here for 7 days. Then its messages and every file nobody kept are gone; decisions already written to tasks stay.', 'წაშლილი ჩატი აქ 7 დღე რჩება. მერე მისი შეტყობინებები და ყველა შეუნახავი ფაილი იშლება; საქმეებში ჩაწერილი გადაწყვეტილებები რჩება.')}</p>
            {!chats.length ? <EmptyNote title={copy('Nothing here', 'აქ არაფერია')}>{copy('Chats you delete wait here for 7 days.', 'წაშლილი ჩატები აქ 7 დღე ელოდება.')}</EmptyNote>
                : <ul className="tc-shelf__list">{chats.map(chat => <DeletedRow key={chat.id} chat={chat} onOpen={onOpen} onChat={onChat} />)}</ul>}
        </div>
    </section>;
}

/** The Kept files shelf: files kept from deleted chats that had no task, newest first. */
export function KeptView({ onBack }: { onBack: () => void }) {
    const copy = useJourneyCopy();
    const [files, setFiles] = useState<KeptFile[] | null>(null);
    const [error, setError] = useState('');
    const [viewing, setViewing] = useState<number | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetchKept(controller.signal).then(setFiles).catch(failure => { if (!controller.signal.aborted) setError(problem(copy, failure, ['The kept files could not load.', 'შენახული ფაილები ვერ ჩაიტვირთა.'])); });
        return () => controller.abort();
    }, [copy]);
    const caption = (file: KeptFile) => [file.chatName, file.keptBy?.name, shortDay(copy, file.keptAt)].filter(Boolean).join(' · ');
    const visual = (files ?? []).filter(file => file.attachment.kind !== 'FILE');
    const others = (files ?? []).filter(file => file.attachment.kind === 'FILE');
    const viewed: Viewed[] = visual.map(file => ({ attachment: file.attachment, messageId: null, chatId: null, caption: caption(file), renew: () => keptPlayLink(file.id) }));
    return <section className="tc-col tc-col--main tc-shelf" aria-label={copy('Kept files', 'შენახული ფაილები')}>
        <ViewHead title={copy('Kept files', 'შენახული ფაილები')} onBack={onBack} />
        <div className="tc-shelf__body">
            <p className="tc-faint">{copy('Files kept from deleted chats that had no task. Nothing deletes them by itself.', 'წაშლილი ჩატებიდან შენახული ფაილები, რომლებსაც საქმე არ ჰქონდათ. თავისით არაფერი წაიშლება.')}</p>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            {!files && !error && <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={88} /></div>}
            {files && !files.length && <EmptyNote title={copy('No kept files', 'შენახული ფაილები არ არის')} />}
            {visual.length > 0 && <ul className="tc-pmedia__grid tc-shelf__grid">
                {visual.map((file, index) => <li key={file.id}>
                    <button type="button" className="tc-tile" onClick={() => setViewing(index)} aria-label={`${file.attachment.name}, ${caption(file)}`} title={caption(file)}>
                        {file.attachment.kind === 'VIDEO'
                            ? <><ChatVideo attachment={file.attachment} renew={() => keptPlayLink(file.id)} className="tc-tile__media" /><span className="tc-tile__play"><Play aria-hidden="true" /></span></>
                            : <ChatImage attachment={file.attachment} lazy className="tc-tile__media" />}
                    </button>
                </li>)}
            </ul>}
            {others.length > 0 && <ul className="tc-pmedia__files">{others.map(file => <li key={file.id}><FileRow attachment={file.attachment} /><span className="tc-faint">{caption(file)}</span></li>)}</ul>}
        </div>
        {viewing !== null && <Lightbox items={viewed} start={viewing} onClose={() => setViewing(null)} />}
    </section>;
}
