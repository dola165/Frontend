import { useEffect, useState } from 'react';
import { FileText, Film } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { deleteChat, fetchShared, keepFiles, type ChatSummary, type SharedItem } from './api';
import { ChatImage } from './Attachments';
import { DELETE_FORBIDDEN, fileSize, problem } from './teamChatWords';

/**
 * The chat's files with a tick each, before a delete ("Delete chat" keeps the ticked ones onto the task, or the
 * Kept files shelf) or on their own from Recently deleted ("Save files"). Files already kept are shown as such and
 * cannot be lost. One button says exactly what will happen.
 */
export function FilePicker({ chat, mode, onClose, onDone }: {
    chat: ChatSummary; mode: 'delete' | 'keep'; onClose: () => void; onDone: (chat: ChatSummary) => void;
}) {
    const copy = useJourneyCopy();
    const [items, setItems] = useState<SharedItem[] | null>(null);
    const [ticked, setTicked] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            try {
                const all: SharedItem[] = [];
                for (let before: number | undefined; ;) {
                    const page = await fetchShared({ chat: chat.id, before }, controller.signal);
                    all.push(...page.items);
                    if (!page.more || !page.items.length) break;
                    before = page.items[page.items.length - 1].attachment.id;
                }
                if (!controller.signal.aborted) setItems(all);
            } catch (failure) { if (!controller.signal.aborted) setError(problem(copy, failure, ['The files could not load.', 'ფაილები ვერ ჩაიტვირთა.'])); }
        })();
        return () => controller.abort();
    }, [chat.id, copy]);

    const open = (items ?? []).filter(item => !item.attachment.kept);
    const kept = (items ?? []).filter(item => item.attachment.kept);
    const toggle = (id: number) => setTicked(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const all = () => setTicked(new Set(open.map(item => item.attachment.id)));
    // A chat for chosen people's files stay with its people on the shelf, never on its task (task files are the whole team's).
    const chosen = chat.audience === 'CHOSEN';
    const where = chosen
        ? copy('onto the Kept files shelf, for this chat’s people only, never onto its task', 'შენახული ფაილების თაროზე, მხოლოდ ამ ჩატის ხალხისთვის, არასდროს საქმეზე')
        : chat.task ? copy(`onto ${chat.task.key}`, `${chat.task.key}-ზე`) : copy('onto the Kept files shelf', 'შენახული ფაილების თაროზე');
    const go = async () => {
        setBusy(true); setError('');
        try { onDone(await (mode === 'delete' ? deleteChat(chat.id, [...ticked]) : keepFiles(chat.id, [...ticked]))); }
        catch (failure) {
            setError(mode === 'delete'
                ? problem(copy, failure, ['The chat was not deleted.', 'ჩატი ვერ წაიშალა.'], DELETE_FORBIDDEN)
                : problem(copy, failure, ['The files were not kept.', 'ფაილები ვერ შეინახა.']));
            setBusy(false);
        }
    };
    const count = ticked.size;
    const action = mode === 'delete'
        ? count
            ? copy(`Delete chat, keep ${count} ${count === 1 ? 'file' : 'files'}`, `ჩატის წაშლა, ${count} ფაილის შენახვა`)
            : copy('Delete chat', 'ჩატის წაშლა')
        : copy(`Keep ${count} ${count === 1 ? 'file' : 'files'}`, `${count} ფაილის შენახვა`);

    return <Dialog open size="md" role={mode === 'delete' ? 'alertdialog' : 'dialog'} className="tc-dialog tc-picker" onClose={onClose}
        closeLabel={copy('Cancel', 'გაუქმება')}
        title={mode === 'delete' ? copy(`Delete “${chat.name}”?`, `წავშალოთ „${chat.name}“?`) : copy('Keep files', 'ფაილების შენახვა')}
        description={mode === 'delete'
            ? copy(`Tick the files to keep (${where}). The chat then waits in Recently deleted for 7 days, where the person who started it or a team admin can restore it. After that its messages and unkept files are gone.`,
                `მონიშნეთ შესანახი ფაილები (${where}). ჩატი 7 დღე „ბოლოს წაშლილებში“ დარჩება; აღდგენა შეუძლია მის დამწყებს ან გუნდის ადმინს. მერე შეტყობინებები და შეუნახავი ფაილები წაიშლება.`)
            : copy(`Ticked files are kept ${where} and never purged.`, `მონიშნული ფაილები შეინახება ${where} და არასდროს წაიშლება.`)}
        footer={<>
            <Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button variant={mode === 'delete' ? 'danger' : 'primary'} disabled={busy || !items || (mode === 'keep' && !count)} onClick={() => void go()}>
                {action}
            </Button>
        </>}>
        {mode === 'delete' && chat.decision && !chat.task && <p className="gk-notice gk-notice--warning" role="note">
            {copy(`Its decision “${chat.decision}” is on no task, so it goes with the chat. Copy it first if you need it.`,
                `მისი გადაწყვეტილება „${chat.decision}“ არც ერთ საქმეზე არ წერია და ჩატთან ერთად წაიშლება. თუ გჭირდებათ, ჯერ გადაიწერეთ.`)}
        </p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {!items && !error && <p className="tc-faint" role="status">{copy('Loading the files…', 'ფაილები იტვირთება…')}</p>}
        {items && !items.length && <p className="tc-faint">{copy('This chat has no files.', 'ამ ჩატში ფაილები არ არის.')}</p>}
        {open.length > 1 && <p className="tc-picker__all">
            <button type="button" className="tc-link-button" onClick={all}>{copy(`Tick all ${open.length}`, `ყველას მონიშვნა (${open.length})`)}</button>
        </p>}
        {open.length > 0 && <ul className="tc-picker__list">
            {open.map(item => <li key={item.attachment.id}>
                <label>
                    <input type="checkbox" checked={ticked.has(item.attachment.id)} onChange={() => toggle(item.attachment.id)} />
                    <span className="tc-picker__thumb">
                        {item.attachment.kind === 'IMAGE'
                            ? <ChatImage attachment={item.attachment} />
                            : item.attachment.kind === 'VIDEO' ? <Film aria-hidden="true" /> : <FileText aria-hidden="true" />}
                    </span>
                    <span className="tc-picker__name">{item.attachment.name}</span>
                    <span className="tc-faint">{fileSize(item.attachment.sizeBytes)} · {item.sender?.name}</span>
                </label>
            </li>)}
        </ul>}
        {kept.length > 0 && <p className="tc-faint tc-picker__kept">
            {copy(`${kept.length} already kept: ${kept.map(item => item.attachment.name).join(', ')}`,
                `${kept.length} უკვე შენახულია: ${kept.map(item => item.attachment.name).join(', ')}`)}
        </p>}
    </Dialog>;
}
