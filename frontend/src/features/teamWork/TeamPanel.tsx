import { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { Badge, Button, Section } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addMember, fetchTeam, removeMember, type Member } from './api';

/**
 * Who sees Team work: system admins, plus the colleagues they add by email (no admin powers needed).
 * Only system admins add or remove people.
 */
export function TeamPanel({ canManage }: { canManage: boolean }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [members, setMembers] = useState<Member[] | null>(null);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        fetchTeam(controller.signal).then(list => { if (!controller.signal.aborted) setMembers(list); }).catch(() => undefined);
        return () => controller.abort();
    }, []);
    const run = async (action: () => Promise<Member[]>) => {
        setBusy(true); setError('');
        try { setMembers(await action()); setEmail(''); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be changed.', 'ვერ შეიცვალა.'))); }
        finally { setBusy(false); }
    };
    return <Section boxed title={copy('Team', 'გუნდი')} hint={copy('Who sees this page', 'ვინ ხედავს ამ გვერდს')} className="tw-team">
        <ul className="tw-team__list">{(members ?? []).map(member => <li key={member.userId}>
            <span className="tw-team__who"><strong>{member.name ?? member.email}</strong><span className="gk-muted">{member.email}</span></span>
            {member.admin ? <Badge>{copy('System admin', 'სისტემის ადმინისტრატორი')}</Badge>
                : canManage && <Button size="sm" iconOnly variant="ghost" disabled={busy} aria-label={copy(`Remove ${member.name ?? member.email} from the team`, `${member.name ?? member.email} — გუნდიდან ამოშლა`)} onClick={() => void run(() => removeMember(member.userId))}><X aria-hidden="true" /></Button>}
        </li>)}</ul>
        {canManage && <form className="tw-team__add" onSubmit={event => { event.preventDefault(); if (email.trim()) void run(() => addMember(email.trim())); }}>
            <label htmlFor={id} className="gk-visually-hidden">{copy('Add a colleague by email', 'კოლეგის დამატება ელფოსტით')}</label>
            <input id={id} className="gk-input" type="email" value={email} placeholder={copy('Colleague’s email', 'კოლეგის ელფოსტა')} onChange={event => setEmail(event.target.value)} />
            <Button size="sm" type="submit" disabled={busy || !email.trim()}>{copy('Add', 'დამატება')}</Button>
        </form>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Section>;
}
