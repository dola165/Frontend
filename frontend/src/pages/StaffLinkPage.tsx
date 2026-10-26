import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, GkRoot } from '../design/primitives';
import { useAuth } from '../context/AuthContext';
import { Crest } from '../features/world/Crest';
import { useJobWords } from '../features/clubOperations/people/jobWords';
import { joinStaffLink, previewStaffLink, type StaffLinkPreview } from '../features/clubOperations/people/inviteLinkApi';
import { refreshAccess } from '../hooks/useCan';
import { extractApiErrorMessage } from '../utils/apiError';
import { buildLoginRedirectPath, buildSignupPath } from '../utils/authRedirect';
import { formatDate } from '../utils/formatting';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/clubOperations/people/club-invite.css';

type Stage = { kind: 'loading' } | { kind: 'broken'; message: string } | { kind: 'ready'; preview: StaffLinkPreview };

/**
 * Where a staff link or its QR code leads: the club's crest, the one job it gives and where, and one button. Signed
 * out, sign in or create an account and come straight back; signed in, Join, then land in My squads or the club.
 */
export function StaffLinkPage() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    return <StaffLink key={token} token={token} />;
}

function StaffLink({ token }: { token: string }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isBootstrapping, refreshNavigationCapabilities } = useAuth();
    const { copy, jobName } = useJobWords();
    const [loaded, setStage] = useState<Stage>({ kind: 'loading' });
    const stage: Stage = token ? loaded : { kind: 'broken', message: copy('This link is missing its code. Ask the club for a new one.', 'ბმულს კოდი აკლია. სთხოვეთ კლუბს ახალი.') };
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();
        previewStaffLink(token, controller.signal).then(preview => { if (!controller.signal.aborted) setStage({ kind: 'ready', preview }); })
            .catch(failure => { if (!controller.signal.aborted) setStage({ kind: 'broken', message: extractApiErrorMessage(failure, copy('This staff link doesn’t work any more. Ask the club for a new one.', 'ეს ბმული აღარ მუშაობს. სთხოვეთ კლუბს ახალი.')) }); });
        return () => controller.abort();
    }, [token, copy]);
    const join = async () => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            const joined = await joinStaffLink(token);
            refreshAccess();
            await refreshNavigationCapabilities().catch(() => undefined);
            navigate(joined.landing || `/clubs/${joined.clubId}/workspace`, { replace: true });
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ თავიდან.'))); setBusy(false); }
    };

    const card = (children: React.ReactNode) => <GkRoot className="ci-page"><main className="ci-card">{children}</main></GkRoot>;
    if (stage.kind === 'loading' || isBootstrapping) return card(<p role="status" className="gk-muted">{copy('Opening the link…', 'ბმული იხსნება…')}</p>);
    if (stage.kind === 'broken') return card(<>
        <h1 className="ci-title">{copy('This link can’t be used', 'ამ ბმულის გამოყენება შეუძლებელია')}</h1>
        <p role="alert" className="gk-notice gk-notice--danger">{stage.message}</p>
        <Link to="/home">{copy('Go to GrassKickZ', 'GrassKickZ-ზე გადასვლა')}</Link>
    </>);
    const { preview } = stage;
    const job = jobName(preview.job);
    const where = preview.clubWide ? copy('Whole club', 'მთელი კლუბი') : preview.squads.join(', ');
    const back = `${location.pathname}${location.search}`;
    return card(<>
        <div className="ci-head">
            <Crest src={resolveMediaUrl(preview.clubLogoUrl) || null} name={preview.clubName} size={48} />
            <p className="ci-club gk-muted">{preview.clubName}</p>
        </div>
        <h1 className="ci-title">{preview.invitedBy ? copy(`${preview.invitedBy} invited you: ${job}`, `${preview.invitedBy} გიწვევთ: ${job}`) : copy(`Join as ${job}`, `შემოუერთდით: ${job}`)}</h1>
        <ul className="ci-jobs"><li className="ci-job"><strong>{job}</strong><span className="gk-muted">{where}</span></li></ul>
        {preview.unavailableReason ? <p role="alert" className="gk-notice gk-notice--warning">{preview.unavailableReason}</p> : <>
            <p className="ci-email gk-faint">{copy(`Until ${formatDate(preview.expiresAt, { day: 'numeric', month: 'short' })} · ${preview.usesLeft} places left`, `${formatDate(preview.expiresAt, { day: 'numeric', month: 'short' })}-მდე · დარჩა ${preview.usesLeft} ადგილი`)}</p>
            {error && <p role="alert" className="gk-notice gk-notice--danger">{error}</p>}
            <div className="ci-actions">{isAuthenticated
                ? <Button variant="primary" disabled={busy} onClick={() => void join()}>{busy ? copy('Joining…', 'შემოდიხართ…') : copy(`Join as ${job}`, `შემოსვლა: ${job}`)}</Button>
                : <>
                    <ButtonLink variant="primary" to={buildLoginRedirectPath(location.pathname, location.search)}>{copy('Sign in', 'შესვლა')}</ButtonLink>
                    <ButtonLink to={buildSignupPath(back)}>{copy('Create an account', 'ანგარიშის შექმნა')}</ButtonLink>
                </>}</div>
        </>}
    </>);
}
