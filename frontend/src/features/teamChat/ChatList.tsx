import { useId, useState } from 'react';
import { Archive, AtSign, CheckCheck, CircleDot, ClipboardList, Images, Lock, MessageSquare, Pause, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useContextMenu, type ContextMenuItems } from '../../components/useContextMenu';
import { Dialog } from '../../design/Dialog';
import { Button, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { markRead, renameChat, setChatStatus, type ChatHome, type ChatStatus, type ChatSummary } from './api';
import { DecideDialog } from './DecideDialog';
import { FilePicker } from './FilePicker';
import { onlyDeleters, problem, shortDay, statusWord } from './teamChatWords';

/** Where the list is: a chat, Recently deleted, the Kept files shelf, or Media. */
export type ListView = 'deleted' | 'kept' | 'media';

/** The status as a dot and a word: one quiet mark per row; Decided is the bright one. */
export function StatusMark({ status, compact = false }: { status: ChatStatus; compact?: boolean }) {
    const copy = useJourneyCopy();
    return <span className="tc-status" data-status={status}><span className="tc-status__dot" aria-hidden="true" />{!compact && statusWord(copy, status)}</span>;
}

/** A new name for a general topic. */
function RenameDialog({ chat, onClose, onDone }: { chat: ChatSummary; onClose: () => void; onDone: (chat: ChatSummary) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [name, setName] = useState(chat.name);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const save = async () => {
        const words = name.trim();
        if (!words || words === chat.name) { onClose(); return; }
        setBusy(true); setError('');
        try { onDone(await renameChat(chat.id, words)); }
        catch (failure) { setError(problem(copy, failure, ['The name was not saved.', 'სახელი ვერ შეინახა.'])); setBusy(false); }
    };
    return <Dialog open size="sm" className="tc-dialog" title={copy('Rename the chat', 'ჩატის გადარქმევა')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button variant="primary" disabled={busy || !name.trim()} onClick={() => void save()}>{copy('Save', 'შენახვა')}</Button></>}>
        <form onSubmit={event => { event.preventDefault(); void save(); }}>
            <label className="tc-sr" htmlFor={id}>{copy('Chat name', 'ჩატის სახელი')}</label>
            <input id={id} className="gk-input" value={name} maxLength={100} autoFocus onChange={event => setName(event.target.value)} />
        </form>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}

type Doing = { kind: 'rename' | 'decide' | 'delete'; chat: ChatSummary } | null;

/** One chat on one line: its name, its task key, its status, what waits for you, and when it last moved. */
function ChatRow({ chat, current, onOpen, menu }: { chat: ChatSummary; current: boolean; onOpen: (id: number) => void; menu: (chat: ChatSummary) => ContextMenuItems }) {
    const copy = useJourneyCopy();
    const unread = chat.unreadCount > 0;
    const context = useContextMenu(() => menu(chat), { label: chat.name });
    const chosen = chat.audience === 'CHOSEN';
    return <li className="tc-chatrow" data-current={current || undefined} data-unread={unread || undefined}>
        <button type="button" className="gk-cm-target" onClick={() => onOpen(chat.id)} aria-current={current ? 'true' : undefined} {...context.bind}
            aria-label={`${chat.name}${chat.task ? `, ${chat.task.key}` : ''}${chosen ? `, ${copy('chosen people', 'არჩეული ხალხი')}` : ''}, ${statusWord(copy, chat.status)}${
                unread ? `, ${copy(`${chat.unreadCount} unread`, `${chat.unreadCount} წაუკითხავი`)}` : ''}`}>
            <span className="tc-chatrow__top">
                {chat.task && <span className="tc-chatrow__key gk-num">{chat.task.key}</span>}
                <span className="tc-chatrow__name">{chat.name}</span>
                {chosen && <Lock className="tc-chatrow__lock" aria-hidden="true" />}
                <time className="tc-chatrow__when gk-num" dateTime={chat.lastActivityAt}>{shortDay(copy, chat.lastActivityAt)}</time>
            </span>
            <span className="tc-chatrow__bottom">
                <StatusMark status={chat.status} />
                <span className="tc-chatrow__line">{chat.lastLine ?? copy('No messages yet', 'ჯერ არაფერი')}</span>
                {chat.unreadMentions > 0 && <span className="tc-chatrow__mention" title={copy('You are mentioned', 'მოგიხსენიეს')}>
                    <AtSign aria-hidden="true" />
                </span>}
                {unread && <span className="gk-count" aria-hidden="true">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>}
            </span>
        </button>
        {context.menu}
    </li>;
}

/**
 * The left column: Media on top (everything shared, in one place), the chats (unread first, then the latest
 * activity), a way to start one, and at the bottom the doors to Recently deleted and the Kept files shelf, each with
 * its count. Right-click (or hold) a chat for what it can do; right-click the empty column to start a chat.
 */
export function ChatList({ home, loading, currentId, view, maxDecision, onOpen, onStart, onView, onChat, onRefresh }: {
    home: ChatHome | null; loading: boolean; currentId: number | null; view: ListView | null; maxDecision: number;
    onOpen: (id: number) => void; onStart: (way: 'task' | 'topic') => void; onView: (view: ListView) => void;
    onChat: (chat: ChatSummary) => void; onRefresh: () => void;
}) {
    const copy = useJourneyCopy();
    const [doing, setDoing] = useState<Doing>(null);
    const [error, setError] = useState('');
    const run = async (work: () => Promise<void>, what: [string, string]) => {
        setError('');
        try { await work(); } catch (failure) { setError(problem(copy, failure, what)); }
    };
    const status = (chat: ChatSummary, next: ChatStatus) => void run(async () => onChat(await setChatStatus(chat.id, next)), ['The status was not saved.', 'სტატუსი ვერ შეინახა.']);
    const menu = (chat: ChatSummary): ContextMenuItems => [
        { key: 'open', label: copy('Open', 'გახსნა'), icon: MessageSquare, onSelect: () => onOpen(chat.id) },
        {
            key: 'read', label: copy('Mark as read', 'წაკითხულად მონიშვნა'), icon: CheckCheck, disabled: chat.unreadCount === 0,
            reason: copy('Nothing waits for you here.', 'აქ არაფერი გელოდებათ.'),
            onSelect: () => void run(async () => { await markRead(chat.id, Number.MAX_SAFE_INTEGER); onRefresh(); }, ['It was not marked as read.', 'წაკითხულად ვერ მოინიშნა.']),
        },
        {
            key: 'rename', label: copy('Rename…', 'გადარქმევა…'), icon: Pencil, disabled: !!chat.task,
            reason: chat.task ? copy(`Named after ${chat.task.key}; rename the task.`, `${chat.task.key}-ის სახელს ატარებს; საქმეს გადაარქვით.`) : undefined,
            onSelect: () => setDoing({ kind: 'rename', chat }),
        },
        { key: 'talking', label: copy('Status: Talking', 'სტატუსი: ვსაუბრობთ'), icon: CircleDot, separated: true, disabled: chat.status === 'TALKING', reason: copy('It is now.', 'ახლა ასეა.'), onSelect: () => status(chat, 'TALKING') },
        { key: 'decided', label: copy('Status: Decided…', 'სტატუსი: გადაწყდა…'), icon: CheckCheck, onSelect: () => setDoing({ kind: 'decide', chat }) },
        { key: 'hold', label: copy('Status: On hold', 'სტატუსი: შეჩერებული'), icon: Pause, disabled: chat.status === 'ON_HOLD', reason: copy('It is now.', 'ახლა ასეა.'), onSelect: () => status(chat, 'ON_HOLD') },
        {
            key: 'delete', label: copy('Delete chat…', 'ჩატის წაშლა…'), icon: Trash2, danger: true, separated: true, disabled: !chat.canDelete,
            reason: chat.canDelete ? undefined : onlyDeleters(copy, chat, 'delete'), onSelect: () => setDoing({ kind: 'delete', chat }),
        },
    ];
    const column = useContextMenu(() => [
        { key: 'start', label: copy('Start a chat', 'ახალი ჩატი'), icon: Plus, onSelect: () => onStart('topic') },
        { key: 'task', label: copy('Start a chat about a task', 'ჩატი საქმეზე'), icon: ClipboardList, onSelect: () => onStart('task') },
        { key: 'media', label: copy('Media', 'მედია'), icon: Images, separated: true, onSelect: () => onView('media') },
        home && home.deleted.length > 0 && { key: 'deleted', label: copy('Recently deleted', 'ბოლოს წაშლილი'), icon: Trash2, onSelect: () => onView('deleted') },
        home && home.keptFiles > 0 && { key: 'kept', label: copy('Kept files', 'შენახული ფაილები'), icon: Archive, onSelect: () => onView('kept') },
    ], { label: copy('Chats', 'ჩატები') });
    const done = (chat: ChatSummary) => { setDoing(null); onChat(chat); };
    return <nav className="tc-chats" aria-label={copy('Chats', 'ჩატები')} {...column.bind}>
        <ul className="tc-chats__doors tc-chats__doors--top">
            <li><button type="button" aria-current={view === 'media' ? 'true' : undefined} onClick={() => onView('media')}>
                <Images aria-hidden="true" /><span>{copy('Media', 'მედია')}</span>
                <span className="tc-faint">{copy('pictures, videos, files', 'სურათები, ვიდეო, ფაილები')}</span>
            </button></li>
        </ul>
        <div className="tc-chats__head">
            <h2 className="tc-chats__title">{copy('Chats', 'ჩატები')}</h2>
            <Button size="sm" variant="primary" onClick={() => onStart('task')}><Plus aria-hidden="true" />{copy('Start a chat', 'ახალი ჩატი')}</Button>
        </div>
        {error && <p className="gk-notice gk-notice--danger tc-chats__error" role="alert"><span>{error}</span>
            <button type="button" className="tc-tool" aria-label={copy('Dismiss', 'დახურვა')} onClick={() => setError('')}><X aria-hidden="true" /></button></p>}
        {loading && !home && <div className="tc-chats__loading" role="status" aria-label={copy('Loading', 'იტვირთება')}>
            <Skeleton height={52} /><Skeleton height={52} /><Skeleton height={52} />
        </div>}
        {home && !home.chats.length && <p className="tc-chats__empty">
            {copy('No chats yet. Start one about a task, or a general topic.', 'ჩატები ჯერ არ არის. დაიწყეთ საქმეზე ან ზოგად თემაზე.')}
        </p>}
        {home && home.chats.length > 0 && <ul className="tc-chats__list">
            {home.chats.map(chat => <ChatRow key={chat.id} chat={chat} current={chat.id === currentId && view === null} onOpen={onOpen} menu={menu} />)}
        </ul>}
        {home && (home.deleted.length > 0 || home.keptFiles > 0) && <ul className="tc-chats__doors">
            {home.deleted.length > 0 && <li><button type="button" aria-current={view === 'deleted' ? 'true' : undefined} onClick={() => onView('deleted')}>
                <Trash2 aria-hidden="true" /><span>{copy('Recently deleted', 'ბოლოს წაშლილი')}</span>
                <span className="tc-faint gk-num">{home.deleted.length}</span>
            </button></li>}
            {home.keptFiles > 0 && <li><button type="button" aria-current={view === 'kept' ? 'true' : undefined} onClick={() => onView('kept')}>
                <Archive aria-hidden="true" /><span>{copy('Kept files', 'შენახული ფაილები')}</span>
                <span className="tc-faint gk-num">{home.keptFiles}</span>
            </button></li>}
        </ul>}
        <p className="tc-chats__tip tc-faint">{copy('Tip: right-click (or hold) a chat, a message or a person for more.', 'რჩევა: მარჯვენა ღილაკით (ან ხანგრძლივი შეხებით) ჩატზე, შეტყობინებაზე ან ადამიანზე მეტს ნახავთ.')}</p>
        {column.menu}
        {doing?.kind === 'rename' && <RenameDialog chat={doing.chat} onClose={() => setDoing(null)} onDone={done} />}
        {doing?.kind === 'decide' && <DecideDialog chat={doing.chat} max={maxDecision} onClose={() => setDoing(null)} onDone={done} />}
        {doing?.kind === 'delete' && <FilePicker chat={doing.chat} mode="delete" onClose={() => setDoing(null)} onDone={done} />}
    </nav>;
}
