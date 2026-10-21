import './announcements.css';
import { useRef, useState, type FormEvent } from 'react';
import { Megaphone } from 'lucide-react';
import { Button, Chip, Field, GkRoot } from '../../design/primitives';
import { ChoiceChips } from '../../design/ChoiceChips';
import { extractApiErrorMessage } from '../../utils/apiError';
import * as api from '../squadCommunication/api';
import { PIN_CHOICES, dayText, expiryFor, localDate, type PinChoice } from './pinning';

type Squad = Pick<api.SquadOverview, 'id' | 'name'>;

/**
 * A coach posts an announcement: separate from chat, pinned at the top of the squad's updates until it
 * expires, and (when asked) each family confirms they have read it. With several squads to choose from
 * (My squads), one announcement goes to each chosen squad.
 */
/** The announcements coaches send most. Each fills the title and a message to finish in one line. */
const TEMPLATES = [
    { title: 'Training cancelled', body: 'No training on [day]. We train again as usual next time.' },
    { title: 'New time', body: 'Training on [day] moves to [time] at [place]. Everything else stays the same.' },
    { title: 'What to bring', body: 'Please bring: [kit], shin pads, water. Be there 10 minutes before the start.' },
    { title: 'Where to meet', body: 'We meet at [place] at [time]. The bus leaves 15 minutes later.' },
    { title: 'Well done', body: 'Great effort today, everyone. Rest well and see you at the next session.' },
];

export function AnnouncementComposer({ space, spaces, initialSquads, startOpen = false, onPosted }: {
    space?: Squad; spaces?: Squad[]; initialSquads?: number[]; startOpen?: boolean; onPosted: () => void;
}) {
    const choices = spaces ?? (space ? [space] : []);
    const [targets, setTargets] = useState<number[]>(() => {
        const chosen = (initialSquads ?? []).filter(id => choices.some(choice => choice.id === id));
        return chosen.length ? chosen : choices.map(choice => choice.id);
    });
    const [title, setTitle] = useState(''), [body, setBody] = useState('');
    const [pin, setPin] = useState<PinChoice>('7'), [date, setDate] = useState('');
    const [confirm, setConfirm] = useState(true);
    const [open, setOpen] = useState(startOpen);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [posted, setPosted] = useState('');
    // One request id per squad for the same text, and the squads it already reached, so a retry never posts twice.
    const request = useRef<{ signature: string; ids: Record<number, string>; done: number[] } | null>(null);
    const sending = useRef(false);
    const now = new Date();
    const until = expiryFor(pin, date, now);
    const dateProblem = pin === 'date' && (!until || until.getTime() <= now.getTime()) ? 'Choose a day from today on.' : '';
    const names = (ids: number[]) => ids.map(id => choices.find(choice => choice.id === id)?.name ?? `Squad #${id}`).join(' and ');

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (sending.current || dateProblem || !until || !targets.length) return;
        sending.current = true; setBusy(true); setError(''); setPosted('');
        const signature = JSON.stringify([title, body, confirm, until.toISOString()]);
        if (request.current?.signature !== signature) request.current = { signature, ids: {}, done: [] };
        const current = request.current;
        let failure = '';
        for (const id of targets) {
            if (current.done.includes(id)) continue;
            current.ids[id] ??= crypto.randomUUID();
            try {
                await api.postMessage(id, { requestId: current.ids[id], threadUserId: null, kind: 'ANNOUNCEMENT', title: title.trim(), body: body.trim(), important: confirm, expiresAt: until.toISOString() });
                current.done.push(id);
            } catch (cause) { failure ||= extractApiErrorMessage(cause, 'The announcement could not be posted. Your text is kept; try again.'); }
        }
        const reached = targets.filter(id => current.done.includes(id)), missed = targets.filter(id => !current.done.includes(id));
        if (!missed.length) {
            setTitle(''); setBody(''); setPin('7'); setDate(''); setOpen(false); request.current = null;
            setPosted(`Posted. Pinned for ${names(reached)} until ${dayText(until, now)}.`);
            onPosted();
        } else {
            setError(reached.length ? `Posted for ${names(reached)}, not yet for ${names(missed)}. Your text is kept; try again.` : failure);
            if (reached.length) onPosted();
        }
        sending.current = false; setBusy(false);
    }

    // Closed, the composer is one line; a half-written announcement keeps it open.
    if (!open && !title && !body) return (
        <GkRoot className="gk-announce-compose">
            {posted && <p className="gk-notice gk-announce-compose__posted" role="status">{posted}</p>}
            <button type="button" className="gk-announce-compose__open" onClick={() => { setOpen(true); setPosted(''); }}>
                <Megaphone aria-hidden="true" /><span><strong>Write a new announcement</strong><span>To one or several squads · pinned at the top until it expires</span></span>
            </button>
        </GkRoot>
    );
    return (
        <GkRoot className="gk-announce-compose">
            <form className="gk-announce-compose__form" onSubmit={event => void submit(event)} aria-label="New announcement">
                <div className="gk-announce-compose__head">
                    <h2 className="gk-announce-compose__title">New announcement</h2>
                    <p className="gk-field__hint">For training changes, kit and travel. Chat stays in Squad chat.</p>
                </div>
                {choices.length > 1 && <div className="gk-field">
                    <span className="gk-field__label" id="announce-to">Send to</span>
                    <div className="gk-chips" role="group" aria-labelledby="announce-to">{choices.map(choice => <Chip key={choice.id} pressed={targets.includes(choice.id)}
                        onClick={() => setTargets(current => current.includes(choice.id) ? current.filter(id => id !== choice.id) : [...current, choice.id])}>{choice.name}</Chip>)}</div>
                    {!targets.length && <span className="gk-field__hint">Choose at least one squad.</span>}
                </div>}
                {/* The five messages coaches send most, one press each; the text stays editable. */}
                <div className="gk-field">
                    <span className="gk-field__label" id="announce-template">Start from</span>
                    <div className="gk-chips" role="group" aria-labelledby="announce-template">{TEMPLATES.map(template => <Chip key={template.title} pressed={title === template.title}
                        onClick={() => { setTitle(template.title); setBody(template.body); }}>{template.title}</Chip>)}</div>
                </div>
                <Field label="Title" htmlFor="announce-title">
                    <input id="announce-title" className="gk-input" required maxLength={140} autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="What should parents know?" />
                </Field>
                <Field label="Message" htmlFor="announce-body">
                    <textarea id="announce-body" className="gk-input" required maxLength={4000} rows={4} value={body} onChange={event => setBody(event.target.value)} placeholder="Write a clear update for the squad…" />
                </Field>
                <div className="gk-field">
                    <span className="gk-field__label" id="announce-pin">Pinned until</span>
                    <ChoiceChips labelledBy="announce-pin" value={pin} onChange={setPin} choices={PIN_CHOICES.map(choice => ({ value: choice.id, label: choice.label }))} />
                    {pin === 'date' && <input aria-label="Last day pinned" className="gk-input gk-announce-compose__date" type="date" min={localDate(now)} value={date} onChange={event => setDate(event.target.value)} aria-invalid={Boolean(dateProblem) || undefined} />}
                    {dateProblem && date ? <span className="gk-field__error" role="alert">{dateProblem}</span>
                        : <span className="gk-field__hint">{until ? `Pinned at the top of the squad’s updates until the end of ${dayText(until, now)}. It stays in the list afterwards.` : 'Choose the last day it stays pinned.'}</span>}
                </div>
                <label className="gk-announce-compose__switch">
                    <input type="checkbox" role="switch" className="gk-switch" checked={confirm} onChange={event => setConfirm(event.target.checked)} />
                    <span><strong>Ask parents to confirm they’ve read it</strong><span className="gk-field__hint">You’ll see who has read it and who hasn’t.</span></span>
                </label>
                {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
                {posted && <p className="gk-notice" role="status">{posted}</p>}
                <div className="gk-announce-compose__actions">
                    <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setTitle(''); setBody(''); setError(''); request.current = null; }}>Discard</Button>
                    <Button variant="primary" type="submit" disabled={busy || !title.trim() || !body.trim() || Boolean(dateProblem) || !until || !targets.length}><Megaphone aria-hidden="true" />{busy ? 'Posting…' : 'Post announcement'}</Button>
                </div>
            </form>
        </GkRoot>
    );
}
