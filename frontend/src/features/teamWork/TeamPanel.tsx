import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Copy, X } from 'lucide-react';
import { Avatar, Badge, Button, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addMember, fetchTeam, newInvite, setResponsibility, type Invite, type Member } from './api';
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

/** One line of responsibility, written in place and saved when the person leaves the box or presses Enter. */
function ResponsibilityLine({ member, onSaved }: { member: Member; onSaved: (members: Member[]) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [line, setLine] = useState(member.responsibility ?? '');
    const [error, setError] = useState('');
    const save = async () => {
        if (line.trim() === (member.responsibility ?? '')) return;
        setError('');
        try { onSaved(await setResponsibility(member.userId, line.trim())); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
    };
    return <span className="tw-team__line">
        <label htmlFor={id} className="gk-visually-hidden">{copy(`What ${member.name ?? member.email} looks after`, `რას უძღვება ${member.name ?? member.email}`)}</label>
        <input id={id} className="gk-input" maxLength={120} value={line} placeholder={copy('What they look after, e.g. Agent Dola', 'რას უძღვება, მაგ. Agent Dola')} onChange={event => setLine(event.target.value)} onBlur={() => void save()}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); (event.target as HTMLInputElement).blur(); } }} />
        {error && <span className="gk-notice gk-notice--danger" role="alert">{error}</span>}
    </span>;
}

/**
 * Who sees Team work: exactly the team's own accounts, by email (the server setting APP_TEAM_WORK_EMAILS), whatever
 * their role, each with one line saying what they look after and a way to see what they are doing. A team email
 * without an account gets one with no password and a one-time sign-up link to pass on; anyone else is refused.
 */
export function TeamPanel({ canManage }: { canManage: boolean }) {
    const copy = useJourneyCopy();
    const id = useId();
    const [members, setMembers] = useState<Member[] | null>(null);
    const [loadError, setLoadError] = useState('');
    const [retry, setRetry] = useState(0);
    const [invite, setInvite] = useState<Invite | null>(null);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        fetchTeam(controller.signal).then(list => { if (!controller.signal.aborted) { setMembers(list); setLoadError(''); } })
            .catch(failure => { if (!controller.signal.aborted) setLoadError(extractApiErrorMessage(failure, copy('The team could not load.', 'გუნდი ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [retry, copy]);
    const run = async (action: () => Promise<void>) => {
        setBusy(true); setError('');
        try { await action(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be done.', 'ვერ მოხერხდა.'))); }
        finally { setBusy(false); }
    };
    return <div className="tw-team">
        <PageHeader title={copy('Team', 'გუნდი')} subtitle={copy('Who looks after what; only these accounts see Team work', 'ვინ რას უძღვება; გუნდის სამუშაოს მხოლოდ ეს ანგარიშები ხედავს')} />
        {loadError && <div className="gk-notice gk-notice--danger" role="alert"><span>{loadError}</span><Button size="sm" onClick={() => setRetry(value => value + 1)}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
        <Panel>
        {members == null && !loadError && <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={44} /><Skeleton height={44} /></div>}
        <ul className="tw-team__list">{(members ?? []).map(member => <li key={member.userId}>
            <span className="tw-team__who"><Avatar name={member.name ?? member.email} size={28} /><strong>{member.name ?? member.email}</strong><span className="gk-muted">{member.email}</span>
                {member.pending && <Badge tone="warning">{copy('Invited', 'მოწვეული')}</Badge>}</span>
            <ResponsibilityLine key={member.responsibility ?? ''} member={member} onSaved={setMembers} />
            <Link className="tw-team__doing" to={`/team-work?who=${member.userId}`}>{copy(`What ${(member.name ?? member.email).split(' ')[0]} is doing`, `რას აკეთებს ${(member.name ?? member.email).split(' ')[0]}`)}<ChevronRight aria-hidden="true" /></Link>
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
        {canManage && <p className="gk-faint tw-team__hint">{copy('Only the team’s own emails (APP_TEAM_WORK_EMAILS) can be added; each gets a one-time sign-up link.',
            'დამატება მხოლოდ გუნდის ელფოსტებს შეუძლია (APP_TEAM_WORK_EMAILS); თითოეული ერთჯერად ბმულს იღებს.')}</p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </Panel>
    </div>;
}
