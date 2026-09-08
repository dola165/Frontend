import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { AlertCircle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { AuthSplitShell } from '../components/auth/AuthSplitShell';
import { GrasskickzLogo } from '../components/layout/GrasskickzLogo';
import {
    authDividerClass,
    authDividerLabelClass,
    authDividerLineClass,
    authFieldErrorClass,
    authInputClass,
    authInputErrorClass,
    authLabelClass,
    authPrimaryButtonClass,
    authRoleCardClass,
    authSecondaryButtonClass,
} from '../components/auth/authClasses';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { isUnder13, todayIso } from '../utils/age';
import {
    buildLoginPath,
    clearAuthFlow,
    completedAuthDestination,
    publicContinuationPath,
    rememberAuthFlow,
    requiredAccountStep,
    resolvePostAuthRedirect,
} from '../utils/authRedirect';

type RoleOption = 'PLAYER' | 'FAN' | 'ORGANIZER';
type RegisterField = 'name' | 'email' | 'password' | 'confirmPassword' | 'dob';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RegisterPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { loginWithAccessToken } = useAuth();
    const [step, setStep] = useState<1 | 2>(1);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<RoleOption>('PLAYER');
    const [dob, setDob] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField, string>>>({});
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/home');

    const passwordRules = [
        { key: 'length', test: (value: string) => value.length >= 8, label: t('auth.register.ruleLength') },
        { key: 'upper', test: (value: string) => /[A-Z]/.test(value), label: t('auth.register.ruleUpper') },
        { key: 'lower', test: (value: string) => /[a-z]/.test(value), label: t('auth.register.ruleLower') },
        { key: 'digit', test: (value: string) => /\d/.test(value), label: t('auth.register.ruleDigit') },
    ];
    const passwordRulesMet = passwordRules.every((rule) => rule.test(password));
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
    const roleOptions: ReadonlyArray<{ id: RoleOption; label: string; desc: string }> = [
        { id: 'PLAYER', label: t('auth.register.rolePlayer'), desc: t('auth.register.rolePlayerDesc') },
        { id: 'ORGANIZER', label: t('auth.register.roleOrganizer'), desc: t('auth.register.roleOrganizerDesc') },
        { id: 'FAN', label: t('auth.register.roleFan'), desc: t('auth.register.roleFanDesc') },
    ];

    const clearFieldError = (field: RegisterField) => setFieldErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
    });

    const validateAccount = () => {
        const errors: Partial<Record<RegisterField, string>> = {};
        if (fullName.trim().length < 2) errors.name = fullName.trim()
            ? t('auth.register.errNameTooShort')
            : t('auth.register.errNameRequired');
        if (!email.trim()) errors.email = t('auth.register.errEmailRequired');
        else if (!EMAIL_PATTERN.test(email.trim())) errors.email = t('auth.register.errEmailInvalid');
        if (!passwordRulesMet) errors.password = t('auth.register.errPasswordWeak');
        if (confirmPassword !== password) errors.confirmPassword = t('auth.register.errConfirmMismatch');
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const continueToDetails = (event: React.FormEvent) => {
        event.preventDefault();
        if (validateAccount()) {
            setError('');
            setStep(2);
        }
    };

    const handleRegister = async (event: React.FormEvent) => {
        event.preventDefault();
        const errors: Partial<Record<RegisterField, string>> = {};
        if (!dob) errors.dob = t('auth.register.errDobRequired');
        else if (isUnder13(dob)) errors.dob = t('auth.register.errUnder13');
        setFieldErrors((current) => ({ ...current, ...errors }));
        if (Object.keys(errors).length > 0) return;

        setIsLoading(true);
        setError('');
        const normalizedEmail = email.trim().toLowerCase();
        try {
            const response = await apiClient.post<{ emailVerificationRequired?: boolean }>('/auth/register', {
                fullName: fullName.trim(),
                email: normalizedEmail,
                password,
                role,
                dateOfBirth: dob,
                continuationPath: publicContinuationPath(nextPath),
            });

            rememberAuthFlow({
                email: normalizedEmail,
                nextPath,
                newAccount: true,
                awaitingVerification: response.data.emailVerificationRequired === true,
            });

            if (response.data.emailVerificationRequired) {
                navigate('/verify-email?pending=1', { replace: true });
                return;
            }

            const loginResponse = await apiClient.post<{ accessToken: string; mustChangePassword?: boolean }>(
                '/auth/login',
                { email: normalizedEmail, password },
            );
            const authenticatedUser = await loginWithAccessToken(loginResponse.data.accessToken);
            const requiredStep = requiredAccountStep({
                ...authenticatedUser,
                mustChangePassword: loginResponse.data.mustChangePassword || authenticatedUser.mustChangePassword,
            });
            if (requiredStep) {
                navigate(requiredStep, { replace: true });
                return;
            }
            const destination = completedAuthDestination(authenticatedUser, nextPath, true);
            clearAuthFlow();
            navigate(destination, { replace: true });
        } catch (requestError) {
            setError(extractApiErrorMessage(requestError, t('auth.register.errSubmitFallback')));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        if (!credentialResponse.credential) return;
        setIsLoading(true);
        setError('');
        rememberAuthFlow({ nextPath });
        try {
            const response = await apiClient.post<{ accessToken: string; newAccount?: boolean }>('/auth/google', {
                token: credentialResponse.credential,
            });
            const authenticatedUser = await loginWithAccessToken(response.data.accessToken);
            rememberAuthFlow({ nextPath, newAccount: response.data.newAccount === true });
            const requiredStep = requiredAccountStep(authenticatedUser);
            if (requiredStep) {
                navigate(requiredStep, { replace: true });
                return;
            }
            const destination = completedAuthDestination(authenticatedUser, nextPath);
            clearAuthFlow();
            navigate(destination, { replace: true });
        } catch (requestError) {
            setError(extractApiErrorMessage(requestError, t('auth.common.googleFailed')));
        } finally {
            setIsLoading(false);
        }
    };

    const field = (
        id: string,
        label: string,
        type: string,
        value: string,
        onChange: (value: string) => void,
        errorKey: RegisterField,
        autoComplete?: string,
    ) => (
        <div className="space-y-2">
            <label htmlFor={id} className={authLabelClass}>{label}</label>
            <input
                id={id}
                type={type}
                value={value}
                onChange={(event) => { onChange(event.target.value); clearFieldError(errorKey); }}
                required
                autoComplete={autoComplete}
                className={fieldErrors[errorKey] ? authInputErrorClass : authInputClass}
                aria-invalid={Boolean(fieldErrors[errorKey])}
            />
            {fieldErrors[errorKey] && <p className={authFieldErrorClass}>{fieldErrors[errorKey]}</p>}
        </div>
    );

    return (
        <AuthSplitShell
            heroMicro={t('auth.register.heroMicro')}
            heroTitle={t('auth.register.heroTitle')}
            heroTagline={t('auth.register.heroTagline')}
            chips={[t('auth.register.chipFollow'), t('auth.register.chipEvents'), t('auth.register.chipFree')]}
            cardHeader={(
                <div className="mb-6">
                    <GrasskickzLogo className="mb-6 lg:hidden" />
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
                        <span>{t('auth.register.stepOf', { current: step, total: 2 })}</span>
                        <span>{step === 1 ? t('auth.register.accountStep') : t('auth.register.detailsStep')}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="h-1 bg-[#16a34a]" />
                        <div className={`h-1 ${step === 2 ? 'bg-[#16a34a]' : 'bg-white/10'}`} />
                    </div>
                </div>
            )}
            footer={(
                <>{t('auth.register.alreadyHave')}{' '}<Link to={buildLoginPath(nextPath)} className="ml-1 text-[#16a34a] hover:underline">{t('auth.register.goLogin')}</Link></>
            )}
        >
            {error && (
                <div className="mb-6 flex items-center gap-2 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                    <AlertCircle className="h-5 w-5 shrink-0" /> {error}
                </div>
            )}

            {step === 1 ? (
                <>
                    <form onSubmit={continueToDetails} className="flex flex-col gap-5" noValidate>
                        {field('auth-name', t('auth.register.labelName'), 'text', fullName, setFullName, 'name', 'name')}
                        {field('auth-email', t('auth.register.labelEmail'), 'email', email, setEmail, 'email', 'email')}
                        {field('auth-password', t('auth.register.labelPassword'), 'password', password, setPassword, 'password', 'new-password')}
                        {password.length > 0 && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                {passwordRules.map((rule) => (
                                    <span key={rule.key} className={`flex items-center gap-1.5 text-[10px] font-semibold ${rule.test(password) ? 'text-[#16a34a]' : 'text-[#a1a1aa]'}`}>
                                        <Check className="h-3.5 w-3.5" /> {rule.label}
                                    </span>
                                ))}
                            </div>
                        )}
                        {field('auth-confirm', t('auth.register.labelConfirm'), 'password', confirmPassword, setConfirmPassword, 'confirmPassword', 'new-password')}
                        {confirmPassword && (
                            <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${passwordsMatch ? 'text-[#16a34a]' : 'text-[#a1a1aa]'}`}>
                                <Check className="h-3.5 w-3.5" /> {t('auth.register.ruleMatch')}
                            </span>
                        )}
                        <button type="submit" className={authPrimaryButtonClass}>{t('auth.register.continue')}</button>
                    </form>
                    <div className={authDividerClass}>
                        <div className={authDividerLineClass} />
                        <span className={authDividerLabelClass}>{t('auth.login.orVia')}</span>
                        <div className={authDividerLineClass} />
                    </div>
                    <GoogleLogin
                        theme="filled_black"
                        size="large"
                        width="100%"
                        text="signup_with"
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError(t('auth.common.googleClosed'))}
                    />
                </>
            ) : (
                <form onSubmit={handleRegister} className="flex flex-col gap-6" noValidate>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-[#f4f4f5]">{t('auth.register.finishTitle')}</h1>
                        <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">{t('auth.register.finishSubtitle')}</p>
                    </div>
                    <div className="space-y-2">
                        <label className={authLabelClass}>{t('auth.register.labelRole')}</label>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {roleOptions.map((option) => (
                                <button type="button" key={option.id} onClick={() => setRole(option.id)} className={authRoleCardClass(role === option.id)}>
                                    <p className="text-sm font-semibold text-[#f4f4f5]">{option.label}</p>
                                    <p className="mt-1 text-[10px] leading-4 text-[#a1a1aa]">{option.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="auth-dob" className={authLabelClass}>{t('auth.register.labelDob')}</label>
                        <input
                            id="auth-dob"
                            type="date"
                            value={dob}
                            max={todayIso()}
                            onChange={(event) => { setDob(event.target.value); clearFieldError('dob'); }}
                            className={fieldErrors.dob ? authInputErrorClass : authInputClass}
                            aria-invalid={Boolean(fieldErrors.dob)}
                        />
                        <p className="text-[10px] leading-4 text-[#a1a1aa]">{t('auth.register.dobHint')}</p>
                        {fieldErrors.dob && <p className={authFieldErrorClass}>{fieldErrors.dob}</p>}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setStep(1)} className={authSecondaryButtonClass} disabled={isLoading}>
                            <ArrowLeft className="h-4 w-4" /> {t('onboarding.back')}
                        </button>
                        <button type="submit" disabled={isLoading} className={`${authPrimaryButtonClass} flex-1`}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.register.submit')}
                        </button>
                    </div>
                </form>
            )}
        </AuthSplitShell>
    );
};
