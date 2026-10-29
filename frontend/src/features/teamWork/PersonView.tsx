import { useEffect, useId, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button, Panel, Skeleton } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addNowComment, deleteNowComment, editNowComment, fetchNow, writeNow, type NowNote, type Person, type Plan, type WorkItem } from './api';
import { needsYou } from './needsYou';
import { TaskGroups } from './NowLists';
import { ago } from './teamWorkWords';
import { WorkComments } from '../../components/work/WorkComments';
import './team-work-now.css';

/**
 * The person's Now note, in their own words, with when they last changed it; only they edit it. Under it, teammates'
 * comments ("let's do branding first"), each edited or deleted by its author. A comment tells the person; their reply
 * tells whoever commented.
 */
export function NowNoteCard({ person, team, me }: { person: Person & { id: number }; team: Person[]; me: number | null }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [note, setNote] = useState<NowNote | null>(null);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        fetchNow(person.id, controller.signal).then(next => { if (!controller.signal.aborted) { setNote(next); setError(''); } })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('The Now note could not load.', '„ახლა“ ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [person.id, copy]);
    const first = (person.name ?? '—').split(' ')[0];
    if (!note) return <Panel className="tw-now-note">{error ? <p className="gk-notice gk-notice--danger" role="alert">{error}</p> : <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={56} /></div>}</Panel>;
    const save = async () => {
        setBusy(true); setError('');
        try { setNote(await writeNow(person.id, text.trim())); setEditing(false); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    const start = () => { setText(note.body ?? ''); setEditing(true); };
    const keep = (next: NowNote) => { setNote(next); return next.comments; };
    return <Panel className="tw-now-note">
        <div className="tw-now-note__head">
            <h3 className="tw-now-note__title">{copy('Now', 'ახლა')}</h3>
            {note.updatedAt && <span className="gk-faint">{copy(`updated ${ago(copy, note.updatedAt)}`, `განახლდა ${ago(copy, note.updatedAt)}`)}</span>}
            {note.canEdit && note.body && !editing && <button type="button" className="work-icon-button" aria-label={copy('Change your Now note', 'შეცვალეთ თქვენი „ახლა“')} onClick={start}><Pencil aria-hidden="true" /></button>}
        </div>
        {editing ? <form className="tw-purpose__edit" onSubmit={event => { event.preventDefault(); void save(); }}>
            <label htmlFor={id} className="gk-visually-hidden">{copy('What you’re doing now', 'რას აკეთებთ ახლა')}</label>
            <textarea id={id} className="gk-input" autoFocus rows={3} maxLength={1000} value={text} placeholder={copy('Working on branding ideas on the side while finishing registration and roles', 'გვერდით ბრენდინგის იდეებზე ვმუშაობ, თან რეგისტრაციას და როლებს ვასრულებ')}
                onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setEditing(false); }} />
            <span className="work-row-actions"><Button size="sm" variant="primary" type="submit" disabled={busy}>{busy ? copy('Saving…', 'ინახება…') : copy('Save', 'შენახვა')}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{copy('Cancel', 'გაუქმება')}</Button></span>
        </form> : note.body ? <p className="tw-now-note__body">{note.body}</p>
            : note.canEdit ? <button type="button" className="tw-purpose__prompt" onClick={start}><Pencil aria-hidden="true" />{copy('Write what you’re doing now, in a few sentences', 'დაწერეთ, რას აკეთებთ ახლა, რამდენიმე წინადადებით')}</button>
            : <p className="gk-faint tw-now-note__none">{copy(`${first} hasn’t written what they’re doing yet.`, `${first}-ს ჯერ არ დაუწერია, რას აკეთებს.`)}</p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        <WorkComments comments={note.comments} team={team} me={me} onChanged={() => undefined}
            label={note.canEdit ? copy('Reply', 'პასუხი') : copy('Comment', 'კომენტარი')}
            placeholder={note.canEdit ? copy('Reply to your teammates', 'უპასუხეთ გუნდელებს') : copy(`Tell ${first}, e.g. let’s do branding first`, `უთხარით ${first}-ს, მაგ. ჯერ ბრენდინგი გავაკეთოთ`)}
            actions={{ add: async body => keep(await addNowComment(person.id, body)), edit: async (comment, body) => keep(await editNowComment(comment, body)), remove: async comment => keep(await deleteNowComment(comment)) }} />
    </Panel>;
}

/**
 * "What Cotne is doing": their responsibility, their Now note with teammates' comments, then one compact list of
 * their open tasks (Needs you, In progress, Blocked, each heading only when it has something). Their recent activity
 * is the agenda under it, already filtered to them.
 */
export function PersonView({ person, line, items, planOf, team, me, onOpen }: {
    person: Person; line?: string; items: WorkItem[]; planOf: Map<number, Plan>; team: Person[]; me: number | null; onOpen: (taskId: number, stepId: number | null) => void;
}) {
    const copy = useJourneyCopy();
    const mine = items.filter(item => item.people.some(who => who.id === person.id));
    const parentOf = new Map(items.map(item => [item.id, item]));
    const waiting = needsYou(mine);
    const rest = mine.filter(item => !waiting.includes(item));
    const name = person.name ?? '—';
    const groups: [string, WorkItem[]][] = [[copy('Needs you', 'გელოდებათ'), waiting], [copy('In progress', 'მიმდინარე'), rest.filter(item => item.status === 'IN_PROGRESS')], [copy('Blocked', 'დაბლოკილი'), rest.filter(item => item.status === 'BLOCKED')]];
    const open = groups.some(([, list]) => list.length > 0);
    return <section className="tw-person" aria-labelledby="tw-person-title">
        <h2 id="tw-person-title" className="tw-person__title">{copy(`What ${name} is doing`, `რას აკეთებს ${name}`)}{line && <span className="tw-person__line">{line}</span>}</h2>
        {person.id != null && <NowNoteCard key={person.id} person={{ ...person, id: person.id }} team={team} me={me} />}
        <div className="tw-person__open">
            {open ? <TaskGroups groups={groups} planOf={planOf} parentOf={parentOf} onOpen={onOpen} />
                : <p className="tw-quiet-row gk-muted">{copy(`Nothing open for ${name.split(' ')[0]}.`, `${name.split(' ')[0]}-ს ღია არაფერი აქვს.`)}</p>}
        </div>
    </section>;
}
