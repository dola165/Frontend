import { useEffect, useId, useState } from 'react';
import { Bell } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Avatar, Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { askAttention, fetchTeam, type Asked, type Detail, type Person, type WorkItem } from './api';
import { MailMark } from './TeamMail';
import './team-work-mail.css';

const names = (people: Person[]) => people.map(person => person.name ?? '—').join(', ');

/**
 * "Notify" on a task: pick teammates (the task's people are picked already), add a line if you like, send. Each gets
 * the notice in the app, on their phone, and by email where they confirmed an inbox (the envelope). The ask is a line
 * in the task's history; someone asked about it a few minutes ago is left alone.
 */
function NotifyDialog({ item, team, me, onPut, onClose }: { item: WorkItem; team: Person[]; me: number | null; onPut: (detail: Detail) => void; onClose: () => void }) {
    const copy = useJourneyCopy();
    const lineId = useId();
    const others = team.filter(person => person.id != null && person.id !== me);
    const [chosen, setChosen] = useState<number[]>(() => item.people.flatMap(person => person.id != null && person.id !== me ? [person.id] : []));
    const [line, setLine] = useState('');
    const [mailed, setMailed] = useState<Set<number>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<Asked | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetchTeam(controller.signal).then(members => { if (!controller.signal.aborted) setMailed(new Set(members.filter(member => member.mail).map(member => member.userId))); }).catch(() => undefined);
        return () => controller.abort();
    }, []);
    const send = async () => {
        if (!chosen.length) { setError(copy('Pick who should look.', 'აირჩიეთ, ვინ უნდა ნახოს.')); return; }
        setBusy(true); setError('');
        try { const asked = await askAttention(item.id, chosen, line.trim()); setResult(asked); onPut(asked.detail); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be sent.', 'ვერ გაიგზავნა.'))); }
        finally { setBusy(false); }
    };
    const toggle = (id: number) => { setError(''); setChosen(current => current.includes(id) ? current.filter(other => other !== id) : [...current, id]); };
    return <Dialog open size="sm" className="tw-dialog" title={copy('Who should look?', 'ვინ უნდა ნახოს?')} description={`${item.key} ${item.title}`} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={result ? <Button variant="primary" onClick={onClose}>{copy('Done', 'მზადაა')}</Button>
            : <><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={busy} onClick={() => void send()}><Bell aria-hidden="true" />{busy ? copy('Sending…', 'იგზავნება…') : copy('Send', 'გაგზავნა')}</Button></>}>
        {result ? <div className="tw-notify" role="status">
            {result.told.length > 0 && <p className="tw-notify__done">{copy(`Sent to ${names(result.told)}.`, `გაეგზავნა: ${names(result.told)}.`)}</p>}
            {result.justAsked.length > 0 && <p className="tw-notify__done gk-muted">{copy(`${names(result.justAsked)} heard about it a few minutes ago, so not again.`, `${names(result.justAsked)}-ს რამდენიმე წუთის წინ უკვე ეცნობა.`)}</p>}
        </div> : <form className="tw-notify" onSubmit={event => { event.preventDefault(); void send(); }}>
            <fieldset className="tw-notify__people">
                <legend className="gk-visually-hidden">{copy('Teammates', 'გუნდელები')}</legend>
                {others.map(person => <button key={person.id} type="button" className="tw-notify__person" aria-pressed={chosen.includes(person.id!)} onClick={() => toggle(person.id!)}>
                    <Avatar name={person.name ?? '—'} size={28} />{person.name ?? '—'}{mailed.has(person.id!) && <MailMark />}
                </button>)}
            </fieldset>
            <div className="tw-field">
                <label htmlFor={lineId} className="tw-field__label">{copy('What’s needed, in one line', 'რა არის საჭირო, ერთი ხაზით')}</label>
                <input id={lineId} className="gk-input" maxLength={200} value={line} placeholder={copy('Can you check this today?', 'შეგიძლია დღეს ნახო?')} onChange={event => setLine(event.target.value)} />
            </div>
            <p className="tw-notify__hint">{copy('Everyone gets it in the app and on their phone; with the envelope, by email too.', 'ყველა მიიღებს აპში და ტელეფონზე; კონვერტით — ელფოსტითაც.')}</p>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </form>}
    </Dialog>;
}

export function NotifyButton({ item, team, me, onPut }: { item: WorkItem; team: Person[]; me: number | null; onPut: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState(false);
    return <>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Bell aria-hidden="true" />{copy('Notify', 'შეტყობინება')}</Button>
        {open && <NotifyDialog item={item} team={team} me={me} onPut={onPut} onClose={() => setOpen(false)} />}
    </>;
}
