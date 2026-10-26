import React, { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Hourglass, Loader2, MailCheck } from 'lucide-react';
import { fetchParentApproval, resendParentApproval, sendParentApproval, type ParentApprovalRequest } from '../api/parentApproval';
import { AuthCenterCard } from '../components/auth/AuthCenterCard';
import { authFieldErrorClass, authGhostButtonClass, authInputClass, authInputErrorClass, authLabelClass, authPrimaryButtonClass } from '../components/auth/authClasses';
import { useAuth } from '../context/AuthContext';
import { completedAuthDestination, getAuthFlow } from '../utils/authRedirect';
import { isEmail } from '../utils/registration';

/**
 * "Waiting for your parent": a 13 to 15-year-old's account after sign-up, until a parent approves it with one tap.
 * One field (the parent's email), then "Sent" with Send again; the answer is checked again whenever the page comes
 * back into view. Looking around stays open meanwhile; the server refuses everything else.
 */
export function WaitingForParentPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, bootstrapSession, logout } = useAuth();
    const [request, setRequest] = useState<ParentApprovalRequest | null>(null);
    const [editing, setEditing] = useState(false);
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState('');

    const load = useCallback((signal?: AbortSignal) => fetchParentApproval(signal)
        .then(setRequest)
        .catch(() => { if (!signal?.aborted) setRequest(current => current ?? { status: 'NOT_SENT' }); }), []);
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        const again = () => { if (document.visibilityState === 'visible') void load(); };
        document.addEventListener('visibilitychange', again);
        return () => { controller.abort(); document.removeEventListener('visibilitychange', again); };
    }, [load]);

    const failed = (failure: unknown) => {
        const wait = Number(isAxiosError(failure) ? failure.response?.headers?.['retry-after'] : NaN);
        setError(isAxiosError(failure) && failure.response?.status === 429 && Number.isFinite(wait) && wait > 0
            ? t('auth.parentWait.wait', { seconds: Math.ceil(wait) })
            : t('auth.parentWait.failed'));
    };
    const send = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy) return;
        if (!isEmail(email) || email.trim().toLowerCase() === user?.email?.toLowerCase()) { setFieldError(t('auth.parentWait.errEmail')); return; }
        setBusy(true); setError('');
        try { setRequest(await sendParentApproval(email.trim().toLowerCase())); setEditing(false); } catch (failure) { failed(failure); } finally { setBusy(false); }
    };
    const resend = async () => {
        if (busy) return;
        setBusy(true); setError('');
        try { setRequest(await resendParentApproval()); } catch (failure) { failed(failure); } finally { setBusy(false); }
    };
    const enter = async () => {
        const fresh = await bootstrapSession().catch(() => null);
        navigate(completedAuthDestination(fresh ?? user ?? {}, getAuthFlow().nextPath, getAuthFlow().newAccount), { replace: true });
    };

    if (!request) return <AuthCenterCard icon={<Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />} title={t('auth.parentWait.title')} />;
    if (request.status === 'APPROVED') return <AuthCenterCard icon={<BadgeCheck className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentWait.approved')}>
        <button type="button" className={authPrimaryButtonClass} onClick={() => void enter()}>{t('auth.parentWait.continue')}</button>
    </AuthCenterCard>;

    const sent = request.status === 'SENT' && !editing;
    return <AuthCenterCard icon={sent ? <MailCheck className="h-8 w-8" aria-hidden="true" /> : <Hourglass className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentWait.title')} line={t('auth.parentWait.line')}>
        {sent ? <div className="flex flex-col gap-3">
            <p role="status" className="border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm font-semibold">
                {t('auth.parentWait.sent', { email: request.parentEmail ?? '' })}
                <span className="mt-1 block text-xs font-normal text-[var(--color-secondary)]">{t('auth.parentWait.sentHint')}</span>
            </p>
            <button type="button" className={authPrimaryButtonClass} disabled={busy} onClick={() => void resend()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : t('auth.parentWait.resend')}
            </button>
            <button type="button" className={authGhostButtonClass} onClick={() => { setEditing(true); setEmail(''); setError(''); }}>{t('auth.parentWait.change')}</button>
        </div> : <form className="flex flex-col gap-3" onSubmit={send} noValidate>
            <label htmlFor="parent-email" className={authLabelClass}>{t('auth.parentWait.emailLabel')}</label>
            <input id="parent-email" type="email" autoComplete="off" value={email} onChange={event => { setEmail(event.target.value); setFieldError(''); }}
                className={fieldError ? authInputErrorClass : authInputClass} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? 'parent-email-error' : undefined} />
            {fieldError && <p id="parent-email-error" className={authFieldErrorClass}>{fieldError}</p>}
            <button type="submit" className={authPrimaryButtonClass} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : t('auth.parentWait.send')}
            </button>
        </form>}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-[color:var(--state-danger)]">{error}</p>}
        <div className="mt-6 flex items-center justify-between border-t border-[color:var(--color-border)]/10 pt-4 text-xs font-semibold">
            <Link to="/world" className="app-text-action">{t('auth.parentWait.lookAround')}</Link>
            <button type="button" className="text-[var(--color-secondary)] hover:text-[var(--color-text)]" onClick={() => void logout().then(() => navigate('/login', { replace: true }))}>{t('auth.parentWait.signOut')}</button>
        </div>
    </AuthCenterCard>;
}
