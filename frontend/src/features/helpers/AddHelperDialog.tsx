import { useId, useRef, useState, type FormEvent } from 'react';
import { Button, Chip, Field } from '../../design/primitives';
import { Dialog } from '../../design/Dialog';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/formatting';
import { useCopy } from '../../locales/useCopy';
import { mySquadsEn } from '../../locales/mySquadsDesign';
import { InviteLinkBox } from '../clubOperations/people/InviteLinkBox';
import { addHelper, type AddedHelper } from './api';
import './helpers.css';

/**
 * Add a helper to a session (decision 3): this date, or every date of a repeating session; who, by name and email.
 * It takes effect at once. Someone new gets a one-time link the coach sends by email or WhatsApp; adults only.
 */
export function AddHelperDialog({ squad, squadName, session, onClose, onAdded }: {
    squad: number; squadName: string; session: { id: number; title: string; starts_at: string; series_id?: string | null }; onClose: () => void; onAdded: () => void;
}) {
    const copy = useCopy('mySquads', mySquadsEn);
    const id = useId();
    const requestId = useRef(crypto.randomUUID());
    const [repeating, setRepeating] = useState(Boolean(session.series_id));
    const [name, setName] = useState(''), [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [added, setAdded] = useState<AddedHelper | null>(null);
    const weekday = formatDate(session.starts_at, { weekday: 'long' }), time = formatDate(session.starts_at, { hour: '2-digit', minute: '2-digit' });
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError('');
        try { setAdded(await addHelper(squad, session.id, { name: name.trim(), email: email.trim(), repeating, requestId: requestId.current })); onAdded(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('helperFailed'))); }
        finally { setBusy(false); }
    };
    if (added) return <Dialog open size="md" title={copy('helperAdded', { name: added.name })} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>{copy('done')}</Button>}>
        {added.link
            ? <InviteLinkBox name={added.name} link={{ token: added.link, expiresAt: added.linkExpiresAt ?? new Date().toISOString() }} message={copy('helperLinkMessage', { squad: squadName, time: `${weekday} ${time}` })} />
            : <p className="hp-note">{copy('helperSeesHome', { name: added.name })}</p>}
    </Dialog>;
    return <Dialog open size="md" title={copy('addHelper')} description={`${session.title} · ${squadName}`} onClose={onClose}
        footer={<><Button onClick={onClose}>{copy('cancel')}</Button><Button variant="primary" type="submit" form={id} disabled={busy}>{copy('addHelper')}</Button></>}>
        <form id={id} className="gk-stack" onSubmit={event => void submit(event)}>
            {session.series_id && <div className="hp-chips" role="group" aria-label={copy('sessionLabel')}>
                <Chip pressed={repeating} onClick={() => setRepeating(true)}>{copy('everyWeek', { day: weekday, time })}</Chip>
                <Chip pressed={!repeating} onClick={() => setRepeating(false)}>{copy('onlyThisDate', { day: weekday })}</Chip>
            </div>}
            <Field label={copy('name')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" required maxLength={120} autoComplete="off" value={name} onChange={e => setName(e.target.value)} /></Field>
            <Field label={copy('email')} htmlFor={`${id}-email`}><input id={`${id}-email`} className="gk-input" type="email" required maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <p className="hp-note">{copy('helperNote')}</p>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </form>
    </Dialog>;
}
