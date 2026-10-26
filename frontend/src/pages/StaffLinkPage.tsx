import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, ButtonLink, GkRoot } from '../design/primitives';
import { useAuth } from '../context/AuthContext';
import { Crest } from '../features/world/Crest';
import { useJobWords } from '../features/clubOperations/people/jobWords';
import { joinStaffInvite, previewStaffInvite, type StaffInvitePreview } from '../features/clubOperations/people/inviteLinkApi';
import { promptEmailConfirmation } from '../components/auth/emailConfirmationPrompt';
import { useAdultOnly } from '../hooks/useAdultOnly';
import { refreshAccess } from '../hooks/useCan';
import { extractApiErrorMessage } from '../utils/apiError';
import { buildLoginRedirectPath, buildSignupPath } from '../utils/authRedirect';
import { formatDate } from '../utils/formatting';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/clubOperations/people/club-invite.css';

type Stage = { kind: 'loading' } | { kind: 'broken'; message: string } | { kind: 'ready'; preview: StaffInvitePreview };

/**
 * Where a staff link or its QR code leads (`/staff-invite/:code`): the club's crest, the one job it gives and where,
 * and one button. Signed out, sign in or create an account and come straight back; signed in, Join: the job starts at
 * once and the person lands in My squads (a squad job) or the club's workspace.
 */
export function StaffLinkPage() {
    const { code = '' } = useParams<{ code: string }>();
    return <StaffLink key={code} code={code} />;
}

function StaffLink({ code }: { code: string }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isBootstrapping, refreshNavigationCapabilities } = useAuth();
    const { copy, jobName } = useJobWords();
    const adult = useAdultOnly('job');
    const [stage, setStage] = useState<Stage>({ kind: 'loading' });
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        previewStaffInvite(code, controller.signal).then(preview => { if (!controller.signal.aborted) setStage({ kind: 'ready', preview }); })
            .catch(failure => { if (!controller.signal.aborted) setStage({ kind: 'broken', message: extractApiErrorMessage(failure, copy('This staff link doesn’t work any more. Ask the club’s admin for a new one.', 'ეს ბმული აღარ მუშაობს. სთხოვეთ კლუბის ადმინს ახალი.')) }); });
        return () => controller.abort();
    }, [code, copy]);
    const join = async (preview: StaffInvitePreview) => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            const joined = await joinStaffInvite(code);
            refreshAccess();
            await refreshNavigationCapabilities().catch(() => undefined);
            navigate(!preview.clubWide && joined.squads.length ? '/my-squads' : `/clubs/${joined.clubId}/workspace`, { replace: true });
        } catch (failure) {
            // "Confirm your email to start as Assistant coach", with Resend, when the server waits on the email.
            if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ თავიდან.')));
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
    const job = preview.job === 'CUSTOM' ? preview.title : jobName(preview.job, preview.title);
    const where = preview.clubWide ? copy('Whole club', 'მთელი კლუბი') : preview.squads.join(', ');
    const closed = preview.status === 'EXPIRED' ? copy('This link has expired. Ask the club’s admin for a new one.', 'ბმულს ვადა გაუვიდა. სთხოვეთ კლუბის ადმინს ახალი.')
        : preview.status === 'USED_UP' ? copy('This link has been used by 10 people. Ask the club’s admin for a new one.', 'ბმული 10-მა ადამიანმა გამოიყენა. სთხოვეთ კლუბის ადმინს ახალი.')
            : preview.status === 'REVOKED' ? copy('This link was switched off. Ask the club’s admin for a new one.', 'ბმული გაითიშა. სთხოვეთ კლუბის ადმინს ახალი.') : null;
    return card(<>
        <div className="ci-head">
            <Crest src={resolveMediaUrl(preview.clubLogoUrl) || null} name={preview.clubName} size={48} />
            <p className="ci-club gk-muted">{preview.clubName}</p>
        </div>
        <h1 className="ci-title">{preview.invitedBy ? copy(`${preview.invitedBy} invited you: ${job}`, `${preview.invitedBy} გიწვევთ: ${job}`) : copy(`Join as ${job}`, `შემოუერთდით: ${job}`)}</h1>
        <ul className="ci-jobs"><li className="ci-job"><strong>{job}</strong><span className="gk-muted">{where}</span></li></ul>
        {closed ? <p role="alert" className="gk-notice gk-notice--warning">{closed}</p> : <>
            <p className="ci-email gk-faint">{copy(`Works until ${formatDate(preview.expiresAt, { day: 'numeric', month: 'short' })}`, `მოქმედებს ${formatDate(preview.expiresAt, { day: 'numeric', month: 'short' })}-მდე`)}</p>
            {error && <p role="alert" className="gk-notice gk-notice--danger">{error}</p>}
            <div className="ci-actions">{isAuthenticated && !adult.allowed ? <p role="status" className="gk-notice gk-notice--warning">{adult.reason}</p>
                : isAuthenticated ? <Button variant="primary" disabled={busy} onClick={() => void join(preview)}>{busy ? copy('Joining…', 'შემოდიხართ…') : copy(`Join as ${job}`, `შემოსვლა: ${job}`)}</Button>
                : <>
                    <ButtonLink variant="primary" to={buildLoginRedirectPath(location.pathname, location.search)}>{copy('Sign in', 'შესვლა')}</ButtonLink>
                    <ButtonLink to={buildSignupPath(`${location.pathname}${location.search}`)}>{copy('Create an account', 'ანგარიშის შექმნა')}</ButtonLink>
                </>}</div>
        </>}
    </>);
}
