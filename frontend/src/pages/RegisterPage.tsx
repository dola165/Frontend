import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Loader2, AlertCircle, Check } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolvePostAuthRedirect } from '../utils/authRedirect';
import { isUnder13, todayIso } from '../utils/age';
import { setPendingName } from '../utils/authNameCarry';
import { AuthSplitShell } from '../components/auth/AuthSplitShell';
import { GrasskickzLogo } from '../components/layout/GrasskickzLogo';
import {
    authInputClass,
    authInputErrorClass,
    authPrimaryButtonClass,
    authLabelClass,
    authHintClass,
    authFieldErrorClass,
    authDividerClass,
    authDividerLineClass,
    authDividerLabelClass,
    authRoleCardClass,
} from '../components/auth/authClasses';

type RoleOption = 'PLAYER' | 'FAN' | 'ORGANIZER' | 'AGENT';

type RegisterField = 'name' | 'email' | 'password' | 'confirmPassword' | 'dob';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RegisterPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { loginWithAccessToken } = useAuth();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<RoleOption>('PLAYER');
    const [dob, setDob] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField, string>>>({});
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/feed');

    // Backend password rule (CreateUserDto: @Size(min=8) + uppercase + lowercase + digit).
    const passwordRules = [
        { key: 'length', test: (p: string) => p.length >= 8, label: t('auth.register.ruleLength') },
        { key: 'upper', test: (p: string) => /[A-Z]/.test(p), label: t('auth.register.ruleUpper') },
        { key: 'lower', test: (p: string) => /[a-z]/.test(p), label: t('auth.register.ruleLower') },
        { key: 'digit', test: (p: string) => /\d/.test(p), label: t('auth.register.ruleDigit') },
    ];
    const passwordRulesMet = passwordRules.every((rule) => rule.test(password));
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

    const roleOptions: ReadonlyArray<{ id: RoleOption; label: string; desc: string }> = [
        { id: 'PLAYER', label: t('auth.register.rolePlayer'), desc: t('auth.register.rolePlayerDesc') },
        { id: 'ORGANIZER', label: t('auth.register.roleOrganizer'), desc: t('auth.register.roleOrganizerDesc') },
        { id: 'AGENT', label: t('auth.register.roleAgent'), desc: t('auth.register.roleAgentDesc') },
        { id: 'FAN', label: t('auth.register.roleFan'), desc: t('auth.register.roleFanDesc') },
    ];

    const clearFieldError = (field: RegisterField) =>
        setFieldErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });

    const validate = (): Partial<Record<RegisterField, string>> => {
        const errors: Partial<Record<RegisterField, string>> = {};
        if (!fullName.trim()) {
            errors.name = t('auth.register.errNameRequired');
        } else if (fullName.trim().length < 2) {
            errors.name = t('auth.register.errNameTooShort');
        }
        if (!email.trim()) {
            errors.email = t('auth.register.errEmailRequired');
        } else if (!EMAIL_PATTERN.test(email.trim())) {
            errors.email = t('auth.register.errEmailInvalid');
        }
        if (!passwordRulesMet) {
            errors.password = t('auth.register.errPasswordWeak');
        }
        if (confirmPassword !== password) {
            errors.confirmPassword = t('auth.register.errConfirmMismatch');
        }
        if (!dob) {
            errors.dob = t('auth.register.errDobRequired');
        } else if (isUnder13(dob)) {
            errors.dob = t('auth.register.errUnder13');
        }
        return errors;
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors = validate();
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;

        // The name rides client-side to onboarding — /auth/register has no name field.
        setPendingName(fullName);
        setIsLoading(true);
        setError('');

        try {
            const normalizedEmail = email.trim();
            await apiClient.post('/auth/register', { email: normalizedEmail, password, role, dateOfBirth: dob });
            const loginRes = await apiClient.post('/auth/login', { email: normalizedEmail, password });
            const authenticatedUser = await loginWithAccessToken(loginRes.data.accessToken);
            navigate(authenticatedUser.profileComplete ? nextPath : '/onboarding');
        } catch (err) {
            console.error(err);
            setError(extractApiErrorMessage(err, t('auth.register.errSubmitFallback')));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        setIsLoading(true);
        try {
            const res = await apiClient.post('/auth/google', {
                token: credentialResponse.credential,
                role,
            });

            const authenticatedUser = await loginWithAccessToken(res.data.accessToken);
            if (!authenticatedUser.dob) {
                navigate('/dob');
            } else if (!authenticatedUser.profileComplete) {
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

    return (
        <AuthSplitShell
            heroMicro={t('auth.register.heroMicro')}
            heroTitle={t('auth.register.heroTitle')}
            heroTagline={t('auth.register.heroTagline')}
            chips={[t('auth.register.chipFollow'), t('auth.register.chipEvents'), t('auth.register.chipFree')]}
            cardHeader={
                <div className="mb-6 lg:hidden">
                    <GrasskickzLogo className="mb-6" />
                    <h1 className="text-2xl font-semibold uppercase tracking-tight text-[#f4f4f5]">
                        {t('auth.register.heroTitle')}
                    </h1>
                    <p className="mt-2 text-sm text-[#a1a1aa]">{t('auth.register.heroTagline')}</p>
                </div>
            }
            footer={
                <>
                    {t('auth.register.alreadyHave')}{' '}
                    <Link to="/login" className="text-[#16a34a] hover:underline ml-1">
                        {t('auth.register.goLogin')}
                    </Link>
                </>
            }
        >
            {error && (
                <div className="mb-6 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)] flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                </div>
            )}

            <form onSubmit={handleRegister} className="flex flex-col gap-5" noValidate>
                <div className="space-y-2">
                    <label className={authLabelClass}>{t('auth.register.labelRole')}</label>
                    <div className="grid grid-cols-2 gap-2">
                        {roleOptions.map((option) => (
                            <button
                                type="button"
                                key={option.id}
                                onClick={() => setRole(option.id)}
                                className={authRoleCardClass(role === option.id)}
                            >
                                <p className="font-semibold uppercase tracking-[0.14em] text-sm text-[#f4f4f5]">
                                    {option.label}
                                </p>
                                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a1a1aa]">
                                    {option.desc}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="auth-name" className={authLabelClass}>
                        {t('auth.register.labelName')}
                    </label>
                    <input
                        id="auth-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                            setFullName(e.target.value);
                            clearFieldError('name');
                        }}
                        required
                        autoComplete="name"
                        className={fieldErrors.name ? authInputErrorClass : authInputClass}
                        placeholder={t('auth.register.namePlaceholder')}
                        aria-invalid={!!fieldErrors.name}
                        aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined}
                    />
                    {fieldErrors.name && (
                        <p id="auth-name-error" className={authFieldErrorClass}>
                            {fieldErrors.name}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="auth-email" className={authLabelClass}>
                        {t('auth.register.labelEmail')}
                    </label>
                    <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            clearFieldError('email');
                        }}
                        required
                        autoComplete="email"
                        className={fieldErrors.email ? authInputErrorClass : authInputClass}
                        placeholder={t('auth.register.emailPlaceholder')}
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
                    />
                    {fieldErrors.email && (
                        <p id="auth-email-error" className={authFieldErrorClass}>
                            {fieldErrors.email}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="auth-password" className={authLabelClass}>
                        {t('auth.register.labelPassword')}
                    </label>
                    <input
                        id="auth-password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            clearFieldError('password');
                        }}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className={fieldErrors.password ? authInputErrorClass : authInputClass}
                        placeholder="********"
                        aria-invalid={!!fieldErrors.password}
                        aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
                    />
                    {password.length > 0 && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {passwordRules.map((rule) => (
                                <div
                                    key={rule.key}
                                    className={`flex items-center gap-1.5 text-[10px] font-semibold ${
                                        rule.test(password) ? 'text-[#16a34a]' : 'text-[#a1a1aa]'
                                    }`}
                                >
                                    <Check className="w-3.5 h-3.5 shrink-0" /> {rule.label}
                                </div>
                            ))}
                            <div
                                className={`flex items-center gap-1.5 text-[10px] font-semibold ${
                                    passwordsMatch ? 'text-[#16a34a]' : 'text-[#a1a1aa]'
                                }`}
                            >
                                <Check className="w-3.5 h-3.5 shrink-0" /> {t('auth.register.ruleMatch')}
                            </div>
                        </div>
                    )}
                    {fieldErrors.password && (
                        <p id="auth-password-error" className={authFieldErrorClass}>
                            {fieldErrors.password}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="auth-confirm" className={authLabelClass}>
                        {t('auth.register.labelConfirm')}
                    </label>
                    <input
                        id="auth-confirm"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            clearFieldError('confirmPassword');
                        }}
                        required
                        autoComplete="new-password"
                        className={fieldErrors.confirmPassword ? authInputErrorClass : authInputClass}
                        placeholder="********"
                        aria-invalid={!!fieldErrors.confirmPassword}
                        aria-describedby={fieldErrors.confirmPassword ? 'auth-confirm-error' : undefined}
                    />
                    {fieldErrors.confirmPassword && (
                        <p id="auth-confirm-error" className={authFieldErrorClass}>
                            {fieldErrors.confirmPassword}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="auth-dob" className={authLabelClass}>
                        {t('auth.register.labelDob')}
                    </label>
                    <input
                        id="auth-dob"
                        type="date"
                        value={dob}
                        max={todayIso()}
                        onChange={(e) => {
                            setDob(e.target.value);
                            clearFieldError('dob');
                        }}
                        required
                        className={fieldErrors.dob ? authInputErrorClass : authInputClass}
                        aria-invalid={!!fieldErrors.dob}
                        aria-describedby={fieldErrors.dob ? 'auth-dob-error' : undefined}
                    />
                    {!fieldErrors.dob && <p className={authHintClass}>{t('auth.register.dobHint')}</p>}
                    {fieldErrors.dob && (
                        <p id="auth-dob-error" className={authFieldErrorClass}>
                            {fieldErrors.dob}
                        </p>
                    )}
                </div>

                <button type="submit" disabled={isLoading} className={authPrimaryButtonClass}>
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('auth.register.submit')}
                </button>
            </form>

            <div className={authDividerClass}>
                <div className={authDividerLineClass}></div>
                <span className={authDividerLabelClass}>{t('auth.common.orVia')}</span>
                <div className={authDividerLineClass}></div>
            </div>

            <div className="flex justify-center w-full">
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
        </AuthSplitShell>
    );
};
