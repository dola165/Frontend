import { useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, ButtonLink, GkRoot } from '../design/primitives';
import { useAuth } from '../context/AuthContext';
import { Crest } from '../features/world/Crest';
import { useJobWords } from '../features/clubOperations/people/jobWords';
import { joinStaffInvite, previewStaffInvite, sendStaffInviteCode, type StaffInviteJoined, type StaffInvitePreview } from '../features/clubOperations/people/inviteLinkApi';
import { promptEmailConfirmation } from '../components/auth/emailConfirmationPrompt';
import { useAdultOnly } from '../hooks/useAdultOnly';
import { useOtherClub } from '../features/clubOperations/leaving/useOtherClub';
import { AdultOnlyNote } from '../components/access/AdultOnlyNote';
import { refreshAccess } from '../hooks/useCan';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import { buildLoginRedirectPath, buildSignupPath } from '../utils/authRedirect';
import { formatDate } from '../utils/formatting';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/clubOperations/people/club-invite.css';

type Stage = { kind: 'loading' } | { kind: 'broken'; message: string } | { kind: 'ready'; preview: StaffInvitePreview };

/**
 * Where a staff link or its QR code leads (`/staff-invite/:code`): the club's crest, the one job it gives, who it is
 * for, and one button. Signed out, sign in or create an account and come straight back; signed in, Join: with a code
 * sent to the email the link names, or the phone the club has for them. Nothing opens until an Owner or Admin says yes:
 * they are told, and the person then has My squads (a squad job) or the club's workspace.
 */
export function StaffLinkPage() {
    const { code = '' } = useParams<{ code: string }>();
    return <StaffLink key={code} code={code} />;
}

function StaffLink({ code }: { code: string }) {
    const navigate = useNavigate();
    const location = useLocation();
    const id = useId();
    const { isAuthenticated, isBootstrapping, refreshNavigationCapabilities } = useAuth();
    const { copy, jobLabel } = useJobWords();
    const adult = useAdultOnly('job');
    const other = useOtherClub();
    const [stage, setStage] = useState<Stage>({ kind: 'loading' });
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [needsCode, setNeedsCode] = useState(false), [proofCode, setProofCode] = useState(''), [phone, setPhone] = useState('');
    const [joined, setJoined] = useState<StaffInviteJoined | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        previewStaffInvite(code, controller.signal).then(preview => { if (!controller.signal.aborted) setStage({ kind: 'ready', preview }); })
            .catch(failure => { if (!controller.signal.aborted) setStage({ kind: 'broken', message: extractApiErrorMessage(failure, copy('This staff link doesn’t work any more. Ask the club’s admin for a new one.', 'ეს ბმული აღარ მუშაობს. სთხოვეთ კლუბის ადმინს ახალი.')) }); });
        return () => controller.abort();
    }, [code, copy]);
    const landing = (preview: StaffInvitePreview, result: StaffInviteJoined) => !preview.clubWide && result.squads.length ? '/my-squads' : `/clubs/${result.clubId}/office`;
    const askForCode = async () => {
        try { await sendStaffInviteCode(code); setError(''); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('We couldn’t send the code. Try again.', 'კოდი ვერ გაიგზავნა. სცადეთ ხელახლა.'))); }
    };
    const join = async (preview: StaffInvitePreview) => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            const result = await joinStaffInvite(code, needsCode ? { code: proofCode.trim() } : preview.proof?.by === 'PHONE' ? { phone: phone.trim() } : undefined);
            refreshAccess();
            await refreshNavigationCapabilities().catch(() => undefined);
            if (result.waitingForYes) { setJoined(result); setBusy(false); return; }
            navigate(landing(preview, result), { replace: true });
        } catch (failure) {
            const problem = extractApiErrorCode(failure);
            if (problem === 'STAFF_LINK_CODE_NEEDED') { setNeedsCode(true); await askForCode(); setBusy(false); return; }
            // "Confirm your email to start as Assistant coach", with Resend, when the server waits on the email.
            // Staff means one club: "Leave {club} first", then Join again.
            if (!other.catchOther(failure, () => void join(preview)) && !promptEmailConfirmation(failure))
                setError(extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ თავიდან.')));
            setBusy(false);
        }
    };

    const card = (children: React.ReactNode) => <GkRoot className="ci-page"><main className="ci-card">{children}</main></GkRoot>;
    if (stage.kind === 'loading' || isBootstrapping) return card(<p role="status" className="gk-muted">{copy('Opening the link…', 'ბმული იხსნება…')}</p>);
    if (stage.kind === 'broken') return card(<>
        <h1 className="ci-title">{copy('This link can’t be used', 'ამ ბმულის გამოყენება შეუძლებელია')}</h1>
        <p role="alert" className="gk-notice gk-notice--danger">{stage.message}</p>
        <Link to="/home">{copy('Go to GrassKickZ', 'GrassKickZ-ზე გადასვლა')}</Link>
    </>);
    const { preview } = stage;
    const job = jobLabel(preview);
    const where = preview.clubWide ? copy('Whole club', 'მთელი კლუბი') : preview.squads.join(', ');
    if (joined) return card(<>
        <div className="ci-head">
            <Crest src={resolveMediaUrl(preview.clubLogoUrl) || null} name={preview.clubName} size={48} />
            <p className="ci-club gk-muted">{preview.clubName}</p>
        </div>
        <h1 className="ci-title">{copy(`You’re ${job}`, `თქვენ ხართ: ${job}`)}</h1>
        <ul className="ci-jobs"><li className="ci-job"><strong>{job}</strong><span className="gk-muted">{where}</span></li></ul>
        <p className="gk-notice gk-notice--info" role="status">{copy('Your squad opens when the club’s admin says yes. We’ll tell you.', 'თქვენი გუნდი გაიხსნება, როცა კლუბის ადმინი დაგთანხმდებათ. შეგატყობინებთ.')}</p>
        <div className="ci-actions"><ButtonLink variant="primary" to="/home" replace>{copy('Go to GrassKickZ', 'GrassKickZ-ზე გადასვლა')}</ButtonLink></div>
    </>);
    const closed = preview.status === 'EXPIRED' ? copy('This link has expired. Ask the club’s admin for a new one.', 'ბმულს ვადა გაუვიდა. სთხოვეთ კლუბის ადმინს ახალი.')
        : preview.status === 'USED_UP' ? copy('This link has been used. Ask the club’s admin for a new one.', 'ბმული უკვე გამოყენებულია. სთხოვეთ კლუბის ადმინს ახალი.')
            : preview.status === 'REVOKED' ? copy('This link was switched off. Ask the club’s admin for a new one.', 'ბმული გაითიშა. სთხოვეთ კლუბის ადმინს ახალი.') : null;
    const proofMissing = needsCode ? !/^\d{6}$/.test(proofCode.trim()) : preview.proof?.by === 'PHONE' && !phone.trim();
    return card(<>
        <div className="ci-head">
            <Crest src={resolveMediaUrl(preview.clubLogoUrl) || null} name={preview.clubName} size={48} />
            <p className="ci-club gk-muted">{preview.clubName}</p>
        </div>
        <h1 className="ci-title">{preview.invitedBy ? copy(`${preview.invitedBy} invited you: ${job}`, `${preview.invitedBy} გიწვევთ: ${job}`) : copy(`Join as ${job}`, `შემოუერთდით: ${job}`)}</h1>
        <ul className="ci-jobs"><li className="ci-job"><strong>{job}</strong><span className="gk-muted">{where}</span></li></ul>
        {preview.invitedName && <p className="ci-email">{copy(`This link is for ${preview.invitedName}.`, `ეს ბმული განკუთვნილია: ${preview.invitedName}.`)}</p>}
        {closed ? <p role="alert" className="gk-notice gk-notice--warning">{closed}</p> : <>
            <p className="ci-email gk-faint">{copy(`Works until ${formatDate(preview.expiresAt, { day: 'numeric', month: 'short' })}`, `მოქმედებს ${formatDate(preview.expiresAt, { day: 'numeric', month: 'short' })}-მდე`)}</p>
            {isAuthenticated && adult.allowed && needsCode && <div className="gk-field">
                <label className="gk-field__label" htmlFor={`${id}-code`}>{copy(`The 6-digit code we emailed to ${preview.proof?.email ?? 'them'}`, `6-ნიშნა კოდი, რომელიც გავუგზავნეთ: ${preview.proof?.email ?? ''}`)}</label>
                <input id={`${id}-code`} className="gk-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={proofCode} disabled={busy} onChange={event => setProofCode(event.target.value)} />
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void askForCode()}>{copy('Send it again', 'ხელახლა გაგზავნა')}</Button>
            </div>}
            {isAuthenticated && adult.allowed && preview.proof?.by === 'PHONE' && <div className="gk-field">
                <label className="gk-field__label" htmlFor={`${id}-phone`}>{copy('Your phone number, the one the club has', 'თქვენი ტელეფონის ნომერი, რომელიც კლუბს აქვს')}</label>
                <input id={`${id}-phone`} className="gk-input" inputMode="tel" autoComplete="tel" maxLength={32} value={phone} disabled={busy} onChange={event => setPhone(event.target.value)} />
            </div>}
            {error && <p role="alert" className="gk-notice gk-notice--danger">{error}</p>}
            {other.notice}
            <div className="ci-actions">{isAuthenticated && !adult.allowed ? <AdultOnlyNote adult={adult} />
                : isAuthenticated ? <Button variant="primary" disabled={busy || proofMissing} onClick={() => void join(preview)}>{busy ? copy('Joining…', 'შემოდიხართ…') : copy(`Join as ${job}`, `შემოსვლა: ${job}`)}</Button>
                : <>
                    <ButtonLink variant="primary" to={buildLoginRedirectPath(location.pathname, location.search)}>{copy('Sign in', 'შესვლა')}</ButtonLink>
                    <ButtonLink to={buildSignupPath(`${location.pathname}${location.search}`)}>{copy('Create an account', 'ანგარიშის შექმნა')}</ButtonLink>
                </>}</div>
        </>}
    </>);
}
