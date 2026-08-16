import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Loader2, AlertCircle, FlaskConical, QrCode } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { QrLoginSection } from '../components/auth/QrLoginSection';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolvePostAuthRedirect } from '../utils/authRedirect';
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
    { email: 'admin@test.dev', password: 'mock', label: 'Alex Kim', role: 'ADMIN' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { loginWithAccessToken } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showQr, setShowQr] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<'email' | 'password', string>>>({});
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/feed');

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

        try {
            const res = await apiClient.post('/auth/login', { email: email.trim(), password });
            const authenticatedUser = await loginWithAccessToken(res.data.accessToken);
            if (res.data.mustChangePassword) {
                // Card-activated account: the kid must set their own password first.
                navigate('/set-password');
            } else {
                navigate(authenticatedUser.profileComplete ? nextPath : '/onboarding');
            }
        } catch (err) {
            console.error(err);
            setError(extractApiErrorMessage(err, t('auth.login.errInvalid')));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        setIsLoading(true);
        try {
            const res = await apiClient.post('/auth/google', {
                token: credentialResponse.credential,
            });

            const authenticatedUser = await loginWithAccessToken(res.data.accessToken);
            if (!authenticatedUser.profileComplete) {
                navigate('/onboarding');
            } else {
                navigate(nextPath);
            }
        } catch (err) {
            console.error('Google Auth Failed', err);
            setError(extractApiErrorMessage(err, t('auth.common.googleFailed')));
        } finally {
            setIsLoading(false);
        }
    };

    const handleMockLogin = async (mockEmail: string, mockPassword: string) => {
        setIsLoading(true);
        setError('');
        try {
            const res = await apiClient.post('/auth/login', { email: mockEmail, password: mockPassword });
            const authenticatedUser = await loginWithAccessToken(res.data.accessToken);
            navigate(authenticatedUser.profileComplete ? nextPath : '/onboarding');
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
                    <h1 className="text-2xl font-semibold uppercase tracking-tight text-[#f4f4f5]">
                        {t('auth.login.heroTitle')}
                    </h1>
                    <p className="mt-2 text-sm text-[#a1a1aa]">{t('auth.login.heroTagline')}</p>
                </div>
            }
            footer={
                <>
                    {t('auth.login.notYet')}{' '}
                    <Link to="/signup" className="text-[#16a34a] hover:underline ml-1">
                        {t('auth.login.goRegister')}
                    </Link>
                </>
            }
        >
            {showQr ? (
                <QrLoginSection onBack={() => setShowQr(false)} />
            ) : (
                <>
                    {error && (
                        <div className="mb-6 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)] flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
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
                                <Link to="/forgot-password" className="text-[10px] font-semibold text-[#16a34a] hover:underline">
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

                    <div className={authDividerClass}>
                        <div className={authDividerLineClass}></div>
                        <span className={authDividerLabelClass}>{t('auth.login.orVia')}</span>
                        <div className={authDividerLineClass}></div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={() => setShowQr(true)}
                            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[color:var(--accent-muted-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--fc-text-primary)] hover:bg-[var(--fc-surface-hover)] transition-colors"
                        >
                            <QrCode className="h-4 w-4 text-[var(--fc-accent)]" />
                            {t('auth.login.qr')}
                        </button>

                        <GoogleLogin
                            theme="filled_black"
                            size="large"
                            width="100%"
                            text="continue_with"
                            onSuccess={handleGoogleSuccess}
                            onError={() => {
                                setError(t('auth.common.googleClosed'));
                            }}
                        />
                    </div>

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
                                            <p className="text-sm font-semibold text-[#f4f4f5]">{u.label}</p>
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
