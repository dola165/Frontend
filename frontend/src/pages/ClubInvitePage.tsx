import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Avatar, Button, Field, GkRoot } from '../design/primitives';
import { useAuth } from '../context/AuthContext';
import { isMinor } from '../utils/age';
import { otherClubOf } from '../features/clubOperations/leaving/api';
import { OtherClubNotice } from '../features/clubOperations/leaving/OtherClubNotice';
import { confirmationJobTitle, needsConfirmedEmail, sendEmailConfirmation } from '../components/auth/emailConfirmation';
import { useJobWords } from '../features/clubOperations/people/jobWords';
import { acceptClubInvite, claimClubInvite, declineClubInvite, landingFor, previewClubInvite, signInAfterClaim, type ClubInvitePreview, type LinkInvite } from '../features/clubOperations/people/inviteLinkApi';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../utils/apiError';
import { buildLoginPath } from '../utils/authRedirect';
import '../features/clubOperations/people/club-invite.css';

type Stage = { kind: 'loading' } | { kind: 'broken'; message: string } | { kind: 'ready'; preview: ClubInvitePreview } | { kind: 'declined' } | { kind: 'partly'; failures: string[]; next: string; waitsOnEmail: string | null; other: { clubId: number; name: string } | null; blocked: LinkInvite[] };

/**
 * The page a club invite link opens: "Nino invited you: Assistant coach · U12" with the club's crest. The person
 * chooses their own password, gives their name and date of birth, and accepts or declines. Accepting signs them in
 * and accepts each job the normal way, so the club's age and verification rules still decide.
 */
export function ClubInvitePage() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    return <ClubInvite key={token} token={token} />;
}

function ClubInvite({ token }: { token: string }) {
    const id = useId();
    const navigate = useNavigate();
    const { loginWithAccessToken } = useAuth();
    const { copy, jobLabel, whereLabel } = useJobWords();
    const [stage, setStage] = useState<Stage>({ kind: 'loading' });
    const [name, setName] = useState(''), [birth, setBirth] = useState(''), [password, setPassword] = useState(''), [again, setAgain] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmDecline, setConfirmDecline] = useState(false);
    const sending = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        if (!token) { setStage({ kind: 'broken', message: copy('This link is missing its code. Ask the club for a new one.', 'ბმულს კოდი აკლია. სთხოვეთ კლუბს ახალი.') }); return () => controller.abort(); }
        previewClubInvite(token, controller.signal).then(preview => { if (!controller.signal.aborted) { setStage({ kind: 'ready', preview }); setName(preview.invitedName ?? ''); } })
            .catch(failure => { if (!controller.signal.aborted) setStage({ kind: 'broken', message: extractApiErrorMessage(failure, copy('This invitation link doesn’t work any more. Ask the club for a new one.', 'ეს ბმული აღარ მუშაობს. სთხოვეთ კლუბს ახალი.')) }); });
        return () => controller.abort();
    }, [token, copy]);

    const accept = async (preview: ClubInvitePreview) => {
        if (sending.current) return;
        if (name.trim().length < 2) { setError(copy('Enter your name.', 'შეიყვანეთ სახელი.')); return; }
        if (!birth) { setError(copy('Enter your date of birth.', 'შეიყვანეთ დაბადების თარიღი.')); return; }
        // Club jobs are for adults (26 October); the server refuses too, this says so before an account is made.
        if (isMinor(birth)) { setError(copy('Club jobs are for adults (18+).', 'კლუბში სამუშაო მხოლოდ სრულწლოვნებისთვისაა (18+).')); return; }
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) { setError(copy('Your password needs 8 characters with an upper-case letter, a lower-case letter and a digit.', 'პაროლს სჭირდება 8 სიმბოლო, დიდი და პატარა ასო და ციფრი.')); return; }
        if (password !== again) { setError(copy('The two passwords are different.', 'პაროლები არ ემთხვევა.')); return; }
        sending.current = true; setBusy(true); setError('');
        try {
            const { email } = await claimClubInvite({ token, name: name.trim(), dateOfBirth: birth, password });
            // The link is used from here on: if signing in fails now, the account exists, so the person signs in
            // normally (the job waits in their notifications) instead of trying the used link again.
            const accessToken = await signInAfterClaim(email, password)
                .then(async found => { if (found) await loginWithAccessToken(found); return found; })
                .catch(() => null);
            if (!accessToken) { navigate(buildLoginPath('/notifications'), { replace: true }); return; }
            await acceptAll(preview.invites.filter(i => !i.unavailableReason));
        } catch (failure) {
            setError(extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ თავიდან.')));
        } finally { sending.current = false; setBusy(false); }
    };
    /** Accepts each job the normal way; also the retry once the person has left the club they were staff at. */
    const acceptAll = async (invites: LinkInvite[]) => {
        const failures: string[] = [], accepted: LinkInvite[] = [], blocked: LinkInvite[] = [];
        let waitsOnEmail: string | null = null, other: { clubId: number; name: string } | null = null;
        for (const invite of invites) {
            try { await acceptClubInvite(invite); accepted.push(invite); }
            catch (failure) {
                const club = otherClubOf(failure);
                // A new account confirms its email before starting a job; the job waits in the notifications meanwhile.
                if (needsConfirmedEmail(failure)) waitsOnEmail ??= confirmationJobTitle(failure) ?? jobLabel(invite);
                // Staff means one club: "Leave {club} first", then these are accepted again.
                else if (club) { other ??= club; blocked.push(invite); }
                else failures.push(`${jobLabel(invite)}: ${extractApiErrorMessage(failure, copy('it couldn’t be accepted.', 'ვერ მიიღეს.'))}`);
            }
        }
        const next = !accepted.length && (waitsOnEmail || other) ? '/notifications' : landingFor(accepted);
        if (failures.length || waitsOnEmail || other) setStage({ kind: 'partly', failures, next, waitsOnEmail, other, blocked });
        else navigate(next, { replace: true });
    };
    const decline = async () => {
        if (sending.current) return;
        sending.current = true; setBusy(true); setError('');
        try { await declineClubInvite(token); setStage({ kind: 'declined' }); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ თავიდან.'))); }
        finally { sending.current = false; setBusy(false); setConfirmDecline(false); }
    };

    const card = (children: React.ReactNode) => <GkRoot className="ci-page"><main className="ci-card">{children}</main></GkRoot>;
    if (stage.kind === 'loading') return card(<p role="status" className="gk-muted">{copy('Opening your invitation…', 'მოწვევა იხსნება…')}</p>);
    if (stage.kind === 'broken') return card(<>
        <h1 className="ci-title">{copy('This link can’t be used', 'ამ ბმულის გამოყენება შეუძლებელია')}</h1>
        <p role="alert" className="gk-notice gk-notice--danger">{stage.message}</p>
        <Link className="gk-btn gk-btn--secondary" to={buildLoginPath('/notifications')}>{copy('Sign in', 'შესვლა')}</Link>
    </>);
    if (stage.kind === 'declined') return card(<>
        <h1 className="ci-title">{copy('You declined', 'უარი თქვით')}</h1>
        <p className="gk-muted">{copy('The club has been told. Nothing was set up for you.', 'კლუბს ეცნობა. თქვენთვის არაფერი შექმნილა.')}</p>
    </>);
    if (stage.kind === 'partly') return card(<>
        <h1 className="ci-title">{copy('Your account is ready', 'თქვენი ანგარიში მზადაა')}</h1>
        {stage.other && <OtherClubNotice club={stage.other} onLeft={() => void acceptAll(stage.blocked)} />}
        {stage.waitsOnEmail && <EmailWait job={stage.waitsOnEmail} />}
        {stage.failures.length > 0 && <div role="alert" className="gk-notice gk-notice--warning"><ul className="ci-failures">{stage.failures.map(f => <li key={f}>{f}</li>)}</ul></div>}
        <Button variant="primary" onClick={() => navigate(stage.next, { replace: true })}>{copy('Continue', 'გაგრძელება')}</Button>
    </>);

    const { preview } = stage;
    const first = preview.invites[0];
    const inviter = first?.invitedBy ?? copy('The club', 'კლუბი');
    const allBlocked = preview.invites.length > 0 && preview.invites.every(i => i.unavailableReason);
    return card(<>
        <header className="ci-head">
            {first ? <Avatar src={resolveMediaUrl(first.clubLogoUrl) || null} name={first.clubName} size={64} square /> : <ShieldCheck aria-hidden="true" />}
            <div>
                <p className="gk-muted ci-club">{[...new Set(preview.invites.map(i => i.clubName))].join(' · ')}</p>
                <h1 className="ci-title">{copy(`${inviter} invited you`, `${inviter} გიწვევთ`)}</h1>
            </div>
        </header>
        <ul className="ci-jobs">{preview.invites.map(invite => <li key={`${invite.kind}-${invite.id}`} className="ci-job">
            <strong>{jobLabel(invite)} · {whereLabel({ clubWide: invite.clubWide, squads: invite.squads.map((squad, index) => ({ id: index, name: squad })) })}</strong>
            {invite.unavailableReason && <span className="gk-faint">{invite.unavailableReason}</span>}
        </li>)}</ul>
        {!preview.invites.length && <p className="gk-notice">{copy('Nothing is waiting for you here any more. Ask the club to invite you again.', 'აქ აღარაფერი გელოდებათ. სთხოვეთ კლუბს ხელახლა მოწვევა.')}</p>}
        {preview.hasPassword ? <>
            <p className="gk-muted">{copy('You already have an account. Sign in and answer the invitation in your notifications.', 'ანგარიში უკვე გაქვთ. შედით და უპასუხეთ მოწვევას შეტყობინებებში.')}</p>
            <Link className="gk-btn gk-btn--primary" to={buildLoginPath('/notifications')}>{copy('Sign in', 'შესვლა')}</Link>
        </> : preview.invites.length > 0 && !allBlocked && <form className="ci-form" onSubmit={event => { event.preventDefault(); void accept(preview); }}>
            <p className="gk-faint ci-email">{copy(`Your account: ${preview.email}`, `თქვენი ანგარიში: ${preview.email}`)}</p>
            <Field label={copy('Your name', 'თქვენი სახელი')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" autoComplete="name" maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></Field>
            <Field label={copy('Date of birth', 'დაბადების თარიღი')} hint={copy('Club jobs are for adults (18 or older).', 'კლუბის სამუშაო მხოლოდ სრულწლოვნებისთვისაა (18+).')} htmlFor={`${id}-birth`}>
                <input id={`${id}-birth`} className="gk-input" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={birth} disabled={busy} onChange={event => setBirth(event.target.value)} /></Field>
            <Field label={copy('Choose a password', 'აირჩიეთ პაროლი')} hint={copy('8 or more characters, with an upper-case letter, a lower-case letter and a digit. Only you know it.', '8+ სიმბოლო, დიდი და პატარა ასო და ციფრი. მას მხოლოდ თქვენ იცნობთ.')} htmlFor={`${id}-password`}>
                <input id={`${id}-password`} className="gk-input" type="password" autoComplete="new-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></Field>
            <Field label={copy('Password again', 'გაიმეორეთ პაროლი')} htmlFor={`${id}-again`}>
                <input id={`${id}-again`} className="gk-input" type="password" autoComplete="new-password" value={again} disabled={busy} onChange={event => setAgain(event.target.value)} /></Field>
            {error && <p role="alert" className="gk-notice gk-notice--danger">{error}</p>}
            <div className="ci-actions">
                <Button type="submit" variant="primary" disabled={busy}>{busy ? copy('Accepting…', 'მიმდინარეობს…') : copy('Accept', 'მიღება')}</Button>
                {confirmDecline ? <span className="ci-decline" role="group" aria-label={copy('Decline the invitation?', 'უარი ეთქვას მოწვევას?')}>
                    <span className="gk-muted">{copy('Decline?', 'უარი?')}</span>
                    <Button variant="danger" disabled={busy} onClick={() => void decline()}>{copy('Yes, decline', 'დიახ, უარი')}</Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setConfirmDecline(false)}>{copy('No', 'არა')}</Button>
                </span> : <Button variant="ghost" disabled={busy} onClick={() => setConfirmDecline(true)}>{copy('Decline', 'უარი')}</Button>}
            </div>
        </form>}
        {allBlocked && <p className="gk-muted">{copy(`Ask ${inviter} for a new invitation.`, `სთხოვეთ ${inviter}-ს ახალი მოწვევა.`)}</p>}
    </>);
}

/** "Confirm your email to start as Assistant coach", with Resend: a new account confirms before its job starts. */
function EmailWait({ job }: { job: string }) {
    const { copy } = useJobWords();
    const [sent, setSent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
    const resend = () => { setSent('sending'); sendEmailConfirmation().then(() => setSent('sent'), () => setSent('failed')); };
    return <div role="status" className="gk-notice gk-notice--warning ci-email-wait">
        <span><strong>{copy(`Confirm your email to start as ${job}`, `დაადასტურეთ ელფოსტა და დაიწყეთ, როგორც ${job}`)}</strong>
            <small>{sent === 'sent' ? copy('Sent. Open the link, then accept the job in your notifications.', 'გაიგზავნა. გახსენით ბმული და მიიღეთ სამუშაო შეტყობინებებში.')
                : sent === 'failed' ? copy('That did not send. Try again.', 'ვერ გაიგზავნა. სცადეთ ხელახლა.')
                    : copy('Open the link we sent, then accept the job in your notifications.', 'გახსენით გამოგზავნილი ბმული და მიიღეთ სამუშაო შეტყობინებებში.')}</small></span>
        {sent !== 'sent' && <Button size="sm" disabled={sent === 'sending'} onClick={resend}>{copy('Resend', 'ხელახლა გაგზავნა')}</Button>}
    </div>;
}
