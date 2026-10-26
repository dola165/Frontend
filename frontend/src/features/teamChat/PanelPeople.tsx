import { useState } from 'react';
import { ClipboardList, Lock, LogOut, NotebookPen, UserMinus, UserPlus, UserRound, Users, X } from 'lucide-react';
import { useContextMenu, type ContextMenuItems } from '../../components/useContextMenu';
import { Dialog } from '../../design/Dialog';
import { Avatar, Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addPeople, removePerson, setAudience, type ChatPeople, type ChatPerson, type ChatSummary } from './api';
import type { PersonTab } from './personTabs';
import { onlyManagers, problem } from './teamChatWords';

const PEOPLE_FORBIDDEN: [string, string] = ['Only the person who started this chat or a team admin chooses who is in it.', 'ვინ არის ჩატში, ირჩევს მხოლოდ მისი დამწყები ან გუნდის ადმინი.'];

/** Team members to add to a chat for chosen people: those not in it yet, ticked. */
function AddDialog({ chat, team, members, onClose, onDone }: { chat: ChatSummary; team: ChatPerson[]; members: ChatPerson[]; onClose: () => void; onDone: (people: ChatPeople) => void }) {
    const copy = useJourneyCopy();
    const [picked, setPicked] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const inIt = new Set(members.map(person => person.id));
    const outside = team.filter(person => !inIt.has(person.id));
    const save = async () => {
        setBusy(true); setError('');
        try { onDone(await addPeople(chat.id, picked)); }
        catch (failure) { setError(problem(copy, failure, ['They were not added.', 'ვერ დაემატნენ.'], PEOPLE_FORBIDDEN)); setBusy(false); }
    };
    return <Dialog open size="sm" className="tc-dialog" title={copy('Add people', 'ხალხის დამატება')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copy('Team members only. They see the chat’s history too.', 'მხოლოდ გუნდის წევრები. ისინი ჩატის ისტორიასაც ნახავენ.')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button variant="primary" disabled={busy || !picked.length} onClick={() => void save()}>{copy(`Add ${picked.length || ''}`.trim(), `დამატება ${picked.length || ''}`.trim())}</Button></>}>
        {outside.length ? <ul className="tc-who__people">{outside.map(person => <li key={person.id}><label>
            <input type="checkbox" checked={picked.includes(person.id)} onChange={event => setPicked(current => event.target.checked ? [...current, person.id] : current.filter(id => id !== person.id))} />
            <span aria-hidden="true"><Avatar src={person.avatarUrl} name={person.name} size={24} /></span><span>{person.name}</span>
        </label></li>)}</ul>
            : <p className="tc-faint">{copy('Everyone on the team is in this chat already.', 'გუნდის ყველა წევრი უკვე ამ ჩატშია.')}</p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}

type Asking = { kind: 'remove'; person: ChatPerson } | { kind: 'leave' } | { kind: 'everyone' } | null;

/** One person in the chat: their name opens them in a sheet; right-click (or hold) for the rest. */
function PersonRow({ person, me, menu, onOpen, onRemove }: {
    person: ChatPerson; me: number | null; menu: (person: ChatPerson) => ContextMenuItems; onOpen: (person: ChatPerson) => void; onRemove?: (person: ChatPerson) => void;
}) {
    const copy = useJourneyCopy();
    const context = useContextMenu(() => menu(person), { label: person.name ?? copy('Teammate', 'გუნდის წევრი') });
    return <li className="tc-personrow">
        <button type="button" className="tc-personrow__open gk-cm-target" onClick={() => onOpen(person)} {...context.bind}
            title={copy('Profile, tasks and what they are doing', 'პროფილი, საქმეები და რას აკეთებს')}>
            <span aria-hidden="true"><Avatar src={person.avatarUrl} name={person.name} size={24} /></span>
            <span>{person.name}{person.id === me && <span className="tc-faint"> {copy('(you)', '(თქვენ)')}</span>}</span>
        </button>
        {onRemove && <button type="button" className="tc-tool" aria-label={copy(`Remove ${person.name ?? ''} from the chat`, `${person.name ?? ''}-ის ამოღება ჩატიდან`)}
            title={copy('Remove from the chat', 'ჩატიდან ამოღება')} onClick={() => onRemove(person)}><X aria-hidden="true" /></button>}
        {context.menu}
    </li>;
}

/**
 * Who is in the chat: everyone on the team (it follows the team list), or the people chosen for it. Whoever started
 * it or a team admin chooses (add, remove, or open it to everyone); anyone leaves a chat for chosen people. A chat
 * keeps at least one person. A name opens the person in a sheet: their profile, their tasks, what they are doing.
 */
export function PanelPeople({ chat, members, team, me, onPeople, onLeft, onPerson }: {
    chat: ChatSummary; members: ChatPerson[]; team: ChatPerson[]; me: number | null;
    onPeople: (people: ChatPeople) => void; onLeft: () => void; onPerson: (personId: number, tab: PersonTab) => void;
}) {
    const copy = useJourneyCopy();
    const [adding, setAdding] = useState(false);
    const [asking, setAsking] = useState<Asking>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const chosen = chat.audience === 'CHOSEN';
    const manages = !!chat.canManagePeople;
    const trashed = chat.deletesAt !== null;
    const last = members.length <= 1;
    const run = async (work: () => Promise<void>, what: [string, string]) => {
        setBusy(true); setError('');
        try { await work(); } catch (failure) { setError(problem(copy, failure, what, PEOPLE_FORBIDDEN)); } finally { setBusy(false); setAsking(null); }
    };
    const choose = () => void run(async () => onPeople(await setAudience(chat.id, 'CHOSEN')), ['It was not changed.', 'ვერ შეიცვალა.']);
    const remove = (person: ChatPerson) => void run(async () => {
        const next = await removePerson(chat.id, person.id);
        if (next) onPeople(next); else onLeft();
    }, person.id === me ? ['You did not leave.', 'ვერ გახვედით.'] : ['They were not removed.', 'ვერ ამოიღეთ.']);
    const cannotRemove = (person: ChatPerson) => trashed ? copy('The chat is in Recently deleted.', 'ჩატი ბოლოს წაშლილებშია.')
        : !chosen ? copy('Everyone on the team is in this chat. Choose its people first.', 'ამ ჩატში გუნდის ყველა წევრია. ჯერ აირჩიეთ ხალხი.')
            : last ? copy('A chat keeps at least one person.', 'ჩატში ერთი ადამიანი მაინც რჩება.')
                : person.id !== me && !manages ? onlyManagers(copy, chat) : undefined;
    const menu = (person: ChatPerson): ContextMenuItems => [
        { key: 'profile', label: copy('Open their profile', 'პროფილის გახსნა'), icon: UserRound, onSelect: () => onPerson(person.id, 'profile') },
        { key: 'tasks', label: copy('See their Team work tasks', 'მისი საქმეების ნახვა'), icon: ClipboardList, onSelect: () => onPerson(person.id, 'tasks') },
        { key: 'now', label: copy('What they are doing now', 'რას აკეთებს ახლა'), icon: NotebookPen, onSelect: () => onPerson(person.id, 'now') },
        person.id === me
            ? { key: 'leave', label: copy('Leave the chat', 'ჩატის დატოვება'), icon: LogOut, danger: true, separated: true, disabled: !!cannotRemove(person), reason: cannotRemove(person), onSelect: () => setAsking({ kind: 'leave' }) }
            : { key: 'remove', label: copy('Remove from the chat', 'ჩატიდან ამოღება'), icon: UserMinus, danger: true, separated: true, disabled: !!cannotRemove(person), reason: cannotRemove(person), onSelect: () => setAsking({ kind: 'remove', person }) },
    ];
    return <section className="tc-panel__section" aria-label={copy('People', 'ხალხი')}>
        <h3 className="tc-panel__title">{copy('People', 'ხალხი')} <span className="tc-faint gk-num">{members.length}</span></h3>
        <p className="tc-panel__audience">
            {chosen ? <><Lock aria-hidden="true" /><span><strong>{copy('Chosen people', 'არჩეული ხალხი')}</strong> · {copy('only those below', 'მხოლოდ ქვემოთ ჩამოთვლილნი')}</span></>
                : <><Users aria-hidden="true" /><span><strong>{copy('Everyone on the team', 'გუნდის ყველა წევრი')}</strong> · {copy('follows the team list', 'მისდევს გუნდის სიას')}</span></>}
        </p>
        <ul className="tc-panel__people">
            {members.map(person => <PersonRow key={person.id} person={person} me={me} menu={menu} onOpen={one => onPerson(one.id, 'profile')}
                onRemove={chosen && manages && !trashed && !last && person.id !== me ? one => setAsking({ kind: 'remove', person: one }) : undefined} />)}
        </ul>
        {!trashed && <div className="tc-panel__actions">
            {manages && chosen && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAdding(true)}><UserPlus aria-hidden="true" />{copy('Add people…', 'ხალხის დამატება…')}</Button>}
            {manages && chosen && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking({ kind: 'everyone' })}><Users aria-hidden="true" />{copy('Open to everyone', 'ყველასთვის გახსნა')}</Button>}
            {manages && !chosen && <Button size="sm" variant="ghost" disabled={busy} onClick={choose}><Lock aria-hidden="true" />{copy('Choose people', 'ხალხის არჩევა')}</Button>}
            {chosen && <Button size="sm" variant="ghost" className="tc-danger" disabled={busy || last} title={last ? copy('A chat keeps at least one person.', 'ჩატში ერთი ადამიანი მაინც რჩება.') : undefined}
                onClick={() => setAsking({ kind: 'leave' })}><LogOut aria-hidden="true" />{copy('Leave the chat', 'ჩატის დატოვება')}</Button>}
        </div>}
        {!manages && !trashed && <p className="tc-faint">{onlyManagers(copy, chat)}</p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {adding && <AddDialog chat={chat} team={team} members={members} onClose={() => setAdding(false)} onDone={next => { setAdding(false); onPeople(next); }} />}
        {asking && <Dialog open size="sm" role="alertdialog" className="tc-dialog" onClose={() => setAsking(null)} closeLabel={copy('Cancel', 'გაუქმება')}
            title={asking.kind === 'remove' ? copy(`Remove ${asking.person.name ?? ''} from the chat?`, `ამოვიღოთ ${asking.person.name ?? ''} ჩატიდან?`)
                : asking.kind === 'leave' ? copy('Leave this chat?', 'დავტოვოთ ეს ჩატი?') : copy('Open this chat to everyone on the team?', 'გავუხსნათ ეს ჩატი მთელ გუნდს?')}
            description={asking.kind === 'remove' ? copy('They lose it at once: its messages, files and search. You can add them again later.', 'ისინი მაშინვე კარგავენ მას: შეტყობინებებს, ფაილებს და ძიებას. მოგვიანებით ისევ შეგიძლიათ დაამატოთ.')
                : asking.kind === 'leave' ? copy('It goes from your chats at once. Someone who chooses its people can add you again.', 'ის მაშინვე გაქრება თქვენი ჩატებიდან. ვინც ხალხს ირჩევს, ისევ დაგამატებთ.')
                    : copy('Everyone on the team joins it and sees its history, and it follows the team list from now on.', 'გუნდის ყველა წევრი შემოვა და ისტორიას ნახავს; ამიერიდან ჩატი გუნდის სიას მისდევს.')}
            footer={<>
                <Button variant="ghost" onClick={() => setAsking(null)}>{copy('Cancel', 'გაუქმება')}</Button>
                {asking.kind === 'everyone'
                    ? <Button variant="primary" autoFocus disabled={busy} onClick={() => void run(async () => onPeople(await setAudience(chat.id, 'EVERYONE')), ['It was not opened to everyone.', 'ყველასთვის ვერ გაიხსნა.'])}>{copy('Open to everyone', 'ყველასთვის გახსნა')}</Button>
                    : <Button variant="danger" autoFocus disabled={busy} onClick={() => remove(asking.kind === 'remove' ? asking.person : members.find(one => one.id === me) ?? { id: me ?? 0, name: null, avatarUrl: null })}>
                        {asking.kind === 'remove' ? copy('Remove', 'ამოღება') : copy('Leave', 'დატოვება')}
                    </Button>}
            </>} />}
    </section>;
}
