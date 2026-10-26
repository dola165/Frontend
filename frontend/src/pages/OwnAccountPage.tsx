import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Check, Eye, EyeOff, KeyRound, Loader2, ShieldQuestion } from 'lucide-react';
import { acceptOwnAccount, fetchOwnAccountLink, type OwnAccountLink } from '../api/ownAccount';
import { AuthCenterCard } from '../components/auth/AuthCenterCard';
import { authFieldErrorClass, authInputClass, authInputErrorClass, authLabelClass, authPrimaryButtonClass } from '../components/auth/authClasses';
import { passwordRules } from '../components/auth/passwordRules';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorCode } from '../utils/apiError';
import { rememberAuthFlow, requiredAccountStep } from '../utils/authRedirect';

/** A link that cannot set a password: used (the account exists: sign in), expired (ask again) or not a link at all. */
type Closed = 'used' | 'expired' | 'invalid' | 'failed';

/**
 * A child's own account from the link a parent sent (`/own-account?token=…`, release 7): the child sees their name and
 * email, sets a password, and is signed in to their own account with their football history kept.
 */
export function OwnAccountPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { loginWithAccessToken } = useAuth();
    const token = useSearchParams()[0].get('token') ?? '';
    const [link, setLink] = useState<OwnAccountLink | null | Closed>(token ? null : 'invalid');
    const [email, setEmail] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const rules = passwordRules(t);

    useEffect(() => {
        if (!token) return;
        let active = true;
        fetchOwnAccountLink(token).then(found => {
            if (!active) return;
            setEmail(found.email);
            setLink(found.status === 'PENDING' ? found : found.status === 'USED' ? 'used' : 'expired');
        }).catch(failure => { if (active) setLink(extractApiErrorCode(failure) === 'invalid_token' ? 'invalid' : 'failed'); });
        return () => { active = false; };
    }, [token, attempt]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy) return;
        if (!rules.every(rule => rule.test(password))) { setError(t('auth.register.errPasswordWeak')); return; }
        setBusy(true); setError('');
        try {
            const result = await acceptOwnAccount(token, password);
            setPassword('');
            const user = await loginWithAccessToken(result.accessToken);
            navigate(requiredAccountStep({ ...user, accountState: result.accountState ?? user.accountState }) ?? '/home', { replace: true });
        } catch (failure) {
            const code = extractApiErrorCode(failure);
            if (code === 'used_token') setLink('used');
            else if (code === 'expired_token') setLink('expired');
            else if (code === 'invalid_token') setLink('invalid');
            else setError(code === 'PASSWORD_WEAK' ? t('auth.register.errPasswordWeak') : t('auth.ownAccount.failed'));
        } finally { setBusy(false); }
    };

    if (link === null) return <AuthCenterCard icon={<Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />} title={t('auth.ownAccount.title')} />;
    if (link === 'failed') return <AuthCenterCard icon={<ShieldQuestion className="h-8 w-8" aria-hidden="true" />} title={t('auth.ownAccount.title')} line={t('auth.parentWait.loadFailed')}>
        <button type="button" className={authPrimaryButtonClass} onClick={() => { setLink(null); setAttempt(value => value + 1); }}>{t('auth.register.retry')}</button>
    </AuthCenterCard>;
    if (link === 'used') return <AuthCenterCard icon={<BadgeCheck className="h-8 w-8" aria-hidden="true" />} title={t('auth.ownAccount.used')} line={t('auth.ownAccount.usedLine')}>
        <button type="button" className={authPrimaryButtonClass} onClick={() => { if (email) rememberAuthFlow({ email }); navigate('/login', { replace: true }); }}>{t('auth.ownAccount.signIn')}</button>
    </AuthCenterCard>;
    if (link === 'expired' || link === 'invalid') return <AuthCenterCard icon={<ShieldQuestion className="h-8 w-8" aria-hidden="true" />}
        title={t(link === 'expired' ? 'auth.ownAccount.expired' : 'auth.ownAccount.invalid')} line={t('auth.ownAccount.invalidLine')} />;
    return <AuthCenterCard icon={<KeyRound className="h-8 w-8" aria-hidden="true" />} title={t('auth.ownAccount.title')} line={t('auth.ownAccount.line', { name: link.name.split(' ')[0] })}>
        <form className="flex flex-col gap-3" onSubmit={event => void submit(event)} noValidate>
            {link.email && <p className="text-sm text-[var(--color-secondary)]">{t('auth.ownAccount.email', { email: link.email })}</p>}
            <label htmlFor="own-password" className={authLabelClass}>{t('auth.ownAccount.password')}</label>
            <div className="relative">
                <input id="own-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => { setPassword(event.target.value); setError(''); }}
                    className={`${error ? authInputErrorClass : authInputClass} pr-12`} aria-invalid={Boolean(error)} aria-describedby={error ? 'own-password-error' : undefined} />
                <button type="button" onClick={() => setShow(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-text)]"
                    aria-label={show ? t('auth.register.hidePassword') : t('auth.register.showPassword')} aria-pressed={show}>
                    {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
            </div>
            {password.length > 0 && <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {rules.map(rule => <span key={rule.key} className={`flex items-center gap-1.5 text-[10px] font-semibold ${rule.test(password) ? 'text-[var(--color-accent)]' : 'text-[var(--color-secondary)]'}`}><Check className="h-3.5 w-3.5" aria-hidden="true" /> {rule.label}</span>)}
            </div>}
            {error && <p id="own-password-error" className={authFieldErrorClass}>{error}</p>}
            <button type="submit" className={authPrimaryButtonClass} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : t('auth.ownAccount.submit')}</button>
        </form>
    </AuthCenterCard>;
}
