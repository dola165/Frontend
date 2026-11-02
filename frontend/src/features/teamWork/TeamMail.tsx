import { useEffect, useId, useState } from 'react';
import { Check, Mail } from 'lucide-react';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchMail, removeMail, setMail, type Mail as MailState } from './api';
import './team-work-mail.css';

/** A teammate whose notices also reach an inbox they confirmed: an envelope after their name. */
export function MailMark() {
    const copy = useJourneyCopy();
    const label = copy('Gets notices by email', 'შეტყობინებებს ელფოსტითაც იღებს');
    return <span className="tw-mail-mark" role="img" aria-label={label} title={label}><Mail aria-hidden="true" /></span>;
}

/**
 * Your own inbox for notices, on your row of the team (the team signs in with admin.* accounts that aren't real
 * inboxes). Type it and a link goes there; once it's opened, notices that need you are emailed there too. Only you
 * see the address; teammates see the envelope.
 */
export function MyInbox({ onChanged }: { onChanged: () => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [mail, setState] = useState<MailState | null>(null);
    const [editing, setEditing] = useState(false);
    const [address, setAddress] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetchMail(controller.signal).then(next => { if (!controller.signal.aborted) setState(next); }).catch(() => undefined);
        return () => controller.abort();
    }, []);
    if (!mail) return null;
    const run = async (action: () => Promise<MailState>) => {
        setBusy(true); setError('');
        try { setState(await action()); setEditing(false); onChanged(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be done.', 'ვერ მოხერხდა.'))); }
        finally { setBusy(false); }
    };
    const send = () => { if (address.trim()) void run(() => setMail(address.trim())); };
    let line;
    if (!mail.address || editing) line = <form className="tw-mail__form" onSubmit={event => { event.preventDefault(); send(); }}>
        <label htmlFor={id} className="gk-visually-hidden">{copy('Your own inbox for notices', 'თქვენი ელფოსტა შეტყობინებებისთვის')}</label>
        <input id={id} className="gk-input" type="email" autoComplete="email" value={address} placeholder="your.name@gmail.com" onChange={event => setAddress(event.target.value)} autoFocus={editing} />
        <Button size="sm" variant="primary" type="submit" disabled={busy || !address.trim()}>{copy('Email me here', 'აქ მომწერეთ')}</Button>
        {editing && <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{copy('Cancel', 'გაუქმება')}</Button>}
    </form>;
    else if (!mail.confirmed) line = <span className="tw-mail__state" data-state="waiting">
        <span className="tw-mail__dot" aria-hidden="true" />
        <span className="tw-mail__text">{copy('Open the link we sent to', 'გახსენით ბმული, რომელიც გავგზავნეთ:')} <strong>{mail.address}</strong></span>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => setMail(mail.address!))}>{copy('Send again', 'ხელახლა გაგზავნა')}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setAddress(mail.address ?? ''); setEditing(true); }}>{copy('Change', 'შეცვლა')}</Button>
    </span>;
    else line = <span className="tw-mail__state" data-state="on">
        <Check className="tw-mail__check" aria-hidden="true" />
        <span className="tw-mail__text">{copy('Notices also go to', 'შეტყობინებები ასევე მოდის:')} <strong>{mail.address}</strong></span>
        <Button size="sm" variant="ghost" onClick={() => { setAddress(mail.address ?? ''); setEditing(true); }}>{copy('Change', 'შეცვლა')}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(removeMail)}>{copy('Stop', 'გამორთვა')}</Button>
    </span>;
    return <div className="tw-mail">
        <Mail className="tw-mail__icon" aria-hidden="true" />
        {line}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
