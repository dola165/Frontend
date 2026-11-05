import { useId, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { ChoiceChips } from '../../design/ChoiceChips';
import { Button, Chip, Field } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/formatting';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { announceToClub, type ClubAnnouncements } from './clubApi';
import { expiryFor, localDate, type PinChoice } from './pinning';

/**
 * Announce to the club: to everyone (the club's leaders and media officer) or to chosen squads (the squads one posts
 * for), pinned for them until the chosen day, a week by default. One request id per wording, so a retry never sends
 * twice; changing anything makes it a new announcement.
 */
export function ClubAnnounceDialog({ clubId, rights, onClose, onSent }: { clubId: number; rights: ClubAnnouncements; onClose: () => void; onSent: () => void }) {
    const copy = useJourneyCopy();
    const ids = { title: useId(), body: useId(), to: useId(), pin: useId() };
    const [title, setTitle] = useState(''), [body, setBody] = useState('');
    // The whole club when one may announce to it; otherwise the first squad one posts for.
    const [squads, setSquads] = useState<number[]>(() => rights.wholeClub || !rights.squads.length ? [] : [rights.squads[0].id]);
    const [pin, setPin] = useState<PinChoice>('7'), [date, setDate] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [told, setTold] = useState<number | null>(null);
    const request = useRef<{ signature: string; id: string } | null>(null);
    const now = new Date();
    const until = expiryFor(pin, date, now);
    const dateProblem = pin === 'date' && (!until || until.getTime() <= now.getTime());
    const toggle = (id: number) => setSquads(current => current.includes(id) ? current.filter(s => s !== id) : [...current, id]);
    const pins: { value: PinChoice; label: string }[] = [
        { value: '1', label: copy('Tomorrow', 'ხვალამდე') }, { value: '3', label: copy('3 days', '3 დღე') }, { value: '7', label: copy('1 week', '1 კვირა') },
        { value: '14', label: copy('2 weeks', '2 კვირა') }, { value: 'date', label: copy('Until a date', 'თარიღამდე') },
    ];
    const ready = title.trim() && until && !dateProblem && (rights.wholeClub || squads.length > 0);
    const send = async () => {
        if (!ready || busy) return;
        const data = { title: title.trim(), body: body.trim(), squadIds: squads, expiresAt: until!.toISOString() };
        const signature = JSON.stringify(data);
        if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
        setBusy(true); setError('');
        try { setTold((await announceToClub(clubId, { requestId: request.current.id, ...data })).told); onSent(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('It couldn’t be sent. Your text is kept; try again.', 'ვერ გაიგზავნა. ტექსტი შენახულია, სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="md" className="ca-dialog" title={copy('Announce to the club', 'კლუბის განცხადება')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={told !== null ? <Button variant="primary" onClick={onClose}>{copy('Done', 'მზადაა')}</Button>
            : <><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
                <Button variant="primary" disabled={!ready || busy} onClick={() => void send()}><Megaphone aria-hidden="true" />{busy ? copy('Sending…', 'იგზავნება…') : copy('Send and pin', 'გაგზავნა და მიმაგრება')}</Button></>}>
        {told !== null ? <p className="ca-dialog__done" role="status">{copy(`Sent to ${told} ${told === 1 ? 'person' : 'people'}, pinned until ${formatDate(until!, { weekday: 'short', day: 'numeric', month: 'short' })}.`,
            `გაეგზავნა ${told} ადამიანს, მიმაგრებულია ${formatDate(until!, { weekday: 'short', day: 'numeric', month: 'short' })}-მდე.`)}</p>
            : <form className="ca-dialog__form" onSubmit={event => { event.preventDefault(); void send(); }}>
                <div className="gk-field">
                    <span className="gk-field__label" id={ids.to}>{copy('To', 'ვის')}</span>
                    <div className="gk-chips" role="group" aria-labelledby={ids.to}>
                        {rights.wholeClub && <Chip pressed={!squads.length} onClick={() => setSquads([])}>{copy('Whole club', 'მთელი კლუბი')}</Chip>}
                        {rights.squads.map(squad => <Chip key={squad.id} pressed={squads.includes(squad.id)} onClick={() => toggle(squad.id)}>{squad.name}</Chip>)}
                    </div>
                </div>
                <Field label={copy('Title', 'სათაური')} htmlFor={ids.title}>
                    <input id={ids.title} className="gk-input" maxLength={140} autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder={copy('Pitch closed on Saturday', 'შაბათს მოედანი დაკეტილია')} />
                </Field>
                <Field label={copy('Message', 'შეტყობინება')} htmlFor={ids.body}>
                    <textarea id={ids.body} className="gk-input" maxLength={2000} rows={3} value={body} onChange={event => setBody(event.target.value)} />
                </Field>
                <div className="gk-field">
                    <span className="gk-field__label" id={ids.pin}>{copy('Pinned until', 'მიმაგრებულია')}</span>
                    <ChoiceChips labelledBy={ids.pin} value={pin} onChange={setPin} choices={pins} />
                    {pin === 'date' && <input aria-label={copy('Last day pinned', 'ბოლო დღე')} className="gk-input ca-dialog__date" type="date" min={localDate(now)} value={date} onChange={event => setDate(event.target.value)} />}
                </div>
                {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            </form>}
    </Dialog>;
}
