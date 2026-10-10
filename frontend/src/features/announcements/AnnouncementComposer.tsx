import './announcements.css';
import { useRef, useState, type FormEvent } from 'react';
import { Megaphone } from 'lucide-react';
import { Button, Field, GkRoot } from '../../design/primitives';
import { ChoiceChips } from '../../design/ChoiceChips';
import { extractApiErrorMessage } from '../../utils/apiError';
import * as api from '../squadCommunication/api';
import { PIN_CHOICES, dayText, expiryFor, localDate, type PinChoice } from './pinning';

/**
 * A coach posts an announcement: separate from chat, pinned on players' and parents' Home and on this
 * page until it expires, and (when asked) each family confirms they have read it.
 */
export function AnnouncementComposer({ space, onPosted }: { space: api.SquadOverview; onPosted: () => void }) {
    const [title, setTitle] = useState(''), [body, setBody] = useState('');
    const [pin, setPin] = useState<PinChoice>('7'), [date, setDate] = useState('');
    const [confirm, setConfirm] = useState(true);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [posted, setPosted] = useState('');
    const request = useRef<{ signature: string; id: string } | null>(null);
    const sending = useRef(false);
    const now = new Date();
    const until = expiryFor(pin, date, now);
    const dateProblem = pin === 'date' && (!until || until.getTime() <= now.getTime()) ? 'Choose a day from today on.' : '';

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (sending.current || dateProblem || !until) return;
        sending.current = true; setBusy(true); setError(''); setPosted('');
        // The same announcement retried after a failure keeps its request id, so it is never posted twice.
        const signature = JSON.stringify([title, body, confirm, until.toISOString()]);
        if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
        try {
            await api.postMessage(space.id, { requestId: request.current.id, threadUserId: null, kind: 'ANNOUNCEMENT', title: title.trim(), body: body.trim(), important: confirm, expiresAt: until.toISOString() });
            setTitle(''); setBody(''); setPin('7'); setDate(''); setOpen(false); request.current = null;
            setPosted(`Posted. Pinned for ${space.name} until ${dayText(until, now)}.`);
            onPosted();
        } catch (cause) {
            setError(extractApiErrorMessage(cause, 'The announcement could not be posted. Your text is kept; try again.'));
        } finally { sending.current = false; setBusy(false); }
    }

    // Closed, the composer is one line; a half-written announcement keeps it open.
    if (!open && !title && !body) return (
        <GkRoot className="gk-announce-compose">
            {posted && <p className="gk-notice gk-announce-compose__posted" role="status">{posted}</p>}
            <button type="button" className="gk-announce-compose__open" onClick={() => { setOpen(true); setPosted(''); }}>
                <Megaphone aria-hidden="true" /><span><strong>New announcement</strong><span>Pinned on players’ and parents’ Home until it expires</span></span>
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
                <Field label="Title" htmlFor="announce-title">
                    <input id="announce-title" className="gk-input" required maxLength={140} autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="What should families know?" />
                </Field>
                <Field label="Message" htmlFor="announce-body">
                    <textarea id="announce-body" className="gk-input" required maxLength={4000} rows={4} value={body} onChange={event => setBody(event.target.value)} placeholder="Write a clear update for this squad…" />
                </Field>
                <div className="gk-field">
                    <span className="gk-field__label" id="announce-pin">Pinned until</span>
                    <ChoiceChips labelledBy="announce-pin" value={pin} onChange={setPin} choices={PIN_CHOICES.map(choice => ({ value: choice.id, label: choice.label }))} />
                    {pin === 'date' && <input aria-label="Last day pinned" className="gk-input gk-announce-compose__date" type="date" min={localDate(now)} value={date} onChange={event => setDate(event.target.value)} aria-invalid={Boolean(dateProblem) || undefined} />}
                    {dateProblem && date ? <span className="gk-field__error" role="alert">{dateProblem}</span>
                        : <span className="gk-field__hint">{until ? `Shown at the top of players’ and parents’ Home and this page until the end of ${dayText(until, now)}. It stays in the list afterwards.` : 'Choose the last day it stays pinned.'}</span>}
                </div>
                <label className="gk-announce-compose__switch">
                    <input type="checkbox" role="switch" className="gk-switch" checked={confirm} onChange={event => setConfirm(event.target.checked)} />
                    <span><strong>Ask families to confirm they’ve read it</strong><span className="gk-field__hint">You’ll see who has read it and who hasn’t.</span></span>
                </label>
                {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
                {posted && <p className="gk-notice" role="status">{posted}</p>}
                <div className="gk-announce-compose__actions">
                    <Button variant="ghost" disabled={busy} onClick={() => { setOpen(false); setTitle(''); setBody(''); setError(''); request.current = null; }}>Discard</Button>
                    <Button variant="primary" type="submit" disabled={busy || !title.trim() || !body.trim() || Boolean(dateProblem) || !until}><Megaphone aria-hidden="true" />{busy ? 'Posting…' : 'Post announcement'}</Button>
                </div>
            </form>
        </GkRoot>
    );
}
