import React, { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Hourglass, Loader2, MailCheck } from 'lucide-react';
import { fetchParentApproval, sendParentApproval, type ParentApprovalStatus } from '../api/parentApproval';
import { AuthCenterCard } from '../components/auth/AuthCenterCard';
import { authFieldErrorClass, authGhostButtonClass, authInputClass, authInputErrorClass, authLabelClass, authPrimaryButtonClass } from '../components/auth/authClasses';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorCode } from '../utils/apiError';
import { completedAuthDestination, getAuthFlow } from '../utils/authRedirect';
import { isEmail } from '../utils/registration';

/**
 * "Waiting for your parent": a 13 to 15-year-old's account after sign-up, until a parent approves it with one tap.
 * It shows where the request went with Send again, or asks for the parent's email (a corrected one, or when staff
 * asked for a parent). The answer is checked again whenever the page comes back into view. Nothing else answers the
 * account meanwhile, so the only other way out is signing out.
 */
export function WaitingForParentPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, bootstrapSession, logout } = useAuth();
    const [request, setRequest] = useState<ParentApprovalStatus | null>(null);
    const [editing, setEditing] = useState(false);
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState('');
    // The status could not be read: say so with Try again, never the form (sending would replace a link already sent).
    const [loadFailed, setLoadFailed] = useState(false);

    const load = useCallback((signal?: AbortSignal) => fetchParentApproval(signal)
        .then(found => { setRequest(found); setLoadFailed(false); })
        .catch(() => { if (!signal?.aborted) setLoadFailed(true); }), []);
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        const again = () => { if (document.visibilityState === 'visible') void load(); };
        document.addEventListener('visibilitychange', again);
        return () => { controller.abort(); document.removeEventListener('visibilitychange', again); };
    }, [load]);

    const send = async (parentEmail: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try { setRequest(await sendParentApproval(parentEmail)); setEditing(false); } catch (failure) {
            const code = extractApiErrorCode(failure);
            const wait = Number(isAxiosError(failure) ? failure.response?.headers?.['retry-after'] : NaN);
            if (code === 'PARENT_EMAIL_INVALID') setFieldError(t('auth.parentWait.errEmail'));
            else if (code === 'PARENT_APPROVAL_NOT_NEEDED') void load();
            else setError(isAxiosError(failure) && failure.response?.status === 429
                ? t('auth.parentWait.wait', { seconds: Number.isFinite(wait) && wait > 0 ? Math.ceil(wait) : 60 })
                : t('auth.parentWait.failed'));
        } finally { setBusy(false); }
    };
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const typed = email.trim().toLowerCase();
        if (!isEmail(typed) || typed === user?.email?.toLowerCase()) { setFieldError(t('auth.parentWait.errEmail')); return; }
        void send(typed);
    };
    const enter = async () => {
        const fresh = await bootstrapSession().catch(() => null);
        navigate(completedAuthDestination(fresh ?? user ?? {}, getAuthFlow().nextPath, getAuthFlow().newAccount), { replace: true });
    };

    if (!request && loadFailed) return <AuthCenterCard icon={<Hourglass className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentWait.title')} line={t('auth.parentWait.loadFailed')}>
        <button type="button" className={authPrimaryButtonClass} onClick={() => { setLoadFailed(false); void load(); }}>{t('auth.register.retry')}</button>
    </AuthCenterCard>;
    if (!request) return <AuthCenterCard icon={<Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />} title={t('auth.parentWait.title')} />;
    if (request.status === 'NOT_NEEDED') return <AuthCenterCard icon={<BadgeCheck className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentWait.approved')}>
        <button type="button" className={authPrimaryButtonClass} onClick={() => void enter()}>{t('auth.parentWait.continue')}</button>
    </AuthCenterCard>;

    const sent = request.status === 'WAITING' && Boolean(request.parentEmail) && !editing;
    return <AuthCenterCard icon={sent ? <MailCheck className="h-8 w-8" aria-hidden="true" /> : <Hourglass className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentWait.title')} line={t('auth.parentWait.line')}>
        {sent ? <div className="flex flex-col gap-3">
            <p role="status" className="border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm font-semibold">
                {t('auth.parentWait.sent', { email: request.parentEmail })}
                <span className="mt-1 block text-xs font-normal text-[var(--color-secondary)]">{t('auth.parentWait.sentHint')}</span>
            </p>
            <button type="button" className={authPrimaryButtonClass} disabled={busy} onClick={() => void send(request.parentEmail!)}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : t('auth.parentWait.resend')}
            </button>
            <button type="button" className={authGhostButtonClass} onClick={() => { setEditing(true); setEmail(''); setError(''); }}>{t('auth.parentWait.change')}</button>
        </div> : <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
            <label htmlFor="parent-email" className={authLabelClass}>{t('auth.parentWait.emailLabel')}</label>
            <input id="parent-email" type="email" autoComplete="off" value={email} onChange={event => { setEmail(event.target.value); setFieldError(''); }}
                className={fieldError ? authInputErrorClass : authInputClass} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? 'parent-email-error' : undefined} />
            {fieldError && <p id="parent-email-error" className={authFieldErrorClass}>{fieldError}</p>}
            <button type="submit" className={authPrimaryButtonClass} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : t('auth.parentWait.send')}
            </button>
            {editing && request.parentEmail && <button type="button" className={authGhostButtonClass} onClick={() => { setEditing(false); setFieldError(''); setError(''); }}>{t('auth.parentWait.keep', { email: request.parentEmail })}</button>}
        </form>}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-[color:var(--state-danger)]">{error}</p>}
        <div className="mt-6 flex justify-end border-t border-[color:var(--color-border)]/10 pt-4 text-xs font-semibold">
            <button type="button" className="text-[var(--color-secondary)] hover:text-[var(--color-text)]" onClick={() => void logout().then(() => navigate('/login', { replace: true }))}>{t('auth.parentWait.signOut')}</button>
        </div>
    </AuthCenterCard>;
}
