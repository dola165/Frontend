import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Avatar, Button } from '../../design/primitives';
import type { WorkStatus } from '../teamWork/api';
import { statusName, statusWords } from '../teamWork/teamWorkWords';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { renameChat, setChatStatus, type ChatPerson, type ChatStatus, type ChatSummary } from './api';
import { DecideDialog } from './DecideDialog';
import { FilePicker } from './FilePicker';
import { PanelMedia, type MediaFilters } from './PanelMedia';
import { taskPath } from './richText';
import { downloadZip } from './saveFile';
import { onlyDeleters, problem, shortDay, STATUSES, statusWord } from './teamChatWords';

/** Who is in the chat: everyone on the team, the same people in every chat. */
function People({ members }: { members: ChatPerson[] }) {
    const copy = useJourneyCopy();
    return <section className="tc-panel__section" aria-label={copy('People', 'ხალხი')}>
        <h3 className="tc-panel__title">{copy('People', 'ხალხი')} <span className="tc-faint gk-num">{members.length}</span></h3>
        <ul className="tc-panel__people">
            {members.map(person => <li key={person.id}><Avatar src={person.avatarUrl} name={person.name} size={24} /><span>{person.name}</span></li>)}
        </ul>
    </section>;
}

/** The task the chat is about: its key, status, what done means, and the way to it. */
function Task({ chat }: { chat: ChatSummary }) {
    const copy = useJourneyCopy();
    const task = chat.task;
    const earlier = chat.earlierTask;
    if (!task) return <section className="tc-panel__section" aria-label={copy('Task', 'საქმე')}>
        <h3 className="tc-panel__title">{copy('Task', 'საქმე')}</h3>
        {earlier
            ? <>
                <p className="tc-faint">
                    {copy(`An earlier chat about ${earlier.key}, a general topic now: the task's newer chat is its chat.`,
                        `ადრინდელი ჩატი ${earlier.key}-ზე, ახლა ზოგადი თემა: საქმის ჩატი მისი ახალი ჩატია.`)}
                </p>
                <p className="tc-panel__taskname">{earlier.title}</p>
                <Link className="tc-link-button" to={taskPath(earlier)}><ExternalLink aria-hidden="true" />{copy('Open the task', 'საქმის გახსნა')}</Link>
            </>
            : <p className="tc-faint">{copy('A general topic, about no single task.', 'ზოგადი თემა, არც ერთ საქმეზე.')}</p>}
    </section>;
    const status = task.status as WorkStatus;
    return <section className="tc-panel__section tc-panel__task" aria-label={copy('Task', 'საქმე')} data-status={task.status}>
        <h3 className="tc-panel__title">{copy('Task', 'საქმე')}</h3>
        <p className="tc-panel__taskline">
            <span className="tc-chatrow__key gk-num">{task.key}</span><span className="tc-dot" aria-hidden="true" />
            {status in statusWords ? statusName(copy, status) : task.status}
        </p>
        <p className="tc-panel__taskname">{task.title}</p>
        <p className="tc-panel__label">{copy('Done means', 'მზადაა, როცა')}</p>
        <p className={task.doneMeans ? 'tc-panel__done' : 'tc-panel__done tc-faint'}>{task.doneMeans || copy('Not written yet.', 'ჯერ არ წერია.')}</p>
        <Link className="tc-link-button" to={taskPath(task)}><ExternalLink aria-hidden="true" />{copy('Open the task', 'საქმის გახსნა')}</Link>
    </section>;
}

/** The status, three choices; Decided asks for its one line. */
function Status({ chat, max, onChat }: { chat: ChatSummary; max: number; onChat: (chat: ChatSummary) => void }) {
    const copy = useJourneyCopy();
    const [deciding, setDeciding] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const trashed = chat.deletesAt !== null;
    const pick = async (status: ChatStatus) => {
        if (status === 'DECIDED') { setDeciding(true); return; }
        if (status === chat.status) return;
        setBusy(true); setError('');
        try { onChat(await setChatStatus(chat.id, status)); }
        catch (failure) { setError(problem(copy, failure, ['The status was not saved.', 'სტატუსი ვერ შეინახა.'])); }
        finally { setBusy(false); }
    };
    return <section className="tc-panel__section" aria-label={copy('Status', 'სტატუსი')}>
        <h3 className="tc-panel__title">{copy('Status', 'სტატუსი')}</h3>
        <div className="tc-panel__statuses" role="group" aria-label={copy('Status', 'სტატუსი')}>
            {STATUSES.map(status => <button key={status} type="button" data-status={status} aria-pressed={chat.status === status} disabled={busy || trashed}
                onClick={() => void pick(status)}><span className="tc-status__dot" aria-hidden="true" />{statusWord(copy, status)}</button>)}
        </div>
        {chat.decision && <p className="tc-panel__decision">
            {chat.status === 'DECIDED' ? copy('Decided:', 'გადაწყდა:') : copy('Last decision:', 'ბოლო გადაწყვეტილება:')} <strong>{chat.decision}</strong>
            {chat.decidedBy && <span className="tc-faint"> · {chat.decidedBy.name}{chat.decidedAt ? ` · ${shortDay(copy, chat.decidedAt)}` : ''}</span>}
        </p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {deciding && <DecideDialog chat={chat} max={max} onClose={() => setDeciding(false)} onDone={next => { setDeciding(false); onChat(next); }} />}
    </section>;
}

/** Settings: the name (general topics; a task's chat is named after its task), all files as one zip, deleting. */
function Settings({ chat, onChat }: { chat: ChatSummary; onChat: (chat: ChatSummary) => void }) {
    const copy = useJourneyCopy();
    const [naming, setNaming] = useState(false);
    const [name, setName] = useState(chat.name);
    const [deleting, setDeleting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const nameId = useId();
    const trashed = chat.deletesAt !== null;
    const rename = async () => {
        const words = name.trim();
        if (!words || words === chat.name) { setNaming(false); return; }
        setBusy(true); setError('');
        try { onChat(await renameChat(chat.id, words)); setNaming(false); }
        catch (failure) { setError(problem(copy, failure, ['The name was not saved.', 'სახელი ვერ შეინახა.'])); }
        finally { setBusy(false); }
    };
    const zip = async () => {
        setBusy(true); setError('');
        try { await downloadZip(chat.id); }
        catch (failure) { setError(problem(copy, failure, ['The files could not be downloaded.', 'ფაილები ვერ ჩამოიტვირთა.'])); }
        finally { setBusy(false); }
    };
    return <section className="tc-panel__section" aria-label={copy('Settings', 'პარამეტრები')}>
        <h3 className="tc-panel__title">{copy('Settings', 'პარამეტრები')}</h3>
        {chat.task
            ? <p className="tc-faint">
                {copy(`Named after ${chat.task.key}; renaming the task renames the chat.`,
                    `დაერქვა ${chat.task.key}-ის სახელი; საქმის გადარქმევა ჩატსაც გადაარქმევს.`)}
            </p>
            : naming ? <form className="tc-panel__rename" onSubmit={event => { event.preventDefault(); void rename(); }}>
                <label className="tc-sr" htmlFor={nameId}>{copy('Chat name', 'ჩატის სახელი')}</label>
                <input id={nameId} className="gk-input" value={name} maxLength={100} autoFocus onChange={event => setName(event.target.value)} />
                <Button type="submit" size="sm" variant="primary" disabled={busy || !name.trim()}>{copy('Save', 'შენახვა')}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setNaming(false); setName(chat.name); }}>{copy('Cancel', 'გაუქმება')}</Button>
            </form>
                : <Button size="sm" variant="ghost" disabled={trashed} onClick={() => { setName(chat.name); setNaming(true); }}>
                    <Pencil aria-hidden="true" />{copy('Rename', 'გადარქმევა')}
                </Button>}
        <div className="tc-panel__actions">
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void zip()}>
                <Download aria-hidden="true" />{copy('Download all files (zip)', 'ყველა ფაილის ჩამოტვირთვა (zip)')}
            </Button>
            {!trashed && chat.canDelete && <Button size="sm" variant="ghost" className="tc-danger" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden="true" />{copy('Delete chat…', 'ჩატის წაშლა…')}
            </Button>}
        </div>
        {!trashed && !chat.canDelete && <p className="tc-faint">{onlyDeleters(copy, chat, 'delete')}</p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {deleting && <FilePicker chat={chat} mode="delete" onClose={() => setDeleting(false)} onDone={next => { setDeleting(false); onChat(next); }} />}
    </section>;
}

/**
 * The right-hand panel of a chat: its people, its task, its status, what was shared, and its settings. On a phone
 * it is a page of its own, with a way back to the chat.
 */
export function ChatPanel({ chat, members, maxDecision, media, onMedia, onChat, onShow, onMissing, onBack }: {
    chat: ChatSummary; members: ChatPerson[]; maxDecision: number; media: MediaFilters; onMedia: (filters: MediaFilters) => void;
    onChat: (chat: ChatSummary) => void; onShow: (chatId: number, messageId: number) => void; onMissing: () => void; onBack: () => void;
}) {
    const copy = useJourneyCopy();
    return <div className="tc-panel">
        <header className="tc-panel__head">
            <button type="button" className="tc-back tc-panel__back" onClick={onBack} aria-label={copy(`Back to ${chat.name}`, `დაბრუნება: ${chat.name}`)}>
                <ArrowLeft aria-hidden="true" />
            </button>
            <h2 className="tc-panel__name">{chat.name}</h2>
        </header>
        <People members={members} />
        <Task chat={chat} />
        <Status chat={chat} max={maxDecision} onChat={onChat} />
        <PanelMedia chatId={chat.id} members={members} filters={media} onFilters={onMedia} onShow={onShow} onMissing={onMissing} trashed={chat.deletesAt !== null} />
        <Settings chat={chat} onChat={onChat} />
    </div>;
}
