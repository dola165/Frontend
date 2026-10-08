import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Loader2, AlertCircle, FlaskConical, QrCode } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { isAndroidApp } from '../android/bridge';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { QrLoginSection } from '../components/auth/QrLoginSection';
import { useSecondFactorLogin } from '../components/auth/useSecondFactorLogin';
import { SecondFactorPrompt } from '../components/auth/SecondFactorPrompt';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import {
    buildSignupPath,
    completedAuthDestination,
    getAuthFlow,
    publicContinuationPath,
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

const IS_MOCK_MODE = import.meta.env.VITE_ENABLE_MOCKS === 'true';

const MOCK_USERS = [
    { email: 'player@test.dev', password: 'mock', label: 'Marcus Rivera', role: 'PLAYER' },
    { email: 'organizer@test.dev', password: 'mock', label: 'Sarah Chen', role: 'ORGANIZER' },
    { email: 'coach@test.dev', password: 'mock', label: 'James Wilson', role: 'COACH' },
    { email: 'fan@test.dev', password: 'mock', label: 'Emma Thompson', role: 'FAN' },
    { email: 'admin@test.dev', password: 'mock', label: 'Alex Kim', role: 'SYSTEM_ADMIN' },
];

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
    const [emailNotVerified, setEmailNotVerified] = useState(false);
    const [isResendingVerification, setIsResendingVerification] = useState(false);
    const [resendConfirmation, setResendConfirmation] = useState<string | null>(null);
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
        setEmailNotVerified(false);
        setResendConfirmation(null);

        try {
            const result = await secondFactor.authenticate({ kind: 'password', email: email.trim(), password });
            if (!result) return;
            setPassword('');
            const authenticatedUser = await loginWithAccessToken(result.accessToken);
            navigateAfterLogin(authenticatedUser, result.mustChangePassword === true);
        } catch (err) {
            setError(extractApiErrorMessage(err, t('auth.login.errInvalid')));
            setEmailNotVerified(extractApiErrorCode(err) === 'EMAIL_NOT_VERIFIED');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendLoginVerification = async () => {
        setIsResendingVerification(true);
        try {
            const res = await apiClient.post<{ message?: string }>('/auth/resend-verification', {
                email: email.trim(),
                continuationPath: publicContinuationPath(nextPath),
            });
            setError('');
            setEmailNotVerified(false);
            setResendConfirmation(res.data?.message ?? 'Verification email sent.');
        } catch (err) {
            setError(extractApiErrorMessage(err, 'Could not resend the verification email. Please try again.'));
        } finally {
            setIsResendingVerification(false);
        }
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
            navigateAfterLogin(authenticatedUser, result.mustChangePassword === true, result.newAccount === true);
        } catch (err) {
            setError(extractApiErrorMessage(err, t('auth.common.googleFailed')));
        } finally {
            setIsLoading(false);
        }
    };

    const handleMockLogin = async (mockEmail: string, mockPassword: string) => {
        setIsLoading(true);
        setError('');
        try {
            const result = await secondFactor.authenticate({ kind: 'password', email: mockEmail, password: mockPassword });
            if (!result) return;
            const authenticatedUser = await loginWithAccessToken(result.accessToken);
            navigateAfterLogin(authenticatedUser);
        } catch (err) {
            setError(extractApiErrorMessage(err, 'Mock login failed.'));
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
                <QrLoginSection onBack={() => setShowQr(false)} />
            ) : (
                <>
                    {error && (
                        <div className="mb-6 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                            </div>
                            {emailNotVerified && (
                                <button
                                    type="button"
                                    onClick={() => void handleResendLoginVerification()}
                                    disabled={isResendingVerification}
                                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--state-danger)] px-4 py-2 text-xs font-semibold text-[color:var(--state-danger)] transition-colors hover:bg-[color:var(--state-danger)] hover:text-[color:var(--color-text)] disabled:opacity-60"
                                >
                                    {isResendingVerification ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        'Resend verification email'
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {resendConfirmation && (
                        <div className="mb-6 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm font-semibold text-[var(--color-accent)]">
                            {resendConfirmation}
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

                    {IS_MOCK_MODE && (
                        <>
                            <div className="my-8 flex items-center gap-4">
                                <div className="h-px bg-[color:var(--accent-muted-soft)] flex-1"></div>
                                <span className="text-[10px] font-semibold accent-muted flex items-center gap-1.5">
                                    <FlaskConical className="w-3.5 h-3.5" />
                                    {t('auth.login.mockLabel')}
                                </span>
                                <div className="h-px bg-[color:var(--accent-muted-soft)] flex-1"></div>
                            </div>

                            <div className="flex flex-col gap-2">
                                {MOCK_USERS.map((u) => (
                                    <button
                                        key={u.email}
                                        type="button"
                                        disabled={isLoading}
                                        onClick={() => handleMockLogin(u.email, u.password)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[color:var(--accent-muted-soft)] bg-[color:var(--accent-muted-soft)] hover:opacity-80 text-left transition-colors disabled:opacity-50"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-[color:var(--accent-muted)]/20 flex items-center justify-center text-xs font-semibold accent-muted shrink-0">
                                            {u.label.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-[var(--color-text)]">{u.label}</p>
                                            <p className="text-[10px] font-semibold accent-muted">{u.role}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </AuthSplitShell>
    );
};
