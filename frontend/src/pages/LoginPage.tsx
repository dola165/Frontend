import React, { lazy, Suspense, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, QrCode } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { isAndroidApp } from '../android/bridge';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSecondFactorLogin } from '../components/auth/useSecondFactorLogin';
import { SecondFactorPrompt } from '../components/auth/SecondFactorPrompt';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import {
    buildSignupPath,
    completedAuthDestination,
    getAuthFlow,
    rememberAuthFlow,
    requiredAccountStep,
    resolvePostAuthRedirect,
} from '../utils/authRedirect';
import { AuthSplitShell } from '../components/auth/AuthSplitShell';
import { GrasskickzLogo } from '../components/layout/GrasskickzLogo';
import {
    authInputClass,
    authInputErrorClass,
    authPrimaryButtonClass,
    authLabelClass,
    authFieldErrorClass,
    authDividerClass,
    authDividerLineClass,
    authDividerLabelClass,
} from '../components/auth/authClasses';

// The QR code library loads only when someone opens QR sign-in, not with the app.
const QrLoginSection = lazy(() => import('../components/auth/QrLoginSection').then(module => ({ default: module.QrLoginSection })));

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { loginWithAccessToken } = useAuth();
    const secondFactor = useSecondFactorLogin();
    const [email, setEmail] = useState(() => getAuthFlow().email ?? '');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showQr, setShowQr] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<'email' | 'password', string>>>({});
    // The server knows no account with this email: offered "Create one?" with what was typed kept.
    const [unknownEmail, setUnknownEmail] = useState(false);
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '');

    const navigateAfterLogin = (
        authenticatedUser: Awaited<ReturnType<typeof loginWithAccessToken>>,
        mustChangePassword = false,
        newAccount?: boolean,
    ) => {
        rememberAuthFlow({ nextPath, ...(newAccount === undefined ? {} : { newAccount }) });
        const requiredStep = requiredAccountStep({
            ...authenticatedUser,
            mustChangePassword: mustChangePassword || authenticatedUser.mustChangePassword,
        });
        if (requiredStep) {
            navigate(requiredStep, { replace: true });
            return;
        }
        const flow = getAuthFlow();
        const destination = completedAuthDestination(authenticatedUser, nextPath, flow.newAccount);
        navigate(destination, { replace: true });
    };

    const clearFieldError = (field: 'email' | 'password') =>
        setFieldErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });

    const validate = (): Partial<Record<'email' | 'password', string>> => {
        const errors: Partial<Record<'email' | 'password', string>> = {};
        if (!email.trim()) {
            errors.email = t('auth.login.errEmailRequired');
        } else if (!EMAIL_PATTERN.test(email.trim())) {
            errors.email = t('auth.login.errEmailInvalid');
        }
        if (!password) {
            errors.password = t('auth.login.errPasswordRequired');
        }
        return errors;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors = validate();
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setIsLoading(true);
        setError('');
        setUnknownEmail(false);

        try {
            const result = await secondFactor.authenticate({ kind: 'password', email: email.trim(), password });
            if (!result) return;
            setPassword('');
            const authenticatedUser = await loginWithAccessToken(result.accessToken);
            navigateAfterLogin({ ...authenticatedUser, accountState: result.accountState ?? authenticatedUser.accountState }, result.mustChangePassword === true);
        } catch (err) {
            const code = extractApiErrorCode(err);
            if (code === 'ACCOUNT_NOT_FOUND') { setUnknownEmail(true); return; }
            // After five failed tries the server asks for a growing wait; other limits are per minute.
            const wait = Number(isAxiosError(err) ? err.response?.headers?.['retry-after'] : NaN);
            setError(code === 'SIGN_IN_DELAYED' || code === 'TOO_MANY_REQUESTS'
                ? t('auth.login.errDelayed', { seconds: Number.isFinite(wait) && wait > 0 ? Math.ceil(wait) : 60 })
                : extractApiErrorMessage(err, t('auth.login.errInvalid')));
        } finally {
            setIsLoading(false);
        }
    };

    const createInstead = () => {
        setPassword('');
        rememberAuthFlow({ email: email.trim().toLowerCase(), nextPath });
        navigate(buildSignupPath(nextPath));
    };

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        if (!credentialResponse.credential) return;
        setIsLoading(true);
        setError('');
        try {
            const result = await secondFactor.authenticate({ kind: 'google', token: credentialResponse.credential });
            if (!result) return;
            rememberAuthFlow({ nextPath, newAccount: result.newAccount === true });
            const authenticatedUser = await loginWithAccessToken(result.accessToken);
            navigateAfterLogin({ ...authenticatedUser, accountState: result.accountState ?? authenticatedUser.accountState }, result.mustChangePassword === true, result.newAccount === true);
        } catch (err) {
            setError(extractApiErrorMessage(err, t('auth.common.googleFailed')));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthSplitShell
            heroMicro={t('auth.login.heroMicro')}
            heroTitle={t('auth.login.heroTitle')}
            heroTagline={t('auth.login.heroTagline')}
            chips={[t('auth.login.chipFollow'), t('auth.login.chipEvents'), t('auth.login.chipFree')]}
            cardHeader={
                <div className="mb-6 lg:hidden">
                    <GrasskickzLogo className="mb-6" />
                    <h1 className="text-2xl font-semibold uppercase tracking-tight text-[var(--color-text)]">
                        {t('auth.login.heroTitle')}
                    </h1>
                    <p className="mt-2 text-sm text-[var(--color-secondary)]">{t('auth.login.heroTagline')}</p>
                </div>
            }
            footer={
                <>
                    {t('auth.login.notYet')}{' '}
                    <Link to={buildSignupPath(nextPath)} className="ml-1 app-text-action">
                        {t('auth.login.goRegister')}
                    </Link>
                </>
            }
        >
            {new URLSearchParams(location.search).get('passwordChanged') === '1' && <p role="status" className="mb-4 text-sm text-[var(--color-secondary)]">Sign in with your new password to continue.</p>}
            {secondFactor.challenge ? <SecondFactorPrompt pending={secondFactor.pending} error={secondFactor.error} onSubmit={code => void secondFactor.submit(code)} onCancel={() => { secondFactor.cancel(); setPassword(''); }} /> : showQr ? (
                <Suspense fallback={<div className="flex flex-col items-center gap-4 py-6"><Loader2 className="h-8 w-8 animate-spin text-[var(--fc-accent)]" /><p className="text-sm text-[var(--fc-text-secondary)]">Generating QR code…</p></div>}>
                    <QrLoginSection onBack={() => setShowQr(false)} />
                </Suspense>
            ) : (
                <>
                    {error && (
                        <div className="mb-6 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="flex flex-col gap-5" noValidate>
                        <div className="space-y-2">
                            <label htmlFor="auth-login-email" className={authLabelClass}>
                                {t('auth.login.labelEmail')}
                            </label>
                            <input
                                id="auth-login-email"
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    clearFieldError('email');
                                    setUnknownEmail(false);
                                }}
                                required
                                autoComplete="email"
                                className={fieldErrors.email ? authInputErrorClass : authInputClass}
                                placeholder={t('auth.login.emailPlaceholder')}
                                aria-invalid={!!fieldErrors.email}
                                aria-describedby={fieldErrors.email ? 'auth-login-email-error' : undefined}
                            />
                            {fieldErrors.email && (
                                <p id="auth-login-email-error" className={authFieldErrorClass}>
                                    {fieldErrors.email}
                                </p>
                            )}
                            {unknownEmail && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
                                <span>{t('auth.login.noAccount')}</span>
                                <button type="button" onClick={createInstead} className="min-h-9 px-3 text-xs font-semibold text-[var(--color-on-accent)] bg-[var(--color-accent)]">{t('auth.login.goRegister')}</button>
                            </div>}
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label htmlFor="auth-login-password" className={authLabelClass}>
                                    {t('auth.login.labelPassword')}
                                </label>
                                <Link to="/forgot-password" className="text-[10px] font-semibold app-text-action">
                                    {t('auth.login.forgot')}
                                </Link>
                            </div>
                            <input
                                id="auth-login-password"
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    clearFieldError('password');
                                }}
                                required
                                autoComplete="current-password"
                                className={fieldErrors.password ? authInputErrorClass : authInputClass}
                                placeholder="********"
                                aria-invalid={!!fieldErrors.password}
                                aria-describedby={fieldErrors.password ? 'auth-login-password-error' : undefined}
                            />
                            {fieldErrors.password && (
                                <p id="auth-login-password-error" className={authFieldErrorClass}>
                                    {fieldErrors.password}
                                </p>
                            )}
                        </div>

                        <button type="submit" disabled={isLoading} className={authPrimaryButtonClass}>
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('auth.login.submit')}
                        </button>
                    </form>

                    {!isAndroidApp && <div className={authDividerClass}>
                        <div className={authDividerLineClass}></div>
                        <span className={authDividerLabelClass}>{t('auth.login.orVia')}</span>
                        <div className={authDividerLineClass}></div>
                    </div>}

                    {!isAndroidApp && <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={() => setShowQr(true)}
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[color:var(--accent-muted-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--fc-text-primary)] hover:bg-[var(--fc-surface-hover)] transition-colors"
                        >
                            <QrCode className="h-4 w-4 text-[var(--fc-accent)]" />
                            {t('auth.login.qr')}
                        </button>

                        {!isAndroidApp && <GoogleLogin
                            theme="filled_black"
                            size="large"
                            width="100%"
                            text="continue_with"
                            onSuccess={handleGoogleSuccess}
                            onError={() => {
                                setError(t('auth.common.googleClosed'));
                            }}
                        />}
                    </div>}
                </>
            )}
        </AuthSplitShell>
    );
};
