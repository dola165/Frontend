import { useEffect, useId, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { Badge, Button, Section } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addMember, fetchTeam, newInvite, type Invite, type Member } from './api';
import { shortDate } from './teamWorkWords';

const linkOf = (invite: Invite) => `${window.location.origin}/reset-password?token=${encodeURIComponent(invite.token)}`;

/** The one-time link for a new colleague, shown once to whoever passes it on. */
function InviteLink({ invite, onDone }: { invite: Invite; onDone: () => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [copied, setCopied] = useState(false);
    const link = linkOf(invite);
    return <div className="tw-invite" role="status">
        <label htmlFor={id}>{copy(`Sign-up link for ${invite.email}`, `რეგისტრაციის ბმული: ${invite.email}`)}</label>
        <div className="tw-invite__row">
            <input id={id} className="gk-input gk-num" readOnly value={link} onFocus={event => event.target.select()} />
            <Button size="sm" variant="primary" onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopied(true))}><Copy aria-hidden="true" />{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy', 'კოპირება')}</Button>
            <Button size="sm" iconOnly variant="ghost" aria-label={copy('Hide the link', 'ბმულის დამალვა')} onClick={onDone}><X aria-hidden="true" /></Button>
        </div>
        <p className="gk-faint">{copy(`Works once, until ${shortDate(copy, new Date(invite.expiresAt))}. They choose their own password; nobody else sees it. It is shown only now.`,
            `მუშაობს ერთხელ, ${shortDate(copy, new Date(invite.expiresAt))}-მდე. პაროლს თავად ირჩევს და მას სხვა ვერავინ ხედავს. ბმული მხოლოდ ახლა ჩანს.`)}</p>
    </div>;
}

/**
 * Who sees Team work: exactly the team's own accounts, by email (the server setting APP_TEAM_WORK_EMAILS), whatever
 * their role. A team email without an account gets one with no password and a one-time sign-up link to pass on;
 * anyone else is refused. Nobody is added or removed by hand here.
 */
export function TeamPanel({ canManage }: { canManage: boolean }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [members, setMembers] = useState<Member[] | null>(null);
    const [invite, setInvite] = useState<Invite | null>(null);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        fetchTeam(controller.signal).then(list => { if (!controller.signal.aborted) setMembers(list); }).catch(() => undefined);
        return () => controller.abort();
    }, []);
    const run = async (action: () => Promise<void>) => {
        setBusy(true); setError('');
        try { await action(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be done.', 'ვერ მოხერხდა.'))); }
        finally { setBusy(false); }
    };
    return <Section boxed title={copy('Team', 'გუნდი')} hint={copy('Only the team’s own accounts see this page', 'ამ გვერდს მხოლოდ გუნდის ანგარიშები ხედავს')} className="tw-team">
        <ul className="tw-team__list">{(members ?? []).map(member => <li key={member.userId}>
            <span className="tw-team__who"><strong>{member.name ?? member.email}</strong><span className="gk-muted">{member.email}</span>
                {member.pending && <Badge tone="warning">{copy('Invited', 'მოწვეული')}</Badge>}</span>
            {canManage && member.pending && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => setInvite(await newInvite(member.userId)))}>{copy('New link', 'ახალი ბმული')}</Button>}
        </li>)}</ul>
        {invite && <InviteLink invite={invite} onDone={() => setInvite(null)} />}
        {canManage && <form className="tw-team__add" onSubmit={event => {
            event.preventDefault();
            if (email.trim()) void run(async () => { const change = await addMember(email.trim()); setMembers(change.members); setInvite(change.invite); setEmail(''); });
        }}>
            <label htmlFor={id} className="gk-visually-hidden">{copy('A team email without an account', 'გუნდის ელფოსტა ანგარიშის გარეშე')}</label>
            <input id={id} className="gk-input" type="email" value={email} placeholder="admin.name@talanti.ge" onChange={event => setEmail(event.target.value)} />
            <Button size="sm" type="submit" disabled={busy || !email.trim()}>{copy('Make account and link', 'ანგარიში და ბმული')}</Button>
        </form>}
        <p className="gk-faint tw-team__hint">{copy('Only the team’s own emails work here (the server setting APP_TEAM_WORK_EMAILS); being an admin adds no one. One without an account gets it, with a one-time sign-up link.',
            'აქ მხოლოდ გუნდის ელფოსტები მუშაობს (სერვერის პარამეტრი APP_TEAM_WORK_EMAILS); ადმინის როლი არავის ამატებს. ანგარიშის არმქონეს შეექმნება ანგარიში და ერთჯერადი ბმული.')}</p>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Section>;
}
