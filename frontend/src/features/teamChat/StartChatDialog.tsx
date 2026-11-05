import { useEffect, useId, useState } from 'react';
import { Lock } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Avatar, Button } from '../../design/primitives';
import type { WorkStatus } from '../teamWork/api';
import { statusName, statusWords } from '../teamWork/teamWorkWords';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { createChat, fetchTasks, type ChatPerson, type ChatSummary, type TaskOption } from './api';
import { CHAT_PRIVATE, problem } from './teamChatWords';

/**
 * Who a new chat is for: everyone on the team (it follows the team list; the default), or the team members ticked.
 * Who starts it is always in it. Nobody off the team can ever be added.
 */
export function WhoPicker({ people, me, chosen, onChosen }: { people: ChatPerson[]; me: number | null; chosen: number[] | null; onChosen: (chosen: number[] | null) => void }) {
    const copy = useJourneyCopy();
    const name = useId();
    const others = people.filter(person => person.id !== me);
    return <fieldset className="tc-who">
        <legend>{copy('Who is in it', 'ვინ არის მასში')}</legend>
        <label className="tc-who__way"><input type="radio" name={name} checked={chosen === null} onChange={() => onChosen(null)} />
            <span><strong>{copy('Everyone on the team', 'გუნდის ყველა წევრი')}</strong>
                <span className="tc-faint">{copy('Follows the team list: whoever joins the team is in it.', 'მისდევს გუნდის სიას: ვინც გუნდში მოვა, ჩატშიც იქნება.')}</span></span>
        </label>
        <label className="tc-who__way"><input type="radio" name={name} checked={chosen !== null} onChange={() => onChosen(chosen ?? [])} />
            <span><strong><Lock aria-hidden="true" className="tc-who__lock" />{copy('Chosen people', 'არჩეული ხალხი')}</strong>
                <span className="tc-faint">{copy('Only those you tick, and you. You can add or remove people later.', 'მხოლოდ ვისაც მონიშნავთ, და თქვენ. მოგვიანებით შეგიძლიათ დაამატოთ ან ამოიღოთ.')}</span></span>
        </label>
        {chosen !== null && <ul className="tc-who__people" aria-label={copy('Team members', 'გუნდის წევრები')}>
            {others.map(person => <li key={person.id}><label>
                <input type="checkbox" checked={chosen.includes(person.id)}
                    onChange={event => onChosen(event.target.checked ? [...chosen, person.id] : chosen.filter(id => id !== person.id))} />
                <span aria-hidden="true"><Avatar src={person.avatarUrl} name={person.name} size={24} /></span><span>{person.name}</span>
            </label></li>)}
            {!others.length && <li className="tc-faint">{copy('Nobody else is on the team yet.', 'გუნდში ჯერ სხვა არავინაა.')}</li>}
        </ul>}
    </fieldset>;
}

/**
 * Starting a chat: a general topic by name, or from one of the open tasks (their keys, short names and status; a
 * task that already has a chat opens it), and who is in it. One decision at a time: the two ways are tabs.
 */
export function StartChatDialog({ people, me, way: initial = 'task', onClose, onCreated }: {
    people: ChatPerson[]; me: number | null; way?: 'task' | 'topic'; onClose: () => void; onCreated: (chat: ChatSummary) => void;
}) {
    const copy = useJourneyCopy();
    const [way, setWay] = useState<'task' | 'topic'>(initial);
    const [name, setName] = useState('');
    const [tasks, setTasks] = useState<TaskOption[] | null>(null);
    const [filter, setFilter] = useState('');
    const [chosen, setChosen] = useState<number[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const nameId = useId(), filterId = useId();

    useEffect(() => {
        const controller = new AbortController();
        fetchTasks(controller.signal).then(setTasks).catch(failure => {
            if (!controller.signal.aborted) setError(problem(copy, failure, ['The tasks could not load.', 'საქმეები ვერ ჩაიტვირთა.']));
        });
        return () => controller.abort();
    }, [copy]);

    const start = async (body: { name?: string; taskId?: number }) => {
        setBusy(true); setError('');
        try { onCreated(await createChat({ ...body, people: chosen })); }
        catch (failure) { setError(problem(copy, failure, ['The chat could not be started.', 'ჩატი ვერ დაიწყო.'], CHAT_PRIVATE)); }
        finally { setBusy(false); }
    };
    const words = filter.trim().toLowerCase();
    const shown = (tasks ?? []).filter(option => !words || option.task.key.toLowerCase().includes(words) || option.task.title.toLowerCase().includes(words));

    return <Dialog open size="md" className="tc-dialog tc-start" title={copy('Start a chat', 'ახალი ჩატი')} onClose={onClose}
        closeLabel={copy('Close', 'დახურვა')} description={copy('About one task, or a general topic.', 'ერთ საქმეზე, ან ზოგად თემაზე.')}>
        <div className="tc-tabs tc-start__ways" role="tablist" aria-label={copy('Start from', 'საიდან')}>
            <button type="button" role="tab" aria-selected={way === 'task'} onClick={() => setWay('task')}>{copy('From a task', 'საქმიდან')}</button>
            <button type="button" role="tab" aria-selected={way === 'topic'} onClick={() => setWay('topic')}>{copy('General topic', 'ზოგადი თემა')}</button>
        </div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {way === 'topic' && <form className="tc-start__topic"
            onSubmit={event => { event.preventDefault(); if (name.trim()) void start({ name: name.trim() }); }}>
            <label className="tc-sr" htmlFor={nameId}>{copy('Name', 'სახელი')}</label>
            <input id={nameId} className="gk-input" value={name} maxLength={100} autoFocus placeholder={copy('What is it about?', 'რაზეა?')}
                onChange={event => setName(event.target.value)} />
            <Button type="submit" variant="primary" disabled={busy || !name.trim()}>{copy('Start', 'დაწყება')}</Button>
        </form>}
        {way === 'task' && <div className="tc-start__tasks">
            <label className="tc-sr" htmlFor={filterId}>{copy('Find a task', 'საქმის ძიება')}</label>
            <input id={filterId} type="search" className="gk-input" value={filter} autoFocus placeholder={copy('Key or name…', 'კოდი ან სახელი…')}
                onChange={event => setFilter(event.target.value)} />
            {!tasks && !error && <p className="tc-faint" role="status">{copy('Loading…', 'იტვირთება…')}</p>}
            {tasks && !shown.length && <p className="tc-faint">{copy('No open task matches.', 'ასეთი ღია საქმე არ არის.')}</p>}
            {shown.length > 0 && <ul className="tc-start__list">
                {shown.map(option => {
                    const status = option.task.status as WorkStatus;
                    return <li key={option.task.id}><button type="button" disabled={busy || option.chatPrivate} onClick={() => void start({ taskId: option.task.id })}
                        data-status={option.task.status} title={option.chatPrivate ? copy(CHAT_PRIVATE[0], CHAT_PRIVATE[1]) : undefined}>
                        <span className="tc-dot" aria-hidden="true" />
                        <span className="tc-chatrow__key gk-num">{option.task.key}</span>
                        <span className="tc-start__name" title={option.task.title}>{option.task.title}</span>
                        <span className="tc-faint">{status in statusWords ? statusName(copy, status) : option.task.status}</span>
                        {option.chatId && <span className="tc-start__has">{copy('has a chat', 'აქვს ჩატი')}</span>}
                        {option.chatPrivate && <span className="tc-start__has"><Lock aria-hidden="true" />{copy('chosen people', 'არჩეული ხალხი')}</span>}
                    </button></li>;
                })}
            </ul>}
        </div>}
        <WhoPicker people={people} me={me} chosen={chosen} onChosen={setChosen} />
    </Dialog>;
}
