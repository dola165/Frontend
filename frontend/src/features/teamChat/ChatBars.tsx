import { useState } from 'react';
import { CircleCheck, Download, FolderDown, RotateCcw } from 'lucide-react';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { restoreChat, zipPath, type ChatSummary } from './api';
import { FilePicker } from './FilePicker';
import { saveFromApi } from './saveFile';
import { onDate, problem, shortDay } from './teamChatWords';

/**
 * The decision, pinned at the top of the chat. While the chat is Decided it is the one bright thing; reopened
 * (Talking or On hold), the last decision stays in sight, quietly, so nobody loses what was agreed.
 */
export function DecisionBar({ chat }: { chat: ChatSummary }) {
    const copy = useJourneyCopy();
    if (!chat.decision) return null;
    const decided = chat.status === 'DECIDED';
    return <div className="tc-decision" data-decided={decided || undefined} role="note" aria-label={decided ? copy('Decided', 'გადაწყდა') : copy('Last decision', 'ბოლო გადაწყვეტილება')}>
        <CircleCheck aria-hidden="true" />
        <p><span className="tc-decision__label">{decided ? copy('Decided', 'გადაწყდა') : copy('Last decision', 'ბოლო გადაწყვეტილება')}</span> {chat.decision}
            {chat.decidedBy && <span className="tc-faint"> · {chat.decidedBy.name}{chat.decidedAt ? `, ${shortDay(copy, chat.decidedAt)}` : ''}</span>}</p>
    </div>;
}

/**
 * A chat waiting in Recently deleted: when it goes, and what can still be done (restore it, keep files, take them
 * all as a zip). It takes no new messages meanwhile.
 */
export function DeletedBar({ chat, onChat }: { chat: ChatSummary; onChat: (chat: ChatSummary) => void }) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [keeping, setKeeping] = useState(false);
    if (!chat.deletesAt) return null;
    const run = async (work: () => Promise<void>, what: [string, string]) => {
        setBusy(true); setError('');
        try { await work(); } catch (failure) { setError(problem(copy, failure, what)); } finally { setBusy(false); }
    };
    const restore = () => run(async () => onChat(await restoreChat(chat.id)), ['The chat was not restored.', 'ჩატი ვერ აღდგა.']);
    const zip = () => run(() => saveFromApi(zipPath(chat.id), `${chat.name}.zip`), ['The files could not be downloaded.', 'ფაილები ვერ ჩამოიტვირთა.']);
    return <div className="tc-deleted" role="status">
        <p><strong>{copy(`This chat will be deleted ${onDate(copy, chat.deletesAt)}.`, `ეს ჩატი წაიშლება ${onDate(copy, chat.deletesAt)}.`)}</strong>{' '}
            {copy('Save anything you need: files you keep stay on the task (or the Kept files shelf).', 'შეინახეთ, რაც გჭირდებათ: შენახული ფაილები საქმეზე (ან შენახული ფაილების თაროზე) დარჩება.')}</p>
        <div className="tc-deleted__actions">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void restore()}><RotateCcw aria-hidden="true" />{copy('Restore', 'აღდგენა')}</Button>
            <Button size="sm" disabled={busy} onClick={() => setKeeping(true)}><FolderDown aria-hidden="true" />{copy('Save files', 'ფაილების შენახვა')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void zip()}><Download aria-hidden="true" />{copy('Download all (zip)', 'ყველას ჩამოტვირთვა (zip)')}</Button>
        </div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {keeping && <FilePicker chat={chat} mode="keep" onClose={() => setKeeping(false)} onDone={next => { setKeeping(false); onChat(next); }} />}
    </div>;
}
